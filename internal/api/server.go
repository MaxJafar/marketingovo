package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/GolemWorkers/golem-intel/internal/domain"
	"github.com/GolemWorkers/golem-intel/internal/governance"
	"github.com/GolemWorkers/golem-intel/internal/jobs"
	"github.com/GolemWorkers/golem-intel/internal/policy"
	"github.com/GolemWorkers/golem-intel/internal/storage"
)

type ServerConfig struct {
	Store          *storage.Store
	Jobs           *jobs.Manager
	DataRoot       string
	ServiceToken   string
	BootstrapToken string
	DashboardDir   string
	SSEPoll        time.Duration
}

type Server struct {
	store              *storage.Store
	jobs               *jobs.Manager
	dataRoot           string
	serviceToken       string
	ssePoll            time.Duration
	handler            http.Handler
	sessionMu          sync.Mutex
	bootstrapHash      [32]byte
	bootstrapAvailable bool
	sessions           map[[32]byte]browserSession
}

type problem struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail,omitempty"`
	Instance string `json:"instance,omitempty"`
	Code     string `json:"code,omitempty"`
}

func NewServer(config ServerConfig) (*Server, error) {
	if config.Store == nil || config.Jobs == nil {
		return nil, fmt.Errorf("API server requires storage and jobs manager")
	}
	if err := ValidateToken(config.ServiceToken); err != nil {
		return nil, fmt.Errorf("service token: %w", err)
	}
	if err := ValidateToken(config.BootstrapToken); err != nil {
		return nil, fmt.Errorf("dashboard bootstrap token: %w", err)
	}
	if subtle.ConstantTimeCompare([]byte(config.ServiceToken), []byte(config.BootstrapToken)) == 1 {
		return nil, fmt.Errorf("service and dashboard bootstrap tokens must be distinct")
	}
	if config.DataRoot == "" {
		return nil, fmt.Errorf("API server requires a data root")
	}
	dataRoot, err := filepath.Abs(config.DataRoot)
	if err != nil {
		return nil, err
	}
	poll := config.SSEPoll
	if poll <= 0 {
		poll = 200 * time.Millisecond
	}
	server := &Server{
		store: config.Store, jobs: config.Jobs, dataRoot: dataRoot, serviceToken: config.ServiceToken, ssePoll: poll,
		bootstrapHash: sha256.Sum256([]byte(config.BootstrapToken)), bootstrapAvailable: true,
		sessions: make(map[[32]byte]browserSession),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", server.health)
	mux.HandleFunc("POST /v1/session/bootstrap", server.bootstrapSession)
	mux.HandleFunc("GET /v1/session", server.getSession)
	mux.HandleFunc("POST /v1/comparisons", server.startComparison)
	mux.HandleFunc("POST /v1/research", server.startResearch)
	mux.HandleFunc("GET /v1/runs", server.listRuns)
	mux.HandleFunc("GET /v1/runs/{runId}", server.getRun)
	mux.HandleFunc("GET /v1/runs/{runId}/events", server.events)
	mux.HandleFunc("POST /v1/runs/{runId}/cancel", server.cancelRun)
	mux.HandleFunc("POST /v1/runs/{runId}/replay", server.replayRun)
	mux.HandleFunc("GET /v1/runs/{runId}/report", server.report)
	mux.HandleFunc("GET /v1/search", server.search)
	mux.HandleFunc("GET /v1/entities/{entityId}", server.entity)
	mux.HandleFunc("GET /v1/monitoring/status", server.monitoring)
	mux.HandleFunc("/v1/", func(writer http.ResponseWriter, request *http.Request) {
		writeProblem(writer, request, http.StatusNotFound, "not_found", "API route not found")
	})
	mux.HandleFunc("/v1", func(writer http.ResponseWriter, request *http.Request) {
		writeProblem(writer, request, http.StatusNotFound, "not_found", "API route not found")
	})
	mux.Handle("/", newSPAHandler(config.DashboardDir))
	server.handler = server.requireLoopbackHost(server.authenticate(mux))
	return server, nil
}

func (server *Server) Handler() http.Handler { return server.handler }

func (server *Server) requireLoopbackHost(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		host, port, err := net.SplitHostPort(request.Host)
		parsedPort, portErr := strconv.Atoi(port)
		if err != nil || portErr != nil || host != "127.0.0.1" || parsedPort < 1 || parsedPort > 65535 {
			writeProblem(writer, request, http.StatusMisdirectedRequest, "loopback_host_required", "Host must be the exact 127.0.0.1:<port> service origin")
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func (server *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/v1/health" || request.URL.Path == "/v1/session/bootstrap" || request.URL.Path == "/v1/session" || request.URL.Path != "/v1" && !strings.HasPrefix(request.URL.Path, "/v1/") {
			next.ServeHTTP(writer, request)
			return
		}
		header := request.Header.Get("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			candidate := strings.TrimPrefix(header, "Bearer ")
			if len(candidate) == len(server.serviceToken) && subtle.ConstantTimeCompare([]byte(candidate), []byte(server.serviceToken)) == 1 {
				next.ServeHTTP(writer, request)
				return
			}
			writer.Header().Set("WWW-Authenticate", `Bearer realm="golem-intel"`)
			writeProblem(writer, request, http.StatusUnauthorized, "unauthorized", "The local bearer token is invalid")
			return
		}
		session, ok := server.readBrowserSession(request, false)
		if !ok {
			writer.Header().Set("WWW-Authenticate", `Bearer realm="golem-intel"`)
			writeProblem(writer, request, http.StatusUnauthorized, "unauthorized", "A local bearer token or dashboard session is required")
			return
		}
		if request.Method != http.MethodGet && request.Method != http.MethodHead && request.Method != http.MethodOptions {
			provided := request.Header.Get("X-Golem-CSRF")
			if len(provided) != len(session.CSRF) || subtle.ConstantTimeCompare([]byte(provided), []byte(session.CSRF)) != 1 || !requestHasSameOrigin(request) {
				writeProblem(writer, request, http.StatusForbidden, "csrf_failed", "Dashboard mutation requires a valid same-origin CSRF token")
				return
			}
		}
		next.ServeHTTP(writer, request)
	})
}

func (server *Server) health(writer http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	database, worker, status := "available", "available", "ok"
	if err := server.store.Ping(ctx); err != nil {
		database, status = "unavailable", "degraded"
	}
	if !server.jobs.WorkerAvailable() {
		worker, status = "unavailable", "degraded"
	}
	writeJSON(writer, http.StatusOK, map[string]any{"status": status, "version": domain.Version, "database": database, "worker": worker})
}

func (server *Server) startComparison(writer http.ResponseWriter, request *http.Request) {
	var input domain.ComparisonStartRequest
	if err := decodeJSON(writer, request, &input, false); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	run, err := server.jobs.StartComparison(request.Context(), input)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusAccepted, run)
}

func (server *Server) startResearch(writer http.ResponseWriter, request *http.Request) {
	var input domain.ResearchStartRequest
	if err := decodeJSON(writer, request, &input, false); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	run, err := server.jobs.StartResearch(request.Context(), input)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusAccepted, run)
}

func (server *Server) listRuns(writer http.ResponseWriter, request *http.Request) {
	limit, err := boundedQueryInteger(request, "limit", 50, 1, 200)
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	runs, err := server.store.ListRuns(request.Context(), request.URL.Query().Get("project_id"), limit)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, runs)
}

func (server *Server) getRun(writer http.ResponseWriter, request *http.Request) {
	detail, err := server.store.RunDetail(request.Context(), request.PathValue("runId"))
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, detail)
}

func (server *Server) events(writer http.ResponseWriter, request *http.Request) {
	runID := request.PathValue("runId")
	if _, err := server.store.GetRun(request.Context(), runID); err != nil {
		writeMappedError(writer, request, err)
		return
	}
	after := int64(0)
	if value := request.Header.Get("Last-Event-ID"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed < 0 {
			writeProblem(writer, request, http.StatusBadRequest, "invalid_last_event_id", "Last-Event-ID must be a non-negative event sequence")
			return
		}
		after = parsed
	}
	flusher, ok := writer.(http.Flusher)
	if !ok {
		writeProblem(writer, request, http.StatusInternalServerError, "streaming_unavailable", "HTTP streaming is unavailable")
		return
	}
	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-cache, no-store")
	writer.Header().Set("X-Accel-Buffering", "no")
	writer.WriteHeader(http.StatusOK)
	flusher.Flush()
	ticker := time.NewTicker(server.ssePoll)
	defer ticker.Stop()
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		events, err := server.store.ListEventsAfter(request.Context(), runID, after, 200)
		if err != nil {
			return
		}
		for _, event := range events {
			payload, _ := json.Marshal(event)
			if _, err := fmt.Fprintf(writer, "id: %d\nevent: run_event\ndata: %s\n\n", event.Sequence, payload); err != nil {
				return
			}
			after = event.Sequence
		}
		if len(events) > 0 {
			flusher.Flush()
		}
		run, err := server.store.GetRun(request.Context(), runID)
		if err != nil || run.Status.Terminal() && len(events) == 0 {
			return
		}
		select {
		case <-request.Context().Done():
			return
		case <-ticker.C:
		case <-heartbeat.C:
			if _, err := io.WriteString(writer, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (server *Server) cancelRun(writer http.ResponseWriter, request *http.Request) {
	var input struct {
		Reason string `json:"reason"`
	}
	if err := decodeJSON(writer, request, &input, true); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	run, err := server.jobs.Cancel(request.Context(), request.PathValue("runId"), input.Reason)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusAccepted, run)
}

func (server *Server) replayRun(writer http.ResponseWriter, request *http.Request) {
	run, err := server.jobs.Replay(request.Context(), request.PathValue("runId"))
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusAccepted, run)
}

func (server *Server) report(writer http.ResponseWriter, request *http.Request) {
	runID := request.PathValue("runId")
	run, err := server.store.GetRun(request.Context(), runID)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	if !run.ReportAvailable {
		writeMappedError(writer, request, storage.ErrNotFound)
		return
	}
	artifact, err := server.store.ReportArtifact(request.Context(), runID)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	payload, err := governance.ReadVerified(server.dataRoot, artifact, governance.DefaultMaximumArtifactBytes)
	if err != nil {
		writeProblem(writer, request, http.StatusInternalServerError, "artifact_integrity_failure", "The committed report failed integrity verification")
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.Header().Set("Content-Length", strconv.Itoa(len(payload)))
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(payload)
}

func (server *Server) search(writer http.ResponseWriter, request *http.Request) {
	query := strings.TrimSpace(request.URL.Query().Get("q"))
	if count := utf8.RuneCountInString(query); count < 2 || count > 200 {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", "q must contain 2 to 200 characters")
		return
	}
	limit, err := boundedQueryInteger(request, "limit", 20, 1, 100)
	if err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	results, err := server.store.Search(request.Context(), query, limit)
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, results)
}

func (server *Server) entity(writer http.ResponseWriter, request *http.Request) {
	entity, err := server.store.GetEntity(request.Context(), request.PathValue("entityId"))
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, entity)
}

func (server *Server) monitoring(writer http.ResponseWriter, request *http.Request) {
	status, err := server.jobs.MonitoringStatus(request.Context())
	if err != nil {
		writeMappedError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, status)
}

func decodeJSON(writer http.ResponseWriter, request *http.Request, destination any, emptyAllowed bool) error {
	if mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type")); request.Header.Get("Content-Type") != "" && (err != nil || mediaType != "application/json") {
		return fmt.Errorf("Content-Type must be application/json")
	}
	request.Body = http.MaxBytesReader(writer, request.Body, 1<<20)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		if emptyAllowed && errors.Is(err, io.EOF) {
			return nil
		}
		return fmt.Errorf("decode JSON body: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return fmt.Errorf("JSON body must contain exactly one value")
	}
	return nil
}

func boundedQueryInteger(request *http.Request, name string, fallback, minimum, maximum int) (int, error) {
	value := request.URL.Query().Get(name)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < minimum || parsed > maximum {
		return 0, fmt.Errorf("%s must be an integer between %d and %d", name, minimum, maximum)
	}
	return parsed, nil
}

func writeMappedError(writer http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, storage.ErrNotFound):
		writeProblem(writer, request, http.StatusNotFound, "not_found", "The requested resource does not exist")
	case errors.Is(err, storage.ErrConflict):
		writeProblem(writer, request, http.StatusConflict, "state_conflict", "The requested operation conflicts with the durable run state")
	case errors.Is(err, policy.ErrInvalidRequest), errors.Is(err, policy.ErrUnsupportedSource):
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
	default:
		writeProblem(writer, request, http.StatusInternalServerError, "internal_error", "The local service could not complete the request")
	}
}

func writeProblem(writer http.ResponseWriter, request *http.Request, status int, code, detail string) {
	writer.Header().Set("Content-Type", "application/problem+json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(problem{
		Type: "urn:golem-intel:problem:" + code, Title: http.StatusText(status), Status: status,
		Detail: detail, Instance: request.URL.Path, Code: code,
	})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func containedPath(root, path string) bool {
	relative, err := filepath.Rel(root, path)
	return err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}
