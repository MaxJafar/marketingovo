import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { connectorEgressHosts } from "./egress.js";
import { GOOGLE_OAUTH_SCOPES } from "./google-oauth.js";
import { META_ADS_SCOPES } from "./meta-graph.js";
import { X_OAUTH_SCOPES } from "./x-oauth.js";

export * from "./egress.js";
export * from "./google-ads.js";
export * from "./google-oauth.js";
export * from "./health.js";
export * from "./media-relay.js";
export * from "./media-sniff.js";
export * from "./meta-graph.js";
export * from "./provider-fetch.js";
export * from "./x-oauth.js";

export interface ConnectorManifest {
  id: string;
  label: string;
  version: string;
  auth: {
    /**
     * `long-lived-token` is a pasted credential like an api key, but one that
     * expires. The distinction is not pedantry: an api key that stops working
     * is a revocation the operator performed, while a long-lived token that
     * stops working is a deadline the operator was never told about. Keeping
     * them apart is what lets the connector surface an expiry and degrade to
     * `expired` instead of reporting a generic failure months later.
     */
    type: "oauth-pkce" | "api-key" | "long-lived-token" | "basic" | "none";
    scopes: readonly string[];
  };
  egressHosts: readonly string[];
  rateLimit: { requests: number; windowSeconds: number; concurrency: number };
  economics: {
    usage: "free" | "provider-quota" | "provider-metered";
    perRequestCost: "free" | "provider-reported" | "not-reported";
  };
  credentialSchema: TSchema;
  configSchema: TSchema;
  normalizedSchema: TSchema;
  retention: { rawPayload: "none" | "optional"; defaultDays: number };
  capabilities: readonly string[];
}

const apiKeySchema = Type.Object(
  { apiKey: Type.String({ minLength: 8 }) },
  { additionalProperties: false },
);
const oauthSchema = Type.Object(
  { refreshToken: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
const emptySchema = Type.Object({}, { additionalProperties: false });
const metricRows = Type.Array(
  Type.Record(
    Type.String(),
    Type.Union([Type.String(), Type.Number(), Type.Null()]),
  ),
);

export const connectorManifests = [
  {
    id: "google-search-console",
    label: "Google Search Console",
    version: "1.0.0",
    auth: {
      type: "oauth-pkce",
      scopes: GOOGLE_OAUTH_SCOPES["google-search-console"],
    },
    egressHosts: connectorEgressHosts["google-search-console"],
    rateLimit: { requests: 600, windowSeconds: 60, concurrency: 3 },
    economics: { usage: "free", perRequestCost: "free" },
    credentialSchema: oauthSchema,
    configSchema: Type.Object({
      siteUrl: Type.String(),
      rowLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1_000_000 })),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: [
      "search-analytics",
      "sitemaps",
      "freshness",
      "pagination-25000",
    ],
  },
  {
    id: "google-analytics-4",
    label: "Google Analytics 4",
    version: "1.0.0",
    auth: {
      type: "oauth-pkce",
      scopes: GOOGLE_OAUTH_SCOPES["google-analytics-4"],
    },
    egressHosts: connectorEgressHosts["google-analytics-4"],
    rateLimit: { requests: 120, windowSeconds: 60, concurrency: 2 },
    economics: { usage: "free", perRequestCost: "free" },
    credentialSchema: oauthSchema,
    configSchema: Type.Object({
      propertyId: Type.String({ pattern: "^[1-9]\\d*$" }),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: [
      "landing-pages",
      "sessions",
      "engagement",
      "key-events",
      "pagination",
    ],
  },
  {
    id: "google-ads",
    label: "Google Ads",
    version: "1.0.0",
    // OAuth for the sign-in, plus a developer token the operator supplies
    // separately. Google issues developer tokens against a manager account and
    // approves them by hand; this product ships none, because a token compiled
    // into a binary is one identity shared by every install and Google's rate
    // limits and terms attach to whoever holds it. See ADR 0008.
    auth: { type: "oauth-pkce", scopes: GOOGLE_OAUTH_SCOPES["google-ads"] },
    egressHosts: connectorEgressHosts["google-ads"],
    // Google's real limit is a daily operations quota that varies by access
    // tier, not a per-minute rate. This is a conservative local bound that
    // keeps a sync well inside the smallest tier.
    rateLimit: { requests: 60, windowSeconds: 60, concurrency: 2 },
    economics: { usage: "provider-quota", perRequestCost: "free" },
    credentialSchema: Type.Composite([
      oauthSchema,
      Type.Object({
        // Held with the OAuth credential rather than in configuration: it is a
        // secret that identifies the operator to Google, and configuration is
        // readable state.
        developerToken: Type.String({ minLength: 16, maxLength: 128 }),
      }),
    ]),
    configSchema: Type.Object({
      /** Ten digits, hyphens optional. The account being read. */
      customerId: Type.String({ pattern: "^\\d{3}-?\\d{3}-?\\d{4}$" }),
      /**
       * The manager account above it, when there is one.
       *
       * Required by Google whenever the credential reaches the account through
       * a manager, which is how every agency is arranged. Omitting it produces
       * a permission error that says nothing about managers.
       */
      loginCustomerId: Type.Optional(
        Type.String({ pattern: "^\\d{3}-?\\d{3}-?\\d{4}$" }),
      ),
      /**
       * Pinned so a Google version sunset is a one-line operator change rather
       * than a silent behaviour shift. Each version lives about a year.
       */
      apiVersion: Type.Optional(Type.String({ pattern: "^v\\d{1,3}$" })),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: [
      "ad-accounts",
      "campaign-insights",
      "network-breakdown",
      "delivery-status",
      "search-terms",
      "keyword-performance",
      "impression-share",
    ],
  },
  {
    id: "pagespeed-insights",
    label: "PageSpeed Insights",
    version: "1.0.0",
    auth: { type: "api-key", scopes: [] },
    egressHosts: connectorEgressHosts["pagespeed-insights"],
    rateLimit: { requests: 60, windowSeconds: 60, concurrency: 2 },
    economics: { usage: "provider-quota", perRequestCost: "not-reported" },
    credentialSchema: Type.Partial(apiKeySchema),
    configSchema: Type.Object({
      strategy: Type.Optional(
        Type.Union([Type.Literal("mobile"), Type.Literal("desktop")]),
      ),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: ["crux", "lighthouse", "core-web-vitals"],
  },
  {
    id: "google-trends",
    label: "Google Trends",
    version: "1.0.0",
    auth: { type: "none", scopes: [] },
    egressHosts: connectorEgressHosts["google-trends"],
    rateLimit: { requests: 20, windowSeconds: 60, concurrency: 1 },
    economics: { usage: "free", perRequestCost: "free" },
    credentialSchema: emptySchema,
    configSchema: Type.Object({
      geo: Type.Optional(Type.String()),
      category: Type.Optional(Type.Integer()),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "none", defaultDays: 0 },
    capabilities: ["interest-over-time", "related-queries"],
  },
  {
    id: "serpapi",
    label: "SerpAPI",
    version: "1.0.0",
    auth: { type: "api-key", scopes: [] },
    egressHosts: connectorEgressHosts.serpapi,
    rateLimit: { requests: 100, windowSeconds: 60, concurrency: 3 },
    economics: { usage: "provider-quota", perRequestCost: "not-reported" },
    credentialSchema: apiKeySchema,
    configSchema: Type.Object({
      engine: Type.Optional(Type.String()),
      location: Type.Optional(Type.String()),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: ["serp", "people-also-ask", "related-searches"],
  },
  {
    id: "dataforseo",
    label: "DataForSEO",
    version: "1.0.0",
    auth: { type: "basic", scopes: [] },
    egressHosts: connectorEgressHosts.dataforseo,
    rateLimit: { requests: 120, windowSeconds: 60, concurrency: 5 },
    economics: {
      usage: "provider-metered",
      perRequestCost: "provider-reported",
    },
    credentialSchema: Type.Object({
      login: Type.String(),
      password: Type.String({ minLength: 8 }),
    }),
    configSchema: Type.Object({
      locationCode: Type.Optional(Type.Integer()),
      languageCode: Type.Optional(Type.String()),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: ["serp", "keywords", "content-analysis", "competitors"],
  },
  {
    id: "meta-ads",
    label: "Meta Ads (Facebook & Instagram)",
    version: "1.0.0",
    // A pasted System User token, not OAuth. Meta's token exchange requires an
    // app secret, and a desktop application cannot hold one safely; shipping a
    // secret in the binary would make every install share one identity. The
    // operator mints the token in their own Business Manager instead, so no
    // secret ever reaches this machine and the credential stays theirs.
    auth: { type: "long-lived-token", scopes: META_ADS_SCOPES },
    egressHosts: connectorEgressHosts["meta-ads"],
    // Meta's documented limit is a moving score per app and account rather than
    // a fixed rate, so this is a conservative local bound that keeps a sync
    // well inside it rather than a transcription of a published number.
    rateLimit: { requests: 100, windowSeconds: 60, concurrency: 2 },
    economics: { usage: "provider-quota", perRequestCost: "free" },
    credentialSchema: Type.Object(
      { accessToken: Type.String({ minLength: 32, maxLength: 4_096 }) },
      { additionalProperties: false },
    ),
    configSchema: Type.Object({
      /**
       * Pinned so a Meta version deprecation is a one-line operator change
       * rather than a silent behaviour shift. Check Meta's version schedule
       * before raising the default; each version is supported roughly two
       * years from release.
       */
      graphVersion: Type.Optional(
        Type.String({ pattern: "^v\\d{1,3}\\.\\d{1,3}$" }),
      ),
      /** Scopes cabinet discovery to one Business Manager, when supplied. */
      businessId: Type.Optional(Type.String({ pattern: "^\\d{1,32}$" })),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: [
      "ad-accounts",
      "campaign-insights",
      "platform-breakdown",
      "delivery-status",
      "creative-fatigue",
    ],
  },
  {
    id: "telegram",
    label: "Telegram",
    version: "1.0.0",
    // A bot token from @BotFather. No OAuth, no app review, no expiry, and the
    // operator can revoke it in one message. This is what every provider's
    // credential story would look like if they optimized for the person
    // holding it rather than for the platform issuing it.
    auth: { type: "long-lived-token", scopes: [] },
    egressHosts: connectorEgressHosts.telegram,
    rateLimit: { requests: 30, windowSeconds: 60, concurrency: 1 },
    economics: { usage: "free", perRequestCost: "free" },
    credentialSchema: Type.Object(
      {
        // `<bot id>:<secret>` is the documented shape; checking it here turns a
        // pasted API key from somewhere else into an immediate, clear error.
        botToken: Type.String({
          minLength: 20,
          maxLength: 200,
          pattern: "^\\d{5,}:[A-Za-z0-9_-]{20,}$",
        }),
      },
      { additionalProperties: false },
    ),
    configSchema: Type.Object({}),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: ["publish-text", "publish-media", "channels", "groups"],
  },
  {
    id: "x",
    label: "X (Twitter)",
    version: "1.0.0",
    // The operator registers their own app, so the client id is theirs and no
    // secret is required: X supports PKCE for public clients, which is the
    // only form a desktop install can use honestly.
    auth: { type: "oauth-pkce", scopes: X_OAUTH_SCOPES },
    egressHosts: connectorEgressHosts.x,
    rateLimit: { requests: 50, windowSeconds: 900, concurrency: 1 },
    // X's free tier caps writes at a few hundred a month. Metered rather than
    // quota because exceeding it costs money on a paid tier and refusals on
    // the free one, and the operator needs to see which they are on.
    economics: { usage: "provider-metered", perRequestCost: "not-reported" },
    credentialSchema: oauthSchema,
    configSchema: Type.Object({
      /** The operator's own OAuth 2.0 client id. */
      clientId: Type.Optional(Type.String({ minLength: 8, maxLength: 200 })),
      /** Posts per month the operator's tier allows, for local pre-checks. */
      monthlyPostLimit: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 1_000_000 }),
      ),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "optional", defaultDays: 7 },
    capabilities: ["publish-text", "publish-media"],
  },
  {
    id: "media-relay",
    label: "Object storage (S3-compatible)",
    version: "1.0.0",
    auth: { type: "api-key", scopes: [] },
    // See the note in egress.ts: this connector's host is operator-declared in
    // its configuration, because an S3 endpoint cannot be a constant.
    egressHosts: connectorEgressHosts["media-relay"],
    rateLimit: { requests: 60, windowSeconds: 60, concurrency: 2 },
    economics: { usage: "provider-metered", perRequestCost: "not-reported" },
    credentialSchema: Type.Object(
      {
        accessKeyId: Type.String({ minLength: 8, maxLength: 200 }),
        secretAccessKey: Type.String({ minLength: 8, maxLength: 400 }),
        sessionToken: Type.Optional(Type.String({ maxLength: 4_096 })),
      },
      { additionalProperties: false },
    ),
    configSchema: Type.Object({
      endpoint: Type.String({
        minLength: 4,
        maxLength: 253,
        pattern: "^[a-z0-9.-]+$",
      }),
      region: Type.String({ minLength: 1, maxLength: 64 }),
      bucket: Type.String({ minLength: 1, maxLength: 63 }),
      publicBaseUrl: Type.String({
        format: "uri",
        pattern: "^https://",
        maxLength: 2_000,
      }),
      forcePathStyle: Type.Optional(Type.Boolean()),
    }),
    normalizedSchema: metricRows,
    retention: { rawPayload: "none", defaultDays: 0 },
    capabilities: ["public-media-hosting"],
  },
] as const satisfies readonly ConnectorManifest[];

export function getConnectorManifest(
  id: string,
): ConnectorManifest | undefined {
  return connectorManifests.find((manifest) => manifest.id === id);
}

export function validateConnectorConfiguration(
  id: string,
  configuration: Record<string, unknown>,
): boolean {
  const manifest = getConnectorManifest(id);
  return Boolean(manifest && Value.Check(manifest.configSchema, configuration));
}
