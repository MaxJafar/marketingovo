// Full-pipeline integration test: spin up the fixture site, run a real
// crawl, then assert the issues we expect to surface.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startFixtureSite, type FixtureSite } from "./fixtures-site.js";
import { crawl } from "../../src/orchestrator.js";

let site: FixtureSite;
beforeAll(async () => {
  // The fixture server lives on 127.0.0.1. Several checks (sitemap
  // fetch in particular) call loadLimits() internally and need
  // allowPrivate=true. We set the env var so any internal loadLimits()
  // resolves to the same value the crawl() call is given.
  process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
  site = await startFixtureSite();
});
afterAll(async () => {
  await site.close();
});

describe("full pipeline against fixture site", () => {
  it("flags every issue category we have a check for", async () => {
    const result = await crawl({
      startUrl: `${site.baseUrl}/`,
      seedUrls: [`${site.baseUrl}/orphan`],
      limits: {
        maxUrls: 60,
        maxRuntimeMs: 30_000,
        requestsPerSecond: 100,
        requestTimeoutMs: 10_000,
        allowPrivate: true, // fixture server lives on 127.0.0.1
      },
    });
    const ids = result.report.issues.map((i) => i.id);
    // Response code
    expect(ids).toContain("internal-4xx");
    // Page titles
    expect(ids).toContain("title-missing");
    // H1
    expect(ids).toContain("h1-missing");
    expect(ids).toContain("h1-multiple");
    // Directives
    expect(ids).toContain("noindex");
    // Security
    expect(ids.some((x) => x.startsWith("header-missing-"))).toBe(true);
    // Orphan
    expect(ids).toContain("orphan-page");
    // Soft-404
    expect(ids).toContain("soft-404");
    // JSON-LD
    expect(ids).toContain("jsonld-parse-error");
    // Hreflang
    expect(ids).toContain("hreflang-no-reciprocal");
    // Near-duplicate titles
    expect(ids).toContain("title-near-duplicate");
    // Sitemap cross-check
    expect(ids).toContain("sitemap-4xx");
    expect(result.report.sitemap).toMatchObject({
      state: "available",
      files: [{ kind: "sitemapindex" }, { kind: "urlset", locCount: 3 }],
    });
    expect(result.report.sitemap?.pageUrls).toContain(`${site.baseUrl}/broken`);
  }, 60_000);
});
