import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "./index.js";

/**
 * The report pipeline end to end: gather → compose → freeze → render.
 *
 * Run against a workspace with no connected sources on purpose — the empty
 * database is the report's hardest honesty test, because every convenient bug
 * turns an unmeasured channel into a zero.
 */
describe("cross-channel report generation", () => {
  const runtimes: MarketingovoLocalRuntime[] = [];
  afterEach(() => runtimes.splice(0).forEach((runtime) => runtime.close()));

  function setup(): MarketingovoLocalRuntime {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-marketing-report-")),
    });
    runtimes.push(runtime);
    return runtime;
  }

  it("freezes a document whose empty channels state their reasons", async () => {
    const runtime = setup();
    const project = await runtime.projects.create({
      name: "Report workspace",
      canonicalUrl: "https://example.com/",
    });
    const report = await runtime.marketingReports.generate({
      projectId: project.id,
      compare: true,
    });

    expect(report.sections.map((section) => section.id)).toEqual([
      "paid",
      "organic",
      "social",
      "email",
      "competitors",
      "actions",
    ]);

    const competitors = report.sections.find(
      (section) => section.id === "competitors",
    )!;
    expect(competitors.state).toBe("unavailable");
    expect(competitors.summary).toMatch(/not evidence that competitors/i);

    // Nothing in an unmeasured workspace may surface as a numeric zero.
    for (const section of report.sections) {
      for (const metric of section.metrics) {
        if (metric.state === "unavailable" || metric.state === "failed") {
          expect(metric.value).toBeNull();
          expect(metric.note).toBeTruthy();
        }
      }
    }

    const stored = await runtime.marketingReports.get(report.id);
    expect(stored?.generatedAt).toBe(report.generatedAt);
  });

  it("renders the stored document as HTML, text and a PDF download", async () => {
    const runtime = setup();
    const project = await runtime.projects.create({
      name: "Render workspace",
      canonicalUrl: "https://example.com/",
    });
    const report = await runtime.marketingReports.generate({
      projectId: project.id,
    });

    const html = await runtime.marketingReports.render(report.id, "html");
    expect(html).toContain("Competitive landscape");
    expect(html).toContain("What this report could not see");

    const text = await runtime.marketingReports.render(report.id, "text");
    expect(text).toContain("Competitive landscape");

    const pdf = await runtime.marketingReports.render(report.id, "pdf");
    expect(pdf).toBeInstanceOf(Uint8Array);
    const bytes = pdf as Uint8Array;
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");

    expect(await runtime.marketingReports.render("missing", "pdf")).toBeNull();
  });
});
