import { describe, expect, it } from "vitest";
import { auditMetaCabinet, type MetaAuditInput } from "./audit.js";
import type { MetaDeliveryRecord } from "./client.js";
import type { ChannelMetric } from "../channel-vocabulary.js";

const CABINET: MetaAuditInput["cabinet"] = {
  id: "cab-1",
  externalId: "act_123456",
  displayName: "Northstar — EU",
  currency: "EUR",
  dailySpendCap: null,
};

function day(index: number): string {
  return new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10);
}

function metric(
  overrides: Partial<ChannelMetric> & Pick<ChannelMetric, "metricKey">,
): ChannelMetric {
  return {
    channelAccountId: "cab-1",
    entityKind: "account",
    entityId: "act_123456",
    entityName: null,
    platform: "all",
    date: day(0),
    value: null,
    state: "unavailable",
    currency: null,
    source: "meta-ads",
    fetchedAt: "2026-08-05T00:00:00.000Z",
    note: null,
    ...overrides,
  };
}

/** A series of available readings across `days` consecutive days. */
function series(
  metricKey: ChannelMetric["metricKey"],
  values: number[],
  overrides: Partial<ChannelMetric> = {},
): ChannelMetric[] {
  return values.map((value, index) =>
    metric({
      metricKey,
      date: day(index),
      value,
      state: "available",
      ...overrides,
    }),
  );
}

const delivery = (
  overrides: Partial<MetaDeliveryRecord> & Pick<MetaDeliveryRecord, "level">,
): MetaDeliveryRecord => ({
  id: "ad-1",
  name: "Creative A",
  effectiveStatus: "ACTIVE",
  reviewFeedback: null,
  dailyBudget: null,
  lifetimeBudget: null,
  campaignId: null,
  ...overrides,
});

describe("Meta paid-media rules", () => {
  it("reports an ad Meta refused to run, with its review reason", () => {
    const issues = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [],
      delivery: [
        delivery({
          level: "ad",
          effectiveStatus: "DISAPPROVED",
          reviewFeedback: "Personal attributes policy",
        }),
      ],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: "meta-ads.ad-disapproved",
      priority: "High",
    });
    // Insights alone cannot see this: a rejected ad simply stops spending,
    // which reads as a creative that went quiet.
    expect(issues[0]?.fix).toMatch(/Personal attributes policy/);
    expect(issues[0]?.urls[0]).toMatch(/adsmanager\.facebook\.com/);
  });

  it("flags spend with no conversion signal reaching Meta", () => {
    const issues = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("spend", [40, 45, 50]),
        // Present but never reported: the signature of a pixel that is not
        // sending events.
        metric({ metricKey: "conversions", date: day(0) }),
        metric({ metricKey: "conversions", date: day(1) }),
        metric({ metricKey: "conversions", date: day(2) }),
      ],
      delivery: [],
    });

    expect(issues.map((issue) => issue.id)).toContain(
      "meta-ads.no-conversion-signal",
    );
  });

  it("stays quiet when Meta reported a genuine zero conversions", () => {
    const issues = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("spend", [40, 45, 50]),
        ...series("conversions", [0, 0, 0]),
      ],
      delivery: [],
    });

    // A reported zero means the pipe works and the campaign is not converting.
    // That is a performance question, and this tracking rule must not claim it.
    expect(issues.map((issue) => issue.id)).not.toContain(
      "meta-ads.no-conversion-signal",
    );
  });

  it("does not read a provider outage as a tracking gap", () => {
    const issues = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("spend", [40, 45, 50]),
        metric({ metricKey: "conversions", date: day(0), state: "failed" }),
        metric({ metricKey: "conversions", date: day(1), state: "failed" }),
        metric({ metricKey: "conversions", date: day(2), state: "failed" }),
      ],
      delivery: [],
    });

    expect(issues.map((issue) => issue.id)).not.toContain(
      "meta-ads.no-conversion-signal",
    );
  });

  it("requires both high frequency and a fallen CTR before calling fatigue", () => {
    const highFrequencyOnly = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("frequency", [4, 4.2, 4.4, 4.6, 4.8, 5, 5.2], {
          entityKind: "adset",
          entityId: "adset-1",
        }),
        // Steady CTR: a working campaign against a small audience, not fatigue.
        ...series("ctr", [2, 2, 2, 2, 2, 2, 2], {
          entityKind: "adset",
          entityId: "adset-1",
        }),
      ],
      delivery: [],
    });
    expect(highFrequencyOnly.map((issue) => issue.id)).not.toContain(
      "meta-ads.creative-fatigue",
    );

    const both = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("frequency", [4, 4.2, 4.4, 4.6, 4.8, 5, 5.2], {
          entityKind: "adset",
          entityId: "adset-1",
          entityName: "Lookalike 1%",
        }),
        ...series("ctr", [3, 3, 3, 1.5, 1.4, 1.3, 1.2], {
          entityKind: "adset",
          entityId: "adset-1",
        }),
      ],
      delivery: [],
    });
    expect(both.map((issue) => issue.id)).toContain(
      "meta-ads.creative-fatigue",
    );
  });

  it("ignores cost-per-conversion drift without real volume in both halves", () => {
    const thin = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("spend", [10, 10, 10, 40, 40, 40, 40], {
          entityKind: "campaign",
          entityId: "camp-1",
        }),
        // One conversion becoming two has doubled nothing worth reporting.
        ...series("conversions", [1, 1, 1, 1, 1, 1, 1], {
          entityKind: "campaign",
          entityId: "camp-1",
        }),
      ],
      delivery: [],
    });
    expect(thin.map((issue) => issue.id)).not.toContain("meta-ads.cpa-drift");

    const real = auditMetaCabinet({
      cabinet: CABINET,
      metrics: [
        ...series("spend", [100, 100, 100, 400, 400, 400, 400], {
          entityKind: "campaign",
          entityId: "camp-1",
          entityName: "Retargeting",
        }),
        ...series("conversions", [20, 20, 20, 20, 20, 20, 20], {
          entityKind: "campaign",
          entityId: "camp-1",
        }),
      ],
      delivery: [],
    });
    expect(real.map((issue) => issue.id)).toContain("meta-ads.cpa-drift");
  });

  it("reports the workspace's own daily cap being breached at the provider", () => {
    const issues = auditMetaCabinet({
      cabinet: { ...CABINET, dailySpendCap: 100 },
      metrics: series("spend", [80, 90, 260, 95]),
      delivery: [],
    });

    const breach = issues.find(
      (issue) => issue.id === "meta-ads.local-spend-cap-breached",
    );
    expect(breach).toBeDefined();
    expect(breach?.detail).toMatchObject({ worstDaySpend: 260, breachDays: 1 });
  });

  it("stays silent on every rule when it cannot see its inputs", () => {
    // The single most important property: a cabinet nobody could read produces
    // no findings, rather than findings derived from treating null as zero.
    expect(
      auditMetaCabinet({ cabinet: CABINET, metrics: [], delivery: [] }),
    ).toEqual([]);

    expect(
      auditMetaCabinet({
        cabinet: { ...CABINET, dailySpendCap: 100 },
        metrics: [
          metric({ metricKey: "spend", date: day(0), state: "failed" }),
          metric({ metricKey: "spend", date: day(1), state: "failed" }),
        ],
        delivery: [],
      }),
    ).toEqual([]);
  });
});
