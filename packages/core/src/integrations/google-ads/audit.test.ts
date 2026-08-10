import { describe, expect, it } from "vitest";
import {
  auditGoogleAdsAccount,
  GOOGLE_ADS_AUDIT_THRESHOLDS,
  googleAdsUrl,
  type GoogleAdsAuditInput,
} from "./audit.js";
import type { ChannelMetric, SearchTermRecord } from "../channel-vocabulary.js";

/**
 * The property every rule here shares: a rule that cannot see its inputs
 * declines to fire.
 *
 * These tests spend as much effort on silence as on findings, because the
 * failure mode that matters is not a missed finding — it is an audit that
 * reads a null as a zero and tells an operator their account converts nothing
 * when the truth is that nobody could read it.
 */

const account: GoogleAdsAuditInput["account"] = {
  id: "acct-1",
  externalId: "1234567890",
  displayName: "Northstar EU",
  currency: "EUR",
  dailySpendCap: null,
};

function metric(
  overrides: Partial<ChannelMetric> & Pick<ChannelMetric, "metricKey">,
): ChannelMetric {
  return {
    channelAccountId: account.id,
    entityKind: "account",
    entityId: "account",
    entityName: null,
    platform: "google_search",
    date: "2026-07-01",
    value: 1,
    state: "available",
    currency: null,
    source: "google-ads",
    fetchedAt: "2026-07-08T00:00:00.000Z",
    note: null,
    ...overrides,
  };
}

function term(overrides: Partial<SearchTermRecord> = {}): SearchTermRecord {
  return {
    channelAccountId: account.id,
    campaignId: "c1",
    campaignName: "Brand",
    adGroupId: "g1",
    adGroupName: "Core",
    query: "cheap widgets free",
    matchedKeyword: "widgets",
    matchType: "broad",
    status: "none",
    impressions: 500,
    clicks: 40,
    cost: 120,
    conversions: 0,
    conversionValue: 0,
    currency: "EUR",
    windowStart: "2026-07-01",
    windowEnd: "2026-07-31",
    fetchedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function input(
  overrides: Partial<GoogleAdsAuditInput> = {},
): GoogleAdsAuditInput {
  return {
    account,
    metrics: [],
    campaigns: [],
    ads: [],
    keywords: [],
    searchTerms: [],
    ...overrides,
  };
}

const rules = (issues: { id: string }[]) => issues.map((issue) => issue.id);

describe("deep links", () => {
  it("points at the operator's own account without fetching it", () => {
    const url = new URL(googleAdsUrl("123-456-7890"));
    expect(url.hostname).toBe("ads.google.com");
    expect(url.searchParams.get("ocid")).toBe("1234567890");
  });

  it("selects a campaign when one is named", () => {
    const url = new URL(
      googleAdsUrl("1234567890", { level: "campaign", id: "77" }),
    );
    expect(url.pathname).toBe("/aw/campaigns");
    expect(url.searchParams.get("campaignId")).toBe("77");
  });
});

describe("wasted search terms", () => {
  it("reports queries that took money and returned nothing", () => {
    const issues = auditGoogleAdsAccount(
      input({ searchTerms: [term(), term({ query: "widgets jobs" })] }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.wasted-search-terms",
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toContain("240 EUR");
    expect(finding?.detail).toMatchObject({ termCount: 2, wastedSpend: 240 });
  });

  it("stays silent below the click threshold", () => {
    // Zero conversions on a handful of clicks is variance, and a negative
    // added on that evidence is as likely to remove revenue as waste.
    const issues = auditGoogleAdsAccount(
      input({
        searchTerms: [
          term({
            clicks: GOOGLE_ADS_AUDIT_THRESHOLDS.wastedTermMinimumClicks - 1,
          }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain("google-ads.wasted-search-terms");
  });

  it("skips terms the operator already negated", () => {
    const issues = auditGoogleAdsAccount(
      input({
        searchTerms: [
          term({ status: "excluded" }),
          term({ status: "added_excluded" }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain("google-ads.wasted-search-terms");
  });

  it("declines when conversions were never reported", () => {
    // Null is "Google did not report the field", which on an account with no
    // conversion tracking is every row. Treating that as zero conversions
    // would turn one broken tag into a hundred confident findings about
    // queries that may well be converting.
    const issues = auditGoogleAdsAccount(
      input({ searchTerms: [term({ conversions: null })] }),
    );
    expect(rules(issues)).not.toContain("google-ads.wasted-search-terms");
  });

  it("declines when cost was not reported", () => {
    const issues = auditGoogleAdsAccount(
      input({ searchTerms: [term({ cost: null })] }),
    );
    expect(rules(issues)).not.toContain("google-ads.wasted-search-terms");
  });

  it("names a shared negative list when a query wastes across campaigns", () => {
    const issues = auditGoogleAdsAccount(
      input({
        searchTerms: [
          term({
            query: "free widgets",
            campaignId: "c1",
            campaignName: "Brand",
          }),
          term({
            query: "free widgets",
            campaignId: "c2",
            campaignName: "Generic",
          }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.cross-campaign-waste",
    );
    expect(finding?.fix).toContain("shared negative keyword list");
  });
});

describe("conversion tracking", () => {
  it("reports spend with no conversion field at all", () => {
    const issues = auditGoogleAdsAccount(
      input({ metrics: [metric({ metricKey: "spend", value: 900 })] }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.conversion-tracking-missing",
    );
    expect(finding?.priority).toBe("High");
    expect(finding?.detail).toMatchObject({ conversionFieldReported: false });
    // The remedy has to say that the rest of the audit is unreliable until
    // this is fixed, because the wasted-query rule depends on conversions.
    expect(finding?.fix).toContain("before acting on the rest of this audit");
  });

  it("distinguishes a reported zero from a missing field", () => {
    const issues = auditGoogleAdsAccount(
      input({
        metrics: [
          metric({ metricKey: "spend", value: 900 }),
          metric({ metricKey: "conversions", value: 0 }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.conversion-tracking-missing",
    );
    expect(finding?.detail).toMatchObject({ conversionFieldReported: true });
    expect(finding?.message).toContain("recorded zero conversions");
  });

  it("stays silent when the account converts", () => {
    const issues = auditGoogleAdsAccount(
      input({
        metrics: [
          metric({ metricKey: "spend", value: 900 }),
          metric({ metricKey: "conversions", value: 12 }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain(
      "google-ads.conversion-tracking-missing",
    );
  });

  it("stays silent when nothing was spent", () => {
    expect(rules(auditGoogleAdsAccount(input()))).not.toContain(
      "google-ads.conversion-tracking-missing",
    );
  });
});

describe("impression share", () => {
  const campaign = {
    id: "c1",
    name: "Generic search",
    status: "ENABLED",
    channelType: "SEARCH",
    biddingStrategyType: "TARGET_CPA",
    budgetAmount: 50,
    budgetLimited: true,
  };

  it("reports a converting campaign held back by budget", () => {
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [campaign],
        metrics: [
          metric({
            metricKey: "search_budget_lost_impression_share",
            entityKind: "campaign",
            entityId: "c1",
            value: 0.4,
          }),
          metric({
            metricKey: "conversions",
            entityKind: "campaign",
            entityId: "c1",
            value: 30,
          }),
          metric({
            metricKey: "spend",
            entityKind: "campaign",
            entityId: "c1",
            value: 600,
          }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.budget-constrained",
    );
    expect(finding?.message).toContain("40%");
    expect(finding?.detail).toMatchObject({ costPerConversion: 20 });
  });

  it("does not call a campaign under-funded when it converts nothing", () => {
    // Losing impressions to budget while returning nothing is a campaign
    // being correctly limited, not one starved of money.
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [campaign],
        metrics: [
          metric({
            metricKey: "search_budget_lost_impression_share",
            entityKind: "campaign",
            entityId: "c1",
            value: 0.4,
          }),
          metric({
            metricKey: "conversions",
            entityKind: "campaign",
            entityId: "c1",
            value: 0,
          }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain("google-ads.budget-constrained");
  });

  it("keeps rank loss separate from budget loss", () => {
    // Opposite remedies: more money never fixes rank, which is exactly why
    // Google reports the two shares separately.
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [campaign],
        metrics: [
          metric({
            metricKey: "search_rank_lost_impression_share",
            entityKind: "campaign",
            entityId: "c1",
            value: 0.5,
          }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.rank-constrained",
    );
    expect(finding?.fix).toContain("Raising the budget will not help");
    expect(rules(issues)).not.toContain("google-ads.budget-constrained");
  });
});

describe("the audit's own blind spot", () => {
  const pmax = {
    id: "c2",
    name: "PMax — all products",
    status: "ENABLED",
    channelType: "PERFORMANCE_MAX",
    biddingStrategyType: "MAXIMIZE_CONVERSION_VALUE",
    budgetAmount: 200,
    budgetLimited: false,
  };
  const search = {
    id: "c1",
    name: "Brand search",
    status: "ENABLED",
    channelType: "SEARCH",
    biddingStrategyType: "TARGET_CPA",
    budgetAmount: 50,
    budgetLimited: false,
  };

  it("names the share of spend the search term report cannot explain", () => {
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [search, pmax],
        metrics: [
          metric({
            metricKey: "spend",
            entityKind: "campaign",
            entityId: "c1",
            value: 300,
          }),
          metric({
            metricKey: "spend",
            entityKind: "campaign",
            entityId: "c2",
            value: 700,
          }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.search-term-blind-spot",
    );
    expect(finding?.message).toContain("70%");
    expect(finding?.detail).toMatchObject({
      opaqueSpend: 700,
      totalSpend: 1000,
    });
    // Framed as a limit of what Google exposes rather than as something the
    // operator did wrong.
    expect(finding?.fix).toContain("limit of what Google exposes");
  });

  it("stays quiet when opaque spend is a small share", () => {
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [search, pmax],
        metrics: [
          metric({
            metricKey: "spend",
            entityKind: "campaign",
            entityId: "c1",
            value: 950,
          }),
          metric({
            metricKey: "spend",
            entityKind: "campaign",
            entityId: "c2",
            value: 50,
          }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain("google-ads.search-term-blind-spot");
  });

  it("declines when campaign spend was not measured", () => {
    // Without the split there is no share to report, and "some unknown
    // portion is invisible" is not worth an operator's attention.
    const issues = auditGoogleAdsAccount(input({ campaigns: [search, pmax] }));
    expect(rules(issues)).not.toContain("google-ads.search-term-blind-spot");
  });
});

describe("structure", () => {
  const manualCampaign = {
    id: "c1",
    name: "Generic",
    status: "ENABLED",
    channelType: "SEARCH",
    biddingStrategyType: "MANUAL_CPC",
    budgetAmount: 40,
    budgetLimited: false,
  };

  function keyword(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      criterionId: "k1",
      text: "widgets",
      matchType: "BROAD",
      adGroupId: "g1",
      adGroupName: "Core",
      campaignId: "c1",
      campaignName: "Generic",
      status: "ENABLED",
      qualityScore: 7,
      impressions: 100,
      clicks: 10,
      cost: 80,
      conversions: 1,
      ...overrides,
    } as GoogleAdsAuditInput["keywords"][number];
  }

  it("reports broad match paired with manual bidding", () => {
    const issues = auditGoogleAdsAccount(
      input({ campaigns: [manualCampaign], keywords: [keyword()] }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.broad-match-without-smart-bidding",
    );
    expect(finding?.message).toContain("80 EUR");
  });

  it("leaves broad match alone under a conversion-based strategy", () => {
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [
          { ...manualCampaign, biddingStrategyType: "MAXIMIZE_CONVERSIONS" },
        ],
        keywords: [keyword()],
      }),
    );
    expect(rules(issues)).not.toContain(
      "google-ads.broad-match-without-smart-bidding",
    );
  });

  it("weights low quality scores by what they cost", () => {
    const cheap = keyword({ criterionId: "k2", qualityScore: 2, cost: 5 });
    const expensive = keyword({
      criterionId: "k3",
      qualityScore: 2,
      cost: 400,
      text: "buy widgets online",
    });
    const issues = auditGoogleAdsAccount(
      input({ keywords: [cheap, expensive] }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.low-quality-keywords",
    );
    expect(finding?.detail).toMatchObject({ totalCost: 400 });
  });

  it("treats the same keyword in two ad groups as a duplicate", () => {
    const issues = auditGoogleAdsAccount(
      input({
        keywords: [
          keyword({ adGroupId: "g1", adGroupName: "Core" }),
          keyword({ criterionId: "k9", adGroupId: "g2", adGroupName: "Other" }),
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.duplicate-keywords",
    );
    expect(finding).toBeDefined();
    const keywords = (finding?.detail as { keywords: Array<{ text: string }> })
      .keywords;
    expect(keywords[0]?.text).toBe("widgets");
  });

  it("does not treat different match types as duplicates", () => {
    const issues = auditGoogleAdsAccount(
      input({
        keywords: [
          keyword({ adGroupId: "g1", matchType: "EXACT" }),
          keyword({ criterionId: "k9", adGroupId: "g2", matchType: "PHRASE" }),
        ],
      }),
    );
    expect(rules(issues)).not.toContain("google-ads.duplicate-keywords");
  });

  it("reports ads Google refuses to run, with the policy reason", () => {
    const issues = auditGoogleAdsAccount(
      input({
        ads: [
          {
            id: "a1",
            adGroupId: "g1",
            adGroupName: "Core",
            campaignId: "c1",
            status: "ENABLED",
            approvalStatus: "DISAPPROVED",
            policyTopics: ["TRADEMARKS_IN_AD_TEXT"],
            finalUrls: ["https://example.com/boots"],
          },
        ],
      }),
    );
    const finding = issues.find(
      (issue) => issue.id === "google-ads.ad-disapproved",
    );
    expect(finding?.priority).toBe("High");
    expect(finding?.detail).toMatchObject({
      policyTopics: ["TRADEMARKS_IN_AD_TEXT"],
    });
  });
});

describe("an account with nothing wrong", () => {
  it("produces no findings at all", () => {
    const issues = auditGoogleAdsAccount(
      input({
        campaigns: [
          {
            id: "c1",
            name: "Brand",
            status: "ENABLED",
            channelType: "SEARCH",
            biddingStrategyType: "TARGET_CPA",
            budgetAmount: 100,
            budgetLimited: false,
          },
        ],
        metrics: [
          metric({ metricKey: "spend", value: 500 }),
          metric({ metricKey: "conversions", value: 25 }),
        ],
        searchTerms: [term({ conversions: 3 })],
      }),
    );
    expect(issues).toEqual([]);
  });
});
