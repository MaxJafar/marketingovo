// Channel metric vocabulary, as the engine layer sees it.
//
// `@marketingovo/contracts/channels` is the authority on these names and holds
// the TypeBox schemas the API validates against. Core deliberately does not
// depend on it — the engine is the layer below the API and stays publishable
// without it — so the shape is restated here instead.
//
// The two are kept from drifting by a compile-time assignability check in the
// runtime, which is the one place that holds both. If a field is added or
// renamed in the contract, that check fails to build rather than silently
// dropping data at the boundary.
//
// This lives beside the connectors rather than inside one of them because more
// than one paid channel speaks it. A rule written about "the middle layer" or
// "spend" should mean the same thing whether the row came from Meta or Google.

/**
 * Where a paid impression was actually served.
 *
 * `all` means the provider reported the row without a breakdown, which is a
 * different claim from a row that happened to be Facebook. Search and Search
 * Partners are kept apart because partner traffic converts differently and is
 * switched off separately. Performance Max is its own value rather than being
 * folded into the networks it runs on: Google reports it as one opaque
 * surface, and calling it search would claim a breakdown that does not exist.
 */
export type AdPlatform =
  | "all"
  | "facebook"
  | "instagram"
  | "messenger"
  | "audience_network"
  | "google_search"
  | "google_search_partners"
  | "google_display"
  | "google_youtube"
  | "google_performance_max"
  | "unknown";

/**
 * `adset` covers Meta's ad set and Google's ad group — the same layer, the
 * thing that holds targeting and a budget under a campaign. One name, so a
 * rule about the middle layer is written once.
 */
export type ChannelEntityKind =
  | "account"
  | "campaign"
  | "adset"
  | "ad"
  /** Google only. The bid unit, and where most account waste is visible. */
  | "keyword"
  | "post"
  | "profile";

export type ChannelMetricState =
  "available" | "partial" | "unavailable" | "failed";

export type ChannelMetricKey =
  | "impressions"
  | "clicks"
  | "spend"
  | "reach"
  | "frequency"
  | "conversions"
  | "conversion_value"
  | "cost_per_conversion"
  | "ctr"
  | "cpc"
  | "cpm"
  | "engagements"
  | "video_plays"
  | "link_clicks"
  /**
   * Google only, reported as a fraction. The two lost shares say where the
   * rest of the auction went — one is a money problem and the other is a
   * quality problem, and they have opposite remedies.
   */
  | "search_impression_share"
  | "search_budget_lost_impression_share"
  | "search_rank_lost_impression_share";

export interface ChannelMetric {
  channelAccountId: string;
  entityKind: ChannelEntityKind;
  entityId: string;
  entityName: string | null;
  platform: AdPlatform;
  date: string;
  /** Null whenever `state` is not `available`. Never a substituted zero. */
  value: number | null;
  state: ChannelMetricState;
  metricKey: ChannelMetricKey;
  currency: string | null;
  source: string;
  fetchedAt: string;
  note: string | null;
}

export type SearchTermMatchType =
  "exact" | "phrase" | "broad" | "near_exact" | "near_phrase" | "unknown";

export type SearchTermStatus =
  "added" | "excluded" | "added_excluded" | "none" | "unknown";

/** One query that triggered an ad, aggregated over the sync window. */
export interface SearchTermRecord {
  channelAccountId: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  query: string;
  matchedKeyword: string | null;
  matchType: SearchTermMatchType;
  status: SearchTermStatus;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  /** Fractional by design; Google divides a conversion across credited clicks. */
  conversions: number | null;
  conversionValue: number | null;
  currency: string | null;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

/** How much of an account's spend the search term report cannot explain. */
export interface SearchTermCoverage {
  inspectableSpend: number | null;
  opaqueSpend: number | null;
  opaqueCampaigns: string[];
  currency: string | null;
}
