import { Type, type Static } from "@sinclair/typebox";
import { IdentifierSchema, IsoDateTimeSchema } from "./index.js";

/**
 * The email builder: a brand kit an agent composes against, and a compiler
 * that decides whether what it wrote will survive a real inbox.
 *
 * The split here is the point. An agent writes the HTML; the product does not
 * trust it. Everything an agent produces is sanitized, inlined and checked
 * against what email clients actually do, and the report comes back in terms
 * specific enough to fix — "Outlook renders with Word and ignores flexbox",
 * not "invalid CSS".
 *
 * That is also why the report is a contract rather than an internal detail:
 * it is what the agent iterates against, so it has to be stable and legible.
 */

/* ------------------------------------------------------------------ */
/* Brand kit                                                           */
/* ------------------------------------------------------------------ */

const HexColorSchema = Type.String({
  pattern: "^#[0-9a-fA-F]{6}$",
  minLength: 7,
  maxLength: 7,
});

/**
 * A named colour.
 *
 * Six-digit hex only. Email clients disagree about `rgba()`, three-digit hex
 * and named colours, and Outlook's Word engine is the least forgiving of the
 * three — so the one form every client agrees on is the only form stored.
 */
export const BrandColorSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 60 }),
    value: HexColorSchema,
    /** What this colour is for, so an agent picks it for the right reason. */
    usage: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BrandColor = Static<typeof BrandColorSchema>;

/**
 * A type stack.
 *
 * `stack` must end in a generic family, because a web font in email is a
 * suggestion: Outlook and Gmail's mobile apps ignore `@font-face` entirely and
 * fall back to whatever the stack names next. A brand that specifies only its
 * custom face is specifying nothing for most recipients.
 */
export const BrandTypefaceSchema = Type.Object(
  {
    role: Type.Union([
      Type.Literal("heading"),
      Type.Literal("body"),
      Type.Literal("mono"),
    ]),
    stack: Type.String({ minLength: 1, maxLength: 400 }),
    /** Base size in pixels. Email clients handle px far better than rem. */
    sizePx: Type.Integer({ minimum: 8, maximum: 72 }),
    lineHeight: Type.Number({ minimum: 1, maximum: 3 }),
    weight: Type.Integer({ minimum: 100, maximum: 900 }),
  },
  { additionalProperties: false },
);
export type BrandTypeface = Static<typeof BrandTypefaceSchema>;

/**
 * The legally required footer of a commercial email.
 *
 * A postal address is mandatory under CAN-SPAM and its equivalents, and an
 * unsubscribe mechanism is mandatory almost everywhere. Marketingovo does not
 * send, so it cannot enforce either — but a template built without them is one
 * an operator will paste into their ESP and send, so the fields exist and the
 * validator says when they are missing.
 */
export const BrandFooterSchema = Type.Object(
  {
    companyName: Type.String({ minLength: 1, maxLength: 240 }),
    postalAddress: Type.String({ minLength: 1, maxLength: 500 }),
    /**
     * The merge tag the operator's ESP uses, e.g. `{{unsubscribe_url}}` or
     * `*|UNSUB|*`. Stored verbatim because every ESP spells it differently and
     * guessing produces a dead link in a legally required place.
     */
    unsubscribePlaceholder: Type.String({ minLength: 1, maxLength: 240 }),
    /** Anything else the brand always includes: VAT number, disclaimer. */
    legalNotes: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type BrandFooter = Static<typeof BrandFooterSchema>;

export const BrandKitProfileSchema = Type.Object(
  {
    /** Colours, with the first entry treated as the primary brand colour. */
    colors: Type.Array(BrandColorSchema, { maxItems: 24 }),
    typefaces: Type.Array(BrandTypefaceSchema, { maxItems: 6 }),
    /** A media asset id from the library. Emails need a hosted URL for it. */
    logoMediaId: Type.Union([IdentifierSchema, Type.Null()]),
    logoAltText: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    /** Maximum body width in pixels. 600 is the long-standing safe default. */
    contentWidthPx: Type.Integer({ minimum: 320, maximum: 900 }),
    /** Corner radius for buttons. Outlook squares them regardless; stated so. */
    buttonRadiusPx: Type.Integer({ minimum: 0, maximum: 40 }),
    /** How the brand sounds, for the agent writing the copy. */
    voice: Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    /** Things never to do. Read by the agent alongside the voice. */
    prohibitions: Type.Array(Type.String({ maxLength: 400 }), { maxItems: 40 }),
    footer: BrandFooterSchema,
    /**
     * The uploaded guideline document, when there is one.
     *
     * Reference material, never authoritative: a token that matters must be
     * entered above, where it can be validated against. An agent may propose
     * values from this file, and a person confirms them.
     */
    referenceMediaId: Type.Union([IdentifierSchema, Type.Null()]),
    referenceNotes: Type.Union([
      Type.String({ maxLength: 8_000 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type BrandKitProfile = Static<typeof BrandKitProfileSchema>;

export const BrandKitVersionSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    revision: Type.Integer({ minimum: 1 }),
    profile: BrandKitProfileSchema,
    changeSummary: Type.String({ minLength: 1, maxLength: 500 }),
    actor: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type BrandKitVersion = Static<typeof BrandKitVersionSchema>;

export const BrandKitWorkspaceSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    current: Type.Union([BrandKitVersionSchema, Type.Null()]),
    history: Type.Array(BrandKitVersionSchema),
  },
  { additionalProperties: false },
);
export type BrandKitWorkspace = Static<typeof BrandKitWorkspaceSchema>;

export const UpdateBrandKitInputSchema = Type.Object(
  {
    profile: BrandKitProfileSchema,
    changeSummary: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);
export type UpdateBrandKitInput = Static<typeof UpdateBrandKitInputSchema>;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * How badly a finding breaks the email.
 *
 * `blocking` means the compiler changed the document — something was removed
 * because it was unsafe. `error` means a client will visibly break. `warning`
 * means one client degrades. `info` is worth knowing and nothing more.
 */
export const EmailFindingSeveritySchema = Type.Union([
  Type.Literal("blocking"),
  Type.Literal("error"),
  Type.Literal("warning"),
  Type.Literal("info"),
]);
export type EmailFindingSeverity = Static<typeof EmailFindingSeveritySchema>;

export const EmailFindingSchema = Type.Object(
  {
    /** Stable rule id, so an agent can tell "the same problem" from "another". */
    rule: Type.String({ minLength: 1, maxLength: 80 }),
    severity: EmailFindingSeveritySchema,
    /** What is wrong, in terms of what a client will do about it. */
    message: Type.String({ minLength: 1, maxLength: 600 }),
    /** Which element, as a readable path like `body > table:nth-child(2)`. */
    where: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    /** The one change that fixes it. */
    remedy: Type.Union([Type.String({ maxLength: 600 }), Type.Null()]),
    /** Clients this actually affects, named rather than implied. */
    affects: Type.Array(Type.String({ maxLength: 60 }), { maxItems: 12 }),
  },
  { additionalProperties: false },
);
export type EmailFinding = Static<typeof EmailFindingSchema>;

export const EmailValidationReportSchema = Type.Object(
  {
    ok: Type.Boolean(),
    findings: Type.Array(EmailFindingSchema),
    /** Compiled size in bytes, and whether Gmail will clip it. */
    sizeBytes: Type.Integer({ minimum: 0 }),
    gmailClips: Type.Boolean(),
    /** Counts an operator glances at before reading the list. */
    counts: Type.Object(
      {
        blocking: Type.Integer({ minimum: 0 }),
        error: Type.Integer({ minimum: 0 }),
        warning: Type.Integer({ minimum: 0 }),
        info: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type EmailValidationReport = Static<typeof EmailValidationReportSchema>;

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export const EmailTemplateVersionSchema = Type.Object(
  {
    templateId: IdentifierSchema,
    revision: Type.Integer({ minimum: 1 }),
    subject: Type.String({ minLength: 1, maxLength: 240 }),
    /**
     * The line an inbox shows after the subject.
     *
     * Absent, clients scrape the first text in the body — usually "View in
     * browser" or an image alt — which is a wasted line in the only preview a
     * recipient sees before deciding to open.
     */
    preheader: Type.String({ maxLength: 240 }),
    /** Exactly what the author submitted, before any processing. */
    sourceHtml: Type.String({ maxLength: 1_000_000 }),
    /** Sanitized and inlined. This is what an operator exports. */
    compiledHtml: Type.String({ maxLength: 1_000_000 }),
    /** The plain-text alternative, derived from the compiled document. */
    plainText: Type.String({ maxLength: 200_000 }),
    report: EmailValidationReportSchema,
    /** The brand revision this was compiled against. */
    brandRevision: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    createdBy: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type EmailTemplateVersion = Static<typeof EmailTemplateVersionSchema>;

export const EmailTemplateSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    name: Type.String({ minLength: 1, maxLength: 240 }),
    purpose: Type.Union([Type.String({ maxLength: 1_000 }), Type.Null()]),
    latestRevision: Type.Integer({ minimum: 0 }),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type EmailTemplate = Static<typeof EmailTemplateSchema>;

export const EmailTemplateWorkspaceSchema = Type.Object(
  {
    template: EmailTemplateSchema,
    current: Type.Union([EmailTemplateVersionSchema, Type.Null()]),
    history: Type.Array(EmailTemplateVersionSchema),
  },
  { additionalProperties: false },
);
export type EmailTemplateWorkspace = Static<
  typeof EmailTemplateWorkspaceSchema
>;

export const CreateEmailTemplateInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    name: Type.String({ minLength: 1, maxLength: 240 }),
    purpose: Type.Optional(
      Type.Union([Type.String({ maxLength: 1_000 }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type CreateEmailTemplateInput = Static<
  typeof CreateEmailTemplateInputSchema
>;

export const CompileEmailInputSchema = Type.Object(
  {
    subject: Type.String({ minLength: 1, maxLength: 240 }),
    preheader: Type.Optional(Type.String({ maxLength: 240 })),
    html: Type.String({ minLength: 1, maxLength: 1_000_000 }),
  },
  { additionalProperties: false },
);
export type CompileEmailInput = Static<typeof CompileEmailInputSchema>;

/**
 * A compile that was not stored.
 *
 * The agent's loop uses this: submit HTML, read the report, fix, submit again.
 * Only the version it decides to keep becomes a revision, so twenty iterations
 * do not become twenty rows an operator has to scroll past.
 */
export const EmailPreviewSchema = Type.Object(
  {
    subject: Type.String(),
    preheader: Type.String(),
    compiledHtml: Type.String(),
    plainText: Type.String(),
    report: EmailValidationReportSchema,
  },
  { additionalProperties: false },
);
export type EmailPreview = Static<typeof EmailPreviewSchema>;
