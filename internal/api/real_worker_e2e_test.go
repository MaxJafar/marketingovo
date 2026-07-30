package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/GolemWorkers/agentintel/internal/connectors"
	"github.com/GolemWorkers/agentintel/internal/domain"
	"github.com/GolemWorkers/agentintel/internal/governance"
	"github.com/GolemWorkers/agentintel/internal/jobs"
	"github.com/GolemWorkers/agentintel/internal/storage"
)

func TestRealPythonWorkerThroughHTTPAndGoAuthority(t *testing.T) {
	if os.Getenv("AGENTINTEL_REAL_WORKER_E2E") != "1" {
		t.Skip("set AGENTINTEL_REAL_WORKER_E2E=1 to run the pinned real-Python HTTP/authority acceptance")
	}
	uv, err := exec.LookPath("uv")
	if err != nil {
		t.Skipf("pinned uv runtime is not provisioned: %v", err)
	}
	uv, err = filepath.EvalSymlinks(uv)
	if err != nil {
		t.Fatal(err)
	}
	uv, err = filepath.Abs(uv)
	if err != nil {
		t.Fatal(err)
	}
	project, err := filepath.Abs(filepath.Join("..", "..", "workers", "intelligence"))
	if err != nil {
		t.Fatal(err)
	}
	fixture, err := filepath.Abs(filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(project, ".venv")); err != nil {
		t.Skipf("pinned Python virtual environment is not provisioned: %v", err)
	}
	dataRoot := filepath.Join(t.TempDir(), "private")
	store, err := storage.Open(filepath.Join(dataRoot, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	manager, err := jobs.New(jobs.Config{Store: store, DataRoot: dataRoot, FixturePath: fixture,
		Worker: &connectors.WorkerRunner{UVCommand: uv, ProjectDir: project}, Concurrency: 1, PollInterval: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	serviceToken, _ := GenerateToken()
	bootstrapToken, _ := GenerateToken()
	server, err := NewServer(ServerConfig{Store: store, Jobs: manager, DataRoot: dataRoot, ServiceToken: serviceToken,
		BootstrapToken: bootstrapToken, SSEPoll: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(server.Handler())
	t.Cleanup(func() { httpServer.Close(); cancel(); manager.Close(); store.Close() })
	client, err := NewClient(httpServer.URL, serviceToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	var run domain.Run
	if err := client.Do(context.Background(), http.MethodPost, "/v1/comparisons", comparisonBody(), &run); err != nil {
		t.Fatal(err)
	}
	detail := waitRealWorkerRun(t, client, run.ID)
	if detail.Status != domain.RunSucceeded {
		code, message := "", ""
		if detail.ErrorCode != nil {
			code = *detail.ErrorCode
		}
		if detail.ErrorMessage != nil {
			message = *detail.ErrorMessage
		}
		t.Fatalf("real worker run failed: code=%s message=%s run=%+v", code, message, detail.Run)
	}
	if detail.WorkerVersion == "" || detail.ModelVersion == "" || detail.ConnectorVersion != "fixture.competitive-pulse@1.0.0" || detail.ParserVersion != governance.CanonicalParserVersion {
		t.Fatalf("real worker provenance was not authority-derived: %+v", detail.Run)
	}
	kinds := map[string]bool{}
	for _, artifact := range detail.Artifacts {
		kinds[artifact.Kind] = true
	}
	for _, kind := range []string{"arrow", "parquet", "report", "manifest"} {
		if !kinds[kind] {
			t.Fatalf("real worker omitted %s artifact: %+v", kind, detail.Artifacts)
		}
	}
}

func TestRealPythonImportedCSVThroughHTTPAndGoAuthority(t *testing.T) {
	if os.Getenv("AGENTINTEL_REAL_WORKER_E2E") != "1" {
		t.Skip("set AGENTINTEL_REAL_WORKER_E2E=1 to run the pinned real-Python HTTP/authority acceptance")
	}
	uv, err := exec.LookPath("uv")
	if err != nil {
		t.Skipf("pinned uv runtime is not provisioned: %v", err)
	}
	uv, err = filepath.EvalSymlinks(uv)
	if err != nil {
		t.Fatal(err)
	}
	project, err := filepath.Abs(filepath.Join("..", "..", "workers", "intelligence"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(project, ".venv")); err != nil {
		t.Skipf("pinned Python virtual environment is not provisioned: %v", err)
	}
	fixture, err := filepath.Abs(filepath.Join("..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson"))
	if err != nil {
		t.Fatal(err)
	}
	csvPath, err := filepath.Abs(filepath.Join("..", "..", "fixtures", "competitive-pulse-import-v1", "competitive-pulse.csv"))
	if err != nil {
		t.Fatal(err)
	}
	csv, err := os.ReadFile(csvPath)
	if err != nil {
		t.Fatal(err)
	}
	originalPath := filepath.Join(t.TempDir(), "analyst-selected.csv")
	if err := os.WriteFile(originalPath, csv, 0o600); err != nil {
		t.Fatal(err)
	}
	upload, err := os.ReadFile(originalPath)
	if err != nil {
		t.Fatal(err)
	}
	dataRoot := filepath.Join(t.TempDir(), "private")
	store, err := storage.Open(filepath.Join(dataRoot, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	manager, err := jobs.New(jobs.Config{Store: store, DataRoot: dataRoot, FixturePath: fixture,
		Worker: &connectors.WorkerRunner{UVCommand: uv, ProjectDir: project}, Concurrency: 1, PollInterval: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	serviceToken, _ := GenerateToken()
	bootstrapToken, _ := GenerateToken()
	server, err := NewServer(ServerConfig{Store: store, Jobs: manager, DataRoot: dataRoot, ServiceToken: serviceToken, BootstrapToken: bootstrapToken, SSEPoll: 5 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(server.Handler())
	t.Cleanup(func() { httpServer.Close(); cancel(); manager.Close(); store.Close() })
	request, err := http.NewRequest(http.MethodPost, httpServer.URL+"/v1/datasets/competitive-pulse/preview", bytes.NewReader(upload))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+serviceToken)
	request.Header.Set("Content-Type", "text/csv; charset=utf-8")
	request.Header.Set("X-AgentIntel-Import-Attestation", "public-permitted-brand-competitive-research.v1")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("import preview status = %d", response.StatusCode)
	}
	var preview domain.ImportPreview
	if err := json.NewDecoder(response.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.Valid || preview.DatasetID == "" || preview.Policy == nil || preview.Policy.AttestationVersion != "public-permitted-brand-competitive-research.v1" {
		t.Fatalf("unexpected import preview: %+v", preview)
	}
	if err := os.Remove(originalPath); err != nil {
		t.Fatal(err)
	}
	client, err := NewClient(httpServer.URL, serviceToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	var run domain.Run
	comparison := domain.ComparisonStartRequest{ProjectID: "import-e2e", DatasetID: preview.DatasetID, TargetIDs: []string{"northstar-labs", "vertex-studio"}}
	if err := client.Do(context.Background(), http.MethodPost, "/v1/comparisons", comparison, &run); err != nil {
		t.Fatal(err)
	}
	detail := waitRealWorkerRun(t, client, run.ID)
	if detail.Status != domain.RunSucceeded {
		code, message := "", ""
		if detail.ErrorCode != nil {
			code = *detail.ErrorCode
		}
		if detail.ErrorMessage != nil {
			message = *detail.ErrorMessage
		}
		t.Fatalf("imported real worker run failed: code=%s message=%s run=%+v", code, message, detail.Run)
	}
	if detail.DatasetID != preview.DatasetID || detail.ConnectorVersion != "local.competitive-pulse-import@1.0.0" || detail.ParserVersion != domain.CompetitivePulseParserVersion {
		t.Fatalf("import provenance was not authority-derived: %+v", detail.Run)
	}
	var replay domain.Run
	if err := client.Do(context.Background(), http.MethodPost, "/v1/runs/"+run.ID+"/replay", nil, &replay); err != nil {
		t.Fatal(err)
	}
	if replayDetail := waitRealWorkerRun(t, client, replay.ID); replayDetail.Status != domain.RunSucceeded || replayDetail.DatasetID != preview.DatasetID {
		t.Fatalf("snapshot replay after deleting the original CSV failed: %+v", replayDetail.Run)
	}
}

func waitRealWorkerRun(t *testing.T, client *Client, runID string) domain.RunDetail {
	t.Helper()
	deadline := time.Now().Add(60 * time.Second)
	for time.Now().Before(deadline) {
		var detail domain.RunDetail
		if err := client.Do(context.Background(), http.MethodGet, "/v1/runs/"+runID, nil, &detail); err == nil && detail.Status.Terminal() {
			return detail
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("real worker run %s did not become terminal", runID)
	return domain.RunDetail{}
}
