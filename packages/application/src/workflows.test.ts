import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type { LeafModuleRegistry, SeoModule } from "@golem-seo/contracts";
import {
  createWorkflowPlan,
  createWorkflowRegistry,
  runtimeWorkflowIds,
  validateWorkflowOutput,
  workflowById,
} from "./workflows.js";

function leaf(id: string): SeoModule<unknown, unknown> {
  return {
    kind: "leaf",
    id,
    version: "1.0.0",
    inputSchema: Type.Object({}),
    outputSchema: Type.Unknown(),
    requirements: [],
    run: vi.fn(async () => ({})),
  };
}

function leafRegistry(): LeafModuleRegistry {
  const modules = [
    leaf("core-audit"),
    leaf("research-compare"),
    leaf("research-keyword-research"),
    leaf("research-content-plan"),
  ];
  return new Map(modules.map((module) => [module.id, module]));
}

describe("workflow registry", () => {
  it("exposes exactly the four runtime workflows in a registry separate from leaves", () => {
    const workflows = createWorkflowRegistry();
    expect([...workflows.keys()]).toEqual(runtimeWorkflowIds);
    for (const workflow of workflows.values()) {
      expect(workflow.kind).toBe("workflow");
      expect((workflow as unknown as { run?: unknown }).run).toBeUndefined();
    }
  });

  it("creates leaf-only plans through Workflow.createPlan", () => {
    const workflows = createWorkflowRegistry();
    const leaves = leafRegistry();
    const expected = new Map([
      ["audit", "core-audit"],
      ["compare", "research-compare"],
      ["keyword-research", "research-keyword-research"],
      ["content-plan", "research-content-plan"],
    ]);
    for (const id of runtimeWorkflowIds) {
      const workflow = workflowById(workflows, id);
      const plan = createWorkflowPlan(workflow, { options: {} }, leaves);
      expect(plan.workflowId).toBe(id);
      expect(plan.nodes).toHaveLength(1);
      expect(plan.nodes[0]?.moduleId).toBe(expected.get(id));
      expect(plan.nodes[0]?.moduleId).not.toBe(id);
    }
  });

  it("rejects invalid workflow input and missing leaf modules before execution", () => {
    const workflow = workflowById(createWorkflowRegistry(), "audit");
    expect(() => createWorkflowPlan(workflow, {}, leafRegistry())).toThrow(
      /input failed runtime schema validation/,
    );
    expect(() =>
      createWorkflowPlan(workflow, { options: {} }, new Map()),
    ).toThrow(/requires leaf module 'core-audit'/);
  });

  it("validates aggregate workflow output", () => {
    const workflow = workflowById(createWorkflowRegistry(), "audit");
    expect(() => validateWorkflowOutput(workflow, {})).toThrow(
      /output failed runtime schema validation/,
    );
    expect(() =>
      validateWorkflowOutput(workflow, {
        runId: "engine-run",
        coverage: 1,
        report: {
          generatedAt: "2026-07-15T00:00:00.000Z",
          startUrl: "https://example.com/",
          durationMs: 1,
          summary: {},
          issues: [],
          pages: [{ status: 200 }],
        },
      }),
    ).not.toThrow();
  });
});
