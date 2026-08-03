import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decodeOAuthCredential } from "@marketingovo/credentials";
import type { Report as EngineReport } from "@marketingovo/core";
import { MarketingovoLocalRuntime } from "./index.js";

function reportFixture(input: Record<string, unknown>): EngineReport {
  const summary = input.summary as
    | {
        pagesCrawled?: number;
        issuesByPriority?: Record<string, number>;
        issuesByCategory?: Record<string, number>;
      }
    | undefined;
  const pages = (input.pages ?? []) as Array<Record<string, unknown>>;
  const rawRealData = input.realData as Record<string, unknown> | undefined;
  const gsc = (rawRealData?.gsc ?? []) as Array<Record<string, unknown>>;
  const ga4 = (rawRealData?.ga4 ?? []) as Array<Record<string, unknown>>;
  return {
    ...input,
    config: {
      maxUrls: 100,
      maxRuntimeMs: 60_000,
      requestsPerSecond: 2,
    },
    summary: {
      pagesCrawled: summary?.pagesCrawled ?? pages.length,
      issuesByPriority: {
        High: 0,
        Medium: 0,
        Low: 0,
        ...summary?.issuesByPriority,
      },
      issuesByCategory: summary?.issuesByCategory ?? {},
    },
    pages: pages.map((page) => ({
      contentType: "text/html",
      canonical: null,
      robotsMeta: null,
      xRobotsTag: null,
      robotsAllowed: true,
      htmlParsed: true,
      error: null,
      redirectChain: [],
      ...page,
    })),
    topUrls: [],
    ...(rawRealData
      ? {
          realData: {
            periodStart: "2026-06-14",
            periodEnd: "2026-07-11",
            topQueries: [],
            sitemaps: [],
            errors: [],
            ...rawRealData,
            gsc: gsc.map((row) => ({ ctr: 0, position: 0, ...row })),
            ga4: ga4.map((row) => ({
              sessions: 0,
              pageViews: 0,
              engagementRate: 0,
              bounceRate: 0,
              avgSessionDuration: 0,
              keyEvents: 0,
              ...row,
            })),
          },
        }
      : {}),
  } as unknown as EngineReport;
}

describe("runtime independence capabilities", () => {
  it("advertises local-only operation without a hosted service", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-capabilities-")),
    });

    try {
      expect((await runtime.system.capabilities()).hosted).toEqual({
        available: false,
        url: "urn:marketingovo:hosted-unavailable",
        message:
          "Marketingovo is local-first; no hosted service is configured.",
      });
    } finally {
      runtime.close();
    }
  });
});

describe("runtime OAuth integration persistence", () => {
  it("persists health, scopes and absolute expiry while keeping tokens in CredentialStore", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "marketingovo-runtime-oauth-"));
    const runtime = new MarketingovoLocalRuntime({ dataDir });
    const accessToken = "runtime-access-secret";
    const refreshToken = "runtime-refresh-secret";
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    try {
      const integration = await runtime.integrations.completeOAuth(
        "google-analytics-4",
        "default",
        {
          provider: "google-analytics-4",
          accessToken,
          refreshToken,
          tokenType: "Bearer",
          expiresAt,
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        },
      );
      expect(integration).toMatchObject({
        provider: "google-analytics-4",
        status: "connected",
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        expiresAt,
      });
      expect(JSON.stringify(integration)).not.toContain(accessToken);
      expect(JSON.stringify(integration)).not.toContain(refreshToken);
      expect(runtime.database.listIntegrations()[0]).toEqual(integration);

      const credential = await runtime.credentialStore.get({
        provider: "google-analytics-4",
        account: "default",
        kind: "oauth",
      });
      expect(Buffer.from(credential!).toString("utf8")).toContain(accessToken);
      expect(Buffer.from(credential!).toString("utf8")).toContain(refreshToken);
      const database = readFileSync(join(dataDir, "marketingovo.db"));
      expect(database.includes(Buffer.from(accessToken))).toBe(false);
      expect(database.includes(Buffer.from(refreshToken))).toBe(false);
    } finally {
      runtime.close();
    }
  });

  it("persists expired health for an already-expired token set", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-oauth-")),
    });
    try {
      const integration = await runtime.integrations.completeOAuth(
        "google-search-console",
        "default",
        {
          provider: "google-search-console",
          accessToken: "expired-access",
          refreshToken: "expired-refresh",
          tokenType: "Bearer",
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
          scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        },
      );
      expect(integration.status).toBe("expired");
      expect(runtime.database.listIntegrations()[0]?.status).toBe("expired");
    } finally {
      runtime.close();
    }
  });

  it("injects refreshed vault credentials and per-project mappings into an audit", async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    let receivedAccessToken: string | undefined;
    const engine = {
      async crawl(options: Record<string, unknown>) {
        receivedOptions = options;
        const tokens = options.googleTokens as {
          gsc?: { refresh(): Promise<{ accessToken: string }> };
        };
        receivedAccessToken = (await tokens.gsc!.refresh()).accessToken;
        return {
          runId: "engine-run",
          report: reportFixture({
            generatedAt: new Date().toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: {},
              issuesByCategory: {},
            },
            issues: [],
            pages: [
              {
                url: String(options.startUrl),
                finalUrl: String(options.startUrl),
                status: 200,
                title: "Bridge",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Report</title>",
      reportToCsv: () => "url,status\n",
    };
    const oauthFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "rotated-runtime-access",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/webmasters.readonly",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-bridge-")),
      engine,
      googleDesktopClientId: "desktop-client.apps.googleusercontent.com",
      oauthFetch,
    });
    try {
      const project = await runtime.projects.create({
        name: "Bridge",
        canonicalUrl: "https://example.com",
      });
      await runtime.integrations.configure(
        "google-search-console",
        project.id,
        { siteUrl: "sc-domain:example.com" },
      );
      await runtime.integrations.completeOAuth(
        "google-search-console",
        "default",
        {
          provider: "google-search-console",
          accessToken: "expired-runtime-access",
          refreshToken: "runtime-refresh-token",
          tokenType: "Bearer",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
          scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        },
      );
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "bridge-test-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }

      expect(completed?.status).toBe("succeeded");
      expect(receivedOptions?.gscSiteUrl).toBe("sc-domain:example.com");
      expect(receivedAccessToken).toBe("rotated-runtime-access");
      expect(oauthFetch).toHaveBeenCalledOnce();
      const storedBytes = await runtime.credentialStore.get({
        provider: "google-search-console",
        account: "default",
        kind: "oauth",
      });
      expect(decodeOAuthCredential(storedBytes!).accessToken).toBe(
        "rotated-runtime-access",
      );
      storedBytes!.fill(0);
      expect(
        (await runtime.integrations.list(project.id)).find(
          (item) => item.provider === "google-search-console",
        )?.configuration,
      ).toEqual({ siteUrl: "sc-domain:example.com" });
    } finally {
      runtime.close();
    }
  });

  it("injects API-provider vault credentials into research without using process environment", async () => {
    let receivedCredentials: unknown;
    const engine = {
      crawl: async () => {
        throw new Error("unexpected audit");
      },
      reportToJson: () => "{}",
      reportToHtml: () => "",
      reportToCsv: () => "",
      keywordResearchModule: {
        async invoke(
          _input: Record<string, unknown>,
          context: Record<string, unknown>,
        ) {
          receivedCredentials = context.integrationCredentials;
          return { profile: { seed: "seo" }, issues: [] };
        },
      },
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-research-")),
      engine,
    });
    vi.stubEnv("SERPAPI_API_KEY", "legacy-env-serp-must-not-be-used");
    vi.stubEnv("DATAFORSEO_LOGIN", "legacy-env-login-must-not-be-used");
    vi.stubEnv("DATAFORSEO_PASSWORD", "legacy-env-password-must-not-be-used");
    try {
      const project = await runtime.projects.create({
        name: "Research",
        canonicalUrl: "https://example.com",
      });
      await runtime.integrations.saveSecret(
        "serpapi",
        "default",
        "credentials",
        Buffer.from(JSON.stringify({ apiKey: "vault-serp-key" })),
      );
      await runtime.integrations.saveSecret(
        "dataforseo",
        "default",
        "credentials",
        Buffer.from(
          JSON.stringify({ login: "vault-login", password: "vault-password" }),
        ),
      );
      await runtime.integrations.configure("dataforseo", project.id, {
        languageCode: "en",
      });
      const run = await runtime.runs.start(
        {
          projectId: project.id,
          workflowId: "keyword-research",
          options: { seed: "seo" },
        },
        "research-test-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }
      expect(completed?.status).toBe("succeeded");
      expect(receivedCredentials).toEqual({
        serpapi: { apiKey: "vault-serp-key" },
        dataforseo: {
          login: "vault-login",
          password: "vault-password",
          languageCode: "en",
        },
      });
      expect(
        JSON.parse(
          Buffer.from((await runtime.reports.get(run.id, "json"))!).toString(
            "utf8",
          ),
        ),
      ).toEqual({ profile: { seed: "seo" }, issues: [] });
      expect(runtime.database.listRunModules(run.id)).toEqual([
        expect.objectContaining({
          moduleId: "research-keyword-research",
          status: "succeeded",
        }),
      ]);
    } finally {
      runtime.close();
      vi.unstubAllEnvs();
    }
  });

  it("executes and persists the bounded public-web OSINT dossier workflow", async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const dossier = {
      schemaVersion: "osint-dossier.v1" as const,
      workflow: "osint-research" as const,
      generatedAt: new Date().toISOString(),
      sourceBudget: 2,
      targets: [
        {
          targetUrl: "https://example.com",
          finalUrl: "https://example.com/",
          host: "example.com",
          status: "available" as const,
          pagesObserved: 1,
          evidence: [],
          entities: [],
          relationships: [],
          publishingCadence: null,
          error: null,
        },
      ],
      findings: [],
      coverage: {
        state: "insufficient" as const,
        targetsRequested: 2,
        targetsCompleted: 1,
        pagesObserved: 1,
        evidenceAvailable: 0,
      },
      policy: {
        collection: "public_web_only" as const,
        personalData: "disabled" as const,
        identityResolution: "disabled" as const,
        authenticatedCollection: "disabled" as const,
        darkWebCollection: "disabled" as const,
      },
      limitations: ["Synthetic runtime fixture."],
    };
    const engine = {
      crawl: async () => {
        throw new Error("unexpected audit");
      },
      runOsintResearch: async (options: Record<string, unknown>) => {
        receivedOptions = options;
        return dossier;
      },
      reportToJson: (report: unknown) => JSON.stringify(report),
      reportToHtml: () => "",
      reportToCsv: () => "",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-osint-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "OSINT",
        canonicalUrl: "https://example.com",
      });
      const run = await runtime.runs.start(
        {
          projectId: project.id,
          workflowId: "osint-research",
          options: { targetUrls: ["https://partner.example"] },
        },
        "osint-runtime-test-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 300 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }
      expect(completed?.status).toBe("partial");
      expect(receivedOptions).toMatchObject({
        targetUrls: ["https://example.com/", "https://partner.example"],
        maxUrls: 12,
        maxRuntimeMs: 60_000,
      });
      expect(receivedOptions).not.toHaveProperty("privateHostAllowlist");
      expect(
        JSON.parse(
          Buffer.from((await runtime.reports.get(run.id, "json"))!).toString(
            "utf8",
          ),
        ),
      ).toEqual(dossier);
      expect(runtime.database.listRunModules(run.id)).toEqual([
        expect.objectContaining({
          moduleId: "research-osint-research",
          status: "succeeded",
        }),
      ]);
    } finally {
      runtime.close();
    }
  });

  it("injects the stored PSI key into an audit without persisting or reporting it", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "marketingovo-runtime-psi-"));
    const apiKey = "vault-psi-key-that-must-never-leak";
    let receivedPageSpeed: unknown;
    let receivedProviderFetch: unknown;
    const providerFetch = vi.fn<typeof fetch>();
    const engine = {
      async crawl(options: Record<string, unknown>) {
        receivedPageSpeed = options.pageSpeedInsights;
        receivedProviderFetch = options.providerFetch;
        return {
          runId: "psi-engine-run",
          report: reportFixture({
            generatedAt: new Date().toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: {},
              issuesByCategory: {},
            },
            issues: [],
            pages: [
              {
                url: String(options.startUrl),
                finalUrl: String(options.startUrl),
                status: 200,
                title: "PSI vault",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: (report: unknown) => JSON.stringify(report),
      reportToHtml: () => "<!doctype html><title>PSI report</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir,
      engine,
      integrationFetch: providerFetch,
    });
    try {
      const project = await runtime.projects.create({
        name: "PSI vault",
        canonicalUrl: "https://example.com",
      });
      await runtime.integrations.saveSecret(
        "pagespeed-insights",
        "default",
        "credentials",
        Buffer.from(JSON.stringify({ apiKey })),
      );
      await runtime.integrations.configure("pagespeed-insights", project.id, {
        strategy: "desktop",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "psi-vault-test-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }

      expect(completed?.status).toBe("succeeded");
      expect(receivedPageSpeed).toEqual({ apiKey, strategy: "desktop" });
      expect(receivedProviderFetch).toBe(providerFetch);
      const report = Buffer.from(
        (await runtime.reports.get(run.id, "json"))!,
      ).toString("utf8");
      expect(report).not.toContain(apiKey);
      expect(readFileSync(join(dataDir, "marketingovo.db"))).not.toContain(
        Buffer.from(apiKey),
      );
      expect(
        JSON.stringify(await runtime.integrations.list(project.id)),
      ).not.toContain(apiKey);
    } finally {
      runtime.close();
    }
  });
});

describe("runtime GA4 action exposure", () => {
  const engineFor = (
    ga4: Array<{
      page: string;
      keyEvents: number;
      apiKey?: string;
    }>,
  ) => ({
    async crawl(options: Record<string, unknown>) {
      return {
        runId: "ga4-action-engine-run",
        report: reportFixture({
          generatedAt: new Date().toISOString(),
          startUrl: String(options.startUrl),
          durationMs: 1,
          summary: {
            pagesCrawled: 2,
            issuesByPriority: { High: 1 },
            issuesByCategory: { technical: 1 },
          },
          issues: [
            {
              id: "canonical-missing",
              category: "technical",
              priority: "High" as const,
              message: "Canonical is missing",
              urls: ["https://EXAMPLE.com:443/pricing#crawl-fragment"],
              moduleId: "technical",
            },
          ],
          pages: [
            {
              url: "https://example.com/pricing",
              finalUrl: "https://example.com/pricing",
              status: 200,
              title: "Pricing",
              responseTimeMs: 1,
              vitals: null,
            },
            {
              url: "https://example.com/benchmark",
              finalUrl: "https://example.com/benchmark",
              status: 200,
              title: "Benchmark",
              responseTimeMs: 1,
              vitals: null,
            },
          ],
          realData: { gsc: [], ga4, errors: [] },
        }),
      };
    },
    // Provider credentials and untrusted provider-only fields are not report
    // inputs. The action path must likewise never serialize them.
    reportToJson: () => "{}",
    reportToHtml: () => "<!doctype html><title>GA4 action report</title>",
    reportToCsv: () => "url,status\n",
  });

  async function waitForTerminal(
    runtime: MarketingovoLocalRuntime,
    runId: string,
  ) {
    let current = await runtime.runs.get(runId);
    for (
      let attempt = 0;
      attempt < 100 &&
      current &&
      !["succeeded", "partial", "failed"].includes(current.status);
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      current = await runtime.runs.get(runId);
    }
    return current;
  }

  it("resolves relative pagePath rows against the project origin", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-ga4-path-")),
      engine: engineFor([
        { page: "/pricing#ga4-fragment", keyEvents: 5 },
        { page: "/benchmark", keyEvents: 10 },
      ]),
    });
    try {
      const project = await runtime.projects.create({
        name: "GA4 relative path",
        canonicalUrl: "https://example.com:443/section/",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "ga4-relative-path",
      );
      expect((await waitForTerminal(runtime, run.id))?.status).toBe(
        "succeeded",
      );

      const [action] = await runtime.actions.list(project.id);
      expect(action?.affectedUrls).toEqual(["https://example.com/pricing"]);
      expect(action).toMatchObject({
        ruleId: "canonical-missing",
        moduleId: "technical",
      });
      expect(action?.scoreInputs.conversionExposure).toBe(0.5);
      expect(action?.scoreInputs.unavailable).toContain("organic_exposure");
      expect(action?.scoreInputs.unavailable).not.toContain(
        "conversion_exposure",
      );
    } finally {
      runtime.close();
    }
  });

  it("keeps invalid or unmatched GA4 rows unavailable and out of actions", async () => {
    const dataDir = mkdtempSync(
      join(tmpdir(), "marketingovo-runtime-ga4-invalid-"),
    );
    const embeddedSecret = "ga4-provider-secret-must-not-leak";
    const runtime = new MarketingovoLocalRuntime({
      dataDir,
      engine: engineFor([
        { page: "https://other.example/pricing", keyEvents: 100 },
        { page: `javascript:${embeddedSecret}`, keyEvents: 50 },
        {
          page: `https://user:${embeddedSecret}@example.com/pricing`,
          keyEvents: 25,
          apiKey: embeddedSecret,
        },
        { page: "/unmatched", keyEvents: 5 },
      ]),
    });
    try {
      const project = await runtime.projects.create({
        name: "GA4 invalid paths",
        canonicalUrl: "https://example.com/",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "ga4-invalid-paths",
      );
      expect((await waitForTerminal(runtime, run.id))?.status).toBe(
        "succeeded",
      );

      const [action] = await runtime.actions.list(project.id);
      expect(action?.scoreInputs.conversionExposure).toBeNull();
      expect(action?.scoreInputs.unavailable).toContain("conversion_exposure");
      expect(JSON.stringify(action)).not.toContain(embeddedSecret);
      expect(readFileSync(join(dataDir, "marketingovo.db"))).not.toContain(
        Buffer.from(embeddedSecret),
      );
    } finally {
      runtime.close();
    }
  });
});

describe("runtime issue reconciliation", () => {
  it("passes an exact URL cohort as both scope and crawl seeds", async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const engine = {
      async crawl(options: Record<string, unknown>) {
        receivedOptions = options;
        return {
          runId: "exact-cohort-engine-run",
          report: reportFixture({
            generatedAt: new Date().toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 1,
            issues: [],
            pages: [
              {
                url: "https://example.com/pricing",
                finalUrl: "https://example.com/pricing",
                status: 200,
                title: "Pricing",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Report</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-runtime-exact-cohort-"),
      ),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Exact cohort",
        canonicalUrl: "https://example.com/",
      });
      const run = await runtime.runs.start(
        {
          projectId: project.id,
          workflowId: "audit",
          options: {
            exactUrls: [
              "https://example.com/pricing#offer",
              "https://example.com/docs",
              "https://example.com/pricing",
            ],
          },
        },
        "exact-cohort-key",
      );
      let current = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        current &&
        !["succeeded", "partial", "failed"].includes(current.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        current = await runtime.runs.get(run.id);
      }
      expect(current?.status).toBe("succeeded");
      expect(receivedOptions?.exactUrls).toEqual([
        "https://example.com/pricing",
        "https://example.com/docs",
      ]);
      expect(receivedOptions?.seedUrls).toEqual(receivedOptions?.exactUrls);
    } finally {
      runtime.close();
    }
  });

  it("deduplicates issue instances by module, rule, and canonical URL", async () => {
    const generatedAt = new Date().toISOString();
    const issue = {
      id: "duplicate-canonical",
      category: "technical",
      priority: "High" as const,
      message: "Canonical issue",
      urls: [
        "https://EXAMPLE.com:443/page#first",
        "https://example.com/page#second",
      ],
      moduleId: "technical",
    };
    const engine = {
      async crawl(options: Record<string, unknown>) {
        return {
          runId: "engine-run",
          report: reportFixture({
            generatedAt,
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: { High: 2 },
              issuesByCategory: { technical: 2 },
            },
            issues: [issue, { ...issue, urls: ["https://example.com/page"] }],
            pages: [
              {
                url: "https://example.com/page",
                finalUrl: "https://example.com/page",
                status: 200,
                title: "Page",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Report</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-issues-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Issues",
        canonicalUrl: "https://example.com",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "issue-dedupe-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }

      expect(completed).toMatchObject({ status: "succeeded", issueCount: 1 });
      const instances = await runtime.runs.issues(run.id);
      expect(instances).toHaveLength(1);
      expect(instances[0]).toMatchObject({
        moduleId: "technical",
        ruleId: "duplicate-canonical",
        canonicalUrl: "https://example.com/page",
      });
      const actions = await runtime.actions.list(project.id);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.affectedUrls).toEqual(["https://example.com/page"]);
      expect(runtime.database.listRunModules(run.id)).toEqual([
        expect.objectContaining({
          moduleId: "core-audit",
          status: "succeeded",
          coverage: 1,
        }),
      ]);
    } finally {
      runtime.close();
    }
  });

  it("keeps one stable action when affected URL order or membership changes", async () => {
    let invocation = 0;
    const urlSets = [
      ["https://example.com/b", "https://example.com/a"],
      ["https://example.com/a", "https://example.com/b"],
      ["https://example.com/c"],
    ];
    const engine = {
      async crawl(options: Record<string, unknown>) {
        const urls = urlSets[Math.min(invocation, urlSets.length - 1)]!;
        invocation += 1;
        return {
          runId: `stable-action-${invocation}`,
          report: reportFixture({
            generatedAt: new Date(Date.UTC(2026, 1, invocation)).toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: { High: 1 },
              issuesByCategory: { technical: 1 },
            },
            issues: [
              {
                id: "canonical-missing",
                category: "technical",
                priority: "High" as const,
                message: "Canonical is missing",
                urls,
                moduleId: "technical",
              },
            ],
            pages: [
              {
                url: "https://example.com/",
                finalUrl: "https://example.com/",
                status: 200,
                title: "Home",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Report</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-action-key-")),
      engine,
    });
    const waitForTerminal = async (runId: string) => {
      let current = await runtime.runs.get(runId);
      for (
        let attempt = 0;
        attempt < 100 &&
        current &&
        !["succeeded", "partial", "failed"].includes(current.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        current = await runtime.runs.get(runId);
      }
      return current;
    };
    try {
      const project = await runtime.projects.create({
        name: "Stable actions",
        canonicalUrl: "https://example.com",
      });
      const actionIds: string[] = [];
      for (let index = 0; index < urlSets.length; index++) {
        const run = await runtime.runs.start(
          { projectId: project.id, workflowId: "audit" },
          `stable-action-${index}`,
        );
        expect((await waitForTerminal(run.id))?.status).toBe("succeeded");
        const actions = await runtime.actions.list(project.id);
        expect(actions).toHaveLength(1);
        actionIds.push(actions[0]!.id);
      }
      expect(new Set(actionIds).size).toBe(1);
      expect((await runtime.actions.list(project.id))[0]?.affectedUrls).toEqual(
        ["https://example.com/c"],
      );
    } finally {
      runtime.close();
    }
  });

  it("resolves disappeared issues, verifies actions, and reopens regressions", async () => {
    let invocation = 0;
    const engine = {
      async crawl(options: Record<string, unknown>) {
        invocation += 1;
        const observedAt = new Date(
          Date.UTC(2026, 0, invocation),
        ).toISOString();
        const present = invocation !== 2;
        const issues = present
          ? [
              {
                id: "title-missing",
                category: "on-page",
                priority: "High" as const,
                message: "Title is missing",
                urls: ["https://example.com/page#fragment"],
                moduleId: "onpage",
              },
            ]
          : [];
        return {
          runId: `engine-${invocation}`,
          report: reportFixture({
            generatedAt: observedAt,
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: (present ? { High: 1 } : {}) as Record<
                string,
                number
              >,
              issuesByCategory: (present ? { "on-page": 1 } : {}) as Record<
                string,
                number
              >,
            },
            issues,
            pages: [
              {
                url: "https://example.com/page",
                finalUrl: "https://example.com/page",
                status: 200,
                title: present ? null : "Fixed title",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Report</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-lifecycle-")),
      engine,
    });
    const waitForTerminal = async (runId: string) => {
      let current = await runtime.runs.get(runId);
      for (
        let attempt = 0;
        attempt < 100 &&
        current &&
        !["succeeded", "partial", "failed"].includes(current.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        current = await runtime.runs.get(runId);
      }
      return current;
    };
    try {
      const project = await runtime.projects.create({
        name: "Lifecycle",
        canonicalUrl: "https://example.com",
      });
      const first = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "lifecycle-1",
      );
      expect((await waitForTerminal(first.id))?.status).toBe("succeeded");
      const firstIssue = (await runtime.runs.issues(first.id))[0]!;
      expect((await runtime.actions.list(project.id))[0]).toMatchObject({
        status: "open",
        verification: "pending",
      });

      const second = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "lifecycle-2",
      );
      expect((await waitForTerminal(second.id))?.status).toBe("succeeded");
      expect(await runtime.runs.issues(second.id)).toEqual([]);
      expect((await runtime.runs.issues(first.id))[0]).toMatchObject({
        status: "resolved",
      });
      expect((await runtime.actions.list(project.id))[0]).toMatchObject({
        status: "resolved",
        verification: "verified",
      });

      const third = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "lifecycle-3",
      );
      expect((await waitForTerminal(third.id))?.status).toBe("succeeded");
      expect((await runtime.runs.issues(third.id))[0]).toMatchObject({
        fingerprint: firstIssue.fingerprint,
        firstSeenAt: firstIssue.firstSeenAt,
        status: "open",
      });
      expect((await runtime.actions.list(project.id))[0]).toMatchObject({
        status: "open",
        verification: "regressed",
      });
    } finally {
      runtime.close();
    }
  });

  it("propagates cancellation to the engine and records a cancelled module", async () => {
    let receivedSignal: AbortSignal | undefined;
    const engine = {
      crawl: async (options: Record<string, unknown>) => {
        receivedSignal = options.signal as AbortSignal;
        return new Promise<never>((_resolve, reject) => {
          receivedSignal!.addEventListener(
            "abort",
            () => reject(receivedSignal!.reason),
            { once: true },
          );
        });
      },
      reportToJson: () => "{}",
      reportToHtml: () => "",
      reportToCsv: () => "",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-cancel-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Cancel",
        canonicalUrl: "https://example.com",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "cancel-key",
      );
      for (let attempt = 0; attempt < 100 && !receivedSignal; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(receivedSignal).toBeDefined();
      await runtime.runs.cancel(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        runtime.database.listRunModules(run.id)[0]?.status !== "cancelled";
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(receivedSignal?.aborted).toBe(true);
      expect((await runtime.runs.get(run.id))?.status).toBe("cancelled");
      expect(runtime.database.listRunModules(run.id)[0]?.status).toBe(
        "cancelled",
      );
    } finally {
      runtime.close();
    }
  });

  it("ignores the legacy global private-network escape and passes only exact per-run hosts", async () => {
    const received: Record<string, unknown>[] = [];
    const engine = {
      async crawl(options: Record<string, unknown>) {
        received.push(options);
        return {
          runId: `private-policy-${received.length}`,
          report: reportFixture({
            generatedAt: new Date().toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 1,
            summary: {
              pagesCrawled: 1,
              issuesByPriority: {},
              issuesByCategory: {},
            },
            issues: [],
            pages: [
              {
                url: String(options.startUrl),
                finalUrl: String(options.startUrl),
                status: 200,
                title: "Policy",
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "",
      reportToCsv: () => "",
    };
    const previous = process.env.MARKETINGOVO_ALLOW_PRIVATE;
    process.env.MARKETINGOVO_ALLOW_PRIVATE = "true";
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(
        join(tmpdir(), "marketingovo-runtime-private-policy-"),
      ),
      engine,
    });
    const waitForTerminal = async (runId: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const current = await runtime.runs.get(runId);
        if (
          current &&
          ["succeeded", "partial", "failed"].includes(current.status)
        )
          return current;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return runtime.runs.get(runId);
    };
    try {
      const project = await runtime.projects.create({
        name: "Private policy",
        canonicalUrl: "https://example.com",
      });
      const publicRun = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "private-policy-public",
      );
      expect((await waitForTerminal(publicRun.id))?.status).toBe("succeeded");
      const explicitRun = await runtime.runs.start(
        {
          projectId: project.id,
          workflowId: "audit",
          options: { privateHostAllowlist: ["INTERNAL.EXAMPLE.", "10.0.0.8"] },
        },
        "private-policy-explicit",
      );
      expect((await waitForTerminal(explicitRun.id))?.status).toBe("succeeded");

      expect(received[0]?.limits).toMatchObject({ allowPrivate: false });
      expect(received[0]?.privateHostAllowlist).toEqual([]);
      expect(received[1]?.limits).toMatchObject({ allowPrivate: true });
      expect(received[1]?.privateHostAllowlist).toEqual([
        "internal.example",
        "10.0.0.8",
      ]);
    } finally {
      runtime.close();
      if (previous === undefined) delete process.env.MARKETINGOVO_ALLOW_PRIVATE;
      else process.env.MARKETINGOVO_ALLOW_PRIVATE = previous;
    }
  });

  it("reports partial coverage instead of false success when page fetches fail", async () => {
    const engine = {
      async crawl(options: Record<string, unknown>) {
        return {
          runId: "coverage-run",
          report: reportFixture({
            generatedAt: new Date().toISOString(),
            startUrl: String(options.startUrl),
            durationMs: 2,
            summary: {
              pagesCrawled: 2,
              issuesByPriority: {},
              issuesByCategory: {},
            },
            issues: [],
            pages: [
              {
                url: String(options.startUrl),
                finalUrl: String(options.startUrl),
                status: 200,
                title: "Home",
                responseTimeMs: 1,
                vitals: null,
              },
              {
                url: "https://example.com/failed",
                finalUrl: "https://example.com/failed",
                status: 0,
                title: null,
                responseTimeMs: 1,
                vitals: null,
              },
            ],
          }),
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "",
      reportToCsv: () => "",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-runtime-partial-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Partial",
        canonicalUrl: "https://example.com",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "partial-key",
      );
      let completed = await runtime.runs.get(run.id);
      for (
        let attempt = 0;
        attempt < 100 &&
        completed &&
        !["succeeded", "partial", "failed"].includes(completed.status);
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        completed = await runtime.runs.get(run.id);
      }

      expect(completed).toMatchObject({ status: "partial" });
      expect(completed?.error).toContain("1 of 2 crawled page requests failed");
      expect(runtime.database.listRunModules(run.id)[0]).toMatchObject({
        moduleId: "core-audit",
        status: "succeeded",
        coverage: 0.5,
      });
    } finally {
      runtime.close();
    }
  });
});
