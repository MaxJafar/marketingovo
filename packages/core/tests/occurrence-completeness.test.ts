import { describe, expect, it } from "vitest";
import { pageTitleChecks } from "../src/checks/page-titles.js";
import type { CrawledPage, CrawlIndex, Issue } from "../src/checks/index.js";
import { issueToInstances } from "../src/core/entities.js";
import {
  buildReport,
  reportToCsv,
  reportToHtml,
  reportToJson,
  reportToMarkdown,
} from "../src/core/report/index.js";
import { parsePage } from "../src/parser.js";

function missingTitlePage(index: number): CrawledPage {
  const url = `https://example.com/page/${index}`;
  const html = `<html><body><h1>Page ${index}</h1></body></html>`;
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: [],
    headers: {},
    parsed: parsePage(html, url),
    error: null,
    fetchDurationMs: 1,
    extractions: [],
    vitals: null,
  };
}

function crawlIndex(pageCount: number): CrawlIndex {
  const pages = Array.from({ length: pageCount }, (_, index) =>
    missingTitlePage(index),
  );
  return {
    pages: new Map(pages.map((page) => [page.url, page])),
    startUrl: pages[0]?.url ?? "https://example.com/",
    robots: new Map(),
    finishedAt: "2026-07-15T00:00:00.000Z",
    durationMs: 1,
    config: {
      maxUrls: pageCount,
      maxRuntimeMs: 60_000,
      maxConcurrency: 4,
      requestsPerSecond: 5,
      requestTimeoutMs: 15_000,
      maxBodyBytes: 5_242_880,
      maxRedirects: 5,
      userAgent: "test",
      allowPrivate: false,
      ignoreRobots: false,
      renderMode: "static",
      customHeaders: {},
      keepRawHtml: false,
    },
  };
}

describe("affected URL occurrence completeness", () => {
  it("keeps every occurrence for report, issue-instance and data exports", async () => {
    const index = crawlIndex(257);
    const check = pageTitleChecks.find((candidate) =>
      candidate.name.includes("missingTitle"),
    );
    expect(check).toBeDefined();
    const issues = (await Promise.resolve(check!(index))) as Issue[];
    const issue = issues.find((candidate) => candidate.id === "title-missing");
    expect(issue).toBeDefined();
    expect(issue!.urls).toHaveLength(257);
    expect(issue!.urls.at(-1)).toBe("https://example.com/page/256");

    const instances = issueToInstances(
      issue!,
      "onpage",
      "2026-07-15T00:00:00.000Z",
    );
    expect(instances).toHaveLength(257);
    expect(instances.at(-1)?.canonicalUrl).toBe("https://example.com/page/256");

    const report = buildReport(index, issues);
    expect(report.issues[0]?.urls).toHaveLength(257);
    expect(JSON.parse(reportToJson(report)).issues[0].urls).toHaveLength(257);

    const csv = reportToCsv(report);
    expect(csv.trim().split("\n")).toHaveLength(258);
    expect(csv).toContain("https://example.com/page/256");

    const html = reportToHtml(report);
    expect(html).toContain("257 URL(s); showing first 200");
    expect(html).toContain("Showing 200 of 257");
    expect(html).not.toContain(">https://example.com/page/256</a>");

    const markdown = reportToMarkdown(report);
    expect(markdown).toContain("...and 252 more");
  });
});
