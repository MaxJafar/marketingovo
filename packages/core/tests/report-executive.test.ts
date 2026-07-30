import { describe, expect, it } from "vitest";
import {
  deriveChange,
  deriveCoverageGaps,
  deriveExecutiveSummary,
} from "../src/core/report/executive.js";
import type { Report } from "../src/core/report/index.js";
import { reportToHtml } from "../src/core/report/html.js";

function issue(
  id: string,
  priority: "High" | "Medium" | "Low",
  urls: string[],
) {
  return {
    id,
    category: "technical",
    priority,
    message: `${id} message`,
    urls,
    fix: `fix ${id}`,
  };
}

function report(overrides: Partial<Report> = {}): Report {
  return {
    generatedAt: "2026-07-30T12:00:00.000Z",
    startUrl: "https://example.com/",
    durationMs: 4200,
    config: { maxUrls: 100, maxRuntimeMs: 60000, requestsPerSecond: 2 },
    summary: {
      pagesCrawled: 40,
      issuesByPriority: { High: 2, Medium: 1, Low: 0 },
      issuesByCategory: { technical: 3 },
    },
    issues: [
      issue(
        "wide",
        "High",
        Array.from({ length: 25 }, (_, i) => `https://example.com/${i}`),
      ),
      issue("narrow", "High", ["https://example.com/only"]),
      issue("minor", "Medium", [
        "https://example.com/a",
        "https://example.com/b",
      ]),
    ],
    pages: [],
    topUrls: [],
    ...overrides,
  } as Report;
}

describe("executive summary ranks by severity then real reach", () => {
  it("puts a wide-reaching finding above an equally severe narrow one", () => {
    const summary = deriveExecutiveSummary(report());
    expect(summary.topActions[0]?.id).toBe("wide");
    expect(summary.topActions[0]?.affectedUrls).toBe(25);
    expect(summary.topActions[1]?.id).toBe("narrow");
    // Severity still dominates: the Medium finding cannot outrank a High one.
    expect(summary.topActions[2]?.priority).toBe("Medium");
  });

  it("reports the complete cohort but samples the URLs it prints", () => {
    const summary = deriveExecutiveSummary(report());
    const widest = summary.topActions[0]!;
    expect(widest.affectedUrls).toBe(25);
    expect(widest.sampleUrls).toHaveLength(3);
  });

  // A synthesized 0-100 score is the one number a client questions and an
  // agency cannot defend, so the model must not grow one.
  it("publishes no invented health score", () => {
    const summary = deriveExecutiveSummary(report());
    for (const key of Object.keys(summary)) {
      expect(key).not.toMatch(/score|grade|rating/i);
    }
  });
});

describe("coverage gaps state what was not measured", () => {
  it("names absent search and analytics data", () => {
    const gaps = deriveCoverageGaps(report());
    expect(gaps.some((gap) => /Search Console/i.test(gap.source))).toBe(true);
    expect(gaps.some((gap) => /sitemap/i.test(gap.source))).toBe(true);
  });

  it("separates unreachable pages from pages with no issues", () => {
    const gaps = deriveCoverageGaps(
      report({
        pages: [
          { url: "https://example.com/a", error: "ETIMEDOUT" },
          { url: "https://example.com/b", error: null },
        ] as Report["pages"],
      }),
    );
    const unreachable = gaps.find((gap) => /unreachable/i.test(gap.source));
    expect(unreachable).toBeDefined();
    expect(unreachable?.consequence).toMatch(/unknown rather than absent/i);
  });

  it("reports robots-disallowed pages as respected, not as a finding", () => {
    const gaps = deriveCoverageGaps(
      report({
        pages: [
          { url: "https://example.com/x", error: null, robotsAllowed: false },
        ] as Report["pages"],
      }),
    );
    expect(gaps.some((gap) => /robots/i.test(gap.source))).toBe(true);
  });
});

describe("change against a baseline", () => {
  const baseline = {
    baselineGeneratedAt: "2026-07-01T12:00:00.000Z",
    baselineIssuesByPriority: { High: 5, Medium: 1, Low: 0 },
    baselinePagesCrawled: 40,
  };

  it("reports movement per priority", () => {
    const change = deriveChange(report(), baseline)!;
    const high = change.byPriority.find((row) => row.priority === "High")!;
    expect(high.baseline).toBe(5);
    expect(high.current).toBe(2);
    expect(high.delta).toBe(-3);
    expect(change.scopeChanged).toBe(false);
  });

  // Counts from crawls of very different sizes are not comparable, and a reader
  // would otherwise take the delta for progress.
  it("flags a material scope change instead of implying progress", () => {
    const change = deriveChange(
      report({
        summary: {
          pagesCrawled: 12,
          issuesByPriority: { High: 2, Medium: 1, Low: 0 },
          issuesByCategory: { technical: 3 },
        },
      }),
      baseline,
    )!;
    expect(change.scopeChanged).toBe(true);
    expect(change.pagesCrawledDelta).toBe(-28);
  });

  it("is absent for a first audit rather than compared against zero", () => {
    expect(deriveChange(report(), null)).toBeNull();
    expect(deriveExecutiveSummary(report()).change).toBeNull();
  });
});

describe("the rendered report carries the executive layer", () => {
  it("leads with the summary, the actions and the gaps", () => {
    const html = reportToHtml(report());
    expect(html).toContain("Do these first");
    expect(html).toContain("What this audit could not measure");
    expect(html).toContain("40 pages crawled");
    // First audit says so rather than showing an empty comparison.
    expect(html).toMatch(/first audit for this site/i);
  });

  it("renders the baseline comparison when one is supplied", () => {
    const html = reportToHtml(report(), {
      baselineGeneratedAt: "2026-07-01T12:00:00.000Z",
      baselineIssuesByPriority: { High: 5, Medium: 1, Low: 0 },
      baselinePagesCrawled: 40,
    });
    expect(html).toContain("What changed since");
    expect(html).toContain("change-table");
  });
});
