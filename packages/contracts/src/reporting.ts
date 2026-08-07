import { Type, type Static } from "@sinclair/typebox";
import { IdentifierSchema, IsoDateTimeSchema } from "./index.js";

/**
 * The cross-channel report.
 *
 * This is the first thing the product makes that is read by someone who did
 * not run it — a client, who cannot see the connector states and will not ask
 * why one section is thinner than another. Every gap is an invitation to fill
 * it, and every fill is invisible to the only person who could catch it.
 *
 * So the shapes below are built to make an absence expressible. There is no
 * plain `number` anywhere a measurement belongs: every figure carries its own
 * availability, and every total the report declines to compute carries the
 * sentence explaining why. See ADR 0007.
 */

const DateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  minLength: 10,
  maxLength: 10,
});

export const ReportAvailabilitySchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
  Type.Literal("failed"),
]);
export type ReportAvailability = Static<typeof ReportAvailabilitySchema>;

/**
 * One figure, with everything needed to know whether to believe it.
 *
 * `value` is null unless `state` is `available` or `partial`. `change` is null
 * unless *both* periods were measured — a month-over-month percentage against
 * a period the connector was down for is not a result, and computing one is
 * the single most common way a marketing report lies.
 */
export const ReportMetricSchema = Type.Object(
  {
    key: Type.String({ minLength: 1, maxLength: 80 }),
    label: Type.String({ minLength: 1, maxLength: 120 }),
    value: Type.Union([Type.Number(), Type.Null()]),
    /** `count`, `currency`, `percent`, `duration`, `position`. */
    unit: Type.String({ minLength: 1, maxLength: 24 }),
    currency: Type.Union([
      Type.String({ minLength: 3, maxLength: 3 }),
      Type.Null(),
    ]),
    state: ReportAvailabilitySchema,
    /** Relative change against the comparison period, or null. */
    change: Type.Union([Type.Number(), Type.Null()]),
    /** Why the value or the change is missing, in the client's terms. */
    note: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ReportMetric = Static<typeof ReportMetricSchema>;

/** Where a section's numbers came from, and whether it could be read. */
export const ReportSourceSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 80 }),
    label: Type.String({ minLength: 1, maxLength: 120 }),
    state: ReportAvailabilitySchema,
    /** Stated for anything not fully available. Empty when it was. */
    reason: Type.String({ maxLength: 400 }),
    observedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type ReportSource = Static<typeof ReportSourceSchema>;

/**
 * A total the report will not compute, and the sentence that replaces it.
 *
 * A first-class part of the document rather than a footnote: the refusal is
 * information the client needs, and a footnote does not travel with a number
 * once it has been screenshotted into a board deck.
 */
export const ReportRefusalSchema = Type.Object(
  {
    /** What a reader might expect to see here, e.g. "Total conversions". */
    expected: Type.String({ minLength: 1, maxLength: 120 }),
    /** Why it would be wrong, in terms a client can follow. */
    explanation: Type.String({ minLength: 1, maxLength: 800 }),
  },
  { additionalProperties: false },
);
export type ReportRefusal = Static<typeof ReportRefusalSchema>;

export const ReportSectionSchema = Type.Object(
  {
    id: Type.Union([
      Type.Literal("paid"),
      Type.Literal("organic"),
      Type.Literal("social"),
      Type.Literal("email"),
      Type.Literal("competitors"),
      Type.Literal("actions"),
    ]),
    title: Type.String({ minLength: 1, maxLength: 120 }),
    /**
     * The worst state among the section's sources.
     *
     * A section is never omitted for having no data. An absent section reads
     * as "nothing happened here", which is the same untruth in a different
     * shape.
     */
    state: ReportAvailabilitySchema,
    /** One sentence a client reads before the numbers. */
    summary: Type.String({ maxLength: 1_000 }),
    metrics: Type.Array(ReportMetricSchema),
    sources: Type.Array(ReportSourceSchema),
    refusals: Type.Array(ReportRefusalSchema),
    /** Per-platform or per-entity rows, where the section has them. */
    breakdown: Type.Array(
      Type.Object(
        {
          label: Type.String({ minLength: 1, maxLength: 160 }),
          metrics: Type.Array(ReportMetricSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type ReportSection = Static<typeof ReportSectionSchema>;

export const ReportPeriodSchema = Type.Object(
  {
    start: DateSchema,
    end: DateSchema,
    /** The period changes are measured against, when one was requested. */
    comparisonStart: Type.Union([DateSchema, Type.Null()]),
    comparisonEnd: Type.Union([DateSchema, Type.Null()]),
    timezone: Type.String({ minLength: 1, maxLength: 80 }),
  },
  { additionalProperties: false },
);
export type ReportPeriod = Static<typeof ReportPeriodSchema>;

export const MarketingReportSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    /** What the client sees at the top. */
    title: Type.String({ minLength: 1, maxLength: 240 }),
    period: ReportPeriodSchema,
    /**
     * The opening paragraph.
     *
     * Written by an agent or by the operator, never generated from the
     * numbers: a sentence assembled from metrics reads as insight while being
     * arithmetic, which is exactly the kind of confident hollowness a client
     * learns to distrust.
     */
    narrative: Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    sections: Type.Array(ReportSectionSchema),
    /**
     * Everything the report could not see, gathered in one place.
     *
     * Repeated from the sections on purpose. A reader who skims the numbers
     * still meets the gaps.
     */
    coverageGaps: Type.Array(
      Type.Object(
        {
          source: Type.String({ minLength: 1, maxLength: 120 }),
          reason: Type.String({ minLength: 1, maxLength: 400 }),
          remedy: Type.Union([Type.String({ maxLength: 400 }), Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
    generatedAt: IsoDateTimeSchema,
    /** The brand revision this was rendered against. */
    brandRevision: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type MarketingReport = Static<typeof MarketingReportSchema>;

export const MarketingReportSummarySchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    title: Type.String(),
    periodStart: DateSchema,
    periodEnd: DateSchema,
    generatedAt: IsoDateTimeSchema,
    /** The worst state across every section, for the list view. */
    state: ReportAvailabilitySchema,
  },
  { additionalProperties: false },
);
export type MarketingReportSummary = Static<
  typeof MarketingReportSummarySchema
>;

export const GenerateReportInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
    start: Type.Optional(DateSchema),
    end: Type.Optional(DateSchema),
    /** Compare against the preceding period of equal length. */
    compare: Type.Optional(Type.Boolean()),
    timezone: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    narrative: Type.Optional(
      Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type GenerateReportInput = Static<typeof GenerateReportInputSchema>;
