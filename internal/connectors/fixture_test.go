package connectors

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/GolemWorkers/agentintel/internal/domain"
	"github.com/GolemWorkers/agentintel/internal/governance"
)

func TestFixtureReportProducesGoldenFollowerDeltas(t *testing.T) {
	fixture := filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson")
	worker := &FixtureWorker{FixturePath: fixture}
	result, err := worker.Analyze(context.Background(), AnalysisRequest{
		RunID: "run-golden", ProjectID: "demo", OutputDir: t.TempDir(),
		TargetIDs: []string{"northstar-labs", "orbit-coffee", "vertex-studio"},
		Options:   map[string]string{"simulate": "none"},
	}, nil)
	if err != nil {
		t.Fatalf("fixture analysis: %v", err)
	}
	if !result.Succeeded || len(result.Entities) != 3 {
		t.Fatalf("unexpected result: %+v", result)
	}
	observations, err := LoadObservations(fixture, []string{"northstar-labs", "orbit-coffee", "vertex-studio"})
	if err != nil {
		t.Fatal(err)
	}
	report, _, _, err := BuildFixtureReport("run-golden", []string{"northstar-labs", "orbit-coffee", "vertex-studio"}, nil, observations)
	if err != nil {
		t.Fatal(err)
	}
	deltas := []float64{report.Targets[0].FollowerDelta, report.Targets[1].FollowerDelta, report.Targets[2].FollowerDelta}
	want := []float64{600, 240, -80}
	for index := range want {
		if deltas[index] != want[index] {
			t.Fatalf("delta[%d]=%v, want %v", index, deltas[index], want[index])
		}
	}
	encoded := strings.ToLower(report.Summary + " " + strings.Join(report.Targets[2].Warnings, " "))
	for _, forbidden := range []string{"retention", "churn"} {
		if strings.Contains(encoded, forbidden) {
			t.Fatalf("fixture output used forbidden inference language %q", forbidden)
		}
	}
}

func TestFixtureCorruptionSimulationIsRejected(t *testing.T) {
	root := t.TempDir()
	stage := filepath.Join(root, "spool")
	worker := &FixtureWorker{FixturePath: filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson")}
	result, err := worker.Analyze(context.Background(), AnalysisRequest{
		RunID: "run-corrupt", ProjectID: "demo", OutputDir: stage,
		TargetIDs: []string{"northstar-labs", "orbit-coffee"}, Options: map[string]string{"simulate": "corrupt_artifact"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := governance.CommitEvidence(governance.CommitOptions{DataRoot: root, RunID: "run-corrupt", StageDir: stage, Descriptors: result.Artifacts,
		Provenance: domain.Provenance{WorkerVersion: "fixture.v1", ModelVersion: "none", ConnectorVersion: "fixture.v1", ParserVersion: "golem-go-fixture.v1"}}); err == nil {
		t.Fatal("corrupt fixture artifact was committed")
	}
}
