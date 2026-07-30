package connectors

import (
	"bufio"
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/GolemWorkers/agentintel/internal/domain"
	"github.com/GolemWorkers/agentintel/internal/governance"
)

const FixtureID = "fixture.competitive-pulse"

type FixtureWorker struct {
	FixturePath string
	SlowDelay   time.Duration
}

func (worker *FixtureWorker) ID() string { return FixtureID }
func (worker *FixtureWorker) Available() bool {
	_, err := os.Stat(worker.FixturePath)
	return err == nil
}

func (worker *FixtureWorker) Analyze(ctx context.Context, request AnalysisRequest, emit ProgressSink) (domain.ConnectorResult, error) {
	simulation := request.Options["simulate"]
	if simulation == "source_failure" {
		return domain.ConnectorResult{}, &WorkerError{Code: "source_failure", Message: "fixture source failed by explicit simulation"}
	}
	emitProgress(emit, "collect", "info", "Reading the offline competitive-pulse fixture", 0.15)
	if simulation == "slow" {
		delay := worker.SlowDelay
		if delay <= 0 {
			delay = 3 * time.Second
		}
		ticker := time.NewTicker(25 * time.Millisecond)
		defer ticker.Stop()
		timer := time.NewTimer(delay)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return domain.ConnectorResult{}, ctx.Err()
			case <-ticker.C:
			case <-timer.C:
				goto collected
			}
		}
	}

collected:
	inputPath := request.InputPath
	if inputPath == "" {
		inputPath = worker.FixturePath
	}
	observations, err := LoadObservations(inputPath, request.TargetIDs)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	if err := ctx.Err(); err != nil {
		return domain.ConnectorResult{}, err
	}
	if err := os.MkdirAll(request.OutputDir, 0o700); err != nil {
		return domain.ConnectorResult{}, fmt.Errorf("create fixture output directory: %w", err)
	}
	emitProgress(emit, "analyze", "info", "Computing denominator-specific public metrics", 0.55)
	reportOptions := cloneOptions(request.Options)
	reportOptions["workflow"] = string(request.Workflow)
	if reportOptions["workflow"] == "" {
		reportOptions["workflow"] = string(domain.WorkflowCompare)
	}
	if request.ResearchQuestion != "" {
		reportOptions["question"] = request.ResearchQuestion
	}
	if request.SourceBudget != 0 {
		reportOptions["source_budget"] = strconv.FormatUint(uint64(request.SourceBudget), 10)
	}
	report, entities, documents, err := BuildFixtureReport(request.RunID, request.TargetIDs, reportOptions, observations)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	observationBytes, err := marshalNDJSON(observations)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	reportBytes, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return domain.ConnectorResult{}, fmt.Errorf("encode comparison report: %w", err)
	}
	reportBytes = append(reportBytes, '\n')
	observationPath := filepath.Join(request.OutputDir, "observations.ndjson")
	reportPath := filepath.Join(request.OutputDir, "report.json")
	if err := os.WriteFile(observationPath, observationBytes, 0o600); err != nil {
		return domain.ConnectorResult{}, err
	}
	if err := os.WriteFile(reportPath, reportBytes, 0o600); err != nil {
		return domain.ConnectorResult{}, err
	}
	observationHash, observationSize, err := governance.FileDigest(observationPath)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	reportHash, reportSize, err := governance.FileDigest(reportPath)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	if simulation == "corrupt_artifact" {
		observationHash = strings.Repeat("0", 64)
	}
	minimum, maximum := observationRange(observations)
	emitProgress(emit, "validate", "info", "Fixture analysis completed; awaiting artifact validation", 0.85)
	return domain.ConnectorResult{
		Succeeded: true,
		Artifacts: []domain.ArtifactDescriptor{
			{
				RelativePath: "observations.ndjson", Kind: "raw", MediaType: "application/x-ndjson",
				SHA256: observationHash, SizeBytes: observationSize, RowCount: int64(len(observations)),
				SchemaID: "golem.observations.v1", MinimumObservedAt: minimum, MaximumObservedAt: maximum,
				DataClass: "public",
			},
			{
				RelativePath: "report.json", Kind: "report", MediaType: "application/json",
				SHA256: reportHash, SizeBytes: reportSize, RowCount: int64(len(report.Targets)),
				SchemaID: "golem.comparison-report.v1", DataClass: "public",
			},
		},
		ReportRelativePath: "report.json", ReportSHA256: reportHash, ModelVersion: "fixture-analytics.v1", WorkerVersion: FixtureID,
		Entities: entities, SearchDocuments: documents,
	}, nil
}

func LoadObservations(path string, targetIDs []string) ([]domain.Observation, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, &WorkerError{Code: "source_failure", Message: "open fixture source", Cause: err}
	}
	defer file.Close()
	targets := make(map[string]struct{}, len(targetIDs))
	for _, target := range targetIDs {
		targets[target] = struct{}{}
	}
	seenTargets := make(map[string]struct{}, len(targets))
	var observations []domain.Observation
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64<<10), 1<<20)
	for line := 1; scanner.Scan(); line++ {
		if len(bytes.TrimSpace(scanner.Bytes())) == 0 {
			continue
		}
		var observation domain.Observation
		decoder := json.NewDecoder(bytes.NewReader(scanner.Bytes()))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&observation); err != nil {
			return nil, &WorkerError{Code: "source_invalid", Message: fmt.Sprintf("fixture line %d is invalid: %v", line, err)}
		}
		if _, included := targets[observation.EntityID]; !included {
			continue
		}
		if err := validateObservation(observation); err != nil {
			return nil, &WorkerError{Code: "source_invalid", Message: fmt.Sprintf("fixture line %d: %v", line, err)}
		}
		seenTargets[observation.EntityID] = struct{}{}
		observations = append(observations, observation)
	}
	if err := scanner.Err(); err != nil {
		return nil, &WorkerError{Code: "source_failure", Message: "read fixture source", Cause: err}
	}
	for target := range targets {
		if _, found := seenTargets[target]; !found {
			return nil, &WorkerError{Code: "target_not_found", Message: fmt.Sprintf("target %q is absent from the fixture", target)}
		}
	}
	if len(observations) == 0 {
		return nil, &WorkerError{Code: "source_empty", Message: "fixture returned no observations"}
	}
	return observations, nil
}

func BuildFixtureReport(runID string, targetIDs []string, options map[string]string, observations []domain.Observation) (domain.ComparisonReport, []domain.Entity, []domain.SearchDocument, error) {
	byEntity := make(map[string][]domain.Observation)
	for _, observation := range observations {
		byEntity[observation.EntityID] = append(byEntity[observation.EntityID], observation)
	}
	findings := make([]domain.TargetFinding, 0, len(targetIDs))
	entities := make([]domain.Entity, 0, len(targetIDs))
	for _, targetID := range targetIDs {
		rows := byEntity[targetID]
		finding, entity, err := analyzeTarget(rows)
		if err != nil {
			return domain.ComparisonReport{}, nil, nil, err
		}
		findings = append(findings, finding)
		entities = append(entities, entity)
	}
	workflow := options["workflow"]
	if workflow == "" {
		workflow = string(domain.WorkflowCompare)
	}
	title := "Competitive Pulse fixture comparison"
	summary := "Compared public follower change, denominator-specific engagement, posting cadence, and content format mix for the selected targets."
	if workflow == string(domain.WorkflowResearch) {
		title = "Competitive Pulse fixture research"
		if question := strings.TrimSpace(options["question"]); question != "" {
			summary = fmt.Sprintf("Research question: %s Public fixture evidence is summarized with explicit denominators and citations.", question)
		}
	}
	report := domain.ComparisonReport{
		SchemaVersion: "golem.comparison-report.v1", RunID: runID, GeneratedAt: time.Now().UTC(),
		Workflow: domain.Workflow(workflow), ResearchQuestion: options["question"], ResearchPlan: []string{"validate fixture observations", "derive denominator-specific metrics", "cite public observations"},
		Derivation: domain.Provenance{WorkerVersion: FixtureID, ModelVersion: "fixture-analytics.v1", ConnectorVersion: FixtureID, ParserVersion: "golem-go-fixture.v1"},
		Title:      title, Summary: summary, Targets: findings,
		MetricDefinitions: []domain.MetricDefinition{
			{ID: "follower_delta", Version: "followers.v1", Label: "Observed follower change", Numerator: "latest public follower count minus earliest public follower count", Denominator: "not_applicable", Period: "fixture observation window"},
			{ID: "median_engagement_rate", Version: "public-engagement-by-followers.v1", Label: "Median public engagement rate by followers", Numerator: "public interactions", Denominator: "public follower count at observation", Period: "per content item"},
			{ID: "posting_cadence_per_week", Version: "posting-cadence.v1", Label: "Observed posts per week", Numerator: "distinct observed content items", Denominator: "elapsed observation weeks", Period: "fixture observation window"},
		},
		Contradictions: []string{},
		Limitations:    []string{"Synthetic offline fixture; values demonstrate pipeline behavior rather than live market conditions.", "Public account observations do not establish causal or private business outcomes."},
	}
	if budget, err := strconv.Atoi(options["source_budget"]); err == nil {
		report.SourceBudget = budget
	}
	documents := []domain.SearchDocument{{
		Kind: "report", ID: runID, Label: report.Title, Excerpt: report.Summary, Confidence: minimumFindingConfidence(findings), RunID: &runID,
	}}
	for _, entity := range entities {
		documents = append(documents, domain.SearchDocument{
			Kind: "entity", ID: entity.ID, Label: entity.DisplayName,
			Excerpt: "Observed public social account in the Competitive Pulse fixture.", Confidence: 1,
		})
	}
	return report, entities, documents, nil
}

func analyzeTarget(rows []domain.Observation) (domain.TargetFinding, domain.Entity, error) {
	if len(rows) == 0 {
		return domain.TargetFinding{}, domain.Entity{}, fmt.Errorf("cannot analyze an empty target")
	}
	slices.SortFunc(rows, func(a, b domain.Observation) int {
		return cmp.Compare(a.ObservedAt.UnixNano(), b.ObservedAt.UnixNano())
	})
	var followers, engagement, content []domain.Observation
	for _, row := range rows {
		switch row.Metric {
		case "followers":
			followers = append(followers, row)
		case "engagement_rate":
			engagement = append(engagement, row)
			if row.ContentID != nil {
				content = append(content, row)
			}
		}
	}
	if len(followers) < 2 || len(engagement) == 0 {
		return domain.TargetFinding{}, domain.Entity{}, &WorkerError{Code: "source_incomplete", Message: fmt.Sprintf("target %s lacks required metric observations", rows[0].EntityID)}
	}
	engagementValues := make([]float64, 0, len(engagement))
	confidence := 1.0
	formats := make(map[string]int)
	citations := make([]domain.Citation, 0, len(rows))
	for _, row := range rows {
		confidence = math.Min(confidence, row.Confidence)
		if row.Metric == "engagement_rate" {
			engagementValues = append(engagementValues, row.Value)
			if row.Dimension != nil && *row.Dimension != "" {
				formats[*row.Dimension]++
			}
		}
		citations = append(citations, domain.Citation{
			ObservationID: row.ObservationID, EntityID: row.EntityID, SourceURL: row.SourceURL,
			NativeID: row.NativeID, ObservedAt: row.ObservedAt, ConnectorVersion: row.ConnectorVersion,
			Confidence: row.Confidence,
		})
	}
	sort.Float64s(engagementValues)
	median := engagementValues[len(engagementValues)/2]
	if len(engagementValues)%2 == 0 {
		median = (engagementValues[len(engagementValues)/2-1] + median) / 2
	}
	mix := make(map[string]float64, len(formats))
	for format, count := range formats {
		mix[format] = float64(count) / float64(len(content))
	}
	spanWeeks := followers[len(followers)-1].ObservedAt.Sub(followers[0].ObservedAt).Hours() / (24 * 7)
	if spanWeeks < 1 {
		spanWeeks = 1
	}
	delta := followers[len(followers)-1].Value - followers[0].Value
	warnings := []string{}
	if delta < 0 {
		warnings = append(warnings, fmt.Sprintf("Public follower count decreased by %.0f during the observed window; no causal or private-outcome inference is available.", -delta))
	}
	finding := domain.TargetFinding{
		EntityID: rows[0].EntityID, EntityName: rows[0].EntityName, FollowerDelta: delta,
		MedianEngagementRate: median, PostingCadencePerWeek: float64(len(content)) / spanWeeks,
		ContentFormatMix: mix, Confidence: confidence, Warnings: warnings, Citations: citations,
	}
	entity := domain.Entity{
		ID: rows[0].EntityID, Type: "social_account", DisplayName: rows[0].EntityName,
		ResolutionState: "observed", UpdatedAt: rows[len(rows)-1].ObservedAt,
		Identifiers: []domain.Identifier{{Scheme: rows[0].Platform + ".fixture_id", Value: rows[0].EntityID, Source: FixtureID}},
	}
	return finding, entity, nil
}

func validateObservation(value domain.Observation) error {
	if value.ObservationID == "" || value.EntityID == "" || value.EntityName == "" || value.Platform == "" || value.Metric == "" || value.MetricDefinitionVersion == "" || value.Unit == "" || value.NativeID == "" || value.ConnectorVersion == "" {
		return fmt.Errorf("required observation field is empty")
	}
	if value.ObservedAt.IsZero() || value.RecordedAt.IsZero() || !isFinite(value.Value) || !isFinite(value.Confidence) || value.Confidence < 0 || value.Confidence > 1 {
		return fmt.Errorf("observation time, value, or confidence is invalid")
	}
	parsed, err := url.Parse(value.SourceURL)
	if err != nil || parsed.Scheme != "https" || !strings.HasSuffix(parsed.Hostname(), ".invalid") {
		return fmt.Errorf("fixture source URL must use a reserved .invalid HTTPS host")
	}
	if value.DataClass != "public" || value.PermittedPurpose != "competitive_research" || value.Classification != "observed" {
		return fmt.Errorf("fixture policy fields are invalid")
	}
	if value.Metric == "engagement_rate" && (value.Numerator == nil || value.Denominator == nil || *value.Denominator <= 0) {
		return fmt.Errorf("engagement rate lacks its numerator or denominator")
	}
	return nil
}

func marshalNDJSON(observations []domain.Observation) ([]byte, error) {
	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	for _, observation := range observations {
		if err := encoder.Encode(observation); err != nil {
			return nil, err
		}
	}
	return output.Bytes(), nil
}

func observationRange(observations []domain.Observation) (*string, *string) {
	minimum, maximum := observations[0].ObservedAt, observations[0].ObservedAt
	for _, observation := range observations[1:] {
		if observation.ObservedAt.Before(minimum) {
			minimum = observation.ObservedAt
		}
		if observation.ObservedAt.After(maximum) {
			maximum = observation.ObservedAt
		}
	}
	minText, maxText := minimum.Format(time.RFC3339), maximum.Format(time.RFC3339)
	return &minText, &maxText
}

func minimumFindingConfidence(findings []domain.TargetFinding) float64 {
	confidence := 1.0
	for _, finding := range findings {
		confidence = math.Min(confidence, finding.Confidence)
	}
	return confidence
}

func emitProgress(sink ProgressSink, stage, level, message string, progress float64) {
	if sink != nil {
		sink(ProgressEvent{Stage: stage, Level: level, Message: message, Progress: progress})
	}
}

func isFinite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }
