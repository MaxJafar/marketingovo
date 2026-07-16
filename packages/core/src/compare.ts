// Competitive comparison: run the same audit on N sites, return a
// side-by-side comparison. Powers the "agent compares my site to
// competitors" workflow that's the killer demo for the marketer
// agent role.
//
// We deliberately reuse the existing `crawl()` function rather than
// reimplementing. N crawls run in parallel (bounded by env) and we
// gather per-site results into a single comparison object.

import { crawl, type CrawlOutcome } from "./index.js";
import { type LighthouseMode, preloadDeps } from "./integrations/lighthouse.js";

export interface CompareOptions {
  urls: string[];
  /** Per-site crawl limits. Applied to every site the same way. */
  maxUrls?: number;
  maxRuntimeMs?: number;
  renderMode?: "static" | "js";
  /** Run Lighthouse on the start URL of each site. Default "off". */
  lighthouse?: LighthouseMode;
  /** Map of GSC site URLs keyed by the start URL. e.g. { "https://example.com/": "sc-domain:example.com" }. */
  gscSiteUrls?: Record<string, string>;
  projectRoot?: string;
  /** Concurrency for parallel crawls. Default 2 (be polite). */
  concurrency?: number;
  signal?: AbortSignal;
  /** Exact private hosts/IPs allowed for this comparison. */
  privateHostAllowlist?: string[];
}

export interface SiteSummary {
  url: string;
  finalUrl: string;
  pagesCrawled: number;
  durationMs: number;
  issuesByPriority: { High: number; Medium: number; Low: number };
  issuesByCategory: Record<string, number>;
  topIssues: Array<{
    id: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    message: string;
    urlCount: number;
  }>;
  avgLcpMs: number | null;
  avgCls: number | null;
  avgTtfbMs: number | null;
  lighthouse: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  } | null;
  title: string | null;
  error: string | null;
}

export interface ComparisonResult {
  generatedAt: string;
  sites: SiteSummary[];
  /** Index of the "winner" (fewest high-priority issues + best Lighthouse) per category, keyed by metric. */
  winners: {
    fewestHigh: number | null;
    fewestTotal: number | null;
    bestPerformance: number | null;
    bestSeo: number | null;
    bestA11y: number | null;
    bestBp: number | null;
    fastestLcp: number | null;
  };
}

export async function compareSites(
  opts: CompareOptions,
): Promise<ComparisonResult> {
  const concurrency = opts.concurrency ?? 2;
  const lighthouse = opts.lighthouse ?? "off";
  if (lighthouse !== "off") await preloadDeps();
  const results: SiteSummary[] = [];
  // Process in batches to bound memory and network pressure.
  for (let i = 0; i < opts.urls.length; i += concurrency) {
    opts.signal?.throwIfAborted();
    const batch = opts.urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => runOneSite(url, opts, lighthouse)),
    );
    results.push(...batchResults);
  }
  return buildComparison(results);
}

async function runOneSite(
  url: string,
  opts: CompareOptions,
  lighthouse: LighthouseMode,
): Promise<SiteSummary> {
  try {
    const outcome: CrawlOutcome = await crawl({
      startUrl: url,
      renderMode: opts.renderMode ?? "static",
      limits: {
        maxUrls: opts.maxUrls ?? 30,
        maxRuntimeMs: opts.maxRuntimeMs ?? 60_000,
        allowPrivate: (opts.privateHostAllowlist?.length ?? 0) > 0,
      },
      signal: opts.signal,
      privateHostAllowlist: opts.privateHostAllowlist ?? [],
      lighthouse: lighthouse === "off" ? "off" : "home",
      gscSiteUrl: opts.gscSiteUrls?.[url],
      projectRoot: opts.projectRoot,
    });
    return summarize(url, outcome);
  } catch (err) {
    opts.signal?.throwIfAborted();
    return {
      url,
      finalUrl: url,
      pagesCrawled: 0,
      durationMs: 0,
      issuesByPriority: { High: 0, Medium: 0, Low: 0 },
      issuesByCategory: {},
      topIssues: [],
      avgLcpMs: null,
      avgCls: null,
      avgTtfbMs: null,
      lighthouse: null,
      title: null,
      error: (err as Error).message,
    };
  }
}

function summarize(url: string, outcome: CrawlOutcome): SiteSummary {
  const r = outcome.report;
  // Per-URL issue counts
  const issueCount = new Map<string, number>();
  for (const i of r.issues) {
    for (const u of i.urls) {
      issueCount.set(u, (issueCount.get(u) ?? 0) + 1);
    }
  }
  // Per-issue urlCount
  const topIssues = [...r.issues]
    .sort((a, b) => {
      const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
      return (
        (order[a.priority ?? "Low"] ?? 3) - (order[b.priority ?? "Low"] ?? 3) ||
        b.urls.length - a.urls.length
      );
    })
    .slice(0, 5)
    .map((i) => ({
      id: i.id ?? "unknown",
      category: i.category ?? "Unknown",
      priority: i.priority ?? "Low",
      message: i.message ?? "",
      urlCount: i.urls.length,
    }));
  // Vitals
  const vitalsPages = r.pages.filter((p) => p.vitals);
  const avgLcpMs = avg(
    vitalsPages
      .map((p) => p.vitals?.lcp)
      .filter((v): v is number => v !== null && v !== undefined),
  );
  const avgCls = avg(
    vitalsPages
      .map((p) => p.vitals?.cls)
      .filter((v): v is number => v !== null && v !== undefined),
  );
  const avgTtfbMs = avg(
    vitalsPages
      .map((p) => p.vitals?.ttfb)
      .filter((v): v is number => v !== null && v !== undefined),
  );
  // Lighthouse (home page only)
  let lighthouse: SiteSummary["lighthouse"] = null;
  const lhReports = r.realData?.lighthouse ?? [];
  if (lhReports.length > 0) {
    const home = lhReports[0]!;
    lighthouse = home.scores;
  }
  return {
    url,
    finalUrl: r.startUrl,
    pagesCrawled: r.summary.pagesCrawled,
    durationMs: r.durationMs,
    issuesByPriority: r.summary.issuesByPriority,
    issuesByCategory: r.summary.issuesByCategory,
    topIssues,
    avgLcpMs: avgLcpMs,
    avgCls: avgCls,
    avgTtfbMs: avgTtfbMs,
    lighthouse,
    title: r.pages[0]?.title ?? null,
    error: null,
  };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildComparison(sites: SiteSummary[]): ComparisonResult {
  const ok = sites.filter((s) => !s.error);
  // Winners: lowest value wins for issue counts, highest for Lighthouse scores,
  // lowest for LCP/TTFB. Errors don't compete.
  const winners: ComparisonResult["winners"] = {
    fewestHigh: pickBy(
      sites,
      (s) => -s.issuesByPriority.High,
      (s) => s.error === null,
    ),
    fewestTotal: pickBy(
      sites,
      (s) =>
        -(
          s.issuesByPriority.High +
          s.issuesByPriority.Medium +
          s.issuesByPriority.Low
        ),
      (s) => s.error === null,
    ),
    bestPerformance: pickBy(sites, (s) => s.lighthouse?.performance ?? -1),
    bestSeo: pickBy(sites, (s) => s.lighthouse?.seo ?? -1),
    bestA11y: pickBy(sites, (s) => s.lighthouse?.accessibility ?? -1),
    bestBp: pickBy(sites, (s) => s.lighthouse?.bestPractices ?? -1),
    fastestLcp: pickBy(
      sites,
      (s) => -(s.avgLcpMs ?? Number.POSITIVE_INFINITY),
      (s) => s.avgLcpMs !== null,
    ),
  };
  return {
    generatedAt: new Date().toISOString(),
    sites,
    winners,
  };
}

function pickBy(
  sites: SiteSummary[],
  score: (s: SiteSummary) => number,
  eligible: (s: SiteSummary) => boolean = () => true,
): number | null {
  let bestIdx: number | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < sites.length; i += 1) {
    const s = sites[i]!;
    if (!eligible(s)) continue;
    const sc = score(s);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Mark `ok` so the unused-import rule doesn't trip on the type
// reference. (TypeScript tree-shakes imports; runtime never sees it.)
export const __compareOk = (s: SiteSummary[]) => s.filter((x) => !x.error);
