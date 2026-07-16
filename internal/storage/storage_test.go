package storage

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"

	"github.com/GolemWorkers/golem-intel/internal/domain"
)

func TestDurableRunCancellationReplayAndRecovery(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "control.sqlite")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	request, _ := json.Marshal(domain.JobRequest{Comparison: &domain.ComparisonStartRequest{ProjectID: "demo", TargetIDs: []string{"northstar-labs", "orbit-coffee"}}})
	run, err := store.createRun(ctx, "demo", domain.WorkflowCompare, request, nil, domain.InputSnapshot{
		RelativePath: "input-snapshots/test.ndjson", SHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		SchemaID: "golem.fixture-observations.v1", SizeBytes: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	cancelled, err := store.RequestCancel(ctx, run.ID, "test cancellation")
	if err != nil || cancelled.Status != domain.RunCancelled {
		t.Fatalf("cancel queued run: status=%s err=%v", cancelled.Status, err)
	}
	replay, err := store.ReplayRun(ctx, run.ID)
	if err != nil || replay.ReplayOf == nil || *replay.ReplayOf != run.ID {
		t.Fatalf("replay terminal run: %+v err=%v", replay, err)
	}
	claimed, err := store.ClaimNextRun(ctx)
	if err != nil || claimed.ID != replay.ID || claimed.Status != domain.RunRunning {
		t.Fatalf("claim replay: %+v err=%v", claimed, err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	recovered, err := reopened.GetRun(ctx, replay.ID)
	if err != nil || recovered.Status != domain.RunQueued || recovered.Stage != "recovered" {
		t.Fatalf("recover interrupted run: %+v err=%v", recovered, err)
	}
	events, err := reopened.ListEventsAfter(ctx, replay.ID, 0, 50)
	if err != nil || len(events) < 3 {
		t.Fatalf("durable events missing: count=%d err=%v", len(events), err)
	}
}

func TestCompleteRunPersistsArtifactsEntitiesAndSearch(t *testing.T) {
	ctx := context.Background()
	store, err := Open(filepath.Join(t.TempDir(), "control.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	request := []byte(`{"comparison":{"project_id":"demo","target_ids":["a","b"]}}`)
	run, err := store.CreateRun(ctx, "demo", domain.WorkflowCompare, request, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.ClaimNextRun(ctx); err != nil {
		t.Fatal(err)
	}
	report := domain.Artifact{ID: "artifact-report", RunID: run.ID, Kind: "report", RelativePath: "runs/x/evidence/report.json", MediaType: "application/json", SHA256: string(make([]byte, 64)), SchemaID: "golem.comparison-report.v1", DataClass: "public"}
	entity := domain.Entity{ID: "northstar-labs", Type: "social_account", DisplayName: "Northstar Labs", ResolutionState: "observed"}
	if err := store.CompleteRun(ctx, run.ID, []domain.Artifact{report}, []domain.Entity{entity}, []domain.SearchDocument{{Kind: "entity", ID: entity.ID, Label: entity.DisplayName, Excerpt: "fixture", Confidence: 1}}, false); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ReportArtifact(ctx, run.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.GetEntity(ctx, entity.ID); err != nil {
		t.Fatal(err)
	}
	results, err := store.Search(ctx, "northstar", 10)
	if err != nil || len(results) != 1 {
		t.Fatalf("search: %+v err=%v", results, err)
	}
	if _, err := store.RequestCancel(ctx, run.ID, "too late"); !errors.Is(err, ErrConflict) {
		t.Fatalf("terminal cancellation returned %v", err)
	}
}
