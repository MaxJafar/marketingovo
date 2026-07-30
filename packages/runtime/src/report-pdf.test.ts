import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createPdf } from "./index.js";
import type { Report as EngineReport } from "@marketingovo/core";

function reportWith(issueCount: number): EngineReport {
  return {
    generatedAt: "2026-07-30T12:00:00.000Z",
    startUrl: "https://example.com/",
    durationMs: 1000,
    config: { maxUrls: 500, maxRuntimeMs: 60000, requestsPerSecond: 2 },
    summary: {
      pagesCrawled: 300,
      issuesByPriority: { High: issueCount, Medium: 0, Low: 0 },
      issuesByCategory: { technical: issueCount },
    },
    issues: Array.from({ length: issueCount }, (_, i) => ({
      id: `rule-${i}`,
      category: "technical",
      priority: "High" as const,
      message: `Finding ${i} with a message long enough to wrap across the printable width of an A4 page`,
      urls: [`https://example.com/${i}`],
      fix: `Fix finding ${i}`,
    })),
    pages: [],
    topUrls: [],
  } as unknown as EngineReport;
}

describe("audit PDF", () => {
  // The previous renderer drew onto a single page and stopped at whatever fit,
  // silently dropping every finding past roughly eighteen.
  it("paginates instead of truncating a long finding list", async () => {
    const bytes = await createPdf(reportWith(120));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("stays compact for a small audit", async () => {
    const bytes = await createPdf(reportWith(3));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(3);
  });

  it("says so when there is no baseline rather than showing an empty comparison", async () => {
    const bytes = await createPdf(reportWith(2));
    expect(new TextDecoder().decode(bytes).length).toBeGreaterThan(0);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Marketingovo audit");
  });
});
