import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadLimits,
  MAX_URLS_CONFIGURATION_BOUNDARY,
  validateMaxUrls,
} from "../src/core/limits.js";
import { crawl } from "../src/orchestrator.js";

describe("loadLimits", () => {
  const saved: Record<string, string | undefined> = {};
  const envKeys = [
    "AGENTSEO_MAX_URLS",
    "AGENTSEO_MAX_RUNTIME_MS",
    "AGENTSEO_MAX_CONCURRENCY",
    "AGENTSEO_REQUESTS_PER_SECOND",
    "AGENTSEO_REQUEST_TIMEOUT_MS",
    "AGENTSEO_MAX_BODY_BYTES",
    "AGENTSEO_MAX_REDIRECTS",
    "AGENTSEO_USER_AGENT",
    "AGENTSEO_ALLOW_PRIVATE",
    "AGENTSEO_IGNORE_ROBOTS",
    "AGENTSEO_RENDER",
    "AGENTSEO_HEADERS",
    "AGENTSEO_KEEP_HTML",
    "GOLEMSEO_MAX_URLS",
    "GOLEMSEO_MAX_RUNTIME_MS",
    "GOLEMSEO_MAX_CONCURRENCY",
    "GOLEMSEO_REQUESTS_PER_SECOND",
    "GOLEMSEO_REQUEST_TIMEOUT_MS",
    "GOLEMSEO_MAX_BODY_BYTES",
    "GOLEMSEO_MAX_REDIRECTS",
    "GOLEMSEO_USER_AGENT",
    "GOLEMSEO_ALLOW_PRIVATE",
    "GOLEMSEO_IGNORE_ROBOTS",
    "GOLEMSEO_RENDER",
    "GOLEMSEO_HEADERS",
    "GOLEMSEO_KEEP_HTML",
    "GOLEM_SEO_MAX_URLS",
    "GOLEM_SEO_MAX_RUNTIME_MS",
    "GOLEM_SEO_MAX_CONCURRENCY",
    "GOLEM_SEO_REQUESTS_PER_SECOND",
    "GOLEM_SEO_REQUEST_TIMEOUT_MS",
    "GOLEM_SEO_MAX_BODY_BYTES",
    "GOLEM_SEO_MAX_REDIRECTS",
    "GOLEM_SEO_USER_AGENT",
    "GOLEM_SEO_ALLOW_PRIVATE",
    "GOLEM_SEO_IGNORE_ROBOTS",
    "GOLEM_SEO_RENDER",
    "GOLEM_SEO_HEADERS",
    "GOLEM_SEO_KEEP_HTML",
    "SCREAMINGCLAW_MAX_URLS",
    "SCREAMINGCLAW_MAX_RUNTIME_MS",
    "SCREAMINGCLAW_MAX_CONCURRENCY",
    "SCREAMINGCLAW_REQUESTS_PER_SECOND",
    "SCREAMINGCLAW_REQUEST_TIMEOUT_MS",
    "SCREAMINGCLAW_MAX_BODY_BYTES",
    "SCREAMINGCLAW_MAX_REDIRECTS",
    "SCREAMINGCLAW_USER_AGENT",
    "SCREAMINGCLAW_ALLOW_PRIVATE",
    "SCREAMINGCLAW_IGNORE_ROBOTS",
    "SCREAMINGCLAW_RENDER",
    "SCREAMINGCLAW_HEADERS",
    "SCREAMINGCLAW_KEEP_HTML",
  ];

  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns safe defaults", () => {
    const l = loadLimits();
    expect(l.maxUrls).toBe(500);
    expect(l.maxRuntimeMs).toBe(300_000);
    expect(l.maxConcurrency).toBe(4);
    expect(l.requestsPerSecond).toBe(5);
    expect(l.requestTimeoutMs).toBe(15_000);
    expect(l.maxBodyBytes).toBe(5 * 1024 * 1024);
    expect(l.maxRedirects).toBe(5);
    expect(l.allowPrivate).toBe(false);
    expect(l.ignoreRobots).toBe(false);
    expect(l.renderMode).toBe("static");
    expect(l.customHeaders).toEqual({});
    expect(l.userAgent).toBe("AGENTseo/1.0.0");
  });

  it("parses renderMode and customHeaders from env", () => {
    process.env.SCREAMINGCLAW_RENDER = "js";
    process.env.SCREAMINGCLAW_HEADERS = "X-Test: 1|Authorization: Bearer x";
    const l = loadLimits();
    expect(l.renderMode).toBe("js");
    expect(l.customHeaders).toEqual({
      "X-Test": "1",
      Authorization: "Bearer x",
    });
  });

  it("accepts a large user-selected crawl scope", () => {
    process.env.GOLEMSEO_MAX_URLS = "250000";
    expect(loadLimits().maxUrls).toBe(250_000);
  });

  it("prefers the canonical crawl scope over both legacy spellings", () => {
    process.env.AGENTSEO_MAX_URLS = "321";
    process.env.GOLEMSEO_MAX_URLS = "654";
    process.env.GOLEM_SEO_MAX_URLS = "987";
    expect(loadLimits().maxUrls).toBe(321);
  });

  it("clamps corrupt env values to defensive configuration boundaries", () => {
    process.env.SCREAMINGCLAW_MAX_URLS = "9999999";
    process.env.SCREAMINGCLAW_MAX_CONCURRENCY = "99999";
    process.env.SCREAMINGCLAW_REQUESTS_PER_SECOND = "99999";
    process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
    const l = loadLimits();
    expect(l.maxUrls).toBe(MAX_URLS_CONFIGURATION_BOUNDARY);
    expect(l.maxConcurrency).toBe(32);
    expect(l.requestsPerSecond).toBe(50);
    expect(l.allowPrivate).toBe(true);
  });

  it("falls back on garbage values", () => {
    process.env.SCREAMINGCLAW_MAX_URLS = "banana";
    const l = loadLimits();
    expect(l.maxUrls).toBe(500);
  });

  it("validates explicit crawl scopes without imposing a product quota", () => {
    expect(validateMaxUrls(750_000)).toBe(750_000);
    expect(validateMaxUrls(MAX_URLS_CONFIGURATION_BOUNDARY)).toBe(
      MAX_URLS_CONFIGURATION_BOUNDARY,
    );
    expect(() => validateMaxUrls(Number.POSITIVE_INFINITY)).toThrow(
      /positive finite integer/,
    );
    expect(() => validateMaxUrls(MAX_URLS_CONFIGURATION_BOUNDARY + 1)).toThrow(
      /configuration safety boundary/,
    );
  });

  it("rejects a corrupt direct crawl override before network work", async () => {
    await expect(
      crawl({
        startUrl: "https://example.com/",
        limits: { maxUrls: Number.POSITIVE_INFINITY },
      }),
    ).rejects.toThrow(/positive finite integer/);
  });
});
