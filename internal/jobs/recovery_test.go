package jobs

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/GolemWorkers/agentintel/internal/connectors"
	"github.com/GolemWorkers/agentintel/internal/domain"
	"github.com/GolemWorkers/agentintel/internal/governance"
	"github.com/GolemWorkers/agentintel/internal/storage"
)

func TestManagerRecoversPublishedEvidenceBeforeWorkers(t *testing.T) {
	store, dataRoot, run := createPublishedRecoveredRun(t, nil)
	defer store.Close()

	worker := &recoveryTestWorker{calls: make(chan struct{}, 1)}
	manager := newRecoveryTestManager(t, store, dataRoot, worker)
	if err := manager.Start(context.Background()); err != nil {
		t.Fatalf("start manager: %v", err)
	}
	defer manager.Close()

	got, err := store.GetRun(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != domain.RunSucceeded || got.Stage != "complete" || !got.ReportAvailable {
		t.Fatalf("recovered run = %+v", got)
	}
	artifacts, err := store.ListArtifacts(context.Background(), run.ID)
	if err != nil || len(artifacts) != 3 {
		t.Fatalf("recovered artifacts = %d, %v", len(artifacts), err)
	}
	if _, err := store.GetEntity(context.Background(), "northstar-labs"); err != nil {
		t.Fatalf("recovered entity projection: %v", err)
	}
	if results, err := store.Search(context.Background(), "Northstar", 20); err != nil || len(results) == 0 {
		t.Fatalf("recovered search projection = %+v, %v", results, err)
	}
	select {
	case <-worker.calls:
		t.Fatal("worker ran despite valid committed recovery evidence")
	default:
	}

	// Re-running reconciliation must observe the terminal state and leave the
	// one recovery completion transaction untouched.
	if err := manager.reconcileRecoveredRuns(context.Background()); err != nil {
		t.Fatalf("repeat reconciliation: %v", err)
	}
	again, err := store.ListArtifacts(context.Background(), run.ID)
	if err != nil || len(again) != len(artifacts) {
		t.Fatalf("reconciliation duplicated artifacts: %d, %v", len(again), err)
	}
	events, err := store.ListEventsAfter(context.Background(), run.ID, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	completeEvents := 0
	for _, event := range events {
		if event.Stage == "complete" && event.Message == "Recovered and revalidated an interrupted evidence commit" {
			completeEvents++
		}
	}
	if completeEvents != 1 {
		t.Fatalf("recovery completion events = %d, want one", completeEvents)
	}
}

func TestManagerFailsClosedForInvalidRecoveredEvidence(t *testing.T) {
	cases := []struct {
		name        string
		mutate      func(*testing.T, string, string)
		wantCode    string
		wantMessage string
	}{
		{
			name: "corrupt_manifest",
			mutate: func(t *testing.T, root, runID string) {
				t.Helper()
				if err := os.WriteFile(filepath.Join(root, "runs", runID, "evidence", "evidence-manifest.json"), []byte("{"), 0o600); err != nil {
					t.Fatal(err)
				}
			},
			wantCode: recoveryEvidenceCorruptCode, wantMessage: recoveryEvidenceCorruptMessage,
		},
		{
			name: "corrupt_artifact",
			mutate: func(t *testing.T, root, runID string) {
				t.Helper()
				if err := os.WriteFile(filepath.Join(root, "runs", runID, "evidence", "report.json"), []byte("tampered"), 0o600); err != nil {
					t.Fatal(err)
				}
			},
			wantCode: recoveryEvidenceCorruptCode, wantMessage: recoveryEvidenceCorruptMessage,
		},
		{
			name: "evidence_symlink_escape",
			mutate: func(t *testing.T, root, runID string) {
				t.Helper()
				evidence := filepath.Join(root, "runs", runID, "evidence")
				outside := filepath.Join(t.TempDir(), "evidence")
				if err := os.Rename(evidence, outside); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(outside, evidence); err != nil {
					t.Skipf("symlinks unavailable: %v", err)
				}
			},
			wantCode: recoveryEvidencePathCode, wantMessage: recoveryEvidencePathMessage,
		},
		{
			name: "projection_mismatch",
			mutate: func(t *testing.T, root, runID string) {
				t.Helper()
				rewriteRecoveredReport(t, root, runID, func(report *domain.ComparisonReport) {
					report.Targets[0].EntityID = "projection-mismatch"
				})
			},
			wantCode: recoveryProjectionMismatchCode, wantMessage: recoveryProjectionMismatchMessage,
		},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			store, dataRoot, run := createPublishedRecoveredRun(t, testCase.mutate)
			defer store.Close()
			manager := newRecoveryTestManager(t, store, dataRoot, &recoveryTestWorker{calls: make(chan struct{}, 1)})
			if err := manager.Start(context.Background()); err != nil {
				t.Fatalf("start manager: %v", err)
			}
			defer manager.Close()

			got, err := store.GetRun(context.Background(), run.ID)
			if err != nil {
				t.Fatal(err)
			}
			if got.Status != domain.RunFailed || got.ReportAvailable || got.ErrorCode == nil || *got.ErrorCode != testCase.wantCode || got.ErrorMessage == nil || *got.ErrorMessage != testCase.wantMessage {
				t.Fatalf("failed recovery = %+v", got)
			}
			if _, err := store.ReportArtifact(context.Background(), run.ID); !errors.Is(err, storage.ErrNotFound) {
				t.Fatalf("failed recovery exposed a report artifact: %v", err)
			}
			if results, err := store.Search(context.Background(), "Northstar", 20); err != nil || len(results) != 0 {
				t.Fatalf("failed recovery exposed search projections: %+v, %v", results, err)
			}
		})
	}
}

func TestManagerRetriesRecoveredRunWhenEvidenceIsMissing(t *testing.T) {
	store, dataRoot, run := createInterruptedRun(t, false)
	defer store.Close()

	worker := &recoveryTestWorker{calls: make(chan struct{}, 1), release: make(chan struct{})}
	manager := newRecoveryTestManager(t, store, dataRoot, worker)
	if err := manager.Start(context.Background()); err != nil {
		t.Fatalf("start manager: %v", err)
	}
	defer manager.Close()
	defer close(worker.release)

	select {
	case <-worker.calls:
	case <-time.After(5 * time.Second):
		t.Fatal("missing recovered evidence was not handed to the retry worker")
	}
	got, err := store.GetRun(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != domain.RunRunning || got.Stage != "starting" {
		t.Fatalf("missing evidence did not remain eligible for retry: %+v", got)
	}
}

func TestManagerPreservesRestartTimeCancellation(t *testing.T) {
	store, dataRoot, run := createInterruptedRun(t, false)
	defer store.Close()
	if _, err := store.RequestCancel(context.Background(), run.ID, "cancel during startup recovery"); err != nil {
		t.Fatal(err)
	}

	worker := &recoveryTestWorker{calls: make(chan struct{}, 1)}
	manager := newRecoveryTestManager(t, store, dataRoot, worker)
	if err := manager.Start(context.Background()); err != nil {
		t.Fatalf("start manager: %v", err)
	}
	defer manager.Close()

	got, err := store.GetRun(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != domain.RunCancelled || got.ReportAvailable {
		t.Fatalf("restart cancellation = %+v", got)
	}
	select {
	case <-worker.calls:
		t.Fatal("cancelled recovered run reached a worker")
	default:
	}
}

func TestManagerStartHonorsCancelledStartupContext(t *testing.T) {
	store, dataRoot, run := createPublishedRecoveredRun(t, nil)
	defer store.Close()
	worker := &recoveryTestWorker{calls: make(chan struct{}, 1)}
	manager := newRecoveryTestManager(t, store, dataRoot, worker)
	startupContext, cancel := context.WithCancel(context.Background())
	cancel()
	if err := manager.Start(startupContext); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled startup = %v, want context.Canceled", err)
	}
	got, err := store.GetRun(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != domain.RunQueued || got.Stage != "recovered" || got.ReportAvailable {
		t.Fatalf("cancelled startup changed recovered run: %+v", got)
	}
	select {
	case <-worker.calls:
		t.Fatal("cancelled startup began a worker")
	default:
	}
}

func TestManagerCleansOnlyOrphanedPrivateSpools(t *testing.T) {
	root := t.TempDir()
	store, err := storage.Open(filepath.Join(root, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	orphan := filepath.Join(root, "spool", "job-orphan")
	if err := os.MkdirAll(orphan, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err := os.WriteFile(outside, []byte("must survive"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(orphan, "escape")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	link := filepath.Join(root, "spool", "job-link")
	if err := os.Symlink(filepath.Dir(outside), link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	committed := filepath.Join(root, "runs", "committed", "evidence", "sentinel")
	if err := os.MkdirAll(filepath.Dir(committed), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(committed, []byte("committed"), 0o600); err != nil {
		t.Fatal(err)
	}

	manager := newRecoveryTestManager(t, store, root, &recoveryTestWorker{calls: make(chan struct{}, 1)})
	if err := manager.Start(context.Background()); err != nil {
		t.Fatalf("start manager: %v", err)
	}
	defer manager.Close()

	if _, err := os.Lstat(orphan); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("orphaned job spool remains: %v", err)
	}
	if payload, err := os.ReadFile(outside); err != nil || string(payload) != "must survive" {
		t.Fatalf("spool cleanup followed a symlink: %q, %v", payload, err)
	}
	if info, err := os.Lstat(link); err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("spool cleanup touched direct symlink: %v, %v", info, err)
	}
	if payload, err := os.ReadFile(committed); err != nil || string(payload) != "committed" {
		t.Fatalf("spool cleanup touched committed evidence: %q, %v", payload, err)
	}
}

type recoveryTestWorker struct {
	calls   chan struct{}
	release chan struct{}
}

func (worker *recoveryTestWorker) ID() string      { return "recovery.test.v1" }
func (worker *recoveryTestWorker) Available() bool { return true }
func (worker *recoveryTestWorker) Analyze(ctx context.Context, _ connectors.AnalysisRequest, _ connectors.ProgressSink) (domain.ConnectorResult, error) {
	select {
	case worker.calls <- struct{}{}:
	default:
	}
	if worker.release != nil {
		select {
		case <-worker.release:
		case <-ctx.Done():
			return domain.ConnectorResult{}, ctx.Err()
		}
	}
	return domain.ConnectorResult{}, &connectors.WorkerError{Code: "recovery_test_worker", Message: "test worker should not produce evidence"}
}

func newRecoveryTestManager(t *testing.T, store *storage.Store, dataRoot string, worker connectors.Worker) *Manager {
	t.Helper()
	fixture, err := fixturePath()
	if err != nil {
		t.Fatal(err)
	}
	manager, err := New(Config{Store: store, DataRoot: dataRoot, FixturePath: fixture, Worker: worker, Concurrency: 1, PollInterval: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	return manager
}

func createPublishedRecoveredRun(t *testing.T, mutate func(*testing.T, string, string)) (*storage.Store, string, domain.Run) {
	t.Helper()
	root := t.TempDir()
	store, err := storage.Open(filepath.Join(root, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	run := createAndClaimRecoveryRun(t, store)
	fixture, err := fixturePath()
	if err != nil {
		t.Fatal(err)
	}
	stage := filepath.Join(root, "spool", "job-crash", "output")
	worker := &connectors.FixtureWorker{FixturePath: fixture}
	result, err := worker.Analyze(context.Background(), connectors.AnalysisRequest{
		RunID: run.ID, ProjectID: run.ProjectID, InputPath: fixture, OutputDir: stage,
		TargetIDs: []string{"northstar-labs", "orbit-coffee"}, Workflow: domain.WorkflowCompare,
		Options: map[string]string{"workflow": "compare", "simulate": "none"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = governance.CommitEvidence(governance.CommitOptions{
		DataRoot: root, RunID: run.ID, StageDir: stage, Descriptors: result.Artifacts,
		MaximumBytes: governance.DefaultMaximumArtifactBytes, AllowLegacyFixture: true,
		Provenance: domain.Provenance{WorkerVersion: result.WorkerVersion, ModelVersion: result.ModelVersion,
			ConnectorVersion: connectors.FixtureID, ParserVersion: "golem-go-fixture.v1"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if mutate != nil {
		mutate(t, root, run.ID)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := storage.Open(filepath.Join(root, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	recovered, err := reopened.GetRun(context.Background(), run.ID)
	if err != nil {
		_ = reopened.Close()
		t.Fatal(err)
	}
	if recovered.Status != domain.RunQueued || recovered.Stage != "recovered" {
		_ = reopened.Close()
		t.Fatalf("published crash run did not become recovered: %+v", recovered)
	}
	return reopened, root, run
}

func createInterruptedRun(t *testing.T, cancel bool) (*storage.Store, string, domain.Run) {
	t.Helper()
	root := t.TempDir()
	store, err := storage.Open(filepath.Join(root, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	run := createAndClaimRecoveryRun(t, store)
	if cancel {
		if _, err := store.RequestCancel(context.Background(), run.ID, "cancel during restart"); err != nil {
			_ = store.Close()
			t.Fatal(err)
		}
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := storage.Open(filepath.Join(root, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.GetRun(context.Background(), run.ID)
	if err != nil {
		_ = reopened.Close()
		t.Fatal(err)
	}
	if cancel {
		if got.Status != domain.RunCancelled {
			_ = reopened.Close()
			t.Fatalf("cancelled interrupted run = %+v", got)
		}
	} else if got.Status != domain.RunQueued || got.Stage != "recovered" {
		_ = reopened.Close()
		t.Fatalf("interrupted run = %+v", got)
	}
	return reopened, root, run
}

func createAndClaimRecoveryRun(t *testing.T, store *storage.Store) domain.Run {
	t.Helper()
	request, err := json.Marshal(domain.JobRequest{Comparison: &domain.ComparisonStartRequest{
		ProjectID: "recovery-test", TargetIDs: []string{"northstar-labs", "orbit-coffee"}, ConnectorIDs: []string{connectors.FixtureID},
	}})
	if err != nil {
		t.Fatal(err)
	}
	run, err := store.CreateRun(context.Background(), "recovery-test", domain.WorkflowCompare, request, nil)
	if err != nil {
		t.Fatal(err)
	}
	claimed, err := store.ClaimNextRun(context.Background())
	if err != nil || claimed.ID != run.ID {
		t.Fatalf("claim recovery run = %+v, %v", claimed, err)
	}
	return run
}

func rewriteRecoveredReport(t *testing.T, root, runID string, mutate func(*domain.ComparisonReport)) {
	t.Helper()
	evidence := filepath.Join(root, "runs", runID, "evidence")
	reportPath := filepath.Join(evidence, "report.json")
	payload, err := os.ReadFile(reportPath)
	if err != nil {
		t.Fatal(err)
	}
	var report domain.ComparisonReport
	if err := json.Unmarshal(payload, &report); err != nil {
		t.Fatal(err)
	}
	mutate(&report)
	payload, err = json.MarshalIndent(report, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	payload = append(payload, '\n')
	if err := os.WriteFile(reportPath, payload, 0o600); err != nil {
		t.Fatal(err)
	}

	manifestPath := filepath.Join(evidence, "evidence-manifest.json")
	manifestPayload, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest governance.EvidenceManifest
	if err := json.Unmarshal(manifestPayload, &manifest); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(payload)
	for index := range manifest.Artifacts {
		if manifest.Artifacts[index].RelativePath == "report.json" {
			manifest.Artifacts[index].SHA256 = hex.EncodeToString(digest[:])
			manifest.Artifacts[index].SizeBytes = int64(len(payload))
		}
	}
	manifestPayload, err = json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	manifestPayload = append(manifestPayload, '\n')
	if err := os.WriteFile(manifestPath, manifestPayload, 0o600); err != nil {
		t.Fatal(err)
	}
}

func fixturePath() (string, error) {
	return filepath.Abs(filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson"))
}
