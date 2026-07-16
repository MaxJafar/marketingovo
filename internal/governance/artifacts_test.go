package governance

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/domain"
)

func TestCleanRelativePathRejectsTraversalAndAmbiguity(t *testing.T) {
	for _, value := range []string{"", ".", "../secret", "a/../../secret", "/tmp/file", "a\\b", "a/../b"} {
		if _, err := CleanRelativePath(value); !errors.Is(err, ErrUnsafePath) {
			t.Fatalf("path %q returned %v, want ErrUnsafePath", value, err)
		}
	}
	if value, err := CleanRelativePath("nested/report.json"); err != nil || value != "nested/report.json" {
		t.Fatalf("safe path rejected: %q %v", value, err)
	}
}

func TestCommitEvidenceAndDetectPostCommitCorruption(t *testing.T) {
	root := t.TempDir()
	stage := filepath.Join(root, "spool", "run-1")
	if err := os.MkdirAll(stage, 0o700); err != nil {
		t.Fatal(err)
	}
	contents := validReportBytes(t, "run-1")
	raw := []byte("{}\n")
	path := filepath.Join(stage, "report.json")
	if err := os.WriteFile(path, contents, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stage, "observations.ndjson"), raw, 0o600); err != nil {
		t.Fatal(err)
	}
	hash, rawHash := sha256.Sum256(contents), sha256.Sum256(raw)
	bound := time.Now().UTC().Format(time.RFC3339Nano)
	commit, err := CommitEvidence(CommitOptions{
		DataRoot: root, RunID: "run-1", StageDir: stage,
		Provenance: testProvenance(), AllowLegacyFixture: true,
		Descriptors: []domain.ArtifactDescriptor{{
			RelativePath: "observations.ndjson", Kind: "raw", MediaType: "application/x-ndjson",
			SHA256: hex.EncodeToString(rawHash[:]), SizeBytes: int64(len(raw)), RowCount: 1,
			SchemaID: "golem.observations.v1", DataClass: "public", MinimumObservedAt: &bound, MaximumObservedAt: &bound,
		}, {
			RelativePath: "report.json", Kind: "report", MediaType: "application/json",
			SHA256: hex.EncodeToString(hash[:]), SizeBytes: int64(len(contents)),
			RowCount: 1, SchemaID: "golem.comparison-report.v1", DataClass: "public",
		}},
	})
	if err != nil {
		t.Fatalf("commit evidence: %v", err)
	}
	if len(commit.Artifacts) != 3 {
		t.Fatalf("got %d committed artifacts, want raw + report + manifest", len(commit.Artifacts))
	}
	if _, err := ReadVerified(root, commit.Artifacts[0], 1024); err != nil {
		t.Fatalf("read verified artifact: %v", err)
	}
	committedPath := filepath.Join(root, filepath.FromSlash(commit.Artifacts[0].RelativePath))
	if err := os.WriteFile(committedPath, []byte("tampered"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadVerified(root, commit.Artifacts[0], 1024); !errors.Is(err, ErrArtifactMismatch) {
		t.Fatalf("corruption returned %v, want ErrArtifactMismatch", err)
	}
}

func TestCommitEvidenceRejectsSymlink(t *testing.T) {
	root := t.TempDir()
	stage := filepath.Join(root, "spool")
	if err := os.MkdirAll(stage, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(root, "outside")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(stage, "report.json")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	_, err := CommitEvidence(CommitOptions{
		DataRoot: root, RunID: "run-2", StageDir: stage,
		Provenance: testProvenance(),
		Descriptors: []domain.ArtifactDescriptor{{
			RelativePath: "report.json", Kind: "report", MediaType: "application/json",
			SHA256: "00" + string(make([]byte, 62)), SizeBytes: 6, RowCount: 1,
			SchemaID: "golem.comparison-report.v1", DataClass: "public",
		}},
	})
	if !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("symlink returned %v, want ErrUnsafePath", err)
	}
}

func TestCommitEvidenceRejectsUndeclaredWorkerOutput(t *testing.T) {
	root := t.TempDir()
	stage := filepath.Join(root, "spool")
	if err := os.MkdirAll(stage, 0o700); err != nil {
		t.Fatal(err)
	}
	report := validReportBytes(t, "run-undeclared")
	if err := os.WriteFile(filepath.Join(stage, "report.json"), report, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stage, "undeclared.tmp"), []byte("untrusted"), 0o600); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(report)
	_, err := CommitEvidence(CommitOptions{
		DataRoot: root, RunID: "run-undeclared", StageDir: stage,
		Provenance: testProvenance(),
		Descriptors: []domain.ArtifactDescriptor{{
			RelativePath: "report.json", Kind: "report", MediaType: "application/json",
			SHA256: hex.EncodeToString(digest[:]), SizeBytes: int64(len(report)),
			RowCount: 1, SchemaID: "golem.comparison-report.v1", DataClass: "public",
		}},
	})
	if !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("undeclared output returned %v, want ErrUnsafePath", err)
	}
}

func TestCommitEvidenceRejectsSpoofedParquetSignature(t *testing.T) {
	root := t.TempDir()
	stage := filepath.Join(root, "spool")
	if err := os.MkdirAll(stage, 0o700); err != nil {
		t.Fatal(err)
	}
	fakeParquet := []byte("PAR1not-a-parquet-footer-NOPE")
	report := validReportBytes(t, "run-signature")
	if err := os.WriteFile(filepath.Join(stage, "observations.parquet"), fakeParquet, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stage, "report.json"), report, 0o600); err != nil {
		t.Fatal(err)
	}
	parquetHash, reportHash := sha256.Sum256(fakeParquet), sha256.Sum256(report)
	minimum, maximum := "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"
	_, err := CommitEvidence(CommitOptions{
		DataRoot: root, RunID: "run-signature", StageDir: stage,
		Provenance: testProvenance(),
		Descriptors: []domain.ArtifactDescriptor{
			{
				RelativePath: "observations.parquet", Kind: "parquet", MediaType: "application/vnd.apache.parquet",
				SHA256: hex.EncodeToString(parquetHash[:]), SizeBytes: int64(len(fakeParquet)), RowCount: 1,
				SchemaID: "golem.observations.v1", MinimumObservedAt: &minimum, MaximumObservedAt: &maximum, DataClass: "public",
			},
			{
				RelativePath: "report.json", Kind: "report", MediaType: "application/json",
				SHA256: hex.EncodeToString(reportHash[:]), SizeBytes: int64(len(report)), RowCount: 1,
				SchemaID: "golem.comparison-report.v1", DataClass: "public",
			},
		},
	})
	if !errors.Is(err, ErrArtifactMismatch) {
		t.Fatalf("spoofed Parquet returned %v, want ErrArtifactMismatch", err)
	}
}

func testProvenance() domain.Provenance {
	return domain.Provenance{WorkerVersion: "worker.v1", ModelVersion: "model.v1", ConnectorVersion: "fixture.v1", ParserVersion: "golem-go-fixture.v1"}
}

func validReportBytes(t *testing.T, runID string) []byte {
	t.Helper()
	now := time.Now().UTC()
	report := domain.ComparisonReport{
		SchemaVersion: "golem.comparison-report.v1", RunID: runID, GeneratedAt: now,
		Workflow: domain.WorkflowCompare, ResearchPlan: []string{"validate test evidence"}, Derivation: testProvenance(),
		Title: "Test report", Summary: "Evidence-backed test report.",
		Targets: []domain.TargetFinding{{
			EntityID: "entity-1", EntityName: "Entity One", FollowerDelta: 1,
			MedianEngagementRate: 0.1, PostingCadencePerWeek: 2,
			ContentFormatMix: map[string]float64{"image": 1}, Confidence: 1,
			Citations: []domain.Citation{{
				ObservationID: "observation-1", EntityID: "entity-1", SourceURL: "https://example.invalid/evidence",
				ObservedAt: now, ConnectorVersion: "fixture.v1", Confidence: 1,
			}},
		}},
		MetricDefinitions: []domain.MetricDefinition{{
			ID: "metric", Version: "v1", Label: "Metric", Numerator: "events", Denominator: "followers", Period: "window",
		}},
		Contradictions: []string{}, Limitations: []string{"Synthetic test evidence."},
	}
	payload, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	return append(payload, '\n')
}
