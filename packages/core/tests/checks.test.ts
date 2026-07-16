import { describe, it, expect } from "vitest";
import { runAllChecks } from "../src/checks/index-all.js";
import type { CrawlIndex, CrawledPage } from "../src/checks/index.js";
import { parsePage } from "../src/parser.js";
import type { Limits } from "../src/core/limits.js";
import { hreflangChecks } from "../src/checks/hreflang.js";

const LIMITS: Limits = {
  maxUrls: 10,
  maxRuntimeMs: 1000,
  maxConcurrency: 1,
  requestsPerSecond: 1,
  requestTimeoutMs: 1000,
  maxBodyBytes: 1024,
  maxRedirects: 1,
  userAgent: "test",
  allowPrivate: false,
  ignoreRobots: false,
  renderMode: "static",
  customHeaders: {},
};

function page(
  url: string,
  status: number,
  html: string,
  extra: Partial<CrawledPage> = {},
): CrawledPage {
  const parsed = parsePage(html, url);
  return {
    url,
    finalUrl: url,
    status,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: [],
    headers: {
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'",
      "referrer-policy": "no-referrer",
    },
    parsed,
    error: null,
    fetchDurationMs: 1,
    ...extra,
  };
}

function indexOf(pages: CrawledPage[]): CrawlIndex {
  const map = new Map<string, CrawledPage>();
  for (const p of pages) map.set(p.url, p);
  return {
    pages: map,
    startUrl: pages[0]?.url ?? "",
    robots: new Map(),
    finishedAt: new Date().toISOString(),
    durationMs: 0,
    config: LIMITS,
  };
}

describe("response code checks", () => {
  it("flags 4xx and 5xx", async () => {
    const idx = indexOf([
      page(
        "https://example.com/",
        200,
        "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      ),
      page(
        "https://example.com/missing",
        404,
        "<html><head><title>404</title></head><body><h1>404</h1></body></html>",
      ),
      page(
        "https://example.com/boom",
        500,
        "<html><head><title>500</title></head><body><h1>500</h1></body></html>",
      ),
    ]);
    const issues = await runAllChecks(idx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("internal-4xx");
    expect(ids).toContain("internal-5xx");
  });
});

describe("title checks", () => {
  it("flags missing, duplicate and long titles", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        "<html><head></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/b",
        200,
        `<html><head><title>${"X".repeat(70)}</title></head><body><h1>B</h1></body></html>`,
      ),
      page(
        "https://example.com/c1",
        200,
        "<html><head><title>Same Title Used Here For SEO Reasons</title></head><body><h1>C1</h1></body></html>",
      ),
      page(
        "https://example.com/c2",
        200,
        "<html><head><title>Same Title Used Here For SEO Reasons</title></head><body><h1>C2</h1></body></html>",
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("title-missing");
    expect(ids).toContain("title-over-60-chars");
    expect(ids).toContain("title-duplicate");
  });

  it("flags near-duplicate titles via shingles", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        "<html><head><title>Best running shoes for marathon training 2026</title></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/b",
        200,
        "<html><head><title>Best running shoes for marathon training 2025</title></head><body><h1>B</h1></body></html>",
      ),
      page(
        "https://example.com/c",
        200,
        "<html><head><title>Completely different title about cooking pasta</title></head><body><h1>C</h1></body></html>",
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("title-near-duplicate");
  });
});

describe("meta description checks", () => {
  it("flags missing and duplicate", async () => {
    const htmlA =
      "<html><head><title>A page with title</title></head><body><h1>A</h1></body></html>";
    const htmlB = `<html><head><title>B page with title</title><meta name="description" content="${"d".repeat(200)}"></head><body><h1>B</h1></body></html>`;
    const htmlC = `<html><head><title>C page with title</title><meta name="description" content="${"d".repeat(200)}"></head><body><h1>C</h1></body></html>`;
    const idx = indexOf([
      page("https://example.com/a", 200, htmlA),
      page("https://example.com/b", 200, htmlB),
      page("https://example.com/c", 200, htmlC),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("meta-description-missing");
    expect(ids).toContain("meta-description-over-155-chars");
    expect(ids).toContain("meta-description-duplicate");
  });
});

describe("heading checks", () => {
  it("flags missing and multiple H1", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        "<html><head><title>Has title</title></head><body><p>No H1</p></body></html>",
      ),
      page(
        "https://example.com/b",
        200,
        "<html><head><title>Has title 2</title></head><body><h1>A</h1><h1>B</h1></body></html>",
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("h1-missing");
    expect(ids).toContain("h1-multiple");
  });
});

describe("canonical checks", () => {
  it("flags missing and broken canonical", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        "<html><head><title>Page A</title></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/b",
        200,
        '<html><head><title>Page B</title><link rel="canonical" href="https://example.com/missing"></head><body><h1>B</h1></body></html>',
      ),
    ]);
    idx.pages.set(
      "https://example.com/missing",
      page(
        "https://example.com/missing",
        404,
        "<html><head><title>Missing page</title></head><body><h1>Missing</h1></body></html>",
      ),
    );
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("canonical-missing");
    expect(ids).toContain("canonical-broken");
  });
});

describe("directive checks", () => {
  it("flags noindex", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        '<html><head><title>Page A title</title><meta name="robots" content="noindex"></head><body><h1>A</h1></body></html>',
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("noindex");
  });
});

describe("image checks", () => {
  it("flags missing alt", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        '<html><head><title>Page A title</title></head><body><h1>A</h1><img src="/x.jpg"></body></html>',
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("image-alt-missing");
  });
});

describe("security checks", () => {
  it("flags missing headers", async () => {
    const p = page(
      "https://example.com/a",
      200,
      "<html><head><title>Page A title</title></head><body><h1>A</h1></body></html>",
    );
    p.headers = {};
    const idx = indexOf([p]);
    const issues = (await runAllChecks(idx)).filter((i) =>
      i.id.startsWith("header-missing-"),
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags mixed content", async () => {
    const p = page(
      "https://example.com/a",
      200,
      '<html><head><title>Page A title</title></head><body><h1>A</h1><img src="http://other.example/x.jpg"></body></html>',
    );
    const idx = indexOf([p]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("mixed-content");
  });
});

describe("orphan checks", () => {
  it("flags pages with no inbound links", async () => {
    const idx = indexOf([
      page(
        "https://example.com/",
        200,
        '<html><head><title>Home page</title></head><body><h1>Home</h1><a href="/a">A</a></body></html>',
      ),
      page(
        "https://example.com/a",
        200,
        "<html><head><title>A page title</title></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/orphan",
        200,
        "<html><head><title>Orphan page title</title></head><body><h1>Orphan</h1></body></html>",
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("orphan-page");
  });
});

describe("JSON-LD check", () => {
  it("flags invalid JSON-LD blocks", async () => {
    const idx = indexOf([
      page(
        "https://example.com/a",
        200,
        '<html><head><title>Has title</title><script type="application/ld+json">{not valid json</script></head><body><h1>A</h1></body></html>',
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("jsonld-parse-error");
  });
});

describe("soft-404 check", () => {
  it("flags 200 pages that look like 404", async () => {
    const idx = indexOf([
      page(
        "https://example.com/gone",
        200,
        "<html><head><title>Page not found</title></head><body><p>nope</p></body></html>",
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("soft-404");
  });

  it("does not flag thick pages with similar words", async () => {
    const thick = "lorem ipsum ".repeat(60);
    const idx = indexOf([
      page(
        "https://example.com/x",
        200,
        `<html><head><title>Page not found anywhere in this title</title></head><body><h1>X</h1><p>${thick}</p></body></html>`,
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).not.toContain("soft-404");
  });
});

describe("hreflang consistency check", () => {
  it("flags missing reciprocal", async () => {
    const idx = indexOf([
      page(
        "https://example.com/en",
        200,
        '<html><head><title>EN page</title><link rel="alternate" hreflang="en" href="https://example.com/en"><link rel="alternate" hreflang="de" href="https://example.com/de"></head><body><h1>EN</h1></body></html>',
      ),
      page(
        "https://example.com/de",
        200,
        '<html><head><title>DE page</title><link rel="alternate" hreflang="de" href="https://example.com/de"></head><body><h1>DE</h1></body></html>',
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("hreflang-no-reciprocal");
  });

  it("accepts reciprocal links whose return language describes the source page", async () => {
    const idx = indexOf([
      page(
        "https://example.com/en",
        200,
        '<html lang="en"><head><title>EN page</title><link rel="alternate" hreflang="en" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>EN</h1></body></html>',
      ),
      page(
        "https://example.com/fr",
        200,
        '<html lang="fr"><head><title>FR page</title><link rel="alternate" hreflang="en" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>FR</h1></body></html>',
      ),
    ]);
    const issues = await Promise.resolve(hreflangChecks[0]!(idx));
    const ids = issues.map((issue) => issue.id);
    expect(ids).not.toContain("hreflang-no-reciprocal");
    expect(ids).not.toContain("hreflang-lang-mismatch");
  });

  it("compares the reciprocal language with the source self-reference", async () => {
    const idx = indexOf([
      page(
        "https://example.com/en",
        200,
        '<html lang="en"><head><title>EN page</title><link rel="alternate" hreflang="en" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>EN</h1></body></html>',
      ),
      page(
        "https://example.com/fr",
        200,
        '<html lang="fr"><head><title>FR page</title><link rel="alternate" hreflang="de" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>FR</h1></body></html>',
      ),
    ]);
    const issues = await Promise.resolve(hreflangChecks[0]!(idx));
    const mismatch = issues.find(
      (issue) => issue.id === "hreflang-lang-mismatch",
    );
    expect(mismatch?.detail).toMatchObject({
      alternate: {
        expectedReturnLanguage: "en",
        observedReturnLanguages: ["de"],
      },
    });
  });
});
