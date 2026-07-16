import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Action, IssueInstance } from "@agentseoapp/contracts";
import {
  GOLEMSEO_PROJECT_BUNDLE_LIMITS,
  type GolemSeoProjectBundleV2,
} from "@agentseoapp/contracts/project-bundle";
import { GolemLocalRuntime, ProjectBundleError } from "./index.js";

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function resign(bundle: GolemSeoProjectBundleV2): void {
  const { integrity, ...payload } = bundle;
  integrity.bundleSha256 = hash(stableJson(payload));
}

async function createBundle(
  options: {
    issueTitle?: string;
    evidenceLabel?: string;
    actionTitle?: string;
    actionWhyNow?: string;
  } = {},
): Promise<{
  bytes: Uint8Array;
  fingerprint: string;
  sourceProjectId: string;
}> {
  const dataDir = mkdtempSync(join(tmpdir(), "golem-bundle-source-"));
  const runtime = new GolemLocalRuntime({ dataDir });
  try {
    const project = runtime.database.createProject({
      name: "Transfer fixture",
      canonicalUrl: "https://example.com/",
    });
    runtime.database.updateProjectSettings(project.id, {
      timezone: "Europe/London",
      reportingCurrency: "USD",
      weeklyDigest: true,
      alertEmail: "owner@example.com",
      dataRetentionDays: 365,
    });
    await runtime.extractionRules.update({
      projectId: project.id,
      rules: [
        {
          id: "portable-price",
          label: "Price",
          selector: "[itemprop='price']",
          type: "text",
          attribute: null,
          regex: null,
          enabled: true,
        },
      ],
      changeSummary: "Capture portable product evidence",
    });
    const runId = randomUUID();
    runtime.database.insertRun({
      id: runId,
      projectId: project.id,
      workflowId: "audit",
      options: {
        renderMode: "js",
        maxUrls: 17,
        exactUrls: ["https://example.com/", "https://example.com/pricing"],
        extractionRuleRevision: 1,
      },
    });
    const observedAt = new Date().toISOString();
    runtime.database.updateRun(runId, {
      status: "succeeded",
      startedAt: observedAt,
      completedAt: observedAt,
      progress: 1,
      issueCount: 1,
    });
    runtime.database.upsertRunModule({
      runId,
      moduleId: "core-audit",
      version: "0.11.0",
      status: "succeeded",
      startedAt: observedAt,
      completedAt: observedAt,
      durationMs: 12,
      coverage: 1,
    });
    runtime.database.replacePages(runId, [
      {
        canonicalUrl: "https://example.com/",
        statusCode: 200,
        title: "Home",
        indexable: true,
        payload: {
          evidenceVersion: 1,
          linkGraphVersion: 1,
          sourceUrl: "https://example.com/",
          crawlDepth: 0,
          internalLinks: [
            {
              targetUrl: "https://example.com/pricing",
              occurrences: 2,
              followOccurrences: 1,
              nofollowOccurrences: 1,
              anchorTexts: ["Pricing", "Compare plans"],
              placements: ["navigation", "main"],
            },
          ],
          canonical: "https://example.com/",
          localPath: "/Users/example/private/report.json",
          headers: { authorization: "Bearer definitely-not-exported" },
        },
      },
    ]);
    const fingerprint = "f".repeat(64);
    const issue: IssueInstance = {
      fingerprint,
      ruleId: "missing-description",
      moduleId: "core-audit",
      canonicalUrl: "https://example.com/",
      severity: "high",
      title: options.issueTitle ?? "Missing description",
      description: "The page has no meta description.",
      evidence: [
        {
          kind: "html",
          label: options.evidenceLabel ?? "Head element",
          value: { accessToken: "must-not-leave-the-machine", count: 1 },
          observedAt,
        },
      ],
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      status: "open",
    };
    runtime.database.replaceIssues(runId, project.id, [issue]);
    const action: Action = {
      id: randomUUID(),
      projectId: project.id,
      issueFingerprint: fingerprint,
      title: options.actionTitle ?? "Write a useful meta description",
      whyNow:
        options.actionWhyNow ??
        "The affected page is indexable and visible in search.",
      impact: 0.8,
      effort: "low",
      confidence: 0.9,
      priorityScore: 81,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.75,
        organicExposure: null,
        conversionExposure: null,
        urlReach: 1,
        confidence: 0.9,
        unavailable: ["gsc", "ga4"],
      },
      affectedUrls: ["https://example.com/"],
      owner: null,
      status: "open",
      verification: "pending",
      createdAt: observedAt,
      updatedAt: observedAt,
    };
    runtime.database.upsertActions([action]);
    runtime.database.updateIssueAdjudication(project.id, fingerprint, {
      status: "false_positive",
      note: "The canonical is injected by the verified edge response layer.",
      actor: "local-user",
    });
    await runtime.context.update({
      projectId: project.id,
      profile: {
        summary: "Turn search evidence into verified improvements.",
        audiences: ["Hands-on SEO leads"],
        markets: ["United States"],
        languages: ["English"],
        conversionGoals: ["Qualified demo request"],
        priorityTopics: ["Technical SEO automation"],
        competitors: ["example-competitor.com"],
        constraints: ["Legal review for comparative claims"],
      },
      changeSummary: "Established the shared SEO brief",
    });
    await runtime.context.update({
      projectId: project.id,
      profile: {
        summary: "Turn search evidence into verified improvements.",
        audiences: ["Hands-on SEO leads"],
        markets: ["United States", "United Kingdom"],
        languages: ["English"],
        conversionGoals: ["Qualified demo request"],
        priorityTopics: ["Technical SEO automation"],
        competitors: ["example-competitor.com"],
        constraints: ["Legal review for comparative claims"],
      },
      changeSummary: "Added the United Kingdom market",
    });
    await runtime.context.append({
      projectId: project.id,
      kind: "observation",
      title: "Comparison pages attract qualified teams",
      detail: "Search demand supports an evidence-led comparison page.",
      sourceRunId: runId,
    });
    await runtime.context.append({
      projectId: project.id,
      kind: "decision",
      title: "Prioritize verifiable fixes",
      detail: "Require a baseline and a repeat audit before claiming impact.",
    });
    runtime.database.upsertMetric(project.id, runId, "seoHealth", {
      value: 0.82,
      state: "available",
      source: "crawl",
      observedAt,
      coverage: 1,
    });
    runtime.database.createSchedule({
      projectId: project.id,
      cron: "0 8 * * 1",
      timezone: "Europe/London",
      enabled: true,
      nextRunAt: "2030-01-07T08:00:00.000Z",
    });
    runtime.database.setProjectIntegrationConfiguration(
      project.id,
      "google-search-console",
      {
        siteUrl: "sc-domain:example.com",
        apiKey: "must-not-be-exported",
        headers: { cookie: "must-not-be-exported" },
      },
    );
    runtime.database.upsertIntegration({
      provider: "serpapi",
      label: "SerpAPI",
      status: "connected",
      secretRef: "serpapi/default/api-key",
      maskedIdentifier: "••••cdef",
      scopes: [],
      lastSyncAt: null,
      nextSyncAt: null,
      expiresAt: null,
      quota: null,
      configuration: { location: "London, England, United Kingdom" },
    });
    const projectDirectory = join(dataDir, "projects", project.id);
    mkdirSync(projectDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(projectDirectory, "custom-rules.json"),
      JSON.stringify({
        rules: [
          {
            id: "legal-footer",
            name: "Legal footer",
            category: "Compliance",
            priority: "High",
            match: "contains",
            value: "Legal notice",
            expect: "present",
            fix: "Add the legal notice to the footer.",
          },
        ],
      }),
      { mode: 0o600 },
    );

    const report = Buffer.from('{"health":82,"status":"complete"}');
    const artifactDirectory = join(dataDir, "artifacts", runId);
    mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
    const artifactPath = join(artifactDirectory, "report.json");
    writeFileSync(artifactPath, report, { mode: 0o600 });
    runtime.database.saveArtifact({
      id: randomUUID(),
      runId,
      kind: "report.json",
      path: artifactPath,
      mediaType: "application/json",
      sizeBytes: report.byteLength,
      sha256: hash(report),
    });

    return {
      bytes: await runtime.exportProject(project.id),
      fingerprint,
      sourceProjectId: project.id,
    };
  } finally {
    runtime.close();
  }
}

describe(".golemseo project bundles", () => {
  it("round-trips history and embedded reports while remapping every local id", async () => {
    const source = await createBundle();
    const serialized = Buffer.from(source.bytes).toString("utf8");
    const bundle = JSON.parse(serialized) as GolemSeoProjectBundleV2;
    expect(bundle.version).toBe(2);
    expect(bundle.secretsIncluded).toBe(false);
    expect(bundle.runConfigurations).toEqual([
      {
        runId: bundle.runs[0]?.id,
        options: {
          renderMode: "js",
          maxUrls: 17,
          exactUrls: ["https://example.com/", "https://example.com/pricing"],
          extractionRuleRevision: 1,
        },
      },
    ]);
    expect(bundle.extractionRuleVersions).toMatchObject([
      {
        revision: 1,
        rules: [{ id: "portable-price", label: "Price" }],
      },
    ]);
    expect(bundle.artifacts[0]).toMatchObject({ contentIncluded: true });
    expect(bundle.pages[0]?.payload).toMatchObject({
      linkGraphVersion: 1,
      internalLinks: [
        {
          targetUrl: "https://example.com/pricing",
          occurrences: 2,
          anchorTexts: ["Pricing", "Compare plans"],
        },
      ],
    });
    expect(bundle.issueAdjudications).toMatchObject([
      {
        fingerprint: source.fingerprint,
        status: "false_positive",
        note: "The canonical is injected by the verified edge response layer.",
      },
    ]);
    expect(bundle.projectContext).toMatchObject({
      versions: [
        { revision: 1, changeSummary: "Established the shared SEO brief" },
        { revision: 2, changeSummary: "Added the United Kingdom market" },
      ],
      journal: [
        {
          sequence: 1,
          title: "Comparison pages attract qualified teams",
          sourceRunId: bundle.runs[0]?.id,
        },
        {
          sequence: 2,
          title: "Prioritize verifiable fixes",
          sourceRunId: null,
        },
      ],
    });
    expect(serialized).not.toContain("must-not-be-exported");
    expect(serialized).not.toContain("must-not-leave-the-machine");
    expect(serialized).not.toContain("/Users/example/private");
    expect(serialized).not.toContain('"secretRef"');

    const destination = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-bundle-destination-")),
    });
    try {
      const first = await destination.importProject(source.bytes);
      const second = await destination.importProject(source.bytes);
      expect(first.sourceProjectId).toBe(source.sourceProjectId);
      expect(first.project.id).not.toBe(source.sourceProjectId);
      expect(second.project.id).not.toBe(first.project.id);
      expect(first.project.canonicalUrl).toBe("https://example.com/");
      expect(first.counts).toMatchObject({
        runs: 1,
        runModules: 1,
        pages: 1,
        issues: 1,
        issueAdjudications: 1,
        contextVersions: 2,
        contextEntries: 2,
        extractionRuleVersions: 1,
        actions: 1,
        metrics: 1,
        schedules: 1,
        connectors: 2,
        customRules: 1,
        artifacts: 1,
      });
      expect(first.schedulesDisabled).toBe(true);
      expect(first.reconnectProviders).toEqual([
        "google-search-console",
        "serpapi",
      ]);
      expect(
        destination.database.listSchedules(first.project.id)[0]?.enabled,
      ).toBe(false);
      const importedRun = destination.database.listRuns(first.project.id)[0]!;
      expect(importedRun.id).not.toBe(bundle.runs[0]?.id);
      expect(destination.database.getRunOptions(importedRun.id)).toEqual({
        renderMode: "js",
        maxUrls: 17,
        exactUrls: ["https://example.com/", "https://example.com/pricing"],
        extractionRuleRevision: 1,
      });
      await expect(
        destination.runs.links(importedRun.id, {
          pageUrl: "https://example.com/",
          direction: "outlinks",
          limit: 50,
          offset: 0,
        }),
      ).resolves.toMatchObject({
        version: "link-graph-v1",
        runId: importedRun.id,
        state: "available",
        summary: {
          outlinkTargets: 1,
          outlinkOccurrences: 2,
          uncrawledOutlinkTargets: 1,
        },
        items: [
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/pricing",
            targetState: "uncrawled",
            occurrences: 2,
            followOccurrences: 1,
            nofollowOccurrences: 1,
            anchorTexts: ["Pricing", "Compare plans"],
            placements: ["navigation", "main"],
          },
        ],
      });
      await expect(
        destination.extractionRules.get(first.project.id),
      ).resolves.toMatchObject({
        current: { revision: 1, rules: [{ id: "portable-price" }] },
      });
      expect(
        destination.database.listIssues(importedRun.id)[0]?.fingerprint,
      ).toBe(source.fingerprint);
      expect(destination.database.listIssues(importedRun.id)[0]?.status).toBe(
        "false_positive",
      );
      expect(
        destination.database.listIssueAdjudications(first.project.id),
      ).toMatchObject([
        {
          fingerprint: source.fingerprint,
          status: "false_positive",
          note: "The canonical is injected by the verified edge response layer.",
        },
      ]);
      expect(await destination.context.get(first.project.id)).toMatchObject({
        current: {
          revision: 2,
          profile: { markets: ["United States", "United Kingdom"] },
        },
        history: [{ revision: 2 }, { revision: 1 }],
        journal: [
          { sequence: 2, sourceRunId: null },
          { sequence: 1, sourceRunId: importedRun.id },
        ],
      });
      const importedAction = destination.database.listActions(
        first.project.id,
        { includeAdjudicated: true },
      )[0]!;
      expect(importedAction.id).not.toBe(bundle.actions[0]?.id);
      expect(importedAction.issueFingerprint).toBe(source.fingerprint);
      expect(
        destination.database
          .listActionIssueScopes(first.project.id)
          .get(importedAction.id),
      ).toMatchObject({
        currentInstances: 1,
        visibleInstances: 0,
      });
      await expect(destination.actions.list(first.project.id)).resolves.toEqual(
        [],
      );
      expect(
        destination.database.listProjectIntegrationConfigurations(
          first.project.id,
        )[0]?.configuration,
      ).toEqual({ siteUrl: "sc-domain:example.com" });
      expect(
        destination.database.listProjectIntegrationConfigurations(
          first.project.id,
        )[1]?.configuration,
      ).toEqual({ location: "London, England, United Kingdom" });
      expect(
        readFileSync(
          join(
            destination.dataDir,
            "projects",
            first.project.id,
            "custom-rules.json",
          ),
          "utf8",
        ),
      ).toContain("legal-footer");
      const report = await destination.reports.get(importedRun.id, "json");
      expect(Buffer.from(report!).toString("utf8")).toContain('"health":82');

      const reexported = Buffer.from(
        await destination.exportProject(first.project.id),
      ).toString("utf8");
      expect(reexported).not.toContain(destination.dataDir);

      const replay = await destination.runs.replay(
        importedRun.id,
        "imported-run-replay",
      );
      expect(replay).not.toBeNull();
      expect(destination.database.getRunOptions(replay!.run.id)).toEqual(
        destination.database.getRunOptions(importedRun.id),
      );
      await destination.runs.cancel(replay!.run.id);
    } finally {
      destination.close();
    }
  });

  it("bounds legacy issue and action text before validating a portable bundle", async () => {
    const source = await createBundle({
      issueTitle: "Issue ".repeat(100),
      evidenceLabel: "Evidence ".repeat(100),
      actionTitle: "Action ".repeat(100),
      actionWhyNow: "Reason ".repeat(1_000),
    });
    const bundle = JSON.parse(
      Buffer.from(source.bytes).toString("utf8"),
    ) as GolemSeoProjectBundleV2;
    expect(Array.from(bundle.issues[0]!.issue.title)).toHaveLength(240);
    expect(Array.from(bundle.issues[0]!.issue.evidence[0]!.label)).toHaveLength(
      240,
    );
    expect(Array.from(bundle.actions[0]!.title)).toHaveLength(240);
    expect(Array.from(bundle.actions[0]!.whyNow)).toHaveLength(2_000);

    const destination = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-bundle-bounded-")),
    });
    try {
      await expect(
        destination.importProject(source.bytes),
      ).resolves.toMatchObject({ counts: { issues: 1, actions: 1 } });
    } finally {
      destination.close();
    }
  });

  it("keeps earlier version 2 bundles without optional review and context sections importable", async () => {
    const source = await createBundle();
    const bundle = JSON.parse(
      Buffer.from(source.bytes).toString("utf8"),
    ) as GolemSeoProjectBundleV2;
    delete bundle.issueAdjudications;
    delete bundle.projectContext;
    delete bundle.extractionRuleVersions;
    delete bundle.runConfigurations;
    resign(bundle);

    const destination = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-bundle-v2-compat-")),
    });
    try {
      const imported = await destination.importProject(bundle);
      expect(imported.counts.issueAdjudications).toBe(0);
      expect(imported.counts.contextVersions).toBe(0);
      expect(imported.counts.contextEntries).toBe(0);
      expect(imported.counts.extractionRuleVersions).toBe(0);
      expect(
        destination.database.listIssueAdjudications(imported.project.id),
      ).toEqual([]);
      await expect(
        destination.context.get(imported.project.id),
      ).resolves.toEqual({
        projectId: imported.project.id,
        current: null,
        history: [],
        journal: [],
      });
    } finally {
      destination.close();
    }
  });

  it("rejects malformed, oversized, tampered, secret-bearing and traversing files without writes", async () => {
    const source = await createBundle();
    const valid = JSON.parse(
      Buffer.from(source.bytes).toString("utf8"),
    ) as GolemSeoProjectBundleV2;
    const destination = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-bundle-malicious-")),
    });
    try {
      await expect(
        destination.importProject("{not-json"),
      ).rejects.toMatchObject({
        code: "invalid_bundle_json",
      });
      await expect(
        destination.importProject(
          new Uint8Array(GOLEMSEO_PROJECT_BUNDLE_LIMITS.maxBytes + 1),
        ),
      ).rejects.toMatchObject({ code: "bundle_too_large", status: 413 });

      const tampered = structuredClone(valid);
      tampered.project.name = "Tampered";
      await expect(destination.importProject(tampered)).rejects.toMatchObject({
        code: "bundle_checksum_mismatch",
      });

      const secret = structuredClone(valid);
      secret.connectors[0]!.configuration.apiKey = "sk_live_1234567890abcdef";
      await expect(destination.importProject(secret)).rejects.toMatchObject({
        code: "secret_material_rejected",
      });

      const localPath = structuredClone(valid);
      localPath.pages[0]!.payload.localPath = "/Users/max/.ssh/id_ed25519";
      await expect(destination.importProject(localPath)).rejects.toMatchObject({
        code: "secret_material_rejected",
      });

      const secretContext = structuredClone(valid);
      secretContext.projectContext!.journal[0]!.detail =
        "apiKey=sk_live_1234567890abcdef";
      resign(secretContext);
      await expect(
        destination.importProject(secretContext),
      ).rejects.toMatchObject({ code: "secret_material_rejected" });

      const orphanedRunConfiguration = structuredClone(valid);
      orphanedRunConfiguration.runConfigurations![0]!.runId = "missing-run";
      resign(orphanedRunConfiguration);
      await expect(
        destination.importProject(orphanedRunConfiguration),
      ).rejects.toMatchObject({ code: "orphaned_bundle_record" });

      const missingExtractionRevision = structuredClone(valid);
      missingExtractionRevision.runConfigurations![0]!.options.extractionRuleRevision = 99;
      resign(missingExtractionRevision);
      await expect(
        destination.importProject(missingExtractionRevision),
      ).rejects.toMatchObject({ code: "invalid_project_bundle" });

      const skippedContextSequence = structuredClone(valid);
      skippedContextSequence.projectContext!.journal[1]!.sequence = 3;
      resign(skippedContextSequence);
      await expect(
        destination.importProject(skippedContextSequence),
      ).rejects.toMatchObject({ code: "invalid_project_bundle" });

      const traversal = structuredClone(valid) as unknown as {
        artifacts: Array<{ kind: string }>;
      };
      traversal.artifacts[0]!.kind = "../../outside.json";
      await expect(destination.importProject(traversal)).rejects.toMatchObject({
        code: "invalid_project_bundle",
      });

      const badArtifact = structuredClone(valid);
      const embedded = badArtifact.artifacts.find(
        (artifact) => artifact.contentIncluded,
      );
      expect(embedded?.contentIncluded).toBe(true);
      if (embedded?.contentIncluded) embedded.sha256 = "0".repeat(64);
      resign(badArtifact);
      await expect(
        destination.importProject(badArtifact),
      ).rejects.toMatchObject({
        code: "artifact_checksum_mismatch",
      });

      const unsafeRegex = structuredClone(valid);
      unsafeRegex.customRules[0] = {
        id: "catastrophic",
        name: "Unsafe regex",
        category: "Content",
        priority: "High",
        match: "regex",
        pattern: "(a+)+$",
        expect: "present",
      };
      resign(unsafeRegex);
      await expect(
        destination.importProject(unsafeRegex),
      ).rejects.toMatchObject({
        code: "unsafe_custom_rule_regex",
      });

      expect(destination.database.listProjects()).toHaveLength(0);
    } finally {
      destination.close();
    }
  });

  it("uses a typed error for absent projects", async () => {
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-bundle-absent-")),
    });
    try {
      await expect(runtime.exportProject("missing")).rejects.toBeInstanceOf(
        ProjectBundleError,
      );
    } finally {
      runtime.close();
    }
  });

  it("fails export instead of silently dropping an unreadable custom-rule source", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-bundle-rule-io-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    try {
      const project = runtime.database.createProject({
        name: "Unreadable rules",
        canonicalUrl: "https://rules.example/",
      });
      mkdirSync(join(dataDir, "projects", project.id, "custom-rules.json"), {
        recursive: true,
      });
      await expect(runtime.exportProject(project.id)).rejects.toMatchObject({
        code: "invalid_custom_rule",
      });
    } finally {
      runtime.close();
    }
  });
});
