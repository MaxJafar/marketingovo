// Change detection across AuditRun history. Pure functions: take
// a previous and a current AuditRun, return an AuditDelta that
// classifies issues as new / resolved / persistent / regressed /
// improved and computes a regression score weighted by issue
// priority.
//
// Issue identity: two issues are "the same" iff their `id` field
// matches exactly. The id is stable per (module, rule) — the
// `data-integrity.test.ts` test pins a closed list of 42 issue
// ids. So `id` is a safe identity key.
//
// Regression score: weighted sum of new + regressed issues, with
//   High   = 3
//   Medium = 2
//   Low    = 1
// Negative means "the site got better" (more issues resolved
// than appeared). The operator's rule of thumb:
//   delta >= 0   → no regression
//   delta >  5   → new issues worth investigating
//   delta >  15  → real regression, post a notification

import type { AuditRun, AuditRunIssue } from "../core/audit-run.js";
import { canonicalizeIssueUrl } from "../core/entities.js";

export interface AuditDelta {
  /** Run id of the previous run. */
  previousRunId: string | null;
  /** Run id of the current run. */
  currentRunId: string;
  /** New issues that appeared between the two runs. */
  newIssues: AuditRunIssue[];
  /** Issues that were in the previous run but not the current one. */
  resolvedIssues: AuditRunIssue[];
  /** Issues present in both runs (and presumably the same rule). */
  persistentIssues: AuditRunIssue[];
  /** Persistent issues whose `urls` set changed (e.g. a different
   *  page is now triggering the same rule). */
  changedScopeIssues: Array<{
    previous: AuditRunIssue;
    current: AuditRunIssue;
  }>;
  /** Weighted sum (new + changed-scope regressions) - (resolved improvements). */
  regressionScore: number;
  /** Plain-language summary. */
  summary: string;
  /** Per-module breakdown (new / resolved counts grouped by moduleId). */
  byModule: Record<
    string,
    { new: number; resolved: number; persistent: number }
  >;
}

const PRIORITY_WEIGHTS: Record<"High" | "Medium" | "Low", number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

/**
 * Compute the delta between two AuditRuns. Either may be the
 * "first" run (previous is null) — in that case every issue in
 * the current run is reported as new.
 */
export function diffAuditRuns(
  previous: AuditRun | null,
  current: AuditRun,
): AuditDelta {
  const prevIssues = aggregateRuleInstances(previous?.issues ?? []);
  const currIssues = aggregateRuleInstances(current.issues ?? []);

  // Build id-keyed indexes for fast lookup.
  const prevById = new Map<string, AuditRunIssue>();
  for (const i of prevIssues) prevById.set(ruleKey(i), i);
  const currById = new Map<string, AuditRunIssue>();
  for (const i of currIssues) currById.set(ruleKey(i), i);

  const newIssues: AuditRunIssue[] = [];
  const resolvedIssues: AuditRunIssue[] = [];
  const persistentIssues: AuditRunIssue[] = [];
  const changedScopeIssues: Array<{
    previous: AuditRunIssue;
    current: AuditRunIssue;
  }> = [];

  for (const c of currIssues) {
    const p = prevById.get(ruleKey(c));
    if (!p) {
      newIssues.push(c);
    } else if (sameUrlSet(p.urls, c.urls)) {
      persistentIssues.push(c);
    } else {
      changedScopeIssues.push({ previous: p, current: c });
    }
  }
  for (const p of prevIssues) {
    if (!currById.has(ruleKey(p))) {
      resolvedIssues.push(p);
    }
  }

  // Regression score.
  let delta = 0;
  for (const i of newIssues) delta += PRIORITY_WEIGHTS[i.priority] ?? 1;
  for (const { previous: p, current: c } of changedScopeIssues) {
    // Scope grew: penalise the diff in URL count. If scope shrank,
    // that's an improvement.
    const prev = p.urls.length;
    const curr = c.urls.length;
    if (curr > prev) delta += PRIORITY_WEIGHTS[c.priority] ?? 1;
    else delta -= PRIORITY_WEIGHTS[c.priority] ?? 1;
  }
  for (const i of resolvedIssues) delta -= PRIORITY_WEIGHTS[i.priority] ?? 1;

  // By-module breakdown.
  const byModule: Record<
    string,
    { new: number; resolved: number; persistent: number }
  > = {};
  for (const i of newIssues) bumpModule(byModule, i.moduleId, "new");
  for (const i of resolvedIssues) bumpModule(byModule, i.moduleId, "resolved");
  for (const i of persistentIssues)
    bumpModule(byModule, i.moduleId, "persistent");

  // Summary.
  const summary = buildSummary(
    previous,
    current,
    newIssues.length,
    resolvedIssues.length,
    changedScopeIssues.length,
    delta,
  );

  return {
    previousRunId: previous?.id ?? null,
    currentRunId: current.id,
    newIssues,
    resolvedIssues,
    persistentIssues,
    changedScopeIssues,
    regressionScore: delta,
    summary,
    byModule,
  };
}

/**
 * Composer v1 stores one issue per canonical URL. Legacy records stored one
 * rule with many URLs. Aggregate both forms by module + rule before diffing so
 * neither duplicate rule ids nor storage format changes corrupt the baseline.
 */
function aggregateRuleInstances(
  issues: readonly AuditRunIssue[],
): AuditRunIssue[] {
  const grouped = new Map<string, AuditRunIssue>();
  for (const issue of issues) {
    const key = ruleKey(issue);
    const urls = issue.urls
      .map((url) => canonicalizeIssueUrl(url))
      .filter((url): url is string => url !== null);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...issue, urls: [...new Set(urls)] });
      continue;
    }
    existing.urls = [...new Set([...existing.urls, ...urls])];
  }
  return [...grouped.values()];
}

function ruleKey(issue: AuditRunIssue): string {
  return `${issue.moduleId ?? "unknown"}\u0000${issue.ruleId ?? issue.id}`;
}

function sameUrlSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  for (const u of b) if (!aSet.has(u)) return false;
  return true;
}

function bumpModule(
  acc: Record<string, { new: number; resolved: number; persistent: number }>,
  moduleId: string | undefined,
  key: "new" | "resolved" | "persistent",
): void {
  const k = moduleId ?? "unknown";
  if (!acc[k]) acc[k] = { new: 0, resolved: 0, persistent: 0 };
  acc[k][key] += 1;
}

function buildSummary(
  previous: AuditRun | null,
  current: AuditRun,
  newCount: number,
  resolvedCount: number,
  changedScopeCount: number,
  delta: number,
): string {
  if (!previous) {
    return `First run. ${current.issueCount} issue(s) across ${current.modules.length} module(s). No baseline to compare.`;
  }
  const verdict =
    delta > 0 ? "regression" : delta < 0 ? "improvement" : "no change";
  return `Compared with previous run ${previous.id}: ${newCount} new, ${resolvedCount} resolved, ${changedScopeCount} changed-scope. Regression score: ${delta >= 0 ? "+" : ""}${delta} (${verdict}).`;
}

/**
 * Issue-count-only fallback for pre-Sprint-10 AuditRun records
 * that lack the `issues` field. Less informative (no per-id
 * breakdown) but at least surfaces the headline number.
 */
export function diffIssueCount(
  previous: AuditRun | null,
  current: AuditRun,
): { delta: number; summary: string } {
  if (!previous) {
    return {
      delta: current.issueCount,
      summary: `First run. ${current.issueCount} issue(s).`,
    };
  }
  const delta = current.issueCount - previous.issueCount;
  const verdict =
    delta > 0 ? "regression" : delta < 0 ? "improvement" : "no change";
  return {
    delta,
    summary: `issueCount ${previous.issueCount} → ${current.issueCount} (${delta >= 0 ? "+" : ""}${delta}, ${verdict}). Pre-Sprint-10 record: no per-id breakdown available.`,
  };
}
