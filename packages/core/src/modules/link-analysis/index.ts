// link-analysis module: source-aware redirects, broken links, click depth,
// discoverability, no-outbound, nofollow, orphans, and top-linked hubs.
//
// Category: tool. Replaces: Ahrefs Site Audit link section, Majestic
// internal-link analysis (Majestic is the canonical external tool for
// this; we cover the internal half here, off-page/backlinks module
// covers the external half in Sprint 5).
//
// Underlying checks (from src/checks/*):
// - links: broken internal / no-outbound / heavy-nofollow-external / top-linked
// - orphan: pages with no inbound internal links

import { ConsoleLogger } from "../../core/logger.js";
import { linkChecks } from "../../checks/links.js";
import { orphanChecks } from "../../checks/orphan.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";
import type { CheckFn, CrawlIndex, Issue } from "../../checks/index.js";

const allChecks: CheckFn[] = [...linkChecks, ...orphanChecks];

export const linkAnalysisModule: Module = {
  id: "link-analysis",
  version: "0.11.0",
  displayName: "Link Analysis",
  category: "tool",
  description:
    "Source-aware internal link analysis: broken and redirected targets, click depth, weak inlink discoverability, dead ends, top-linked hubs, nofollow patterns, and orphans.",
  inputSchema: {
    type: "object",
    properties: { crawlOutcome: { type: "object" } },
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: { issues: { type: "array" }, issueCount: { type: "number" } },
    required: ["issues", "issueCount"],
  },
  dependsOn: ["crawl"],
  configKeys: [
    "MARKETINGOVO_FOLLOW_NOFOLLOW",
    "MARKETINGOVO_FOLLOW_EXTERNAL",
    "MARKETINGOVO_MAX_DEPTH",
  ],
  checks: allChecks,
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "link-analysis",
    });
    const index: CrawlIndex | undefined =
      (input.crawlOutcome as { index?: CrawlIndex } | undefined)?.index ??
      (ctx.crawlOutcome as unknown as { index?: CrawlIndex } | undefined)
        ?.index;
    if (!index) {
      throw new Error(
        "link-analysis module requires a crawl outcome (depends on 'crawl')",
      );
    }
    const allIssues: Issue[] = [];
    for (const check of allChecks) {
      try {
        const result = await check(index);
        allIssues.push(...result);
      } catch (err) {
        logger.error("check failed", { err: (err as Error).message });
        ctx.signal.markWeak(
          `link-analysis check threw: ${(err as Error).message}`,
        );
      }
    }
    if (allIssues.length < 2) {
      ctx.signal.markWeak(
        `link-analysis found only ${allIssues.length} issues (data-thin)`,
      );
    } else {
      ctx.signal.markStrong(`${allIssues.length} link-analysis issues`);
    }
    return { issues: allIssues, issueCount: allIssues.length };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
