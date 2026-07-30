import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@marketingovo/contracts";
import { AgentSeoLocalRuntime } from "./index.js";

describe("issue adjudication runtime boundary", () => {
  it("requires an evidence-based note and rejects secret-like material", async () => {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-runtime-issue-review-"),
      ),
    });
    try {
      const project = await runtime.projects.create({
        name: "Review runtime",
        canonicalUrl: "https://example.com",
      });
      const run = runtime.database.insertRun({
        id: "runtime-review-run",
        projectId: project.id,
        workflowId: "audit",
      });
      const at = "2026-07-15T12:00:00.000Z";
      const issue: IssueInstance = {
        fingerprint: "c".repeat(64),
        ruleId: "viewport-missing",
        moduleId: "mobile",
        canonicalUrl: "https://example.com/",
        severity: "medium",
        title: "Viewport metadata is missing",
        description: "Mobile rendering may use a desktop layout viewport.",
        evidence: [{ kind: "html", label: "Viewport tag count", value: 0 }],
        firstSeenAt: at,
        lastSeenAt: at,
        status: "open",
      };
      runtime.database.replaceIssues(run.id, project.id, [issue]);

      await expect(
        runtime.issues.update(issue.fingerprint, {
          projectId: project.id,
          status: "ignored",
        }),
      ).rejects.toMatchObject({
        code: "adjudication_note_required",
        status: 422,
      });
      await expect(
        runtime.issues.update(issue.fingerprint, {
          projectId: project.id,
          status: "false_positive",
          note: "apiKey=super-secret-provider-value",
        }),
      ).rejects.toMatchObject({
        code: "secret_material_rejected",
        status: 422,
      });

      await expect(
        runtime.issues.update(issue.fingerprint, {
          projectId: project.id,
          status: "ignored",
          note: "The mobile app shell injects a validated viewport element.",
        }),
      ).resolves.toMatchObject({
        issue: { status: "ignored" },
        adjudication: { actor: "local-user" },
      });
    } finally {
      runtime.close();
    }
  });

  it("re-scores the remaining action scope and suppresses only a fully reviewed group", async () => {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-runtime-action-scope-"),
      ),
    });
    try {
      const project = await runtime.projects.create({
        name: "Scoped action runtime",
        canonicalUrl: "https://example.com",
      });
      const run = runtime.database.insertRun({
        id: "runtime-action-scope-run",
        projectId: project.id,
        workflowId: "audit",
      });
      const at = "2026-07-15T12:00:00.000Z";
      const first: IssueInstance = {
        fingerprint: "d".repeat(64),
        ruleId: "thin-content",
        moduleId: "content",
        canonicalUrl: "https://example.com/one",
        severity: "high",
        title: "Thin content",
        description: "The page has too little unique copy.",
        evidence: [{ kind: "text", label: "Word count", value: 40 }],
        firstSeenAt: at,
        lastSeenAt: at,
        status: "open",
      };
      const second: IssueInstance = {
        ...first,
        fingerprint: "e".repeat(64),
        canonicalUrl: "https://example.com/two",
      };
      runtime.database.replaceIssues(run.id, project.id, [first, second]);
      const action: Action = {
        id: "runtime-thin-content-action",
        projectId: project.id,
        ruleId: first.ruleId,
        moduleId: first.moduleId,
        issueFingerprint: first.fingerprint,
        title: "Improve thin pages",
        whyNow: "2 affected URLs. Organic exposure is unavailable.",
        impact: 0.75,
        effort: "medium",
        confidence: 0.8,
        priorityScore: 70,
        scoreVersion: "priority-v1",
        scoreInputs: {
          severity: 0.8,
          organicExposure: null,
          conversionExposure: null,
          urlReach: 0.5,
          confidence: 0.8,
          unavailable: ["organic_exposure", "conversion_exposure"],
        },
        affectedUrls: [first.canonicalUrl!, second.canonicalUrl!],
        owner: null,
        status: "open",
        verification: "pending",
        createdAt: at,
        updatedAt: at,
      };
      runtime.database.upsertActions([action]);
      runtime.database.replaceActionIssueLinks(
        run.id,
        project.id,
        [action],
        [first, second],
      );

      await runtime.issues.update(second.fingerprint, {
        projectId: project.id,
        status: "false_positive",
        note: "This page is intentionally a short navigational landing page.",
      });
      const narrowed = await runtime.actions.list(project.id);
      expect(narrowed).toMatchObject([
        {
          id: action.id,
          affectedUrls: [first.canonicalUrl],
          whyNow: "1 affected URL. Organic exposure is unavailable.",
          scoreInputs: { urlReach: 0.25, confidence: 0.8 },
        },
      ]);
      expect(narrowed[0]!.priorityScore).toBeLessThan(action.priorityScore);

      await runtime.issues.update(first.fingerprint, {
        projectId: project.id,
        status: "ignored",
        note: "This page is intentionally concise for a single conversion.",
      });
      await expect(runtime.actions.list(project.id)).resolves.toEqual([]);
      await expect(
        runtime.projects.overview(project.id),
      ).resolves.toMatchObject({ topActions: [] });
    } finally {
      runtime.close();
    }
  });
});
