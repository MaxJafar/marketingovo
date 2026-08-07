// Deterministic ad audit rules for Meta cabinets.
//
// These emit ordinary `Issue` values, so paid findings flow into the same
// prioritized action queue as SEO findings, with the same evidence, the same
// adjudication and the same verification. A marketer has one budget of
// attention, and paid waste should compete for it in one ranked list.
//
// Every rule here follows one discipline: a rule that cannot see its inputs
// declines to fire. Treating a null reading as zero would let "we could not
// read this cabinet" surface as "this campaign spends nothing and converts
// nothing", which is a confident wrong answer about money.

import type { Issue, Priority } from "../../checks/index.js";
import type { MetaDeliveryRecord } from "./client.js";
import type { ChannelMetric } from "../channel-vocabulary.js";

export const META_ADS_MODULE_ID = "integrations:meta-ads";

/** Thresholds, named once so a rule reads as policy rather than magic. */
export const META_AUDIT_THRESHOLDS = {
  /** Average impressions per person before a creative is treated as fatigued. */
  fatigueFrequency: 3.5,
  /** Relative CTR fall between window halves that confirms fatigue. */
  fatigueCtrDrop: 0.25,
  /** Relative rise in cost per conversion that counts as drift. */
  cpaDriftRatio: 0.5,
  /** Conversions needed in each half before drift is worth reporting. */
  cpaMinimumConversions: 10,
  /** Share of an ad set's daily budget below which delivery is under-pacing. */
  underPacingShare: 0.5,
  /** Days of data a windowed rule needs before it will speak. */
  minimumDays: 7,
} as const;

export interface MetaAuditInput {
  /** The cabinet, as the workspace linked it. */
  cabinet: {
    id: string;
    externalId: string;
    displayName: string;
    currency: string | null;
    dailySpendCap: number | null;
  };
  /** Daily metrics for the window, at whatever levels were synced. */
  metrics: readonly ChannelMetric[];
  /** Delivery state for campaigns, ad sets and ads. */
  delivery: readonly MetaDeliveryRecord[];
}

/**
 * A deep link into the operator's own Ads Manager.
 *
 * Issues carry URLs so an action names something a person can open. This one
 * is never fetched by the product — it exists so "fix this ad" is one click
 * from the finding rather than a search through a cabinet.
 */
export function adsManagerUrl(
  accountExternalId: string,
  selection?: { level: "campaign" | "adset" | "ad"; id: string },
): string {
  const account = accountExternalId.replace(/^act_/, "");
  const url = new URL("https://adsmanager.facebook.com/adsmanager/manage/ads");
  url.searchParams.set("act", account);
  if (selection) {
    const key = {
      campaign: "selected_campaign_ids",
      adset: "selected_adset_ids",
      ad: "selected_ad_ids",
    }[selection.level];
    url.searchParams.set(key, selection.id);
  }
  return url.toString();
}

interface EntitySeries {
  entityId: string;
  entityName: string | null;
  /** Date -> value, holding only readings the provider actually reported. */
  byDate: Map<string, number>;
}

/** Groups available readings for one metric. Unavailable rows never enter. */
function seriesFor(
  metrics: readonly ChannelMetric[],
  metricKey: ChannelMetric["metricKey"],
  entityKind: ChannelMetric["entityKind"],
  platform: ChannelMetric["platform"] = "all",
): Map<string, EntitySeries> {
  const series = new Map<string, EntitySeries>();
  for (const metric of metrics) {
    if (
      metric.metricKey !== metricKey ||
      metric.entityKind !== entityKind ||
      metric.platform !== platform ||
      metric.value === null
    ) {
      continue;
    }
    const existing = series.get(metric.entityId) ?? {
      entityId: metric.entityId,
      entityName: metric.entityName,
      byDate: new Map<string, number>(),
    };
    existing.byDate.set(metric.date, metric.value);
    if (!existing.entityName && metric.entityName) {
      existing.entityName = metric.entityName;
    }
    series.set(metric.entityId, existing);
  }
  return series;
}

function total(byDate: Map<string, number>): number {
  let sum = 0;
  for (const value of byDate.values()) sum += value;
  return sum;
}

/** Splits a series by date into an earlier and a later half. */
function halves(byDate: Map<string, number>): {
  earlier: Map<string, number>;
  later: Map<string, number>;
} {
  const dates = [...byDate.keys()].sort();
  const midpoint = Math.floor(dates.length / 2);
  const earlier = new Map<string, number>();
  const later = new Map<string, number>();
  dates.forEach((date, index) => {
    const value = byDate.get(date)!;
    if (index < midpoint) earlier.set(date, value);
    else later.set(date, value);
  });
  return { earlier, later };
}

function money(value: number, currency: string | null): string {
  const rounded = Math.round(value * 100) / 100;
  return currency ? `${rounded} ${currency}` : `${rounded}`;
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
    moduleId: META_ADS_MODULE_ID,
  };
}

/**
 * An ad Meta refused to run.
 *
 * This is the one finding insights alone cannot produce: a disapproved ad
 * simply stops appearing in spend, which reads as a creative that went quiet
 * rather than one the platform rejected.
 */
function disapprovedAds(input: MetaAuditInput): Issue[] {
  const rejected = input.delivery.filter(
    (record) =>
      record.level === "ad" &&
      ["DISAPPROVED", "WITH_ISSUES", "ADSET_PAUSED_DISAPPROVED"].includes(
        record.effectiveStatus,
      ),
  );
  if (rejected.length === 0) return [];
  return rejected.map((record) =>
    issue(
      "meta-ads.ad-disapproved",
      "High",
      `Meta is not running the ad "${record.name}" in ${input.cabinet.displayName} (${record.effectiveStatus})`,
      [adsManagerUrl(input.cabinet.externalId, { level: "ad", id: record.id })],
      {
        cabinet: input.cabinet.displayName,
        adId: record.id,
        adName: record.name,
        effectiveStatus: record.effectiveStatus,
        reviewFeedback: record.reviewFeedback,
      },
      record.reviewFeedback
        ? `Meta's review reported: ${record.reviewFeedback}. Edit the creative or copy to comply, then resubmit for review.`
        : "Open the ad in Ads Manager to read Meta's review reason, correct the creative or copy, then resubmit for review.",
    ),
  );
}

/**
 * Creative fatigue: the same people seeing the same ad until it stops working.
 *
 * Frequency alone is not evidence — a high frequency with a steady CTR is a
 * campaign working as intended on a small audience. The rule requires both a
 * high frequency and a fallen click-through rate, and declines when either
 * reading is missing rather than assuming the missing one is bad.
 */
function creativeFatigue(input: MetaAuditInput): Issue[] {
  const frequency = seriesFor(input.metrics, "frequency", "adset");
  const ctr = seriesFor(input.metrics, "ctr", "adset");
  const spend = seriesFor(input.metrics, "spend", "adset");
  const issues: Issue[] = [];

  for (const [entityId, frequencySeries] of frequency) {
    const ctrSeries = ctr.get(entityId);
    if (
      !ctrSeries ||
      ctrSeries.byDate.size < META_AUDIT_THRESHOLDS.minimumDays
    ) {
      continue;
    }
    const peakFrequency = Math.max(...frequencySeries.byDate.values());
    if (peakFrequency < META_AUDIT_THRESHOLDS.fatigueFrequency) continue;

    const { earlier, later } = halves(ctrSeries.byDate);
    if (earlier.size === 0 || later.size === 0) continue;
    const earlierCtr = total(earlier) / earlier.size;
    const laterCtr = total(later) / later.size;
    if (earlierCtr <= 0) continue;
    const drop = (earlierCtr - laterCtr) / earlierCtr;
    if (drop < META_AUDIT_THRESHOLDS.fatigueCtrDrop) continue;

    const spendSeries = spend.get(entityId);
    const name = frequencySeries.entityName ?? entityId;
    issues.push(
      issue(
        "meta-ads.creative-fatigue",
        "Medium",
        `Creative fatigue in ad set "${name}": frequency reached ${peakFrequency.toFixed(1)} and click-through rate fell ${(drop * 100).toFixed(0)}%`,
        [
          adsManagerUrl(input.cabinet.externalId, {
            level: "adset",
            id: entityId,
          }),
        ],
        {
          cabinet: input.cabinet.displayName,
          adsetId: entityId,
          adsetName: name,
          peakFrequency,
          earlierCtr,
          laterCtr,
          ctrDropShare: drop,
          spendOverWindow: spendSeries ? total(spendSeries.byDate) : null,
          currency: input.cabinet.currency,
          daysObserved: ctrSeries.byDate.size,
        },
        "Refresh the creative, or widen the audience so the same people stop absorbing the whole budget. Compare against a new creative before increasing spend.",
      ),
    );
  }
  return issues;
}

/**
 * Spend with no conversion signal reaching Meta.
 *
 * Deliberately narrow. It fires only when the cabinet spent money and Meta
 * reported no conversion field at all across the window — the signature of a
 * pixel or Conversions API that is not sending events. A cabinet that reports
 * conversions and happens to have zero is a performance question, not a
 * tracking one, and this rule stays quiet about it.
 */
function missingConversionSignal(input: MetaAuditInput): Issue[] {
  const spend = seriesFor(input.metrics, "spend", "account");
  const spendTotal = [...spend.values()].reduce(
    (sum, series) => sum + total(series.byDate),
    0,
  );
  if (spendTotal <= 0) return [];

  const conversionRows = input.metrics.filter(
    (metric) =>
      metric.metricKey === "conversions" && metric.entityKind === "account",
  );
  if (conversionRows.length === 0) return [];
  // A single reported figure — even zero — means the pipe exists.
  if (conversionRows.some((metric) => metric.value !== null)) return [];
  // Everything unreadable is an outage, not a tracking gap.
  if (conversionRows.every((metric) => metric.state === "failed")) return [];

  return [
    issue(
      "meta-ads.no-conversion-signal",
      "High",
      `${input.cabinet.displayName} spent ${money(spendTotal, input.cabinet.currency)} with no conversion events reported by Meta`,
      [adsManagerUrl(input.cabinet.externalId)],
      {
        cabinet: input.cabinet.displayName,
        spendOverWindow: spendTotal,
        currency: input.cabinet.currency,
        daysObserved: conversionRows.length,
      },
      "Verify the Meta pixel or Conversions API is installed and firing purchase or lead events. Until it is, optimization and reported cost per result are both blind.",
    ),
  ];
}

/**
 * Cost per conversion rising sharply within the window.
 *
 * Requires real volume in both halves. A campaign that went from one
 * conversion to two has doubled nothing worth reporting, and a rule that
 * fires on it teaches an operator to ignore the queue.
 */
function cpaDrift(input: MetaAuditInput): Issue[] {
  const spend = seriesFor(input.metrics, "spend", "campaign");
  const conversions = seriesFor(input.metrics, "conversions", "campaign");
  const issues: Issue[] = [];

  for (const [entityId, spendSeries] of spend) {
    const conversionSeries = conversions.get(entityId);
    if (!conversionSeries) continue;
    if (spendSeries.byDate.size < META_AUDIT_THRESHOLDS.minimumDays) continue;

    const spendHalves = halves(spendSeries.byDate);
    const conversionHalves = halves(conversionSeries.byDate);
    const earlierConversions = total(conversionHalves.earlier);
    const laterConversions = total(conversionHalves.later);
    if (
      earlierConversions < META_AUDIT_THRESHOLDS.cpaMinimumConversions ||
      laterConversions < META_AUDIT_THRESHOLDS.cpaMinimumConversions
    ) {
      continue;
    }
    const earlierCpa = total(spendHalves.earlier) / earlierConversions;
    const laterCpa = total(spendHalves.later) / laterConversions;
    if (earlierCpa <= 0) continue;
    const rise = (laterCpa - earlierCpa) / earlierCpa;
    if (rise < META_AUDIT_THRESHOLDS.cpaDriftRatio) continue;

    const name = spendSeries.entityName ?? entityId;
    issues.push(
      issue(
        "meta-ads.cpa-drift",
        "High",
        `Cost per conversion in campaign "${name}" rose ${(rise * 100).toFixed(0)}%, from ${money(earlierCpa, input.cabinet.currency)} to ${money(laterCpa, input.cabinet.currency)}`,
        [
          adsManagerUrl(input.cabinet.externalId, {
            level: "campaign",
            id: entityId,
          }),
        ],
        {
          cabinet: input.cabinet.displayName,
          campaignId: entityId,
          campaignName: name,
          earlierCostPerConversion: earlierCpa,
          laterCostPerConversion: laterCpa,
          riseShare: rise,
          earlierConversions,
          laterConversions,
          currency: input.cabinet.currency,
        },
        "Compare audience, placement and creative between the two halves of the window before adding budget. A rising cost per conversion at flat spend usually means the reachable audience is exhausted.",
      ),
    );
  }
  return issues;
}

/**
 * An ad set delivering far below the budget it was given.
 *
 * Under-pacing is money the operator intended to spend and did not, which is
 * as much a waste of a campaign window as overspending is of a budget.
 */
function budgetUnderPacing(input: MetaAuditInput): Issue[] {
  const spend = seriesFor(input.metrics, "spend", "adset");
  const issues: Issue[] = [];

  for (const record of input.delivery) {
    if (record.level !== "adset" || record.dailyBudget === null) continue;
    if (record.effectiveStatus !== "ACTIVE") continue;
    const series = spend.get(record.id);
    if (!series || series.byDate.size < META_AUDIT_THRESHOLDS.minimumDays) {
      continue;
    }
    const averageDailySpend = total(series.byDate) / series.byDate.size;
    const share = averageDailySpend / record.dailyBudget;
    if (share >= META_AUDIT_THRESHOLDS.underPacingShare) continue;

    issues.push(
      issue(
        "meta-ads.budget-under-pacing",
        "Medium",
        `Ad set "${record.name}" delivered ${(share * 100).toFixed(0)}% of its ${money(record.dailyBudget, input.cabinet.currency)} daily budget`,
        [
          adsManagerUrl(input.cabinet.externalId, {
            level: "adset",
            id: record.id,
          }),
        ],
        {
          cabinet: input.cabinet.displayName,
          adsetId: record.id,
          adsetName: record.name,
          dailyBudget: record.dailyBudget,
          averageDailySpend,
          deliveryShare: share,
          daysObserved: series.byDate.size,
          currency: input.cabinet.currency,
        },
        "A narrow audience, a low bid cap or a small creative pool usually causes this. Widen one of the three, or move the budget to an ad set that can spend it.",
      ),
    );
  }
  return issues;
}

/**
 * The workspace's own daily spend bound, breached at the provider.
 *
 * The cap is locally authored and independent of any provider-side limit; this
 * rule is what makes it more than a note in a form.
 */
function localSpendCapBreached(input: MetaAuditInput): Issue[] {
  const cap = input.cabinet.dailySpendCap;
  if (cap === null || cap <= 0) return [];
  const spend = seriesFor(input.metrics, "spend", "account");
  const breaches: Array<{ date: string; value: number }> = [];
  for (const series of spend.values()) {
    for (const [date, value] of series.byDate) {
      if (value > cap) breaches.push({ date, value });
    }
  }
  if (breaches.length === 0) return [];
  breaches.sort((left, right) => right.value - left.value);
  const worst = breaches[0]!;

  return [
    issue(
      "meta-ads.local-spend-cap-breached",
      "High",
      `${input.cabinet.displayName} spent ${money(worst.value, input.cabinet.currency)} on ${worst.date}, above the ${money(cap, input.cabinet.currency)} daily cap set for this cabinet`,
      [adsManagerUrl(input.cabinet.externalId)],
      {
        cabinet: input.cabinet.displayName,
        dailySpendCap: cap,
        worstDay: worst.date,
        worstDaySpend: worst.value,
        breachDays: breaches.length,
        currency: input.cabinet.currency,
      },
      "Lower the campaign budgets, or raise the cabinet's daily cap if the higher spend was intended. The cap is a local bound and does not stop delivery on its own.",
    ),
  ];
}

/**
 * Runs every rule over one cabinet.
 *
 * Rules are independent by design: one that cannot see its inputs stays quiet
 * without suppressing the others, so a partial sync still produces the
 * findings it does have evidence for.
 */
export function auditMetaCabinet(input: MetaAuditInput): Issue[] {
  return [
    ...disapprovedAds(input),
    ...missingConversionSignal(input),
    ...cpaDrift(input),
    ...creativeFatigue(input),
    ...budgetUnderPacing(input),
    ...localSpendCapBreached(input),
  ];
}
