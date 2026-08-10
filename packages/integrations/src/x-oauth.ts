import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSafeProviderFetch } from "./provider-fetch.js";

/**
 * X (Twitter) OAuth 2.0 with PKCE, against an app the operator registers.
 *
 * Structurally the same as the Google installed-app flow, and deliberately so:
 * a public client with no secret, a one-time state, a loopback callback on a
 * random port. Two things differ and both matter.
 *
 * X issues a refresh token only when `offline.access` is requested, and
 * refreshing **rotates** it — the old one dies. A refresh that succeeds but
 * whose result is not persisted therefore locks the operator out, so the
 * caller must store the new token before using the access token.
 *
 * X also requires the client id in the refresh body for public clients, where
 * Google accepts it alone.
 */

export const X_OAUTH_AUTHORIZATION_ENDPOINT =
  "https://x.com/i/oauth2/authorize";
export const X_OAUTH_TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";

/**
 * `tweet.write` is the point; `users.read` identifies which account the token
 * posts as, which the operator needs to see before approving anything;
 * `offline.access` is what makes a refresh token exist at all, and without it
 * the connection dies in two hours.
 */
export const X_OAUTH_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
] as const;

export type XOAuthErrorCode =
  | "oauth_redirect_invalid"
  | "oauth_state_mismatch"
  | "oauth_transaction_expired"
  | "oauth_transaction_replayed"
  | "oauth_exchange_failed"
  | "oauth_token_invalid"
  | "oauth_scope_missing";

export class XOAuthError extends Error {
  readonly code: XOAuthErrorCode;

  constructor(code: XOAuthErrorCode, message: string) {
    super(message);
    this.name = "XOAuthError";
    this.code = code;
  }
}

export interface XOAuthTokenSet {
  accessToken: string;
  /** Rotated on every refresh. Persist before using the access token. */
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
}

const safeXOAuthFetch = createSafeProviderFetch({
  allowedHosts: ["api.twitter.com"],
});

function validateLoopbackRedirectUri(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new XOAuthError(
      "oauth_redirect_invalid",
      "OAuth redirect URI is invalid",
    );
  }
  const port = Number(url.port);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    url.username ||
    url.password ||
    url.pathname !== "/oauth/callback" ||
    url.search ||
    url.hash
  ) {
    throw new XOAuthError(
      "oauth_redirect_invalid",
      "X desktop OAuth callbacks must use a random 127.0.0.1 loopback port",
    );
  }
  return url.toString();
}

function secureStateEqual(
  actual: string | undefined,
  expected: string,
): boolean {
  if (!actual) return false;
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export class XOAuthTransaction {
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly authorizationUrl: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string;
  private readonly expiresAtEpochMs: number;
  private consumed = false;

  constructor(options: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeVerifier: string;
    now: number;
    ttlMs: number;
  }) {
    this.state = options.state;
    this.codeVerifier = options.codeVerifier;
    this.codeChallenge = createHash("sha256")
      .update(options.codeVerifier)
      .digest("base64url");
    this.redirectUri = validateLoopbackRedirectUri(options.redirectUri);
    this.scopes = X_OAUTH_SCOPES;
    this.expiresAtEpochMs = options.now + options.ttlMs;
    this.expiresAt = new Date(this.expiresAtEpochMs).toISOString();

    const authorization = new URL(X_OAUTH_AUTHORIZATION_ENDPOINT);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", options.clientId);
    authorization.searchParams.set("redirect_uri", this.redirectUri);
    authorization.searchParams.set("scope", this.scopes.join(" "));
    authorization.searchParams.set("state", this.state);
    authorization.searchParams.set("code_challenge", this.codeChallenge);
    authorization.searchParams.set("code_challenge_method", "S256");
    this.authorizationUrl = authorization.toString();
  }

  /** Atomically consumes the callback state. Every transaction is one-use. */
  consume(actualState: string | undefined, now = Date.now()): void {
    if (this.consumed) {
      throw new XOAuthError(
        "oauth_transaction_replayed",
        "OAuth callback was already used",
      );
    }
    this.consumed = true;
    if (now >= this.expiresAtEpochMs) {
      throw new XOAuthError(
        "oauth_transaction_expired",
        "OAuth transaction expired",
      );
    }
    if (!secureStateEqual(actualState, this.state)) {
      throw new XOAuthError(
        "oauth_state_mismatch",
        "OAuth callback state does not match",
      );
    }
  }
}

export function createXOAuthTransaction(options: {
  clientId: string;
  redirectUri: string;
  now?: number;
  ttlMs?: number;
}): XOAuthTransaction {
  const clientId = options.clientId.trim();
  if (!clientId) {
    throw new XOAuthError(
      "oauth_exchange_failed",
      "Register an X app and supply its OAuth 2.0 client ID before connecting.",
    );
  }
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 10 * 60_000) {
    throw new XOAuthError(
      "oauth_transaction_expired",
      "OAuth transaction lifetime is invalid",
    );
  }
  return new XOAuthTransaction({
    clientId,
    redirectUri: options.redirectUri,
    state: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(64).toString("base64url"),
    now: options.now ?? Date.now(),
    ttlMs,
  });
}

function asTokenSet(
  payload: unknown,
  now: number,
  fallbackRefresh?: string,
): XOAuthTokenSet {
  if (!payload || typeof payload !== "object") {
    throw new XOAuthError(
      "oauth_token_invalid",
      "X returned an invalid token response",
    );
  }
  const record = payload as Record<string, unknown>;
  const expiresIn = record.expires_in;
  const refreshToken =
    typeof record.refresh_token === "string" && record.refresh_token
      ? record.refresh_token
      : fallbackRefresh;
  if (
    typeof record.access_token !== "string" ||
    !record.access_token ||
    !refreshToken ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new XOAuthError(
      "oauth_token_invalid",
      "X returned an incomplete token response",
    );
  }
  const scopes =
    typeof record.scope === "string" && record.scope.trim()
      ? [...new Set(record.scope.trim().split(/\s+/))]
      : [...X_OAUTH_SCOPES];
  if (!scopes.includes("tweet.write")) {
    throw new XOAuthError(
      "oauth_scope_missing",
      "The X connection was granted without tweet.write, so it cannot post. Reconnect and accept the posting permission.",
    );
  }
  return {
    accessToken: record.access_token,
    refreshToken,
    tokenType:
      typeof record.token_type === "string" ? record.token_type : "bearer",
    expiresAt: new Date(now + expiresIn * 1_000).toISOString(),
    scopes,
  };
}

export async function exchangeXAuthorizationCode(options: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<XOAuthTokenSet> {
  const redirectUri = validateLoopbackRedirectUri(options.redirectUri);
  if (!options.code || !options.clientId.trim()) {
    throw new XOAuthError(
      "oauth_exchange_failed",
      "OAuth code exchange parameters are incomplete",
    );
  }
  const response = await (options.fetchImpl ?? safeXOAuthFetch)(
    X_OAUTH_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: options.clientId.trim(),
        code: options.code,
        code_verifier: options.codeVerifier,
        redirect_uri: redirectUri,
      }),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new XOAuthError(
      "oauth_exchange_failed",
      `X token exchange failed with status ${response.status}`,
    );
  }
  return asTokenSet(await response.json(), options.now ?? Date.now());
}

/**
 * Refreshes, returning the rotated refresh token.
 *
 * X invalidates the old refresh token the moment this succeeds. The caller
 * must persist the returned pair before making any request with the access
 * token: a crash in between leaves a connection that cannot be refreshed and
 * has to be reconnected by hand.
 */
export async function refreshXOAuthToken(options: {
  clientId: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<XOAuthTokenSet> {
  if (!options.clientId.trim() || !options.refreshToken) {
    throw new XOAuthError(
      "oauth_exchange_failed",
      "OAuth refresh parameters are incomplete",
    );
  }
  const response = await (options.fetchImpl ?? safeXOAuthFetch)(
    X_OAUTH_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: options.clientId.trim(),
        refresh_token: options.refreshToken,
      }),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new XOAuthError(
      "oauth_exchange_failed",
      `X token refresh failed with status ${response.status}. Reconnect the account if this persists — X rotates refresh tokens and an interrupted refresh cannot be resumed.`,
    );
  }
  return asTokenSet(
    await response.json(),
    options.now ?? Date.now(),
    options.refreshToken,
  );
}
