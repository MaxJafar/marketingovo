import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { crawl } from "../src/orchestrator.js";

describe("active orchestrator credential boundary", () => {
  let server: Server;
  let startUrl: string;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html><head><title>Vault boundary</title></head><body><h1>Safe</h1></body></html>",
      );
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("missing port");
    startUrl = `http://127.0.0.1:${address.port}/`;
  });

  afterEach(() => vi.unstubAllEnvs());

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("does not auto-load legacy Google token files during an audit", async () => {
    const directory = mkdtempSync(join(tmpdir(), "golem-token-boundary-"));
    const tokenPath = join(directory, "gsc-token.json");
    const legacyAccessToken = "legacy-file-access-token-must-stay-unused";
    writeFileSync(
      tokenPath,
      JSON.stringify({
        client_id: "legacy-client",
        client_secret: "legacy-client-secret",
        refresh_token: "legacy-refresh-token",
        access_token: legacyAccessToken,
        expires_at: Date.now() + 3_600_000,
      }),
      { mode: 0o600 },
    );
    vi.stubEnv("GOLEMSEO_GSC_TOKEN", tokenPath);
    vi.stubEnv("GOLEMSEO_ALLOW_PRIVATE", "1");
    const providerFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ rows: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    try {
      const result = await crawl({
        startUrl,
        gscSiteUrl: "sc-domain:example.com",
        providerFetch,
        privateHostAllowlist: ["127.0.0.1"],
        limits: {
          maxUrls: 1,
          maxRuntimeMs: 5_000,
          maxConcurrency: 1,
          requestsPerSecond: 100,
          requestTimeoutMs: 2_000,
          ignoreRobots: true,
        },
      });

      expect(providerFetch).not.toHaveBeenCalled();
      expect(result.report.realData?.errors).toContain(
        "GSC: credentials are not connected",
      );
      expect(JSON.stringify(result.report)).not.toContain(legacyAccessToken);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses an explicit PSI key for enrichment without copying it into the report", async () => {
    const apiKey = "vault-psi-orchestrator-secret";
    let requestedUrl: URL | undefined;
    const providerFetch = vi.fn<typeof fetch>(async (input) => {
      requestedUrl = new URL(String(input));
      return new Response(
        JSON.stringify({
          finalUrl: startUrl,
          analysisUTCTimestamp: "2026-07-15T00:00:00.000Z",
          lighthouseResult: {
            categories: {
              performance: { score: 0.91, title: "Performance" },
              accessibility: { score: 0.95, title: "Accessibility" },
              "best-practices": { score: 0.93, title: "Best Practices" },
              seo: { score: 1, title: "SEO" },
            },
            audits: {},
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await crawl({
      startUrl,
      pageSpeedInsights: { apiKey, strategy: "desktop" },
      providerFetch,
      privateHostAllowlist: ["127.0.0.1"],
      limits: {
        maxUrls: 1,
        maxRuntimeMs: 5_000,
        maxConcurrency: 1,
        requestsPerSecond: 100,
        requestTimeoutMs: 2_000,
        ignoreRobots: true,
      },
    });

    expect(providerFetch).toHaveBeenCalledOnce();
    expect(requestedUrl?.hostname).toBe("pagespeedonline.googleapis.com");
    expect(requestedUrl?.searchParams.get("key")).toBe(apiKey);
    expect(result.report.realData?.pageSpeedInsights?.[0]).toMatchObject({
      strategy: "desktop",
      scores: { performance: { score: 91 } },
    });
    expect(JSON.stringify(result.report)).not.toContain(apiKey);
  });
});
