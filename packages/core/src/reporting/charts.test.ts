import { describe, expect, it } from "vitest";
import { donutSlices, reportChartSpecs } from "./charts.js";
import type { ReportMetric, ReportSection, MarketingReport } from "./types.js";

const measuredMetric = (
  key: string,
  value: number,
  overrides: Partial<ReportMetric> = {},
): ReportMetric => ({
  key,
  label: key,
  value,
  unit: "count",
  currency: null,
  state: "available",
  change: null,
  note: null,
  ...overrides,
});

const missingMetric = (key: string, note: string): ReportMetric => ({
  key,
  label: key,
  value: null,
  unit: "count",
  currency: null,
  state: "unavailable",
  change: null,
  note,
});

const section = (overrides: Partial<ReportSection>): ReportSection => ({
  id: "social",
  title: "Social publishing",
  state: "available",
  summary: "",
  metrics: [],
  sources: [],
  refusals: [],
  breakdown: [],
  ...overrides,
});

const report = (sections: ReportSection[]): MarketingReport => ({
  id: "r1",
  projectId: "p1",
  title: "Test",
  period: {
    start: "2026-07-01",
    end: "2026-07-31",
    comparisonStart: null,
    comparisonEnd: null,
    timezone: "UTC",
  },
  narrative: null,
  sections,
  coverageGaps: [],
  generatedAt: "2026-08-01T00:00:00.000Z",
  brandRevision: null,
});

describe("what a chart may draw", () => {
  it("omits an unmeasured row with its reason instead of a zero bar", () => {
    const specs = reportChartSpecs(
      report([
        section({
          breakdown: [
            { label: "telegram", metrics: [measuredMetric("published", 12)] },
            {
              label: "instagram",
              metrics: [
                missingMetric("published", "The account was disconnected."),
              ],
            },
          ],
        }),
      ]),
    );
    const bars = specs.find((spec) => spec.kind === "bars")!;
    expect(bars.rows.map((row) => row.label)).toEqual(["telegram"]);
    expect(bars.omitted).toEqual([
      { label: "instagram", reason: "The account was disconnected." },
    ]);
    // A share chart of an incomplete whole would misstate every slice.
    expect(specs.some((spec) => spec.kind === "donut")).toBe(false);
  });

  it("draws a share donut only when every row was measured", () => {
    const specs = reportChartSpecs(
      report([
        section({
          breakdown: [
            { label: "telegram", metrics: [measuredMetric("published", 12)] },
            { label: "x", metrics: [measuredMetric("published", 4)] },
          ],
        }),
      ]),
    );
    const donut = specs.find((spec) => spec.kind === "donut");
    expect(donut).toBeDefined();
    const slices = donutSlices(donut!, 90, 90, 70, 44);
    expect(slices.map((slice) => slice.share)).toEqual([0.75, 0.25]);
    expect(slices.reduce((total, slice) => total + slice.share, 0)).toBeCloseTo(
      1,
    );
    expect(slices[0]!.path).toMatch(/^M .+ Z$/);
  });

  it("never turns competitor citations into a share chart", () => {
    const specs = reportChartSpecs(
      report([
        section({
          id: "competitors",
          title: "Competitive landscape",
          breakdown: [
            { label: "a.example", metrics: [measuredMetric("signals", 20)] },
            { label: "b.example", metrics: [measuredMetric("signals", 10)] },
          ],
        }),
      ]),
    );
    // Bars compare citation counts; a donut would read as market share,
    // which nobody measured.
    expect(specs.some((spec) => spec.kind === "bars")).toBe(true);
    expect(specs.some((spec) => spec.kind === "donut")).toBe(false);
  });

  it("declines paid bars across two currencies", () => {
    const specs = reportChartSpecs(
      report([
        section({
          id: "paid",
          title: "Paid advertising",
          breakdown: [
            {
              label: "EU",
              metrics: [
                measuredMetric("spend", 100, {
                  unit: "currency",
                  currency: "EUR",
                }),
              ],
            },
            {
              label: "US",
              metrics: [
                measuredMetric("spend", 100, {
                  unit: "currency",
                  currency: "USD",
                }),
              ],
            },
          ],
        }),
      ]),
    );
    expect(specs).toEqual([]);
  });

  it("compares periods only where the composer allowed a change", () => {
    const specs = reportChartSpecs(
      report([
        section({
          metrics: [
            measuredMetric("clicks", 120, { change: 0.2 }),
            // Measured, but the previous period was not — no pair to draw.
            measuredMetric("impressions", 900, {
              change: null,
              note: "No comparison: the previous period was not measured.",
            }),
          ],
        }),
      ]),
    );
    const compare = specs.find((spec) => spec.kind === "compare")!;
    expect(compare.compareRows).toHaveLength(1);
    expect(compare.compareRows[0]!.current).toBe(120);
    expect(compare.compareRows[0]!.previous).toBeCloseTo(100);
  });
});
