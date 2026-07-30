import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NativeBrokerCredentialStore } from "./native-broker.js";

describe("NativeBrokerCredentialStore", () => {
  it("round-trips opaque bytes over the private line protocol", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agentseo-broker-test-"));
    const binary = join(directory, "broker.mjs");
    const previousDbus = process.env.DBUS_SESSION_BUS_ADDRESS;
    process.env.DBUS_SESSION_BUS_ADDRESS =
      "unix:path=/private/agentseo-test-bus";
    writeFileSync(
      binary,
      `#!/usr/bin/env node
import { createInterface } from "node:readline";
const entries = new Map();
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (process.env.DBUS_SESSION_BUS_ADDRESS !== "unix:path=/private/agentseo-test-bus") {
    process.stdout.write(JSON.stringify({ request_id: request.request_id, ok: false, error: "missing_os_session" }) + "\\n");
    return;
  }
  if (request.operation === "put") entries.set(request.key, request.secret_base64);
  if (request.operation === "delete") entries.delete(request.key);
  const secret = request.operation === "get" ? entries.get(request.key) : undefined;
  process.stdout.write(JSON.stringify({
    request_id: request.request_id,
    ok: true,
    exists: request.operation === "put" ? true : entries.has(request.key),
    ...(secret ? { secret_base64: secret } : {}),
  }) + "\\n");
});
`,
      { mode: 0o700 },
    );
    chmodSync(binary, 0o700);
    const store = new NativeBrokerCredentialStore(binary, {
      timeoutMs: 2_000,
      backendName: "macos-keychain",
    });
    const ref = {
      provider: "serpapi",
      account: "default",
      kind: "credentials",
    };
    const secret = Buffer.from('{"apiKey":"native-secret"}');
    try {
      await store.put(ref, secret);
      expect(await store.status(ref)).toMatchObject({
        exists: true,
        backend: "os",
      });
      expect(Buffer.from((await store.get(ref))!).toString("utf8")).toBe(
        secret.toString("utf8"),
      );
      await store.delete(ref);
      expect(await store.get(ref)).toBeNull();
    } finally {
      secret.fill(0);
      store.close();
      if (previousDbus === undefined)
        delete process.env.DBUS_SESSION_BUS_ADDRESS;
      else process.env.DBUS_SESSION_BUS_ADDRESS = previousDbus;
    }
  });
});
