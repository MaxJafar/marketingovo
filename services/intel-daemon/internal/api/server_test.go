package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/connectors"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/jobs"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/storage"
)

func TestBearerAndOneTimeBrowserSessionBoundaries(t *testing.T) {
	environment := newTestAPI(t)
	response, err := http.Get(environment.server.URL + "/v1/health")
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d", response.StatusCode)
	}
	response.Body.Close()

	unauthorized := postJSON(t, http.DefaultClient, environment.server.URL+"/v1/comparisons", comparisonBody(), nil)
	if unauthorized.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated comparison status = %d", unauthorized.StatusCode)
	}
	unauthorized.Body.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	browser := &http.Client{Jar: jar}
	missingOrigin := postJSON(t, browser, environment.server.URL+"/v1/session/bootstrap", map[string]string{"token": environment.bootstrapToken}, nil)
	if missingOrigin.StatusCode != http.StatusForbidden {
		t.Fatalf("bootstrap without Origin = %d", missingOrigin.StatusCode)
	}
	missingOrigin.Body.Close()
	evilOrigin := postJSON(t, browser, environment.server.URL+"/v1/session/bootstrap", map[string]string{"token": environment.bootstrapToken}, map[string]string{"Origin": "http://127.0.0.1:1"})
	if evilOrigin.StatusCode != http.StatusForbidden {
		t.Fatalf("bootstrap with evil Origin = %d", evilOrigin.StatusCode)
	}
	evilOrigin.Body.Close()
	bootstrap := postJSON(t, browser, environment.server.URL+"/v1/session/bootstrap", map[string]string{"token": environment.bootstrapToken}, map[string]string{"Origin": environment.server.URL})
	if bootstrap.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(bootstrap.Body)
		t.Fatalf("bootstrap status = %d: %s", bootstrap.StatusCode, payload)
	}
	var session sessionResponse
	if err := json.NewDecoder(bootstrap.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookies := bootstrap.Cookies()
	bootstrap.Body.Close()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode || session.CSRF == "" {
		t.Fatalf("unsafe session response: cookies=%+v body=%+v", cookies, session)
	}
	second := postJSON(t, &http.Client{}, environment.server.URL+"/v1/session/bootstrap", map[string]string{"token": environment.bootstrapToken}, map[string]string{"Origin": environment.server.URL})
	if second.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bootstrap ticket was reusable: %d", second.StatusCode)
	}
	second.Body.Close()

	serviceOnly := &http.Client{}
	sessionRequest, _ := http.NewRequest(http.MethodGet, environment.server.URL+"/v1/session", nil)
	sessionRequest.Header.Set("Authorization", "Bearer "+environment.serviceToken)
	sessionResult, err := serviceOnly.Do(sessionRequest)
	if err != nil {
		t.Fatal(err)
	}
	if sessionResult.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bearer minted/read a browser session: %d", sessionResult.StatusCode)
	}
	sessionResult.Body.Close()

	withoutCSRF := postJSON(t, browser, environment.server.URL+"/v1/comparisons", comparisonBody(), map[string]string{"Origin": environment.server.URL})
	if withoutCSRF.StatusCode != http.StatusForbidden {
		t.Fatalf("cookie mutation without CSRF = %d", withoutCSRF.StatusCode)
	}
	withoutCSRF.Body.Close()
	wrongOrigin := postJSON(t, browser, environment.server.URL+"/v1/comparisons", comparisonBody(), map[string]string{"Origin": "http://127.0.0.1:1", "X-AgentIntel-CSRF": session.CSRF})
	if wrongOrigin.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-origin cookie mutation = %d", wrongOrigin.StatusCode)
	}
	wrongOrigin.Body.Close()
	accepted := postJSON(t, browser, environment.server.URL+"/v1/comparisons", comparisonBody(), map[string]string{"Origin": environment.server.URL, "X-AgentIntel-CSRF": session.CSRF})
	if accepted.StatusCode != http.StatusAccepted {
		payload, _ := io.ReadAll(accepted.Body)
		t.Fatalf("session mutation status = %d: %s", accepted.StatusCode, payload)
	}
	accepted.Body.Close()

	bearer := postJSON(t, http.DefaultClient, environment.server.URL+"/v1/comparisons", comparisonBody(), map[string]string{"Authorization": "Bearer " + environment.serviceToken})
	if bearer.StatusCode != http.StatusAccepted {
		payload, _ := io.ReadAll(bearer.Body)
		t.Fatalf("bearer mutation status = %d: %s", bearer.StatusCode, payload)
	}
	bearer.Body.Close()
}

func TestEverySurfaceRejectsReboundHost(t *testing.T) {
	environment := newTestAPI(t)
	tests := []struct {
		method string
		path   string
		body   any
	}{
		{method: http.MethodGet, path: "/v1/health"},
		{method: http.MethodGet, path: "/"},
		{method: http.MethodPost, path: "/v1/session/bootstrap", body: map[string]string{"token": environment.bootstrapToken}},
	}
	for _, test := range tests {
		var body io.Reader
		if test.body != nil {
			payload, _ := json.Marshal(test.body)
			body = bytes.NewReader(payload)
		}
		request, err := http.NewRequest(test.method, environment.server.URL+test.path, body)
		if err != nil {
			t.Fatal(err)
		}
		request.Host = "evil.example:443"
		if test.body != nil {
			request.Header.Set("Content-Type", "application/json")
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusMisdirectedRequest {
			t.Fatalf("%s %s with rebound Host = %d", test.method, test.path, response.StatusCode)
		}
	}
}

func TestReportSearchAndSSEUseDurableCommittedEvidence(t *testing.T) {
	environment := newTestAPI(t)
	client, err := NewClient(environment.server.URL, environment.serviceToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	request := domain.ComparisonStartRequest{ProjectID: "api", TargetIDs: []string{"northstar-labs", "vertex-studio"}}
	var run domain.Run
	if err := client.Do(context.Background(), http.MethodPost, "/v1/comparisons", request, &run); err != nil {
		t.Fatal(err)
	}
	terminal := waitAPIRun(t, client, run.ID)
	if terminal.Status != domain.RunSucceeded || !terminal.ReportAvailable {
		t.Fatalf("unexpected terminal run: %+v", terminal)
	}
	var report domain.ComparisonReport
	if err := client.Do(context.Background(), http.MethodGet, "/v1/runs/"+run.ID+"/report", nil, &report); err != nil {
		t.Fatal(err)
	}
	if report.RunID != run.ID || len(report.Targets) != 2 {
		t.Fatalf("unexpected report: %+v", report)
	}
	var search []domain.SearchResult
	if err := client.Do(context.Background(), http.MethodGet, "/v1/search?q=Northstar&limit=10", nil, &search); err != nil {
		t.Fatal(err)
	}
	if len(search) == 0 {
		t.Fatal("search did not return committed evidence")
	}
	var events []domain.RunEvent
	if err := client.StreamEvents(context.Background(), run.ID, 0, func(event domain.RunEvent) error {
		events = append(events, event)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if len(events) < 2 {
		t.Fatalf("expected durable event stream, got %+v", events)
	}
	for index := 1; index < len(events); index++ {
		if events[index].Sequence <= events[index-1].Sequence {
			t.Fatalf("out-of-order events: %+v", events)
		}
	}
}

type testAPIEnvironment struct {
	server         *httptest.Server
	serviceToken   string
	bootstrapToken string
}

func newTestAPI(t *testing.T) testAPIEnvironment {
	t.Helper()
	root := t.TempDir()
	dataRoot := filepath.Join(root, "private")
	store, err := storage.Open(filepath.Join(dataRoot, "state.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	fixture, _ := filepath.Abs(filepath.Join("..", "..", "..", "..", "fixtures", "competitive-pulse", "raw", "observations.ndjson"))
	manager, err := jobs.New(jobs.Config{
		Store: store, DataRoot: dataRoot, FixturePath: fixture,
		Worker: &connectors.FixtureWorker{FixturePath: fixture}, Concurrency: 1, PollInterval: 5 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	dashboard := filepath.Join(root, "dashboard")
	if err := os.MkdirAll(dashboard, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dashboard, "index.html"), []byte("<!doctype html><title>AGENTintel</title>"), 0o600); err != nil {
		t.Fatal(err)
	}
	serviceToken, _ := GenerateToken()
	bootstrapToken, _ := GenerateToken()
	server, err := NewServer(ServerConfig{
		Store: store, Jobs: manager, DataRoot: dataRoot, ServiceToken: serviceToken,
		BootstrapToken: bootstrapToken, DashboardDir: dashboard, SSEPoll: 5 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(server.Handler())
	t.Cleanup(func() {
		httpServer.Close()
		cancel()
		manager.Close()
		store.Close()
	})
	return testAPIEnvironment{server: httpServer, serviceToken: serviceToken, bootstrapToken: bootstrapToken}
}

func comparisonBody() domain.ComparisonStartRequest {
	return domain.ComparisonStartRequest{ProjectID: "browser", TargetIDs: []string{"northstar-labs", "orbit-coffee"}}
}

func postJSON(t *testing.T, client *http.Client, endpoint string, body any, headers map[string]string) *http.Response {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func waitAPIRun(t *testing.T, client *Client, runID string) domain.RunDetail {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var detail domain.RunDetail
		if err := client.Do(context.Background(), http.MethodGet, "/v1/runs/"+runID, nil, &detail); err == nil && detail.Status.Terminal() {
			return detail
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("run %s did not become terminal", runID)
	return domain.RunDetail{}
}
