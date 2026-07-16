import { describe, expect, it } from "vitest";
import { hreflangChecks } from "../src/checks/hreflang.js";
import { imageChecks } from "../src/checks/images.js";
import type {
  CheckFn,
  CrawledPage,
  CrawlIndex,
  Issue,
} from "../src/checks/index.js";
import { linkChecks } from "../src/checks/links.js";
import { markupChecks } from "../src/checks/markup.js";
import { parsePage } from "../src/parser.js";
import { stabilizeCrawlDiscovery } from "../src/orchestrator.js";

function page(
  url: string,
  html: string,
  options: {
    depth?: number;
    discoveredFrom?: string | null;
    finalUrl?: string;
    redirectChain?: string[];
  } = {},
): CrawledPage {
  const finalUrl = options.finalUrl ?? url;
  return {
    url,
    finalUrl,
    crawlDepth: options.depth ?? 0,
    discoveredFrom: options.discoveredFrom ?? null,
    status: 200,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: options.redirectChain ?? [],
    headers: {},
    parsed: parsePage(html, finalUrl),
    error: null,
    fetchDurationMs: 1,
    extractions: [],
    vitals: null,
  };
}

function indexOf(pages: CrawledPage[]): CrawlIndex {
  return {
    pages: new Map(pages.map((item) => [item.url, item])),
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

async function run(checks: CheckFn[], index: CrawlIndex): Promise<Issue[]> {
  return (
    await Promise.all(checks.map((check) => Promise.resolve(check(index))))
  ).flat();
}

describe("audit intelligence pack", () => {
  it("extracts structural evidence once and emits explainable markup issues", async () => {
    const repeatedNodes = "<span></span>".repeat(1_501);
    const html = `<html><head><meta name="viewport" content=""></head><body>
      <div id="offer"></div><section id="offer"></section>
      <img src="/hero.webp" alt="Hero">
      <picture><source srcset="/hero.avif"></picture>
      ${repeatedNodes}
    </body></html>`;
    const parsed = parsePage(html, "https://example.com/");
    expect(parsed.viewportContent).toBeNull();
    expect(parsed.duplicateIds).toEqual(["offer"]);
    expect(parsed.imagesWithoutDimensions).toEqual(["/hero.webp"]);
    expect(parsed.picturesMissingImg).toBe(1);
    expect(parsed.domNodeCount).toBeGreaterThan(1_500);

    const index = indexOf([page("https://example.com/", html)]);
    const issues = await run([...markupChecks, ...imageChecks], index);
    const ids = new Set(issues.map((issue) => issue.id));
    for (const id of [
      "viewport-missing-or-empty",
      "duplicate-dom-id",
      "large-dom",
      "image-dimensions-missing",
      "picture-img-fallback-missing",
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("reports source pages that link through redirects and weak deep paths", async () => {
    const root = page(
      "https://example.com/",
      '<html><head><meta name="viewport" content="width=device-width"></head><body><a href="/legacy">Legacy</a><a href="/a">A</a></body></html>',
    );
    const redirect = page(
      "https://example.com/legacy",
      '<html><head><meta name="viewport" content="width=device-width"></head><body><a href="/">Home</a></body></html>',
      {
        depth: 1,
        discoveredFrom: root.url,
        finalUrl: "https://example.com/new",
        redirectChain: [
          "https://example.com/legacy",
          "https://example.com/new",
        ],
      },
    );
    const a = page(
      "https://example.com/a",
      '<html><body><a href="/b">B</a></body></html>',
      { depth: 1, discoveredFrom: root.url },
    );
    const b = page(
      "https://example.com/b",
      '<html><body><a href="/c">C</a></body></html>',
      { depth: 2, discoveredFrom: a.url },
    );
    const c = page(
      "https://example.com/c",
      '<html><body><a href="/deep">Deep</a></body></html>',
      { depth: 3, discoveredFrom: b.url },
    );
    const deep = page(
      "https://example.com/deep",
      '<html><head><meta name="viewport" content="width=device-width"></head><body><a href="/">Home</a></body></html>',
      { depth: 4, discoveredFrom: c.url },
    );
    const issues = await run(
      linkChecks,
      indexOf([root, redirect, a, b, c, deep]),
    );
    expect(
      issues.find((issue) => issue.id === "internal-link-to-redirect")?.urls,
    ).toEqual([root.url]);
    expect(
      issues.find((issue) => issue.id === "excessive-click-depth")?.urls,
    ).toEqual([deep.url]);
    const deepEvidence = (
      issues.find((issue) => issue.id === "excessive-click-depth")?.detail
        ?.pages as Array<{ url: string; path: string[] }>
    ).find((item) => item.url === deep.url);
    expect(deepEvidence?.path).toEqual([
      root.url,
      a.url,
      b.url,
      c.url,
      deep.url,
    ]);
    expect(
      issues.find((issue) => issue.id === "low-inlink-discoverability")?.urls,
    ).toContain(deep.url);
  });

  it("recomputes deterministic shortest click paths after concurrent discovery", async () => {
    const root = page(
      "https://example.com/",
      '<html><body><a href="/slow-shortcut">Shortcut</a><a href="/a">A</a></body></html>',
    );
    const a = page(
      "https://example.com/a",
      '<html><body><a href="/b">B</a></body></html>',
      { depth: 1, discoveredFrom: root.url },
    );
    const b = page(
      "https://example.com/b",
      '<html><body><a href="/target">Target</a></body></html>',
      { depth: 2, discoveredFrom: a.url },
    );
    const shortcut = page(
      "https://example.com/slow-shortcut",
      '<html><body><a href="/target">Target</a></body></html>',
      { depth: 1, discoveredFrom: root.url },
    );
    const target = page(
      "https://example.com/target",
      "<html><body></body></html>",
      // Simulate the longer worker completing first.
      { depth: 3, discoveredFrom: b.url },
    );
    const pages = new Map(
      [root, a, b, shortcut, target].map((item) => [item.url, item]),
    );

    stabilizeCrawlDiscovery(pages, [root.url]);

    expect(target.crawlDepth).toBe(2);
    expect(target.discoveredFrom).toBe(shortcut.url);
    const depthIssue = (
      await run(linkChecks, indexOf([...pages.values()]))
    ).find((issue) => issue.id === "excessive-click-depth");
    expect(depthIssue).toBeUndefined();
  });

  it("distinguishes hreflang implementation defects from intent reviews", async () => {
    const relative = page(
      "https://example.com/en",
      '<html lang="en"><head><link rel="alternate" hreflang="fr" href="/fr"></head><body></body></html>',
    );
    const mismatch = page(
      "https://example.com/fr",
      '<html lang="en"><head><link rel="alternate" hreflang="fr" href="https://example.com/fr"><link rel="alternate" hreflang="x-default" href="https://example.com/"></head><body></body></html>',
    );
    const issues = await run(hreflangChecks, indexOf([relative, mismatch]));
    const ids = new Set(issues.map((issue) => issue.id));
    expect(ids.has("hreflang-relative-url")).toBe(true);
    expect(ids.has("hreflang-self-reference-missing")).toBe(true);
    expect(ids.has("hreflang-x-default-missing")).toBe(true);
    expect(ids.has("hreflang-html-lang-mismatch")).toBe(true);
  });
});
