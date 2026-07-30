import { describe, it, expect } from "vitest";
import {
  reportToHtml,
  reportToCsv,
  reportToJson,
  reportToMarkdown,
} from "../src/core/report/index.js";
import type { Report } from "../src/core/report/index.js";
import { withRecommendations } from "../src/core/recommendations.js";

const SAMPLE: Report = {
  generatedAt: "2026-06-04T12:00:00.000Z",
  startUrl: "https://example.com/",
  durationMs: 1234,
  config: { maxUrls: 100, maxRuntimeMs: 60_000, requestsPerSecond: 5 },
  summary: {
    pagesCrawled: 3,
    issuesByPriority: { High: 1, Medium: 1, Low: 1 },
    issuesByCategory: { "Response Codes": 1, Titles: 1, Performance: 1 },
  },
  issues: withRecommendations([
    {
      id: "internal-4xx",
      category: "Response Codes",
      priority: "High",
      message: "1 internal 4xx link(s) found.",
      urls: ["https://example.com/missing"],
    },
    {
      id: "title-missing",
      category: "Titles",
      priority: "Medium",
      message: "1 page(s) missing a <title> tag.",
      urls: ["https://example.com/no-title"],
    },
    {
      id: "vitals-lcp-poor",
      category: "Performance",
      priority: "Low",
      message: "1 page(s) have LCP > 4000ms.",
      urls: ["https://example.com/slow"],
    },
  ]),
  pages: [
    {
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      status: 200,
      title: "Home",
      responseTimeMs: 50,
      vitals: null,
    },
  ],
  topUrls: [
    {
      url: "https://example.com/missing",
      status: 404,
      title: "Missing",
      issueCount: 1,
      extractions: [],
    },
  ],
};

describe("reportToHtml", () => {
  it("renders an HTML doc with the startUrl and all categories", () => {
    const html = reportToHtml(SAMPLE);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("https://example.com/");
    expect(html).toContain("Response Codes");
    expect(html).toContain("Titles");
    expect(html).toContain("Performance");
    expect(html).toContain("Fix:"); // recommendation
    expect(html).toContain("priority-high");
    expect(html).toContain("priority-medium");
    expect(html).toContain("priority-low");
    expect(html).toContain("AGENTseo Community Edition");
    expect(html).toContain("Crawl evidence only");
    expect(html).not.toContain("AgentSeo v0.2");
  });
  it("escapes HTML in URLs and titles", () => {
    const html = reportToHtml(SAMPLE);
    expect(html).not.toContain("<script>alert");
    const evil: Report = {
      ...SAMPLE,
      topUrls: [
        {
          url: 'https://example.com/?a="><script>alert(1)</script>',
          status: 200,
          title: "<bad>",
          issueCount: 0,
          extractions: [],
        },
      ],
    };
    const html2 = reportToHtml(evil);
    expect(html2).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html2).toContain("&lt;bad&gt;");
  });
});

describe("reportToCsv", () => {
  it("renders CSV with one row per (issue, url)", () => {
    const csv = reportToCsv(SAMPLE);
    const lines = csv.trim().split("\n");
    // header + 3 issue rows with 1 url each = 4
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("priority,category,issue_id");
    expect(csv).toContain("High,Response Codes,internal-4xx");
    expect(csv).toContain("Medium,Titles,title-missing");
  });
  it("expands multi-URL issues into multiple rows", () => {
    const big: Report = {
      ...SAMPLE,
      issues: withRecommendations([
        {
          id: "title-duplicate",
          category: "Titles",
          priority: "Medium",
          message: "3 dup titles",
          urls: [
            "https://example.com/a",
            "https://example.com/b",
            "https://example.com/c",
          ],
        },
      ]),
    };
    const csv = reportToCsv(big);
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(4);
    expect(csv).toContain("https://example.com/a");
    expect(csv).toContain("https://example.com/c");
  });
  it("escapes commas, quotes, and newlines", () => {
    const tricky: Report = {
      ...SAMPLE,
      issues: withRecommendations([
        {
          id: "x",
          category: "Has, comma",
          priority: "High",
          message: 'Message with "quote" and, comma\nand newline',
          urls: ["https://example.com/has,comma"],
        },
      ]),
    };
    const csv = reportToCsv(tricky);
    expect(csv).toContain('"Has, comma"');
    expect(csv).toContain('"Message with ""quote"" and, comma\nand newline"');
    expect(csv).toContain('"https://example.com/has,comma"');
  });
});

describe("reportToJson", () => {
  it("round-trips a report", () => {
    const j = reportToJson(SAMPLE);
    const d = JSON.parse(j);
    expect(d.startUrl).toBe(SAMPLE.startUrl);
    expect(d.issues.length).toBe(3);
  });
});

describe("reportToMarkdown", () => {
  it("includes fixes", () => {
    const md = reportToMarkdown(SAMPLE);
    expect(md).toContain("Fix:");
    expect(md).toContain("https://example.com/");
  });
});
