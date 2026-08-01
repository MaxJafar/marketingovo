package governance

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
)

// importComparisonReport is deliberately separate from the legacy v1 domain
// report. Imported CSV analysis has a different, narrower claim model. This
// parser is the Go authority boundary: unknown fields, unknown metric arms,
// unbound evidence, and malformed availability/value combinations fail closed.
type importComparisonReport struct {
	SchemaVersion  string                     `json:"schema_version"`
	RunID          string                     `json:"run_id"`
	Workflow       string                     `json:"workflow"`
	GeneratedAt    string                     `json:"generated_at"`
	Derivation     domain.Provenance          `json:"derivation"`
	Dataset        importDatasetProvenance    `json:"dataset"`
	Summary        string                     `json:"summary"`
	Targets        []importTargetResult       `json:"targets"`
	Comparisons    []importComparisonClaim    `json:"comparisons"`
	Evidence       map[string]json.RawMessage `json:"evidence"`
	Contradictions []importContradiction      `json:"contradictions"`
	Limitations    []string                   `json:"limitations"`
}

type importDatasetProvenance struct {
	DatasetID            string `json:"dataset_id"`
	InputSHA256          string `json:"input_sha256"`
	InputSchemaID        string `json:"input_schema_id"`
	InputSizeBytes       int64  `json:"input_size_bytes"`
	Platform             string `json:"platform"`
	ValidatedAt          string `json:"validated_at"`
	RetentionUntil       string `json:"retention_until"`
	InputParserVersion   string `json:"input_parser_version"`
	MetricCatalogVersion string `json:"metric_catalog_version"`
}

type importTargetResult struct {
	TargetID   string               `json:"target_id"`
	TargetName string               `json:"target_name"`
	Metrics    []importMetricResult `json:"metrics"`
}

type importMetricResult struct {
	ID                     string              `json:"id"`
	DefinitionVersion      string              `json:"definition_version"`
	Availability           string              `json:"availability"`
	Value                  json.RawMessage     `json:"value"`
	Unit                   string              `json:"unit"`
	Population             string              `json:"population"`
	Numerator              string              `json:"numerator"`
	Denominator            string              `json:"denominator"`
	Period                 *importMetricPeriod `json:"period"`
	Quality                importMetricQuality `json:"quality"`
	EvidenceObservationIDs []string            `json:"evidence_observation_ids"`
	Limitations            []string            `json:"limitations"`
}

type importMetricPeriod struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type importMetricQuality struct {
	CandidateCount      int64    `json:"candidate_count"`
	IncludedCount       int64    `json:"included_count"`
	ExcludedCount       int64    `json:"excluded_count"`
	MinInputConfidence  *float64 `json:"min_input_confidence"`
	MeanInputConfidence *float64 `json:"mean_input_confidence"`
	MeanInputCoverage   *float64 `json:"mean_input_coverage"`
}

type importComparisonClaim struct {
	MetricID               string   `json:"metric_id"`
	DefinitionVersion      string   `json:"definition_version"`
	Kind                   string   `json:"kind"`
	TargetID               string   `json:"target_id"`
	ComparedTargetIDs      []string `json:"compared_target_ids"`
	EvidenceObservationIDs []string `json:"evidence_observation_ids"`
}

type importContradiction struct {
	Code           string   `json:"code"`
	TargetID       string   `json:"target_id"`
	ObservedAt     string   `json:"observed_at"`
	ObservationIDs []string `json:"observation_ids"`
}

func readImportReportJSON(payload []byte, runID string, expectedRows int64) (domain.ComparisonReport, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var report importComparisonReport
	if err := decoder.Decode(&report); err != nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: imported report JSON does not match its schema: %v", ErrArtifactMismatch, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err == nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: imported report JSON contains trailing data", ErrArtifactMismatch)
	} else if !errors.Is(err, io.EOF) {
		return domain.ComparisonReport{}, fmt.Errorf("%w: imported report JSON contains trailing data", ErrArtifactMismatch)
	}
	if report.SchemaVersion != "agentintel.comparison-report.v2" || report.RunID != runID || report.Workflow != "compare" ||
		strings.TrimSpace(report.Summary) == "" || len(report.Targets) < 2 || len(report.Targets) > 5 || int64(len(report.Targets)) != expectedRows ||
		len(report.Limitations) == 0 || report.Evidence == nil || report.Contradictions == nil || report.Comparisons == nil {
		return domain.ComparisonReport{}, fmt.Errorf("%w: imported report is incomplete", ErrArtifactMismatch)
	}
	generatedAt, err := parseAuthorityTime(report.GeneratedAt)
	if err != nil {
		return domain.ComparisonReport{}, err
	}
	if report.Derivation.WorkerVersion == "" || report.Derivation.ModelVersion == "" || report.Derivation.ConnectorVersion == "" || report.Derivation.ParserVersion == "" {
		return domain.ComparisonReport{}, fmt.Errorf("%w: imported report derivation is incomplete", ErrArtifactMismatch)
	}
	if err := validateImportDatasetProvenance(report.Dataset); err != nil {
		return domain.ComparisonReport{}, err
	}
	if err := validateImportEvidence(report.Evidence); err != nil {
		return domain.ComparisonReport{}, err
	}
	targets := make(map[string]struct{}, len(report.Targets))
	projection := make([]domain.TargetFinding, 0, len(report.Targets))
	for _, target := range report.Targets {
		if target.TargetID == "" || strings.TrimSpace(target.TargetName) == "" {
			return domain.ComparisonReport{}, fmt.Errorf("%w: imported report target is incomplete", ErrArtifactMismatch)
		}
		if _, duplicate := targets[target.TargetID]; duplicate {
			return domain.ComparisonReport{}, fmt.Errorf("%w: imported report repeats a target", ErrArtifactMismatch)
		}
		targets[target.TargetID] = struct{}{}
		if err := validateImportTarget(target, report.Evidence); err != nil {
			return domain.ComparisonReport{}, err
		}
		projection = append(projection, domain.TargetFinding{EntityID: target.TargetID, EntityName: target.TargetName})
	}
	for _, claim := range report.Comparisons {
		if err := validateImportClaim(claim, targets, report.Evidence); err != nil {
			return domain.ComparisonReport{}, err
		}
	}
	for _, contradiction := range report.Contradictions {
		if contradiction.Code != "observation_value_conflict" || !hasTarget(targets, contradiction.TargetID) || len(contradiction.ObservationIDs) < 2 {
			return domain.ComparisonReport{}, fmt.Errorf("%w: imported report contradiction is invalid", ErrArtifactMismatch)
		}
		if _, err := parseAuthorityTime(contradiction.ObservedAt); err != nil || !allEvidenceExists(contradiction.ObservationIDs, report.Evidence) {
			return domain.ComparisonReport{}, fmt.Errorf("%w: imported report contradiction is unbound", ErrArtifactMismatch)
		}
	}
	return domain.ComparisonReport{SchemaVersion: report.SchemaVersion, RunID: report.RunID, GeneratedAt: generatedAt,
		Workflow: domain.WorkflowCompare, Derivation: report.Derivation, Title: "Imported competitive pulse comparison",
		Summary: report.Summary, Targets: projection, Contradictions: []string{}, Limitations: report.Limitations}, nil
}

func validateImportDatasetProvenance(dataset importDatasetProvenance) error {
	if dataset.DatasetID == "" || len(dataset.InputSHA256) != 64 || dataset.InputSchemaID != domain.CompetitivePulseImportSchema ||
		dataset.InputSizeBytes <= 0 || dataset.Platform == "" || dataset.InputParserVersion != domain.CompetitivePulseParserVersion ||
		dataset.MetricCatalogVersion != domain.CompetitivePulseMetricCatalog {
		return fmt.Errorf("%w: imported report dataset provenance is invalid", ErrArtifactMismatch)
	}
	for _, value := range []byte(dataset.InputSHA256) {
		if !((value >= '0' && value <= '9') || (value >= 'a' && value <= 'f')) {
			return fmt.Errorf("%w: imported report input digest is invalid", ErrArtifactMismatch)
		}
	}
	validated, err := parseAuthorityTime(dataset.ValidatedAt)
	if err != nil {
		return err
	}
	retention, err := parseAuthorityTime(dataset.RetentionUntil)
	if err != nil || !retention.After(validated) {
		return fmt.Errorf("%w: imported report retention is invalid", ErrArtifactMismatch)
	}
	return nil
}

func validateImportEvidence(evidence map[string]json.RawMessage) error {
	for id, value := range evidence {
		if id == "" || len(value) == 0 || !json.Valid(value) {
			return fmt.Errorf("%w: imported report evidence is invalid", ErrArtifactMismatch)
		}
		var item struct {
			ObservationID string `json:"observation_id"`
		}
		if err := json.Unmarshal(value, &item); err != nil || item.ObservationID != id {
			return fmt.Errorf("%w: imported report evidence is not identity-bound", ErrArtifactMismatch)
		}
	}
	return nil
}

func validateImportTarget(target importTargetResult, evidence map[string]json.RawMessage) error {
	if len(target.Metrics) != 4 {
		return fmt.Errorf("%w: imported report metric count is invalid", ErrArtifactMismatch)
	}
	expected := map[string]string{"followers.delta": "followers", "public-engagement-by-followers.median": "ratio", "posting-cadence": "posts_per_week", "content-format-mix": "distribution"}
	for _, metric := range target.Metrics {
		unit, known := expected[metric.ID]
		if !known || metric.DefinitionVersion != "v1" || metric.Unit != unit || metric.Population == "" || metric.Numerator == "" || metric.Denominator == "" ||
			!validMetricAvailability(metric.Availability) || metric.Limitations == nil || metric.EvidenceObservationIDs == nil ||
			metric.Quality.CandidateCount < 0 || metric.Quality.IncludedCount < 0 || metric.Quality.ExcludedCount < 0 || metric.Quality.IncludedCount > metric.Quality.CandidateCount || metric.Quality.ExcludedCount > metric.Quality.CandidateCount {
			return fmt.Errorf("%w: imported report metric is invalid", ErrArtifactMismatch)
		}
		delete(expected, metric.ID)
		if metric.Period != nil {
			start, err := parseAuthorityTime(metric.Period.Start)
			end, endErr := parseAuthorityTime(metric.Period.End)
			if err != nil || endErr != nil || end.Before(start) {
				return fmt.Errorf("%w: imported report metric period is invalid", ErrArtifactMismatch)
			}
		}
		for _, value := range []*float64{metric.Quality.MinInputConfidence, metric.Quality.MeanInputConfidence, metric.Quality.MeanInputCoverage} {
			if value != nil && (!finiteUnit(*value)) {
				return fmt.Errorf("%w: imported report quality is invalid", ErrArtifactMismatch)
			}
		}
		if !allEvidenceExists(metric.EvidenceObservationIDs, evidence) || !validImportMetricValue(metric) {
			return fmt.Errorf("%w: imported report metric value or evidence is invalid", ErrArtifactMismatch)
		}
	}
	if len(expected) != 0 {
		return fmt.Errorf("%w: imported report metric identities are incomplete", ErrArtifactMismatch)
	}
	return nil
}

func validMetricAvailability(value string) bool {
	return value == "available" || value == "missing" || value == "insufficient" || value == "contradictory"
}

func validImportMetricValue(metric importMetricResult) bool {
	if metric.Availability != "available" {
		return bytes.Equal(bytes.TrimSpace(metric.Value), []byte("null"))
	}
	if metric.ID == "content-format-mix" {
		var values map[string]float64
		if json.Unmarshal(metric.Value, &values) != nil || len(values) == 0 {
			return false
		}
		for _, value := range values {
			if !finiteUnit(value) {
				return false
			}
		}
		return true
	}
	var value float64
	return json.Unmarshal(metric.Value, &value) == nil && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func validateImportClaim(claim importComparisonClaim, targets map[string]struct{}, evidence map[string]json.RawMessage) error {
	if (claim.MetricID != "followers.delta" && claim.MetricID != "public-engagement-by-followers.median" && claim.MetricID != "posting-cadence") ||
		claim.DefinitionVersion != "v1" || claim.Kind != "leader" || !hasTarget(targets, claim.TargetID) || len(claim.ComparedTargetIDs) < 2 || !allEvidenceExists(claim.EvidenceObservationIDs, evidence) {
		return fmt.Errorf("%w: imported report comparison claim is invalid", ErrArtifactMismatch)
	}
	seen := map[string]struct{}{}
	for _, id := range claim.ComparedTargetIDs {
		if !hasTarget(targets, id) {
			return fmt.Errorf("%w: imported report claim target is invalid", ErrArtifactMismatch)
		}
		if _, duplicate := seen[id]; duplicate {
			return fmt.Errorf("%w: imported report claim repeats a target", ErrArtifactMismatch)
		}
		seen[id] = struct{}{}
	}
	return nil
}

func hasTarget(targets map[string]struct{}, id string) bool { _, ok := targets[id]; return ok }
func allEvidenceExists(ids []string, evidence map[string]json.RawMessage) bool {
	for _, id := range ids {
		if id == "" {
			return false
		}
		if _, ok := evidence[id]; !ok {
			return false
		}
	}
	return true
}

func parseAuthorityTime(value string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil || !strings.HasSuffix(value, "Z") || parsed.Location() != time.UTC {
		return time.Time{}, fmt.Errorf("%w: imported report timestamp is invalid", ErrArtifactMismatch)
	}
	return parsed, nil
}
