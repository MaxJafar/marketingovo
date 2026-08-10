import { describe, expect, it } from "vitest";
import type { MetaInsightRow } from "./client.js";
import {
  datesInRange,
  markMetaWindowUnavailable,
  normalizeMetaInsights,
  toAdPlatform,
} from "./normalize.js";

const FETCHED_AT = "2026-08-05T00:00:00.000Z";

function row(overrides: Partial<MetaInsightRow> = {}): MetaInsightRow {
  return {
    date: "2026-08-01",
    entityId: "23849",
    entityName: "Summer prospecting",
    publisherPlatform: null,
    impressions: null,
    clicks: null,
    linkClicks: null,
    spend: null,
    reach: null,
    frequency: null,
    ctr: null,
    cpc: null,
    cpm: null,
    conversions: null,
    conversionValue: null,
    videoPlays: null,
    ...overrides,
  };
}

const find = (metrics: ReturnType<typeof normalizeMetaInsights>, key: string) =>
  metrics.find((metric) => metric.metricKey === key);

describe("Meta insight normalization", () => {
  it("never turns a metric Meta did not report into a zero", () => {
    const metrics = normalizeMetaInsights(
      [row({ impressions: 1_200, spend: 48.5 })],
      {
        channelAccountId: "cab-1",
        level: "campaign",
        currency: "EUR",
        fetchedAt: FETCHED_AT,
      },
    );

    // Reported: a number and an available state.
    expect(find(metrics, "impressions")).toMatchObject({
      value: 1_200,
      state: "available",
    });

    // Not reported: null with a reason, which is the whole discipline. A zero
    // here would say this ad set got no clicks when nobody measured whether it
    // did, and every derived cost would inherit the lie.
    const clicks = find(metrics, "clicks");
    expect(clicks?.value).toBeNull();
    expect(clicks?.state).toBe("unavailable");
    expect(clicks?.note).toMatch(/no clicks field/i);
  });

  it("attaches currency only to monetary readings", () => {
    const metrics = normalizeMetaInsights(
      [row({ spend: 10, impressions: 500 })],
      {
        channelAccountId: "cab-1",
        level: "campaign",
        currency: "USD",
        fetchedAt: FETCHED_AT,
      },
    );

    expect(find(metrics, "spend")?.currency).toBe("USD");
    // An impression count in dollars is a category error, and a renderer that
    // sees a currency will print one.
    expect(find(metrics, "impressions")?.currency).toBeNull();
  });

  it("carries a null currency through rather than inventing one", () => {
    const metrics = normalizeMetaInsights([row({ spend: 10 })], {
      channelAccountId: "cab-1",
      level: "account",
      currency: null,
      fetchedAt: FETCHED_AT,
    });
    expect(find(metrics, "spend")?.currency).toBeNull();
  });

  it("marks every row partial when the provider result was truncated", () => {
    const metrics = normalizeMetaInsights([row({ spend: 10 })], {
      channelAccountId: "cab-1",
      level: "campaign",
      currency: "USD",
      fetchedAt: FETCHED_AT,
      truncated: true,
    });
    const spend = find(metrics, "spend");
    // The number is real; the set of rows behind it is not complete, so a
    // total over the window is a lower bound and must say so.
    expect(spend).toMatchObject({ value: 10, state: "partial" });
    expect(spend?.note).toMatch(/lower bound/i);
  });

  it("maps publisher platforms and refuses to fold an unknown one into all", () => {
    expect(toAdPlatform("instagram")).toBe("instagram");
    expect(toAdPlatform("FACEBOOK")).toBe("facebook");
    // `all` is a specific claim — "not broken out". A new Meta surface filed
    // under it would make an unattributed row look attributed.
    expect(toAdPlatform("threads")).toBe("unknown");
    expect(toAdPlatform(null)).toBe("all");
  });

  it("drops a row that cannot be filed against a day or an entity", () => {
    const metrics = normalizeMetaInsights(
      [row({ date: "", spend: 10 }), row({ entityId: "", spend: 10 })],
      {
        channelAccountId: "cab-1",
        level: "campaign",
        currency: "USD",
        fetchedAt: FETCHED_AT,
      },
    );
    // Guessing today's date would attribute yesterday's spend to the wrong
    // period, which is worse than not recording it.
    expect(metrics).toHaveLength(0);
  });

  it("records a failed window instead of leaving stale numbers in place", () => {
    const metrics = markMetaWindowUnavailable({
      channelAccountId: "cab-1",
      dates: ["2026-08-01", "2026-08-02"],
      reason: "Meta rejected the access token.",
      fetchedAt: FETCHED_AT,
      currency: "USD",
    });

    expect(metrics.every((metric) => metric.state === "failed")).toBe(true);
    expect(metrics.every((metric) => metric.value === null)).toBe(true);
    expect(metrics[0]?.note).toBe("Meta rejected the access token.");
  });

  it("enumerates a date range inclusively and rejects an inverted one", () => {
    expect(datesInRange("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
    expect(datesInRange("2026-08-03", "2026-08-01")).toEqual([]);
  });
});
