// Report generation: JSON dump (machine-readable) and markdown
// highlights (human-readable for the agent to summarize to the user).

import type {
  CrawledPage,
  CrawlIndex,
  Issue,
  Priority,
} from "../../checks/index.js";
import {
  analyzeHreflang,
  type HreflangPageEvidence,
} from "../../checks/hreflang.js";
import type { SitemapCrawlSnapshot } from "../../checks/sitemap.js";
import type { LighthouseReport } from "../../integrations/lighthouse.js";
import type { PsiReport } from "../../integrations/psi.js";
import {
  assessBrandPresence,
  type BrandProfilePresence,
} from "../../integrations/brand-presence.js";
import type { TrendsReport } from "../../integrations/trends.js";

export interface GscPageStat {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryStat {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryPageStat extends GscQueryStat {
  page: string;
}

export interface Ga4PageStat {
  page: string;
  sessions: number;
  pageViews: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  keyEvents: number;
}

export interface PerformancePeriodSummary {
  periodStart: string;
  periodEnd: string;
  /** Omitted when GSC was not connected or the provider request failed. */
  gsc?: {
    perPage: GscPageStat[];
    topQueries: GscQueryStat[];
    queryPages: GscQueryPageStat[];
  };
  /** Omitted when GA4 was not connected or the provider request failed. */
  ga4?: {
    perPage: Ga4PageStat[];
  };
}

/**
 * Two adjacent, provider-neutral periods retained for deterministic impact
 * comparisons. Legacy top-level realData fields remain current-period aliases.
 */
export interface PerformanceComparisonSummary {
  asOfDate: string;
  calendarTimeZone: "UTC";
  completeDataLagDays: 3;
  windowDays: 28;
  current: PerformancePeriodSummary;
  previous: PerformancePeriodSummary;
}

export interface RealDataSummary {
  /** Period this snapshot covers. */
  periodStart: string;
  periodEnd: string;
  /** Per-URL GSC stats. */
  gsc: GscPageStat[];
  /** Per-URL GA4 stats. */
  ga4: Ga4PageStat[];
  /** Top queries across the site. */
  topQueries: GscQueryStat[];
  /** Sitemaps known to GSC. */
  sitemaps: Array<{
    path: string;
    lastSubmitted: string;
    warnings: number;
    errors: number;
  }>;
  /** Source errors (e.g. GA4 token expired). We surface these in the report so the operator knows. */
  errors: string[];
  /**
   * Current and previous 28-day datasets for Impact Flight Recorder.
   * Optional so reports saved before this field existed remain valid.
   */
  performanceComparison?: PerformanceComparisonSummary;
  /** Lighthouse per-URL scores. */
  lighthouse?: LighthouseReport[];
  /** PageSpeed Insights results requested through the local BYOK connector. */
  pageSpeedInsights?: PsiReport[];
  /** Google Trends interest-over-time for the operator's chosen keywords. */
  trends?: TrendsReport[];
}

export interface Report {
  generatedAt: string;
  startUrl: string;
  durationMs: number;
  config: {
    maxUrls: number;
    maxRuntimeMs: number;
    requestsPerSecond: number;
  };
  summary: {
    pagesCrawled: number;
    issuesByPriority: Record<Priority, number>;
    issuesByCategory: Record<string, number>;
  };
  /** Optional first-party data from GSC/GA4. May be undefined if the integrations are not configured. */
  realData?: RealDataSummary;
  /** Exact sitemap snapshot used by the sitemap checks in this crawl. */
  sitemap?: SitemapCrawlSnapshot;
  issues: Issue[];
  /**
   * Present only when the workspace declared brand profiles. Absent means the
   * check did not run, which is different from "no profile is linked".
   */
  brandPresence?: BrandProfilePresence[];
  pages: Array<{
    url: string;
    finalUrl: string;
    status: number;
    title: string | null;
    contentType: string;
    canonical: string | null;
    robotsMeta: string | null;
    xRobotsTag: string | null;
    robotsAllowed: boolean | null;
    htmlParsed: boolean;
    error: string | null;
    redirectChain: string[];
    responseTimeMs: number;
    vitals: import("../../checks/index.js").WebVitals | null;
    /** Added in 0.11 evidence reports; optional for legacy report readers. */
    crawlDepth?: number | null;
    discoveredFrom?: string | null;
    /**
     * The words a page actually shows.
     *
     * Carried so the paid-alignment rules can ask whether a landing page says
     * anything about the terms being bid on. Optional, because a report from
     * before that module existed has none, and the rule declines rather than
     * judging a page on its title alone.
     */
    h1?: string[];
    h2?: string[];
    metaDescription?: string | null;
    wordCount?: number | null;
    htmlLang?: string | null;
    hreflang?: HreflangPageEvidence | null;
    extractions?: Array<{
      label: string;
      value: string | null;
      truncated?: true;
    }>;
    /** Aggregated per-target internal-link evidence for link-graph replay. */
    internalLinks?: Array<{
      targetUrl: string;
      occurrences: number;
      followOccurrences: number;
      nofollowOccurrences: number;
      anchorTexts: string[];
      placements: Array<
        "header" | "navigation" | "main" | "aside" | "footer" | "body"
      >;
    }>;
  }>;
  topUrls: Array<{
    url: string;
    status: number;
    title: string | null;
    issueCount: number;
    extractions: Array<{
      label: string;
      value: string | null;
      truncated?: true;
    }>;
  }>;
}

const LINK_PLACEMENT_ORDER = [
  "header",
  "navigation",
  "main",
  "aside",
  "footer",
  "body",
] as const;

function internalLinkEvidence(
  page: CrawledPage,
): NonNullable<Report["pages"][number]["internalLinks"]> {
  if (!page.parsed) return [];
  const details =
    page.parsed.internalLinkDetails ??
    page.parsed.internalLinks.map((targetUrl) => ({
      targetUrl,
      anchorText: null,
      nofollow: page.parsed!.nofollowLinks.includes(targetUrl),
      placement: "body" as const,
    }));
  const aggregated = new Map<
    string,
    {
      occurrences: number;
      followOccurrences: number;
      nofollowOccurrences: number;
      anchorTexts: Set<string>;
      placements: Set<(typeof LINK_PLACEMENT_ORDER)[number]>;
    }
  >();
  for (const detail of details) {
    let targetUrl: string;
    try {
      const target = new URL(detail.targetUrl, page.finalUrl);
      if (target.protocol !== "http:" && target.protocol !== "https:") continue;
      target.hash = "";
      targetUrl = target.toString();
    } catch {
      continue;
    }
    const current = aggregated.get(targetUrl) ?? {
      occurrences: 0,
      followOccurrences: 0,
      nofollowOccurrences: 0,
      anchorTexts: new Set<string>(),
      placements: new Set<(typeof LINK_PLACEMENT_ORDER)[number]>(),
    };
    current.occurrences += 1;
    if (detail.nofollow) current.nofollowOccurrences += 1;
    else current.followOccurrences += 1;
    if (detail.anchorText && current.anchorTexts.size < 10) {
      current.anchorTexts.add(detail.anchorText.slice(0, 500));
    }
    current.placements.add(detail.placement);
    aggregated.set(targetUrl, current);
  }
  return [...aggregated.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([targetUrl, value]) => ({
      targetUrl,
      occurrences: value.occurrences,
      followOccurrences: value.followOccurrences,
      nofollowOccurrences: value.nofollowOccurrences,
      anchorTexts: [...value.anchorTexts],
      placements: LINK_PLACEMENT_ORDER.filter((placement) =>
        value.placements.has(placement),
      ),
    }));
}

export function buildReport(
  index: CrawlIndex,
  issues: Issue[],
  realData?: RealDataSummary,
  lighthouse?: LighthouseReport[],
  sitemap?: SitemapCrawlSnapshot | null,
  brandProfiles?: readonly { label: string; url: string }[],
): Report {
  // Brand presence is derived here rather than in the runtime because it needs
  // each page's external links and JSON-LD, and the report deliberately drops
  // both to stay small. Computing it at the one point where the parsed pages
  // are still in hand costs no extra requests.
  const brandPresence =
    brandProfiles && brandProfiles.length > 0
      ? assessBrandPresence(
          brandProfiles,
          Array.from(index.pages.values()).flatMap((page) =>
            page.parsed
              ? [
                  {
                    url: page.url,
                    externalLinks: page.parsed.externalLinks,
                    jsonLd: page.parsed.jsonLd,
                  },
                ]
              : [],
          ),
        )
      : undefined;
  const byPriority: Record<Priority, number> = { High: 0, Medium: 0, Low: 0 };
  const byCategory: Record<string, number> = {};
  for (const i of issues) {
    byPriority[i.priority] = (byPriority[i.priority] ?? 0) + 1;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }
  const issuesByUrl = new Map<string, number>();
  for (const i of issues) {
    for (const u of i.urls) {
      issuesByUrl.set(u, (issuesByUrl.get(u) ?? 0) + 1);
    }
  }
  const topUrls = Array.from(index.pages.values())
    .map((p) => ({
      url: p.url,
      status: p.status,
      title: p.parsed?.title ?? null,
      issueCount: issuesByUrl.get(p.url) ?? 0,
      extractions: p.extractions ?? [],
    }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 25);
  const hreflang = analyzeHreflang(index);
  return {
    generatedAt: new Date().toISOString(),
    startUrl: index.startUrl,
    durationMs: index.durationMs,
    config: {
      maxUrls: index.config.maxUrls,
      maxRuntimeMs: index.config.maxRuntimeMs,
      requestsPerSecond: index.config.requestsPerSecond,
    },
    summary: {
      pagesCrawled: index.pages.size,
      issuesByPriority: byPriority,
      issuesByCategory: byCategory,
    },
    issues,
    realData,
    ...(brandPresence ? { brandPresence } : {}),
    ...(sitemap ? { sitemap: structuredClone(sitemap) } : {}),
    pages: Array.from(index.pages.values()).map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      status: p.status,
      title: p.parsed?.title ?? null,
      contentType: p.contentType,
      canonical: p.parsed?.canonical ?? null,
      robotsMeta: p.parsed?.robotsMeta ?? null,
      xRobotsTag:
        Object.entries(p.headers).find(
          ([name]) => name.toLowerCase() === "x-robots-tag",
        )?.[1] ?? null,
      robotsAllowed: p.robotsAllowed ?? null,
      htmlParsed: p.parsed !== null,
      error: p.error,
      redirectChain: p.redirectChain,
      responseTimeMs: p.responseTimeMs,
      vitals: p.vitals ?? null,
      crawlDepth: p.crawlDepth ?? null,
      discoveredFrom: p.discoveredFrom ?? null,
      h1: p.parsed?.h1 ?? [],
      h2: p.parsed?.h2 ?? [],
      metaDescription: p.parsed?.metaDescription ?? null,
      wordCount: p.parsed?.wordCount ?? null,
      htmlLang: p.parsed?.htmlLang ?? null,
      hreflang: hreflang.get(p.url) ?? null,
      extractions: p.extractions ?? [],
      internalLinks: internalLinkEvidence(p),
    })),
    topUrls,
  };
}

export function reportToJson(r: Report): string {
  return JSON.stringify(r, null, 2);
}

export { reportToHtml } from "./html.js";
export { reportToCsv } from "./csv.js";

export function reportToMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`# Marketingovo audit`);
  lines.push("");
  lines.push(`- Start URL: ${r.startUrl}`);
  lines.push(`- Generated: ${r.generatedAt}`);
  lines.push(`- Duration: ${(r.durationMs / 1000).toFixed(1)}s`);
  lines.push(`- Pages crawled: ${r.summary.pagesCrawled}`);
  lines.push(
    `- Run configuration: crawlScope=${r.config.maxUrls} URLs, maxRuntime=${r.config.maxRuntimeMs}ms, rps=${r.config.requestsPerSecond}`,
  );
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Priority | Issues |`);
  lines.push(`|----------|--------|`);
  for (const p of ["High", "Medium", "Low"] as const) {
    lines.push(`| ${p} | ${r.summary.issuesByPriority[p]} |`);
  }
  if (Object.keys(r.summary.issuesByCategory).length > 0) {
    lines.push("");
    lines.push(`| Category | Issues |`);
    lines.push(`|----------|--------|`);
    const cats = Object.entries(r.summary.issuesByCategory).sort(
      (a, b) => b[1] - a[1],
    );
    for (const [c, n] of cats) {
      lines.push(`| ${c} | ${n} |`);
    }
  }
  lines.push("");
  lines.push(`## Highlights`);
  lines.push("");
  const highFirst = [...r.issues].sort((a, b) => {
    const order: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
    return order[a.priority] - order[b.priority];
  });
  if (highFirst.length === 0) {
    lines.push("No issues detected.");
  } else {
    for (const issue of highFirst) {
      lines.push(`### [${issue.priority}] ${issue.message}`);
      lines.push(`_Category: ${issue.category}, id: \`${issue.id}\`_`);
      if (issue.fix) lines.push(`**Fix:** ${issue.fix}`);
      const sample = issue.urls.slice(0, 5);
      for (const u of sample) lines.push(`- ${u}`);
      if (issue.urls.length > sample.length) {
        lines.push(`- ...and ${issue.urls.length - sample.length} more`);
      }
      lines.push("");
    }
  }
  if (r.topUrls.length > 0) {
    lines.push(`## Top affected URLs`);
    lines.push("");
    lines.push(`| URL | Status | Title | Issues |`);
    lines.push(`|-----|--------|-------|--------|`);
    for (const u of r.topUrls.slice(0, 10)) {
      const t = (u.title ?? "").replace(/\|/g, "\\|").slice(0, 60);
      lines.push(`| ${u.url} | ${u.status} | ${t} | ${u.issueCount} |`);
    }
  }
  if (r.realData) {
    lines.push("");
    lines.push(
      `## Real-world performance (GSC + GA4 + Lighthouse, ${r.realData.periodStart} → ${r.realData.periodEnd})`,
    );
    lines.push("");
    if (r.realData.errors.length > 0) {
      lines.push(`> ⚠️ Data source issues:`);
      for (const e of r.realData.errors) lines.push(`> - ${e}`);
      lines.push("");
    }
    if (r.realData.gsc.length > 0) {
      lines.push(`### GSC: per-URL clicks + impressions`);
      lines.push("");
      lines.push(`| Page | Clicks | Impr | CTR | Pos |`);
      lines.push(`|------|-------:|-----:|----:|----:|`);
      for (const p of r.realData.gsc.slice(0, 20)) {
        lines.push(
          `| ${p.page} | ${p.clicks} | ${p.impressions} | ${(p.ctr * 100).toFixed(1)}% | ${p.position.toFixed(1)} |`,
        );
      }
      lines.push("");
    }
    if (r.realData.ga4.length > 0) {
      lines.push(`### GA4: per-URL traffic + engagement`);
      lines.push("");
      lines.push(
        `| Page | Sessions | Views | Engagement | Bounce | Avg time (s) | Key events |`,
      );
      lines.push(
        `|------|---------:|------:|-----------:|-------:|-------------:|-----:|`,
      );
      for (const p of r.realData.ga4.slice(0, 20)) {
        // Old saved reports used `conversions`; new reports serialize only `keyEvents`.
        const legacyCompatible = p as Ga4PageStat & { conversions?: number };
        const keyEvents =
          legacyCompatible.keyEvents ?? legacyCompatible.conversions ?? 0;
        lines.push(
          `| ${p.page} | ${p.sessions} | ${p.pageViews} | ${(p.engagementRate * 100).toFixed(1)}% | ${(p.bounceRate * 100).toFixed(1)}% | ${p.avgSessionDuration.toFixed(1)} | ${keyEvents} |`,
        );
      }
      lines.push("");
    }
    if (r.realData.topQueries.length > 0) {
      lines.push(`### GSC: top queries across the site`);
      lines.push("");
      lines.push(`| Query | Clicks | Impr | CTR | Pos |`);
      lines.push(`|-------|-------:|-----:|----:|----:|`);
      for (const q of r.realData.topQueries.slice(0, 15)) {
        lines.push(
          `| ${q.query} | ${q.clicks} | ${q.impressions} | ${(q.ctr * 100).toFixed(1)}% | ${q.position.toFixed(1)} |`,
        );
      }
      lines.push("");
    }
    if (r.realData.sitemaps.length > 0) {
      lines.push(`### Sitemaps registered in GSC`);
      lines.push("");
      lines.push(`| Sitemap | Last submitted | Warnings | Errors |`);
      lines.push(`|---------|---------------:|---------:|-------:|`);
      for (const s of r.realData.sitemaps) {
        lines.push(
          `| ${s.path} | ${s.lastSubmitted || "—"} | ${s.warnings} | ${s.errors} |`,
        );
      }
    }
    if (r.realData.trends && r.realData.trends.length > 0) {
      lines.push("");
      lines.push(`### Topic momentum (Google Trends, 90 days)`);
      lines.push("");
      lines.push(
        `| Keyword | Verdict | Avg interest | Recent Q-o-Q | Slope (pts/mo) |`,
      );
      lines.push(
        `|---------|---------|-------------:|-------------:|---------------:|`,
      );
      for (const t of r.realData.trends) {
        if (t.error) {
          lines.push(`| ${t.keyword} | err | — | — | — |`);
          continue;
        }
        const pct = (t.momentum * 100).toFixed(1);
        const arrow = t.momentum > 0 ? "↑" : t.momentum < 0 ? "↓" : "→";
        lines.push(
          `| ${t.keyword} | ${t.verdict} ${arrow} | ${t.average.toFixed(1)} | ${pct}% | ${t.slope.toFixed(2)} |`,
        );
      }
    }
    if (r.realData.lighthouse && r.realData.lighthouse.length > 0) {
      lines.push("");
      lines.push(`### Lighthouse scores (mobile)`);
      lines.push("");
      lines.push(`| URL | Perf | A11y | BP | SEO |`);
      lines.push(`|-----|----:|-----:|---:|----:|`);
      for (const l of r.realData.lighthouse) {
        const s = l.scores;
        const cell = (v: number | null) =>
          v === null ? (l.error ? "err" : "—") : String(v);
        lines.push(
          `| ${l.url} | ${cell(s.performance)} | ${cell(s.accessibility)} | ${cell(s.bestPractices)} | ${cell(s.seo)} |`,
        );
        if (l.error) lines.push(`  _Error: ${l.error}_`);
      }
      // Top opportunities across the run
      const opp = r.realData.lighthouse.flatMap((l) => l.topAudits);
      const byAudit = new Map<
        string,
        { title: string; count: number; minScore: number }
      >();
      for (const a of opp) {
        const e = byAudit.get(a.id) ?? {
          title: a.title,
          count: 0,
          minScore: 1,
        };
        e.count += 1;
        e.minScore = Math.min(e.minScore, a.score ?? 1);
        byAudit.set(a.id, e);
      }
      const top = Array.from(byAudit.entries())
        .sort(
          (a, b) => b[1].count - a[1].count || a[1].minScore - b[1].minScore,
        )
        .slice(0, 5);
      if (top.length > 0) {
        lines.push("");
        lines.push(`**Top opportunities across crawled URLs:**`);
        lines.push("");
        for (const [id, e] of top) {
          lines.push(
            `- \`${id}\` — ${e.title} (${e.count} URL${e.count > 1 ? "s" : ""}, lowest score ${(e.minScore * 100).toFixed(0)})`,
          );
        }
      }
    }
    if (
      r.realData.pageSpeedInsights &&
      r.realData.pageSpeedInsights.length > 0
    ) {
      lines.push("");
      lines.push(
        `### PageSpeed Insights (${r.realData.pageSpeedInsights[0]?.strategy ?? "mobile"})`,
      );
      lines.push("");
      lines.push(`| URL | Perf | A11y | BP | SEO |`);
      lines.push(`|-----|----:|-----:|---:|----:|`);
      for (const result of r.realData.pageSpeedInsights) {
        const score = (value: number | null) =>
          value === null ? "—" : String(value);
        lines.push(
          `| ${result.url} | ${score(result.scores.performance.score)} | ${score(result.scores.accessibility.score)} | ${score(result.scores["best-practices"].score)} | ${score(result.scores.seo.score)} |`,
        );
      }
    }
  }
  return lines.join("\n") + "\n";
}
