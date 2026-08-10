import { describe, expect, it } from "vitest";
import { syncGoogleAdsAccount } from "./sync.js";

/**
 * The whole sync path, against a stubbed transport.
 *
 * The piece worth testing here is the destination join: several ads usually
 * share one landing page, and the alignment rules want one entry per page
 * carrying every ad group that feeds it. Getting that wrong produces forty
 * findings about one broken page, which is the sort of output that makes an
 * operator stop reading.
 */

const ACCOUNT = {
  id: "acct-1",
  externalId: "1234567890",
  displayName: "Northstar EU",
  currency: "EUR",
  dailySpendCap: null,
};

/** Answers each GAQL query with the rows its FROM clause implies. */
function stubTransport(
  rowsFor: Partial<Record<string, unknown[]>>,
): typeof fetch {
  return (async (_url: URL | RequestInfo, options?: RequestInit) => {
    const query = String(JSON.parse(String(options?.body ?? "{}")).query ?? "");
    const resource =
      /FROM\s+(\w+)/.exec(query)?.[1] ??
      (query.includes("FROM customer") ? "customer" : "unknown");
    return new Response(
      JSON.stringify([{ results: rowsFor[resource] ?? [] }]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

function run(rowsFor: Partial<Record<string, unknown[]>>) {
  return syncGoogleAdsAccount({
    account: ACCOUNT,
    accessToken: "token",
    developerToken: "developer-token-value",
    since: "2026-07-01",
    until: "2026-07-31",
    levels: ["campaign", "adgroup"],
    providerFetch: stubTransport(rowsFor),
    now: () => new Date("2026-08-01T00:00:00.000Z"),
  });
}

const AD = (overrides: Record<string, unknown> = {}) => ({
  adGroupAd: {
    ad: { id: "a1", finalUrls: ["https://example.com/boots"] },
    status: "ENABLED",
    policySummary: { approvalStatus: "APPROVED", policyTopicEntries: [] },
  },
  adGroup: { id: "g1", name: "Waterproof boots" },
  campaign: { id: "c1" },
  ...overrides,
});

describe("destination join", () => {
  it("groups ads that share a landing page into one destination", async () => {
    const result = await run({
      ad_group_ad: [
        AD(),
        AD({
          adGroupAd: {
            ad: { id: "a2", finalUrls: ["https://example.com/boots"] },
            status: "ENABLED",
            policySummary: {
              approvalStatus: "APPROVED",
              policyTopicEntries: [],
            },
          },
        }),
      ],
    });

    // One page, one entry — not one per ad.
    expect(result.destinations).toHaveLength(1);
    expect(result.destinations[0]?.url).toBe("https://example.com/boots");
    expect(result.destinations[0]?.entities).toHaveLength(1);
    expect(result.destinations[0]?.entities[0]).toMatchObject({
      kind: "adgroup",
      id: "g1",
    });
  });

  it("collects every ad group feeding one page", async () => {
    const result = await run({
      ad_group_ad: [
        AD(),
        AD({
          adGroupAd: {
            ad: { id: "a2", finalUrls: ["https://example.com/boots"] },
            status: "ENABLED",
            policySummary: {
              approvalStatus: "APPROVED",
              policyTopicEntries: [],
            },
          },
          adGroup: { id: "g2", name: "Hiking boots" },
        }),
      ],
    });
    expect(result.destinations[0]?.entities.map((e) => e.id).sort()).toEqual([
      "g1",
      "g2",
    ]);
  });

  it("carries the ad group's keywords so relevance can be judged", async () => {
    const result = await run({
      ad_group_ad: [AD()],
      keyword_view: [
        {
          adGroupCriterion: {
            criterionId: "k1",
            keyword: { text: "waterproof boots", matchType: "PHRASE" },
            status: "ENABLED",
          },
          adGroup: { id: "g1", name: "Waterproof boots" },
          campaign: { id: "c1", name: "Footwear" },
          metrics: {},
        },
        {
          adGroupCriterion: {
            criterionId: "k2",
            keyword: { text: "paused term", matchType: "BROAD" },
            status: "PAUSED",
          },
          adGroup: { id: "g1", name: "Waterproof boots" },
          campaign: { id: "c1", name: "Footwear" },
          metrics: {},
        },
      ],
    });
    // A paused keyword is not being bought, so judging a page against it
    // would report a problem the operator already fixed.
    expect(result.destinations[0]?.keywords).toEqual(["waterproof boots"]);
  });

  it("attributes ad-group spend to the page it buys", async () => {
    const result = await run({
      ad_group_ad: [AD()],
      ad_group: [
        {
          adGroup: { id: "g1", name: "Waterproof boots" },
          segments: { date: "2026-07-01", adNetworkType: "SEARCH" },
          metrics: { costMicros: "120000000", clicks: "40" },
        },
      ],
    });
    expect(result.destinations[0]).toMatchObject({
      spend: 120,
      clicks: 40,
      currency: "EUR",
    });
  });

  it("leaves spend null when ad-group metrics were not read", async () => {
    // Apportioning a campaign's spend across the ad groups inside it would be
    // a guess presented as a measurement.
    const result = await syncGoogleAdsAccount({
      account: ACCOUNT,
      accessToken: "token",
      developerToken: "developer-token-value",
      since: "2026-07-01",
      until: "2026-07-31",
      levels: ["campaign"],
      providerFetch: stubTransport({ ad_group_ad: [AD()] }),
      now: () => new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(result.destinations[0]?.spend).toBeNull();
    expect(result.destinations[0]?.clicks).toBeNull();
  });

  it("ignores paused ads and unparseable URLs", async () => {
    const result = await run({
      ad_group_ad: [
        AD({
          adGroupAd: {
            ad: { id: "a3", finalUrls: ["https://example.com/live"] },
            status: "PAUSED",
            policySummary: {
              approvalStatus: "APPROVED",
              policyTopicEntries: [],
            },
          },
        }),
        AD({
          adGroupAd: {
            ad: { id: "a4", finalUrls: ["not a url"] },
            status: "ENABLED",
            policySummary: {
              approvalStatus: "APPROVED",
              policyTopicEntries: [],
            },
          },
        }),
      ],
    });
    expect(result.destinations).toEqual([]);
  });

  it("reports no destinations when nothing could be read at all", async () => {
    const failing = (async () =>
      new Response("{}", { status: 503 })) as typeof fetch;
    const result = await syncGoogleAdsAccount({
      account: ACCOUNT,
      accessToken: "token",
      developerToken: "developer-token-value",
      since: "2026-07-01",
      until: "2026-07-31",
      providerFetch: failing,
      now: () => new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(result.state).toBe("failed");
    expect(result.destinations).toEqual([]);
    // And the window is marked unreadable rather than left looking like zero
    // spend, which is the discipline the whole connector is built on.
    expect(result.metrics.every((metric) => metric.state === "failed")).toBe(
      true,
    );
  });
});
