import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectContextProfile } from "@marketingovo/contracts";
import { AgentSeoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

const contextProfile: ProjectContextProfile = {
  summary: "Turn search evidence into verified improvements.",
  audiences: ["Hands-on SEO leads"],
  markets: ["United States", "United Kingdom"],
  languages: ["English"],
  conversionGoals: ["Qualified demo request"],
  priorityTopics: ["Technical SEO automation"],
  competitors: ["example-competitor.com"],
  constraints: ["Legal review for comparative claims"],
};

describe("project context API", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-context-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const canonicalHeaders = {
      host: HOST,
      authorization: `Bearer ${token}`,
    };
    const dashboardHeaders = {
      ...canonicalHeaders,
      "x-marketingovo-client": "dashboard",
    };
    const project = await runtime.projects.create({
      name: "Context API",
      canonicalUrl: "https://example.com",
    });
    const run = runtime.database.insertRun({
      id: "context-api-run",
      projectId: project.id,
      workflowId: "audit",
    });
    return {
      runtime,
      server,
      project,
      run,
      canonicalHeaders,
      dashboardHeaders,
    };
  }

  it("serves canonical and dashboard envelopes for versioned profiles and append-only entries", async () => {
    const { server, project, run, canonicalHeaders, dashboardHeaders } =
      await setup();

    const empty = await server.app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/context`,
      headers: dashboardHeaders,
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({
      data: { projectId: project.id, current: null, history: [], journal: [] },
      meta: { state: "missing" },
    });

    const updated = await server.app.inject({
      method: "PUT",
      url: `/api/v1/projects/${project.id}/context`,
      headers: dashboardHeaders,
      payload: {
        profile: contextProfile,
        changeSummary: "Established the shared SEO brief",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      data: {
        projectId: project.id,
        current: {
          revision: 1,
          profile: { markets: ["United States", "United Kingdom"] },
          changeSummary: "Established the shared SEO brief",
        },
      },
      meta: { state: "fresh" },
    });

    const appended = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/context/journal`,
      headers: canonicalHeaders,
      payload: {
        kind: "decision",
        title: "Prioritize verifiable fixes",
        detail: "Require a baseline and a repeat audit before claiming impact.",
        sourceRunId: run.id,
      },
    });
    expect(appended.statusCode).toBe(201);
    expect(appended.json()).toMatchObject({
      projectId: project.id,
      sequence: 1,
      kind: "decision",
      sourceRunId: run.id,
      actor: "local-user",
    });

    const canonical = await server.app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/context`,
      headers: canonicalHeaders,
    });
    expect(canonical.statusCode).toBe(200);
    expect(canonical.json()).toMatchObject({
      current: { revision: 1 },
      history: [{ revision: 1 }],
      journal: [{ sequence: 1, sourceRunId: run.id }],
    });
  });

  it("uses problem details without reflecting rejected secrets or cross-project evidence", async () => {
    const { runtime, server, project, canonicalHeaders } = await setup();
    const other = await runtime.projects.create({
      name: "Other API project",
      canonicalUrl: "https://other.example.com",
    });
    const foreignRun = runtime.database.insertRun({
      id: "foreign-context-api-run",
      projectId: other.id,
      workflowId: "audit",
    });

    const canary = "super-secret-provider-value";
    const unsafe = await server.app.inject({
      method: "PUT",
      url: `/api/v1/projects/${project.id}/context`,
      headers: canonicalHeaders,
      payload: {
        profile: { ...contextProfile, summary: `apiKey=${canary}` },
        changeSummary: "Attempted unsafe context",
      },
    });
    expect(unsafe.statusCode).toBe(422);
    expect(unsafe.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(unsafe.json()).toMatchObject({
      code: "secret_material_rejected",
      status: 422,
    });
    expect(unsafe.body).not.toContain(canary);

    const foreign = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/context/journal`,
      headers: canonicalHeaders,
      payload: {
        kind: "observation",
        title: "Foreign run reference",
        detail: "This source run belongs to another project.",
        sourceRunId: foreignRun.id,
      },
    });
    expect(foreign.statusCode).toBe(422);
    expect(foreign.json()).toMatchObject({ code: "invalid_source_run" });

    const missing = await server.app.inject({
      method: "GET",
      url: "/api/v1/projects/missing/context",
      headers: canonicalHeaders,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "project_not_found" });
  });

  it("publishes all three context operations in OpenAPI", async () => {
    const { server, canonicalHeaders } = await setup();
    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers: canonicalHeaders,
    });
    const paths = (response.json() as { paths: Record<string, unknown> }).paths;
    expect(paths["/api/v1/projects/{id}/context"]).toMatchObject({
      get: expect.any(Object),
      put: expect.any(Object),
    });
    expect(paths["/api/v1/projects/{id}/context/journal"]).toMatchObject({
      post: expect.any(Object),
    });
  });
});
