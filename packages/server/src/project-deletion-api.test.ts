import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GolemLocalRuntime } from "@agentseoapp/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("project deletion API", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-project-delete-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: HOST,
      authorization: `Bearer ${token}`,
    };
    const project = await runtime.projects.create({
      name: "Delete through API",
      canonicalUrl: "https://delete.example",
    });
    runtime.database.insertRun({
      id: "delete-api-run",
      projectId: project.id,
      workflowId: "audit",
    });
    return { runtime, server, project, headers };
  }

  it("requires an exact typed confirmation and returns a dashboard receipt", async () => {
    const { runtime, server, project, headers } = await setup();

    const mismatch = await server.app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.id}`,
      headers,
      payload: { confirmation: "delete through api" },
    });
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(mismatch.json()).toMatchObject({
      code: "project_confirmation_mismatch",
      status: 422,
    });
    expect(runtime.database.getProject(project.id)).not.toBeNull();

    const removed = await server.app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.id}`,
      headers: { ...headers, "x-golem-client": "dashboard" },
      payload: { confirmation: "Delete through API" },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({
      data: {
        projectId: project.id,
        counts: { runs: 1 },
        artifactCleanup: "complete",
        globalCredentialsRetained: true,
      },
      meta: { state: "fresh" },
    });
    expect(await runtime.projects.list()).toEqual([]);

    const repeated = await server.app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.id}`,
      headers,
      payload: { confirmation: "Delete through API" },
    });
    expect(repeated.statusCode).toBe(404);
    expect(repeated.json()).toMatchObject({ code: "project_not_found" });
  });

  it("publishes the destructive operation and strict body in OpenAPI", async () => {
    const { server, project, headers } = await setup();

    const invalid = await server.app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.id}`,
      headers,
      payload: { confirmation: "", unexpected: true },
    });
    expect(invalid.statusCode).toBe(400);

    const openapi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers,
    });
    const paths = (openapi.json() as { paths: Record<string, unknown> }).paths;
    expect(paths["/api/v1/projects/{id}"]).toMatchObject({
      delete: expect.any(Object),
    });
  });
});
