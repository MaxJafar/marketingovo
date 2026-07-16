import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GolemLocalRuntime } from "@golem-seo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const CLIENT_ID = "public-desktop-client.apps.googleusercontent.com";

describe("local Google desktop OAuth", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
    vi.unstubAllEnvs();
  });

  async function authenticatedHeaders(
    server: LocalServer,
  ): Promise<Record<string, string>> {
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    return { host: HOST, authorization: `Bearer ${token}` };
  }

  it("returns clear problem+json when the public desktop client ID is not configured", async () => {
    vi.stubEnv("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID", "");
    vi.stubEnv("GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID", "");
    const dataDir = mkdtempSync(join(tmpdir(), "golem-oauth-server-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);

    const response = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-search-console/auth/start",
      headers: await authenticatedHeaders(server),
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      code: "google_oauth_not_configured",
      title: "Google OAuth is not configured",
      status: 503,
    });
    expect(response.body).toContain("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID");
  });

  it("uses a random loopback callback, persists safe metadata, and never serializes tokens", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-oauth-server-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    const now = Date.now();
    const accessToken = "access-token-must-never-leak";
    const refreshToken = "refresh-token-must-never-leak";
    const oauthFetch = vi.fn<typeof fetch>(async (_input, init) => {
      const body = String(init?.body);
      expect(body).toContain("code=authorization-code");
      expect(body).toContain("code_verifier=");
      expect(body).not.toContain("client_secret");
      return new Response(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/webmasters.readonly",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const server = await createLocalServer({
      runtime,
      port: 3210,
      googleDesktopClientId: CLIENT_ID,
      oauthFetch,
      oauthNow: () => now,
    });
    activeServers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = { host: HOST, authorization: `Bearer ${token}` };

    const started = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-search-console/auth/start",
      headers,
    });
    expect(started.statusCode, started.body).toBe(200);
    expect(started.body).not.toContain(accessToken);
    expect(started.body).not.toContain(refreshToken);
    const startBody = started.json() as {
      authorizationUrl: string;
      expiresAt: string;
    };
    const authorization = new URL(startBody.authorizationUrl);
    const redirectUri = new URL(
      authorization.searchParams.get("redirect_uri")!,
    );
    expect(redirectUri.hostname).toBe("127.0.0.1");
    expect(Number(redirectUri.port)).toBeGreaterThan(0);
    expect(redirectUri.port).not.toBe("3210");
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );

    const callback = new URL(redirectUri);
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("state")!,
    );
    callback.searchParams.set("code", "authorization-code");
    const callbackResponse = await fetch(callback, { redirect: "error" });
    expect(callbackResponse.status).toBe(200);
    const callbackBody = await callbackResponse.text();
    expect(callbackBody).not.toContain(accessToken);
    expect(callbackBody).not.toContain(refreshToken);
    expect(oauthFetch).toHaveBeenCalledOnce();

    const replayResponse = await fetch(callback, { redirect: "error" });
    expect(replayResponse.status).toBe(410);
    const replayBody = await replayResponse.text();
    expect(replayBody).toContain("oauth_transaction_replayed");
    expect(replayBody).not.toContain(accessToken);
    expect(replayBody).not.toContain(refreshToken);
    expect(oauthFetch).toHaveBeenCalledOnce();

    const metadata = runtime.database
      .listIntegrations()
      .find((item) => item.provider === "google-search-console");
    expect(metadata).toMatchObject({
      status: "connected",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      expiresAt: new Date(now + 3_600_000).toISOString(),
      maskedIdentifier: "Google OAuth",
    });
    const stored = await runtime.credentialStore.get({
      provider: "google-search-console",
      account: "default",
      kind: "oauth",
    });
    expect(stored).not.toBeNull();
    expect(Buffer.from(stored!).toString("utf8")).toContain(accessToken);
    expect(Buffer.from(stored!).toString("utf8")).toContain(refreshToken);

    const integrationsResponse = await server.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers,
    });
    const dashboardResponse = await server.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers: { ...headers, "x-golem-client": "dashboard" },
    });
    for (const serialized of [
      integrationsResponse.body,
      dashboardResponse.body,
    ]) {
      expect(serialized).not.toContain(accessToken);
      expect(serialized).not.toContain(refreshToken);
      expect(serialized).not.toContain("authorization-code");
      expect(serialized).not.toContain("secretRef");
    }
    const databaseBytes = readFileSync(join(dataDir, "golem-seo.db"));
    expect(databaseBytes.includes(Buffer.from(accessToken))).toBe(false);
    expect(databaseBytes.includes(Buffer.from(refreshToken))).toBe(false);
  });

  it("validates and isolates connector configuration for the selected project", async () => {
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-config-server-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const headers = await authenticatedHeaders(server);
    const project = await runtime.projects.create({
      name: "Mapped site",
      canonicalUrl: "https://example.com",
    });

    const configured = await server.app.inject({
      method: "PATCH",
      url: "/api/v1/integrations/google-search-console/configuration",
      headers,
      payload: {
        projectId: project.id,
        configuration: { siteUrl: "sc-domain:example.com" },
      },
    });
    expect(configured.statusCode).toBe(200);
    expect(configured.json()).toMatchObject({
      configuration: { siteUrl: "sc-domain:example.com" },
    });
    expect(configured.body).not.toContain("secretRef");

    const invalid = await server.app.inject({
      method: "PATCH",
      url: "/api/v1/integrations/google-analytics-4/configuration",
      headers,
      payload: {
        projectId: project.id,
        configuration: { propertyId: "G-INVALID" },
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });

  it("exposes the PageSpeed API key as optional to the dashboard", async () => {
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-pagespeed-dashboard-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);

    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers: {
        ...(await authenticatedHeaders(server)),
        "x-golem-client": "dashboard",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        items: Array<{
          id: string;
          credentialFields: Array<{
            key: string;
            label: string;
            required: boolean;
          }>;
        }>;
      };
    };
    const pagespeed = body.data.items.find(
      (integration) => integration.id === "pagespeed-insights",
    );
    expect(pagespeed?.credentialFields).toEqual([
      {
        key: "apiKey",
        label: "API key (optional)",
        type: "secret",
        required: false,
      },
    ]);
  });

  it("uses the selected project for a real connector probe and never returns vault references", async () => {
    const secret = "serpapi-route-secret";
    const providerFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ account_id: "acct-1", total_searches_left: 9 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-provider-test-server-")),
      integrationFetch: providerFetch,
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const headers = await authenticatedHeaders(server);
    const project = await runtime.projects.create({
      name: "Provider test site",
      canonicalUrl: "https://example.com/",
    });

    const saved = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/serpapi/credentials",
      headers,
      payload: { credentials: { apiKey: secret } },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ status: "degraded" });
    expect(saved.body).not.toContain("secretRef");
    expect(saved.body).not.toContain(secret);

    const tested = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/serpapi/test",
      headers,
      payload: { projectId: project.id },
    });
    expect(tested.statusCode).toBe(200);
    expect(tested.json()).toMatchObject({ status: "connected" });
    expect(tested.body).not.toContain("secretRef");
    expect(tested.body).not.toContain(secret);
    expect(providerFetch).toHaveBeenCalledOnce();

    const invalidProject = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/serpapi/test",
      headers,
      payload: { projectId: 42 },
    });
    expect(invalidProject.statusCode).toBe(400);
    expect(invalidProject.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const configured = await server.app.inject({
      method: "PATCH",
      url: "/api/v1/integrations/serpapi/configuration",
      headers,
      payload: {
        projectId: project.id,
        configuration: { location: "Austin, Texas, United States" },
      },
    });
    expect(configured.statusCode).toBe(200);

    const removed = await server.app.inject({
      method: "DELETE",
      url: "/api/v1/integrations/serpapi",
      headers,
    });
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe("");
    expect(
      await runtime.credentialStore.get({
        provider: "serpapi",
        account: "default",
        kind: "credentials",
      }),
    ).toBeNull();
    expect(
      (await runtime.integrations.list(project.id)).find(
        (integration) => integration.provider === "serpapi",
      ),
    ).toMatchObject({
      status: "not_configured",
      configuration: { location: "Austin, Texas, United States" },
    });

    const repeatedRemoval = await server.app.inject({
      method: "DELETE",
      url: "/api/v1/integrations/serpapi",
      headers,
    });
    expect(repeatedRemoval.statusCode).toBe(404);
    expect(repeatedRemoval.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });
});

describe("dashboard bootstrap tickets", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
  });

  it("requires the service token to issue short-lived, one-time tickets", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-bootstrap-server-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    let now = Date.now();
    const server = await createLocalServer({
      runtime,
      port: 3210,
      bootstrapTokenTtlMs: 1_000,
      bootstrapNow: () => now,
    });
    activeServers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();
    const serviceHeaders = {
      host: HOST,
      authorization: `Bearer ${serviceToken}`,
    };

    const unauthenticated = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: { host: HOST },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const issued = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: serviceHeaders,
    });
    expect(issued.statusCode).toBe(200);
    const ticket = issued.json() as { token: string; expiresAt: string };
    expect(ticket.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ticket.expiresAt).toBe(new Date(now + 1_000).toISOString());

    const exchanged = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap",
      headers: { host: HOST },
      payload: { token: ticket.token },
    });
    expect(exchanged.statusCode).toBe(200);
    expect(exchanged.headers["set-cookie"]).toContain("golem_session=");
    const session = exchanged.json() as { csrf: string };
    const cookie = String(exchanged.headers["set-cookie"]).split(";", 1)[0]!;

    const sessionCannotMint = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: {
        host: HOST,
        cookie,
        origin: "http://127.0.0.1:3210",
        "x-golem-csrf": session.csrf,
      },
    });
    expect(sessionCannotMint.statusCode).toBe(401);
    expect(sessionCannotMint.json()).toMatchObject({
      code: "service_token_required",
    });

    const replay = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap",
      headers: { host: HOST },
      payload: { token: ticket.token },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ code: "bootstrap_rejected" });

    const expiring = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: serviceHeaders,
    });
    const expiredTicket = expiring.json() as { token: string };
    now += 1_001;
    const expired = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap",
      headers: { host: HOST },
      payload: { token: expiredTicket.token },
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toMatchObject({ code: "bootstrap_rejected" });
  });

  it("serves the bundled dashboard index without registering the root route twice", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-dashboard-server-"));
    const dashboardDir = mkdtempSync(join(tmpdir(), "golem-dashboard-assets-"));
    writeFileSync(
      join(dashboardDir, "index.html"),
      "<!doctype html><title>Golem SEO</title>",
    );
    const runtime = new GolemLocalRuntime({ dataDir });
    const server = await createLocalServer({
      runtime,
      port: 3210,
      dashboardDir,
    });
    activeServers.push(server);

    await server.app.ready();
    const response = await server.app.inject({
      method: "GET",
      url: "/",
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("<title>Golem SEO</title>");
  });
});

describe("GolemWorkers project transfer", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
  });

  it("links through the hosted device flow and sends a secret-free raw project bundle", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "golem-hosted-server-"));
    const runtime = new GolemLocalRuntime({ dataDir });
    let importedBundle: Record<string, unknown> | null = null;
    const hostedFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/v1/device/authorizations")) {
        return new Response(
          JSON.stringify({
            deviceCode: "private-device-code-never-returned-locally",
            userCode: "ABCD-1234",
            verificationUri: "https://golemworkers.com/seo/device",
            expiresAt: "2026-07-15T12:10:00.000Z",
            intervalSeconds: 5,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/v1/device/token")) {
        return new Response(
          JSON.stringify({
            deviceToken: "linked-device-token-never-returned-locally",
            orgId: "org-hosted",
            expiresAt: "2026-10-15T12:00:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/v1/imports/golemseo")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe(
          "Bearer linked-device-token-never-returned-locally",
        );
        expect(headers.get("x-device-org")).toBe("org-hosted");
        importedBundle = JSON.parse(
          Buffer.from(init?.body as Uint8Array).toString("utf8"),
        ) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            import: {
              projectId: "hosted-project",
              runCount: 0,
              actionCount: 0,
              issueCount: 0,
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected hosted request: ${url}`);
    });
    const server = await createLocalServer({
      runtime,
      port: 3210,
      golemWorkersFetch: hostedFetch,
      golemWorkersNow: () => Date.parse("2026-07-15T12:00:00.000Z"),
    });
    activeServers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = { host: HOST, authorization: `Bearer ${serviceToken}` };
    const project = await runtime.projects.create({
      name: "Transfer site",
      canonicalUrl: "https://example.com",
    });

    const start = await server.app.inject({
      method: "POST",
      url: "/api/v1/golemworkers/device/start",
      headers,
    });
    expect([200, 202]).toContain(start.statusCode);
    expect(start.body).toContain("ABCD-1234");
    expect(start.body).not.toContain("private-device-code");
    expect(start.body).not.toContain("linked-device-token");
    await vi.waitFor(async () =>
      expect(
        (
          await runtime.credentialStore.status({
            provider: "golemworkers",
            account: "default",
            kind: "device",
          })
        ).exists,
      ).toBe(true),
    );

    const imported = await server.app.inject({
      method: "POST",
      url: "/api/v1/golemworkers/import",
      headers,
      payload: { projectId: project.id },
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({
      import: { projectId: "hosted-project" },
    });
    expect(imported.body).not.toContain("linked-device-token");
    expect(importedBundle).toMatchObject({
      format: "golemseo-project",
      version: 2,
      secretsIncluded: false,
      project: { id: project.id },
    });
  });
});
