// Sprint 10: change detection module + core diff tests.
//
// We test:
//   1. diffAuditRuns: pure diff function with synthetic
//      AuditRun objects. Covers new, resolved, persistent,
//      changed-scope, and regression score.
//   2. diffIssueCount: fallback for pre-Sprint-10 records.
//   3. audit-history query helpers: latestPair, latest,
//      queryHistory. Uses an in-memory projectRoot (tmpdir).
//   4. change-detection module: loader discovery, selfTest,
//      input contract, end-to-end with a tmpdir that has two
//      pre-populated AuditRun records (saved via saveAuditRun).
//   5. AuditRun schema now persists the full issues list —
//      verify by saving + loading + diffing.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadModules } from "../src/modules/loader.js";
import {
  saveAuditRun,
  newAuditRunId,
  type AuditRun,
  type AuditRunIssue,
} from "../src/core/audit-run.js";
import { latestPair, latest, queryHistory } from "../src/core/audit-history.js";
import {
  diffAuditRuns,
  diffIssueCount,
  type AuditDelta,
} from "../src/integrations/change.js";

const REPO = resolve(import.meta.dirname, "..");

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "marketingovo-change-"));
});
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// Helper: build an AuditRun with issues.
function makeRun(opts: {
  id?: string;
  startUrl?: string;
  status?: AuditRun["status"];
  issues?: AuditRunIssue[];
  requestedAt?: string;
  issueCount?: number;
}): AuditRun {
  const id = opts.id ?? newAuditRunId();
  const issues = opts.issues ?? [];
  return {
    id,
    startUrl: opts.startUrl ?? "https://example.com/",
    modules: ["onpage", "technical"],
    requestedAt: opts.requestedAt ?? new Date().toISOString(),
    status: opts.status ?? "succeeded",
    passes: 1,
    issueCount: opts.issueCount ?? issues.length,
    issues,
    signal: {
      onpage: { weak: [], strong: [] },
      technical: { weak: [], strong: [] },
    },
  };
}

function mkIssue(opts: {
  id: string;
  urls: string[];
  priority?: "High" | "Medium" | "Low";
  moduleId?: string;
}): AuditRunIssue {
  return {
    id: opts.id,
    category: "test",
    priority: opts.priority ?? "Medium",
    message: `issue ${opts.id}`,
    urls: opts.urls,
    moduleId: opts.moduleId,
  };
}

describe("diffAuditRuns (Sprint 10 pure diff)", () => {
  it("classifies new issues correctly", () => {
    const prev = makeRun({
      issues: [mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" })],
    });
    const curr = makeRun({
      issues: [
        mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" }),
        mkIssue({
          id: "b",
          urls: ["/x"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.newIssues.map((i) => i.id)).toEqual(["b"]);
    expect(d.resolvedIssues).toEqual([]);
    expect(d.persistentIssues.map((i) => i.id)).toEqual(["a"]);
    expect(d.regressionScore).toBe(3); // High priority new
  });

  it("classifies resolved issues correctly", () => {
    const prev = makeRun({
      issues: [
        mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" }),
        mkIssue({
          id: "b",
          urls: ["/x"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    const curr = makeRun({
      issues: [mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" })],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.resolvedIssues.map((i) => i.id)).toEqual(["b"]);
    expect(d.newIssues).toEqual([]);
    expect(d.regressionScore).toBe(-3); // High priority resolved
  });

  it("treats same id + same url set as persistent (no penalty)", () => {
    const prev = makeRun({
      issues: [mkIssue({ id: "a", urls: ["/", "/x"], moduleId: "onpage" })],
    });
    const curr = makeRun({
      issues: [mkIssue({ id: "a", urls: ["/x", "/"], moduleId: "onpage" })],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.persistentIssues.map((i) => i.id)).toEqual(["a"]);
    expect(d.newIssues).toEqual([]);
    expect(d.resolvedIssues).toEqual([]);
    expect(d.regressionScore).toBe(0);
  });

  it("treats same id + different url set as changed-scope (penalty grows, reward shrinks)", () => {
    const prev = makeRun({
      issues: [
        mkIssue({
          id: "a",
          urls: ["/x"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    // Scope grew: 1 url → 3 urls.
    const curr = makeRun({
      issues: [
        mkIssue({
          id: "a",
          urls: ["/x", "/y", "/z"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.changedScopeIssues).toHaveLength(1);
    expect(d.regressionScore).toBe(3); // grew, +High
    // Scope shrank: 3 urls → 1 url.
    const prev2 = makeRun({
      issues: [
        mkIssue({
          id: "a",
          urls: ["/x", "/y", "/z"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    const curr2 = makeRun({
      issues: [
        mkIssue({
          id: "a",
          urls: ["/x"],
          priority: "High",
          moduleId: "onpage",
        }),
      ],
    });
    const d2 = diffAuditRuns(prev2, curr2);
    expect(d2.regressionScore).toBe(-3); // shrank, -High
  });

  it("returns empty delta when runs are identical", () => {
    const r = makeRun({
      issues: [mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" })],
    });
    const d = diffAuditRuns(r, r);
    expect(d.newIssues).toEqual([]);
    expect(d.resolvedIssues).toEqual([]);
    expect(d.persistentIssues).toHaveLength(1);
    expect(d.changedScopeIssues).toEqual([]);
    expect(d.regressionScore).toBe(0);
  });

  it("summary starts with 'First run' when previous is null", () => {
    const r = makeRun({ issues: [mkIssue({ id: "a", urls: ["/"] })] });
    const d = diffAuditRuns(null, r);
    expect(d.summary).toMatch(/First run/);
  });

  it("byModule counts new / resolved / persistent per moduleId", () => {
    const prev = makeRun({
      issues: [
        mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" }),
        mkIssue({ id: "b", urls: ["/"], moduleId: "technical" }),
        mkIssue({ id: "c", urls: ["/"], moduleId: "onpage" }),
      ],
    });
    const curr = makeRun({
      issues: [
        mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" }),
        mkIssue({ id: "d", urls: ["/"], moduleId: "onpage" }),
      ],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.byModule.onpage).toEqual({ new: 1, resolved: 1, persistent: 1 });
    expect(d.byModule.technical).toEqual({
      new: 0,
      resolved: 1,
      persistent: 0,
    });
  });

  it("weights by priority: High=3, Medium=2, Low=1", () => {
    const prev = makeRun({ issues: [] });
    const curr = makeRun({
      issues: [
        mkIssue({ id: "a", urls: ["/"], priority: "High" }),
        mkIssue({ id: "b", urls: ["/"], priority: "Medium" }),
        mkIssue({ id: "c", urls: ["/"], priority: "Low" }),
      ],
    });
    const d = diffAuditRuns(prev, curr);
    expect(d.regressionScore).toBe(3 + 2 + 1);
  });
});

describe("diffIssueCount (pre-Sprint-10 fallback)", () => {
  it("computes a numeric delta and a degraded summary", () => {
    const prev = makeRun({ issueCount: 10 });
    const curr = makeRun({ issueCount: 13 });
    const d = diffIssueCount(prev, curr);
    expect(d.delta).toBe(3);
    expect(d.summary).toMatch(/regression/);
    expect(d.summary).toMatch(/Pre-Sprint-10/);
  });

  it("returns issueCount for first run", () => {
    const curr = makeRun({ issueCount: 5 });
    const d = diffIssueCount(null, curr);
    expect(d.delta).toBe(5);
    expect(d.summary).toMatch(/First run/);
  });
});

describe("audit-history query helpers", () => {
  beforeEach(() => {
    // Each test gets a clean tmp dir.
    rmSync(tmpRoot, { recursive: true, force: true });
    require("node:fs").mkdirSync(tmpRoot, { recursive: true });
  });

  it("latestPair returns previous+current for the same URL", () => {
    const url = "https://example.com/";
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r1", startUrl: url, requestedAt: "2026-06-01T00:00:00Z" }),
    );
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r2", startUrl: url, requestedAt: "2026-06-05T00:00:00Z" }),
    );
    const { previous, current } = latestPair(tmpRoot, url);
    expect(current?.id).toBe("r2");
    expect(previous?.id).toBe("r1");
  });

  it("latestPair returns null previous when only one run exists", () => {
    const url = "https://example.com/";
    saveAuditRun(tmpRoot, makeRun({ id: "r1", startUrl: url }));
    const { previous, current } = latestPair(tmpRoot, url);
    expect(previous).toBeNull();
    expect(current?.id).toBe("r1");
  });

  it("latest returns the most recent run", () => {
    const url = "https://example.com/";
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r1", startUrl: url, requestedAt: "2026-06-01T00:00:00Z" }),
    );
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r2", startUrl: url, requestedAt: "2026-06-05T00:00:00Z" }),
    );
    const r = latest(tmpRoot, url);
    expect(r?.id).toBe("r2");
  });

  it("queryHistory respects limit and since", () => {
    const url = "https://example.com/";
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r1", startUrl: url, requestedAt: "2026-05-01T00:00:00Z" }),
    );
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r2", startUrl: url, requestedAt: "2026-06-01T00:00:00Z" }),
    );
    saveAuditRun(
      tmpRoot,
      makeRun({ id: "r3", startUrl: url, requestedAt: "2026-06-05T00:00:00Z" }),
    );
    const all = queryHistory(tmpRoot, { startUrl: url });
    expect(all.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
    const recent = queryHistory(tmpRoot, {
      startUrl: url,
      since: "2026-06-01T00:00:00Z",
    });
    expect(recent.map((r) => r.id)).toEqual(["r3", "r2"]);
    const limited = queryHistory(tmpRoot, { startUrl: url, limit: 1 });
    expect(limited.map((r) => r.id)).toEqual(["r3"]);
  });
});

describe("AuditRun persists full issues list (Sprint 10 schema)", () => {
  it("save + load round-trips the issues field", () => {
    const url = "https://example.com/";
    const issues: AuditRunIssue[] = [
      mkIssue({ id: "a", urls: ["/"], moduleId: "onpage" }),
      mkIssue({
        id: "b",
        urls: ["/x"],
        priority: "High",
        moduleId: "technical",
      }),
    ];
    const run = makeRun({ id: "r1", startUrl: url, issues });
    saveAuditRun(tmpRoot, run);
    // Read raw from disk to confirm the field is in the JSON.
    const path = join(tmpRoot, "audits.json");
    const text = require("node:fs").readFileSync(path, "utf8");
    expect(text).toContain('"issues"');
    expect(text).toContain('"id": "a"');
    expect(text).toContain('"priority": "High"');
    // And queryHistory should return it.
    const loaded = latest(tmpRoot, url);
    expect(loaded?.issues).toHaveLength(2);
  });
});

describe("integrations:change-detection module contract (Sprint 10)", () => {
  it("loader discovers integrations:change-detection with the right shape", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    expect(r.errors).toEqual([]);
    const m = r.modules.find((m) => m.id === "integrations:change-detection");
    expect(m).toBeDefined();
    expect(m!.version).toBe("0.9.0");
    expect(m!.category).toBe("research");
    expect(m!.dependsOn).toEqual([]);
    expect(m!.inputSchema.required).toContain("url");
  });

  it("selfTest returns ok with no issues (pure in-memory module)", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:change-detection")!;
    const t = await m.selfTest();
    expect(t.ok).toBe(true);
  });

  it("invoke rejects with 'url' in the error message", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:change-detection")!;
    await expect(m.invoke({}, {} as never)).rejects.toThrow(/url/);
  });
});

describe("integrations:change-detection end-to-end (Sprint 10)", () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    require("node:fs").mkdirSync(tmpRoot, { recursive: true });
  });

  it("compares the two most recent runs and reports a regression", async () => {
    const url = "https://example.com/";
    // First run: clean.
    saveAuditRun(
      tmpRoot,
      makeRun({
        id: "r1",
        startUrl: url,
        requestedAt: "2026-06-01T00:00:00Z",
        issues: [],
      }),
    );
    // Second run: 2 new High issues.
    saveAuditRun(
      tmpRoot,
      makeRun({
        id: "r2",
        startUrl: url,
        requestedAt: "2026-06-05T00:00:00Z",
        issues: [
          mkIssue({
            id: "x",
            urls: ["/"],
            priority: "High",
            moduleId: "onpage",
          }),
          mkIssue({
            id: "y",
            urls: ["/x"],
            priority: "High",
            moduleId: "onpage",
          }),
        ],
      }),
    );
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:change-detection")!;
    const out = (await m.invoke({ url }, {
      projectRoot: tmpRoot,
    } as never)) as unknown as {
      delta: AuditDelta;
      trend: unknown[];
      issues: Array<{ severity: string; message: string }>;
    };
    expect(out.delta.regressionScore).toBe(6); // 2 × High
    expect(out.delta.newIssues.map((i) => i.id)).toEqual(["x", "y"]);
    expect(out.issues.some((i) => i.severity === "warning")).toBe(true); // 5 < 6 ≤ 15
  });

  it("returns the trend when includeHistory=true", async () => {
    const url = "https://example.com/";
    saveAuditRun(
      tmpRoot,
      makeRun({
        id: "r1",
        startUrl: url,
        requestedAt: "2026-06-01T00:00:00Z",
        issueCount: 10,
      }),
    );
    saveAuditRun(
      tmpRoot,
      makeRun({
        id: "r2",
        startUrl: url,
        requestedAt: "2026-06-05T00:00:00Z",
        issueCount: 13,
      }),
    );
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:change-detection")!;
    const out = (await m.invoke({ url, includeHistory: true }, {
      projectRoot: tmpRoot,
    } as never)) as unknown as {
      trend: Array<{ runId: string; issueCount: number }>;
    };
    expect(out.trend).toHaveLength(2);
    expect(out.trend[0]).toEqual({
      runId: "r2",
      requestedAt: "2026-06-05T00:00:00Z",
      issueCount: 13,
    });
  });

  it("throws when no runs exist for the URL", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:change-detection")!;
    await expect(
      m.invoke({ url: "https://nothing.test/" }, {
        projectRoot: tmpRoot,
      } as never),
    ).rejects.toThrow(/no completed audit runs/);
  });
});
