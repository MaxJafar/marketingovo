type Environment = Readonly<Record<string, string | undefined>>;
type Warn = (message: string) => void;
const warnedLegacyNames = new Set<string>();
export const LEGACY_MCP_EXECUTABLE = "golem-seo-mcp";
export const CANONICAL_MCP_EXECUTABLE = "agentseo-mcp";

function readCompatibleEnvironmentVariable(
  canonicalName: string,
  legacyNames: readonly string[],
  environment: Environment,
  warn: Warn,
  warningState: Set<string>,
): string | undefined {
  const canonicalValue = environment[canonicalName]?.trim();
  if (canonicalValue) return canonicalValue;

  for (const legacyName of legacyNames) {
    const legacyValue = environment[legacyName]?.trim();
    if (!legacyValue) continue;
    if (!warningState.has(legacyName)) {
      warningState.add(legacyName);
      warn(
        `Warning: ${legacyName} is deprecated; use ${canonicalName}. The legacy alias remains supported through AGENTseo 1.x.\n`,
      );
    }
    return legacyValue;
  }
  return undefined;
}

export interface McpConnectionEnvironment {
  baseUrl?: string;
  tokenFile?: string;
}

export function resolveMcpConnectionEnvironment(
  environment: Environment = process.env,
  warn: Warn = (message) => process.stderr.write(message),
  warningState: Set<string> = warnedLegacyNames,
): McpConnectionEnvironment {
  return {
    tokenFile: readCompatibleEnvironmentVariable(
      "AGENTSEO_SERVICE_TOKEN_FILE",
      ["GOLEMSEO_SERVICE_TOKEN_FILE", "GOLEM_SEO_SERVICE_TOKEN_FILE"],
      environment,
      warn,
      warningState,
    ),
    baseUrl: readCompatibleEnvironmentVariable(
      "AGENTSEO_API_URL",
      ["GOLEMSEO_API_URL", "GOLEM_SEO_API_URL"],
      environment,
      warn,
      warningState,
    ),
  };
}

export function warnLegacyMcpInvocation(
  warn: Warn = (message) => process.stderr.write(message),
): void {
  warn(
    `Warning: ${LEGACY_MCP_EXECUTABLE} is deprecated; use ${CANONICAL_MCP_EXECUTABLE}. The legacy alias remains supported through AGENTseo 1.x.\n`,
  );
}
