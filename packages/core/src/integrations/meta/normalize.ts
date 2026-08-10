// Meta insight rows -> channel metrics.
//
// Pure and side-effect free, so the interesting question — "what does this
// product claim it measured" — is answerable from a unit test rather than from
// a live ad account.
//
// The rule this file exists to enforce: a metric Meta did not report becomes a
// row with a null value and a state that says why, never a zero. On paid
// spend that distinction is the difference between "this campaign is dormant"
// and "we could not see this campaign", and those call for opposite actions.

import type { MetaInsightLevel, MetaInsightRow } from "./client.js";
import type {
  AdPlatform,
  ChannelEntityKind,
  ChannelMetric,
  ChannelMetricKey,
  ChannelMetricState,
} from "../channel-vocabulary.js";

export const META_SOURCE = "meta-ads";

/**
 * Meta's `publisher_platform` values, mapped onto the product's vocabulary.
 *
 * An unrecognized value becomes `unknown` rather than being folded into `all`.
 * `all` is a specific claim — "this row was not broken out by platform" — and
 * quietly filing a new Meta surface under it would make an account total look
 * like it had been attributed when it had not.
 */
export function toAdPlatform(value: string | null | undefined): AdPlatform {
  if (value === null || value === undefined) return "all";
  switch (value.toLowerCase()) {
    case "facebook":
      return "facebook";
    case "instagram":
      return "instagram";
    case "messenger":
      return "messenger";
    case "audience_network":
      return "audience_network";
    default:
      return "unknown";
  }
}

export function toEntityKind(level: MetaInsightLevel): ChannelEntityKind {
  return level === "account" ? "account" : level;
}

interface MetricSource {
  key: ChannelMetricKey;
  read: (row: MetaInsightRow) => number | null;
  /** True when the figure is denominated in the cabinet's currency. */
  monetary: boolean;
  /**
   * Why a null reading is missing. Meta omits a field it has no data for
   * rather than sending a zero, and each omission has a different meaning.
   */
  absentNote: string;
}

const METRIC_SOURCES: readonly MetricSource[] = [
  {
    key: "impressions",
    read: (row) => row.impressions,
    monetary: false,
    absentNote: "Meta reported no impressions field for this row.",
  },
  {
    key: "clicks",
    read: (row) => row.clicks,
    monetary: false,
    absentNote: "Meta reported no clicks field for this row.",
  },
  {
    key: "link_clicks",
    read: (row) => row.linkClicks,
    monetary: false,
    absentNote:
      "Meta reported no link clicks; objectives without a link destination do not produce this field.",
  },
  {
    key: "spend",
    read: (row) => row.spend,
    monetary: true,
    absentNote: "Meta reported no spend field for this row.",
  },
  {
    key: "reach",
    read: (row) => row.reach,
    monetary: false,
    absentNote:
      "Meta does not report reach for every breakdown; a platform-split row often omits it.",
  },
  {
    key: "frequency",
    read: (row) => row.frequency,
    monetary: false,
    absentNote:
      "Meta reports frequency only where it also reports reach for the same row.",
  },
  {
    key: "ctr",
    read: (row) => row.ctr,
    monetary: false,
    absentNote: "Meta reported no click-through rate for this row.",
  },
  {
    key: "cpc",
    read: (row) => row.cpc,
    monetary: true,
    absentNote:
      "Meta omits cost per click on a row with no clicks; it is undefined rather than zero.",
  },
  {
    key: "cpm",
    read: (row) => row.cpm,
    monetary: true,
    absentNote: "Meta reported no cost per thousand impressions for this row.",
  },
  {
    key: "conversions",
    read: (row) => row.conversions,
    monetary: false,
    absentNote:
      "Meta reported no counted conversion actions. Verify the pixel or Conversions API is sending events.",
  },
  {
    key: "conversion_value",
    read: (row) => row.conversionValue,
    monetary: true,
    absentNote:
      "Meta reported no conversion value. Value-based reporting requires the event to carry a value parameter.",
  },
  {
    key: "video_plays",
    read: (row) => row.videoPlays,
    monetary: false,
    absentNote: "Meta reported no video play actions for this row.",
  },
];

export interface NormalizeMetaInsightsOptions {
  channelAccountId: string;
  level: MetaInsightLevel;
  /** The cabinet's currency. Null when Meta did not report one. */
  currency: string | null;
  fetchedAt: string;
  /**
   * Set when the provider result was cut short. Every row from a truncated
   * read is recorded as `partial`, because a total over a truncated page is a
   * smaller number presented as a complete one.
   */
  truncated?: boolean;
}

export function normalizeMetaInsights(
  rows: readonly MetaInsightRow[],
  options: NormalizeMetaInsightsOptions,
): ChannelMetric[] {
  const entityKind = toEntityKind(options.level);
  const metrics: ChannelMetric[] = [];

  for (const row of rows) {
    // A row without a date cannot be filed against a day, and guessing today
    // would attribute yesterday's spend to the wrong period.
    if (!row.date || !row.entityId) continue;
    const platform = toAdPlatform(row.publisherPlatform);

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
        // `partial` still carries the number Meta gave for this row; what is
        // partial is the set of rows, not this reading. `unavailable` carries
        // nothing, which the storage CHECK constraint also enforces.
        value: available ? raw : null,
        state,
        // A monetary figure without its currency is not actionable, so the
        // currency travels with every row that holds one.
        currency: source.monetary ? options.currency : null,
        source: META_SOURCE,
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

/**
 * Records that a cabinet could not be read at all.
 *
 * Without this, a failed sync leaves the previous window's rows in place and
 * the dashboard shows stale numbers as if they were current. Writing explicit
 * `failed` rows for the requested days makes the outage visible where the
 * numbers would otherwise be.
 */
export function markMetaWindowUnavailable(options: {
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
      source: META_SOURCE,
      fetchedAt: options.fetchedAt,
      note: options.reason.slice(0, 400),
    })),
  );
}

/** Inclusive list of ISO dates, oldest first. Empty when the range inverts. */
export function datesInRange(since: string, until: string): string[] {
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [];
  }
  const days: string[] = [];
  for (
    let cursor = start;
    cursor <= end && days.length < 400;
    cursor += 86_400_000
  ) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}
