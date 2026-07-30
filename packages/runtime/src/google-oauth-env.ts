const GOOGLE_DESKTOP_CLIENT_ID_ENV = "MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID";
const LEGACY_GOOGLE_DESKTOP_CLIENT_ID_ENVS = [
  "GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID",
  "GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID",
] as const;
const warnedLegacyNames = new Set<string>();

function environmentValue(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function warnLegacyName(name: string): void {
  if (warnedLegacyNames.has(name)) return;
  warnedLegacyNames.add(name);
  // Never include the value: OAuth client identifiers are configuration data
  // and warnings may be persisted in local logs.
  // eslint-disable-next-line no-console
  console.warn(
    `[marketingovo] env ${name} is deprecated; use ${GOOGLE_DESKTOP_CLIENT_ID_ENV} instead`,
  );
}

export function resolveGoogleDesktopClientId(
  explicitValue?: string,
): string | undefined {
  const explicit = explicitValue?.trim();
  if (explicit) return explicit;

  const canonical = environmentValue(GOOGLE_DESKTOP_CLIENT_ID_ENV);
  if (canonical) return canonical;

  for (const legacyName of LEGACY_GOOGLE_DESKTOP_CLIENT_ID_ENVS) {
    const legacy = environmentValue(legacyName);
    if (!legacy) continue;
    warnLegacyName(legacyName);
    return legacy;
  }
  return undefined;
}
