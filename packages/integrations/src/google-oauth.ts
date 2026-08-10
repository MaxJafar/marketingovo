import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { safeGoogleOAuthFetch } from "./provider-fetch.js";

export const GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

export const GOOGLE_OAUTH_SCOPES = {
  "google-search-console": [
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
  "google-analytics-4": ["https://www.googleapis.com/auth/analytics.readonly"],
  /**
   * Google Ads publishes no read-only scope.
   *
   * `https://www.googleapis.com/auth/adwords` is the only scope the API
   * accepts, and it grants write as well as read. That is Google's design, not
   * a choice available here, so the read-only guarantee has to be kept above
   * the credential: this product issues no mutate call, and the contract and
   * MCP suites assert that no Google Ads write surface exists. An operator
   * consenting to this screen is trusting the software, and the software is
   * auditable and local.
   */
  "google-ads": ["https://www.googleapis.com/auth/adwords"],
} as const;

export type GoogleOAuthProvider = keyof typeof GOOGLE_OAUTH_SCOPES;

export interface GoogleOAuthTokenSet {
  provider: GoogleOAuthProvider;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
}

export type GoogleOAuthErrorCode =
  | "oauth_provider_unsupported"
  | "oauth_redirect_invalid"
  | "oauth_transaction_expired"
  | "oauth_transaction_replayed"
  | "oauth_state_mismatch"
  | "oauth_exchange_failed"
  | "oauth_token_invalid"
  | "oauth_scope_missing";

export class GoogleOAuthError extends Error {
  readonly code: GoogleOAuthErrorCode;

  constructor(code: GoogleOAuthErrorCode, message: string) {
    super(message);
    this.name = "GoogleOAuthError";
    this.code = code;
  }
}

export function isGoogleOAuthProvider(
  value: string,
): value is GoogleOAuthProvider {
  return Object.hasOwn(GOOGLE_OAUTH_SCOPES, value);
}

export function googleOAuthScopes(provider: string): readonly string[] {
  if (!isGoogleOAuthProvider(provider)) {
    throw new GoogleOAuthError(
      "oauth_provider_unsupported",
      `OAuth is not supported for ${provider}`,
    );
  }
  return GOOGLE_OAUTH_SCOPES[provider];
}

function validateLoopbackRedirectUri(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GoogleOAuthError(
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
    throw new GoogleOAuthError(
      "oauth_redirect_invalid",
      "Google desktop OAuth callbacks must use a random 127.0.0.1 loopback port",
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

export class GoogleOAuthTransaction {
  readonly provider: GoogleOAuthProvider;
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
    provider: GoogleOAuthProvider;
    state: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
    now: number;
    ttlMs: number;
  }) {
    this.provider = options.provider;
    this.state = options.state;
    this.codeVerifier = options.codeVerifier;
    this.codeChallenge = createHash("sha256")
      .update(options.codeVerifier)
      .digest("base64url");
    this.redirectUri = validateLoopbackRedirectUri(options.redirectUri);
    this.scopes = GOOGLE_OAUTH_SCOPES[options.provider];
    this.expiresAtEpochMs = options.now + options.ttlMs;
    this.expiresAt = new Date(this.expiresAtEpochMs).toISOString();

    const authorization = new URL(GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT);
    authorization.searchParams.set("client_id", options.clientId);
    authorization.searchParams.set("redirect_uri", this.redirectUri);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", this.scopes.join(" "));
    authorization.searchParams.set("state", this.state);
    authorization.searchParams.set("code_challenge", this.codeChallenge);
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set("access_type", "offline");
    authorization.searchParams.set("include_granted_scopes", "true");
    authorization.searchParams.set("prompt", "consent");
    this.authorizationUrl = authorization.toString();
  }

  /** Atomically consumes the callback state. Every transaction is one-use. */
  consume(actualState: string | undefined, now = Date.now()): void {
    if (this.consumed) {
      throw new GoogleOAuthError(
        "oauth_transaction_replayed",
        "OAuth callback was already used",
      );
    }
    this.consumed = true;
    if (now >= this.expiresAtEpochMs) {
      throw new GoogleOAuthError(
        "oauth_transaction_expired",
        "OAuth transaction expired",
      );
    }
    if (!secureStateEqual(actualState, this.state)) {
      throw new GoogleOAuthError(
        "oauth_state_mismatch",
        "OAuth callback state does not match",
      );
    }
  }
}

export function createGoogleOAuthTransaction(options: {
  provider: string;
  clientId: string;
  redirectUri: string;
  now?: number;
  ttlMs?: number;
}): GoogleOAuthTransaction {
  if (!isGoogleOAuthProvider(options.provider)) {
    throw new GoogleOAuthError(
      "oauth_provider_unsupported",
      `OAuth is not supported for ${options.provider}`,
    );
  }
  const clientId = options.clientId.trim();
  if (!clientId)
    throw new GoogleOAuthError(
      "oauth_exchange_failed",
      "Google desktop OAuth client ID is required",
    );
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const now = options.now ?? Date.now();
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 10 * 60_000) {
    throw new GoogleOAuthError(
      "oauth_transaction_expired",
      "OAuth transaction lifetime is invalid",
    );
  }
  if (!Number.isFinite(now)) {
    throw new GoogleOAuthError(
      "oauth_transaction_expired",
      "OAuth transaction clock is invalid",
    );
  }
  return new GoogleOAuthTransaction({
    provider: options.provider,
    clientId,
    redirectUri: options.redirectUri,
    state: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(64).toString("base64url"),
    now,
    ttlMs,
  });
}

function asTokenResponse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new GoogleOAuthError(
      "oauth_token_invalid",
      "Google returned an invalid OAuth token response",
    );
  }
  return value as Record<string, unknown>;
}

export async function exchangeGoogleAuthorizationCode(options: {
  provider: GoogleOAuthProvider;
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<GoogleOAuthTokenSet> {
  const redirectUri = validateLoopbackRedirectUri(options.redirectUri);
  if (
    !options.code ||
    options.codeVerifier.length < 43 ||
    options.codeVerifier.length > 128 ||
    !options.clientId.trim()
  ) {
    throw new GoogleOAuthError(
      "oauth_exchange_failed",
      "OAuth code exchange parameters are incomplete",
    );
  }
  const body = new URLSearchParams({
    client_id: options.clientId.trim(),
    code: options.code,
    code_verifier: options.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await (options.fetchImpl ?? safeGoogleOAuthFetch)(
    GOOGLE_OAUTH_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      // Never forward an authorization code or verifier to a redirected host.
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new GoogleOAuthError(
      "oauth_exchange_failed",
      `Google OAuth token exchange failed with status ${response.status}`,
    );
  }

  const payload = asTokenResponse(await response.json());
  const expiresIn = payload.expires_in;
  if (
    typeof payload.access_token !== "string" ||
    !payload.access_token ||
    typeof payload.refresh_token !== "string" ||
    !payload.refresh_token ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new GoogleOAuthError(
      "oauth_token_invalid",
      "Google returned an incomplete OAuth token response",
    );
  }
  const requiredScopes = GOOGLE_OAUTH_SCOPES[options.provider];
  const scopes =
    typeof payload.scope === "string" && payload.scope.trim()
      ? [...new Set(payload.scope.trim().split(/\s+/))]
      : [...requiredScopes];
  if (requiredScopes.some((scope) => !scopes.includes(scope))) {
    throw new GoogleOAuthError(
      "oauth_scope_missing",
      "Google did not grant the required integration scope",
    );
  }
  const expiresAtEpochMs = (options.now ?? Date.now()) + expiresIn * 1000;
  if (!Number.isFinite(expiresAtEpochMs)) {
    throw new GoogleOAuthError(
      "oauth_token_invalid",
      "Google returned an invalid OAuth token expiry",
    );
  }
  return {
    provider: options.provider,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType:
      typeof payload.token_type === "string" && payload.token_type
        ? payload.token_type
        : "Bearer",
    expiresAt: new Date(expiresAtEpochMs).toISOString(),
    scopes,
  };
}

/** Refreshes an installed-app OAuth token without requiring a client secret. */
export async function refreshGoogleOAuthToken(options: {
  provider: GoogleOAuthProvider;
  clientId: string;
  refreshToken: string;
  scopes: readonly string[];
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<GoogleOAuthTokenSet> {
  const clientId = options.clientId.trim();
  if (!clientId || !options.refreshToken) {
    throw new GoogleOAuthError(
      "oauth_exchange_failed",
      "OAuth refresh parameters are incomplete",
    );
  }
  const response = await (options.fetchImpl ?? safeGoogleOAuthFetch)(
    GOOGLE_OAUTH_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: options.refreshToken,
        grant_type: "refresh_token",
      }),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new GoogleOAuthError(
      "oauth_exchange_failed",
      `Google OAuth refresh failed with status ${response.status}`,
    );
  }
  const payload = asTokenResponse(await response.json());
  const expiresIn = payload.expires_in;
  if (
    typeof payload.access_token !== "string" ||
    !payload.access_token ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new GoogleOAuthError(
      "oauth_token_invalid",
      "Google returned an incomplete OAuth refresh response",
    );
  }
  const scopes =
    typeof payload.scope === "string" && payload.scope.trim()
      ? [...new Set(payload.scope.trim().split(/\s+/))]
      : [...options.scopes];
  const requiredScopes = GOOGLE_OAUTH_SCOPES[options.provider];
  if (requiredScopes.some((scope) => !scopes.includes(scope))) {
    throw new GoogleOAuthError(
      "oauth_scope_missing",
      "The refreshed Google credential is missing a required scope",
    );
  }
  const expiresAtEpochMs = (options.now ?? Date.now()) + expiresIn * 1_000;
  if (!Number.isFinite(expiresAtEpochMs)) {
    throw new GoogleOAuthError(
      "oauth_token_invalid",
      "Google returned an invalid OAuth token expiry",
    );
  }
  return {
    provider: options.provider,
    accessToken: payload.access_token,
    refreshToken: options.refreshToken,
    tokenType:
      typeof payload.token_type === "string" && payload.token_type
        ? payload.token_type
        : "Bearer",
    expiresAt: new Date(expiresAtEpochMs).toISOString(),
    scopes,
  };
}
