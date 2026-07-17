package governance

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/domain"
	"github.com/GolemWorkers/golem-intel/internal/policy"
)

func validateEvidenceSemantics(descriptors []domain.ArtifactDescriptor, allowLegacy bool, kindCounts map[string]int,
	canonical map[string][]domain.Observation, report domain.ComparisonReport, provenance domain.Provenance) ([]domain.Observation, domain.Provenance, error) {
	var canonicalRows []domain.Observation
	if err := validateReportProjection(report); err != nil {
		return nil, provenance, err
	}
	if allowLegacy {
		if len(descriptors) != 2 || kindCounts["raw"] != 1 || kindCounts["report"] != 1 {
			return nil, provenance, fmt.Errorf("%w: legacy fixture evidence requires exactly raw + report", ErrArtifactMismatch)
		}
	} else {
		if len(descriptors) != 3 || kindCounts["arrow"] != 1 || kindCounts["parquet"] != 1 || kindCounts["report"] != 1 {
			return nil, provenance, fmt.Errorf("%w: production evidence requires exactly Arrow IPC + Parquet + report", ErrArtifactMismatch)
		}
		if err := validateCanonicalPair(canonical["arrow"], canonical["parquet"]); err != nil {
			return nil, provenance, err
		}
		canonicalRows = canonical["arrow"]
		minimum, maximum := canonicalBounds(canonicalRows)
		dataClass := canonicalDataClass(canonicalRows)
		for _, descriptor := range descriptors {
			if descriptor.RowCount != int64(len(canonicalRows)) && descriptor.Kind != "report" {
				return nil, provenance, fmt.Errorf("%w: %s row_count disagrees with decoded observations", ErrArtifactMismatch, descriptor.Kind)
			}
			if descriptor.DataClass != dataClass {
				return nil, provenance, fmt.Errorf("%w: %s data_class disagrees with decoded observations", ErrArtifactMismatch, descriptor.Kind)
			}
			if descriptor.MinimumObservedAt == nil || descriptor.MaximumObservedAt == nil {
				return nil, provenance, fmt.Errorf("%w: %s lacks decoded observation bounds", ErrArtifactMismatch, descriptor.Kind)
			}
			declaredMinimum, _ := time.Parse(time.RFC3339Nano, *descriptor.MinimumObservedAt)
			declaredMaximum, _ := time.Parse(time.RFC3339Nano, *descriptor.MaximumObservedAt)
			if !declaredMinimum.Equal(minimum) || !declaredMaximum.Equal(maximum) {
				return nil, provenance, fmt.Errorf("%w: %s observation bounds disagree with decoded rows", ErrArtifactMismatch, descriptor.Kind)
			}
		}
		if err := validateReportCitations(report, canonicalRows); err != nil {
			return nil, provenance, err
		}
		if report.SchemaVersion != "golem.comparison-report.v2" {
			provenance.ConnectorVersion = canonicalConnectorVersion(canonicalRows)
			provenance.ParserVersion = CanonicalParserVersion
		}
	}
	if err := validateReportContext(report, provenance); err != nil {
		return nil, provenance, err
	}
	return canonicalRows, provenance, nil
}

// LoadCommittedEvidence verifies and reconstructs authority metadata for a
// directory that was atomically published before SQLite completion. It never
// trusts the manifest without re-hashing and physically parsing its files.
func LoadCommittedEvidence(dataRoot, runID string, maximum int64) (CommitResult, error) {
	if maximum <= 0 {
		maximum = DefaultMaximumArtifactBytes
	}
	evidenceDir, err := committedEvidenceDirectory(dataRoot, runID)
	if err != nil {
		return CommitResult{}, err
	}
	manifestPath := filepath.Join(evidenceDir, "evidence-manifest.json")
	info, err := os.Lstat(manifestPath)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Size() > maximum {
		return CommitResult{}, fmt.Errorf("%w: committed evidence manifest is unavailable or unsafe", ErrArtifactMismatch)
	}
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return CommitResult{}, err
	}
	decoder := json.NewDecoder(bufio.NewReaderSize(bytesReader(manifestBytes), 32<<10))
	decoder.DisallowUnknownFields()
	var manifest EvidenceManifest
	if err := decoder.Decode(&manifest); err != nil {
		return CommitResult{}, fmt.Errorf("%w: decode committed manifest: %v", ErrArtifactMismatch, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return CommitResult{}, fmt.Errorf("%w: committed manifest contains trailing data", ErrArtifactMismatch)
	}
	if manifest.ManifestVersion != 1 || manifest.RunID != runID || manifest.CommittedAt.IsZero() || len(manifest.Artifacts) == 0 {
		return CommitResult{}, fmt.Errorf("%w: committed manifest identity is invalid", ErrArtifactMismatch)
	}
	descriptors := make([]domain.ArtifactDescriptor, 0, len(manifest.Artifacts))
	seen := map[string]struct{}{"evidence-manifest.json": {}}
	kindCounts := make(map[string]int)
	canonical := make(map[string][]domain.Observation)
	var report domain.ComparisonReport
	artifacts := make([]domain.Artifact, 0, len(manifest.Artifacts)+1)
	for _, item := range manifest.Artifacts {
		kind, err := committedArtifactKind(item)
		if err != nil {
			return CommitResult{}, err
		}
		descriptor := domain.ArtifactDescriptor{RelativePath: item.RelativePath, Kind: kind, MediaType: item.MediaType,
			SHA256: item.SHA256, SizeBytes: item.SizeBytes, RowCount: item.RowCount, SchemaID: item.SchemaID,
			MinimumObservedAt: item.MinimumObservedAt, MaximumObservedAt: item.MaximumObservedAt, DataClass: item.DataClass}
		clean, err := CleanRelativePath(descriptor.RelativePath)
		if err != nil {
			return CommitResult{}, err
		}
		if _, duplicate := seen[clean]; duplicate {
			return CommitResult{}, fmt.Errorf("%w: duplicate committed artifact path", ErrArtifactMismatch)
		}
		seen[clean] = struct{}{}
		if err := validateArtifactMetadata(descriptor); err != nil {
			return CommitResult{}, err
		}
		if err := policy.ValidateDataClass(descriptor.DataClass); err != nil {
			return CommitResult{}, err
		}
		path := filepath.Join(evidenceDir, clean)
		if err := VerifyFile(evidenceDir, path, descriptor.SizeBytes, descriptor.SHA256, maximum); err != nil {
			return CommitResult{}, err
		}
		switch kind {
		case "arrow":
			canonical["arrow"], err = parseArrowEvidence(path, manifest.CommittedAt)
		case "parquet":
			canonical["parquet"], err = parseParquetEvidence(path, manifest.CommittedAt)
		case "raw":
			err = validateNDJSON(path, descriptor.RowCount)
		case "report":
			report, err = readReportJSON(path, runID, descriptor.RowCount)
		}
		if err != nil {
			return CommitResult{}, err
		}
		kindCounts[kind]++
		descriptors = append(descriptors, descriptor)
		id, _ := domain.NewID("artifact")
		artifacts = append(artifacts, domain.Artifact{ID: id, RunID: runID, Kind: kind,
			RelativePath: filepath.ToSlash(filepath.Join("runs", runID, "evidence", clean)), MediaType: descriptor.MediaType,
			SHA256: descriptor.SHA256, SizeBytes: descriptor.SizeBytes, RowCount: descriptor.RowCount, SchemaID: descriptor.SchemaID,
			DataClass: descriptor.DataClass, CreatedAt: manifest.CommittedAt})
	}
	if err := verifyDeclaredOutputSet(evidenceDir, seen); err != nil {
		return CommitResult{}, err
	}
	allowLegacy := kindCounts["raw"] == 1
	rows, provenance, err := validateEvidenceSemantics(descriptors, allowLegacy, kindCounts, canonical, report, manifest.Provenance)
	if err != nil || provenance != manifest.Provenance {
		if err == nil {
			err = fmt.Errorf("%w: manifest provenance disagrees with decoded evidence", ErrArtifactMismatch)
		}
		return CommitResult{}, err
	}
	manifestHash := sha256.Sum256(manifestBytes)
	manifestID, _ := domain.NewID("artifact")
	artifacts = append(artifacts, domain.Artifact{ID: manifestID, RunID: runID, Kind: "manifest",
		RelativePath: filepath.ToSlash(filepath.Join("runs", runID, "evidence", "evidence-manifest.json")),
		MediaType:    "application/json", SHA256: hex.EncodeToString(manifestHash[:]), SizeBytes: int64(len(manifestBytes)),
		SchemaID: "golem.evidence-manifest.v1", DataClass: mostRestrictiveDataClass(manifest.Artifacts), CreatedAt: manifest.CommittedAt})
	return CommitResult{Artifacts: artifacts, Manifest: manifest, EvidenceDir: evidenceDir, Observations: rows, Report: report}, nil
}

// committedEvidenceDirectory resolves a recovery path one component at a
// time. A manifest is only authority if its directory chain is made of real
// directories under the caller's data root; otherwise a symlink could make a
// previously committed run read or publish data from outside that root.
func committedEvidenceDirectory(dataRoot, runID string) (string, error) {
	root, err := filepath.Abs(dataRoot)
	if err != nil {
		return "", err
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", fmt.Errorf("resolve committed evidence root: %w", err)
	}
	rootInfo, err := os.Lstat(root)
	if err != nil || !rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("%w: committed evidence root is not a real directory", ErrUnsafePath)
	}
	cleanRunID, err := CleanRelativePath(runID)
	if err != nil || cleanRunID != runID || filepath.Base(runID) != runID {
		return "", fmt.Errorf("%w: committed evidence run identifier is unsafe", ErrUnsafePath)
	}
	path := root
	for _, component := range []string{"runs", runID, "evidence"} {
		path = filepath.Join(path, component)
		if err := requireContained(root, path); err != nil {
			return "", err
		}
		info, err := os.Lstat(path)
		if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				return "", fmt.Errorf("inspect committed evidence directory: %w", err)
			}
			return "", fmt.Errorf("%w: committed evidence directory is unavailable or unsafe", ErrUnsafePath)
		}
	}
	return path, nil
}

func committedArtifactKind(item ManifestArtifactItem) (string, error) {
	switch {
	case item.MediaType == "application/vnd.apache.arrow.file" && item.SchemaID == "golem.observations.v1":
		return "arrow", nil
	case item.MediaType == "application/vnd.apache.parquet" && item.SchemaID == "golem.observations.v1":
		return "parquet", nil
	case item.MediaType == "application/x-ndjson" && item.SchemaID == "golem.observations.v1":
		return "raw", nil
	case item.MediaType == "application/json" && (item.SchemaID == "golem.comparison-report.v1" || item.SchemaID == "golem.comparison-report.v2"):
		return "report", nil
	default:
		return "", fmt.Errorf("%w: committed artifact contract is not allowlisted", ErrArtifactMismatch)
	}
}

type byteReader struct {
	payload []byte
	offset  int
}

func bytesReader(payload []byte) *byteReader { return &byteReader{payload: payload} }
func (reader *byteReader) Read(output []byte) (int, error) {
	if reader.offset >= len(reader.payload) {
		return 0, io.EOF
	}
	n := copy(output, reader.payload[reader.offset:])
	reader.offset += n
	return n, nil
}
