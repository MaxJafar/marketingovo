import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "./index.js";

// Report artifacts live in two crash domains: the file on disk and the row in
// SQLite that indexes it. A crash between them is unavoidable without a
// distributed transaction, so what matters is the *direction* of the exposure.
//
// The runtime writes the file first and registers it second. That ordering is
// load-bearing: a crash can only ever leave an unreferenced file, never an
// advertised artifact whose bytes are missing. The read path is defensive in the
// same direction — a row whose file has since disappeared reads as absent rather
// than throwing.
//
// Both properties are currently correct, and the schema adds a third: an
// artifact row cannot reference a run that does not exist, so referential
// integrity is enforced rather than assumed. None of the three was pinned by a
// test, so a refactor that swapped the write order, dropped the read guard, or
// relaxed the foreign key would reintroduce a user-visible "download exists but
// fails" bug in silence.

const observedAt = "2026-07-15T10:00:00.000Z";

async function runtimeWithRun(label: string) {
  const dataDir = mkdtempSync(join(tmpdir(), `marketingovo-${label}-`));
  const runtime = new MarketingovoLocalRuntime({ dataDir });
  const project = await runtime.projects.create({
    name: "Crash domains",
    canonicalUrl: "https://example.com/",
  });
  const run = runtime.database.insertRun({
    id: `${label}-run`,
    projectId: project.id,
    workflowId: "audit",
  });
  runtime.database.updateRun(run.id, {
    status: "succeeded",
    progress: 1,
    completedAt: observedAt,
  });
  return { dataDir, runtime, runId: run.id };
}

const artifactRow = (runId: string, kind: string, path: string) => ({
  id: `artifact-${kind}`,
  runId,
  kind,
  path,
  mediaType: "application/octet-stream",
  sizeBytes: 1,
  sha256: "0".repeat(64),
});

describe("report artifact crash domains", () => {
  it("reads a registered artifact whose file vanished as absent, not as an error", async () => {
    const { dataDir, runtime, runId } =
      await runtimeWithRun("artifact-missing");
    const path = join(dataDir, "artifacts", runId, "report.json");

    // The state left by an external deletion, or a restore that dropped the
    // artifact tree while keeping the database.
    runtime.database.saveArtifact(artifactRow(runId, "report.json", path));

    expect(existsSync(path)).toBe(false);
    await expect(runtime.reports.get(runId, "json")).resolves.toBeNull();

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("does not advertise an artifact that was written but never registered", async () => {
    const { dataDir, runtime, runId } = await runtimeWithRun("artifact-orphan");

    // The exact state a crash between writeFileSync and saveArtifact leaves:
    // bytes on disk, nothing in the index.
    const directory = join(dataDir, "artifacts", runId);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "report.json"), '{"leaked":true}');

    // SQLite is the index, so an unreferenced file is a disk leak and never a
    // served artifact.
    await expect(runtime.reports.get(runId, "json")).resolves.toBeNull();
    expect(existsSync(join(directory, "report.json"))).toBe(true);

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("degrades per format when a crash lands mid-loop", async () => {
    const { dataDir, runtime, runId } =
      await runtimeWithRun("artifact-partial");
    const directory = join(dataDir, "artifacts", runId);
    mkdirSync(directory, { recursive: true });

    // saveReportArtifacts writes and registers one format at a time, so a crash
    // can land between them. json and html made it; csv and pdf did not.
    for (const kind of ["report.json", "report.html"]) {
      const path = join(directory, kind);
      writeFileSync(path, `bytes for ${kind}`);
      runtime.database.saveArtifact(artifactRow(runId, kind, path));
    }

    await expect(runtime.reports.get(runId, "json")).resolves.not.toBeNull();
    await expect(runtime.reports.get(runId, "html")).resolves.not.toBeNull();
    await expect(runtime.reports.get(runId, "csv")).resolves.toBeNull();
    await expect(runtime.reports.get(runId, "pdf")).resolves.toBeNull();

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("refuses to index an artifact for a run that does not exist", async () => {
    const { dataDir, runtime } = await runtimeWithRun("artifact-referential");

    // Referential integrity is enforced by the schema, not by calling code, so a
    // partially rolled-back run cannot leave artifacts pointing at nothing.
    expect(() =>
      runtime.database.saveArtifact(
        artifactRow(
          "run-that-never-existed",
          "report.json",
          join(dataDir, "x"),
        ),
      ),
    ).toThrow(/FOREIGN KEY/iu);

    rmSync(dataDir, { recursive: true, force: true });
  });
});
