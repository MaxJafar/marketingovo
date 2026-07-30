import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryCredentialStore } from "@agentseoapp/credentials";
import { AgentSeoLocalRuntime } from "./index.js";

function runtimeWith(
  fetchImpl: typeof fetch,
  credentialStore = new MemoryCredentialStore(),
): { runtime: AgentSeoLocalRuntime; credentialStore: MemoryCredentialStore } {
  return {
    runtime: new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "agentseo-integration-health-")),
      integrationFetch: fetchImpl,
      credentialStore,
    }),
    credentialStore,
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("runtime connector health", () => {
  it("keeps stored API credentials unverified until a real provider probe succeeds", async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const { runtime } = runtimeWith(async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get("authorization"),
      });
      return json({ account_id: "acct-1", total_searches_left: 42 });
    });
    try {
      const project = await runtime.projects.create({
        name: "Health fixture",
        canonicalUrl: "https://example.com/",
      });
      const secret = Buffer.from(
        JSON.stringify({ apiKey: "serpapi-test-secret" }),
      );
      try {
        const stored = await runtime.integrations.saveSecret(
          "serpapi",
          "default",
          "credentials",
          secret,
        );
        expect(stored.status).toBe("degraded");
      } finally {
        secret.fill(0);
      }

      const tested = await runtime.integrations.test("serpapi", project.id);
      expect(tested.status).toBe("connected");
      expect(tested.lastSyncAt).not.toBeNull();
      expect(tested.quota).toEqual({
        remaining: 42,
        limit: null,
        resetsAt: null,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toContain("https://serpapi.com/account.json");
      expect(calls[0]?.authorization).toBeNull();
      expect(JSON.stringify(tested)).not.toContain("serpapi-test-secret");
    } finally {
      runtime.close();
    }
  });

  it("persists expired without exposing provider errors or credential material", async () => {
    const { runtime } = runtimeWith(
      async () => new Response("secret provider diagnostic", { status: 401 }),
    );
    try {
      const secret = Buffer.from(
        JSON.stringify({ apiKey: "serpapi-expired-secret" }),
      );
      try {
        await runtime.integrations.saveSecret(
          "serpapi",
          "default",
          "credentials",
          secret,
        );
      } finally {
        secret.fill(0);
      }
      const tested = await runtime.integrations.test("serpapi");
      expect(tested.status).toBe("expired");
      expect(JSON.stringify(tested)).not.toContain("provider diagnostic");
      expect(JSON.stringify(tested)).not.toContain("expired-secret");
      expect(
        (await runtime.integrations.list()).find(
          (integration) => integration.provider === "serpapi",
        )?.status,
      ).toBe("expired");
    } finally {
      runtime.close();
    }
  });

  it("uses refreshed OAuth plus the selected project mapping for GSC", async () => {
    let requestedUrl = "";
    let authorization = "";
    const { runtime } = runtimeWith(async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return json({
        siteUrl: "sc-domain:example.com",
        permissionLevel: "siteOwner",
      });
    });
    try {
      const project = await runtime.projects.create({
        name: "Mapped site",
        canonicalUrl: "https://example.com/",
      });
      await runtime.integrations.completeOAuth(
        "google-search-console",
        "default",
        {
          provider: "google-search-console",
          accessToken: "current-access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        },
      );
      await runtime.integrations.configure(
        "google-search-console",
        project.id,
        { siteUrl: "sc-domain:example.com" },
      );

      const tested = await runtime.integrations.test(
        "google-search-console",
        project.id,
      );
      expect(tested.status).toBe("connected");
      expect(decodeURIComponent(new URL(requestedUrl).pathname)).toContain(
        "/sites/sc-domain:example.com",
      );
      expect(authorization).toBe("Bearer current-access-token");
    } finally {
      runtime.close();
    }
  });

  it("removes the previous vault account during credential rotation", async () => {
    const store = new MemoryCredentialStore();
    const { runtime, credentialStore } = runtimeWith(
      async () => json({ account_id: "unused" }),
      store,
    );
    try {
      const first = Buffer.from(JSON.stringify({ apiKey: "first-api-key" }));
      const second = Buffer.from(JSON.stringify({ apiKey: "second-api-key" }));
      try {
        await runtime.integrations.saveSecret(
          "serpapi",
          "first-account",
          "credentials",
          first,
        );
        await runtime.integrations.saveSecret(
          "serpapi",
          "second-account",
          "credentials",
          second,
        );
      } finally {
        first.fill(0);
        second.fill(0);
      }

      expect(
        await credentialStore.status({
          provider: "serpapi",
          account: "first-account",
          kind: "credentials",
        }),
      ).toMatchObject({ exists: false });
      expect(
        await credentialStore.status({
          provider: "serpapi",
          account: "second-account",
          kind: "credentials",
        }),
      ).toMatchObject({ exists: true });
    } finally {
      runtime.close();
    }
  });
});
