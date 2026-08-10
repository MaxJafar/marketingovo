import { createHash } from "node:crypto";
import type {
  ChannelAccount,
  ChannelMetric,
  ChannelMetricKey,
  ChannelMetricState,
  ChannelMetricSummary,
  AdPlatform,
  SearchTermCoverage,
  SearchTermRecord,
} from "@marketingovo/contracts/channels";
import type {
  ChannelMetric as EngineChannelMetric,
  SearchTermCoverage as EngineSearchTermCoverage,
  SearchTermRecord as EngineSearchTermRecord,
} from "@marketingovo/core";

/**
 * The engine and the API describe a channel metric separately: core is the
 * layer below the contracts package and does not depend on it. These
 * assignments are the check that the two never drift — if a field is added,
 * renamed or retyped on either side, this file stops compiling instead of
 * silently dropping data as it crosses the boundary.
 */
const _engineMetricMatchesContract: ChannelMetric =
  null as never as EngineChannelMetric;
const _engineSearchTermMatchesContract: SearchTermRecord =
  null as never as EngineSearchTermRecord;
const _engineCoverageMatchesContract: SearchTermCoverage =
  null as never as EngineSearchTermCoverage;
void _engineMetricMatchesContract;
void _engineSearchTermMatchesContract;
void _engineCoverageMatchesContract;

export type ChannelErrorCode =
  | "cabinet_not_found"
  | "cabinet_provider_unsupported"
  | "credential_missing"
  | "spend_cap_exceeded"
  | "intent_not_staged"
  | "intent_payload_changed"
  | "approval_requires_operator"
  | "deliverable_not_found"
  | "brief_not_found"
  | "currency_mismatch";

export class ChannelError extends Error {
  readonly code: ChannelErrorCode;
  readonly status: number;

  constructor(code: ChannelErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ChannelError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Metrics that can be added across days and across sibling entities.
 *
 * Everything absent from this set is either derived from these (a rate) or
 * genuinely not additive (reach counts people, and the same person seen on two
 * days is one person). Summing a non-additive metric is the most common way a
 * paid dashboard produces a confident wrong number, so the code refuses rather
 * than allowing it behind a rounding caveat.
 */
const ADDITIVE_METRICS: ReadonlySet<ChannelMetricKey> = new Set([
  "impressions",
  "clicks",
  "link_clicks",
  "spend",
  "conversions",
  "conversion_value",
  "engagements",
  "video_plays",
]);

/**
 * Rates and costs, recomputed from their components rather than averaged.
 *
 * Averaging a daily CTR treats a day with ten impressions as equal to a day
 * with a million. Recomputing from summed clicks and impressions is the only
 * form of this number that means what its name says.
 */
const DERIVED_METRICS: Readonly<
  Record<
    string,
    {
      numerator: ChannelMetricKey;
      denominator: ChannelMetricKey;
      scale: number;
      monetary: boolean;
    }
  >
> = {
  ctr: {
    numerator: "clicks",
    denominator: "impressions",
    scale: 100,
    monetary: false,
  },
  cpc: {
    numerator: "spend",
    denominator: "clicks",
    scale: 1,
    monetary: true,
  },
  cpm: {
    numerator: "spend",
    denominator: "impressions",
    scale: 1_000,
    monetary: true,
  },
  cost_per_conversion: {
    numerator: "spend",
    denominator: "conversions",
    scale: 1,
    monetary: true,
  },
};

/**
 * Metrics that exist per row but cannot be totalled over a window.
 *
 * These are reported as unavailable with the reason stated, which is a more
 * useful answer than a number nobody can act on.
 */
const NON_SUMMABLE: Readonly<Record<string, string>> = {
  reach:
    "Reach counts unique people. Adding it across days or campaigns would count the same person more than once, so no window total is reported.",
  frequency:
    "Frequency is impressions divided by reach, and reach has no honest window total, so neither does frequency.",
};

const MONETARY_METRICS: ReadonlySet<string> = new Set([
  "spend",
  "conversion_value",
  "cpc",
  "cpm",
  "cost_per_conversion",
]);

interface Accumulator {
  sum: number;
  availableDates: Set<string>;
  partialDates: Set<string>;
  failedDates: Set<string>;
  unavailableDates: Set<string>;
  currencies: Set<string>;
  notes: Set<string>;
}

function emptyAccumulator(): Accumulator {
  return {
    sum: 0,
    availableDates: new Set(),
    partialDates: new Set(),
    failedDates: new Set(),
    unavailableDates: new Set(),
    currencies: new Set(),
    notes: new Set(),
  };
}

function accumulate(target: Accumulator, metric: ChannelMetric): void {
  if (metric.currency) target.currencies.add(metric.currency);
  if (metric.note) target.notes.add(metric.note);
  switch (metric.state) {
    case "available":
      target.sum += metric.value ?? 0;
      target.availableDates.add(metric.date);
      break;
    case "partial":
      target.sum += metric.value ?? 0;
      target.partialDates.add(metric.date);
      break;
    case "failed":
      target.failedDates.add(metric.date);
      break;
    case "unavailable":
      target.unavailableDates.add(metric.date);
      break;
  }
}

function stateFor(
  accumulator: Accumulator,
  requestedDays: number,
): ChannelMetricState {
  const observed =
    accumulator.availableDates.size + accumulator.partialDates.size;
  if (observed === 0) {
    return accumulator.failedDates.size > 0 ? "failed" : "unavailable";
  }
  if (
    accumulator.partialDates.size > 0 ||
    accumulator.failedDates.size > 0 ||
    observed < requestedDays
  ) {
    return "partial";
  }
  return "available";
}

/**
 * Resolves the currency for a total.
 *
 * `null` here means the rows disagreed, and the caller must render that as
 * "not comparable" rather than picking one. Adding 100 EUR to 100 USD without
 * a recorded rate produces a number that looks like money and is not.
 */
function currencyFor(accumulator: Accumulator): {
  currency: string | null;
  mismatch: boolean;
} {
  if (accumulator.currencies.size === 1) {
    return { currency: [...accumulator.currencies][0]!, mismatch: false };
  }
  return { currency: null, mismatch: accumulator.currencies.size > 1 };
}

export interface SummarizeChannelMetricsOptions {
  /** How many days the caller asked for, used to detect a short window. */
  requestedDays: number;
  /** Which level to total. Campaign rows carry the platform breakdown. */
  entityKind?: ChannelMetric["entityKind"];
}

/**
 * Totals a window into one summary per (metric, platform).
 *
 * The rules this encodes are the interesting part: additive metrics are
 * summed, rates are recomputed from their summed components, and metrics that
 * cannot be honestly totalled decline with a stated reason instead of
 * producing an average nobody should act on.
 */
export function summarizeChannelMetrics(
  metrics: readonly ChannelMetric[],
  options: SummarizeChannelMetricsOptions,
): ChannelMetricSummary[] {
  const requestedDays = Math.max(1, options.requestedDays);
  const entityKind = options.entityKind ?? "account";
  const buckets = new Map<string, Accumulator>();
  const platforms = new Set<AdPlatform>();

  for (const metric of metrics) {
    if (metric.entityKind !== entityKind) continue;
    platforms.add(metric.platform);
    const key = `${metric.platform}${metric.metricKey}`;
    const accumulator = buckets.get(key) ?? emptyAccumulator();
    accumulate(accumulator, metric);
    buckets.set(key, accumulator);
  }

  const summaries: ChannelMetricSummary[] = [];

  for (const platform of [...platforms].sort()) {
    const read = (key: ChannelMetricKey): Accumulator | undefined =>
      buckets.get(`${platform}${key}`);

    for (const [key, accumulator] of buckets) {
      const [bucketPlatform, metricKey] = key.split("") as [
        AdPlatform,
        ChannelMetricKey,
      ];
      if (bucketPlatform !== platform) continue;
      if (!ADDITIVE_METRICS.has(metricKey)) continue;
      const { currency, mismatch } = currencyFor(accumulator);
      const state = stateFor(accumulator, requestedDays);
      const monetary = MONETARY_METRICS.has(metricKey);
      summaries.push({
        metricKey,
        platform,
        value:
          state === "unavailable" || state === "failed"
            ? null
            : accumulator.sum,
        state,
        currency: monetary ? currency : null,
        observedDays:
          accumulator.availableDates.size + accumulator.partialDates.size,
        requestedDays,
        note:
          monetary && mismatch
            ? "The rows in this window did not agree on one currency, so the total is not comparable."
            : state === "partial"
              ? `${accumulator.failedDates.size} day(s) failed and ${accumulator.unavailableDates.size} reported nothing.`
              : null,
      });
    }

    for (const [metricKey, recipe] of Object.entries(DERIVED_METRICS)) {
      const numerator = read(recipe.numerator);
      const denominator = read(recipe.denominator);
      const numeratorState = numerator
        ? stateFor(numerator, requestedDays)
        : "unavailable";
      const denominatorState = denominator
        ? stateFor(denominator, requestedDays)
        : "unavailable";
      const usable =
        numerator !== undefined &&
        denominator !== undefined &&
        numeratorState !== "unavailable" &&
        numeratorState !== "failed" &&
        denominatorState !== "unavailable" &&
        denominatorState !== "failed" &&
        denominator.sum > 0;
      const { currency, mismatch } = numerator
        ? currencyFor(numerator)
        : { currency: null, mismatch: false };
      const state: ChannelMetricState = usable
        ? numeratorState === "available" && denominatorState === "available"
          ? "available"
          : "partial"
        : denominatorState === "failed" || numeratorState === "failed"
          ? "failed"
          : "unavailable";
      summaries.push({
        metricKey: metricKey as ChannelMetricKey,
        platform,
        value: usable ? (numerator.sum / denominator.sum) * recipe.scale : null,
        state,
        currency: recipe.monetary && !mismatch ? currency : null,
        observedDays: numerator
          ? numerator.availableDates.size + numerator.partialDates.size
          : 0,
        requestedDays,
        note: usable
          ? null
          : denominator === undefined || denominator.sum <= 0
            ? `Undefined without ${recipe.denominator.replaceAll("_", " ")}; it is not zero.`
            : `Requires ${recipe.numerator.replaceAll("_", " ")} and ${recipe.denominator.replaceAll("_", " ")}, and at least one was not reported.`,
      });
    }

    for (const [metricKey, reason] of Object.entries(NON_SUMMABLE)) {
      const accumulator = read(metricKey as ChannelMetricKey);
      if (!accumulator) continue;
      summaries.push({
        metricKey: metricKey as ChannelMetricKey,
        platform,
        value: null,
        state: "unavailable",
        currency: null,
        observedDays:
          accumulator.availableDates.size + accumulator.partialDates.size,
        requestedDays,
        note: reason,
      });
    }
  }

  return summaries.sort(
    (left, right) =>
      left.platform.localeCompare(right.platform) ||
      left.metricKey.localeCompare(right.metricKey),
  );
}

/** Deterministic JSON so one payload always hashes to one value. */
function stablePayload(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stablePayload(entry)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stablePayload(entry)}`);
  return `{${entries.join(",")}}`;
}

/**
 * The hash an approval binds to.
 *
 * Key order and whitespace must not change it, or an intent would appear to
 * have been edited every time it was re-serialized and every approval would be
 * void for no reason.
 */
export function publishPayloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stablePayload(payload)).digest("hex");
}

export interface SpendCapCheckInput {
  cabinet: Pick<
    ChannelAccount,
    "displayName" | "currency" | "dailySpendCap" | "totalSpendCap"
  >;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  /** The intent's own currency, when it named one. */
  currency: string | null;
}

/**
 * Refuses an intent that would exceed the cabinet's locally authored caps.
 *
 * Checked here, in the daemon, before anything could be sent. A provider-side
 * cap is not a substitute: it is set by the same call that could carry the
 * wrong number, so it cannot also be the check on that number. Exceeding the
 * local cap is a refusal rather than a warning, which is the entire reason for
 * having a second, independently authored bound.
 */
export function assertWithinSpendCap(input: SpendCapCheckInput): void {
  const { cabinet } = input;
  if (
    input.currency &&
    cabinet.currency &&
    input.currency !== cabinet.currency
  ) {
    throw new ChannelError(
      "currency_mismatch",
      `This intent is denominated in ${input.currency} but the cabinet bills in ${cabinet.currency}. Comparing them against a spend cap without a recorded rate would be a guess.`,
      422,
    );
  }
  if (
    cabinet.dailySpendCap !== null &&
    input.dailyBudget !== null &&
    input.dailyBudget > cabinet.dailySpendCap
  ) {
    throw new ChannelError(
      "spend_cap_exceeded",
      `A daily budget of ${input.dailyBudget} exceeds the ${cabinet.dailySpendCap} daily cap set for ${cabinet.displayName}. Raise the cap deliberately if the higher spend is intended.`,
      422,
    );
  }
  if (
    cabinet.totalSpendCap !== null &&
    input.lifetimeBudget !== null &&
    input.lifetimeBudget > cabinet.totalSpendCap
  ) {
    throw new ChannelError(
      "spend_cap_exceeded",
      `A lifetime budget of ${input.lifetimeBudget} exceeds the ${cabinet.totalSpendCap} total cap set for ${cabinet.displayName}. Raise the cap deliberately if the higher spend is intended.`,
      422,
    );
  }
}

/** Inclusive day count, used to tell a short window from a complete one. */
export function daysBetween(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.floor((to - from) / 86_400_000) + 1;
}

/** ISO date `days` before `reference`, in UTC. */
export function isoDateBefore(reference: Date, days: number): string {
  return new Date(reference.getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
