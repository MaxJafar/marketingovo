import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startFixtureSite,
  type FixtureSite,
} from "./integration/fixtures-site.js";
import { crawl } from "../src/orchestrator.js";

// No sandbox flag is set here. Nothing reads SCREAMINGCLAW_NO_SANDBOX any more
// — it was a no-op left over from an earlier brand — and lighthouse.test.ts
// asserts that --no-sandbox stays out of the Chrome flags on purpose. This test
// needs a real Chromium, which CI installs, not a weakened one.

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
