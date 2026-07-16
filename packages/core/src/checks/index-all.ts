// Aggregator that runs all check modules and returns a flat list of issues.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckFn, CrawlIndex, Issue } from "./index.js";
import { responseCodeChecks } from "./response-codes.js";
import { pageTitleChecks } from "./page-titles.js";
import { metaDescriptionChecks } from "./meta-description.js";
import { headingChecks } from "./headings.js";
import { canonicalChecks } from "./canonical.js";
import { directiveChecks } from "./directives.js";
import { imageChecks } from "./images.js";
import { securityChecks } from "./security.js";
import { orphanChecks } from "./orphan.js";
import {
  initSitemapFetcher,
  sitemapChecks,
  resetSitemapCache,
} from "./sitemap.js";
import { hreflangChecks } from "./hreflang.js";
import { jsonLdChecks } from "./jsonld.js";
import { soft404Checks } from "./soft-404.js";
import { nearDupTitleChecks } from "./near-dup-titles.js";
import { webVitalsChecks } from "./web-vitals.js";
import { contentChecks } from "./content.js";
import { linkChecks } from "./links.js";
import { markupChecks } from "./markup.js";
import {
  FILE_NAME as CUSTOM_RULES_FILE,
  loadCustomRules,
  makeCustomRulesCheck,
} from "./custom-rules.js";

export interface RunAllChecksOptions {
  /** Project root for custom-rules.json discovery. */
  projectRoot?: string;
}

export async function runAllChecks(
  index: CrawlIndex,
  options: RunAllChecksOptions = {},
): Promise<Issue[]> {
  // Reset sitemap cache between runs (each crawl is a new origin).
  resetSitemapCache();
  initSitemapFetcher(index.config);

  // Discover and load custom rules, if any. We only attach the
  // dynamic check if the file is present; otherwise we save the
  // import cost of the path.
  const customChecks: CheckFn[] = [];
  if (options.projectRoot) {
    const customPath = join(options.projectRoot, CUSTOM_RULES_FILE);
    if (existsSync(customPath)) {
      const rules = loadCustomRules(options.projectRoot);
      if (rules.length > 0) {
        customChecks.push(makeCustomRulesCheck(rules));
      }
    }
  }

  const checks: CheckFn[] = [
    ...responseCodeChecks,
    ...pageTitleChecks,
    ...metaDescriptionChecks,
    ...headingChecks,
    ...canonicalChecks,
    ...directiveChecks,
    ...imageChecks,
    ...securityChecks,
    ...orphanChecks,
    ...hreflangChecks,
    ...jsonLdChecks,
    ...soft404Checks,
    ...nearDupTitleChecks,
    ...webVitalsChecks,
    ...contentChecks,
    ...linkChecks,
    ...markupChecks,
    ...customChecks,
  ];

  const out: Issue[] = [];
  for (const check of checks) {
    try {
      const result = await Promise.resolve(check(index));
      out.push(...result);
    } catch (err) {
      // A check that throws should not crash the whole report.
      out.push({
        id: "check-failed",
        category: "Internal",
        priority: "Low",
        message: `Check threw: ${(err as Error).message}`,
        urls: [],
      });
    }
  }
  // Sitemap checks need a network call; they are async.
  for (const check of sitemapChecks) {
    try {
      const result = await Promise.resolve(check(index));
      out.push(...result);
    } catch (err) {
      out.push({
        id: "check-failed",
        category: "Internal",
        priority: "Low",
        message: `Check threw: ${(err as Error).message}`,
        urls: [],
      });
    }
  }
  return out;
}
