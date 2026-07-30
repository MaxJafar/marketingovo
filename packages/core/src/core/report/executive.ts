// The executive layer of a report: what a marketer sends to a client on Friday.
//
// One model, rendered by both the HTML and PDF writers, so the two can never
// disagree about what the audit found.
//
// Deliberately absent: a 0-100 "health score". A single synthesized number is
// the one thing in a report a client will question and an agency cannot defend,
// because no one can reconstruct it from the evidence. Everything here is either
// a count of something observed or an explicit statement that it was not
// measured.

import type { Report } from "./index.js";
import type { Issue, Priority } from "../../checks/index.js";

/** A finding promoted to the summary, with the reach that justified it. */
export interface HeadlineAction {
  id: string;
  category: string;
  priority: Priority;
  message: string;
  fix: string | null;
  /** Complete affected cohort size. Never a sample count. */
  affectedUrls: number;
  /** A small, explicitly-labelled sample for the reader. */
  sampleUrls: string[];
}

/** Something the audit could not observe, and what that costs the reader. */
export interface CoverageGap {
  source: string;
  consequence: string;
}

export interface ComparisonInput {
  baselineGeneratedAt: string;
  baselineIssuesByPriority: Record<Priority, number>;
  baselinePagesCrawled: number;
}

export interface ChangeSinceBaseline {
  baselineGeneratedAt: string;
  pagesCrawledDelta: number;
  byPriority: Array<{
    priority: Priority;
    current: number;
    baseline: number;
    delta: number;
  }>;
  /** True when the crawl scope moved enough that counts are not comparable. */
  scopeChanged: boolean;
}

export interface ExecutiveSummary {
  site: string;
  generatedAt: string;
  pagesCrawled: number;
  issueTotal: number;
  byPriority: Array<{ priority: Priority; count: number }>;
  topActions: HeadlineAction[];
  coverageGaps: CoverageGap[];
  /** Null when there is no prior audit to compare against. */
  change: ChangeSinceBaseline | null;
  /** Period of first-party data, when any was connected. */
  dataPeriod: { start: string; end: string } | null;
}

const PRIORITY_ORDER: readonly Priority[] = ["High", "Medium", "Low"];

function priorityRank(priority: Priority): number {
  const index = PRIORITY_ORDER.indexOf(priority);
  return index === -1 ? PRIORITY_ORDER.length : index;
}

/**
 * Ranks by severity first and reach second. Reach is the complete affected
 * cohort, not a sample, so a rule firing on six hundred pages outranks the same
 * severity firing on one.
 */
function rankIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const bySeverity = priorityRank(a.priority) - priorityRank(b.priority);
    if (bySeverity !== 0) return bySeverity;
    return b.urls.length - a.urls.length;
  });
}

/**
 * Names what the audit could not see. This section is the reason a report
 * survives a client challenge: it states the boundary of the evidence instead of
 * letting silence imply completeness.
 */
export function deriveCoverageGaps(report: Report): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  if (!report.realData) {
    gaps.push({
      source: "Search Console and Analytics",
      consequence:
        "Findings are ranked by technical severity and reach only. No organic click or conversion exposure was available to weight them.",
    });
  } else {
    if (report.realData.gsc.length === 0) {
      gaps.push({
        source: "Search Console page data",
        consequence:
          "No per-URL impressions or clicks, so organic exposure could not inform priority.",
      });
    }
    if (report.realData.ga4.length === 0) {
      gaps.push({
        source: "Analytics page data",
        consequence:
          "No per-URL sessions or key events, so conversion exposure could not inform priority.",
      });
    }
  }

  if (!report.sitemap) {
    gaps.push({
      source: "XML sitemap",
      consequence:
        "Sitemap coverage and orphan detection are unavailable. Absence here is not evidence that every page is discoverable.",
    });
  }

  const unreachable = report.pages.filter((page) => page.error !== null).length;
  if (unreachable > 0) {
    gaps.push({
      source: `${unreachable} unreachable page${unreachable === 1 ? "" : "s"}`,
      consequence:
        "These pages returned a transport error and were not analysed. Their issues, if any, are unknown rather than absent.",
    });
  }

  const blocked = report.pages.filter(
    (page) => page.robotsAllowed === false,
  ).length;
  if (blocked > 0) {
    gaps.push({
      source: `${blocked} page${blocked === 1 ? "" : "s"} disallowed by robots.txt`,
      consequence:
        "Respected and skipped. This is usually intentional; confirm before treating it as a finding.",
    });
  }

  return gaps;
}

/**
 * Compares against a prior audit. Counts from crawls of very different sizes are
 * not comparable, so a material scope change is flagged rather than silently
 * producing a delta the reader would misread as progress.
 */
export function deriveChange(
  report: Report,
  baseline: ComparisonInput | null,
): ChangeSinceBaseline | null {
  if (!baseline) return null;

  const current = report.summary.pagesCrawled;
  const previous = baseline.baselinePagesCrawled;
  const larger = Math.max(current, previous);
  const scopeChanged =
    larger > 0 && Math.abs(current - previous) / larger > 0.2;

  return {
    baselineGeneratedAt: baseline.baselineGeneratedAt,
    pagesCrawledDelta: current - previous,
    scopeChanged,
    byPriority: PRIORITY_ORDER.map((priority) => {
      const now = report.summary.issuesByPriority[priority] ?? 0;
      const then = baseline.baselineIssuesByPriority[priority] ?? 0;
      return { priority, current: now, baseline: then, delta: now - then };
    }),
  };
}

export function deriveExecutiveSummary(
  report: Report,
  options: { baseline?: ComparisonInput | null; topActionCount?: number } = {},
): ExecutiveSummary {
  const limit = options.topActionCount ?? 5;
  const ranked = rankIssues(report.issues).slice(0, limit);

  return {
    site: report.startUrl,
    generatedAt: report.generatedAt,
    pagesCrawled: report.summary.pagesCrawled,
    issueTotal: report.issues.length,
    byPriority: PRIORITY_ORDER.map((priority) => ({
      priority,
      count: report.summary.issuesByPriority[priority] ?? 0,
    })),
    topActions: ranked.map((issue) => ({
      id: issue.id,
      category: issue.category,
      priority: issue.priority,
      message: issue.message,
      fix: issue.fix ?? null,
      affectedUrls: issue.urls.length,
      sampleUrls: issue.urls.slice(0, 3),
    })),
    coverageGaps: deriveCoverageGaps(report),
    change: deriveChange(report, options.baseline ?? null),
    dataPeriod: report.realData
      ? {
          start: report.realData.periodStart,
          end: report.realData.periodEnd,
        }
      : null,
  };
}
