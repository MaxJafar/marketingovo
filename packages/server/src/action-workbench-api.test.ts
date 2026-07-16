import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Action,
  ActionService,
  IssueInstance,
} from "@golem-seo/contracts";
import { GolemLocalRuntime } from "@golem-seo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const OBSERVED_AT = "2026-07-15T09:00:00.000Z";

describe("action workbench API", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-action-workbench-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const serviceHeaders = {
      host: HOST,
      authorization: `Bearer ${token}`,
    };
    const headers = {
      ...serviceHeaders,
      "x-golem-client": "dashboard",
    };
    const project = await runtime.projects.create({
      name: "Action evidence fixture",
      canonicalUrl: "https://example.com",
    });
    return { runtime, server, project, headers, serviceHeaders };
  }

  function seedAction(
    runtime: GolemLocalRuntime,
    projectId: string,
    options: { successfulBaseline?: boolean } = {},
  ) {
    const urls = [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ];
    const run = runtime.database.insertRun({
      id: `baseline-${projectId}`,
      projectId,
      workflowId: "audit",
    });
    if (options.successfulBaseline !== false) {
      runtime.database.updateRun(run.id, {
        status: "succeeded",
        startedAt: OBSERVED_AT,
        completedAt: OBSERVED_AT,
        progress: 1,
        issueCount: urls.length,
      });
    }
    const issues: IssueInstance[] = urls.map((url, index) => ({
      fingerprint: String(index + 1).repeat(64),
      ruleId: "canonical-missing",
      moduleId: "onpage",
      canonicalUrl: url,
      severity: "high",
      title: `Canonical missing on page ${index + 1}`,
      description: "The page has no canonical declaration.",
      evidence: [
        {
          kind: "html",
          label: "Canonical element absent",
          value: { selector: 'link[rel="canonical"]', present: false },
          source: "crawler",
          observedAt: OBSERVED_AT,
        },
      ],
      firstSeenAt: OBSERVED_AT,
      lastSeenAt: OBSERVED_AT,
      status: "open",
    }));
    runtime.database.replacePages(
      run.id,
      urls.map((canonicalUrl, index) => ({
        canonicalUrl,
        statusCode: index === 0 ? 200 : null,
        title: index === 0 ? "Page A" : null,
        indexable: index === 0 ? true : null,
      })),
    );
    runtime.database.replaceIssues(run.id, projectId, issues);
    const action: Action = {
      id: `action-${projectId}`,
      projectId,
      ruleId: "canonical-missing",
      moduleId: "onpage",
      issueFingerprint: issues[0]!.fingerprint,
      title: "Add canonical declarations",
      whyNow: "Three indexable landing pages send ambiguous canonical signals.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 84,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["organic_exposure", "conversion_exposure"],
      },
      affectedUrls: urls,
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: OBSERVED_AT,
      updatedAt: OBSERVED_AT,
    };
    runtime.database.upsertActions([action]);
    runtime.database.replaceActionIssueLinks(
      run.id,
      projectId,
      [action],
      issues,
    );
    return { action, issues, run, urls };
  }

  it("requires authentication and returns 404 for unknown action evidence", async () => {
    const { server, headers } = await setup();
    const unauthenticated = await server.app.inject({
      method: "GET",
      url: "/api/v1/actions/missing/evidence",
      headers: { host: HOST },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const evidence = await server.app.inject({
      method: "GET",
      url: "/api/v1/actions/missing/evidence",
      headers,
    });
    expect(evidence.statusCode).toBe(404);
    expect(evidence.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const checkpoint = await server.app.inject({
      method: "POST",
      url: "/api/v1/actions/missing/checkpoints",
      headers,
      payload: {},
    });
    expect(checkpoint.statusCode).toBe(404);
  });

  it("paginates opaque URL evidence and preserves unavailable values and raw evidence", async () => {
    const { runtime, server, project, headers } = await setup();
    const { action, urls } = seedAction(runtime, project.id);

    const first = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/evidence?limit=1`,
      headers,
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.data.action).toMatchObject({
      id: action.id,
      moduleId: "onpage",
      ruleId: "canonical-missing",
      verification: "pending",
      scoreInputs: {
        organicExposure: null,
        conversionExposure: null,
      },
      affectedUrlList: urls,
    });
    expect(firstBody.data.summary).toMatchObject({
      totalUrls: 3,
      clicks: null,
      impressions: null,
      keyEvents: null,
    });
    expect(firstBody.data.verification).toEqual({
      state: "not_started",
      checkpointId: null,
      runId: null,
      coverage: null,
      checkedAt: null,
      reason: null,
    });
    expect(firstBody.data.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crawl",
          status: "healthy",
          availability: "fresh",
          coverage: 100,
        }),
        expect.objectContaining({
          id: "google-search-console",
          status: "offline",
          availability: "unavailable",
          coverage: null,
        }),
      ]),
    );
    expect(firstBody.data.urls).toHaveLength(1);
    expect(firstBody.data.urls[0]).toMatchObject({
      gsc: null,
      ga4: null,
      issue: {
        evidence: [
          {
            kind: "html",
            label: "Canonical element absent",
            value: {
              selector: 'link[rel="canonical"]',
              present: false,
            },
            source: "crawler",
            observedAt: OBSERVED_AT,
          },
        ],
      },
    });
    expect(firstBody.data.pageInfo).toMatchObject({ total: 3 });
    expect(firstBody.data.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(firstBody.data.pageInfo.nextCursor).not.toContain(
      firstBody.data.urls[0].url,
    );
    expect(firstBody.data).not.toHaveProperty("outcomes");
    expect(firstBody.data.action).not.toHaveProperty("projectId");
    expect(firstBody.data.urls[0].issue).not.toHaveProperty("moduleId");

    const second = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/evidence?limit=1&cursor=${encodeURIComponent(firstBody.data.pageInfo.nextCursor)}`,
      headers,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.urls[0].url).not.toBe(firstBody.data.urls[0].url);

    for (const limit of [0, 101]) {
      const invalid = await server.app.inject({
        method: "GET",
        url: `/api/v1/actions/${action.id}/evidence?limit=${limit}`,
        headers,
      });
      expect(invalid.statusCode).toBe(400);
    }
  });

  it("returns malformed opaque cursors as a client error", async () => {
    const { runtime, server, project, headers } = await setup();
    const { action } = seedAction(runtime, project.id);
    const response = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/evidence?cursor=not-a-valid-cursor`,
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "invalid_action_evidence_cursor",
    });
  });

  it("creates a durable checkpoint and serializes pending outcomes without fake zeros", async () => {
    const { runtime, server, project, headers } = await setup();
    const { action, run } = seedAction(runtime, project.id);

    const created = await server.app.inject({
      method: "POST",
      url: `/api/v1/actions/${action.id}/checkpoints`,
      headers,
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    expect(Object.keys(created.json().data).sort()).toEqual([
      "createdAt",
      "id",
      "state",
    ]);
    expect(created.json().data).toMatchObject({ state: "active" });

    const persisted = runtime.database.latestActionCheckpoint(action.id);
    expect(persisted).toMatchObject({
      id: created.json().data.id,
      actionId: action.id,
      baselineRunId: run.id,
      targetUrls: action.affectedUrls,
    });

    const outcomes = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/outcomes`,
      headers,
    });
    expect(outcomes.statusCode).toBe(200);
    expect(outcomes.json().data).toMatchObject({ total: 3 });
    expect(outcomes.json().data.items).toHaveLength(3);
    expect(outcomes.json().data.items[0]).toMatchObject({
      state: "pending",
      period: null,
      targetChange: null,
      controlChange: null,
      controlAdjustedChange: null,
      confidence: null,
      observedAt: null,
    });
  });

  it("returns 409 when an action has no successful audit baseline", async () => {
    const { runtime, server, project, headers } = await setup();
    const { action } = seedAction(runtime, project.id, {
      successfulBaseline: false,
    });
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/actions/${action.id}/checkpoints`,
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "checkpoint_baseline_unavailable",
    });
  });

  it("serves canonical raw evidence, checkpoints, and outcomes to SDK clients", async () => {
    const { runtime, server, project, serviceHeaders } = await setup();
    const { action, run } = seedAction(runtime, project.id);

    const evidence = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/evidence?limit=2`,
      headers: serviceHeaders,
    });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json()).toMatchObject({
      action: {
        id: action.id,
        projectId: project.id,
        ruleId: action.ruleId,
        moduleId: action.moduleId,
      },
      outcomes: [],
      pageInfo: { total: 3 },
    });
    expect(evidence.json()).not.toHaveProperty("data");

    const checkpoint = await server.app.inject({
      method: "POST",
      url: `/api/v1/actions/${action.id}/checkpoints`,
      headers: serviceHeaders,
      payload: {},
    });
    expect(checkpoint.statusCode).toBe(201);
    expect(checkpoint.json()).toMatchObject({
      actionId: action.id,
      projectId: project.id,
      baselineRunId: run.id,
      state: "active",
    });
    expect(checkpoint.json()).not.toHaveProperty("data");

    const rawOutcomes = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions/${action.id}/outcomes`,
      headers: serviceHeaders,
    });
    expect(rawOutcomes.statusCode).toBe(200);
    expect(rawOutcomes.json()).toHaveLength(3);
    expect(rawOutcomes.json()[0]).toMatchObject({
      checkpointId: checkpoint.json().id,
      state: "pending",
    });
  });

  it("requires a valid idempotency header and preserves runtime idempotence across clients", async () => {
    const { runtime, server, project, headers, serviceHeaders } = await setup();
    const { action } = seedAction(runtime, project.id);
    const checkpoint = await runtime.actions.createCheckpoint(action.id);
    expect(checkpoint).not.toBeNull();

    const actionService = runtime.actions as unknown as ActionService;
    const verify = vi
      .spyOn(actionService, "verify")
      .mockImplementation(async (_actionId, _checkpointId, key) => ({
        runId: `verification-${key}`,
        verificationState: "queued" as const,
      }));
    for (const idempotencyKey of [undefined, "short"]) {
      const invalid = await server.app.inject({
        method: "POST",
        url: `/api/v1/actions/${action.id}/verify`,
        headers: {
          ...serviceHeaders,
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        payload: { checkpointId: checkpoint!.id },
      });
      expect(invalid.statusCode).toBe(400);
    }
    expect(verify).not.toHaveBeenCalled();

    const idempotencyKey = "same-verification-request";
    const raw = await server.app.inject({
      method: "POST",
      url: `/api/v1/actions/${action.id}/verify`,
      headers: { ...serviceHeaders, "idempotency-key": idempotencyKey },
      payload: { checkpointId: checkpoint!.id },
    });
    expect(raw.statusCode).toBe(202);
    expect(raw.json()).toEqual({
      runId: `verification-${idempotencyKey}`,
      verificationState: "queued",
    });

    const dashboard = await server.app.inject({
      method: "POST",
      url: `/api/v1/actions/${action.id}/verify`,
      headers: { ...headers, "idempotency-key": idempotencyKey },
      payload: { checkpointId: checkpoint!.id },
    });
    expect(dashboard.statusCode).toBe(202);
    expect(dashboard.json().data).toEqual(raw.json());
    expect(verify).toHaveBeenNthCalledWith(
      1,
      action.id,
      checkpoint!.id,
      idempotencyKey,
    );
    expect(verify).toHaveBeenNthCalledWith(
      2,
      action.id,
      checkpoint!.id,
      idempotencyKey,
    );
  });

  it("maps verification lookup and runtime conflicts to problem details", async () => {
    const { runtime, server, project, serviceHeaders } = await setup();
    const { action } = seedAction(runtime, project.id);
    const verify = vi.spyOn(
      runtime.actions as unknown as ActionService,
      "verify",
    );
    const request = () =>
      server.app.inject({
        method: "POST",
        url: `/api/v1/actions/${action.id}/verify`,
        headers: {
          ...serviceHeaders,
          "idempotency-key": "verification-error-request",
        },
        payload: { checkpointId: "checkpoint-fixture" },
      });

    verify.mockResolvedValueOnce(null);
    const missing = await request();
    expect(missing.statusCode).toBe(404);

    verify.mockRejectedValueOnce(
      Object.assign(new Error("checkpoint mismatch"), {
        code: "checkpoint_action_mismatch",
      }),
    );
    const mismatch = await request();
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(mismatch.json()).toMatchObject({
      code: "checkpoint_action_mismatch",
    });

    verify.mockRejectedValueOnce(
      Object.assign(new Error("no targets"), {
        code: "verification_targets_unavailable",
      }),
    );
    const unavailable = await request();
    expect(unavailable.statusCode).toBe(422);
    expect(unavailable.json()).toMatchObject({
      code: "verification_targets_unavailable",
    });
  });

  it("publishes the verify and dual Action Workbench contracts in OpenAPI", async () => {
    const { server } = await setup();
    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(200);
    const paths = response.json().paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const verify = paths["/api/v1/actions/{id}/verify"]?.post;
    expect(verify).toBeDefined();
    expect(JSON.stringify(verify)).toContain("idempotency-key");
    expect(verify?.responses).toMatchObject({
      202: expect.any(Object),
      404: expect.any(Object),
      409: expect.any(Object),
      422: expect.any(Object),
    });
    for (const route of ["evidence", "checkpoints", "outcomes"]) {
      const operation =
        paths[`/api/v1/actions/{id}/${route}`]?.[
          route === "checkpoints" ? "post" : "get"
        ];
      expect(JSON.stringify(operation)).toContain("anyOf");
    }
  });
});
