// change_detection: compare a current audit run with a previous
// one for the same URL and return a structured delta (new,
// resolved, persistent, changed-scope issues + a regression
// score). The "did this site just get worse?" question, answered
// from the existing AuditRun history at <projectRoot>/audits.json.
//
// The module does not require a crawl. It depends on the
// audit-run store being populated, which the audit-full module
// does automatically. So a typical workflow is:
//
//   $ agentseo audit <url> --modules onpage,technical ...
//   $ agentseo change-detection <url>            # delta vs prior run
//
//   or in one composer run:
//
//   $ agentseo audit <url> --modules onpage,technical,integrations:change-detection
//
// In the composer path, the module reads the run that was just
// persisted by audit-full and compares it to the second-most-
// recent run for the same URL.
//
// For pre-Sprint-10 AuditRun records that lack the `issues`
// field, the module falls back to issueCount-only diff
// (diffIssueCount) and flags the result as a degraded signal.

import { ConsoleLogger } from "../../core/logger.js";
import {
  queryHistory,
  latestPair,
  loadById,
  type HistoryQuery,
} from "../../core/audit-history.js";
import {
  diffAuditRuns,
  diffIssueCount,
  type AuditDelta,
} from "../../integrations/change.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";

export const changeDetectionModule: Module = {
  id: "integrations:change-detection",
  version: "0.9.0",
  displayName: "Change Detection",
  category: "research",
  description:
    "Compare the most recent audit run for a URL with the previous one. Returns new / resolved / persistent / changed-scope issues, a regression score weighted by issue priority (High=3, Medium=2, Low=1), and a per-module breakdown. Falls back to issueCount-only diff for pre-Sprint-10 AuditRun records that lack per-id data.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "Site URL. Required. The module finds the two most recent runs for this URL.",
      },
      runId: {
        type: "string",
        description:
          "Optional. Specific run id to use as the 'current' run. If omitted, the most recent completed run is used.",
      },
      previousRunId: {
        type: "string",
        description:
          "Optional. Specific run id to use as the 'previous' run. If omitted, the second-most-recent completed run is used.",
      },
      includeHistory: {
        type: "boolean",
        default: false,
        description:
          "If true, also return the last N runs as a trend (issueCount per run). Default false.",
      },
      historyLimit: {
        type: "number",
        default: 7,
        description:
          "Number of runs in the trend list when includeHistory=true. Default 7.",
      },
    },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      delta: {
        type: "object",
        description:
          "AuditDelta (new, resolved, persistent, changed-scope, regression score, by-module breakdown).",
      },
      trend: {
        type: "array",
        description:
          "Issue-count trend over the last N runs. Empty unless includeHistory=true.",
      },
      issues: {
        type: "array",
        description:
          "Operator-facing issues: e.g. a 'regression' warning if delta > 5.",
      },
    },
  },
  dependsOn: [],
  configKeys: [],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "change-detection",
    });
    // Defensive: in tests the caller may pass a partial ctx
    // (e.g. just { projectRoot }). The signal context is part
    // of the contract, but a no-op fallback keeps unit tests
    // and CLI invocations from crashing on it.
    const signal = ctx.signal ?? {
      markWeak: () => {},
      markStrong: () => {},
      isFollowUp: false,
    };
    const url = (input.url as string | undefined)?.trim();
    if (!url)
      throw new Error("change-detection requires a non-empty 'url' in input");

    const projectRoot =
      (ctx.projectRoot as string | undefined) ?? process.cwd();
    const runId = input.runId as string | undefined;
    const previousRunId = input.previousRunId as string | undefined;
    const includeHistory =
      (input.includeHistory as boolean | undefined) ?? false;
    const historyLimit = Math.max(
      1,
      Math.min(50, (input.historyLimit as number | undefined) ?? 7),
    );

    let current = runId ? loadById(projectRoot, runId) : null;
    let previous = previousRunId ? loadById(projectRoot, previousRunId) : null;
    if (!current) {
      const pair = latestPair(projectRoot, url);
      current = pair.current;
      // If the caller didn't pin a previous, use the latest-pair's previous.
      if (!previousRunId) previous = pair.previous;
    }
    if (!current) {
      throw new Error(
        `change-detection: no completed audit runs found for ${url}`,
      );
    }

    // Pick the more informative diff. If both runs have full
    // issues lists, use diffAuditRuns (per-id). If at least one
    // is pre-Sprint-10 (no `issues` field), fall back.
    const prevRun = previous;
    let delta: AuditDelta | { delta: number; summary: string };
    let degraded = false;
    if (prevRun && (!prevRun.issues || !current.issues)) {
      const fb = diffIssueCount(prevRun, current);
      delta = {
        previousRunId: prevRun.id,
        currentRunId: current.id,
        newIssues: [],
        resolvedIssues: [],
        persistentIssues: [],
        changedScopeIssues: [],
        regressionScore: fb.delta,
        summary: fb.summary,
        byModule: {},
      };
      degraded = true;
    } else {
      delta = diffAuditRuns(prevRun, current);
    }

    const trend = includeHistory
      ? queryHistory(projectRoot, {
          startUrl: url,
          status: "succeeded",
          limit: historyLimit,
        }).map((r) => ({
          runId: r.id,
          requestedAt: r.requestedAt,
          issueCount: r.issueCount,
        }))
      : [];

    const issues = issuesFromDelta(delta, degraded);
    if (issues.length === 0) {
      signal.markStrong(`change-detection: ${delta.summary}`);
    } else {
      signal.markWeak(
        `change-detection: ${issues.length} issue(s), score ${delta.regressionScore}`,
      );
    }
    logger.info("change-detection complete", {
      url,
      current: current.id,
      previous: prevRun?.id ?? null,
      regressionScore: delta.regressionScore,
      degraded,
    });

    return { delta, trend, issues } as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    // selfTest is trivial: this module is pure in-memory over the
    // local audit-run store. No network, no env. Always ok as
    // long as the runtime can find the audit-run module.
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};

function issuesFromDelta(
  delta: AuditDelta | { regressionScore: number; summary: string },
  degraded: boolean,
): Array<{ severity: "info" | "warning" | "critical"; message: string }> {
  const issues: Array<{
    severity: "info" | "warning" | "critical";
    message: string;
  }> = [];
  if (degraded) {
    issues.push({
      severity: "info",
      message:
        "Pre-Sprint-10 AuditRun record in the previous slot; per-id diff unavailable. Re-run audits to upgrade the store.",
    });
  }
  if (delta.regressionScore > 15) {
    issues.push({
      severity: "critical",
      message: `Regression score ${delta.regressionScore} (> 15). Multiple new High-priority issues likely. Investigate before deploying.`,
    });
  } else if (delta.regressionScore > 5) {
    issues.push({
      severity: "warning",
      message: `Regression score ${delta.regressionScore} (> 5). New issues worth investigating.`,
    });
  } else if (delta.regressionScore < -5) {
    issues.push({
      severity: "info",
      message: `Site improved (regression score ${delta.regressionScore}). ${delta.summary}`,
    });
  }
  return issues;
}
