import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MarketingovoDatabase } from "@marketingovo/storage-sqlite";
import { nextCronOccurrence } from "./cron.js";
import { DurableJobWorker, DurableScheduler } from "./durable-work.js";

describe("durable local work", () => {
  it("calculates timezone-aware cron cursors and legacy intervals", () => {
    expect(
      nextCronOccurrence(
        "0 9 * * 1-5",
        "America/New_York",
        new Date("2026-01-02T14:00:00.000Z"),
      ).toISOString(),
    ).toBe("2026-01-05T14:00:00.000Z");
    expect(
      nextCronOccurrence(
        "@every 15m",
        "UTC",
        new Date("2026-01-01T00:00:00.000Z"),
      ).toISOString(),
    ).toBe("2026-01-01T00:15:00.000Z");
    expect(() => nextCronOccurrence("61 * * * *", "UTC", new Date())).toThrow(
      /Invalid cron/u,
    );
  });

  it("executes a leased job once", async () => {
    const root = mkdtempSync(join(tmpdir(), "marketingovo-worker-"));
    const database = new MarketingovoDatabase({
      path: join(root, "marketingovo.db"),
    });
    const handler = vi.fn(async () => undefined);
    database.enqueueJob({ type: "test", payload: { ok: true } });
    const worker = new DurableJobWorker({
      database,
      handlers: new Map([["test", handler]]),
    });
    expect(await worker.runOnce()).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(database.listJobs("succeeded")).toHaveLength(1);
    database.close();
  });

  it("starts a due schedule with an idempotency cursor and advances it", async () => {
    const root = mkdtempSync(join(tmpdir(), "marketingovo-runtime-schedule-"));
    const database = new MarketingovoDatabase({
      path: join(root, "marketingovo.db"),
    });
    const project = database.createProject({
      name: "Example",
      canonicalUrl: "https://example.com",
    });
    database.createSchedule({
      projectId: project.id,
      cron: "0 6 * * *",
      timezone: "UTC",
      enabled: true,
      nextRunAt: "2026-01-01T06:00:00.000Z",
    });
    const startRun = vi.fn(async () => undefined);
    const scheduler = new DurableScheduler({
      database,
      startRun,
      workerId: "scheduler-test",
      now: () => new Date("2026-01-01T06:00:00.000Z"),
    });
    expect(await scheduler.runOnce()).toBe(1);
    expect(startRun).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: project.id }),
      expect.stringMatching(/^schedule:/u),
    );
    expect(database.listSchedules()[0]?.nextRunAt).toBe(
      "2026-01-02T06:00:00.000Z",
    );
    expect(await scheduler.runOnce()).toBe(0);
    database.close();
  });

  it("starts the workflow the schedule names, with its options", async () => {
    const root = mkdtempSync(join(tmpdir(), "marketingovo-report-schedule-"));
    const database = new MarketingovoDatabase({
      path: join(root, "marketingovo.db"),
    });
    const project = database.createProject({
      name: "Example",
      canonicalUrl: "https://example.com",
    });
    const schedule = database.createSchedule({
      projectId: project.id,
      cron: "0 8 1 * *",
      timezone: "UTC",
      enabled: true,
      nextRunAt: "2026-02-01T08:00:00.000Z",
      workflowId: "marketing-report",
      options: { title: "Monthly report", compare: true },
    });
    const startRun = vi.fn(async () => undefined);
    const scheduler = new DurableScheduler({
      database,
      startRun,
      workerId: "scheduler-test",
      now: () => new Date("2026-02-01T08:00:00.000Z"),
    });
    expect(await scheduler.runOnce()).toBe(1);
    expect(startRun).toHaveBeenCalledWith(
      {
        projectId: project.id,
        workflowId: "marketing-report",
        options: {
          title: "Monthly report",
          compare: true,
          // The scheduler stamps the provenance id last so a schedule cannot
          // claim to be a different one through its own options.
          scheduleId: schedule.id,
        },
      },
      `schedule:${schedule.id}:2026-02-01T08:00:00.000Z`,
    );
    database.close();
  });
});
