// integrations/psi: Google PageSpeed Insights fetcher.
//
// Category: integration. Replaces: PageSpeed Insights UI.
//
// Wraps src/integrations/psi.ts. Calls the public PSI v5 endpoint.
// No auth required for low-volume calls. The local runtime can inject an
// ephemeral vault-backed Google API key to lift provider quota.
//
// Composes with audit-full: a `psi` module instance is added to the
// composer pipeline if the user opts in via `modules: ["integrations:psi"]`.
// The module is lightweight (one HTTP call per URL), so it doesn't
// depend on crawl.

import { ConsoleLogger } from "../../../core/logger.js";
import {
  psiReport,
  isAvailable as psiAvailable,
  type PsiReport,
  type PsiStrategy,
  type PsiCategory,
} from "../../../integrations/psi.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../../types.js";

export const psiModule: Module = {
  id: "integrations:psi",
  version: "0.9.0",
  displayName: "PageSpeed Insights",
  category: "integration",
  description:
    "Run Google PageSpeed Insights v5 for a URL. Returns Lighthouse category scores (performance, accessibility, best-practices, SEO), Core Web Vitals (LCP, CLS, TBT, FCP, TTFB), and top opportunities sorted by potential savings. Strategy: mobile (default) or desktop. An optional Google API key is supplied ephemerally by the local vault.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to test. Required.",
      },
      strategy: {
        type: "string",
        enum: ["mobile", "desktop"],
        default: "mobile",
        description:
          "Test strategy. Mobile uses Moto G4 emulation; desktop uses no throttling.",
      },
      categories: {
        type: "array",
        items: {
          type: "string",
          enum: ["performance", "accessibility", "best-practices", "seo"],
        },
        default: ["performance", "accessibility", "best-practices", "seo"],
        description: "Categories to fetch. Default: all four.",
      },
    },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      report: { type: "object", description: "Typed PsiReport." },
      issues: {
        type: "array",
        description:
          "Issues derived from the scores (low perf, poor LCP, etc.).",
      },
    },
  },
  dependsOn: [],
  configKeys: [],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({ module: "psi" });
    if (!psiAvailable()) {
      throw new Error("global fetch() not available (Node < 18)");
    }
    const url = input.url as string | undefined;
    if (!url) throw new Error("psi module requires url in input");
    const strategy = (input.strategy as PsiStrategy | undefined) ?? "mobile";
    const categories =
      (input.categories as readonly PsiCategory[] | undefined) ?? [];
    const apiKey = ctx.integrationCredentials?.["pagespeed-insights"]?.apiKey;
    const report = await psiReport(url, {
      strategy,
      categories,
      ...(typeof apiKey === "string" ? { apiKey } : {}),
    });

    const issues = issuesFromReport(report);
    if (issues.length === 0) {
      ctx.signal.markStrong(
        `psi: scores ${formatScores(report)} (${report.opportunities.length} opportunities)`,
      );
    } else {
      ctx.signal.markWeak(
        `psi: ${issues.length} issues (${formatScores(report)})`,
      );
    }
    logger.info("psi fetch complete", {
      strategy,
      perf: report.scores.performance.score,
      a11y: report.scores.accessibility.score,
      lcp: report.metrics.find((m) => m.id === "largest-contentful-paint")
        ?.displayValue,
    });
    return { report, issues } as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    if (!psiAvailable()) {
      return {
        ok: false,
        issues: ["global fetch() not available (Node < 18)"],
        checkedAt: new Date().toISOString(),
      };
    }
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};

function formatScores(r: PsiReport): string {
  return `perf=${r.scores.performance.score ?? "?"} a11y=${r.scores.accessibility.score ?? "?"} bp=${r.scores["best-practices"].score ?? "?"} seo=${r.scores.seo.score ?? "?"}`;
}

/**
 * Turn a PSI report into the same issue shape the rest of golem-seo
 * uses. Thresholds:
 *   - performance < 50 → "critical" issue
 *   - performance < 90 → "warning"
 *   - accessibility < 90 → "warning"
 *   - LCP > 4000ms → "critical", > 2500ms → "warning"
 *   - CLS > 0.25 → "critical", > 0.1 → "warning"
 *   - TBT > 600ms → "critical", > 200ms → "warning"
 */
export function issuesFromReport(r: PsiReport): Array<{
  severity: "critical" | "warning";
  message: string;
  metric?: string;
}> {
  const issues: Array<{
    severity: "critical" | "warning";
    message: string;
    metric?: string;
  }> = [];
  const perf = r.scores.performance.score;
  if (perf !== null) {
    if (perf < 50)
      issues.push({
        severity: "critical",
        message: `Performance score is ${perf}/100 (critical).`,
        metric: "performance",
      });
    else if (perf < 90)
      issues.push({
        severity: "warning",
        message: `Performance score is ${perf}/100 (warning).`,
        metric: "performance",
      });
  }
  const a11y = r.scores.accessibility.score;
  if (a11y !== null && a11y < 90) {
    issues.push({
      severity: "warning",
      message: `Accessibility score is ${a11y}/100.`,
      metric: "accessibility",
    });
  }
  const seo = r.scores.seo.score;
  if (seo !== null && seo < 90) {
    issues.push({
      severity: "warning",
      message: `SEO score is ${seo}/100.`,
      metric: "seo",
    });
  }
  const lcp = r.metrics.find((m) => m.id === "largest-contentful-paint");
  if (lcp && lcp.value > 0) {
    if (lcp.value > 4000)
      issues.push({
        severity: "critical",
        message: `LCP is ${lcp.displayValue} (slow).`,
        metric: "lcp",
      });
    else if (lcp.value > 2500)
      issues.push({
        severity: "warning",
        message: `LCP is ${lcp.displayValue}.`,
        metric: "lcp",
      });
  }
  const cls = r.metrics.find((m) => m.id === "cumulative-layout-shift");
  if (cls && cls.value > 0) {
    if (cls.value > 0.25)
      issues.push({
        severity: "critical",
        message: `CLS is ${cls.displayValue} (high).`,
        metric: "cls",
      });
    else if (cls.value > 0.1)
      issues.push({
        severity: "warning",
        message: `CLS is ${cls.displayValue}.`,
        metric: "cls",
      });
  }
  const tbt = r.metrics.find((m) => m.id === "total-blocking-time");
  if (tbt && tbt.value > 0) {
    if (tbt.value > 600)
      issues.push({
        severity: "critical",
        message: `TBT is ${tbt.displayValue} (high).`,
        metric: "tbt",
      });
    else if (tbt.value > 200)
      issues.push({
        severity: "warning",
        message: `TBT is ${tbt.displayValue}.`,
        metric: "tbt",
      });
  }
  return issues;
}
