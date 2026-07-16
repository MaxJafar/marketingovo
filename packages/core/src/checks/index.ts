// Check types and shared schema.
//
// Each check produces 0..N issues. An issue has a stable `id`, a
// priority (High/Medium/Low), a human-readable message, and a set of
// affected URLs. This shape matches the major SEO crawlers so a future
// UI can adopt it.

import { assessPageIndexability } from "../indexability.js";

export type Priority = "High" | "Medium" | "Low";

export interface WebVitals {
  /** Largest Contentful Paint in ms (null if not measured). */
  lcp: number | null;
  /** Cumulative Layout Shift (unitless, null if not measured). */
  cls: number | null;
  /** Time to First Byte in ms. */
  ttfb: number | null;
  /** First Contentful Paint in ms. */
  fcp: number | null;
  /** Page weight in bytes (transferSize estimate). */
  pageWeightBytes: number | null;
}

export interface CrawledPage {
  url: string;
  finalUrl: string;
  /** Zero-based shortest discovery depth from a seed URL. */
  crawlDepth?: number;
  /** Page that first placed this URL on the crawl frontier. */
  discoveredFrom?: string | null;
  status: number;
  contentType: string;
  responseTimeMs: number;
  bodyBytes: number;
  redirectChain: string[];
  headers: Record<string, string>;
  /** Result of the crawler's robots policy check; null when it was bypassed. */
  robotsAllowed?: boolean | null;
  parsed: import("../parser.js").ParsedPage | null;
  /** Raw HTML body, only populated when limits.keepRawHtml is true. */
  rawHtml?: string;
  error: string | null;
  fetchDurationMs: number;
  extractions: import("../extraction.js").ExtractedField[];
  vitals?: WebVitals | null;
}

export interface CrawlIndex {
  pages: Map<string, CrawledPage>;
  startUrl: string;
  robots: Map<string, boolean | null>;
  finishedAt: string;
  durationMs: number;
  config: import("../core/limits.js").Limits;
}

export interface Issue {
  id: string;
  category: string;
  priority: Priority;
  message: string;
  /** Complete affected-URL cohort. Checks must not truncate this collection;
   * human-facing report renderers are responsible for explicit sampling. */
  urls: string[];
  detail?: Record<string, unknown>;
  fix?: string;
  /** Optional module id. Set by modules in src/modules so the
   *  composer can attribute issues back to the source module.
   *  Not required by every check (older checks leave it unset).
   *  Added in Sprint 10. */
  moduleId?: string;
}

export interface CheckResult {
  issues: Issue[];
}

export type CheckFn = (index: CrawlIndex) => Issue[] | Promise<Issue[]>;

export const ISSUE_PRIORITIES: Priority[] = ["High", "Medium", "Low"];

export function isIndexable(p: CrawledPage): boolean {
  const xRobotsTag = Object.entries(p.headers).find(
    ([name]) => name.toLowerCase() === "x-robots-tag",
  )?.[1];
  return (
    assessPageIndexability({
      status: p.status,
      finalUrl: p.finalUrl,
      contentType: p.contentType,
      canonical: p.parsed?.canonical,
      robotsMeta: p.parsed?.robotsMeta,
      xRobotsTag,
      // Older in-memory fixtures predate this field. Production pages always
      // set it; preserving `undefined` compatibility does not collapse an
      // explicit `null` (robots checks bypassed) into a positive result.
      robotsAllowed: p.robotsAllowed === undefined ? true : p.robotsAllowed,
      htmlParsed: p.parsed !== null,
      error: p.error,
    }).indexable === true
  );
}
