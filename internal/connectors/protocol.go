package connectors

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	intelv1 "github.com/GolemWorkers/golem-intel/gen/go/golem/intel/v1"
	"github.com/GolemWorkers/golem-intel/internal/domain"
	"google.golang.org/protobuf/proto"
)

const (
	workerProtocolVersion  = 1
	maximumProtocolMessage = 4 << 20
	maximumWorkerLogBytes  = 256 << 10
)

// WorkerRunner owns the production worker-control boundary. Control messages
// are uint32 big-endian length-delimited protobuf envelopes; bulk evidence is
// written to the bounded spool paths in StartAnalysis and never crosses stdio.
type WorkerRunner struct {
	PythonCommand string
	UVCommand     string
	ProjectDir    string
}

func (runner *WorkerRunner) ID() string { return "python.intelligence.protocol.v1" }

func (runner *WorkerRunner) Available() bool {
	if runner.PythonCommand != "" {
		return isExecutableRegularFile(runner.PythonCommand)
	}
	command := runner.UVCommand
	if command == "" {
		command = "uv"
	}
	if !isExecutableRegularFile(command) {
		return false
	}
	info, err := os.Lstat(filepath.Join(runner.ProjectDir, "pyproject.toml"))
	return err == nil && info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0
}

func (runner *WorkerRunner) Analyze(ctx context.Context, request AnalysisRequest, emit ProgressSink) (domain.ConnectorResult, error) {
	if !runner.Available() {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_unavailable", Message: "Python intelligence protocol worker is unavailable"}
	}
	commandName, arguments := runner.command()
	command := exec.CommandContext(ctx, commandName, arguments...)
	command.Dir = request.WorkspacePath
	command.Env = minimalWorkerEnvironment(request.WorkspacePath, runner.ProjectDir)
	command.WaitDelay = 2 * time.Second

	stdin, err := command.StdinPipe()
	if err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stdin", Cause: err}
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stdout", Cause: err}
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stderr", Cause: err}
	}
	var writeMu sync.Mutex
	write := func(envelope *intelv1.WorkerEnvelope) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return writeProtocolEnvelope(stdin, envelope)
	}
	command.Cancel = func() error {
		cancel := &intelv1.WorkerEnvelope{
			ProtocolVersion: workerProtocolVersion,
			Message: &intelv1.WorkerEnvelope_CancelAnalysis{CancelAnalysis: &intelv1.CancelAnalysis{
				RunId: request.RunID, Reason: "daemon context cancelled",
			}},
		}
		if writeErr := write(cancel); writeErr != nil && !errors.Is(writeErr, os.ErrClosed) {
			return writeErr
		}
		return nil
	}
	if err := command.Start(); err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_start_failed", Message: "start Python protocol worker", Cause: err}
	}
	logDone := make(chan string, 1)
	go func() {
		collector := &boundedLog{maximum: maximumWorkerLogBytes}
		_, _ = io.Copy(collector, stderr)
		logDone <- collector.String()
	}()

	start, err := startAnalysisEnvelope(request)
	if err != nil {
		_ = command.Process.Kill()
		_ = command.Wait()
		<-logDone
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: err.Error()}
	}
	if err := write(start); err != nil {
		_ = command.Process.Kill()
		_ = command.Wait()
		<-logDone
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: "send StartAnalysis", Cause: err}
	}

	reader := bufio.NewReader(stdout)
	var result domain.ConnectorResult
	var receivedResult bool
	var sequence uint64
	for !receivedResult {
		envelope, readErr := readProtocolEnvelope(reader)
		if readErr != nil {
			break
		}
		if envelope.ProtocolVersion != workerProtocolVersion {
			err = fmt.Errorf("unsupported worker protocol version %d", envelope.ProtocolVersion)
			break
		}
		switch message := envelope.Message.(type) {
		case *intelv1.WorkerEnvelope_WorkerEvent:
			event := message.WorkerEvent
			if event == nil || event.RunId != request.RunID || event.Sequence <= sequence || event.Stage == "" || math.IsNaN(event.Progress) || math.IsInf(event.Progress, 0) || event.Progress < 0 || event.Progress > 1 {
				err = fmt.Errorf("invalid or out-of-order WorkerEvent")
				break
			}
			sequence = event.Sequence
			emitProgress(emit, event.Stage, normalizeLevel(event.Level), event.Message, event.Progress)
		case *intelv1.WorkerEnvelope_AnalysisResult:
			if message.AnalysisResult == nil {
				err = fmt.Errorf("empty AnalysisResult")
				break
			}
			result, err = connectorResultFromProto(request.RunID, message.AnalysisResult)
			receivedResult = err == nil
		default:
			err = fmt.Errorf("unexpected worker envelope message %T", envelope.Message)
		}
		if err != nil {
			break
		}
	}
	_ = stdin.Close()
	waitErr := command.Wait()
	logs := <-logDone
	if ctx.Err() != nil {
		return domain.ConnectorResult{}, ctx.Err()
	}
	if err != nil {
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: err.Error(), Cause: waitErr}
	}
	if !receivedResult {
		message := "Python protocol worker closed without AnalysisResult"
		if waitErr != nil {
			message += fmt.Sprintf(" (exit: %v)", waitErr)
		}
		if text := strings.TrimSpace(logs); text != "" {
			message += ": " + text
		}
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_protocol_error", Message: message, Cause: waitErr}
	}
	if waitErr != nil && result.Succeeded {
		message := fmt.Sprintf("Python protocol worker exited unsuccessfully after a successful result: %v", waitErr)
		if text := strings.TrimSpace(logs); text != "" {
			message += ": " + text
		}
		return domain.ConnectorResult{}, &WorkerError{Code: "worker_failed", Message: message, Cause: waitErr}
	}
	if !result.Succeeded {
		code := result.ErrorCode
		if code == "" {
			code = "worker_failed"
		}
		return result, &WorkerError{Code: code, Message: result.ErrorMessage, Cause: waitErr}
	}
	return result, nil
}

// ValidateImport uses the same bounded, length-delimited worker boundary as
// analysis, but returns a proposal only. The Go authority owns the body hash,
// retention clock, durable dataset ID, and eventual publication decision.
func (runner *WorkerRunner) ValidateImport(ctx context.Context, request ImportValidationRequest) (ImportValidationResult, error) {
	if !runner.Available() {
		return ImportValidationResult{}, &WorkerError{Code: "worker_unavailable", Message: "Python intelligence protocol worker is unavailable"}
	}
	if request.RequestID == "" || request.WorkspacePath == "" || request.InputPath == "" || len(request.InputSHA256) != 64 || request.InputSchemaID == "" || request.ValidatedAt.IsZero() {
		return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "import validation request is incomplete"}
	}
	commandName, arguments := runner.command()
	command := exec.CommandContext(ctx, commandName, arguments...)
	command.Dir = request.WorkspacePath
	command.Env = minimalWorkerEnvironment(request.WorkspacePath, runner.ProjectDir)
	command.WaitDelay = 2 * time.Second
	stdin, err := command.StdinPipe()
	if err != nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stdin", Cause: err}
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stdout", Cause: err}
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_start_failed", Message: "open worker stderr", Cause: err}
	}
	if err := command.Start(); err != nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_start_failed", Message: "start Python protocol worker", Cause: err}
	}
	logDone := make(chan struct{}, 1)
	go func() { _, _ = io.Copy(&boundedLog{maximum: maximumWorkerLogBytes}, stderr); logDone <- struct{}{} }()
	envelope := &intelv1.WorkerEnvelope{ProtocolVersion: workerProtocolVersion,
		Message: &intelv1.WorkerEnvelope_ValidateImport{ValidateImport: &intelv1.ValidateImport{
			RequestId: request.RequestID, InputPath: request.InputPath, InputSha256: request.InputSHA256,
			InputSchemaId: request.InputSchemaID, ValidatedAt: request.ValidatedAt.UTC().Truncate(time.Second).Format(time.RFC3339),
		}}}
	if err := writeProtocolEnvelope(stdin, envelope); err != nil {
		_ = command.Process.Kill()
		_ = command.Wait()
		<-logDone
		return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "send ValidateImport", Cause: err}
	}
	_ = stdin.Close()
	response, readErr := readProtocolEnvelope(bufio.NewReader(stdout))
	waitErr := command.Wait()
	<-logDone
	if ctx.Err() != nil {
		return ImportValidationResult{}, ctx.Err()
	}
	if readErr != nil || response == nil || response.ProtocolVersion != workerProtocolVersion {
		return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "read ImportValidationResult", Cause: readErr}
	}
	resultMessage, ok := response.Message.(*intelv1.WorkerEnvelope_ImportValidationResult)
	if !ok || resultMessage.ImportValidationResult == nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "worker returned an unexpected validation envelope", Cause: waitErr}
	}
	if waitErr != nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_failed", Message: "Python validation worker exited unsuccessfully", Cause: waitErr}
	}
	return importValidationFromProto(request.RequestID, resultMessage.ImportValidationResult)
}

func (runner *WorkerRunner) command() (string, []string) {
	if runner.PythonCommand != "" {
		return runner.PythonCommand, []string{"-I", "-B", "-m", "golem_intel_worker", "protocol"}
	}
	command := runner.UVCommand
	if command == "" {
		command = "uv"
	}
	return command, []string{
		"run", "--frozen", "--offline", "--no-dev", "--no-config", "--no-sync",
		"--project", runner.ProjectDir, "python", "-I", "-B", "-m", "golem_intel_worker", "protocol",
	}
}

func isExecutableRegularFile(path string) bool {
	if !filepath.IsAbs(path) {
		return false
	}
	info, err := os.Lstat(path)
	return err == nil && info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 && info.Mode().Perm()&0o111 != 0
}

func writeProtocolEnvelope(writer io.Writer, envelope *intelv1.WorkerEnvelope) error {
	payload, err := proto.Marshal(envelope)
	if err != nil {
		return err
	}
	if len(payload) == 0 || len(payload) > maximumProtocolMessage {
		return fmt.Errorf("protobuf envelope has invalid size %d", len(payload))
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(payload)))
	if _, err := writer.Write(header[:]); err != nil {
		return err
	}
	_, err = writer.Write(payload)
	return err
}

func readProtocolEnvelope(reader io.Reader) (*intelv1.WorkerEnvelope, error) {
	var header [4]byte
	if _, err := io.ReadFull(reader, header[:]); err != nil {
		return nil, err
	}
	size := binary.BigEndian.Uint32(header[:])
	if size == 0 || size > maximumProtocolMessage {
		return nil, fmt.Errorf("protobuf envelope has invalid size %d", size)
	}
	payload := make([]byte, size)
	if _, err := io.ReadFull(reader, payload); err != nil {
		return nil, err
	}
	var envelope intelv1.WorkerEnvelope
	if err := proto.Unmarshal(payload, &envelope); err != nil {
		return nil, err
	}
	return &envelope, nil
}

func connectorResultFromProto(runID string, result *intelv1.AnalysisResult) (domain.ConnectorResult, error) {
	if result.RunId != runID {
		return domain.ConnectorResult{}, fmt.Errorf("AnalysisResult run id mismatch")
	}
	descriptors := make([]domain.ArtifactDescriptor, 0, len(result.Artifacts))
	for _, item := range result.Artifacts {
		if item == nil || item.SizeBytes > math.MaxInt64 || item.RowCount > math.MaxInt64 {
			return domain.ConnectorResult{}, fmt.Errorf("AnalysisResult contains an invalid artifact descriptor")
		}
		var minimum, maximum *string
		if item.MinimumObservedAt != "" {
			value := item.MinimumObservedAt
			minimum = &value
		}
		if item.MaximumObservedAt != "" {
			value := item.MaximumObservedAt
			maximum = &value
		}
		descriptor := domain.ArtifactDescriptor{
			RelativePath: item.RelativePath, MediaType: item.MediaType, SHA256: item.Sha256,
			SizeBytes: int64(item.SizeBytes), RowCount: int64(item.RowCount), SchemaID: item.SchemaId,
			MinimumObservedAt: minimum, MaximumObservedAt: maximum, DataClass: item.DataClass,
		}
		descriptor.Kind = inferArtifactKind(descriptor, result.ReportRelativePath)
		descriptors = append(descriptors, descriptor)
	}
	return domain.ConnectorResult{
		RunID: result.RunId, Succeeded: result.Succeeded,
		ErrorCode: result.ErrorCode, ErrorMessage: result.ErrorMessage, Artifacts: descriptors,
		ReportRelativePath: result.ReportRelativePath, ReportSHA256: result.ReportSha256,
		ModelVersion: result.ModelVersion, WorkerVersion: result.WorkerVersion,
	}, nil
}

func startAnalysisEnvelope(request AnalysisRequest) (*intelv1.WorkerEnvelope, error) {
	var workflow intelv1.AnalysisWorkflow
	switch request.Workflow {
	case domain.WorkflowCompare:
		if request.ResearchQuestion != "" || request.SourceBudget != 0 {
			return nil, fmt.Errorf("comparison analysis cannot carry research controls")
		}
		workflow = intelv1.AnalysisWorkflow_ANALYSIS_WORKFLOW_COMPARE
	case domain.WorkflowResearch:
		if request.ResearchQuestion == "" || request.SourceBudget < 1 || request.SourceBudget > 100 {
			return nil, fmt.Errorf("research analysis requires a question and source budget from 1 to 100")
		}
		workflow = intelv1.AnalysisWorkflow_ANALYSIS_WORKFLOW_RESEARCH
	default:
		return nil, fmt.Errorf("analysis workflow is required")
	}
	start := &intelv1.StartAnalysis{
		RunId: request.RunID, ProjectId: request.ProjectID, WorkspacePath: request.WorkspacePath,
		InputPath: request.InputPath, InputSha256: request.InputSHA256, InputSchemaId: request.InputSchemaID,
		OutputDirectory: request.OutputDir, TargetIds: append([]string(nil), request.TargetIDs...),
		Options: cloneOptions(request.Options), Workflow: workflow,
		ResearchQuestion: request.ResearchQuestion, SourceBudget: request.SourceBudget,
	}
	if request.ImportContext != nil {
		context := request.ImportContext
		if context.DatasetID == "" || context.ValidatedAt.IsZero() || context.InputParserVersion == "" || context.MetricCatalogVersion == "" {
			return nil, fmt.Errorf("import analysis context is incomplete")
		}
		start.ImportContext = &intelv1.ImportContext{DatasetId: context.DatasetID,
			ValidatedAt:        context.ValidatedAt.UTC().Truncate(time.Second).Format(time.RFC3339),
			InputParserVersion: context.InputParserVersion, MetricCatalogVersion: context.MetricCatalogVersion}
	}
	return &intelv1.WorkerEnvelope{
		ProtocolVersion: workerProtocolVersion,
		Message:         &intelv1.WorkerEnvelope_StartAnalysis{StartAnalysis: start},
	}, nil
}

func importValidationFromProto(requestID string, result *intelv1.ImportValidationResult) (ImportValidationResult, error) {
	if result.RequestId != requestID || result.Input == nil {
		return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result does not match its request"}
	}
	converted := ImportValidationResult{RequestID: result.RequestId, Valid: result.Valid,
		Input:                domain.ImportInputSummary{SchemaID: result.Input.SchemaId, SHA256: result.Input.Sha256, SizeBytes: int64(result.Input.SizeBytes)},
		DiagnosticsTruncated: result.DiagnosticsTruncated, Targets: make([]domain.ImportTargetSummary, 0, len(result.Targets)),
		Diagnostics: make([]domain.ImportDiagnostic, 0, len(result.Diagnostics))}
	if result.Input.RowCount != nil {
		if *result.Input.RowCount > math.MaxInt64 {
			return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result row count is invalid"}
		}
		value := int64(*result.Input.RowCount)
		converted.Input.RowCount = &value
	}
	if result.FilePolicy != nil {
		policy := domain.ImportPolicySummary{TargetScope: valueOrEmpty(result.FilePolicy.TargetScope), DataClass: valueOrEmpty(result.FilePolicy.DataClass),
			PermittedPurpose: valueOrEmpty(result.FilePolicy.PermittedPurpose), RightsState: valueOrEmpty(result.FilePolicy.RightsState)}
		if result.FilePolicy.RetentionDays != nil {
			policy.RetentionDays = int(*result.FilePolicy.RetentionDays)
		}
		converted.Policy = &policy
	}
	if result.Platform != nil {
		value := *result.Platform
		converted.Platform = &value
	}
	for _, target := range result.Targets {
		if target == nil || target.RowCount > math.MaxInt64 {
			return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result contains an invalid target"}
		}
		availability := make(map[string]string, len(target.MetricAvailability))
		for metric, state := range target.MetricAvailability {
			switch state {
			case intelv1.ImportMetricAvailability_IMPORT_METRIC_AVAILABILITY_MISSING:
				availability[metric] = "missing"
			case intelv1.ImportMetricAvailability_IMPORT_METRIC_AVAILABILITY_INSUFFICIENT:
				availability[metric] = "insufficient"
			case intelv1.ImportMetricAvailability_IMPORT_METRIC_AVAILABILITY_CONTRADICTORY:
				availability[metric] = "contradictory"
			case intelv1.ImportMetricAvailability_IMPORT_METRIC_AVAILABILITY_AVAILABLE:
				availability[metric] = "available"
			default:
				return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result contains an unspecified metric state"}
			}
		}
		converted.Targets = append(converted.Targets, domain.ImportTargetSummary{TargetID: target.TargetId, TargetName: target.TargetName, RowCount: int64(target.RowCount), MetricAvailability: availability})
	}
	for _, item := range result.Diagnostics {
		if item == nil {
			return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result contains an empty diagnostic"}
		}
		severity := ""
		switch item.Severity {
		case intelv1.ImportDiagnosticSeverity_IMPORT_DIAGNOSTIC_SEVERITY_ERROR:
			severity = "error"
		case intelv1.ImportDiagnosticSeverity_IMPORT_DIAGNOSTIC_SEVERITY_WARNING:
			severity = "warning"
		default:
			return ImportValidationResult{}, &WorkerError{Code: "worker_protocol_error", Message: "validation result contains an unspecified diagnostic severity"}
		}
		converted.Diagnostics = append(converted.Diagnostics, domain.ImportDiagnostic{Severity: severity, Code: item.Code, RecordNumber: item.RecordNumber, Column: item.Column, Message: item.Message})
	}
	return converted, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func cloneOptions(options map[string]string) map[string]string {
	cloned := make(map[string]string, len(options))
	for key, value := range options {
		cloned[key] = value
	}
	return cloned
}

type boundedLog struct {
	maximum int
	buffer  []byte
}

func (log *boundedLog) Write(payload []byte) (int, error) {
	remaining := log.maximum - len(log.buffer)
	if remaining > 0 {
		if len(payload) < remaining {
			remaining = len(payload)
		}
		log.buffer = append(log.buffer, payload[:remaining]...)
	}
	return len(payload), nil
}

func (log *boundedLog) String() string { return string(log.buffer) }
