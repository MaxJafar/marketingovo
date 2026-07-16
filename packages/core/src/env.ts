// Env-var compat layer.
//
// Primary names: `GOLEMSEO_*`. Legacy names: `SCREAMINGCLAW_*` (still
// honored so existing scripts and the golem-seo-dashboard backend
// keep working). A one-time deprecation warning is logged per
// legacy name per process.

const warned = new Set<string>();

function compatRead(
  newName: string,
  oldName: string,
): { value: string; fromLegacy: boolean } {
  const newRaw = process.env[newName];
  if (newRaw !== undefined && newRaw !== "") {
    return { value: newRaw, fromLegacy: false };
  }
  const oldRaw = process.env[oldName];
  if (oldRaw !== undefined && oldRaw !== "") {
    if (!warned.has(oldName)) {
      warned.add(oldName);
      // eslint-disable-next-line no-console
      console.warn(
        `[golem-seo] env ${oldName} is deprecated, use ${newName} instead`,
      );
    }
    return { value: oldRaw, fromLegacy: true };
  }
  return { value: "", fromLegacy: false };
}

/** Read a string env var with GOLEMSEO_* → SCREAMINGCLAW_* fallback. */
export function envStr(
  newName: string,
  oldName: string,
  fallback = "",
): string {
  const { value } = compatRead(newName, oldName);
  return value === "" ? fallback : value;
}

/** Read a boolean env var. Truthy: "1" or "true" (case-insensitive). */
export function envBool(
  newName: string,
  oldName: string,
  fallback: boolean,
): boolean {
  const { value } = compatRead(newName, oldName);
  if (value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

/** Read a positive int env var. Returns fallback on missing, NaN, or <= 0. */
export function envInt(
  newName: string,
  oldName: string,
  fallback: number,
  hardMax = Number.MAX_SAFE_INTEGER,
): number {
  const { value } = compatRead(newName, oldName);
  if (value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, hardMax);
}

/** Test-only: clear deprecation log memory between tests. */
export function _resetEnvCompatForTests(): void {
  warned.clear();
}
