import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { connectorEgressHosts } from "./egress.js";
import { GOOGLE_OAUTH_SCOPES } from "./google-oauth.js";

export * from "./egress.js";
export * from "./google-oauth.js";
export * from "./health.js";
export * from "./provider-fetch.js";

export interface ConnectorManifest {
  id: string;
  label: string;
  version: string;
  auth: {
    type: "oauth-pkce" | "api-key" | "basic" | "none";
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
