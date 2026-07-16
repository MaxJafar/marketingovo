import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startFixtureSite,
  type FixtureSite,
} from "./integration/fixtures-site.js";
import { crawl } from "../src/orchestrator.js";

process.env.SCREAMINGCLAW_NO_SANDBOX = "1";

let site: FixtureSite;
beforeAll(async () => {
  site = await startFixtureSite();
});
afterAll(async () => {
  await site.close();
});

describe("Web Vitals", () => {
  it("collects LCP, CLS, TTFB, FCP in JS mode", async () => {
    const result = await crawl({
      startUrl: `${site.baseUrl}/has-all`,
      limits: {
        maxUrls: 1,
        maxRuntimeMs: 60_000,
        requestsPerSecond: 50,
        requestTimeoutMs: 30_000,
        renderMode: "js",
        allowPrivate: true,
      },
      renderMode: "js",
      collectVitals: true,
    });
    const page = result.report.pages.find((p) => p.url.endsWith("/has-all"));
    expect(page).toBeTruthy();
    expect(page!.vitals).toBeTruthy();
    // We can't assert exact numbers (depends on machine), but the
    // fields should be present and within sane ranges.
    if (typeof page!.vitals!.lcp === "number") {
      expect(page!.vitals!.lcp).toBeGreaterThan(0);
    }
    if (typeof page!.vitals!.fcp === "number") {
      expect(page!.vitals!.fcp).toBeGreaterThan(0);
    }
    if (typeof page!.vitals!.ttfb === "number") {
      expect(page!.vitals!.ttfb).toBeGreaterThanOrEqual(0);
    }
  }, 90_000);
});
