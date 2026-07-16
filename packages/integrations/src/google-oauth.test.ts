import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createGoogleOAuthTransaction,
  exchangeGoogleAuthorizationCode,
  GOOGLE_OAUTH_TOKEN_ENDPOINT,
  GoogleOAuthError,
  refreshGoogleOAuthToken,
} from "./google-oauth.js";

const CLIENT_ID = "public-desktop-client.apps.googleusercontent.com";
const REDIRECT_URI = "http://127.0.0.1:43127/oauth/callback";

describe("Google desktop OAuth PKCE", () => {
  it("uses S256, cryptographic state, offline access, and the exact loopback redirect", () => {
    const transaction = createGoogleOAuthTransaction({
      provider: "google-search-console",
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      now: Date.parse("2026-07-15T09:00:00Z"),
    });
    const authorization = new URL(transaction.authorizationUrl);
    expect(authorization.protocol).toBe("https:");
    expect(authorization.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(authorization.searchParams.get("state")).toBe(transaction.state);
    expect(transaction.state.length).toBeGreaterThanOrEqual(43);
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorization.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(transaction.codeVerifier).digest("base64url"),
    );
    expect(authorization.searchParams.get("access_type")).toBe("offline");
    expect(authorization.searchParams.get("prompt")).toBe("consent");
    expect(transaction.authorizationUrl).not.toContain(
      transaction.codeVerifier,
    );
  });

  it("rejects a state mismatch and makes the transaction one-time", () => {
    const transaction = createGoogleOAuthTransaction({
      provider: "google-search-console",
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      now: 1_000,
      ttlMs: 5_000,
    });
    expect(() => transaction.consume("wrong-state", 2_000)).toThrowError(
      expect.objectContaining<Partial<GoogleOAuthError>>({
        code: "oauth_state_mismatch",
      }),
    );
    expect(() => transaction.consume(transaction.state, 2_001)).toThrowError(
      expect.objectContaining<Partial<GoogleOAuthError>>({
        code: "oauth_transaction_replayed",
      }),
    );
  });

  it("rejects an expired transaction", () => {
    const transaction = createGoogleOAuthTransaction({
      provider: "google-analytics-4",
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      now: 1_000,
      ttlMs: 1_000,
    });
    expect(() => transaction.consume(transaction.state, 2_000)).toThrowError(
      expect.objectContaining<Partial<GoogleOAuthError>>({
        code: "oauth_transaction_expired",
      }),
    );
  });

  it("exchanges the code without a client secret and returns an absolute expiry", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "access-token-secret",
            refresh_token: "refresh-token-secret",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/webmasters.readonly",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const tokenSet = await exchangeGoogleAuthorizationCode({
      provider: "google-search-console",
      clientId: CLIENT_ID,
      code: "one-time-code",
      codeVerifier: "v".repeat(64),
      redirectUri: REDIRECT_URI,
      fetchImpl,
      now: Date.parse("2026-07-15T09:00:00Z"),
    });

    expect(tokenSet.expiresAt).toBe("2026-07-15T10:00:00.000Z");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(GOOGLE_OAUTH_TOKEN_ENDPOINT);
    expect(init?.redirect).toBe("error");
    const requestBody = String(init?.body);
    expect(requestBody).toContain("code_verifier=");
    expect(requestBody).not.toContain("client_secret");
  });

  it("refreshes a vault credential without redirecting or sending a client secret", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "rotated-access-token",
            expires_in: 1800,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const refreshed = await refreshGoogleOAuthToken({
      provider: "google-analytics-4",
      clientId: CLIENT_ID,
      refreshToken: "vault-refresh-token",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      fetchImpl,
      now: Date.parse("2026-07-15T09:00:00Z"),
    });

    expect(refreshed.expiresAt).toBe("2026-07-15T09:30:00.000Z");
    expect(refreshed.refreshToken).toBe("vault-refresh-token");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(GOOGLE_OAUTH_TOKEN_ENDPOINT);
    expect(init?.redirect).toBe("error");
    expect(String(init?.body)).toContain("refresh_token=vault-refresh-token");
    expect(String(init?.body)).not.toContain("client_secret");
  });
});
