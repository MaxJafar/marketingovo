import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@marketingovo/contracts";
import { AgentSeoDatabase } from "./database.js";

const observedAt = "2026-07-15T12:00:00.000Z";

function issue(fingerprint: string, canonicalUrl: string): IssueInstance {
  return {
    fingerprint,
    ruleId: "missing-title",
    moduleId: "core-audit",
    canonicalUrl,
    severity: "high",
    title: "Page title is missing",
    description: "The page has no title element.",
    evidence: [{ kind: "crawl", label: "Missing title" }],
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    status: "open",
  };
}

describe("project deletion storage", () => {
  it("deletes one complete project graph while preserving shared issue definitions and global credentials", () => {
    const root = mkdtempSync(join(tmpdir(), "marketingovo-project-deletion-"));
    const database = new AgentSeoDatabase({
      path: join(root, "marketingovo.db"),
    });
    const first = database.createProject({
      name: "Delete me",
      canonicalUrl: "https://delete.example",
    });
    const second = database.createProject({
      name: "Keep me",
      canonicalUrl: "https://keep.example",
    });
    const firstRun = database.insertRun({
      id: "delete-run",
      projectId: first.id,
      workflowId: "audit",
    });
    const secondRun = database.insertRun({
      id: "keep-run",
      projectId: second.id,
      workflowId: "audit",
    });
    const fingerprint = "d".repeat(64);
    database.replaceIssues(firstRun.id, first.id, [
      issue(fingerprint, "https://delete.example/"),
    ]);
    database.replaceIssues(secondRun.id, second.id, [
      issue(fingerprint, "https://keep.example/"),
    ]);
    database.db
      .prepare(
        `INSERT INTO pages
        (run_id,canonical_url,status_code,title,indexable,payload_json)
        VALUES(?,?,?,?,?,?)`,
      )
      .run(firstRun.id, "https://delete.example/", 200, null, 1, "{}");
    const action: Action = {
      id: "delete-action",
      projectId: first.id,
      ruleId: "missing-title",
      moduleId: "core-audit",
      issueFingerprint: fingerprint,
      title: "Add a useful page title",
      whyNow: "1 affected URL.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 78,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["organic_exposure", "conversion_exposure"],
      },
      affectedUrls: ["https://delete.example/"],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: observedAt,
      updatedAt: observedAt,
    };
    database.upsertActions([action]);
    database.createSchedule({
      projectId: first.id,
      cron: "0 8 * * 1",
      timezone: "UTC",
      enabled: true,
      nextRunAt: "2026-07-20T08:00:00.000Z",
    });
    database.saveArtifact({
      id: "delete-artifact",
      runId: firstRun.id,
      kind: "report.json",
      path: join(root, "artifacts", firstRun.id, "report.json"),
      mediaType: "application/json",
      sizeBytes: 2,
      sha256: "a".repeat(64),
    });
    database.updateProjectContext(
      first.id,
      {
        summary: "A project that will be deleted.",
        audiences: [],
        markets: [],
        languages: ["English"],
        conversionGoals: [],
        priorityTopics: [],
        competitors: [],
        constraints: [],
      },
      "Initial context",
      "local-user",
    );
    database.appendProjectContextJournal({
      projectId: first.id,
      kind: "decision",
      title: "Retire the fixture",
      detail: "The local project is no longer needed.",
      sourceRunId: firstRun.id,
      actor: "local-user",
    });
    database.upsertIntegration({
      provider: "serpapi",
      label: "SerpAPI",
      status: "connected",
      secretRef: "serpapi/default/api-key",
      maskedIdentifier: "••••1234",
      scopes: [],
      lastSyncAt: null,
      nextSyncAt: null,
      expiresAt: null,
      quota: null,
    });

    expect(
      database.deleteProject(first.id, "2026-07-15T13:00:00.000Z"),
    ).toEqual({
      runs: 1,
      pages: 1,
      issueInstances: 1,
      actions: 1,
      schedules: 1,
      artifacts: 1,
      contextVersions: 1,
      contextEntries: 1,
      extractionRuleVersions: 0,
    });
    expect(database.getProject(first.id)).toBeNull();
    expect(database.getRun(firstRun.id)).toBeNull();
    expect(database.listActions(first.id)).toEqual([]);
    expect(database.getProjectContext(first.id)).toBeNull();
    expect(database.getProject(second.id)).not.toBeNull();
    expect(database.listIssues(secondRun.id)).toHaveLength(1);
    expect(database.listIntegrations()).toHaveLength(1);
    expect(
      Number(
        (
          database.db.prepare("SELECT COUNT(*) AS count FROM issues").get() as {
            count: number;
          }
        ).count,
      ),
    ).toBe(1);

    const deletionEvent = database.db
      .prepare(
        "SELECT entity_id,payload_json FROM audit_events WHERE action='project.delete'",
      )
      .get() as { entity_id: string; payload_json: string };
    expect(deletionEvent.entity_id).toBe(first.id);
    expect(deletionEvent.payload_json).not.toContain("Delete me");
    expect(JSON.parse(deletionEvent.payload_json)).toMatchObject({
      counts: { runs: 1, artifacts: 1 },
    });
    expect(
      database.db
        .prepare(
          `SELECT action FROM audit_events
          WHERE entity_id=? OR payload_json LIKE ? ORDER BY id`,
        )
        .all(first.id, `%${first.id}%`),
    ).toEqual([{ action: "project.delete" }]);

    expect(database.deleteProject(first.id)).toBeNull();
    expect(database.deleteProject(second.id)).not.toBeNull();
    expect(
      Number(
        (
          database.db.prepare("SELECT COUNT(*) AS count FROM issues").get() as {
            count: number;
          }
        ).count,
      ),
    ).toBe(0);
    database.close();
  });
});
