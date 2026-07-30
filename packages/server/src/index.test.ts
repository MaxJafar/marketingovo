import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const CLIENT_ID = "public-desktop-client.apps.googleusercontent.com";

describe("local Google desktop OAuth", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function authenticatedHeaders(
    server: LocalServer,
  ): Promise<Record<string, string>> {
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    return { host: HOST, authorization: `Bearer ${token}` };
  }

  it("returns clear problem+json when the public desktop client ID is not configured", async () => {
    vi.stubEnv("MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID", "");
    vi.stubEnv("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID", "");
    vi.stubEnv("GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID", "");
    const dataDir = mkdtempSync(join(tmpdir(), "marketingovo-oauth-server-"));
    const runtime = new MarketingovoLocalRuntime({ dataDir });
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
      type: "urn:marketingovo:problem:google-oauth-not-configured",
      code: "google_oauth_not_configured",
      title: "Google OAuth is not configured",
      status: 503,
    });
    expect(response.body).toContain("MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID");
  });

  it("prefers the canonical desktop client ID over both migration aliases", async () => {
    const canonicalClientId = "canonical-client.apps.googleusercontent.com";
    const legacyClientId = "legacy-client-value-must-not-be-used";
    const irregularClientId = "irregular-client-value-must-not-be-used";
    vi.stubEnv("MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID", canonicalClientId);
    vi.stubEnv("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID", legacyClientId);
    vi.stubEnv("GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID", irregularClientId);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-oauth-precedence-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);

    const response = await server.app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-search-console/auth/start",
      headers: await authenticatedHeaders(server),
    });

    expect(response.statusCode).toBe(200);
    const authorizationUrl = new URL(
      (response.json() as { authorizationUrl: string }).authorizationUrl,
    );
    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      canonicalClientId,
    );
    expect(response.body).not.toContain(legacyClientId);
    expect(response.body).not.toContain(irregularClientId);
    expect(warning).not.toHaveBeenCalled();
  });

  it("uses a random loopback callback, persists safe metadata, and never serializes tokens", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "marketingovo-oauth-server-"));
    const runtime = new MarketingovoLocalRuntime({ dataDir });
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
    expect(callbackBody).toContain("<title>Marketingovo connected</title>");
    expect(callbackBody).not.toContain("Golem SEO connected");
    expect(callbackBody).not.toContain(accessToken);
    expect(callbackBody).not.toContain(refreshToken);
    expect(oauthFetch).toHaveBeenCalledOnce();

    const replayResponse = await fetch(callback, { redirect: "error" });
    expect(replayResponse.status).toBe(410);
    const replayBody = await replayResponse.text();
    expect(JSON.parse(replayBody)).toMatchObject({
      type: "urn:marketingovo:problem:oauth-transaction-replayed",
      code: "oauth_transaction_replayed",
      status: 410,
    });
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
      headers: { ...headers, "x-marketingovo-client": "dashboard" },
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
    const databaseBytes = readFileSync(join(dataDir, "marketingovo.db"));
    expect(databaseBytes.includes(Buffer.from(accessToken))).toBe(false);
    expect(databaseBytes.includes(Buffer.from(refreshToken))).toBe(false);
  });

  it("validates and isolates connector configuration for the selected project", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-config-server-")),
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
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-pagespeed-dashboard-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);

    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers: {
        ...(await authenticatedHeaders(server)),
        "x-marketingovo-client": "dashboard",
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
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-provider-test-server-"),
      ),
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
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-bootstrap-server-"),
    );
    const runtime = new MarketingovoLocalRuntime({ dataDir });
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
    const setCookieHeader = exchanged.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [String(setCookieHeader)];
    expect(
      setCookies.some((cookie) => cookie.startsWith("marketingovo_session=")),
    ).toBe(true);
    expect(
      setCookies.some((cookie) => cookie.startsWith("marketingovo_session=")),
    ).toBe(true);
    const session = exchanged.json() as { csrf: string };
    const cookie = setCookies
      .find((value) => value.startsWith("marketingovo_session="))!
      .split(";", 1)[0]!;

    const sessionCannotMint = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: {
        host: HOST,
        cookie,
        origin: "http://127.0.0.1:3210",
        "x-marketingovo-csrf": session.csrf,
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

  it("accepts only the canonical dashboard identifiers and rejects the retired aliases", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-session-identity-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();
    const serviceHeaders = {
      host: HOST,
      authorization: `Bearer ${serviceToken}`,
    };
    const ticketResponse = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: serviceHeaders,
    });
    const ticket = ticketResponse.json() as { token: string };
    const exchanged = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap",
      headers: { host: HOST },
      payload: ticket,
    });
    const session = exchanged.json() as { csrf: string };
    const rawSetCookie = exchanged.headers["set-cookie"];
    const setCookies = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : [String(rawSetCookie)];

    // Exactly one session cookie is issued, under the canonical name.
    expect(
      setCookies.filter((value) => value.includes("_session=")),
    ).toHaveLength(1);
    expect(
      setCookies.some((value) => value.startsWith("marketingovo_session=")),
    ).toBe(true);
    expect(setCookies.some((value) => value.startsWith("golem_session="))).toBe(
      false,
    );

    const sessionValue = setCookies
      .find((value) => value.startsWith("marketingovo_session="))!
      .split(";", 1)[0]!
      .slice("marketingovo_session=".length);

    const canonicalSession = await server.app.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: HOST, cookie: `marketingovo_session=${sessionValue}` },
    });
    expect(canonicalSession.statusCode).toBe(200);

    // The retired cookie name is not a credential.
    const retiredSession = await server.app.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: HOST, cookie: `golem_session=${sessionValue}` },
    });
    expect(retiredSession.statusCode).toBe(401);

    const canonicalMutation = await server.app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: {
        host: HOST,
        cookie: `marketingovo_session=${sessionValue}`,
        origin: "http://127.0.0.1:3210",
        "x-marketingovo-csrf": session.csrf,
      },
      payload: {
        name: "Canonical session project",
        canonicalUrl: "https://canonical.example.com",
      },
    });
    expect(canonicalMutation.statusCode).toBe(201);

    // The retired CSRF header does not satisfy the CSRF requirement.
    const retiredCsrf = await server.app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: {
        host: HOST,
        cookie: `marketingovo_session=${sessionValue}`,
        origin: "http://127.0.0.1:3210",
        "x-golem-csrf": session.csrf,
      },
      payload: {
        name: "Rejected project",
        canonicalUrl: "https://rejected.example.com",
      },
    });
    expect(retiredCsrf.statusCode).toBe(403);
    expect(retiredCsrf.json()).toMatchObject({ code: "csrf_rejected" });

    // Dashboard identity comes only from the canonical client header.
    const canonicalDashboard = await server.app.inject({
      method: "GET",
      url: "/api/v1/runs",
      headers: { ...serviceHeaders, "x-marketingovo-client": "dashboard" },
    });
    expect(canonicalDashboard.json()).toHaveProperty("meta");

    const retiredDashboard = await server.app.inject({
      method: "GET",
      url: "/api/v1/runs",
      headers: { ...serviceHeaders, "x-golem-client": "dashboard" },
    });
    expect(retiredDashboard.json()).toEqual([]);
  });

  it("publishes exactly one canonical session security scheme", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-openapi-identity-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);

    const response = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      info: { title: string; description: string };
      components: {
        securitySchemes: Record<string, Record<string, string>>;
      };
    };
    expect(document.info).toEqual({
      title: "Marketingovo Local API",
      version: "1.0.0",
      description: "Loopback API for the local-first Marketingovo application",
    });
    expect(document.components.securitySchemes.localServiceToken).toMatchObject(
      { bearerFormat: "Marketingovo local service token" },
    );
    expect(document.components.securitySchemes.localSession).toMatchObject({
      name: "marketingovo_session",
    });
    expect(document.components.securitySchemes).not.toHaveProperty(
      "legacyLocalSession",
    );
  });

  it("serves the bundled dashboard index without registering the root route twice", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-dashboard-server-"),
    );
    const dashboardDir = mkdtempSync(
      join(tmpdir(), "marketingovo-dashboard-assets-"),
    );
    writeFileSync(
      join(dashboardDir, "index.html"),
      "<!doctype html><title>Marketingovo</title>",
    );
    const runtime = new MarketingovoLocalRuntime({ dataDir });
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
    expect(response.body).toContain("<title>Marketingovo</title>");
  });
});

describe("hosted service independence", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
    vi.unstubAllGlobals();
  });

  it("leaves legacy hosted routes unregistered without making network calls", async () => {
    const hostedFetch = vi.fn<typeof fetch>(async (input) => {
      throw new Error(`Unexpected hosted request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", hostedFetch);
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-local-server-")),
    });
    const server = await createLocalServer({
      runtime,
      port: 3210,
    });
    activeServers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = { host: HOST, authorization: `Bearer ${serviceToken}` };

    const responses = await Promise.all([
      server.app.inject({
        method: "GET",
        url: "/api/v1/maxjafar/device/status",
        headers,
      }),
      server.app.inject({
        method: "POST",
        url: "/api/v1/maxjafar/device/start",
        headers,
      }),
      server.app.inject({
        method: "DELETE",
        url: "/api/v1/maxjafar/device",
        headers,
      }),
      server.app.inject({
        method: "POST",
        url: "/api/v1/maxjafar/import",
        headers,
        payload: { projectId: "legacy-project" },
      }),
    ]);

    expect(responses.map(({ statusCode }) => statusCode)).toEqual([
      404, 404, 404, 404,
    ]);
    expect(
      await runtime.credentialStore.status({
        provider: "maxjafar",
        account: "default",
        kind: "device",
      }),
    ).toMatchObject({ exists: false });

    const capabilities = await server.app.inject({
      method: "GET",
      url: "/api/v1/capabilities",
      headers: { host: HOST },
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toMatchObject({
      hosted: {
        available: false,
        url: "urn:marketingovo:hosted-unavailable",
        message:
          "Marketingovo is local-first; no hosted service is configured.",
      },
    });

    const openApi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers: { host: HOST },
    });
    expect(openApi.statusCode).toBe(200);
    expect(openApi.body).not.toContain("/api/v1/maxjafar");
    expect(hostedFetch).not.toHaveBeenCalled();
  });
});
