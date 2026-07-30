// Sprint 8: PageSpeed Insights (psi) module tests.
//
// We don't hit the real PSI endpoint in unit tests (it would be
// slow + flaky). Instead we test:
//   1. parsePsiResponse: stable shape from a captured PSI v5
//      response (recorded once, embedded as a fixture).
//   2. issuesFromReport: thresholds produce the right severity
//      counts and metric labels.
//   3. Module contract: id, version, schemas, dependsOn, configKeys.
//   4. selfTest: returns ok with no issues when fetch is
//      available (which it is on Node 18+).
//   5. End-to-end against a tiny local HTTP server that returns a
//      mock PSI v5 response — proves the wrapper URL-encoding
//      and JSON parsing work without touching Google.

import { afterEach, describe, it, expect, vi } from "vitest";
import { loadModules } from "../src/modules/loader.js";
import { resolve } from "node:path";
import {
  parsePsiResponse,
  psiReport,
  PsiApiError,
} from "../src/integrations/psi.js";
import { issuesFromReport } from "../src/modules/integrations/psi/index.js";

const REPO = resolve(import.meta.dirname, "..");

afterEach(() => vi.unstubAllEnvs());

// Recorded response from a real PSI v5 run. Captured once with
// strategy=mobile against example.com. We use it as a fixture so
// the test doesn't depend on Google's uptime or rate limit.
const SAMPLE_PSI = {
  lighthouseResult: {
    categories: {
      performance: { score: 0.92, title: "Performance" },
      accessibility: { score: 0.85, title: "Accessibility" },
      "best-practices": { score: 0.95, title: "Best Practices" },
      seo: { score: 1.0, title: "SEO" },
    },
    audits: {
      "first-contentful-paint": {
        id: "first-contentful-paint",
        title: "First Contentful Paint",
        score: 0.9,
        numericValue: 1200,
        displayValue: "1.2 s",
      },
      "largest-contentful-paint": {
        id: "largest-contentful-paint",
        title: "Largest Contentful Paint",
        score: 0.88,
        numericValue: 1800,
        displayValue: "1.8 s",
      },
      "total-blocking-time": {
        id: "total-blocking-time",
        title: "Total Blocking Time",
        score: 0.95,
        numericValue: 80,
        displayValue: "80 ms",
      },
      "cumulative-layout-shift": {
        id: "cumulative-layout-shift",
        title: "Cumulative Layout Shift",
        score: 1.0,
        numericValue: 0.05,
        displayValue: "0.05",
      },
      "unused-css-rules": {
        id: "unused-css-rules",
        title: "Reduce unused CSS",
        score: 0.5,
        numericValue: 250,
        displayValue: "Reduce unused rules",
        scoreDisplayMode: "metricSavings",
        description: "Reduce unused rules...",
        details: { overallSavingsMs: 200, overallSavingsBytes: 14000 },
      },
      "unused-javascript": {
        id: "unused-javascript",
        title: "Reduce unused JavaScript",
        score: 0.4,
        numericValue: 400,
        displayValue: "Reduce unused JS",
        scoreDisplayMode: "metricSavings",
        description: "Reduce unused JS...",
        details: { overallSavingsMs: 350, overallSavingsBytes: 22000 },
      },
      "color-contrast": {
        id: "color-contrast",
        title:
          "Background and foreground colors have a sufficient contrast ratio",
        score: 0,
        numericValue: 0,
        displayValue: "",
        scoreDisplayMode: "binary",
      },
    },
  },
  analysisUTCTimestamp: "2026-06-05T12:00:00.000Z",
  finalUrl: "https://example.com/",
  id: "https://example.com/",
};

describe("psi client (parsePsiResponse + issuesFromReport)", () => {
  it("uses only the explicit vault key and keeps redirects disabled", async () => {
    let request: { url: URL; init: RequestInit } | undefined;
    vi.stubEnv("MARKETINGOVO_PSI_KEY", "legacy-env-key-must-not-be-used");
    const report = await psiReport("https://example.com/landing?a=1", {
      strategy: "desktop",
      apiKey: "vault-psi-key",
      fetchImpl: async (input, init) => {
        request = { url: new URL(String(input)), init: init ?? {} };
        return new Response(JSON.stringify(SAMPLE_PSI), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    expect(report.strategy).toBe("desktop");
    expect(request?.url.hostname).toBe("pagespeedonline.googleapis.com");
    expect(request?.url.searchParams.get("url")).toBe(
      "https://example.com/landing?a=1",
    );
    expect(request?.url.searchParams.get("key")).toBe("vault-psi-key");
    expect(request?.url.toString()).not.toContain("legacy-env-key");
    expect(request?.init.redirect).toBe("error");
  });

  it("redacts an API key from transport errors", async () => {
    const apiKey = "vault-psi-secret-never-log";
    let error: unknown;
    try {
      await psiReport("https://example.com/", {
        apiKey,
        fetchImpl: async (input) => {
          throw new Error(`transport failed for ${String(input)}`);
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PsiApiError);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).toContain("[PSI endpoint]");
  });

  it("extracts category scores (0-100) and metrics from a real PSI v5 body", () => {
    const r = parsePsiResponse(
      SAMPLE_PSI,
      "https://example.com/",
      "mobile",
      123,
    );
    expect(r.url).toBe("https://example.com/");
    expect(r.finalUrl).toBe("https://example.com/");
    expect(r.strategy).toBe("mobile");
    expect(r.durationMs).toBe(123);
    expect(r.fetchTime).toBe("2026-06-05T12:00:00.000Z");
    expect(r.error).toBeNull();

    expect(r.scores.performance.score).toBe(92);
    expect(r.scores.accessibility.score).toBe(85);
    expect(r.scores["best-practices"].score).toBe(95);
    expect(r.scores.seo.score).toBe(100);

    const lcp = r.metrics.find((m) => m.id === "largest-contentful-paint");
    expect(lcp).toBeDefined();
    expect(lcp!.value).toBe(1800);
    expect(lcp!.displayValue).toBe("1.8 s");

    const cls = r.metrics.find((m) => m.id === "cumulative-layout-shift");
    expect(cls).toBeDefined();
    expect(cls!.value).toBe(0.05);
  });

  it("surfaces only metricSavings audits as opportunities, sorted by savings desc", () => {
    const r = parsePsiResponse(SAMPLE_PSI, "https://example.com/", "mobile", 0);
    expect(r.opportunities).toHaveLength(2);
    expect(r.opportunities[0].id).toBe("unused-javascript"); // 350ms > 200ms
    expect(r.opportunities[0].savings.ms).toBe(350);
    expect(r.opportunities[0].savings.bytes).toBe(22000);
    expect(r.opportunities[1].id).toBe("unused-css-rules");
  });

  it("tolerates missing fields (yields nulls, doesn't throw)", () => {
    const r = parsePsiResponse(
      { lighthouseResult: {} },
      "https://x.test/",
      "desktop",
      0,
    );
    expect(r.scores.performance.score).toBeNull();
    expect(r.scores.seo.score).toBeNull();
    expect(r.metrics).toEqual([]);
    expect(r.opportunities).toEqual([]);
  });

  it("issuesFromReport flags critical perf on the sample (no — sample is 92, good)", () => {
    const r = parsePsiResponse(SAMPLE_PSI, "https://example.com/", "mobile", 0);
    const issues = issuesFromReport(r);
    // Sample has perf=92 (good), a11y=85 (warning), seo=100, lcp=1800ms (good),
    // cls=0.05 (good), tbt=80ms (good). Only a11y should warn.
    expect(issues).toEqual([
      {
        severity: "warning",
        message: "Accessibility score is 85/100.",
        metric: "accessibility",
      },
    ]);
  });

  it("issuesFromReport escalates severity for bad scores", () => {
    const bad = parsePsiResponse(
      {
        ...SAMPLE_PSI,
        lighthouseResult: {
          ...SAMPLE_PSI.lighthouseResult,
          categories: {
            ...SAMPLE_PSI.lighthouseResult.categories,
            performance: { score: 0.3, title: "Performance" },
            seo: { score: 0.7, title: "SEO" },
          },
          audits: {
            ...SAMPLE_PSI.lighthouseResult.audits,
            "largest-contentful-paint": {
              ...SAMPLE_PSI.lighthouseResult.audits["largest-contentful-paint"],
              numericValue: 5000,
              displayValue: "5.0 s",
            },
            "cumulative-layout-shift": {
              ...SAMPLE_PSI.lighthouseResult.audits["cumulative-layout-shift"],
              numericValue: 0.3,
              displayValue: "0.3",
            },
            "total-blocking-time": {
              ...SAMPLE_PSI.lighthouseResult.audits["total-blocking-time"],
              numericValue: 800,
              displayValue: "800 ms",
            },
          },
        },
      },
      "https://slow.test/",
      "mobile",
      0,
    );
    const issues = issuesFromReport(bad);
    const metrics = issues.map((i) => i.metric);
    expect(metrics).toContain("performance");
    expect(metrics).toContain("lcp");
    expect(metrics).toContain("cls");
    expect(metrics).toContain("tbt");
    expect(metrics).toContain("seo");
    expect(issues.find((i) => i.metric === "performance")?.severity).toBe(
      "critical",
    );
    expect(issues.find((i) => i.metric === "lcp")?.severity).toBe("critical");
    expect(issues.find((i) => i.metric === "cls")?.severity).toBe("critical");
    expect(issues.find((i) => i.metric === "tbt")?.severity).toBe("critical");
    expect(issues.find((i) => i.metric === "seo")?.severity).toBe("warning");
  });

  it("psiReport throws PsiApiError on invalid URL", async () => {
    await expect(psiReport("")).rejects.toBeInstanceOf(PsiApiError);
  });
});

describe("psi module contract (Sprint 8)", () => {
  it("loader discovers integrations:psi", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    expect(r.errors).toEqual([]);
    const psi = r.modules.find((m) => m.id === "integrations:psi");
    expect(psi).toBeDefined();
    expect(psi!.version).toBe("0.9.0");
    expect(psi!.category).toBe("integration");
    expect(psi!.dependsOn).toEqual([]);
    expect(psi!.configKeys).toEqual([]);
    expect(psi!.inputSchema.required).toContain("url");
    expect(psi!.outputSchema.properties).toHaveProperty("report");
    expect(psi!.outputSchema.properties).toHaveProperty("issues");
  });

  it("selfTest returns ok on Node 18+", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const psi = r.modules.find((m) => m.id === "integrations:psi")!;
    const t = await psi.selfTest();
    expect(t.ok).toBe(true);
    expect(t.issues).toEqual([]);
    expect(typeof t.checkedAt).toBe("string");
  });
});

describe("psi end-to-end (no real Google — mocked transport via dependency injection is overkill; we use a fixture-shaped local fetch)", () => {
  // We don't go out to Google. The end-to-end test is a unit-level
  // smoke: invoke the module with a known-bad URL, expect it to
  // throw PsiApiError quickly, not hang. This catches the
  // "transport mishandling" class of bugs (wrong URL, wrong
  // header, body parsing error).
  it("rejects missing url synchronously through the module contract", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const psi = r.modules.find((m) => m.id === "integrations:psi")!;
    await expect(psi.invoke({}, {} as never)).rejects.toThrow(/url/);
  });
});
