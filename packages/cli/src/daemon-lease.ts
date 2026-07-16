import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const LEASE_DATABASE = "daemon-lease.sqlite";
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2_000;

export interface DaemonLeaseOwner {
  ownerId: string;
  pid: number;
  port: number;
  startedAt: number;
  heartbeatAt: number;
}

export interface DaemonLeaseOptions {
  pid?: number;
  now?: () => number;
  isProcessAlive?: (pid: number) => boolean;
  heartbeatIntervalMs?: number;
}

export type DaemonLeaseAttempt =
  | {
      status: "acquired";
      lease: DataDirectoryDaemonLease;
      owner: DaemonLeaseOwner;
    }
  | { status: "held"; owner: DaemonLeaseOwner };

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function ownerFromRow(row: Record<string, unknown>): DaemonLeaseOwner {
  const owner = {
    ownerId: String(row.owner_id ?? ""),
    pid: Number(row.pid),
    port: Number(row.port),
    startedAt: Number(row.started_at),
    heartbeatAt: Number(row.heartbeat_at),
  };
  if (
    !owner.ownerId ||
    !Number.isInteger(owner.pid) ||
    owner.pid <= 0 ||
    !Number.isInteger(owner.port) ||
    owner.port < 1024 ||
    owner.port > 65_535 ||
    !Number.isFinite(owner.startedAt) ||
    !Number.isFinite(owner.heartbeatAt)
  ) {
    throw new Error("The local daemon lease contains invalid owner metadata");
  }
  return owner;
}

function openLeaseDatabase(dataDirectory: string): DatabaseSync {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dataDirectory, 0o700);
  } catch {
    /* platform ACL owns permissions */
  }
  const path = join(dataDirectory, LEASE_DATABASE);
  const database = new DatabaseSync(path, { timeout: 5_000 });
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;",
  );
  database.exec(`
    CREATE TABLE IF NOT EXISTS daemon_lease (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      owner_id TEXT NOT NULL,
      pid INTEGER NOT NULL,
      port INTEGER NOT NULL CHECK (port BETWEEN 1024 AND 65535),
      started_at INTEGER NOT NULL,
      heartbeat_at INTEGER NOT NULL
    ) STRICT;
  `);
  try {
    chmodSync(path, 0o600);
  } catch {
    /* platform ACL owns permissions */
  }
  return database;
}

export class DataDirectoryDaemonLease {
  private readonly timer: NodeJS.Timeout;
  private released = false;

  constructor(
    private readonly database: DatabaseSync,
    readonly owner: DaemonLeaseOwner,
    heartbeatIntervalMs: number,
    private readonly now: () => number,
  ) {
    this.timer = setInterval(() => this.heartbeat(), heartbeatIntervalMs);
    this.timer.unref();
  }

  private heartbeat(): void {
    if (this.released) return;
    const heartbeatAt = this.now();
    let changes: number;
    try {
      const result = this.database
        .prepare(
          `
        UPDATE daemon_lease SET heartbeat_at = ? WHERE singleton = 1 AND owner_id = ?
      `,
        )
        .run(heartbeatAt, this.owner.ownerId);
      changes = Number(result.changes);
    } catch (error) {
      // A contender can hold BEGIN IMMEDIATE briefly while inspecting the
      // owner. Missing one heartbeat is safer than crashing the daemon.
      if (/busy|locked/iu.test((error as Error).message)) return;
      clearInterval(this.timer);
      this.released = true;
      this.database.close();
      return;
    }
    if (changes !== 1) {
      clearInterval(this.timer);
      this.released = true;
      this.database.close();
      return;
    }
    this.owner.heartbeatAt = heartbeatAt;
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    clearInterval(this.timer);
    try {
      this.database
        .prepare(
          `
        DELETE FROM daemon_lease WHERE singleton = 1 AND owner_id = ?
      `,
        )
        .run(this.owner.ownerId);
    } finally {
      this.database.close();
    }
  }
}

export function acquireDataDirectoryDaemonLease(
  dataDirectory: string,
  port: number,
  options: DaemonLeaseOptions = {},
): DaemonLeaseAttempt {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("Daemon lease port must be an integer from 1024 to 65535");
  }
  const pid = options.pid ?? process.pid;
  if (!Number.isInteger(pid) || pid <= 0)
    throw new Error("Daemon lease PID must be a positive integer");
  const now = options.now ?? Date.now;
  const heartbeatIntervalMs = Math.max(
    250,
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  const isProcessAlive = options.isProcessAlive ?? processIsAlive;
  const database = openLeaseDatabase(dataDirectory);
  const ownerId = randomUUID();
  const acquiredAt = now();

  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare(
        `
      SELECT owner_id, pid, port, started_at, heartbeat_at FROM daemon_lease WHERE singleton = 1
    `,
      )
      .get() as Record<string, unknown> | undefined;
    const existing = row ? ownerFromRow(row) : null;
    // A live PID remains authoritative across system sleep or an event-loop
    // stall even when its heartbeat is old. A crashed owner is replaced inside
    // this same transaction, so contenders cannot both become the writer.
    const existingPidIsLive = existing ? isProcessAlive(existing.pid) : false;
    if (existing && existingPidIsLive) {
      database.exec("COMMIT");
      database.close();
      return { status: "held", owner: existing };
    }

    database
      .prepare(
        `
      INSERT INTO daemon_lease (singleton, owner_id, pid, port, started_at, heartbeat_at)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        owner_id = excluded.owner_id,
        pid = excluded.pid,
        port = excluded.port,
        started_at = excluded.started_at,
        heartbeat_at = excluded.heartbeat_at
    `,
      )
      .run(ownerId, pid, port, acquiredAt, acquiredAt);
    database.exec("COMMIT");
    const owner = {
      ownerId,
      pid,
      port,
      startedAt: acquiredAt,
      heartbeatAt: acquiredAt,
    };
    return {
      status: "acquired",
      owner,
      lease: new DataDirectoryDaemonLease(
        database,
        owner,
        heartbeatIntervalMs,
        now,
      ),
    };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* transaction already closed */
    }
    database.close();
    throw error;
  }
}
