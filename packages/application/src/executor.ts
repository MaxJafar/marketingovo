import { Value } from "@sinclair/typebox/value";
import type {
  ExecutionNode,
  ExecutionPlan,
  LeafModuleRegistry,
  ModuleStatus,
  Requirement,
  SeoModule,
} from "@agentseoapp/contracts";

export interface NodeExecutionResult {
  nodeId: string;
  moduleId: string;
  /** Exact module implementation version used for this node. */
  version?: string;
  status: ModuleStatus;
  output?: unknown;
  error?: string;
  skipReason?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  /** Normalized measured coverage. Missing coverage stays unavailable. */
  coverage?: number;
}

export type RequirementAvailability =
  boolean | { available: boolean; reason?: string };

export interface ExecutePlanOptions {
  concurrency: number;
  /** The concrete run id. A workflow id is not a run id. */
  runId?: string;
  signal?: AbortSignal;
  /** Resolve integration and capability requirements without exposing secrets. */
  resolveRequirement?: (
    requirement: Requirement,
    module: SeoModule<unknown, unknown>,
  ) => Promise<RequirementAvailability> | RequirementAvailability;
  /** @deprecated Prefer resolveRequirement for an explicit per-requirement reason. */
  requirementsAvailable?: (
    module: SeoModule<unknown, unknown>,
  ) => Promise<RequirementAvailability> | RequirementAvailability;
  /** Override how a normalized 0..1 coverage value is read from module output. */
  readCoverage?: (
    module: SeoModule<unknown, unknown>,
    output: unknown,
  ) => number | undefined;
  /** Persist or stream every queued, running, and terminal node transition. */
  onNodeStateChange?: (state: NodeExecutionResult) => void;
}

function validatePlan(plan: ExecutionPlan): ReadonlyMap<string, ExecutionNode> {
  if (!plan.workflowId.trim())
    throw new Error("Execution plan workflowId is required");
  const nodes = new Map<string, ExecutionNode>();
  for (const node of plan.nodes) {
    if (!node.id.trim()) throw new Error("Execution node id is required");
    if (!node.moduleId.trim())
      throw new Error(`Execution node '${node.id}' moduleId is required`);
    if (nodes.has(node.id))
      throw new Error(`Execution plan contains duplicate node id '${node.id}'`);
    if (node.moduleId === plan.workflowId) {
      throw new Error(
        `Workflow '${plan.workflowId}' cannot be scheduled as a leaf node`,
      );
    }
    if (node.dependsOn.includes(node.id)) {
      throw new Error(`Execution node '${node.id}' cannot depend on itself`);
    }
    nodes.set(node.id, node);
  }
  for (const node of plan.nodes) {
    for (const dependency of node.dependsOn) {
      if (!nodes.has(dependency)) {
        throw new Error(
          `Execution node '${node.id}' has unknown dependency '${dependency}'`,
        );
      }
    }
  }
  return nodes;
}

function planLayers(
  plan: ExecutionPlan,
  nodes: ReadonlyMap<string, ExecutionNode>,
): string[][] {
  const remaining = new Set(nodes.keys());
  const complete = new Set<string>();
  const layers: string[][] = [];
  while (remaining.size > 0) {
    const layer = [...remaining].filter((id) =>
      nodes.get(id)!.dependsOn.every((dependency) => complete.has(dependency)),
    );
    if (layer.length === 0) {
      throw new Error("Execution plan contains a dependency cycle");
    }
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
      complete.add(id);
    }
  }
  return layers;
}

async function pooledMap<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const count = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: count }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]!);
      }
    }),
  );
  return results;
}

function availability(value: RequirementAvailability): {
  available: boolean;
  reason?: string;
} {
  return typeof value === "boolean" ? { available: value } : value;
}

async function unavailableRequirementReason(
  node: ExecutionNode,
  module: SeoModule<unknown, unknown>,
  nodes: ReadonlyMap<string, ExecutionNode>,
  results: ReadonlyMap<string, NodeExecutionResult>,
  options: ExecutePlanOptions,
): Promise<string | null> {
  if (options.requirementsAvailable) {
    try {
      const resolved = availability(
        await options.requirementsAvailable(module),
      );
      if (!resolved.available)
        return resolved.reason ?? "Required configuration is unavailable";
    } catch (error) {
      return `Requirement check failed: ${errorMessage(error)}`;
    }
  }

  for (const requirement of module.requirements) {
    if (requirement.kind === "module") {
      const prerequisite = node.dependsOn.find(
        (dependencyId) => nodes.get(dependencyId)?.moduleId === requirement.id,
      );
      const prerequisiteSucceeded = prerequisite
        ? results.get(prerequisite)?.status === "succeeded"
        : false;
      if (!prerequisiteSucceeded && !requirement.optional) {
        return prerequisite
          ? `Module prerequisite '${requirement.id}' did not succeed`
          : `Module prerequisite '${requirement.id}' is not declared in dependsOn`;
      }
      continue;
    }

    if (!options.resolveRequirement) {
      if (!requirement.optional) {
        return `${requirement.kind} requirement '${requirement.id}' was not resolved`;
      }
      continue;
    }
    try {
      const resolved = availability(
        await options.resolveRequirement(requirement, module),
      );
      if (!resolved.available && !requirement.optional) {
        return (
          resolved.reason ??
          `${requirement.kind} requirement '${requirement.id}' is unavailable`
        );
      }
    } catch (error) {
      if (!requirement.optional) {
        return `Requirement '${requirement.id}' check failed: ${errorMessage(error)}`;
      }
    }
  }
  return null;
}

function coverageFromOutput(
  module: SeoModule<unknown, unknown>,
  output: unknown,
  options: ExecutePlanOptions,
): number | undefined {
  const value = options.readCoverage
    ? options.readCoverage(module, output)
    : output && typeof output === "object" && "coverage" in output
      ? (output as { coverage?: unknown }).coverage
      : undefined;
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new TypeError(
      `Module '${module.id}' coverage must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function cancelled(
  node: ExecutionNode,
  module?: SeoModule<unknown, unknown>,
): NodeExecutionResult {
  return {
    nodeId: node.id,
    moduleId: node.moduleId,
    ...(module ? { version: module.version } : {}),
    status: "cancelled",
  };
}

export async function executePlan(
  plan: ExecutionPlan,
  registry: LeafModuleRegistry,
  options: ExecutePlanOptions,
): Promise<NodeExecutionResult[]> {
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) {
    throw new RangeError(
      "Execution concurrency must be a positive safe integer",
    );
  }
  const nodes = validatePlan(plan);
  const layers = planLayers(plan, nodes);
  const results = new Map<string, NodeExecutionResult>();
  const outputs = new Map<string, unknown>();
  const notify = (state: NodeExecutionResult): NodeExecutionResult => {
    options.onNodeStateChange?.(state);
    return state;
  };

  for (const node of plan.nodes) {
    const module = registry.get(node.moduleId);
    notify({
      nodeId: node.id,
      moduleId: node.moduleId,
      ...(module?.kind === "leaf" ? { version: module.version } : {}),
      status: "queued",
    });
  }

  for (const layer of layers) {
    if (options.signal?.aborted) break;
    const layerResults = await pooledMap(
      layer,
      options.concurrency,
      async (nodeId) => {
        const node = nodes.get(nodeId)!;
        const module = registry.get(node.moduleId);
        if (options.signal?.aborted) return notify(cancelled(node, module));
        if (!module || module.kind !== "leaf") {
          return notify({
            nodeId,
            moduleId: node.moduleId,
            status: "failed",
            error: "Leaf module is not registered",
          } satisfies NodeExecutionResult);
        }

        const blockedDependencies = node.dependsOn.filter(
          (dependency) => results.get(dependency)?.status !== "succeeded",
        );
        if (blockedDependencies.length > 0) {
          const summary = blockedDependencies
            .map(
              (dependency) =>
                `${dependency}:${results.get(dependency)?.status ?? "missing"}`,
            )
            .join(", ");
          return notify({
            nodeId,
            moduleId: module.id,
            version: module.version,
            status: "skipped",
            skipReason: `Prerequisite node did not succeed (${summary})`,
          } satisfies NodeExecutionResult);
        }

        const requirementReason = await unavailableRequirementReason(
          node,
          module,
          nodes,
          results,
          options,
        );
        if (requirementReason) {
          return notify({
            nodeId,
            moduleId: module.id,
            version: module.version,
            status: "skipped",
            skipReason: requirementReason,
          } satisfies NodeExecutionResult);
        }
        if (!Value.Check(module.inputSchema, node.input)) {
          return notify({
            nodeId,
            moduleId: module.id,
            version: module.version,
            status: "failed",
            error: "Module input failed runtime schema validation",
          } satisfies NodeExecutionResult);
        }

        const startedAt = new Date().toISOString();
        const started = performance.now();
        notify({
          nodeId,
          moduleId: module.id,
          version: module.version,
          status: "running",
          startedAt,
        });
        try {
          const output = await module.run(node.input, {
            runId: options.runId ?? plan.workflowId,
            signal: options.signal ?? new AbortController().signal,
            pass: 1,
            isFollowUp: false,
            getResult: <T>(id: string) => outputs.get(id) as T | undefined,
          });
          if (options.signal?.aborted) {
            return notify({
              ...cancelled(node, module),
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: performance.now() - started,
            });
          }
          if (!Value.Check(module.outputSchema, output)) {
            throw new Error("Module output failed runtime schema validation");
          }
          const coverage = coverageFromOutput(module, output, options);
          // ModuleContext is intentionally keyed by leaf module id, not by the
          // executor's internal node id. This keeps module prerequisites stable
          // when a workflow renames its nodes.
          outputs.set(module.id, output);
          return notify({
            nodeId,
            moduleId: module.id,
            version: module.version,
            status: "succeeded",
            output,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: performance.now() - started,
            ...(coverage === undefined ? {} : { coverage }),
          } satisfies NodeExecutionResult);
        } catch (error) {
          return notify({
            nodeId,
            moduleId: module.id,
            version: module.version,
            status: options.signal?.aborted ? "cancelled" : "failed",
            error: errorMessage(error),
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: performance.now() - started,
          } satisfies NodeExecutionResult);
        }
      },
    );
    for (const result of layerResults) results.set(result.nodeId, result);
  }

  for (const node of plan.nodes) {
    if (!results.has(node.id)) {
      results.set(
        node.id,
        notify(cancelled(node, registry.get(node.moduleId))),
      );
    }
  }
  return plan.nodes.map((node) => results.get(node.id)!);
}

/** Aggregate terminal node states into the public workflow status contract. */
export function executionStatus(
  results: readonly NodeExecutionResult[],
): "succeeded" | "partial" | "failed" | "cancelled" {
  const nonTerminal = results.find(
    (result) => result.status === "queued" || result.status === "running",
  );
  if (nonTerminal) {
    throw new Error(
      `Cannot summarize non-terminal node '${nonTerminal.nodeId}' (${nonTerminal.status})`,
    );
  }
  if (results.some((result) => result.status === "cancelled"))
    return "cancelled";
  const succeeded = results.filter(
    (result) => result.status === "succeeded",
  ).length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter(
    (result) => result.status === "skipped",
  ).length;
  if (failed > 0 && succeeded === 0) return "failed";
  if (failed > 0 || skipped > 0) return "partial";
  return "succeeded";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
