// Crawl configuration. Everything is loaded from env (not argv) so
// secrets and URLs do not appear in `ps`. Operators can drop a JSON
// file at `MARKETINGOVO_CONFIG=/path/to/config.json` (legacy
// `SCREAMINGCLAW_CONFIG` is also honored) for richer configuration
// (basic auth, cookies, link follow rules).
//
// Auth and cookies are SENSITIVE. They are written to the audit log
// only with `[REDACTED]` markers.

import { readFileSync, existsSync } from "node:fs";
import { envBool, envInt, envStr } from "../env.js";

export interface CrawlConfig {
  // Link-follow rules. Default: follow all, no rel-filter.
  followNofollow: boolean; // when false (default), links with rel="nofollow" are not enqueued
  followExternal: boolean; // when false, external links are still extracted but not enqueued (BFS stays in-scope)
  // Crawl depth cap. 0 = unlimited.
  maxDepth: number;
  // Basic auth (HTTP Basic). URL-decoded user:pass.
  basicAuth: { username: string; password: string } | null;
  // Pre-set cookies sent with every request.
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  // Extra path to append to the User-Agent string (e.g. " (+contact@example.com)").
  userAgentSuffix: string;
}

const DEFAULT: CrawlConfig = {
  followNofollow: false,
  followExternal: false,
  maxDepth: 0,
  basicAuth: null,
  cookies: [],
  userAgentSuffix: "",
};

function fromEnv(): CrawlConfig {
  const cfg: CrawlConfig = { ...DEFAULT };
  if (
    envBool(
      "MARKETINGOVO_FOLLOW_NOFOLLOW",
      "SCREAMINGCLAW_FOLLOW_NOFOLLOW",
      false,
    )
  )
    cfg.followNofollow = true;
  if (
    envBool(
      "MARKETINGOVO_FOLLOW_EXTERNAL",
      "SCREAMINGCLAW_FOLLOW_EXTERNAL",
      false,
    )
  )
    cfg.followExternal = true;
  cfg.maxDepth = envInt(
    "MARKETINGOVO_MAX_DEPTH",
    "SCREAMINGCLAW_MAX_DEPTH",
    0,
    50,
  );
  const basicAuth = envStr(
    "MARKETINGOVO_BASIC_AUTH",
    "SCREAMINGCLAW_BASIC_AUTH",
    "",
  );
  if (basicAuth) {
    const idx = basicAuth.indexOf(":");
    if (idx > 0) {
      cfg.basicAuth = {
        username: basicAuth.slice(0, idx),
        password: basicAuth.slice(idx + 1),
      };
    }
  }
  const cookies = envStr("MARKETINGOVO_COOKIES", "SCREAMINGCLAW_COOKIES", "");
  if (cookies) {
    // Format: "name1=value1; name2=value2" (browser-style)
    for (const pair of cookies.split(";")) {
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name && value) cfg.cookies.push({ name, value });
    }
  }
  cfg.userAgentSuffix = envStr(
    "MARKETINGOVO_UA_SUFFIX",
    "SCREAMINGCLAW_UA_SUFFIX",
    "",
  );
  return cfg;
}

function fromFile(path: string): CrawlConfig {
  if (!existsSync(path)) return fromEnv();
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `MARKETINGOVO_CONFIG: invalid JSON: ${(err as Error).message}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("MARKETINGOVO_CONFIG: expected object");
  }
  const o = parsed as Record<string, unknown>;
  const base = fromEnv();
  const cfg: CrawlConfig = { ...base };
  if (typeof o.followNofollow === "boolean")
    cfg.followNofollow = o.followNofollow;
  if (typeof o.followExternal === "boolean")
    cfg.followExternal = o.followExternal;
  if (typeof o.maxDepth === "number" && o.maxDepth > 0) {
    cfg.maxDepth = Math.min(o.maxDepth, 50);
  }
  if (
    o.basicAuth &&
    typeof o.basicAuth === "object" &&
    typeof (o.basicAuth as Record<string, unknown>).username === "string" &&
    typeof (o.basicAuth as Record<string, unknown>).password === "string"
  ) {
    cfg.basicAuth = o.basicAuth as CrawlConfig["basicAuth"];
  }
  if (Array.isArray(o.cookies)) {
    cfg.cookies = [];
    for (const c of o.cookies) {
      if (
        c &&
        typeof c === "object" &&
        typeof (c as Record<string, unknown>).name === "string" &&
        typeof (c as Record<string, unknown>).value === "string"
      ) {
        cfg.cookies.push(c as CrawlConfig["cookies"][number]);
      }
    }
  }
  if (typeof o.userAgentSuffix === "string")
    cfg.userAgentSuffix = o.userAgentSuffix;
  return cfg;
}

export function loadCrawlConfig(): CrawlConfig {
  const path = envStr("MARKETINGOVO_CONFIG", "SCREAMINGCLAW_CONFIG", "");
  if (path) return fromFile(path);
  return fromEnv();
}

// Build the final User-Agent string (base + suffix).
export function buildUserAgent(base: string, suffix: string): string {
  if (!suffix) return base;
  if (suffix.startsWith(" ")) return base + suffix;
  return `${base} ${suffix}`;
}

// Build the Cookie header value from the cookie list.
export function buildCookieHeader(
  cookies: CrawlConfig["cookies"],
  host: string,
): string {
  const pairs: string[] = [];
  for (const c of cookies) {
    if (c.domain && c.domain !== host) continue;
    pairs.push(`${c.name}=${c.value}`);
  }
  return pairs.join("; ");
}

// Build the Authorization header value, or null if no basic auth.
export function buildAuthHeader(
  basicAuth: CrawlConfig["basicAuth"],
): string | null {
  if (!basicAuth) return null;
  const encoded = Buffer.from(
    `${basicAuth.username}:${basicAuth.password}`,
  ).toString("base64");
  return `Basic ${encoded}`;
}
