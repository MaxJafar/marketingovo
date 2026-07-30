import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createGoogleOAuthTransaction,
  exchangeGoogleAuthorizationCode,
  GoogleOAuthError,
  isGoogleOAuthProvider,
} from "@marketingovo/integrations";
import type { MarketingovoLocalRuntime } from "@marketingovo/runtime";

export interface GoogleOAuthStartResponse {
  provider: string;
  authorizationUrl: string;
  expiresAt: string;
}

export class OAuthBrokerProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;

  constructor(status: number, code: string, title: string, detail: string) {
    super(detail);
    this.name = "OAuthBrokerProblem";
    this.status = status;
    this.code = code;
    this.title = title;
  }
}

export interface GoogleDesktopOAuthBrokerOptions {
  runtime: MarketingovoLocalRuntime;
  clientId?: string;
  fetchImpl?: typeof fetch;
  transactionTtlMs?: number;
  now?: () => number;
}

function writeProblem(
  response: ServerResponse,
  problem: OAuthBrokerProblem,
): void {
  response.writeHead(problem.status, {
    "content-type": "application/problem+json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(
    JSON.stringify({
      type: `urn:marketingovo:problem:${problem.code.replaceAll("_", "-")}`,
      title: problem.title,
      status: problem.status,
      detail: problem.message,
      code: problem.code,
    }),
  );
}

function writeSuccess(response: ServerResponse, provider: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
  });
  response.end(
    `<!doctype html><meta charset="utf-8"><title>Marketingovo connected</title><style>body{font:16px system-ui;margin:3rem;max-width:42rem}h1{font-size:1.5rem}</style><h1>Google connected</h1><p>${provider === "google-search-console" ? "Search Console" : "Google Analytics 4"} is connected. You can close this window.</p>`,
  );
}

function callbackProblem(error: unknown): OAuthBrokerProblem {
  if (error instanceof GoogleOAuthError) {
    if (
      error.code === "oauth_transaction_expired" ||
      error.code === "oauth_transaction_replayed"
    ) {
      return new OAuthBrokerProblem(
        410,
        error.code,
        "OAuth transaction expired",
        "Start a new connection from the Integrations screen.",
      );
    }
    if (error.code === "oauth_state_mismatch") {
      return new OAuthBrokerProblem(
        400,
        error.code,
        "OAuth callback rejected",
        "The OAuth callback state did not match the active transaction.",
      );
    }
  }
  return new OAuthBrokerProblem(
    502,
    "oauth_exchange_failed",
    "Google connection failed",
    "Google OAuth could not be completed. Start a new connection and try again.",
  );
}

export class GoogleDesktopOAuthBroker {
  private readonly runtime: MarketingovoLocalRuntime;
  private readonly clientId: string | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly transactionTtlMs: number;
  private readonly now: () => number;
  private readonly listeners = new Set<Server>();
  private readonly timers = new Map<Server, NodeJS.Timeout>();

  constructor(options: GoogleDesktopOAuthBrokerOptions) {
    this.runtime = options.runtime;
    this.clientId = options.clientId?.trim() || undefined;
    this.fetchImpl = options.fetchImpl;
    this.transactionTtlMs = options.transactionTtlMs ?? 5 * 60_000;
    this.now = options.now ?? Date.now;
  }

  async start(
    provider: string,
    account = "default",
  ): Promise<GoogleOAuthStartResponse> {
    if (!this.clientId) {
      throw new OAuthBrokerProblem(
        503,
        "google_oauth_not_configured",
        "Google OAuth is not configured",
        "Set MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID or pass googleDesktopClientId to the local server. The legacy GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID and GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID names remain migration aliases.",
      );
    }
    if (!isGoogleOAuthProvider(provider)) {
      throw new OAuthBrokerProblem(
        400,
        "oauth_provider_unsupported",
        "OAuth is not supported",
        "This provider does not support Google desktop OAuth.",
      );
    }
    const normalizedAccount = account.trim();
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(normalizedAccount)) {
      throw new OAuthBrokerProblem(
        400,
        "oauth_account_invalid",
        "OAuth account is invalid",
        "The local OAuth account key must contain only letters, numbers, dots, underscores, or hyphens.",
      );
    }
    if (this.listeners.size >= 8) {
      throw new OAuthBrokerProblem(
        429,
        "oauth_too_many_transactions",
        "Too many OAuth transactions",
        "Finish or wait for an existing OAuth connection before starting another.",
      );
    }

    let expectedHost = "";
    let transaction:
      ReturnType<typeof createGoogleOAuthTransaction> | undefined;
    const listener = createServer((request, response) => {
      void (async () => {
        if (request.headers.host !== expectedHost) {
          writeProblem(
            response,
            new OAuthBrokerProblem(
              421,
              "oauth_invalid_host",
              "Misdirected OAuth callback",
              "The callback Host header is not accepted.",
            ),
          );
          return;
        }
        const callback = new URL(request.url ?? "/", `http://${expectedHost}`);
        if (
          request.method !== "GET" ||
          callback.pathname !== "/oauth/callback"
        ) {
          writeProblem(
            response,
            new OAuthBrokerProblem(
              404,
              "oauth_callback_not_found",
              "OAuth callback not found",
              "This loopback listener accepts only the active OAuth callback.",
            ),
          );
          return;
        }
        if (!transaction) {
          writeProblem(
            response,
            new OAuthBrokerProblem(
              503,
              "oauth_transaction_unavailable",
              "OAuth transaction unavailable",
              "Start a new connection from the Integrations screen.",
            ),
          );
          return;
        }

        try {
          transaction.consume(
            callback.searchParams.get("state") ?? undefined,
            this.now(),
          );
          const oauthError = callback.searchParams.get("error");
          const code = callback.searchParams.get("code");
          if (oauthError) {
            throw new OAuthBrokerProblem(
              400,
              "oauth_access_denied",
              "Google access was not granted",
              "Google did not grant access to the requested integration.",
            );
          }
          if (!code) {
            throw new OAuthBrokerProblem(
              400,
              "oauth_code_missing",
              "OAuth callback rejected",
              "Google did not provide an authorization code.",
            );
          }
          const tokenSet = await exchangeGoogleAuthorizationCode({
            provider,
            clientId: this.clientId!,
            code,
            codeVerifier: transaction.codeVerifier,
            redirectUri: transaction.redirectUri,
            ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
            now: this.now(),
          });
          await this.runtime.integrations.completeOAuth(
            provider,
            normalizedAccount,
            tokenSet,
          );
          writeSuccess(response, provider);
        } catch (error) {
          writeProblem(
            response,
            error instanceof OAuthBrokerProblem
              ? error
              : callbackProblem(error),
          );
        } finally {
          // Close after the first valid callback attempt. The transaction also
          // rejects reuse atomically; a short grace window lets a replay receive
          // an explicit 410 before the one-shot listener disappears.
          this.scheduleClose(listener);
        }
      })().catch(() => {
        if (!response.headersSent)
          writeProblem(response, callbackProblem(undefined));
        this.scheduleClose(listener);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      listener.once("error", onError);
      listener.listen(0, "127.0.0.1", () => {
        listener.off("error", onError);
        resolve();
      });
    });
    const address = listener.address() as AddressInfo | null;
    if (!address || address.address !== "127.0.0.1" || address.port <= 0) {
      listener.close();
      throw new OAuthBrokerProblem(
        500,
        "oauth_listener_failed",
        "OAuth listener failed",
        "The loopback callback listener could not be started.",
      );
    }
    expectedHost = `127.0.0.1:${address.port}`;
    try {
      transaction = createGoogleOAuthTransaction({
        provider,
        clientId: this.clientId,
        redirectUri: `http://${expectedHost}/oauth/callback`,
        now: this.now(),
        ttlMs: this.transactionTtlMs,
      });
    } catch (error) {
      listener.close();
      throw error;
    }
    this.listeners.add(listener);
    // Keep a short post-expiry grace period so the browser receives a clear
    // problem response instead of an opaque connection-refused page.
    const timer = setTimeout(
      () => listener.close(),
      this.transactionTtlMs + 1_000,
    );
    timer.unref();
    this.timers.set(listener, timer);
    listener.once("close", () => {
      const activeTimer = this.timers.get(listener);
      if (activeTimer) clearTimeout(activeTimer);
      this.timers.delete(listener);
      this.listeners.delete(listener);
    });

    return {
      provider,
      authorizationUrl: transaction.authorizationUrl,
      expiresAt: transaction.expiresAt,
    };
  }

  private scheduleClose(listener: Server): void {
    const current = this.timers.get(listener);
    if (current) clearTimeout(current);
    const timer = setTimeout(() => listener.close(), 1_000);
    timer.unref();
    this.timers.set(listener, timer);
  }

  async close(): Promise<void> {
    const listeners = [...this.listeners];
    for (const listener of listeners) {
      const timer = this.timers.get(listener);
      if (timer) clearTimeout(timer);
      listener.closeAllConnections();
    }
    await Promise.all(
      listeners.map(
        (listener) =>
          new Promise<void>((resolve) => {
            if (!listener.listening) return resolve();
            listener.close(() => resolve());
          }),
      ),
    );
    this.listeners.clear();
    this.timers.clear();
  }
}
