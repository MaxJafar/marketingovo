package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/connectors"
	"github.com/GolemWorkers/golem-intel/internal/domain"
	"github.com/GolemWorkers/golem-intel/internal/governance"
	"github.com/GolemWorkers/golem-intel/internal/jobs"
	"github.com/GolemWorkers/golem-intel/internal/storage"
)

func TestRealPythonWorkerThroughHTTPAndGoAuthority(t *testing.T) {
	if os.Getenv("GOLEM_INTEL_REAL_WORKER_E2E") != "1" {
		t.Skip("set GOLEM_INTEL_REAL_WORKER_E2E=1 to run the pinned real-Python HTTP/authority acceptance")
	}
	uv, err := exec.LookPath("uv")
	if err != nil {
		t.Skipf("pinned uv runtime is not provisioned: %v", err)
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
	detail := waitAPIRun(t, client, run.ID)
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
