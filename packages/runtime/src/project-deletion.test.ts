import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "./index.js";

describe("project deletion runtime", () => {
  let runtime: MarketingovoLocalRuntime | undefined;

  afterEach(() => runtime?.close());

  it("requires exact confirmation and removes deterministic project files without touching global credentials", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    runtime = new MarketingovoLocalRuntime({ dataDir });
    const project = await runtime.projects.create({
      name: "Exact Project Name",
      canonicalUrl: "https://delete.example",
    });
    const run = runtime.database.insertRun({
      id: "project-delete-run",
      projectId: project.id,
      workflowId: "audit",
    });
    runtime.database.updateRun(run.id, {
      status: "succeeded",
      startedAt: "2026-07-15T12:00:00.000Z",
      completedAt: "2026-07-15T12:01:00.000Z",
      progress: 1,
    });
    const normalArtifactDirectory = join(dataDir, "artifacts", run.id);
    const importedArtifactDirectory = join(
      dataDir,
      "artifacts",
      "imported",
      project.id,
      run.id,
    );
    const projectDirectory = join(dataDir, "projects", project.id);
    for (const directory of [
      normalArtifactDirectory,
      importedArtifactDirectory,
      projectDirectory,
    ]) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
    const reportPath = join(normalArtifactDirectory, "report.json");
    writeFileSync(reportPath, "{}", { mode: 0o600 });
    writeFileSync(join(importedArtifactDirectory, "report.html"), "safe", {
      mode: 0o600,
    });
    writeFileSync(join(projectDirectory, "custom-rules.json"), "{}", {
      mode: 0o600,
    });
    runtime.database.saveArtifact({
      id: "project-delete-artifact",
      runId: run.id,
      kind: "report.json",
      path: reportPath,
      mediaType: "application/json",
      sizeBytes: 2,
      sha256: "a".repeat(64),
    });
    runtime.database.upsertIntegration({
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

    await expect(
      runtime.projects.delete({
        projectId: project.id,
        confirmation: "exact project name",
      }),
    ).rejects.toMatchObject({
      name: "ProjectDeletionError",
      code: "project_confirmation_mismatch",
      status: 422,
    });
    expect(runtime.database.getProject(project.id)).not.toBeNull();
    expect(existsSync(reportPath)).toBe(true);

    const receipt = await runtime.projects.delete({
      projectId: project.id,
      confirmation: "Exact Project Name",
    });
    expect(receipt).toMatchObject({
      projectId: project.id,
      counts: { runs: 1, artifacts: 1 },
      artifactCleanup: "complete",
      globalCredentialsRetained: true,
    });
    expect(runtime.database.getProject(project.id)).toBeNull();
    expect(existsSync(normalArtifactDirectory)).toBe(false);
    expect(existsSync(join(dataDir, "artifacts", "imported", project.id))).toBe(
      false,
    );
    expect(existsSync(projectDirectory)).toBe(false);
    expect(existsSync(join(dataDir, ".deletion-staging"))).toBe(false);
    expect(runtime.database.listIntegrations()).toHaveLength(1);
    await expect(runtime.system.health()).resolves.toMatchObject({
      status: "ok",
      database: "connected",
    });
  });

  it("returns a typed not-found error instead of making deletion idempotently ambiguous", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    runtime = new MarketingovoLocalRuntime({ dataDir });

    await expect(
      runtime.projects.delete({
        projectId: "missing-project",
        confirmation: "Missing",
      }),
    ).rejects.toMatchObject({ code: "project_not_found", status: 404 });
  });

  it("retries isolated deletion staging at the next service start", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    const staleDirectory = join(
      dataDir,
      ".deletion-staging",
      "stale-operation",
    );
    mkdirSync(staleDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(staleDirectory, "manifest.json"),
      `${JSON.stringify({
        version: 1,
        projectId: "already-deleted-project",
        runIds: [],
      })}\n`,
      { mode: 0o600 },
    );
    writeFileSync(join(staleDirectory, "project"), "deleted data", {
      mode: 0o600,
    });

    runtime = new MarketingovoLocalRuntime({ dataDir });

    expect(existsSync(join(dataDir, ".deletion-staging"))).toBe(false);
    await expect(runtime.system.health()).resolves.toMatchObject({
      status: "ok",
      database: "connected",
    });
  });

  it("restores staged files after a crash when the SQLite project still exists", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    runtime = new MarketingovoLocalRuntime({ dataDir });
    const project = await runtime.projects.create({
      name: "Crash recovery project",
      canonicalUrl: "https://recovery.example",
    });
    const projectDirectory = join(dataDir, "projects", project.id);
    mkdirSync(projectDirectory, { recursive: true, mode: 0o700 });
    const customRulesPath = join(projectDirectory, "custom-rules.json");
    writeFileSync(customRulesPath, "{}", { mode: 0o600 });
    runtime.close();
    runtime = undefined;

    const stagingRoot = join(
      dataDir,
      ".deletion-staging",
      "interrupted-operation",
    );
    mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(stagingRoot, "manifest.json"),
      `${JSON.stringify({ version: 1, projectId: project.id, runIds: [] })}\n`,
      { mode: 0o600 },
    );
    renameSync(projectDirectory, join(stagingRoot, "project"));
    expect(existsSync(customRulesPath)).toBe(false);

    runtime = new MarketingovoLocalRuntime({ dataDir });

    expect(runtime.database.getProject(project.id)).not.toBeNull();
    expect(existsSync(customRulesPath)).toBe(true);
    expect(existsSync(join(dataDir, ".deletion-staging"))).toBe(false);
    await expect(runtime.system.health()).resolves.toMatchObject({
      status: "ok",
      database: "connected",
    });
  });

  it("fails closed on unrecognized staging instead of deleting unknown files", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    const unknownStaging = join(
      dataDir,
      ".deletion-staging",
      "unknown-operation",
    );
    mkdirSync(unknownStaging, { recursive: true, mode: 0o700 });
    const unknownFile = join(unknownStaging, "unknown-data");
    writeFileSync(unknownFile, "preserve me", { mode: 0o600 });

    runtime = new MarketingovoLocalRuntime({ dataDir });

    expect(existsSync(unknownFile)).toBe(true);
    await expect(runtime.system.health()).resolves.toMatchObject({
      status: "degraded",
      database: "connected; project deletion cleanup pending",
    });
  });

  it("cancels an executing project job before deleting its database graph", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-deletion-"),
    );
    runtime = new MarketingovoLocalRuntime({
      dataDir,
      engine: {
        crawl: async (options) =>
          new Promise<never>((_resolve, reject) => {
            const signal = options.signal as AbortSignal;
            signal.addEventListener(
              "abort",
              () => reject(signal.reason ?? new Error("aborted")),
              { once: true },
            );
          }),
        reportToJson: () => "{}",
        reportToHtml: () => "",
        reportToCsv: () => "",
      },
    });
    const project = await runtime.projects.create({
      name: "Running project",
      canonicalUrl: "https://running.example",
    });
    const run = await runtime.runs.start({
      projectId: project.id,
      workflowId: "audit",
    });
    const deadline = Date.now() + 3_000;
    while (runtime.database.getRun(run.id)?.status !== "running") {
      if (Date.now() >= deadline) throw new Error("Run did not start");
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 20));
    }

    await expect(
      runtime.projects.delete({
        projectId: project.id,
        confirmation: "Running project",
      }),
    ).resolves.toMatchObject({
      counts: { runs: 1 },
      artifactCleanup: "complete",
    });
    expect(runtime.database.getProject(project.id)).toBeNull();
    expect(runtime.database.getRun(run.id)).toBeNull();
  });
});
