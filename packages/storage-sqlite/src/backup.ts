import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import type { AgentSeoDatabase } from "./database.js";
import { migrations } from "./schema.js";

export interface DatabaseBackupMetadata {
  path: string;
  sizeBytes: number;
  sha256: string;
  schemaVersion: number;
}

export interface RestoreResult extends DatabaseBackupMetadata {
  rollbackPath: string | null;
}

const REQUIRED_TABLES = [
  "projects",
  "runs",
  "run_modules",
  "pages",
  "issues",
  "issue_instances",
  "issue_adjudications",
  "project_context_versions",
  "project_context_journal",
  "project_extraction_rule_versions",
  "actions",
  "metrics",
  "integrations",
  "schedules",
  "artifacts",
] as const;

async function hashFile(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function assertRegularFile(path: string): void {
  const file = lstatSync(path);
  if (file.isSymbolicLink() || !file.isFile()) {
    throw new Error("Database backup must be a regular file, not a link");
  }
}

function integrityValue(row: Record<string, unknown> | undefined): string {
  if (!row) return "missing";
  const value = row.integrity_check ?? Object.values(row)[0];
  return String(value ?? "missing");
}

/**
 * Validates a backup without running migrations or changing the file.
 */
export async function validateDatabaseBackup(
  path: string,
  expectedSha256?: string,
): Promise<DatabaseBackupMetadata> {
  const source = resolve(path);
  if (!existsSync(source)) throw new Error("Database backup does not exist");
  assertRegularFile(source);
  const sizeBytes = statSync(source).size;
  if (sizeBytes < 1) throw new Error("Database backup is empty");
  const sha256 = await hashFile(source);
  if (expectedSha256 && !/^[a-f0-9]{64}$/iu.test(expectedSha256.trim())) {
    throw new Error(
      "Expected SHA-256 must contain exactly 64 hexadecimal characters",
    );
  }
  if (
    expectedSha256 &&
    sha256.toLowerCase() !== expectedSha256.trim().toLowerCase()
  ) {
    throw new Error("Database backup SHA-256 does not match");
  }

  const database = new DatabaseSync(source, { readOnly: true });
  try {
    const integrity = integrityValue(
      database.prepare("PRAGMA integrity_check(1)").get() as
        Record<string, unknown> | undefined,
    );
    if (integrity !== "ok") {
      throw new Error(`Database backup failed integrity check: ${integrity}`);
    }
    const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyErrors.length > 0) {
      throw new Error("Database backup contains foreign-key violations");
    }
    const tableRows = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<Record<string, unknown>>;
    const tables = new Set(tableRows.map((row) => String(row.name)));
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      throw new Error(
        `Database backup is missing required tables: ${missing.join(", ")}`,
      );
    }
    const migration = database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as Record<string, unknown> | undefined;
    const schemaVersion = Number(migration?.version);
    const latestSupported = migrations.at(-1)?.version ?? 0;
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error("Database backup has no valid schema version");
    }
    if (schemaVersion > latestSupported) {
      throw new Error(
        `Database backup schema ${schemaVersion} is newer than supported schema ${latestSupported}`,
      );
    }
    return { path: source, sizeBytes, sha256, schemaVersion };
  } finally {
    database.close();
  }
}

/**
 * Creates a consistent online snapshot through SQLite's backup API. The
 * destination must not exist so an operator cannot overwrite evidence by
 * accident.
 */
export async function createDatabaseBackup(
  database: Pick<AgentSeoDatabase, "db" | "path">,
  destination: string,
): Promise<DatabaseBackupMetadata> {
  const target = resolve(destination);
  if (target === resolve(database.path)) {
    throw new Error("Backup destination must differ from the active database");
  }
  if (existsSync(target)) {
    throw new Error("Backup destination already exists");
  }
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.partial-${randomUUID()}`;
  try {
    await backup(database.db, temporary, { rate: 100 });
    chmodSync(temporary, 0o600);
    const metadata = await validateDatabaseBackup(temporary);
    renameSync(temporary, target);
    return { ...metadata, path: target };
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * Restores a validated snapshot while the caller holds the single-writer
 * daemon lease. The previous database is retained as a rollback file. This is
 * intentionally an offline operation; callers must refuse it while the daemon
 * is active.
 */
export async function restoreDatabaseBackup(
  backupPath: string,
  databasePath: string,
  expectedSha256?: string,
): Promise<RestoreResult> {
  const source = resolve(backupPath);
  const target = resolve(databasePath);
  if (source === target) {
    throw new Error("Backup source must differ from the active database");
  }
  const sourceMetadata = await validateDatabaseBackup(source, expectedSha256);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.restore-${randomUUID()}`;
  const rollbackPath = existsSync(target)
    ? `${target}.before-restore-${new Date().toISOString().replaceAll(":", "-")}`
    : null;
  copyFileSync(source, temporary);
  chmodSync(temporary, 0o600);
  await validateDatabaseBackup(temporary, sourceMetadata.sha256);

  let originalMoved = false;
  try {
    if (rollbackPath) {
      renameSync(target, rollbackPath);
      originalMoved = true;
    }
    // WAL/SHM files belong to the previous database generation and must never
    // be replayed into the restored snapshot.
    rmSync(`${target}-wal`, { force: true });
    rmSync(`${target}-shm`, { force: true });
    renameSync(temporary, target);
    chmodSync(target, 0o600);
    const restored = await validateDatabaseBackup(
      target,
      sourceMetadata.sha256,
    );
    return { ...restored, rollbackPath };
  } catch (error) {
    rmSync(temporary, { force: true });
    if (originalMoved && rollbackPath) {
      rmSync(target, { force: true });
      renameSync(rollbackPath, target);
    } else {
      rmSync(target, { force: true });
    }
    throw error;
  }
}
