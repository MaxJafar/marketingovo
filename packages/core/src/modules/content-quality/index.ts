// content-quality module: content thinness, duplicates, Flesch, near-dup titles.
//
// Category: tool. Replaces: Surfer, Clearscope, MarketMuse (partial —
// they also do keyword research, which is a separate module in Sprint 7).
//
// Underlying checks (from src/checks/*):
// - content: thin body / exact-dup / near-dup / Flesch readability
// - near-dup-titles: Jaccard-2-shingle clustering of titles
//
// Note: TF-IDF content_gap (the v0.8 feature) is a separate module
// (content-gap) because its inputs and outputs differ from per-page
// content checks.

import { ConsoleLogger } from "../../core/logger.js";
import { contentChecks } from "../../checks/content.js";
import { nearDupTitleChecks } from "../../checks/near-dup-titles.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";
import type { CheckFn, CrawlIndex, Issue } from "../../checks/index.js";

const allChecks: CheckFn[] = [...contentChecks, ...nearDupTitleChecks];

export const contentQualityModule: Module = {
  id: "content-quality",
  version: "0.9.0",
  displayName: "Content Quality",
  category: "tool",
  description:
    "Per-page content checks: thin body, exact-duplicate body (SHA-256), near-duplicate body (MinHash), Flesch reading ease, near-duplicate titles (Jaccard-2-shingle).",
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
  configKeys: ["GOLEMSEO_KEEP_HTML", "GOLEMSEO_RENDER"],
  checks: allChecks,
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "content-quality",
    });
    const index: CrawlIndex | undefined =
      (input.crawlOutcome as { index?: CrawlIndex } | undefined)?.index ??
      (ctx.crawlOutcome as unknown as { index?: CrawlIndex } | undefined)
        ?.index;
    if (!index) {
      throw new Error(
        "content-quality module requires a crawl outcome (depends on 'crawl')",
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
          `content-quality check threw: ${(err as Error).message}`,
        );
      }
    }
    if (allIssues.length === 0) {
      ctx.signal.markWeak("content-quality found 0 issues (data-thin)");
    } else {
      ctx.signal.markStrong(`${allIssues.length} content-quality issues`);
    }
    return { issues: allIssues, issueCount: allIssues.length };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
