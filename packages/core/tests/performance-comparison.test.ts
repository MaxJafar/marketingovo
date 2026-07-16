import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildComparablePerformanceWindows,
  PERFORMANCE_COMPLETE_DATA_LAG_DAYS,
  PERFORMANCE_WINDOW_DAYS,
} from "../src/integrations/google/analytics-window.js";
import { GscClient } from "../src/integrations/google/gsc.js";
import { crawl } from "../src/orchestrator.js";
import {
  reportToJson,
  reportToMarkdown,
  type Report,
} from "../src/core/report/index.js";

describe("comparable performance windows", () => {
  it("builds adjacent 28-day ranges after a three-day completion lag", () => {
    expect(
      buildComparablePerformanceWindows(new Date("2026-07-15T23:59:59.999Z")),
    ).toEqual({
      asOfDate: "2026-07-15",
      calendarTimeZone: "UTC",
      completeDataLagDays: PERFORMANCE_COMPLETE_DATA_LAG_DAYS,
      windowDays: PERFORMANCE_WINDOW_DAYS,
      current: {
        startDate: "2026-06-15",
        endDate: "2026-07-12",
        days: 28,
      },
      previous: {
        startDate: "2026-05-18",
        endDate: "2026-06-14",
        days: 28,
      },
    });
  });

  it("uses UTC calendar arithmetic across leap-day and year boundaries", () => {
    const leapDay = buildComparablePerformanceWindows(
      new Date("2024-03-03T00:00:00.000Z"),
    );
    expect(leapDay.current).toEqual({
      startDate: "2024-02-02",
      endDate: "2024-02-29",
      days: 28,
    });
    expect(leapDay.previous).toEqual({
      startDate: "2024-01-05",
      endDate: "2024-02-01",
      days: 28,
    });

    const newYear = buildComparablePerformanceWindows(
      new Date("2026-01-03T12:00:00.000Z"),
    );
    expect(newYear.current).toEqual({
      startDate: "2025-12-04",
      endDate: "2025-12-31",
      days: 28,
    });
    expect(newYear.previous).toEqual({
      startDate: "2025-11-06",
      endDate: "2025-12-03",
      days: 28,
    });
  });

  it("rejects an invalid clock instead of producing malformed API dates", () => {
    expect(() =>
      buildComparablePerformanceWindows(new Date("invalid")),
    ).toThrow(/valid date/);
  });
});

describe("GSC query/page evidence", () => {
  it("paginates and retains an explicit query + page metric shape", async () => {
    const bodies: Array<{
      dimensions: string[];
      rowLimit: number;
      startRow: number;
    }> = [];
    const providerFetch = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        dimensions: string[];
        rowLimit: number;
        startRow: number;
      };
      bodies.push(body);
      const rows =
        body.startRow === 0
          ? [
              {
                keys: ["running shoes", "https://example.com/shoes"],
                clicks: 4,
                impressions: 40,
                ctr: 0.1,
                position: 3,
              },
              {
                keys: ["walking shoes", "https://example.com/shoes"],
                clicks: 2,
                impressions: 20,
                ctr: 0.1,
                position: 5,
              },
            ]
          : [
              {
                keys: ["shoe care", "https://example.com/care"],
                clicks: 1,
                impressions: 10,
                ctr: 0.1,
                position: 7,
              },
            ];
      return new Response(JSON.stringify({ rows }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new GscClient(
      { refresh: async () => ({ accessToken: "provider-test-token" }) },
      providerFetch,
    );

    const rows = await client.queryPages({
      siteUrl: "sc-domain:example.com",
      startDate: "2026-06-15",
      endDate: "2026-07-12",
      rowLimit: 3,
      pageSize: 2,
    });

    expect(bodies).toEqual([
      {
        startDate: "2026-06-15",
        endDate: "2026-07-12",
        dimensions: ["query", "page"],
        rowLimit: 2,
        startRow: 0,
      },
      {
        startDate: "2026-06-15",
        endDate: "2026-07-12",
        dimensions: ["query", "page"],
        rowLimit: 1,
        startRow: 2,
      },
    ]);
    expect(rows).toEqual([
      {
        query: "running shoes",
        page: "https://example.com/shoes",
        clicks: 4,
        impressions: 40,
        ctr: 0.1,
        position: 3,
      },
      {
        query: "walking shoes",
        page: "https://example.com/shoes",
        clicks: 2,
        impressions: 20,
        ctr: 0.1,
        position: 5,
      },
      {
        query: "shoe care",
        page: "https://example.com/care",
        clicks: 1,
        impressions: 10,
        ctr: 0.1,
        position: 7,
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("provider-test-token");
  });
});

describe("performance comparison report enrichment", () => {
  let server: Server;
  let startUrl: string;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html><head><title>Comparison fixture</title></head><body><h1>Fixture</h1></body></html>",
      );
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("comparison fixture has no port");
    }
    startUrl = `http://127.0.0.1:${address.port}/`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("fetches both periods while preserving legacy current-period fields", async () => {
    const accessToken = "vault-token-must-not-be-serialized";
    const requestedRanges: Array<{
      provider: "gsc" | "ga4";
      dimensions: string[];
      startDate: string;
      endDate: string;
    }> = [];
    const providerFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "www.googleapis.com") {
        if (url.pathname.endsWith("/sitemaps")) {
          return new Response(JSON.stringify({ sitemap: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        const body = JSON.parse(String(init?.body)) as {
          startDate: string;
          endDate: string;
          dimensions: string[];
        };
        requestedRanges.push({ provider: "gsc", ...body });
        const current = body.startDate === "2026-06-15";
        const query = current ? "current query" : "previous query";
        const page = current
          ? "https://example.com/current"
          : "https://example.com/previous";
        const keys = body.dimensions.map((dimension) =>
          dimension === "query" ? query : page,
        );
        return new Response(
          JSON.stringify({
            rows: [
              {
                keys,
                clicks: current ? 12 : 8,
                impressions: current ? 120 : 100,
                ctr: current ? 0.1 : 0.08,
                position: current ? 3 : 4,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.hostname === "analyticsdata.googleapis.com") {
        const body = JSON.parse(String(init?.body)) as {
          dateRanges: Array<{ startDate: string; endDate: string }>;
          dimensions: Array<{ name: string }>;
        };
        const range = body.dateRanges[0]!;
        requestedRanges.push({
          provider: "ga4",
          dimensions: body.dimensions.map(({ name }) => name),
          startDate: range.startDate,
          endDate: range.endDate,
        });
        const current = range.startDate === "2026-06-15";
        return new Response(
          JSON.stringify({
            rowCount: 1,
            rows: [
              {
                dimensionValues: [
                  { value: current ? "/current" : "/previous" },
                ],
                metricValues: [
                  { value: current ? "20" : "10" },
                  { value: current ? "30" : "15" },
                  { value: "0.6" },
                  { value: "0.4" },
                  { value: "45" },
                  { value: current ? "4" : "2" },
                ],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`unexpected provider host ${url.hostname}`);
    });

    const result = await crawl({
      startUrl,
      gscSiteUrl: "sc-domain:example.com",
      ga4PropertyId: "123",
      googleTokens: {
        gsc: { refresh: async () => ({ accessToken }) },
        ga4: { refresh: async () => ({ accessToken }) },
      },
      providerFetch,
      performanceComparisonAsOf: new Date("2026-07-15T12:00:00.000Z"),
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

    const realData = result.report.realData!;
    expect(realData.errors).toEqual([]);
    expect(realData.periodStart).toBe("2026-06-15");
    expect(realData.periodEnd).toBe("2026-07-12");
    expect(realData.gsc).toEqual(
      realData.performanceComparison?.current.gsc?.perPage,
    );
    expect(realData.topQueries).toEqual(
      realData.performanceComparison?.current.gsc?.topQueries,
    );
    expect(realData.ga4).toEqual(
      realData.performanceComparison?.current.ga4?.perPage,
    );
    expect(realData.performanceComparison).toMatchObject({
      asOfDate: "2026-07-15",
      calendarTimeZone: "UTC",
      completeDataLagDays: 3,
      windowDays: 28,
      current: {
        periodStart: "2026-06-15",
        periodEnd: "2026-07-12",
        gsc: {
          perPage: [{ page: "https://example.com/current", clicks: 12 }],
          topQueries: [{ query: "current query", clicks: 12 }],
          queryPages: [
            {
              query: "current query",
              page: "https://example.com/current",
              clicks: 12,
            },
          ],
        },
        ga4: { perPage: [{ page: "/current", keyEvents: 4 }] },
      },
      previous: {
        periodStart: "2026-05-18",
        periodEnd: "2026-06-14",
        gsc: {
          perPage: [{ page: "https://example.com/previous", clicks: 8 }],
          topQueries: [{ query: "previous query", clicks: 8 }],
          queryPages: [
            {
              query: "previous query",
              page: "https://example.com/previous",
              clicks: 8,
            },
          ],
        },
        ga4: { perPage: [{ page: "/previous", keyEvents: 2 }] },
      },
    });
    expect(requestedRanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "gsc",
          dimensions: ["query", "page"],
          startDate: "2026-06-15",
          endDate: "2026-07-12",
        }),
        expect.objectContaining({
          provider: "gsc",
          dimensions: ["query", "page"],
          startDate: "2026-05-18",
          endDate: "2026-06-14",
        }),
        expect.objectContaining({
          provider: "ga4",
          startDate: "2026-06-15",
          endDate: "2026-07-12",
        }),
        expect.objectContaining({
          provider: "ga4",
          startDate: "2026-05-18",
          endDate: "2026-06-14",
        }),
      ]),
    );
    expect(reportToJson(result.report)).not.toContain(accessToken);
  });

  it("keeps reports saved before performanceComparison readable", () => {
    const legacy: Report = {
      generatedAt: "2026-06-01T00:00:00.000Z",
      startUrl: "https://example.com/",
      durationMs: 1,
      config: { maxUrls: 1, maxRuntimeMs: 1_000, requestsPerSecond: 1 },
      summary: {
        pagesCrawled: 0,
        issuesByPriority: { High: 0, Medium: 0, Low: 0 },
        issuesByCategory: {},
      },
      issues: [],
      pages: [],
      topUrls: [],
      realData: {
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        gsc: [],
        ga4: [],
        topQueries: [],
        sitemaps: [],
        errors: [],
      },
    };

    const serialized = reportToJson(legacy);
    expect(JSON.parse(serialized).realData).not.toHaveProperty(
      "performanceComparison",
    );
    expect(reportToMarkdown(JSON.parse(serialized) as Report)).toContain(
      "2026-05-01 → 2026-05-31",
    );
  });
});
