import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSeoLocalRuntime } from "@agentseoapp/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

function replayEngine() {
  return {
    crawl: async (input: Record<string, unknown>) => ({
      runId: "replay-engine-run",
      report: {
        generatedAt: new Date().toISOString(),
        startUrl: String(input.startUrl),
        durationMs: 1,
        config: { maxUrls: 1, maxRuntimeMs: 1_000, requestsPerSecond: 1 },
        summary: {
          pagesCrawled: 0,
          issuesByPriority: { High: 0, Medium: 0, Low: 0 },
          issuesByCategory: {},
        },
        issues: [],
        pages: [],
        topUrls: [],
      },
    }),
    reportToJson: (value: unknown) => JSON.stringify(value),
    reportToHtml: () => "<!doctype html><title>Replay</title>",
    reportToCsv: () => "url,status\n",
  } as never;
}

describe("run replay API", () => {
  const servers: LocalServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-run-replay-api-")),
      engine: replayEngine(),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: "127.0.0.1:3210",
      authorization: `Bearer ${token}`,
    };
    const project = await runtime.projects.create({
      name: "Replay API",
      canonicalUrl: "https://example.com/",
    });
    const source = runtime.database.insertRun({
      id: "run-replay-source",
      projectId: project.id,
      workflowId: "audit",
      options: {
        renderMode: "js",
        exactUrls: ["https://example.com/", "https://example.com/pricing"],
      },
    });
    runtime.database.updateRun(source.id, {
      status: "succeeded",
      startedAt: "2026-07-15T12:00:00.000Z",
      completedAt: "2026-07-15T12:01:00.000Z",
      progress: 1,
    });
    return { runtime, server, source, headers };
  }

  it("queues one canonical and dashboard replay while preserving the source", async () => {
    const { runtime, server, source, headers } = await setup();
    const original = await runtime.runs.get(source.id);
    const originalOptions = runtime.database.getRunOptions(source.id);
    const request = {
      method: "POST" as const,
      url: `/api/v1/runs/${source.id}/replay`,
      headers: { ...headers, "idempotency-key": "api-replay-request" },
    };

    const canonical = await server.app.inject(request);
    const repeated = await server.app.inject(request);
    expect(canonical.statusCode).toBe(202);
    expect(canonical.json()).toMatchObject({
      sourceRunId: source.id,
      configurationVersion: 1,
      configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      run: { projectId: source.projectId, workflowId: "audit" },
    });
    expect(repeated.statusCode).toBe(202);
    expect(repeated.json().run.id).toBe(canonical.json().run.id);
    expect(runtime.database.getRunOptions(canonical.json().run.id)).toEqual(
      originalOptions,
    );
    expect(await runtime.runs.get(source.id)).toEqual(original);

    const dashboard = await server.app.inject({
      method: "POST",
      url: `/api/v1/runs/${source.id}/replay`,
      headers: {
        ...headers,
        "idempotency-key": "dashboard-replay-request",
        "x-agentseo-client": "dashboard",
      },
    });
    expect(dashboard.statusCode).toBe(202);
    expect(dashboard.json()).toMatchObject({
      data: {
        sourceRunId: source.id,
        configurationVersion: 1,
        run: { status: "queued", trigger: "manual" },
      },
      meta: { state: "fresh" },
    });
  });

  it("uses Problem Details for invalid sources and publishes the operation", async () => {
    const { runtime, server, source, headers } = await setup();
    const missingKey = await server.app.inject({
      method: "POST",
      url: `/api/v1/runs/${source.id}/replay`,
      headers,
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const active = runtime.database.insertRun({
      id: "active-replay-source",
      projectId: source.projectId,
      workflowId: "audit",
    });
    const conflict = await server.app.inject({
      method: "POST",
      url: `/api/v1/runs/${active.id}/replay`,
      headers: { ...headers, "idempotency-key": "active-replay-request" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      code: "source_run_not_terminal",
    });

    const missing = await server.app.inject({
      method: "POST",
      url: "/api/v1/runs/missing/replay",
      headers: { ...headers, "idempotency-key": "missing-replay-request" },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "source_run_not_found" });

    const openapi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers,
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths).toHaveProperty("/api/v1/runs/{id}/replay");
  });
});
