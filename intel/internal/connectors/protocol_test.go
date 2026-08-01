package connectors

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	intelv1 "github.com/MaxJafar/AGENTintel/gen/go/agentintel/v1"
	"github.com/MaxJafar/AGENTintel/internal/domain"
)

func TestProtocolEnvelopeUsesBigEndianLengthPrefix(t *testing.T) {
	want := &intelv1.WorkerEnvelope{
		ProtocolVersion: 1,
		Message:         &intelv1.WorkerEnvelope_CancelAnalysis{CancelAnalysis: &intelv1.CancelAnalysis{RunId: "run-1", Reason: "test"}},
	}
	var stream bytes.Buffer
	if err := writeProtocolEnvelope(&stream, want); err != nil {
		t.Fatal(err)
	}
	if size := binary.BigEndian.Uint32(stream.Bytes()[:4]); int(size) != stream.Len()-4 {
		t.Fatalf("prefix size = %d, payload = %d", size, stream.Len()-4)
	}
	got, err := readProtocolEnvelope(&stream)
	if err != nil {
		t.Fatal(err)
	}
	if got.ProtocolVersion != 1 || got.GetCancelAnalysis().GetRunId() != "run-1" {
		t.Fatalf("unexpected round trip: %v", got)
	}
}

func TestWorkerCommandsAndEnvironmentAreSealed(t *testing.T) {
	root := t.TempDir()
	workspace := filepath.Join(root, "job")
	project := filepath.Join(root, "worker")
	if err := os.MkdirAll(filepath.Join(project, ".venv"), 0o700); err != nil {
		t.Fatal(err)
	}
	python := filepath.Join(root, "python")
	if err := os.WriteFile(python, []byte("#! /bin/sh\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	runner := WorkerRunner{PythonCommand: python, ProjectDir: project}
	command, args := runner.command()
	if command != python || strings.Join(args, " ") != "-I -B -m agentintel_worker protocol" {
		t.Fatalf("direct command = %q %q", command, args)
	}
	runner = WorkerRunner{UVCommand: python, ProjectDir: project}
	_, args = runner.command()
	joined := strings.Join(args, " ")
	for _, required := range []string{"--frozen", "--offline", "--no-dev", "--no-config", "--no-sync", "python -I -B"} {
		if !strings.Contains(joined, required) {
			t.Fatalf("developer uv command lacks %q: %s", required, joined)
		}
	}
	environment := minimalWorkerEnvironment(workspace, project)
	joined = strings.Join(environment, "\n")
	for _, forbidden := range []string{"HOME=", "USER=", "LOGNAME=", "PATH=", "PYTHONPATH=", "HTTP_PROXY=", "HTTPS_PROXY=", "ALL_PROXY=", "NO_PROXY="} {
		if strings.Contains(joined, forbidden) {
			t.Fatalf("worker environment inherited %q: %s", forbidden, joined)
		}
	}
	for _, required := range []string{"TMPDIR=" + filepath.Join(workspace, "tmp"), "UV_CACHE_DIR=" + filepath.Join(workspace, "tmp", "uv-cache"), "UV_OFFLINE=1", "UV_NO_SYNC=1"} {
		if !strings.Contains(joined, required) {
			t.Fatalf("worker environment lacks %q: %s", required, joined)
		}
	}
}

func TestStartAnalysisRequiresCoherentTypedWorkflow(t *testing.T) {
	base := AnalysisRequest{RunID: "run-1", ProjectID: "demo", WorkspacePath: "/job", InputPath: "/job/input", InputSHA256: strings.Repeat("a", 64), InputSchemaID: "agentintel.fixture-observations.v1", OutputDir: "/job/output"}
	compare := base
	compare.Workflow = domain.WorkflowCompare
	envelope, err := startAnalysisEnvelope(compare)
	if err != nil || envelope.GetStartAnalysis().GetWorkflow() != intelv1.AnalysisWorkflow_ANALYSIS_WORKFLOW_COMPARE {
		t.Fatalf("compare envelope = %v, %v", envelope, err)
	}
	research := base
	research.Workflow = domain.WorkflowResearch
	research.ResearchQuestion = "Who is growing?"
	research.SourceBudget = 20
	envelope, err = startAnalysisEnvelope(research)
	if err != nil || envelope.GetStartAnalysis().GetResearchQuestion() != research.ResearchQuestion || envelope.GetStartAnalysis().GetSourceBudget() != 20 {
		t.Fatalf("research envelope = %v, %v", envelope, err)
	}
	research.SourceBudget = 0
	if _, err := startAnalysisEnvelope(research); err == nil {
		t.Fatal("research without a source budget was accepted")
	}
	compare.ResearchQuestion = "smuggled"
	if _, err := startAnalysisEnvelope(compare); err == nil {
		t.Fatal("comparison with research controls was accepted")
	}
	imported := base
	imported.InputSchemaID = domain.CompetitivePulseImportSchema
	imported.Workflow = domain.WorkflowCompare
	imported.ImportContext = &ImportContext{DatasetID: "dataset-1", ValidatedAt: time.Date(2026, 7, 17, 5, 0, 0, 0, time.UTC),
		InputParserVersion: domain.CompetitivePulseParserVersion, MetricCatalogVersion: domain.CompetitivePulseMetricCatalog}
	envelope, err = startAnalysisEnvelope(imported)
	if err != nil || envelope.GetStartAnalysis().GetImportContext().GetDatasetId() != "dataset-1" || envelope.GetStartAnalysis().GetImportContext().GetValidatedAt() != "2026-07-17T05:00:00Z" {
		t.Fatalf("import envelope = %v, %v", envelope, err)
	}
}

func TestProtocolEnvelopeRejectsOversizedFrameBeforeAllocation(t *testing.T) {
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], maximumProtocolMessage+1)
	if _, err := readProtocolEnvelope(bytes.NewReader(header[:])); err == nil || !strings.Contains(err.Error(), "invalid size") {
		t.Fatalf("oversized frame returned %v", err)
	}
}
