export const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:3210/api/v1";

const LOCAL_API_BASE_URL_PATTERN =
  /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/api\/v1$/u;

/**
 * Validate and canonicalize the only origin shape that may receive a local
 * Marketingovo service token. Keep this deliberately stricter than URL parsing:
 * aliases such as `localhost`, IPv6 loopback, credentials, and URL suffixes
 * must not become alternate trust boundaries.
 */
export function validateLocalApiBaseUrl(value: string): string {
  const match = LOCAL_API_BASE_URL_PATTERN.exec(value);
  const port = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      "The Marketingovo local API URL must match http://127.0.0.1:<port>/api/v1",
    );
  }
  return `http://127.0.0.1:${port}/api/v1`;
}
