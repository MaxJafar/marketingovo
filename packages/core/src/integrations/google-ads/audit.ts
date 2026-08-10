// Deterministic audit rules for Google Ads accounts.
//
// These emit ordinary `Issue` values, so paid findings flow into the same
// prioritized action queue as SEO and Meta findings, with the same evidence
// and the same adjudication. A marketer has one budget of attention.
//
// Every rule follows the discipline the Meta rules established: a rule that
// cannot see its inputs declines to fire. Treating a null reading as zero would
// let "we could not read this account" surface as "this campaign spends nothing
// and converts nothing", which is a confident wrong answer about money.
//
// One rule here breaks the usual shape deliberately. `searchTermBlindSpot`
// fires about the audit's own coverage rather than about the account, because
// an audit that inspects the third of spend it can see and reports a clean
// bill is lying by omission. See ADR 0008.

import type { Issue, Priority } from "../../checks/index.js";
import type {
  GoogleAdsAdRecord,
  GoogleAdsCampaignRecord,
  GoogleAdsKeywordRecord,
} from "./client.js";
import { OPAQUE_CHANNEL_TYPES } from "./normalize.js";
import type { ChannelMetric, SearchTermRecord } from "../channel-vocabulary.js";

export const GOOGLE_ADS_MODULE_ID = "integrations:google-ads";

/** Thresholds, named once so a rule reads as policy rather than magic. */
export const GOOGLE_ADS_AUDIT_THRESHOLDS = {
  /**
   * Clicks a query needs before "it never converted" means anything.
   *
   * Below this, zero conversions is ordinary variance rather than evidence.
   * Ten is deliberately conservative: excluding a query is not free, and a
   * negative added on four clicks is as likely to remove revenue as waste.
   */
  wastedTermMinimumClicks: 10,
  /** Share of account spend in opaque campaign types that is worth naming. */
  opaqueSpendShare: 0.2,
  /** Share of impressions lost to budget that counts as constrained. */
  budgetLostShare: 0.1,
  /** Share of impressions lost to rank that counts as a quality problem. */
  rankLostShare: 0.3,
  /** Quality score at or below which Google is signalling poor relevance. */
  lowQualityScore: 4,
  /** Spend a keyword needs before its quality score is worth acting on. */
  lowQualitySpendFloor: 50,
  /** Relative rise in cost per conversion that counts as drift. */
  cpaDriftRatio: 0.5,
  /** Conversions needed in each half before drift is worth reporting. */
  cpaMinimumConversions: 10,
  /** Days of data a windowed rule needs before it will speak. */
  minimumDays: 7,
} as const;

export interface GoogleAdsAuditInput {
  /** The account, as the workspace linked it. */
  account: {
    id: string;
    externalId: string;
    displayName: string;
    currency: string | null;
    dailySpendCap: number | null;
  };
  /** Daily metrics for the window, at whatever levels were synced. */
  metrics: readonly ChannelMetric[];
  campaigns: readonly GoogleAdsCampaignRecord[];
  ads: readonly GoogleAdsAdRecord[];
  keywords: readonly GoogleAdsKeywordRecord[];
  searchTerms: readonly SearchTermRecord[];
}

/**
 * A deep link into the operator's own Google Ads account.
 *
 * Issues carry URLs so an action names something a person can open. This is
 * never fetched by the product; `ads.google.com` is deliberately absent from
 * the connector's egress allowlist.
 */
export function googleAdsUrl(
  customerId: string,
  selection?: { level: "campaign" | "adgroup" | "keyword"; id: string },
): string {
  const account = customerId.replace(/\D/g, "");
  const url = new URL("https://ads.google.com/aw/overview");
  url.searchParams.set("ocid", account);
  if (selection) {
    const path = {
      campaign: "/aw/campaigns",
      adgroup: "/aw/adgroups",
      keyword: "/aw/keywords",
    }[selection.level];
    url.pathname = path;
    url.searchParams.set(
      selection.level === "campaign" ? "campaignId" : "adGroupId",
      selection.id,
    );
  }
  return url.toString();
}

function money(value: number, currency: string | null): string {
  const rounded = Math.round(value * 100) / 100;
  return currency ? `${rounded} ${currency}` : `${rounded}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function issue(
  id: string,
  priority: Priority,
  message: string,
  urls: string[],
  detail: Record<string, unknown>,
  fix: string,
): Issue {
  return {
    id,
    category: "paid-media",
    priority,
    message,
    urls,
    detail,
    fix,
    moduleId: GOOGLE_ADS_MODULE_ID,
  };
}

/** Sums the available readings for one metric. Unavailable rows never enter. */
function sumMetric(
  metrics: readonly ChannelMetric[],
  metricKey: ChannelMetric["metricKey"],
  entityKind: ChannelMetric["entityKind"],
  entityId?: string,
): number | null {
  let total: number | null = null;
  for (const metric of metrics) {
    if (
      metric.metricKey !== metricKey ||
      metric.entityKind !== entityKind ||
      metric.value === null ||
      (entityId !== undefined && metric.entityId !== entityId)
    ) {
      continue;
    }
    total = (total ?? 0) + metric.value;
  }
  return total;
}

/** Mean of the available readings, which is how a share metric aggregates. */
function meanMetric(
  metrics: readonly ChannelMetric[],
  metricKey: ChannelMetric["metricKey"],
  entityKind: ChannelMetric["entityKind"],
  entityId: string,
): number | null {
  let total = 0;
  let count = 0;
  for (const metric of metrics) {
    if (
      metric.metricKey !== metricKey ||
      metric.entityKind !== entityKind ||
      metric.entityId !== entityId ||
      metric.value === null
    ) {
      continue;
    }
    total += metric.value;
    count += 1;
  }
  return count === 0 ? null : total / count;
}

/**
 * Queries that took money and returned nothing.
 *
 * The single most valuable finding in a Google Ads account, and the one that
 * needs the most care. Zero conversions on four clicks is variance; zero on
 * forty is evidence. Terms Google already reports as excluded are skipped, so
 * the audit does not keep proposing a negative that exists.
 */
function wastedSearchTerms(input: GoogleAdsAuditInput): Issue[] {
  const candidates = input.searchTerms.filter((term) => {
    if (term.status === "excluded" || term.status === "added_excluded") {
      return false;
    }
    // A missing cost or click count is a reading this rule cannot use. It
    // declines rather than assuming the absent figure is favourable.
    if (term.clicks === null || term.cost === null) return false;
    if (term.clicks < GOOGLE_ADS_AUDIT_THRESHOLDS.wastedTermMinimumClicks) {
      return false;
    }
    if (term.cost <= 0) return false;
    // Null conversions means Google did not report the field, which on an
    // account without conversion tracking is every row. That is a different
    // finding, handled by `conversionTrackingMissing`.
    return term.conversions !== null && term.conversions === 0;
  });

  if (candidates.length === 0) return [];

  const byCost = [...candidates].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
  const wasted = byCost.reduce((sum, term) => sum + (term.cost ?? 0), 0);
  const currency = byCost[0]?.currency ?? input.account.currency;

  // One finding for the account rather than one per query. Fifty separate
  // actions saying "add a negative" is a queue nobody works through; one
  // action carrying the list is a task somebody completes.
  return [
    issue(
      "google-ads.wasted-search-terms",
      wasted > 0 ? "High" : "Medium",
      `${candidates.length} search ${candidates.length === 1 ? "term" : "terms"} in ${input.account.displayName} took ${money(wasted, currency)} across the window and converted nothing`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency,
        wastedSpend: wasted,
        termCount: candidates.length,
        minimumClicks: GOOGLE_ADS_AUDIT_THRESHOLDS.wastedTermMinimumClicks,
        // Capped, because an issue payload is read by a person and a thousand
        // rows is not evidence, it is a data dump.
        terms: byCost.slice(0, 50).map((term) => ({
          query: term.query,
          matchedKeyword: term.matchedKeyword,
          matchType: term.matchType,
          campaign: term.campaignName,
          adGroup: term.adGroupName,
          clicks: term.clicks,
          cost: term.cost,
        })),
      },
      "Review these queries and add the irrelevant ones as negative keywords. Where a query is relevant but expensive, the problem is the landing page or the bid rather than the match, and a negative would remove real demand.",
    ),
  ];
}

/**
 * Queries wasting money in more than one campaign.
 *
 * A negative added at ad-group level fixes one place; the same query costing
 * money across three campaigns is a shared negative list, which is a different
 * and more durable action.
 */
function crossCampaignWaste(input: GoogleAdsAuditInput): Issue[] {
  const byQuery = new Map<
    string,
    { campaigns: Set<string>; cost: number; clicks: number }
  >();
  for (const term of input.searchTerms) {
    if (term.status === "excluded" || term.status === "added_excluded")
      continue;
    if (term.clicks === null || term.cost === null) continue;
    if (term.conversions === null || term.conversions > 0) continue;
    const existing = byQuery.get(term.query) ?? {
      campaigns: new Set<string>(),
      cost: 0,
      clicks: 0,
    };
    existing.campaigns.add(term.campaignName ?? term.campaignId);
    existing.cost += term.cost;
    existing.clicks += term.clicks;
    byQuery.set(term.query, existing);
  }

  const shared = [...byQuery.entries()]
    .filter(
      ([, value]) =>
        value.campaigns.size > 1 &&
        value.clicks >= GOOGLE_ADS_AUDIT_THRESHOLDS.wastedTermMinimumClicks,
    )
    .sort((a, b) => b[1].cost - a[1].cost);

  if (shared.length === 0) return [];
  const total = shared.reduce((sum, [, value]) => sum + value.cost, 0);

  return [
    issue(
      "google-ads.cross-campaign-waste",
      "Medium",
      `${shared.length} non-converting ${shared.length === 1 ? "query costs" : "queries cost"} money in more than one campaign, totalling ${money(total, input.account.currency)}`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency: input.account.currency,
        totalCost: total,
        queries: shared.slice(0, 40).map(([query, value]) => ({
          query,
          campaigns: [...value.campaigns],
          clicks: value.clicks,
          cost: value.cost,
        })),
      },
      "Add these to a shared negative keyword list applied across the account, rather than negating them campaign by campaign. A shared list also catches the next campaign before it repeats the same spend.",
    ),
  ];
}

/**
 * How much of the account the search term analysis cannot see.
 *
 * Performance Max and Demand Gen report no queries at all. On accounts where
 * they hold most of the spend, a clean search term audit means very little,
 * and saying so is the difference between a report and a reassurance.
 */
function searchTermBlindSpot(input: GoogleAdsAuditInput): Issue[] {
  const opaqueCampaigns = input.campaigns.filter((campaign) =>
    OPAQUE_CHANNEL_TYPES.has(campaign.channelType.toUpperCase()),
  );
  if (opaqueCampaigns.length === 0) return [];

  const opaqueIds = new Set(opaqueCampaigns.map((campaign) => campaign.id));
  let opaqueSpend: number | null = null;
  let totalSpend: number | null = null;
  for (const metric of input.metrics) {
    if (metric.metricKey !== "spend" || metric.value === null) continue;
    if (metric.entityKind === "campaign") {
      totalSpend = (totalSpend ?? 0) + metric.value;
      if (opaqueIds.has(metric.entityId)) {
        opaqueSpend = (opaqueSpend ?? 0) + metric.value;
      }
    }
  }

  // Without campaign-level spend the share cannot be computed, and a finding
  // that says "some unknown share" is not worth an operator's attention.
  if (opaqueSpend === null || totalSpend === null || totalSpend <= 0) return [];
  const share = opaqueSpend / totalSpend;
  if (share < GOOGLE_ADS_AUDIT_THRESHOLDS.opaqueSpendShare) return [];

  return [
    issue(
      "google-ads.search-term-blind-spot",
      "Medium",
      `${percent(share)} of spend in ${input.account.displayName} is in campaign types that report no search terms, so the wasted-query analysis does not cover it`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency: input.account.currency,
        opaqueSpend,
        totalSpend,
        opaqueShare: share,
        campaigns: opaqueCampaigns.slice(0, 40).map((campaign) => ({
          name: campaign.name,
          type: campaign.channelType,
        })),
      },
      "This is a limit of what Google exposes, not something to fix in the account. Read the search term findings as covering the rest of the spend only. Where Performance Max is a large share, account-level negative keyword lists and brand exclusions are the controls that still apply to it.",
    ),
  ];
}

/**
 * Spend with no conversions recorded anywhere.
 *
 * Almost always broken tracking rather than an account that genuinely sells
 * nothing, and it invalidates every other conclusion — including this audit's
 * own wasted-query rule, which is why it is High.
 */
function conversionTrackingMissing(input: GoogleAdsAuditInput): Issue[] {
  const spend = sumMetric(input.metrics, "spend", "account");
  if (spend === null || spend <= 0) return [];

  const conversions = sumMetric(input.metrics, "conversions", "account");
  // Null means Google never reported the field, which is what an account with
  // no conversion action configured looks like. Zero means it reported the
  // field and it was zero — a real, if bleak, measurement.
  const neverReported = conversions === null;
  if (!neverReported && conversions > 0) return [];

  return [
    issue(
      "google-ads.conversion-tracking-missing",
      "High",
      neverReported
        ? `${input.account.displayName} spent ${money(spend, input.account.currency)} and Google reported no conversion figures at all`
        : `${input.account.displayName} spent ${money(spend, input.account.currency)} and recorded zero conversions`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency: input.account.currency,
        spend,
        conversions,
        conversionFieldReported: !neverReported,
      },
      neverReported
        ? "No conversion action is reporting into this account, so nothing here can be judged on return — including the wasted-query findings, which need conversions to tell waste from working spend. Configure a conversion action before acting on the rest of this audit."
        : "Check that the conversion action is still firing and still within its counting window. A tag that broke reads exactly like a campaign that stopped working, and only one of those is fixed in the account.",
    ),
  ];
}

/**
 * Campaigns Google is holding back for want of budget.
 *
 * Only worth raising where the campaign is converting: a campaign losing
 * impressions to budget while returning nothing is not under-funded, it is
 * being correctly limited.
 */
function budgetConstrained(input: GoogleAdsAuditInput): Issue[] {
  const issues: Issue[] = [];
  for (const campaign of input.campaigns) {
    if (campaign.status !== "ENABLED") continue;
    const lost = meanMetric(
      input.metrics,
      "search_budget_lost_impression_share",
      "campaign",
      campaign.id,
    );
    if (lost === null || lost < GOOGLE_ADS_AUDIT_THRESHOLDS.budgetLostShare) {
      continue;
    }
    const conversions = sumMetric(
      input.metrics,
      "conversions",
      "campaign",
      campaign.id,
    );
    if (conversions === null || conversions <= 0) continue;
    const spend = sumMetric(input.metrics, "spend", "campaign", campaign.id);

    issues.push(
      issue(
        "google-ads.budget-constrained",
        "Medium",
        `"${campaign.name}" is converting and losing ${percent(lost)} of available impressions to its budget`,
        [
          googleAdsUrl(input.account.externalId, {
            level: "campaign",
            id: campaign.id,
          }),
        ],
        {
          account: input.account.displayName,
          campaignId: campaign.id,
          campaignName: campaign.name,
          budgetLostImpressionShare: lost,
          conversions,
          spend,
          dailyBudget: campaign.budgetAmount,
          currency: input.account.currency,
          costPerConversion:
            spend !== null && conversions > 0 ? spend / conversions : null,
        },
        "Demand exists that this campaign is not buying. Raise the budget while the cost per conversion stays acceptable, and check the change against the following window rather than assuming the extra volume converts at the same rate.",
      ),
    );
  }
  return issues;
}

/**
 * Ads not showing because Google ranks them poorly.
 *
 * The opposite remedy to a budget problem, which is why the two are separate
 * rules: more money does not fix rank, and Google reports the split precisely
 * so an advertiser can tell them apart.
 */
function rankConstrained(input: GoogleAdsAuditInput): Issue[] {
  const issues: Issue[] = [];
  for (const campaign of input.campaigns) {
    if (campaign.status !== "ENABLED") continue;
    const lost = meanMetric(
      input.metrics,
      "search_rank_lost_impression_share",
      "campaign",
      campaign.id,
    );
    if (lost === null || lost < GOOGLE_ADS_AUDIT_THRESHOLDS.rankLostShare) {
      continue;
    }
    issues.push(
      issue(
        "google-ads.rank-constrained",
        "Medium",
        `"${campaign.name}" loses ${percent(lost)} of available impressions to ad rank rather than to budget`,
        [
          googleAdsUrl(input.account.externalId, {
            level: "campaign",
            id: campaign.id,
          }),
        ],
        {
          account: input.account.displayName,
          campaignId: campaign.id,
          campaignName: campaign.name,
          rankLostImpressionShare: lost,
          biddingStrategy: campaign.biddingStrategyType,
        },
        "Raising the budget will not help here — Google is choosing not to show these ads. Improve expected click-through rate and landing page relevance, or raise bids. Ad rank responds to relevance more cheaply than to money.",
      ),
    );
  }
  return issues;
}

/**
 * Broad match without a bidding strategy that can steer it.
 *
 * Broad match hands query selection to Google and only works when Google is
 * also choosing bids against a conversion signal. Paired with manual CPC it
 * spends against queries nobody chose, at bids nobody adjusted.
 */
function broadMatchWithoutSmartBidding(input: GoogleAdsAuditInput): Issue[] {
  const manualStrategies = new Set([
    "MANUAL_CPC",
    "MANUAL_CPM",
    "MANUAL_CPV",
    "TARGET_SPEND",
  ]);
  const manualCampaigns = new Map(
    input.campaigns
      .filter(
        (campaign) =>
          campaign.status === "ENABLED" &&
          campaign.biddingStrategyType !== null &&
          manualStrategies.has(campaign.biddingStrategyType),
      )
      .map((campaign) => [campaign.id, campaign]),
  );
  if (manualCampaigns.size === 0) return [];

  const affected = new Map<
    string,
    { name: string; keywords: number; cost: number }
  >();
  for (const keyword of input.keywords) {
    if (keyword.matchType.toUpperCase() !== "BROAD") continue;
    if (keyword.status === "PAUSED" || keyword.status === "REMOVED") continue;
    const campaign = manualCampaigns.get(keyword.campaignId);
    if (!campaign) continue;
    const existing = affected.get(campaign.id) ?? {
      name: campaign.name,
      keywords: 0,
      cost: 0,
    };
    existing.keywords += 1;
    existing.cost += keyword.cost ?? 0;
    affected.set(campaign.id, existing);
  }
  if (affected.size === 0) return [];

  return [...affected.entries()].map(([campaignId, value]) =>
    issue(
      "google-ads.broad-match-without-smart-bidding",
      "Medium",
      `"${value.name}" runs ${value.keywords} broad match ${value.keywords === 1 ? "keyword" : "keywords"} on manual bidding, which spent ${money(value.cost, input.account.currency)}`,
      [
        googleAdsUrl(input.account.externalId, {
          level: "campaign",
          id: campaignId,
        }),
      ],
      {
        account: input.account.displayName,
        campaignId,
        campaignName: value.name,
        broadMatchKeywords: value.keywords,
        cost: value.cost,
        currency: input.account.currency,
      },
      "Broad match delegates query selection to Google, and it only pays off when Google is also choosing bids against a conversion signal. Either move this campaign to a conversion-based bidding strategy, or tighten the keywords to phrase and exact match.",
    ),
  );
}

/** Ads Google refuses to run. */
function disapprovedAds(input: GoogleAdsAuditInput): Issue[] {
  const rejected = input.ads.filter(
    (ad) =>
      ad.approvalStatus === "DISAPPROVED" ||
      ad.approvalStatus === "AREA_OF_INTEREST_ONLY",
  );
  if (rejected.length === 0) return [];

  return [
    issue(
      "google-ads.ad-disapproved",
      "High",
      `Google is not running ${rejected.length} ${rejected.length === 1 ? "ad" : "ads"} in ${input.account.displayName}`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        ads: rejected.slice(0, 40).map((ad) => ({
          adId: ad.id,
          adGroup: ad.adGroupName,
          approvalStatus: ad.approvalStatus,
          policyTopics: ad.policyTopics,
        })),
        // Named rather than counted, because the remedy differs entirely
        // between a trademark objection and a broken destination.
        policyTopics: [
          ...new Set(rejected.flatMap((ad) => ad.policyTopics)),
        ].slice(0, 20),
      },
      "Open each ad to read Google's policy reason, correct the copy or the destination, and resubmit. A disapproved ad stops appearing in spend, which reads as a creative that went quiet rather than one the platform rejected.",
    ),
  ];
}

/**
 * Keywords Google judges irrelevant, weighted by what they cost.
 *
 * Quality score alone is noise — a low score on a keyword that spent nothing
 * is not worth an operator's afternoon. The spend floor is what turns it into
 * a finding.
 */
function lowQualityKeywords(input: GoogleAdsAuditInput): Issue[] {
  const poor = input.keywords.filter(
    (keyword) =>
      keyword.qualityScore !== null &&
      keyword.qualityScore <= GOOGLE_ADS_AUDIT_THRESHOLDS.lowQualityScore &&
      (keyword.cost ?? 0) >= GOOGLE_ADS_AUDIT_THRESHOLDS.lowQualitySpendFloor,
  );
  if (poor.length === 0) return [];
  const cost = poor.reduce((sum, keyword) => sum + (keyword.cost ?? 0), 0);

  return [
    issue(
      "google-ads.low-quality-keywords",
      "Medium",
      `${poor.length} ${poor.length === 1 ? "keyword" : "keywords"} with a quality score of ${GOOGLE_ADS_AUDIT_THRESHOLDS.lowQualityScore} or below spent ${money(cost, input.account.currency)}`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency: input.account.currency,
        totalCost: cost,
        keywords: poor
          .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
          .slice(0, 40)
          .map((keyword) => ({
            text: keyword.text,
            matchType: keyword.matchType,
            qualityScore: keyword.qualityScore,
            adGroup: keyword.adGroupName,
            campaign: keyword.campaignName,
            cost: keyword.cost,
            clicks: keyword.clicks,
            conversions: keyword.conversions,
          })),
      },
      "A low quality score raises what every click costs. The usual cause is an ad group holding keywords that need different ad copy: split them so the ad and the landing page answer the query directly.",
    ),
  ];
}

/**
 * The same keyword bid on from more than one ad group.
 *
 * Google serves only one, so the duplicates fragment the performance history
 * that its bidding needs while making the account harder to reason about.
 */
function duplicateKeywords(input: GoogleAdsAuditInput): Issue[] {
  const byText = new Map<
    string,
    { text: string; adGroups: Set<string>; cost: number; matchType: string }
  >();
  for (const keyword of input.keywords) {
    if (keyword.status === "REMOVED" || keyword.status === "PAUSED") continue;
    // Same text under different match types is a deliberate structure, not a
    // duplicate, so the key includes the match type.
    const key = `${keyword.text.toLowerCase()}${keyword.matchType}`;
    const existing = byText.get(key) ?? {
      text: keyword.text,
      adGroups: new Set<string>(),
      cost: 0,
      matchType: keyword.matchType,
    };
    existing.adGroups.add(keyword.adGroupName ?? keyword.adGroupId);
    existing.cost += keyword.cost ?? 0;
    byText.set(key, existing);
  }

  const duplicated = [...byText.entries()]
    .filter(([, value]) => value.adGroups.size > 1)
    .sort((a, b) => b[1].cost - a[1].cost);
  if (duplicated.length === 0) return [];

  return [
    issue(
      "google-ads.duplicate-keywords",
      "Low",
      `${duplicated.length} ${duplicated.length === 1 ? "keyword appears" : "keywords appear"} in more than one ad group in ${input.account.displayName}`,
      [googleAdsUrl(input.account.externalId)],
      {
        account: input.account.displayName,
        currency: input.account.currency,
        keywords: duplicated.slice(0, 40).map(([, value]) => ({
          text: value.text,
          matchType: value.matchType,
          adGroups: [...value.adGroups],
          cost: value.cost,
        })),
      },
      "Google runs only one of these in any auction, so the duplicates add no reach and split the performance history its bidding relies on. Keep the one in the best-matched ad group and remove the rest.",
    ),
  ];
}

/**
 * Runs every rule.
 *
 * Ordering is by rule, not by severity — the caller ranks findings alongside
 * everything else in the action queue.
 */
export function auditGoogleAdsAccount(input: GoogleAdsAuditInput): Issue[] {
  return [
    ...conversionTrackingMissing(input),
    ...disapprovedAds(input),
    ...wastedSearchTerms(input),
    ...crossCampaignWaste(input),
    ...searchTermBlindSpot(input),
    ...budgetConstrained(input),
    ...rankConstrained(input),
    ...broadMatchWithoutSmartBidding(input),
    ...lowQualityKeywords(input),
    ...duplicateKeywords(input),
  ];
}
