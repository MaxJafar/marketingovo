// Sprint 4 CLI smoke (T-044): spawn the compiled `dist/cli.js audit`
// binary against the local fixture and verify the JSON output and
// the persisted AuditRun. This is the closest we can get to
// "production invocation" without going live on a real site.
//
// Why this is a vitest test and not a shell script: the fixture
// is a TypeScript file that imports node:http helpers. Easier to
// share state with vitest's beforeAll/afterAll hooks than to
// chain a separate process.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
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

beforeAll(async () => {
  process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
  process.env.MARKETINGOVO_ALLOW_PRIVATE = "1";
  site = await startFixtureSite();
  tmpRoot = mkdtempSync(join(tmpdir(), "marketingovo-cli-audit-"));
}, 30_000);

afterAll(async () => {
  await site.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}, 5_000);

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  parsed?: Record<string, unknown>;
}

function runCli(
  args: string[],
  extraEnv: Record<string, string> = {},
): Promise<CliResult> {
  return new Promise((resolveP) => {
    const child = spawn("node", [CLI, ...args], {
      cwd: REPO,
      env: {
        ...process.env,
        GOLEMSEO_PROJECT_ROOT: tmpRoot,
        SCREAMINGCLAW_PROJECT_ROOT: tmpRoot,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(out);
      } catch {
        // Not JSON; that's fine for some test cases (e.g. usage
        // message). Leave parsed undefined.
      }
      resolveP({ exitCode: code ?? 1, stdout: out, stderr: err, parsed });
    });
  });
}

describe("CLI: marketingovo audit (Sprint 4 smoke)", () => {
  it("prints usage to stderr when called without a url", async () => {
    const r = await runCli(["audit"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: marketingovo audit <url>/);
  });

  it("runs a real audit on the fixture, returns JSON, persists AuditRun", async () => {
    const url = `${site.baseUrl}/`;
    const r = await runCli([
      "audit",
      url,
      "--modules",
      "onpage,technical",
      "--max-passes",
      "1",
      "--max-runtime",
      "30000",
      "--notes",
      "Sprint 4 CLI smoke test",
    ]);
    if (!r.parsed) {
      // Diagnostic: print what came out so a future failure is
      // debuggable from the test log alone.
      console.log("CLI exit:", r.exitCode);
      console.log("CLI stdout:", r.stdout);
      console.log("CLI stderr:", r.stderr);
    }
    expect(r.exitCode, `stderr: ${r.stderr}`).toBe(0);
    expect(r.parsed).toBeDefined();
    expect(["succeeded", "partial"]).toContain(r.parsed!["status"]);
    expect(r.parsed!["startUrl"]).toBe(url);
    expect(r.parsed!["modules"]).toEqual(["onpage", "technical"]);
    expect(typeof r.parsed!["auditRunId"]).toBe("string");
    expect(r.parsed!["issueCount"] as number).toBeGreaterThan(0);
    expect(r.parsed!["errored"]).toEqual([]);

    // AuditRun on disk
    const auditsFile = join(tmpRoot, "audits.json");
    expect(existsSync(auditsFile)).toBe(true);
    const text = readFileSync(auditsFile, "utf8");
    expect(text).toContain(r.parsed!["auditRunId"] as string);
    expect(text).toMatch(/"status": "(succeeded|partial)"/);
    expect(text).toContain("Sprint 4 CLI smoke test"); // notes round-trip
  }, 60_000);

  it("supports the module-id form (audit-full <url>)", async () => {
    const url = `${site.baseUrl}/has-all`;
    const r = await runCli([
      "audit-full",
      url,
      "--modules",
      "onpage,technical",
      "--max-passes",
      "1",
      "--max-runtime",
      "30000",
    ]);
    expect(r.exitCode, `stderr: ${r.stderr}`).toBe(0);
    expect(r.parsed).toBeDefined();
    expect(["succeeded", "partial"]).toContain(r.parsed!["status"]);
  }, 60_000);
});
