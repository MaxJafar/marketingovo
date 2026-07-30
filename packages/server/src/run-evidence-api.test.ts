import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSeoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

describe("run evidence API", () => {
  const servers: LocalServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-run-evidence-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: "127.0.0.1:3210",
      authorization: `Bearer ${token}`,
    };
    const project = await runtime.projects.create({
      name: "Evidence API",
      canonicalUrl: "https://example.com/",
    });
    const run = runtime.database.insertRun({
      id: "run-evidence-api",
      projectId: project.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(run.id, {
      status: "succeeded",
      startedAt: "2026-07-15T12:00:00.000Z",
      completedAt: "2026-07-15T12:01:00.000Z",
      progress: 1,
    });
    runtime.database.replacePages(run.id, [
      {
        canonicalUrl: "https://example.com/new",
        statusCode: 200,
        title: "New page",
        indexable: true,
        payload: {
          evidenceVersion: 1,
          sourceUrl: "https://example.com/old",
          crawlDepth: 1,
          discoveredFrom: "https://example.com/",
          redirectChain: ["https://example.com/new"],
          hreflang: null,
          extractions: [],
        },
      },
    ]);
    return { runtime, server, run, headers };
  }

  it("returns paginated canonical and dashboard evidence without fake sitemap zeros", async () => {
    const { server, run, headers } = await setup();
    const canonical = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${run.id}/evidence?section=redirects&limit=1&offset=0`,
      headers,
    });
    expect(canonical.statusCode).toBe(200);
    expect(canonical.json()).toMatchObject({
      runId: run.id,
      state: "partial",
      section: "redirects",
      items: [
        {
          kind: "redirect",
          chain: ["https://example.com/old", "https://example.com/new"],
        },
      ],
      pageInfo: { total: 1, offset: 0, limit: 1, nextOffset: null },
      sitemap: {
        state: "not_captured",
        declaredUrls: null,
        discoveredIndexableUrls: null,
        matchedIndexableUrls: null,
      },
    });

    const dashboard = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${run.id}/evidence?section=crawl`,
      headers: { ...headers, "x-marketingovo-client": "dashboard" },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      data: { runId: run.id, section: "crawl" },
      meta: { state: "stale" },
    });
  });

  it("rejects unknown sections and publishes the route in OpenAPI", async () => {
    const { server, run, headers } = await setup();
    const invalid = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${run.id}/evidence?section=unknown&unexpected=yes`,
      headers,
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await server.app.inject({
      method: "GET",
      url: "/api/v1/runs/missing/evidence",
      headers,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const openapi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers,
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths).toHaveProperty("/api/v1/runs/{id}/evidence");
  });
});
