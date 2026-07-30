import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectContextProfile } from "@marketingovo/contracts";
import { MarketingovoDatabase } from "./database.js";

const profile = (
  summary: string,
  markets: string[],
): ProjectContextProfile => ({
  summary,
  audiences: ["Hands-on SEO leads"],
  markets,
  languages: ["English"],
  conversionGoals: ["Qualified demo request"],
  priorityTopics: ["Technical SEO automation"],
  competitors: ["example-competitor.com"],
  constraints: ["Legal review is required for comparative claims"],
});

describe("project context storage", () => {
  it("keeps profile revisions and journal entries immutable, ordered, scoped, and out of audit payloads", () => {
    const root = mkdtempSync(join(tmpdir(), "marketingovo-project-context-"));
    const database = new MarketingovoDatabase({
      path: join(root, "marketingovo.db"),
    });
    const project = database.createProject({
      name: "Context fixture",
      canonicalUrl: "https://example.com",
    });
    const otherProject = database.createProject({
      name: "Other fixture",
      canonicalUrl: "https://other.example.com",
    });
    const sourceRun = database.insertRun({
      id: "context-source-run",
      projectId: project.id,
      workflowId: "audit",
    });
    const foreignRun = database.insertRun({
      id: "foreign-context-run",
      projectId: otherProject.id,
      workflowId: "audit",
    });

    expect(database.getProjectContext(project.id)).toEqual({
      projectId: project.id,
      current: null,
      history: [],
      journal: [],
    });
    expect(database.getProjectContext("missing-project")).toBeNull();

    database.updateProjectContext(
      project.id,
      profile("Sell a local-first SEO operations system.", ["United States"]),
      "Established the initial positioning",
      "local-user",
    );
    database.updateProjectContext(
      project.id,
      profile("Help growth teams verify SEO improvements.", [
        "United States",
        "United Kingdom",
      ]),
      "Added the UK market and verification goal",
      "local-user",
    );

    const firstJournal = database.appendProjectContextJournal({
      projectId: project.id,
      kind: "observation",
      title: "Comparison pages attract qualified teams",
      detail:
        "The latest crawl and search data show demand for evidence-led comparison pages.",
      sourceRunId: sourceRun.id,
      actor: "local-user",
    });
    const secondJournal = database.appendProjectContextJournal({
      projectId: project.id,
      kind: "decision",
      title: "Prioritize verifiable technical fixes",
      detail:
        "The team will ship fixes only when a baseline and a repeat audit can verify the outcome.",
      sourceRunId: null,
      actor: "local-user",
    });

    expect(firstJournal).toMatchObject({
      projectId: project.id,
      sequence: 1,
      sourceRunId: sourceRun.id,
    });
    expect(secondJournal).toMatchObject({
      projectId: project.id,
      sequence: 2,
      sourceRunId: null,
    });
    expect(() =>
      database.appendProjectContextJournal({
        projectId: project.id,
        kind: "constraint",
        title: "Foreign evidence must not link",
        detail: "A journal entry cannot cite a run from another project.",
        sourceRunId: foreignRun.id,
        actor: "local-user",
      }),
    ).toThrow(/does not belong to this project/u);

    const workspace = database.getProjectContext(project.id)!;
    expect(workspace.current).toMatchObject({
      revision: 2,
      changeSummary: "Added the UK market and verification goal",
      profile: { markets: ["United States", "United Kingdom"] },
    });
    expect(workspace.history.map((version) => version.revision)).toEqual([
      2, 1,
    ]);
    expect(workspace.journal.map((entry) => entry.sequence)).toEqual([2, 1]);

    workspace.history[1]!.profile.markets.push("Mutated in test memory");
    expect(database.listProjectContextVersions(project.id)[0]).toMatchObject({
      revision: 1,
      profile: { markets: ["United States"] },
    });
    expect(database.listProjectContextJournal(project.id)).toMatchObject([
      { sequence: 1, sourceRunId: sourceRun.id },
      { sequence: 2, sourceRunId: null },
    ]);

    const auditRows = database.db
      .prepare(
        `SELECT action,payload_json FROM audit_events
         WHERE action LIKE 'project.context.%' ORDER BY id`,
      )
      .all() as Array<{ action: string; payload_json: string }>;
    expect(auditRows).toHaveLength(4);
    const serializedAudit = JSON.stringify(auditRows);
    expect(serializedAudit).not.toContain("local-first SEO operations");
    expect(serializedAudit).not.toContain("Comparison pages attract");
    expect(serializedAudit).not.toContain("baseline and a repeat audit");
    expect(JSON.parse(auditRows[0]!.payload_json)).toEqual({
      projectId: project.id,
      revision: 1,
      summaryPresent: true,
      listItemCount: 7,
    });
    expect(JSON.parse(auditRows[2]!.payload_json)).toEqual({
      projectId: project.id,
      sequence: 1,
      kind: "observation",
      sourceRunPresent: true,
    });

    database.close();
  });
});
