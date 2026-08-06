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
  // One host for the API, plus the two OAuth hosts the token refresh uses.
  // Notably absent: `ads.google.com`, which is where deep links in findings
  // send the operator's browser. The daemon never fetches it.
  "google-ads": [
    "accounts.google.com",
    "oauth2.googleapis.com",
    "googleads.googleapis.com",
  ],
  "pagespeed-insights": ["pagespeedonline.googleapis.com"],
  "google-trends": ["trends.google.com"],
  serpapi: ["serpapi.com"],
  dataforseo: ["api.dataforseo.com"],
  // Facebook and Instagram ads are one API. Marketing, page and Instagram
  // business reads all go to the same host, so this connector needs exactly
  // one exact name — and notably not the CDN hosts that serve creative images,
  // which the product never fetches.
  "meta-ads": ["graph.facebook.com"],
  telegram: ["api.telegram.org"],
  // `x.com` is where the operator's browser is sent to authorize; the daemon
  // itself only ever calls the two API hosts.
  x: ["api.twitter.com", "upload.twitter.com", "x.com"],
  /**
   * Deliberately empty.
   *
   * The media relay talks to object storage the operator owns, and an S3
   * endpoint differs per provider and per account — `s3.eu-west-1.amazonaws.com`
   * for one operator, `<account>.r2.cloudflarestorage.com` or a self-hosted
   * MinIO for the next. There is no host to compile in, so this connector's
   * allowlist is authored in its own configuration and applied per call.
   *
   * Empty here is load-bearing: it means the shared health probe, which checks
   * a URL against this list before fetching, can never reach the network for
   * this connector by accident.
   */
  "media-relay": [],
} as const;

export type ConnectorId = keyof typeof connectorEgressHosts;
