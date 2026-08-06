import type { MarketingReport } from "@marketingovo/contracts/reporting";
import type { MarketingReport as EngineMarketingReport } from "@marketingovo/core";
import type { MarketingovoDatabase } from "@marketingovo/storage-sqlite";
import { summarizeChannelMetrics, daysBetween } from "./channels.js";

/**
 * Gathering the evidence a cross-channel report is composed from.
 *
 * The composer in core is pure and decides what may be claimed. This file is
 * the boring half: it reads storage and hands over readings that already carry
 * their own availability. The one rule it must not break is the same one
 * everywhere else — a query returning no rows is `unavailable`, never zero.
 * "Nobody posted" and "the table has no rows because the sync never ran" look
 * identical in SQL and mean opposite things to a client.
 */

/**
 * The engine and the API describe a report separately: core is the layer below
 * the contracts package. This assignment is the check that they never drift —
 * a renamed or retyped field stops this file compiling rather than silently
 * dropping data on the way to storage.
 */
const _engineReportMatchesContract: MarketingReport =
  null as never as EngineMarketingReport;
void _engineReportMatchesContract;

export interface ReportWindow {
  start: string;
  end: string;
  comparisonStart: string | null;
  comparisonEnd: string | null;
}

/** ISO date `days` before `reference`, in UTC. */
function isoDate(reference: Date, offsetDays: number): string {
  return new Date(reference.getTime() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Resolves the window, and the preceding one of equal length when a comparison
 * was asked for.
 *
 * The comparison is always the immediately preceding period rather than "the
 * same month last year": a marketer comparing July to June is comparing what
 * they did, while a year-over-year comparison folds in seasonality nobody
 * controlled.
 */
export function resolveReportWindow(input: {
  start?: string | undefined;
  end?: string | undefined;
  compare?: boolean | undefined;
  now?: Date;
}): ReportWindow {
  const now = input.now ?? new Date();
  // Defaults to the last complete 30 days, ending yesterday: providers restate
  // the current day, and a report is a statement about settled figures.
  const end = input.end ?? isoDate(now, -1);
  const start = input.start ?? isoDate(new Date(`${end}T00:00:00Z`), -29);
  if (!input.compare) {
    return { start, end, comparisonStart: null, comparisonEnd: null };
  }
  const length = Math.max(1, daysBetween(start, end));
  const comparisonEnd = isoDate(new Date(`${start}T00:00:00Z`), -1);
  const comparisonStart = isoDate(
    new Date(`${comparisonEnd}T00:00:00Z`),
    -(length - 1),
  );
  return { start, end, comparisonStart, comparisonEnd };
}

const METRIC_KEYS = ["spend", "impressions", "clicks", "conversions"] as const;

type Totals = {
  value: number | null;
  state: "available" | "partial" | "unavailable" | "failed";
  note?: string | null;
};

/** Turns channel summaries into the composer's per-metric readings. */
function totalsFromSummaries(
  summaries: ReturnType<typeof summarizeChannelMetrics>,
  platform: string,
): Record<string, Totals> {
  const totals: Record<string, Totals> = {};
  for (const key of METRIC_KEYS) {
    const summary = summaries.find(
      (entry) => entry.metricKey === key && entry.platform === platform,
    );
    totals[key] = summary
      ? {
          value: summary.value,
          state: summary.state,
          note: summary.note,
        }
      : {
          value: null,
          state: "unavailable",
          note: "This account reported no readings for the period.",
        };
  }
  return totals;
}

export interface GatheredEvidence {
  paid: {
    notConnected: boolean;
    cabinets: Array<{
      name: string;
      currency: string | null;
      current: Record<string, Totals>;
      previous?: Record<string, Totals> | undefined;
      platforms: Array<{ platform: string; current: Record<string, Totals> }>;
    }>;
  };
  organic: {
    clicks: Totals;
    impressions: Totals;
    position: Totals;
    sessions: Totals;
    keyEvents: Totals;
    seoHealth: Totals;
    previous?: Record<string, Totals> | undefined;
    sources: Array<{
      id: string;
      label: string;
      state: "available" | "partial" | "unavailable" | "failed";
      reason: string;
      observedAt: string | null;
    }>;
  };
  social: {
    notConnected: boolean;
    indeterminate: number;
    publishedByPlatform: Array<{
      platform: string;
      published: number;
      failed: number;
    }>;
  };
  email: {
    templatesBuilt: number;
    revisionsSaved: number;
    withBlockingFindings: number;
  };
  actions: {
    opened: number;
    resolved: number;
    verified: number;
    noAuditInPeriod: boolean;
  };
}

export function gatherPaid(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence["paid"] {
  const cabinets = database.listChannelAccounts(projectId, { kind: "ads" });
  if (cabinets.length === 0) return { notConnected: true, cabinets: [] };

  const requestedDays = Math.max(1, daysBetween(window.start, window.end));
  return {
    notConnected: false,
    cabinets: cabinets.map((cabinet) => {
      const metrics = database.listChannelMetrics({
        channelAccountId: cabinet.id,
        start: window.start,
        end: window.end,
      });
      const accountSummaries = summarizeChannelMetrics(metrics, {
        requestedDays,
        entityKind: "account",
      });
      const campaignSummaries = summarizeChannelMetrics(metrics, {
        requestedDays,
        entityKind: "campaign",
      });

      let previous: Record<string, Totals> | undefined;
      if (window.comparisonStart && window.comparisonEnd) {
        const priorMetrics = database.listChannelMetrics({
          channelAccountId: cabinet.id,
          start: window.comparisonStart,
          end: window.comparisonEnd,
        });
        previous = totalsFromSummaries(
          summarizeChannelMetrics(priorMetrics, {
            requestedDays: Math.max(
              1,
              daysBetween(window.comparisonStart, window.comparisonEnd),
            ),
            entityKind: "account",
          }),
          "all",
        );
      }

      const platforms = [...new Set(campaignSummaries.map((s) => s.platform))]
        .filter((platform) => platform !== "all")
        .map((platform) => ({
          platform,
          current: totalsFromSummaries(campaignSummaries, platform),
        }));

      return {
        name: cabinet.displayName,
        provider: cabinet.provider,
        currency: cabinet.currency,
        current: totalsFromSummaries(accountSummaries, "all"),
        previous,
        platforms,
      };
    }),
  };
}

/**
 * Organic evidence from the most recent audit inside the window.
 *
 * Deliberately scoped to the window: a report about July that quoted an audit
 * from May would be describing a different site.
 */
export function gatherOrganic(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence["organic"] {
  const runs = database
    .listRuns(projectId)
    .filter(
      (run) =>
        run.workflowId === "audit" &&
        (run.status === "succeeded" || run.status === "partial") &&
        run.requestedAt.slice(0, 10) >= window.start &&
        run.requestedAt.slice(0, 10) <= window.end,
    );
  const latest = runs[0];

  const absent = (reason: string): Totals => ({
    value: null,
    state: "unavailable",
    note: reason,
  });

  if (!latest) {
    const reason =
      "No audit ran inside this reporting period, so search and analytics evidence was not collected.";
    return {
      clicks: absent(reason),
      impressions: absent(reason),
      position: absent(reason),
      sessions: absent(reason),
      keyEvents: absent(reason),
      seoHealth: absent(reason),
      sources: [
        {
          id: "audit",
          label: "Site audit",
          state: "unavailable",
          reason,
          observedAt: null,
        },
      ],
    };
  }

  const windows = database.listPerformanceWindows(latest.id);
  const gsc = windows.find(
    (entry) => entry.source === "gsc" && entry.period === "current",
  );
  const ga4 = windows.find(
    (entry) => entry.source === "ga4" && entry.period === "current",
  );
  const pages = database.listPagePerformance(latest.id, "current");

  const sum = (
    pick: (row: (typeof pages)[number]) => number | null,
    source: { state: string } | undefined,
    label: string,
  ): Totals => {
    if (
      !source ||
      source.state === "unavailable" ||
      source.state === "failed"
    ) {
      return {
        value: null,
        state: (source?.state as Totals["state"]) ?? "unavailable",
        note: `${label} did not report for this period.`,
      };
    }
    const values = pages
      .map((row) => pick(row))
      .filter((value): value is number => value !== null);
    if (values.length === 0) {
      return {
        value: null,
        state: "unavailable",
        note: `${label} returned no rows for this period.`,
      };
    }
    return {
      value: values.reduce((total, value) => total + value, 0),
      state: source.state === "partial" ? "partial" : "available",
    };
  };

  const positions = pages
    .map((row) => row.position)
    .filter((value): value is number => value !== null);

  const metrics = database.latestMetrics(projectId);
  const health = metrics.seo_health;

  return {
    clicks: sum((row) => row.clicks, gsc, "Search Console"),
    impressions: sum((row) => row.impressions, gsc, "Search Console"),
    position:
      positions.length > 0 && gsc && gsc.state !== "failed"
        ? {
            value:
              positions.reduce((total, value) => total + value, 0) /
              positions.length,
            state: gsc.state === "partial" ? "partial" : "available",
          }
        : {
            value: null,
            state: "unavailable",
            note: "Search Console reported no ranking positions for this period.",
          },
    sessions: sum((row) => row.sessions, ga4, "Analytics"),
    keyEvents: sum((row) => row.keyEvents, ga4, "Analytics"),
    seoHealth:
      health && health.value !== null && health.state === "available"
        ? { value: health.value, state: "available" }
        : {
            value: null,
            state: "unavailable",
            note: "No SEO health score was calculated for this period.",
          },
    sources: [
      {
        id: "gsc",
        label: "Search Console",
        state: (gsc?.state as Totals["state"]) ?? "unavailable",
        reason: gsc?.note ?? (gsc ? "" : "Search Console is not connected."),
        observedAt: gsc?.fetchedAt ?? null,
      },
      {
        id: "ga4",
        label: "Analytics",
        state: (ga4?.state as Totals["state"]) ?? "unavailable",
        reason: ga4?.note ?? (ga4 ? "" : "Analytics is not connected."),
        observedAt: ga4?.fetchedAt ?? null,
      },
    ],
  };
}

export function gatherSocial(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence["social"] {
  const accounts = database.listChannelAccounts(projectId, { kind: "social" });
  if (accounts.length === 0) {
    return { notConnected: true, indeterminate: 0, publishedByPlatform: [] };
  }

  const records = database
    .listPublishRecords({ projectId, limit: 500 })
    .filter(
      (record) =>
        record.attemptedAt.slice(0, 10) >= window.start &&
        record.attemptedAt.slice(0, 10) <= window.end,
    );

  const byPlatform = new Map<string, { published: number; failed: number }>();
  let indeterminate = 0;
  for (const record of records) {
    if (record.state === "indeterminate" || record.state === "attempting") {
      indeterminate += 1;
      continue;
    }
    const entry = byPlatform.get(record.platform) ?? {
      published: 0,
      failed: 0,
    };
    if (record.state === "published") entry.published += 1;
    else entry.failed += 1;
    byPlatform.set(record.platform, entry);
  }

  return {
    notConnected: false,
    indeterminate,
    publishedByPlatform: [...byPlatform.entries()].map(
      ([platform, counts]) => ({
        platform,
        ...counts,
      }),
    ),
  };
}

export function gatherEmail(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence["email"] {
  const templates = database.listEmailTemplates(projectId);
  let revisionsSaved = 0;
  let withBlockingFindings = 0;
  const touched = new Set<string>();

  for (const template of templates) {
    const workspace = database.getEmailTemplateWorkspace(template.id);
    for (const version of workspace?.history ?? []) {
      const day = version.createdAt.slice(0, 10);
      if (day < window.start || day > window.end) continue;
      revisionsSaved += 1;
      touched.add(template.id);
      const counts = version.report?.counts;
      if (counts && (counts.blocking > 0 || counts.error > 0)) {
        withBlockingFindings += 1;
      }
    }
  }

  return {
    templatesBuilt: touched.size,
    revisionsSaved,
    withBlockingFindings,
  };
}

export function gatherActions(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence["actions"] {
  const auditRan = database
    .listRuns(projectId)
    .some(
      (run) =>
        run.workflowId === "audit" &&
        run.requestedAt.slice(0, 10) >= window.start &&
        run.requestedAt.slice(0, 10) <= window.end,
    );
  if (!auditRan) {
    return { opened: 0, resolved: 0, verified: 0, noAuditInPeriod: true };
  }

  const actions = database.listActions(projectId, { includeAdjudicated: true });
  const inWindow = (value: string | null | undefined): boolean =>
    Boolean(
      value &&
      value.slice(0, 10) >= window.start &&
      value.slice(0, 10) <= window.end,
    );

  return {
    opened: actions.filter((action) => inWindow(action.createdAt)).length,
    resolved: actions.filter(
      (action) => action.status === "resolved" && inWindow(action.updatedAt),
    ).length,
    verified: actions.filter(
      (action) =>
        action.verification === "verified" && inWindow(action.updatedAt),
    ).length,
    noAuditInPeriod: false,
  };
}

export function gatherEvidence(
  database: MarketingovoDatabase,
  projectId: string,
  window: ReportWindow,
): GatheredEvidence {
  return {
    paid: gatherPaid(database, projectId, window),
    organic: gatherOrganic(database, projectId, window),
    social: gatherSocial(database, projectId, window),
    email: gatherEmail(database, projectId, window),
    actions: gatherActions(database, projectId, window),
  };
}
