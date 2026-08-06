import { Type, type Static } from "@sinclair/typebox";
import { IdentifierSchema, IsoDateTimeSchema } from "./index.js";

/**
 * The channel layer: which external entity a workspace reads from, and the
 * cross-channel facts it reads.
 *
 * Two properties of this file are load-bearing and should not be relaxed for
 * convenience later.
 *
 * A metric value is nullable and carries a separate availability state. "We
 * spent nothing" and "we could not ask" are different findings, and a paid
 * dashboard that collapses them produces confident wrong answers about money.
 *
 * Currency is recorded per row and never inferred. Summing spend across
 * cabinets in different currencies without a recorded rate is a fabrication,
 * so the roll-up declines instead of guessing.
 */

export const ChannelKindSchema = Type.Union([
  Type.Literal("search"),
  Type.Literal("analytics"),
  Type.Literal("ads"),
  Type.Literal("social"),
]);
export type ChannelKind = Static<typeof ChannelKindSchema>;

/**
 * Where a paid impression was actually served.
 *
 * Meta bills one ad account across several surfaces, and "Instagram is
 * expensive" is not a question that can be answered from an account total.
 * Every metric row therefore carries the platform it was measured on, and
 * `all` means the provider reported the row without a platform breakdown —
 * which is a different claim from a row that happened to be Facebook.
 */
export const AdPlatformSchema = Type.Union([
  Type.Literal("all"),
  Type.Literal("facebook"),
  Type.Literal("instagram"),
  Type.Literal("messenger"),
  Type.Literal("audience_network"),
  // Google's equivalent split. Search and Search Partners are kept apart
  // because partner traffic converts differently and is switched off
  // separately, and an operator comparing them is usually deciding exactly
  // that. Performance Max is its own value rather than being folded into the
  // networks it runs on: Google reports it as one opaque surface, and calling
  // it "search" would claim a breakdown that does not exist.
  Type.Literal("google_search"),
  Type.Literal("google_search_partners"),
  Type.Literal("google_display"),
  Type.Literal("google_youtube"),
  Type.Literal("google_performance_max"),
  Type.Literal("unknown"),
]);
export type AdPlatform = Static<typeof AdPlatformSchema>;

export const ChannelEntityKindSchema = Type.Union([
  Type.Literal("account"),
  Type.Literal("campaign"),
  // Meta's ad set and Google's ad group are the same layer: the thing that
  // holds targeting and a budget under a campaign. One name, so a rule about
  // "the middle layer" is written once.
  Type.Literal("adset"),
  Type.Literal("ad"),
  /** Google only. The bid unit, and where most account waste is visible. */
  Type.Literal("keyword"),
  Type.Literal("post"),
  Type.Literal("profile"),
]);
export type ChannelEntityKind = Static<typeof ChannelEntityKindSchema>;

/**
 * The same four states `PerformanceWindowRecord` already enforces for organic
 * sources, reused here so a marketer reads one vocabulary across channels.
 */
export const ChannelMetricStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
  Type.Literal("failed"),
]);
export type ChannelMetricState = Static<typeof ChannelMetricStateSchema>;

/**
 * The metric vocabulary. Named explicitly rather than accepting free strings so
 * a connector cannot quietly invent a key the dashboard will never render, and
 * so a cross-channel comparison is comparing the same thing.
 */
export const CHANNEL_METRIC_KEYS = [
  "impressions",
  "clicks",
  "spend",
  "reach",
  "frequency",
  "conversions",
  "conversion_value",
  "cost_per_conversion",
  "ctr",
  "cpc",
  "cpm",
  "engagements",
  "video_plays",
  "link_clicks",
  /**
   * Share of the auctions this account could have appeared in and did.
   *
   * Google only. Reported as a fraction, and the two "lost" keys below say
   * where the rest went — one is a money problem and the other is a quality
   * problem, and they have opposite remedies. Google withholds all three when
   * the auction pool is too small to anonymise, which arrives as null.
   */
  "search_impression_share",
  "search_budget_lost_impression_share",
  "search_rank_lost_impression_share",
] as const;

export const ChannelMetricKeySchema = Type.Union(
  CHANNEL_METRIC_KEYS.map((key) => Type.Literal(key)),
);
export type ChannelMetricKey = (typeof CHANNEL_METRIC_KEYS)[number];

/** ISO 4217. Stored as supplied by the provider; never defaulted. */
export const CurrencySchema = Type.String({
  minLength: 3,
  maxLength: 3,
  pattern: "^[A-Z]{3}$",
});

const DateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  minLength: 10,
  maxLength: 10,
});

/**
 * One ad cabinet, analytics property, or social profile a workspace reads.
 *
 * `account` is the credential discriminator — one Meta login reaches many
 * cabinets, and an agency needs different logins for different clients, so the
 * credential and the entity it reaches are deliberately separate fields.
 */
export const ChannelAccountSchema = Type.Object(
  {
    id: IdentifierSchema,
    workspaceId: IdentifierSchema,
    provider: IdentifierSchema,
    account: IdentifierSchema,
    kind: ChannelKindSchema,
    /** The provider's own identifier, e.g. `act_1234567890`. */
    externalId: Type.String({ minLength: 1, maxLength: 240 }),
    displayName: Type.String({ minLength: 1, maxLength: 240 }),
    /** Ads only, and only when the provider reported one. */
    currency: Type.Union([CurrencySchema, Type.Null()]),
    /**
     * A locally authored bound on what this cabinet may be approved to spend.
     * Deliberately independent of any provider-side cap: a provider cap is set
     * by the same call that could carry the wrong number, so it cannot also be
     * the check on that number.
     */
    dailySpendCap: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    totalSpendCap: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    createdAt: IsoDateTimeSchema,
    archivedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type ChannelAccount = Static<typeof ChannelAccountSchema>;

export const LinkChannelAccountInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    provider: IdentifierSchema,
    account: Type.Optional(IdentifierSchema),
    kind: ChannelKindSchema,
    externalId: Type.String({ minLength: 1, maxLength: 240 }),
    displayName: Type.String({ minLength: 1, maxLength: 240 }),
    currency: Type.Optional(Type.Union([CurrencySchema, Type.Null()])),
    dailySpendCap: Type.Optional(
      Type.Union([
        Type.Number({ minimum: 0, maximum: 100_000_000 }),
        Type.Null(),
      ]),
    ),
    totalSpendCap: Type.Optional(
      Type.Union([
        Type.Number({ minimum: 0, maximum: 100_000_000 }),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type LinkChannelAccountInput = Static<
  typeof LinkChannelAccountInputSchema
>;

export const UpdateChannelAccountInputSchema = Type.Object(
  {
    displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
    dailySpendCap: Type.Optional(
      Type.Union([
        Type.Number({ minimum: 0, maximum: 100_000_000 }),
        Type.Null(),
      ]),
    ),
    totalSpendCap: Type.Optional(
      Type.Union([
        Type.Number({ minimum: 0, maximum: 100_000_000 }),
        Type.Null(),
      ]),
    ),
    /** `true` archives the cabinet; `false` restores it. */
    archived: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type UpdateChannelAccountInput = Static<
  typeof UpdateChannelAccountInputSchema
>;

/**
 * A cabinet the connected credential can reach but the workspace has not
 * linked. Discovery is read-only and never links anything on its own: which
 * client's money this workspace is allowed to look at is an operator decision.
 */
export const DiscoveredChannelAccountSchema = Type.Object(
  {
    provider: IdentifierSchema,
    account: IdentifierSchema,
    kind: ChannelKindSchema,
    externalId: Type.String({ minLength: 1, maxLength: 240 }),
    displayName: Type.String({ minLength: 1, maxLength: 240 }),
    currency: Type.Union([CurrencySchema, Type.Null()]),
    /** Provider-reported account state, verbatim, e.g. `ACTIVE`, `DISABLED`. */
    status: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    /** True when this workspace already holds a row for the same entity. */
    linked: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type DiscoveredChannelAccount = Static<
  typeof DiscoveredChannelAccountSchema
>;

export const ChannelMetricSchema = Type.Object(
  {
    channelAccountId: IdentifierSchema,
    entityKind: ChannelEntityKindSchema,
    entityId: Type.String({ minLength: 1, maxLength: 240 }),
    entityName: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    platform: AdPlatformSchema,
    date: DateSchema,
    metricKey: ChannelMetricKeySchema,
    /** Null whenever `state` is not `available`. Never a substituted zero. */
    value: Type.Union([Type.Number(), Type.Null()]),
    state: ChannelMetricStateSchema,
    currency: Type.Union([CurrencySchema, Type.Null()]),
    source: Type.String({ minLength: 1, maxLength: 120 }),
    fetchedAt: IsoDateTimeSchema,
    /** Why the value is missing or partial, in the operator's terms. */
    note: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ChannelMetric = Static<typeof ChannelMetricSchema>;

/**
 * How closely the query matched the keyword that triggered it.
 *
 * `near_exact` and `near_phrase` are Google's own designations for a query it
 * treated as a close variant — a plural, a misspelling, or something it judged
 * to mean the same thing. They are kept separate from `exact` and `phrase`
 * because close variants are where a tightly-built account still leaks: the
 * operator wrote one keyword and Google matched a different one on their
 * behalf.
 */
export const SearchTermMatchTypeSchema = Type.Union([
  Type.Literal("exact"),
  Type.Literal("phrase"),
  Type.Literal("broad"),
  Type.Literal("near_exact"),
  Type.Literal("near_phrase"),
  Type.Literal("unknown"),
]);
export type SearchTermMatchType = Static<typeof SearchTermMatchTypeSchema>;

/** Whether the operator has already acted on this term. */
export const SearchTermStatusSchema = Type.Union([
  /** Already a keyword. */
  Type.Literal("added"),
  /** Already a negative. Reported so the audit does not suggest it twice. */
  Type.Literal("excluded"),
  Type.Literal("added_excluded"),
  /** Neither. The only status worth acting on. */
  Type.Literal("none"),
  Type.Literal("unknown"),
]);
export type SearchTermStatus = Static<typeof SearchTermStatusSchema>;

/**
 * One query that triggered an ad, aggregated over the window.
 *
 * Deliberately not per-day. A daily search term row multiplies the largest
 * table in the product by the length of the window for no analytical gain: the
 * question is "did this query ever earn its cost", and a single day of one
 * query is almost always too small to answer it.
 *
 * These are words people typed. They stay on the operator's machine like
 * everything else here, and Google already withholds terms whose volume is too
 * low to anonymise — which is why a search term report never accounts for the
 * whole of a campaign's clicks.
 */
export const SearchTermRecordSchema = Type.Object(
  {
    channelAccountId: IdentifierSchema,
    campaignId: Type.String({ minLength: 1, maxLength: 64 }),
    campaignName: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
    adGroupId: Type.String({ minLength: 1, maxLength: 64 }),
    adGroupName: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
    /** What was typed. */
    query: Type.String({ minLength: 1, maxLength: 400 }),
    /** The keyword it was matched to, when Google reported one. */
    matchedKeyword: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
    matchType: SearchTermMatchTypeSchema,
    status: SearchTermStatusSchema,
    impressions: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    clicks: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    cost: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    /**
     * Fractional by design. Google divides a conversion across the clicks it
     * credits, so 0.5 is a real reading and rounding it to zero would turn a
     * converting query into a wasteful one.
     */
    conversions: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    conversionValue: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    currency: Type.Union([CurrencySchema, Type.Null()]),
    windowStart: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
    windowEnd: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
    fetchedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type SearchTermRecord = Static<typeof SearchTermRecordSchema>;

/**
 * How much of an account's spend the search term report cannot explain.
 *
 * Performance Max and Demand Gen do not expose queries at all, and Google
 * withholds low-volume terms everywhere else. Without this, an audit that
 * inspected 30% of spend and found little would read as an account in good
 * order. See ADR 0008.
 */
export const SearchTermCoverageSchema = Type.Object(
  {
    /** Spend in campaign types whose queries can be inspected. */
    inspectableSpend: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    /** Spend in Performance Max, Demand Gen and similar. */
    opaqueSpend: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    /** Campaign names behind `opaqueSpend`, so the gap is nameable. */
    opaqueCampaigns: Type.Array(Type.String({ maxLength: 400 }), {
      maxItems: 200,
    }),
    currency: Type.Union([CurrencySchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type SearchTermCoverage = Static<typeof SearchTermCoverageSchema>;

/**
 * A totalled read over one cabinet and window.
 *
 * `currency` is null when the rows summed did not agree on one, and the caller
 * must render that as "not comparable" rather than as a number.
 */
export const ChannelMetricSummarySchema = Type.Object(
  {
    metricKey: ChannelMetricKeySchema,
    platform: AdPlatformSchema,
    value: Type.Union([Type.Number(), Type.Null()]),
    state: ChannelMetricStateSchema,
    currency: Type.Union([CurrencySchema, Type.Null()]),
    /** Days in the requested window that produced an available value. */
    observedDays: Type.Integer({ minimum: 0 }),
    requestedDays: Type.Integer({ minimum: 0 }),
    note: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ChannelMetricSummary = Static<typeof ChannelMetricSummarySchema>;

export const ChannelPerformanceSchema = Type.Object(
  {
    account: ChannelAccountSchema,
    start: DateSchema,
    end: DateSchema,
    /** Empty when the cabinet has never been synced. */
    lastSyncedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    summaries: Type.Array(ChannelMetricSummarySchema),
  },
  { additionalProperties: false },
);
export type ChannelPerformance = Static<typeof ChannelPerformanceSchema>;

/* ------------------------------------------------------------------ */
/* Campaign staging                                                    */
/*                                                                     */
/* The composer's read half: a brief, its per-channel deliverables and */
/* the exact payloads staged for a human to approve. Nothing here      */
/* reaches a provider. Approval is the gate, and it is pinned to the   */
/* browser's transport rather than to a flag a caller could set.       */
/* ------------------------------------------------------------------ */

export const CampaignBriefStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("in_review"),
  Type.Literal("archived"),
]);
export type CampaignBriefStatus = Static<typeof CampaignBriefStatusSchema>;

export const CampaignBriefSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    title: Type.String({ minLength: 1, maxLength: 240 }),
    objective: Type.String({ minLength: 1, maxLength: 2_000 }),
    audience: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    keyMessage: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    constraints: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    status: CampaignBriefStatusSchema,
    /** `agent` or `operator`, decided by transport rather than by the caller. */
    createdBy: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type CampaignBrief = Static<typeof CampaignBriefSchema>;

export const CreateCampaignBriefInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    title: Type.String({ minLength: 1, maxLength: 240 }),
    objective: Type.String({ minLength: 1, maxLength: 2_000 }),
    audience: Type.Optional(
      Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    ),
    keyMessage: Type.Optional(
      Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    ),
    constraints: Type.Optional(
      Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type CreateCampaignBriefInput = Static<
  typeof CreateCampaignBriefInputSchema
>;

export const DeliverableChannelSchema = Type.Union([
  Type.Literal("facebook-ad"),
  Type.Literal("instagram-ad"),
  Type.Literal("instagram-post"),
  Type.Literal("instagram-reel"),
  Type.Literal("facebook-post"),
  Type.Literal("seo-article"),
  // Organic posting destinations. `social-post` is the channel-agnostic one:
  // the composer writes it once and the per-platform payload is derived, so a
  // post going to four places is one deliverable rather than four near-copies
  // that drift apart the first time someone edits three of them.
  Type.Literal("social-post"),
  Type.Literal("telegram-post"),
  Type.Literal("x-post"),
]);
export type DeliverableChannel = Static<typeof DeliverableChannelSchema>;

export const CampaignDeliverableSchema = Type.Object(
  {
    id: IdentifierSchema,
    briefId: IdentifierSchema,
    channel: DeliverableChannelSchema,
    headline: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    body: Type.String({ minLength: 1, maxLength: 20_000 }),
    callToAction: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    /** Where the click goes. Absent for organic copy with no destination. */
    destinationUrl: Type.Union([
      Type.String({ format: "uri", pattern: "^https://", maxLength: 2_000 }),
      Type.Null(),
    ]),
    creativeNotes: Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    createdBy: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type CampaignDeliverable = Static<typeof CampaignDeliverableSchema>;

export const CreateCampaignDeliverableInputSchema = Type.Object(
  {
    channel: DeliverableChannelSchema,
    headline: Type.Optional(
      Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    ),
    body: Type.String({ minLength: 1, maxLength: 20_000 }),
    callToAction: Type.Optional(
      Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    ),
    destinationUrl: Type.Optional(
      Type.Union([
        Type.String({ format: "uri", pattern: "^https://", maxLength: 2_000 }),
        Type.Null(),
      ]),
    ),
    creativeNotes: Type.Optional(
      Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type CreateCampaignDeliverableInput = Static<
  typeof CreateCampaignDeliverableInputSchema
>;

/**
 * `staged` is the only state an agent can produce. `approved` requires a
 * request carrying the browser's own session and CSRF token, and `void` is
 * what an approval becomes when the payload it approved changed underneath it.
 */
export const PublishIntentStateSchema = Type.Union([
  Type.Literal("staged"),
  Type.Literal("approved"),
  // `publishing` is claimed by exactly one worker, conditioned on the intent
  // still being `approved`. A second worker loses that race and stops, which
  // is what keeps a retried job from becoming a second post.
  Type.Literal("publishing"),
  Type.Literal("published"),
  Type.Literal("failed"),
  Type.Literal("void"),
  Type.Literal("withdrawn"),
]);
export type PublishIntentState = Static<typeof PublishIntentStateSchema>;

export const PublishIntentBudgetSchema = Type.Object(
  {
    dailyBudget: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    lifetimeBudget: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    currency: Type.Union([CurrencySchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type PublishIntentBudget = Static<typeof PublishIntentBudgetSchema>;

export const PublishIntentSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    deliverableId: IdentifierSchema,
    channelAccountId: IdentifierSchema,
    state: PublishIntentStateSchema,
    /** The exact request body that would be sent. Stored, never summarized. */
    payload: Type.Record(Type.String(), Type.Unknown()),
    /** SHA-256 of the canonical payload. Approval binds to this exact value. */
    payloadHash: Type.String({ minLength: 64, maxLength: 64 }),
    budget: PublishIntentBudgetSchema,
    stagedBy: Type.String({ minLength: 1, maxLength: 160 }),
    stagedAt: IsoDateTimeSchema,
    approvedBy: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
    approvedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    /** The hash the operator actually read and approved. */
    approvedPayloadHash: Type.Union([
      Type.String({ minLength: 64, maxLength: 64 }),
      Type.Null(),
    ]),
    /**
     * When this should be sent, and the timezone the operator chose it in.
     *
     * Part of what an approval binds to: moving a scheduled post is a change
     * to what was consented to, so it voids the approval the same way editing
     * the copy does. Null means approved but not yet placed on the calendar.
     */
    scheduledAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    timezone: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    /**
     * Generated at approval and carried by the durable job.
     *
     * No provider here accepts an idempotency key of its own, so this is the
     * key the local record is written under — it is what makes a retry after a
     * crash resolvable rather than a coin flip between double-posting and
     * silently dropping a post.
     */
    idempotencyKey: Type.Union([
      Type.String({ minLength: 16, maxLength: 128 }),
      Type.Null(),
    ]),
    /** Why the intent is void, withdrawn or failed. */
    note: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type PublishIntent = Static<typeof PublishIntentSchema>;

export const StagePublishIntentInputSchema = Type.Object(
  {
    deliverableId: IdentifierSchema,
    channelAccountId: IdentifierSchema,
    payload: Type.Record(Type.String(), Type.Unknown()),
    budget: Type.Optional(
      Type.Object(
        {
          dailyBudget: Type.Optional(
            Type.Union([
              Type.Number({ minimum: 0, maximum: 100_000_000 }),
              Type.Null(),
            ]),
          ),
          lifetimeBudget: Type.Optional(
            Type.Union([
              Type.Number({ minimum: 0, maximum: 100_000_000 }),
              Type.Null(),
            ]),
          ),
          currency: Type.Optional(Type.Union([CurrencySchema, Type.Null()])),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type StagePublishIntentInput = Static<
  typeof StagePublishIntentInputSchema
>;

export const ApprovePublishIntentInputSchema = Type.Object(
  {
    /**
     * The hash of the payload the operator read. Supplying it is what makes an
     * approval informed rather than a click on whatever the record now holds.
     */
    payloadHash: Type.String({ minLength: 64, maxLength: 64 }),
  },
  { additionalProperties: false },
);
export type ApprovePublishIntentInput = Static<
  typeof ApprovePublishIntentInputSchema
>;

/** A brief with everything staged under it, for one dashboard or agent read. */
export const CampaignWorkspaceSchema = Type.Object(
  {
    brief: CampaignBriefSchema,
    deliverables: Type.Array(CampaignDeliverableSchema),
    intents: Type.Array(PublishIntentSchema),
  },
  { additionalProperties: false },
);
export type CampaignWorkspace = Static<typeof CampaignWorkspaceSchema>;
