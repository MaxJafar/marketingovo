import { describe, expect, it, vi } from "vitest";
import {
  checkConnectorHealth,
  connectorHealthEndpoints,
  connectorManifests,
  type CheckConnectorHealthOptions,
  type ConnectorId,
} from "./index.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const successCases: Array<{
  provider: ConnectorId;
  options: Partial<CheckConnectorHealthOptions>;
  payload: unknown;
}> = [
  {
    provider: "google-search-console",
    options: {
      credentials: { accessToken: "gsc-secret-token" },
      configuration: { siteUrl: "sc-domain:example.com" },
    },
    payload: {
      siteUrl: "sc-domain:example.com",
      permissionLevel: "siteOwner",
    },
  },
  {
    provider: "google-analytics-4",
    options: {
      credentials: { accessToken: "ga4-secret-token" },
      configuration: { propertyId: "123456" },
    },
    payload: { rowCount: 0, rows: [] },
  },
  {
    provider: "pagespeed-insights",
    options: {
      credentials: { apiKey: "psi-secret-key" },
      configuration: { strategy: "mobile" },
      targetUrl: "https://example.com/landing?a=1",
    },
    payload: { lighthouseResult: {} },
  },
  {
    provider: "serpapi",
    options: { credentials: { apiKey: "serp-secret-key" } },
    payload: { account_id: "account", total_searches_left: 42 },
  },
  {
    provider: "dataforseo",
    options: {
      credentials: {
        login: "operator@example.com",
        password: "dataforseo-secret-password",
      },
    },
    payload: { status_code: 20_000, tasks: [] },
  },
];

describe("connector health", () => {
  it.each(successCases)(
    "verifies $provider only against an exact HTTPS manifest host",
    async ({ provider, options, payload }) => {
      const calls: Array<{ input: URL | RequestInfo; init?: RequestInit }> = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        calls.push({ input, ...(init ? { init } : {}) });
        return json(payload);
      };
      const health = await checkConnectorHealth({
        provider,
        ...options,
        fetchImpl,
        now: () => new Date("2026-07-15T12:00:00.000Z"),
      });

      expect(health.status).toBe("connected");
      expect(health.checkedAt).toBe("2026-07-15T12:00:00.000Z");
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      const url = new URL(String(call.input));
      const manifest = connectorManifests.find((item) => item.id === provider);
      expect(url.protocol).toBe("https:");
      expect(manifest?.egressHosts).toContain(url.hostname);
      expect(call.init?.redirect).toBe("error");
      expect(call.init?.signal).toBeInstanceOf(AbortSignal);
      if (provider === "serpapi") expect(health.remainingQuota).toBe(42);
    },
  );

  it("uses project configuration in the GSC and GA4 probes", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: new URL(String(input)), init: init ?? {} });
      return calls.length === 1
        ? json({
            siteUrl: "sc-domain:example.com",
            permissionLevel: "siteOwner",
          })
        : json({ rowCount: 0, rows: [] });
    };

    await checkConnectorHealth({
      provider: "google-search-console",
      credentials: { accessToken: "first-token" },
      configuration: { siteUrl: "sc-domain:example.com" },
      fetchImpl,
    });
    await checkConnectorHealth({
      provider: "google-analytics-4",
      credentials: { accessToken: "second-token" },
      configuration: { propertyId: "987654" },
      fetchImpl,
    });

    expect(
      decodeURIComponent(calls[0]!.url.pathname).endsWith(
        "/sites/sc-domain:example.com",
      ),
    ).toBe(true);
    expect(
      calls[1]!.url.pathname.endsWith("/properties/987654:runReport"),
    ).toBe(true);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      dateRanges: [{ startDate: "today", endDate: "today" }],
      metrics: [{ name: "sessions" }],
      limit: "1",
    });
  });

  it("sends the exact target and strategy to PageSpeed Insights", async () => {
    let requested: URL | undefined;
    await checkConnectorHealth({
      provider: "pagespeed-insights",
      credentials: { apiKey: "pagespeed-secret" },
      configuration: { strategy: "desktop" },
      targetUrl: "https://example.com/a?b=1",
      fetchImpl: async (input) => {
        requested = new URL(String(input));
        return json({ loadingExperience: {} });
      },
    });

    expect(requested).toBeDefined();
    if (!requested) throw new Error("PageSpeed request was not issued");
    expect(requested.origin + requested.pathname).toBe(
      connectorHealthEndpoints["pagespeed-insights"],
    );
    expect(requested.searchParams.get("url")).toBe("https://example.com/a?b=1");
    expect(requested.searchParams.get("strategy")).toBe("desktop");
  });

  it("reports Trends as degraded without pretending a network probe is reliable", async () => {
    const fetchImpl = vi.fn(async () => json({}));
    const health = await checkConnectorHealth({
      provider: "google-trends",
      fetchImpl,
    });

    expect(health.status).toBe("degraded");
    expect(health.message).toContain("no stable credential health endpoint");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, "expired"],
    [403, "degraded"],
    [429, "rate_limited"],
    [500, "failed"],
  ] as const)("maps HTTP %i to %s", async (status, expected) => {
    const health = await checkConnectorHealth({
      provider: "serpapi",
      credentials: { apiKey: "serp-secret-key" },
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      fetchImpl: async () =>
        new Response("provider detail must not escape", {
          status,
          headers: status === 429 ? { "retry-after": "60" } : {},
        }),
    });

    expect(health.status).toBe(expected);
    expect(JSON.stringify(health)).not.toContain("provider detail");
    if (status === 429) {
      expect(health.resetsAt).toBe("2026-07-15T12:01:00.000Z");
    }
  });

  it.each([new Response("not json", { status: 200 }), json({})])(
    "maps malformed successful payloads to degraded",
    async (response) => {
      const health = await checkConnectorHealth({
        provider: "serpapi",
        credentials: { apiKey: "serp-secret-key" },
        fetchImpl: async () => response.clone(),
      });
      expect(health.status).toBe("degraded");
      expect(health.message).toContain("malformed");
    },
  );

  it("aborts at the deadline and maps timeout to failed even if fetch ignores the signal", async () => {
    const health = await checkConnectorHealth({
      provider: "serpapi",
      credentials: { apiKey: "serp-secret-key" },
      timeoutMs: 50,
      fetchImpl: async () => await new Promise<Response>(() => {}),
    });

    expect(health.status).toBe("failed");
    expect(health.message).toContain("timed out");
  });

  it("keeps the deadline active while reading a stalled response body", async () => {
    const health = await checkConnectorHealth({
      provider: "serpapi",
      credentials: { apiKey: "serp-secret-key" },
      timeoutMs: 50,
      fetchImpl: async () =>
        new Response(new ReadableStream<Uint8Array>({ start() {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    expect(health.status).toBe("failed");
    expect(health.message).toContain("timed out");
  });

  it("does not copy secrets or provider errors into health output", async () => {
    const secrets = {
      apiKey: "sk_this-must-never-appear",
      nested: { token: "nested-secret" },
    };
    const health = await checkConnectorHealth({
      provider: "serpapi",
      credentials: secrets,
      fetchImpl: async () => {
        throw new Error(`request leaked ${secrets.apiKey}`);
      },
    });
    const serialized = JSON.stringify(health);

    expect(health.status).toBe("failed");
    expect(serialized).not.toContain(secrets.apiKey);
    expect(serialized).not.toContain("nested-secret");
    expect(serialized).not.toContain("request leaked");
  });

  it("requires provider-specific configuration instead of claiming success", async () => {
    const gsc = await checkConnectorHealth({
      provider: "google-search-console",
      credentials: { accessToken: "token" },
    });
    const ga4 = await checkConnectorHealth({
      provider: "google-analytics-4",
      credentials: { accessToken: "token" },
      configuration: { propertyId: "properties/123" },
    });
    const psi = await checkConnectorHealth({
      provider: "pagespeed-insights",
      targetUrl: "file:///etc/passwd",
    });
    const psiWithCredentials = await checkConnectorHealth({
      provider: "pagespeed-insights",
      targetUrl: "https://user:password@example.com/",
    });

    expect(gsc.status).toBe("not_configured");
    expect(ga4.status).toBe("not_configured");
    expect(psi.status).toBe("not_configured");
    expect(psiWithCredentials.status).toBe("not_configured");
  });
});
