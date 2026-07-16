import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MemoryCredentialStore } from "@golem-seo/credentials";
import { GolemWorkersBridge } from "./golem-workers-bridge.js";

const authorization = {
  deviceCode: "device-code-that-remains-inside-the-daemon",
  userCode: "ABCD-1234",
  verificationUri: "https://golemworkers.com/seo/device",
  expiresAt: "2026-07-15T12:10:00.000Z",
  intervalSeconds: 5,
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GolemWorkers device bridge", () => {
  it("keeps the device code private, stores only the linked token in the vault, and imports the raw bundle", async () => {
    const credentialStore = new MemoryCredentialStore();
    const observed: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      observed.push({ url, init });
      if (url.endsWith("/v1/device/authorizations"))
        return json(authorization, 201);
      if (url.endsWith("/v1/device/token")) {
        return json({
          deviceToken: "hosted-device-token-that-must-stay-secret",
          orgId: "org-linked",
          expiresAt: "2026-10-15T12:00:00.000Z",
        });
      }
      if (url.endsWith("/v1/imports/golemseo")) {
        return json(
          {
            import: {
              projectId: "hosted-project",
              runCount: 1,
              actionCount: 2,
              issueCount: 3,
            },
          },
          201,
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const bridge = new GolemWorkersBridge({
      dataDir: mkdtempSync(join(tmpdir(), "golem-hosted-bridge-")),
      credentialStore,
      fetch: fetchImpl,
      now: () => Date.parse("2026-07-15T12:00:00.000Z"),
    });

    const started = await bridge.start();
    expect(JSON.stringify(started)).not.toContain(authorization.deviceCode);
    await vi.waitFor(async () =>
      expect((await bridge.status()).state).toBe("connected"),
    );
    const status = await bridge.status();
    expect(status).toMatchObject({ state: "connected", orgId: "org-linked" });
    expect(JSON.stringify(status)).not.toContain("hosted-device-token");

    const bundle = Buffer.from(
      JSON.stringify({
        format: "golemseo-project",
        version: 1,
        secretsIncluded: false,
      }),
    );
    await expect(bridge.importProject(bundle)).resolves.toMatchObject({
      import: { projectId: "hosted-project" },
    });
    const importCall = observed.find((call) =>
      call.url.endsWith("/v1/imports/golemseo"),
    );
    expect(importCall?.url).toBe(
      "https://golemworkers.com/v1/imports/golemseo",
    );
    const headers = new Headers(importCall?.init?.headers);
    expect(headers.get("authorization")).toBe(
      "Bearer hosted-device-token-that-must-stay-secret",
    );
    expect(headers.get("x-device-id")).toBe(bridge.deviceId);
    expect(headers.get("x-device-org")).toBe("org-linked");
    expect(headers.get("content-type")).toBe("application/vnd.golemseo+json");
    expect(
      JSON.parse(
        Buffer.from(importCall?.init?.body as Uint8Array).toString("utf8"),
      ),
    ).toMatchObject({
      format: "golemseo-project",
      secretsIncluded: false,
    });
    bridge.close();
  });

  it("preserves hosted entitlement errors without returning token material", async () => {
    const credentialStore = new MemoryCredentialStore();
    const dataDir = mkdtempSync(join(tmpdir(), "golem-hosted-entitlement-"));
    const bridge = new GolemWorkersBridge({
      dataDir,
      credentialStore,
      now: () => Date.parse("2026-07-15T12:00:00.000Z"),
      fetch: vi.fn<typeof fetch>(async (input) =>
        String(input).endsWith("/v1/imports/golemseo")
          ? json(
              {
                code: "entitlement_required",
                title: "Golem SEO Full is required",
              },
              402,
            )
          : json({}, 500),
      ),
    });
    await credentialStore.put(
      { provider: "golemworkers", account: "default", kind: "device" },
      Buffer.from(
        JSON.stringify({
          version: 1,
          deviceId: bridge.deviceId,
          orgId: "org-a",
          deviceToken: "secret-device-token-that-never-enters-errors",
          expiresAt: "2026-10-15T12:00:00.000Z",
        }),
      ),
    );

    const result = bridge.importProject(Buffer.from("{}"));
    await expect(result).rejects.toMatchObject({
      status: 402,
      code: "entitlement_required",
    });
    await expect(result).rejects.not.toThrow(/secret-device-token/u);
    bridge.close();
  });

  it.each([
    "http://golemworkers.com",
    "https://api.golemworkers.com",
    "https://attacker.test",
    "https://user:password@golemworkers.com",
    "https://golemworkers.com/v1",
    "https://golemworkers.com?redirect=https://attacker.test",
    "https://golemworkers.com#attacker",
  ])("rejects untrusted hosted origin %s before fetch", (apiBaseUrl) => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(
      () =>
        new GolemWorkersBridge({
          dataDir: mkdtempSync(join(tmpdir(), "golem-hosted-origin-")),
          credentialStore: new MemoryCredentialStore(),
          apiBaseUrl,
          fetch: fetchImpl,
        }),
    ).toThrow(/pinned to https:\/\/golemworkers\.com/u);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires an active device link before importing", async () => {
    const bridge = new GolemWorkersBridge({
      dataDir: mkdtempSync(join(tmpdir(), "golem-hosted-disconnected-")),
      credentialStore: new MemoryCredentialStore(),
    });
    await expect(bridge.importProject(Buffer.from("{}"))).rejects.toEqual(
      expect.objectContaining({
        status: 409,
        code: "golemworkers_not_connected",
      }),
    );
    bridge.close();
  });
});
