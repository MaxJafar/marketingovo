import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@golem-seo/contracts";
import { GolemDatabase } from "./database.js";

describe("GolemDatabase", () => {
  it("persists projects, idempotent runs, events, and restart recovery", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-storage-"));
    const path = join(root, "golem-seo.db");
    const database = new GolemDatabase({ path });
    const project = database.createProject({
      name: "Example",
      canonicalUrl: "https://example.com",
    });
    const first = database.insertRun({
      id: "run-1",
      projectId: project.id,
      workflowId: "audit",
      idempotencyKey: "same",
    });
    const duplicate = database.insertRun({
      id: "run-2",
      projectId: project.id,
      workflowId: "audit",
      idempotencyKey: "same",
    });
    expect(duplicate.id).toBe(first.id);
    database.updateRun(first.id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    database.appendRunEvent(first.id, "run.started", { progress: 0 });
    expect(database.recoverInterruptedRuns()).toBe(1);
    expect(database.getRun(first.id)?.status).toBe("queued");
    expect(database.listRunEvents(first.id)).toHaveLength(1);
    database.close();

    const reopened = new GolemDatabase({ path });
    expect(reopened.getProject(project.id)?.canonicalUrl).toBe(
      "https://example.com/",
    );
    reopened.close();
  });

  it("projects per-run page counts and health without inventing missing health", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-run-statistics-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const project = database.createProject({
      name: "Run statistics",
      canonicalUrl: "https://example.com",
    });
    const measured = database.insertRun({
      id: "run-statistics-measured",
      projectId: project.id,
      workflowId: "audit",
    });
    const missing = database.insertRun({
      id: "run-statistics-missing",
      projectId: project.id,
      workflowId: "audit",
    });
    database.replacePages(measured.id, [
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
    database.upsertMetric(project.id, measured.id, "seo_health", {
      value: 91,
      state: "available",
      source: "crawl",
      observedAt: "2026-07-16T00:00:00.000Z",
      coverage: 1,
    });

    expect(
      Object.fromEntries(
        database
          .listRunDashboardStatistics(project.id)
          .map((item) => [item.runId, item]),
      ),
    ).toEqual({
      [missing.id]: {
        runId: missing.id,
        pagesCrawled: 0,
        healthScore: null,
      },
      [measured.id]: {
        runId: measured.id,
        pagesCrawled: 2,
        healthScore: 91,
      },
    });
    database.close();
  });

  it("upserts durable per-module execution metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-run-modules-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const project = database.createProject({
      name: "Modules",
      canonicalUrl: "https://example.com",
    });
    const run = database.insertRun({
      id: "run-modules",
      projectId: project.id,
      workflowId: "audit",
    });
    database.upsertRunModule({
      runId: run.id,
      moduleId: "core-audit",
      version: "0.11.0",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    database.upsertRunModule({
      runId: run.id,
      moduleId: "core-audit",
      version: "0.11.0",
      status: "succeeded",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:02.000Z",
      durationMs: 2_000,
      coverage: 0.8,
    });

    expect(database.listRunModules(run.id)).toEqual([
      {
        runId: run.id,
        moduleId: "core-audit",
        version: "0.11.0",
        status: "succeeded",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:02.000Z",
        durationMs: 2_000,
        coverage: 0.8,
        error: null,
      },
    ]);
    database.close();
  });

  it("leases, heartbeats, retries and dead-letters jobs without duplicate claims", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-jobs-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const project = database.createProject({
      name: "Jobs",
      canonicalUrl: "https://example.com",
    });
    const run = database.insertRun({
      id: "run-jobs",
      projectId: project.id,
      workflowId: "audit",
    });
    const job = database.enqueueJob({
      id: "job-1",
      runId: run.id,
      type: "run.execute",
      payload: { runId: run.id },
      maxAttempts: 2,
      availableAt: "2026-01-01T00:00:00.000Z",
    });
    expect(job.state).toBe("queued");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const first = database.claimJobs("worker-a", 1, 1_000, now);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      state: "leased",
      attempts: 1,
      leaseOwner: "worker-a",
    });
    expect(database.claimJobs("worker-b", 1, 1_000, now)).toHaveLength(0);
    expect(database.heartbeatJob(job.id, "worker-a", 5_000, now)).toBe(true);
    const retry = database.failJob(
      job.id,
      "worker-a",
      "temporary failure",
      now,
    );
    expect(retry?.state).toBe("queued");
    expect(
      database.claimJobs(
        "worker-b",
        1,
        1_000,
        new Date("2026-01-01T00:00:00.500Z"),
      ),
    ).toHaveLength(0);
    const second = database.claimJobs(
      "worker-b",
      1,
      1_000,
      new Date("2026-01-01T00:00:01.001Z"),
    );
    expect(second[0]?.attempts).toBe(2);
    const dead = database.failJob(
      job.id,
      "worker-b",
      "permanent failure",
      new Date("2026-01-01T00:00:01.001Z"),
    );
    expect(dead?.state).toBe("dead_letter");
    expect(
      database.claimJobs(
        "worker-c",
        1,
        1_000,
        new Date("2026-01-02T00:00:00.000Z"),
      ),
    ).toHaveLength(0);
    database.close();
  });

  it("claims a due schedule once and advances its durable cursor", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-schedule-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const project = database.createProject({
      name: "Schedule",
      canonicalUrl: "https://example.com",
    });
    const schedule = database.createSchedule({
      projectId: project.id,
      cron: "0 6 * * *",
      timezone: "UTC",
      enabled: true,
      nextRunAt: "2026-01-01T06:00:00.000Z",
    });
    const now = new Date("2026-01-01T06:00:00.000Z");
    expect(
      database.claimDueSchedules("scheduler-a", 10, 60_000, now),
    ).toHaveLength(1);
    expect(
      database.claimDueSchedules("scheduler-b", 10, 60_000, now),
    ).toHaveLength(0);
    expect(
      database.advanceSchedule(
        schedule.id,
        "scheduler-a",
        "2026-01-02T06:00:00.000Z",
        now.toISOString(),
      ),
    ).toBe(true);
    expect(
      database.claimDueSchedules("scheduler-b", 10, 60_000, now),
    ).toHaveLength(0);
    expect(database.listSchedules(project.id)[0]?.nextRunAt).toBe(
      "2026-01-02T06:00:00.000Z",
    );
    database.close();
  });

  it("keeps non-secret connector configuration isolated per project", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-integrations-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const first = database.createProject({
      name: "First",
      canonicalUrl: "https://one.example",
    });
    const second = database.createProject({
      name: "Second",
      canonicalUrl: "https://two.example",
    });
    database.setProjectIntegrationConfiguration(
      first.id,
      "google-search-console",
      { siteUrl: "sc-domain:one.example" },
    );
    database.setProjectIntegrationConfiguration(
      second.id,
      "google-search-console",
      { siteUrl: "sc-domain:two.example" },
    );
    expect(
      database.getProjectIntegrationConfiguration(
        first.id,
        "google-search-console",
      ),
    ).toEqual({ siteUrl: "sc-domain:one.example" });
    expect(
      database.getProjectIntegrationConfiguration(
        second.id,
        "google-search-console",
      ),
    ).toEqual({ siteUrl: "sc-domain:two.example" });
    database.close();
  });

  it("updates project identity and persists local reporting settings", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-settings-"));
    const path = join(root, "golem-seo.db");
    const database = new GolemDatabase({ path });
    const project = database.createProject({
      name: "Original",
      canonicalUrl: "https://example.com",
    });

    const updated = database.updateProjectSettings(project.id, {
      name: "Marketing site",
      canonicalUrl: "https://www.example.com",
      timezone: "Europe/London",
      reportingCurrency: "GBP",
      weeklyDigest: true,
      alertEmail: "seo@example.com",
      dataRetentionDays: 365,
    });

    expect(updated).toMatchObject({
      project: {
        name: "Marketing site",
        canonicalUrl: "https://www.example.com/",
      },
      settings: {
        timezone: "Europe/London",
        reportingCurrency: "GBP",
        weeklyDigest: true,
        alertEmail: "seo@example.com",
        dataRetentionDays: 365,
      },
    });
    database.close();

    const reopened = new GolemDatabase({ path });
    expect(reopened.getProjectSettings(project.id)).toMatchObject({
      timezone: "Europe/London",
      reportingCurrency: "GBP",
      weeklyDigest: true,
    });
    expect(reopened.getProject(project.id)?.canonicalUrl).toBe(
      "https://www.example.com/",
    );
    reopened.close();
  });

  it("persists action evidence, checkpoints, and idempotent verification verdicts", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-flight-recorder-"));
    const path = join(root, "golem-seo.db");
    const database = new GolemDatabase({ path });
    const project = database.createProject({
      name: "Flight recorder",
      canonicalUrl: "https://example.com",
    });
    const baseline = database.insertRun({
      id: "baseline-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const observedAt = "2026-07-15T10:00:00.000Z";
    const issue: IssueInstance = {
      fingerprint: "b".repeat(64),
      ruleId: "canonical-missing",
      moduleId: "technical",
      canonicalUrl: "https://example.com/products/a",
      severity: "high",
      title: "Canonical missing",
      description: "Add a self-referencing canonical.",
      evidence: [{ kind: "html", label: "Canonical element absent" }],
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      status: "open",
    };
    database.replaceIssues(baseline.id, project.id, [issue]);
    const action: Action = {
      id: "action-canonical",
      projectId: project.id,
      ruleId: issue.ruleId,
      moduleId: issue.moduleId,
      issueFingerprint: issue.fingerprint,
      title: issue.title,
      whyNow: "The affected cohort has organic exposure.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 82,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: 0.7,
        conversionExposure: null,
        urlReach: 0.5,
        confidence: 0.9,
        unavailable: ["conversion_exposure"],
      },
      affectedUrls: [issue.canonicalUrl!],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: observedAt,
      updatedAt: observedAt,
    };
    database.upsertActions([action]);
    database.replaceActionIssueLinks(
      baseline.id,
      project.id,
      [action],
      [issue],
      { resolveMissing: true },
    );
    database.updateRun(baseline.id, {
      status: "succeeded",
      startedAt: observedAt,
      completedAt: observedAt,
      progress: 1,
    });
    database.replacePerformanceData({
      runId: baseline.id,
      projectId: project.id,
      windows: [
        {
          runId: baseline.id,
          projectId: project.id,
          source: "gsc",
          period: "current",
          startDate: "2026-06-14",
          endDate: "2026-07-11",
          fetchedAt: observedAt,
          state: "available",
          rowCount: 1,
          rowLimit: 25_000,
          truncated: false,
          coverage: null,
          note: "Completeness is not guaranteed by the provider.",
        },
      ],
      pages: [
        {
          runId: baseline.id,
          projectId: project.id,
          period: "current",
          canonicalUrl: issue.canonicalUrl!,
          crawlMatched: true,
          clicks: 120,
          impressions: 1_000,
          ctr: 0.12,
          position: 4.2,
          sessions: 140,
          pageViews: 180,
          engagementRate: 0.7,
          keyEvents: 12,
        },
      ],
      queries: [
        {
          runId: baseline.id,
          projectId: project.id,
          period: "current",
          query: "technical seo",
          canonicalUrl: issue.canonicalUrl!,
          clicks: 80,
          impressions: 600,
          ctr: 0.133,
          position: 4.1,
        },
      ],
    });

    expect(database.getAction(action.id)).toMatchObject({
      ruleId: issue.ruleId,
      moduleId: issue.moduleId,
    });
    expect(database.listActionIssueLinks(action.id)).toEqual([
      expect.objectContaining({ lifecycle: "new", issue }),
    ]);
    expect(database.listPerformanceWindows(baseline.id)).toEqual([
      expect.objectContaining({
        source: "gsc",
        rowCount: 1,
        coverage: null,
      }),
    ]);
    expect(database.listPagePerformance(baseline.id, "current")).toEqual([
      expect.objectContaining({
        canonicalUrl: issue.canonicalUrl,
        clicks: 120,
        keyEvents: 12,
      }),
    ]);
    expect(database.listQueryPerformance(baseline.id, "current")).toEqual([
      expect.objectContaining({
        query: "technical seo",
        impressions: 600,
      }),
    ]);

    const checkpoint = database.createActionCheckpoint({
      actionId: action.id,
      projectId: project.id,
      baselineRunId: baseline.id,
      baselineSnapshot: { clicks: 120, period: "previous-28-days" },
      targetUrls: action.affectedUrls,
      controlUrls: ["https://example.com/products/control"],
      cohortMatching: { method: "path-and-demand-v1" },
    });
    expect(checkpoint).toMatchObject({
      state: "active",
      targetUrls: action.affectedUrls,
      controlUrls: ["https://example.com/products/control"],
    });
    expect(database.listActionObservations(checkpoint.id)).toHaveLength(3);

    const verificationRun = database.insertRun({
      id: "verification-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const first = database.createActionVerification({
      checkpointId: checkpoint.id,
      idempotencyKey: "verify-request-1",
    });
    const duplicate = database.createActionVerification({
      checkpointId: checkpoint.id,
      idempotencyKey: "verify-request-1",
    });
    expect(duplicate.id).toBe(first.id);
    database.attachActionVerificationRun(first.id, verificationRun.id);
    expect(database.latestActionVerification(action.id)?.state).toBe("queued");
    database.markActionVerificationRunning(verificationRun.id);
    expect(database.latestActionVerification(action.id)?.state).toBe("running");
    expect(
      database.completeActionVerification({
        runId: verificationRun.id,
        state: "verified",
        coverage: 1,
        reason: "The issue was absent on every target URL.",
      }),
    ).toMatchObject({ state: "verified", coverage: 1 });
    expect(database.latestActionCheckpoint(action.id)?.state).toBe(
      "technically_verified",
    );
    database.close();

    const reopened = new GolemDatabase({ path });
    expect(reopened.latestActionVerification(action.id)).toMatchObject({
      state: "verified",
      runId: verificationRun.id,
    });
    expect(reopened.listActionObservations(checkpoint.id)).toHaveLength(3);
    reopened.close();
  });

  it("rolls back every imported row when a late bundle insert conflicts", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-seo-import-transaction-"));
    const database = new GolemDatabase({ path: join(root, "golem-seo.db") });
    const at = "2026-07-15T10:00:00.000Z";
    const fingerprint = "a".repeat(64);
    const action = {
      projectId: "import-project",
      issueFingerprint: fingerprint,
      title: "Fix imported issue",
      whyNow: "The issue affects an indexable page.",
      impact: 0.8,
      effort: "low" as const,
      confidence: 0.9,
      priorityScore: 80,
      scoreVersion: "priority-v1" as const,
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["gsc"],
      },
      affectedUrls: ["https://import.example/"],
      owner: null,
      status: "open" as const,
      verification: "pending" as const,
      createdAt: at,
      updatedAt: at,
    };

    expect(() =>
      database.importProjectBundle({
        project: {
          id: "import-project",
          name: "Imported",
          canonicalUrl: "https://import.example/",
          createdAt: at,
          updatedAt: at,
        },
        settings: null,
        runs: [
          {
            id: "import-run",
            projectId: "import-project",
            workflowId: "audit",
            status: "succeeded",
            requestedAt: at,
            startedAt: at,
            completedAt: at,
            progress: 1,
            issueCount: 1,
            error: null,
          },
        ],
        runConfigurations: [],
        runModules: [],
        pages: [],
        issues: [
          {
            runId: "import-run",
            issue: {
              fingerprint,
              ruleId: "import-rule",
              moduleId: "core-audit",
              canonicalUrl: "https://import.example/",
              severity: "high",
              title: "Imported issue",
              description: "Imported issue description.",
              evidence: [],
              firstSeenAt: at,
              lastSeenAt: at,
              status: "open",
            },
          },
        ],
        issueAdjudications: [],
        contextVersions: [],
        contextJournal: [],
        extractionRuleVersions: [],
        actions: [
          { ...action, id: "action-one" },
          { ...action, id: "action-two" },
        ],
        metrics: [],
        schedules: [],
        connectors: [],
        artifacts: [],
        sourceProjectId: "source-project",
        importedAt: at,
      }),
    ).toThrow();

    expect(database.getProject("import-project")).toBeNull();
    expect(database.getRun("import-run")).toBeNull();
    expect(database.listActions("import-project")).toEqual([]);
    database.close();
  });
});
