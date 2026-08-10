// One cabinet's sync: fetch, normalize, audit.
//
// The runtime calls this once per linked cabinet. It is the only place that
// combines network I/O with the pure normalizer and rules, so both of those
// stay testable without a live ad account.

import { MetaGraphError } from "@marketingovo/integrations";
import type { Issue } from "../../checks/index.js";
import {
  MetaAdsClient,
  type MetaDeliveryRecord,
  type MetaInsightLevel,
} from "./client.js";
import { auditMetaCabinet, type MetaAuditInput } from "./audit.js";
import {
  datesInRange,
  markMetaWindowUnavailable,
  normalizeMetaInsights,
} from "./normalize.js";
import type { ChannelMetric } from "../channel-vocabulary.js";

export interface MetaCabinetSyncInput {
  cabinet: MetaAuditInput["cabinet"];
  accessToken: string;
  graphVersion?: string;
  /** Inclusive ISO dates. */
  since: string;
  until: string;
  providerFetch?: typeof fetch;
  signal?: AbortSignal;
  /**
   * Levels to read. Account and campaign are the defaults because they answer
   * the marketer's first two questions; ad-level reads multiply the row count
   * by the size of the creative library.
   */
  levels?: readonly MetaInsightLevel[];
  now?: () => Date;
}

export interface MetaCabinetSyncResult {
  cabinetId: string;
  metrics: ChannelMetric[];
  delivery: MetaDeliveryRecord[];
  issues: Issue[];
  /** `available` only when every requested read completed in full. */
  state: "available" | "partial" | "failed";
  /** Operator-facing reason when the state is not `available`. */
  reason: string | null;
}

const DEFAULT_LEVELS: readonly MetaInsightLevel[] = [
  "account",
  "campaign",
  "adset",
];

function reasonFrom(error: unknown): string {
  if (error instanceof MetaGraphError) return error.message;
  return error instanceof Error
    ? error.message
    : "The Meta request failed for an unknown reason.";
}

/**
 * Reads one cabinet and returns what it actually saw.
 *
 * A failure never produces an empty result that reads as "this cabinet spent
 * nothing". It produces explicit `failed` rows for the requested days, so the
 * outage is visible exactly where the numbers would otherwise be.
 */
export async function syncMetaCabinet(
  input: MetaCabinetSyncInput,
): Promise<MetaCabinetSyncResult> {
  const now = input.now ?? (() => new Date());
  const fetchedAt = now().toISOString();
  const client = new MetaAdsClient({
    accessToken: input.accessToken,
    ...(input.graphVersion ? { graphVersion: input.graphVersion } : {}),
    ...(input.providerFetch ? { providerFetch: input.providerFetch } : {}),
  });

  const metrics: ChannelMetric[] = [];
  const delivery: MetaDeliveryRecord[] = [];
  const problems: string[] = [];
  let sawAnything = false;
  let truncatedAnywhere = false;

  for (const level of input.levels ?? DEFAULT_LEVELS) {
    input.signal?.throwIfAborted();
    try {
      const result = await client.insights({
        accountId: input.cabinet.externalId,
        since: input.since,
        until: input.until,
        level,
        // The platform split is the whole reason Facebook and Instagram can be
        // compared at all. It is requested below the account level, where an
        // operator can act on the answer.
        byPlatform: level !== "account",
      });
      sawAnything = true;
      truncatedAnywhere = truncatedAnywhere || result.truncated;
      metrics.push(
        ...normalizeMetaInsights(result.rows, {
          channelAccountId: input.cabinet.id,
          level,
          currency: input.cabinet.currency,
          fetchedAt,
          truncated: result.truncated,
        }),
      );
    } catch (error) {
      problems.push(`${level} insights: ${reasonFrom(error)}`);
    }
  }

  for (const level of ["campaign", "adset", "ad"] as const) {
    input.signal?.throwIfAborted();
    try {
      const result = await client.delivery({
        accountId: input.cabinet.externalId,
        level,
      });
      sawAnything = true;
      truncatedAnywhere = truncatedAnywhere || result.truncated;
      delivery.push(...result.records);
    } catch (error) {
      problems.push(`${level} delivery: ${reasonFrom(error)}`);
    }
  }

  if (!sawAnything) {
    const reason =
      problems[0] ?? "Meta returned nothing for this cabinet's window.";
    return {
      cabinetId: input.cabinet.id,
      metrics: markMetaWindowUnavailable({
        channelAccountId: input.cabinet.id,
        dates: datesInRange(input.since, input.until),
        reason,
        fetchedAt,
        currency: input.cabinet.currency,
      }),
      delivery: [],
      issues: [],
      state: "failed",
      reason,
    };
  }

  const issues = auditMetaCabinet({
    cabinet: input.cabinet,
    metrics,
    delivery,
  });

  const partial = problems.length > 0 || truncatedAnywhere;
  return {
    cabinetId: input.cabinet.id,
    metrics,
    delivery,
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
