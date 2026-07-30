import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@agentseoapp/contracts";
import { AgentSeoLocalRuntime } from "@agentseoapp/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("issue review API", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-issue-review-api-")),
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
      "x-agentseo-client": "dashboard",
    };
    const project = await runtime.projects.create({
      name: "Issue review",
      canonicalUrl: "https://example.com",
    });
    const run = runtime.database.insertRun({
      id: "issue-api-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const at = "2026-07-15T12:00:00.000Z";
    const issue: IssueInstance = {
      fingerprint: "d".repeat(64),
      ruleId: "duplicate-dom-id",
      moduleId: "html-quality",
      canonicalUrl: "https://example.com/product",
      severity: "high",
      title: "Duplicate DOM id",
      description: "The same DOM id appears more than once.",
      evidence: [
        {
          kind: "dom",
          label: "Repeated id",
          value: "buy-button",
          source: "static-crawl",
          observedAt: at,
        },
      ],
      firstSeenAt: at,
      lastSeenAt: at,
      status: "open",
    };
    runtime.database.replaceIssues(run.id, project.id, [issue]);
    const action: Action = {
      id: "duplicate-id-action",
      projectId: project.id,
      ruleId: issue.ruleId,
      moduleId: issue.moduleId,
      issueFingerprint: issue.fingerprint,
      title: "Make DOM ids unique",
      whyNow: "Duplicate ids can break labels and client-side targeting.",
      impact: 0.7,
      effort: "low",
      confidence: 0.9,
      priorityScore: 75,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["gsc", "ga4"],
      },
      affectedUrls: [issue.canonicalUrl!],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: at,
      updatedAt: at,
    };
    runtime.database.upsertActions([action]);
    return {
      runtime,
      server,
      project,
      issue,
      canonicalHeaders,
      dashboardHeaders,
    };
  }

  it("lists evidence with bounded filters and persists a dashboard review", async () => {
    const { server, project, issue, canonicalHeaders, dashboardHeaders } =
      await setup();

    const missingProject = await server.app.inject({
      method: "GET",
      url: "/api/v1/issues",
      headers: canonicalHeaders,
    });
    expect(missingProject.statusCode).toBe(400);
    expect(missingProject.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const listed = await server.app.inject({
      method: "GET",
      url: `/api/v1/issues?siteId=${project.id}&status=open&search=duplicate&limit=20&offset=0`,
      headers: dashboardHeaders,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      data: {
        total: 1,
        offset: 0,
        limit: 20,
        items: [
          {
            issue: {
              fingerprint: issue.fingerprint,
              status: "open",
              evidence: [{ label: "Repeated id", value: "buy-button" }],
            },
            occurrenceCount: 1,
            adjudication: null,
          },
        ],
      },
      meta: { state: "fresh" },
    });

    const updated = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/issues/${issue.fingerprint}`,
      headers: dashboardHeaders,
      payload: {
        projectId: project.id,
        status: "false_positive",
        note: "The repeated node is inside inert template markup.",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      data: {
        issue: { status: "false_positive" },
        adjudication: {
          status: "false_positive",
          note: "The repeated node is inside inert template markup.",
        },
      },
    });

    const canonical = await server.app.inject({
      method: "GET",
      url: `/api/v1/issues?projectId=${project.id}&status=false_positive`,
      headers: canonicalHeaders,
    });
    expect(canonical.statusCode).toBe(200);
    expect(canonical.json()).toMatchObject({
      total: 1,
      items: [{ issue: { status: "false_positive" } }],
    });

    const actions = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions?projectId=${project.id}`,
      headers: canonicalHeaders,
    });
    expect(actions.statusCode).toBe(200);
    expect(actions.json()).toEqual([]);
  });

  it("uses problem details and never reflects a rejected secret-like note", async () => {
    const { server, project, issue, canonicalHeaders } = await setup();

    const missingNote = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/issues/${issue.fingerprint}`,
      headers: canonicalHeaders,
      payload: { projectId: project.id, status: "ignored" },
    });
    expect(missingNote.statusCode).toBe(422);
    expect(missingNote.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(missingNote.json()).toMatchObject({
      code: "adjudication_note_required",
    });

    const canary = "super-secret-provider-value";
    const secretNote = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/issues/${issue.fingerprint}`,
      headers: canonicalHeaders,
      payload: {
        projectId: project.id,
        status: "ignored",
        note: `apiKey=${canary}`,
      },
    });
    expect(secretNote.statusCode).toBe(422);
    expect(secretNote.json()).toMatchObject({
      code: "secret_material_rejected",
    });
    expect(secretNote.body).not.toContain(canary);
  });

  it("publishes both review routes in OpenAPI", async () => {
    const { server, canonicalHeaders } = await setup();
    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers: canonicalHeaders,
    });
    const paths = (response.json() as { paths: Record<string, unknown> }).paths;
    expect(paths["/api/v1/issues"]).toBeDefined();
    expect(paths["/api/v1/issues/{fingerprint}"]).toBeDefined();
  });
});
