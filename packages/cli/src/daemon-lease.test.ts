import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { acquireDataDirectoryDaemonLease } from "./daemon-lease.js";

describe("data-directory daemon lease", () => {
  it("allows one writer across ports and releases ownership cleanly", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-daemon-lease-"));
    const first = acquireDataDirectoryDaemonLease(root, 3210);
    expect(first.status).toBe("acquired");
    if (first.status !== "acquired") return;

    const second = acquireDataDirectoryDaemonLease(root, 4321);
    expect(second).toMatchObject({
      status: "held",
      owner: { ownerId: first.owner.ownerId, pid: process.pid, port: 3210 },
    });

    first.lease.release();
    const replacement = acquireDataDirectoryDaemonLease(root, 4321);
    expect(replacement.status).toBe("acquired");
    if (replacement.status === "acquired") replacement.lease.release();
  });

  it("transactionally replaces a crashed owner without trusting a stale row", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-daemon-stale-"));
    const initial = acquireDataDirectoryDaemonLease(root, 3210);
    expect(initial.status).toBe("acquired");
    if (initial.status !== "acquired") return;
    initial.lease.release();

    const database = new DatabaseSync(join(root, "daemon-lease.sqlite"));
    database
      .prepare(
        `
      INSERT INTO daemon_lease (singleton, owner_id, pid, port, started_at, heartbeat_at)
      VALUES (1, 'crashed-owner', 987654321, 3210, 1, 1)
    `,
      )
      .run();
    database.close();

    const recovered = acquireDataDirectoryDaemonLease(root, 4321, {
      isProcessAlive: () => false,
      now: () => 50_000,
    });
    expect(recovered).toMatchObject({
      status: "acquired",
      owner: { port: 4321 },
    });
    if (recovered.status === "acquired") recovered.lease.release();
  });

  it("never steals from a live owner after a long sleep", () => {
    const root = mkdtempSync(join(tmpdir(), "golem-daemon-live-"));
    const first = acquireDataDirectoryDaemonLease(root, 3210, {
      pid: 4444,
      now: () => 1,
      heartbeatIntervalMs: 60_000,
      isProcessAlive: () => false,
    });
    expect(first.status).toBe("acquired");
    if (first.status !== "acquired") return;

    const second = acquireDataDirectoryDaemonLease(root, 4321, {
      now: () => 86_400_000,
      isProcessAlive: (pid) => pid === 4444,
    });
    expect(second).toMatchObject({
      status: "held",
      owner: { pid: 4444, port: 3210 },
    });
    first.lease.release();
  });
});
