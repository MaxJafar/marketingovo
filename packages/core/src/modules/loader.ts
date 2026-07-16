// Module loader / registry.
//
// Walks src/modules/*/index.ts (or a configured root), imports each
// module or workflow, validates it against the appropriate contract,
// and exposes two disjoint registries. The composer receives only leaf
// modules; workflows can create plans but can never be scheduled as leaves.

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Module, ModuleId, Workflow, WorkflowId } from "./types.js";

export interface LoadResult {
  readonly ok: boolean;
  readonly modules: readonly Module[];
  readonly workflows: readonly Workflow[];
  readonly errors: ReadonlyArray<{ path: string; error: string }>;
}

/**
 * Walk `root` for subdirectories that contain an `index.ts` (or
 * `index.js`), dynamic-import each one, and collect the `default` (or
 * named `module`) export as a Module instance, or the named workflow export
 * as a Workflow instance.
 *
 * Validation:
 * - id, version, displayName, category, description required (non-empty)
 * - inputSchema, outputSchema must be objects
 * - dependsOn entries must be valid ModuleId strings
 * - configKeys entries must be strings
 * - invoke must be a function
 * - selfTest must be a function
 *
 * Invalid modules are reported in the errors array; loading does
 * not throw so a single broken module doesn't block the rest.
 */
export async function loadModules(
  root: string = defaultRoot(),
): Promise<LoadResult> {
  const errors: Array<{ path: string; error: string }> = [];
  const modules: Module[] = [];
  const workflows: Workflow[] = [];

  if (!existsSync(root)) {
    return {
      ok: false,
      modules,
      workflows,
      errors: [{ path: root, error: "modules root not found" }],
    };
  }

  const entries = readdirSync(root, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  );

  for (const entry of entries) {
    const dir = join(root, entry.name);
    // Walk one level deep: integrations/ -> integrations/gsc/, etc.
    const subEntries = readdirSync(dir, { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    );
    if (subEntries.length > 0) {
      // Parent directory has sub-dirs: this is a namespace (e.g. integrations/).
      // Walk each sub-dir and load its module. The export is the
      // camelCased sub-dir name + "Module" (e.g. gsc/ -> gscModule).
      for (const sub of subEntries) {
        const subDir = join(dir, sub.name);
        const indexFile = findIndexFile(subDir);
        if (!indexFile) continue;
        const stem = kebabToCamel(sub.name);
        await loadOne(
          indexFile,
          `${stem}Module`,
          `${stem}Workflow`,
          entry.name + "/" + sub.name,
          modules,
          workflows,
          errors,
        );
      }
      continue;
    }
    const indexFile = findIndexFile(dir);
    if (!indexFile) continue; // skip empty dirs (process/ is a placeholder)
    const stem = kebabToCamel(entry.name);
    await loadOne(
      indexFile,
      `${stem}Module`,
      `${stem}Workflow`,
      entry.name,
      modules,
      workflows,
      errors,
    );
  }

  // Cross-module validation: detect duplicate ids, unknown dependsOn.
  // Duplicate ids and self-deps are hard errors. Unknown dependsOn
  // entries are reported as warnings — the module is still loaded
  // because partial module sets (e.g. mid-migration, dev iteration)
  // are common and the composer will skip them at schedule time.
  const seen = new Set<ModuleId>();
  for (const m of modules) {
    if (seen.has(m.id)) {
      errors.push({
        path: `module:${m.id}`,
        error: `duplicate module id: ${m.id}`,
      });
    }
    seen.add(m.id);
  }
  const seenWorkflows = new Set<WorkflowId>();
  for (const workflow of workflows) {
    if (seenWorkflows.has(workflow.id)) {
      errors.push({
        path: `workflow:${workflow.id}`,
        error: `duplicate workflow id: ${workflow.id}`,
      });
    }
    seenWorkflows.add(workflow.id);
    if ([...seen].some((id) => id === workflow.id)) {
      errors.push({
        path: `workflow:${workflow.id}`,
        error: `id is registered as both module and workflow: ${workflow.id}`,
      });
    }
  }
  for (const m of modules) {
    for (const dep of m.dependsOn) {
      if (dep === m.id) {
        errors.push({
          path: `module:${m.id}`,
          error: `module depends on itself: ${dep}`,
        });
        continue;
      }
      // `crawl` is the executor's built-in prerequisite, not a loadable leaf.
      if (dep === "crawl") continue;
      if (!seen.has(dep)) {
        // Soft warning: not added to errors[] so result.ok stays true.
        // eslint-disable-next-line no-console
        console.warn(`[agentseo] module ${m.id} has unknown dependsOn: ${dep}`);
      }
    }
  }

  return { ok: errors.length === 0, modules, workflows, errors };
}

function defaultRoot(): string {
  // Resolve relative to this file's location so the loader works
  // both from src/ and dist/ after compilation.
  // src/modules/loader.ts -> src/modules
  return resolve(dirname(new URL(import.meta.url).pathname));
}

async function loadOne(
  indexFile: string,
  moduleExportName: string,
  workflowExportName: string,
  dirName: string,
  modules: Module[],
  workflows: Workflow[],
  errors: Array<{ path: string; error: string }>,
): Promise<void> {
  try {
    const mod = await import(pathToFileURL(indexFile).href);
    const moduleCandidate: Module | undefined =
      mod.default ?? mod.module ?? mod[moduleExportName];
    const workflowCandidate: Workflow | undefined =
      mod.workflow ?? mod[workflowExportName];
    if (moduleCandidate && workflowCandidate) {
      errors.push({
        path: indexFile,
        error: "a registry entry cannot export both a module and a workflow",
      });
      return;
    }
    if (workflowCandidate) {
      const validationError = validateWorkflow(workflowCandidate, dirName);
      if (validationError) {
        errors.push({ path: indexFile, error: validationError });
        return;
      }
      workflows.push(workflowCandidate);
      return;
    }
    if (moduleCandidate) {
      const validationError = validateModule(moduleCandidate, dirName);
      if (validationError) {
        errors.push({ path: indexFile, error: validationError });
        return;
      }
      modules.push(moduleCandidate);
      return;
    }
    errors.push({
      path: indexFile,
      error: `no default/module/${moduleExportName} or workflow/${workflowExportName} export`,
    });
  } catch (err) {
    errors.push({ path: indexFile, error: (err as Error).message });
  }
}

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function findIndexFile(dir: string): string | null {
  for (const name of ["index.ts", "index.js", "index.mjs"]) {
    const p = join(dir, name);
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function validateModule(m: Module, dirName: string): string | null {
  if (m.kind !== undefined && m.kind !== "leaf") {
    return `module in ${dirName}: invalid kind ${String(m.kind)}`;
  }
  if (!m.id || typeof m.id !== "string")
    return `module in ${dirName}: missing id`;
  if (!m.version || typeof m.version !== "string")
    return `module ${m.id}: missing version`;
  if (!m.displayName || typeof m.displayName !== "string")
    return `module ${m.id}: missing displayName`;
  if (
    !m.category ||
    !["tool", "integration", "research", "process"].includes(m.category)
  )
    return `module ${m.id}: invalid category ${m.category}`;
  if (!m.description || typeof m.description !== "string")
    return `module ${m.id}: missing description`;
  if (!m.inputSchema || typeof m.inputSchema !== "object")
    return `module ${m.id}: inputSchema must be an object`;
  if (!m.outputSchema || typeof m.outputSchema !== "object")
    return `module ${m.id}: outputSchema must be an object`;
  if (!Array.isArray(m.dependsOn))
    return `module ${m.id}: dependsOn must be an array`;
  if (!Array.isArray(m.configKeys))
    return `module ${m.id}: configKeys must be an array`;
  if (typeof m.invoke !== "function")
    return `module ${m.id}: invoke must be a function`;
  if (typeof m.selfTest !== "function")
    return `module ${m.id}: selfTest must be a function`;
  return null;
}

function validateWorkflow(workflow: Workflow, dirName: string): string | null {
  if (workflow.kind !== "workflow") {
    return `workflow in ${dirName}: kind must be workflow`;
  }
  if (!workflow.id || typeof workflow.id !== "string")
    return `workflow in ${dirName}: missing id`;
  if (!workflow.version || typeof workflow.version !== "string") {
    return `workflow ${workflow.id}: missing version`;
  }
  if (!workflow.displayName || typeof workflow.displayName !== "string") {
    return `workflow ${workflow.id}: missing displayName`;
  }
  if (workflow.category !== "process") {
    return `workflow ${workflow.id}: invalid category ${workflow.category}`;
  }
  if (!workflow.description || typeof workflow.description !== "string") {
    return `workflow ${workflow.id}: missing description`;
  }
  if (!workflow.inputSchema || typeof workflow.inputSchema !== "object") {
    return `workflow ${workflow.id}: inputSchema must be an object`;
  }
  if (!workflow.outputSchema || typeof workflow.outputSchema !== "object") {
    return `workflow ${workflow.id}: outputSchema must be an object`;
  }
  if (typeof workflow.createPlan !== "function") {
    return `workflow ${workflow.id}: createPlan must be a function`;
  }
  return null;
}

/** Lookup a module by id. Returns undefined if not found. */
export function findModule(
  modules: readonly Module[],
  id: ModuleId,
): Module | undefined {
  return modules.find((m) => m.id === id);
}

/** Lookup a workflow by id. Returns undefined if not found. */
export function findWorkflow(
  workflows: readonly Workflow[],
  id: WorkflowId,
): Workflow | undefined {
  return workflows.find((workflow) => workflow.id === id);
}

/** Filter modules by category. */
export function filterByCategory(
  modules: readonly Module[],
  category: Module["category"],
): Module[] {
  return modules.filter((m) => m.category === category);
}

/**
 * Topological order respecting dependsOn.
 *
 * Tolerant: unknown dependsOn entries (deps not in the input list) are
 * skipped with a warning, because partial module sets are common
 * (e.g. user runs only `audit_full --modules onpage,technical`, and
 * `crawl` is the synthetic underlying dependency that the composer
 * injects automatically). Cycles throw — those are programmer errors.
 */
export function topoSort(modules: readonly Module[]): Module[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const visited = new Set<ModuleId>();
  const onStack = new Set<ModuleId>();
  const out: Module[] = [];
  const skipped: ModuleId[] = [];

  const visit = (id: ModuleId, path: ModuleId[]): void => {
    if (visited.has(id)) return;
    if (onStack.has(id)) {
      throw new Error(`dependency cycle: ${[...path, id].join(" -> ")}`);
    }
    const m = byId.get(id);
    if (!m) {
      if (id === "crawl") return;
      if (!skipped.includes(id)) skipped.push(id);
      return;
    }
    onStack.add(id);
    for (const dep of m.dependsOn) {
      visit(dep, [...path, id]);
    }
    onStack.delete(id);
    visited.add(id);
    out.push(m);
  };

  for (const m of modules) {
    visit(m.id, []);
  }
  if (skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[agentseo] topoSort: skipped ${skipped.length} unknown dep(s): ${skipped.join(", ")}`,
    );
  }
  return out;
}
