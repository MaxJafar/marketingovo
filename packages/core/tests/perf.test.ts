// Performance regression test: ensures the static pipeline can
// crawl a 20-page fixture in well under 5 seconds. If a change
// makes this much slower, fail loudly.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startFixtureSite,
  type FixtureSite,
} from "./integration/fixtures-site.js";
import { crawl } from "../src/orchestrator.js";

let site: FixtureSite;
beforeAll(async () => {
  // Fixture server lives on 127.0.0.1, allow loopback in the SSRF guard.
  process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
  site = await startFixtureSite();
});
afterAll(async () => {
  await site.close();
});

describe("performance budget", () => {
  it("crawls 20 pages under 5s in static mode", async () => {
    const t0 = Date.now();
    const result = await crawl({
      startUrl: `${site.baseUrl}/`,
      limits: {
        maxUrls: 60,
        maxRuntimeMs: 30_000,
        maxConcurrency: 8,
        requestsPerSecond: 100,
        requestTimeoutMs: 10_000,
        allowPrivate: true, // fixture server lives on 127.0.0.1
      },
    });
    const elapsed = Date.now() - t0;
    expect(result.report.summary.pagesCrawled).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(5_000);
  }, 30_000);
});
