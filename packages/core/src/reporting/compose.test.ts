import { describe, expect, it } from "vitest";
import {
  composeReport,
  metric,
  reportState,
  worstState,
  type ComposeReportInput,
} from "./compose.js";
import {
  formatMetricValue,
  renderReportHtml,
  renderReportText,
} from "./render.js";

const PERIOD = {
  start: "2026-07-01",
  end: "2026-07-31",
  comparisonStart: "2026-06-01",
  comparisonEnd: "2026-06-30",
  timezone: "Europe/Berlin",
};

const measured = (value: number) => ({ value, state: "available" as const });
const missing = (note?: string) => ({
  value: null,
  state: "unavailable" as const,
  ...(note ? { note } : {}),
});

function input(
  overrides: Partial<ComposeReportInput> = {},
): ComposeReportInput {
  return {
    projectId: "p1",
    title: "July 2026",
    period: PERIOD,
    paid: {
      notConnected: false,
      cabinets: [
        {
          name: "Northstar — EU",
          provider: "meta-ads",
          currency: "EUR",
          current: {
            spend: measured(4_000),
            impressions: measured(500_000),
            clicks: measured(9_000),
            conversions: measured(180),
          },
          previous: {
            spend: measured(3_000),
            impressions: measured(400_000),
            clicks: measured(8_000),
            conversions: measured(150),
          },
          platforms: [
            {
              platform: "facebook",
              current: { spend: measured(2_500), clicks: measured(6_000) },
            },
            {
              platform: "instagram",
              current: { spend: measured(1_500), clicks: measured(3_000) },
            },
          ],
        },
      ],
    },
    organic: {
      clicks: measured(12_000),
      impressions: measured(300_000),
      position: measured(8.4),
      sessions: measured(14_000),
      keyEvents: measured(320),
      seoHealth: measured(82),
      previous: { clicks: measured(10_000) },
      sources: [
        {
          id: "gsc",
          label: "Search Console",
          state: "available",
          reason: "",
          observedAt: null,
        },
      ],
    },
    social: {
      notConnected: false,
      indeterminate: 0,
      publishedByPlatform: [
        { platform: "telegram", published: 12, failed: 0 },
        { platform: "instagram", published: 8, failed: 1 },
      ],
    },
    email: { templatesBuilt: 3, revisionsSaved: 7, withBlockingFindings: 0 },
    competitors: {
      noResearchInPeriod: false,
      targets: [
        {
          name: "rival.example",
          state: "available",
          reason: "",
          signals: measured(24),
          cadencePerWeek: measured(2.5),
        },
        {
          name: "blocked.example",
          state: "partial",
          reason: "Robots rules kept most of this site out of reach.",
          signals: measured(3),
          cadencePerWeek: missing(
            "No public feed made publishing cadence measurable.",
          ),
        },
      ],
      changes: {
        added: measured(5),
        removed: measured(1),
        changed: measured(2),
      },
      observedAt: "2026-07-20T10:00:00.000Z",
    },
    actions: { opened: 14, resolved: 9, verified: 6, noAuditInPeriod: false },
    brandRevision: 2,
    generatedAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

const section = (report: ReturnType<typeof composeReport>, id: string) =>
  report.sections.find((entry) => entry.id === id)!;

const findMetric = (
  report: ReturnType<typeof composeReport>,
  sectionId: string,
  key: string,
) => section(report, sectionId).metrics.find((entry) => entry.key === key);

describe("what the report refuses to claim", () => {
  it("never totals conversions across channels", () => {
    const report = composeReport(input());
    const refusal = section(report, "paid").refusals.find((entry) =>
      /total conversions/i.test(entry.expected),
    );

    // The refusal that gives the document its character. Meta's attributed
    // conversions and GA4's key events count overlapping things on different
    // models, so a sum is larger than what happened.
    expect(refusal).toBeDefined();
    expect(refusal?.explanation).toMatch(/last-click|attribut/i);

    // And there is no combined figure anywhere to contradict it.
    const combined = report.sections.flatMap((entry) =>
      entry.metrics.filter((candidate) =>
        /^(total|combined|all)[-_ ]?conversions$/i.test(candidate.key),
      ),
    );
    expect(combined).toEqual([]);
  });

  it("declines to total spend across currencies", () => {
    const report = composeReport(
      input({
        paid: {
          notConnected: false,
          cabinets: [
            {
              name: "EU",
              provider: "meta-ads",
              currency: "EUR",
              current: { spend: measured(1_000) },
              platforms: [],
            },
            {
              name: "US",
              provider: "meta-ads",
              currency: "USD",
              current: { spend: measured(1_000) },
              platforms: [],
            },
          ],
        },
      }),
    );

    // 2,000 of nothing. Without a rate recorded at the time, the sum is not
    // money.
    expect(findMetric(report, "paid", "spend")?.value).toBeNull();
    expect(
      section(report, "paid").refusals.some((entry) =>
        /exchange rate/i.test(entry.explanation),
      ),
    ).toBe(true);
  });

  it("refuses a combined reach figure", () => {
    const report = composeReport(input());
    expect(
      section(report, "paid").refusals.some((entry) =>
        /same person more than once/i.test(entry.explanation),
      ),
    ).toBe(true);
  });

  it("says plainly that it has no email engagement data", () => {
    const report = composeReport(input());
    const refusal = section(report, "email").refusals[0];
    // Email is where a client most expects a number and the one channel the
    // product cannot see at all.
    expect(refusal?.expected).toMatch(/opens/i);
    expect(refusal?.explanation).toMatch(/would be invented/i);
  });
});

describe("a missing source is never a zero", () => {
  it("reports an unconnected ad account as unmeasured, not as no spend", () => {
    const report = composeReport(
      input({ paid: { notConnected: true, cabinets: [] } }),
    );
    const paid = section(report, "paid");

    expect(paid.state).toBe("unavailable");
    expect(paid.summary).toMatch(/not a report of zero spend/i);
    // The section is present. An omitted one reads as "nothing happened here".
    expect(report.sections.map((entry) => entry.id)).toContain("paid");
  });

  it("keeps a section that could not be read, with its reason", () => {
    const report = composeReport(
      input({
        social: {
          notConnected: true,
          indeterminate: 0,
          publishedByPlatform: [],
        },
      }),
    );
    expect(section(report, "social").state).toBe("unavailable");
    expect(section(report, "social").summary).toMatch(/no social channel/i);
  });

  it("carries an unmeasured metric's reason instead of a value", () => {
    const report = composeReport(
      input({
        organic: {
          ...input().organic,
          clicks: missing("Search Console was disconnected for this period."),
          sources: [
            {
              id: "gsc",
              label: "Search Console",
              state: "unavailable",
              reason: "The connection expired on 12 July.",
              observedAt: null,
            },
          ],
        },
      }),
    );
    const clicks = findMetric(report, "organic", "clicks");
    expect(clicks?.value).toBeNull();
    expect(clicks?.note).toMatch(/disconnected/i);
  });

  it("gathers every gap in one place for a reader who skims", () => {
    const report = composeReport(
      input({
        paid: { notConnected: true, cabinets: [] },
        organic: {
          ...input().organic,
          sources: [
            {
              id: "ga4",
              label: "Analytics",
              state: "failed",
              reason: "Analytics refused the credential on 3 July.",
              observedAt: null,
            },
          ],
        },
      }),
    );
    const gaps = report.coverageGaps.map((gap) => gap.source).join(" ");
    expect(gaps).toMatch(/Analytics/);
    expect(gaps).toMatch(/Paid advertising/);
  });
});

describe("change is only reported where both periods were measured", () => {
  it("computes a change when both periods have readings", () => {
    const report = composeReport(input());
    // 12,000 against 10,000.
    expect(findMetric(report, "organic", "clicks")?.change).toBeCloseTo(0.2, 5);
  });

  it("refuses a change against an unmeasured previous period", () => {
    const result = metric({
      key: "clicks",
      label: "Clicks",
      unit: "count",
      current: measured(12_000),
      previous: missing(),
    });
    // A 400% rise over a month the connector was down is not a result, and
    // showing one is worse than showing nothing because it reads as success.
    expect(result.value).toBe(12_000);
    expect(result.change).toBeNull();
    expect(result.note).toMatch(/was not measured/i);
  });

  it("refuses a percentage change from zero", () => {
    const result = metric({
      key: "clicks",
      label: "Clicks",
      unit: "count",
      current: measured(50),
      previous: measured(0),
    });
    expect(result.change).toBeNull();
    expect(result.note).toMatch(/no meaning/i);
  });

  it("distinguishes a measured zero from an absent reading", () => {
    const zero = metric({
      key: "spend",
      label: "Spend",
      unit: "currency",
      current: measured(0),
    });
    const absent = metric({
      key: "spend",
      label: "Spend",
      unit: "currency",
      current: missing(),
    });
    // "We spent nothing" and "we could not ask" must stay distinguishable all
    // the way to the rendered page.
    expect(zero.value).toBe(0);
    expect(zero.state).toBe("available");
    expect(absent.value).toBeNull();
  });
});

describe("state roll-up", () => {
  it("takes the worst state, so a section cannot look healthier than it is", () => {
    expect(worstState(["available", "partial"])).toBe("partial");
    expect(worstState(["available", "failed", "partial"])).toBe("failed");
    expect(worstState([])).toBe("unavailable");
  });

  it("rolls the whole report up to its worst section", () => {
    const report = composeReport(
      input({ paid: { notConnected: true, cabinets: [] } }),
    );
    expect(reportState(report)).toBe("unavailable");
  });
});

describe("the competitive landscape stays observational", () => {
  it("reports citation counts and per-target rows", () => {
    const report = composeReport(input());
    const competitors = section(report, "competitors");

    expect(competitors.state).toBe("partial");
    expect(findMetric(report, "competitors", "targets")?.value).toBe(2);
    // Only measured targets are summed, and the total says it is partial.
    const signals = findMetric(report, "competitors", "signals");
    expect(signals?.value).toBe(27);
    expect(signals?.state).toBe("available");
    expect(findMetric(report, "competitors", "signalsAdded")?.value).toBe(5);
    expect(competitors.breakdown.map((row) => row.label)).toEqual([
      "rival.example",
      "blocked.example",
    ]);
  });

  it("refuses traffic, spend and market-share figures", () => {
    const report = composeReport(input());
    const refusal = section(report, "competitors").refusals.find((entry) =>
      /traffic, spend and revenue/i.test(entry.expected),
    );
    expect(refusal).toBeDefined();
    expect(refusal?.explanation).toMatch(/public pages only/i);
  });

  it("says when a first pass has nothing to compare against", () => {
    const report = composeReport(
      input({
        competitors: {
          ...input().competitors,
          changes: {
            added: missing("This is the first research pass."),
            removed: missing("This is the first research pass."),
            changed: missing("This is the first research pass."),
          },
        },
      }),
    );
    const added = findMetric(report, "competitors", "signalsAdded");
    expect(added?.value).toBeNull();
    expect(added?.note).toMatch(/first research pass/i);
  });

  it("keeps the section when no research ran, with the reason", () => {
    const report = composeReport(
      input({
        competitors: {
          noResearchInPeriod: true,
          targets: [],
          changes: {
            added: missing(),
            removed: missing(),
            changed: missing(),
          },
          observedAt: null,
        },
      }),
    );
    const competitors = section(report, "competitors");
    expect(competitors.state).toBe("unavailable");
    expect(competitors.summary).toMatch(/not evidence that competitors/i);
    // And the absence lands in the coverage gaps a skimming reader meets.
    expect(
      report.coverageGaps.some((gap) =>
        /competitive landscape/i.test(gap.source),
      ),
    ).toBe(true);
  });
});

describe("rendering", () => {
  it("puts the reason where the number would be, never a dash", () => {
    const report = composeReport(
      input({
        organic: {
          ...input().organic,
          clicks: missing("Search Console was disconnected for this period."),
        },
      }),
    );
    const html = renderReportHtml(report);
    expect(html).toContain("Search Console was disconnected for this period.");
    // A dash reads as zero to anyone skimming, which is what happens to a
    // monthly report.
    expect(html).not.toMatch(/>\s*—\s*<\/div>/);
  });

  it("escapes everything it renders", () => {
    const report = composeReport(
      input({
        title: `<script>alert(1)</script>`,
        narrative: `<img onerror=x>`,
      }),
    );
    const html = renderReportHtml(report);
    // The angle brackets are what make markup; escaping them turns the whole
    // thing into visible text. The `onerror=` substring surviving inside
    // escaped text is inert, so asserting on it would be asserting the wrong
    // property.
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img onerror=x&gt;");
  });

  it("prints a monetary figure without inventing a symbol", () => {
    expect(
      formatMetricValue({
        key: "spend",
        label: "Spend",
        value: 1234.5,
        unit: "currency",
        currency: null,
        state: "available",
        change: null,
        note: null,
      }),
    ).toBe("1,234.5");
  });

  it("derives text from the same structure as the HTML", () => {
    const report = composeReport(
      input({
        organic: { ...input().organic, clicks: missing("No Search Console.") },
      }),
    );
    const text = renderReportText(report);
    expect(text).toContain("not measured");
    expect(text).toContain("No Search Console.");
    // The refusal travels into the text form too.
    expect(text).toMatch(/not totalled across channels/i);
  });
});

describe("two paid platforms in one section", () => {
  const googleCabinet = {
    name: "Northstar — Google",
    provider: "google-ads",
    currency: "EUR",
    current: {
      spend: measured(2_000),
      impressions: measured(120_000),
      clicks: measured(4_000),
      conversions: measured(95),
    },
    platforms: [],
  };

  function twoProviders() {
    const base = input();
    return composeReport({
      ...base,
      paid: {
        notConnected: false,
        cabinets: [...base.paid.cabinets, googleCabinet],
      },
    });
  }

  it("still totals spend, because budgets cannot double-count", () => {
    const paid = twoProviders().sections.find(
      (section) => section.id === "paid",
    )!;
    const spend = paid.metrics.find((metric) => metric.key === "spend");
    expect(spend?.value).toBe(6_000);
  });

  it("refuses a combined conversion figure and reports each platform's own", () => {
    // The same reasoning ADR 0007 applies across channels turns out to apply
    // just as strictly between two paid platforms: Meta attributes on its own
    // click-and-view window, Google credits the click that preceded the sale,
    // and one purchase can be counted by both.
    const paid = twoProviders().sections.find(
      (section) => section.id === "paid",
    )!;
    expect(
      paid.metrics.find((metric) => metric.key === "conversions"),
    ).toBeUndefined();

    const perProvider = paid.metrics.filter((metric) =>
      metric.key.startsWith("conversions_"),
    );
    expect(
      perProvider.map((metric) => metric.value).sort((a, b) => a! - b!),
    ).toEqual([95, 180]);
    expect(perProvider.map((metric) => metric.label)).toContain(
      "Conversions reported by Google Ads",
    );

    const refusal = paid.refusals.find((entry) =>
      entry.expected.includes("Total paid conversions"),
    );
    expect(refusal?.explanation).toContain(
      "larger than what actually happened",
    );
  });

  it("keeps totalling conversions when only one platform is connected", () => {
    const paid = composeReport(input()).sections.find(
      (section) => section.id === "paid",
    )!;
    const conversions = paid.metrics.find(
      (metric) => metric.key === "conversions",
    );
    expect(conversions?.value).toBe(180);
    expect(conversions?.label).toBe("Conversions reported by Meta");
  });

  it("warns that recent Google figures are still filling in", () => {
    // Google dates a conversion to the click, so a report regenerated a week
    // later disagrees with this one and neither is a correction of the other.
    const paid = twoProviders().sections.find(
      (section) => section.id === "paid",
    )!;
    const caveat = paid.refusals.find((entry) =>
      entry.expected.includes("most recent days"),
    );
    expect(caveat?.explanation).toContain("dates a conversion to the click");
  });

  it("names both platforms in the summary", () => {
    const paid = twoProviders().sections.find(
      (section) => section.id === "paid",
    )!;
    expect(paid.summary).toContain("Meta and Google Ads");
  });
});
