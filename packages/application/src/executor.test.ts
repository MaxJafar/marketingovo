import { Type, type TSchema } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type {
  ExecutionPlan,
  LeafModuleRegistry,
  Requirement,
  SeoModule,
} from "@golem-seo/contracts";
import {
  executePlan,
  executionStatus,
  type NodeExecutionResult,
} from "./executor.js";

function leaf(
  id: string,
  run: SeoModule<unknown, unknown>["run"],
  options: {
    inputSchema?: TSchema;
    outputSchema?: TSchema;
    requirements?: readonly Requirement[];
    version?: string;
  } = {},
): SeoModule<unknown, unknown> {
  return {
    kind: "leaf",
    id,
    version: options.version ?? "1.2.3",
    inputSchema: options.inputSchema ?? Type.Object({}),
    outputSchema:
      options.outputSchema ?? Type.Object({}, { additionalProperties: true }),
    requirements: options.requirements ?? [],
    run,
  };
}

function registry(
  ...modules: SeoModule<unknown, unknown>[]
): LeafModuleRegistry {
  return new Map(modules.map((module) => [module.id, module]));
}

describe("executePlan", () => {
  it("runs topological layers through a bounded pool and exposes prior node results", async () => {
    let active = 0;
    let peak = 0;
    const order: string[] = [];
    const transitions: NodeExecutionResult[] = [];
    const makeRoot = (id: string) =>
      leaf(id, async (_input, context) => {
        expect(context.runId).toBe("run-123");
        active += 1;
        peak = Math.max(peak, active);
        order.push(`${id}:start`);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        order.push(`${id}:end`);
        return { id };
      });
    const join = leaf(
      "join",
      async (_input, context) => {
        expect(context.getResult<{ id: string }>("a")).toEqual({ id: "a" });
        expect(context.getResult<{ id: string }>("b")).toEqual({ id: "b" });
        order.push("join");
        return { coverage: 0.75 };
      },
      {
        outputSchema: Type.Object({ coverage: Type.Number() }),
        requirements: [
          { id: "a", kind: "module" },
          { id: "b", kind: "module" },
        ],
      },
    );
    const plan: ExecutionPlan = {
      workflowId: "audit",
      nodes: [
        { id: "root-a", moduleId: "a", dependsOn: [], input: {} },
        { id: "root-b", moduleId: "b", dependsOn: [], input: {} },
        {
          id: "joined",
          moduleId: "join",
          dependsOn: ["root-a", "root-b"],
          input: {},
        },
      ],
    };

    const result = await executePlan(
      plan,
      registry(makeRoot("a"), makeRoot("b"), join),
      {
        concurrency: 2,
        runId: "run-123",
        onNodeStateChange: (state) => transitions.push(state),
      },
    );

    expect(peak).toBe(2);
    expect(order.indexOf("join")).toBeGreaterThan(order.indexOf("a:end"));
    expect(order.indexOf("join")).toBeGreaterThan(order.indexOf("b:end"));
    expect(result.map((entry) => entry.status)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
    ]);
    expect(result[2]).toMatchObject({ version: "1.2.3", coverage: 0.75 });
    expect(result[2]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(
      transitions
        .filter((entry) => entry.nodeId === "joined")
        .map((entry) => entry.status),
    ).toEqual(["queued", "running", "succeeded"]);
    expect(executionStatus(result)).toBe("succeeded");
  });

  it("marks missing configuration skipped and propagates skipped prerequisites", async () => {
    const sourceRun = vi.fn(async () => ({}));
    const dependentRun = vi.fn(async () => ({}));
    const source = leaf("source", sourceRun, {
      requirements: [{ id: "gsc", kind: "integration" }],
    });
    const dependent = leaf("dependent", dependentRun, {
      requirements: [{ id: "source", kind: "module" }],
    });
    const plan: ExecutionPlan = {
      workflowId: "audit",
      nodes: [
        { id: "source-node", moduleId: "source", dependsOn: [], input: {} },
        {
          id: "dependent-node",
          moduleId: "dependent",
          dependsOn: ["source-node"],
          input: {},
        },
      ],
    };

    const result = await executePlan(plan, registry(source, dependent), {
      concurrency: 2,
      resolveRequirement: () => ({
        available: false,
        reason: "GSC is not connected",
      }),
    });

    expect(result[0]).toMatchObject({
      status: "skipped",
      skipReason: "GSC is not connected",
    });
    expect(result[1]).toMatchObject({ status: "skipped" });
    expect(result[1]?.skipReason).toContain("source-node:skipped");
    expect(result[0]?.error).toBeUndefined();
    expect(executionStatus(result)).toBe("partial");
    expect(sourceRun).not.toHaveBeenCalled();
    expect(dependentRun).not.toHaveBeenCalled();
  });

  it("does not let an unavailable optional requirement block execution", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const module = leaf("optional", run, {
      requirements: [{ id: "trends", kind: "integration", optional: true }],
    });
    const result = await executePlan(
      {
        workflowId: "audit",
        nodes: [
          {
            id: "optional-node",
            moduleId: "optional",
            dependsOn: [],
            input: {},
          },
        ],
      },
      registry(module),
      {
        concurrency: 1,
        resolveRequirement: () => false,
      },
    );

    expect(result[0]?.status).toBe("succeeded");
    expect(run).toHaveBeenCalledOnce();
  });

  it("validates every module input and output at runtime", async () => {
    const invalidInputRun = vi.fn(async () => ({ value: "ok" }));
    const invalidOutputRun = vi.fn(async () => ({ value: 42 }));
    const inputModule = leaf("input", invalidInputRun, {
      inputSchema: Type.Object({ url: Type.String() }),
      outputSchema: Type.Object({ value: Type.String() }),
    });
    const outputModule = leaf("output", invalidOutputRun, {
      outputSchema: Type.Object({ value: Type.String() }),
    });
    const result = await executePlan(
      {
        workflowId: "audit",
        nodes: [
          { id: "bad-input", moduleId: "input", dependsOn: [], input: {} },
          { id: "bad-output", moduleId: "output", dependsOn: [], input: {} },
        ],
      },
      registry(inputModule, outputModule),
      { concurrency: 2 },
    );

    expect(result[0]).toMatchObject({
      status: "failed",
      version: "1.2.3",
      error: "Module input failed runtime schema validation",
    });
    expect(result[1]).toMatchObject({
      status: "failed",
      version: "1.2.3",
      error: "Module output failed runtime schema validation",
    });
    expect(result[1]?.startedAt).toBeTruthy();
    expect(result[1]?.completedAt).toBeTruthy();
    expect(invalidInputRun).not.toHaveBeenCalled();
    expect(invalidOutputRun).toHaveBeenCalledOnce();
  });

  it("cancels in-flight and not-yet-started nodes without publishing their output", async () => {
    const controller = new AbortController();
    const secondRun = vi.fn(async () => ({ ok: true }));
    const first = leaf("first", async () => {
      controller.abort(new Error("test cancellation"));
      return { ok: true };
    });
    const second = leaf("second", secondRun);
    const result = await executePlan(
      {
        workflowId: "audit",
        nodes: [
          { id: "first-node", moduleId: "first", dependsOn: [], input: {} },
          { id: "second-node", moduleId: "second", dependsOn: [], input: {} },
        ],
      },
      registry(first, second),
      { concurrency: 1, signal: controller.signal },
    );

    expect(result.map((entry) => entry.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(result[0]?.output).toBeUndefined();
    expect(secondRun).not.toHaveBeenCalled();
    expect(executionStatus(result)).toBe("cancelled");
  });

  it("rejects malformed, cyclic, and recursively scheduled plans before side effects", async () => {
    const run = vi.fn(async () => ({}));
    const module = leaf("leaf", run);
    await expect(
      executePlan(
        {
          workflowId: "audit",
          nodes: [
            { id: "same", moduleId: "leaf", dependsOn: [], input: {} },
            { id: "same", moduleId: "leaf", dependsOn: [], input: {} },
          ],
        },
        registry(module),
        { concurrency: 1 },
      ),
    ).rejects.toThrow(/duplicate node/);
    await expect(
      executePlan(
        {
          workflowId: "audit",
          nodes: [
            { id: "a", moduleId: "leaf", dependsOn: ["b"], input: {} },
            { id: "b", moduleId: "leaf", dependsOn: ["a"], input: {} },
          ],
        },
        registry(module),
        { concurrency: 1 },
      ),
    ).rejects.toThrow(/cycle/);
    await expect(
      executePlan(
        {
          workflowId: "audit",
          nodes: [
            { id: "recursive", moduleId: "audit", dependsOn: [], input: {} },
          ],
        },
        registry(module),
        { concurrency: 1 },
      ),
    ).rejects.toThrow(/cannot be scheduled/);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses forged workflow entries in a leaf registry", async () => {
    const run = vi.fn(async () => ({}));
    const forged = {
      ...leaf("forged", run),
      kind: "workflow",
    } as unknown as SeoModule<unknown, unknown>;
    const result = await executePlan(
      {
        workflowId: "audit",
        nodes: [
          { id: "forged-node", moduleId: "forged", dependsOn: [], input: {} },
        ],
      },
      registry(forged),
      { concurrency: 1 },
    );

    expect(result[0]).toMatchObject({
      status: "failed",
      error: "Leaf module is not registered",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("fails invalid coverage metadata instead of persisting a false value", async () => {
    const module = leaf("coverage", async () => ({ coverage: 1.1 }), {
      outputSchema: Type.Object({ coverage: Type.Number() }),
    });
    const result = await executePlan(
      {
        workflowId: "audit",
        nodes: [
          {
            id: "coverage-node",
            moduleId: "coverage",
            dependsOn: [],
            input: {},
          },
        ],
      },
      registry(module),
      { concurrency: 1 },
    );

    expect(result[0]).toMatchObject({ status: "failed" });
    expect(result[0]?.error).toMatch(/coverage.*between 0 and 1/);
  });

  it("never reports a terminal workflow status from non-terminal node state", () => {
    expect(() =>
      executionStatus([
        {
          nodeId: "crawl",
          moduleId: "crawl",
          version: "1.0.0",
          status: "running",
        },
      ]),
    ).toThrow(/non-terminal/);
  });
});
