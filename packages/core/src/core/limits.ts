// Limit configuration. All values are loaded from env with safe defaults.
// Never read these from argv so URLs and secrets don't leak into `ps`.
//
// Env var naming: primary is `AGENTSEO_*`. The historical `SCREAMINGCLAW_*`
// names are still honored as a fallback (see src/env.ts) so existing
// scripts and the agentseo-dashboard backend keep working without
// changes. A one-time deprecation warning is logged per legacy name.

import { envBool, envInt, envStr } from "../env.js";

export const AGENTSEO_DEFAULT_USER_AGENT = "AGENTseo/1.0.0";

export interface Limits {
  maxUrls: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
  requestsPerSecond: number;
  requestTimeoutMs: number;
  maxBodyBytes: number;
  maxRedirects: number;
  userAgent: string;
  allowPrivate: boolean;
  ignoreRobots: boolean;
  renderMode: "static" | "js";
  customHeaders: Record<string, string>;
  /** When true, CrawledPage.rawHtml is populated for css-exists rules. */
  keepRawHtml: boolean;
}

/**
 * Defensive configuration boundary, not a AGENTseo entitlement or
 * audit quota. Users choose the crawl scope that fits their machine; this
 * rejects corrupt or accidentally unbounded numeric input before allocation.
 */
export const MAX_URLS_CONFIGURATION_BOUNDARY = 1_000_000;
const HARD_MAX_RUNTIME_MS = 600_000; // 10 minutes
const HARD_MAX_CONCURRENCY = 32;
const HARD_MAX_RPS = 50;
const HARD_TIMEOUT_MS = 60_000;
const HARD_MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB absolute ceiling
const HARD_MAX_REDIRECTS = 10;

export function validateMaxUrls(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("maxUrls must be a positive finite integer");
  }
  if (value > MAX_URLS_CONFIGURATION_BOUNDARY) {
    throw new RangeError(
      `maxUrls exceeds the ${MAX_URLS_CONFIGURATION_BOUNDARY.toLocaleString("en-US")} URL configuration safety boundary`,
    );
  }
  return value;
}

function readEnvRenderMode(): "static" | "js" {
  const raw = envStr("AGENTSEO_RENDER", "SCREAMINGCLAW_RENDER", "static");
  return raw === "js" ? "js" : "static";
}

function readEnvHeaders(): Record<string, string> {
  // Format: "Key1: Value1|Key2: Value2". Empty -> no custom headers.
  const raw = envStr("AGENTSEO_HEADERS", "SCREAMINGCLAW_HEADERS", "");
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split("|")) {
    const idx = pair.indexOf(":");
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function loadLimits(): Limits {
  return {
    maxUrls: envInt(
      "AGENTSEO_MAX_URLS",
      "SCREAMINGCLAW_MAX_URLS",
      500,
      MAX_URLS_CONFIGURATION_BOUNDARY,
    ),
    maxRuntimeMs: envInt(
      "AGENTSEO_MAX_RUNTIME_MS",
      "SCREAMINGCLAW_MAX_RUNTIME_MS",
      300_000,
      HARD_MAX_RUNTIME_MS,
    ),
    maxConcurrency: envInt(
      "AGENTSEO_MAX_CONCURRENCY",
      "SCREAMINGCLAW_MAX_CONCURRENCY",
      4,
      HARD_MAX_CONCURRENCY,
    ),
    requestsPerSecond: envInt(
      "AGENTSEO_REQUESTS_PER_SECOND",
      "SCREAMINGCLAW_REQUESTS_PER_SECOND",
      5,
      HARD_MAX_RPS,
    ),
    requestTimeoutMs: envInt(
      "AGENTSEO_REQUEST_TIMEOUT_MS",
      "SCREAMINGCLAW_REQUEST_TIMEOUT_MS",
      15_000,
      HARD_TIMEOUT_MS,
    ),
    maxBodyBytes: envInt(
      "AGENTSEO_MAX_BODY_BYTES",
      "SCREAMINGCLAW_MAX_BODY_BYTES",
      5 * 1024 * 1024,
      HARD_MAX_BODY_BYTES,
    ),
    maxRedirects: envInt(
      "AGENTSEO_MAX_REDIRECTS",
      "SCREAMINGCLAW_MAX_REDIRECTS",
      5,
      HARD_MAX_REDIRECTS,
    ),
    userAgent: envStr(
      "AGENTSEO_USER_AGENT",
      "SCREAMINGCLAW_USER_AGENT",
      AGENTSEO_DEFAULT_USER_AGENT,
    ),
    allowPrivate: envBool(
      "AGENTSEO_ALLOW_PRIVATE",
      "SCREAMINGCLAW_ALLOW_PRIVATE",
      false,
    ),
    ignoreRobots: envBool(
      "AGENTSEO_IGNORE_ROBOTS",
      "SCREAMINGCLAW_IGNORE_ROBOTS",
      false,
    ),
    renderMode: readEnvRenderMode(),
    customHeaders: readEnvHeaders(),
    keepRawHtml: envBool(
      "AGENTSEO_KEEP_HTML",
      "SCREAMINGCLAW_KEEP_HTML",
      false,
    ),
  };
}
