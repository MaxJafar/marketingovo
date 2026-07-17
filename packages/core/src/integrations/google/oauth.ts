// Legacy Google OAuth token-file compatibility.
//
// IMPORTANT: active Community audits use the local credential vault and the
// narrow GoogleAccessTokenManager contract below. File and environment helpers
// in this module exist only for explicit legacy import/backward compatibility;
// the orchestrator must never auto-discover or invoke them.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { envStr } from "../../env.js";
import { safeGoogleOAuthFetch } from "@agentseoapp/integrations";

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
  accessToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  scope: string;
}

const FIVE_MIN = 5 * 60 * 1000;

function absoluteExpiry(raw: Record<string, unknown>): number {
  const stored = Number(raw.expires_at ?? raw.expiry_date);
  if (Number.isFinite(stored) && stored > 0) {
    // Tolerate epoch seconds from hand-written token files.
    return stored < 1_000_000_000_000 ? stored * 1000 : stored;
  }
  const issuedAt = Number(raw.issued_at ?? raw.created_at);
  const expiresIn = Number(raw.expires_in);
  if (Number.isFinite(issuedAt) && issuedAt > 0 && Number.isFinite(expiresIn)) {
    const issuedAtMs =
      issuedAt < 1_000_000_000_000 ? issuedAt * 1000 : issuedAt;
    return issuedAtMs + expiresIn * 1000;
  }
  // A relative expires_in cannot survive a process restart safely. Treat
  // legacy files without an absolute timestamp as expired and refresh.
  return Date.now() - 1;
}

export function readTokenFile(path: string): OAuthCreds {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<
    string,
    unknown
  >;
  return {
    clientId: String(raw.client_id ?? ""),
    clientSecret: String(raw.client_secret ?? ""),
    refreshToken: raw.refresh_token ? String(raw.refresh_token) : null,
    accessToken: String(raw.access_token ?? ""),
    expiresAt: absoluteExpiry(raw),
    scope: String(raw.scope ?? ""),
  };
}

export function writeTokenFile(
  path: string,
  c: OAuthCreds,
  additional?: Record<string, unknown>,
): void {
  const out: Record<string, unknown> = {
    ...(additional ?? {}),
    access_token: c.accessToken,
    expires_in: Math.max(0, Math.floor((c.expiresAt - Date.now()) / 1000)),
    expires_at: c.expiresAt,
    scope: c.scope,
    token_type: "Bearer",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    ...(c.refreshToken ? { refresh_token: c.refreshToken } : {}),
  };
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tempPath = join(dirname(path), `.${randomUUID()}.token.tmp`);
  try {
    // Atomic same-directory replacement avoids truncated/replayed partial
    // credentials if the process exits while refreshing a token.
    writeFileSync(tempPath, JSON.stringify(out, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, path);
    chmodSync(path, 0o600);
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // Preserve the original write error.
    }
    throw err;
  }
}

/**
 * Refresh an OAuth creds object against Google's token endpoint.
 * Returns a new OAuthCreds with the refreshed access token.
 */
export async function refreshAccessToken(
  c: OAuthCreds,
  tokenUri = "https://oauth2.googleapis.com/token",
  fetchImpl: typeof fetch = safeGoogleOAuthFetch,
): Promise<OAuthCreds> {
  if (!c.refreshToken) {
    throw new Error(
      "no refresh_token available; the operator must re-authorize via " +
        "the Google OAuth flow (e.g. by running the original setup script " +
        "or 'gog auth add' with the analytics/search-console scopes).",
    );
  }
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetchImpl(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "error",
  });
  if (!res.ok) {
    // Provider error bodies are deliberately excluded because some OAuth
    // servers echo request context that must not reach logs or reports.
    void res.body?.cancel().catch(() => undefined);
    throw new Error(`OAuth refresh failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!json.access_token || !Number.isFinite(json.expires_in)) {
    throw new Error("OAuth refresh returned an invalid token response");
  }
  return {
    ...c,
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope ?? c.scope,
  };
}

/**
 * Ensure a creds object has a valid access token. Refreshes if the
 * existing one is within 5 minutes of expiry. The result may be the
 * same object (no refresh needed) or a new one (refreshed).
 */
export async function ensureFresh(
  c: OAuthCreds,
  fetchImpl: typeof fetch = safeGoogleOAuthFetch,
): Promise<OAuthCreds> {
  if (c.expiresAt - Date.now() > FIVE_MIN) return c;
  return refreshAccessToken(c, undefined, fetchImpl);
}

/**
 * Narrow token contract consumed by Google API clients. Runtime hosts can
 * supply a vault-backed implementation without exposing file paths or secret
 * material to the crawler package.
 */
export interface GoogleAccessTokenManager {
  refresh(): Promise<Pick<OAuthCreds, "accessToken">>;
}

export interface ManagedTokenFile extends GoogleAccessTokenManager {
  path: string;
  creds: OAuthCreds;
  /** Refresh the access token if needed and persist back to disk. */
  refresh(): Promise<OAuthCreds>;
  /** Persist the creds back to disk. */
  persist(updated: OAuthCreds): void;
}

/** @deprecated Legacy migration/backward-compatibility helper only. */
export function manageTokenFile(
  path: string,
  fetchImpl: typeof fetch = safeGoogleOAuthFetch,
): ManagedTokenFile {
  if (!existsSync(path)) {
    throw new Error(`token file not found: ${path}`);
  }
  let creds = readTokenFile(path);
  let refreshInFlight: Promise<OAuthCreds> | null = null;
  return {
    path,
    get creds() {
      return creds;
    },
    async refresh(): Promise<OAuthCreds> {
      if (creds.expiresAt - Date.now() > FIVE_MIN) return creds;
      if (!refreshInFlight) {
        refreshInFlight = (async () => {
          const next = await ensureFresh(creds, fetchImpl);
          if (next !== creds) {
            writeTokenFile(path, next);
            creds = next;
          }
          return creds;
        })().finally(() => {
          refreshInFlight = null;
        });
      }
      return refreshInFlight;
    },
    persist(updated: OAuthCreds): void {
      writeTokenFile(path, updated);
      creds = updated;
    },
  };
}

/** @deprecated Legacy migration/backward-compatibility helper only. */
export function resolveTokenFiles(): {
  gsc: string | null;
  ga4: string | null;
} {
  const candidates = {
    gsc: [
      envStr("AGENTSEO_GSC_TOKEN", "SCREAMINGCLAW_GSC_TOKEN", ""),
      join(
        process.env.HOME ?? "/root",
        ".config/google-search-console/token.json",
      ),
    ].filter((x): x is string => !!x),
    ga4: [
      envStr("AGENTSEO_GA4_TOKEN", "SCREAMINGCLAW_GA4_TOKEN", ""),
      join(process.env.HOME ?? "/root", ".config/google-analytics/token.json"),
    ].filter((x): x is string => !!x),
  };
  const firstExisting = (paths: string[]): string | null =>
    paths.find((p) => existsSync(p)) ?? null;
  return {
    gsc: firstExisting(candidates.gsc),
    ga4: firstExisting(candidates.ga4),
  };
}
