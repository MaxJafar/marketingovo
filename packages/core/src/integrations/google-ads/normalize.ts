// Google Ads rows -> channel metrics and search terms.
//
// Pure and side-effect free, so the interesting question — "what does this
// product claim it measured" — is answerable from a unit test rather than from
// a live ad account.
//
// The rule this file exists to enforce is the same one the Meta normalizer
// keeps: a figure Google did not report becomes a row with a null value and a
// state that says why, never a zero. Google makes this easy to get wrong,
// because it omits a metric field entirely when it has nothing for it, and an
// omitted field in JSON reads as `undefined` — which coerces to 0 in arithmetic
// without complaint.

import type {
  GoogleAdsLevel,
  GoogleAdsMetricRow,
  GoogleAdsSearchTermRow,
} from "./client.js";
import type {
  AdPlatform,
  ChannelEntityKind,
  ChannelMetric,
  ChannelMetricKey,
  ChannelMetricState,
  SearchTermMatchType,
  SearchTermRecord,
  SearchTermStatus,
} from "../channel-vocabulary.js";

export const GOOGLE_ADS_SOURCE = "google-ads";

/**
 * Campaign types whose queries Google does not expose.
 *
 * Not an oversight to work around — Google reports these as one surface by
 * design. The audit names the share of spend they hold rather than analysing
 * what it can see and implying the rest is fine.
 */
export const OPAQUE_CHANNEL_TYPES = new Set([
  "PERFORMANCE_MAX",
  "DEMAND_GEN",
  "DISCOVERY",
  "SMART",
  "LOCAL",
  "APP",
]);

/**
 * Maps Google's network and campaign type onto the product's vocabulary.
 *
 * Performance Max wins over the network segment when both are present: Google
 * reports a PMax row's network as `MIXED` or as one of the underlying
 * surfaces, and filing that under `google_search` would claim a breakdown that
 * Google does not actually provide for it.
 */
export function toGoogleAdPlatform(
  adNetworkType: string | null | undefined,
  channelType?: string | null,
): AdPlatform {
  if (channelType && OPAQUE_CHANNEL_TYPES.has(channelType.toUpperCase())) {
    return "google_performance_max";
  }
  if (adNetworkType === null || adNetworkType === undefined) return "all";
  switch (adNetworkType.toUpperCase()) {
    case "SEARCH":
      return "google_search";
    case "SEARCH_PARTNERS":
      return "google_search_partners";
    case "CONTENT":
      return "google_display";
    case "YOUTUBE":
    case "YOUTUBE_SEARCH":
    case "YOUTUBE_WATCH":
      return "google_youtube";
    // `MIXED` is Google saying it did not break the row out, which is exactly
    // what `all` means here.
    case "MIXED":
      return "all";
    default:
      return "unknown";
  }
}

export function toGoogleEntityKind(level: GoogleAdsLevel): ChannelEntityKind {
  return level === "account"
    ? "account"
    : level === "campaign"
      ? "campaign"
      : "adset";
}

export function toSearchTermMatchType(value: string): SearchTermMatchType {
  switch (value.toUpperCase()) {
    case "EXACT":
      return "exact";
    case "PHRASE":
      return "phrase";
    case "BROAD":
      return "broad";
    case "NEAR_EXACT":
      return "near_exact";
    case "NEAR_PHRASE":
      return "near_phrase";
    default:
      return "unknown";
  }
}

export function toSearchTermStatus(value: string): SearchTermStatus {
  switch (value.toUpperCase()) {
    case "ADDED":
      return "added";
    case "EXCLUDED":
      return "excluded";
    case "ADDED_EXCLUDED":
      return "added_excluded";
    case "NONE":
      return "none";
    default:
      return "unknown";
  }
}

interface MetricSource {
  key: ChannelMetricKey;
  read: (row: GoogleAdsMetricRow) => number | null;
  /** True when the figure is denominated in the account currency. */
  monetary: boolean;
  /** Why a null reading is missing. Each omission means something different. */
  absentNote: string;
}

const METRIC_SOURCES: readonly MetricSource[] = [
  {
    key: "impressions",
    read: (row) => row.impressions,
    monetary: false,
    absentNote: "Google reported no impressions for this row.",
  },
  {
    key: "clicks",
    read: (row) => row.clicks,
    monetary: false,
    absentNote: "Google reported no clicks for this row.",
  },
  {
    key: "spend",
    read: (row) => row.cost,
    monetary: true,
    absentNote: "Google reported no cost for this row.",
  },
  {
    key: "conversions",
    // Fractional on purpose. Google divides one conversion across the clicks
    // it credits, so 0.5 is a real reading rather than a rounding artefact.
    read: (row) => row.conversions,
    monetary: false,
    absentNote:
      "Google reported no conversions. On an account without conversion tracking configured, this field is absent rather than zero.",
  },
  {
    key: "conversion_value",
    read: (row) => row.conversionValue,
    monetary: true,
    absentNote:
      "Google reported no conversion value; conversion actions without a value assigned do not produce this field.",
  },
  {
    key: "ctr",
    read: (row) => row.ctr,
    monetary: false,
    absentNote: "Google reported no click-through rate for this row.",
  },
  {
    key: "cpc",
    read: (row) => row.averageCpc,
    monetary: true,
    absentNote:
      "Google reports an average cost per click only for rows with at least one click.",
  },
  {
    key: "cpm",
    read: (row) => row.averageCpm,
    monetary: true,
    absentNote: "Google reported no average cost per thousand impressions.",
  },
  {
    key: "search_impression_share",
    read: (row) => row.searchImpressionShare,
    monetary: false,
    absentNote:
      "Google withholds impression share when the auction pool is too small to anonymise, and does not report it outside Search at all.",
  },
  {
    key: "search_budget_lost_impression_share",
    read: (row) => row.searchBudgetLostImpressionShare,
    monetary: false,
    absentNote:
      "Google withholds impression share when the auction pool is too small to anonymise, and does not report it outside Search at all.",
  },
  {
    key: "search_rank_lost_impression_share",
    read: (row) => row.searchRankLostImpressionShare,
    monetary: false,
    absentNote:
      "Google withholds impression share when the auction pool is too small to anonymise, and does not report it outside Search at all.",
  },
];

export interface NormalizeGoogleAdsOptions {
  channelAccountId: string;
  level: GoogleAdsLevel;
  currency: string | null;
  fetchedAt: string;
  /**
   * Set when the provider result was cut short. Every row from a truncated
   * read is recorded as `partial`, because a total over a truncated page is a
   * smaller number presented as a complete one.
   */
  truncated?: boolean;
}

export function normalizeGoogleAdsMetrics(
  rows: readonly GoogleAdsMetricRow[],
  options: NormalizeGoogleAdsOptions,
): ChannelMetric[] {
  const entityKind = toGoogleEntityKind(options.level);
  const metrics: ChannelMetric[] = [];

  for (const row of rows) {
    // A row without a date cannot be filed against a day, and guessing today
    // would attribute an earlier day's spend to the wrong period.
    if (!row.date || !row.entityId) continue;
    const platform = toGoogleAdPlatform(row.adNetworkType, row.channelType);

    for (const source of METRIC_SOURCES) {
      const raw = source.read(row);
      const available = raw !== null && Number.isFinite(raw);
      const state: ChannelMetricState = available
        ? options.truncated
          ? "partial"
          : "available"
        : "unavailable";
      metrics.push({
        channelAccountId: options.channelAccountId,
        entityKind,
        entityId: row.entityId,
        entityName: row.entityName,
        platform,
        date: row.date,
        metricKey: source.key,
        value: available ? raw : null,
        state,
        // A monetary figure without its currency is not actionable, so the
        // currency travels with every row that holds one.
        currency: source.monetary ? options.currency : null,
        source: GOOGLE_ADS_SOURCE,
        fetchedAt: options.fetchedAt,
        note: available
          ? options.truncated
            ? "The provider result was truncated; totals over this window are a lower bound."
            : null
          : source.absentNote,
      });
    }
  }

  return metrics;
}

export function normalizeSearchTerms(
  rows: readonly GoogleAdsSearchTermRow[],
  options: {
    channelAccountId: string;
    currency: string | null;
    windowStart: string;
    windowEnd: string;
    fetchedAt: string;
  },
): SearchTermRecord[] {
  const records: SearchTermRecord[] = [];
  for (const row of rows) {
    if (!row.query || !row.campaignId || !row.adGroupId) continue;
    records.push({
      channelAccountId: options.channelAccountId,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      adGroupId: row.adGroupId,
      adGroupName: row.adGroupName,
      query: row.query,
      matchedKeyword: row.matchedKeyword,
      matchType: toSearchTermMatchType(row.matchType),
      status: toSearchTermStatus(row.status),
      impressions: row.impressions,
      clicks: row.clicks,
      cost: row.cost,
      conversions: row.conversions,
      conversionValue: row.conversionValue,
      currency: options.currency,
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      fetchedAt: options.fetchedAt,
    });
  }
  return records;
}

/**
 * Records that an account could not be read at all.
 *
 * Without this, a failed sync leaves the previous window's rows in place and
 * the dashboard shows stale numbers as if they were current. Writing explicit
 * `failed` rows for the requested days makes the outage visible exactly where
 * the numbers would otherwise be.
 */
export function markGoogleAdsWindowUnavailable(options: {
  channelAccountId: string;
  dates: readonly string[];
  reason: string;
  fetchedAt: string;
  currency: string | null;
}): ChannelMetric[] {
  return options.dates.flatMap((date) =>
    METRIC_SOURCES.map((source) => ({
      channelAccountId: options.channelAccountId,
      entityKind: "account" as const,
      entityId: "account",
      entityName: null,
      platform: "all" as const,
      date,
      metricKey: source.key,
      value: null,
      state: "failed" as const,
      currency: source.monetary ? options.currency : null,
      source: GOOGLE_ADS_SOURCE,
      fetchedAt: options.fetchedAt,
      note: options.reason.slice(0, 400),
    })),
  );
}
