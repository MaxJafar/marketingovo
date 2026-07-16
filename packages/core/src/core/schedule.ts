// Schedule: persistent cron-style runs. The schedule is a JSON file
// at `<projectRoot>/schedule.json` containing an array of jobs:
//
//   [{
//     "name": "daily-audit",
//     "startUrl": "https://example.com/",
//     "intervalMinutes": 1440,
//     "renderMode": "static",
//     "limits": { "maxUrls": 200 }
//   }]
//
// The scheduler derives one bounded timer from each persisted
// `nextRunAt` cursor. On finish, it stores the full page/issue snapshot
// and advances the cursor, so process restarts do not reset cadence.

import { ProjectStore } from "./store.js";
import { crawl, type CrawlOptions } from "../orchestrator.js";
import type { Report } from "./report/index.js";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface ScheduleJob {
  name: string;
  startUrl: string;
  intervalMinutes: number;
  renderMode?: "static" | "js";
  collectVitals?: boolean;
  limits?: CrawlOptions["limits"];
  seedUrls?: string[];
  enabled?: boolean;
  /** IANA timezone used when the job was created. */
  timezone?: string;
  /** Durable scheduling cursor; timers are derived from this value. */
  nextRunAt?: string;
  lastRunAt?: string;
}

export interface ScheduleConfig {
  jobs: ScheduleJob[];
}

const DEFAULT_PATH = "schedule.json";

export function loadSchedule(
  projectRoot: string,
  path = DEFAULT_PATH,
): ScheduleConfig {
  const full = join(projectRoot, path);
  if (!existsSync(full)) return { jobs: [] };
  try {
    const parsed = JSON.parse(readFileSync(full, "utf8")) as { jobs?: unknown };
    if (!Array.isArray(parsed.jobs)) return { jobs: [] };
    const seen = new Set<string>();
    const jobs = parsed.jobs
      .map(normalizeJob)
      .filter((job): job is ScheduleJob => job !== null)
      .filter((job) => {
        if (seen.has(job.name)) return false;
        seen.add(job.name);
        return true;
      });
    return { jobs };
  } catch {
    return { jobs: [] };
  }
}

export function saveSchedule(
  projectRoot: string,
  cfg: ScheduleConfig,
  path = DEFAULT_PATH,
): void {
  if (!existsSync(projectRoot)) mkdirSync(projectRoot, { recursive: true });
  const jobs = cfg.jobs.map((job) => {
    const normalized = normalizeJob(job);
    if (!normalized)
      throw new TypeError(`invalid schedule job: ${job?.name ?? "unknown"}`);
    return normalized;
  });
  if (new Set(jobs.map((job) => job.name)).size !== jobs.length) {
    throw new TypeError("schedule job names must be unique");
  }
  writeFileSync(
    join(projectRoot, path),
    JSON.stringify({ jobs }, null, 2) + "\n",
  );
}

export interface RunResult {
  job: ScheduleJob;
  report: Report;
  durationMs: number;
  pages: number;
  issues: number;
}

export async function runJob(
  job: ScheduleJob,
  projectRoot: string,
): Promise<RunResult> {
  const store = new ProjectStore({ projectRoot });
  const t0 = Date.now();
  try {
    const outcome = await crawl({
      startUrl: job.startUrl,
      seedUrls: job.seedUrls,
      renderMode: job.renderMode ?? "static",
      collectVitals: job.collectVitals,
      limits: job.limits,
      projectRoot,
    });
    const report = outcome.report;
    const id = await store.beginCrawl(new Date(t0).toISOString(), job.startUrl);
    await store.savePages(id, outcome.index.pages.values());
    await store.saveIssues(id, report.issues);
    await store.finishCrawl(
      id,
      new Date().toISOString(),
      outcome.index.pages.size,
      Date.now() - t0,
    );
    return {
      job,
      report,
      durationMs: Date.now() - t0,
      pages: report.summary.pagesCrawled,
      issues: report.issues.length,
    };
  } finally {
    store.close();
  }
}

export class Scheduler {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private running = false;

  constructor(private readonly projectRoot: string) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const cfg = loadSchedule(this.projectRoot);
    let changed = false;
    for (const job of cfg.jobs) {
      if (job.enabled === false) continue;
      if (!validDate(job.nextRunAt)) {
        job.nextRunAt = new Date(Date.now() + intervalMs(job)).toISOString();
        changed = true;
      }
      this.scheduleJob(job);
    }
    if (changed) saveSchedule(this.projectRoot, cfg);
  }

  private scheduleJob(job: ScheduleJob): void {
    const dueAt = Date.parse(job.nextRunAt!);
    const delay = Math.max(0, dueAt - Date.now());
    if (delay > 2_147_000_000) {
      const longTimer = setTimeout(() => {
        if (this.running) this.scheduleJob(job);
      }, 2_147_000_000);
      this.timers.set(job.name, longTimer);
      return;
    }
    const t = setTimeout(async () => {
      if (!this.running) return;
      try {
        await runJob(job, this.projectRoot);
        job.lastRunAt = new Date().toISOString();
      } catch (err) {
        process.stderr.write(
          `schedule ${job.name} failed: ${(err as Error).message}\n`,
        );
      } finally {
        const previousDue = Number.isFinite(dueAt) ? dueAt : Date.now();
        job.nextRunAt = new Date(
          Math.max(Date.now(), previousDue) + intervalMs(job),
        ).toISOString();
        this.persistJob(job);
        if (this.running) this.scheduleJob(job);
      }
    }, delay);
    this.timers.set(job.name, t);
  }

  private persistJob(job: ScheduleJob): void {
    const cfg = loadSchedule(this.projectRoot);
    const index = cfg.jobs.findIndex(
      (candidate) => candidate.name === job.name,
    );
    if (index >= 0) cfg.jobs[index] = { ...job };
    else cfg.jobs.push({ ...job });
    saveSchedule(this.projectRoot, cfg);
  }

  stop(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.running = false;
  }

  has(name: string): boolean {
    return this.timers.has(name);
  }
}

function normalizeJob(value: unknown): ScheduleJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const job = value as Partial<ScheduleJob> & { next_run_at?: unknown };
  if (!job.name?.trim() || !job.startUrl?.trim()) return null;
  if (!Number.isFinite(job.intervalMinutes) || (job.intervalMinutes ?? 0) <= 0)
    return null;
  try {
    new URL(job.startUrl);
  } catch {
    return null;
  }
  const legacyNext =
    typeof job.next_run_at === "string" ? job.next_run_at : undefined;
  const { next_run_at: _legacyNextRunAt, ...clean } = job;
  return {
    ...clean,
    name: job.name.trim(),
    startUrl: job.startUrl.trim(),
    intervalMinutes: Number(job.intervalMinutes),
    timezone: normalizeTimezone(job.timezone),
    nextRunAt: job.nextRunAt ?? legacyNext,
  };
}

function normalizeTimezone(value: string | undefined): string {
  const timezone =
    value?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "UTC";
  }
}

function intervalMs(job: ScheduleJob): number {
  return Math.round(job.intervalMinutes * 60_000);
}

function validDate(value: string | undefined): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
