import { describe, expect, it } from "vitest";
import { GoogleAdsClient } from "./client.js";
import {
  markGoogleAdsWindowUnavailable,
  normalizeGoogleAdsMetrics,
  normalizeSearchTerms,
  toGoogleAdPlatform,
  toSearchTermMatchType,
  toSearchTermStatus,
} from "./normalize.js";

/**
 * The client is exercised against recorded response shapes rather than a live
 * account, which is the only way the interesting cases — a field Google
 * omitted, a cost in micros, an error buried three levels down — are testable
 * at all.
 */

const CUSTOMER = "123-456-7890";

function stubFetch(
  body: unknown,
  init: { status?: number } = {},
): { fetch: typeof fetch; calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = [];
  const impl = (async (url: URL | RequestInfo, options?: RequestInit) => {
    calls.push({
      url: String(url),
      body: options?.body ? JSON.parse(String(options.body)) : null,
    });
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetch: impl, calls };
}

function client(fetchImpl: typeof fetch) {
  return new GoogleAdsClient({
    accessToken: "token",
    developerToken: "developer-token-value",
    customerId: CUSTOMER,
    loginCustomerId: "999-888-7777",
    providerFetch: fetchImpl,
  });
}

describe("credentials and identifiers", () => {
  it("sends both credentials as headers and never in the URL", () => {
    const { fetch: impl, calls } = stubFetch([{ results: [] }]);
    const headers: Record<string, string>[] = [];
    const capturing = (async (
      url: URL | RequestInfo,
      options?: RequestInit,
    ) => {
      headers.push(options?.headers as Record<string, string>);
      return impl(url, options);
    }) as typeof fetch;

    return client(capturing)
      .customer()
      .catch(() => undefined)
      .then(() => {
        expect(headers[0]?.authorization).toBe("Bearer token");
        expect(headers[0]?.["developer-token"]).toBe("developer-token-value");
        // Required whenever the account is reached through a manager, which is
        // how every agency is arranged.
        expect(headers[0]?.["login-customer-id"]).toBe("9998887777");
        expect(calls[0]?.url).not.toContain("token");
      });
  });

  it("accepts a hyphenated customer id and normalizes it into the path", async () => {
    const { fetch: impl, calls } = stubFetch([
      { results: [{ customer: { id: "1234567890" } }] },
    ]);
    await client(impl).customer();
    expect(calls[0]?.url).toContain("/customers/1234567890/");
  });

  it("refuses a customer id that is not ten digits", () => {
    expect(
      () =>
        new GoogleAdsClient({
          accessToken: "t",
          developerToken: "d",
          customerId: "12345",
        }),
    ).toThrow(/ten digits/);
  });

  it("refuses to run without a developer token", () => {
    expect(
      () =>
        new GoogleAdsClient({
          accessToken: "t",
          developerToken: "  ",
          customerId: CUSTOMER,
        }),
    ).toThrow(/developer token/i);
  });
});

describe("micros", () => {
  it("converts cost to the account currency", async () => {
    // The conversion that matters most in this connector. A missed division
    // reports a 4,300 EUR spend as 0.0043 and still renders as an ordinary
    // number on a dashboard.
    const { fetch: impl } = stubFetch([
      {
        results: [
          {
            campaign: { id: "1", name: "Brand" },
            segments: { date: "2026-07-01", adNetworkType: "SEARCH" },
            metrics: { costMicros: "4300000000", averageCpc: "1250000" },
          },
        ],
      },
    ]);
    const result = await client(impl).metrics({
      level: "campaign",
      since: "2026-07-01",
      until: "2026-07-31",
    });
    expect(result.rows[0]?.cost).toBe(4300);
    expect(result.rows[0]?.averageCpc).toBe(1.25);
  });

  it("keeps an omitted cost null rather than zero", async () => {
    const { fetch: impl } = stubFetch([
      {
        results: [
          {
            campaign: { id: "1", name: "Brand" },
            segments: { date: "2026-07-01" },
            metrics: { impressions: "10" },
          },
        ],
      },
    ]);
    const result = await client(impl).metrics({
      level: "campaign",
      since: "2026-07-01",
      until: "2026-07-31",
    });
    expect(result.rows[0]?.cost).toBeNull();
    expect(result.rows[0]?.impressions).toBe(10);
  });
});

describe("query construction", () => {
  it("refuses a date that is not ISO", async () => {
    const { fetch: impl } = stubFetch([{ results: [] }]);
    await expect(
      client(impl).metrics({
        level: "campaign",
        // GAQL has no bound parameters, so every value in a WHERE clause is
        // interpolated. Dates are validated by shape rather than escaped.
        since: "2026-07-01' OR '1'='1",
        until: "2026-07-31",
      }),
    ).rejects.toThrow(/ISO date/);
  });

  it("does not select impression share for a resource that cannot report it", async () => {
    const { fetch: impl, calls } = stubFetch([{ results: [] }]);
    await client(impl).metrics({
      level: "adgroup",
      since: "2026-07-01",
      until: "2026-07-31",
    });
    const query = String((calls[0]?.body as { query: string }).query);
    // Google rejects the whole query rather than omitting the column.
    expect(query).not.toContain("search_impression_share");
    expect(query).toContain("FROM ad_group");
  });
});

describe("failures", () => {
  it("explains an unapproved developer token in terms of the remedy", async () => {
    const { fetch: impl } = stubFetch(
      [
        {
          error: {
            status: "PERMISSION_DENIED",
            details: [
              {
                errors: [
                  {
                    errorCode: {
                      authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED",
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
      { status: 403 },
    );
    await expect(client(impl).customer()).rejects.toThrow(
      /Apply for Basic access/,
    );
  });

  it("reports a server error as unavailable rather than as zero", async () => {
    const { fetch: impl } = stubFetch({ error: {} }, { status: 503 });
    await expect(client(impl).customer()).rejects.toThrow(
      /unavailable, not zero/,
    );
  });

  it("mentions managers when permission is refused", async () => {
    const { fetch: impl } = stubFetch({ error: {} }, { status: 403 });
    await expect(client(impl).customer()).rejects.toThrow(/manager id is set/);
  });
});

describe("platform mapping", () => {
  it("keeps search and search partners apart", () => {
    expect(toGoogleAdPlatform("SEARCH")).toBe("google_search");
    expect(toGoogleAdPlatform("SEARCH_PARTNERS")).toBe(
      "google_search_partners",
    );
  });

  it("does not claim a breakdown Performance Max never provides", () => {
    // Google reports a PMax row's network as one of the underlying surfaces.
    // Filing it under search would assert a split that does not exist.
    expect(toGoogleAdPlatform("SEARCH", "PERFORMANCE_MAX")).toBe(
      "google_performance_max",
    );
    expect(toGoogleAdPlatform("CONTENT", "DEMAND_GEN")).toBe(
      "google_performance_max",
    );
  });

  it("treats a missing network as unsegmented, and MIXED the same way", () => {
    expect(toGoogleAdPlatform(null)).toBe("all");
    expect(toGoogleAdPlatform("MIXED")).toBe("all");
  });

  it("files an unrecognised network as unknown rather than folding it into all", () => {
    // `all` is a specific claim — "this row was not broken out". Quietly
    // filing a new Google surface under it would make a total look attributed.
    expect(toGoogleAdPlatform("SOME_NEW_SURFACE")).toBe("unknown");
  });
});

describe("normalizing metrics", () => {
  const row = {
    date: "2026-07-01",
    entityId: "c1",
    entityName: "Brand",
    adNetworkType: "SEARCH",
    channelType: "SEARCH",
    impressions: 1000,
    clicks: 50,
    cost: 120.5,
    conversions: 2.5,
    conversionValue: 400,
    ctr: 0.05,
    averageCpc: 2.41,
    averageCpm: 12,
    searchImpressionShare: 0.62,
    searchBudgetLostImpressionShare: 0.2,
    searchRankLostImpressionShare: 0.18,
  };

  const options = {
    channelAccountId: "acct-1",
    level: "campaign" as const,
    currency: "EUR",
    fetchedAt: "2026-08-01T00:00:00.000Z",
  };

  it("carries currency only on monetary rows", () => {
    const metrics = normalizeGoogleAdsMetrics([row], options);
    const spend = metrics.find((metric) => metric.metricKey === "spend");
    const clicks = metrics.find((metric) => metric.metricKey === "clicks");
    expect(spend?.currency).toBe("EUR");
    expect(clicks?.currency).toBeNull();
  });

  it("keeps a fractional conversion count", () => {
    // Google divides a conversion across the clicks it credits, so rounding
    // would turn a converting query into a wasteful one.
    const metrics = normalizeGoogleAdsMetrics([row], options);
    expect(
      metrics.find((metric) => metric.metricKey === "conversions")?.value,
    ).toBe(2.5);
  });

  it("records an absent metric as unavailable with a stated reason", () => {
    const metrics = normalizeGoogleAdsMetrics(
      [{ ...row, searchImpressionShare: null }],
      options,
    );
    const share = metrics.find(
      (metric) => metric.metricKey === "search_impression_share",
    );
    expect(share?.value).toBeNull();
    expect(share?.state).toBe("unavailable");
    expect(share?.note).toContain("too small to anonymise");
  });

  it("marks every row partial when the read was truncated", () => {
    const metrics = normalizeGoogleAdsMetrics([row], {
      ...options,
      truncated: true,
    });
    expect(metrics.every((metric) => metric.state !== "available")).toBe(true);
    expect(metrics.find((metric) => metric.value !== null)?.state).toBe(
      "partial",
    );
  });

  it("drops a row that cannot be filed against a day", () => {
    expect(
      normalizeGoogleAdsMetrics([{ ...row, date: "" }], options),
    ).toHaveLength(0);
  });

  it("writes failed rows so an outage is visible where the numbers would be", () => {
    const metrics = markGoogleAdsWindowUnavailable({
      channelAccountId: "acct-1",
      dates: ["2026-07-01", "2026-07-02"],
      reason: "Google returned a server error.",
      fetchedAt: "2026-08-01T00:00:00.000Z",
      currency: "EUR",
    });
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((metric) => metric.state === "failed")).toBe(true);
    expect(metrics.every((metric) => metric.value === null)).toBe(true);
  });
});

describe("normalizing search terms", () => {
  it("maps Google's vocabulary onto the product's", () => {
    expect(toSearchTermMatchType("NEAR_EXACT")).toBe("near_exact");
    expect(toSearchTermStatus("ADDED_EXCLUDED")).toBe("added_excluded");
    expect(toSearchTermStatus("SOMETHING_NEW")).toBe("unknown");
  });

  it("stamps the window rather than a date, because the rows are aggregates", () => {
    const [record] = normalizeSearchTerms(
      [
        {
          query: "widgets",
          matchedKeyword: "widgets",
          matchType: "BROAD",
          status: "NONE",
          campaignId: "c1",
          campaignName: "Brand",
          adGroupId: "g1",
          adGroupName: "Core",
          impressions: 10,
          clicks: 2,
          cost: 4,
          conversions: 0,
          conversionValue: 0,
        },
      ],
      {
        channelAccountId: "acct-1",
        currency: "EUR",
        windowStart: "2026-07-01",
        windowEnd: "2026-07-31",
        fetchedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(record).toMatchObject({
      windowStart: "2026-07-01",
      windowEnd: "2026-07-31",
      matchType: "broad",
      status: "none",
    });
  });
});

describe("read-only", () => {
  /**
   * Google publishes no read-only OAuth scope for the Ads API, so the
   * credential this product holds is capable of writing. The guarantee that it
   * never does lives in the software rather than in the permission — which
   * means it has to be asserted rather than assumed.
   *
   * This walks every public method on the client and checks where each one
   * sends its request. A `:mutate` endpoint added later fails here.
   */
  it("only ever reaches read endpoints", async () => {
    const urls: string[] = [];
    const recording = (async (url: URL | RequestInfo) => {
      const href = String(url);
      urls.push(href);
      // The two endpoints answer with different shapes: searchStream returns
      // an array of chunks, the listing returns an object.
      const body = href.endsWith("listAccessibleCustomers")
        ? { resourceNames: ["customers/1234567890"] }
        : [{ results: [] }];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const instance = client(recording);
    const window = { since: "2026-07-01", until: "2026-07-31" };
    await instance.accessibleCustomers();
    await instance.customer().catch(() => undefined);
    await instance.metrics({ level: "campaign", ...window });
    await instance.campaigns();
    await instance.ads();
    await instance.keywords(window);
    await instance.searchTerms(window);

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(
        /googleAds:searchStream$|customers:listAccessibleCustomers$/,
      );
    }
    expect(urls.join(" ")).not.toMatch(/:mutate/);
  });

  it("exposes no method whose name suggests a write", () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(
        client((async () => new Response("[]")) as typeof fetch),
      ),
    );
    expect(
      methods.filter((name) =>
        /mutate|create|update|remove|delete|pause|enable/iu.test(name),
      ),
    ).toEqual([]);
  });
});
