import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AgentSeoDatabase } from "@agentseoapp/storage-sqlite";
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
    const root = mkdtempSync(join(tmpdir(), "agentseo-worker-"));
    const database = new AgentSeoDatabase({ path: join(root, "agentseo.db") });
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
    const root = mkdtempSync(join(tmpdir(), "agentseo-runtime-schedule-"));
    const database = new AgentSeoDatabase({ path: join(root, "agentseo.db") });
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
});
