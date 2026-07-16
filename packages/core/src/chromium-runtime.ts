import { existsSync } from "node:fs";
import { envStr } from "./env.js";

/**
 * Resolve the exact Chromium executable shared by JS crawling and Lighthouse.
 * Desktop builds always set GOLEMSEO_CHROME_PATH to the lockfile-matched
 * packaged browser. The npm route can fall back to Playwright's own cache.
 */
export async function resolveChromiumExecutablePath(
  explicitPath?: string,
): Promise<string | undefined> {
  const configuredPath =
    explicitPath?.trim() ||
    envStr("GOLEMSEO_CHROME_PATH", "SCREAMINGCLAW_CHROME_PATH", "").trim();
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new Error(
        `Configured Chromium executable does not exist: ${configuredPath}`,
      );
    }
    return configuredPath;
  }

  try {
    const { chromium } = await import("playwright");
    const playwrightPath = chromium.executablePath();
    if (playwrightPath && existsSync(playwrightPath)) return playwrightPath;
  } catch {
    // Playwright is optional for static-only npm installations.
  }
  return undefined;
}
