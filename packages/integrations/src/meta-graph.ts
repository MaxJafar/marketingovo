/**
 * Meta Graph API constants and credential handling.
 *
 * Facebook and Instagram advertising is one API behind one host. What differs
 * between them is a breakdown dimension on the insights call, not an endpoint,
 * which is why this connector reaches both without a second credential.
 */

/**
 * The pinned Graph API version.
 *
 * Meta supports each version for roughly two years from release and changes
 * field behaviour between them, so an unpinned client silently changes its
 * answers when Meta promotes a new default. The operator can override this per
 * connection with `graphVersion`; check Meta's published version schedule
 * before raising the value here, since a version past its sunset date returns
 * errors rather than degrading.
 */
export const META_GRAPH_DEFAULT_VERSION = "v23.0";

export const META_GRAPH_HOST = "graph.facebook.com";

/**
 * Read-only scopes.
 *
 * `ads_read` covers insights and delivery state; `business_management` is what
 * makes the cabinets under a Business Manager enumerable. `ads_management` is
 * deliberately absent: nothing in this connector writes, and asking for a
 * write scope to perform reads is how a credential ends up more dangerous than
 * the feature that needed it.
 */
export const META_ADS_SCOPES = ["ads_read", "business_management"] as const;

export type MetaGraphErrorCode =
  | "meta_token_invalid"
  | "meta_token_expired"
  | "meta_permission_denied"
  | "meta_rate_limited"
  | "meta_unavailable"
  | "meta_response_invalid";

export class MetaGraphError extends Error {
  readonly code: MetaGraphErrorCode;
  /** Meta's own subcode, kept for support conversations. Never a credential. */
  readonly providerSubcode: number | null;

  constructor(
    code: MetaGraphErrorCode,
    message: string,
    providerSubcode: number | null = null,
  ) {
    super(message);
    this.name = "MetaGraphError";
    this.code = code;
    this.providerSubcode = providerSubcode;
  }
}

export function normalizeGraphVersion(value: unknown): string {
  if (typeof value !== "string") return META_GRAPH_DEFAULT_VERSION;
  const trimmed = value.trim();
  return /^v\d{1,3}\.\d{1,3}$/.test(trimmed)
    ? trimmed
    : META_GRAPH_DEFAULT_VERSION;
}

/**
 * Builds a Graph URL. The access token is deliberately not a parameter here:
 * it belongs in the `Authorization` header, so it cannot end up in a URL that
 * a log line, an error message or a diagnostic copies verbatim.
 */
export function metaGraphUrl(
  version: string,
  path: string,
  searchParams: Readonly<Record<string, string>> = {},
): URL {
  const normalizedPath = path.replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_./-]+$/.test(normalizedPath)) {
    throw new MetaGraphError(
      "meta_response_invalid",
      "Meta Graph paths are restricted to identifier and edge characters",
    );
  }
  const url = new URL(
    `https://${META_GRAPH_HOST}/${normalizeGraphVersion(version)}/${normalizedPath}`,
  );
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url;
}

interface GraphErrorBody {
  error?: {
    message?: unknown;
    type?: unknown;
    code?: unknown;
    error_subcode?: unknown;
  };
}

/**
 * Maps a Graph failure onto a code the rest of the product can act on.
 *
 * Meta reports an expired token, a revoked token and a token for a user who
 * lost access all as HTTP 400 with different subcodes, so the status alone is
 * not enough to tell an operator what to do about it.
 */
export function classifyMetaGraphFailure(
  status: number,
  body: unknown,
): MetaGraphError {
  const error =
    body && typeof body === "object"
      ? ((body as GraphErrorBody).error ?? {})
      : {};
  const code = typeof error.code === "number" ? error.code : null;
  const subcode =
    typeof error.error_subcode === "number" ? error.error_subcode : null;

  if (
    status === 429 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613
  ) {
    return new MetaGraphError(
      "meta_rate_limited",
      "Meta is throttling this credential. Retry after the reported window.",
      subcode,
    );
  }
  if (code === 190) {
    // 463 is "expired", 460 is "password changed", 458 is "app unauthorized".
    // Only the first is a deadline the operator can pre-empt by rotating.
    const expired = subcode === 463;
    return new MetaGraphError(
      expired ? "meta_token_expired" : "meta_token_invalid",
      expired
        ? "The Meta access token expired. Generate a new System User token and paste it."
        : "Meta rejected the access token. Generate a new System User token and paste it.",
      subcode,
    );
  }
  if (
    status === 403 ||
    code === 10 ||
    (code !== null && code >= 200 && code <= 299)
  ) {
    return new MetaGraphError(
      "meta_permission_denied",
      "The Meta token lacks permission for this ad account. Check its System User assignment and scopes.",
      subcode,
    );
  }
  if (status === 401) {
    return new MetaGraphError(
      "meta_token_invalid",
      "Meta rejected the access token. Generate a new System User token and paste it.",
      subcode,
    );
  }
  if (status >= 500) {
    return new MetaGraphError(
      "meta_unavailable",
      "Meta returned a server error. The reading is unavailable, not zero.",
      subcode,
    );
  }
  return new MetaGraphError(
    "meta_response_invalid",
    "Meta returned an unexpected response for this request.",
    subcode,
  );
}

export interface MetaTokenDebug {
  /** Absent when Meta reports the token as never expiring. */
  expiresAt: string | null;
  scopes: string[];
  /** The app the token belongs to, useful when several are in play. */
  appId: string | null;
  valid: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MetaGraphError(
      "meta_response_invalid",
      "Meta returned a response that was not an object",
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Reads a token's own expiry and granted scopes.
 *
 * This is what turns a pasted credential from "works until one day it does
 * not" into a dated fact the connector can show and warn about. Meta reports
 * `expires_at: 0` for tokens it considers non-expiring; that is recorded as
 * `null`, which is a different claim from an expiry in 1970.
 */
export function parseMetaTokenDebug(payload: unknown): MetaTokenDebug {
  const data = asRecord(asRecord(payload).data ?? {});
  const expiresAtSeconds =
    typeof data.expires_at === "number" && Number.isFinite(data.expires_at)
      ? data.expires_at
      : 0;
  const scopes = Array.isArray(data.scopes)
    ? data.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  return {
    expiresAt:
      expiresAtSeconds > 0
        ? new Date(expiresAtSeconds * 1_000).toISOString()
        : null,
    scopes,
    appId: typeof data.app_id === "string" ? data.app_id : null,
    valid: data.is_valid === true,
  };
}

/** Meta account ids arrive as `act_<digits>`; everything else is rejected. */
export function isMetaAdAccountId(value: string): boolean {
  return /^act_\d{1,32}$/.test(value);
}

/**
 * Meta reports currency-valued fields as decimal strings, and a missing field
 * simply does not appear on the row. `null` means "not reported" and must not
 * become `0` — the difference is between an ad set that spent nothing and one
 * whose spend Meta declined to break out.
 */
export function parseMetaNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
