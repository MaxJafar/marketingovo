/** Exact provider hosts allowed by both manifests and health probes. */
export const connectorEgressHosts = {
  "google-search-console": [
    "accounts.google.com",
    "oauth2.googleapis.com",
    "searchconsole.googleapis.com",
    "www.googleapis.com",
  ],
  "google-analytics-4": [
    "accounts.google.com",
    "oauth2.googleapis.com",
    "analyticsdata.googleapis.com",
  ],
  "pagespeed-insights": ["pagespeedonline.googleapis.com"],
  "google-trends": ["trends.google.com"],
  serpapi: ["serpapi.com"],
  dataforseo: ["api.dataforseo.com"],
} as const;

export type ConnectorId = keyof typeof connectorEgressHosts;
