package domain

import (
	"encoding/json"
	"time"
)

const Version = "0.2.0-alpha.0"

type RunStatus string

const (
	RunQueued    RunStatus = "queued"
	RunRunning   RunStatus = "running"
	RunSucceeded RunStatus = "succeeded"
	RunPartial   RunStatus = "partial"
	RunFailed    RunStatus = "failed"
	RunCancelled RunStatus = "cancelled"
)

func (s RunStatus) Terminal() bool {
	switch s {
	case RunSucceeded, RunPartial, RunFailed, RunCancelled:
		return true
	default:
		return false
	}
}

type Workflow string

const (
	WorkflowCompare  Workflow = "compare"
	WorkflowResearch Workflow = "research"
)

type Run struct {
	ID                string          `json:"id"`
	ProjectID         string          `json:"project_id"`
	Workflow          Workflow        `json:"workflow"`
	Status            RunStatus       `json:"status"`
	Progress          float64         `json:"progress"`
	Stage             string          `json:"stage,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	StartedAt         *time.Time      `json:"started_at"`
	CompletedAt       *time.Time      `json:"completed_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	ReplayOf          *string         `json:"replay_of"`
	ErrorCode         *string         `json:"error_code"`
	ErrorMessage      *string         `json:"error_message"`
	ReportAvailable   bool            `json:"report_available"`
	WorkerVersion     string          `json:"worker_version,omitempty"`
	ModelVersion      string          `json:"model_version,omitempty"`
	ConnectorVersion  string          `json:"connector_version,omitempty"`
	ParserVersion     string          `json:"parser_version,omitempty"`
	InputSHA256       string          `json:"input_sha256,omitempty"`
	InputSchemaID     string          `json:"input_schema_id,omitempty"`
	InputSizeBytes    int64           `json:"input_size_bytes,omitempty"`
	DatasetID         string          `json:"dataset_id,omitempty"`
	RequestJSON       json.RawMessage `json:"-"`
	InputRelativePath string          `json:"-"`
	CancelRequested   bool            `json:"-"`
	CancelReason      string          `json:"-"`
}

type Provenance struct {
	WorkerVersion    string `json:"worker_version"`
	ModelVersion     string `json:"model_version"`
	ConnectorVersion string `json:"connector_version"`
	ParserVersion    string `json:"parser_version"`
}

type InputSnapshot struct {
	RelativePath string
	SHA256       string
	SchemaID     string
	SizeBytes    int64
	DatasetID    string
}

type RunEvent struct {
	ID         string    `json:"id"`
	RunID      string    `json:"run_id"`
	Sequence   int64     `json:"sequence"`
	Stage      string    `json:"stage"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	Progress   float64   `json:"progress"`
	RecordedAt time.Time `json:"recorded_at"`
}

type Artifact struct {
	ID           string    `json:"id"`
	RunID        string    `json:"run_id"`
	Kind         string    `json:"kind"`
	RelativePath string    `json:"relative_path"`
	MediaType    string    `json:"media_type"`
	SHA256       string    `json:"sha256"`
	SizeBytes    int64     `json:"size_bytes"`
	RowCount     int64     `json:"row_count,omitempty"`
	SchemaID     string    `json:"schema_id"`
	DataClass    string    `json:"data_class"`
	CreatedAt    time.Time `json:"-"`
}

// ArtifactDescriptor is the language-neutral worker result contract. Paths are
// relative to a worker-owned staging directory and are untrusted until the
// governance package validates and commits them.
type ArtifactDescriptor struct {
	RelativePath      string  `json:"relative_path"`
	Kind              string  `json:"kind"`
	MediaType         string  `json:"media_type"`
	SHA256            string  `json:"sha256"`
	SizeBytes         int64   `json:"size_bytes"`
	RowCount          int64   `json:"row_count,omitempty"`
	SchemaID          string  `json:"schema_id"`
	MinimumObservedAt *string `json:"minimum_observed_at,omitempty"`
	MaximumObservedAt *string `json:"maximum_observed_at,omitempty"`
	DataClass         string  `json:"data_class"`
}

type ConnectorResult struct {
	ManifestVersion    int                  `json:"manifest_version,omitempty"`
	RunID              string               `json:"run_id,omitempty"`
	Succeeded          bool                 `json:"succeeded"`
	ErrorCode          string               `json:"error_code,omitempty"`
	ErrorMessage       string               `json:"error_message,omitempty"`
	Artifacts          []ArtifactDescriptor `json:"artifacts"`
	ReportRelativePath string               `json:"report_relative_path"`
	ReportSHA256       string               `json:"report_sha256"`
	ModelVersion       string               `json:"model_version"`
	WorkerVersion      string               `json:"worker_version"`
	Entities           []Entity             `json:"entities,omitempty"`
	SearchDocuments    []SearchDocument     `json:"search_documents,omitempty"`
}

type SearchDocument struct {
	Kind       string
	ID         string
	Label      string
	Excerpt    string
	Confidence float64
	RunID      *string
}

type RunDetail struct {
	Run
	Events    []RunEvent `json:"events"`
	Artifacts []Artifact `json:"artifacts"`
}

type Identifier struct {
	Scheme string `json:"scheme"`
	Value  string `json:"value"`
	Source string `json:"source"`
}

type Entity struct {
	ID              string       `json:"id"`
	Type            string       `json:"type"`
	DisplayName     string       `json:"display_name"`
	ResolutionState string       `json:"resolution_state"`
	Identifiers     []Identifier `json:"identifiers"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

type Citation struct {
	ObservationID    string    `json:"observation_id"`
	EntityID         string    `json:"entity_id"`
	SourceURL        string    `json:"source_url"`
	NativeID         string    `json:"native_id,omitempty"`
	ObservedAt       time.Time `json:"observed_at"`
	ConnectorVersion string    `json:"connector_version"`
	Confidence       float64   `json:"confidence"`
}

type MetricDefinition struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Label       string `json:"label"`
	Numerator   string `json:"numerator"`
	Denominator string `json:"denominator"`
	Period      string `json:"period"`
}

type TargetFinding struct {
	EntityID              string             `json:"entity_id"`
	EntityName            string             `json:"entity_name"`
	FollowerDelta         float64            `json:"follower_delta"`
	MedianEngagementRate  float64            `json:"median_engagement_rate"`
	PostingCadencePerWeek float64            `json:"posting_cadence_per_week"`
	ContentFormatMix      map[string]float64 `json:"content_format_mix"`
	Confidence            float64            `json:"confidence"`
	Warnings              []string           `json:"warnings,omitempty"`
	Citations             []Citation         `json:"citations"`
}

type ComparisonReport struct {
	SchemaVersion     string             `json:"schema_version"`
	RunID             string             `json:"run_id"`
	GeneratedAt       time.Time          `json:"generated_at"`
	Workflow          Workflow           `json:"workflow"`
	ResearchQuestion  string             `json:"research_question,omitempty"`
	SourceBudget      int                `json:"source_budget,omitempty"`
	ResearchPlan      []string           `json:"research_plan"`
	Derivation        Provenance         `json:"derivation"`
	Title             string             `json:"title"`
	Summary           string             `json:"summary"`
	Targets           []TargetFinding    `json:"targets"`
	MetricDefinitions []MetricDefinition `json:"metric_definitions"`
	Contradictions    []string           `json:"contradictions"`
	Limitations       []string           `json:"limitations"`
}

type SearchResult struct {
	Kind       string  `json:"kind"`
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Excerpt    string  `json:"excerpt"`
	Confidence float64 `json:"confidence"`
	RunID      *string `json:"run_id"`
}

type ConnectorStatus struct {
	ID              string `json:"id"`
	Status          string `json:"status"`
	AcquisitionMode string `json:"acquisition_mode"`
	CostState       string `json:"cost_state"`
}

type MonitoringStatus struct {
	Daemon      string            `json:"daemon"`
	Worker      string            `json:"worker"`
	QueuedRuns  int               `json:"queued_runs"`
	RunningRuns int               `json:"running_runs"`
	Connectors  []ConnectorStatus `json:"connectors"`
}

type ComparisonStartRequest struct {
	ProjectID    string   `json:"project_id"`
	TargetIDs    []string `json:"target_ids"`
	DatasetID    string   `json:"dataset_id,omitempty"`
	ConnectorIDs []string `json:"connector_ids,omitempty"`
	Goal         string   `json:"goal,omitempty"`
	Simulate     string   `json:"simulate,omitempty"`
}

type ResearchStartRequest struct {
	ProjectID    string   `json:"project_id"`
	Question     string   `json:"question"`
	TargetIDs    []string `json:"target_ids"`
	SourceBudget int      `json:"source_budget,omitempty"`
}

type JobRequest struct {
	Comparison *ComparisonStartRequest `json:"comparison,omitempty"`
	Research   *ResearchStartRequest   `json:"research,omitempty"`
}

type Observation struct {
	ObservationID           string     `json:"observation_id"`
	EntityID                string     `json:"entity_id"`
	EntityName              string     `json:"entity_name"`
	Platform                string     `json:"platform"`
	ContentID               *string    `json:"content_id"`
	Dimension               *string    `json:"dimension"`
	Metric                  string     `json:"metric"`
	MetricDefinitionVersion string     `json:"metric_definition_version"`
	Numerator               *float64   `json:"numerator"`
	Denominator             *float64   `json:"denominator"`
	Value                   float64    `json:"value"`
	Unit                    string     `json:"unit"`
	PublishedAt             *time.Time `json:"published_at"`
	ObservedAt              time.Time  `json:"observed_at"`
	RecordedAt              time.Time  `json:"recorded_at"`
	ValidFrom               time.Time  `json:"valid_from"`
	ValidTo                 *time.Time `json:"valid_to"`
	SourceURL               string     `json:"source_url"`
	NativeID                string     `json:"native_id"`
	ConnectorVersion        string     `json:"connector_version"`
	Classification          string     `json:"classification"`
	Confidence              float64    `json:"confidence"`
	ArtifactHash            string     `json:"artifact_hash"`
	ExtractionPointer       string     `json:"extraction_pointer"`
	FreshnessSeconds        int64      `json:"freshness_seconds"`
	Availability            string     `json:"availability"`
	Coverage                float64    `json:"coverage"`
	AcquisitionMode         string     `json:"acquisition_mode"`
	DataClass               string     `json:"data_class"`
	PermittedPurpose        string     `json:"permitted_purpose"`
	RetentionUntil          time.Time  `json:"retention_until"`
	RightsState             string     `json:"rights_state"`
}
