import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectContextProfile } from "@agentseoapp/contracts";
import { AgentSeoLocalRuntime } from "./index.js";

const profile = (overrides: Partial<ProjectContextProfile> = {}) => ({
  summary: "  Turn crawl and search evidence into verified actions.  ",
  audiences: [" SEO leads ", "seo LEADS", "Growth teams"],
  markets: ["United States"],
  languages: ["English"],
  conversionGoals: ["Qualified demo request"],
  priorityTopics: ["Technical SEO automation"],
  competitors: ["example-competitor.com"],
  constraints: ["Legal review for comparative claims"],
  ...overrides,
});

describe("project context runtime boundary", () => {
  it("normalizes reusable context while preserving immutable revisions and linked journal evidence", async () => {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-runtime-context-")),
    });
    try {
      const project = await runtime.projects.create({
        name: "Context runtime",
        canonicalUrl: "https://example.com",
      });
      const run = runtime.database.insertRun({
        id: "context-runtime-run",
        projectId: project.id,
        workflowId: "audit",
      });

      const first = await runtime.context.update({
        projectId: project.id,
        profile: profile(),
        changeSummary: "  Established the reusable SEO brief  ",
      });
      expect(first).toMatchObject({
        current: {
          revision: 1,
          changeSummary: "Established the reusable SEO brief",
          actor: "local-user",
          profile: {
            summary: "Turn crawl and search evidence into verified actions.",
            audiences: ["SEO leads", "Growth teams"],
          },
        },
      });

      await runtime.context.update({
        projectId: project.id,
        profile: profile({ markets: ["United States", "United Kingdom"] }),
        changeSummary: "Added the United Kingdom market",
      });
      const entry = await runtime.context.append({
        projectId: project.id,
        kind: "experiment",
        title: "  Test evidence-led comparison pages  ",
        detail:
          "  Compare qualified organic demand before and after publication.  ",
        sourceRunId: run.id,
      });

      expect(entry).toMatchObject({
        projectId: project.id,
        sequence: 1,
        kind: "experiment",
        title: "Test evidence-led comparison pages",
        detail:
          "Compare qualified organic demand before and after publication.",
        sourceRunId: run.id,
        actor: "local-user",
      });
      await expect(runtime.context.get(project.id)).resolves.toMatchObject({
        current: {
          revision: 2,
          profile: { markets: ["United States", "United Kingdom"] },
        },
        history: [{ revision: 2 }, { revision: 1 }],
        journal: [{ sequence: 1, sourceRunId: run.id }],
      });
    } finally {
      runtime.close();
    }
  });

  it("rejects malformed, secret-like, local-path, and cross-project material", async () => {
    const runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-runtime-context-safety-")),
    });
    try {
      const project = await runtime.projects.create({
        name: "Safe context",
        canonicalUrl: "https://example.com",
      });
      const other = await runtime.projects.create({
        name: "Other context",
        canonicalUrl: "https://other.example.com",
      });
      const foreignRun = runtime.database.insertRun({
        id: "foreign-context-runtime-run",
        projectId: other.id,
        workflowId: "audit",
      });

      await expect(
        runtime.context.update({
          projectId: project.id,
          profile: profile({ summary: "apiKey=super-secret-provider-value" }),
          changeSummary: "Added unsafe material",
        }),
      ).rejects.toMatchObject({
        code: "secret_material_rejected",
        status: 422,
      });
      await expect(
        runtime.context.update({
          projectId: project.id,
          profile: profile(),
          changeSummary: "x",
        }),
      ).rejects.toMatchObject({
        code: "invalid_project_context",
        status: 422,
      });
      await expect(
        runtime.context.append({
          projectId: project.id,
          kind: "observation",
          title: "Local report path",
          detail: "Review the private report at /Users/example/seo/report.json",
        }),
      ).rejects.toMatchObject({
        code: "local_path_rejected",
        status: 422,
      });
      await expect(
        runtime.context.append({
          projectId: project.id,
          kind: "decision",
          title: "Do not link foreign evidence",
          detail: "The cited run must belong to the selected project.",
          sourceRunId: foreignRun.id,
        }),
      ).rejects.toMatchObject({
        code: "invalid_source_run",
        status: 422,
      });
      await expect(runtime.context.get("missing-project")).resolves.toBeNull();
    } finally {
      runtime.close();
    }
  });
});
