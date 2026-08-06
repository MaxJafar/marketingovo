import type { IntegrationStatus } from "@marketingovo/contracts";
import { connectorEgressHosts, type ConnectorId } from "./egress.js";
import {
  isGoogleAdsCustomerId,
  normalizeCustomerId,
  normalizeGoogleAdsVersion,
} from "./google-ads.js";
import { metaGraphUrl, normalizeGraphVersion } from "./meta-graph.js";
import { safeConnectorFetch } from "./provider-fetch.js";

export type { ConnectorId } from "./egress.js";

export interface ConnectorHealth {
  status: IntegrationStatus;
  checkedAt: string;
  message: string;
  remainingQuota?: number;
  resetsAt?: string;
}

export interface CheckConnectorHealthOptions {
  provider: ConnectorId;
  /** Current access material. The result never includes this object. */
  credentials?: Readonly<Record<string, unknown>>;
  /** Non-secret, project-scoped connector configuration. */
  configuration?: Readonly<Record<string, unknown>>;
  /** URL to verify with PageSpeed Insights. */
  targetUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

interface Probe {
  url: URL;
  init: RequestInit;
  isValidPayload(value: unknown): boolean;
  readQuota?(value: unknown): number | undefined;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const HEALTH_ENDPOINTS: Readonly<Record<ConnectorId, string>> = {
  "google-search-console": "https://www.googleapis.com/webmasters/v3/sites/",
  "google-analytics-4":
    "https://analyticsdata.googleapis.com/v1beta/properties/",
  // The version segment is appended per call, because the operator may pin a
  // different API version than the default.
  "google-ads": "https://googleads.googleapis.com/",
  "pagespeed-insights":
    "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed",
  "google-trends": "https://trends.google.com/",
  serpapi: "https://serpapi.com/account.json",
  dataforseo: "https://api.dataforseo.com/v3/appendix/user_data",
  // The version segment is appended per call, because the operator may pin a
  // different Graph version than the default.
  "meta-ads": "https://graph.facebook.com/",
  // The bot token is a path segment in Telegram's API, so the URL is built per
  // call rather than stored whole — a constant here would have to contain a
  // credential.
  telegram: "https://api.telegram.org/",
  x: "https://api.twitter.com/2/users/me",
  // Never fetched. The relay's host is operator-declared, so it has no
  // constant endpoint and its health is established by an actual upload.
  "media-relay": "",
};

function result(
  status: IntegrationStatus,
  message: string,
  now: () => Date,
  extra: Pick<ConnectorHealth, "remainingQuota" | "resetsAt"> = {},
): ConnectorHealth {
  return {
    status,
    checkedAt: now().toISOString(),
    message,
    ...(extra.remainingQuota === undefined
      ? {}
      : { remainingQuota: extra.remainingQuota }),
    ...(extra.resetsAt === undefined ? {} : { resetsAt: extra.resetsAt }),
  };
}

function requiredString(
  value: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const candidate = value?.[key];
  if (typeof candidate !== "string" || candidate.trim() === "") return null;
  return candidate.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function baseInit(headers: Record<string, string> = {}): RequestInit {
  return {
    method: "GET",
    headers: { accept: "application/json", ...headers },
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  };
}

function buildProbe(
  options: CheckConnectorHealthOptions,
): Probe | ConnectorHealth {
  const now = options.now ?? (() => new Date());
  const accessToken = requiredString(options.credentials, "accessToken");
  const apiKey = requiredString(options.credentials, "apiKey");

  switch (options.provider) {
    case "google-search-console": {
      const siteUrl = requiredString(options.configuration, "siteUrl");
      if (!accessToken || !siteUrl) {
        return result(
          "not_configured",
          "A current Google access token and project site URL are required.",
          now,
        );
      }
      const url = new URL(
        encodeURIComponent(siteUrl),
        HEALTH_ENDPOINTS[options.provider],
      );
      return {
        url,
        init: baseInit({ authorization: `Bearer ${accessToken}` }),
        isValidPayload: (value) =>
          isRecord(value) &&
          typeof value.siteUrl === "string" &&
          typeof value.permissionLevel === "string",
      };
    }

    case "google-analytics-4": {
      const propertyId = requiredString(options.configuration, "propertyId");
      if (!accessToken || !propertyId || !/^[1-9]\d*$/.test(propertyId)) {
        return result(
          "not_configured",
          "A current Google access token and numeric GA4 property ID are required.",
          now,
        );
      }
      const url = new URL(
        `${encodeURIComponent(propertyId)}:runReport`,
        HEALTH_ENDPOINTS[options.provider],
      );
      return {
        url,
        init: {
          ...baseInit({
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          }),
          method: "POST",
          body: JSON.stringify({
            dateRanges: [{ startDate: "today", endDate: "today" }],
            metrics: [{ name: "sessions" }],
            limit: "1",
          }),
        },
        isValidPayload: (value) =>
          isRecord(value) &&
          (finiteNumber(value.rowCount) !== undefined ||
            Array.isArray(value.rows)),
      };
    }

    /**
     * Reads the customer's own record.
     *
     * `listAccessibleCustomers` would be a lighter probe, but it succeeds
     * whenever the credential is valid at all — including when it cannot see
     * the account this workspace is configured for. Selecting one row from the
     * configured customer is the check that answers the question actually
     * being asked, and it exercises the developer token and the manager header
     * on the same call.
     */
    case "google-ads": {
      const developerToken = requiredString(
        options.credentials,
        "developerToken",
      );
      const customerId = normalizeCustomerId(
        requiredString(options.configuration, "customerId") ?? "",
      );
      if (
        !accessToken ||
        !developerToken ||
        !isGoogleAdsCustomerId(customerId)
      ) {
        return result(
          "not_configured",
          "A current Google sign-in, a developer token, and a ten-digit customer ID are required.",
          now,
        );
      }
      const loginCustomerId = normalizeCustomerId(
        requiredString(options.configuration, "loginCustomerId") ?? "",
      );
      const version = normalizeGoogleAdsVersion(
        options.configuration?.apiVersion,
      );
      return {
        url: new URL(
          `${version}/customers/${customerId}/googleAds:searchStream`,
          HEALTH_ENDPOINTS[options.provider],
        ),
        init: {
          ...baseInit({
            authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
            "content-type": "application/json",
            // Required whenever the account is reached through a manager,
            // which is how every agency is arranged. Its absence produces a
            // permission error that never mentions managers.
            ...(isGoogleAdsCustomerId(loginCustomerId)
              ? { "login-customer-id": loginCustomerId }
              : {}),
          }),
          method: "POST",
          body: JSON.stringify({
            query:
              "SELECT customer.id, customer.currency_code FROM customer LIMIT 1",
          }),
        },
        // searchStream answers with an array of result chunks rather than an
        // object, so a valid empty read is `[]` and still proves access.
        isValidPayload: (value) =>
          Array.isArray(value) ||
          (isRecord(value) && Array.isArray(value.results)),
      };
    }

    case "pagespeed-insights": {
      let target: URL;
      try {
        target = new URL(options.targetUrl ?? "");
      } catch {
        return result(
          "not_configured",
          "A valid HTTP or HTTPS target URL is required for PageSpeed Insights.",
          now,
        );
      }
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        return result(
          "not_configured",
          "A valid HTTP or HTTPS target URL is required for PageSpeed Insights.",
          now,
        );
      }
      if (target.username || target.password) {
        return result(
          "not_configured",
          "PageSpeed target URLs must not contain embedded credentials.",
          now,
        );
      }
      target.hash = "";
      const url = new URL(HEALTH_ENDPOINTS[options.provider]);
      url.searchParams.set("url", target.toString());
      const strategy = options.configuration?.strategy;
      if (strategy === "mobile" || strategy === "desktop") {
        url.searchParams.set("strategy", strategy);
      }
      if (apiKey) url.searchParams.set("key", apiKey);
      return {
        url,
        init: baseInit(),
        isValidPayload: (value) =>
          isRecord(value) &&
          (isRecord(value.lighthouseResult) ||
            isRecord(value.loadingExperience) ||
            isRecord(value.originLoadingExperience)),
      };
    }

    case "google-trends":
      return result(
        "degraded",
        "Google Trends has no stable credential health endpoint; health is verified when a research request runs.",
        now,
      );

    case "serpapi": {
      if (!apiKey) {
        return result("not_configured", "A SerpAPI key is required.", now);
      }
      const url = new URL(HEALTH_ENDPOINTS[options.provider]);
      url.searchParams.set("api_key", apiKey);
      return {
        url,
        init: baseInit(),
        isValidPayload: (value) =>
          isRecord(value) &&
          (typeof value.account_id === "string" ||
            finiteNumber(value.account_id) !== undefined ||
            typeof value.plan_name === "string" ||
            finiteNumber(value.total_searches_left) !== undefined ||
            finiteNumber(value.plan_searches_left) !== undefined),
        readQuota: (value) => {
          if (!isRecord(value)) return undefined;
          return (
            finiteNumber(value.total_searches_left) ??
            finiteNumber(value.plan_searches_left) ??
            finiteNumber(value.searches_left)
          );
        },
      };
    }

    case "meta-ads": {
      const token = requiredString(options.credentials, "accessToken");
      if (!token) {
        return result(
          "not_configured",
          "A Meta System User access token is required.",
          now,
        );
      }
      // Listing one ad account proves three things at once: the token parses,
      // it still carries `ads_read`, and it actually reaches a cabinet. A bare
      // identity call would pass for a token that can read nothing, which is
      // the failure an operator most needs this check to catch.
      const url = metaGraphUrl(
        normalizeGraphVersion(options.configuration?.graphVersion),
        "me/adaccounts",
        { limit: "1", fields: "id,name,account_status" },
      );
      return {
        url,
        // The token travels in the header rather than the query string, so no
        // credential can be copied out of a URL by a log line or an error.
        init: baseInit({ authorization: `Bearer ${token}` }),
        isValidPayload: (value) =>
          isRecord(value) &&
          (Array.isArray(value.data) || isRecord(value.paging)),
      };
    }

    case "telegram": {
      const botToken = requiredString(options.credentials, "botToken");
      if (!botToken) {
        return result(
          "not_configured",
          "A Telegram bot token from @BotFather is required.",
          now,
        );
      }
      // `getMe` is Telegram's identity call: it proves the token parses, the
      // bot exists and has not been revoked, in one request that changes
      // nothing.
      //
      // The token is a path segment here because Telegram's API has no header
      // form. It is encoded, the URL is never logged, and the transport
      // refuses redirects so it cannot be forwarded elsewhere.
      const url = new URL(
        `bot${encodeURIComponent(botToken)}/getMe`,
        HEALTH_ENDPOINTS[options.provider],
      );
      return {
        url,
        init: baseInit(),
        isValidPayload: (value) =>
          isRecord(value) && value.ok === true && isRecord(value.result),
      };
    }

    case "x": {
      if (!accessToken) {
        return result(
          "not_configured",
          "Connect X to authorize posting; a current access token is required.",
          now,
        );
      }
      return {
        url: new URL(HEALTH_ENDPOINTS[options.provider]),
        init: baseInit({ authorization: `Bearer ${accessToken}` }),
        isValidPayload: (value) => isRecord(value) && isRecord(value.data),
      };
    }

    case "media-relay": {
      const accessKeyId = requiredString(options.credentials, "accessKeyId");
      const bucket = requiredString(options.configuration, "bucket");
      const endpoint = requiredString(options.configuration, "endpoint");
      if (!accessKeyId || !bucket || !endpoint) {
        return result(
          "not_configured",
          "Object storage needs an endpoint, region, bucket, public base URL and access key.",
          now,
        );
      }
      // Not probed. A signed HEAD would be a real request against the
      // operator's bucket from a code path whose whole job is uploads, and the
      // first upload establishes the same fact with no extra permission.
      return result(
        "degraded",
        "Object storage settings are stored. The connection is verified by the first upload, which is also the only thing this connector does.",
        now,
      );
    }

    case "dataforseo": {
      const login = requiredString(options.credentials, "login");
      const password = requiredString(options.credentials, "password");
      if (!login || !password || login.includes(":")) {
        return result(
          "not_configured",
          "A valid DataForSEO login and password are required.",
          now,
        );
      }
      const authorization = Buffer.from(
        `${login}:${password}`,
        "utf8",
      ).toString("base64");
      return {
        url: new URL(HEALTH_ENDPOINTS[options.provider]),
        init: baseInit({ authorization: `Basic ${authorization}` }),
        isValidPayload: (value) =>
          isRecord(value) &&
          value.status_code === 20_000 &&
          Array.isArray(value.tasks),
      };
    }
  }
}

function assertAllowedEndpoint(provider: ConnectorId, url: URL): void {
  if (
    url.protocol !== "https:" ||
    !(connectorEgressHosts[provider] as readonly string[]).includes(
      url.hostname,
    )
  ) {
    throw new Error("Connector health endpoint is outside its manifest policy");
  }
}

function retryAt(response: Response, now: Date): string | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return new Date(now.getTime() + seconds * 1_000).toISOString();
  }
  const timestamp = Date.parse(retryAfter);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("response_too_large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("response_too_large");
  }
  return JSON.parse(text) as unknown;
}

/**
 * Performs a minimal provider request without ever returning credential or
 * response payload material. OAuth refresh remains the caller's responsibility.
 */
export async function checkConnectorHealth(
  options: CheckConnectorHealthOptions,
): Promise<ConnectorHealth> {
  const now = options.now ?? (() => new Date());
  const probe = buildProbe(options);
  if ("status" in probe) return probe;

  try {
    assertAllowedEndpoint(options.provider, probe.url);
  } catch {
    return result(
      "failed",
      "The connector health endpoint violates its egress manifest.",
      now,
    );
  }

  // Explicit injection is retained for deterministic tests. Production calls
  // use the DNS-validating, address-pinned exact-host transport.
  const fetchImpl = options.fetchImpl ?? safeConnectorFetch;
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.max(50, Math.min(30_000, Math.trunc(requestedTimeout)))
    : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<Response>((_resolve, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(
        new DOMException("Connector health check timed out", "TimeoutError"),
      );
      reject(
        new DOMException("Connector health check timed out", "TimeoutError"),
      );
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetchImpl(probe.url, {
        ...probe.init,
        signal: controller.signal,
      }),
      deadline,
    ]);

    if (response.status === 401) {
      return result(
        "expired",
        "The provider rejected the credential. Reconnect or rotate it.",
        now,
      );
    }
    if (response.status === 403) {
      return result(
        "degraded",
        "The provider denied access. Verify account permissions and OAuth scopes.",
        now,
      );
    }
    if (response.status === 429) {
      return result(
        "rate_limited",
        "The provider rate limit is active. Retry after the reported reset time.",
        now,
        { resetsAt: retryAt(response, now()) },
      );
    }
    if (!response.ok) {
      return result(
        "failed",
        "The provider returned an unsuccessful health response.",
        now,
      );
    }

    let payload: unknown;
    try {
      payload = await Promise.race([readJson(response), deadline]);
    } catch {
      if (timedOut) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("connector_health_timeout");
      }
      return result(
        "degraded",
        "The provider responded, but its health payload was malformed.",
        now,
      );
    }
    if (!probe.isValidPayload(payload)) {
      return result(
        "degraded",
        "The provider responded, but its health payload was malformed.",
        now,
      );
    }
    return result("connected", "Connection verified.", now, {
      remainingQuota: probe.readQuota?.(payload),
    });
  } catch {
    return result(
      "failed",
      timedOut
        ? "The provider health check timed out."
        : "The provider health check could not reach its approved endpoint.",
      now,
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const connectorHealthEndpoints = HEALTH_ENDPOINTS;
