import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@agentseoapp/contracts";
import { AgentSeoDatabase } from "./database.js";

function issue(at: string): IssueInstance {
  return {
    fingerprint: "a".repeat(64),
    ruleId: "canonical-missing",
    moduleId: "technical",
    canonicalUrl: "https://example.com/product",
    severity: "high",
    title: "Canonical element is missing",
    description: "The page does not declare a canonical URL.",
    evidence: [
      {
        kind: "html",
        label: "Canonical link count",
        value: 0,
        source: "static-crawl",
        observedAt: at,
      },
    ],
    firstSeenAt: at,
    lastSeenAt: at,
    status: "open",
  };
}

describe("issue adjudication storage", () => {
  it("keeps reviewed classifications sticky, reversible, scoped, and out of priorities", () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-issue-review-"));
    const database = new AgentSeoDatabase({ path: join(root, "agentseo.db") });
    const project = database.createProject({
      name: "Review fixture",
      canonicalUrl: "https://example.com",
    });
    const otherProject = database.createProject({
      name: "Other fixture",
      canonicalUrl: "https://other.example.com",
    });
    const baseline = database.insertRun({
      id: "issue-run-1",
      projectId: project.id,
      workflowId: "audit",
    });
    const firstSeen = "2026-07-15T10:00:00.000Z";
    const finding = issue(firstSeen);
    database.replaceIssues(baseline.id, project.id, [finding]);

    const action: Action = {
      id: "canonical-action",
      projectId: project.id,
      ruleId: finding.ruleId,
      moduleId: finding.moduleId,
      issueFingerprint: finding.fingerprint,
      title: "Add a canonical URL",
      whyNow: "An indexable product page has no declared canonical.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 83,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["gsc", "ga4"],
      },
      affectedUrls: [finding.canonicalUrl!],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: firstSeen,
      updatedAt: firstSeen,
    };
    database.upsertActions([action]);

    expect(database.listProjectIssueReviews(project.id)).toMatchObject({
      total: 1,
      items: [
        {
          issue: { status: "open", fingerprint: finding.fingerprint },
          latestRunId: baseline.id,
          occurrenceCount: 1,
          adjudication: null,
        },
      ],
    });
    expect(
      database.updateIssueAdjudication(otherProject.id, finding.fingerprint, {
        status: "false_positive",
        note: "Not this project's issue.",
        actor: "local-user",
      }),
    ).toBeNull();

    const classified = database.updateIssueAdjudication(
      project.id,
      finding.fingerprint,
      {
        status: "false_positive",
        note: "The canonical is injected at the edge before delivery.",
        actor: "local-user",
      },
    );
    expect(classified).toMatchObject({
      issue: { status: "false_positive" },
      adjudication: {
        status: "false_positive",
        note: "The canonical is injected at the edge before delivery.",
      },
    });
    expect(database.listIssues(baseline.id)[0]?.status).toBe("false_positive");
    expect(database.listActions(project.id)).toEqual([]);
    expect(
      database.listActions(project.id, { includeAdjudicated: true }),
    ).toHaveLength(1);

    const repeat = database.insertRun({
      id: "issue-run-2",
      projectId: project.id,
      workflowId: "audit",
    });
    database.replaceIssues(repeat.id, project.id, [
      issue("2026-07-16T10:00:00.000Z"),
    ]);
    expect(database.listIssues(repeat.id)[0]?.status).toBe("false_positive");
    expect(database.listProjectIssueReviews(project.id)).toMatchObject({
      total: 1,
      items: [{ occurrenceCount: 2, issue: { status: "false_positive" } }],
    });

    const reopened = database.updateIssueAdjudication(
      project.id,
      finding.fingerprint,
      { status: "open", actor: "local-user" },
    );
    expect(reopened).toMatchObject({
      issue: { status: "open" },
      adjudication: null,
    });
    expect(database.listActions(project.id)).toHaveLength(1);

    database.updateIssueAdjudication(project.id, finding.fingerprint, {
      status: "ignored",
      note: "Accepted until the legacy template is retired.",
      actor: "local-user",
    });
    const cleanRun = database.insertRun({
      id: "issue-run-3",
      projectId: project.id,
      workflowId: "audit",
    });
    database.replaceIssues(cleanRun.id, project.id, [], {
      resolveMissing: true,
    });
    expect(
      database.getProjectIssueReview(project.id, finding.fingerprint)?.issue
        .status,
    ).toBe("ignored");
    expect(
      database.updateIssueAdjudication(project.id, finding.fingerprint, {
        status: "open",
        actor: "local-user",
      })?.issue.status,
    ).toBe("resolved");

    const auditRows = database.db
      .prepare(
        "SELECT payload_json FROM audit_events WHERE action='issue.adjudication.update' ORDER BY id",
      )
      .all() as Array<{ payload_json: string }>;
    expect(auditRows).toHaveLength(4);
    expect(auditRows[0]?.payload_json).not.toContain("injected at the edge");
    expect(JSON.parse(auditRows[0]!.payload_json)).toEqual({
      projectId: project.id,
      from: "open",
      to: "false_positive",
      notePresent: true,
    });

    database.close();
  });

  it("narrows grouped actions per URL and hides them only when every live instance is reviewed", () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-action-review-scope-"));
    const database = new AgentSeoDatabase({ path: join(root, "agentseo.db") });
    const project = database.createProject({
      name: "Grouped review fixture",
      canonicalUrl: "https://example.com",
    });
    const run = database.insertRun({
      id: "grouped-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const at = "2026-07-15T10:00:00.000Z";
    const primary = issue(at);
    const secondary: IssueInstance = {
      ...issue(at),
      fingerprint: "b".repeat(64),
      canonicalUrl: "https://example.com/category",
    };
    database.replaceIssues(run.id, project.id, [primary, secondary]);
    const action: Action = {
      id: "grouped-canonical-action",
      projectId: project.id,
      ruleId: primary.ruleId,
      moduleId: primary.moduleId,
      issueFingerprint: primary.fingerprint,
      title: "Add canonical URLs",
      whyNow: "2 affected URLs. Organic exposure is unavailable.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 83,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["organic_exposure", "conversion_exposure"],
      },
      affectedUrls: [primary.canonicalUrl!, secondary.canonicalUrl!],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: at,
      updatedAt: at,
    };
    database.upsertActions([action]);
    database.replaceActionIssueLinks(
      run.id,
      project.id,
      [action],
      [primary, secondary],
    );

    database.updateIssueAdjudication(project.id, secondary.fingerprint, {
      status: "false_positive",
      note: "The category template injects a canonical at the edge.",
      actor: "local-user",
    });
    expect(database.listActionIssueScopes(project.id).get(action.id)).toEqual({
      actionId: action.id,
      currentInstances: 2,
      visibleInstances: 1,
      visibleUrls: [primary.canonicalUrl],
    });
    expect(database.listActions(project.id)).toMatchObject([
      {
        id: action.id,
        affectedUrls: [primary.canonicalUrl],
        whyNow: "1 affected URL. Organic exposure is unavailable.",
      },
    ]);

    database.updateIssueAdjudication(project.id, primary.fingerprint, {
      status: "ignored",
      note: "The product canonical exception is accepted temporarily.",
      actor: "local-user",
    });
    expect(database.listActions(project.id)).toEqual([]);

    database.updateIssueAdjudication(project.id, secondary.fingerprint, {
      status: "open",
      actor: "local-user",
    });
    expect(database.listActions(project.id)).toMatchObject([
      { id: action.id, affectedUrls: [secondary.canonicalUrl] },
    ]);

    database.close();
  });

  it("filters and paginates the review workspace without returning another site", () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-issue-filters-"));
    const database = new AgentSeoDatabase({ path: join(root, "agentseo.db") });
    const project = database.createProject({
      name: "Filter fixture",
      canonicalUrl: "https://filters.example.com",
    });
    const run = database.insertRun({
      id: "filter-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const at = "2026-07-15T10:00:00.000Z";
    const canonical = issue(at);
    const description: IssueInstance = {
      ...issue(at),
      fingerprint: "b".repeat(64),
      ruleId: "description-missing",
      severity: "medium",
      title: "Meta description is missing",
    };
    database.replaceIssues(run.id, project.id, [canonical, description]);

    expect(
      database.listProjectIssueReviews(project.id, {
        search: "DESCRIPTION",
        severity: "medium",
        limit: 1,
      }),
    ).toMatchObject({
      total: 1,
      offset: 0,
      limit: 1,
      items: [{ issue: { fingerprint: description.fingerprint } }],
    });
    expect(
      database.listProjectIssueReviews(project.id, { limit: 1, offset: 1 }),
    ).toMatchObject({ total: 2, offset: 1, limit: 1 });

    database.close();
  });
});
