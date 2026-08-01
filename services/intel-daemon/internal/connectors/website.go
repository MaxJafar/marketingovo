package connectors

// The first connector that reaches a live source.
//
// It reads what a site publishes about itself: its RSS or Atom feed. That is
// deliberately the narrowest useful surface — it is public by construction,
// needs no credentials, is explicitly intended for machine consumption, and
// carries publication timestamps that support honest cadence and freshness
// metrics without inferring anything the publisher did not state.
//
// What this connector does not do is as important as what it does. It does not
// infer engagement, audience, reach or revenue from a feed; none of those are in
// the data. It records what was published and when, and marks everything else
// unavailable rather than zero.
//
// Every outbound request goes through internal/policy. This connector never
// constructs an http.Client of its own.

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/governance"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/policy"
)

const (
	WebsiteID               = "website.rss"
	WebsiteConnectorVersion = "website.rss@1.0.0"
	websiteUserAgent        = "AGENTintel/1.0 (+https://github.com/MaxJafar/marketingovo/services/intel-daemon)"
	// Parser identity recorded in evidence provenance for live website runs.
	WebsiteParserVersion = "agentintel-go-feed.v1"
)

// WebsiteWorker collects publication evidence from a site's own feed.
type WebsiteWorker struct {
	Limits policy.EgressLimits
	// Now is injectable so tests are deterministic.
	Now func() time.Time
	// KillSwitch is consulted before every request. A source disabled mid-run
	// ends the run partial rather than failed: what was already collected stays
	// valid evidence.
	KillSwitch func() bool
}

func NewWebsiteWorker() *WebsiteWorker {
	return &WebsiteWorker{Limits: policy.DefaultEgressLimits(websiteUserAgent)}
}

func (worker *WebsiteWorker) ID() string { return WebsiteID }

// Available reports whether the connector can run at all. It needs no
// credentials, so it is always available; a network failure is a per-run
// condition, not an availability one.
func (worker *WebsiteWorker) Available() bool { return true }

func (worker *WebsiteWorker) now() time.Time {
	if worker.Now != nil {
		return worker.Now().UTC()
	}
	return time.Now().UTC()
}

func (worker *WebsiteWorker) limits() policy.EgressLimits {
	if worker.Limits.MaxRedirects == 0 {
		return policy.DefaultEgressLimits(websiteUserAgent)
	}
	return worker.Limits
}

// SourceOutcome records what happened for one target, so a partial run can
// explain precisely which source was unavailable and why.
type SourceOutcome struct {
	TargetID     string
	FeedURL      string
	Items        int
	Blocked      bool
	BlockedBy    string
	Err          error
	RobotsResult string
}

func (worker *WebsiteWorker) Analyze(ctx context.Context, request AnalysisRequest, emit ProgressSink) (domain.ConnectorResult, error) {
	targets := request.TargetIDs
	if len(targets) == 0 {
		return domain.ConnectorResult{}, &WorkerError{
			Code:    "no_targets",
			Message: "the website connector needs at least one target site",
		}
	}

	limits := worker.limits()
	client := policy.NewEgressClient(limits)
	observed := worker.now()

	var observations []domain.Observation
	outcomes := make([]SourceOutcome, 0, len(targets))

	for index, target := range targets {
		if err := ctx.Err(); err != nil {
			return domain.ConnectorResult{}, err
		}
		if worker.KillSwitch != nil && worker.KillSwitch() {
			outcomes = append(outcomes, SourceOutcome{
				TargetID: target, Blocked: true, BlockedBy: "kill_switch",
			})
			continue
		}
		progress := 0.15 + 0.5*float64(index)/float64(len(targets))
		emitProgress(emit, "collect", "info",
			fmt.Sprintf("Reading published content for %s", target), progress)

		outcome, targetObservations := worker.collectTarget(ctx, client, limits, target, observed)
		outcomes = append(outcomes, outcome)
		observations = append(observations, targetObservations...)
	}

	if len(observations) == 0 {
		return domain.ConnectorResult{}, &WorkerError{
			Code:    "source_failure",
			Message: describeOutcomes(outcomes),
		}
	}
	emitProgress(emit, "analyze", "info",
		fmt.Sprintf("Collected %d observation(s) across %d source(s)",
			len(observations), len(outcomes)), 0.7)
	return worker.publish(request, observations, outcomes)
}

// Observations exposes the collected evidence for a set of targets without the
// artifact plumbing, so the daemon can reuse the shared report path.
func (worker *WebsiteWorker) Observations(ctx context.Context, targets []string) ([]domain.Observation, []SourceOutcome, error) {
	limits := worker.limits()
	client := policy.NewEgressClient(limits)
	observed := worker.now()

	var observations []domain.Observation
	outcomes := make([]SourceOutcome, 0, len(targets))
	for _, target := range targets {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		if worker.KillSwitch != nil && worker.KillSwitch() {
			outcomes = append(outcomes, SourceOutcome{
				TargetID: target, Blocked: true, BlockedBy: "kill_switch",
			})
			continue
		}
		outcome, targetObservations := worker.collectTarget(ctx, client, limits, target, observed)
		outcomes = append(outcomes, outcome)
		observations = append(observations, targetObservations...)
	}
	return observations, outcomes, nil
}

func (worker *WebsiteWorker) collectTarget(
	ctx context.Context,
	client *http.Client,
	limits policy.EgressLimits,
	target string,
	observed time.Time,
) (SourceOutcome, []domain.Observation) {
	outcome := SourceOutcome{TargetID: target}

	base, err := policy.ValidateEgressURL(target, limits)
	if err != nil {
		outcome.Err = err
		return outcome, nil
	}

	robots := worker.fetchRobots(ctx, client, limits, base)
	outcome.RobotsResult = robots.result

	feedURL, err := worker.discoverFeed(ctx, client, limits, base, robots)
	if err != nil {
		outcome.Err = err
		return outcome, nil
	}
	outcome.FeedURL = feedURL.String()

	if !robots.allows(feedURL.Path) {
		outcome.Blocked = true
		outcome.BlockedBy = "robots"
		return outcome, nil
	}

	items, err := worker.fetchFeed(ctx, client, limits, feedURL)
	if err != nil {
		outcome.Err = err
		return outcome, nil
	}
	outcome.Items = len(items)

	return outcome, buildWebsiteObservations(target, feedURL.String(), items, observed)
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

type robotsPolicy struct {
	disallow []string
	allow    []string
	result   string
}

// allows implements the longest-match rule: the most specific matching pattern
// wins, and Allow beats Disallow at equal length. Absent or unreadable robots
// means the site stated no restriction, which is not the same as forbidding.
func (r robotsPolicy) allows(path string) bool {
	if path == "" {
		path = "/"
	}
	longestDisallow, longestAllow := -1, -1
	for _, rule := range r.disallow {
		if rule != "" && strings.HasPrefix(path, rule) && len(rule) > longestDisallow {
			longestDisallow = len(rule)
		}
	}
	for _, rule := range r.allow {
		if rule != "" && strings.HasPrefix(path, rule) && len(rule) > longestAllow {
			longestAllow = len(rule)
		}
	}
	if longestDisallow < 0 {
		return true
	}
	return longestAllow >= longestDisallow
}

func (worker *WebsiteWorker) fetchRobots(
	ctx context.Context, client *http.Client, limits policy.EgressLimits, base *url.URL,
) robotsPolicy {
	robotsURL := *base
	robotsURL.Path = "/robots.txt"
	robotsURL.RawQuery = ""
	body, _, err := worker.get(ctx, client, limits, &robotsURL)
	if err != nil {
		return robotsPolicy{result: "unavailable"}
	}
	return parseRobots(string(body))
}

func parseRobots(body string) robotsPolicy {
	policyForUs := robotsPolicy{result: "applied"}
	var applies bool
	for _, raw := range strings.Split(body, "\n") {
		line := strings.TrimSpace(raw)
		if index := strings.IndexByte(line, '#'); index >= 0 {
			line = strings.TrimSpace(line[:index])
		}
		if line == "" {
			continue
		}
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		switch key {
		case "user-agent":
			// Only the wildcard group is honoured. Claiming a product-specific
			// group would let a site's rules for some other crawler apply to us.
			applies = value == "*"
		case "disallow":
			if applies {
				policyForUs.disallow = append(policyForUs.disallow, value)
			}
		case "allow":
			if applies {
				policyForUs.allow = append(policyForUs.allow, value)
			}
		}
	}
	return policyForUs
}

// ---------------------------------------------------------------------------
// feed discovery and parsing
// ---------------------------------------------------------------------------

var feedLinkPattern = regexp.MustCompile(
	`(?is)<link[^>]+type=["']application/(?:rss|atom)\+xml["'][^>]*>`)
var hrefPattern = regexp.MustCompile(`(?is)href=["']([^"']+)["']`)

var conventionalFeedPaths = []string{
	"/feed", "/feed.xml", "/rss", "/rss.xml", "/atom.xml", "/index.xml", "/blog/feed",
}

func (worker *WebsiteWorker) discoverFeed(
	ctx context.Context, client *http.Client, limits policy.EgressLimits,
	base *url.URL, robots robotsPolicy,
) (*url.URL, error) {
	// If the target already points at a feed, use it.
	if looksLikeFeedPath(base.Path) {
		return base, nil
	}
	// Prefer the site's own declaration over guessing.
	if robots.allows(base.Path) {
		if body, _, err := worker.get(ctx, client, limits, base); err == nil {
			if match := feedLinkPattern.Find(body); match != nil {
				if href := hrefPattern.FindSubmatch(match); len(href) == 2 {
					if resolved, err := base.Parse(strings.TrimSpace(string(href[1]))); err == nil {
						if _, err := policy.ValidateEgressURL(resolved.String(), limits); err == nil {
							return resolved, nil
						}
					}
				}
			}
		}
	}
	for _, path := range conventionalFeedPaths {
		if !robots.allows(path) {
			continue
		}
		candidate := *base
		candidate.Path = path
		candidate.RawQuery = ""
		if body, _, err := worker.get(ctx, client, limits, &candidate); err == nil {
			if len(parseFeed(body)) > 0 {
				return &candidate, nil
			}
		}
	}
	return nil, &WorkerError{
		Code:    "feed_not_found",
		Message: fmt.Sprintf("no RSS or Atom feed was discoverable for %s", base.Host),
	}
}

func looksLikeFeedPath(path string) bool {
	lowered := strings.ToLower(path)
	for _, suffix := range []string{".xml", "/feed", "/rss", "/atom"} {
		if strings.HasSuffix(lowered, suffix) {
			return true
		}
	}
	return false
}

// FeedItem is one published entry, reduced to what a feed actually states.
type FeedItem struct {
	ID          string
	Title       string
	Link        string
	PublishedAt time.Time
}

type rssDocument struct {
	XMLName xml.Name `xml:"rss"`
	Items   []struct {
		Title   string `xml:"title"`
		Link    string `xml:"link"`
		GUID    string `xml:"guid"`
		PubDate string `xml:"pubDate"`
	} `xml:"channel>item"`
}

type atomDocument struct {
	XMLName xml.Name `xml:"feed"`
	Entries []struct {
		Title string `xml:"title"`
		ID    string `xml:"id"`
		Links []struct {
			Href string `xml:"href,attr"`
			Rel  string `xml:"rel,attr"`
		} `xml:"link"`
		Published string `xml:"published"`
		Updated   string `xml:"updated"`
	} `xml:"entry"`
}

var feedTimeLayouts = []string{
	time.RFC1123Z, time.RFC1123, time.RFC822Z, time.RFC822,
	time.RFC3339, "2006-01-02T15:04:05Z0700", "2006-01-02",
}

func parseFeedTime(value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	for _, layout := range feedTimeLayouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), true
		}
	}
	return time.Time{}, false
}

func parseFeed(body []byte) []FeedItem {
	var rss rssDocument
	if err := xml.Unmarshal(body, &rss); err == nil && len(rss.Items) > 0 {
		items := make([]FeedItem, 0, len(rss.Items))
		for _, entry := range rss.Items {
			item := FeedItem{
				ID:    firstNonEmpty(entry.GUID, entry.Link, entry.Title),
				Title: strings.TrimSpace(entry.Title),
				Link:  strings.TrimSpace(entry.Link),
			}
			if published, ok := parseFeedTime(entry.PubDate); ok {
				item.PublishedAt = published
			}
			items = append(items, item)
		}
		return items
	}
	var atom atomDocument
	if err := xml.Unmarshal(body, &atom); err == nil && len(atom.Entries) > 0 {
		items := make([]FeedItem, 0, len(atom.Entries))
		for _, entry := range atom.Entries {
			link := ""
			for _, candidate := range entry.Links {
				if candidate.Rel == "" || candidate.Rel == "alternate" {
					link = candidate.Href
					break
				}
			}
			item := FeedItem{
				ID:    firstNonEmpty(entry.ID, link, entry.Title),
				Title: strings.TrimSpace(entry.Title),
				Link:  strings.TrimSpace(link),
			}
			if published, ok := parseFeedTime(firstNonEmpty(entry.Published, entry.Updated)); ok {
				item.PublishedAt = published
			}
			items = append(items, item)
		}
		return items
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (worker *WebsiteWorker) fetchFeed(
	ctx context.Context, client *http.Client, limits policy.EgressLimits, feedURL *url.URL,
) ([]FeedItem, error) {
	body, _, err := worker.get(ctx, client, limits, feedURL)
	if err != nil {
		return nil, err
	}
	items := parseFeed(body)
	if len(items) == 0 {
		return nil, &WorkerError{
			Code:    "feed_unparsable",
			Message: fmt.Sprintf("%s returned no readable RSS or Atom entries", feedURL),
		}
	}
	return items, nil
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------

func (worker *WebsiteWorker) get(
	ctx context.Context, client *http.Client, limits policy.EgressLimits, target *url.URL,
) ([]byte, int, error) {
	if _, err := policy.ValidateEgressURL(target.String(), limits); err != nil {
		return nil, 0, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("User-Agent", limits.UserAgent)
	request.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/html;q=0.8")

	response, err := client.Do(request)
	if err != nil {
		var egress *policy.EgressError
		if errors.As(err, &egress) {
			return nil, 0, egress
		}
		return nil, 0, &WorkerError{Code: "source_unreachable", Message: err.Error(), Cause: err}
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return nil, response.StatusCode, &WorkerError{
			Code:    "source_status",
			Message: fmt.Sprintf("%s returned HTTP %d", target, response.StatusCode),
		}
	}
	// Bounded read: a source must not be able to exhaust memory.
	body, err := io.ReadAll(io.LimitReader(response.Body, limits.MaxResponseSize+1))
	if err != nil {
		return nil, response.StatusCode, &WorkerError{
			Code: "source_read_failed", Message: err.Error(), Cause: err,
		}
	}
	if int64(len(body)) > limits.MaxResponseSize {
		return nil, response.StatusCode, &WorkerError{
			Code:    "response_too_large",
			Message: fmt.Sprintf("%s exceeded the %d byte response bound", target, limits.MaxResponseSize),
		}
	}
	return body, response.StatusCode, nil
}

// ---------------------------------------------------------------------------
// observations
// ---------------------------------------------------------------------------

// buildWebsiteObservations turns feed entries into evidence. Every metric is
// something the feed stated; nothing is inferred about audience or engagement.
func buildWebsiteObservations(
	targetID, feedURL string, items []FeedItem, observed time.Time,
) []domain.Observation {
	dated := make([]FeedItem, 0, len(items))
	for _, item := range items {
		if !item.PublishedAt.IsZero() {
			dated = append(dated, item)
		}
	}
	sort.Slice(dated, func(a, b int) bool {
		return dated[a].PublishedAt.Before(dated[b].PublishedAt)
	})

	retention := observed.AddDate(0, 0, 90)
	name := targetID
	if parsed, err := url.Parse(targetID); err == nil && parsed.Host != "" {
		name = parsed.Host
	}

	base := domain.Observation{
		EntityID:          targetID,
		EntityName:        name,
		Platform:          "website",
		ObservedAt:        observed,
		RecordedAt:        observed,
		ValidFrom:         observed,
		SourceURL:         feedURL,
		ConnectorVersion:  WebsiteConnectorVersion,
		Classification:    "observed",
		Confidence:        1,
		AcquisitionMode:   "public_feed",
		DataClass:         "public",
		PermittedPurpose:  "competitive_research",
		RetentionUntil:    retention,
		RightsState:       "permitted",
		Availability:      "available",
		Coverage:          1,
		ExtractionPointer: "feed:item",
	}

	observations := make([]domain.Observation, 0, 3)

	// 1. How much the feed exposes. Counting entries in a feed is not counting
	//    everything a site published: most feeds are truncated. Coverage records
	//    that honestly rather than implying a total.
	published := base
	published.ObservationID = fmt.Sprintf("obs-%s-content-published", stableID(targetID))
	published.Metric = "content_published"
	published.MetricDefinitionVersion = "content_published.v1"
	published.Value = float64(len(items))
	published.Unit = "items"
	published.NativeID = fmt.Sprintf("%s#items", feedURL)
	published.Coverage = 1
	published.FreshnessSeconds = 0
	observations = append(observations, published)

	if len(dated) == 0 {
		// A feed with no parseable dates supports a count and nothing else. Saying
		// so is the point: a missing cadence is not a cadence of zero.
		return observations
	}

	newest := dated[len(dated)-1].PublishedAt
	oldest := dated[0].PublishedAt

	freshness := base
	freshness.ObservationID = fmt.Sprintf("obs-%s-content-freshness", stableID(targetID))
	freshness.Metric = "content_freshness_seconds"
	freshness.MetricDefinitionVersion = "content_freshness_seconds.v1"
	freshness.Value = math.Max(0, observed.Sub(newest).Seconds())
	freshness.Unit = "seconds"
	freshness.NativeID = fmt.Sprintf("%s#newest", feedURL)
	newestCopy := newest
	freshness.PublishedAt = &newestCopy
	freshness.FreshnessSeconds = int64(math.Max(0, observed.Sub(newest).Seconds()))
	freshness.Coverage = float64(len(dated)) / float64(len(items))
	observations = append(observations, freshness)

	// 2. Cadence, only when there is a real interval to divide by. One dated item
	//    gives a span of zero, and dividing by it would fabricate a rate.
	if len(dated) >= 2 && newest.After(oldest) {
		spanDays := newest.Sub(oldest).Hours() / 24
		intervals := float64(len(dated) - 1)
		cadence := base
		cadence.ObservationID = fmt.Sprintf("obs-%s-publishing-cadence", stableID(targetID))
		cadence.Metric = "publishing_cadence_days"
		cadence.MetricDefinitionVersion = "publishing_cadence_days.v1"
		cadence.Numerator = &spanDays
		cadence.Denominator = &intervals
		cadence.Value = spanDays / intervals
		cadence.Unit = "days_per_item"
		cadence.NativeID = fmt.Sprintf("%s#cadence", feedURL)
		cadence.Coverage = float64(len(dated)) / float64(len(items))
		cadence.FreshnessSeconds = int64(math.Max(0, observed.Sub(newest).Seconds()))
		observations = append(observations, cadence)
	}

	return observations
}

var unsafeIDPattern = regexp.MustCompile(`[^a-z0-9]+`)

func stableID(value string) string {
	lowered := strings.ToLower(value)
	lowered = strings.TrimPrefix(strings.TrimPrefix(lowered, "https://"), "http://")
	return strings.Trim(unsafeIDPattern.ReplaceAllString(lowered, "-"), "-")
}

func describeOutcomes(outcomes []SourceOutcome) string {
	parts := make([]string, 0, len(outcomes))
	for _, outcome := range outcomes {
		switch {
		case outcome.Blocked:
			parts = append(parts, fmt.Sprintf("%s blocked by %s", outcome.TargetID, outcome.BlockedBy))
		case outcome.Err != nil:
			parts = append(parts, fmt.Sprintf("%s failed: %v", outcome.TargetID, outcome.Err))
		default:
			parts = append(parts, fmt.Sprintf("%s produced no observations", outcome.TargetID))
		}
	}
	return strings.Join(parts, "; ")
}

// publish writes the same artifact pair the rest of the pipeline expects, so
// live-source runs are governed, hashed and validated exactly like fixture runs.
// The authority still re-decodes and verifies everything written here.
func (worker *WebsiteWorker) publish(
	request AnalysisRequest,
	observations []domain.Observation,
	outcomes []SourceOutcome,
) (domain.ConnectorResult, error) {
	if err := os.MkdirAll(request.OutputDir, 0o700); err != nil {
		return domain.ConnectorResult{}, fmt.Errorf("create website output directory: %w", err)
	}
	options := cloneOptions(request.Options)
	options["workflow"] = string(request.Workflow)
	if options["workflow"] == "" {
		options["workflow"] = string(domain.WorkflowCompare)
	}
	if request.ResearchQuestion != "" {
		options["question"] = request.ResearchQuestion
	}
	// Sources that produced nothing are recorded so the report can say which
	// evidence is missing instead of silently narrowing its scope.
	var unavailable []string
	for _, outcome := range outcomes {
		if outcome.Err != nil || outcome.Blocked || outcome.Items == 0 {
			unavailable = append(unavailable, outcome.TargetID)
		}
	}
	if len(unavailable) > 0 {
		options["unavailable_sources"] = strings.Join(unavailable, ",")
	}

	report, entities, documents, err := BuildFixtureReport(
		request.RunID, request.TargetIDs, options, observations)
	if err != nil {
		return domain.ConnectorResult{}, err
	}

	observationBytes, err := marshalNDJSON(observations)
	if err != nil {
		return domain.ConnectorResult{}, err
	}
	reportBytes, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return domain.ConnectorResult{}, fmt.Errorf("encode website report: %w", err)
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
	minimum, maximum := observationRange(observations)
	return domain.ConnectorResult{
		Succeeded: true,
		Artifacts: []domain.ArtifactDescriptor{
			{
				RelativePath: "observations.ndjson", Kind: "raw", MediaType: "application/x-ndjson",
				SHA256: observationHash, SizeBytes: observationSize, RowCount: int64(len(observations)),
				SchemaID: "agentintel.observations.v1", MinimumObservedAt: minimum, MaximumObservedAt: maximum,
				DataClass: "public",
			},
			{
				RelativePath: "report.json", Kind: "report", MediaType: "application/json",
				SHA256: reportHash, SizeBytes: reportSize, RowCount: int64(len(report.Targets)),
				SchemaID: "agentintel.comparison-report.v1", DataClass: "public",
			},
		},
		ReportRelativePath: "report.json", ReportSHA256: reportHash,
		ModelVersion: "website-feed-analytics.v1", WorkerVersion: WebsiteConnectorVersion,
		Entities: entities, SearchDocuments: documents,
	}, nil
}
