import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("workspaces without a website", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-optional-website-api-"),
      ),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    return {
      runtime,
      server,
      headers: { host: HOST, authorization: `Bearer ${token}` },
    };
  }

  it("creates a workspace with no url and reports it as null", async () => {
    const { server, headers } = await setup();

    const created = await server.app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers,
      payload: { name: "Social only" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      name: "Social only",
      url: null,
    });

    // The pre-existing shape keeps working unchanged.
    const withUrl = await server.app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers,
      payload: { name: "Has a site", url: "https://has-a-site.example" },
    });
    expect(withUrl.statusCode).toBe(201);
    expect(withUrl.json().data.url).toBe("https://has-a-site.example/");
  });

  it("refuses an audit with a typed problem instead of queueing a doomed run", async () => {
    const { runtime, server, headers } = await setup();
    const workspace = await runtime.projects.create({ name: "No website" });

    const response = await server.app.inject({
      method: "POST",
      url: "/api/v1/runs",
      headers: { ...headers, "idempotency-key": "no-website-audit-1" },
      payload: { projectId: workspace.id, workflowId: "audit" },
    });
    expect(response.statusCode).toBe(422);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      code: "workspace_has_no_website",
      status: 422,
    });
    // Nothing was queued, so the workspace is not left holding a failed run.
    expect(runtime.database.listRuns(workspace.id)).toHaveLength(0);
  });

  it("reports website as an unavailable capability with a remedy", async () => {
    const { runtime, server, headers } = await setup();
    const workspace = await runtime.projects.create({ name: "No website" });

    const response = await server.app.inject({
      method: "GET",
      url: `/api/v1/projects/${workspace.id}/capabilities`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      available: string[];
      states: Array<{
        capability: string;
        available: boolean;
        reason: string;
        remedy: { label: string; href: string } | null;
      }>;
    };
    expect(body.available).not.toContain("website");
    const website = body.states.find(
      (state) => state.capability === "website",
    )!;
    expect(website.available).toBe(false);
    expect(website.reason).not.toBe("");
    expect(website.remedy).toMatchObject({ href: "/settings" });
  });

  it("attaches and detaches a website through settings", async () => {
    const { runtime, server, headers } = await setup();
    const workspace = await runtime.projects.create({ name: "Later" });

    const attached = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/settings?siteId=${workspace.id}`,
      headers,
      payload: { siteUrl: "https://later.example" },
    });
    expect(attached.statusCode).toBe(200);
    expect(attached.json().data.siteUrl).toBe("https://later.example/");

    const capabilities = await server.app.inject({
      method: "GET",
      url: `/api/v1/projects/${workspace.id}/capabilities`,
      headers,
    });
    expect(capabilities.json().available).toContain("website");

    const detached = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/settings?siteId=${workspace.id}`,
      headers,
      payload: { siteUrl: null },
    });
    expect(detached.statusCode).toBe(200);
    expect(detached.json().data.siteUrl).toBeNull();
    expect(runtime.database.getProject(workspace.id)?.name).toBe("Later");
  });
});
