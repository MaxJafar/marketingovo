package domain

import "time"

const (
	CompetitivePulseImportSchema  = "golem.competitive-pulse-import.v1"
	CompetitivePulseParserVersion = "golem-python-competitive-pulse-csv@1.0.0"
	CompetitivePulseMetricCatalog = "competitive-pulse.v1"
)

type DatasetState string

const (
	DatasetReady    DatasetState = "ready"
	DatasetDeleting DatasetState = "deleting"
	DatasetDeleted  DatasetState = "deleted"
)

type ImportInputSummary struct {
	SchemaID  string `json:"schema_id"`
	SHA256    string `json:"sha256"`
	SizeBytes int64  `json:"size_bytes"`
	RowCount  *int64 `json:"row_count"`
}

type ImportPolicySummary struct {
	AttestationVersion string `json:"attestation_version"`
	TargetScope        string `json:"target_scope"`
	DataClass          string `json:"data_class"`
	PermittedPurpose   string `json:"permitted_purpose"`
	RetentionDays      int    `json:"retention_days"`
	RightsState        string `json:"rights_state"`
}

type ImportTargetSummary struct {
	TargetID           string            `json:"target_id"`
	TargetName         string            `json:"target_name"`
	RowCount           int64             `json:"row_count"`
	MetricAvailability map[string]string `json:"metric_availability"`
}

type ImportDiagnostic struct {
	Severity     string  `json:"severity"`
	Code         string  `json:"code"`
	RecordNumber *uint32 `json:"record_number"`
	Column       *string `json:"column"`
	Message      string  `json:"message"`
}

// ImportPreview is the content-free, durable projection returned for both a
// completed preview and a subsequent dataset read. It never contains the
// client file name, a local path, or CSV cells.
type ImportPreview struct {
	SchemaVersion        string                `json:"schema_version"`
	Valid                bool                  `json:"valid"`
	DatasetID            string                `json:"dataset_id,omitempty"`
	State                DatasetState          `json:"state,omitempty"`
	ValidatedAt          *time.Time            `json:"validated_at,omitempty"`
	RetentionUntil       *time.Time            `json:"retention_until,omitempty"`
	Input                ImportInputSummary    `json:"input"`
	Policy               *ImportPolicySummary  `json:"policy,omitempty"`
	Platform             *string               `json:"platform,omitempty"`
	Targets              []ImportTargetSummary `json:"targets"`
	Diagnostics          []ImportDiagnostic    `json:"diagnostics"`
	DiagnosticsTruncated bool                  `json:"diagnostics_truncated"`
}

type Dataset struct {
	Preview              ImportPreview
	Snapshot             InputSnapshot
	CreatedAt            time.Time
	DeletionReason       string
	InputParserVersion   string
	MetricCatalogVersion string
}
