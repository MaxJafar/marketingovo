import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MarketingovoDatabase } from "./database.js";
import { migrations } from "./schema.js";

/**
 * Builds a database frozen at an earlier schema version, populated through raw
 * SQL, so the migration under test runs against real rows rather than an empty
 * file. A migration that only ever sees an empty table proves nothing about the
 * upgrade an existing install will actually perform.
 */
function databaseAtVersion(path: string, version: number): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const migration of migrations) {
    if (migration.version > version) break;
    if (migration.foreignKeysOff) db.exec("PRAGMA foreign_keys = OFF;");
    db.exec(migration.sql);
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES(?, ?, ?)",
    ).run(migration.version, migration.name, new Date().toISOString());
    if (migration.foreignKeysOff) db.exec("PRAGMA foreign_keys = ON;");
  }
  return db;
}

describe("optional website", () => {
  it("migrates a populated v12 database without losing projects or breaking foreign keys", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "marketingovo-optional-website-")),
      "marketingovo.db",
    );
    const legacy = databaseAtVersion(path, 12);
    const timestamp = new Date().toISOString();
    for (const { id, name, url } of [
      { id: "project-a", name: "Acme", url: "https://acme.example/" },
      { id: "project-b", name: "Globex", url: "https://globex.example/" },
    ]) {
      legacy
        .prepare(
          "INSERT INTO projects(id,name,canonical_url,created_at,updated_at) VALUES(?,?,?,?,?)",
        )
        .run(id, name, url, timestamp, timestamp);
      legacy
        .prepare(
          "INSERT INTO sites(id,project_id,canonical_url,created_at) VALUES(?,?,?,?)",
        )
        .run(`site-${id}`, id, url, timestamp);
      // A child row on the cascade path: the rebuild must not orphan it.
      legacy
        .prepare(
          "INSERT INTO runs(id,project_id,workflow_id,status,requested_at) VALUES(?,?,?,?,?)",
        )
        .run(`run-${id}`, id, "audit", "succeeded", timestamp);
    }
    legacy.close();

    const database = new MarketingovoDatabase({ path });
    const projects = database.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.canonicalUrl).sort()).toEqual([
      "https://acme.example/",
      "https://globex.example/",
    ]);
    expect(database.db.prepare("PRAGMA foreign_key_check").all()).toHaveLength(
      0,
    );
    expect(
      database.db.prepare("SELECT COUNT(*) AS total FROM runs").get(),
    ).toEqual({ total: 2 });
    database.close();
  });

  it("creates a workspace with no website and no site row, then attaches one later", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "marketingovo-optional-website-")),
      "marketingovo.db",
    );
    const database = new MarketingovoDatabase({ path });

    const workspace = database.createProject({ name: "Social only" });
    expect(workspace.canonicalUrl).toBeNull();
    expect(
      database.db
        .prepare("SELECT COUNT(*) AS total FROM sites WHERE project_id = ?")
        .get(workspace.id),
    ).toEqual({ total: 0 });

    // Adding a website later must create the site row the workspace never had.
    const attached = database.updateProjectSettings(workspace.id, {
      canonicalUrl: "https://later.example",
    });
    expect(attached?.project.canonicalUrl).toBe("https://later.example/");
    expect(
      database.db
        .prepare("SELECT canonical_url FROM sites WHERE project_id = ?")
        .get(workspace.id),
    ).toEqual({ canonical_url: "https://later.example/" });

    // Detaching removes it rather than writing a placeholder into a NOT NULL
    // column, and the workspace itself survives.
    const detached = database.updateProjectSettings(workspace.id, {
      canonicalUrl: null,
    });
    expect(detached?.project.canonicalUrl).toBeNull();
    expect(detached?.project.name).toBe("Social only");
    expect(
      database.db
        .prepare("SELECT COUNT(*) AS total FROM sites WHERE project_id = ?")
        .get(workspace.id),
    ).toEqual({ total: 0 });

    database.close();
  });
});
