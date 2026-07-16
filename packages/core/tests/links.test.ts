import { describe, it, expect } from "vitest";
import { runAllChecks } from "../src/checks/index-all.js";
import type { CrawledPage, CrawlIndex } from "../src/checks/index.js";
import { parsePage } from "../src/parser.js";

function makePage(
  url: string,
  status: number,
  html: string,
  finalUrl = url,
): CrawledPage {
  const parsed = parsePage(html, url);
  return {
    url,
    finalUrl,
    status,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: [],
    headers: {},
    parsed,
    error: null,
    fetchDurationMs: 1,
    extractions: [],
    vitals: null,
  };
}

function indexOf(pages: CrawledPage[]): CrawlIndex {
  const m = new Map<string, CrawledPage>();
  for (const p of pages) m.set(p.url, p);
  return {
    pages: m,
    startUrl: pages[0]?.url ?? "",
    robots: new Map(),
    finishedAt: new Date().toISOString(),
    durationMs: 1,
    config: {
      maxUrls: 100,
      maxRuntimeMs: 60_000,
      maxConcurrency: 4,
      requestsPerSecond: 5,
      requestTimeoutMs: 15_000,
      maxBodyBytes: 5_242_880,
      maxRedirects: 5,
      userAgent: "test",
      allowPrivate: false,
      ignoreRobots: false,
      customHeaders: {},
      renderMode: "static",
    },
  };
}

describe("link analysis checks", () => {
  it("flags pages that link to a 4xx internal URL", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/",
        200,
        `<html><head><title>Home page</title></head><body><h1>H</h1><a href="/missing">x</a></body></html>`,
      ),
      makePage(
        "https://example.com/missing",
        404,
        `<html><head><title>404 page</title></head><body><h1>Not found</h1></body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "internal-link-to-broken",
    );
    expect(issues.length).toBe(1);
    expect(issues[0]?.urls).toContain("https://example.com/");
  });

  it("flags pages with no internal outbound links", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title</title></head><body><h1>A</h1><p>no links</p></body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "no-outbound-internal",
    );
    expect(issues.length).toBe(1);
  });

  it("does not flag noindex pages for no-outbound-internal", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/x",
        200,
        '<html><head><title>Page X title</title><meta name="robots" content="noindex"></head><body><h1>X</h1></body></html>',
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "no-outbound-internal",
    );
    expect(issues.length).toBe(0);
  });

  it("flags pages with > 80% nofollow external links", async () => {
    const html = `<html><head><title>Heavy nofollow page</title></head><body><h1>H</h1>
      <a href="https://other.example/a" rel="nofollow">a</a>
      <a href="https://other.example/b" rel="nofollow">b</a>
      <a href="https://other.example/c" rel="nofollow">c</a>
      <a href="https://other.example/d" rel="nofollow">d</a>
      <a href="https://other.example/e" rel="nofollow">e</a>
    </body></html>`;
    const idx = indexOf([makePage("https://example.com/x", 200, html)]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "heavy-nofollow-external",
    );
    expect(issues.length).toBe(1);
  });

  it("surfaces top-linked-to informational issue", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title</title></head><body><h1>A</h1><a href="/hub">hub</a><a href="/hub">hub2</a></body></html>`,
      ),
      makePage(
        "https://example.com/b",
        200,
        `<html><head><title>Page B title</title></head><body><h1>B</h1><a href="/hub">hub3</a></body></html>`,
      ),
      makePage(
        "https://example.com/hub",
        200,
        `<html><head><title>Hub page title</title></head><body><h1>H</h1></body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "top-linked-to",
    );
    expect(issues.length).toBe(1);
    expect(issues[0]?.urls[0]).toBe("https://example.com/hub");
    expect(issues[0]?.message.length).toBeLessThanOrEqual(240);
    expect(issues[0]?.detail).toMatchObject({
      ranking: "inbound-internal-links",
      pages: [{ url: "https://example.com/hub", inlinkCount: 2 }],
    });
  });
});
