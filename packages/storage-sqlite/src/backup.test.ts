import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  validateDatabaseBackup,
} from "./backup.js";
import { AgentSeoDatabase } from "./database.js";

describe("SQLite backup and restore", () => {
  it("creates a validated snapshot and restores it with a rollback copy", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-backup-"));
    const databasePath = join(root, "agentseo.db");
    const backupPath = join(root, "snapshots", "baseline.db");
    const database = new AgentSeoDatabase({ path: databasePath });
    const original = database.createProject({
      name: "Original",
      canonicalUrl: "https://example.com/",
    });
    const backup = await createDatabaseBackup(database, backupPath);
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(backup.schemaVersion).toBeGreaterThanOrEqual(1);
    database.createProject({
      name: "Later",
      canonicalUrl: "https://later.example/",
    });
    database.close();

    const restored = await restoreDatabaseBackup(
      backupPath,
      databasePath,
      backup.sha256,
    );
    expect(restored.rollbackPath).toBeTruthy();
    const reopened = new AgentSeoDatabase({ path: databasePath });
    expect(reopened.listProjects()).toEqual([original]);
    reopened.close();
  });

  it("rejects a checksum mismatch, malformed file and symbolic link", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-backup-invalid-"));
    const malformed = join(root, "not-a-database.db");
    writeFileSync(malformed, "not sqlite");
    await expect(validateDatabaseBackup(malformed)).rejects.toThrow();

    const database = new AgentSeoDatabase({ path: join(root, "source.db") });
    database.createProject({
      name: "Project",
      canonicalUrl: "https://example.com/",
    });
    const backup = await createDatabaseBackup(
      database,
      join(root, "backup.db"),
    );
    database.close();
    await expect(
      validateDatabaseBackup(backup.path, "0".repeat(64)),
    ).rejects.toThrow("does not match");

    const link = join(root, "backup-link.db");
    symlinkSync(backup.path, link);
    await expect(validateDatabaseBackup(link)).rejects.toThrow("regular file");
    expect(readFileSync(backup.path).byteLength).toBeGreaterThan(0);
  });

  it("refuses to overwrite an existing backup destination", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentseo-backup-existing-"));
    const database = new AgentSeoDatabase({ path: join(root, "source.db") });
    const destination = join(root, "existing.db");
    writeFileSync(destination, "keep me");
    await expect(createDatabaseBackup(database, destination)).rejects.toThrow(
      "already exists",
    );
    database.close();
  });
});
