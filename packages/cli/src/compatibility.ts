import { join, resolve } from "node:path";

export const CANONICAL_CLI_NAME = "marketingovo";

type Environment = Readonly<Record<string, string | undefined>>;
type Warn = (message: string) => void;
type Flags = ReadonlyMap<string, string | boolean>;
const warnedLegacyNames = new Set<string>();

export interface CliConnectionResolutionOptions {
  flags: Flags;
  environment: Environment;
  currentWorkingDirectory: string;
  defaultDataDirectory: string;
  warn?: Warn;
  warningState?: Set<string>;
}

export interface CliConnectionOptions {
  dataDirectory: string;
  serviceTokenFile: string;
  apiUrl: string;
}

const DATA_DIRECTORY_LEGACY_NAMES = [
  "GOLEMSEO_DATA_DIR",
  "GOLEM_SEO_DATA_DIR",
  "SCREAMINGCLAW_DATA_DIR",
] as const;

const SERVICE_TOKEN_FILE_LEGACY_NAMES = [
  "GOLEMSEO_SERVICE_TOKEN_FILE",
  "GOLEM_SEO_SERVICE_TOKEN_FILE",
  "SCREAMINGCLAW_SERVICE_TOKEN_FILE",
] as const;

const API_URL_LEGACY_NAMES = [
  "GOLEMSEO_API_URL",
  "GOLEM_SEO_API_URL",
  "SCREAMINGCLAW_API_URL",
] as const;

function optionalFlag(flags: Flags, name: string): string | undefined {
  const value = flags.get(name);
  if (value === true) throw new Error(`--${name} requires a value`);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`--${name} requires a value`);
  return trimmed;
}

function configuredValue(
  options: CliConnectionResolutionOptions,
  flagName: string,
  canonicalName: string,
  legacyNames: readonly string[],
): string | undefined {
  const flagValue = optionalFlag(options.flags, flagName);
  if (flagValue) return flagValue;
  return readCompatibleEnvironmentVariable(
    canonicalName,
    legacyNames,
    options.environment,
    options.warn,
    options.warningState,
  );
}

function defaultApiPort(flags: Flags): number {
  const portValue = optionalFlag(flags, "port");
  if (portValue === undefined) return 3210;
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port must be an integer from 1 to 65535");
  }
  return port;
}

function canonicalizeLocalApiUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "The Marketingovo API URL must be an absolute loopback URL ending in /api/v1",
    );
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (!loopbackHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      "The Marketingovo API URL must use 127.0.0.1, localhost, or [::1]; remote API URLs are not allowed",
    );
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.pathname !== "/api/v1" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "The Marketingovo API URL must match http://127.0.0.1:<port>/api/v1; localhost and [::1] are accepted aliases",
    );
  }
  const port = parsed.port ? Number(parsed.port) : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("The Marketingovo API URL port must be from 1 to 65535");
  }
  return `http://127.0.0.1:${port}/api/v1`;
}

export function resolveCliDataDirectory(
  options: CliConnectionResolutionOptions,
): string {
  const configured = configuredValue(
    options,
    "data-dir",
    "MARKETINGOVO_DATA_DIR",
    DATA_DIRECTORY_LEGACY_NAMES,
  );
  return resolve(
    options.currentWorkingDirectory,
    configured ?? options.defaultDataDirectory,
  );
}

export function resolveCliConnectionOptions(
  options: CliConnectionResolutionOptions,
): CliConnectionOptions {
  const dataDirectory = resolveCliDataDirectory(options);
  const serviceTokenFile = configuredValue(
    options,
    "service-token-file",
    "MARKETINGOVO_SERVICE_TOKEN_FILE",
    SERVICE_TOKEN_FILE_LEGACY_NAMES,
  );
  const configuredApiUrl = configuredValue(
    options,
    "api-url",
    "MARKETINGOVO_API_URL",
    API_URL_LEGACY_NAMES,
  );
  return {
    dataDirectory,
    serviceTokenFile: serviceTokenFile
      ? resolve(options.currentWorkingDirectory, serviceTokenFile)
      : join(dataDirectory, "service-token"),
    apiUrl: configuredApiUrl
      ? canonicalizeLocalApiUrl(configuredApiUrl)
      : `http://127.0.0.1:${defaultApiPort(options.flags)}/api/v1`,
  };
}

export function readCompatibleEnvironmentVariable(
  canonicalName: string,
  legacyNames: readonly string[],
  environment: Environment = process.env,
  warn: Warn = (message) => process.stderr.write(message),
  warningState: Set<string> = warnedLegacyNames,
): string | undefined {
  const canonicalValue = environment[canonicalName]?.trim();
  if (canonicalValue) return canonicalValue;

  for (const legacyName of legacyNames) {
    const legacyValue = environment[legacyName]?.trim();
    if (!legacyValue) continue;
    if (!warningState.has(legacyName)) {
      warningState.add(legacyName);
      warn(
        `Warning: ${legacyName} is deprecated; use ${canonicalName}. The legacy alias remains supported through Marketingovo 1.x.\n`,
      );
    }
    return legacyValue;
  }
  return undefined;
}
