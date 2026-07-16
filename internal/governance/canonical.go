package governance

import (
	"context"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/domain"
	"github.com/GolemWorkers/golem-intel/internal/policy"
	"github.com/apache/arrow-go/v18/arrow"
	arrowarray "github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	parquetfile "github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/pqarrow"
)

const CanonicalParserVersion = "golem-go-arrow-parquet.v1"

var canonicalObservationFields = []arrow.Field{
	{Name: "observation_id", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "entity_id", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "entity_name", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "platform", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "content_id", Type: arrow.BinaryTypes.String, Nullable: true},
	{Name: "dimension", Type: arrow.BinaryTypes.String, Nullable: true},
	{Name: "metric", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "metric_definition_version", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "numerator", Type: arrow.PrimitiveTypes.Float64, Nullable: true},
	{Name: "denominator", Type: arrow.PrimitiveTypes.Float64, Nullable: true},
	{Name: "value", Type: arrow.PrimitiveTypes.Float64, Nullable: false},
	{Name: "unit", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "published_at", Type: canonicalTimestampType(), Nullable: true},
	{Name: "observed_at", Type: canonicalTimestampType(), Nullable: false},
	{Name: "recorded_at", Type: canonicalTimestampType(), Nullable: false},
	{Name: "valid_from", Type: canonicalTimestampType(), Nullable: false},
	{Name: "valid_to", Type: canonicalTimestampType(), Nullable: true},
	{Name: "source_url", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "native_id", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "connector_version", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "classification", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "confidence", Type: arrow.PrimitiveTypes.Float64, Nullable: false},
	{Name: "artifact_hash", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "extraction_pointer", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "freshness_seconds", Type: arrow.PrimitiveTypes.Int64, Nullable: false},
	{Name: "availability", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "coverage", Type: arrow.PrimitiveTypes.Float64, Nullable: false},
	{Name: "acquisition_mode", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "data_class", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "permitted_purpose", Type: arrow.BinaryTypes.String, Nullable: false},
	{Name: "retention_until", Type: canonicalTimestampType(), Nullable: false},
	{Name: "rights_state", Type: arrow.BinaryTypes.String, Nullable: false},
}

func canonicalTimestampType() arrow.DataType {
	return &arrow.TimestampType{Unit: arrow.Microsecond, TimeZone: "UTC"}
}

func parseArrowEvidence(path string, authorityTime time.Time) ([]domain.Observation, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	reader, err := ipc.NewFileReader(file, ipc.WithAllocator(memory.NewGoAllocator()))
	if err != nil {
		return nil, artifactDecodeError("Arrow IPC", err)
	}
	defer reader.Close()
	if err := validateCanonicalSchema(reader.Schema(), true); err != nil {
		return nil, err
	}
	rows := make([]domain.Observation, 0)
	for index := 0; index < reader.NumRecords(); index++ {
		record, err := reader.RecordBatchAt(index)
		if err != nil {
			return nil, artifactDecodeError("Arrow IPC record batch", err)
		}
		if int64(len(rows))+record.NumRows() > maximumArtifactRows {
			record.Release()
			return nil, fmt.Errorf("%w: Arrow IPC row count exceeds the bounded limit", ErrArtifactMismatch)
		}
		rows, err = appendCanonicalRecord(rows, record, authorityTime)
		record.Release()
		if err != nil {
			return nil, err
		}
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: Arrow IPC contains no observations", ErrArtifactMismatch)
	}
	return rows, nil
}

func parseParquetEvidence(path string, authorityTime time.Time) ([]domain.Observation, error) {
	reader, err := parquetfile.OpenParquetFile(path, false)
	if err != nil {
		return nil, artifactDecodeError("Parquet", err)
	}
	defer reader.Close()
	declaredRows := reader.MetaData().GetNumRows()
	if declaredRows <= 0 || declaredRows > maximumArtifactRows {
		return nil, fmt.Errorf("%w: Parquet metadata row count is outside the bounded limit", ErrArtifactMismatch)
	}
	arrowReader, err := pqarrow.NewFileReader(reader, pqarrow.ArrowReadProperties{BatchSize: 4096, Parallel: false}, memory.NewGoAllocator())
	if err != nil {
		return nil, artifactDecodeError("Parquet Arrow schema", err)
	}
	schema, err := arrowReader.Schema()
	if err != nil {
		return nil, artifactDecodeError("Parquet Arrow schema", err)
	}
	if err := validateCanonicalSchema(schema, false); err != nil {
		return nil, err
	}
	records, err := arrowReader.GetRecordReader(context.Background(), nil, nil)
	if err != nil {
		return nil, artifactDecodeError("Parquet record reader", err)
	}
	defer records.Release()
	rows := make([]domain.Observation, 0, int(declaredRows))
	for records.Next() {
		record := records.RecordBatch()
		if int64(len(rows))+record.NumRows() > maximumArtifactRows {
			return nil, fmt.Errorf("%w: Parquet row count exceeds the bounded limit", ErrArtifactMismatch)
		}
		rows, err = appendCanonicalRecord(rows, record, authorityTime)
		if err != nil {
			return nil, err
		}
	}
	if err := records.Err(); err != nil {
		return nil, artifactDecodeError("Parquet records", err)
	}
	if int64(len(rows)) != declaredRows {
		return nil, fmt.Errorf("%w: Parquet decoded row count disagrees with file metadata", ErrArtifactMismatch)
	}
	return rows, nil
}

func artifactDecodeError(label string, err error) error {
	return fmt.Errorf("%w: %s cannot be decoded: %v", ErrArtifactMismatch, label, err)
}

func validateCanonicalSchema(schema *arrow.Schema, requireSchemaID bool) error {
	if schema == nil || schema.NumFields() != len(canonicalObservationFields) {
		return fmt.Errorf("%w: canonical evidence must contain exactly 32 fields", ErrArtifactMismatch)
	}
	for index, expected := range canonicalObservationFields {
		actual := schema.Field(index)
		if actual.Name != expected.Name || actual.Nullable != expected.Nullable || !arrow.TypeEqual(actual.Type, expected.Type) {
			return fmt.Errorf("%w: canonical field %d must be %s/%s/nullable=%t, got %s/%s/nullable=%t", ErrArtifactMismatch,
				index, expected.Name, expected.Type, expected.Nullable, actual.Name, actual.Type, actual.Nullable)
		}
	}
	if schemaID, present := schema.Metadata().GetValue("golem.schema_id"); requireSchemaID && (!present || schemaID != "golem.observations.v1") {
		return fmt.Errorf("%w: canonical schema metadata lacks golem.observations.v1", ErrArtifactMismatch)
	}
	return nil
}

func appendCanonicalRecord(rows []domain.Observation, record arrow.RecordBatch, authorityTime time.Time) ([]domain.Observation, error) {
	if err := validateCanonicalSchema(record.Schema(), false); err != nil {
		return nil, err
	}
	stringsAt := func(index int) *arrowarray.String { return record.Column(index).(*arrowarray.String) }
	floatsAt := func(index int) *arrowarray.Float64 { return record.Column(index).(*arrowarray.Float64) }
	timesAt := func(index int) *arrowarray.Timestamp { return record.Column(index).(*arrowarray.Timestamp) }
	intsAt := func(index int) *arrowarray.Int64 { return record.Column(index).(*arrowarray.Int64) }
	for rowIndex := 0; rowIndex < int(record.NumRows()); rowIndex++ {
		row := domain.Observation{
			ObservationID: requiredString(stringsAt(0), rowIndex), EntityID: requiredString(stringsAt(1), rowIndex),
			EntityName: requiredString(stringsAt(2), rowIndex), Platform: requiredString(stringsAt(3), rowIndex),
			ContentID: optionalStringArray(stringsAt(4), rowIndex), Dimension: optionalStringArray(stringsAt(5), rowIndex),
			Metric: requiredString(stringsAt(6), rowIndex), MetricDefinitionVersion: requiredString(stringsAt(7), rowIndex),
			Numerator: optionalFloat(floatsAt(8), rowIndex), Denominator: optionalFloat(floatsAt(9), rowIndex),
			Value: requiredFloat(floatsAt(10), rowIndex), Unit: requiredString(stringsAt(11), rowIndex),
			PublishedAt: optionalTimestamp(timesAt(12), rowIndex), ObservedAt: requiredTimestamp(timesAt(13), rowIndex),
			RecordedAt: requiredTimestamp(timesAt(14), rowIndex), ValidFrom: requiredTimestamp(timesAt(15), rowIndex),
			ValidTo: optionalTimestamp(timesAt(16), rowIndex), SourceURL: requiredString(stringsAt(17), rowIndex),
			NativeID: requiredString(stringsAt(18), rowIndex), ConnectorVersion: requiredString(stringsAt(19), rowIndex),
			Classification: requiredString(stringsAt(20), rowIndex), Confidence: requiredFloat(floatsAt(21), rowIndex),
			ArtifactHash: requiredString(stringsAt(22), rowIndex), ExtractionPointer: requiredString(stringsAt(23), rowIndex),
			FreshnessSeconds: requiredInt(intsAt(24), rowIndex), Availability: requiredString(stringsAt(25), rowIndex),
			Coverage: requiredFloat(floatsAt(26), rowIndex), AcquisitionMode: requiredString(stringsAt(27), rowIndex),
			DataClass: requiredString(stringsAt(28), rowIndex), PermittedPurpose: requiredString(stringsAt(29), rowIndex),
			RetentionUntil: requiredTimestamp(timesAt(30), rowIndex), RightsState: requiredString(stringsAt(31), rowIndex),
		}
		if err := validateCanonicalObservation(row, authorityTime); err != nil {
			return nil, fmt.Errorf("%w: canonical row %d: %v", ErrArtifactMismatch, len(rows)+rowIndex+1, err)
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func requiredString(values *arrowarray.String, index int) string {
	if values.IsNull(index) {
		return ""
	}
	return values.Value(index)
}

func optionalStringArray(values *arrowarray.String, index int) *string {
	if values.IsNull(index) {
		return nil
	}
	value := values.Value(index)
	return &value
}

func requiredFloat(values *arrowarray.Float64, index int) float64 {
	if values.IsNull(index) {
		return math.NaN()
	}
	return values.Value(index)
}

func optionalFloat(values *arrowarray.Float64, index int) *float64 {
	if values.IsNull(index) {
		return nil
	}
	value := values.Value(index)
	return &value
}

func requiredInt(values *arrowarray.Int64, index int) int64 {
	if values.IsNull(index) {
		return -1
	}
	return values.Value(index)
}

func requiredTimestamp(values *arrowarray.Timestamp, index int) time.Time {
	if values.IsNull(index) {
		return time.Time{}
	}
	return values.Value(index).ToTime(arrow.Microsecond).UTC()
}

func optionalTimestamp(values *arrowarray.Timestamp, index int) *time.Time {
	if values.IsNull(index) {
		return nil
	}
	value := values.Value(index).ToTime(arrow.Microsecond).UTC()
	return &value
}

func validateCanonicalObservation(row domain.Observation, authorityTime time.Time) error {
	for name, value := range map[string]string{
		"observation_id": row.ObservationID, "entity_id": row.EntityID, "entity_name": row.EntityName,
		"platform": row.Platform, "metric": row.Metric, "metric_definition_version": row.MetricDefinitionVersion,
		"unit": row.Unit, "source_url": row.SourceURL, "native_id": row.NativeID, "connector_version": row.ConnectorVersion,
		"classification": row.Classification, "artifact_hash": row.ArtifactHash, "extraction_pointer": row.ExtractionPointer,
		"availability": row.Availability, "acquisition_mode": row.AcquisitionMode, "permitted_purpose": row.PermittedPurpose,
		"rights_state": row.RightsState,
	} {
		if value == "" || value != strings.TrimSpace(value) {
			return fmt.Errorf("%s is empty or contains surrounding whitespace", name)
		}
	}
	if _, err := hex.DecodeString(row.ArtifactHash); err != nil || len(row.ArtifactHash) != 64 || row.ArtifactHash != strings.ToLower(row.ArtifactHash) {
		return fmt.Errorf("artifact_hash is not a lowercase SHA-256")
	}
	if row.ObservedAt.IsZero() || row.RecordedAt.IsZero() || row.ValidFrom.IsZero() || row.RetentionUntil.IsZero() {
		return fmt.Errorf("required timestamp is null")
	}
	if row.RecordedAt.Before(row.ObservedAt) || row.ValidTo != nil && row.ValidTo.Before(row.ValidFrom) || row.RetentionUntil.Before(row.RecordedAt) {
		return fmt.Errorf("observation time ordering is invalid")
	}
	if row.RetentionUntil.Before(authorityTime) {
		return fmt.Errorf("retention window expired before authority commit")
	}
	if row.RightsState != "permitted" {
		return fmt.Errorf("rights_state %q is not eligible for publication", row.RightsState)
	}
	if err := policy.ValidateDataClass(row.DataClass); err != nil {
		return err
	}
	if !slices.Contains([]string{"observed", "derived", "estimated", "first_party"}, row.Classification) ||
		!slices.Contains([]string{"available", "unavailable", "stale", "failed"}, row.Availability) ||
		!slices.Contains([]string{"public_web", "official_api", "authorized_account", "licensed_provider", "user_import", "fixture"}, row.AcquisitionMode) {
		return fmt.Errorf("canonical enum value is invalid")
	}
	if !finite(row.Value) || !finiteUnit(row.Confidence) || !finiteUnit(row.Coverage) || row.FreshnessSeconds < 0 ||
		row.Numerator != nil && !finite(*row.Numerator) || row.Denominator != nil && !finite(*row.Denominator) {
		return fmt.Errorf("canonical numeric value is invalid")
	}
	if row.Metric == "engagement_rate" && row.Numerator != nil && row.Denominator != nil {
		if *row.Denominator <= 0 || math.Abs(row.Value-(*row.Numerator / *row.Denominator)) > 1e-9*math.Max(1, math.Abs(row.Value)) {
			return fmt.Errorf("engagement rate contradicts its numerator and denominator")
		}
	}
	return nil
}

func validateCanonicalPair(arrowRows, parquetRows []domain.Observation) error {
	if !reflect.DeepEqual(arrowRows, parquetRows) {
		return fmt.Errorf("%w: Arrow IPC and Parquet canonical rows disagree", ErrArtifactMismatch)
	}
	seen := make(map[string]struct{}, len(arrowRows))
	for _, row := range arrowRows {
		if _, exists := seen[row.ObservationID]; exists {
			return fmt.Errorf("%w: duplicate canonical observation_id %q", ErrArtifactMismatch, row.ObservationID)
		}
		seen[row.ObservationID] = struct{}{}
	}
	return nil
}

func canonicalConnectorVersion(rows []domain.Observation) string {
	unique := make(map[string]struct{})
	for _, row := range rows {
		unique[row.ConnectorVersion] = struct{}{}
	}
	values := make([]string, 0, len(unique))
	for value := range unique {
		values = append(values, value)
	}
	slices.Sort(values)
	return strings.Join(values, ",")
}

func validateReportCitations(report domain.ComparisonReport, rows []domain.Observation) error {
	byID := make(map[string]domain.Observation, len(rows))
	for _, row := range rows {
		byID[row.ObservationID] = row
	}
	for _, target := range report.Targets {
		for _, citation := range target.Citations {
			row, present := byID[citation.ObservationID]
			if !present || citation.EntityID != row.EntityID || citation.SourceURL != row.SourceURL || citation.NativeID != row.NativeID ||
				!citation.ObservedAt.Equal(row.ObservedAt) || citation.ConnectorVersion != row.ConnectorVersion || math.Abs(citation.Confidence-row.Confidence) > 1e-12 {
				return fmt.Errorf("%w: report citation %q does not exactly match canonical evidence", ErrArtifactMismatch, citation.ObservationID)
			}
		}
	}
	return nil
}

func canonicalBounds(rows []domain.Observation) (time.Time, time.Time) {
	minimum, maximum := rows[0].ObservedAt, rows[0].ObservedAt
	for _, row := range rows[1:] {
		if row.ObservedAt.Before(minimum) {
			minimum = row.ObservedAt
		}
		if row.ObservedAt.After(maximum) {
			maximum = row.ObservedAt
		}
	}
	return minimum, maximum
}

func canonicalDataClass(rows []domain.Observation) string {
	precedence := map[string]int{"public": 0, "first_party": 1, "licensed_business_contact": 2, "restricted": 3}
	result := rows[0].DataClass
	for _, row := range rows[1:] {
		if precedence[row.DataClass] > precedence[result] {
			result = row.DataClass
		}
	}
	return result
}
