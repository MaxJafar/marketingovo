import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ActionSchema,
  ActionCheckpointSchema,
  ActionEvidenceWorkspaceSchema,
  ActionOutcomeObservationSchema,
  ActionVerificationStartSchema,
  AppendProjectContextJournalInputSchema,
  CapabilitiesSchema,
  CreateProjectInputSchema,
  DeleteProjectInputSchema,
  ExtractionPreviewSchema,
  ExtractionRuleTemplateCatalogSchema,
  ExtractionRuleWorkspaceSchema,
  IssueInstanceSchema,
  IssueReviewItemSchema,
  IssueReviewPageSchema,
  ProblemDetailsSchema,
  ProjectOverviewSchema,
  ProjectDeletionReceiptSchema,
  ProjectContextJournalEntrySchema,
  ProjectContextWorkspaceSchema,
  ProjectSchema,
  RunEvidencePageSchema,
  RunLinkExplorerSchema,
  RunComparisonSchema,
  RunReplaySchema,
  RunSchema,
  ScheduleSchema,
  StartRunInputSchema,
  PreviewExtractionRulesInputSchema,
  UpdateExtractionRulesInputSchema,
  UpdateActionInputSchema,
  UpdateIssueAdjudicationInputSchema,
  UpdateProjectContextInputSchema,
  type Action,
  type ActionEvidenceWorkspace,
  type ActionService,
  type Integration,
  type MetricValue,
  type ExtractionRule,
  type ProjectContextProfile,
  type Run,
} from "@marketingovo/contracts";
import {
  MARKETINGOVO_PROJECT_BUNDLE_LIMITS,
  MarketingovoProjectBundleV2Schema,
  ProjectImportResultSchema,
} from "@marketingovo/contracts/project-bundle";
import { getConnectorManifest } from "@marketingovo/integrations";
import {
  ActionCheckpointError,
  ActionEvidenceCursorError,
  MarketingovoLocalRuntime,
  ExtractionRulesError,
  IssueAdjudicationError,
  nextCronOccurrence,
  ProjectBundleError,
  ProjectContextError,
  ProjectDeletionError,
  resolveGoogleDesktopClientId,
  RunComparisonError,
  RunLinkExplorerError,
  RunReplayError,
} from "@marketingovo/runtime";
import {
  ActionCheckpointInputSchema,
  ActionEvidenceQuerySchema,
  ActionVerificationInputSchema,
  DashboardActionCheckpointSchema,
  DashboardActionEvidenceResponseSchema,
  DashboardActionOutcomesSchema,
  dashboardActionCheckpoint,
  dashboardActionEvidence,
  dashboardActionOutcomes,
} from "./action-workbench.js";
import {
  GoogleDesktopOAuthBroker,
  OAuthBrokerProblem,
} from "./google-oauth.js";
import {
  dashboardPageIndexability,
  storedIndexabilityReason,
} from "./page-indexability.js";
import {
  brandPresenceItems,
  competitorDashboardItems,
  contentGapTerms,
  keywordDashboardWorkspace,
  parseResearchArtifact,
} from "./research-dashboard.js";

export {
  GoogleDesktopOAuthBroker,
  OAuthBrokerProblem,
} from "./google-oauth.js";

export interface LocalServerOptions {
  runtime: MarketingovoLocalRuntime;
  host?: "127.0.0.1";
  port?: number;
  dashboardDir?: string;
  serviceTokenPath?: string;
  logger?: boolean;
  /** Public OAuth desktop client ID; this is not a client secret. */
  googleDesktopClientId?: string;
  /** Injectable transport for deterministic OAuth token-exchange tests. */
  oauthFetch?: typeof fetch;
  oauthTransactionTtlMs?: number;
  oauthNow?: () => number;
  /** Short lifetime for one-time dashboard bootstrap tickets. Defaults to 60 seconds. */
  bootstrapTokenTtlMs?: number;
  /** Injectable clock for deterministic bootstrap expiry tests. */
  bootstrapNow?: () => number;
}

export interface LocalServer {
  app: FastifyInstance;
  runtime: MarketingovoLocalRuntime;
  host: "127.0.0.1";
  port: number;
  serviceTokenPath: string;
  listen(): Promise<string>;
  close(): Promise<void>;
}

interface Session {
  csrf: string;
  expiresAt: number;
}

interface BootstrapTicket {
  expiresAt: number;
}

const MARKETINGOVO_SESSION_COOKIE = "marketingovo_session";
const MARKETINGOVO_CLIENT_HEADER = "x-marketingovo-client";
const MARKETINGOVO_CSRF_HEADER = "x-marketingovo-csrf";

// Exactly one accepted name per credential. The rebrand deliberately did not
// carry a second accepted session cookie or CSRF header forward: the session is
// same-origin and short lived, so a rename costs one re-login, while a second
// accepted auth name is a permanent widening of the authenticated surface.
function headerValue(
  request: FastifyRequest,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

function requestSessionId(request: FastifyRequest): string | undefined {
  return request.cookies[MARKETINGOVO_SESSION_COOKIE];
}

function requestCsrfToken(request: FastifyRequest): string | undefined {
  return headerValue(request, MARKETINGOVO_CSRF_HEADER);
}

function isDashboardRequest(request: FastifyRequest): boolean {
  return headerValue(request, MARKETINGOVO_CLIENT_HEADER) === "dashboard";
}

function setSessionCookies(reply: FastifyReply, sessionId: string): void {
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    secure: false,
    maxAge: 12 * 60 * 60,
  };
  reply.setCookie(MARKETINGOVO_SESSION_COOKIE, sessionId, options);
}

const DashboardClientHeaderSchemaProperties = {
  [MARKETINGOVO_CLIENT_HEADER]: Type.Optional(Type.Literal("dashboard")),
};

const terminalStatuses = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const secureEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
};

function ensureServiceToken(path: string): string {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) return readFileSync(path, "utf8").trim();
  const token = randomBytes(32).toString("base64url");
  writeFileSync(path, `${token}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* platform ACL may own this */
  }
  return token;
}

const envelope = <T>(
  data: T,
  state: "fresh" | "stale" | "missing" | "unavailable" | "unknown" = "fresh",
  warnings: string[] = [],
) => ({
  data,
  meta: { state, generatedAt: new Date().toISOString(), warnings },
});

function metric(
  metricValue: MetricValue,
  unit: "number" | "percent" = "number",
) {
  return {
    value:
      metricValue.value === null
        ? null
        : unit === "percent"
          ? metricValue.value * 100
          : metricValue.value,
    unit,
    status: metricValue.state === "available" ? "fresh" : metricValue.state,
    updatedAt: metricValue.observedAt,
    coverage: metricValue.coverage === null ? null : metricValue.coverage * 100,
    note: metricValue.note,
  };
}

function dashboardAction(action: Action) {
  const priority =
    action.priorityScore >= 80
      ? "critical"
      : action.priorityScore >= 60
        ? "high"
        : action.priorityScore >= 35
          ? "medium"
          : "low";
  return {
    id: action.id,
    title: action.title,
    summary: action.whyNow,
    status: action.status,
    priority,
    priorityScore: action.priorityScore,
    priorityExplanation: `priority-v1: severity ${action.scoreInputs.severity.toFixed(2)}, organic ${action.scoreInputs.organicExposure?.toFixed(2) ?? "unavailable"}, conversion ${action.scoreInputs.conversionExposure?.toFixed(2) ?? "unavailable"}, reach ${action.scoreInputs.urlReach.toFixed(2)}, confidence ${action.scoreInputs.confidence.toFixed(2)}.`,
    impact:
      action.impact >= 0.7 ? "high" : action.impact >= 0.4 ? "medium" : "low",
    effort:
      action.effort === "low"
        ? "small"
        : action.effort === "high"
          ? "large"
          : "medium",
    confidence: action.confidence,
    whyNow: action.whyNow,
    affectedUrls: action.affectedUrls.length,
    owner: action.owner,
    evidence: action.affectedUrls.slice(0, 5).map((url) => ({
      label: "Affected URL",
      value: url,
      source: "crawl",
      url,
    })),
  };
}

function dashboardCoreWebVitals(
  payload: Record<string, unknown>,
): "pass" | "needs_improvement" | "fail" | "unavailable" {
  const vitals = payload.vitals;
  if (!vitals || typeof vitals !== "object" || Array.isArray(vitals)) {
    return "unavailable";
  }
  const record = vitals as Record<string, unknown>;
  const value = (key: string): number | null => {
    const candidate = record[key];
    return typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0
      ? candidate
      : null;
  };
  const lcp = value("lcp");
  const cls = value("cls");
  const ttfb = value("ttfb");
  if (lcp === null || cls === null) return "unavailable";
  if (lcp > 4_000 || cls > 0.25 || (ttfb !== null && ttfb > 1_800)) {
    return "fail";
  }
  if (lcp > 2_500 || cls > 0.1 || (ttfb !== null && ttfb > 800)) {
    return "needs_improvement";
  }
  return "pass";
}

const CreateScheduleInputSchema = Type.Object(
  {
    projectId: Type.String({ minLength: 1 }),
    cron: Type.String({ minLength: 5, maxLength: 120 }),
    timezone: Type.String({ minLength: 1, maxLength: 80 }),
    enabled: Type.Boolean(),
    nextRunAt: Type.Optional(Type.String({ format: "date-time" })),
  },
  { additionalProperties: false },
);

const UpdateScheduleInputSchema = Type.Partial(
  Type.Object({
    cron: Type.String({ minLength: 5, maxLength: 120 }),
    timezone: Type.String({ minLength: 1, maxLength: 80 }),
    enabled: Type.Boolean(),
    nextRunAt: Type.String({ format: "date-time" }),
  }),
  { additionalProperties: false, minProperties: 1 },
);

const IdentifierParamsSchema = Type.Object(
  { id: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);
const DeleteProjectBodySchema = Type.Omit(DeleteProjectInputSchema, [
  "projectId",
]);
const UpdateProjectContextBodySchema = Type.Omit(
  UpdateProjectContextInputSchema,
  ["projectId"],
  { additionalProperties: false },
);
const AppendProjectContextJournalBodySchema = Type.Omit(
  AppendProjectContextJournalInputSchema,
  ["projectId"],
  { additionalProperties: false },
);
const UpdateExtractionRulesBodySchema = Type.Omit(
  UpdateExtractionRulesInputSchema,
  ["projectId"],
  { additionalProperties: false },
);
const PreviewExtractionRulesBodySchema = Type.Omit(
  PreviewExtractionRulesInputSchema,
  ["projectId"],
  { additionalProperties: false },
);

const FingerprintParamsSchema = Type.Object(
  {
    fingerprint: Type.String({ minLength: 16, maxLength: 128 }),
  },
  { additionalProperties: false },
);

const ProviderParamsSchema = Type.Object(
  {
    provider: Type.String({
      minLength: 1,
      maxLength: 80,
      pattern: "^[a-z0-9][a-z0-9-]*$",
    }),
  },
  { additionalProperties: false },
);

const ProjectSelectorQuerySchema = Type.Object(
  {
    projectId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    siteId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
  },
  { additionalProperties: false },
);

const RunListQuerySchema = ProjectSelectorQuerySchema;
const RunComparisonQuerySchema = Type.Object(
  {
    baselineRunId: Type.String({ minLength: 1, maxLength: 160 }),
  },
  { additionalProperties: false },
);
const RunEvidenceQuerySchema = Type.Object(
  {
    section: Type.Optional(
      Type.Union([
        Type.Literal("crawl"),
        Type.Literal("redirects"),
        Type.Literal("hreflang"),
        Type.Literal("extractions"),
      ]),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
    offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 1_000_000 })),
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
  },
  { additionalProperties: false },
);
const RunLinksQuerySchema = Type.Object(
  {
    pageUrl: Type.String({ format: "uri", pattern: "^https?://" }),
    direction: Type.Optional(
      Type.Union([Type.Literal("inlinks"), Type.Literal("outlinks")]),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
    offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 1_000_000 })),
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
  },
  { additionalProperties: false },
);
const ActionsListQuerySchema = ProjectSelectorQuerySchema;
const IntegrationsListQuerySchema = ProjectSelectorQuerySchema;
const IssuesListQuerySchema = Type.Object(
  {
    projectId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    siteId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
    offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 250_000 })),
    status: Type.Optional(
      Type.Union([
        Type.Literal("open"),
        Type.Literal("resolved"),
        Type.Literal("ignored"),
        Type.Literal("false_positive"),
      ]),
    ),
    severity: Type.Optional(
      Type.Union([
        Type.Literal("critical"),
        Type.Literal("high"),
        Type.Literal("medium"),
        Type.Literal("low"),
        Type.Literal("info"),
      ]),
    ),
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
  },
  { additionalProperties: false },
);

const ProblemResponse = (description: string) => ({
  description,
  content: {
    "application/problem+json": { schema: ProblemDetailsSchema },
  },
});

const StandardProblemResponses = {
  400: ProblemResponse("The request is invalid."),
  401: ProblemResponse("Authentication is required."),
  403: ProblemResponse("The request failed CSRF or authorization checks."),
  421: ProblemResponse("The request Host header is not accepted."),
  500: ProblemResponse("The local service could not complete the request."),
};

const strictOptionalBodyValidator =
  ({ schema, httpPart }: { schema: unknown; httpPart?: string }) =>
  (value: unknown): boolean =>
    (httpPart === "body" && value === undefined) ||
    Value.Check(schema as TSchema, value);

const ConnectorConfigurationValueSchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
]);

const PublicIntegrationSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1, maxLength: 160 }),
    label: Type.String(),
    status: Type.Union([
      Type.Literal("connected"),
      Type.Literal("degraded"),
      Type.Literal("expired"),
      Type.Literal("rate_limited"),
      Type.Literal("failed"),
      Type.Literal("not_configured"),
    ]),
    maskedIdentifier: Type.Union([Type.String(), Type.Null()]),
    scopes: Type.Array(Type.String()),
    lastSyncAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    nextSyncAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    quota: Type.Union([
      Type.Object(
        {
          remaining: Type.Number(),
          limit: Type.Union([Type.Number(), Type.Null()]),
          resetsAt: Type.Union([
            Type.String({ format: "date-time" }),
            Type.Null(),
          ]),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    configuration: Type.Optional(
      Type.Record(Type.String(), ConnectorConfigurationValueSchema),
    ),
  },
  { additionalProperties: false },
);

const DashboardMetaSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("fresh"),
      Type.Literal("stale"),
      Type.Literal("missing"),
      Type.Literal("unavailable"),
      Type.Literal("unknown"),
    ]),
    generatedAt: Type.String({ format: "date-time" }),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

const DashboardEnvelopeSchema = <T extends TSchema>(data: T) =>
  Type.Object(
    { data, meta: DashboardMetaSchema },
    { additionalProperties: false },
  );

const DashboardRunSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 160 }),
    workflowId: Type.String({ minLength: 1, maxLength: 160 }),
    startedAt: Type.String({ format: "date-time" }),
    completedAt: Type.Union([
      Type.String({ format: "date-time" }),
      Type.Null(),
    ]),
    status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("partial"),
      Type.Literal("failed"),
      Type.Literal("cancelled"),
    ]),
    progress: Type.Number({ minimum: 0, maximum: 1 }),
    trigger: Type.Literal("manual"),
    pagesCrawled: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    issuesFound: Type.Number({ minimum: 0 }),
    healthScore: Type.Union([
      Type.Number({ minimum: 0, maximum: 100 }),
      Type.Null(),
    ]),
    message: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardRunReplaySchema = Type.Object(
  {
    sourceRunId: Type.String({ minLength: 1, maxLength: 160 }),
    configurationVersion: Type.Literal(1),
    configurationHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    run: DashboardRunSchema,
  },
  { additionalProperties: false },
);

const DashboardRunDetailSchema = Type.Composite(
  [
    DashboardRunSchema,
    Type.Object(
      {
        summary: Type.String(),
        issueBreakdown: Type.Array(
          Type.Object(
            {
              severity: Type.String(),
              count: Type.Integer({ minimum: 0 }),
            },
            { additionalProperties: false },
          ),
        ),
        log: Type.Array(
          Type.Object(
            {
              at: Type.String({ format: "date-time" }),
              message: Type.String(),
              level: Type.Union([Type.Literal("info"), Type.Literal("error")]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

const DashboardActionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 160 }),
    title: Type.String(),
    summary: Type.String(),
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("acknowledged"),
      Type.Literal("in_progress"),
      Type.Literal("resolved"),
    ]),
    priority: Type.Union([
      Type.Literal("critical"),
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ]),
    priorityScore: Type.Number({ minimum: 0, maximum: 100 }),
    priorityExplanation: Type.String(),
    impact: Type.Union([
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ]),
    effort: Type.Union([
      Type.Literal("small"),
      Type.Literal("medium"),
      Type.Literal("large"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    whyNow: Type.String(),
    affectedUrls: Type.Integer({ minimum: 0 }),
    owner: Type.Union([Type.String(), Type.Null()]),
    evidence: Type.Array(
      Type.Object(
        {
          label: Type.String(),
          value: Type.String({ format: "uri" }),
          source: Type.Literal("crawl"),
          url: Type.String({ format: "uri" }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const DashboardIntegrationSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    category: Type.Literal("Data source"),
    status: Type.Union([
      Type.Literal("connected"),
      Type.Literal("degraded"),
      Type.Literal("expired"),
      Type.Literal("rate_limited"),
      Type.Literal("failed"),
      Type.Literal("not_configured"),
    ]),
    description: Type.Union([Type.String(), Type.Null()]),
    accountLabel: Type.Union([Type.String(), Type.Null()]),
    lastSyncAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    quota: Type.Union([
      Type.Object(
        {
          remaining: Type.Number(),
          limit: Type.Union([Type.Number(), Type.Null()]),
          resetsAt: Type.Union([
            Type.String({ format: "date-time" }),
            Type.Null(),
          ]),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    lastError: Type.Union([Type.String(), Type.Null()]),
    permissions: Type.Array(Type.String()),
    supportsApiKey: Type.Boolean(),
    setupUrl: Type.Union([Type.String(), Type.Null()]),
    credentialFields: Type.Array(
      Type.Object(
        {
          key: Type.String(),
          label: Type.String(),
          type: Type.Union([Type.Literal("text"), Type.Literal("secret")]),
          required: Type.Boolean(),
        },
        { additionalProperties: false },
      ),
    ),
    configuration: Type.Record(
      Type.String(),
      ConnectorConfigurationValueSchema,
    ),
    configurationFields: Type.Array(
      Type.Object(
        {
          key: Type.String(),
          label: Type.String(),
          required: Type.Boolean(),
          placeholder: Type.String(),
          help: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const IntegrationRouteResponseSchema = Type.Union([
  PublicIntegrationSchema,
  DashboardEnvelopeSchema(DashboardIntegrationSchema),
]);

const IntegrationConfigurationInputSchema = Type.Object(
  {
    projectId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    siteId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    configuration: Type.Record(
      Type.String({ minLength: 1, maxLength: 80 }),
      ConnectorConfigurationValueSchema,
      { maxProperties: 32 },
    ),
  },
  { additionalProperties: false },
);

const IntegrationCredentialsInputSchema = Type.Object(
  {
    credentials: Type.Record(
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.String({ minLength: 1, maxLength: 8192 }),
      {
        minProperties: 1,
        maxProperties: 8,
        writeOnly: true,
        description:
          "Write-only connector credential fields. Values are stored in the local vault and never returned.",
      },
    ),
    account: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: "^[a-zA-Z0-9._-]+$",
      }),
    ),
  },
  { additionalProperties: false },
);

const IntegrationTestInputSchema = Type.Optional(
  Type.Object(
    {
      projectId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
      siteId: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    },
    { additionalProperties: false },
  ),
);

const OAuthStartInputSchema = Type.Optional(
  Type.Object(
    {
      account: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 64,
          pattern: "^[a-zA-Z0-9._-]+$",
        }),
      ),
    },
    { additionalProperties: false },
  ),
);

const OAuthStartResponseSchema = Type.Object(
  {
    provider: Type.String(),
    authorizationUrl: Type.String({ format: "uri" }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

const DashboardKeywordOpportunitySchema = Type.Object(
  {
    id: Type.String(),
    keyword: Type.String(),
    intent: Type.String(),
    position: Type.Union([Type.Number(), Type.Null()]),
    clicks: Type.Union([Type.Number(), Type.Null()]),
    impressions: Type.Union([Type.Number(), Type.Null()]),
    volume: Type.Union([Type.Number(), Type.Null()]),
    difficulty: Type.Union([Type.Number(), Type.Null()]),
    opportunityScore: Type.Union([Type.Number(), Type.Null()]),
    targetUrl: Type.Union([Type.String(), Type.Null()]),
    cluster: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardKeywordClusterSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    keywords: Type.Integer({ minimum: 0 }),
    contentCoverage: Type.Union([Type.Number(), Type.Null()]),
    recommendedBrief: Type.String(),
  },
  { additionalProperties: false },
);

const DashboardProviderUsageSchema = Type.Object(
  {
    actualCostUsd: Type.Number({ minimum: 0 }),
    billableRequests: Type.Integer({ minimum: 0 }),
    unreportedBillableRequests: Type.Integer({ minimum: 0 }),
    freeRequests: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const DashboardBrandProfileSchema = Type.Object(
  {
    id: Type.String(),
    label: Type.String(),
    url: Type.String(),
    linkingPageCount: Type.Integer({ minimum: 0 }),
    linkedFrom: Type.Array(Type.String()),
    declaredInSameAs: Type.Boolean(),
    reachability: Type.Union([
      Type.Literal("reachable"),
      Type.Literal("unreachable"),
      Type.Literal("unchecked"),
    ]),
    reachabilityDetail: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardContentGapTermSchema = Type.Object(
  {
    term: Type.String(),
    referencesCovering: Type.Integer({ minimum: 0 }),
    referenceDensity: Type.Union([Type.Number(), Type.Null()]),
    targetDensity: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardCompetitorSchema = Type.Object(
  {
    id: Type.String(),
    domain: Type.String(),
    technicalHealth: Type.Union([Type.Number(), Type.Null()]),
    technicalHealthChange: Type.Union([Type.Number(), Type.Null()]),
    sharedKeywords: Type.Union([Type.Number(), Type.Null()]),
    keywordGaps: Type.Union([Type.Number(), Type.Null()]),
    contentGaps: Type.Union([Type.Number(), Type.Null()]),
    cadenceDays: Type.Union([Type.Number(), Type.Null()]),
    freshnessSeconds: Type.Union([Type.Number(), Type.Null()]),
    lastUpdatedAt: Type.Union([
      Type.String({ format: "date-time" }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const DashboardSettingsInputSchema = Type.Partial(
  Type.Object({
    siteName: Type.String({ minLength: 1, maxLength: 160 }),
    siteUrl: Type.String({ minLength: 1, maxLength: 2048 }),
    timezone: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
    reportingCurrency: Type.Union([
      Type.String({ pattern: "^[A-Za-z]{3}$" }),
      Type.Literal(""),
      Type.Null(),
    ]),
    weeklyDigest: Type.Boolean(),
    alertEmail: Type.Union([
      Type.String({ format: "email", maxLength: 320 }),
      Type.Literal(""),
      Type.Null(),
    ]),
    dataRetentionDays: Type.Union([
      Type.Integer({ minimum: 1, maximum: 3650 }),
      Type.Null(),
    ]),
  }),
  { additionalProperties: false, minProperties: 1 },
);

function dashboardRun(
  run: Run,
  statistics?: { pagesCrawled: number; healthScore: number | null },
) {
  return {
    id: run.id,
    workflowId: run.workflowId,
    startedAt: run.startedAt ?? run.requestedAt,
    completedAt: run.completedAt,
    status: run.status === "succeeded" ? "completed" : run.status,
    progress: run.progress,
    trigger: "manual",
    pagesCrawled: statistics?.pagesCrawled ?? null,
    issuesFound: run.issueCount,
    healthScore: statistics?.healthScore ?? null,
    message: run.error,
  };
}

function integrationForDashboard(integration: Integration) {
  const manifest = getConnectorManifest(integration.provider);
  const auth = manifest?.auth.type;
  const credentialFields =
    auth === "api-key"
      ? [
          {
            key: "apiKey",
            label:
              integration.provider === "pagespeed-insights"
                ? "API key (optional)"
                : "API key",
            type: "secret" as const,
            required: integration.provider !== "pagespeed-insights",
          },
        ]
      : auth === "basic"
        ? [
            {
              key: "login",
              label: "Login",
              type: "text" as const,
              required: true,
            },
            {
              key: "password",
              label: "Password",
              type: "secret" as const,
              required: true,
            },
          ]
        : [];
  const configurationFields =
    integration.provider === "google-search-console"
      ? [
          {
            key: "siteUrl",
            label: "Search Console property",
            required: true,
            placeholder: "sc-domain:example.com",
            help: "Use the exact URL-prefix or Domain property registered in Search Console.",
          },
        ]
      : integration.provider === "google-analytics-4"
        ? [
            {
              key: "propertyId",
              label: "GA4 property ID",
              required: true,
              placeholder: "123456789",
              help: "The numeric property ID, not a measurement ID.",
            },
          ]
        : integration.provider === "pagespeed-insights"
          ? [
              {
                key: "strategy",
                label: "Default strategy",
                required: false,
                placeholder: "mobile",
                help: "Use mobile or desktop.",
              },
            ]
          : integration.provider === "google-trends"
            ? [
                {
                  key: "geo",
                  label: "Default country code",
                  required: false,
                  placeholder: "US",
                  help: "Optional ISO country code.",
                },
              ]
            : integration.provider === "serpapi"
              ? [
                  {
                    key: "location",
                    label: "Default location",
                    required: false,
                    placeholder: "Austin, Texas, United States",
                    help: "Used for localized SERP research.",
                  },
                ]
              : integration.provider === "dataforseo"
                ? [
                    {
                      key: "languageCode",
                      label: "Language code",
                      required: false,
                      placeholder: "en",
                      help: "Default DataForSEO language code.",
                    },
                  ]
                : [];
  return {
    id: integration.provider,
    name: integration.label,
    category: "Data source",
    status: integration.status,
    description: manifest?.capabilities.join(", ") ?? null,
    accountLabel: integration.maskedIdentifier,
    lastSyncAt: integration.lastSyncAt,
    quota: integration.quota,
    lastError:
      integration.status === "expired"
        ? "The credential has expired. Reconnect or rotate it."
        : integration.status === "rate_limited"
          ? "The provider rate limit is active. Try again after the reset window."
          : integration.status === "failed"
            ? "The provider could not be reached or returned an unsuccessful response."
            : integration.status === "degraded"
              ? "Credentials are stored, but the connection still needs verification or attention."
              : null,
    permissions: integration.scopes,
    supportsApiKey: auth === "api-key" || auth === "basic",
    setupUrl:
      auth === "oauth-pkce"
        ? `/api/v1/integrations/${integration.provider}/auth/start`
        : null,
    credentialFields,
    configuration: integration.configuration ?? {},
    configurationFields,
  };
}

export async function createLocalServer(
  options: LocalServerOptions,
): Promise<LocalServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3210;
  const origin = `http://${host}:${port}`;
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1_048_576,
    trustProxy: false,
  });
  app.addContentTypeParser(
    "application/vnd.marketingovo.project+json",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        done(null, JSON.parse(String(body)) as unknown);
      } catch (error) {
        done(error as Error);
      }
    },
  );
  const bootstrapNow = options.bootstrapNow ?? Date.now;
  const bootstrapTokenTtlMs = options.bootstrapTokenTtlMs ?? 60_000;
  if (
    !Number.isFinite(bootstrapTokenTtlMs) ||
    bootstrapTokenTtlMs <= 0 ||
    bootstrapTokenTtlMs > 300_000
  ) {
    throw new Error(
      "bootstrapTokenTtlMs must be between 1 and 300000 milliseconds",
    );
  }
  const bootstrapTickets = new Map<string, BootstrapTicket>();
  const sessions = new Map<string, Session>();
  const serviceTokenPath =
    options.serviceTokenPath ?? join(options.runtime.dataDir, "service-token");
  const serviceToken = ensureServiceToken(serviceTokenPath);
  const googleDesktopClientId = resolveGoogleDesktopClientId(
    options.googleDesktopClientId,
  );
  options.runtime.configureGoogleOAuth(
    googleDesktopClientId,
    options.oauthFetch,
  );
  const oauthBroker = new GoogleDesktopOAuthBroker({
    runtime: options.runtime,
    clientId: googleDesktopClientId,
    ...(options.oauthFetch ? { fetchImpl: options.oauthFetch } : {}),
    ...(options.oauthTransactionTtlMs !== undefined
      ? { transactionTtlMs: options.oauthTransactionTtlMs }
      : {}),
    ...(options.oauthNow ? { now: options.oauthNow } : {}),
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute",
    keyGenerator: () => "loopback",
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Marketingovo Local API",
        version: "1.0.0",
        description:
          "Loopback API for the local-first Marketingovo application",
      },
      servers: [{ url: origin }],
      components: {
        securitySchemes: {
          localServiceToken: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "Marketingovo local service token",
          },
          localSession: {
            type: "apiKey",
            in: "cookie",
            name: MARKETINGOVO_SESSION_COOKIE,
          },
        },
      },
      security: [{ localServiceToken: [] }, { localSession: [] }],
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    const allowedHost = `${host}:${port}`;
    if (request.headers.host !== allowedHost) {
      return reply.code(421).type("application/problem+json").send({
        type: "urn:marketingovo:problem:invalid-host",
        title: "Misdirected request",
        status: 421,
        detail: "The Host header is not accepted by the local service.",
        code: "invalid_host",
      });
    }
    reply.headers({
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy":
        "camera=(), microphone=(), geolocation=(), payment=()",
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "cache-control": request.url.startsWith("/api/")
        ? "no-store"
        : "no-cache",
    });
  });

  const publicPaths = new Set([
    "/api/v1/health",
    "/api/v1/capabilities",
    "/api/v1/openapi.json",
    "/api/v1/session/bootstrap",
  ]);
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?", 1)[0]!;
    if (
      !path.startsWith("/api/v1/") ||
      publicPaths.has(path) ||
      path.endsWith("/auth/callback")
    )
      return;
    const bearer = request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : null;
    if (bearer && secureEqual(bearer, serviceToken)) return;
    const sessionId = requestSessionId(request);
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session || session.expiresAt < Date.now()) {
      if (sessionId) sessions.delete(sessionId);
      return reply.code(401).type("application/problem+json").send({
        type: "urn:marketingovo:problem:authentication-required",
        title: "Authentication required",
        status: 401,
        detail:
          "Open the dashboard from the current local service or use the local service token.",
        code: "authentication_required",
      });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (
        request.headers.origin !== origin ||
        requestCsrfToken(request) !== session.csrf
      ) {
        return reply.code(403).type("application/problem+json").send({
          type: "urn:marketingovo:problem:csrf",
          title: "Request rejected",
          status: 403,
          detail: "The request origin or CSRF token is invalid.",
          code: "csrf_rejected",
        });
      }
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof IssueAdjudicationError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 404
              ? "Issue review target not found"
              : "Issue review was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof ProjectContextError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 404
              ? "Project context not found"
              : "Project context was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof ExtractionRulesError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.code === "extraction_template_catalog_invalid"
              ? "Extraction template catalog unavailable"
              : error.status === 404
                ? "Extraction-rule project not found"
                : error.status >= 500
                  ? "Extraction preview unavailable"
                  : "Extraction rules were rejected",
          status: error.status,
          detail:
            error.code === "extraction_template_catalog_invalid"
              ? "The built-in extraction template catalog failed validation."
              : error.status >= 500
                ? "The installed local engine could not complete the preview."
                : error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof ProjectDeletionError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 404
              ? "Project not found"
              : error.status === 409
                ? "Project is still stopping"
                : "Project deletion was not confirmed",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof RunReplayError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 409
              ? "Source run cannot be replayed yet"
              : "Replay request was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof RunComparisonError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 404
              ? "Audit comparison target not found"
              : error.status === 409
                ? "Audit comparison is not ready"
                : "Audit comparison was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof RunLinkExplorerError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 404
              ? "Link explorer target not found"
              : error.status === 409
                ? "Link graph is not ready"
                : "Link explorer request was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    if (error instanceof ProjectBundleError) {
      return reply
        .code(error.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${error.code.replaceAll("_", "-")}`,
          title:
            error.status === 413
              ? "Project bundle is too large"
              : "Project bundle was rejected",
          status: error.status,
          detail: error.message,
          instance: request.id,
          code: error.code,
        });
    }
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    const status =
      typeof statusCode === "number" && statusCode >= 400 ? statusCode : 500;
    const message =
      error instanceof Error
        ? error.message
        : "The request could not be processed.";
    const safeDetail =
      status >= 500
        ? "The local service could not complete the request."
        : message;
    reply
      .code(status)
      .type("application/problem+json")
      .send({
        type: `urn:marketingovo:problem:${status === 500 ? "internal" : "request"}`,
        title: status === 500 ? "Internal service error" : "Request rejected",
        status,
        detail: safeDetail,
        instance: request.id,
        code: status === 500 ? "internal_error" : "invalid_request",
      });
  });

  app.get(
    "/api/v1/openapi.json",
    {
      schema: {
        security: [],
        response: {
          200: Type.Record(Type.String(), Type.Unknown()),
          421: ProblemResponse("The request Host header is not accepted."),
        },
      },
    },
    async () => app.swagger(),
  );
  app.get(
    "/api/v1/health",
    {
      schema: {
        security: [],
        response: {
          200: Type.Object({
            status: Type.Union([Type.Literal("ok"), Type.Literal("degraded")]),
            database: Type.String(),
            queue: Type.String(),
            version: Type.String(),
          }),
          421: ProblemResponse("The request Host header is not accepted."),
          500: ProblemResponse(
            "The local health check could not be completed.",
          ),
        },
      },
    },
    async () => options.runtime.system.health(),
  );
  app.get(
    "/api/v1/capabilities",
    {
      schema: {
        security: [],
        response: {
          200: CapabilitiesSchema,
          421: ProblemResponse("The request Host header is not accepted."),
          500: ProblemResponse("Capabilities could not be loaded."),
        },
      },
    },
    async () => options.runtime.system.capabilities(),
  );
  app.post(
    "/api/v1/session/bootstrap-token",
    {
      schema: {
        security: [{ localServiceToken: [] }],
        response: {
          200: Type.Object(
            {
              token: Type.String({ minLength: 32, writeOnly: true }),
              expiresAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
          401: ProblemResponse("A valid local service token is required."),
          421: ProblemResponse("The request Host header is not accepted."),
        },
      },
    },
    async (request, reply) => {
      const bearer = request.headers.authorization?.startsWith("Bearer ")
        ? request.headers.authorization.slice(7)
        : null;
      if (!bearer || !secureEqual(bearer, serviceToken)) {
        return reply.code(401).type("application/problem+json").send({
          type: "urn:marketingovo:problem:service-token-required",
          title: "Service token required",
          status: 401,
          detail:
            "Dashboard bootstrap tickets can only be issued with the local service token.",
          code: "service_token_required",
        });
      }
      const now = bootstrapNow();
      for (const [ticketHash, ticket] of bootstrapTickets) {
        if (ticket.expiresAt <= now) bootstrapTickets.delete(ticketHash);
      }
      while (bootstrapTickets.size >= 16) {
        const oldest = bootstrapTickets.keys().next().value as
          string | undefined;
        if (!oldest) break;
        bootstrapTickets.delete(oldest);
      }
      const token = randomBytes(32).toString("base64url");
      const expiresAt = now + bootstrapTokenTtlMs;
      bootstrapTickets.set(hash(token), { expiresAt });
      return { token, expiresAt: new Date(expiresAt).toISOString() };
    },
  );
  app.post(
    "/api/v1/session/bootstrap",
    {
      schema: {
        security: [],
        body: Type.Object({ token: Type.String({ minLength: 32 }) }),
        response: {
          200: Type.Object(
            {
              csrf: Type.String({ minLength: 16 }),
              expiresAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
          401: ProblemResponse("The bootstrap ticket is invalid or expired."),
          421: ProblemResponse("The request Host header is not accepted."),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { token: string };
      const ticketHash = hash(body.token);
      const ticket = bootstrapTickets.get(ticketHash);
      bootstrapTickets.delete(ticketHash);
      if (!ticket || ticket.expiresAt <= bootstrapNow()) {
        return reply.code(401).type("application/problem+json").send({
          type: "urn:marketingovo:problem:bootstrap",
          title: "Bootstrap rejected",
          status: 401,
          detail: "The bootstrap token is invalid, expired, or already used.",
          code: "bootstrap_rejected",
        });
      }
      const sessionId = randomBytes(32).toString("base64url");
      const csrf = randomBytes(24).toString("base64url");
      sessions.set(sessionId, {
        csrf,
        expiresAt: Date.now() + 12 * 60 * 60 * 1_000,
      });
      setSessionCookies(reply, sessionId);
      return {
        csrf,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1_000).toISOString(),
      };
    },
  );
  app.get(
    "/api/v1/session",
    {
      schema: {
        response: {
          200: Type.Object(
            {
              csrf: Type.String({ minLength: 16 }),
              expiresAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const session = sessions.get(requestSessionId(request) ?? "");
      return {
        csrf: session!.csrf,
        expiresAt: new Date(session!.expiresAt).toISOString(),
      };
    },
  );

  app.get(
    "/api/v1/projects",
    {
      schema: {
        response: {
          200: Type.Array(ProjectSchema),
          ...StandardProblemResponses,
        },
      },
    },
    async () => options.runtime.projects.list(),
  );
  app.post(
    "/api/v1/projects",
    {
      schema: {
        body: CreateProjectInputSchema,
        response: {
          201: ProjectSchema,
          ...StandardProblemResponses,
          409: ProblemResponse("A project already uses this canonical URL."),
        },
      },
    },
    async (request, reply) => {
      const project = await options.runtime.projects.create(
        request.body as never,
      );
      return reply.code(201).send(project);
    },
  );
  app.delete(
    "/api/v1/projects/:id",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: DeleteProjectBodySchema,
        response: {
          200: Type.Union([
            ProjectDeletionReceiptSchema,
            DashboardEnvelopeSchema(ProjectDeletionReceiptSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          409: ProblemResponse("An active project job is still stopping."),
          422: ProblemResponse("The project-name confirmation does not match."),
        },
      },
    },
    async (request) => {
      const projectId = (request.params as { id: string }).id;
      const body = request.body as { confirmation: string };
      const receipt = await options.runtime.projects.delete({
        projectId,
        confirmation: body.confirmation,
      });
      return isDashboardRequest(request) ? envelope(receipt) : receipt;
    },
  );
  app.get(
    "/api/v1/projects/:id/overview",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: ProjectOverviewSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
        },
      },
    },
    async (request) => {
      return options.runtime.projects.overview(
        (request.params as { id: string }).id,
      );
    },
  );
  app.get(
    "/api/v1/projects/:id/context",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: Type.Union([
            ProjectContextWorkspaceSchema,
            DashboardEnvelopeSchema(ProjectContextWorkspaceSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
        },
      },
    },
    async (request, reply) => {
      const projectId = (request.params as { id: string }).id;
      const context = await options.runtime.context.get(projectId);
      if (!context) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:project-not-found",
          title: "Project not found",
          status: 404,
          detail: "The selected project does not exist.",
          code: "project_not_found",
        });
      }
      return isDashboardRequest(request)
        ? envelope(context, context.current ? "fresh" : "missing")
        : context;
    },
  );
  app.put(
    "/api/v1/projects/:id/context",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: UpdateProjectContextBodySchema,
        response: {
          200: Type.Union([
            ProjectContextWorkspaceSchema,
            DashboardEnvelopeSchema(ProjectContextWorkspaceSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          422: ProblemResponse(
            "The project context is invalid or contains unsafe material.",
          ),
        },
      },
    },
    async (request) => {
      const projectId = (request.params as { id: string }).id;
      const body = request.body as {
        profile: ProjectContextProfile;
        changeSummary: string;
      };
      const context = await options.runtime.context.update({
        projectId,
        profile: body.profile,
        changeSummary: body.changeSummary,
      });
      return isDashboardRequest(request) ? envelope(context!) : context;
    },
  );
  app.post(
    "/api/v1/projects/:id/context/journal",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: AppendProjectContextJournalBodySchema,
        response: {
          201: Type.Union([
            ProjectContextJournalEntrySchema,
            DashboardEnvelopeSchema(ProjectContextJournalEntrySchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          422: ProblemResponse(
            "The context journal entry is invalid or contains unsafe material.",
          ),
        },
      },
    },
    async (request, reply) => {
      const projectId = (request.params as { id: string }).id;
      const body = request.body as {
        kind: "observation" | "decision" | "constraint" | "experiment";
        title: string;
        detail: string;
        sourceRunId?: string | null;
      };
      const entry = await options.runtime.context.append({
        projectId,
        ...body,
      });
      const response = isDashboardRequest(request) ? envelope(entry!) : entry;
      return reply.code(201).send(response);
    },
  );

  app.get(
    "/api/v1/extraction-rule-templates",
    {
      schema: {
        response: {
          200: Type.Union([
            ExtractionRuleTemplateCatalogSchema,
            DashboardEnvelopeSchema(ExtractionRuleTemplateCatalogSchema),
          ]),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const catalog = await options.runtime.extractionRules.templates();
      return isDashboardRequest(request) ? envelope(catalog) : catalog;
    },
  );

  app.get(
    "/api/v1/projects/:id/extraction-rules",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: Type.Union([
            ExtractionRuleWorkspaceSchema,
            DashboardEnvelopeSchema(ExtractionRuleWorkspaceSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
        },
      },
    },
    async (request, reply) => {
      const projectId = (request.params as { id: string }).id;
      const workspace = await options.runtime.extractionRules.get(projectId);
      if (!workspace) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:project-not-found",
          title: "Project not found",
          status: 404,
          detail: "The selected project does not exist.",
          code: "project_not_found",
        });
      }
      return isDashboardRequest(request)
        ? envelope(workspace, workspace.current ? "fresh" : "missing")
        : workspace;
    },
  );
  app.put(
    "/api/v1/projects/:id/extraction-rules",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: UpdateExtractionRulesBodySchema,
        response: {
          200: Type.Union([
            ExtractionRuleWorkspaceSchema,
            DashboardEnvelopeSchema(ExtractionRuleWorkspaceSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          422: ProblemResponse(
            "The extraction rules are invalid or contain unsafe material.",
          ),
        },
      },
    },
    async (request) => {
      const projectId = (request.params as { id: string }).id;
      const body = request.body as {
        rules: ExtractionRule[];
        changeSummary: string;
      };
      const workspace = await options.runtime.extractionRules.update({
        projectId,
        ...body,
      });
      return isDashboardRequest(request) ? envelope(workspace!) : workspace;
    },
  );
  app.post(
    "/api/v1/projects/:id/extraction-rules/preview",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: PreviewExtractionRulesBodySchema,
        response: {
          200: Type.Union([
            ExtractionPreviewSchema,
            DashboardEnvelopeSchema(ExtractionPreviewSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          422: ProblemResponse(
            "The preview target or extraction rules are invalid.",
          ),
        },
      },
    },
    async (request) => {
      const projectId = (request.params as { id: string }).id;
      const body = request.body as {
        url: string;
        renderMode?: "static" | "js";
        allowPrivateHost?: boolean;
        rules: ExtractionRule[];
      };
      const preview = await options.runtime.extractionRules.preview({
        projectId,
        ...body,
      });
      return isDashboardRequest(request) ? envelope(preview) : preview;
    },
  );

  app.post(
    "/api/v1/runs",
    {
      schema: {
        headers: Type.Object(
          {
            "idempotency-key": Type.String({
              minLength: 8,
              maxLength: 256,
            }),
            ...DashboardClientHeaderSchemaProperties,
          },
          { additionalProperties: true },
        ),
        body: Type.Union([
          StartRunInputSchema,
          Type.Object(
            {
              siteId: Type.String(),
              mode: Type.Optional(
                Type.Union([Type.Literal("full"), Type.Literal("incremental")]),
              ),
              privateHostAllowlist: Type.Optional(
                Type.Array(Type.String({ minLength: 1, maxLength: 253 }), {
                  maxItems: 32,
                  uniqueItems: true,
                }),
              ),
            },
            { additionalProperties: false },
          ),
        ]),
        response: {
          202: Type.Union([
            RunSchema,
            DashboardEnvelopeSchema(DashboardRunSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          409: ProblemResponse("The request conflicts with the current run."),
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:idempotency-key",
          title: "Idempotency-Key required",
          status: 400,
          detail:
            "Start requests require an Idempotency-Key header of at least eight characters.",
          code: "idempotency_key_required",
        });
      }
      const body = request.body as {
        projectId?: string;
        siteId?: string;
        workflowId?: string;
        goal?: string;
        options?: Record<string, unknown>;
        mode?: string;
        privateHostAllowlist?: string[];
      };
      const dashboardOptions = {
        ...(body.mode ? { mode: body.mode } : {}),
        ...(body.privateHostAllowlist
          ? { privateHostAllowlist: body.privateHostAllowlist }
          : {}),
      };
      const started = await options.runtime.runs.start(
        {
          projectId: body.projectId ?? body.siteId!,
          workflowId: (body.workflowId ?? "audit") as "audit",
          goal: body.goal,
          options:
            body.options ??
            (Object.keys(dashboardOptions).length > 0
              ? dashboardOptions
              : undefined),
        },
        idempotencyKey,
      );
      if (isDashboardRequest(request))
        return reply.code(202).send(envelope(dashboardRun(started)));
      return reply.code(202).send(started);
    },
  );
  app.get(
    "/api/v1/runs",
    {
      schema: {
        querystring: RunListQuerySchema,
        response: {
          200: Type.Union([
            Type.Array(RunSchema),
            DashboardEnvelopeSchema(
              Type.Object(
                {
                  items: Type.Array(DashboardRunSchema),
                  total: Type.Integer({ minimum: 0 }),
                },
                { additionalProperties: false },
              ),
            ),
          ]),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const query = request.query as { projectId?: string; siteId?: string };
      const runs = await options.runtime.runs.list(
        query.projectId ?? query.siteId,
      );
      const statistics = new Map(
        options.runtime.database
          .listRunDashboardStatistics(query.projectId ?? query.siteId)
          .map((item) => [item.runId, item]),
      );
      return isDashboardRequest(request)
        ? envelope(
            {
              items: runs.map((run) =>
                dashboardRun(run, statistics.get(run.id)),
              ),
              total: runs.length,
            },
            runs.length ? "fresh" : "missing",
          )
        : runs;
    },
  );
  app.get(
    "/api/v1/runs/:id",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: Type.Union([
            RunSchema,
            DashboardEnvelopeSchema(DashboardRunDetailSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The run was not found."),
        },
      },
    },
    async (request, reply) => {
      const run = await options.runtime.runs.get(
        (request.params as { id: string }).id,
      );
      if (!run)
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:run-not-found",
          title: "Run not found",
          status: 404,
        });
      if (isDashboardRequest(request)) {
        const issues = await options.runtime.runs.issues(run.id);
        const events = options.runtime.listRunEvents(run.id);
        const statistics = options.runtime.database
          .listRunDashboardStatistics(run.projectId)
          .find((item) => item.runId === run.id);
        const counts = new Map<string, number>();
        for (const issue of issues)
          counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1);
        return envelope({
          ...dashboardRun(run, statistics),
          summary: run.error ?? `${run.issueCount} issue instances detected.`,
          issueBreakdown: [...counts].map(([severity, count]) => ({
            severity,
            count,
          })),
          log: events.map((event) => ({
            at: event.at,
            message: event.type,
            level: event.type.includes("failed") ? "error" : "info",
          })),
        });
      }
      return run;
    },
  );
  app.get(
    "/api/v1/runs/:id/evidence",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: RunEvidenceQuerySchema,
        response: {
          200: Type.Union([
            RunEvidencePageSchema,
            DashboardEnvelopeSchema(RunEvidencePageSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The run was not found."),
        },
      },
    },
    async (request, reply) => {
      const runId = (request.params as { id: string }).id;
      const query = request.query as {
        section?: "crawl" | "redirects" | "hreflang" | "extractions";
        limit?: number;
        offset?: number;
        search?: string;
      };
      const evidence = await options.runtime.runs.evidence(runId, {
        section: query.section ?? "crawl",
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
        ...(query.search ? { search: query.search } : {}),
      });
      if (!evidence)
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:run-not-found",
          title: "Run not found",
          status: 404,
        });
      if (!isDashboardRequest(request)) return evidence;
      return envelope(
        evidence,
        evidence.state === "available"
          ? "fresh"
          : evidence.state === "partial"
            ? "stale"
            : "unavailable",
        evidence.warnings,
      );
    },
  );
  app.get(
    "/api/v1/runs/:id/links",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: RunLinksQuerySchema,
        response: {
          200: Type.Union([
            RunLinkExplorerSchema,
            DashboardEnvelopeSchema(RunLinkExplorerSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The run or selected page was not found."),
          409: ProblemResponse("The audit link graph is not ready."),
          422: ProblemResponse("The link explorer request is invalid."),
        },
      },
    },
    async (request, reply) => {
      const runId = (request.params as { id: string }).id;
      const query = request.query as {
        pageUrl: string;
        direction?: "inlinks" | "outlinks";
        limit?: number;
        offset?: number;
        search?: string;
      };
      const explorer = await options.runtime.runs.links(runId, {
        pageUrl: query.pageUrl,
        direction: query.direction ?? "inlinks",
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
        ...(query.search ? { search: query.search } : {}),
      });
      if (!explorer) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:run-not-found",
          title: "Run not found",
          status: 404,
        });
      }
      if (!isDashboardRequest(request)) return explorer;
      return envelope(
        explorer,
        explorer.state === "available"
          ? "fresh"
          : explorer.state === "partial"
            ? "stale"
            : "unavailable",
        explorer.warnings,
      );
    },
  );
  app.get(
    "/api/v1/runs/:id/comparison",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: RunComparisonQuerySchema,
        response: {
          200: Type.Union([
            RunComparisonSchema,
            DashboardEnvelopeSchema(RunComparisonSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("One of the audit runs was not found."),
          409: ProblemResponse("One of the audit runs is not ready."),
          422: ProblemResponse("The audit runs cannot be compared."),
        },
      },
    },
    async (request) => {
      const runId = (request.params as { id: string }).id;
      const baselineRunId = (request.query as { baselineRunId: string })
        .baselineRunId;
      const comparison = await options.runtime.runs.compare(
        runId,
        baselineRunId,
      );
      if (!isDashboardRequest(request)) {
        return comparison;
      }
      return envelope(
        comparison,
        comparison.state === "available"
          ? "fresh"
          : comparison.state === "partial"
            ? "stale"
            : "unavailable",
        comparison.warnings,
      );
    },
  );
  app.post(
    "/api/v1/runs/:id/replay",
    {
      schema: {
        params: IdentifierParamsSchema,
        headers: Type.Object(
          {
            "idempotency-key": Type.String({
              minLength: 8,
              maxLength: 256,
            }),
            ...DashboardClientHeaderSchemaProperties,
          },
          { additionalProperties: true },
        ),
        response: {
          202: Type.Union([
            RunReplaySchema,
            DashboardEnvelopeSchema(DashboardRunReplaySchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The source run was not found."),
          409: ProblemResponse(
            "The source run has not finished or its workflow is unavailable.",
          ),
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:idempotency-key",
          title: "Idempotency-Key required",
          status: 400,
          detail:
            "Replay requests require an Idempotency-Key header of at least eight characters.",
          code: "idempotency_key_required",
        });
      }
      const sourceRunId = (request.params as { id: string }).id;
      const replay = await options.runtime.runs.replay(
        sourceRunId,
        idempotencyKey,
      );
      if (!replay) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:source-run-not-found",
          title: "Source run not found",
          status: 404,
          code: "source_run_not_found",
        });
      }
      if (!isDashboardRequest(request)) {
        return reply.code(202).send(replay);
      }
      return reply.code(202).send(
        envelope({
          ...replay,
          run: dashboardRun(replay.run),
        }),
      );
    },
  );
  app.post(
    "/api/v1/runs/:id/cancel",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: RunSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The run was not found."),
          409: ProblemResponse("The run can no longer be cancelled."),
        },
      },
    },
    async (request, reply) => {
      const run = await options.runtime.runs.cancel(
        (request.params as { id: string }).id,
      );
      return (
        run ??
        reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:run-not-found",
          title: "Run not found",
          status: 404,
        })
      );
    },
  );
  app.get(
    "/api/v1/runs/:id/issues",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: Type.Array(IssueInstanceSchema),
          ...StandardProblemResponses,
          404: ProblemResponse("The run was not found."),
        },
      },
    },
    async (request) => {
      return options.runtime.runs.issues((request.params as { id: string }).id);
    },
  );
  app.get(
    "/api/v1/issues",
    {
      schema: {
        querystring: IssuesListQuerySchema,
        response: {
          200: Type.Union([
            IssueReviewPageSchema,
            DashboardEnvelopeSchema(IssueReviewPageSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        projectId?: string;
        siteId?: string;
        limit?: number;
        offset?: number;
        status?: "open" | "resolved" | "ignored" | "false_positive";
        severity?: "critical" | "high" | "medium" | "low" | "info";
        search?: string;
      };
      const projectId = query.projectId ?? query.siteId;
      if (!projectId) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:project-required",
          title: "Project required",
          status: 400,
          detail: "projectId or siteId is required to review issues.",
          code: "project_required",
        });
      }
      const page = await options.runtime.issues.list(projectId, {
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.offset === undefined ? {} : { offset: query.offset }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.search ? { search: query.search } : {}),
      });
      return isDashboardRequest(request)
        ? envelope(page, page.total > 0 ? "fresh" : "missing")
        : page;
    },
  );
  app.patch(
    "/api/v1/issues/:fingerprint",
    {
      schema: {
        params: FingerprintParamsSchema,
        body: UpdateIssueAdjudicationInputSchema,
        response: {
          200: Type.Union([
            IssueReviewItemSchema,
            DashboardEnvelopeSchema(IssueReviewItemSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The project or issue was not found."),
          422: ProblemResponse(
            "A safe review reason is required for ignored and false-positive issues.",
          ),
        },
      },
    },
    async (request, reply) => {
      const { fingerprint } = request.params as { fingerprint: string };
      const review = await options.runtime.issues.update(
        fingerprint,
        request.body as never,
      );
      if (!review) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:issue-not-found",
          title: "Issue not found",
          status: 404,
          detail: "The issue does not belong to the selected project.",
          code: "issue_not_found",
        });
      }
      return isDashboardRequest(request) ? envelope(review) : review;
    },
  );
  app.get(
    "/api/v1/runs/:id/events",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: Type.Object(
          {
            after: Type.Optional(Type.Integer({ minimum: 0 })),
          },
          { additionalProperties: false },
        ),
        response: {
          200: {
            description: "A Server-Sent Events stream of durable run events.",
            content: {
              "text/event-stream": { schema: Type.String() },
            },
          },
          ...StandardProblemResponses,
          404: ProblemResponse("The run was not found."),
        },
      },
    },
    async (request, reply) => {
      const runId = (request.params as { id: string }).id;
      if (!(await options.runtime.runs.get(runId)))
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:run-not-found",
          title: "Run not found",
          status: 404,
        });
      const after = Number((request.query as { after?: string }).after ?? 0);
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const send = (event: {
        id: number;
        type: string;
        payload: Record<string, unknown>;
      }) => {
        reply.raw.write(
          `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`,
        );
      };
      for (const event of options.runtime.listRunEvents(
        runId,
        Number.isFinite(after) ? after : 0,
      ))
        send(event);
      const unsubscribe = options.runtime.onRunEvent(runId, (event) => {
        send(event);
        void options.runtime.runs.get(runId).then((run) => {
          if (run && terminalStatuses.has(run.status)) {
            unsubscribe();
            reply.raw.end();
          }
        });
      });
      const heartbeat = setInterval(
        () => reply.raw.write(": heartbeat\n\n"),
        15_000,
      );
      heartbeat.unref();
      request.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );
  app.get(
    "/api/v1/runs/:id/report",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: Type.Object(
          {
            format: Type.Optional(
              Type.Union([
                Type.Literal("html"),
                Type.Literal("pdf"),
                Type.Literal("csv"),
                Type.Literal("json"),
              ]),
            ),
          },
          { additionalProperties: false },
        ),
        response: {
          200: {
            description: "The generated report artifact.",
            headers: {
              "content-disposition": {
                description: "Attachment filename for the report.",
                schema: { type: "string" },
              },
            },
            content: {
              "text/html": {
                schema: Type.String({ contentEncoding: "binary" }),
              },
              "application/pdf": {
                schema: Type.String({ contentEncoding: "binary" }),
              },
              "text/csv": {
                schema: Type.String({ contentEncoding: "binary" }),
              },
              "application/json": {
                schema: Type.String({ contentEncoding: "binary" }),
              },
            },
          },
          ...StandardProblemResponses,
          404: ProblemResponse("The report was not found."),
        },
      },
    },
    async (request, reply) => {
      const runId = (request.params as { id: string }).id;
      const format = ((request.query as { format?: string }).format ??
        "html") as "html" | "pdf" | "csv" | "json";
      if (!["html", "pdf", "csv", "json"].includes(format))
        return reply.code(400).send({
          type: "urn:marketingovo:problem:unsupported-report-format",
          title: "Unsupported format",
          status: 400,
        });
      const bytes = await options.runtime.reports.get(runId, format);
      if (!bytes)
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:report-not-found",
          title: "Report not found",
          status: 404,
        });
      const mediaType = {
        html: "text/html; charset=utf-8",
        pdf: "application/pdf",
        csv: "text/csv; charset=utf-8",
        json: "application/json",
      }[format];
      return reply
        .type(mediaType)
        .header(
          "content-disposition",
          `attachment; filename=\"marketingovo-${runId}.${format}\"`,
        )
        .send(Buffer.from(bytes));
    },
  );

  app.get(
    "/api/v1/actions",
    {
      schema: {
        querystring: ActionsListQuerySchema,
        response: {
          200: Type.Union([
            Type.Array(ActionSchema),
            DashboardEnvelopeSchema(
              Type.Object(
                {
                  items: Type.Array(DashboardActionSchema),
                  total: Type.Integer({ minimum: 0 }),
                },
                { additionalProperties: false },
              ),
            ),
          ]),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const query = request.query as { projectId?: string; siteId?: string };
      const actions = await options.runtime.actions.list(
        query.projectId ?? query.siteId,
      );
      return isDashboardRequest(request)
        ? envelope(
            { items: actions.map(dashboardAction), total: actions.length },
            actions.length ? "fresh" : "missing",
          )
        : actions;
    },
  );
  app.get(
    "/api/v1/actions/:id/evidence",
    {
      schema: {
        params: IdentifierParamsSchema,
        querystring: ActionEvidenceQuerySchema,
        response: {
          200: Type.Union([
            ActionEvidenceWorkspaceSchema,
            DashboardEnvelopeSchema(DashboardActionEvidenceResponseSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The action was not found."),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: number; cursor?: string };
      let workspace: ActionEvidenceWorkspace | null;
      try {
        workspace = await options.runtime.actions.evidence(id, {
          limit: query.limit ?? 100,
          ...(query.cursor ? { cursor: query.cursor } : {}),
        });
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as { code?: unknown }).code
            : undefined;
        if (
          error instanceof ActionEvidenceCursorError ||
          code === "invalid_action_evidence_cursor"
        ) {
          return reply.code(400).type("application/problem+json").send({
            type: "urn:marketingovo:problem:invalid-action-evidence-cursor",
            title: "Invalid action evidence cursor",
            status: 400,
            detail: "The evidence cursor is invalid or has expired.",
            code: "invalid_action_evidence_cursor",
          });
        }
        throw error;
      }
      if (!workspace)
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:action-not-found",
          title: "Action not found",
          status: 404,
        });
      return isDashboardRequest(request)
        ? envelope(dashboardActionEvidence(workspace))
        : workspace;
    },
  );
  app.post(
    "/api/v1/actions/:id/checkpoints",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: ActionCheckpointInputSchema,
        response: {
          201: Type.Union([
            ActionCheckpointSchema,
            DashboardEnvelopeSchema(DashboardActionCheckpointSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The action was not found."),
          409: ProblemResponse(
            "A completed audit baseline is required before creating a checkpoint.",
          ),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const checkpoint = await options.runtime.actions.createCheckpoint(id);
        if (!checkpoint)
          return reply.code(404).type("application/problem+json").send({
            type: "urn:marketingovo:problem:action-not-found",
            title: "Action not found",
            status: 404,
          });
        return reply
          .code(201)
          .send(
            isDashboardRequest(request)
              ? envelope(dashboardActionCheckpoint(checkpoint))
              : checkpoint,
          );
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as { code?: unknown }).code
            : undefined;
        if (
          error instanceof ActionCheckpointError ||
          code === "checkpoint_baseline_unavailable"
        ) {
          return reply.code(409).type("application/problem+json").send({
            type: "urn:marketingovo:problem:checkpoint-baseline-unavailable",
            title: "Checkpoint baseline unavailable",
            status: 409,
            detail:
              "Run a successful audit before creating an action checkpoint.",
            code: "checkpoint_baseline_unavailable",
          });
        }
        throw error;
      }
    },
  );
  app.post(
    "/api/v1/actions/:id/verify",
    {
      schema: {
        params: IdentifierParamsSchema,
        headers: Type.Object(
          {
            "idempotency-key": Type.String({
              minLength: 8,
              maxLength: 256,
            }),
            ...DashboardClientHeaderSchemaProperties,
          },
          { additionalProperties: true },
        ),
        body: ActionVerificationInputSchema,
        response: {
          202: Type.Union([
            ActionVerificationStartSchema,
            DashboardEnvelopeSchema(ActionVerificationStartSchema),
          ]),
          ...StandardProblemResponses,
          404: ProblemResponse("The action or checkpoint was not found."),
          409: ProblemResponse("The checkpoint belongs to a different action."),
          422: ProblemResponse(
            "The checkpoint has no URL targets available for verification.",
          ),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { checkpointId } = request.body as { checkpointId: string };
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string") {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:idempotency-key",
          title: "Idempotency-Key required",
          status: 400,
          detail:
            "Verification requests require an Idempotency-Key header of at least eight characters.",
          code: "idempotency_key_required",
        });
      }
      try {
        const started = await (
          options.runtime.actions as unknown as ActionService
        ).verify(id, checkpointId, idempotencyKey);
        if (!started)
          return reply.code(404).type("application/problem+json").send({
            type: "urn:marketingovo:problem:action-or-checkpoint-not-found",
            title: "Action or checkpoint not found",
            status: 404,
          });
        return reply
          .code(202)
          .send(isDashboardRequest(request) ? envelope(started) : started);
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as { code?: unknown }).code
            : undefined;
        if (code === "checkpoint_action_mismatch") {
          return reply.code(409).type("application/problem+json").send({
            type: "urn:marketingovo:problem:checkpoint-action-mismatch",
            title: "Checkpoint does not belong to this action",
            status: 409,
            detail: "Use a checkpoint created for the action being verified.",
            code,
          });
        }
        if (code === "verification_targets_unavailable") {
          return reply.code(422).type("application/problem+json").send({
            type: "urn:marketingovo:problem:verification-targets-unavailable",
            title: "Verification targets unavailable",
            status: 422,
            detail:
              "The checkpoint does not contain any valid URL targets to verify.",
            code,
          });
        }
        throw error;
      }
    },
  );
  app.get(
    "/api/v1/actions/:id/outcomes",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          200: Type.Union([
            Type.Array(ActionOutcomeObservationSchema),
            DashboardEnvelopeSchema(DashboardActionOutcomesSchema),
          ]),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const outcomes = await options.runtime.actions.outcomes(
        (request.params as { id: string }).id,
      );
      return isDashboardRequest(request)
        ? envelope(
            dashboardActionOutcomes(outcomes),
            outcomes.length ? "fresh" : "missing",
          )
        : outcomes;
    },
  );
  app.patch(
    "/api/v1/actions/:id",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: UpdateActionInputSchema,
        response: {
          200: ActionSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The action was not found."),
        },
      },
    },
    async (request, reply) => {
      const action = await options.runtime.actions.update(
        (request.params as { id: string }).id,
        request.body as never,
      );
      return (
        action ??
        reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:action-not-found",
          title: "Action not found",
          status: 404,
        })
      );
    },
  );

  app.get(
    "/api/v1/integrations",
    {
      schema: {
        querystring: IntegrationsListQuerySchema,
        response: {
          200: Type.Union([
            Type.Array(PublicIntegrationSchema),
            DashboardEnvelopeSchema(
              Type.Object(
                {
                  items: Type.Array(DashboardIntegrationSchema),
                  total: Type.Integer({ minimum: 0 }),
                },
                { additionalProperties: false },
              ),
            ),
          ]),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const query = request.query as { projectId?: string; siteId?: string };
      const integrations = await options.runtime.integrations.list(
        query.projectId ?? query.siteId,
      );
      return isDashboardRequest(request)
        ? envelope({
            items: integrations.map(integrationForDashboard),
            total: integrations.length,
          })
        : integrations.map(
            ({ secretRef: _secretRef, ...integration }) => integration,
          );
    },
  );
  app.patch(
    "/api/v1/integrations/:provider/configuration",
    {
      schema: {
        params: ProviderParamsSchema,
        body: IntegrationConfigurationInputSchema,
        response: {
          200: IntegrationRouteResponseSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The integration or project was not found."),
        },
      },
    },
    async (request, reply) => {
      const provider = (request.params as { provider: string }).provider;
      const body = request.body as {
        projectId?: string;
        siteId?: string;
        configuration?: Record<string, unknown>;
      };
      const projectId = body.projectId ?? body.siteId;
      if (
        !projectId ||
        !body.configuration ||
        typeof body.configuration !== "object" ||
        Array.isArray(body.configuration)
      ) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:invalid-integration-configuration",
          title: "Integration configuration is invalid",
          status: 400,
          detail:
            "A project identifier and connector configuration object are required.",
          code: "invalid_integration_configuration",
        });
      }
      try {
        const configured = await options.runtime.integrations.configure(
          provider,
          projectId,
          body.configuration,
        );
        if (isDashboardRequest(request))
          return envelope(integrationForDashboard(configured));
        const { secretRef: _secretRef, ...publicIntegration } = configured;
        return publicIntegration;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Integration configuration is invalid";
        const notFound = /not found|unknown/iu.test(message);
        return reply
          .code(notFound ? 404 : 400)
          .type("application/problem+json")
          .send({
            type: `urn:marketingovo:problem:${notFound ? "integration-not-found" : "invalid-integration-configuration"}`,
            title: notFound
              ? "Integration or project not found"
              : "Integration configuration is invalid",
            status: notFound ? 404 : 400,
            detail: message,
            code: notFound
              ? "integration_not_found"
              : "invalid_integration_configuration",
          });
      }
    },
  );
  app.post(
    "/api/v1/integrations/:provider/credentials",
    {
      schema: {
        params: ProviderParamsSchema,
        body: IntegrationCredentialsInputSchema,
        response: {
          200: IntegrationRouteResponseSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The integration was not found."),
          405: ProblemResponse("This provider requires OAuth."),
        },
      },
    },
    async (request, reply) => {
      const provider = (request.params as { provider: string }).provider;
      const manifest = getConnectorManifest(provider);
      if (!manifest) {
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:integration-not-found",
          title: "Integration not found",
          status: 404,
          detail: "The requested integration provider is not registered.",
          code: "integration_not_found",
        });
      }
      if (manifest.auth.type === "oauth-pkce") {
        return reply.code(405).type("application/problem+json").send({
          type: "urn:marketingovo:problem:oauth-required",
          title: "OAuth connection required",
          status: 405,
          detail:
            "Start the Google OAuth flow; OAuth tokens cannot be submitted through the credentials API.",
          code: "oauth_required",
        });
      }
      const body = request.body as {
        credentials?: Record<string, string>;
        account?: string;
      };
      if (
        !body.credentials ||
        !Value.Check(manifest.credentialSchema, body.credentials)
      ) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:invalid-credentials",
          title: "Credential fields are invalid",
          status: 400,
          detail:
            "Provide exactly the credential fields required by this connector.",
          code: "invalid_credential_fields",
        });
      }
      const account = body.account ?? "default";
      if (!/^[a-zA-Z0-9._-]{1,64}$/u.test(account)) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:invalid-account",
          title: "Account key is invalid",
          status: 400,
          detail:
            "Account keys may contain letters, numbers, dots, underscores and hyphens.",
          code: "invalid_account",
        });
      }
      const secret = Buffer.from(JSON.stringify(body.credentials));
      try {
        const saved = await options.runtime.integrations.saveSecret(
          provider,
          account,
          "credentials",
          secret,
        );
        if (isDashboardRequest(request))
          return envelope(integrationForDashboard(saved));
        const { secretRef: _secretRef, ...publicIntegration } = saved;
        return publicIntegration;
      } finally {
        secret.fill(0);
      }
    },
  );
  app.post(
    "/api/v1/integrations/:provider/test",
    {
      validatorCompiler: strictOptionalBodyValidator,
      schema: {
        params: ProviderParamsSchema,
        body: IntegrationTestInputSchema,
        response: {
          200: IntegrationRouteResponseSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The integration or project was not found."),
          429: ProblemResponse("The provider rate limit is active."),
          502: ProblemResponse("The provider returned an invalid response."),
          503: ProblemResponse("The provider is unavailable."),
        },
      },
    },
    async (request, reply) => {
      const provider = (request.params as { provider: string }).provider;
      const body = (request.body ?? {}) as {
        projectId?: unknown;
        siteId?: unknown;
      };
      const candidate = body.projectId ?? body.siteId;
      if (candidate !== undefined && typeof candidate !== "string") {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:invalid-project-id",
          title: "Project identifier is invalid",
          status: 400,
          detail: "projectId or siteId must be a string when provided.",
          code: "invalid_project_id",
        });
      }
      try {
        const tested = await options.runtime.integrations.test(
          provider,
          candidate,
        );
        if (isDashboardRequest(request)) {
          return envelope(integrationForDashboard(tested));
        }
        const { secretRef: _secretRef, ...publicIntegration } = tested;
        return publicIntegration;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Connection test failed";
        const notFound = /not found|unknown/iu.test(message);
        return reply
          .code(notFound ? 404 : 400)
          .type("application/problem+json")
          .send({
            type: `urn:marketingovo:problem:${notFound ? "integration-not-found" : "integration-test-failed"}`,
            title: notFound
              ? "Integration or project not found"
              : "Integration test failed",
            status: notFound ? 404 : 400,
            detail: message,
            code: notFound
              ? "integration_not_found"
              : "integration_test_failed",
          });
      }
    },
  );
  app.delete(
    "/api/v1/integrations/:provider",
    {
      schema: {
        params: ProviderParamsSchema,
        response: {
          204: {
            description: "The local credential was revoked and removed.",
          },
          ...StandardProblemResponses,
          404: ProblemResponse("The integration was not found."),
        },
      },
    },
    async (request, reply) => {
      const removed = await options.runtime.integrations.remove(
        (request.params as { provider: string }).provider,
      );
      return removed
        ? reply.code(204).send()
        : reply.code(404).type("application/problem+json").send({
            type: "urn:marketingovo:problem:integration-not-found",
            title: "Integration not found",
            status: 404,
          });
    },
  );
  const startOAuth = async (
    provider: string,
    account: string,
    reply: FastifyReply,
    redirect: boolean,
  ) => {
    try {
      const started = await oauthBroker.start(provider, account);
      if (redirect)
        return reply
          .code(302)
          .header("location", started.authorizationUrl)
          .send();
      return reply.send(started);
    } catch (error) {
      const problem =
        error instanceof OAuthBrokerProblem
          ? error
          : new OAuthBrokerProblem(
              500,
              "oauth_start_failed",
              "OAuth could not start",
              "The local OAuth callback listener could not be started.",
            );
      return reply
        .code(problem.status)
        .type("application/problem+json")
        .send({
          type: `urn:marketingovo:problem:${problem.code.replaceAll("_", "-")}`,
          title: problem.title,
          status: problem.status,
          detail: problem.message,
          code: problem.code,
        });
    }
  };
  app.post(
    "/api/v1/integrations/:provider/auth/start",
    {
      validatorCompiler: strictOptionalBodyValidator,
      schema: {
        params: ProviderParamsSchema,
        body: OAuthStartInputSchema,
        response: {
          200: OAuthStartResponseSchema,
          ...StandardProblemResponses,
          429: ProblemResponse("Too many OAuth transactions are active."),
          503: ProblemResponse("OAuth is not configured or unavailable."),
        },
      },
    },
    async (request, reply) => {
      const provider = (request.params as { provider: string }).provider;
      const account =
        (request.body as { account?: string } | undefined)?.account ??
        "default";
      return startOAuth(provider, account, reply, false);
    },
  );
  // Dashboard setup links open this authenticated GET endpoint in a new tab.
  app.get(
    "/api/v1/integrations/:provider/auth/start",
    {
      schema: {
        params: ProviderParamsSchema,
        response: {
          302: {
            description: "Redirect to the provider authorization page.",
            headers: {
              location: {
                description: "Provider authorization URL.",
                schema: { type: "string", format: "uri" },
              },
            },
          },
          ...StandardProblemResponses,
          429: ProblemResponse("Too many OAuth transactions are active."),
          503: ProblemResponse("OAuth is not configured or unavailable."),
        },
      },
    },
    async (request, reply) => {
      return startOAuth(
        (request.params as { provider: string }).provider,
        "default",
        reply,
        true,
      );
    },
  );
  app.get(
    "/api/v1/integrations/:provider/auth/callback",
    {
      schema: {
        security: [],
        params: ProviderParamsSchema,
        querystring: Type.Object(
          {
            state: Type.Optional(Type.String({ maxLength: 2048 })),
            code: Type.Optional(
              Type.String({ maxLength: 8192, writeOnly: true }),
            ),
            error: Type.Optional(Type.String({ maxLength: 240 })),
            error_description: Type.Optional(Type.String({ maxLength: 1024 })),
          },
          { additionalProperties: false },
        ),
        response: {
          410: ProblemResponse(
            "The fixed callback is not active; desktop OAuth uses a one-time random loopback callback.",
          ),
          421: ProblemResponse("The request Host header is not accepted."),
        },
      },
    },
    async (_request, reply) =>
      reply.code(410).type("application/problem+json").send({
        type: "urn:marketingovo:problem:oauth-expired",
        title: "OAuth transaction expired",
        status: 410,
        detail: "Start a new connection from the Integrations screen.",
        code: "oauth_transaction_expired",
      }),
  );

  app.get(
    "/api/v1/schedules",
    {
      schema: {
        querystring: Type.Object(
          {
            projectId: Type.Optional(
              Type.String({ minLength: 1, maxLength: 160 }),
            ),
          },
          { additionalProperties: false },
        ),
        response: {
          200: Type.Array(ScheduleSchema),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) =>
      options.runtime.schedules.list(
        (request.query as { projectId?: string }).projectId,
      ),
  );
  app.post(
    "/api/v1/schedules",
    {
      schema: {
        body: CreateScheduleInputSchema,
        response: {
          201: ScheduleSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        projectId: string;
        cron: string;
        timezone: string;
        enabled: boolean;
        nextRunAt?: string;
      };
      try {
        const nextRunAt =
          body.nextRunAt ??
          nextCronOccurrence(
            body.cron,
            body.timezone,
            new Date(),
          ).toISOString();
        return reply
          .code(201)
          .send(await options.runtime.schedules.create({ ...body, nextRunAt }));
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : "The schedule definition is invalid.";
        const notFound = detail === "Project not found";
        return reply
          .code(notFound ? 404 : 400)
          .type("application/problem+json")
          .send({
            type: `urn:marketingovo:problem:${notFound ? "project-not-found" : "invalid-schedule"}`,
            title: notFound ? "Project not found" : "Schedule is invalid",
            status: notFound ? 404 : 400,
            detail,
            code: notFound ? "project_not_found" : "invalid_schedule",
          });
      }
    },
  );
  app.patch(
    "/api/v1/schedules/:id",
    {
      schema: {
        params: IdentifierParamsSchema,
        body: UpdateScheduleInputSchema,
        response: {
          200: ScheduleSchema,
          ...StandardProblemResponses,
          404: ProblemResponse("The schedule was not found."),
        },
      },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        cron?: string;
        timezone?: string;
        enabled?: boolean;
        nextRunAt?: string;
      };
      const current = (await options.runtime.schedules.list()).find(
        (schedule) => schedule.id === id,
      );
      if (!current)
        return reply.code(404).type("application/problem+json").send({
          type: "urn:marketingovo:problem:schedule-not-found",
          title: "Schedule not found",
          status: 404,
        });
      try {
        const definitionChanged =
          body.cron !== undefined || body.timezone !== undefined;
        const patch =
          definitionChanged && body.nextRunAt === undefined
            ? {
                ...body,
                nextRunAt: nextCronOccurrence(
                  body.cron ?? current.cron,
                  body.timezone ?? current.timezone,
                  new Date(),
                ).toISOString(),
              }
            : body;
        return await options.runtime.schedules.update(id, patch);
      } catch (error) {
        return reply
          .code(400)
          .type("application/problem+json")
          .send({
            type: "urn:marketingovo:problem:invalid-schedule",
            title: "Schedule is invalid",
            status: 400,
            detail:
              error instanceof Error
                ? error.message
                : "The schedule definition is invalid.",
            code: "invalid_schedule",
          });
      }
    },
  );
  app.delete(
    "/api/v1/schedules/:id",
    {
      schema: {
        params: IdentifierParamsSchema,
        response: {
          204: { description: "The schedule was deleted." },
          ...StandardProblemResponses,
          404: ProblemResponse("The schedule was not found."),
        },
      },
    },
    async (request, reply) => {
      const removed = await options.runtime.schedules.remove(
        (request.params as { id: string }).id,
      );
      return removed
        ? reply.code(204).send()
        : reply.code(404).type("application/problem+json").send({
            type: "urn:marketingovo:problem:schedule-not-found",
            title: "Schedule not found",
            status: 404,
          });
    },
  );
  app.post(
    "/api/v1/export",
    {
      schema: {
        consumes: ["application/json"],
        body: Type.Object(
          { projectId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
        response: {
          200: {
            description:
              "A portable Marketingovo project bundle. Credentials and secret references are never included.",
            headers: {
              "content-disposition": {
                description: "Attachment filename for the project bundle.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/vnd.marketingovo.project+json": {
                schema: Type.String({ contentEncoding: "binary" }),
              },
            },
          },
          ...StandardProblemResponses,
          404: ProblemResponse("The project was not found."),
          413: ProblemResponse("The project bundle exceeds the local limit."),
        },
      },
    },
    async (request, reply) => {
      const projectId = (request.body as { projectId?: string }).projectId;
      if (!projectId)
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:project-required",
          title: "projectId is required",
          status: 400,
        });
      const bytes = await options.runtime.exportProject(projectId);
      return reply
        .type("application/vnd.marketingovo.project+json")
        .header(
          "content-disposition",
          `attachment; filename=\"${projectId}.marketingovo\"`,
        )
        .send(Buffer.from(bytes));
    },
  );
  app.post(
    "/api/v1/import",
    {
      bodyLimit: MARKETINGOVO_PROJECT_BUNDLE_LIMITS.maxBytes,
      // Keep the exact parsed object for the signed canonical checksum. The
      // runtime performs the same TypeBox validation plus semantic, secret,
      // relationship and checksum checks without AJV coercion/removal.
      validatorCompiler: () => () => true,
      schema: {
        consumes: [
          "application/vnd.marketingovo.project+json",
          "application/json",
        ],
        produces: ["application/json"],
        body: MarketingovoProjectBundleV2Schema,
        response: {
          201: ProjectImportResultSchema,
          ...StandardProblemResponses,
          409: ProblemResponse("The bundle conflicts with local state."),
          413: ProblemResponse("The project bundle exceeds the local limit."),
          415: ProblemResponse("The project bundle media type is unsupported."),
        },
      },
    },
    async (request, reply) => {
      const mediaType = String(request.headers["content-type"] ?? "")
        .split(";", 1)[0]!
        .trim()
        .toLowerCase();
      if (
        mediaType !== "application/json" &&
        mediaType !== "application/vnd.marketingovo.project+json" &&
        // Accepted for compatibility with bundles exported under the previous
        // product name. Exports always emit the canonical type above.
        mediaType !== "application/vnd.golemseo.project+json"
      ) {
        return reply.code(415).type("application/problem+json").send({
          type: "urn:marketingovo:problem:unsupported-project-bundle-media-type",
          title: "Unsupported project bundle media type",
          status: 415,
          detail:
            "Use application/vnd.marketingovo.project+json or application/json.",
          code: "unsupported_bundle_media_type",
        });
      }
      const result = await options.runtime.importProject(request.body);
      return reply.code(201).send(result);
    },
  );
  // Dashboard compatibility endpoints. They adapt the public contracts without
  // creating a second source of truth.
  app.get("/api/v1/sites", async () =>
    envelope({
      items: (await options.runtime.projects.list()).map((project) => ({
        id: project.id,
        name: project.name,
        url: project.canonicalUrl,
        status: "active",
      })),
      total: (await options.runtime.projects.list()).length,
    }),
  );
  app.post("/api/v1/sites", async (request, reply) => {
    const body = request.body as { name: string; url: string };
    const project = await options.runtime.projects.create({
      name: body.name,
      canonicalUrl: body.url,
    });
    return reply.code(201).send(
      envelope({
        id: project.id,
        name: project.name,
        url: project.canonicalUrl,
        status: "active",
      }),
    );
  });
  app.get("/api/v1/overview", async (request) => {
    const siteId = (request.query as { siteId: string }).siteId;
    const overview = await options.runtime.projects.overview(siteId);
    const integrations = await options.runtime.integrations.list();
    const healthTrend = options.runtime.database
      .listMetricHistory(siteId)
      .filter(
        (entry) =>
          entry.runId !== null &&
          entry.key === "seo_health" &&
          entry.metric.state === "available" &&
          typeof entry.metric.value === "number" &&
          Number.isFinite(entry.metric.value) &&
          entry.metric.value >= 0 &&
          entry.metric.value <= 100 &&
          typeof entry.metric.observedAt === "string" &&
          Number.isFinite(Date.parse(entry.metric.observedAt)),
      )
      .map((entry) => ({
        date: entry.metric.observedAt!.slice(0, 10),
        value: entry.metric.value,
      }))
      .slice(-30);
    return envelope({
      siteHealth: {
        ...metric(overview.seoHealth),
        change:
          overview.healthChange.state === "available" &&
          typeof overview.healthChange.value === "number" &&
          Number.isFinite(overview.healthChange.value)
            ? overview.healthChange.value
            : null,
      },
      organicClicks: metric(overview.gscClicks),
      organicKeyEvents: metric(overview.organicKeyEvents),
      indexableCoverage: metric(overview.indexableCoverage, "percent"),
      coreWebVitalsPassRate: metric(overview.cwvPassRate, "percent"),
      criticalRegressions: metric(overview.criticalRegressions),
      topActions: overview.topActions.map(dashboardAction),
      healthTrend,
      sources: integrations.map((integration) => ({
        id: integration.provider,
        name: integration.label,
        status:
          integration.status === "connected"
            ? "healthy"
            : integration.status === "not_configured"
              ? "unknown"
              : "degraded",
        availability:
          integration.status === "connected" ? "fresh" : "unavailable",
        updatedAt: integration.lastSyncAt,
      })),
    });
  });
  app.get("/api/v1/pages", async (request) => {
    const siteId = (request.query as { siteId: string }).siteId;
    const run = (await options.runtime.runs.list(siteId)).find(
      (candidate) =>
        candidate.workflowId === "audit" &&
        ["succeeded", "partial"].includes(candidate.status),
    );
    if (!run)
      return envelope({ items: [], total: 0 }, "missing", [
        "Run the first audit to populate pages.",
      ]);
    const linkMetrics = options.runtime.database.listPageLinkMetrics(run.id);
    const performance = new Map(
      options.runtime.database
        .listPagePerformance(run.id, "current")
        .map((item) => [item.canonicalUrl, item]),
    );
    const issuesByUrl = new Map<string, number>();
    for (const issue of await options.runtime.runs.issues(run.id)) {
      if (issue.status !== "open" || !issue.canonicalUrl) continue;
      issuesByUrl.set(
        issue.canonicalUrl,
        (issuesByUrl.get(issue.canonicalUrl) ?? 0) + 1,
      );
    }
    const pages = options.runtime.listPages(run.id).map((page) => {
      const indexabilityReason = storedIndexabilityReason(page.payload);
      const links = linkMetrics.get(page.canonicalUrl);
      const pagePerformance = performance.get(page.canonicalUrl);
      const crawlDepth = page.payload.crawlDepth;
      return {
        id: hash(page.canonicalUrl).slice(0, 16),
        runId: run.id,
        url: page.canonicalUrl,
        title: page.title,
        statusCode: page.statusCode,
        indexability: dashboardPageIndexability(
          page.indexable,
          indexabilityReason,
        ),
        indexabilityReason,
        crawlDepth:
          typeof crawlDepth === "number" &&
          Number.isInteger(crawlDepth) &&
          crawlDepth >= 0
            ? crawlDepth
            : null,
        linkGraphState: links?.state ?? "unavailable",
        inlinkSources:
          links?.state === "available" ? links.inlinkSources : null,
        inlinkOccurrences:
          links?.state === "available" ? links.inlinkOccurrences : null,
        outlinkTargets:
          links?.state === "available" ? links.outlinkTargets : null,
        outlinkOccurrences:
          links?.state === "available" ? links.outlinkOccurrences : null,
        organicClicks: pagePerformance?.clicks ?? null,
        organicKeyEvents: pagePerformance?.keyEvents ?? null,
        issues: issuesByUrl.get(page.canonicalUrl) ?? 0,
        coreWebVitals: dashboardCoreWebVitals(page.payload),
        lastCrawledAt: run.completedAt,
      };
    });
    const unavailable = pages.filter(
      (page) => page.linkGraphState === "unavailable",
    ).length;
    return envelope(
      { items: pages, total: pages.length },
      unavailable === 0 ? "fresh" : "stale",
      unavailable === 0
        ? []
        : [
            `${unavailable} page record(s) predate versioned internal-link evidence.`,
          ],
    );
  });
  app.get(
    "/api/v1/keywords",
    {
      schema: {
        querystring: Type.Object(
          {
            siteId: Type.Optional(
              Type.String({ minLength: 1, maxLength: 160 }),
            ),
          },
          { additionalProperties: false },
        ),
        response: {
          200: DashboardEnvelopeSchema(
            Type.Object(
              {
                opportunities: Type.Array(DashboardKeywordOpportunitySchema),
                clusters: Type.Array(DashboardKeywordClusterSchema),
                providerUsage: Type.Union([
                  DashboardProviderUsageSchema,
                  Type.Null(),
                ]),
              },
              { additionalProperties: false },
            ),
          ),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const siteId = (request.query as { siteId?: string }).siteId;
      if (!siteId)
        return envelope(
          { opportunities: [], clusters: [], providerUsage: null },
          "unavailable",
          ["Select a site to view keyword research."],
        );
      const run = (await options.runtime.runs.list(siteId)).find(
        (candidate) =>
          ["keyword-research", "content-plan"].includes(candidate.workflowId) &&
          ["succeeded", "partial"].includes(candidate.status),
      );
      if (!run)
        return envelope(
          { opportunities: [], clusters: [], providerUsage: null },
          "missing",
          [
            "Run keyword research or a content plan to populate this workspace.",
          ],
        );
      const artifact = parseResearchArtifact(
        await options.runtime.reports.get(run.id, "json"),
      );
      if (!artifact)
        return envelope(
          { opportunities: [], clusters: [], providerUsage: null },
          "unavailable",
          ["The latest keyword research artifact could not be read."],
        );
      // The latest audit supplies the on-site pages a keyword can point at.
      // Absent an audit the target simply stays unavailable.
      const auditRun = (await options.runtime.runs.list(siteId)).find(
        (candidate) =>
          candidate.workflowId === "audit" &&
          ["succeeded", "partial"].includes(candidate.status),
      );
      const auditArtifact = auditRun
        ? parseResearchArtifact(
            await options.runtime.reports.get(auditRun.id, "json"),
          )
        : null;
      return envelope(keywordDashboardWorkspace(artifact, auditArtifact));
    },
  );
  app.get(
    "/api/v1/brand-presence",
    {
      schema: {
        querystring: Type.Object(
          {
            siteId: Type.Optional(
              Type.String({ minLength: 1, maxLength: 160 }),
            ),
          },
          { additionalProperties: false },
        ),
        response: {
          200: DashboardEnvelopeSchema(
            Type.Object(
              {
                items: Type.Array(DashboardBrandProfileSchema),
                total: Type.Integer({ minimum: 0 }),
              },
              { additionalProperties: false },
            ),
          ),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const empty = { items: [], total: 0 };
      const siteId = (request.query as { siteId?: string }).siteId;
      if (!siteId)
        return envelope(empty, "unavailable", [
          "Select a site to view brand presence.",
        ]);
      const run = (await options.runtime.runs.list(siteId)).find(
        (candidate) =>
          candidate.workflowId === "audit" &&
          ["succeeded", "partial"].includes(candidate.status),
      );
      if (!run)
        return envelope(empty, "missing", [
          "Run an audit to check where your brand profiles are linked.",
        ]);
      const artifact = parseResearchArtifact(
        await options.runtime.reports.get(run.id, "json"),
      );
      const items = artifact ? brandPresenceItems(artifact) : [];
      // The audit omits the section entirely when no profiles are declared, so
      // an empty result is reported as missing configuration rather than as a
      // finding that nothing is linked.
      if (items.length === 0)
        return envelope(empty, "missing", [
          "Add brand or social profiles in project context, then run an audit.",
        ]);
      return envelope({ items, total: items.length });
    },
  );
  app.get(
    "/api/v1/competitors",
    {
      schema: {
        querystring: Type.Object(
          {
            siteId: Type.Optional(
              Type.String({ minLength: 1, maxLength: 160 }),
            ),
          },
          { additionalProperties: false },
        ),
        response: {
          200: DashboardEnvelopeSchema(
            Type.Object(
              {
                items: Type.Array(DashboardCompetitorSchema),
                total: Type.Integer({ minimum: 0 }),
                contentGapTerms: Type.Array(DashboardContentGapTermSchema),
              },
              { additionalProperties: false },
            ),
          ),
          ...StandardProblemResponses,
        },
      },
    },
    async (request) => {
      const empty = { items: [], total: 0, contentGapTerms: [] };
      const siteId = (request.query as { siteId?: string }).siteId;
      if (!siteId)
        return envelope(empty, "unavailable", [
          "Select a site to view competitor research.",
        ]);
      // Runs come back newest first, so the second completed comparison is the
      // baseline the trend is measured against.
      const comparisons = (await options.runtime.runs.list(siteId)).filter(
        (candidate) =>
          candidate.workflowId === "compare" &&
          ["succeeded", "partial"].includes(candidate.status),
      );
      const run = comparisons[0];
      if (!run)
        return envelope(empty, "missing", [
          "Run a competitor comparison to populate this workspace.",
        ]);
      const artifact = parseResearchArtifact(
        await options.runtime.reports.get(run.id, "json"),
      );
      if (!artifact)
        return envelope(empty, "unavailable", [
          "The latest competitor comparison artifact could not be read.",
        ]);
      const previous = comparisons[1];
      const baseline = previous
        ? (parseResearchArtifact(
            await options.runtime.reports.get(previous.id, "json"),
          ) ?? undefined)
        : undefined;
      const items = competitorDashboardItems(artifact, baseline);
      return envelope({
        items,
        total: items.length,
        contentGapTerms: contentGapTerms(artifact),
      });
    },
  );
  app.get("/api/v1/monitoring", async (request) => {
    const siteId = (request.query as { siteId: string }).siteId;
    const schedules = await options.runtime.schedules.list(siteId);
    return envelope({
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        name: "SEO audit",
        cadence: schedule.cron,
        cron: schedule.cron,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt,
        status: schedule.enabled ? "healthy" : "unknown",
      })),
      alerts: [],
    });
  });
  app.get("/api/v1/reports", async (request) => {
    const siteId = (request.query as { siteId: string }).siteId;
    const runs = await options.runtime.runs.list(siteId);
    const reports = runs
      .filter(
        (run) =>
          run.workflowId === "audit" &&
          ["succeeded", "partial"].includes(run.status),
      )
      .map((run) => ({
        id: run.id,
        name: `SEO audit ${run.completedAt?.slice(0, 10) ?? ""}`,
        type: "audit",
        status: "ready",
        generatedAt: run.completedAt,
        downloadUrl: `/api/v1/runs/${run.id}/report?format=html`,
      }));
    return envelope(
      { items: reports, total: reports.length },
      reports.length ? "fresh" : "missing",
    );
  });
  app.get("/api/v1/settings", async (request, reply) => {
    const siteId = (request.query as { siteId: string }).siteId;
    const project = options.runtime.database.getProject(siteId);
    if (!project) {
      return reply.code(404).type("application/problem+json").send({
        type: "urn:marketingovo:problem:project-not-found",
        title: "Project not found",
        status: 404,
        detail: "The selected project does not exist.",
        code: "project_not_found",
      });
    }
    const settings = options.runtime.database.getProjectSettings(siteId);
    return envelope({
      siteName: project.name,
      siteUrl: project.canonicalUrl,
      timezone:
        settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      reportingCurrency: settings?.reportingCurrency ?? null,
      weeklyDigest: settings?.weeklyDigest ?? false,
      alertEmail: settings?.alertEmail ?? null,
      dataRetentionDays: settings?.dataRetentionDays ?? null,
    });
  });
  app.patch(
    "/api/v1/settings",
    { schema: { body: DashboardSettingsInputSchema } },
    async (request, reply) => {
      const siteId = (request.query as { siteId?: string }).siteId;
      if (!siteId) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:project-required",
          title: "Project is required",
          status: 400,
          detail: "Select a project before updating settings.",
          code: "project_required",
        });
      }
      const body = request.body as {
        siteName?: string;
        siteUrl?: string;
        timezone?: string | null;
        reportingCurrency?: string | null;
        weeklyDigest?: boolean;
        alertEmail?: string | null;
        dataRetentionDays?: number | null;
      };
      const siteName = body.siteName?.trim();
      if (body.siteName !== undefined && !siteName) {
        return reply.code(400).type("application/problem+json").send({
          type: "urn:marketingovo:problem:invalid-settings",
          title: "Settings are invalid",
          status: 400,
          detail: "Site name cannot be empty.",
          code: "invalid_settings",
        });
      }
      let siteUrl: string | undefined;
      if (body.siteUrl !== undefined) {
        try {
          const parsed = new URL(body.siteUrl);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
            throw new Error("unsupported protocol");
          siteUrl = parsed.href;
        } catch {
          return reply.code(400).type("application/problem+json").send({
            type: "urn:marketingovo:problem:invalid-settings",
            title: "Settings are invalid",
            status: 400,
            detail: "Canonical URL must be an absolute HTTP or HTTPS URL.",
            code: "invalid_settings",
          });
        }
      }
      const timezone = body.timezone?.trim() || null;
      if (timezone) {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
        } catch {
          return reply.code(400).type("application/problem+json").send({
            type: "urn:marketingovo:problem:invalid-settings",
            title: "Settings are invalid",
            status: 400,
            detail:
              "Timezone must be a valid IANA timezone such as Europe/London.",
            code: "invalid_settings",
          });
        }
      }
      try {
        const updated = options.runtime.database.updateProjectSettings(siteId, {
          ...(siteName !== undefined ? { name: siteName } : {}),
          ...(siteUrl !== undefined ? { canonicalUrl: siteUrl } : {}),
          ...(body.timezone !== undefined ? { timezone } : {}),
          ...(body.reportingCurrency !== undefined
            ? {
                reportingCurrency:
                  body.reportingCurrency?.trim().toUpperCase() || null,
              }
            : {}),
          ...(body.weeklyDigest !== undefined
            ? { weeklyDigest: body.weeklyDigest }
            : {}),
          ...(body.alertEmail !== undefined
            ? { alertEmail: body.alertEmail?.trim().toLowerCase() || null }
            : {}),
          ...(body.dataRetentionDays !== undefined
            ? { dataRetentionDays: body.dataRetentionDays }
            : {}),
        });
        if (!updated) {
          return reply.code(404).type("application/problem+json").send({
            type: "urn:marketingovo:problem:project-not-found",
            title: "Project not found",
            status: 404,
            detail: "The selected project does not exist.",
            code: "project_not_found",
          });
        }
        return envelope({
          siteName: updated.project.name,
          siteUrl: updated.project.canonicalUrl,
          timezone:
            updated.settings.timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          reportingCurrency: updated.settings.reportingCurrency,
          weeklyDigest: updated.settings.weeklyDigest,
          alertEmail: updated.settings.alertEmail,
          dataRetentionDays: updated.settings.dataRetentionDays,
        });
      } catch (error) {
        const conflict =
          error instanceof Error &&
          error.message.includes("UNIQUE constraint failed");
        return reply
          .code(conflict ? 409 : 400)
          .type("application/problem+json")
          .send({
            type: `urn:marketingovo:problem:${conflict ? "project-url-conflict" : "invalid-settings"}`,
            title: conflict
              ? "Canonical URL is already in use"
              : "Settings are invalid",
            status: conflict ? 409 : 400,
            detail: conflict
              ? "Another local project already uses this canonical URL."
              : "The project settings could not be saved.",
            code: conflict ? "project_url_conflict" : "invalid_settings",
          });
      }
    },
  );
  app.get("/api/v1/system/health", async () => {
    const health = await options.runtime.system.health();
    return envelope({
      status: health.status === "ok" ? "healthy" : "degraded",
      version: health.version,
      checkedAt: new Date().toISOString(),
      checks: [
        {
          id: "database",
          name: "SQLite",
          status: health.database === "connected" ? "healthy" : "degraded",
          checkedAt: new Date().toISOString(),
          message: health.database,
        },
        {
          id: "queue",
          name: "Worker queue",
          status: "healthy",
          checkedAt: new Date().toISOString(),
          message: health.queue,
        },
      ],
    });
  });

  if (
    options.dashboardDir &&
    existsSync(join(options.dashboardDir, "index.html"))
  ) {
    const root = resolve(options.dashboardDir);
    await app.register(fastifyStatic, { root, prefix: "/", wildcard: false });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/"))
        return reply.type("text/html").sendFile("index.html");
      return reply.code(404).type("application/problem+json").send({
        type: "urn:marketingovo:problem:not-found",
        title: "Not found",
        status: 404,
      });
    });
  }

  const server: LocalServer = {
    app,
    runtime: options.runtime,
    host,
    port,
    serviceTokenPath,
    listen: async () => app.listen({ host, port }),
    close: async () => {
      await oauthBroker.close();
      await app.close();
      options.runtime.close();
    },
  };
  return server;
}
