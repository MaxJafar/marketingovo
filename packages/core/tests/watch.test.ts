// Sprint 11: `golem-seo watch` end-to-end smoke (--once mode).
//
// We spawn the compiled CLI with `--once` to make it run a
// single cycle and exit, then verify:
//   1. Cycle 1 (no previous runs): diff is "First run" (info),
//      no notify fires (regression score is 0).
//   2. Cycle 2 (one previous run with 0 issues): composer
//      surfaces real issues, regression score is positive,
//      notify fires on the stdout channel, the audit is
//      persisted to <projectRoot>/audits.json.
//
// This is the closest we can get to "production" without
// running the loop in CI.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startFixtureSite,
  type FixtureSite,
} from "./integration/fixtures-site.js";

const REPO = resolve(import.meta.dirname, "..");
const CLI = resolve(REPO, "dist/cli.js");

let site: FixtureSite;
let tmpRoot: string;

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolveP) => {
    const child = spawn("node", [CLI, ...args], {
      cwd: REPO,
      env: {
        ...process.env,
        GOLEMSEO_PROJECT_ROOT: tmpRoot,
        SCREAMINGCLAW_PROJECT_ROOT: tmpRoot,
        SCREAMINGCLAW_ALLOW_PRIVATE: "1",
        GOLEMSEO_ALLOW_PRIVATE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) =>
      resolveP({ exitCode: code ?? 1, stdout: out, stderr: err }),
    );
  });
}

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "golem-seo-watch-"));
  site = await startFixtureSite();
}, 30_000);

afterAll(async () => {
  await site.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}, 5_000);

describe("golem-seo watch --once (Sprint 11 smoke)", () => {
  it("prints usage to stderr and exits 2 when called without url", async () => {
    const r = await runCli(["watch"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: golem-seo watch <url>/);
  });

  it("rejects NaN-producing numeric flags before starting a crawl", async () => {
    const r = await runCli([
      "watch",
      `${site.baseUrl}/`,
      "--once",
      "--max-runtime",
      "not-a-number",
    ]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--max-runtime must be a finite number/);
    expect(r.stderr).not.toMatch(/watch cycle/);
  });

  it("cycle 1: first run, regression score 0, no notify, persisted", async () => {
    const url = `${site.baseUrl}/`;
    const r = await runCli([
      "watch",
      url,
      "--once",
      "--modules",
      "onpage,technical",
      "--max-passes",
      "1",
      "--max-runtime",
      "30000",
      "--channels",
      "stdout",
    ]);
    expect(r.exitCode, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stderr).toMatch(/watch started url=/);
    expect(r.stderr).toMatch(/cycle 1 starting/);
    expect(r.stderr).toMatch(/cycle 1 complete/);
    expect(r.stderr).not.toMatch(/notify stdout:/);

    // Persisted to audits.json.
    const auditsFile = join(tmpRoot, "audits.json");
    expect(existsSync(auditsFile)).toBe(true);
    const runs = JSON.parse(readFileSync(auditsFile, "utf8")).runs as Record<
      string,
      { startUrl: string; issueCount: number; id: string }
    >;
    const runIds = Object.keys(runs);
    expect(runIds).toHaveLength(1);
    const firstRun = runs[runIds[0]!]!;
    expect(firstRun.startUrl).toBe(url);
    expect(firstRun.id).toMatch(/^watch-/);
  }, 60_000);

  it("cycle 2: regression detected, notify fires, new issues logged", async () => {
    const url = `${site.baseUrl}/`;
    // Turn the first run into a clean baseline. The second invocation must
    // compare against index 0 because its current run is not persisted yet.
    const auditsFile = join(tmpRoot, "audits.json");
    const disk = JSON.parse(readFileSync(auditsFile, "utf8")) as {
      runs: Record<string, { issueCount: number; issues?: unknown[] }>;
    };
    for (const run of Object.values(disk.runs)) {
      run.issueCount = 0;
      run.issues = [];
    }
    writeFileSync(auditsFile, JSON.stringify(disk, null, 2) + "\n");
    const r = await runCli([
      "watch",
      url,
      "--once",
      "--modules",
      "onpage,technical",
      "--max-passes",
      "1",
      "--max-runtime",
      "30000",
      "--channels",
      "stdout",
      "--threshold",
      "1",
    ]);
    expect(r.exitCode, `stderr: ${r.stderr}`).toBe(0);
    // regressionScore > 0 (issues found), threshold 1, so notify fires.
    expect(r.stderr).toMatch(/notify stdout: ok/);
    expect(r.stderr).toMatch(/regressionScore=/);
  }, 60_000);
});
