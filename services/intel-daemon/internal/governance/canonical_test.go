package governance

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
	"github.com/apache/arrow-go/v18/arrow"
)

func TestCanonicalSchemaIsExactly32PhysicalFields(t *testing.T) {
	metadata := arrow.MetadataFrom(map[string]string{"agentintel.schema_id": "agentintel.observations.v1"})
	if err := validateCanonicalSchema(arrow.NewSchema(canonicalObservationFields, &metadata), true); err != nil {
		t.Fatalf("exact schema rejected: %v", err)
	}
	wrong := append([]arrow.Field(nil), canonicalObservationFields...)
	wrong[10].Type = arrow.PrimitiveTypes.Int64
	if err := validateCanonicalSchema(arrow.NewSchema(wrong, &metadata), true); err == nil {
		t.Fatal("wrong physical type was accepted")
	}
	missingMetadata := arrow.NewSchema(canonicalObservationFields, nil)
	if err := validateCanonicalSchema(missingMetadata, true); err == nil {
		t.Fatal("schema without canonical metadata was accepted")
	}
}

func TestCanonicalPolicyRejectsRevokedExpiredAndContradictoryRows(t *testing.T) {
	now := time.Now().UTC()
	base := validCanonicalObservation(now)
	for name, mutate := range map[string]func(*domain.Observation){
		"revoked": func(row *domain.Observation) { row.RightsState = "revoked" },
		"expired": func(row *domain.Observation) { row.RetentionUntil = now.Add(-time.Second) },
		"contradictory_rate": func(row *domain.Observation) {
			numerator, denominator := 5.0, 100.0
			row.Metric, row.Numerator, row.Denominator, row.Value = "engagement_rate", &numerator, &denominator, 0.9
		},
	} {
		t.Run(name, func(t *testing.T) {
			row := base
			mutate(&row)
			if err := validateCanonicalObservation(row, now); err == nil {
				t.Fatal("ineligible canonical row was accepted")
			}
		})
	}
}

func TestCanonicalFilesAndReportCitationsMustAgree(t *testing.T) {
	now := time.Now().UTC()
	row := validCanonicalObservation(now)
	other := row
	other.Value++
	if err := validateCanonicalPair([]domain.Observation{row}, []domain.Observation{other}); err == nil {
		t.Fatal("cross-file value mismatch was accepted")
	}
	report := domain.ComparisonReport{Targets: []domain.TargetFinding{{Citations: []domain.Citation{{
		ObservationID: row.ObservationID, EntityID: row.EntityID, SourceURL: row.SourceURL, NativeID: "wrong",
		ObservedAt: row.ObservedAt, ConnectorVersion: row.ConnectorVersion, Confidence: row.Confidence,
	}}}}}
	if err := validateReportCitations(report, []domain.Observation{row}); err == nil {
		t.Fatal("citation not present as an exact canonical tuple was accepted")
	}
	report.Targets[0].Citations[0].NativeID = row.NativeID
	if err := validateReportCitations(report, []domain.Observation{row}); err != nil {
		t.Fatalf("exact citation rejected: %v", err)
	}
	report.Targets[0].EntityID = "different-entity"
	if err := validateReportCitations(report, []domain.Observation{row}); !errors.Is(err, ErrProjectionMismatch) {
		t.Fatalf("projection mismatch error = %v, want ErrProjectionMismatch", err)
	}
}

func validCanonicalObservation(now time.Time) domain.Observation {
	return domain.Observation{
		ObservationID: "obs-1", EntityID: "entity-1", EntityName: "Entity One", Platform: "web",
		Metric: "followers", MetricDefinitionVersion: "followers.v1", Value: 42, Unit: "followers",
		ObservedAt: now.Add(-time.Hour), RecordedAt: now.Add(-time.Hour), ValidFrom: now.Add(-time.Hour),
		SourceURL: "https://example.invalid/evidence", NativeID: "native-1", ConnectorVersion: "fixture.v1",
		Classification: "observed", Confidence: 1, ArtifactHash: strings.Repeat("a", 64),
		ExtractionPointer: "ndjson:1", FreshnessSeconds: 0, Availability: "available", Coverage: 1,
		AcquisitionMode: "fixture", DataClass: "public", PermittedPurpose: "competitive_research",
		RetentionUntil: now.Add(365 * 24 * time.Hour), RightsState: "permitted",
	}
}
