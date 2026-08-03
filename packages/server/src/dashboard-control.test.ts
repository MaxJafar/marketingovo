import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Action } from "@marketingovo/contracts";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("dashboard control panel API", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-dashboard-controls-"),
    );
    const runtime = new MarketingovoLocalRuntime({ dataDir });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: HOST,
      authorization: `Bearer ${token}`,
      "x-marketingovo-client": "dashboard",
    };
    const project = await runtime.projects.create({
      name: "Example",
      canonicalUrl: "https://example.com",
    });
    return { dataDir, runtime, server, project, headers };
  }

  function saveResearchArtifact(
    runtime: MarketingovoLocalRuntime,
    dataDir: string,
    runId: string,
    value: unknown,
  ) {
    const directory = join(dataDir, "artifacts", runId);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, "report.json");
    const bytes = Buffer.from(JSON.stringify(value));
    writeFileSync(path, bytes);
    runtime.database.saveArtifact({
      id: randomUUID(),
      runId,
      kind: "report.json",
      path,
      mediaType: "application/json",
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  it("persists marketer action status and returns the canonical state to the dashboard", async () => {
    const { runtime, server, project, headers } = await setup();
    const timestamp = new Date().toISOString();
    const action: Action = {
      id: "action-canonical",
      projectId: project.id,
      title: "Consolidate canonical URLs",
      whyNow: "Duplicate landing pages are splitting organic exposure.",
      impact: 0.8,
      effort: "medium",
      confidence: 0.8,
      priorityScore: 72,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.75,
        organicExposure: 0.8,
        conversionExposure: null,
        urlReach: 0.5,
        confidence: 0.8,
        unavailable: ["conversion_exposure"],
      },
      affectedUrls: ["https://example.com/landing"],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    runtime.database.upsertActions([action]);

    const updated = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/actions/${action.id}`,
      headers,
      payload: { status: "acknowledged" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: action.id,
      status: "acknowledged",
    });

    const listed = await server.app.inject({
      method: "GET",
      url: `/api/v1/actions?siteId=${project.id}`,
      headers,
    });
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.json().data.items[0]).toMatchObject({
      id: action.id,
      status: "acknowledged",
      confidence: 0.8,
    });
  });

  it("creates, edits, pauses, and deletes durable local schedules", async () => {
    const { server, project, headers } = await setup();
    const created = await server.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers,
      payload: {
        projectId: project.id,
        cron: "0 6 * * 1",
        timezone: "UTC",
        enabled: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const schedule = created.json() as { id: string; nextRunAt: string };
    expect(new Date(schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now());

    const edited = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/schedules/${schedule.id}`,
      headers,
      payload: { cron: "30 7 * * *", timezone: "Europe/London" },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({
      cron: "30 7 * * *",
      timezone: "Europe/London",
    });

    const paused = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/schedules/${schedule.id}`,
      headers,
      payload: { enabled: false },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({ enabled: false });

    const monitoring = await server.app.inject({
      method: "GET",
      url: `/api/v1/monitoring?siteId=${project.id}`,
      headers,
    });
    expect(monitoring.json().data.schedules[0]).toMatchObject({
      id: schedule.id,
      cron: "30 7 * * *",
      timezone: "Europe/London",
      enabled: false,
    });

    const deleted = await server.app.inject({
      method: "DELETE",
      url: `/api/v1/schedules/${schedule.id}`,
      headers,
    });
    expect(deleted.statusCode).toBe(204);
    expect(await server.runtime.schedules.list(project.id)).toHaveLength(0);
  });

  it("validates and persists project settings instead of returning an alpha placeholder", async () => {
    const { server, project, headers } = await setup();
    const updated = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/settings?siteId=${project.id}`,
      headers,
      payload: {
        siteName: "International marketing",
        siteUrl: "https://www.example.com",
        timezone: "Europe/London",
        reportingCurrency: "gbp",
        weeklyDigest: true,
        alertEmail: "SEO@example.com",
        dataRetentionDays: 365,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toEqual({
      siteName: "International marketing",
      siteUrl: "https://www.example.com/",
      timezone: "Europe/London",
      reportingCurrency: "GBP",
      weeklyDigest: true,
      alertEmail: "seo@example.com",
      dataRetentionDays: 365,
    });

    const read = await server.app.inject({
      method: "GET",
      url: `/api/v1/settings?siteId=${project.id}`,
      headers,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().data).toMatchObject({
      timezone: "Europe/London",
      reportingCurrency: "GBP",
    });

    const invalid = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/settings?siteId=${project.id}`,
      headers,
      payload: { timezone: "Not/A-Timezone" },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ code: "invalid_settings" });
  });

  it("returns stored page counts and run-specific SEO Health in audit history", async () => {
    const { runtime, server, project, headers } = await setup();
    const baseline = runtime.database.insertRun({
      id: "dashboard-audit-baseline",
      projectId: project.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(baseline.id, {
      status: "succeeded",
      completedAt: "2026-07-15T01:00:00.000Z",
      progress: 1,
    });
    runtime.database.upsertMetric(project.id, baseline.id, "seo_health", {
      value: 74,
      state: "available",
      source: "crawl",
      observedAt: "2026-07-15T01:00:00.000Z",
      coverage: 1,
    });
    const run = runtime.database.insertRun({
      id: "dashboard-audit-statistics",
      projectId: project.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(run.id, {
      status: "succeeded",
      completedAt: "2026-07-16T01:00:00.000Z",
      progress: 1,
      issueCount: 3,
    });
    runtime.database.replacePages(run.id, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 200,
        title: "Home",
        indexable: true,
      },
      {
        canonicalUrl: "https://example.com/pricing",
        statusCode: 200,
        title: "Pricing",
        indexable: true,
      },
    ]);
    runtime.database.upsertMetric(project.id, run.id, "seo_health", {
      value: 88,
      state: "available",
      source: "crawl",
      observedAt: "2026-07-16T01:00:00.000Z",
      coverage: 1,
    });
    runtime.database.upsertMetric(project.id, run.id, "health_change", {
      value: 14,
      state: "available",
      source: "audit-comparison",
      observedAt: "2026-07-16T01:00:00.000Z",
      coverage: 1,
    });

    const listed = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs?siteId=${project.id}`,
      headers,
    });
    expect(listed.statusCode, listed.body).toBe(200);
    const listedRun = listed
      .json()
      .data.items.find((item: { id: string }) => item.id === run.id);
    expect(listedRun).toMatchObject({
      id: run.id,
      pagesCrawled: 2,
      issuesFound: 3,
      healthScore: 88,
    });

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/v1/runs/${run.id}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data).toMatchObject({
      id: run.id,
      pagesCrawled: 2,
      healthScore: 88,
    });

    const overview = await server.app.inject({
      method: "GET",
      url: `/api/v1/overview?siteId=${project.id}`,
      headers,
    });
    expect(overview.statusCode, overview.body).toBe(200);
    expect(overview.json().data).toMatchObject({
      siteHealth: { value: 88, change: 14 },
      healthTrend: [
        { date: "2026-07-15", value: 74 },
        { date: "2026-07-16", value: 88 },
      ],
    });
  });

  it("projects the latest completed keyword and competitor research artifacts", async () => {
    const { dataDir, runtime, server, project, headers } = await setup();

    const emptyKeywords = await server.app.inject({
      method: "GET",
      url: `/api/v1/keywords?siteId=${project.id}`,
      headers,
    });
    expect(emptyKeywords.json().meta.state).toBe("missing");

    const keywordRun = runtime.database.insertRun({
      id: "research-keywords",
      projectId: project.id,
      workflowId: "content-plan",
    });
    runtime.database.updateRun(keywordRun.id, {
      status: "succeeded",
      completedAt: new Date().toISOString(),
      progress: 1,
    });
    saveResearchArtifact(runtime, dataDir, keywordRun.id, {
      keywordProfiles: [
        {
          profile: {
            seed: "technical seo",
            strength: 82,
            variants: [{ term: "technical seo audit" }],
          },
        },
      ],
      clusters: {
        profile: {
          clusters: [
            {
              hub: "technical seo",
              members: ["technical seo"],
              spokes: ["crawl budget"],
            },
          ],
        },
      },
    });

    const compareRun = runtime.database.insertRun({
      id: "research-competitors",
      projectId: project.id,
      workflowId: "compare",
    });
    runtime.database.updateRun(compareRun.id, {
      status: "partial",
      completedAt: new Date().toISOString(),
      progress: 1,
    });
    saveResearchArtifact(runtime, dataDir, compareRun.id, {
      generatedAt: "2026-07-15T00:00:00.000Z",
      sites: [
        { finalUrl: "https://example.com/", pagesCrawled: 5 },
        {
          finalUrl: "https://competitor.example/",
          pagesCrawled: 10,
          issuesByPriority: { High: 1 },
        },
      ],
    });

    const keywords = await server.app.inject({
      method: "GET",
      url: `/api/v1/keywords?siteId=${project.id}`,
      headers,
    });
    expect(keywords.statusCode).toBe(200);
    expect(keywords.json()).toMatchObject({
      meta: { state: "fresh" },
      data: {
        opportunities: [
          { keyword: "technical seo", opportunityScore: 82 },
          { keyword: "technical seo audit", volume: null },
        ],
        clusters: [{ name: "technical seo", contentCoverage: null }],
      },
    });

    const competitors = await server.app.inject({
      method: "GET",
      url: `/api/v1/competitors?siteId=${project.id}`,
      headers,
    });
    expect(competitors.statusCode).toBe(200);
    expect(competitors.json()).toMatchObject({
      meta: { state: "fresh" },
      data: {
        total: 1,
        items: [
          {
            domain: "competitor.example",
            technicalHealth: 95,
            keywordGaps: null,
          },
        ],
      },
    });
  });

  it("returns cited OSINT changes from the previous completed pass", async () => {
    const { dataDir, runtime, server, project, headers } = await setup();
    const dossier = (generatedAt: string, value: string) => ({
      schemaVersion: "osint-dossier.v1",
      workflow: "osint-research",
      generatedAt,
      sourceBudget: 1,
      targets: [
        {
          targetUrl: "https://example.com/",
          finalUrl: "https://example.com/",
          host: "example.com",
          status: "available",
          pagesObserved: 1,
          evidence: [
            {
              id: "signal",
              kind: "public-channel",
              label: "Security page",
              value,
              state: "available",
              sourceUrl: "https://example.com/",
              sourceClass: "public_web",
              observedAt: generatedAt,
              confidence: 1,
            },
          ],
          entities: [],
          relationships: [],
          publishingCadence: null,
          error: null,
        },
      ],
      findings: [],
      coverage: {
        state: "available",
        targetsRequested: 1,
        targetsCompleted: 1,
        pagesObserved: 1,
        evidenceAvailable: 1,
      },
      policy: {
        collection: "public_web_only",
        personalData: "disabled",
        identityResolution: "disabled",
        authenticatedCollection: "disabled",
        darkWebCollection: "disabled",
      },
      limitations: ["Public web only."],
    });
    const baseline = runtime.database.insertRun({
      id: "osint-baseline",
      projectId: project.id,
      workflowId: "osint-research",
    });
    runtime.database.updateRun(baseline.id, {
      status: "succeeded",
      completedAt: "2026-08-02T12:00:00.000Z",
      progress: 1,
    });
    saveResearchArtifact(
      runtime,
      dataDir,
      baseline.id,
      dossier("2026-08-02T12:00:00.000Z", "/security"),
    );
    const current = runtime.database.insertRun({
      id: "osint-current",
      projectId: project.id,
      workflowId: "osint-research",
    });
    runtime.database.updateRun(current.id, {
      status: "succeeded",
      completedAt: "2026-08-03T12:00:00.000Z",
      progress: 1,
    });
    saveResearchArtifact(
      runtime,
      dataDir,
      current.id,
      dossier("2026-08-03T12:00:00.000Z", "/security.txt"),
    );

    const response = await server.app.inject({
      method: "GET",
      url: `/api/v1/osint?siteId=${project.id}`,
      headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      meta: { state: "fresh" },
      data: {
        compared: true,
        previousGeneratedAt: "2026-08-02T12:00:00.000Z",
        changes: [
          {
            targetUrl: "https://example.com/",
            change: "changed",
            label: "Security page",
            before: { value: "/security" },
            after: { value: "/security.txt" },
          },
        ],
      },
    });
  });
});
