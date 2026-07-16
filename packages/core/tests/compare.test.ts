import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  compareToMarkdown,
  compareToHtml,
  compareToJson,
} from "../src/core/report/compare.js";
import type { ComparisonResult } from "../src/compare.js";

let fixture: ComparisonResult;

beforeEach(() => {
  fixture = {
    generatedAt: "2026-06-04T22:00:00.000Z",
    sites: [
      {
        url: "https://a.com/",
        finalUrl: "https://a.com/",
        pagesCrawled: 12,
        durationMs: 4500,
        issuesByPriority: { High: 2, Medium: 3, Low: 5 },
        issuesByCategory: {
          H1: 1,
          "Content Quality": 1,
          Canonicals: 1,
          Security: 7,
        },
        topIssues: [
          {
            id: "h1-missing",
            category: "H1",
            priority: "High",
            message: "1 URL has no H1",
            urlCount: 1,
          },
          {
            id: "content-thin",
            category: "Content Quality",
            priority: "Medium",
            message: "1 page is thin",
            urlCount: 1,
          },
        ],
        avgLcpMs: 1200,
        avgCls: 0.05,
        avgTtfbMs: 250,
        lighthouse: {
          performance: 78,
          accessibility: 92,
          bestPractices: 85,
          seo: 90,
        },
        title: "Site A",
        error: null,
      },
      {
        url: "https://b.com/",
        finalUrl: "https://b.com/",
        pagesCrawled: 30,
        durationMs: 9200,
        issuesByPriority: { High: 0, Medium: 1, Low: 3 },
        issuesByCategory: { "Meta Description": 1, Security: 3 },
        topIssues: [
          {
            id: "meta-description",
            category: "Meta Description",
            priority: "Medium",
            message: "1 missing meta desc",
            urlCount: 1,
          },
        ],
        avgLcpMs: 800,
        avgCls: 0.01,
        avgTtfbMs: 180,
        lighthouse: {
          performance: 95,
          accessibility: 100,
          bestPractices: 100,
          seo: 100,
        },
        title: "Site B",
        error: null,
      },
    ],
    winners: {
      fewestHigh: 1,
      fewestTotal: 1,
      bestPerformance: 1,
      bestSeo: 1,
      bestA11y: 1,
      bestBp: 1,
      fastestLcp: 1,
    },
  };
});

describe("compare reports", () => {
  it("compareToMarkdown includes the overview table", () => {
    const md = compareToMarkdown(fixture);
    expect(md).toContain("https://a.com/");
    expect(md).toContain("https://b.com/");
    expect(md).toContain("Overview");
    expect(md).toContain("Lighthouse");
    expect(md).toContain("High");
    expect(md).toContain("LCP");
  });

  it("compareToMarkdown marks winners with a trophy", () => {
    const md = compareToMarkdown(fixture);
    expect(md).toMatch(/https:\/\/b\.com\/.*🏆/);
  });

  it("compareToMarkdown skips Lighthouse section when no site has scores", () => {
    fixture.sites.forEach((s) => (s.lighthouse = null));
    const md = compareToMarkdown(fixture);
    expect(md).not.toContain("Lighthouse (home)");
  });

  it("compareToHtml is self-contained (no external assets)", () => {
    const html = compareToHtml(fixture);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    expect(html).toContain("Competitive SEO comparison");
  });

  it("compareToHtml highlights winners with class", () => {
    const html = compareToHtml(fixture);
    // Site B is the winner for fewestHigh, total, lighthouse, lcp
    const bRow = html.match(/<tr>[\s\S]*?https:\/\/b\.com\/[\s\S]*?<\/tr>/);
    expect(bRow).toBeTruthy();
    expect(bRow![0]).toContain('class="num winner"');
  });

  it("compareToHtml shows error state for failed sites", () => {
    fixture.sites[0]!.error = "DNS resolution failed";
    const html = compareToHtml(fixture);
    expect(html).toContain("DNS resolution failed");
    expect(html).toContain("⚠️");
  });

  it("compareToHtml escapes HTML in user content (XSS-safe)", () => {
    fixture.sites[0]!.url = "https://evil.com/<script>alert(1)</script>";
    const html = compareToHtml(fixture);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("compareToJson round-trips", () => {
    const json = compareToJson(fixture);
    const parsed = JSON.parse(json);
    expect(parsed.sites).toHaveLength(2);
    expect(parsed.winners.fewestHigh).toBe(1);
  });
});
