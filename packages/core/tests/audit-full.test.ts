// Tests for the audit-full module + composer (Sprint 3 / T-040).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { loadModules, findWorkflow } from "../src/modules/loader.js";
import {
  newAuditRunId,
  saveAuditRun,
  loadAuditRun,
  listAuditRuns,
  type AuditRun,
} from "../src/core/audit-run.js";
import {
  isStrong,
  evaluatePass,
  type PassSignal,
} from "../src/core/signal-eval.js";
import { ConsoleLogger } from "../src/core/logger.js";
import { runComposer } from "../src/core/composer.js";
import type {
  Module,
  ModuleId,
  ModuleInput,
  ModuleOutput,
} from "../src/modules/types.js";
import type { Limits } from "../src/core/limits.js";

const REPO = resolve(import.meta.dirname, "..");
const MODULES_ROOT = resolve(REPO, "src/modules");

const BASE_LIMITS: Limits = {
  maxUrls: 5,
  maxRuntimeMs: 5000,
  maxConcurrency: 1,
  requestsPerSecond: 10,
  requestTimeoutMs: 2000,
  maxBodyBytes: 1024 * 1024,
  maxRedirects: 1,
  userAgent: "marketingovo-test",
  allowPrivate: true,
  ignoreRobots: true,
  renderMode: "static",
  customHeaders: {},
};

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "marketingovo-audit-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("loader discovers audit-full workflow (T-036)", () => {
  it("finds audit-full only in the workflow registry", async () => {
    const result = await loadModules(MODULES_ROOT);
    expect(
      result.errors,
      `errors: ${JSON.stringify(result.errors, null, 2)}`,
    ).toEqual([]);
    const workflow = findWorkflow(result.workflows, "audit-full");
    expect(workflow).toBeDefined();
    expect(workflow!.category).toBe("process");
    expect(workflow!.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.modules.map((module) => module.id)).not.toContain(
      "audit-full",
    );
  });

  it("audit-full input/output schemas are non-empty and typed", async () => {
    const result = await loadModules(MODULES_ROOT);
    const workflow = findWorkflow(result.workflows, "audit-full")!;
    expect(workflow.inputSchema.type).toBe("object");
    expect(workflow.inputSchema.properties?.["url"]).toBeDefined();
    expect(workflow.outputSchema.type).toBe("object");
    expect(workflow.outputSchema.properties?.["auditRunId"]).toBeDefined();
    expect(workflow.outputSchema.properties?.["status"]).toBeDefined();
  });
});

describe("AuditRun persistence (T-034)", () => {
  it("round-trips a run through save/load/list", () => {
    const id = newAuditRunId();
    const run: AuditRun = {
      id,
      startUrl: "https://example.com/",
      modules: ["onpage", "technical"],
      requestedAt: new Date().toISOString(),
      status: "succeeded",
      passes: 1,
      issueCount: 5,
      signal: { onpage: { weak: [], strong: ["5 issues"] } },
      durationMs: 1234,
    };
    saveAuditRun(tmp, run);
    const loaded = loadAuditRun(tmp, id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(id);
    expect(loaded!.startUrl).toBe(run.startUrl);
    expect(loaded!.issueCount).toBe(5);

    const listed = listAuditRuns(tmp);
    expect(listed.length).toBe(1);
    expect(listed[0]!.id).toBe(id);
  });

  it("audits.json is human-readable JSON in the project root", () => {
    const id = newAuditRunId();
    saveAuditRun(tmp, {
      id,
      startUrl: "https://example.org/",
      modules: ["performance"],
      requestedAt: "2026-06-05T00:00:00.000Z",
      status: "succeeded",
      passes: 1,
      issueCount: 0,
      signal: {},
    });
    const file = join(tmp, "audits.json");
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text).toContain(id);
    expect(text).toContain("https://example.org/");
  });

  it("listAuditRuns sorts by requestedAt descending", () => {
    const older = newAuditRunId();
    const newer = newAuditRunId();
    saveAuditRun(tmp, {
      id: older,
      startUrl: "https://a/",
      modules: ["onpage"],
      requestedAt: "2026-06-01T00:00:00.000Z",
      status: "succeeded",
      passes: 1,
      issueCount: 0,
      signal: {},
    });
    saveAuditRun(tmp, {
      id: newer,
      startUrl: "https://b/",
      modules: ["onpage"],
      requestedAt: "2026-06-05T00:00:00.000Z",
      status: "succeeded",
      passes: 1,
      issueCount: 0,
      signal: {},
    });
    const listed = listAuditRuns(tmp);
    expect(listed[0]!.id).toBe(newer);
    expect(listed[1]!.id).toBe(older);
  });

  it("listAuditRuns filters by status and startUrlPrefix", () => {
    const r1 = newAuditRunId();
    const r2 = newAuditRunId();
    saveAuditRun(tmp, {
      id: r1,
      startUrl: "https://a.com/",
      modules: ["onpage"],
      requestedAt: "2026-06-01T00:00:00.000Z",
      status: "running",
      passes: 0,
      issueCount: 0,
      signal: {},
    });
    saveAuditRun(tmp, {
      id: r2,
      startUrl: "https://b.com/",
      modules: ["onpage"],
      requestedAt: "2026-06-02T00:00:00.000Z",
      status: "succeeded",
      passes: 1,
      issueCount: 0,
      signal: {},
    });
    expect(listAuditRuns(tmp, { status: "running" }).map((r) => r.id)).toEqual([
      r1,
    ]);
    expect(
      listAuditRuns(tmp, { startUrlPrefix: "https://a.com/" }).map((r) => r.id),
    ).toEqual([r1]);
  });

  it("survives a corrupt audits.json (backed up, not clobbered)", () => {
    const file = join(tmp, "audits.json");
    // Write a corrupt file (not valid JSON)
    require("node:fs").writeFileSync(file, "{not json");
    // First read should not throw; it should back up the corrupt file.
    const id = newAuditRunId();
    saveAuditRun(tmp, {
      id,
      startUrl: "https://c.com/",
      modules: ["onpage"],
      requestedAt: "2026-06-03T00:00:00.000Z",
      status: "succeeded",
      passes: 1,
      issueCount: 0,
      signal: {},
    });
    // The new run should be readable.
    expect(loadAuditRun(tmp, id)).not.toBeNull();
    // And the corrupt file should still exist (backed up).
    const dir = require("node:fs").readdirSync(tmp);
    expect(dir.some((f: string) => f.startsWith("audits.json.corrupt."))).toBe(
      true,
    );
  });

  it("migrates legacy completed/aborted statuses on read", () => {
    require("node:fs").writeFileSync(
      join(tmp, "audits.json"),
      JSON.stringify({
        schemaVersion: 1,
        runs: {
          old: {
            id: "old",
            startUrl: "https://legacy.example/",
            modules: [],
            requestedAt: "2026-01-01T00:00:00.000Z",
            status: "completed",
            passes: 1,
            issueCount: 0,
            signal: {},
          },
        },
      }),
    );
    expect(loadAuditRun(tmp, "old")?.status).toBe("succeeded");
    expect(
      listAuditRuns(tmp, { status: "succeeded" }).map((run) => run.id),
    ).toEqual(["old"]);
  });
});

describe("signal-eval (T-035)", () => {
  it("isStrong requires markStrong and no markWeak", () => {
    expect(isStrong({ weak: [], strong: ["x"] })).toBe(true);
    expect(isStrong({ weak: ["y"], strong: ["x"] })).toBe(false);
    expect(isStrong({ weak: [], strong: [] })).toBe(false);
    expect(isStrong(undefined)).toBe(false);
  });

  it("evaluatePass returns stop=true when all signaled strong", () => {
    const signal = new Map<ModuleId, PassSignal>([
      ["onpage" as ModuleId, { weak: [], strong: ["5 issues"] }],
    ]);
    const v = evaluatePass(signal, ["onpage" as ModuleId]);
    expect(v.stop).toBe(true);
    expect(v.rerun).toEqual([]);
  });

  it("evaluatePass flags weak modules for rerun", () => {
    const signal = new Map<ModuleId, PassSignal>([
      ["onpage" as ModuleId, { weak: ["data-thin"], strong: [] }],
      ["technical" as ModuleId, { weak: [], strong: ["x"] }],
    ]);
    const v = evaluatePass(signal, [
      "onpage" as ModuleId,
      "technical" as ModuleId,
    ]);
    expect(v.stop).toBe(false);
    expect(v.rerun).toEqual(["onpage"]);
  });

  it("evaluatePass flags silent modules (no markStrong, no markWeak) for rerun", () => {
    const signal = new Map<ModuleId, PassSignal>([
      ["onpage" as ModuleId, { weak: [], strong: [] }],
    ]);
    const v = evaluatePass(signal, ["onpage" as ModuleId]);
    expect(v.stop).toBe(false);
    expect(v.rerun).toEqual(["onpage"]);
    expect(v.reason).toMatch(/silent/);
  });
});

// --- Composer tests (T-033) with synthetic modules ---
// We use hand-rolled fake modules (not the real ones) to keep the
// test deterministic and to exercise the topo / parallel /
// signal-eval logic in isolation. Real-module integration is
// covered by full-pipeline.test.ts.

interface FakeOpts {
  id: ModuleId;
  dependsOn?: ModuleId[];
  strong?: string;
  weak?: string;
  failWith?: string;
  issues?: IssueLike[];
  delayMs?: number;
  onInvoke?: () => void | Promise<void>;
}

interface IssueLike {
  id: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  message: string;
  urls: string[];
}

function fakeModule(opts: FakeOpts): Module {
  return {
    id: opts.id,
    version: "0.0.1",
    displayName: opts.id,
    category: "tool",
    description: "fake",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    dependsOn: opts.dependsOn ?? [],
    configKeys: [],
    async invoke(_input: ModuleInput, ctx) {
      await opts.onInvoke?.();
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.failWith) throw new Error(opts.failWith);
      if (opts.strong) ctx.signal.markStrong(opts.strong);
      if (opts.weak) ctx.signal.markWeak(opts.weak);
      return { issues: opts.issues ?? [] } as unknown as ModuleOutput;
    },
    async selfTest() {
      return { ok: true, issues: [], checkedAt: new Date().toISOString() };
    },
  };
}

describe("composer (T-033)", () => {
  it("runs two independent modules in parallel", async () => {
    let started = 0;
    let releaseAllStarted: (() => void) | undefined;
    const allStarted = new Promise<void>((resolve) => {
      releaseAllStarted = resolve;
    });
    const enterBarrier = async (): Promise<void> => {
      started += 1;
      if (started === 2) releaseAllStarted?.();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("independent modules did not overlap")),
          1_000,
        );
        void allStarted.then(
          () => {
            clearTimeout(timeout);
            resolve();
          },
          (error: unknown) => {
            clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        );
      });
    };
    const registry = [
      fakeModule({
        id: "a" as ModuleId,
        strong: "a done",
        onInvoke: enterBarrier,
      }),
      fakeModule({
        id: "b" as ModuleId,
        strong: "b done",
        onInvoke: enterBarrier,
      }),
    ];
    const result = await runComposer({
      startUrl: "https://x/",
      registry,
      modulesToRun: ["a" as ModuleId, "b" as ModuleId],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
    });
    expect(started).toBe(2);
    expect(result.passes).toBe(1);
    expect(result.moduleResults.size).toBe(2);
  });

  it("topo-orders a dependent module after its dependency", async () => {
    const order: ModuleId[] = [];
    const tracker = (id: string): Module => ({
      id: id as ModuleId,
      version: "0.0.1",
      displayName: id,
      category: "tool",
      description: "tracker",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      dependsOn: [],
      configKeys: [],
      async invoke(_input, ctx) {
        order.push(id as ModuleId);
        ctx.signal.markStrong(`${id} done`);
        return { issues: [] };
      },
      async selfTest() {
        return { ok: true, issues: [], checkedAt: new Date().toISOString() };
      },
    });
    const a = tracker("a");
    const b = tracker("b");
    b.dependsOn = ["a" as ModuleId];
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [a, b],
      modulesToRun: ["b" as ModuleId],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
    });
    expect(result.moduleResults.has("a" as ModuleId)).toBe(true);
    expect(result.moduleResults.has("b" as ModuleId)).toBe(true);
    expect(order).toEqual(["a", "b"]);
  });

  it("aggregates issues from multiple modules into the result", async () => {
    const registry = [
      fakeModule({
        id: "a" as ModuleId,
        strong: "a ok",
        issues: [
          {
            id: "x-missing",
            category: "X",
            priority: "High",
            message: "x",
            urls: ["https://x/"],
          },
        ],
      }),
      fakeModule({
        id: "b" as ModuleId,
        strong: "b ok",
        issues: [
          {
            id: "y-missing",
            category: "Y",
            priority: "Medium",
            message: "y",
            urls: ["https://x/"],
          },
        ],
      }),
    ];
    const result = await runComposer({
      startUrl: "https://x/",
      registry,
      modulesToRun: ["a" as ModuleId, "b" as ModuleId],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
    });
    const ids = result.issues.map((i) => i.id);
    expect(ids).toContain("x-missing");
    expect(ids).toContain("y-missing");
  });

  it("captures per-module errors without aborting the run", async () => {
    const registry = [
      fakeModule({ id: "ok" as ModuleId, strong: "ok done" }),
      fakeModule({ id: "broken" as ModuleId, failWith: "synthetic error" }),
    ];
    const result = await runComposer({
      startUrl: "https://x/",
      registry,
      modulesToRun: ["ok" as ModuleId, "broken" as ModuleId],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
    });
    expect(result.moduleResults.has("ok" as ModuleId)).toBe(true);
    expect(result.moduleResults.has("broken" as ModuleId)).toBe(false);
    expect(result.errored.get("broken" as ModuleId)).toBe("synthetic error");
  });

  it("runs follow-up pass for weak modules and stops when strong", async () => {
    let aRunCount = 0;
    let bRunCount = 0;
    const a: Module = {
      id: "a" as ModuleId,
      version: "0.0.1",
      displayName: "a",
      category: "tool",
      description: "a",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      dependsOn: [],
      configKeys: [],
      async invoke(_input, ctx) {
        aRunCount++;
        // weak on first run, strong on second
        if (aRunCount === 1) ctx.signal.markWeak("data-thin");
        else ctx.signal.markStrong(`a run #${aRunCount}`);
        return { issues: [] };
      },
      async selfTest() {
        return { ok: true, issues: [], checkedAt: new Date().toISOString() };
      },
    };
    const b: Module = {
      id: "b" as ModuleId,
      version: "0.0.1",
      displayName: "b",
      category: "tool",
      description: "b",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      dependsOn: [],
      configKeys: [],
      async invoke(_input, ctx) {
        bRunCount++;
        ctx.signal.markStrong(`b run #${bRunCount}`);
        return { issues: [] };
      },
      async selfTest() {
        return { ok: true, issues: [], checkedAt: new Date().toISOString() };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [a, b],
      modulesToRun: ["a" as ModuleId, "b" as ModuleId],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
      maxPasses: 3,
    });
    // Pass 1: a weak, b strong.
    // Pass 2: a re-runs, becomes strong. b skipped.
    // evaluatePass returns stop=true after pass 2, so passes=2.
    expect(aRunCount).toBe(2);
    expect(bRunCount).toBe(1);
    expect(result.passes).toBe(2);
  });

  it("returns empty result for an empty module list", async () => {
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [],
      modulesToRun: [],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      logger: new ConsoleLogger(),
    });
    expect(result.passes).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it("never schedules a workflow through the leaf registry", async () => {
    let invoked = false;
    const workflow = {
      ...fakeModule({ id: "nested-workflow" as ModuleId }),
      kind: "workflow",
      async invoke() {
        invoked = true;
        return {};
      },
    } as unknown as Module;
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [workflow],
      modulesToRun: [workflow.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });
    expect(invoked).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.skipped.get(workflow.id)).toMatch(/workflow/);
  });

  it("fails a dependency cycle instead of silently returning a partial plan", async () => {
    const a = fakeModule({
      id: "cycle-a" as ModuleId,
      dependsOn: ["cycle-b" as ModuleId],
    });
    const b = fakeModule({
      id: "cycle-b" as ModuleId,
      dependsOn: ["cycle-a" as ModuleId],
    });
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [a, b],
      modulesToRun: [a.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });
    expect(result.status).toBe("failed");
    expect(result.errored.get(a.id)).toMatch(/cycle/);
    expect(result.errored.get(b.id)).toMatch(/cycle/);
  });

  it("marks missing prerequisites as skipped, not failed", async () => {
    const dependent = fakeModule({
      id: "dependent" as ModuleId,
      dependsOn: ["not-installed" as ModuleId],
    });
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [dependent],
      modulesToRun: [dependent.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });
    expect(result.errored.has(dependent.id)).toBe(false);
    expect(result.moduleStates.get(dependent.id)?.status).toBe("skipped");
    expect(result.skipped.get(dependent.id)).toMatch(/missing prerequisite/);
    expect(result.status).toBe("partial");
  });

  it("treats declared missing configuration as skipped", async () => {
    const module: Module = {
      ...fakeModule({ id: "needs-key" as ModuleId }),
      requirements: [
        { kind: "environment", keys: ["MARKETINGOVO_TEST_REQUIRED_KEY"] },
      ],
    };
    delete process.env.MARKETINGOVO_TEST_REQUIRED_KEY;
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [module],
      modulesToRun: [module.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });
    expect(result.moduleStates.get(module.id)?.status).toBe("skipped");
    expect(result.errored.has(module.id)).toBe(false);
    expect(result.status).toBe("partial");
  });

  it("enforces the bounded module pool", async () => {
    let active = 0;
    let peak = 0;
    const modules = Array.from({ length: 6 }, (_, index): Module => ({
      ...fakeModule({ id: `pool-${index}` as ModuleId }),
      async invoke(_input, ctx) {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolveP) => setTimeout(resolveP, 20));
        active -= 1;
        ctx.signal.markStrong("done");
        return { issues: [] };
      },
    }));
    const result = await runComposer({
      startUrl: "https://x/",
      registry: modules,
      modulesToRun: modules.map((module) => module.id),
      limits: BASE_LIMITS,
      projectRoot: tmp,
      maxModuleConcurrency: 2,
    });
    expect(result.status).toBe("succeeded");
    expect(peak).toBe(2);
  });

  it("validates module output and rejects malformed issue contracts", async () => {
    const malformed: Module = {
      ...fakeModule({ id: "malformed" as ModuleId }),
      outputSchema: {
        type: "object",
        required: ["issues", "issueCount"],
        properties: {
          issues: { type: "array" },
          issueCount: { type: "number" },
        },
      },
      async invoke() {
        return {
          issues: [{ severity: "warning", message: "not canonical" }],
          issueCount: 1,
        };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [malformed],
      modulesToRun: [malformed.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });
    expect(result.status).toBe("failed");
    expect(result.errored.get(malformed.id)).toMatch(/\.id is required/);
  });

  it("replaces prior-pass issues and gives follow-ups changed parameters", async () => {
    let calls = 0;
    const followUpFlags: boolean[] = [];
    const followUpInputs: unknown[] = [];
    const module: Module = {
      ...fakeModule({ id: "replace-pass" as ModuleId }),
      async invoke(input, ctx) {
        calls += 1;
        followUpFlags.push(ctx.signal.isFollowUp);
        followUpInputs.push(input.followUp);
        if (calls === 1) {
          ctx.signal.markWeak("needs a deeper pass");
          return {
            issues: [
              {
                id: "old-rule",
                category: "test",
                priority: "Low",
                message: "old",
                urls: ["https://x/#old"],
              },
            ],
          };
        }
        ctx.signal.markStrong("enough evidence");
        return {
          issues: [
            {
              id: "new-rule",
              category: "test",
              priority: "High",
              message: "new",
              urls: ["https://x/#a", "https://x/#b"],
            },
          ],
        };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [module],
      modulesToRun: [module.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      maxPasses: 3,
    });
    expect(calls).toBe(2);
    expect(followUpFlags).toEqual([false, true]);
    expect(followUpInputs[0]).toBeUndefined();
    expect(followUpInputs[1]).toMatchObject({
      pass: 2,
      strategy: "deeper",
      breadthMultiplier: 2,
    });
    expect(result.issues.map((issue) => issue.id)).toEqual(["new-rule"]);
    // Both fragment variants canonicalize to one URL/fingerprint.
    expect(result.issueInstances).toHaveLength(1);
    expect(result.status).toBe("succeeded");
  });

  it("stops an unchanged weak follow-up instead of repeating it", async () => {
    let calls = 0;
    const module: Module = {
      ...fakeModule({ id: "stalled" as ModuleId }),
      async invoke(_input, ctx) {
        calls += 1;
        ctx.signal.markWeak("same weak evidence");
        return {
          issues: [
            {
              id: "same",
              category: "test",
              priority: "Low",
              message: "same",
              urls: ["https://x/"],
            },
          ],
        };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [module],
      modulesToRun: [module.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      maxPasses: 3,
    });
    expect(calls).toBe(2);
    expect(result.passes).toBe(2);
    expect(result.inconclusive.has(module.id)).toBe(true);
    expect(result.status).toBe("partial");
  });

  it("preserves declared module coverage without inventing unavailable coverage", async () => {
    const measured: Module = {
      ...fakeModule({ id: "coverage-measured" as ModuleId }),
      async invoke(_input, ctx) {
        ctx.signal.markStrong("measured");
        return { issues: [], coverage: 0.625 };
      },
    };
    const unavailable = fakeModule({
      id: "coverage-unavailable" as ModuleId,
      strong: "done",
    });
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [measured, unavailable],
      modulesToRun: [measured.id, unavailable.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });

    expect(result.moduleStates.get(measured.id)?.coverage).toBe(0.625);
    expect(result.moduleStates.get(unavailable.id)?.coverage).toBeUndefined();
  });

  it("reports partial when the final module layer exceeds the runtime budget", async () => {
    const slow: Module = {
      ...fakeModule({ id: "slow-final-layer" as ModuleId }),
      async invoke(_input, ctx) {
        await new Promise((resolveP) => setTimeout(resolveP, 30));
        ctx.signal.markStrong("finished after deadline");
        return { issues: [] };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [slow],
      modulesToRun: [slow.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      maxRuntimeMs: 10,
    });

    expect(result.moduleStates.get(slow.id)?.status).toBe("succeeded");
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
    expect(result.status).toBe("partial");
  });

  it("rejects invalid coverage metadata as a module contract failure", async () => {
    const invalid: Module = {
      ...fakeModule({ id: "coverage-invalid" as ModuleId }),
      async invoke() {
        return { issues: [], coverage: 2 };
      },
    };
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [invalid],
      modulesToRun: [invalid.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
    });

    expect(result.status).toBe("failed");
    expect(result.errored.get(invalid.id)).toMatch(/coverage.*between 0 and 1/);
  });

  it("returns cancelled when aborted before execution", async () => {
    const controller = new AbortController();
    controller.abort();
    const module = fakeModule({ id: "cancel-me" as ModuleId });
    const result = await runComposer({
      startUrl: "https://x/",
      registry: [module],
      modulesToRun: [module.id],
      limits: BASE_LIMITS,
      projectRoot: tmp,
      abortSignal: controller.signal,
    });
    expect(result.status).toBe("cancelled");
    expect(result.moduleStates.get(module.id)?.status).toBe("cancelled");
  });
});
