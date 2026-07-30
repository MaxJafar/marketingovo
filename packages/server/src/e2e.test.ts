import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSeoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const ENGINE_CANARY = "api-response-canary-z9Y8x7W6";

describe("local API end-to-end", () => {
  const servers: LocalServer[] = [];
  afterEach(async () =>
    Promise.all(servers.splice(0).map((server) => server.close())),
  );

  it("creates, deduplicates, executes, reports, and exposes verified work through v1", async () => {
    const report = {
      generatedAt: "2026-07-15T09:00:00.000Z",
      startUrl: "https://example.com/",
      durationMs: 15,
      config: {
        maxUrls: 1,
        maxRuntimeMs: 30_000,
        requestsPerSecond: 1,
      },
      summary: {
        pagesCrawled: 1,
        issuesByPriority: { High: 1, Medium: 0, Low: 0 },
        issuesByCategory: { Technical: 1 },
      },
      issues: [
        {
          id: "canonical-missing",
          moduleId: "technical",
          category: "Technical",
          priority: "High" as const,
          message: `Add a canonical URL; provider apiKey=${ENGINE_CANARY}`,
          urls: ["https://example.com/"],
          fix: "Add one self-referencing canonical link.",
          detail: {
            apiKey: ENGINE_CANARY,
            nested: { authorization: `Bearer ${ENGINE_CANARY}` },
          },
        },
      ],
      pages: [
        {
          url: "https://example.com/",
          finalUrl: "https://example.com/",
          status: 200,
          title: "Example",
          contentType: "text/html",
          canonical: "https://example.com/",
          robotsMeta: null,
          xRobotsTag: null,
          robotsAllowed: true,
          htmlParsed: true,
          redirectChain: [],
          responseTimeMs: 15,
          error: null,
          vitals: null,
        },
      ],
      topUrls: [],
    };
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-server-e2e-")),
      engine: {
        crawl: async () => ({ report, runId: "engine-run" }),
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html><title>Marketingovo report</title>",
        reportToCsv: () => "url,status\nhttps://example.com/,200\n",
      },
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = { host: HOST, authorization: `Bearer ${token}` };

    const projectResponse = await server.app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers,
      payload: { name: "Example", canonicalUrl: "https://example.com" },
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json() as { id: string };

    const missingKey = await server.app.inject({
      method: "POST",
      url: "/api/v1/runs",
      headers,
      payload: { projectId: project.id, workflowId: "audit" },
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const start = () =>
      server.app.inject({
        method: "POST",
        url: "/api/v1/runs",
        headers: { ...headers, "idempotency-key": "same-request-key" },
        payload: { projectId: project.id, workflowId: "audit" },
      });
    const first = await start();
    const duplicate = await start();
    expect(first.statusCode).toBe(202);
    expect(duplicate.statusCode).toBe(202);
    const runId = (first.json() as { id: string }).id;
    expect((duplicate.json() as { id: string }).id).toBe(runId);

    let runStatus = "queued";
    for (
      let attempt = 0;
      attempt < 100 && !["succeeded", "partial", "failed"].includes(runStatus);
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const response = await server.app.inject({
        method: "GET",
        url: `/api/v1/runs/${runId}`,
        headers,
      });
      runStatus = (response.json() as { status: string }).status;
    }
    expect(runStatus).toBe("succeeded");

    const issues = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${runId}/issues`,
      headers,
    });
    expect(issues.json()).toEqual([
      expect.objectContaining({
        ruleId: "canonical-missing",
        severity: "high",
      }),
    ]);
    expect(issues.body).not.toContain(ENGINE_CANARY);
    const actions = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions?projectId=${project.id}`,
      headers,
    });
    expect(actions.json()).toEqual([
      expect.objectContaining({
        scoreVersion: "priority-v1",
        verification: "pending",
      }),
    ]);
    expect(actions.body).not.toContain(ENGINE_CANARY);
    const reportMediaTypes = {
      html: "text/html",
      pdf: "application/pdf",
      csv: "text/csv",
      json: "application/json",
    } as const;
    for (const [format, mediaType] of Object.entries(reportMediaTypes)) {
      const artifact = await server.app.inject({
        method: "GET",
        url: `/api/v1/runs/${runId}/report?format=${format}`,
        headers,
      });
      expect(artifact.statusCode).toBe(200);
      expect(artifact.headers["content-type"]).toContain(mediaType);
      expect(artifact.headers["content-disposition"]).toBe(
        `attachment; filename=\"marketingovo-${runId}.${format}\"`,
      );
      expect(artifact.rawPayload.byteLength).toBeGreaterThan(20);
      expect(artifact.rawPayload.includes(Buffer.from(ENGINE_CANARY))).toBe(
        false,
      );
      if (format === "json") {
        expect(artifact.body).toContain("canonical-missing");
      }
    }

    const exported = await server.app.inject({
      method: "POST",
      url: "/api/v1/export",
      headers,
      payload: { projectId: project.id },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toContain(
      "application/vnd.marketingovo.project+json",
    );
    expect(exported.json()).toMatchObject({
      format: "marketingovo-project",
      version: 2,
      secretsIncluded: false,
    });
    expect(exported.body).not.toContain(ENGINE_CANARY);

    const imported = await server.app.inject({
      method: "POST",
      url: "/api/v1/import",
      headers: {
        ...headers,
        "content-type": "application/vnd.marketingovo.project+json",
      },
      payload: exported.body,
    });
    expect(imported.statusCode, imported.body).toBe(201);
    expect(imported.json()).toMatchObject({
      sourceProjectId: project.id,
      schedulesDisabled: true,
      counts: { runs: 1, issues: 1, actions: 1 },
    });
    expect(imported.body).not.toContain(ENGINE_CANARY);
    expect(
      (imported.json() as { project: { id: string } }).project.id,
    ).not.toBe(project.id);

    const tamperedBundle = exported.json() as {
      project: { name: string };
    };
    tamperedBundle.project.name = "Tampered bundle";
    const rejected = await server.app.inject({
      method: "POST",
      url: "/api/v1/import",
      headers: {
        ...headers,
        "content-type": "application/vnd.marketingovo.project+json",
      },
      payload: tamperedBundle,
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(rejected.json()).toMatchObject({
      code: "bundle_checksum_mismatch",
      status: 400,
    });
  });

  it("rejects non-loopback Host headers before authentication", async () => {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-server-host-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "attacker.example" },
    });
    expect(response.statusCode).toBe(421);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      type: "urn:marketingovo:problem:invalid-host",
      status: 421,
      code: "invalid_host",
    });
  });
});
