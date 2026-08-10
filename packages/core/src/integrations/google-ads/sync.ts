// One Google Ads account's sync: fetch, normalize, audit.
//
// The runtime calls this once per linked account. It is the only place that
// combines network I/O with the pure normalizer and rules, so both of those
// stay testable without a live ad account.

import { GoogleAdsError } from "@marketingovo/integrations";
import type { Issue } from "../../checks/index.js";
import {
  GoogleAdsClient,
  type GoogleAdsAdRecord,
  type GoogleAdsCampaignRecord,
  type GoogleAdsKeywordRecord,
  type GoogleAdsLevel,
} from "./client.js";
import { auditGoogleAdsAccount, type GoogleAdsAuditInput } from "./audit.js";
import {
  markGoogleAdsWindowUnavailable,
  normalizeGoogleAdsMetrics,
  normalizeSearchTerms,
  OPAQUE_CHANNEL_TYPES,
} from "./normalize.js";
import { datesInRange } from "../meta/normalize.js";
import type {
  ChannelMetric,
  SearchTermCoverage,
  SearchTermRecord,
} from "../channel-vocabulary.js";
import type { AdDestination } from "../../landing/types.js";

export interface GoogleAdsAccountSyncInput {
  account: GoogleAdsAuditInput["account"];
  accessToken: string;
  /** The operator's own, from the API Center of their manager account. */
  developerToken: string;
  /** The manager above the account, when the credential arrives that way. */
  loginCustomerId?: string | null;
  apiVersion?: string;
  /** Inclusive ISO dates. */
  since: string;
  until: string;
  providerFetch?: typeof fetch;
  signal?: AbortSignal;
  /**
   * Levels to read. Account and campaign answer the marketer's first two
   * questions; ad-group multiplies the row count by the size of the account
   * structure.
   */
  levels?: readonly GoogleAdsLevel[];
  /**
   * Whether to pull the search terms report.
   *
   * On by default, because it is where the money leaks. It is also the largest
   * read by some margin, so a caller syncing many accounts on a schedule can
   * turn it off and keep the cheap signals.
   */
  includeSearchTerms?: boolean;
  now?: () => Date;
}

export interface GoogleAdsAccountSyncResult {
  accountId: string;
  metrics: ChannelMetric[];
  searchTerms: SearchTermRecord[];
  campaigns: GoogleAdsCampaignRecord[];
  ads: GoogleAdsAdRecord[];
  keywords: GoogleAdsKeywordRecord[];
  /** Where the ads send people, grouped by page. */
  destinations: AdDestination[];
  /** How much of the spend the search term report could not explain. */
  coverage: SearchTermCoverage;
  issues: Issue[];
  /** `available` only when every requested read completed in full. */
  state: "available" | "partial" | "failed";
  /** Operator-facing reason when the state is not `available`. */
  reason: string | null;
}

const DEFAULT_LEVELS: readonly GoogleAdsLevel[] = ["account", "campaign"];

function reasonFrom(error: unknown): string {
  if (error instanceof GoogleAdsError) return error.message;
  return error instanceof Error
    ? error.message
    : "The Google Ads request failed for an unknown reason.";
}

/**
 * Groups ads by where they send people.
 *
 * Built here rather than in the runtime because it needs the ads and the
 * keywords together, and both are already in hand. Several ads usually share
 * one destination, and the alignment rules want one entry per page rather than
 * one per ad — a landing page that 404s is one problem, not forty.
 *
 * Spend is attributed only from ad-group metrics. When the sync did not read
 * that level, it stays null: apportioning a campaign's spend across the ad
 * groups inside it would be a guess presented as a measurement.
 */
function buildDestinations(
  account: GoogleAdsAuditInput["account"],
  ads: readonly GoogleAdsAdRecord[],
  keywords: readonly GoogleAdsKeywordRecord[],
  metrics: readonly ChannelMetric[],
): AdDestination[] {
  const keywordsByAdGroup = new Map<string, string[]>();
  for (const keyword of keywords) {
    if (keyword.status === "REMOVED" || keyword.status === "PAUSED") continue;
    const bucket = keywordsByAdGroup.get(keyword.adGroupId) ?? [];
    bucket.push(keyword.text);
    keywordsByAdGroup.set(keyword.adGroupId, bucket);
  }

  const readAdGroupMetric = (
    adGroupId: string,
    metricKey: ChannelMetric["metricKey"],
  ): number | null => {
    let total: number | null = null;
    for (const metric of metrics) {
      if (
        metric.metricKey !== metricKey ||
        metric.entityKind !== "adset" ||
        metric.entityId !== adGroupId ||
        metric.value === null
      ) {
        continue;
      }
      total = (total ?? 0) + metric.value;
    }
    return total;
  };

  const byUrl = new Map<string, AdDestination>();
  for (const ad of ads) {
    if (ad.status === "REMOVED" || ad.status === "PAUSED") continue;
    for (const rawUrl of ad.finalUrls) {
      let url: string;
      try {
        url = new URL(rawUrl).toString();
      } catch {
        continue;
      }
      const existing = byUrl.get(url) ?? {
        url,
        origin: "google-ads" as const,
        accountId: account.id,
        accountName: account.displayName,
        accountExternalId: account.externalId,
        entities: [],
        keywords: [],
        spend: null,
        clicks: null,
        currency: account.currency,
      };

      // One entity per ad group rather than per ad: a finding about a landing
      // page is acted on by editing the ad group, and listing forty ads that
      // share one page is noise rather than evidence.
      if (!existing.entities.some((entity) => entity.id === ad.adGroupId)) {
        existing.entities.push({
          kind: "adgroup",
          id: ad.adGroupId,
          name: ad.adGroupName,
          campaignId: ad.campaignId,
          campaignName: null,
        });
        for (const keyword of keywordsByAdGroup.get(ad.adGroupId) ?? []) {
          if (!existing.keywords.includes(keyword)) {
            existing.keywords.push(keyword);
          }
        }
        const spend = readAdGroupMetric(ad.adGroupId, "spend");
        const clicks = readAdGroupMetric(ad.adGroupId, "clicks");
        if (spend !== null) existing.spend = (existing.spend ?? 0) + spend;
        if (clicks !== null) existing.clicks = (existing.clicks ?? 0) + clicks;
      }

      byUrl.set(url, existing);
    }
  }
  return [...byUrl.values()];
}

/**
 * Splits campaign spend into what the search term report can explain and what
 * it cannot.
 *
 * Computed here rather than in the audit because it needs the campaign records
 * and the metrics together, and because the coverage figure is worth showing
 * in the dashboard whether or not it crosses the threshold that makes it a
 * finding.
 */
function computeCoverage(
  metrics: readonly ChannelMetric[],
  campaigns: readonly GoogleAdsCampaignRecord[],
  currency: string | null,
): SearchTermCoverage {
  const opaque = campaigns.filter((campaign) =>
    OPAQUE_CHANNEL_TYPES.has(campaign.channelType.toUpperCase()),
  );
  const opaqueIds = new Set(opaque.map((campaign) => campaign.id));

  let inspectable: number | null = null;
  let hidden: number | null = null;
  for (const metric of metrics) {
    if (
      metric.metricKey !== "spend" ||
      metric.entityKind !== "campaign" ||
      metric.value === null
    ) {
      continue;
    }
    if (opaqueIds.has(metric.entityId)) hidden = (hidden ?? 0) + metric.value;
    else inspectable = (inspectable ?? 0) + metric.value;
  }

  return {
    inspectableSpend: inspectable,
    opaqueSpend: hidden,
    opaqueCampaigns: opaque.map((campaign) => campaign.name).slice(0, 200),
    currency,
  };
}

/**
 * Reads one account and returns what it actually saw.
 *
 * A failure never produces an empty result that reads as "this account spent
 * nothing". It produces explicit `failed` rows for the requested days, so the
 * outage is visible exactly where the numbers would otherwise be.
 */
export async function syncGoogleAdsAccount(
  input: GoogleAdsAccountSyncInput,
): Promise<GoogleAdsAccountSyncResult> {
  const now = input.now ?? (() => new Date());
  const fetchedAt = now().toISOString();
  const client = new GoogleAdsClient({
    accessToken: input.accessToken,
    developerToken: input.developerToken,
    customerId: input.account.externalId,
    loginCustomerId: input.loginCustomerId ?? null,
    ...(input.apiVersion ? { apiVersion: input.apiVersion } : {}),
    ...(input.providerFetch ? { providerFetch: input.providerFetch } : {}),
  });

  const metrics: ChannelMetric[] = [];
  const searchTerms: SearchTermRecord[] = [];
  let campaigns: GoogleAdsCampaignRecord[] = [];
  let ads: GoogleAdsAdRecord[] = [];
  let keywords: GoogleAdsKeywordRecord[] = [];
  const problems: string[] = [];
  let sawAnything = false;
  let truncatedAnywhere = false;

  for (const level of input.levels ?? DEFAULT_LEVELS) {
    input.signal?.throwIfAborted();
    try {
      const result = await client.metrics({
        level,
        since: input.since,
        until: input.until,
      });
      sawAnything = true;
      truncatedAnywhere = truncatedAnywhere || result.truncated;
      metrics.push(
        ...normalizeGoogleAdsMetrics(result.rows, {
          channelAccountId: input.account.id,
          level,
          currency: input.account.currency,
          fetchedAt,
          truncated: result.truncated,
        }),
      );
    } catch (error) {
      problems.push(`${level} metrics: ${reasonFrom(error)}`);
    }
  }

  input.signal?.throwIfAborted();
  try {
    const result = await client.campaigns();
    sawAnything = true;
    truncatedAnywhere = truncatedAnywhere || result.truncated;
    campaigns = result.records;
  } catch (error) {
    problems.push(`campaign configuration: ${reasonFrom(error)}`);
  }

  input.signal?.throwIfAborted();
  try {
    const result = await client.ads();
    sawAnything = true;
    truncatedAnywhere = truncatedAnywhere || result.truncated;
    ads = result.records;
  } catch (error) {
    problems.push(`ad policy state: ${reasonFrom(error)}`);
  }

  input.signal?.throwIfAborted();
  try {
    const result = await client.keywords({
      since: input.since,
      until: input.until,
    });
    sawAnything = true;
    truncatedAnywhere = truncatedAnywhere || result.truncated;
    keywords = result.records;
  } catch (error) {
    problems.push(`keywords: ${reasonFrom(error)}`);
  }

  if (input.includeSearchTerms !== false) {
    input.signal?.throwIfAborted();
    try {
      const result = await client.searchTerms({
        since: input.since,
        until: input.until,
      });
      sawAnything = true;
      truncatedAnywhere = truncatedAnywhere || result.truncated;
      searchTerms.push(
        ...normalizeSearchTerms(result.rows, {
          channelAccountId: input.account.id,
          currency: input.account.currency,
          windowStart: input.since,
          windowEnd: input.until,
          fetchedAt,
        }),
      );
    } catch (error) {
      problems.push(`search terms: ${reasonFrom(error)}`);
    }
  }

  if (!sawAnything) {
    const reason =
      problems[0] ?? "Google returned nothing for this account's window.";
    return {
      accountId: input.account.id,
      metrics: markGoogleAdsWindowUnavailable({
        channelAccountId: input.account.id,
        dates: datesInRange(input.since, input.until),
        reason,
        fetchedAt,
        currency: input.account.currency,
      }),
      searchTerms: [],
      campaigns: [],
      ads: [],
      keywords: [],
      destinations: [],
      coverage: {
        inspectableSpend: null,
        opaqueSpend: null,
        opaqueCampaigns: [],
        currency: input.account.currency,
      },
      issues: [],
      state: "failed",
      reason,
    };
  }

  const issues = auditGoogleAdsAccount({
    account: input.account,
    metrics,
    campaigns,
    ads,
    keywords,
    searchTerms,
  });

  const partial = problems.length > 0 || truncatedAnywhere;
  return {
    accountId: input.account.id,
    metrics,
    searchTerms,
    campaigns,
    ads,
    keywords,
    destinations: buildDestinations(input.account, ads, keywords, metrics),
    coverage: computeCoverage(metrics, campaigns, input.account.currency),
    issues,
    state: partial ? "partial" : "available",
    reason: partial
      ? [
          ...problems,
          ...(truncatedAnywhere
            ? ["The provider result was truncated; totals are a lower bound."]
            : []),
        ]
          .join("; ")
          .slice(0, 400)
      : null,
  };
}
