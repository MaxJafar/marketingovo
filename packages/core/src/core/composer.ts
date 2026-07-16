import type { Issue } from "../checks/index.js";
import { crawl, type CrawlOutcome } from "../orchestrator.js";
import type {
  JSONSchemaSubset,
  Module,
  ModuleContext,
  ModuleId,
  ModuleInput,
  ModuleOutput,
  ModuleRequirement,
} from "../modules/types.js";
import {
  canonicalizeIssueUrl,
  issueToInstances,
  type IssueInstance,
} from "./entities.js";
import type { Limits } from "./limits.js";
import { ConsoleLogger, type Logger } from "./logger.js";
import type { ProjectStore } from "./store.js";
import { evaluatePass, type PassSignal } from "./signal-eval.js";

export type RunStatus =
  "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
export type ModuleExecutionStatus = RunStatus | "skipped";

export interface ModuleExecutionState {
  readonly moduleId: ModuleId;
  readonly version: string;
  readonly status: ModuleExecutionStatus;
  readonly attempts: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  /** Normalized measured coverage. Missing coverage stays unavailable. */
  readonly coverage?: number;
  readonly error?: string;
  readonly skipReason?: string;
}

export interface ComposerOptions {
  readonly startUrl: string;
  readonly registry: readonly Module[];
  readonly modulesToRun: readonly ModuleId[];
  readonly limits: Limits;
  readonly projectRoot: string;
  readonly store?: ProjectStore;
  readonly maxPasses?: number;
  readonly maxRuntimeMs?: number;
  /** Bounded module pool size. Crawl concurrency is configured separately. */
  readonly maxModuleConcurrency?: number;
  readonly abortSignal?: AbortSignal;
  readonly logger?: Logger;
  readonly onModuleStateChange?: (state: ModuleExecutionState) => void;
}

export interface ComposerResult {
  readonly status: Exclude<RunStatus, "queued" | "running">;
  readonly issues: readonly Issue[];
  readonly issueInstances: readonly IssueInstance[];
  readonly moduleResults: ReadonlyMap<ModuleId, ModuleOutput>;
  readonly moduleStates: ReadonlyMap<ModuleId, ModuleExecutionState>;
  /** The most recent signal for each module, not an append-only pass log. */
  readonly signal: ReadonlyMap<ModuleId, PassSignal>;
  readonly passes: number;
  readonly durationMs: number;
  readonly crawlOutcome?: CrawlOutcome;
  readonly errored: ReadonlyMap<ModuleId, string>;
  readonly skipped: ReadonlyMap<ModuleId, string>;
  /** Weak modules whose follow-up produced no new evidence. */
  readonly inconclusive: ReadonlyMap<ModuleId, string>;
}

interface ExecutionPlan {
  layers: Module[][];
  needsCrawl: boolean;
  missingDependencies: Map<ModuleId, string[]>;
  skipped: Map<ModuleId, string>;
  errors: Map<ModuleId, string>;
  cycles: Map<ModuleId, string>;
}

interface InvocationResult {
  output: ModuleOutput;
  issues: Map<string, Issue>;
  signal: PassSignal;
  signature: string;
  coverage?: number;
}

const DEFAULT_MAX_PASSES = 1;
const ABSOLUTE_MAX_PASSES = 3;
const DEFAULT_MAX_RUNTIME_MS = 600_000;
const DEFAULT_MODULE_CONCURRENCY = 4;
const CRAWL_MODULE_ID = "crawl" as const;

export async function runComposer(
  opts: ComposerOptions,
): Promise<ComposerResult> {
  const logger = (opts.logger ?? new ConsoleLogger()).child({
    component: "composer",
  });
  const maxPasses = clampInteger(
    opts.maxPasses ?? DEFAULT_MAX_PASSES,
    1,
    ABSOLUTE_MAX_PASSES,
  );
  const maxRuntimeMs = finitePositive(
    opts.maxRuntimeMs,
    DEFAULT_MAX_RUNTIME_MS,
  );
  const poolSize = clampInteger(
    opts.maxModuleConcurrency ?? DEFAULT_MODULE_CONCURRENCY,
    1,
    32,
  );
  const startTime = Date.now();
  const plan = createExecutionPlan(opts.registry, opts.modulesToRun);

  const moduleResults = new Map<ModuleId, ModuleOutput>();
  const moduleStates = new Map<ModuleId, ModuleExecutionState>();
  const signalMap = new Map<ModuleId, PassSignal>();
  const errored = new Map<ModuleId, string>();
  const skipped = new Map<ModuleId, string>(plan.skipped);
  const inconclusive = new Map<ModuleId, string>();
  const issuesByModule = new Map<ModuleId, Map<string, Issue>>();
  const previousSignatures = new Map<ModuleId, string>();
  let crawlOutcome: CrawlOutcome | undefined;
  let passesUsed = 0;
  let timedOut = false;

  const setState = (state: ModuleExecutionState): void => {
    moduleStates.set(state.moduleId, state);
    opts.onModuleStateChange?.(state);
  };

  for (const [id, reason] of skipped) {
    if (plan.errors.has(id)) continue;
    const m = opts.registry.find((candidate) => candidate.id === id);
    setState({
      moduleId: id,
      version: m?.version ?? "unknown",
      status: "skipped",
      attempts: 0,
      skipReason: reason,
    });
  }
  for (const [id, reason] of plan.errors) {
    errored.set(id, reason);
    const m = opts.registry.find((candidate) => candidate.id === id);
    setState({
      moduleId: id,
      version: m?.version ?? "unknown",
      status: "failed",
      attempts: 0,
      error: reason,
    });
  }
  for (const [id, reason] of plan.cycles) {
    errored.set(id, reason);
    const m = opts.registry.find((candidate) => candidate.id === id);
    setState({
      moduleId: id,
      version: m?.version ?? "unknown",
      status: "failed",
      attempts: 0,
      error: reason,
    });
  }
  for (const layer of plan.layers) {
    for (const m of layer) {
      if (!moduleStates.has(m.id)) {
        setState({
          moduleId: m.id,
          version: m.version,
          status: "queued",
          attempts: 0,
        });
      }
    }
  }

  if (plan.needsCrawl) {
    setState({
      moduleId: CRAWL_MODULE_ID,
      version: "synthetic-v1",
      status: "queued",
      attempts: 0,
    });
    if (opts.abortSignal?.aborted) {
      setState({
        moduleId: CRAWL_MODULE_ID,
        version: "synthetic-v1",
        status: "cancelled",
        attempts: 0,
      });
    } else {
      const startedAt = new Date().toISOString();
      const crawlStarted = Date.now();
      setState({
        moduleId: CRAWL_MODULE_ID,
        version: "synthetic-v1",
        status: "running",
        attempts: 1,
        startedAt,
      });
      try {
        crawlOutcome = await crawl({
          startUrl: opts.startUrl,
          renderMode: opts.limits.renderMode === "js" ? "js" : "static",
          projectRoot: opts.projectRoot,
          limits: opts.limits,
          signal: opts.abortSignal,
        });
        moduleResults.set(CRAWL_MODULE_ID, {
          report: crawlOutcome.report,
          runId: crawlOutcome.runId,
        } as unknown as ModuleOutput);
        setState({
          moduleId: CRAWL_MODULE_ID,
          version: "synthetic-v1",
          status: "succeeded",
          attempts: 1,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - crawlStarted,
        });
      } catch (error) {
        const message = errorMessage(error);
        errored.set(CRAWL_MODULE_ID, message);
        setState({
          moduleId: CRAWL_MODULE_ID,
          version: "synthetic-v1",
          status: "failed",
          attempts: 1,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - crawlStarted,
          error: message,
        });
        logger.error("crawl failed", { err: message });
      }
    }
  }

  let rerunIds: Set<ModuleId> | null = null;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    if (opts.abortSignal?.aborted) break;
    if (Date.now() - startTime >= maxRuntimeMs) {
      timedOut = true;
      break;
    }

    const candidates = new Set<ModuleId>();
    for (const layer of plan.layers) {
      for (const module of layer) {
        if (pass === 0 || rerunIds?.has(module.id)) candidates.add(module.id);
      }
    }
    if (candidates.size === 0) break;
    passesUsed = pass + 1;
    const unchangedThisPass = new Set<ModuleId>();

    for (const layer of plan.layers) {
      if (Date.now() - startTime >= maxRuntimeMs) {
        timedOut = true;
        break;
      }
      const runnable = layer.filter((module) => candidates.has(module.id));
      if (runnable.length === 0) continue;

      const results = await boundedMap(runnable, poolSize, async (module) => {
        if (opts.abortSignal?.aborted) {
          setState({
            ...baseState(module, moduleStates),
            status: "cancelled",
            completedAt: new Date().toISOString(),
          });
          return {
            module,
            result: null,
            error: null,
            skippedReason: "run cancelled",
          };
        }
        const dependencyReason = unavailableDependencyReason(
          module,
          plan,
          moduleStates,
        );
        const requirementReason = missingRequirementReason(
          module.requirements ?? [],
        );
        const skipReason = dependencyReason ?? requirementReason;
        if (skipReason) {
          skipped.set(module.id, skipReason);
          setState({
            ...baseState(module, moduleStates),
            status: "skipped",
            completedAt: new Date().toISOString(),
            skipReason,
          });
          return {
            module,
            result: null,
            error: null,
            skippedReason: skipReason,
          };
        }

        const prior = baseState(module, moduleStates);
        const startedAt = new Date().toISOString();
        const invocationStart = Date.now();
        setState({
          ...prior,
          status: "running",
          attempts: prior.attempts + 1,
          startedAt,
        });
        try {
          const result = await runOne(
            module,
            opts,
            crawlOutcome,
            moduleResults,
            logger,
            pass,
            signalMap.get(module.id)?.weak ?? [],
          );
          setState({
            moduleId: module.id,
            version: module.version,
            status: "succeeded",
            attempts: prior.attempts + 1,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: (prior.durationMs ?? 0) + Date.now() - invocationStart,
            ...(result.coverage === undefined
              ? {}
              : { coverage: result.coverage }),
          });
          return { module, result, error: null, skippedReason: null };
        } catch (error) {
          const message = errorMessage(error);
          setState({
            moduleId: module.id,
            version: module.version,
            status: "failed",
            attempts: prior.attempts + 1,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: (prior.durationMs ?? 0) + Date.now() - invocationStart,
            error: message,
          });
          return { module, result: null, error: message, skippedReason: null };
        }
      });

      for (const entry of results) {
        if (entry.error) {
          errored.set(entry.module.id, entry.error);
          logger.error("module failed", {
            moduleId: entry.module.id,
            err: entry.error,
          });
          continue;
        }
        if (!entry.result) continue;
        moduleResults.set(entry.module.id, entry.result.output);
        signalMap.set(entry.module.id, entry.result.signal);
        issuesByModule.set(entry.module.id, entry.result.issues);
        const previous = previousSignatures.get(entry.module.id);
        if (pass > 0 && previous === entry.result.signature)
          unchangedThisPass.add(entry.module.id);
        previousSignatures.set(entry.module.id, entry.result.signature);
      }
      // A module cannot be forcibly interrupted if its implementation ignores
      // cancellation. Re-check the wall-clock budget after every bounded layer
      // so an over-budget final layer can never be reported as a clean success.
      if (Date.now() - startTime >= maxRuntimeMs) {
        timedOut = true;
        break;
      }
    }

    if (opts.abortSignal?.aborted || timedOut) break;
    const verdict = evaluatePass(
      signalMap,
      plan.layers.flat().map((module) => module.id),
    );
    if (verdict.stop) break;

    const next = verdict.rerun.filter(
      (id) => moduleStates.get(id)?.status === "succeeded",
    );
    for (const id of next) {
      if (unchangedThisPass.has(id)) {
        inconclusive.set(
          id,
          "follow-up produced the same issues and weak-signal reasons; stopped",
        );
      }
    }
    const progressing = next.filter((id) => !unchangedThisPass.has(id));
    if (progressing.length === 0) break;
    if (pass === maxPasses - 1) {
      for (const id of progressing)
        inconclusive.set(id, "maximum follow-up pass count reached");
      break;
    }
    rerunIds = new Set(progressing);
    logger.info("scheduling follow-up", {
      pass: pass + 2,
      modules: progressing,
      reason: verdict.reason,
    });
  }

  if (timedOut) {
    for (const [id, state] of moduleStates) {
      if (state.status !== "queued") continue;
      const reason = `runtime budget of ${maxRuntimeMs}ms exhausted`;
      skipped.set(id, reason);
      setState({
        ...state,
        status: "skipped",
        completedAt: new Date().toISOString(),
        skipReason: reason,
      });
    }
  }
  if (opts.abortSignal?.aborted) {
    for (const [id, state] of moduleStates) {
      if (state.status !== "queued") continue;
      setState({
        ...state,
        status: "cancelled",
        completedAt: new Date().toISOString(),
      });
    }
  }

  const issues = [...issuesByModule.values()].flatMap((entries) => [
    ...entries.values(),
  ]);
  const observedAt = new Date().toISOString();
  const issueInstances = issues.flatMap((issue) =>
    issueToInstances(
      issue,
      (issue.moduleId ?? "unknown") as ModuleId,
      observedAt,
    ),
  );
  const status = finalStatus(moduleStates, {
    aborted: opts.abortSignal?.aborted ?? false,
    timedOut,
    hasInconclusive: inconclusive.size > 0,
  });

  return {
    status,
    issues,
    issueInstances,
    moduleResults,
    moduleStates,
    signal: signalMap,
    passes: passesUsed,
    durationMs: Date.now() - startTime,
    crawlOutcome,
    errored,
    skipped,
    inconclusive,
  };
}

function createExecutionPlan(
  registry: readonly Module[],
  requested: readonly ModuleId[],
): ExecutionPlan {
  const byId = new Map(registry.map((module) => [module.id, module] as const));
  const wanted = new Set<ModuleId>();
  const missingDependencies = new Map<ModuleId, string[]>();
  const skipped = new Map<ModuleId, string>();
  const errors = new Map<ModuleId, string>();
  let needsCrawl = false;

  const collect = (id: ModuleId, requiredBy?: ModuleId): void => {
    if (id === CRAWL_MODULE_ID) {
      needsCrawl = true;
      return;
    }
    const module = byId.get(id);
    if (!module) {
      if (requiredBy) addMissingDependency(missingDependencies, requiredBy, id);
      else {
        const reason = `unknown module: ${id}`;
        skipped.set(id, reason);
        errors.set(id, reason);
      }
      return;
    }
    // Defense in depth for untyped/forged registries. The Module contract can
    // only express leaf entries, so normal callers cannot reach this branch.
    if ((module as { readonly kind?: string }).kind === "workflow") {
      const reason = `workflow ${id} cannot be scheduled in the leaf-module registry`;
      if (requiredBy)
        addMissingDependency(missingDependencies, requiredBy, reason);
      else {
        skipped.set(id, reason);
        errors.set(id, reason);
      }
      return;
    }
    if (wanted.has(id)) return;
    wanted.add(id);
    for (const dependency of module.dependsOn) collect(dependency, id);
  };
  for (const id of requested) collect(id);

  const remaining = new Set(wanted);
  const layers: Module[][] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((id) => {
        const module = byId.get(id)!;
        return module.dependsOn.every(
          (dependency) =>
            dependency === CRAWL_MODULE_ID || !remaining.has(dependency),
        );
      })
      .map((id) => byId.get(id)!);
    if (ready.length === 0) break;
    layers.push(ready);
    for (const module of ready) remaining.delete(module.id);
  }

  const cycles = new Map<ModuleId, string>();
  if (remaining.size > 0) {
    const ids = [...remaining];
    const reason = `dependency cycle detected among: ${ids.join(", ")}`;
    for (const id of ids) cycles.set(id, reason);
  }
  return { layers, needsCrawl, missingDependencies, skipped, errors, cycles };
}

async function runOne(
  module: Module,
  opts: ComposerOptions,
  crawlOutcome: CrawlOutcome | undefined,
  moduleResults: ReadonlyMap<ModuleId, ModuleOutput>,
  logger: Logger,
  pass: number,
  previousWeakReasons: readonly string[],
): Promise<InvocationResult> {
  const childLogger = logger.child({ module: module.id, pass: pass + 1 });
  const passSignal: PassSignal = { weak: [], strong: [] };
  const context: ModuleContext = {
    projectRoot: opts.projectRoot,
    limits: opts.limits,
    store: opts.store,
    logger: childLogger,
    crawlOutcome,
    moduleResults,
    signal: {
      markWeak: (reason) => passSignal.weak.push(reason),
      markStrong: (reason) => passSignal.strong.push(reason),
      isFollowUp: pass > 0,
    },
  };
  const input: ModuleInput = {
    startUrl: opts.startUrl,
    url: opts.startUrl,
    ...(crawlOutcome ? { crawlOutcome } : {}),
    ...(pass > 0
      ? {
          followUp: {
            pass: pass + 1,
            strategy: "deeper",
            previousWeakReasons: [...previousWeakReasons],
            breadthMultiplier: Math.min(4, 2 ** pass),
          },
        }
      : {}),
  };

  assertSchema(module.inputSchema, input, `${module.id} input`);
  const output = await module.invoke(input, context);
  assertSchema(module.outputSchema, output, `${module.id} output`);
  const rawIssues = output.issues ?? output.allIssues ?? [];
  if (!Array.isArray(rawIssues)) {
    throw new TypeError(`${module.id} output issues must be an array`);
  }
  const issues = normalizeIssues(module.id, rawIssues);
  const coverage = normalizeCoverage(module.id, output);
  const signature = [
    [...issues.keys()].sort().join("|"),
    [...passSignal.weak].sort().join("|"),
    [...passSignal.strong].sort().join("|"),
  ].join("\n");
  return {
    output,
    issues,
    signal: passSignal,
    signature,
    ...(coverage === undefined ? {} : { coverage }),
  };
}

function normalizeCoverage(
  moduleId: ModuleId,
  output: ModuleOutput,
): number | undefined {
  if (!("coverage" in output)) return undefined;
  const coverage = output.coverage;
  if (
    typeof coverage !== "number" ||
    !Number.isFinite(coverage) ||
    coverage < 0 ||
    coverage > 1
  ) {
    throw new TypeError(
      `${moduleId} output coverage must be a finite number between 0 and 1`,
    );
  }
  return coverage;
}

function normalizeIssues(
  moduleId: ModuleId,
  rawIssues: readonly unknown[],
): Map<string, Issue> {
  const normalized = new Map<string, Issue>();
  for (let index = 0; index < rawIssues.length; index += 1) {
    const value = rawIssues[index];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${moduleId} issue[${index}] must be an object`);
    }
    const issue = value as Partial<Issue>;
    if (!issue.id || typeof issue.id !== "string")
      throw new TypeError(`${moduleId} issue[${index}].id is required`);
    if (!issue.category || typeof issue.category !== "string")
      throw new TypeError(`${moduleId} issue[${index}].category is required`);
    if (!issue.message || typeof issue.message !== "string")
      throw new TypeError(`${moduleId} issue[${index}].message is required`);
    if (
      !(["High", "Medium", "Low"] as const).includes(
        issue.priority as "High" | "Medium" | "Low",
      )
    ) {
      throw new TypeError(
        `${moduleId} issue[${index}].priority must be High, Medium, or Low`,
      );
    }
    if (
      !Array.isArray(issue.urls) ||
      !issue.urls.every((url) => typeof url === "string")
    ) {
      throw new TypeError(
        `${moduleId} issue[${index}].urls must be an array of strings`,
      );
    }
    const urls = issue.urls.length > 0 ? issue.urls : [null];
    for (const url of urls) {
      const canonicalUrl = canonicalizeIssueUrl(url);
      const key = `${moduleId}\u0000${issue.id}\u0000${canonicalUrl ?? "<site>"}`;
      normalized.set(key, {
        id: issue.id,
        category: issue.category,
        priority: issue.priority as Issue["priority"],
        message: issue.message,
        urls: canonicalUrl ? [canonicalUrl] : [],
        detail: issue.detail,
        fix: issue.fix,
        moduleId,
      });
    }
  }
  return normalized;
}

function unavailableDependencyReason(
  module: Module,
  plan: ExecutionPlan,
  states: ReadonlyMap<ModuleId, ModuleExecutionState>,
): string | null {
  const missing = plan.missingDependencies.get(module.id);
  if (missing?.length) return `missing prerequisite: ${missing.join(", ")}`;
  for (const dependency of module.dependsOn) {
    const state = states.get(dependency);
    if (!state) return `missing prerequisite: ${dependency}`;
    if (state.status !== "succeeded")
      return `prerequisite ${dependency} is ${state.status}`;
  }
  return null;
}

function missingRequirementReason(
  requirements: readonly ModuleRequirement[],
): string | null {
  for (const requirement of requirements) {
    if (requirement.kind === "environment") {
      const present = requirement.keys.map((key) =>
        Boolean(process.env[key]?.trim()),
      );
      const ok =
        requirement.mode === "any"
          ? present.some(Boolean)
          : present.every(Boolean);
      if (!ok) {
        return (
          requirement.description ??
          `required configuration unavailable: ${requirement.keys.join(requirement.mode === "any" ? " or " : ", ")}`
        );
      }
    } else {
      let available = false;
      try {
        available = requirement.available();
      } catch {
        available = false;
      }
      if (!available) {
        return (
          requirement.description ??
          `required capability unavailable: ${requirement.id}`
        );
      }
    }
  }
  return null;
}

function assertSchema(
  schema: JSONSchemaSubset,
  value: unknown,
  label: string,
  path = "$",
  errors: string[] = [],
): void {
  if (
    schema.enum &&
    !schema.enum.some((candidate) => Object.is(candidate, value))
  ) {
    errors.push(`${path} must be one of ${schema.enum.map(String).join(", ")}`);
  }
  if (schema.type && !matchesType(schema.type, value)) {
    errors.push(`${path} must be ${schema.type}`);
  } else if (
    schema.type === "object" &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record)
        assertSchema(child, record[key], label, `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(record)) {
        if (!(key in schema.properties))
          errors.push(`${path}.${key} is not allowed`);
      }
    }
  } else if (schema.type === "array" && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path} must contain at most ${schema.maxItems} items`);
    if (schema.items)
      value.forEach((item, index) =>
        assertSchema(schema.items!, item, label, `${path}[${index}]`, errors),
      );
  } else if (schema.type === "string" && typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path} is too long`);
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value))
          errors.push(`${path} does not match ${schema.pattern}`);
      } catch {
        errors.push(`${path} has an invalid schema pattern`);
      }
    }
  } else if (schema.type === "number" && typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path} must be finite`);
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path} must be <= ${schema.maximum}`);
  }
  if (path === "$" && errors.length > 0)
    throw new TypeError(`${label} contract violation: ${errors.join("; ")}`);
}

function matchesType(
  type: NonNullable<JSONSchemaSubset["type"]>,
  value: unknown,
): boolean {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

async function boundedMap<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await task(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function finalStatus(
  states: ReadonlyMap<ModuleId, ModuleExecutionState>,
  flags: { aborted: boolean; timedOut: boolean; hasInconclusive: boolean },
): ComposerResult["status"] {
  if (flags.aborted) return "cancelled";
  const leafStates = [...states.entries()]
    .filter(([id]) => id !== CRAWL_MODULE_ID)
    .map(([, state]) => state);
  const succeeded = leafStates.filter(
    (state) => state.status === "succeeded",
  ).length;
  const failed = leafStates.filter((state) => state.status === "failed").length;
  const crawlFailed = states.get(CRAWL_MODULE_ID)?.status === "failed";
  const incomplete = leafStates.some((state) =>
    ["failed", "skipped", "cancelled", "queued"].includes(state.status),
  );
  if ((failed > 0 || crawlFailed) && succeeded === 0) return "failed";
  if (incomplete || flags.timedOut || flags.hasInconclusive) return "partial";
  return "succeeded";
}

function baseState(
  module: Module,
  states: ReadonlyMap<ModuleId, ModuleExecutionState>,
): ModuleExecutionState {
  return (
    states.get(module.id) ?? {
      moduleId: module.id,
      version: module.version,
      status: "queued",
      attempts: 0,
    }
  );
}

function addMissingDependency(
  target: Map<ModuleId, string[]>,
  id: ModuleId,
  dependency: string,
): void {
  const values = target.get(id) ?? [];
  if (!values.includes(dependency)) values.push(dependency);
  target.set(id, values);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
