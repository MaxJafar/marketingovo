package connectors

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/GolemWorkers/agentintel/internal/domain"
)

const maximumWorkerControlBytes = 4 << 20

// PythonWorker is the diagnostic JSON-CLI adapter used by focused tests and
// operator troubleshooting. Production daemon execution uses WorkerRunner's
// length-delimited protobuf boundary. Bulk artifacts remain files in both
// modes and never travel over stdout.
type PythonWorker struct {
	UVCommand  string
	ProjectDir string
}

func (worker *PythonWorker) ID() string { return "python.intelligence" }

func (worker *PythonWorker) Available() bool {
	command := worker.UVCommand
	if command == "" {
		command = "uv"
	}
	if _, err := exec.LookPath(command); err != nil {
		return false
	}
	info, err := os.Stat(filepath.Join(worker.ProjectDir, "pyproject.toml"))
	return err == nil && info.Mode().IsRegular()
}

func (worker *PythonWorker) Analyze(ctx context.Context, request AnalysisRequest, emit ProgressSink) (domain.ConnectorResult, error) {
	if !worker.Available() {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_unavailable", Message: "Python intelligence worker is unavailable"}
	}
	commandName := worker.UVCommand
	if commandName == "" {
		commandName = "uv"
	}
	args := []string{
		"run", "--frozen", "--offline", "--no-dev", "--no-config", "--no-sync", "--project", worker.ProjectDir,
		"python", "-I", "-B", "-m", "agentintel_worker", "analyze",
		"--run-id", request.RunID,
		"--input", request.InputPath,
		"--input-sha256", request.InputSHA256,
		"--output-dir", request.OutputDir,
	}
	for _, targetID := range request.TargetIDs {
		args = append(args, "--target-id", targetID)
	}
	simulation := request.Options["simulate"]
	if simulation == "" {
		simulation = "none"
	}
	args = append(args, "--simulate", simulation)

	command := exec.CommandContext(ctx, commandName, args...)
	command.Dir = request.WorkspacePath
	command.Env = minimalWorkerEnvironment(request.WorkspacePath, worker.ProjectDir)
	stdout, err := command.StdoutPipe()
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	if err := command.Start(); err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_start_failed", Message: "start Python worker", Cause: err}
	}
	progressDone := make(chan struct{})
	go func() {
		defer close(progressDone)
		scanner := bufio.NewScanner(io.LimitReader(stderr, maximumWorkerControlBytes))
		scanner.Buffer(make([]byte, 16<<10), 256<<10)
		for scanner.Scan() {
			var event ProgressEvent
			if json.Unmarshal(scanner.Bytes(), &event) == nil && event.Stage != "" {
				emitProgress(emit, event.Stage, normalizeLevel(event.Level), event.Message, event.Progress)
			}
		}
	}()
	output, readErr := io.ReadAll(io.LimitReader(stdout, maximumWorkerControlBytes+1))
	waitErr := command.Wait()
	<-progressDone
	if readErr != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: "read Python worker result", Cause: readErr}
	}
	if len(output) > maximumWorkerControlBytes {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: "Python worker result exceeded 4 MiB"}
	}
	if ctx.Err() != nil {
		return domain.ConnectorResult{}, ctx.Err()
	}
	if waitErr != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_failed", Message: "Python intelligence worker exited unsuccessfully", Cause: waitErr}
	}
	decoder := json.NewDecoder(bytes.NewReader(output))
	decoder.DisallowUnknownFields()
	var result domain.ConnectorResult
	if err := decoder.Decode(&result); err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: "decode Python worker result", Cause: err}
	}
	if result.ReportRelativePath == "" || len(result.Artifacts) == 0 {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: "Python worker returned incomplete artifact metadata"}
	}
	for index := range result.Artifacts {
		if result.Artifacts[index].Kind == "" {
			result.Artifacts[index].Kind = inferArtifactKind(result.Artifacts[index], result.ReportRelativePath)
		}
	}
	if !result.Succeeded {
		return result, &WorkerError{Code: result.ErrorCode, Message: result.ErrorMessage}
	}
	return result, nil
}

func inferArtifactKind(descriptor domain.ArtifactDescriptor, reportPath string) string {
	if descriptor.RelativePath == reportPath || strings.Contains(descriptor.MediaType, "json") && strings.Contains(descriptor.SchemaID, "report") {
		return "report"
	}
	switch strings.ToLower(filepath.Ext(descriptor.RelativePath)) {
	case ".arrow", ".ipc":
		return "arrow"
	case ".parquet":
		return "parquet"
	default:
		return "raw"
	}
}

func normalizeLevel(value string) string {
	switch value {
	case "debug", "info", "warning", "error":
		return value
	default:
		return "info"
	}
}

func minimalWorkerEnvironment(workspace, projectDir string) []string {
	temporary := filepath.Join(workspace, "tmp")
	cache := filepath.Join(temporary, "uv-cache")
	_ = os.MkdirAll(cache, 0o700)
	return []string{
		"LANG=C.UTF-8",
		"LC_ALL=C.UTF-8",
		"PYTHONUTF8=1",
		"PYTHONDONTWRITEBYTECODE=1",
		"PYTHONNOUSERSITE=1",
		"TMPDIR=" + temporary,
		"TMP=" + temporary,
		"TEMP=" + temporary,
		"UV_CACHE_DIR=" + cache,
		"UV_NO_CONFIG=1",
		"UV_OFFLINE=1",
		"UV_NO_SYNC=1",
		"UV_NO_PROGRESS=1",
		"UV_PROJECT_ENVIRONMENT=" + filepath.Join(projectDir, ".venv"),
	}
}
