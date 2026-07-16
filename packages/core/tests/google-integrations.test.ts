import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readTokenFile,
  writeTokenFile,
  refreshAccessToken,
  ensureFresh,
  manageTokenFile,
  resolveTokenFiles,
} from "../src/integrations/google/oauth.js";
import { GscClient } from "../src/integrations/google/gsc.js";
import { Ga4Client } from "../src/integrations/google/ga4.js";

const origFetch = globalThis.fetch;
const injectedProviderFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);

let tmpDir: string;
let tokenPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sc-google-"));
  tokenPath = join(tmpDir, "token.json");
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  globalThis.fetch = origFetch;
});

function seedToken(): void {
  writeTokenFile(tokenPath, {
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "rt",
    accessToken: "at",
    expiresAt: Date.now() + 3600 * 1000,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  });
}

describe("oauth token store", () => {
  it("reads and writes token files", () => {
    seedToken();
    const c = readTokenFile(tokenPath);
    expect(c.clientId).toBe("id");
    expect(c.refreshToken).toBe("rt");
    expect(c.scope).toContain("webmasters");
    expect(c.expiresAt).toBeGreaterThan(Date.now());
    expect(statSync(tokenPath).mode & 0o777).toBe(0o600);
  });

  it("treats legacy relative-only expiry as expired after restart", () => {
    writeFileSync(
      tokenPath,
      JSON.stringify({
        client_id: "id",
        client_secret: "secret",
        refresh_token: "rt",
        access_token: "at",
        expires_in: 3600,
      }),
    );
    expect(readTokenFile(tokenPath).expiresAt).toBeLessThanOrEqual(Date.now());
  });

  it("preserves refresh_token on write", () => {
    seedToken();
    const c = readTokenFile(tokenPath);
    c.accessToken = "at2";
    writeTokenFile(tokenPath, c);
    const c2 = readTokenFile(tokenPath);
    expect(c2.refreshToken).toBe("rt");
    expect(c2.accessToken).toBe("at2");
  });

  it("ensureFresh returns the same object when not near expiry", async () => {
    seedToken();
    const c = readTokenFile(tokenPath);
    const next = await ensureFresh(c);
    expect(next).toBe(c);
  });

  it("refreshAccessToken posts to Google's token endpoint and returns new creds", async () => {
    seedToken();
    const c = readTokenFile(tokenPath);
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(
        JSON.stringify({
          access_token: "at-new",
          expires_in: 3600,
          scope: "x",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const next = await refreshAccessToken(c, undefined, injectedProviderFetch);
    expect(next.accessToken).toBe("at-new");
    expect(captured?.url).toBe("https://oauth2.googleapis.com/token");
    const body = String((captured!.init as { body: string }).body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=rt");
  });

  it("throws if no refresh_token", async () => {
    seedToken();
    const c = readTokenFile(tokenPath);
    c.refreshToken = null;
    await expect(refreshAccessToken(c)).rejects.toThrow(/no refresh_token/);
  });

  it("manageTokenFile refreshes + persists when expired", async () => {
    seedToken();
    const m = manageTokenFile(tokenPath, injectedProviderFetch);
    // Force expiry by mutating in-memory creds via persist (so the
    // closure sees the new value).
    m.persist({ ...m.creds, expiresAt: Date.now() - 1000 });
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ access_token: "at-fresh", expires_in: 3600 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch;
    const c = await m.refresh();
    expect(c.accessToken).toBe("at-fresh");
    // Persisted back to disk
    const onDisk = readTokenFile(tokenPath);
    expect(onDisk.accessToken).toBe("at-fresh");
  });

  it("coalesces concurrent refreshes and atomically persists one result", async () => {
    seedToken();
    const m = manageTokenFile(tokenPath, injectedProviderFetch);
    m.persist({ ...m.creds, expiresAt: Date.now() - 1000 });
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(
        JSON.stringify({ access_token: "one-refresh", expires_in: 3600 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;
    const [first, second] = await Promise.all([m.refresh(), m.refresh()]);
    expect(calls).toBe(1);
    expect(first.accessToken).toBe("one-refresh");
    expect(second.accessToken).toBe("one-refresh");
    expect(readTokenFile(tokenPath).accessToken).toBe("one-refresh");
  });

  it("resolveTokenFiles respects SCREAMINGCLAW_GSC_TOKEN env", () => {
    process.env.SCREAMINGCLAW_GSC_TOKEN = tokenPath;
    seedToken();
    const r = resolveTokenFiles();
    expect(r.gsc).toBe(tokenPath);
    delete process.env.SCREAMINGCLAW_GSC_TOKEN;
  });
});

describe("GscClient", () => {
  it("searchAnalytics posts to webmasters/v3", async () => {
    seedToken();
    const m = manageTokenFile(tokenPath, injectedProviderFetch);
    const c = new GscClient(m, injectedProviderFetch);
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) {
        return new Response(
          JSON.stringify({ access_token: "at", expires_in: 3600 }),
          { status: 200 },
        );
      }
      captured = { url: u, init: init ?? {} };
      return new Response(
        JSON.stringify({
          rows: [
            {
              keys: ["2025-01-01", "screaming frog", "https://example.com/"],
              clicks: 3,
              impressions: 100,
              ctr: 0.03,
              position: 1.5,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const rows = await c.searchAnalytics({
      siteUrl: "https://example.com/",
      startDate: "2025-01-01",
      endDate: "2025-01-07",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.query).toBe("screaming frog");
    expect(rows[0]?.clicks).toBe(3);
    expect(captured?.url).toContain(
      "/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics/query",
    );
    const requestBody = JSON.parse(String(captured?.init.body));
    expect(requestBody.dimensions).toEqual(["date", "query", "page"]);
    expect(requestBody.startRow).toBe(0);
    expect(requestBody.rowLimit).toBe(25_000);
  });

  it("paginates with lowercase dimensions and startRow", async () => {
    seedToken();
    const c = new GscClient(
      manageTokenFile(tokenPath, injectedProviderFetch),
      injectedProviderFetch,
    );
    const bodies: Array<{
      startRow: number;
      rowLimit: number;
      dimensions: string[];
    }> = [];
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      const rows =
        body.startRow === 0
          ? [
              { keys: ["q1"], clicks: 1, impressions: 2 },
              { keys: ["q2"], clicks: 1, impressions: 2 },
            ]
          : [{ keys: ["q3"], clicks: 1, impressions: 2 }];
      return new Response(JSON.stringify({ rows }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const rows = await c.searchAnalytics({
      siteUrl: "sc-domain:example.com",
      startDate: "2025-01-01",
      endDate: "2025-01-07",
      dimensions: ["query"],
      rowLimit: 3,
      pageSize: 2,
    });
    expect(rows.map((row) => row.query)).toEqual(["q1", "q2", "q3"]);
    expect(bodies).toEqual([
      {
        startDate: "2025-01-01",
        endDate: "2025-01-07",
        dimensions: ["query"],
        rowLimit: 2,
        startRow: 0,
      },
      {
        startDate: "2025-01-01",
        endDate: "2025-01-07",
        dimensions: ["query"],
        rowLimit: 1,
        startRow: 2,
      },
    ]);
  });

  it("perPage aggregates by page", async () => {
    seedToken();
    const c = new GscClient(
      manageTokenFile(tokenPath, injectedProviderFetch),
      injectedProviderFetch,
    );
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) {
        return new Response(
          JSON.stringify({ access_token: "at", expires_in: 3600 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          rows: [
            {
              keys: ["https://x/a"],
              clicks: 5,
              impressions: 100,
              ctr: 0.05,
              position: 2.0,
            },
            {
              keys: ["https://x/a"],
              clicks: 3,
              impressions: 50,
              ctr: 0.06,
              position: 3.0,
            },
            {
              keys: ["https://x/b"],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 5.0,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const stats = await c.perPage({
      siteUrl: "https://x.com/",
      startDate: "2025-01-01",
      endDate: "2025-01-07",
    });
    expect(stats).toHaveLength(2);
    expect(stats[0]?.page).toBe("https://x/a");
    expect(stats[0]?.clicks).toBe(8);
    expect(stats[0]?.impressions).toBe(150);
    expect(stats[0]?.position).toBeCloseTo(2.5, 1);
  });
});

describe("Ga4Client", () => {
  it("perPage posts to runReport", async () => {
    seedToken();
    const c = new Ga4Client(
      manageTokenFile(tokenPath, injectedProviderFetch),
      "123",
      injectedProviderFetch,
    );
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) {
        return new Response(
          JSON.stringify({ access_token: "at", expires_in: 3600 }),
          { status: 200 },
        );
      }
      captured = { url: u, init: init ?? {} };
      return new Response(
        JSON.stringify({
          rows: [
            {
              dimensionValues: [{ value: "/articles/setup" }],
              metricValues: [
                { value: "10" },
                { value: "20" },
                { value: "0.7" },
                { value: "0.3" },
                { value: "120" },
                { value: "0" },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const rows = await c.perPage({ startDate: "30daysAgo", endDate: "today" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.page).toBe("/articles/setup");
    expect(rows[0]?.sessions).toBe(10);
    expect(rows[0]?.engagementRate).toBe(0.7);
    expect(captured?.url).toContain("/properties/123:runReport");
    const requestBody = JSON.parse(String(captured?.init.body));
    expect(requestBody.metrics.at(-1)).toEqual({ name: "keyEvents" });
    expect(requestBody.dimensionFilter).toEqual({
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: {
          matchType: "EXACT",
          value: "Organic Search",
          caseSensitive: true,
        },
      },
    });
    expect(requestBody.offset).toBe("0");
    expect(requestBody.limit).toBe("100000");
    expect(captured?.init.redirect).toBe("error");
    expect(JSON.stringify(requestBody)).not.toContain("clientSecret");
    expect(JSON.stringify(requestBody)).not.toContain("refreshToken");
  });

  it("paginates GA4 rows with offset and rowCount", async () => {
    seedToken();
    const c = new Ga4Client(
      manageTokenFile(tokenPath, injectedProviderFetch),
      "123",
      injectedProviderFetch,
    );
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      const paths = body.offset === "0" ? ["/a", "/b"] : ["/c"];
      return new Response(
        JSON.stringify({
          rowCount: 3,
          rows: paths.map((path) => ({
            dimensionValues: [{ value: path }],
            metricValues: ["1", "2", "0.5", "0.5", "3", "4"].map((value) => ({
              value,
            })),
          })),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const rows = await c.perPage({
      startDate: "30daysAgo",
      endDate: "today",
      limit: 3,
      pageSize: 2,
    });
    expect(bodies.map((body) => body.offset)).toEqual(["0", "2"]);
    expect(bodies.map((body) => body.dimensionFilter)).toEqual([
      {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: {
            matchType: "EXACT",
            value: "Organic Search",
            caseSensitive: true,
          },
        },
      },
      {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: {
            matchType: "EXACT",
            value: "Organic Search",
            caseSensitive: true,
          },
        },
      },
    ]);
    expect(rows.map((row) => row.page)).toEqual(["/a", "/b", "/c"]);
    expect(rows[0]?.keyEvents).toBe(4);
    expect(rows[0]).not.toHaveProperty("conversions");
  });

  it("isConfigured requires a property id", () => {
    seedToken();
    const empty = new Ga4Client(manageTokenFile(tokenPath), "");
    expect(empty.isConfigured()).toBe(false);
    const ok = new Ga4Client(manageTokenFile(tokenPath), "123");
    expect(ok.isConfigured()).toBe(true);
    expect(
      new Ga4Client(
        manageTokenFile(tokenPath),
        "properties/123",
      ).isConfigured(),
    ).toBe(false);
    expect(
      new Ga4Client(manageTokenFile(tokenPath), "abc").isConfigured(),
    ).toBe(false);
    expect(new Ga4Client(manageTokenFile(tokenPath), "0").isConfigured()).toBe(
      false,
    );
  });
});
