// Higher-level query helpers on top of audit-run.ts's storage
// primitives. These exist for the change-detection module (and
// any future "show me my last N runs" UI). They are pure
// functions over the in-memory listAuditRuns() result — the
// storage layer remains a flat JSON file.

import { listAuditRuns, loadAuditRun, type AuditRun } from "./audit-run.js";

export interface HistoryQuery {
  /** Restrict to runs for this URL (exact match). */
  startUrl?: string;
  /** Restrict to runs whose startUrl begins with this prefix. */
  startUrlPrefix?: string;
  /** Restrict to runs that completed after this ISO timestamp. */
  since?: string;
  /** Max runs to return. Default 10. */
  limit?: number;
  /** Status filter. Default: only completed. */
  status?: AuditRun["status"];
}

export function queryHistory(root: string, q: HistoryQuery = {}): AuditRun[] {
  const limit = q.limit ?? 10;
  const status = q.status ?? (["succeeded", "partial"] as const);
  const runs = listAuditRuns(root, {
    limit,
    status,
    startUrlPrefix: q.startUrl ?? q.startUrlPrefix,
  });
  return runs.filter((r) => (q.since ? r.requestedAt >= q.since : true));
}

/**
 * Returns the two most recent completed runs for a URL. If only
 * one exists, `previous` is null. The pair is what the
 * change-detection module needs.
 */
export function latestPair(
  root: string,
  startUrl: string,
): { previous: AuditRun | null; current: AuditRun | null } {
  const runs = listAuditRuns(root, {
    startUrlPrefix: startUrl,
    status: ["succeeded", "partial"],
    limit: 2,
  });
  if (runs.length === 0) return { previous: null, current: null };
  if (runs.length === 1) return { previous: null, current: runs[0] ?? null };
  // listAuditRuns returns sorted descending by requestedAt, so
  // [0] is the most recent and [1] is the previous one.
  return { previous: runs[1] ?? null, current: runs[0] ?? null };
}

/**
 * Returns the most recent completed run for a URL, or null.
 */
export function latest(root: string, startUrl: string): AuditRun | null {
  const runs = listAuditRuns(root, {
    startUrlPrefix: startUrl,
    status: ["succeeded", "partial"],
    limit: 1,
  });
  return runs[0] ?? null;
}

export function loadById(root: string, id: string): AuditRun | null {
  return loadAuditRun(root, id);
}
