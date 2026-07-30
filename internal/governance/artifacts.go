package governance

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/GolemWorkers/agentintel/internal/domain"
	"github.com/GolemWorkers/agentintel/internal/policy"
)

const DefaultMaximumArtifactBytes int64 = 128 << 20
const maximumArtifactRows int64 = 10_000_000

type artifactContract struct {
	mediaType string
	schemaID  string
}

var phaseOneArtifactContracts = map[string]artifactContract{
	"arrow":   {mediaType: "application/vnd.apache.arrow.file", schemaID: "golem.observations.v1"},
	"parquet": {mediaType: "application/vnd.apache.parquet", schemaID: "golem.observations.v1"},
	"raw":     {mediaType: "application/x-ndjson", schemaID: "golem.observations.v1"},
	"report":  {mediaType: "application/json", schemaID: "golem.comparison-report.v1"},
}

var (
	ErrUnsafePath       = errors.New("unsafe artifact path")
	ErrArtifactMismatch = errors.New("artifact integrity mismatch")
	ErrArtifactTooLarge = errors.New("artifact exceeds size limit")
	// ErrProjectionMismatch identifies a report whose claimed entity
	// projections disagree with the evidence it cites. It is also an artifact
	// mismatch so callers that only need the broad integrity category remain
	// compatible.
	ErrProjectionMismatch = errors.New("artifact projection mismatch")
)

type EvidenceManifest struct {
	ManifestVersion int                    `json:"manifest_version"`
	RunID           string                 `json:"run_id"`
	CommittedAt     time.Time              `json:"committed_at"`
	Provenance      domain.Provenance      `json:"provenance"`
	Artifacts       []ManifestArtifactItem `json:"artifacts"`
}

type ManifestArtifactItem struct {
	RelativePath      string  `json:"relative_path"`
	MediaType         string  `json:"media_type"`
	SHA256            string  `json:"sha256"`
	SizeBytes         int64   `json:"size_bytes"`
	RowCount          int64   `json:"row_count,omitempty"`
	SchemaID          string  `json:"schema_id"`
	MinimumObservedAt *string `json:"minimum_observed_at,omitempty"`
	MaximumObservedAt *string `json:"maximum_observed_at,omitempty"`
	DataClass         string  `json:"data_class"`
}

type CommitOptions struct {
	DataRoot           string
	RunID              string
	StageDir           string
	Descriptors        []domain.ArtifactDescriptor
	MaximumBytes       int64
	CommittedAt        time.Time
	Provenance         domain.Provenance
	AllowLegacyFixture bool
}

type CommitResult struct {
	Artifacts    []domain.Artifact
	Manifest     EvidenceManifest
	EvidenceDir  string
	Observations []domain.Observation
	Report       domain.ComparisonReport
}

func CleanRelativePath(value string) (string, error) {
	if value == "" || strings.ContainsRune(value, '\x00') || strings.Contains(value, "\\") {
		return "", fmt.Errorf("%w: invalid relative path", ErrUnsafePath)
	}
	if filepath.IsAbs(value) || filepath.VolumeName(value) != "" {
		return "", fmt.Errorf("%w: absolute path", ErrUnsafePath)
	}
	clean := filepath.Clean(value)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("%w: traversal", ErrUnsafePath)
	}
	if clean != value {
		return "", fmt.Errorf("%w: path is not canonical", ErrUnsafePath)
	}
	return clean, nil
}

func CommitEvidence(options CommitOptions) (_ CommitResult, err error) {
	if options.RunID == "" || len(options.Descriptors) == 0 {
		return CommitResult{}, fmt.Errorf("commit evidence: run id and artifacts are required")
	}
	maximum := options.MaximumBytes
	if maximum <= 0 {
		maximum = DefaultMaximumArtifactBytes
	}
	committedAt := options.CommittedAt.UTC()
	if committedAt.IsZero() {
		committedAt = time.Now().UTC()
	}
	root, err := filepath.Abs(options.DataRoot)
	if err != nil {
		return CommitResult{}, fmt.Errorf("resolve data root: %w", err)
	}
	stage, err := filepath.Abs(options.StageDir)
	if err != nil {
		return CommitResult{}, fmt.Errorf("resolve stage directory: %w", err)
	}
	if err := requireContained(root, stage); err != nil {
		return CommitResult{}, err
	}
	stageInfo, err := os.Lstat(stage)
	if err != nil || !stageInfo.IsDir() || stageInfo.Mode()&os.ModeSymlink != 0 {
		return CommitResult{}, fmt.Errorf("%w: staging directory is not a real directory", ErrUnsafePath)
	}

	items := make([]ManifestArtifactItem, 0, len(options.Descriptors))
	seen := make(map[string]struct{}, len(options.Descriptors))
	reportCount := 0
	kindCounts := make(map[string]int)
	canonical := make(map[string][]domain.Observation)
	var report domain.ComparisonReport
	for _, descriptor := range options.Descriptors {
		clean, cleanErr := CleanRelativePath(descriptor.RelativePath)
		if cleanErr != nil {
			return CommitResult{}, cleanErr
		}
		if _, exists := seen[clean]; exists {
			return CommitResult{}, fmt.Errorf("duplicate artifact path %q", clean)
		}
		seen[clean] = struct{}{}
		if err := validateArtifactMetadata(descriptor); err != nil {
			return CommitResult{}, fmt.Errorf("artifact %q: %w", clean, err)
		}
		if err := policy.ValidateDataClass(descriptor.DataClass); err != nil {
			return CommitResult{}, err
		}
		path := filepath.Join(stage, clean)
		if err := VerifyFile(stage, path, descriptor.SizeBytes, descriptor.SHA256, maximum); err != nil {
			return CommitResult{}, fmt.Errorf("artifact %q: %w", clean, err)
		}
		if err := validateArtifactContents(path, options.RunID, descriptor); err != nil {
			return CommitResult{}, fmt.Errorf("artifact %q: %w", clean, err)
		}
		switch descriptor.Kind {
		case "arrow":
			canonical["arrow"], err = parseArrowEvidence(path, committedAt)
		case "parquet":
			canonical["parquet"], err = parseParquetEvidence(path, committedAt)
		case "report":
			report, err = readReportJSON(path, options.RunID, descriptor.RowCount)
		}
		if err != nil {
			return CommitResult{}, fmt.Errorf("artifact %q: %w", clean, err)
		}
		if descriptor.Kind == "report" {
			reportCount++
		}
		kindCounts[descriptor.Kind]++
		items = append(items, ManifestArtifactItem{
			RelativePath: clean, MediaType: descriptor.MediaType, SHA256: descriptor.SHA256,
			SizeBytes: descriptor.SizeBytes, RowCount: descriptor.RowCount, SchemaID: descriptor.SchemaID,
			MinimumObservedAt: descriptor.MinimumObservedAt, MaximumObservedAt: descriptor.MaximumObservedAt,
			DataClass: descriptor.DataClass,
		})
	}
	if reportCount != 1 {
		return CommitResult{}, fmt.Errorf("%w: evidence must declare exactly one report", ErrArtifactMismatch)
	}
	if err := verifyDeclaredOutputSet(stage, seen); err != nil {
		return CommitResult{}, err
	}
	canonicalRows, authorityProvenance, err := validateEvidenceSemantics(options.Descriptors, options.AllowLegacyFixture, kindCounts, canonical, report, options.Provenance)
	if err != nil {
		return CommitResult{}, err
	}
	options.Provenance = authorityProvenance
	if options.Provenance.WorkerVersion == "" || options.Provenance.ModelVersion == "" || options.Provenance.ConnectorVersion == "" || options.Provenance.ParserVersion == "" {
		return CommitResult{}, fmt.Errorf("%w: evidence provenance is incomplete", ErrArtifactMismatch)
	}
	manifest := EvidenceManifest{ManifestVersion: 1, RunID: options.RunID, CommittedAt: committedAt, Provenance: options.Provenance, Artifacts: items}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return CommitResult{}, fmt.Errorf("encode evidence manifest: %w", err)
	}
	manifestBytes = append(manifestBytes, '\n')
	manifestPath := filepath.Join(stage, "evidence-manifest.json")
	if _, err := os.Lstat(manifestPath); err == nil {
		return CommitResult{}, fmt.Errorf("worker output conflicts with evidence manifest")
	} else if !errors.Is(err, os.ErrNotExist) {
		return CommitResult{}, fmt.Errorf("inspect evidence manifest target: %w", err)
	}
	if err := writeAtomic(manifestPath, manifestBytes, 0o600); err != nil {
		return CommitResult{}, err
	}
	if err := syncDirectory(stage); err != nil {
		return CommitResult{}, fmt.Errorf("sync staging directory: %w", err)
	}

	finalRelative := filepath.Join("runs", options.RunID, "evidence")
	finalDir := filepath.Join(root, finalRelative)
	if err := requireContained(root, finalDir); err != nil {
		return CommitResult{}, err
	}
	if err := os.MkdirAll(filepath.Dir(finalDir), 0o700); err != nil {
		return CommitResult{}, fmt.Errorf("create run artifact directory: %w", err)
	}
	if _, err := os.Lstat(finalDir); err == nil {
		return CommitResult{}, fmt.Errorf("committed evidence already exists for run %s", options.RunID)
	} else if !errors.Is(err, os.ErrNotExist) {
		return CommitResult{}, fmt.Errorf("inspect evidence target: %w", err)
	}
	if err := os.Rename(stage, finalDir); err != nil {
		return CommitResult{}, fmt.Errorf("atomically publish evidence: %w", err)
	}
	if err := syncDirectory(filepath.Dir(finalDir)); err != nil {
		return CommitResult{}, fmt.Errorf("sync committed evidence parent: %w", err)
	}

	artifacts := make([]domain.Artifact, 0, len(options.Descriptors)+1)
	for _, descriptor := range options.Descriptors {
		id, idErr := domain.NewID("artifact")
		if idErr != nil {
			return CommitResult{}, idErr
		}
		artifacts = append(artifacts, domain.Artifact{
			ID: id, RunID: options.RunID, Kind: descriptor.Kind,
			RelativePath: filepath.ToSlash(filepath.Join(finalRelative, descriptor.RelativePath)),
			MediaType:    descriptor.MediaType, SHA256: descriptor.SHA256, SizeBytes: descriptor.SizeBytes,
			RowCount: descriptor.RowCount, SchemaID: descriptor.SchemaID, DataClass: descriptor.DataClass,
			CreatedAt: committedAt,
		})
	}
	manifestHash := sha256.Sum256(manifestBytes)
	manifestID, err := domain.NewID("artifact")
	if err != nil {
		return CommitResult{}, err
	}
	artifacts = append(artifacts, domain.Artifact{
		ID: manifestID, RunID: options.RunID, Kind: "manifest",
		RelativePath: filepath.ToSlash(filepath.Join(finalRelative, "evidence-manifest.json")),
		MediaType:    "application/json", SHA256: hex.EncodeToString(manifestHash[:]), SizeBytes: int64(len(manifestBytes)),
		SchemaID: "golem.evidence-manifest.v1", DataClass: mostRestrictiveDataClass(items), CreatedAt: committedAt,
	})
	return CommitResult{Artifacts: artifacts, Manifest: manifest, EvidenceDir: finalDir, Observations: canonicalRows, Report: report}, nil
}

func VerifyFile(root, path string, expectedSize int64, expectedSHA string, maximum int64) error {
	if maximum <= 0 {
		maximum = DefaultMaximumArtifactBytes
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	realRoot, err := filepath.EvalSymlinks(rootAbs)
	if err != nil {
		return fmt.Errorf("resolve artifact root: %w", err)
	}
	pathAbs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	if err := requireContained(rootAbs, pathAbs); err != nil {
		return err
	}
	info, err := os.Lstat(pathAbs)
	if err != nil {
		return fmt.Errorf("read artifact metadata: %w", err)
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("%w: artifact is not a regular file", ErrUnsafePath)
	}
	realPath, err := filepath.EvalSymlinks(pathAbs)
	if err != nil {
		return fmt.Errorf("resolve artifact path: %w", err)
	}
	if err := requireContained(realRoot, realPath); err != nil {
		return err
	}
	if info.Size() > maximum || expectedSize > maximum {
		return ErrArtifactTooLarge
	}
	if expectedSize < 0 || info.Size() != expectedSize {
		return fmt.Errorf("%w: declared size %d, actual size %d", ErrArtifactMismatch, expectedSize, info.Size())
	}
	if len(expectedSHA) != 64 {
		return fmt.Errorf("%w: malformed SHA-256", ErrArtifactMismatch)
	}
	file, err := os.Open(realPath)
	if err != nil {
		return err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.CopyN(hash, file, maximum+1); err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("hash artifact: %w", err)
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if actual != expectedSHA {
		return fmt.Errorf("%w: SHA-256 does not match", ErrArtifactMismatch)
	}
	return nil
}

func ReadVerified(dataRoot string, artifact domain.Artifact, maximum int64) ([]byte, error) {
	clean, err := CleanRelativePath(filepath.FromSlash(artifact.RelativePath))
	if err != nil {
		return nil, err
	}
	root, err := filepath.Abs(dataRoot)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(root, clean)
	if err := VerifyFile(root, path, artifact.SizeBytes, artifact.SHA256, maximum); err != nil {
		return nil, err
	}
	return os.ReadFile(path)
}

func FileDigest(path string) (string, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(hash.Sum(nil)), size, nil
}

func requireContained(root, path string) error {
	relative, err := filepath.Rel(root, path)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || filepath.IsAbs(relative) {
		return fmt.Errorf("%w: path escapes root", ErrUnsafePath)
	}
	return nil
}

func verifyDeclaredOutputSet(stage string, declared map[string]struct{}) error {
	return filepath.WalkDir(stage, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return fmt.Errorf("inspect worker output set: %w", walkErr)
		}
		if path == stage {
			return nil
		}
		relative, err := filepath.Rel(stage, path)
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("%w: undeclared link %q", ErrUnsafePath, relative)
		}
		if entry.IsDir() {
			prefix := relative + string(filepath.Separator)
			for item := range declared {
				if strings.HasPrefix(item, prefix) {
					return nil
				}
			}
			return fmt.Errorf("%w: undeclared directory %q", ErrUnsafePath, relative)
		}
		if _, present := declared[relative]; !present {
			return fmt.Errorf("%w: undeclared worker output %q", ErrUnsafePath, relative)
		}
		return nil
	})
}

func validateArtifactMetadata(descriptor domain.ArtifactDescriptor) error {
	contract, present := phaseOneArtifactContracts[descriptor.Kind]
	if !present {
		return fmt.Errorf("%w: unsupported artifact kind %q", ErrArtifactMismatch, descriptor.Kind)
	}
	if descriptor.MediaType != contract.mediaType || (descriptor.SchemaID != contract.schemaID &&
		!(descriptor.Kind == "report" && descriptor.SchemaID == "golem.comparison-report.v2")) {
		return fmt.Errorf("%w: kind/media_type/schema_id combination is not allowlisted", ErrArtifactMismatch)
	}
	if descriptor.RowCount <= 0 || descriptor.RowCount > maximumArtifactRows {
		return fmt.Errorf("%w: row_count is outside the Phase-1 range", ErrArtifactMismatch)
	}
	if (descriptor.MinimumObservedAt == nil) != (descriptor.MaximumObservedAt == nil) {
		return fmt.Errorf("%w: observation time bounds must be paired", ErrArtifactMismatch)
	}
	if descriptor.Kind != "report" && descriptor.MinimumObservedAt == nil {
		return fmt.Errorf("%w: evidence artifact lacks observation time bounds", ErrArtifactMismatch)
	}
	if descriptor.MinimumObservedAt != nil {
		minimum, err := time.Parse(time.RFC3339Nano, *descriptor.MinimumObservedAt)
		if err != nil {
			return fmt.Errorf("%w: minimum_observed_at is invalid", ErrArtifactMismatch)
		}
		maximum, err := time.Parse(time.RFC3339Nano, *descriptor.MaximumObservedAt)
		if err != nil || maximum.Before(minimum) {
			return fmt.Errorf("%w: maximum_observed_at is invalid or precedes the minimum", ErrArtifactMismatch)
		}
	}
	return nil
}

func validateArtifactContents(path, runID string, descriptor domain.ArtifactDescriptor) error {
	switch descriptor.Kind {
	case "arrow":
		return nil
	case "parquet":
		return nil
	case "raw":
		return validateNDJSON(path, descriptor.RowCount)
	case "report":
		return validateReportJSON(path, runID, descriptor.RowCount)
	default:
		return fmt.Errorf("%w: unsupported artifact content", ErrArtifactMismatch)
	}
}

func validateBookendMagic(path string, magic []byte) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	if info.Size() < int64(len(magic)*2) {
		return fmt.Errorf("%w: artifact is too short for its file signature", ErrArtifactMismatch)
	}
	header := make([]byte, len(magic))
	if _, err := io.ReadFull(file, header); err != nil || !bytes.Equal(header, magic) {
		return fmt.Errorf("%w: artifact header signature does not match", ErrArtifactMismatch)
	}
	if _, err := file.Seek(-int64(len(magic)), io.SeekEnd); err != nil {
		return err
	}
	footer := make([]byte, len(magic))
	if _, err := io.ReadFull(file, footer); err != nil || !bytes.Equal(footer, magic) {
		return fmt.Errorf("%w: artifact footer signature does not match", ErrArtifactMismatch)
	}
	return nil
}

func validateNDJSON(path string, expectedRows int64) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64<<10), 8<<20)
	var rows int64
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if !json.Valid(line) {
			return fmt.Errorf("%w: raw artifact contains invalid NDJSON", ErrArtifactMismatch)
		}
		rows++
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("%w: read raw artifact: %v", ErrArtifactMismatch, err)
	}
	if rows != expectedRows {
		return fmt.Errorf("%w: raw row_count declares %d but contains %d", ErrArtifactMismatch, expectedRows, rows)
	}
	return nil
}

func validateReportJSON(path, runID string, expectedRows int64) error {
	_, err := readReportJSON(path, runID, expectedRows)
	return err
}

func readReportJSON(path, runID string, expectedRows int64) (domain.ComparisonReport, error) {
	payload, err := os.ReadFile(path)
	if err != nil {
		return domain.ComparisonReport{}, err
	}
	if int64(len(payload)) > DefaultMaximumArtifactBytes {
		return domain.ComparisonReport{}, ErrArtifactTooLarge
	}
	var header struct {
		SchemaVersion string `json:"schema_version"`
	}
	if err := json.Unmarshal(payload, &header); err != nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report JSON does not match its schema: %v", ErrArtifactMismatch, err)
	}
	if header.SchemaVersion == "golem.comparison-report.v2" {
		return readImportReportJSON(payload, runID, expectedRows)
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var report domain.ComparisonReport
	if err := decoder.Decode(&report); err != nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report JSON does not match its schema: %v", ErrArtifactMismatch, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report JSON contains trailing data", ErrArtifactMismatch)
	}
	if report.SchemaVersion != "golem.comparison-report.v1" || report.RunID != runID {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report schema version or run id does not match", ErrArtifactMismatch)
	}
	if len(report.Targets) == 0 || len(report.Targets) > 50 || int64(len(report.Targets)) != expectedRows {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report target count does not match row_count", ErrArtifactMismatch)
	}
	if report.GeneratedAt.IsZero() || strings.TrimSpace(report.Title) == "" || strings.TrimSpace(report.Summary) == "" || report.MetricDefinitions == nil || report.Contradictions == nil || report.Limitations == nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: report omits required top-level fields", ErrArtifactMismatch)
	}
	for _, definition := range report.MetricDefinitions {
		if definition.ID == "" || definition.Version == "" || definition.Label == "" || definition.Numerator == "" || definition.Denominator == "" || definition.Period == "" {
			return domain.ComparisonReport{}, fmt.Errorf("%w: report contains an incomplete metric definition", ErrArtifactMismatch)
		}
	}
	for _, target := range report.Targets {
		if target.EntityID == "" || target.EntityName == "" || target.ContentFormatMix == nil || len(target.Citations) == 0 || !finiteUnit(target.Confidence) || !finite(target.FollowerDelta) || !finite(target.MedianEngagementRate) || !finite(target.PostingCadencePerWeek) {
			return domain.ComparisonReport{}, fmt.Errorf("%w: report contains an incomplete target finding", ErrArtifactMismatch)
		}
		for _, share := range target.ContentFormatMix {
			if !finiteUnit(share) {
				return domain.ComparisonReport{}, fmt.Errorf("%w: report content format share is invalid", ErrArtifactMismatch)
			}
		}
		for _, citation := range target.Citations {
			if citation.ObservationID == "" || citation.EntityID == "" || citation.SourceURL == "" || citation.ObservedAt.IsZero() || citation.ConnectorVersion == "" || !finiteUnit(citation.Confidence) {
				return domain.ComparisonReport{}, fmt.Errorf("%w: report contains an incomplete citation", ErrArtifactMismatch)
			}
		}
	}
	return report, nil
}

func validateReportContext(report domain.ComparisonReport, provenance domain.Provenance) error {
	if report.SchemaVersion == "golem.comparison-report.v2" {
		if report.Workflow != domain.WorkflowCompare || report.Derivation != provenance {
			return fmt.Errorf("%w: imported report workflow or derivation is invalid", ErrArtifactMismatch)
		}
		return nil
	}
	if report.Workflow != domain.WorkflowCompare && report.Workflow != domain.WorkflowResearch || report.ResearchPlan == nil || len(report.ResearchPlan) == 0 {
		return fmt.Errorf("%w: report workflow or research_plan is missing", ErrArtifactMismatch)
	}
	if report.Workflow == domain.WorkflowCompare && (report.ResearchQuestion != "" || report.SourceBudget != 0) {
		return fmt.Errorf("%w: comparison report carries research-only controls", ErrArtifactMismatch)
	}
	if report.Workflow == domain.WorkflowResearch && (strings.TrimSpace(report.ResearchQuestion) == "" || report.SourceBudget < 1 || report.SourceBudget > 100) {
		return fmt.Errorf("%w: research report omits its exact question or source budget", ErrArtifactMismatch)
	}
	if report.Derivation != provenance {
		return fmt.Errorf("%w: report derivation disagrees with authority provenance", ErrArtifactMismatch)
	}
	return nil
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func finiteUnit(value float64) bool { return finite(value) && value >= 0 && value <= 1 }

func writeAtomic(path string, contents []byte, mode os.FileMode) (err error) {
	temporary, err := os.CreateTemp(filepath.Dir(path), ".manifest-*")
	if err != nil {
		return fmt.Errorf("create temporary manifest: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() {
		_ = temporary.Close()
		if err != nil {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err = temporary.Chmod(mode); err != nil {
		return err
	}
	if _, err = temporary.Write(contents); err != nil {
		return err
	}
	if err = temporary.Sync(); err != nil {
		return err
	}
	if err = temporary.Close(); err != nil {
		return err
	}
	if err = os.Rename(temporaryPath, path); err != nil {
		return err
	}
	return nil
}

func syncDirectory(path string) error {
	directory, err := os.Open(path)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}

func mostRestrictiveDataClass(items []ManifestArtifactItem) string {
	rank := map[string]int{"public": 0, "first_party": 1, "licensed_business_contact": 2, "restricted": 3}
	result := "public"
	for _, item := range items {
		if rank[item.DataClass] > rank[result] {
			result = item.DataClass
		}
	}
	return result
}
