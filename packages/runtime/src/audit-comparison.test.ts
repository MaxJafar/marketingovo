import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { IssueInstance, Severity } from "@golem-seo/contracts";
import { GolemLocalRuntime } from "./index.js";

const observedAt = "2026-07-16T09:00:00.000Z";

function issue(
  fingerprintCharacter: string,
  severity: Severity,
  canonicalUrl: string,
  title = "Comparison issue",
): IssueInstance {
  return {
    fingerprint: fingerprintCharacter.repeat(64),
    ruleId: `rule-${fingerprintCharacter}`,
    moduleId: "technical",
    canonicalUrl,
    severity,
    title,
    description: `${title} requires review.`,
    evidence: [{ kind: "crawl", label: "Fixture", value: true }],
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    status: "open",
  };
}

describe("immutable audit comparison", () => {
  let runtime: GolemLocalRuntime | undefined;
  afterEach(() => runtime?.close());

  it("calculates reviewed issue, page, health, and configuration deltas without mutating history", async () => {
    runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-audit-comparison-")),
    });
    const project = await runtime.projects.create({
      name: "Comparison",
      canonicalUrl: "https://example.com/",
    });
    const baseline = runtime.database.insertRun({
      id: "baseline-audit",
      projectId: project.id,
      workflowId: "audit",
      options: { renderMode: "static", maxUrls: 100 },
    });
    runtime.database.updateRun(baseline.id, {
      status: "succeeded",
      progress: 1,
      completedAt: observedAt,
      issueCount: 3,
    });
    const persistentBaseline = issue(
      "a",
      "high",
      "https://example.com/",
      "Canonical target is invalid",
    );
    const resolved = issue(
      "b",
      "medium",
      "https://example.com/resolved",
      "Meta description is missing",
    );
    const reviewedNoise = issue(
      "c",
      "high",
      "https://example.com/intentional",
      "Intentional test finding",
    );
    runtime.database.replaceIssues(baseline.id, project.id, [
      persistentBaseline,
      resolved,
      reviewedNoise,
    ]);
    runtime.database.replacePages(baseline.id, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 200,
        title: "Home",
        indexable: true,
        payload: {
          linkGraphVersion: 1,
          internalLinks: [
            {
              targetUrl: "https://example.com/",
              occurrences: 1,
              followOccurrences: 1,
              nofollowOccurrences: 0,
              anchorTexts: ["Home"],
              placements: ["navigation"],
            },
            {
              targetUrl: "https://example.com/removed",
              occurrences: 1,
              followOccurrences: 1,
              nofollowOccurrences: 0,
              anchorTexts: ["Old resource"],
              placements: ["main"],
            },
          ],
        },
      },
      {
        canonicalUrl: "https://example.com/removed",
        statusCode: 404,
        title: "Removed",
        indexable: false,
        payload: { linkGraphVersion: 1, internalLinks: [] },
      },
    ]);
    runtime.database.upsertMetric(project.id, baseline.id, "seo_health", {
      value: 80,
      state: "available",
      source: "crawl",
      observedAt,
      coverage: 1,
    });

    const current = runtime.database.insertRun({
      id: "current-audit",
      projectId: project.id,
      workflowId: "audit",
      options: { renderMode: "js", maxUrls: 200 },
    });
    runtime.database.updateRun(current.id, {
      status: "succeeded",
      progress: 1,
      completedAt: observedAt,
      issueCount: 2,
    });
    const persistentCurrent = {
      ...persistentBaseline,
      severity: "critical" as const,
      title: "Canonical target now causes a critical loop",
    };
    const newlyDetected = issue(
      "d",
      "low",
      "https://example.com/new",
      "Heading order changed",
    );
    runtime.database.replaceIssues(current.id, project.id, [
      persistentCurrent,
      newlyDetected,
    ]);
    runtime.database.replacePages(current.id, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 500,
        title: "Home unavailable",
        indexable: false,
        payload: {
          linkGraphVersion: 1,
          internalLinks: [
            {
              targetUrl: "https://example.com/",
              occurrences: 2,
              followOccurrences: 1,
              nofollowOccurrences: 1,
              anchorTexts: ["Home", "Start"],
              placements: ["navigation", "footer"],
            },
            {
              targetUrl: "https://example.com/added",
              occurrences: 1,
              followOccurrences: 1,
              nofollowOccurrences: 0,
              anchorTexts: ["New resource"],
              placements: ["main"],
            },
            {
              targetUrl: "https://example.com/missing",
              occurrences: 1,
              followOccurrences: 1,
              nofollowOccurrences: 0,
              anchorTexts: ["Missing resource"],
              placements: ["footer"],
            },
          ],
        },
      },
      {
        canonicalUrl: "https://example.com/added",
        statusCode: 200,
        title: "Added",
        indexable: true,
        payload: { linkGraphVersion: 1, internalLinks: [] },
      },
    ]);
    runtime.database.upsertMetric(project.id, current.id, "seo_health", {
      value: 70,
      state: "available",
      source: "crawl",
      observedAt,
      coverage: 1,
    });
    await runtime.issues.update(reviewedNoise.fingerprint, {
      projectId: project.id,
      status: "false_positive",
      note: "This fixture represents a documented intentional response.",
    });

    expect(
      runtime.database
        .listIssues(baseline.id)
        .find((item) => item.fingerprint === persistentBaseline.fingerprint),
    ).toMatchObject({
      severity: "high",
      title: "Canonical target is invalid",
    });
    expect(
      runtime.database
        .listIssues(current.id)
        .find((item) => item.fingerprint === persistentCurrent.fingerprint),
    ).toMatchObject({
      severity: "critical",
      title: "Canonical target now causes a critical loop",
    });

    const comparison = await runtime.runs.compare(current.id, baseline.id);

    expect(comparison).toMatchObject({
      scoreVersion: "regression-v1",
      state: "available",
      projectId: project.id,
      configuration: {
        state: "different",
        differences: ["Render and performance mode", "Maximum URL limit"],
      },
      summary: {
        baselinePages: 2,
        currentPages: 2,
        addedPages: 1,
        removedPages: 1,
        statusChanges: 1,
        indexabilityChanges: 1,
        baselineIssues: 2,
        currentIssues: 2,
        newIssues: 1,
        resolvedIssues: 1,
        persistentIssues: 1,
        severityIncreases: 1,
        severityDecreases: 0,
        reviewedExcludedBaseline: 1,
        reviewedExcludedCurrent: 0,
        baselineHealth: 80,
        currentHealth: 70,
        healthDelta: -10,
        regressionScore: 6,
      },
      truncated: {
        issueRegressions: false,
        issueImprovements: false,
        pageChanges: false,
      },
      linkGraph: {
        version: "link-delta-v1",
        state: "available",
        baseline: { pageCount: 2, graphPageCount: 2, edgeCount: 2 },
        current: { pageCount: 2, graphPageCount: 2, edgeCount: 3 },
        summary: {
          addedEdges: 2,
          removedEdges: 1,
          changedEdges: 1,
          regressions: 1,
          improvements: 1,
        },
        truncated: false,
      },
    });
    expect(comparison.issueRegressions.map((item) => item.change)).toEqual([
      "severity_increased",
      "new",
    ]);
    expect(comparison.issueImprovements.map((item) => item.change)).toEqual([
      "resolved",
    ]);
    expect(comparison.pageChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalUrl: "https://example.com/",
          kind: "status_changed",
          impact: "regression",
        }),
        expect.objectContaining({
          canonicalUrl: "https://example.com/",
          kind: "indexability_changed",
          impact: "regression",
        }),
      ]),
    );
    expect(comparison.warnings.join(" ")).toContain(
      "Ignored and false-positive",
    );
    expect(comparison.linkGraph.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: "https://example.com/",
          targetUrl: "https://example.com/",
          change: "changed",
          impact: "regression",
          reasons: expect.arrayContaining([
            "target_resolution",
            "follow_policy",
            "occurrences",
            "anchor_text",
            "placement",
          ]),
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/removed",
          change: "removed",
          impact: "improvement",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/missing",
          change: "added",
          impact: "neutral",
        }),
      ]),
    );
    expect(comparison.linkGraph.warnings.join(" ")).toContain(
      "editorial intent",
    );
  });

  it("rejects same-run, cross-project, active, and non-audit comparisons", async () => {
    runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-audit-comparison-guard-")),
    });
    const firstProject = await runtime.projects.create({
      name: "First",
      canonicalUrl: "https://first.example/",
    });
    const secondProject = await runtime.projects.create({
      name: "Second",
      canonicalUrl: "https://second.example/",
    });
    const baseline = runtime.database.insertRun({
      id: "guard-baseline",
      projectId: firstProject.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(baseline.id, {
      status: "succeeded",
      completedAt: observedAt,
    });
    const active = runtime.database.insertRun({
      id: "guard-active",
      projectId: firstProject.id,
      workflowId: "audit",
    });
    const foreign = runtime.database.insertRun({
      id: "guard-foreign",
      projectId: secondProject.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(foreign.id, {
      status: "succeeded",
      completedAt: observedAt,
    });
    const research = runtime.database.insertRun({
      id: "guard-research",
      projectId: firstProject.id,
      workflowId: "keyword-research",
    });
    runtime.database.updateRun(research.id, {
      status: "succeeded",
      completedAt: observedAt,
    });

    await expect(
      runtime.runs.compare(baseline.id, baseline.id),
    ).rejects.toMatchObject({ code: "comparison_same_run", status: 422 });
    await expect(
      runtime.runs.compare(foreign.id, baseline.id),
    ).rejects.toMatchObject({
      code: "comparison_project_mismatch",
      status: 422,
    });
    await expect(
      runtime.runs.compare(active.id, baseline.id),
    ).rejects.toMatchObject({
      code: "comparison_run_not_ready",
      status: 409,
    });
    await expect(
      runtime.runs.compare(research.id, baseline.id),
    ).rejects.toMatchObject({
      code: "comparison_workflow_unsupported",
      status: 422,
    });
    await expect(
      runtime.runs.compare("missing", baseline.id),
    ).rejects.toMatchObject({ code: "current_run_not_found", status: 404 });
  });
});
