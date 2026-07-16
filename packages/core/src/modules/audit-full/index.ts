// audit-full workflow planning and execution.
//
// The workflow is deliberately not a Module. The loader places it in a
// workflow-only registry, createPlan can reference only leaf ModuleIds, and
// the composer receives only the leaf registry. This makes recursive workflow
// scheduling impossible by type and by registry construction.

import { runComposer, type ComposerResult } from "../../core/composer.js";
import type { Logger } from "../../core/logger.js";
import {
  newAuditRunId,
  saveAuditRun,
  signalToRecord,
  type AuditRun,
  type AuditRunStatus,
} from "../../core/audit-run.js";
import type {
  LeafModuleRegistry,
  ModuleContext,
  ModuleId,
  ModuleInput,
  ModuleOutput,
  Workflow,
  WorkflowExecutionPlan,
} from "../types.js";
import type { Limits } from "../../core/limits.js";

interface AuditFullInput {
  url: string;
  /** Subset of leaf module ids to run. Defaults to crawl-backed modules. */
  modules?: ModuleId[];
  /** Max composer passes. Default 1; max 3. */
  maxPasses?: number;
  /** Max runtime. Default 600_000 ms (10 min). */
  maxRuntimeMs?: number;
  /** Project root for persistence. Default: ctx.projectRoot. */
  projectRoot?: string;
  /** Caller-supplied notes (e.g. CI job name, batch id). */
  notes?: string;
}

interface AuditFullOutput {
  auditRunId: string;
  status: AuditRunStatus;
  startUrl: string;
  modules: ModuleId[];
  passes: number;
  issueCount: number;
  durationMs: number;
  /** Module ids that errored (not the same as "weak signal"). */
  errored: string[];
  skipped: string[];
  signal: Record<string, { weak: string[]; strong: string[] }>;
}

export interface AuditFullPlan extends WorkflowExecutionPlan {
  readonly workflowId: "audit-full";
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function validateOptionalInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): void {
  if (value === undefined) return;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new Error(
      `audit-full: input.${field} must be an integer from ${minimum} to ${maximum}`,
    );
  }
}

export const auditFullWorkflow: Workflow = {
  kind: "workflow",
  id: "audit-full",
  version: "0.11.0",
  displayName: "Audit (full)",
  category: "process",
  description:
    "One-shot audit workflow. Creates a leaf-only composer plan, injects a crawl, " +
    "runs modules in dependency order, aggregates issues, and persists an AuditRun. " +
    "Deep mode re-runs weak-signal modules with changed parameters.",
  inputSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "Start URL to audit." },
      modules: {
        type: "array",
        items: { type: "string" },
        description: 'Leaf module ids to run, e.g. ["onpage", "technical"].',
      },
      maxPasses: {
        type: "number",
        description:
          "Max composer passes. 1 = single-pass, up to 3 for deep mode.",
        minimum: 1,
        maximum: 3,
      },
      maxRuntimeMs: {
        type: "number",
        description: "Hard runtime cap in ms. Default 600_000 (10 min).",
        minimum: 1000,
      },
      projectRoot: {
        type: "string",
        description:
          "Project root for AuditRun persistence. Default: ctx.projectRoot.",
      },
      notes: {
        type: "string",
        description: "Caller-supplied notes (CI job, batch id, etc.).",
      },
    },
  },
  outputSchema: {
    type: "object",
    required: [
      "auditRunId",
      "status",
      "startUrl",
      "modules",
      "passes",
      "issueCount",
      "durationMs",
    ],
    properties: {
      auditRunId: { type: "string" },
      status: {
        type: "string",
        enum: ["succeeded", "partial", "failed", "cancelled"],
      },
      startUrl: { type: "string" },
      modules: { type: "array", items: { type: "string" } },
      passes: { type: "number" },
      issueCount: { type: "number" },
      durationMs: { type: "number" },
      errored: { type: "array", items: { type: "string" } },
      skipped: { type: "array", items: { type: "string" } },
      signal: { type: "object" },
    },
  },
  createPlan(input: ModuleInput, registry: LeafModuleRegistry): AuditFullPlan {
    const url = input["url"];
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new Error("audit-full: input.url is required");
    }

    const rawModules = input["modules"];
    if (rawModules !== undefined && !isStringArray(rawModules)) {
      throw new Error(
        "audit-full: input.modules must be an array of leaf module ids",
      );
    }
    if (rawModules?.includes("audit-full")) {
      throw new Error("audit-full: a workflow cannot schedule itself");
    }
    validateOptionalInteger(input["maxPasses"], "maxPasses", 1, 3);
    validateOptionalInteger(input["maxRuntimeMs"], "maxRuntimeMs", 1000);
    if (
      input["projectRoot"] !== undefined &&
      typeof input["projectRoot"] !== "string"
    ) {
      throw new Error("audit-full: input.projectRoot must be a string");
    }
    if (input["notes"] !== undefined && typeof input["notes"] !== "string") {
      throw new Error("audit-full: input.notes must be a string");
    }

    const requested = rawModules
      ? rawModules.map((id) => id as ModuleId)
      : [...registry.values()]
          .filter((module) => module.dependsOn.includes("crawl"))
          .map((module) => module.id);

    return {
      workflowId: "audit-full",
      input: { ...input, url, modules: requested },
      moduleIds: requested,
    };
  },
};

/** Plan and execute the audit-full workflow against an explicitly leaf-only registry. */
export async function executeAuditFullWorkflow(
  workflow: Workflow,
  input: ModuleInput,
  ctx: ModuleContext,
  registry: LeafModuleRegistry,
): Promise<ModuleOutput> {
  if (workflow.id !== auditFullWorkflow.id) {
    throw new Error(`audit-full executor received workflow ${workflow.id}`);
  }
  const plan = workflow.createPlan(input, registry) as AuditFullPlan;
  if (plan.workflowId !== auditFullWorkflow.id) {
    throw new Error(`audit-full: invalid plan workflow id ${plan.workflowId}`);
  }
  if ((plan.moduleIds as readonly string[]).includes(auditFullWorkflow.id)) {
    throw new Error("audit-full: a workflow cannot schedule itself");
  }

  const plannedInput = plan.input as unknown as AuditFullInput;
  const projectRoot: string = plannedInput.projectRoot ?? ctx.projectRoot;
  const limits: Limits = ctx.limits;
  const logger: Logger = ctx.logger;
  const requested = [...plan.moduleIds];

  // Persist the running record before side effects. A process crash therefore
  // leaves a recoverable running record instead of a false success.
  const auditRun: AuditRun = {
    id: newAuditRunId(),
    startUrl: plannedInput.url,
    modules: requested,
    requestedAt: new Date().toISOString(),
    status: "running",
    passes: 0,
    issueCount: 0,
    signal: {},
    notes: plannedInput.notes,
  };
  saveAuditRun(projectRoot, auditRun);

  let result: ComposerResult;
  try {
    result = await runComposer({
      startUrl: plannedInput.url,
      registry: [...registry.values()],
      modulesToRun: requested,
      limits,
      projectRoot,
      store: ctx.store,
      maxPasses: plannedInput.maxPasses,
      maxRuntimeMs: plannedInput.maxRuntimeMs,
      logger,
    });
  } catch (error) {
    const completed: AuditRun = {
      ...auditRun,
      completedAt: new Date().toISOString(),
      status: "failed",
      signal: signalToRecord(new Map()),
    };
    saveAuditRun(projectRoot, completed);
    throw error;
  }

  const final: AuditRun = {
    ...auditRun,
    completedAt: new Date().toISOString(),
    status: result.status,
    passes: result.passes,
    issueCount: result.issues.length,
    issues: result.issues.map((issue, index) => ({
      id: issue.id,
      category: issue.category,
      priority: issue.priority,
      message: issue.message,
      urls: [...issue.urls],
      detail: issue.detail,
      fix: issue.fix,
      moduleId: issue.moduleId as ModuleId | undefined,
      fingerprint: result.issueInstances[index]?.fingerprint,
      ruleId: issue.id,
      canonicalUrl: result.issueInstances[index]?.canonicalUrl,
    })),
    issueInstances: result.issueInstances,
    signal: signalToRecord(result.signal),
    durationMs: result.durationMs,
    errored: Object.fromEntries(result.errored),
  };
  saveAuditRun(projectRoot, final);

  const output: AuditFullOutput = {
    auditRunId: auditRun.id,
    status: final.status,
    startUrl: plannedInput.url,
    modules: requested,
    passes: result.passes,
    issueCount: result.issues.length,
    durationMs: result.durationMs,
    errored: [...result.errored.keys()],
    skipped: [...result.skipped.keys()],
    signal: final.signal,
  };
  logger.info("audit-full done", {
    auditRunId: auditRun.id,
    issues: result.issues.length,
    passes: result.passes,
  });
  return output as unknown as ModuleOutput;
}

export type { AuditRun, AuditRunStatus } from "../../core/audit-run.js";
export type { AuditFullInput, AuditFullOutput };
