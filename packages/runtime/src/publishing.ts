import { randomBytes } from "node:crypto";
import type { PublishIntent } from "@marketingovo/contracts/channels";
import type {
  PublishRecord,
  SocialPlatform,
} from "@marketingovo/contracts/publishing";
import { PLATFORM_CAPABILITIES } from "@marketingovo/contracts/publishing";
import type { MarketingovoDatabase } from "@marketingovo/storage-sqlite";

/**
 * Sending one post, exactly once.
 *
 * The whole file exists to answer one question correctly: after a crash, was
 * the post sent? Every scheduling tool eventually double-posts to someone's
 * audience, and it happens here — in the gap between "we made the request" and
 * "we recorded the response". The sequence below closes that gap by writing
 * the record *before* the call, so a resumed job finds evidence that a request
 * left even though it never saw a reply.
 */

export type PublishJobErrorCode =
  | "intent_not_approved"
  | "intent_not_scheduled"
  | "payload_changed"
  | "publisher_unavailable"
  | "attempt_in_flight"
  | "daily_limit_reached";

export class PublishJobError extends Error {
  readonly code: PublishJobErrorCode;
  readonly status: number;

  constructor(code: PublishJobErrorCode, message: string, status = 409) {
    super(message);
    this.name = "PublishJobError";
    this.code = code;
    this.status = status;
  }
}

/** Generated at approval, so a retry of the same approval reuses one key. */
export function createIdempotencyKey(): string {
  return randomBytes(24).toString("base64url");
}

export interface PublishAttemptOutcome {
  intent: PublishIntent;
  record: PublishRecord | null;
  state: "published" | "failed" | "indeterminate" | "skipped";
  reason: string | null;
}

export interface PublishExecutor {
  publish(input: {
    platform: SocialPlatform;
    externalId: string;
    intent: PublishIntent;
    signal?: AbortSignal;
  }): Promise<{
    providerId: string;
    permalink: string | null;
    request: Record<string, unknown>;
  }>;
}

export interface RunPublishAttemptOptions {
  database: MarketingovoDatabase;
  intentId: string;
  executor: PublishExecutor;
  signal?: AbortSignal;
  now?: () => Date;
}

/**
 * Checks the platform's own published-per-day ceiling before sending.
 *
 * Local and therefore not authoritative — only the provider knows the truth —
 * but a calendar that discovers Instagram's limit at 09:00 has failed at the
 * one job a calendar has. Counted from our own records, which is what we can
 * actually see.
 */
export function dailyLimitReached(
  database: MarketingovoDatabase,
  channelAccountId: string,
  platform: SocialPlatform,
  now: Date,
): boolean {
  const limit = PLATFORM_CAPABILITIES[platform].dailyPostLimit;
  if (limit === null) return false;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
  return database.countPublishedSince(channelAccountId, since) >= limit;
}

/**
 * Sends one intent.
 *
 * The order below is the contract, and each step exists because of a specific
 * way this goes wrong without it:
 *
 * 1. Claim `approved → publishing`, conditionally. Two workers waking on the
 *    same due post would otherwise both send it.
 * 2. Re-check the approved hash against the current payload. An intent edited
 *    after approval must not go out under a consent given for something else.
 * 3. Write the record as `attempting`, keyed by the idempotency key. If a
 *    record already exists, a previous attempt reached this point and the
 *    outcome is unknown — stop and say so rather than sending again.
 * 4. Call the provider.
 * 5. Settle the record and the intent together.
 */
export async function runPublishAttempt(
  options: RunPublishAttemptOptions,
): Promise<PublishAttemptOutcome> {
  const { database } = options;
  const now = options.now ?? (() => new Date());
  const existing = database.getPublishIntent(options.intentId);
  if (!existing) {
    throw new PublishJobError(
      "intent_not_approved",
      "The publish intent no longer exists.",
      404,
    );
  }
  if (existing.state !== "approved") {
    // Not an error worth retrying: withdrawn, already sent, or never approved.
    return {
      intent: existing,
      record: null,
      state: "skipped",
      reason: `The intent is ${existing.state} rather than approved, so nothing was sent.`,
    };
  }
  if (!existing.idempotencyKey) {
    throw new PublishJobError(
      "intent_not_approved",
      "The intent has no idempotency key, which means it was not approved through the normal path.",
    );
  }

  const cabinet = database.getChannelAccount(existing.channelAccountId);
  if (!cabinet) {
    return {
      intent: existing,
      record: null,
      state: "failed",
      reason: "The destination account was removed before this post was sent.",
    };
  }
  const platform = platformFor(existing, cabinet.provider);
  if (!platform) {
    return {
      intent: existing,
      record: null,
      state: "failed",
      reason: `No publisher exists for ${cabinet.provider}.`,
    };
  }

  // A previous attempt may have left a record. Reading it before claiming
  // means an interrupted send is reported rather than repeated.
  const priorRecord = database.getPublishRecordByKey(existing.idempotencyKey);
  if (priorRecord && priorRecord.state === "attempting") {
    const settled = database.settlePublishRecord(priorRecord.id, {
      state: "indeterminate",
      error:
        "A previous attempt sent a request and did not record a response. Whether the post reached the platform is unknown; check the account before retrying.",
    });
    database.settlePublishIntent(
      existing.id,
      "failed",
      "A previous send was interrupted with an unknown outcome. Check the account, then withdraw or re-approve this post.",
    );
    return {
      intent: database.getPublishIntent(existing.id) ?? existing,
      record: settled,
      state: "indeterminate",
      reason:
        "A previous attempt was interrupted after the request left. Marketingovo will not send again on its own.",
    };
  }
  if (priorRecord) {
    return {
      intent: existing,
      record: priorRecord,
      state: "skipped",
      reason: `This intent was already ${priorRecord.state}.`,
    };
  }

  if (dailyLimitReached(database, cabinet.id, platform, now())) {
    const limit = PLATFORM_CAPABILITIES[platform].dailyPostLimit;
    database.settlePublishIntent(
      existing.id,
      "failed",
      `${platform} allows ${limit} posts per 24 hours on this account and that ceiling is already reached. Reschedule this post.`,
    );
    return {
      intent: database.getPublishIntent(existing.id) ?? existing,
      record: null,
      state: "failed",
      reason: `The ${platform} daily posting limit is already reached.`,
    };
  }

  const claimed = database.claimPublishIntent(existing.id);
  if (!claimed) {
    // Another worker took it between the read and the claim.
    return {
      intent: existing,
      record: null,
      state: "skipped",
      reason: "Another worker claimed this post first.",
    };
  }

  if (
    claimed.approvedPayloadHash &&
    claimed.approvedPayloadHash !== claimed.payloadHash
  ) {
    database.settlePublishIntent(
      claimed.id,
      "failed",
      "The payload changed after it was approved, so the approval no longer covers what would be sent. Approve the current version.",
    );
    return {
      intent: database.getPublishIntent(claimed.id) ?? claimed,
      record: null,
      state: "failed",
      reason: "The approved payload no longer matches the stored payload.",
    };
  }

  const record = database.beginPublishRecord({
    intentId: claimed.id,
    projectId: claimed.projectId,
    channelAccountId: claimed.channelAccountId,
    platform,
    // Provisional: replaced with what the publisher actually sent once it
    // returns, because the payload is a draft and the request is the truth.
    request: claimed.payload,
    idempotencyKey: claimed.idempotencyKey!,
  });
  if (!record) {
    database.settlePublishIntent(
      claimed.id,
      "failed",
      "Another attempt already claimed this idempotency key. Check the account before retrying.",
    );
    return {
      intent: database.getPublishIntent(claimed.id) ?? claimed,
      record: null,
      state: "indeterminate",
      reason: "An attempt with this idempotency key already exists.",
    };
  }

  try {
    const outcome = await options.executor.publish({
      platform,
      externalId: cabinet.externalId,
      intent: claimed,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const settled = database.settlePublishRecord(record.id, {
      state: "published",
      providerId: outcome.providerId,
      permalink: outcome.permalink,
      // What actually went on the wire, replacing the draft the opening row
      // held. A later question about this post is then answered by evidence
      // rather than by reconstructing it from a template that may have moved.
      request: outcome.request,
    });
    database.settlePublishIntent(claimed.id, "published", null);
    return {
      intent: database.getPublishIntent(claimed.id) ?? claimed,
      record: settled,
      state: "published",
      reason: null,
    };
  } catch (error) {
    const indeterminate =
      typeof error === "object" &&
      error !== null &&
      (error as { indeterminate?: unknown }).indeterminate === true;
    const message =
      error instanceof Error ? error.message : "The post could not be sent.";
    const settled = database.settlePublishRecord(record.id, {
      state: indeterminate ? "indeterminate" : "failed",
      error: message.slice(0, 2_000),
    });
    database.settlePublishIntent(claimed.id, "failed", message.slice(0, 400));
    return {
      intent: database.getPublishIntent(claimed.id) ?? claimed,
      record: settled,
      state: indeterminate ? "indeterminate" : "failed",
      reason: message,
    };
  }
}

/**
 * Which publisher a destination needs.
 *
 * An intent records its platform when it is staged, because a Meta connection
 * serves both Facebook Pages and Instagram and the provider alone cannot say
 * which one this post is for.
 */
export function platformFor(
  intent: PublishIntent,
  provider: string,
): SocialPlatform | null {
  const declared = (intent.payload as { platform?: unknown }).platform;
  if (
    declared === "telegram" ||
    declared === "x" ||
    declared === "facebook-page" ||
    declared === "instagram"
  ) {
    return declared;
  }
  if (provider === "telegram") return "telegram";
  if (provider === "x") return "x";
  return null;
}
