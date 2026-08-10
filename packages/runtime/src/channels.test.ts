import { describe, expect, it } from "vitest";
import type { ChannelMetric } from "@marketingovo/contracts/channels";
import {
  assertWithinSpendCap,
  ChannelError,
  daysBetween,
  publishPayloadHash,
  summarizeChannelMetrics,
} from "./channels.js";

function day(index: number): string {
  return new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10);
}

function metric(
  overrides: Partial<ChannelMetric> & Pick<ChannelMetric, "metricKey">,
): ChannelMetric {
  return {
    channelAccountId: "cab-1",
    entityKind: "account",
    entityId: "act_1",
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

function available(
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

const pick = (
  summaries: ReturnType<typeof summarizeChannelMetrics>,
  metricKey: string,
  platform = "all",
) =>
  summaries.find(
    (summary) =>
      summary.metricKey === metricKey && summary.platform === platform,
  );

describe("channel metric summaries", () => {
  it("sums additive metrics over the window", () => {
    const summaries = summarizeChannelMetrics(
      available("spend", [10, 20, 30], { currency: "EUR" }),
      { requestedDays: 3 },
    );
    expect(pick(summaries, "spend")).toMatchObject({
      value: 60,
      state: "available",
      currency: "EUR",
      observedDays: 3,
    });
  });

  it("recomputes a rate from its components instead of averaging days", () => {
    const summaries = summarizeChannelMetrics(
      [
        // A day with almost no traffic and a day carrying the whole window.
        ...available("clicks", [1, 999]),
        ...available("impressions", [10, 99_990]),
      ],
      { requestedDays: 2 },
    );
    // Averaging the daily rates would give 10.5%; the real rate is 1%.
    // Averaging treats a ten-impression day as equal to a hundred-thousand
    // impression one, which is how a paid dashboard reports a fiction.
    expect(pick(summaries, "ctr")?.value).toBeCloseTo(1, 5);
  });

  it("declines a cost when its denominator is zero rather than dividing", () => {
    const summaries = summarizeChannelMetrics(
      [...available("spend", [50]), ...available("clicks", [0])],
      { requestedDays: 1 },
    );
    const cpc = pick(summaries, "cpc");
    expect(cpc?.value).toBeNull();
    expect(cpc?.state).toBe("unavailable");
    expect(cpc?.note).toMatch(/not zero/i);
  });

  it("refuses to total reach and frequency, and says why", () => {
    const summaries = summarizeChannelMetrics(
      [...available("reach", [100, 100]), ...available("frequency", [2, 2])],
      { requestedDays: 2 },
    );

    const reach = pick(summaries, "reach");
    expect(reach?.value).toBeNull();
    // 200 would count the same person on both days. The refusal is the
    // feature: a reported reach of 200 is a number an operator would act on.
    expect(reach?.note).toMatch(/unique people/i);
    expect(pick(summaries, "frequency")?.value).toBeNull();
  });

  it("marks a short window partial rather than complete", () => {
    const summaries = summarizeChannelMetrics(available("spend", [10, 20]), {
      requestedDays: 7,
    });
    expect(pick(summaries, "spend")).toMatchObject({
      value: 30,
      state: "partial",
      observedDays: 2,
      requestedDays: 7,
    });
  });

  it("distinguishes a failed read from a genuine absence of data", () => {
    const failed = summarizeChannelMetrics(
      [
        metric({ metricKey: "spend", date: day(0), state: "failed" }),
        metric({ metricKey: "spend", date: day(1), state: "failed" }),
      ],
      { requestedDays: 2 },
    );
    expect(pick(failed, "spend")).toMatchObject({
      value: null,
      state: "failed",
    });

    const unavailable = summarizeChannelMetrics(
      [metric({ metricKey: "spend", date: day(0) })],
      { requestedDays: 1 },
    );
    expect(pick(unavailable, "spend")?.state).toBe("unavailable");
  });

  it("declines a currency when the rows disagreed", () => {
    const summaries = summarizeChannelMetrics(
      [
        ...available("spend", [10], { currency: "EUR" }),
        ...available("spend", [20], { currency: "USD", date: day(1) }).map(
          (entry) => ({ ...entry, date: day(1) }),
        ),
      ],
      { requestedDays: 2 },
    );
    const spend = pick(summaries, "spend");
    // 30 of nothing. Without a recorded rate the total is not money.
    expect(spend?.currency).toBeNull();
    expect(spend?.note).toMatch(/not comparable/i);
  });

  it("keeps platforms separate so Facebook and Instagram stay comparable", () => {
    const summaries = summarizeChannelMetrics(
      [
        ...available("spend", [100], {
          entityKind: "campaign",
          platform: "facebook",
          currency: "EUR",
        }),
        ...available("spend", [40], {
          entityKind: "campaign",
          platform: "instagram",
          currency: "EUR",
        }),
      ],
      { requestedDays: 1, entityKind: "campaign" },
    );

    expect(pick(summaries, "spend", "facebook")?.value).toBe(100);
    expect(pick(summaries, "spend", "instagram")?.value).toBe(40);
  });
});

describe("publish payload hashing", () => {
  it("ignores key order and whitespace", () => {
    // An approval that went void every time the payload was re-serialized
    // would train an operator to click through the warning.
    expect(publishPayloadHash({ name: "Summer", budget: { daily: 50 } })).toBe(
      publishPayloadHash({ budget: { daily: 50 }, name: "Summer" }),
    );
  });

  it("changes when any value changes", () => {
    expect(publishPayloadHash({ daily: 50 })).not.toBe(
      publishPayloadHash({ daily: 500 }),
    );
  });
});

describe("spend caps", () => {
  const cabinet = {
    displayName: "Northstar — EU",
    currency: "EUR",
    dailySpendCap: 100,
    totalSpendCap: 1_000,
  };

  it("allows a budget inside the locally authored bound", () => {
    expect(() =>
      assertWithinSpendCap({
        cabinet,
        dailyBudget: 100,
        lifetimeBudget: 900,
        currency: "EUR",
      }),
    ).not.toThrow();
  });

  it("refuses rather than warns when a budget exceeds the cap", () => {
    expect(() =>
      assertWithinSpendCap({
        cabinet,
        dailyBudget: 101,
        lifetimeBudget: null,
        currency: "EUR",
      }),
    ).toThrow(ChannelError);
  });

  it("refuses to compare across currencies without a recorded rate", () => {
    // 90 USD against a 100 EUR cap is not a comparison, it is a guess that
    // happens to pass.
    expect(() =>
      assertWithinSpendCap({
        cabinet,
        dailyBudget: 90,
        lifetimeBudget: null,
        currency: "USD",
      }),
    ).toThrow(/recorded rate/i);
  });

  it("imposes nothing when no cap was set", () => {
    expect(() =>
      assertWithinSpendCap({
        cabinet: { ...cabinet, dailySpendCap: null, totalSpendCap: null },
        dailyBudget: 5_000,
        lifetimeBudget: 50_000,
        currency: "EUR",
      }),
    ).not.toThrow();
  });
});

describe("window arithmetic", () => {
  it("counts days inclusively and rejects an inverted range", () => {
    expect(daysBetween("2026-08-01", "2026-08-07")).toBe(7);
    expect(daysBetween("2026-08-07", "2026-08-01")).toBe(0);
  });
});
