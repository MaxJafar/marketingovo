import { Type, type Static } from "@sinclair/typebox";
import {
  IdentifierSchema,
  IsoDateTimeSchema,
  ProblemDetailsSchema,
  UrlSchema,
} from "./index.js";

/**
 * Campaign links and their QR codes.
 *
 * Two things travel together here because they fail together. A QR code is a
 * URL that has been made expensive to change — once it is printed on a
 * banner, the tagging inside it is fixed for the life of the banner. Getting
 * `utm_source=Facebook` instead of `facebook` onto a screen costs nothing to
 * correct; getting it onto ten thousand leaflets means a quarter of reporting
 * where that campaign is split in two and nobody can say why.
 *
 * So the tagging is validated before the code is generated, not after.
 */

/** The five parameters every analytics tool agrees on. */
export const UtmParametersSchema = Type.Object(
  {
    /** Where the traffic came from: `newsletter`, `flyer`, `instagram`. */
    source: Type.String({ minLength: 1, maxLength: 120 }),
    /** How it arrived: `email`, `print`, `social`, `cpc`. */
    medium: Type.String({ minLength: 1, maxLength: 120 }),
    /** Which campaign: `summer-sale-2026`. */
    campaign: Type.String({ minLength: 1, maxLength: 160 }),
    /** Paid keyword. Null outside search advertising. */
    term: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
    /** Which variant, when one campaign has several. */
    content: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type UtmParameters = Static<typeof UtmParametersSchema>;

export const CampaignLinkFindingSeveritySchema = Type.Union([
  /** The data will be wrong or lost. */
  Type.Literal("blocking"),
  /** The data will be usable but harder to read than it should be. */
  Type.Literal("warning"),
  /** A convention worth keeping to. */
  Type.Literal("advice"),
]);
export type CampaignLinkFindingSeverity = Static<
  typeof CampaignLinkFindingSeveritySchema
>;

export const CampaignLinkFindingSchema = Type.Object(
  {
    /** Stable rule id, so an agent can tell the same problem from another. */
    rule: Type.String({ minLength: 1, maxLength: 80 }),
    severity: CampaignLinkFindingSeveritySchema,
    /** What goes wrong, stated as the reporting consequence. */
    message: Type.String({ minLength: 1, maxLength: 600 }),
    /** Which parameter, or null when it is about the link as a whole. */
    field: Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
    /** The one change that fixes it. */
    remedy: Type.Union([Type.String({ maxLength: 600 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type CampaignLinkFinding = Static<typeof CampaignLinkFindingSchema>;

export const QrErrorCorrectionSchema = Type.Union([
  Type.Literal("L"),
  Type.Literal("M"),
  Type.Literal("Q"),
  Type.Literal("H"),
]);
export type QrErrorCorrection = Static<typeof QrErrorCorrectionSchema>;

/**
 * Where the code will physically live.
 *
 * This is asked rather than inferred because it is the only input that
 * decides whether the code works. A code on a coffee cup gets deformed and
 * wet; one on a poster is read from across a room; one on a screen is
 * pristine and close. They want different error correction and different
 * minimum sizes, and defaulting hides that from whoever is about to spend
 * money on printing.
 */
export const QrPlacementSchema = Type.Union([
  Type.Literal("screen"),
  Type.Literal("print-handheld"),
  Type.Literal("print-poster"),
  Type.Literal("packaging"),
  Type.Literal("outdoor"),
]);
export type QrPlacement = Static<typeof QrPlacementSchema>;

const HexColorSchema = Type.String({ pattern: "^#[0-9a-fA-F]{6}$" });

export const QrStyleSchema = Type.Object(
  {
    errorCorrection: QrErrorCorrectionSchema,
    /** Modules of margin. Four is the standard minimum. */
    quietZone: Type.Integer({ minimum: 0, maximum: 16 }),
    darkColor: HexColorSchema,
    lightColor: HexColorSchema,
    /** Drops the background, for placing over artwork. */
    transparent: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type QrStyle = Static<typeof QrStyleSchema>;

export const QrScanVerdictSchema = Type.Union([
  Type.Literal("comfortable"),
  Type.Literal("tight"),
  Type.Literal("unscannable"),
]);
export type QrScanVerdict = Static<typeof QrScanVerdictSchema>;

/**
 * Whether the code can actually be read at the size it will be printed.
 *
 * The one check nobody runs, and the one that costs the most when it fails:
 * a print run is committed before anyone holds a phone up to it.
 */
export const QrPrintAdviceSchema = Type.Object(
  {
    version: Type.Integer({ minimum: 1, maximum: 40 }),
    /** Modules per side, before the quiet zone. */
    moduleCount: Type.Integer({ minimum: 21, maximum: 177 }),
    errorCorrection: QrErrorCorrectionSchema,
    /** The printed width the advice was computed against. */
    printedWidthMm: Type.Number({ minimum: 1 }),
    /** How large one module lands at that width, including the quiet zone. */
    moduleSizeMm: Type.Number({ minimum: 0 }),
    verdict: QrScanVerdictSchema,
    /** The smallest width that would reach `comfortable`. */
    recommendedWidthMm: Type.Number({ minimum: 0 }),
    /** Beyond this a phone camera cannot resolve the modules. */
    maxScanDistanceMm: Type.Number({ minimum: 0 }),
    /** Luminance contrast between the two colours. Under 3 is a real risk. */
    contrastRatio: Type.Number({ minimum: 0 }),
    findings: Type.Array(CampaignLinkFindingSchema, { maxItems: 40 }),
  },
  { additionalProperties: false },
);
export type QrPrintAdvice = Static<typeof QrPrintAdviceSchema>;

export const CampaignLinkSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    /** What an operator calls it. Never appears in the URL. */
    label: Type.String({ minLength: 1, maxLength: 160 }),
    /** The page, before tagging. */
    destinationUrl: UrlSchema,
    utm: UtmParametersSchema,
    /**
     * The tagged URL, stored rather than recomputed.
     *
     * Once a code is printed, this string is what is in the world. Rebuilding
     * it from the parts later — after a convention changed, or after someone
     * corrected a typo — would silently disagree with the paper.
     */
    taggedUrl: Type.String({ minLength: 1, maxLength: 2000 }),
    style: QrStyleSchema,
    placement: QrPlacementSchema,
    /** Intended print width, kept so the advice can be recomputed honestly. */
    printedWidthMm: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
    findings: Type.Array(CampaignLinkFindingSchema, { maxItems: 40 }),
    /**
     * Set once the code has been sent to print.
     *
     * After this the tagged URL is frozen: editing it would mean the physical
     * code points somewhere the record no longer describes.
     */
    printedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type CampaignLink = Static<typeof CampaignLinkSchema>;

export const CreateCampaignLinkInputSchema = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 160 }),
    destinationUrl: UrlSchema,
    utm: UtmParametersSchema,
    style: Type.Optional(Type.Partial(QrStyleSchema)),
    placement: Type.Optional(QrPlacementSchema),
    printedWidthMm: Type.Optional(Type.Number({ minimum: 1 })),
  },
  { additionalProperties: false },
);
export type CreateCampaignLinkInput = Static<
  typeof CreateCampaignLinkInputSchema
>;

/**
 * The hosts where manual tagging destroys the measurement it was meant to
 * provide, because the platform tags automatically and its own parameter wins.
 */
export const AUTO_TAGGED_HOSTS: readonly string[] = [
  "doubleclick.net",
  "googleadservices.com",
];

/**
 * A link checked but not saved.
 *
 * The dashboard asks for this on every edit, so the cost of a tagging choice
 * is visible while it is still free to change rather than after the code has
 * been generated.
 */
export const CampaignLinkPreviewSchema = Type.Object(
  {
    /** Empty when the destination could not be parsed at all. */
    taggedUrl: Type.String({ maxLength: 2000 }),
    /** What the parameters become under the convention, for one-click fixing. */
    normalizedUtm: UtmParametersSchema,
    findings: Type.Array(CampaignLinkFindingSchema, { maxItems: 40 }),
    /** Null when the content could not be encoded. */
    advice: Type.Union([QrPrintAdviceSchema, Type.Null()]),
    /** The code itself, for showing without a second request. */
    svg: Type.Union([Type.String({ maxLength: 400_000 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type CampaignLinkPreview = Static<typeof CampaignLinkPreviewSchema>;

/** Redirect targets for operator-hosted short links. */
export const RedirectTargetSchema = Type.Union([
  Type.Literal("cloudflare-worker"),
  Type.Literal("netlify"),
  Type.Literal("vercel"),
  Type.Literal("nginx"),
  Type.Literal("apache"),
]);
export type RedirectTarget = Static<typeof RedirectTargetSchema>;

export const RedirectConfigResponseSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1, maxLength: 120 }),
    contents: Type.String({ maxLength: 400_000 }),
    /**
     * Whether the platform can enforce an expiry by itself.
     *
     * Static rewrite files cannot. Stating it here is the difference between a
     * scheduled expiry and an intention that something will be edited later.
     */
    enforcesExpiry: Type.Boolean(),
    notes: Type.Array(Type.String({ maxLength: 600 }), { maxItems: 12 }),
    findings: Type.Array(CampaignLinkFindingSchema, { maxItems: 40 }),
  },
  { additionalProperties: false },
);
export type RedirectConfigResponse = Static<
  typeof RedirectConfigResponseSchema
>;

/**
 * A refusal, with the findings that caused it.
 *
 * The standard problem shape carries a single sentence, and a serializer keeps
 * only the fields its schema declares — so a refusal sent through it arrives
 * as "the link was rejected" with the remedies stripped off. That is the least
 * useful possible answer here: the caller is one edit away from a valid link
 * and cannot see which edit.
 */
export const CampaignLinkProblemSchema = Type.Composite([
  ProblemDetailsSchema,
  Type.Object({
    findings: Type.Array(CampaignLinkFindingSchema, { maxItems: 40 }),
  }),
]);
export type CampaignLinkProblem = Static<typeof CampaignLinkProblemSchema>;
