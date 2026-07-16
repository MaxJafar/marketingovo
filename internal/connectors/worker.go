package connectors

import (
	"context"
	"errors"

	"github.com/GolemWorkers/golem-intel/internal/domain"
)

type AnalysisRequest struct {
	RunID            string
	ProjectID        string
	WorkspacePath    string
	InputPath        string
	InputSHA256      string
	InputSchemaID    string
	OutputDir        string
	TargetIDs        []string
	Workflow         domain.Workflow
	ResearchQuestion string
	SourceBudget     uint32
	Options          map[string]string
}

type ProgressEvent struct {
	Stage    string  `json:"stage"`
	Level    string  `json:"level"`
	Message  string  `json:"message"`
	Progress float64 `json:"progress"`
}

type ProgressSink func(ProgressEvent)

type Worker interface {
	ID() string
	Available() bool
	Analyze(context.Context, AnalysisRequest, ProgressSink) (domain.ConnectorResult, error)
}

type WorkerError struct {
	Code    string
	Message string
	Cause   error
}

func (e *WorkerError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	if e.Cause != nil {
		return e.Cause.Error()
	}
	return e.Code
}

func (e *WorkerError) Unwrap() error { return e.Cause }

func ErrorCode(err error) string {
	var workerError *WorkerError
	if errors.As(err, &workerError) && workerError.Code != "" {
		return workerError.Code
	}
	return "worker_failed"
}
