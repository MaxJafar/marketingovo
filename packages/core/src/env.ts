// Environment compatibility boundary.
//
// Product code reads MARKETINGOVO_* only. This module accepts bounded legacy
// names in priority order and emits one value-free warning per legacy name.

const warnedLegacyNames = new Set<string>();
const CANONICAL_PREFIX = "MARKETINGOVO_";

function nonEmptyEnvironmentValue(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

function legacyNames(
  canonicalName: string,
  explicitLegacyName: string,
): readonly string[] {
  const suffix = canonicalName.slice(CANONICAL_PREFIX.length);
  const names = [`GOLEMSEO_${suffix}`, `GOLEM_SEO_${suffix}`];
  if (explicitLegacyName) names.push(explicitLegacyName);
  return [...new Set(names)];
}

function warnLegacyName(legacyName: string, canonicalName: string): void {
  if (warnedLegacyNames.has(legacyName)) return;
  warnedLegacyNames.add(legacyName);
  // Do not include the environment value: many supported values are secrets.
  // eslint-disable-next-line no-console
  console.warn(
    `[marketingovo] env ${legacyName} is deprecated; use ${canonicalName} instead`,
  );
}

function compatRead(
  canonicalName: string,
  explicitLegacyName: string,
): string | undefined {
  if (!canonicalName.startsWith(CANONICAL_PREFIX)) {
    throw new Error(
      `Canonical environment names must start with ${CANONICAL_PREFIX}`,
    );
  }
  const canonicalValue = nonEmptyEnvironmentValue(canonicalName);
  if (canonicalValue !== undefined) return canonicalValue;
  for (const legacyName of legacyNames(canonicalName, explicitLegacyName)) {
    const legacyValue = nonEmptyEnvironmentValue(legacyName);
    if (legacyValue === undefined) continue;
    warnLegacyName(legacyName, canonicalName);
    return legacyValue;
  }
  return undefined;
}

/**
 * Reads a canonical MARKETINGOVO_* value, then GOLEMSEO_*, GOLEM_SEO_*, and the
 * explicit historical alias (normally SCREAMINGCLAW_*). Canonical wins.
 */
export function envStr(
  canonicalName: string,
  explicitLegacyName = "",
  fallback = "",
): string {
  return compatRead(canonicalName, explicitLegacyName) ?? fallback;
}

/** Read a boolean environment value. Truthy values are "1" and "true". */
export function envBool(
  canonicalName: string,
  explicitLegacyName: string,
  fallback: boolean,
): boolean {
  const value = compatRead(canonicalName, explicitLegacyName);
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

/** Read a positive integer with a defensive upper bound. */
export function envInt(
  canonicalName: string,
  explicitLegacyName: string,
  fallback: number,
  hardMax = Number.MAX_SAFE_INTEGER,
): number {
  const value = compatRead(canonicalName, explicitLegacyName);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, hardMax);
}

/** Test-only: clear one-time warning state. */
export function _resetEnvCompatForTests(): void {
  warnedLegacyNames.clear();
}
