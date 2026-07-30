import { randomUUID } from "node:crypto";
import type { StartRunInput } from "@marketingovo/contracts";
import type {
  ClaimedSchedule,
  DurableJob,
  AgentSeoDatabase,
} from "@marketingovo/storage-sqlite";
import { nextCronOccurrence } from "./cron.js";

export type DurableJobHandler = (
  payload: Record<string, unknown>,
  job: DurableJob,
) => Promise<void>;

export interface DurableJobWorkerOptions {
  database: AgentSeoDatabase;
  handlers: ReadonlyMap<string, DurableJobHandler>;
  workerId?: string;
  concurrency?: number;
  leaseMs?: number;
  pollMs?: number;
}

export class DurableJobWorker {
  private readonly workerId: string;
  private readonly concurrency: number;
  private readonly leaseMs: number;
  private readonly pollMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: DurableJobWorkerOptions) {
    this.workerId = options.workerId ?? `worker-${process.pid}-${randomUUID()}`;
    this.concurrency = Math.max(1, Math.min(16, options.concurrency ?? 2));
    this.leaseMs = Math.max(5_000, options.leaseMs ?? 30_000);
    this.pollMs = Math.max(100, options.pollMs ?? 1_000);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  async runOnce(): Promise<number> {
    const jobs = this.options.database.claimJobs(
      this.workerId,
      this.concurrency,
      this.leaseMs,
    );
    await Promise.all(jobs.map((job) => this.execute(job)));
    return jobs.length;
  }

  private async execute(job: DurableJob): Promise<void> {
    const handler = this.options.handlers.get(job.type);
    let heartbeat: NodeJS.Timeout | null = null;
    try {
      if (!handler)
        throw new Error(
          `No handler registered for durable job type '${job.type}'`,
        );
      heartbeat = setInterval(
        () => {
          this.options.database.heartbeatJob(
            job.id,
            this.workerId,
            this.leaseMs,
          );
        },
        Math.max(1_000, Math.floor(this.leaseMs / 3)),
      );
      heartbeat.unref();
      await handler(job.payload, job);
      this.options.database.completeJob(job.id, this.workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.database.failJob(job.id, this.workerId, message);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  private async loop(): Promise<void> {
    if (!this.running) return;
    await this.runOnce();
    if (!this.running) return;
    this.timer = setTimeout(() => void this.loop(), this.pollMs);
    this.timer.unref();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export interface DurableSchedulerOptions {
  database: AgentSeoDatabase;
  startRun(input: StartRunInput, idempotencyKey: string): Promise<unknown>;
  workerId?: string;
  pollMs?: number;
  now?: () => Date;
}

export class DurableScheduler {
  private readonly workerId: string;
  private readonly pollMs: number;
  private readonly now: () => Date;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: DurableSchedulerOptions) {
    this.workerId =
      options.workerId ?? `scheduler-${process.pid}-${randomUUID()}`;
    this.pollMs = Math.max(250, options.pollMs ?? 30_000);
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  async runOnce(): Promise<number> {
    const current = this.now();
    const schedules = this.options.database.claimDueSchedules(
      this.workerId,
      20,
      Math.max(60_000, this.pollMs * 3),
      current,
    );
    for (const schedule of schedules) await this.execute(schedule, current);
    return schedules.length;
  }

  private async execute(
    schedule: ClaimedSchedule,
    current: Date,
  ): Promise<void> {
    try {
      await this.options.startRun(
        {
          projectId: schedule.projectId,
          workflowId: "audit",
          options: { scheduleId: schedule.id },
        },
        `schedule:${schedule.id}:${schedule.nextRunAt}`,
      );
      const next = nextCronOccurrence(
        schedule.cron,
        schedule.timezone,
        new Date(schedule.nextRunAt),
      );
      if (
        !this.options.database.advanceSchedule(
          schedule.id,
          this.workerId,
          next.toISOString(),
          current.toISOString(),
        )
      ) {
        throw new Error(
          `Schedule '${schedule.id}' lost its lease before advancing`,
        );
      }
    } catch {
      this.options.database.releaseSchedule(schedule.id, this.workerId);
    }
  }

  private nextDelay(): number {
    const enabled = this.options.database
      .listSchedules()
      .filter((schedule) => schedule.enabled);
    if (enabled.length === 0) return this.pollMs;
    const due = Math.min(
      ...enabled
        .map((schedule) => Date.parse(schedule.nextRunAt))
        .filter(Number.isFinite),
    );
    return Number.isFinite(due)
      ? Math.max(250, Math.min(this.pollMs, due - this.now().getTime()))
      : this.pollMs;
  }

  private async loop(): Promise<void> {
    if (!this.running) return;
    await this.runOnce();
    if (!this.running) return;
    this.timer = setTimeout(() => void this.loop(), this.nextDelay());
    this.timer.unref();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
