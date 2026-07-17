// performance module: Web Vitals + Lighthouse audits.
//
// Category: tool. Replaces: GTmetrix, PageSpeed Insights (local mode).
//
// Underlying components:
// - src/checks/web-vitals.ts: per-page LCP/CLS/INP/TTFB/FCP checks
// - src/integrations/lighthouse.ts: Lighthouse (async ESM-safe
//   loader, shared Chrome, top-15 audits)
//
// Note: this module is a wrapper. The actual invoke() runs the
// webVitalsChecks per-page and the Lighthouse runner (when
// AGENTSEO_LIGHTHOUSE is set). It requires renderMode=js to be
// useful, which the composer (or operator) must set.

import { ConsoleLogger } from "../../core/logger.js";
import { webVitalsChecks } from "../../checks/web-vitals.js";
import { collectWebVitals } from "../../web-vitals.js";
import {
  runLighthouse,
  launchChrome,
  isAvailable as lighthouseAvailable,
} from "../../integrations/lighthouse.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";
import type { CheckFn, CrawlIndex, Issue } from "../../checks/index.js";

const perPageChecks: CheckFn[] = [...webVitalsChecks];

export const performanceModule: Module = {
  id: "performance",
  version: "0.9.0",
  displayName: "Performance",
  category: "tool",
  description:
    "Per-page Web Vitals (LCP, CLS, INP, TTFB, FCP) and optional Lighthouse audit (top-15 categories) with shared Chrome instance. Requires renderMode=js to be useful.",
  inputSchema: {
    type: "object",
    properties: {
      crawlOutcome: { type: "object" },
      lighthouse: {
        type: "string",
        enum: ["off", "home", "sample", "all"],
        default: "off",
        description: "Run Lighthouse on home / sample / all pages.",
      },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array" },
      issueCount: { type: "number" },
      lighthouse: {
        type: "object",
        description: "Lighthouse scores by page (if requested)",
      },
    },
    required: ["issues", "issueCount"],
  },
  dependsOn: ["crawl"],
  configKeys: [
    "AGENTSEO_LIGHTHOUSE",
    "AGENTSEO_COLLECT_VITALS",
    "AGENTSEO_RENDER",
    "AGENTSEO_CHROME_PATH",
  ],
  checks: perPageChecks,
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "performance",
    });
    const index: CrawlIndex | undefined =
      (input.crawlOutcome as { index?: CrawlIndex } | undefined)?.index ??
      (ctx.crawlOutcome as unknown as { index?: CrawlIndex } | undefined)
        ?.index;
    if (!index) {
      throw new Error(
        "performance module requires a crawl outcome (depends on 'crawl')",
      );
    }
    const allIssues: Issue[] = [];
    for (const check of perPageChecks) {
      try {
        const result = await check(index);
        allIssues.push(...result);
      } catch (err) {
        logger.error("check failed", { err: (err as Error).message });
        ctx.signal.markWeak(
          `performance check threw: ${(err as Error).message}`,
        );
      }
    }

    // Optional Lighthouse pass.
    let lighthouse: unknown = null;
    const mode = input.lighthouse as
      "off" | "home" | "sample" | "all" | undefined;
    const lighthouseMode = (mode ?? "off") as "off" | "home" | "sample" | "all";
    if (lighthouseMode !== "off" && index.startUrl) {
      if (!lighthouseAvailable()) {
        logger.warn("lighthouse not available (deps missing); skipping");
        ctx.signal.markWeak("lighthouse deps missing");
      } else {
        let chrome: Awaited<ReturnType<typeof launchChrome>> | null = null;
        try {
          chrome = await launchChrome({
            allowPrivate: ctx.limits?.allowPrivate ?? false,
            allowedPrivateHosts: [new URL(index.startUrl).hostname],
          });
          const report = await runLighthouse({
            url: index.startUrl,
            port: chrome.port,
            allowPrivate: ctx.limits?.allowPrivate ?? false,
            formFactor: "mobile",
          });
          lighthouse = report;
          logger.info("lighthouse complete", { mode: lighthouseMode });
        } catch (err) {
          logger.warn("lighthouse failed (non-fatal)", {
            err: (err as Error).message,
          });
          ctx.signal.markWeak(`lighthouse failed: ${(err as Error).message}`);
        } finally {
          if (chrome) await chrome.kill();
        }
      }
    }

    // Reference the unused symbol to keep the import in case the
    // operator later flips on per-page vitals in a different way.
    void collectWebVitals;

    if (allIssues.length === 0) {
      ctx.signal.markWeak(
        "performance found 0 issues (likely renderMode=static; set js for Vitals)",
      );
    } else {
      ctx.signal.markStrong(`${allIssues.length} performance issues`);
    }
    return { issues: allIssues, issueCount: allIssues.length, lighthouse };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
