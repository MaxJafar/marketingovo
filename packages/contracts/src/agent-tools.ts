import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { RunEvidenceSectionSchema } from "./index.js";

/**
 * Agent adapters deliberately expose workflow-level operations only. This is
 * the single source of truth for their names, descriptions, input validation,
 * and safety annotations. MCP and OpenClaw project these JSON Schemas into
 * their native validator formats at runtime.
 */

const strictObject = <Properties extends Record<string, TSchema>>(
  properties: Properties,
) => Type.Object(properties, { additionalProperties: false });

export const AgentAuditStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  goal: Type.Optional(Type.String({ maxLength: 240 })),
  render_mode: Type.Optional(
    Type.Union([Type.Literal("static"), Type.Literal("js")], {
      default: "static",
    }),
  ),
  collect_vitals: Type.Optional(Type.Boolean({ default: false })),
  max_urls: Type.Optional(Type.Integer({ minimum: 1, maximum: 100_000 })),
});

export const AgentRunGetInputSchema = strictObject({
  run_id: Type.String({ minLength: 1 }),
  include_issues: Type.Optional(Type.Boolean({ default: true })),
});

export const AgentCompareStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  competitor_urls: Type.Array(
    Type.String({ format: "uri", pattern: "^https?://" }),
    { minItems: 1, maxItems: 5 },
  ),
  max_urls: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 1_000, default: 30 }),
  ),
});

export const AgentKeywordResearchStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  seed: Type.String({ minLength: 1, maxLength: 240 }),
});

export const AgentContentPlanStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  seeds: Type.Array(Type.String({ minLength: 1, maxLength: 240 }), {
    minItems: 1,
    maxItems: 10,
  }),
});

export const AgentOsintResearchStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  target_urls: Type.Optional(
    Type.Array(Type.String({ format: "uri", pattern: "^https?://" }), {
      minItems: 1,
      maxItems: 4,
    }),
  ),
  max_urls: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, default: 12 }),
  ),
});

export const AgentMonitoringStatusInputSchema = strictObject({
  project_id: Type.Optional(Type.String({ minLength: 1 })),
});

/**
 * Paid media.
 *
 * An agent gets full read access to ad cabinets and their measured
 * performance, and may draft and stage a campaign. It cannot approve one:
 * that transition requires the browser's own transport and is refused for the
 * service token these tools authenticate with. There is deliberately no
 * publish tool, because nothing in this product publishes yet.
 */

export const AgentAdsCabinetsInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  /** Include cabinets the operator archived. Default is only the active set. */
  include_archived: Type.Optional(Type.Boolean({ default: false })),
});

export const AgentAdsPerformanceInputSchema = strictObject({
  channel_account_id: Type.String({ minLength: 1 }),
  start: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  end: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  /**
   * Also return the queries that triggered ads, most expensive first.
   *
   * Google Ads only, and off by default because it is a large payload that
   * most questions do not need. Terms already added as keywords or negatives
   * are omitted, so what comes back is the list worth acting on.
   */
  include_search_terms: Type.Optional(Type.Boolean({ default: false })),
});

export const AgentAdsAuditStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  start: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  end: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});

export const AgentCampaignStageInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  brief_title: Type.String({ minLength: 1, maxLength: 240 }),
  objective: Type.String({ minLength: 1, maxLength: 2_000 }),
  audience: Type.Optional(Type.String({ maxLength: 2_000 })),
  deliverables: Type.Array(
    strictObject({
      channel: Type.Union([
        Type.Literal("facebook-ad"),
        Type.Literal("instagram-ad"),
        Type.Literal("instagram-post"),
        Type.Literal("instagram-reel"),
        Type.Literal("facebook-post"),
        Type.Literal("seo-article"),
      ]),
      headline: Type.Optional(Type.String({ maxLength: 240 })),
      body: Type.String({ minLength: 1, maxLength: 20_000 }),
      call_to_action: Type.Optional(Type.String({ maxLength: 80 })),
      destination_url: Type.Optional(
        Type.String({ format: "uri", pattern: "^https://", maxLength: 2_000 }),
      ),
      creative_notes: Type.Optional(Type.String({ maxLength: 4_000 })),
    }),
    { minItems: 1, maxItems: 10 },
  ),
});

/**
 * The three read tools below expose stored evidence that agents previously
 * could not reach at all: the paginated evidence workbench, the internal-link
 * graph, and the server-computed run comparison. They read immutable per-run
 * snapshots, so they are idempotent and never touch the network.
 */

export const AgentRunEvidenceInputSchema = strictObject({
  run_id: Type.String({ minLength: 1 }),
  // Reuses the authoritative section union rather than restating it, so an agent
  // cannot be offered a section the evidence API does not serve.
  section: Type.Optional(RunEvidenceSectionSchema),
  search: Type.Optional(Type.String({ maxLength: 240 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const AgentRunLinksInputSchema = strictObject({
  run_id: Type.String({ minLength: 1 }),
  page_url: Type.String({ format: "uri", pattern: "^https?://" }),
  direction: Type.Union([Type.Literal("inlinks"), Type.Literal("outlinks")], {
    default: "inlinks",
  }),
  search: Type.Optional(Type.String({ maxLength: 240 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const AgentRunCompareInputSchema = strictObject({
  run_id: Type.String({ minLength: 1 }),
  baseline_run_id: Type.String({ minLength: 1 }),
});

export type AgentAuditStartInput = Static<typeof AgentAuditStartInputSchema>;
export type AgentRunGetInput = Static<typeof AgentRunGetInputSchema>;
export type AgentCompareStartInput = Static<
  typeof AgentCompareStartInputSchema
>;
export type AgentKeywordResearchStartInput = Static<
  typeof AgentKeywordResearchStartInputSchema
>;
export type AgentContentPlanStartInput = Static<
  typeof AgentContentPlanStartInputSchema
>;
export type AgentOsintResearchStartInput = Static<
  typeof AgentOsintResearchStartInputSchema
>;
export type AgentMonitoringStatusInput = Static<
  typeof AgentMonitoringStatusInputSchema
>;
export type AgentRunEvidenceInput = Static<typeof AgentRunEvidenceInputSchema>;
export type AgentRunLinksInput = Static<typeof AgentRunLinksInputSchema>;
export type AgentRunCompareInput = Static<typeof AgentRunCompareInputSchema>;
export type AgentAdsCabinetsInput = Static<typeof AgentAdsCabinetsInputSchema>;
export type AgentAdsPerformanceInput = Static<
  typeof AgentAdsPerformanceInputSchema
>;
export type AgentAdsAuditStartInput = Static<
  typeof AgentAdsAuditStartInputSchema
>;
export type AgentCampaignStageInput = Static<
  typeof AgentCampaignStageInputSchema
>;
export type AgentBrandKitInput = Static<typeof AgentBrandKitInputSchema>;
export type AgentMarketingReportInput = Static<
  typeof AgentMarketingReportInputSchema
>;
export type AgentCampaignLinkInput = Static<
  typeof AgentCampaignLinkInputSchema
>;
export type AgentEmailDraftInput = Static<typeof AgentEmailDraftInputSchema>;
export type AgentEmailTemplatesInput = Static<
  typeof AgentEmailTemplatesInputSchema
>;

export interface AgentToolSafetyAnnotations {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint: false;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

interface AgentToolContract<Schema extends TSchema = TSchema> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly optional: boolean;
  readonly inputSchema: Schema;
  readonly annotations: AgentToolSafetyAnnotations;
}

const agentTool = <const Contract extends AgentToolContract>(
  contract: Contract,
): Contract => contract;

export const AgentAuditStartTool = agentTool({
  name: "marketingovo_audit_start",
  title: "Start SEO audit",
  description:
    "Start a static or JavaScript audit for an existing local project. Returns immediately with a run id.",
  optional: true,
  inputSchema: AgentAuditStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentRunGetTool = agentTool({
  name: "marketingovo_run_get",
  title: "Get SEO run",
  description:
    "Read current run state and, when finished, its canonical issues. Safe to replay.",
  optional: false,
  inputSchema: AgentRunGetInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentCompareStartTool = agentTool({
  name: "marketingovo_compare_start",
  title: "Start competitor comparison",
  description:
    "Compare a project to one or more public competitor URLs using the same bounded crawl settings.",
  optional: true,
  inputSchema: AgentCompareStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentKeywordResearchStartTool = agentTool({
  name: "marketingovo_keyword_research_start",
  title: "Start keyword research",
  description:
    "Expand a seed across configured sources, classify intent, and evaluate momentum. Returns a run id.",
  optional: true,
  inputSchema: AgentKeywordResearchStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentContentPlanStartTool = agentTool({
  name: "marketingovo_content_plan_start",
  title: "Start content plan",
  description:
    "Build keyword profiles and topic clusters for up to ten seed topics. Returns a run id.",
  optional: true,
  inputSchema: AgentContentPlanStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentOsintResearchStartTool = agentTool({
  name: "marketingovo_osint_research_start",
  title: "Start public-web OSINT research",
  description:
    "Build a bounded, evidence-linked public-web intelligence dossier for the project origin and up to four explicitly supplied public targets. It records exact profile links, structured identity claims, sitemap/robots signals, and publication cadence; it never performs people lookup, authenticated scraping, identity resolution, or dark-web collection.",
  optional: true,
  inputSchema: AgentOsintResearchStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentMonitoringStatusTool = agentTool({
  name: "marketingovo_monitoring_status",
  title: "Read monitoring status",
  description:
    "Read schedules, recent runs, and runtime health without changing configuration.",
  optional: false,
  inputSchema: AgentMonitoringStatusInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentRunEvidenceTool = agentTool({
  name: "marketingovo_run_evidence",
  title: "Read run evidence",
  description:
    "Read one paginated evidence section of a finished run: crawl paths, redirect chains, reciprocal hreflang, or captured extraction results. Reads an immutable snapshot; safe to replay.",
  optional: false,
  inputSchema: AgentRunEvidenceInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentRunLinksTool = agentTool({
  name: "marketingovo_run_links",
  title: "Read internal links for a page",
  description:
    "Read the inlinks or outlinks recorded for one page URL in a finished run, with anchor text, placement, follow state, and resolved or broken targets. Unavailable for runs crawled before the link graph existed.",
  optional: false,
  inputSchema: AgentRunLinksInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentRunCompareTool = agentTool({
  name: "marketingovo_run_compare",
  title: "Compare two runs",
  description:
    "Read the server-computed comparison between two completed audits: new and worsened issues, resolved and reduced findings, HTTP and indexability changes, link-graph deltas, and configuration drift. Never recomputed client-side.",
  optional: false,
  inputSchema: AgentRunCompareInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

/**
 * Email.
 *
 * The loop these exist for: read the brand kit, write HTML, submit it, read
 * the validation report, fix what it names, submit again. The report is what
 * makes this work — a model cannot be relied on to remember that Outlook
 * renders with Word, but it can act on being told so about the line it wrote.
 */

export const AgentBrandKitInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
});

export const AgentEmailDraftInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  subject: Type.String({ minLength: 1, maxLength: 240 }),
  preheader: Type.Optional(Type.String({ maxLength: 240 })),
  html: Type.String({ minLength: 1, maxLength: 1_000_000 }),
  /**
   * Where to keep it. Omit while iterating — a draft that is not worth an
   * operator's attention should not become a revision they scroll past.
   */
  template_id: Type.Optional(Type.String({ minLength: 1 })),
});

export const AgentEmailTemplatesInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  template_id: Type.Optional(Type.String({ minLength: 1 })),
});

export const AgentMarketingReportInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  /** Read an existing report instead of generating one. */
  report_id: Type.Optional(Type.String({ minLength: 1 })),
  start: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  end: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  /**
   * The opening paragraph a client reads.
   *
   * Supplied by you, never derived from the metrics: a sentence assembled
   * from numbers reads as insight while being arithmetic, and a client learns
   * to distrust it.
   */
  narrative: Type.Optional(Type.String({ maxLength: 4_000 })),
});

export const AgentCampaignLinkInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  /** Omit everything else to list the workspace's existing links. */
  destination_url: Type.Optional(
    Type.String({ minLength: 1, maxLength: 2000 }),
  ),
  utm_source: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  utm_medium: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  utm_campaign: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
  utm_term: Type.Optional(Type.String({ maxLength: 160 })),
  utm_content: Type.Optional(Type.String({ maxLength: 160 })),
  /** Where the code will live. Decides the error-correction level and size. */
  placement: Type.Optional(
    Type.Union([
      Type.Literal("screen"),
      Type.Literal("print-handheld"),
      Type.Literal("print-poster"),
      Type.Literal("packaging"),
      Type.Literal("outdoor"),
    ]),
  ),
  /** The width the code will be printed at, so scannability can be judged. */
  printed_width_mm: Type.Optional(Type.Number({ minimum: 1, maximum: 5000 })),
});

export const AgentMarketingReportTool = agentTool({
  name: "marketingovo_marketing_report",
  title: "Generate or read a cross-channel report",
  description:
    "Generate a client-facing report spanning paid, organic search, social publishing, email, the competitive landscape and completed work for a period, or read an existing one with report_id. The operator can download the same document as a chart-carrying PDF from the dashboard. Each section carries its own coverage, and the report names the totals it deliberately refuses to compute — conversions are never summed across channels because Meta's attributed conversions and Analytics key events count overlapping things on different models, and competitor figures are citation counts, never market share. Report each channel's own figures and repeat the refusals; never present a combined number the report declined to produce.",
  optional: true,
  inputSchema: AgentMarketingReportInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentBrandKitTool = agentTool({
  name: "marketingovo_brand_kit",
  title: "Read the brand kit",
  description:
    "Read the workspace's brand kit: colours with their intended use, type stacks and sizes, logo, content width, voice, prohibitions, and the legal footer including the postal address and the ESP's unsubscribe merge tag. Read this before writing any email — the validator checks the result against it.",
  optional: false,
  inputSchema: AgentBrandKitInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentEmailDraftTool = agentTool({
  name: "marketingovo_email_draft",
  title: "Compile and check an email",
  description:
    "Submit email HTML and get back the sanitized, CSS-inlined document, a plain-text alternative, and a validation report naming every problem a real client will have with it — Outlook's Word engine ignoring flexbox, images without alt text that Outlook blocks by default, Gmail clipping past 102KB, missing unsubscribe or postal address, contrast below WCAG AA. Iterate against the report until it is clean. Nothing is stored unless you pass template_id.",
  optional: true,
  inputSchema: AgentEmailDraftInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentEmailTemplatesTool = agentTool({
  name: "marketingovo_email_templates",
  title: "Read email templates",
  description:
    "List a workspace's email templates, or read one with its revision history, compiled HTML and the validation report each revision was saved with. Supply template_id for the full history; omit it for the list.",
  optional: false,
  inputSchema: AgentEmailTemplatesInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentAdsCabinetsTool = agentTool({
  name: "marketingovo_ads_cabinets",
  title: "List ad cabinets",
  description:
    "List the ad accounts linked to a workspace — Meta cabinets covering Facebook and Instagram, and Google Ads customers — with their provider, currency, and the daily and total spend caps the operator set locally. Reads stored local state; contacts no provider.",
  optional: false,
  inputSchema: AgentAdsCabinetsInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentAdsPerformanceTool = agentTool({
  name: "marketingovo_ads_performance",
  title: "Read ad cabinet performance",
  description:
    "Read one ad account's measured spend, impressions, clicks, conversions and derived costs over a date window, split by the surface it ran on — Facebook and Instagram for Meta, Search, Search Partners, Display, YouTube and Performance Max for Google. A metric that was not measured is returned as null with the reason stated, never as zero; reach and frequency have no window total by design. Never add conversions from two providers together: each counts what it takes credit for, on its own attribution model, so one sale can appear in both. Reads stored evidence from the last sync; run marketingovo_ads_audit_start first for current numbers.",
  optional: false,
  inputSchema: AgentAdsPerformanceInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentAdsAuditStartTool = agentTool({
  name: "marketingovo_ads_audit_start",
  title: "Start paid media audit",
  description:
    "Sync every linked ad account — Meta and Google Ads — for a date window and run the paid-media rules over it. Meta: disapproved ads, missing conversion signal, cost-per-conversion drift, creative fatigue, budget under-pacing, local spend-cap breaches. Google: search terms that took money and converted nothing, queries wasting spend across several campaigns, broken conversion tracking, campaigns held back by budget versus by ad rank, broad match without conversion-based bidding, disapproved ads, low quality scores weighted by cost, and duplicate keywords. It also reports how much spend sits in Performance Max and similar, whose queries Google does not expose at all — read a quiet search-term result on such an account as covering only the part that could be inspected. Findings enter the same prioritized action queue as SEO work. Returns a run id; poll marketingovo_run_get until terminal.",
  optional: true,
  inputSchema: AgentAdsAuditStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentCampaignStageTool = agentTool({
  name: "marketingovo_campaign_stage",
  title: "Draft and stage a campaign",
  description:
    "Create a campaign brief and its per-channel deliverables — Facebook and Instagram ad copy, organic posts, an article — as drafts for a person to review. Nothing is sent to any provider and nothing spends money. Approval happens in the dashboard, in a browser, and is refused for agent tooling by design: you draft and stage, a human decides what runs under their brand.",
  optional: true,
  inputSchema: AgentCampaignStageInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentCampaignLinkTool = agentTool({
  name: "marketingovo_campaign_link",
  title: "Build a tagged campaign link and QR code",
  description:
    "Build a UTM-tagged campaign link and its QR code, or list the workspace's existing ones. Checks the tagging before the code exists, because a printed code cannot be corrected: mixed case and spaces split one campaign into two rows no report can merge, source and medium swapped files it under a channel that does not exist, and manual tags on an already auto-tagged platform link destroy the cost data only that platform can supply. Also judges whether the code can physically be scanned at the width it will be printed. Tagging that would lose data is refused rather than recorded. Codes are generated locally and encode the URL directly, so they never expire and no service resolves them.",
  // Creates records, so an operator can allowlist it apart from the read-only
  // tools — the same treatment every other state-changing tool gets.
  optional: true,
  inputSchema: AgentCampaignLinkInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const PUBLIC_AGENT_TOOL_CONTRACTS = [
  AgentAuditStartTool,
  AgentRunGetTool,
  AgentRunEvidenceTool,
  AgentRunLinksTool,
  AgentRunCompareTool,
  AgentCompareStartTool,
  AgentKeywordResearchStartTool,
  AgentContentPlanStartTool,
  AgentOsintResearchStartTool,
  AgentMonitoringStatusTool,
  AgentAdsCabinetsTool,
  AgentAdsPerformanceTool,
  AgentAdsAuditStartTool,
  AgentCampaignStageTool,
  AgentBrandKitTool,
  AgentEmailTemplatesTool,
  AgentEmailDraftTool,
  AgentMarketingReportTool,
  AgentCampaignLinkTool,
] as const;

export type PublicAgentToolContract =
  (typeof PUBLIC_AGENT_TOOL_CONTRACTS)[number];
export type PublicAgentToolName = PublicAgentToolContract["name"];

export const PUBLIC_AGENT_TOOL_NAMES: readonly PublicAgentToolName[] =
  PUBLIC_AGENT_TOOL_CONTRACTS.map((contract) => contract.name);

/**
 * Terminal session tools are a separate group from the nineteen workflow tools
 * above, and the split is intentional rather than tidiness.
 *
 * The workflow tools answer "do this SEO job". These answer "a human is typing
 * at the dashboard console; be the thing that replies". A harness can hold one
 * capability without the other: an operator may want an agent that audits but
 * never speaks into the browser, or a conversational session that only reads.
 * Keeping the registries apart lets an adapter allowlist them independently,
 * and keeps the documented public workflow surface stable at nineteen.
 *
 * None of these tools touch the network beyond the loopback daemon, and none
 * of them start crawls — so the whole group is closed-world.
 */

export const AgentSessionListInputSchema = strictObject({});

export const AgentSessionAttachInputSchema = strictObject({
  session_id: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1, maxLength: 80 }),
  harness: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
});

export const AgentSessionWaitInputSchema = strictObject({
  session_id: Type.String({ minLength: 1 }),
  agent_id: Type.String({ minLength: 1 }),
  wait_ms: Type.Optional(
    Type.Integer({ minimum: 0, maximum: 20_000, default: 20_000 }),
  ),
});

export const AgentSessionSayInputSchema = strictObject({
  session_id: Type.String({ minLength: 1 }),
  agent_id: Type.String({ minLength: 1 }),
  text: Type.String({ minLength: 1, maxLength: 20_000 }),
  kind: Type.Optional(
    Type.Union(
      [
        Type.Literal("message"),
        Type.Literal("thought"),
        Type.Literal("tool"),
        Type.Literal("error"),
      ],
      { default: "message" },
    ),
  ),
  tool: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});

export const AgentSessionDetachInputSchema = strictObject({
  session_id: Type.String({ minLength: 1 }),
  agent_id: Type.String({ minLength: 1 }),
});

export type AgentSessionListInput = Static<typeof AgentSessionListInputSchema>;
export type AgentSessionAttachInput = Static<
  typeof AgentSessionAttachInputSchema
>;
export type AgentSessionWaitInput = Static<typeof AgentSessionWaitInputSchema>;
export type AgentSessionSayInput = Static<typeof AgentSessionSayInputSchema>;
export type AgentSessionDetachInput = Static<
  typeof AgentSessionDetachInputSchema
>;

export const AgentSessionListTool = agentTool({
  name: "marketingovo_session_list",
  title: "List terminal sessions",
  description:
    "List dashboard terminal sessions and whether an agent is already attached to each. Call this first to find the session a marketer is typing into.",
  optional: false,
  inputSchema: AgentSessionListInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentSessionAttachTool = agentTool({
  name: "marketingovo_session_attach",
  title: "Attach to a terminal session",
  description:
    "Claim a dashboard terminal session as its answering agent. Returns an agent_id required by every later session call, plus any turns the marketer typed before you arrived. Only one agent may hold a session at a time.",
  optional: true,
  inputSchema: AgentSessionAttachInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentSessionWaitTool = agentTool({
  name: "marketingovo_session_wait",
  title: "Wait for the next terminal turn",
  description:
    "Block until the marketer types into the terminal, or until wait_ms elapses. An empty result means nobody typed — call it again to keep listening. Also renews the session lease, so a session you stop polling is released for another agent. Check cancel_requested and abandon the current answer when it is true.",
  optional: true,
  inputSchema: AgentSessionWaitInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentSessionSayTool = agentTool({
  name: "marketingovo_session_say",
  title: "Speak into the terminal",
  description:
    "Write a line into the marketer's terminal. Use kind 'message' for the answer, 'thought' for progress narration, 'tool' when reporting a tool you ran, and 'error' when you could not complete the request. Never write credentials or raw provider keys into a session.",
  optional: true,
  inputSchema: AgentSessionSayInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const);

export const AgentSessionDetachTool = agentTool({
  name: "marketingovo_session_detach",
  title: "Detach from a terminal session",
  description:
    "Release a terminal session so another agent can answer it. Call this when you finish a conversation rather than leaving the lease to lapse.",
  optional: true,
  inputSchema: AgentSessionDetachInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const TERMINAL_SESSION_TOOL_CONTRACTS = [
  AgentSessionListTool,
  AgentSessionAttachTool,
  AgentSessionWaitTool,
  AgentSessionSayTool,
  AgentSessionDetachTool,
] as const;

export type TerminalSessionToolContract =
  (typeof TERMINAL_SESSION_TOOL_CONTRACTS)[number];
export type TerminalSessionToolName = TerminalSessionToolContract["name"];

export const TERMINAL_SESSION_TOOL_NAMES: readonly TerminalSessionToolName[] =
  TERMINAL_SESSION_TOOL_CONTRACTS.map((contract) => contract.name);
