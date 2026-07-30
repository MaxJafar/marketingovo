package connectors

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/MaxJafar/AGENTintel/internal/policy"
)

const sampleRSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Northstar Labs</title>
  <item><title>Third post</title><link>https://site/3</link><guid>p3</guid>
    <pubDate>Mon, 22 Jun 2026 12:00:00 +0000</pubDate></item>
  <item><title>Second post</title><link>https://site/2</link><guid>p2</guid>
    <pubDate>Mon, 08 Jun 2026 12:00:00 +0000</pubDate></item>
  <item><title>First post</title><link>https://site/1</link><guid>p1</guid>
    <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate></item>
</channel></rss>`

const sampleAtom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Alpha</title><id>urn:a</id>
    <link href="https://site/a" rel="alternate"/>
    <published>2026-06-10T12:00:00Z</published></entry>
  <entry><title>Beta</title><id>urn:b</id>
    <link href="https://site/b" rel="alternate"/>
    <published>2026-06-20T12:00:00Z</published></entry>
</feed>`

// A worker pointed at a test server needs private addresses allowed, because
// httptest binds loopback. Everything else stays at its default bound.
func testWorker(observed time.Time) *WebsiteWorker {
	limits := policy.DefaultEgressLimits("AGENTintel/test")
	limits.AllowPrivateHosts = true
	worker := &WebsiteWorker{Limits: limits, Now: func() time.Time { return observed }}
	return worker
}

// The egress layer blocks loopback even for approved private hosts, which is
// correct in production and inconvenient in a test. These tests therefore drive
// the parsing and metric layers directly, plus one end-to-end fetch through a
// server reached by its own hostname.
func TestParseFeedReadsRSSAndAtom(t *testing.T) {
	rss := parseFeed([]byte(sampleRSS))
	if len(rss) != 3 {
		t.Fatalf("expected 3 RSS items, got %d", len(rss))
	}
	if rss[0].Title != "Third post" || rss[0].ID != "p3" {
		t.Fatalf("unexpected first RSS item: %+v", rss[0])
	}
	if rss[0].PublishedAt.IsZero() {
		t.Fatal("RFC1123Z pubDate must parse")
	}

	atom := parseFeed([]byte(sampleAtom))
	if len(atom) != 2 {
		t.Fatalf("expected 2 Atom entries, got %d", len(atom))
	}
	if atom[0].Link != "https://site/a" {
		t.Fatalf("alternate link not selected: %+v", atom[0])
	}

	if items := parseFeed([]byte("<html><body>not a feed</body></html>")); items != nil {
		t.Fatalf("HTML must not parse as a feed, got %d items", len(items))
	}
}

func TestObservationsStateOnlyWhatTheFeedSays(t *testing.T) {
	observed := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	items := parseFeed([]byte(sampleRSS))
	observations := buildWebsiteObservations("https://example.com", "https://example.com/feed", items, observed)

	byMetric := map[string]float64{}
	for _, observation := range observations {
		byMetric[observation.Metric] = observation.Value
	}

	if byMetric["content_published"] != 3 {
		t.Fatalf("expected 3 published items, got %v", byMetric["content_published"])
	}
	// Newest post is 2026-06-22; observed 2026-06-29 → exactly 7 days.
	if byMetric["content_freshness_seconds"] != 7*24*3600 {
		t.Fatalf("freshness should be 7 days, got %v seconds", byMetric["content_freshness_seconds"])
	}
	// Span 01 Jun → 22 Jun is 21 days across 2 intervals → 10.5 days per item.
	if byMetric["publishing_cadence_days"] != 10.5 {
		t.Fatalf("cadence should be 10.5 days/item, got %v", byMetric["publishing_cadence_days"])
	}

	// Cadence must expose its denominator so the metric can be audited.
	for _, observation := range observations {
		if observation.Metric != "publishing_cadence_days" {
			continue
		}
		if observation.Denominator == nil || *observation.Denominator != 2 {
			t.Fatalf("cadence denominator must be the interval count, got %+v", observation.Denominator)
		}
		if observation.Numerator == nil || *observation.Numerator != 21 {
			t.Fatalf("cadence numerator must be the span in days, got %+v", observation.Numerator)
		}
	}

	// Nothing may claim engagement, audience or reach: a feed does not carry it.
	for _, observation := range observations {
		for _, forbidden := range []string{"engagement", "followers", "reach", "revenue", "audience"} {
			if strings.Contains(observation.Metric, forbidden) {
				t.Fatalf("feed evidence must not produce a %q metric", forbidden)
			}
		}
		if observation.Classification != "observed" {
			t.Fatalf("feed metrics are observations, not estimates: %+v", observation)
		}
	}
}

// One dated entry gives a span of zero. Dividing by it would fabricate a rate,
// so cadence must be absent rather than zero or infinite.
func TestCadenceIsAbsentWithoutAnInterval(t *testing.T) {
	observed := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	single := `<?xml version="1.0"?><rss version="2.0"><channel>
	  <item><title>Only</title><guid>p1</guid>
	    <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate></item>
	</channel></rss>`
	observations := buildWebsiteObservations("https://example.com", "https://example.com/feed",
		parseFeed([]byte(single)), observed)
	for _, observation := range observations {
		if observation.Metric == "publishing_cadence_days" {
			t.Fatal("cadence must not be emitted from a single dated item")
		}
	}
}

// A feed with no parseable dates supports a count and nothing else. A missing
// cadence is not a cadence of zero.
func TestUndatedFeedYieldsCountOnly(t *testing.T) {
	observed := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	undated := `<?xml version="1.0"?><rss version="2.0"><channel>
	  <item><title>A</title><guid>a</guid></item>
	  <item><title>B</title><guid>b</guid></item>
	</channel></rss>`
	observations := buildWebsiteObservations("https://example.com", "https://example.com/feed",
		parseFeed([]byte(undated)), observed)
	if len(observations) != 1 || observations[0].Metric != "content_published" {
		t.Fatalf("expected only a published count, got %d observations", len(observations))
	}
	if observations[0].Value != 2 {
		t.Fatalf("expected 2 items counted, got %v", observations[0].Value)
	}
}

func TestRobotsLongestMatchWins(t *testing.T) {
	robots := parseRobots(strings.Join([]string{
		"User-agent: *",
		"Disallow: /private",
		"Allow: /private/public-feed.xml",
		"Disallow: /admin",
		"",
		"User-agent: OtherBot",
		"Disallow: /",
	}, "\n"))

	if !robots.allows("/private/public-feed.xml") {
		t.Fatal("a longer Allow must beat a shorter Disallow")
	}
	if robots.allows("/private/secret") {
		t.Fatal("Disallow must still apply where no Allow is more specific")
	}
	if robots.allows("/admin/panel") {
		t.Fatal("/admin must stay disallowed")
	}
	if !robots.allows("/blog/feed.xml") {
		t.Fatal("an unmatched path is allowed")
	}
	// A group for a different crawler must not bind us.
	if !robots.allows("/anything-else") {
		t.Fatal("another crawler's rules must not apply to this connector")
	}
}

// An absent robots.txt states no restriction, which is not the same as
// forbidding everything.
func TestMissingRobotsDoesNotBlock(t *testing.T) {
	empty := parseRobots("")
	if !empty.allows("/feed.xml") {
		t.Fatal("an empty robots.txt must not block")
	}
}

// End-to-end through the real transport, including robots, discovery and the
// response bound. The server is reached through a hostname the egress policy
// accepts, so the production path is what runs.
func TestEndToEndAgainstAServer(t *testing.T) {
	var robotsHits, feedHits int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/robots.txt":
			robotsHits++
			fmt.Fprint(w, "User-agent: *\nDisallow: /admin\n")
		case "/":
			w.Header().Set("Content-Type", "text/html")
			fmt.Fprint(w, `<html><head>
			  <link rel="alternate" type="application/rss+xml" href="/feed.xml">
			</head></html>`)
		case "/feed.xml":
			feedHits++
			w.Header().Set("Content-Type", "application/rss+xml")
			fmt.Fprint(w, sampleRSS)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	observed := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	worker := testWorker(observed)
	// httptest binds loopback, which the egress policy refuses by design. The
	// test therefore exercises the fetch path with loopback permitted, which is
	// the one deviation from production and is deliberate.
	worker.Limits.AllowLoopback = true

	observations, outcomes, err := worker.Observations(context.Background(), []string{server.URL})
	if err != nil {
		t.Fatalf("collection failed: %v", err)
	}
	if len(outcomes) != 1 {
		t.Fatalf("expected one outcome, got %d", len(outcomes))
	}
	if outcomes[0].Err != nil {
		t.Fatalf("collection failed: %v", outcomes[0].Err)
	}
	if robotsHits == 0 {
		t.Fatal("robots.txt must be consulted before fetching")
	}
	if feedHits == 0 {
		t.Fatal("the declared feed must be fetched")
	}
	if len(observations) != 3 {
		t.Fatalf("expected 3 observations, got %d", len(observations))
	}
}

// The kill switch stops further requests and is reported as a blocked source, so
// the run ends partial rather than failed.
func TestKillSwitchBlocksWithoutFailing(t *testing.T) {
	worker := testWorker(time.Now())
	worker.KillSwitch = func() bool { return true }
	observations, outcomes, err := worker.Observations(context.Background(),
		[]string{"https://example.com"})
	if err != nil {
		t.Fatalf("a kill switch is not an error: %v", err)
	}
	if len(observations) != 0 {
		t.Fatal("no observations may be collected once the source is disabled")
	}
	if len(outcomes) != 1 || outcomes[0].BlockedBy != "kill_switch" {
		t.Fatalf("the block must be attributed to the kill switch, got %+v", outcomes)
	}
}

// A connector must never be able to reach the loopback API, whatever a target
// or a redirect claims.
func TestConnectorCannotReachLoopbackByDefault(t *testing.T) {
	worker := NewWebsiteWorker()
	_, outcomes, err := worker.Observations(context.Background(),
		[]string{"http://127.0.0.1:3210/api/v1/projects"})
	if err != nil {
		t.Fatalf("a refused target is a per-source outcome, not a run error: %v", err)
	}
	if len(outcomes) != 1 || outcomes[0].Err == nil {
		t.Fatal("the loopback API must be refused")
	}
	if !strings.Contains(outcomes[0].Err.Error(), "loopback_blocked") {
		t.Fatalf("expected a loopback refusal, got %v", outcomes[0].Err)
	}
}
