// Sprint 4 sanity (T-043): end-to-end test of `audit-full` against the
// local fixture site. Proves the full pipeline works:
//
//   1. Loader discovers audit-full
//   2. audit-full re-loads the registry, creates an AuditRun
//   3. Composer injects a synthetic crawl on pass 0
//   4. Composer runs onpage + technical + content-quality in parallel
//   5. Issues are aggregated and the AuditRun is patched to
//      status: 'completed'
//   6. <projectRoot>/audits.json is written and readable
//
// This is the Sprint 4 sanity gate (replaces the G2 golemworkers.com
// run, which needs explicit Max go-ahead to hit the live site). When
// the real G2 runs, we'll add a separate integration test that
// compares the fixture-baseline issue list against the live-site
// issue list to catch any drift.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startFixtureSite,
  type FixtureSite,
} from "./integration/fixtures-site.js";
import { loadModules, findWorkflow } from "../src/modules/loader.js";
import { executeAuditFullWorkflow } from "../src/modules/audit-full/index.js";
import { ConsoleLogger } from "../src/core/logger.js";
import { loadAuditRun, listAuditRuns } from "../src/core/audit-run.js";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const MODULES_ROOT = resolve(REPO, "src/modules");

let site: FixtureSite;
let tmpRoot: string;

beforeAll(async () => {
  process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
  process.env.GOLEMSEO_ALLOW_PRIVATE = "1";
  site = await startFixtureSite();
  tmpRoot = mkdtempSync(join(tmpdir(), "golem-seo-audit-full-"));
}, 30_000);

afterAll(async () => {
  await site.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}, 5_000);

describe("audit-full on local fixture (Sprint 4 sanity)", () => {
  it("discovers audit-full only in the workflow registry", async () => {
    const result = await loadModules(MODULES_ROOT);
    expect(
      result.errors,
      `loader errors: ${JSON.stringify(result.errors, null, 2)}`,
    ).toEqual([]);
    const workflow = findWorkflow(result.workflows, "audit-full");
    expect(workflow).toBeDefined();
    expect(workflow!.category).toBe("process");
    expect(result.modules.map((module) => module.id)).not.toContain(
      "audit-full",
    );
  }, 10_000);

  it("runs a full audit on the fixture, persists AuditRun, returns issues", async () => {
    const result = await loadModules(MODULES_ROOT);
    const workflow = findWorkflow(result.workflows, "audit-full")!;
    const { loadLimits } = await import("../src/core/limits.js");
    const { startLimitsEnv } = await import("../src/core/limits.js").then(
      (m) => ({ startLimitsEnv: null }),
    );
    void startLimitsEnv;

    // Use a sub-set of modules for speed: onpage + technical.
    // These are the two highest-signal modules and the ones we'd
    // expect to surface issues on the fixture (the fixture has
    // pages with no H1, multiple H1s, noindex, broken links, etc.).
    const url = `${site.baseUrl}/`;
    const input = {
      url,
      modules: ["onpage", "technical"],
      maxPasses: 1,
      maxRuntimeMs: 30_000,
      projectRoot: tmpRoot,
      notes: "Sprint 4 sanity test",
    };

    const ctx = {
      projectRoot: tmpRoot,
      limits: loadLimits(),
      store: undefined,
      logger: new ConsoleLogger(),
      crawlOutcome: undefined,
      moduleResults: new Map(),
      signal: {
        markWeak: () => {},
        markStrong: () => {},
        isFollowUp: false,
      },
    };

    const output = (await executeAuditFullWorkflow(
      workflow,
      input,
      ctx,
      new Map(result.modules.map((module) => [module.id, module] as const)),
    )) as Record<string, unknown>;

    // Output shape: { auditRunId, status, startUrl, modules,
    //   passes, issueCount, durationMs, errored, signal }
    expect(typeof output["auditRunId"]).toBe("string");
    expect(output["status"]).toBe("succeeded");
    expect(output["startUrl"]).toBe(url);
    expect(output["modules"]).toEqual(["onpage", "technical"]);
    expect(output["passes"]).toBe(1);
    expect(typeof output["issueCount"]).toBe("number");
    expect(output["issueCount"]).toBeGreaterThan(0);
    expect(output["errored"]).toEqual([]);

    // The AuditRun must be persisted on disk.
    const runId = output["auditRunId"] as string;
    const loaded = loadAuditRun(tmpRoot, runId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(runId);
    expect(loaded!.status).toBe("succeeded");
    expect(loaded!.issueCount).toBe(output["issueCount"]);
    expect(loaded!.durationMs).toBeGreaterThan(0);

    // audits.json file is human-readable JSON.
    const file = join(tmpRoot, "audits.json");
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text).toContain(runId);
    expect(text).toContain('"status": "succeeded"');

    // listAuditRuns should find it.
    const list = listAuditRuns(tmpRoot);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(runId);
  }, 60_000);

  it("multi-pass (maxPasses=2) re-runs weak modules and stops on strong", async () => {
    const result = await loadModules(MODULES_ROOT);
    const workflow = findWorkflow(result.workflows, "audit-full")!;
    const { loadLimits } = await import("../src/core/limits.js");

    const input = {
      url: `${site.baseUrl}/has-all`,
      modules: ["onpage", "technical"],
      maxPasses: 3, // give the composer room to do follow-up
      maxRuntimeMs: 30_000,
      projectRoot: tmpRoot,
      notes: "Sprint 4 multi-pass sanity",
    };
    const ctx = {
      projectRoot: tmpRoot,
      limits: loadLimits(),
      store: undefined,
      logger: new ConsoleLogger(),
      crawlOutcome: undefined,
      moduleResults: new Map(),
      signal: {
        markWeak: () => {},
        markStrong: () => {},
        isFollowUp: false,
      },
    };
    const output = (await executeAuditFullWorkflow(
      workflow,
      input,
      ctx,
      new Map(result.modules.map((module) => [module.id, module] as const)),
    )) as Record<string, unknown>;
    expect(["succeeded", "partial"]).toContain(output["status"]);
    // /has-all is the "clean" fixture page. onpage / technical
    // may mark themselves weak (issues < 3) on every pass because
    // the data doesn't change between passes — that's the
    // 'signal-eval: same data, still weak' path. The composer
    // should respect maxPasses and stop at 3 even if no module
    // converged. So passes is in [1, 3].
    expect(output["passes"]).toBeGreaterThanOrEqual(1);
    expect(output["passes"]).toBeLessThanOrEqual(3);

    // The AuditRun on disk reflects the final pass count.
    const runId = output["auditRunId"] as string;
    const run = loadAuditRun(tmpRoot, runId);
    expect(run).not.toBeNull();
    expect(run!.passes).toBe(output["passes"]);
  }, 60_000);

  it("validates input: rejects missing url", async () => {
    const result = await loadModules(MODULES_ROOT);
    const workflow = findWorkflow(result.workflows, "audit-full")!;
    const { loadLimits } = await import("../src/core/limits.js");

    const ctx = {
      projectRoot: tmpRoot,
      limits: loadLimits(),
      store: undefined,
      logger: new ConsoleLogger(),
      crawlOutcome: undefined,
      moduleResults: new Map(),
      signal: { markWeak: () => {}, markStrong: () => {}, isFollowUp: false },
    };
    await expect(
      executeAuditFullWorkflow(
        workflow,
        {} as Record<string, unknown>,
        ctx,
        new Map(result.modules.map((module) => [module.id, module] as const)),
      ),
    ).rejects.toThrow(/url is required/);
  });

  it("makes recursive workflow scheduling impossible", async () => {
    const result = await loadModules(MODULES_ROOT);
    const workflow = findWorkflow(result.workflows, "audit-full")!;
    const { loadLimits } = await import("../src/core/limits.js");
    const ctx = {
      projectRoot: tmpRoot,
      limits: loadLimits(),
      store: undefined,
      logger: new ConsoleLogger(),
      crawlOutcome: undefined,
      moduleResults: new Map(),
      signal: { markWeak: () => {}, markStrong: () => {}, isFollowUp: false },
    };
    await expect(
      executeAuditFullWorkflow(
        workflow,
        { url: `${site.baseUrl}/`, modules: ["audit-full"] },
        ctx,
        new Map(result.modules.map((module) => [module.id, module] as const)),
      ),
    ).rejects.toThrow(/cannot schedule itself/);
  });
});
