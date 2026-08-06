/**
 * Google Ads API constants, error classification and value parsing.
 *
 * Three things about this API shape everything downstream.
 *
 * It is queried with GAQL rather than by endpoint, so one host and one method
 * serve every read. It requires a developer token alongside the OAuth
 * credential, which this product never ships — see ADR 0008. And it reports
 * money in micros, which is the single most consequential unit conversion in
 * the codebase: getting it wrong understates spend by a factor of a million
 * and looks entirely plausible on a dashboard.
 */

/**
 * The pinned API version.
 *
 * Google supports each version for roughly a year and removes fields between
 * them, so an unpinned client changes its answers without a release. Check
 * Google's deprecation schedule before raising this; a sunset version returns
 * errors rather than degrading.
 */
export const GOOGLE_ADS_DEFAULT_VERSION = "v21";

export const GOOGLE_ADS_HOST = "googleads.googleapis.com";

export type GoogleAdsErrorCode =
  | "google_ads_token_invalid"
  | "google_ads_token_expired"
  | "google_ads_developer_token_missing"
  | "google_ads_developer_token_unapproved"
  | "google_ads_permission_denied"
  | "google_ads_customer_not_found"
  | "google_ads_query_invalid"
  | "google_ads_rate_limited"
  | "google_ads_unavailable"
  | "google_ads_response_invalid";

export class GoogleAdsError extends Error {
  readonly code: GoogleAdsErrorCode;
  /** Google's own enum name, kept for support conversations. Never a secret. */
  readonly providerReason: string | null;

  constructor(
    code: GoogleAdsErrorCode,
    message: string,
    providerReason: string | null = null,
  ) {
    super(message);
    this.name = "GoogleAdsError";
    this.code = code;
    this.providerReason = providerReason;
  }
}

export function normalizeGoogleAdsVersion(value: unknown): string {
  if (typeof value !== "string") return GOOGLE_ADS_DEFAULT_VERSION;
  const trimmed = value.trim();
  return /^v\d{1,3}$/.test(trimmed) ? trimmed : GOOGLE_ADS_DEFAULT_VERSION;
}

/**
 * Customer ids are ten digits. Google writes them hyphenated for humans
 * (`123-456-7890`) and requires them bare in URLs, which is a reliable source
 * of 404s when an operator pastes what they see on screen.
 */
export function normalizeCustomerId(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function isGoogleAdsCustomerId(value: string): boolean {
  return /^\d{10}$/.test(normalizeCustomerId(value));
}

/**
 * Builds a search URL for one customer.
 *
 * The customer id is validated rather than interpolated, because it lands in
 * the path where a crafted value would otherwise reach a different resource.
 */
export function googleAdsSearchUrl(version: string, customerId: string): URL {
  const id = normalizeCustomerId(customerId);
  if (!isGoogleAdsCustomerId(id)) {
    throw new GoogleAdsError(
      "google_ads_customer_not_found",
      "A Google Ads customer id is ten digits, with or without hyphens.",
    );
  }
  return new URL(
    `https://${GOOGLE_ADS_HOST}/${normalizeGoogleAdsVersion(version)}/customers/${id}/googleAds:searchStream`,
  );
}

export function googleAdsAccessibleCustomersUrl(version: string): URL {
  return new URL(
    `https://${GOOGLE_ADS_HOST}/${normalizeGoogleAdsVersion(version)}/customers:listAccessibleCustomers`,
  );
}

interface GoogleAdsErrorBody {
  error?: {
    message?: unknown;
    status?: unknown;
    details?: unknown;
  };
}

/** Pulls the first Google Ads failure enum out of the nested error details. */
function firstErrorReason(body: unknown): string | null {
  const error =
    body && typeof body === "object"
      ? ((body as GoogleAdsErrorBody).error ?? {})
      : {};
  const details = Array.isArray(error.details) ? error.details : [];
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const errors = (detail as { errors?: unknown }).errors;
    if (!Array.isArray(errors)) continue;
    for (const entry of errors) {
      if (!entry || typeof entry !== "object") continue;
      const code = (entry as { errorCode?: unknown }).errorCode;
      if (!code || typeof code !== "object") continue;
      for (const value of Object.values(code)) {
        if (typeof value === "string") return value;
      }
    }
  }
  return null;
}

/**
 * Maps a failure onto something an operator can act on.
 *
 * The developer token cases matter most and are the least self-explanatory.
 * Google returns 403 for a missing token, an unapproved token used against a
 * production account, and a token whose account lacks access — three different
 * problems with three different remedies, all reading as "forbidden".
 */
export function classifyGoogleAdsFailure(
  status: number,
  body: unknown,
): GoogleAdsError {
  const reason = firstErrorReason(body);

  if (reason === "DEVELOPER_TOKEN_NOT_APPROVED") {
    return new GoogleAdsError(
      "google_ads_developer_token_unapproved",
      "This developer token has not been approved for production accounts, so Google will only serve test accounts with it. Apply for Basic access in the API Center of the manager account that issued it.",
      reason,
    );
  }
  if (
    reason === "DEVELOPER_TOKEN_PROHIBITED" ||
    reason === "INVALID_DEVELOPER_TOKEN" ||
    reason === "DEVELOPER_TOKEN_PARAMETER_MISSING"
  ) {
    return new GoogleAdsError(
      "google_ads_developer_token_missing",
      "Google rejected the developer token. It is issued in the API Center of a Google Ads manager account and is separate from the sign-in.",
      reason,
    );
  }
  if (
    reason === "CUSTOMER_NOT_FOUND" ||
    reason === "CUSTOMER_NOT_ENABLED" ||
    status === 404
  ) {
    return new GoogleAdsError(
      "google_ads_customer_not_found",
      "Google has no enabled account with that customer id for this credential.",
      reason,
    );
  }
  if (status === 429 || reason === "RESOURCE_EXHAUSTED") {
    return new GoogleAdsError(
      "google_ads_rate_limited",
      "Google is throttling this credential. Retry after the reported window.",
      reason,
    );
  }
  if (status === 401) {
    return new GoogleAdsError(
      "google_ads_token_expired",
      "The Google sign-in expired. Reconnect the Google Ads account.",
      reason,
    );
  }
  if (status === 403) {
    return new GoogleAdsError(
      "google_ads_permission_denied",
      "This Google account cannot read that Ads customer. Check that it has at least read access, and that the manager id is set when the account sits under one.",
      reason,
    );
  }
  if (status === 400) {
    return new GoogleAdsError(
      "google_ads_query_invalid",
      "Google rejected the query. This is a defect in the request rather than something to retry.",
      reason,
    );
  }
  if (status >= 500) {
    return new GoogleAdsError(
      "google_ads_unavailable",
      "Google returned a server error. The reading is unavailable, not zero.",
      reason,
    );
  }
  return new GoogleAdsError(
    "google_ads_response_invalid",
    "Google returned an unexpected response for this request.",
    reason,
  );
}

/**
 * One millionth of the account currency.
 *
 * Google reports every money field in micros as a string, because the values
 * exceed what JSON numbers hold safely. Dividing by a million is the whole
 * conversion, and it is isolated here so it happens in exactly one place: a
 * missed division reports a €4,300 spend as €0.0043, which is wrong by six
 * orders of magnitude and still renders as a perfectly ordinary number.
 */
export function microsToCurrency(value: unknown): number | null {
  const raw = parseGoogleAdsNumber(value);
  return raw === null ? null : raw / 1_000_000;
}

/**
 * Google omits a field entirely when it has nothing to report, and returns
 * others as strings. `null` means "not reported" and must never become `0` —
 * the difference is between a campaign that spent nothing and one whose spend
 * Google did not break out.
 */
export function parseGoogleAdsNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Escapes a string for a GAQL literal.
 *
 * GAQL has no bound parameters, so every value in a WHERE clause is
 * interpolated. Dates are validated by shape at the call sites; free text —
 * campaign names, resource names — passes through here. A quote or backslash
 * left unescaped ends the literal and the rest of the value becomes query
 * syntax.
 */
export function escapeGaqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** `YYYY-MM-DD`, which is the only date form GAQL accepts in a range. */
export function isGaqlDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function assertGaqlDate(value: string, label: string): string {
  if (!isGaqlDate(value)) {
    throw new GoogleAdsError(
      "google_ads_query_invalid",
      `${label} must be an ISO date like 2026-08-01.`,
    );
  }
  return value;
}
