import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@marketingovo/contracts";
import type { Report } from "@marketingovo/core";
import {
  ActionEvidenceCursorError,
  MarketingovoLocalRuntime,
} from "./index.js";

const observedAt = "2026-07-15T10:00:00.000Z";

function issue(canonicalUrl: string, fingerprint: string): IssueInstance {
  return {
    fingerprint,
    ruleId: "canonical-missing",
    moduleId: "technical",
    canonicalUrl,
    severity: "high",
    title: `Canonical missing on ${canonicalUrl}`,
    description: "Add a self-referencing canonical.",
    evidence: [
      {
        kind: "html",
        label: "Canonical element absent",
        value: { canonicalUrl },
        source: "static-crawl",
        observedAt,
      },
    ],
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    status: "open",
  };
}

function action(projectId: string, affectedUrls: string[]): Action {
  return {
    id: "action-canonical",
    projectId,
    ruleId: "canonical-missing",
    moduleId: "technical",
    issueFingerprint: "a".repeat(64),
    title: "Canonical is missing",
    whyNow: "Affected pages have observed organic exposure.",
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
    affectedUrls,
    owner: null,
    status: "open",
    verification: "pending",
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

function completeRun(
  runtime: MarketingovoLocalRuntime,
  projectId: string,
  id: string,
  issues: IssueInstance[],
  currentAction: Action,
): void {
  const run = runtime.database.insertRun({
    id,
    projectId,
    workflowId: "audit",
  });
  runtime.database.replaceIssues(run.id, projectId, issues, {
    resolveMissing: true,
  });
  runtime.database.upsertActions([currentAction]);
  runtime.database.updateRun(run.id, {
    status: "succeeded",
    startedAt: observedAt,
    completedAt: observedAt,
    progress: 1,
    issueCount: issues.length,
  });
  runtime.database.replaceActionIssueLinks(
    run.id,
    projectId,
    runtime.database.listActions(projectId),
    issues,
    { resolveMissing: true },
  );
}

function report(projectUrl: string): Report {
  const currentGsc = [
    {
      page: `${projectUrl}products/a`,
      clicks: 100,
      impressions: 1_000,
      ctr: 0.1,
      position: 4,
    },
    {
      page: `${projectUrl}products/b`,
      clicks: 90,
      impressions: 900,
      ctr: 0.1,
      position: 4.5,
    },
    {
      page: `${projectUrl}blog/post`,
      clicks: 98,
      impressions: 980,
      ctr: 0.1,
      position: 4.2,
    },
  ];
  const currentGa4 = currentGsc.map((row, index) => ({
    page: new URL(row.page).pathname,
    sessions: 120 - index * 10,
    pageViews: 150 - index * 10,
    engagementRate: 0.7,
    bounceRate: 0.3,
    avgSessionDuration: 90,
    keyEvents: 12 - index,
  }));
  const performanceComparison = {
    asOfDate: "2026-07-15",
    calendarTimeZone: "UTC" as const,
    completeDataLagDays: 3 as const,
    windowDays: 28 as const,
    current: {
      periodStart: "2026-06-14",
      periodEnd: "2026-07-11",
      gsc: { perPage: currentGsc, topQueries: [], queryPages: [] },
      ga4: { perPage: currentGa4 },
    },
    previous: {
      periodStart: "2026-05-17",
      periodEnd: "2026-06-13",
      gsc: { perPage: currentGsc, topQueries: [], queryPages: [] },
      ga4: { perPage: currentGa4 },
    },
  };
  return {
    generatedAt: observedAt,
    startUrl: projectUrl,
    durationMs: 10,
    config: { maxUrls: 100, maxRuntimeMs: 60_000, requestsPerSecond: 2 },
    summary: {
      pagesCrawled: 3,
      issuesByPriority: { High: 1, Medium: 0, Low: 0 },
      issuesByCategory: { technical: 1 },
    },
    issues: [
      {
        id: "canonical-missing",
        category: "technical",
        priority: "High",
        message: "Canonical is missing",
        urls: [`${projectUrl}products/a`],
        moduleId: "technical",
      },
    ],
    pages: [
      ["products/a", "Target"],
      ["products/b", "Matched control"],
      ["blog/post", "Different template"],
    ].map(([path, title]) => ({
      url: `${projectUrl}${path}`,
      finalUrl: `${projectUrl}${path}`,
      status: 200,
      title: title ?? null,
      contentType: "text/html",
      canonical: null,
      robotsMeta: null,
      xRobotsTag: null,
      robotsAllowed: true,
      htmlParsed: true,
      error: null,
      redirectChain: [],
      responseTimeMs: 10,
      vitals: {
        lcp: 1_800,
        cls: 0.05,
        ttfb: 350,
        fcp: 900,
        pageWeightBytes: 30_000,
      },
    })),
    topUrls: [],
    realData: {
      periodStart: performanceComparison.current.periodStart,
      periodEnd: performanceComparison.current.periodEnd,
      gsc: currentGsc,
      ga4: currentGa4,
      topQueries: [],
      sitemaps: [],
      errors: [],
      performanceComparison,
    },
  };
}

async function waitForTerminal(
  runtime: MarketingovoLocalRuntime,
  runId: string,
) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const run = await runtime.runs.get(runId);
    if (run && ["succeeded", "partial", "failed"].includes(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return runtime.runs.get(runId);
}

describe("runtime Action Evidence service", () => {
  it("preserves the full URL history and paginates exact evidence", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-action-evidence-history-"),
      ),
    });
    try {
      const project = await runtime.projects.create({
        name: "Evidence history",
        canonicalUrl: "https://example.com/",
      });
      const a = issue("https://example.com/a", "a".repeat(64));
      const b = issue("https://example.com/b", "b".repeat(64));
      completeRun(
        runtime,
        project.id,
        "history-1",
        [a, b],
        action(project.id, [a.canonicalUrl!, b.canonicalUrl!]),
      );
      await new Promise((resolve) => setTimeout(resolve, 2));
      completeRun(
        runtime,
        project.id,
        "history-2",
        [b],
        action(project.id, [b.canonicalUrl!]),
      );
      await new Promise((resolve) => setTimeout(resolve, 2));
      completeRun(
        runtime,
        project.id,
        "history-3",
        [a],
        action(project.id, [a.canonicalUrl!]),
      );
      runtime.database.replacePages("history-3", [
        {
          canonicalUrl: a.canonicalUrl!,
          statusCode: 200,
          title: "Page A",
          indexable: true,
          payload: { vitals: { lcp: 1_900, cls: 0.04, ttfb: 300 } },
        },
      ]);
      runtime.database.replacePerformanceData({
        runId: "history-3",
        projectId: project.id,
        windows: [
          {
            runId: "history-3",
            projectId: project.id,
            source: "gsc",
            period: "current",
            startDate: "2026-06-14",
            endDate: "2026-07-11",
            fetchedAt: observedAt,
            state: "available",
            rowCount: 1,
            rowLimit: 250_000,
            truncated: false,
            coverage: null,
            note: null,
          },
          {
            runId: "history-3",
            projectId: project.id,
            source: "ga4",
            period: "current",
            startDate: "2026-06-14",
            endDate: "2026-07-11",
            fetchedAt: observedAt,
            state: "unavailable",
            rowCount: 0,
            rowLimit: 1_000_000,
            truncated: false,
            coverage: null,
            note: "GA4 is not connected.",
          },
        ],
        pages: [
          {
            runId: "history-3",
            projectId: project.id,
            period: "current",
            canonicalUrl: a.canonicalUrl!,
            crawlMatched: true,
            clicks: 10,
            impressions: 100,
            ctr: 0.1,
            position: 5,
            sessions: null,
            pageViews: null,
            engagementRate: null,
            keyEvents: null,
          },
        ],
        queries: [],
      });

      const first = await runtime.actions.evidence(action(project.id, []).id, {
        limit: 1,
      });
      expect(first?.summary).toEqual({
        totalUrls: 2,
        issueOccurrences: 6,
        newOccurrences: 2,
        persistentOccurrences: 1,
        resolvedOccurrences: 2,
        reappearedOccurrences: 1,
        clicks: 10,
        impressions: 100,
        keyEvents: null,
      });
      expect(first?.urls).toHaveLength(1);
      expect(first?.urls[0]).toMatchObject({
        url: "https://example.com/a",
        lifecycle: "reappeared",
        title: "Page A",
        gsc: { clicks: 10, impressions: 100 },
        ga4: null,
        issue: {
          evidence: [{ value: { canonicalUrl: "https://example.com/a" } }],
        },
      });
      expect(first?.pageInfo).toMatchObject({ total: 2 });
      expect(first?.pageInfo.nextCursor).not.toBeNull();
      expect(
        first?.sources.find((source) => source.source === "google-analytics-4"),
      ).toMatchObject({
        value: null,
        state: "unavailable",
      });
      const second = await runtime.actions.evidence(action(project.id, []).id, {
        limit: 1,
        cursor: first!.pageInfo.nextCursor!,
      });
      expect(second?.urls[0]).toMatchObject({
        url: "https://example.com/b",
        lifecycle: "resolved",
        issue: {
          evidence: [{ value: { canonicalUrl: "https://example.com/b" } }],
        },
      });
      expect(second?.pageInfo.nextCursor).toBeNull();
      await expect(
        runtime.actions.evidence(action(project.id, []).id, {
          cursor: "not-a-valid-cursor",
        }),
      ).rejects.toBeInstanceOf(ActionEvidenceCursorError);

      const partial = runtime.database.insertRun({
        id: "history-partial",
        projectId: project.id,
        workflowId: "audit",
      });
      runtime.database.updateRun(partial.id, {
        status: "partial",
        startedAt: observedAt,
        completedAt: observedAt,
        progress: 1,
      });
      runtime.database.replaceActionIssueLinks(
        partial.id,
        project.id,
        runtime.database.listActions(project.id),
        [],
        { resolveMissing: false },
      );
      const afterPartial = await runtime.actions.evidence(
        action(project.id, []).id,
      );
      expect(afterPartial?.summary.issueOccurrences).toBe(6);
      expect(afterPartial?.action.status).toBe("open");
    } finally {
      runtime.close();
    }
  });

  it("persists comparison evidence and matched checkpoints across restart", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-action-checkpoint-"),
    );
    const engineReport = report("https://example.com/");
    let runtime = new MarketingovoLocalRuntime({
      dataDir,
      engine: {
        crawl: async () => ({ runId: "engine-run", report: engineReport }),
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html><title>Evidence</title>",
        reportToCsv: () => "url,status\n",
      },
    });
    try {
      const project = await runtime.projects.create({
        name: "Checkpoint",
        canonicalUrl: "https://example.com/",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "checkpoint-baseline",
      );
      expect((await waitForTerminal(runtime, run.id))?.status).toBe(
        "succeeded",
      );
      const [storedAction] = await runtime.actions.list(project.id);
      const checkpoint = await runtime.actions.createCheckpoint(
        storedAction!.id,
      );
      expect(checkpoint).toMatchObject({
        actionId: storedAction!.id,
        baselineRunId: run.id,
        state: "active",
      });
      expect(checkpoint).not.toHaveProperty("baselineSnapshot");
      const durable = runtime.database.latestActionCheckpoint(
        storedAction!.id,
      )!;
      expect(durable.controlUrls).toEqual(["https://example.com/products/b"]);
      expect(durable.baselineSnapshot).toMatchObject({
        schemaVersion: "action-checkpoint-v1",
        target: { urls: ["https://example.com/products/a"] },
        control: { urls: ["https://example.com/products/b"] },
      });

      await new Promise((resolve) => setTimeout(resolve, 2));
      const targeted = runtime.database.insertRun({
        id: "targeted-verification",
        projectId: project.id,
        workflowId: "audit",
        options: {
          verificationActionId: storedAction!.id,
          verificationId: "verification-1",
          technicalOnly: true,
        },
      });
      runtime.database.updateRun(targeted.id, {
        status: "succeeded",
        startedAt: observedAt,
        completedAt: observedAt,
        progress: 1,
      });
      runtime.database.replacePages(targeted.id, [
        {
          canonicalUrl: "https://example.com/products/a",
          statusCode: 200,
          title: "Verification-only page",
          indexable: true,
        },
      ]);
      expect(
        (await runtime.actions.evidence(storedAction!.id))?.urls[0]?.title,
      ).toBe("Target");
      expect(
        (await runtime.actions.createCheckpoint(storedAction!.id))
          ?.baselineRunId,
      ).toBe(run.id);
      runtime.close();

      runtime = new MarketingovoLocalRuntime({ dataDir });
      const restored = await runtime.actions.evidence(storedAction!.id);
      expect(restored?.verification.checkpointId).not.toBeNull();
      expect(restored?.summary).toMatchObject({ clicks: 100, keyEvents: 12 });
      expect(restored?.outcomes).toHaveLength(3);
      expect(await runtime.actions.outcomes(storedAction!.id)).toHaveLength(3);
    } finally {
      runtime.close();
    }
  });

  it("returns null metrics instead of zeros when providers are unavailable", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-action-evidence-missing-"),
      ),
    });
    try {
      const project = await runtime.projects.create({
        name: "Missing sources",
        canonicalUrl: "https://example.com/",
      });
      const pageIssue = issue("https://example.com/missing", "c".repeat(64));
      const storedAction = {
        ...action(project.id, [pageIssue.canonicalUrl!]),
        issueFingerprint: pageIssue.fingerprint,
      };
      completeRun(
        runtime,
        project.id,
        "missing-sources",
        [pageIssue],
        storedAction,
      );
      runtime.database.replacePages("missing-sources", [
        {
          canonicalUrl: pageIssue.canonicalUrl!,
          statusCode: 200,
          title: "Missing sources",
          indexable: true,
        },
      ]);
      const evidence = await runtime.actions.evidence(storedAction.id);
      expect(evidence?.summary).toMatchObject({
        clicks: null,
        impressions: null,
        keyEvents: null,
      });
      expect(evidence?.urls[0]).toMatchObject({ gsc: null, ga4: null });
      expect(
        evidence?.sources.filter((source) => source.source !== "crawl"),
      ).toEqual([
        expect.objectContaining({ value: null, state: "unavailable" }),
        expect.objectContaining({ value: null, state: "unavailable" }),
      ]);
    } finally {
      runtime.close();
    }
  });

  it("does not resolve action occurrences after a partial audit", async () => {
    const complete = report("https://example.com/");
    const partial: Report = {
      ...complete,
      generatedAt: "2026-07-16T10:00:00.000Z",
      summary: {
        pagesCrawled: complete.pages.length + 1,
        issuesByPriority: { High: 0, Medium: 0, Low: 0 },
        issuesByCategory: {},
      },
      issues: [],
      pages: [
        ...complete.pages,
        {
          ...complete.pages[0]!,
          url: "https://example.com/failed",
          finalUrl: "https://example.com/failed",
          status: 0,
          title: null,
          error: "timeout",
        },
      ],
    };
    let invocation = 0;
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-action-evidence-partial-"),
      ),
      engine: {
        crawl: async () => ({
          runId: `partial-engine-${invocation}`,
          report: invocation++ === 0 ? complete : partial,
        }),
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html><title>Evidence</title>",
        reportToCsv: () => "url,status\n",
      },
    });
    try {
      const project = await runtime.projects.create({
        name: "Partial safety",
        canonicalUrl: "https://example.com/",
      });
      const baseline = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "partial-safety-baseline",
      );
      expect((await waitForTerminal(runtime, baseline.id))?.status).toBe(
        "succeeded",
      );
      const [storedAction] = await runtime.actions.list(project.id);
      const followUp = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "partial-safety-follow-up",
      );
      expect((await waitForTerminal(runtime, followUp.id))?.status).toBe(
        "partial",
      );
      const evidence = await runtime.actions.evidence(storedAction!.id);
      expect(evidence?.summary.resolvedOccurrences).toBe(0);
      expect(evidence?.action).toMatchObject({
        status: "open",
        verification: "pending",
      });
    } finally {
      runtime.close();
    }
  });
});
