import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

export const PUBLIC_RUNTIME_CONFIG_VERSION = 1;
export const GOOGLE_DESKTOP_CLIENT_ID_ENV = "AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID";
export const GOOGLE_DESKTOP_CLIENT_SECRET_ENV_NAMES = [
  // Desktop OAuth is PKCE-only. Reject a packaged client secret under the
  // canonical name as well as every retired name, so the rebrand cannot open a
  // hole by leaving the guard pointed only at old variables.
  "AGENTSEO_GOOGLE_DESKTOP_CLIENT_SECRET",
  "GOLEMSEO_GOOGLE_DESKTOP_CLIENT_SECRET",
  "GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_SECRET",
];

export function expectedRustTarget(
  platform = process.platform,
  architecture = process.arch,
) {
  const key = `${platform}:${architecture}`;
  const targets = {
    "darwin:arm64": "aarch64-apple-darwin",
    "darwin:x64": "x86_64-apple-darwin",
    "linux:x64": "x86_64-unknown-linux-gnu",
    "win32:x64": "x86_64-pc-windows-msvc",
  };
  const target = targets[key];
  if (!target) throw new Error(`Unsupported desktop build host: ${key}`);
  return target;
}

export function validateBuildTarget(target) {
  const expected = expectedRustTarget();
  if (target !== expected) {
    throw new Error(
      `Desktop browser and Node sidecars must be assembled on the target host (expected ${expected}, received ${target})`,
    );
  }
  return target;
}

export function validateGoogleDesktopClientId(
  rawValue,
  { required = false } = {},
) {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    if (required) {
      throw new Error(
        `${GOOGLE_DESKTOP_CLIENT_ID_ENV} is required for a release-ready desktop runtime`,
      );
    }
    return null;
  }
  if (
    value.length > 255 ||
    !/^[a-z0-9][a-z0-9.-]*\.apps\.googleusercontent\.com$/iu.test(value) ||
    value.includes("..")
  ) {
    throw new Error(
      `${GOOGLE_DESKTOP_CLIENT_ID_ENV} must be a Google Desktop OAuth client ID`,
    );
  }
  return value;
}

export function rejectGoogleClientSecrets(environment = process.env) {
  const provided = GOOGLE_DESKTOP_CLIENT_SECRET_ENV_NAMES.filter((name) =>
    environment[name]?.trim(),
  );
  if (provided.length > 0) {
    throw new Error(
      `Desktop OAuth uses PKCE and must not package a client secret (${provided.join(", ")})`,
    );
  }
}

export function runtimeRelativePath(runtimeRoot, absolutePath) {
  const value = relative(runtimeRoot, absolutePath);
  if (
    !value ||
    value === ".." ||
    value.startsWith(`..${sep}`) ||
    value.includes("\0")
  ) {
    throw new Error(
      `Desktop runtime resource is outside the runtime root: ${absolutePath}`,
    );
  }
  return value.split(sep).join("/");
}

export async function assertExecutable(path) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`Expected an executable file at ${path}`);
  if (process.platform !== "win32") await access(path, constants.X_OK);
}

export async function playwrightVersionFrom(packageEntry) {
  const packageJson = resolve(dirname(packageEntry), "package.json");
  const parsed = JSON.parse(await readFile(packageJson, "utf8"));
  if (
    typeof parsed.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+].+)?$/u.test(parsed.version)
  ) {
    throw new Error(`Invalid Playwright package version in ${packageJson}`);
  }
  return parsed.version;
}

export function workspacePlaywrightEntry(root) {
  return resolve(root, "packages/core/node_modules/playwright/index.mjs");
}
