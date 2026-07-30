package jobs

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MaxJafar/AGENTintel/internal/connectors"
	"github.com/MaxJafar/AGENTintel/internal/domain"
	"github.com/MaxJafar/AGENTintel/internal/storage"
)

func TestManagerFailureAndReplay(t *testing.T) {
	manager, store, dataRoot := testManager(t, 100*time.Millisecond)
	run, err := manager.StartComparison(context.Background(), comparisonRequest("source_failure"))
	if err != nil {
		t.Fatal(err)
	}
	failed := waitForTerminal(t, store, run.ID)
	if failed.Status != domain.RunFailed || failed.ErrorCode == nil || *failed.ErrorCode != "source_failure" {
		t.Fatalf("unexpected source failure: %+v", failed)
	}
	if failed.ReportAvailable {
		t.Fatal("failed run must not expose a report")
	}
	if _, err := os.Stat(filepath.Join(dataRoot, "runs", run.ID, "evidence")); !os.IsNotExist(err) {
		t.Fatalf("failed run published evidence: %v", err)
	}
	replayed, err := manager.Replay(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	terminalReplay := waitForTerminal(t, store, replayed.ID)
	if terminalReplay.ReplayOf == nil || *terminalReplay.ReplayOf != run.ID || terminalReplay.Status != domain.RunFailed {
		t.Fatalf("unexpected replay: %+v", terminalReplay)
	}
}

func TestManagerRejectsCorruptArtifact(t *testing.T) {
	manager, store, dataRoot := testManager(t, 100*time.Millisecond)
	run, err := manager.StartComparison(context.Background(), comparisonRequest("corrupt_artifact"))
	if err != nil {
		t.Fatal(err)
	}
	terminal := waitForTerminal(t, store, run.ID)
	if terminal.Status != domain.RunFailed || terminal.ErrorCode == nil || *terminal.ErrorCode != "artifact_corrupt" {
		t.Fatalf("unexpected corruption result: %+v", terminal)
	}
	if _, err := os.Stat(filepath.Join(dataRoot, "runs", run.ID, "evidence")); !os.IsNotExist(err) {
		t.Fatalf("corrupt evidence was published: %v", err)
	}
}

func TestManagerCancelsSlowRun(t *testing.T) {
	manager, store, dataRoot := testManager(t, 5*time.Second)
	run, err := manager.StartComparison(context.Background(), comparisonRequest("slow"))
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, store, run.ID, domain.RunRunning)
	if _, err := manager.Cancel(context.Background(), run.ID, "test cancellation"); err != nil {
		t.Fatal(err)
	}
	terminal := waitForTerminal(t, store, run.ID)
	if terminal.Status != domain.RunCancelled || terminal.ReportAvailable {
		t.Fatalf("unexpected cancellation: %+v", terminal)
	}
	if _, err := os.Stat(filepath.Join(dataRoot, "runs", run.ID, "evidence")); !os.IsNotExist(err) {
		t.Fatalf("cancelled run published evidence: %v", err)
	}
}

func TestManagerCommitsSearchableEvidence(t *testing.T) {
	manager, store, dataRoot := testManager(t, 100*time.Millisecond)
	run, err := manager.StartComparison(context.Background(), comparisonRequest("none"))
	if err != nil {
		t.Fatal(err)
	}
	terminal := waitForTerminal(t, store, run.ID)
	if terminal.Status != domain.RunSucceeded || !terminal.ReportAvailable {
		t.Fatalf("unexpected success: %+v", terminal)
	}
	if terminal.InputSHA256 == "" || terminal.InputSchemaID != "agentintel.fixture-observations.v1" || terminal.InputSizeBytes <= 0 || terminal.WorkerVersion == "" || terminal.ModelVersion == "" || terminal.ConnectorVersion == "" || terminal.ParserVersion == "" {
		t.Fatalf("run lacks immutable input/provenance: %+v", terminal)
	}
	artifacts, err := store.ListArtifacts(context.Background(), run.ID)
	if err != nil || len(artifacts) != 3 {
		t.Fatalf("expected two artifacts and a manifest, got %d: %v", len(artifacts), err)
	}
	if _, err := os.Stat(filepath.Join(dataRoot, "runs", run.ID, "evidence", "evidence-manifest.json")); err != nil {
		t.Fatal(err)
	}
	results, err := store.Search(context.Background(), "Northstar", 20)
	if err != nil || len(results) == 0 {
		t.Fatalf("expected searchable entity: %v, %+v", err, results)
	}
}

func TestReplayUsesImmutableInputAfterFixtureDeletion(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson")
	fixture := filepath.Join(root, "mutable.ndjson")
	payload, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fixture, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	manager, store := startCustomManager(t, root, fixture, &connectors.FixtureWorker{FixturePath: fixture})
	run, err := manager.StartComparison(context.Background(), comparisonRequest("none"))
	if err != nil {
		t.Fatal(err)
	}
	original := waitForTerminal(t, store, run.ID)
	if original.Status != domain.RunSucceeded {
		t.Fatalf("original run = %+v", original)
	}
	if err := os.Remove(fixture); err != nil {
		t.Fatal(err)
	}
	replay, err := manager.Replay(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	replayed := waitForTerminal(t, store, replay.ID)
	if replayed.Status != domain.RunSucceeded || replayed.InputSHA256 != original.InputSHA256 || replayed.InputRelativePath != original.InputRelativePath {
		t.Fatalf("immutable replay = %+v, original = %+v", replayed, original)
	}
}

func TestManagerHandsWorkerOnlyPrivateJobPathsAndRejectsEscape(t *testing.T) {
	root := t.TempDir()
	canonicalRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatal(err)
	}
	fixture := filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson")
	if err := os.WriteFile(filepath.Join(root, "service-token"), []byte(strings.Repeat("s", 43)), 0o600); err != nil {
		t.Fatal(err)
	}
	capture := &capturingWorker{requests: make(chan connectors.AnalysisRequest, 1), mode: "fail"}
	manager, store := startCustomManager(t, root, fixture, capture)
	run, err := manager.StartComparison(context.Background(), comparisonRequest("none"))
	if err != nil {
		t.Fatal(err)
	}
	request := <-capture.requests
	_ = waitForTerminal(t, store, run.ID)
	if request.WorkspacePath == canonicalRoot || !strings.HasPrefix(request.WorkspacePath, filepath.Join(canonicalRoot, "spool")+string(filepath.Separator)) {
		t.Fatalf("worker workspace escaped private job root: %q", request.WorkspacePath)
	}
	for _, path := range []string{request.InputPath, request.OutputDir, filepath.Join(request.WorkspacePath, "tmp")} {
		relative, err := filepath.Rel(request.WorkspacePath, path)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			t.Fatalf("worker path escaped job root: %q", path)
		}
	}
	handed := fmt.Sprintf("%+v", request)
	for _, secretPath := range []string{"service-token", "state.sqlite3", filepath.Join(root, "runs")} {
		if strings.Contains(handed, secretPath) {
			t.Fatalf("worker request exposed authority path %q: %s", secretPath, handed)
		}
	}

	escape := &capturingWorker{requests: make(chan connectors.AnalysisRequest, 1), mode: "escape"}
	root2 := t.TempDir()
	manager2, store2 := startCustomManager(t, root2, fixture, escape)
	run2, err := manager2.StartComparison(context.Background(), comparisonRequest("none"))
	if err != nil {
		t.Fatal(err)
	}
	terminal := waitForTerminal(t, store2, run2.ID)
	if terminal.ErrorCode == nil || *terminal.ErrorCode != "artifact_path_violation" {
		t.Fatalf("escaping result was not rejected: %+v", terminal)
	}
	if matches, _ := filepath.Glob(filepath.Join(root2, "spool", "job-*", "escape.json")); len(matches) != 0 {
		t.Fatalf("escaping worker file survived job cleanup: %v", matches)
	}
}

type capturingWorker struct {
	requests chan connectors.AnalysisRequest
	mode     string
	once     sync.Once
}

func (worker *capturingWorker) ID() string      { return "malicious.test.v1" }
func (worker *capturingWorker) Available() bool { return true }
func (worker *capturingWorker) Analyze(_ context.Context, request connectors.AnalysisRequest, _ connectors.ProgressSink) (domain.ConnectorResult, error) {
	worker.once.Do(func() { worker.requests <- request })
	if worker.mode == "fail" {
		return domain.ConnectorResult{}, &connectors.WorkerError{Code: "malicious_probe", Message: "probe complete"}
	}
	payload := []byte(`{"escape":true}`)
	path := filepath.Join(request.OutputDir, "..", "escape.json")
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		return domain.ConnectorResult{}, err
	}
	digest := sha256.Sum256(payload)
	hash := hex.EncodeToString(digest[:])
	return domain.ConnectorResult{Succeeded: true, ReportRelativePath: "../escape.json", ReportSHA256: hash,
		ModelVersion: "malicious", WorkerVersion: "malicious",
		Artifacts: []domain.ArtifactDescriptor{{RelativePath: "../escape.json", Kind: "report", MediaType: "application/json", SHA256: hash,
			SizeBytes: int64(len(payload)), RowCount: 1, SchemaID: "agentintel.comparison-report.v1", DataClass: "public"}}}, nil
}

func startCustomManager(t *testing.T, dataRoot, fixture string, worker connectors.Worker) (*Manager, *storage.Store) {
	t.Helper()
	store, err := storage.Open(filepath.Join(dataRoot, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	manager, err := New(Config{Store: store, DataRoot: dataRoot, FixturePath: fixture, Worker: worker, Concurrency: 1, PollInterval: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cancel(); manager.Close(); store.Close() })
	return manager, store
}

func testManager(t *testing.T, slowDelay time.Duration) (*Manager, *storage.Store, string) {
	t.Helper()
	dataRoot := t.TempDir()
	store, err := storage.Open(filepath.Join(dataRoot, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	fixture, err := filepath.Abs(filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson"))
	if err != nil {
		t.Fatal(err)
	}
	worker := &connectors.FixtureWorker{FixturePath: fixture, SlowDelay: slowDelay}
	manager, err := New(Config{Store: store, DataRoot: dataRoot, FixturePath: fixture, Worker: worker, Concurrency: 1, PollInterval: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cancel()
		manager.Close()
		store.Close()
	})
	return manager, store, dataRoot
}

func comparisonRequest(simulation string) domain.ComparisonStartRequest {
	return domain.ComparisonStartRequest{
		ProjectID: "test", TargetIDs: []string{"northstar-labs", "orbit-coffee"},
		ConnectorIDs: []string{connectors.FixtureID}, Simulate: simulation,
	}
}

func waitForStatus(t *testing.T, store *storage.Store, runID string, status domain.RunStatus) domain.Run {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		run, err := store.GetRun(context.Background(), runID)
		if err == nil && run.Status == status {
			return run
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("run %s did not reach status %s", runID, status)
	return domain.Run{}
}

func waitForTerminal(t *testing.T, store *storage.Store, runID string) domain.Run {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		run, err := store.GetRun(context.Background(), runID)
		if err == nil && run.Status.Terminal() {
			return run
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("run %s did not become terminal", runID)
	return domain.Run{}
}
