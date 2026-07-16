#!/usr/bin/env node
// CLI for AGENTseo. Configuration is read from env (see limits.ts)
// so URLs do not appear in `ps`. The start URL is the single positional
// argument.
//
// Usage:
//   AGENTSEO_MAX_URLS=200 agentseo https://example.com/
//   AGENTSEO_OUTPUT=html agentseo https://example.com/ > report.html
//   AGENTSEO_OUTPUT=csv agentseo https://example.com/ > report.csv
//   AGENTSEO_SCHEDULE=1 agentseo --schedule-start
//
// Environment:
//   AGENTSEO_RENDER=js|static        (default: static)
//   AGENTSEO_OUTPUT=md|html|csv|json (default: md)
//   AGENTSEO_COLLECT_VITALS=1        (default: 0; needs --render js)
//   AGENTSEO_MAX_URLS, etc.          (see limits.ts)
//   AGENTSEO_PROJECT_ROOT=<path>     (default: cwd)
//   AGENTSEO_SCHEDULE=1              (run scheduler instead of single crawl)
//
// Legacy SCREAMINGCLAW_* names are still honored (see src/env.ts).

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crawl, type CrawlOutcome } from "./index.js";
import {
  reportToJson,
  reportToMarkdown,
  reportToHtml,
  reportToCsv,
} from "./core/report/index.js";
import { compareSites, type CompareOptions } from "./compare.js";
import {
  compareToJson,
  compareToMarkdown,
  compareToHtml,
} from "./core/report/compare.js";
import {
  runContentGap,
  contentGapToJson,
  contentGapToMarkdown,
} from "./content-gap.js";
import {
  Scheduler,
  runJob,
  loadSchedule,
  saveSchedule,
  type ScheduleJob,
} from "./core/schedule.js";
import { envBool, envInt, envStr } from "./env.js";
import { loadModules, findModule, findWorkflow } from "./modules/loader.js";
import { resolve as resolvePath } from "node:path";
import { ConsoleLogger } from "./core/logger.js";
import type {
  ModuleId,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
} from "./modules/types.js";
import { loadLimits as loadLimitsFromCore } from "./core/limits.js";
import { executeAuditFullWorkflow } from "./modules/audit-full/index.js";
import type { AuditRun } from "./core/audit-run.js";

function projectRoot(): string {
  return resolve(
    envStr("AGENTSEO_PROJECT_ROOT", "SCREAMINGCLAW_PROJECT_ROOT", "."),
  );
}

// Detect custom-rules.json early so we can flip AGENTSEO_KEEP_HTML
// before the limits are loaded by the orchestrator. This avoids
// re-parsing the body just to evaluate css-exists rules.
function detectKeepHtml(): void {
  if (envBool("AGENTSEO_KEEP_HTML", "SCREAMINGCLAW_KEEP_HTML", false)) return; // operator override
  const path = join(projectRoot(), "custom-rules.json");
  if (existsSync(path)) {
    process.env["AGENTSEO_KEEP_HTML"] = "1";
  }
}

async function runOnce(startUrl: string): Promise<CrawlOutcome> {
  detectKeepHtml();
  const mode =
    envStr("AGENTSEO_RENDER", "SCREAMINGCLAW_RENDER", "static") === "js"
      ? "js"
      : "static";
  const collectVitals = envBool(
    "AGENTSEO_COLLECT_VITALS",
    "SCREAMINGCLAW_COLLECT_VITALS",
    false,
  );
  const gscSiteUrl =
    envStr("AGENTSEO_GSC_SITE", "SCREAMINGCLAW_GSC_SITE", "") || undefined;
  const ga4PropertyId =
    envStr("AGENTSEO_GA4_PROPERTY", "SCREAMINGCLAW_GA4_PROPERTY", "") ||
    undefined;
  const lighthouseMode = envStr(
    "AGENTSEO_LIGHTHOUSE",
    "SCREAMINGCLAW_LIGHTHOUSE",
    "off",
  ) as "off" | "home" | "sample" | "all";
  return crawl({
    startUrl,
    renderMode: mode,
    collectVitals,
    projectRoot: projectRoot(),
    gscSiteUrl,
    ga4PropertyId,
    lighthouse: lighthouseMode,
  });
}

function emitReport(outcome: CrawlOutcome): void {
  const fmt = envStr(
    "AGENTSEO_OUTPUT",
    "SCREAMINGCLAW_OUTPUT",
    "md",
  ).toLowerCase();
  switch (fmt) {
    case "json":
      process.stdout.write(reportToJson(outcome.report));
      break;
    case "html":
      process.stdout.write(reportToHtml(outcome.report));
      break;
    case "csv":
      process.stdout.write(reportToCsv(outcome.report));
      break;
    case "md":
      process.stdout.write(reportToMarkdown(outcome.report));
      break;
    default:
      process.stderr.write(
        `unknown AGENTSEO_OUTPUT=${fmt}; expected one of md|html|csv|json. Falling back to md.\n`,
      );
      process.stdout.write(reportToMarkdown(outcome.report));
      break;
  }
}

// --- T-027: module subcommand (`agentseo <module-id>`, `agentseo list-modules`) ---

/**
 * Path to the modules directory. Resolved relative to this file's
 * location at runtime, so it works the same whether the CLI is run
 * from source (src/cli.ts via tsx) or from the compiled bundle
 * (dist/cli.js). In both cases the modules live in a sibling
 * `modules/` directory.
 */
function modulesRoot(): string {
  return resolvePath(fileURLToPath(import.meta.url), "..", "modules");
}

/**
 * Resolve a tool-name-shaped first argument (e.g. "integrations_gsc")
 * back to its moduleId ("integrations:gsc"). Returns the input as-is
 * if no mapping is found, so the caller can do a final existence
 * check against the loader.
 */
function toolNameToModuleId(name: string): string {
  return name.includes(":") ? name : name.replace(/_/g, ":");
}

/**
 * Parse the args after a module id into a ModuleInput. Supports:
 *   --json '<json>'         full input as JSON (overrides everything else)
 *   --crawl <url>           do a crawl first and inject the result as
 *                           input.crawlOutcome
 *   --input-file <path>     read JSON input from a file
 *   key=value               simple top-level fields
 *   --key value             same as key=value
 *
 * Returns { input, crawlUrl } so the caller can decide whether to do
 * the crawl (and can dedupe a crawl that the user already triggered
 * via the env).
 */
async function parseModuleArgs(
  args: string[],
): Promise<{ input: ModuleInput; crawlUrl: string | undefined }> {
  let input: ModuleInput = {};
  let crawlUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--json") {
      const v = args[++i];
      if (!v) throw new Error("--json requires a value");
      input = JSON.parse(v);
    } else if (a === "--crawl") {
      crawlUrl = args[++i];
      if (!crawlUrl) throw new Error("--crawl requires a url");
    } else if (a === "--input-file") {
      const p = args[++i];
      if (!p) throw new Error("--input-file requires a path");
      input = JSON.parse(readFileSync(p, "utf8"));
    } else if (a.startsWith("--")) {
      // --key value
      const key = a.slice(2);
      const v = args[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      // Try JSON-parse first; fall back to string. This lets callers
      // pass arrays/objects inline (e.g. --urls '["a","b"]') and also
      // simple scalars (--maxUrls 200).
      try {
        input[key] = JSON.parse(v);
      } catch {
        input[key] = v;
      }
    } else if (a.includes("=")) {
      const [k, ...rest] = a.split("=");
      const v = rest.join("=");
      try {
        input[k!] = JSON.parse(v);
      } catch {
        input[k!] = v;
      }
    } else {
      // Bare positional — treat as a URL for backwards-compat with
      // `agentseo <module-id> <url>` for modules that take a URL.
      if (!input["url"] && /^https?:\/\//i.test(a)) {
        input["url"] = a;
      } else if (!input["startUrl"] && /^https?:\/\//i.test(a)) {
        input["startUrl"] = a;
      }
    }
  }
  return { input, crawlUrl };
}

function buildModuleContext(
  entry: { readonly id: string },
  crawlOutcome?: CrawlOutcome,
): ModuleContext {
  return {
    projectRoot: projectRoot(),
    limits: loadLimitsFromCore(),
    store: undefined,
    logger: new ConsoleLogger().child({ module: entry.id }),
    crawlOutcome,
    moduleResults: new Map(),
    signal: {
      markWeak: (_reason: string) => {
        // CLI is single-pass; no follow-up scheduling.
      },
      markStrong: (_reason: string) => {
        // see above
      },
      isFollowUp: false,
    },
  };
}

async function runListModules(): Promise<void> {
  const root = modulesRoot();
  const result = await loadModules(root);
  if (!result.ok) {
    process.stderr.write(
      `loader errors: ${JSON.stringify(result.errors, null, 2)}\n`,
    );
    process.exit(1);
  }
  const fmt = envStr(
    "AGENTSEO_OUTPUT",
    "SCREAMINGCLAW_OUTPUT",
    "table",
  ).toLowerCase();
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(result.modules, null, 2) + "\n");
    return;
  }
  // Default: human-readable table
  process.stdout.write(
    "Module ID                       | Version | Category     | Depends on\n",
  );
  process.stdout.write(
    "--------------------------------+---------+--------------+--------------\n",
  );
  for (const m of [...result.modules].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const id = m.id.padEnd(31);
    const ver = m.version.padEnd(7);
    const cat = m.category.padEnd(12);
    const deps = m.dependsOn.length === 0 ? "-" : m.dependsOn.join(", ");
    process.stdout.write(`${id} | ${ver} | ${cat} | ${deps}\n`);
  }
  process.stdout.write(`\n${result.modules.length} module(s) discovered.\n`);
}

async function runModuleInvocation(
  moduleId: string,
  args: string[],
): Promise<void> {
  const root = modulesRoot();
  const result = await loadModules(root);
  if (!result.ok) {
    process.stderr.write(
      `loader errors: ${JSON.stringify(result.errors, null, 2)}\n`,
    );
    process.exit(1);
  }
  const id = toolNameToModuleId(moduleId) as ModuleId;
  const mod = findModule(result.modules, id);
  if (!mod) {
    process.stderr.write(`unknown module: ${moduleId}\n`);
    process.stderr.write(
      `run \`agentseo list-modules\` to see available modules.\n`,
    );
    process.exit(2);
  }

  const { input: parsedInput, crawlUrl } = await parseModuleArgs(args);

  // If the user asked for a crawl, do it. This is the most common
  // way to invoke a tool/integration module that depends on 'crawl'.
  let crawlOutcome: CrawlOutcome | undefined;
  if (crawlUrl) {
    process.stderr.write(`crawling ${crawlUrl} ...\n`);
    crawlOutcome = await runOnce(crawlUrl);
  } else if (
    mod.dependsOn.includes("crawl") &&
    (parsedInput["crawlOutcome"] ||
      parsedInput["index"] ||
      parsedInput["startUrl"])
  ) {
    // Convenience: if the module depends on crawl and the user passed
    // a URL but not a crawl outcome, do the crawl for them.
    const url = (parsedInput["startUrl"] ?? parsedInput["url"]) as
      string | undefined;
    if (url) {
      process.stderr.write(`module depends on 'crawl'; crawling ${url} ...\n`);
      crawlOutcome = await runOnce(url);
    }
  }

  // Merge crawl outcome into the input so modules that look at
  // input.crawlOutcome (as well as ctx.crawlOutcome) both work.
  const input: ModuleInput = crawlOutcome
    ? { ...parsedInput, crawlOutcome }
    : parsedInput;

  const ctx = buildModuleContext(mod, crawlOutcome);
  process.stderr.write(`invoking ${mod.id} v${mod.version} ...\n`);
  const output: ModuleOutput = await mod.invoke(input, ctx);

  const fmt = envStr(
    "AGENTSEO_OUTPUT",
    "SCREAMINGCLAW_OUTPUT",
    "json",
  ).toLowerCase();
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  }
}

async function runAudit(args: string[]): Promise<void> {
  const root = modulesRoot();
  const result = await loadModules(root);
  if (!result.ok) {
    process.stderr.write(
      `loader errors: ${JSON.stringify(result.errors, null, 2)}\n`,
    );
    process.exit(1);
  }
  const workflow = findWorkflow(result.workflows, "audit-full");
  if (!workflow) {
    process.stderr.write(`workflow 'audit-full' not found in registry\n`);
    process.exit(2);
  }

  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    process.stderr.write(
      "usage: agentseo audit <url> [--modules <ids>] [--max-passes 3] [--max-runtime 600000] [--notes <text>]\n",
    );
    process.exit(2);
  }

  const input: ModuleInput = { url };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--modules") {
      const v = args[++i];
      if (!v) throw new Error("--modules requires a comma-separated value");
      input.modules = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--max-passes") {
      const v = args[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 3) {
        throw new Error("--max-passes must be 1, 2, or 3");
      }
      input.maxPasses = n;
    } else if (a === "--max-runtime") {
      const v = args[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1000) {
        throw new Error("--max-runtime must be a number >= 1000 (ms)");
      }
      input.maxRuntimeMs = n;
    } else if (a === "--notes") {
      input.notes = args[++i];
    } else if (a.startsWith("--")) {
      // Unknown flag; ignore rather than crash to keep the CLI
      // forward-compat with future flags the module may add.
      i++;
    }
  }
  // Env-var fallbacks.
  if (input.maxPasses === undefined) {
    const envMax = envInt(
      "AGENTSEO_AUDIT_MAX_PASSES",
      "SCREAMINGCLAW_AUDIT_MAX_PASSES",
      1,
    );
    if (envMax !== 1) input.maxPasses = envMax;
  }
  if (input.maxRuntimeMs === undefined) {
    const envRt = envInt(
      "AGENTSEO_AUDIT_MAX_RUNTIME_MS",
      "SCREAMINGCLAW_AUDIT_MAX_RUNTIME_MS",
      600_000,
    );
    if (envRt !== 600_000) input.maxRuntimeMs = envRt;
  }

  const ctx = buildModuleContext(workflow);
  process.stderr.write(`running audit-full on ${url} ...\n`);
  const leafRegistry = new Map(
    result.modules.map((module) => [module.id, module] as const),
  );
  const output: ModuleOutput = await executeAuditFullWorkflow(
    workflow,
    input,
    ctx,
    leafRegistry,
  );

  const fmt = envStr(
    "AGENTSEO_OUTPUT",
    "SCREAMINGCLAW_OUTPUT",
    "json",
  ).toLowerCase();
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  }
}

// ---------------------------------------------------------------------------
// Sprint 11: `agentseo watch <url>` — long-running monitor loop.
// ---------------------------------------------------------------------------

/**
 * Parse an interval string like "30m", "24h", "1d", or a bare
 * number of milliseconds. Returns milliseconds.
 */
function parseInterval(s: string | undefined, fallbackMs: number): number {
  if (!s) return fallbackMs;
  const trimmed = s.trim();
  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) throw new Error(`invalid interval: ${s}`);
    return value;
  }
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (!m)
    throw new Error(
      `invalid interval: ${s} (use e.g. '30m', '24h', '1d', or bare ms)`,
    );
  const n = Number(m[1]);
  if (!Number.isFinite(n)) throw new Error(`invalid interval: ${s}`);
  const factor = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    m[2]!.toLowerCase() as "ms" | "s" | "m" | "h" | "d"
  ];
  const milliseconds = Math.round(n * factor);
  if (!Number.isSafeInteger(milliseconds))
    throw new Error(`invalid interval: ${s}`);
  return milliseconds;
}

function parseNumericFlag(
  value: string | undefined,
  name: string,
  fallback: number,
  opts: { min?: number; max?: number; integer?: boolean } = {},
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`--${name} must be a finite number`);
  if (opts.integer && !Number.isInteger(parsed))
    throw new Error(`--${name} must be an integer`);
  if (opts.min !== undefined && parsed < opts.min)
    throw new Error(`--${name} must be >= ${opts.min}`);
  if (opts.max !== undefined && parsed > opts.max)
    throw new Error(`--${name} must be <= ${opts.max}`);
  return parsed;
}

function parseFlag(
  args: string[],
  long: string,
  short?: string,
): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === `--${long}` || (short && a === `-${short}`)) {
      return args[i + 1];
    }
    if (a.startsWith(`--${long}=`)) {
      return a.slice(long.length + 3);
    }
  }
  return undefined;
}

function hasFlag(args: string[], long: string, short?: string): boolean {
  return args.some(
    (a) => a === `--${long}` || (short ? a === `-${short}` : false),
  );
}

// `loadLimits` is imported lazily so test startup is fast. We
// re-declare its presence here to keep the type-checker happy.
// (No-op — the real import is at the top of the file.)

async function runWatch(args: string[]): Promise<void> {
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    process.stderr.write(
      "usage: agentseo watch <url> [--interval 24h] [--threshold 5] [--modules <ids>] [--max-passes 1] [--max-runtime 60000] [--channels stdout,webhook,telegram] [--once]\n",
    );
    process.exit(2);
  }
  const intervalMs = parseInterval(
    parseFlag(args, "interval", "i"),
    24 * 3_600_000,
  );
  const threshold = parseNumericFlag(
    parseFlag(args, "threshold", "t"),
    "threshold",
    5,
    { min: 0 },
  );
  const maxPasses = parseNumericFlag(
    parseFlag(args, "max-passes", "p"),
    "max-passes",
    1,
    { min: 1, max: 3, integer: true },
  );
  const maxRuntime = parseNumericFlag(
    parseFlag(args, "max-runtime", "r"),
    "max-runtime",
    60_000,
    { min: 1_000, integer: true },
  );
  const modulesRaw =
    parseFlag(args, "modules", "m") ??
    "onpage,technical,content-quality,link-analysis";
  const modules: ModuleId[] = modulesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((id) => id as ModuleId);
  const channelsRaw = parseFlag(args, "channels", "c") ?? "stdout";
  const channels = channelsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as ("stdout" | "webhook" | "telegram")[];
  const once = hasFlag(args, "once");

  const { notify, deltaToNotification } =
    await import("./integrations/notify.js");
  const { listAuditRuns, saveAuditRun } = await import("./core/audit-run.js");
  const { diffAuditRuns, diffIssueCount } =
    await import("./integrations/change.js");
  const { runComposer } = await import("./core/composer.js");

  process.stderr.write(
    `[agentseo] watch started url=${url} interval=${intervalMs}ms threshold=${threshold} channels=${channels.join(",")}\n`,
  );

  const stop = new AbortController();
  process.on("SIGINT", () => {
    process.stderr.write(
      "[agentseo] SIGINT received, exiting after current cycle\n",
    );
    stop.abort();
  });
  process.on("SIGTERM", () => stop.abort());

  const root = modulesRoot();
  const loader = await loadModules(root);
  if (!loader.ok) {
    process.stderr.write(
      `loader errors: ${JSON.stringify(loader.errors, null, 2)}\n`,
    );
    process.exit(1);
  }

  let cycle = 0;
  while (!stop.signal.aborted) {
    cycle += 1;
    const cycleStart = Date.now();
    process.stderr.write(
      `[agentseo] watch cycle ${cycle} starting at ${new Date().toISOString()}\n`,
    );

    const auditResult = await runComposer({
      startUrl: url,
      registry: loader.modules,
      modulesToRun: modules,
      limits: loadLimitsFromCore(),
      projectRoot: projectRoot(),
      logger: new ConsoleLogger(),
      maxPasses,
      maxRuntimeMs: maxRuntime,
    });
    const issueCount = auditResult.issues.length;
    const auditRunId = `watch-${new Date().toISOString().replace(/[:.]/g, "-")}-${cycle.toString().padStart(4, "0")}`;

    // The current run has not been saved yet, so the newest persisted
    // comparable run is the baseline (index 0, not index 1).
    const previous =
      listAuditRuns(projectRoot(), {
        startUrlPrefix: url,
        status: ["succeeded", "partial"],
        limit: 1,
      })[0] ?? null;

    const currentRunLite: AuditRun = {
      id: auditRunId,
      startUrl: url,
      modules,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: auditResult.status,
      passes: auditResult.passes,
      issueCount,
      issues: auditResult.issues.map((i) => ({
        id: i.id,
        category: i.category,
        priority: i.priority as "High" | "Medium" | "Low",
        message: i.message,
        urls: [...i.urls],
        detail: i.detail,
        fix: i.fix,
        moduleId: i.moduleId as ModuleId | undefined,
      })),
      signal: {},
      durationMs: auditResult.durationMs,
      errored: Object.fromEntries(auditResult.errored),
    };
    let delta;
    if (previous && !previous.issues) {
      const fb = diffIssueCount(previous, currentRunLite);
      delta = {
        previousRunId: previous.id,
        currentRunId: auditRunId,
        newIssues: [],
        resolvedIssues: [],
        persistentIssues: [],
        changedScopeIssues: [],
        regressionScore: fb.delta,
        summary: fb.summary,
        byModule: {},
      };
    } else {
      delta = diffAuditRuns(previous, currentRunLite);
    }

    const shouldNotify =
      previous !== null &&
      (auditResult.status === "succeeded" ||
        auditResult.status === "partial") &&
      (delta.regressionScore >= threshold || delta.newIssues.length > 0);
    process.stderr.write(
      `[agentseo] cycle ${cycle} complete: ${issueCount} issues, regressionScore=${delta.regressionScore}, notify=${shouldNotify}\n`,
    );
    if (shouldNotify) {
      const payload = deltaToNotification(delta, url);
      const results = await notify(payload, { channels });
      for (const r of results) {
        process.stderr.write(
          `[agentseo] notify ${r.channel}: ${r.ok ? "ok" : "FAILED"} (${r.durationMs}ms${r.error ? `, ${r.error}` : ""})\n`,
        );
      }
    }

    saveAuditRun(projectRoot(), currentRunLite);

    if (once || stop.signal.aborted) break;
    if (intervalMs <= 0) break;

    process.stderr.write(
      `[agentseo] cycle ${cycle} done in ${Date.now() - cycleStart}ms, sleeping ${intervalMs}ms\n`,
    );
    await new Promise<void>((resolveP) => {
      const t = setTimeout(resolveP, intervalMs);
      stop.signal.addEventListener("abort", () => {
        clearTimeout(t);
        resolveP();
      });
    });
  }
  process.stderr.write("[agentseo] watch exited cleanly\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isScheduleStart = args.includes("--schedule-start");
  const startUrl = args.find((a) => !a.startsWith("--"));

  // T-027: `agentseo list-modules`
  if (args[0] === "list-modules") {
    await runListModules();
    return;
  }

  // T-038: `agentseo audit <url> [--modules <ids>] [--max-passes 3]
  // [--max-runtime 600000] [--notes <text>]` — the operator's
  // one-liner for "tell me everything you can about this site."
  // Dispatches to the audit-full workflow. Runs BEFORE the generic
  // module dispatch so the audit-specific flags (--max-passes,
  // --max-runtime, --modules) are handled here rather than
  // falling through to generic leaf-module dispatch.
  if (args[0] === "audit" || args[0] === "audit-full") {
    await runAudit(args.slice(1));
    return;
  }

  // Sprint 11: `agentseo watch <url> [--interval <ms|24h|30m>]
  // [--threshold 5] [--channels stdout,webhook,telegram]`
  // [--max-passes 1] [--modules <ids>]`
  // Long-running loop: audit → diff vs previous → notify if
  // regression score > threshold. Runs once immediately on
  // startup, then every --interval until SIGINT. The operator
  // is expected to wire this to systemd / k8s / etc. for
  // production.
  if (args[0] === "watch") {
    await runWatch(args.slice(1));
    return;
  }

  // T-027: `agentseo <module-id> [args...]` — dispatch to a module
  // if the first positional arg matches a known module id. Done
  // before the URL-or-? check so the existing single-crawl flow
  // (URL as first arg) keeps working unchanged.
  if (startUrl && !startUrl.startsWith("-")) {
    const candidateId = toolNameToModuleId(startUrl);
    const probe = await loadModules(modulesRoot());
    if (findModule(probe.modules, candidateId as ModuleId)) {
      await runModuleInvocation(startUrl, args.slice(1));
      return;
    }
  }

  if (
    envBool("AGENTSEO_SCHEDULE", "SCREAMINGCLAW_SCHEDULE", false) ||
    isScheduleStart
  ) {
    const root = projectRoot();
    const cfg = loadSchedule(root);
    if (cfg.jobs.length === 0) {
      process.stderr.write("no jobs in schedule.json; add a job first\n");
      process.exit(2);
    }
    const sched = new Scheduler(root);
    sched.start();
    process.stderr.write(
      `scheduler started with ${cfg.jobs.length} job(s) at ${root}\n`,
    );
    // Keep process alive; allow SIGINT to stop.
    process.on("SIGINT", () => {
      sched.stop();
      process.stderr.write("scheduler stopped\n");
      process.exit(0);
    });
    return;
  }

  if (args.includes("--schedule-add") && startUrl) {
    const root = projectRoot();
    const cfg = loadSchedule(root);
    const job: ScheduleJob = {
      name: `audit-${cfg.jobs.length + 1}`,
      startUrl,
      intervalMinutes: 1440,
      renderMode:
        envStr("AGENTSEO_RENDER", "SCREAMINGCLAW_RENDER", "static") === "js"
          ? "js"
          : "static",
      collectVitals: envBool(
        "AGENTSEO_COLLECT_VITALS",
        "SCREAMINGCLAW_COLLECT_VITALS",
        false,
      ),
      limits: {
        maxUrls: envInt("AGENTSEO_MAX_URLS", "SCREAMINGCLAW_MAX_URLS", 200),
        maxRuntimeMs: envInt(
          "AGENTSEO_MAX_RUNTIME_MS",
          "SCREAMINGCLAW_MAX_RUNTIME_MS",
          60_000,
        ),
      },
    };
    cfg.jobs.push(job);
    saveSchedule(root, cfg);
    process.stderr.write(`added job: ${job.name} -> ${startUrl}\n`);
    return;
  }

  if (args.includes("--schedule-run") && startUrl) {
    const root = projectRoot();
    const cfg = loadSchedule(root);
    const job = cfg.jobs.find((j) => j.startUrl === startUrl);
    if (!job) {
      process.stderr.write(`no job for ${startUrl}\n`);
      process.exit(2);
    }
    const result = await runJob(job, root);
    process.stdout.write(reportToMarkdown(result.report));
    return;
  }

  if (!startUrl) {
    process.stderr.write(
      "usage:\n" +
        "  agentseo <startUrl>                       # run a single crawl\n" +
        "  agentseo --compare <url1> <url2> [url3]   # compare N sites side by side\n" +
        "  agentseo --schedule-add <startUrl>        # add a job to schedule.json\n" +
        "  agentseo --schedule-start                 # start the scheduler (foreground)\n" +
        "  agentseo --schedule-run <startUrl>        # run a single scheduled job once\n",
    );
    process.exit(2);
  }

  if (args.includes("--content-gap")) {
    const urls = args.filter((a) => !a.startsWith("--"));
    if (urls.length < 2) {
      process.stderr.write(
        "--content-gap requires at least 2 URLs (target + 1 ref)\n",
      );
      process.exit(2);
    }
    const [target, ...refs] = urls;
    const report = await runContentGap({
      targetUrl: target!,
      referenceUrls: refs,
      topN: envInt(
        "AGENTSEO_CONTENT_GAP_TOPN",
        "SCREAMINGCLAW_CONTENT_GAP_TOPN",
        20,
      ),
      timeoutMs: 30_000,
      maxBodyBytes: 2_621_440,
      allowPrivate: envBool(
        "AGENTSEO_ALLOW_PRIVATE",
        "SCREAMINGCLAW_ALLOW_PRIVATE",
        false,
      ),
      renderMode:
        envStr("AGENTSEO_RENDER", "SCREAMINGCLAW_RENDER", "static") === "js"
          ? "js"
          : "static",
    });
    const fmt = envStr(
      "AGENTSEO_OUTPUT",
      "SCREAMINGCLAW_OUTPUT",
      "md",
    ).toLowerCase();
    if (fmt === "json") process.stdout.write(contentGapToJson(report));
    else process.stdout.write(contentGapToMarkdown(report));
    return;
  }

  if (args.includes("--compare")) {
    const urls = args.filter((a) => !a.startsWith("--"));
    if (urls.length < 2) {
      process.stderr.write("--compare requires at least 2 URLs\n");
      process.exit(2);
    }
    const compareOpts: CompareOptions = {
      urls,
      renderMode:
        envStr("AGENTSEO_RENDER", "SCREAMINGCLAW_RENDER", "static") === "js"
          ? "js"
          : "static",
      maxUrls: envInt("AGENTSEO_MAX_URLS", "SCREAMINGCLAW_MAX_URLS", 30),
      maxRuntimeMs: envInt(
        "AGENTSEO_MAX_RUNTIME_MS",
        "SCREAMINGCLAW_MAX_RUNTIME_MS",
        60_000,
      ),
      lighthouse: envStr(
        "AGENTSEO_LIGHTHOUSE",
        "SCREAMINGCLAW_LIGHTHOUSE",
        "off",
      ) as "off" | "home" | "sample" | "all",
      projectRoot: projectRoot(),
    };
    const result = await compareSites(compareOpts);
    const fmt = envStr(
      "AGENTSEO_OUTPUT",
      "SCREAMINGCLAW_OUTPUT",
      "html",
    ).toLowerCase();
    if (fmt === "json") process.stdout.write(compareToJson(result));
    else if (fmt === "md") process.stdout.write(compareToMarkdown(result));
    else process.stdout.write(compareToHtml(result));
    return;
  }

  const outcome = await runOnce(startUrl);
  emitReport(outcome);
}

main().catch((err: unknown) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
