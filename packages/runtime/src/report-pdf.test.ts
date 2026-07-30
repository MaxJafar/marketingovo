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

// Cold-start finding: an audit that failed reported "1 of 1 crawled page
// requests failed" and nothing else, while the daemon log knew the cause was
// the egress policy. For a product whose discipline is to say what it could not
// measure and why, a bare count is the wrong failure.
describe("audit failure reporting", () => {
  it("carries the transport reason into the run error", async () => {
    const { auditReportState } = await import("./index.js");
    const state = auditReportState({
      pages: [
        {
          url: "http://127.0.0.1:4599/",
          status: 0,
          error: "private/loopback address blocked: 127.0.0.1",
        },
      ],
    } as never);
    expect(state.status).toBe("failed");
    expect(state.error).toContain("loopback address blocked");
  });

  it("bounds the reasons so one broken host cannot flood the message", async () => {
    const { auditReportState } = await import("./index.js");
    const state = auditReportState({
      pages: Array.from({ length: 9 }, (_, i) => ({
        url: `https://example.com/${i}`,
        status: 0,
        error: `distinct failure ${i}`,
      })),
    } as never);
    expect(state.error).toMatch(/and 6 other reasons/);
  });

  it("still reports a count when no page carried a reason", async () => {
    const { auditReportState } = await import("./index.js");
    const state = auditReportState({
      pages: [{ url: "https://example.com/", status: 0, error: null }],
    } as never);
    expect(state.error).toContain("1 of 1 crawled page requests failed");
  });
});
