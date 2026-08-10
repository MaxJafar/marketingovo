// Google Ads API client.
//
// The runtime supplies a vault-backed OAuth access token and the operator's
// own developer token for the duration of an invocation. This client never
// reads token files, never refreshes a credential, and holds no client secret.
//
// One endpoint serves every read. Google Ads is queried with GAQL rather than
// by resource, so the shape below is a handful of pinned queries rather than a
// set of URL builders — which is a good deal, because it means every field
// this product reads is visible in one file.
//
// Nothing here mutates. There is no `:mutate` call, and ADR 0008 records why
// the read-only guarantee has to live above the credential: Google publishes
// no read-only scope, so the promise is kept by the software rather than by
// the permission.

import {
  assertGaqlDate,
  classifyGoogleAdsFailure,
  GoogleAdsError,
  googleAdsAccessibleCustomersUrl,
  googleAdsSearchUrl,
  isGoogleAdsCustomerId,
  microsToCurrency,
  normalizeCustomerId,
  normalizeGoogleAdsVersion,
  parseGoogleAdsNumber,
  safeGoogleAdsFetch,
} from "@marketingovo/integrations";

/**
 * Bounds. Google will happily stream a large account into hundreds of
 * thousands of rows, and an unbounded sync is how a local tool becomes
 * something an operator has to babysit.
 */
const MAX_ROWS = 20_000;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

/** One Google Ads account as Google describes it. */
export interface GoogleAdsCustomer {
  id: string;
  descriptiveName: string | null;
  currencyCode: string | null;
  timeZone: string | null;
  /** True when the account only manages others and spends nothing itself. */
  manager: boolean;
  testAccount: boolean;
  /** Provider-side cap in the account currency, when the account sets one. */
  accountBudgetLimit: number | null;
}

/** One daily row at whichever level it was requested. */
export interface GoogleAdsMetricRow {
  date: string;
  entityId: string;
  entityName: string | null;
  /** Google's `ad_network_type`, or null when the level does not report one. */
  adNetworkType: string | null;
  /** Google's `advertising_channel_type` for the owning campaign. */
  channelType: string | null;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
  conversionValue: number | null;
  ctr: number | null;
  averageCpc: number | null;
  averageCpm: number | null;
  searchImpressionShare: number | null;
  searchBudgetLostImpressionShare: number | null;
  searchRankLostImpressionShare: number | null;
}

/** Delivery and configuration state, which metrics alone cannot report. */
export interface GoogleAdsCampaignRecord {
  id: string;
  name: string;
  status: string;
  /** SEARCH, DISPLAY, SHOPPING, VIDEO, PERFORMANCE_MAX, DEMAND_GEN. */
  channelType: string;
  /** MANUAL_CPC, TARGET_CPA, MAXIMIZE_CONVERSIONS and so on. */
  biddingStrategyType: string | null;
  budgetAmount: number | null;
  /** Google's own verdict that the budget is holding the campaign back. */
  budgetLimited: boolean;
}

export interface GoogleAdsAdRecord {
  id: string;
  adGroupId: string;
  adGroupName: string | null;
  campaignId: string;
  status: string;
  /** APPROVED, APPROVED_LIMITED, AREA_OF_INTEREST_ONLY, DISAPPROVED. */
  approvalStatus: string | null;
  /** Google's policy topic names, e.g. TRADEMARKS_IN_AD_TEXT. */
  policyTopics: string[];
  /**
   * Where clicks actually land.
   *
   * An ad may carry several, and Google picks between them. Read because it
   * is the only field that connects paid spend to a page this product has
   * already crawled — and a destination that 404s is the purest waste there
   * is, invisible in every metric except the one nobody looks at.
   */
  finalUrls: string[];
}

export interface GoogleAdsKeywordRecord {
  criterionId: string;
  text: string;
  matchType: string;
  adGroupId: string;
  adGroupName: string | null;
  campaignId: string;
  campaignName: string | null;
  status: string;
  /** Google's own relevance verdict, when it has enough data to give one. */
  qualityScore: number | null;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
}

export interface GoogleAdsSearchTermRow {
  query: string;
  matchedKeyword: string | null;
  matchType: string;
  status: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
  conversionValue: number | null;
}

export type GoogleAdsLevel = "account" | "campaign" | "adgroup";

export interface GoogleAdsClientOptions {
  accessToken: string;
  /** The operator's own, from the API Center of their manager account. */
  developerToken: string;
  /** The account being read. */
  customerId: string;
  /** The manager above it, required whenever the credential arrives that way. */
  loginCustomerId?: string | null;
  apiVersion?: string;
  providerFetch?: typeof fetch;
}

interface StreamChunk {
  results?: unknown[];
  fieldMask?: unknown;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GoogleAdsError(
      "google_ads_response_invalid",
      "Google returned a response that was not an object",
    );
  }
  return value as Record<string, unknown>;
}

/** Reads a dotted path out of the nested resource Google returns. */
function at(row: unknown, path: string): unknown {
  let current: unknown = row;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function text(row: unknown, path: string): string | null {
  const value = at(row, path);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(row: unknown, path: string): number | null {
  return parseGoogleAdsNumber(at(row, path));
}

function micros(row: unknown, path: string): number | null {
  return microsToCurrency(at(row, path));
}

/**
 * Google reports an id as a number in some resources and a string in others,
 * and ids exceed the safe integer range. Read as a string either way.
 */
function id(row: unknown, path: string): string | null {
  const value = at(row, path);
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export class GoogleAdsClient {
  private readonly accessToken: string;
  private readonly developerToken: string;
  private readonly customerId: string;
  private readonly loginCustomerId: string | null;
  private readonly apiVersion: string;
  private readonly providerFetch: typeof fetch;

  constructor(options: GoogleAdsClientOptions) {
    const token = options.accessToken.trim();
    if (!token) {
      throw new GoogleAdsError(
        "google_ads_token_invalid",
        "A Google access token is required",
      );
    }
    const developerToken = options.developerToken.trim();
    if (!developerToken) {
      throw new GoogleAdsError(
        "google_ads_developer_token_missing",
        "A Google Ads developer token is required. It comes from the API Center of a manager account and is separate from the sign-in.",
      );
    }
    const customerId = normalizeCustomerId(options.customerId);
    if (!isGoogleAdsCustomerId(customerId)) {
      throw new GoogleAdsError(
        "google_ads_customer_not_found",
        "A Google Ads customer id is ten digits, with or without hyphens.",
      );
    }
    const login = normalizeCustomerId(options.loginCustomerId ?? "");
    this.accessToken = token;
    this.developerToken = developerToken;
    this.customerId = customerId;
    this.loginCustomerId = isGoogleAdsCustomerId(login) ? login : null;
    this.apiVersion = normalizeGoogleAdsVersion(options.apiVersion);
    this.providerFetch = options.providerFetch ?? safeGoogleAdsFetch;
  }

  private headers(): Record<string, string> {
    return {
      accept: "application/json",
      "content-type": "application/json",
      // Both credentials travel as headers, never as query parameters, so
      // neither can be lifted out of a URL an error or a log copies verbatim.
      authorization: `Bearer ${this.accessToken}`,
      "developer-token": this.developerToken,
      ...(this.loginCustomerId
        ? { "login-customer-id": this.loginCustomerId }
        : {}),
    };
  }

  /**
   * Runs one GAQL query and returns every row.
   *
   * `searchStream` answers with a JSON array of chunks rather than a paginated
   * object, so there is no cursor to follow — the bound is on total rows, and
   * exceeding it is reported rather than silently truncating into a total that
   * looks complete.
   */
  private async query(
    gaql: string,
  ): Promise<{ rows: unknown[]; truncated: boolean }> {
    const url = googleAdsSearchUrl(this.apiVersion, this.customerId);
    const response = await this.providerFetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query: gaql }),
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });

    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_BYTES) {
      throw new GoogleAdsError(
        "google_ads_response_invalid",
        "Google returned more data than this sync will hold in memory. Narrow the date window.",
      );
    }

    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new GoogleAdsError(
        "google_ads_response_invalid",
        "Google returned a response that was not JSON",
      );
    }

    if (!response.ok) {
      // An error body arrives as an array of one chunk from searchStream, and
      // as a bare object from every other endpoint.
      throw classifyGoogleAdsFailure(
        response.status,
        Array.isArray(payload) ? payload[0] : payload,
      );
    }

    const chunks: StreamChunk[] = Array.isArray(payload)
      ? (payload as StreamChunk[])
      : [payload as StreamChunk];
    const rows: unknown[] = [];
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== "object") continue;
      const results = chunk.results;
      if (!Array.isArray(results)) continue;
      for (const row of results) {
        if (rows.length >= MAX_ROWS) return { rows, truncated: true };
        rows.push(row);
      }
    }
    return { rows, truncated: false };
  }

  /** The accounts this credential can see. Read-only; links nothing. */
  async accessibleCustomers(): Promise<string[]> {
    const response = await this.providerFetch(
      googleAdsAccessibleCustomersUrl(this.apiVersion),
      {
        method: "GET",
        headers: this.headers(),
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      },
    );
    const raw = await response.text();
    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new GoogleAdsError(
        "google_ads_response_invalid",
        "Google returned a response that was not JSON",
      );
    }
    if (!response.ok) throw classifyGoogleAdsFailure(response.status, payload);
    const names = asObject(payload).resourceNames;
    if (!Array.isArray(names)) return [];
    return names
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.replace(/^customers\//, ""))
      .filter((value) => isGoogleAdsCustomerId(value));
  }

  /** The account's own record: name, currency, and whether it is a manager. */
  async customer(): Promise<GoogleAdsCustomer> {
    const { rows } = await this.query(
      `SELECT customer.id, customer.descriptive_name, customer.currency_code,
              customer.time_zone, customer.manager, customer.test_account
       FROM customer
       LIMIT 1`,
    );
    const row = rows[0];
    if (!row) {
      throw new GoogleAdsError(
        "google_ads_customer_not_found",
        "Google returned no record for this customer id.",
      );
    }
    return {
      id: id(row, "customer.id") ?? this.customerId,
      descriptiveName: text(row, "customer.descriptiveName"),
      currencyCode: text(row, "customer.currencyCode"),
      timeZone: text(row, "customer.timeZone"),
      manager: at(row, "customer.manager") === true,
      testAccount: at(row, "customer.testAccount") === true,
      // Not on the customer resource; read separately when a cap matters.
      accountBudgetLimit: null,
    };
  }

  /**
   * Daily metrics for a window.
   *
   * Segmented by ad network below the account level, because "Search Partners
   * are expensive" is not answerable from a campaign total, and turning
   * partners off is a switch an operator actually has.
   */
  async metrics(options: {
    level: GoogleAdsLevel;
    since: string;
    until: string;
  }): Promise<{ rows: GoogleAdsMetricRow[]; truncated: boolean }> {
    const since = assertGaqlDate(options.since, "since");
    const until = assertGaqlDate(options.until, "until");

    const shared = `segments.date, metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions, metrics.conversions_value,
       metrics.ctr, metrics.average_cpc, metrics.average_cpm`;

    // Impression share is only defined on Search, and Google rejects the query
    // outright when it is selected for a resource that cannot report it.
    const impressionShare = `metrics.search_impression_share,
       metrics.search_budget_lost_impression_share,
       metrics.search_rank_lost_impression_share`;

    const gaql =
      options.level === "account"
        ? `SELECT customer.id, customer.descriptive_name, ${shared}, ${impressionShare}
           FROM customer
           WHERE segments.date BETWEEN '${since}' AND '${until}'`
        : options.level === "campaign"
          ? `SELECT campaign.id, campaign.name, campaign.advertising_channel_type,
                    segments.ad_network_type, ${shared}, ${impressionShare}
             FROM campaign
             WHERE segments.date BETWEEN '${since}' AND '${until}'`
          : `SELECT ad_group.id, ad_group.name, campaign.advertising_channel_type,
                    segments.ad_network_type, ${shared}
             FROM ad_group
             WHERE segments.date BETWEEN '${since}' AND '${until}'`;

    const { rows, truncated } = await this.query(gaql);
    const prefix =
      options.level === "account"
        ? "customer"
        : options.level === "campaign"
          ? "campaign"
          : "adGroup";
    const nameField = options.level === "account" ? "descriptiveName" : "name";

    return {
      truncated,
      rows: rows.map((row) => ({
        date: text(row, "segments.date") ?? "",
        entityId: id(row, `${prefix}.id`) ?? this.customerId,
        entityName: text(row, `${prefix}.${nameField}`),
        adNetworkType: text(row, "segments.adNetworkType"),
        channelType: text(row, "campaign.advertisingChannelType"),
        impressions: num(row, "metrics.impressions"),
        clicks: num(row, "metrics.clicks"),
        cost: micros(row, "metrics.costMicros"),
        conversions: num(row, "metrics.conversions"),
        conversionValue: num(row, "metrics.conversionsValue"),
        ctr: num(row, "metrics.ctr"),
        averageCpc: micros(row, "metrics.averageCpc"),
        averageCpm: micros(row, "metrics.averageCpm"),
        searchImpressionShare: num(row, "metrics.searchImpressionShare"),
        searchBudgetLostImpressionShare: num(
          row,
          "metrics.searchBudgetLostImpressionShare",
        ),
        searchRankLostImpressionShare: num(
          row,
          "metrics.searchRankLostImpressionShare",
        ),
      })),
    };
  }

  /** Campaign configuration: type, bidding, budget, and Google's own verdict. */
  async campaigns(): Promise<{
    records: GoogleAdsCampaignRecord[];
    truncated: boolean;
  }> {
    const { rows, truncated } = await this.query(
      `SELECT campaign.id, campaign.name, campaign.status,
              campaign.advertising_channel_type, campaign.bidding_strategy_type,
              campaign_budget.amount_micros,
              campaign_budget.has_recommended_budget
       FROM campaign
       WHERE campaign.status != 'REMOVED'`,
    );
    return {
      truncated,
      records: rows.map((row) => ({
        id: id(row, "campaign.id") ?? "",
        name: text(row, "campaign.name") ?? "",
        status: text(row, "campaign.status") ?? "UNKNOWN",
        channelType: text(row, "campaign.advertisingChannelType") ?? "UNKNOWN",
        biddingStrategyType: text(row, "campaign.biddingStrategyType"),
        budgetAmount: micros(row, "campaignBudget.amountMicros"),
        // Google recommends a larger budget precisely when the current one is
        // the constraint, which is a cheaper signal than the budget-lost
        // impression share and available on every campaign type.
        budgetLimited: at(row, "campaignBudget.hasRecommendedBudget") === true,
      })),
    };
  }

  /**
   * Ads and their policy state.
   *
   * The one finding metrics cannot produce: a disapproved ad simply stops
   * appearing in spend, which reads as a creative that went quiet rather than
   * one Google refused to run.
   */
  async ads(): Promise<{ records: GoogleAdsAdRecord[]; truncated: boolean }> {
    const { rows, truncated } = await this.query(
      `SELECT ad_group_ad.ad.id, ad_group_ad.status,
              ad_group_ad.ad.final_urls,
              ad_group_ad.policy_summary.approval_status,
              ad_group_ad.policy_summary.policy_topic_entries,
              ad_group.id, ad_group.name, campaign.id
       FROM ad_group_ad
       WHERE ad_group_ad.status != 'REMOVED'`,
    );
    return {
      truncated,
      records: rows.map((row) => {
        const entries = at(row, "adGroupAd.policySummary.policyTopicEntries");
        const topics = Array.isArray(entries)
          ? entries
              .map((entry) =>
                entry && typeof entry === "object"
                  ? (entry as { topic?: unknown }).topic
                  : null,
              )
              .filter((topic): topic is string => typeof topic === "string")
          : [];
        const finalUrls = at(row, "adGroupAd.ad.finalUrls");
        return {
          id: id(row, "adGroupAd.ad.id") ?? "",
          adGroupId: id(row, "adGroup.id") ?? "",
          adGroupName: text(row, "adGroup.name"),
          campaignId: id(row, "campaign.id") ?? "",
          status: text(row, "adGroupAd.status") ?? "UNKNOWN",
          approvalStatus: text(row, "adGroupAd.policySummary.approvalStatus"),
          policyTopics: topics,
          finalUrls: Array.isArray(finalUrls)
            ? finalUrls.filter(
                (value): value is string =>
                  typeof value === "string" && value.trim() !== "",
              )
            : [],
        };
      }),
    };
  }

  /** Keywords with their window totals and Google's relevance verdict. */
  async keywords(options: {
    since: string;
    until: string;
  }): Promise<{ records: GoogleAdsKeywordRecord[]; truncated: boolean }> {
    const since = assertGaqlDate(options.since, "since");
    const until = assertGaqlDate(options.until, "until");
    const { rows, truncated } = await this.query(
      `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
              ad_group_criterion.keyword.match_type, ad_group_criterion.status,
              ad_group_criterion.quality_info.quality_score,
              ad_group.id, ad_group.name, campaign.id, campaign.name,
              metrics.impressions, metrics.clicks, metrics.cost_micros,
              metrics.conversions
       FROM keyword_view
       WHERE segments.date BETWEEN '${since}' AND '${until}'
         AND ad_group_criterion.status != 'REMOVED'`,
    );
    return {
      truncated,
      records: rows.map((row) => ({
        criterionId: id(row, "adGroupCriterion.criterionId") ?? "",
        text: text(row, "adGroupCriterion.keyword.text") ?? "",
        matchType: text(row, "adGroupCriterion.keyword.matchType") ?? "UNKNOWN",
        adGroupId: id(row, "adGroup.id") ?? "",
        adGroupName: text(row, "adGroup.name"),
        campaignId: id(row, "campaign.id") ?? "",
        campaignName: text(row, "campaign.name"),
        status: text(row, "adGroupCriterion.status") ?? "UNKNOWN",
        qualityScore: num(row, "adGroupCriterion.qualityInfo.qualityScore"),
        impressions: num(row, "metrics.impressions"),
        clicks: num(row, "metrics.clicks"),
        cost: micros(row, "metrics.costMicros"),
        conversions: num(row, "metrics.conversions"),
      })),
    };
  }

  /**
   * The queries that actually triggered ads.
   *
   * Aggregated across the window rather than segmented by date, which is both
   * what the analysis needs and an order of magnitude fewer rows.
   *
   * This view covers Search and Shopping only. Performance Max and Demand Gen
   * report no queries at all, and Google withholds terms whose volume is too
   * low to anonymise — so the result never accounts for the whole of an
   * account's clicks, and the audit says so rather than implying coverage.
   */
  async searchTerms(options: {
    since: string;
    until: string;
  }): Promise<{ rows: GoogleAdsSearchTermRow[]; truncated: boolean }> {
    const since = assertGaqlDate(options.since, "since");
    const until = assertGaqlDate(options.until, "until");
    const { rows, truncated } = await this.query(
      `SELECT search_term_view.search_term, search_term_view.status,
              segments.keyword.info.text, segments.keyword.info.match_type,
              campaign.id, campaign.name, ad_group.id, ad_group.name,
              metrics.impressions, metrics.clicks, metrics.cost_micros,
              metrics.conversions, metrics.conversions_value
       FROM search_term_view
       WHERE segments.date BETWEEN '${since}' AND '${until}'`,
    );
    return {
      truncated,
      rows: rows.map((row) => ({
        query: text(row, "searchTermView.searchTerm") ?? "",
        matchedKeyword: text(row, "segments.keyword.info.text"),
        matchType: text(row, "segments.keyword.info.matchType") ?? "UNKNOWN",
        status: text(row, "searchTermView.status") ?? "UNKNOWN",
        campaignId: id(row, "campaign.id") ?? "",
        campaignName: text(row, "campaign.name"),
        adGroupId: id(row, "adGroup.id") ?? "",
        adGroupName: text(row, "adGroup.name"),
        impressions: num(row, "metrics.impressions"),
        clicks: num(row, "metrics.clicks"),
        cost: micros(row, "metrics.costMicros"),
        conversions: num(row, "metrics.conversions"),
        conversionValue: num(row, "metrics.conversionsValue"),
      })),
    };
  }
}
