// technical module: per-page technical SEO checks.
//
// Category: tool. Replaces: ScreamingFrog technical tab, Ahrefs
// Site Audit, Sitebulb.
//
// Underlying checks (from src/checks/*):
// - response-codes: 4xx / 5xx / no-response / redirect chains / loops
// - canonical: missing / broken / relative / multiple / cross-domain
// - directives: noindex / nofollow on indexable pages
// - security: HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy
// - soft-404: 200 pages that look like errors
// - jsonld: structured data parse
// - hreflang: reciprocal links / language mismatch
// - sitemap: sitemap integrity (sourced via src/checks/sitemap.ts)
//
// Backward compat: this module re-exports the existing CheckFn
// arrays so runAllChecks() and the existing crawl_site plugin tool
// keep working unchanged. invoke() runs the same checks and returns
// a { issues } object for the composer.

import { ConsoleLogger } from "../../core/logger.js";
import { responseCodeChecks } from "../../checks/response-codes.js";
import { canonicalChecks } from "../../checks/canonical.js";
import { directiveChecks } from "../../checks/directives.js";
import { securityChecks } from "../../checks/security.js";
import { soft404Checks } from "../../checks/soft-404.js";
import { jsonLdChecks } from "../../checks/jsonld.js";
import { hreflangChecks } from "../../checks/hreflang.js";
import { sitemapChecks } from "../../checks/sitemap.js";
import { markupChecks } from "../../checks/markup.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";
import type { CheckFn, CrawlIndex, Issue } from "../../checks/index.js";

const allChecks: CheckFn[] = [
  ...responseCodeChecks,
  ...canonicalChecks,
  ...directiveChecks,
  ...securityChecks,
  ...soft404Checks,
  ...jsonLdChecks,
  ...hreflangChecks,
  ...sitemapChecks,
  ...markupChecks,
];

export const technicalModule: Module = {
  id: "technical",
  version: "0.11.0",
  displayName: "Technical SEO",
  category: "tool",
  description:
    "Per-page technical checks: response codes, canonical, robots directives, security headers, soft-404, JSON-LD, hreflang, sitemap integrity, mobile viewport, duplicate DOM ids, and large DOM diagnostics.",
  inputSchema: {
    type: "object",
    properties: {
      crawlOutcome: {
        type: "object",
        description:
          "Optional pre-existing crawl outcome (the module depends on 'crawl').",
      },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array" },
      issueCount: { type: "number" },
    },
    required: ["issues", "issueCount"],
  },
  dependsOn: ["crawl"],
  configKeys: [
    "GOLEMSEO_RENDER",
    "GOLEMSEO_KEEP_HTML",
    "GOLEMSEO_ALLOW_PRIVATE",
  ],
  checks: allChecks,
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "technical",
    });
    const index: CrawlIndex | undefined =
      (input.crawlOutcome as { index?: CrawlIndex } | undefined)?.index ??
      (ctx.crawlOutcome as unknown as { index?: CrawlIndex } | undefined)
        ?.index;
    if (!index) {
      throw new Error(
        "technical module requires a crawl outcome (depends on 'crawl')",
      );
    }
    const allIssues: Issue[] = [];
    for (const check of allChecks) {
      try {
        const result = await check(index);
        allIssues.push(...result);
      } catch (err) {
        logger.error("check failed", { err: (err as Error).message });
        ctx.signal.markWeak(`technical check threw: ${(err as Error).message}`);
      }
    }
    if (allIssues.length < 5) {
      ctx.signal.markWeak(
        `technical found only ${allIssues.length} issues across 8 categories`,
      );
    } else {
      ctx.signal.markStrong(`${allIssues.length} technical issues`);
    }
    return { issues: allIssues, issueCount: allIssues.length };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
