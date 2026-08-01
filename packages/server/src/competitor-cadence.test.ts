import { describe, expect, it } from "vitest";
import {
  competitorDashboardItems,
  contentGapTerms,
} from "./research-dashboard.js";

// Publishing cadence is the one competitor signal a content team acts on
// weekly: a rival shipping every 3 days is a different problem from one
// shipping every 40. The projection joins it onto the crawl by hostname, and
// the failure mode to guard is the usual one — a site with no feed must read as
// unmeasured, never as a zero that implies they stopped publishing.

const artifact = (cadence: unknown) => ({
  generatedAt: "2026-07-30T12:00:00.000Z",
  sites: [
    { url: "https://ours.example/", pagesCrawled: 10, issuesByPriority: {} },
    {
      url: "https://rival.example/",
      pagesCrawled: 20,
      issuesByPriority: { High: 1 },
    },
    {
      url: "https://quiet.example/",
      pagesCrawled: 5,
      issuesByPriority: {},
    },
  ],
  publishingCadence: cadence,
});

const measured = {
  target: "https://rival.example/",
  cadence: {
    feedUrl: "https://rival.example/feed",
    itemsInFeed: 20,
    datedItems: 20,
    freshnessSeconds: 172_800,
    cadenceDays: 3.5,
    spanDays: 66.5,
    intervals: 19,
    newestPublishedAt: "2026-07-28T00:00:00.000Z",
    oldestPublishedAt: "2026-05-22T12:00:00.000Z",
  },
  unavailable: null,
};

describe("competitor publishing cadence", () => {
  it("joins measured cadence onto the matching competitor", () => {
    const rows = competitorDashboardItems(artifact([measured]));
    const rival = rows.find((row) => row.domain === "rival.example")!;
    expect(rival.cadenceDays).toBe(3.5);
    expect(rival.freshnessSeconds).toBe(172_800);
  });

  // A competitor without a feed has an unknown cadence, not a cadence of zero.
  it("leaves a site with no feed unmeasured rather than at zero", () => {
    const rows = competitorDashboardItems(
      artifact([
        measured,
        {
          target: "https://quiet.example/",
          cadence: null,
          unavailable: "no-feed-discovered",
        },
      ]),
    );
    const quiet = rows.find((row) => row.domain === "quiet.example")!;
    expect(quiet.cadenceDays).toBeNull();
    expect(quiet.freshnessSeconds).toBeNull();
  });

  it("degrades to unmeasured when the run predates cadence collection", () => {
    const rows = competitorDashboardItems(artifact(undefined));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.cadenceDays).toBeNull();
  });

  // The crawl records where a target settled after redirects, so matching on
  // the raw URL string would silently drop cadence for any site that redirects.
  it("matches on hostname, not on the exact target string", () => {
    const rows = competitorDashboardItems(
      artifact([
        {
          ...measured,
          target: "https://rival.example/blog?utm_source=x",
        },
      ]),
    );
    expect(
      rows.find((row) => row.domain === "rival.example")!.cadenceDays,
    ).toBe(3.5);
  });

  it("ignores a cadence entry whose target is not a URL", () => {
    const rows = competitorDashboardItems(
      artifact([{ ...measured, target: "not a url" }]),
    );
    expect(rows.every((row) => row.cadenceDays === null)).toBe(true);
  });
});

// Content gap is the other half of the intel picture: cadence says how often a
// rival ships, the gap says what they ship about. Both are derived from the
// pages themselves, so neither needs a keyword provider.

const gapArtifact = (contentGap: unknown) => ({
  generatedAt: "2026-07-30T12:00:00.000Z",
  sites: [
    { url: "https://ours.example/", pagesCrawled: 10, issuesByPriority: {} },
    { url: "https://rival.example/", pagesCrawled: 20, issuesByPriority: {} },
  ],
  contentGap,
});

const report = {
  targetUrl: "https://ours.example/",
  referenceUrls: ["https://rival.example/"],
  missing: [
    { term: "onboarding", refFreq: 2, refDensity: 0.01, targetDensity: 0 },
    { term: "pricing", refFreq: 1, refDensity: 0.008, targetDensity: 0.001 },
  ],
  perReference: [{ url: "https://rival.example/", matchedTermCount: 7 }],
  errors: [],
};

describe("content gap projection", () => {
  it("attaches per-competitor gap coverage by hostname", () => {
    const rows = competitorDashboardItems(gapArtifact(report));
    expect(
      rows.find((row) => row.domain === "rival.example")!.contentGaps,
    ).toBe(7);
  });

  // "Covers none of our gap terms" and "was never analysed" are opposite
  // findings, so an unanalysed competitor must not read as zero.
  it("leaves an unanalysed competitor unavailable rather than zero", () => {
    const rows = competitorDashboardItems(
      gapArtifact({ ...report, perReference: [] }),
    );
    expect(
      rows.find((row) => row.domain === "rival.example")!.contentGaps,
    ).toBeNull();
  });

  it("returns the missing terms with the count of sites covering each", () => {
    const terms = contentGapTerms(gapArtifact(report));
    expect(terms).toHaveLength(2);
    expect(terms[0]).toMatchObject({
      term: "onboarding",
      referencesCovering: 2,
    });
  });

  it("returns no terms when the run predates content-gap collection", () => {
    expect(contentGapTerms(gapArtifact(undefined))).toEqual([]);
    expect(contentGapTerms({})).toEqual([]);
  });

  it("drops a malformed term rather than rendering a blank row", () => {
    const terms = contentGapTerms(
      gapArtifact({
        ...report,
        missing: [{ term: "", refFreq: 2 }, { refFreq: 1 }, report.missing[0]],
      }),
    );
    expect(terms).toHaveLength(1);
    expect(terms[0]!.term).toBe("onboarding");
  });
});

// Two sites on the same hostname but different ports are different sites.
// Keying on hostname alone silently handed the second one's cadence to the
// first, which is how a local or multi-tenant setup gets a confidently wrong
// number rather than an honest blank.
describe("same hostname, different ports", () => {
  const artifactOnPorts = {
    generatedAt: "2026-07-30T12:00:00.000Z",
    sites: [
      { url: "http://127.0.0.1:4501/", pagesCrawled: 4, issuesByPriority: {} },
      { url: "http://127.0.0.1:4502/", pagesCrawled: 6, issuesByPriority: {} },
      { url: "http://127.0.0.1:4503/", pagesCrawled: 6, issuesByPriority: {} },
    ],
    publishingCadence: [
      { target: "http://127.0.0.1:4501/", cadence: { cadenceDays: 30 } },
      { target: "http://127.0.0.1:4502/", cadence: { cadenceDays: 7 } },
    ],
  };

  it("does not give one port's cadence to another", () => {
    const rows = competitorDashboardItems(artifactOnPorts);
    expect(rows).toHaveLength(2);
    // 4502 has its own measurement.
    expect(rows[0]!.cadenceDays).toBe(7);
    // 4503 was never measured, so it stays blank rather than inheriting.
    expect(rows[1]!.cadenceDays).toBeNull();
  });
});

// A raw health number is not actionable; the movement is. The baseline is the
// previous comparison for the same site, and the interesting failure is a rival
// that was not in that run — its change must read as unavailable, never as 0,
// which would claim we measured no movement.
describe("competitor health trend", () => {
  const comparison = (health: Record<string, number>) => ({
    generatedAt: "2026-07-30T12:00:00.000Z",
    sites: [
      { url: "https://ours.example/", pagesCrawled: 10, issuesByPriority: {} },
      ...Object.entries(health).map(([host, high]) => ({
        url: `https://${host}/`,
        pagesCrawled: 10,
        issuesByPriority: { High: high },
      })),
    ],
  });

  it("reports the change against the previous comparison", () => {
    // More High issues means lower health, so the delta is negative.
    const rows = competitorDashboardItems(
      comparison({ "rival.example": 8 }),
      comparison({ "rival.example": 2 }),
    );
    const rival = rows.find((row) => row.domain === "rival.example")!;
    expect(typeof rival.technicalHealth).toBe("number");
    expect(rival.technicalHealthChange).toBeLessThan(0);
  });

  it("reports no change when health held steady", () => {
    const rows = competitorDashboardItems(
      comparison({ "rival.example": 4 }),
      comparison({ "rival.example": 4 }),
    );
    expect(rows[0]!.technicalHealthChange).toBe(0);
  });

  it("leaves a first comparison without an invented trend", () => {
    const rows = competitorDashboardItems(comparison({ "rival.example": 4 }));
    expect(rows[0]!.technicalHealthChange).toBeNull();
  });

  it("leaves a newly added rival unavailable rather than at zero", () => {
    const rows = competitorDashboardItems(
      comparison({ "rival.example": 4, "newcomer.example": 4 }),
      comparison({ "rival.example": 4 }),
    );
    const newcomer = rows.find((row) => row.domain === "newcomer.example")!;
    expect(newcomer.technicalHealthChange).toBeNull();
    expect(
      rows.find((row) => row.domain === "rival.example")!.technicalHealthChange,
    ).toBe(0);
  });

  // hostKey is the internal join key. The response schema forbids unknown
  // properties, so leaking it would make every competitor request fail.
  it("does not leak the internal join key into the response", () => {
    const rows = competitorDashboardItems(comparison({ "rival.example": 1 }));
    for (const row of rows) expect(row).not.toHaveProperty("hostKey");
  });
});
