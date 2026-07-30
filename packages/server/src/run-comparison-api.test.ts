import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSeoLocalRuntime } from "@agentseoapp/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

describe("run comparison API", () => {
  const servers: LocalServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-run-comparison-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: "127.0.0.1:3210",
      authorization: `Bearer ${token}`,
    };
    const project = await runtime.projects.create({
      name: "Comparison API",
      canonicalUrl: "https://example.com/",
    });
    const baseline = runtime.database.insertRun({
      id: "comparison-api-baseline",
      projectId: project.id,
      workflowId: "audit",
      options: { renderMode: "static" },
    });
    runtime.database.updateRun(baseline.id, {
      status: "succeeded",
      progress: 1,
      completedAt: "2026-07-16T09:00:00.000Z",
    });
    runtime.database.replacePages(baseline.id, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 200,
        title: "Home",
        indexable: true,
      },
    ]);
    const current = runtime.database.insertRun({
      id: "comparison-api-current",
      projectId: project.id,
      workflowId: "audit",
      options: { renderMode: "static" },
    });
    runtime.database.updateRun(current.id, {
      status: "succeeded",
      progress: 1,
      completedAt: "2026-07-16T10:00:00.000Z",
    });
    runtime.database.replacePages(current.id, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 404,
        title: "Not found",
        indexable: false,
      },
    ]);
    return { runtime, server, baseline, current, headers };
  }

  it("returns the canonical comparison and a dashboard envelope", async () => {
    const { server, baseline, current, headers } = await setup();
    const url = `/api/v1/runs/${current.id}/comparison?baselineRunId=${baseline.id}`;
    const canonical = await server.app.inject({ method: "GET", url, headers });
    expect(canonical.statusCode).toBe(200);
    expect(canonical.json()).toMatchObject({
      scoreVersion: "regression-v1",
      state: "available",
      baselineRun: { id: baseline.id },
      currentRun: { id: current.id },
      configuration: { state: "matched" },
      summary: {
        statusChanges: 1,
        indexabilityChanges: 1,
        regressionScore: 5,
      },
      linkGraph: {
        version: "link-delta-v1",
        state: "unavailable",
        baseline: { pageCount: 1, graphPageCount: 0, edgeCount: 0 },
        current: { pageCount: 1, graphPageCount: 0, edgeCount: 0 },
        summary: {
          addedEdges: 0,
          removedEdges: 0,
          changedEdges: 0,
          regressions: 0,
          improvements: 0,
        },
      },
    });

    const dashboard = await server.app.inject({
      method: "GET",
      url,
      headers: { ...headers, "x-agentseo-client": "dashboard" },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      data: {
        scoreVersion: "regression-v1",
        baselineRun: { id: baseline.id },
        currentRun: { id: current.id },
      },
      meta: { state: "fresh" },
    });
  });

  it("uses Problem Details for invalid pairs and publishes the operation", async () => {
    const { server, baseline, current, headers } = await setup();
    const same = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${current.id}/comparison?baselineRunId=${current.id}`,
      headers,
    });
    expect(same.statusCode).toBe(422);
    expect(same.headers["content-type"]).toContain("application/problem+json");
    expect(same.json()).toMatchObject({ code: "comparison_same_run" });

    const missingQuery = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${current.id}/comparison`,
      headers,
    });
    expect(missingQuery.statusCode).toBe(400);

    const missing = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/missing/comparison?baselineRunId=${baseline.id}`,
      headers,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "current_run_not_found" });

    const openapi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers,
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths).toHaveProperty("/api/v1/runs/{id}/comparison");
  });
});
