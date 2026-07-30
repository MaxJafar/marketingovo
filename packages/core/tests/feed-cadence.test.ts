import { describe, expect, it } from "vitest";
import { parseFeed, summarizeCadence } from "../src/integrations/feed.js";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Northstar Labs</title>
  <item><title>Third post</title><link>https://site/3</link><guid>p3</guid>
    <pubDate>Mon, 22 Jun 2026 12:00:00 +0000</pubDate></item>
  <item><title>Second post</title><link>https://site/2</link><guid>p2</guid>
    <pubDate>Mon, 08 Jun 2026 12:00:00 +0000</pubDate></item>
  <item><title>First post</title><link>https://site/1</link><guid>p1</guid>
    <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Alpha</title><id>urn:a</id>
    <link href="https://site/a" rel="alternate"/>
    <published>2026-06-10T12:00:00Z</published></entry>
  <entry><title>Beta</title><id>urn:b</id>
    <link href="https://site/b" rel="alternate"/>
    <published>2026-06-20T12:00:00Z</published></entry>
</feed>`;

const NOW = new Date("2026-06-29T12:00:00Z");

describe("feed parsing", () => {
  it("reads RSS items with guid, link and date", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(3);
    expect(items[0]?.id).toBe("p3");
    expect(items[0]?.title).toBe("Third post");
    expect(items[0]?.publishedAt).not.toBeNull();
  });

  it("reads Atom entries and takes the href from the link attribute", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(2);
    expect(items[0]?.link).toBe("https://site/a");
    expect(items[0]?.id).toBe("urn:a");
  });

  it("unwraps CDATA titles rather than leaking the wrapper", () => {
    const items = parseFeed(
      `<rss><channel><item><title><![CDATA[Q3 & beyond]]></title>
       <guid>x</guid></item></channel></rss>`,
    );
    expect(items[0]?.title).toBe("Q3 & beyond");
  });

  it("returns nothing for a page that is not a feed", () => {
    expect(parseFeed("<html><body>not a feed</body></html>")).toHaveLength(0);
  });

  // Feeds in the wild are frequently malformed. Reading the entries that do
  // parse is a better failure than rejecting the document.
  it("reads the valid entries out of a partially broken feed", () => {
    const items = parseFeed(
      `<rss><channel>
         <item><title>Good</title><guid>g1</guid>
           <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate></item>
         <item><title>Also good</title><guid>g2</guid><unclosed>
           <pubDate>Mon, 08 Jun 2026 12:00:00 +0000</pubDate></item>
       </channel></rss>`,
    );
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

describe("cadence states only what the feed says", () => {
  it("measures freshness and cadence with an auditable denominator", () => {
    const cadence = summarizeCadence("https://x/feed", parseFeed(RSS), NOW);

    expect(cadence.itemsInFeed).toBe(3);
    expect(cadence.datedItems).toBe(3);
    // Newest is 22 Jun; observed 29 Jun → exactly 7 days.
    expect(cadence.freshnessSeconds).toBe(7 * 24 * 3600);
    // 01 Jun → 22 Jun is 21 days across 2 intervals → 10.5 days per post.
    expect(cadence.cadenceDays).toBe(10.5);
    expect(cadence.spanDays).toBe(21);
    expect(cadence.intervals).toBe(2);
  });

  // One dated entry gives a span of zero. Dividing by it would fabricate a
  // rate, so the cadence is absent rather than zero or infinite.
  it("reports no cadence when there is no interval to divide", () => {
    const single = parseFeed(
      `<rss><channel><item><title>Only</title><guid>p1</guid>
        <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate></item>
      </channel></rss>`,
    );
    const cadence = summarizeCadence("https://x/feed", single, NOW);
    expect(cadence.datedItems).toBe(1);
    expect(cadence.cadenceDays).toBeNull();
    expect(cadence.intervals).toBeNull();
    // Freshness is still measurable from a single dated post.
    expect(cadence.freshnessSeconds).toBeGreaterThan(0);
  });

  // A missing cadence is not a cadence of zero.
  it("reports a count and nothing else for an undated feed", () => {
    const undated = parseFeed(
      `<rss><channel>
        <item><title>A</title><guid>a</guid></item>
        <item><title>B</title><guid>b</guid></item>
      </channel></rss>`,
    );
    const cadence = summarizeCadence("https://x/feed", undated, NOW);
    expect(cadence.itemsInFeed).toBe(2);
    expect(cadence.datedItems).toBe(0);
    expect(cadence.cadenceDays).toBeNull();
    expect(cadence.freshnessSeconds).toBeNull();
    expect(cadence.newestPublishedAt).toBeNull();
  });

  it("never reports a negative freshness for a future-dated post", () => {
    const future = parseFeed(
      `<rss><channel><item><title>Scheduled</title><guid>f</guid>
        <pubDate>Wed, 01 Jul 2026 12:00:00 +0000</pubDate></item>
      </channel></rss>`,
    );
    expect(
      summarizeCadence("https://x/feed", future, NOW).freshnessSeconds,
    ).toBe(0);
  });

  // The whole point of the module: a feed carries publication facts and
  // nothing about how anyone responded to them.
  it("exposes no engagement, audience or reach field", () => {
    const cadence = summarizeCadence("https://x/feed", parseFeed(RSS), NOW);
    for (const key of Object.keys(cadence)) {
      expect(key).not.toMatch(/engagement|audience|reach|revenue|follower/i);
    }
  });
});
