// AuditRun: the persistent record of a single `marketingovo audit <url>`
// (or any other) workflow run. Stores what was requested, when, what
// modules ran, what they reported, and the final status.
//
// Storage: one JSON file per project, <projectRoot>/audits.json,
// keyed by run id. Updates overwrite the entry; listing sorts by
// requestedAt descending. No SQLite, no migration. The file is
// operator-readable (open in any text editor).
//
// Why a flat file and not the existing SQLite store: AuditRuns are
// workflow-level entities. The SQLite store is for crawl-level
// data (pages, issues, history). Mixing them would force a schema
// migration for every project on every upgrade. Keeping audit
// history in a separate file is a deliberate trade: zero-migration
// upgrades in exchange for a slightly less powerful query
// interface (we can filter, sort, paginate; we cannot JOIN against
// crawl history).
//
// The schema is intentionally permissive. New optional fields can
// be added without bumping a version. If a future Sprint needs
// to evolve the shape incompatibly, that's the time to add a
// `schemaVersion` field and a migrator.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ModuleId } from "../modules/types.js";
import type { IssueInstance } from "./entities.js";
import type { PassSignal } from "./signal-eval.js";

export type AuditRunStatus =
  "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";

export interface AuditRun {
  id: string;
  startUrl: string;
  modules: ModuleId[];
  requestedAt: string;
  completedAt?: string;
  status: AuditRunStatus;
  /** How many composer passes ran (1 for single-pass, 2-3 for deep). */
  passes: number;
  /** Total issues surfaced across all modules. */
  issueCount: number;
  /** Full issue list (optional, persisted since Sprint 10). Used
   *  by the change-detection module to compute deltas. Older runs
   *  (pre-Sprint 10) may have this field absent; readers must
   *  tolerate that (it falls back to issueCount-only comparisons). */
  issues?: readonly AuditRunIssue[];
  /** Canonical per-URL issue instances used by the v1 history model. */
  issueInstances?: readonly IssueInstance[];
  signal: Record<string, { weak: string[]; strong: string[] }>;
  durationMs?: number;
  errored?: Record<string, string>;
  /** Caller-supplied notes (e.g. operator label, job name). */
  notes?: string;
}

/**
 * A trimmed Issue shape persisted in AuditRun. Mirrors the public
 * `Issue` interface from src/checks/ but is duplicated here to
 * avoid a cross-module import: audit-run.ts sits at the storage
 * layer and shouldn't reach into the checks layer. Forward-compat:
 * if a future Sprint needs more fields, add them here and in
 * the writer in src/modules/audit-full/index.ts.
 */
export interface AuditRunIssue {
  id: string;
  category: string;
  /** High | Medium | Low (matches Priority in checks/index.ts). */
  priority: "High" | "Medium" | "Low";
  message: string;
  urls: string[];
  detail?: Record<string, unknown>;
  fix?: string;
  /** Optional module id, persisted since Sprint 10 so the
   *  change-detection module can attribute issues to modules. */
  moduleId?: ModuleId;
  /** Stable v1 identity fields. Optional while legacy records migrate. */
  fingerprint?: string;
  ruleId?: string;
  canonicalUrl?: string | null;
}

const FILE_NAME = "audits.json";

interface OnDisk {
  /** Schema version. Bumped when AuditRun's shape changes
   *  incompatibly. We don't have one yet. */
  schemaVersion: 2;
  runs: Record<string, AuditRun>;
}

function readDisk(root: string): OnDisk {
  const path = join(root, FILE_NAME);
  if (!existsSync(path)) {
    return { schemaVersion: 2, runs: {} };
  }
  const text = readFileSync(path, "utf8");
  if (text.trim() === "") return { schemaVersion: 2, runs: {} };
  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.runs &&
      typeof parsed.runs === "object"
    ) {
      // Forward-compat: any unknown fields are preserved.
      const runs = Object.fromEntries(
        Object.entries(
          parsed.runs as Record<string, AuditRun & { status: string }>,
        ).map(([id, run]) => [
          id,
          { ...run, status: normalizeLegacyStatus(run.status) },
        ]),
      ) as Record<string, AuditRun>;
      return { schemaVersion: 2, runs };
    }
  } catch {
    // Fall through: corrupt file. Back it up and start fresh.
  }
  // Don't clobber: rename the broken file and start a new one.
  const backupPath = `${path}.corrupt.${Date.now()}`;
  writeFileSync(backupPath, text);
  return { schemaVersion: 2, runs: {} };
}

function writeDisk(root: string, disk: OnDisk): void {
  mkdirSync(dirname(join(root, FILE_NAME)), { recursive: true });
  writeFileSync(join(root, FILE_NAME), JSON.stringify(disk, null, 2) + "\n");
}

/** Generate a new AuditRun id. Format: `<ISO timestamp>-<short
 *  random>` so it's both sortable and (effectively) unique
 *  within a single project. Not a UUID — we don't need the
 *  122-bit uniqueness guarantee, and timestamp prefix makes
 *  listing by id natural. */
export function newAuditRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rnd}`;
}

export function saveAuditRun(root: string, run: AuditRun): void {
  const disk = readDisk(root);
  disk.runs[run.id] = run;
  writeDisk(root, disk);
}

export function loadAuditRun(root: string, id: string): AuditRun | null {
  const disk = readDisk(root);
  return disk.runs[id] ?? null;
}

export interface ListAuditRunsOpts {
  limit?: number;
  status?: AuditRunStatus | readonly AuditRunStatus[];
  /** Filter to runs whose startUrl starts with this prefix. */
  startUrlPrefix?: string;
}

export function listAuditRuns(
  root: string,
  opts: ListAuditRunsOpts = {},
): AuditRun[] {
  const disk = readDisk(root);
  let runs = Object.values(disk.runs);
  if (opts.status) {
    const statuses: readonly AuditRunStatus[] = Array.isArray(opts.status)
      ? opts.status
      : [opts.status];
    runs = runs.filter((r) => statuses.includes(r.status));
  }
  if (opts.startUrlPrefix)
    runs = runs.filter((r) => r.startUrl.startsWith(opts.startUrlPrefix!));
  runs.sort((a, b) =>
    a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0,
  );
  if (opts.limit && opts.limit > 0) runs = runs.slice(0, opts.limit);
  return runs;
}

function normalizeLegacyStatus(status: string): AuditRunStatus {
  if (status === "completed") return "succeeded";
  if (status === "aborted") return "cancelled";
  if (
    [
      "queued",
      "running",
      "succeeded",
      "partial",
      "failed",
      "cancelled",
    ].includes(status)
  ) {
    return status as AuditRunStatus;
  }
  return "failed";
}

export function deleteAuditRun(root: string, id: string): boolean {
  const disk = readDisk(root);
  if (!(id in disk.runs)) return false;
  delete disk.runs[id];
  writeDisk(root, disk);
  return true;
}

/** Convenience: patch a run in place. Returns the updated run, or
 *  null if the id doesn't exist. The callback receives the current
 *  run; whatever it returns replaces it. */
export function patchAuditRun(
  root: string,
  id: string,
  patch: (current: AuditRun) => AuditRun,
): AuditRun | null {
  const disk = readDisk(root);
  const current = disk.runs[id];
  if (!current) return null;
  const next = patch(current);
  disk.runs[id] = next;
  writeDisk(root, disk);
  return next;
}

/** Convert a Map<ModuleId, PassSignal> (the in-memory shape from
 *  the composer) into the Record shape AuditRun stores. */
export function signalToRecord(
  signal: ReadonlyMap<ModuleId, PassSignal>,
): Record<string, { weak: string[]; strong: string[] }> {
  const out: Record<string, { weak: string[]; strong: string[] }> = {};
  for (const [k, v] of signal) {
    out[k] = { weak: [...v.weak], strong: [...v.strong] };
  }
  return out;
}
