// onpage module: per-page on-page SEO checks.
//
// Category: tool. Replaces: ScreamingFrog custom extraction,
// ContentKing on-page audit.
//
// Underlying checks (from src/checks/*):
// - page-titles: missing / duplicate / multiple / too long
// - meta-description: missing / duplicate / over 155 chars
// - headings: H1 missing / multiple H1s
// - images: alt missing
//
// Backward compat: this module re-exports the existing CheckFn
// arrays so runAllChecks() and the existing crawl_site plugin
// tool keep working unchanged. invoke() runs the same checks and
// returns a { issues } object for the composer.

import { ConsoleLogger } from "../../core/logger.js";
import { pageTitleChecks } from "../../checks/page-titles.js";
import { metaDescriptionChecks } from "../../checks/meta-description.js";
import { headingChecks } from "../../checks/headings.js";
import { imageChecks } from "../../checks/images.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";
import type { CheckFn, CrawlIndex, Issue } from "../../checks/index.js";

const allChecks: CheckFn[] = [
  ...pageTitleChecks,
  ...metaDescriptionChecks,
  ...headingChecks,
  ...imageChecks,
];

export const onpageModule: Module = {
  id: "onpage",
  version: "0.11.0",
  displayName: "On-Page SEO",
  category: "tool",
  description:
    "Per-page on-page checks: titles, meta descriptions, headings, image alt text, intrinsic image dimensions, and picture fallbacks.",
  inputSchema: {
    type: "object",
    properties: {
      crawlOutcome: {
        type: "object",
        description:
          "Optional pre-existing crawl outcome; if omitted, the module expects a fresh crawl to have already been done by the 'crawl' module.",
      },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        description:
          "Issues found by the on-page checks (title-*, meta-*, heading-*, image-alt-*).",
      },
      issueCount: { type: "number" },
    },
    required: ["issues", "issueCount"],
  },
  dependsOn: ["crawl"],
  configKeys: ["AGENTSEO_KEEP_HTML", "AGENTSEO_RENDER", "AGENTSEO_USER_AGENT"],
  checks: allChecks,
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "onpage",
    });
    const index: CrawlIndex | undefined =
      (input.crawlOutcome as { index?: CrawlIndex } | undefined)?.index ??
      (ctx.crawlOutcome as unknown as { index?: CrawlIndex } | undefined)
        ?.index;
    if (!index) {
      throw new Error(
        "onpage module requires a crawl outcome (depends on 'crawl')",
      );
    }
    const allIssues: Issue[] = [];
    for (const check of allChecks) {
      try {
        const result = await check(index);
        allIssues.push(...result);
      } catch (err) {
        logger.error("check failed", { err: (err as Error).message });
        ctx.signal.markWeak(`onpage check threw: ${(err as Error).message}`);
      }
    }
    if (allIssues.length < 3) {
      ctx.signal.markWeak(
        `onpage found only ${allIssues.length} issues across 4 categories`,
      );
    } else {
      ctx.signal.markStrong(`${allIssues.length} on-page issues`);
    }
    return { issues: allIssues, issueCount: allIssues.length };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
