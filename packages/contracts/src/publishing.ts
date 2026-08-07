import { Type, type Static } from "@sinclair/typebox";
import { IdentifierSchema, IsoDateTimeSchema } from "./index.js";

/**
 * The outbound half: media, scheduling, and the immutable record of what was
 * actually sent.
 *
 * Two properties here are load-bearing and should not be relaxed.
 *
 * A publish record stores the exact request and the provider's exact response
 * identifier, never a summary. When a post misbehaves the question is always
 * "what did we send", and reconstructing it from a template plus current data
 * is not an answer, because the template may have changed since.
 *
 * An attempt whose outcome is unknown stays `indeterminate` rather than being
 * resolved by a guess. Guessing "it failed" double-posts to the operator's
 * audience; guessing "it succeeded" silently drops a post. Neither is a
 * decision code should make quietly.
 */

/**
 * Where a post goes.
 *
 * Named rather than free strings so a scheduler cannot target a platform no
 * publisher implements, and so the calendar can render a per-platform preview
 * without guessing.
 */
export const SocialPlatformSchema = Type.Union([
  Type.Literal("telegram"),
  Type.Literal("x"),
  Type.Literal("facebook-page"),
  Type.Literal("instagram"),
]);
export type SocialPlatform = Static<typeof SocialPlatformSchema>;

/** What each platform will physically accept. Not a preference — a fact. */
export const PLATFORM_CAPABILITIES: Readonly<
  Record<
    SocialPlatform,
    {
      /** Longest body the platform accepts, in characters. */
      readonly maxBodyLength: number;
      /** Whether a post can exist with no media at all. */
      readonly allowsTextOnly: boolean;
      /** Whether the platform accepts raw bytes rather than a public URL. */
      readonly acceptsBytes: boolean;
      /** Attachments per post. */
      readonly maxAttachments: number;
      /** Published posts per 24h, where the provider documents one. */
      readonly dailyPostLimit: number | null;
    }
  >
> = {
  telegram: {
    maxBodyLength: 4_096,
    allowsTextOnly: true,
    acceptsBytes: true,
    maxAttachments: 10,
    dailyPostLimit: null,
  },
  x: {
    maxBodyLength: 280,
    allowsTextOnly: true,
    acceptsBytes: true,
    maxAttachments: 4,
    dailyPostLimit: null,
  },
  "facebook-page": {
    maxBodyLength: 63_206,
    allowsTextOnly: true,
    acceptsBytes: true,
    maxAttachments: 1,
    dailyPostLimit: null,
  },
  instagram: {
    maxBodyLength: 2_200,
    // Instagram has no text-only post, and its Content Publishing API fetches
    // media from a public URL rather than accepting an upload. Both facts are
    // the platform's, and both are why an Instagram post needs a hosted asset.
    allowsTextOnly: false,
    acceptsBytes: false,
    maxAttachments: 10,
    dailyPostLimit: 25,
  },
};

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export const MediaKindSchema = Type.Union([
  Type.Literal("image"),
  Type.Literal("video"),
]);
export type MediaKind = Static<typeof MediaKindSchema>;

export const MediaAssetSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    filename: Type.String({ minLength: 1, maxLength: 240 }),
    /**
     * Determined by sniffing the file signature, not by trusting the upload's
     * declared type or its extension. Both are caller-supplied.
     */
    mediaType: Type.String({ minLength: 3, maxLength: 120 }),
    kind: MediaKindSchema,
    sizeBytes: Type.Integer({ minimum: 1 }),
    sha256: Type.String({ minLength: 64, maxLength: 64 }),
    /** Pixel dimensions when they could be read from the file itself. */
    width: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    height: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    createdAt: IsoDateTimeSchema,
    /**
     * Where this asset is reachable publicly, if the operator relayed it.
     *
     * Null means the bytes have never left this machine, which is the default
     * and the state every platform except Instagram can publish from.
     */
    publicUrl: Type.Union([
      Type.String({ format: "uri", pattern: "^https://" }),
      Type.Null(),
    ]),
    /** Which destination produced `publicUrl`: `operator-supplied` or a bucket. */
    publicUrlSource: Type.Union([Type.String({ maxLength: 120 }), Type.Null()]),
    publicUrlAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type MediaAsset = Static<typeof MediaAssetSchema>;

/** Attaches an already-public URL the operator hosts themselves. */
export const AttachPublicMediaUrlInputSchema = Type.Object(
  {
    publicUrl: Type.String({
      format: "uri",
      pattern: "^https://",
      maxLength: 2_000,
    }),
  },
  { additionalProperties: false },
);
export type AttachPublicMediaUrlInput = Static<
  typeof AttachPublicMediaUrlInputSchema
>;

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

/**
 * The lifecycle of one destination's send.
 *
 * `publishing` exists so a second worker cannot claim an intent mid-flight, and
 * `indeterminate` exists because a crash between the request and the response
 * is a real state that must not be collapsed into either neighbour.
 */
export const PublishAttemptStateSchema = Type.Union([
  Type.Literal("attempting"),
  Type.Literal("published"),
  Type.Literal("failed"),
  Type.Literal("indeterminate"),
]);
export type PublishAttemptState = Static<typeof PublishAttemptStateSchema>;

export const PublishRecordSchema = Type.Object(
  {
    id: IdentifierSchema,
    intentId: IdentifierSchema,
    projectId: IdentifierSchema,
    channelAccountId: IdentifierSchema,
    platform: SocialPlatformSchema,
    state: PublishAttemptStateSchema,
    /** The exact request body sent to the provider. Stored, not summarized. */
    request: Type.Record(Type.String(), Type.Unknown()),
    /** The idempotency key this attempt claimed. */
    idempotencyKey: Type.String({ minLength: 16, maxLength: 128 }),
    /** The provider's own identifier for what it created. */
    providerId: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    /** A link to the live post, when the provider gives one. */
    permalink: Type.Union([
      Type.String({ format: "uri", pattern: "^https://", maxLength: 2_000 }),
      Type.Null(),
    ]),
    /** The provider's error, preserved verbatim enough to act on. */
    error: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    attemptedAt: IsoDateTimeSchema,
    completedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type PublishRecord = Static<typeof PublishRecordSchema>;

export const ScheduleIntentInputSchema = Type.Object(
  {
    /**
     * When to send. Approval binds to this value, so moving a scheduled post
     * voids its approval and it must be approved again.
     */
    scheduledAt: IsoDateTimeSchema,
    /**
     * The operator's timezone, recorded so the calendar can render the time
     * they chose rather than the one their browser happens to be in now.
     */
    timezone: Type.String({ minLength: 1, maxLength: 80 }),
  },
  { additionalProperties: false },
);
export type ScheduleIntentInput = Static<typeof ScheduleIntentInputSchema>;

/**
 * One entry as the calendar renders it.
 *
 * Deliberately denormalized: a calendar cell needs the platform, the time, the
 * state and enough copy to recognize the post, and issuing four queries per
 * cell to assemble that would make a month view unusable.
 */
export const CalendarEntrySchema = Type.Object(
  {
    intentId: IdentifierSchema,
    deliverableId: IdentifierSchema,
    briefId: IdentifierSchema,
    briefTitle: Type.String({ maxLength: 240 }),
    channelAccountId: IdentifierSchema,
    platform: SocialPlatformSchema,
    accountName: Type.String({ maxLength: 240 }),
    /** `staged`, `approved`, `publishing`, `published`, `failed`, … */
    state: Type.String({ minLength: 1, maxLength: 40 }),
    scheduledAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    timezone: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    preview: Type.String({ maxLength: 400 }),
    attachmentCount: Type.Integer({ minimum: 0 }),
    /** Present once a send has been attempted. */
    record: Type.Union([PublishRecordSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type CalendarEntry = Static<typeof CalendarEntrySchema>;

export const ContentCalendarSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    start: IsoDateTimeSchema,
    end: IsoDateTimeSchema,
    entries: Type.Array(CalendarEntrySchema),
    /**
     * Posts that are approved but have no scheduled time, and posts whose time
     * has passed without a send. Surfaced separately because a calendar that
     * only draws cells hides exactly the things that need attention.
     */
    unscheduled: Type.Array(CalendarEntrySchema),
    overdue: Type.Array(CalendarEntrySchema),
  },
  { additionalProperties: false },
);
export type ContentCalendar = Static<typeof ContentCalendarSchema>;

/**
 * What a composed post says and carries, before it is split per platform.
 *
 * The per-platform payload is derived from this, and the derivation is where
 * "this body is 480 characters and X takes 280" becomes a refusal rather than
 * a truncation nobody asked for.
 */
export const SocialPostDraftSchema = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 63_206 }),
    /** Media asset ids, in the order they should appear. */
    mediaIds: Type.Array(IdentifierSchema, { maxItems: 10 }),
    /** Appended to the body on platforms where a link is not auto-detected. */
    linkUrl: Type.Union([
      Type.String({ format: "uri", pattern: "^https://", maxLength: 2_000 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type SocialPostDraft = Static<typeof SocialPostDraftSchema>;

/**
 * Why a draft cannot go to a platform, in the operator's terms.
 *
 * Returned before staging so a calendar never holds a post that was always
 * going to be rejected at 09:00.
 */
export const PlatformFitSchema = Type.Object(
  {
    platform: SocialPlatformSchema,
    ok: Type.Boolean(),
    problems: Type.Array(Type.String({ maxLength: 400 })),
  },
  { additionalProperties: false },
);
export type PlatformFit = Static<typeof PlatformFitSchema>;

/**
 * Checks a draft against what a platform will physically accept.
 *
 * Every problem is reported at once rather than the first one found: an
 * operator fixing a post should learn everything wrong with it in one pass.
 */
export function checkPlatformFit(
  platform: SocialPlatform,
  draft: {
    body: string;
    attachmentCount: number;
    /** Attachments that are reachable at a public HTTPS URL. */
    publicAttachmentCount: number;
  },
): PlatformFit {
  const limits = PLATFORM_CAPABILITIES[platform];
  const problems: string[] = [];

  if (draft.body.length > limits.maxBodyLength) {
    problems.push(
      `The body is ${draft.body.length} characters and ${platform} accepts ${limits.maxBodyLength}. Shorten it rather than letting the platform truncate mid-sentence.`,
    );
  }
  if (draft.attachmentCount === 0 && !limits.allowsTextOnly) {
    problems.push(
      `${platform} has no text-only post. Attach an image or video.`,
    );
  }
  if (draft.attachmentCount > limits.maxAttachments) {
    problems.push(
      `${draft.attachmentCount} attachments exceed the ${limits.maxAttachments} ${platform} accepts.`,
    );
  }
  if (
    !limits.acceptsBytes &&
    draft.publicAttachmentCount < draft.attachmentCount
  ) {
    problems.push(
      `${platform} fetches media from a public URL rather than accepting an upload, and ${draft.attachmentCount - draft.publicAttachmentCount} attachment(s) are only stored locally. Publish them to your own storage, or supply a URL you already host.`,
    );
  }

  return { platform, ok: problems.length === 0, problems };
}

/* ------------------------------------------------------------------ */
/* Object storage relay                                                */
/* ------------------------------------------------------------------ */

/**
 * The operator's own bucket.
 *
 * `endpoint` is the one place in this product where the exact-host egress
 * allowlist is authored by the operator rather than compiled in. An S3
 * endpoint differs per provider and per account, so it cannot be a constant.
 * Everything else about the policy still holds: one exact host, HTTPS only,
 * DNS re-resolved per call, non-public addresses refused, redirects refused.
 */
export const MediaRelayConfigSchema = Type.Object(
  {
    /** Exact host, e.g. `s3.eu-west-1.amazonaws.com`. No scheme, no path. */
    endpoint: Type.String({
      minLength: 4,
      maxLength: 253,
      pattern: "^[a-z0-9.-]+$",
    }),
    region: Type.String({ minLength: 1, maxLength: 64 }),
    bucket: Type.String({ minLength: 1, maxLength: 63 }),
    /**
     * The base URL the uploaded object is publicly readable from. Kept separate
     * from the endpoint because a CDN domain usually fronts the bucket, and
     * guessing it wrong produces a URL Instagram cannot fetch.
     */
    publicBaseUrl: Type.String({
      format: "uri",
      pattern: "^https://",
      maxLength: 2_000,
    }),
    /** Path-style addressing, which MinIO and some S3 clones require. */
    forcePathStyle: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type MediaRelayConfig = Static<typeof MediaRelayConfigSchema>;
