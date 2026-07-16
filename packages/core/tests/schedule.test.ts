import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSchedule,
  saveSchedule,
  runJob,
  Scheduler,
} from "../src/core/schedule.js";
import { ProjectStore } from "../src/core/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sc-sched-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadSchedule / saveSchedule", () => {
  it("returns empty config when file is missing", () => {
    const cfg = loadSchedule(dir);
    expect(cfg.jobs).toEqual([]);
  });
  it("round-trips a job list", () => {
    saveSchedule(dir, {
      jobs: [
        {
          name: "daily",
          startUrl: "https://example.com/",
          intervalMinutes: 1440,
        },
      ],
    });
    const cfg = loadSchedule(dir);
    expect(cfg.jobs.length).toBe(1);
    expect(cfg.jobs[0]!.name).toBe("daily");
    expect(cfg.jobs[0]!.timezone).toBeTruthy();
  });
  it("drops malformed and NaN-producing schedule entries", () => {
    require("node:fs").writeFileSync(
      join(dir, "schedule.json"),
      JSON.stringify({
        jobs: [
          {
            name: "bad",
            startUrl: "https://example.com/",
            intervalMinutes: "nope",
          },
        ],
      }),
    );
    expect(loadSchedule(dir).jobs).toEqual([]);
  });
});

describe("runJob", () => {
  it("runs a single crawl end-to-end and persists a crawl row", async () => {
    const result = await runJob(
      {
        name: "test",
        startUrl: "https://example.com/",
        intervalMinutes: 1440,
        limits: { maxUrls: 1, maxRuntimeMs: 30_000 },
      },
      dir,
    );
    expect(result.pages).toBe(1);
    expect(result.issues).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    const store = new ProjectStore({ projectRoot: dir });
    const crawls = await store.listCrawls();
    expect(crawls).toHaveLength(1);
    expect(await store.countSavedPages(crawls[0]!.id)).toBe(result.pages);
    store.close();
  });
});

describe("Scheduler", () => {
  it("starts jobs from schedule.json and stops cleanly", () => {
    saveSchedule(dir, {
      jobs: [
        { name: "fast", startUrl: "https://example.com/", intervalMinutes: 60 },
        {
          name: "disabled",
          startUrl: "https://example.com/",
          intervalMinutes: 60,
          enabled: false,
        },
      ],
    });
    const sched = new Scheduler(dir);
    sched.start();
    expect(sched.has("fast")).toBe(true);
    expect(sched.has("disabled")).toBe(false);
    sched.stop();
    expect(sched.has("fast")).toBe(false);
    expect(
      loadSchedule(dir).jobs.find((job) => job.name === "fast")?.nextRunAt,
    ).toBeTruthy();
  });
});
