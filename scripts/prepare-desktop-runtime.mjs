import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertExecutable,
  GOOGLE_DESKTOP_CLIENT_ID_ENV,
  playwrightVersionFrom,
  PUBLIC_RUNTIME_CONFIG_VERSION,
  rejectGoogleClientSecrets,
  runtimeRelativePath,
  validateBuildTarget,
  validateGoogleDesktopClientId,
  workspacePlaywrightEntry,
} from "./desktop-runtime-config.mjs";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
if (!target || !/^[a-z0-9_-]+$/iu.test(target)) {
  throw new Error(
    "usage: node scripts/prepare-desktop-runtime.mjs --target <Rust target triple> [--require-google-client-id]",
  );
}
validateBuildTarget(target);
rejectGoogleClientSecrets();
const googleDesktopClientId = validateGoogleDesktopClientId(
  process.env[GOOGLE_DESKTOP_CLIENT_ID_ENV],
  { required: process.argv.includes("--require-google-client-id") },
);

const root = resolve(import.meta.dirname, "..");
const tauriRoot = resolve(root, "apps/desktop/src-tauri");
const runtimeRoot = resolve(tauriRoot, "runtime");
const applicationRuntime = resolve(runtimeRoot, "app");
const browserRuntime = resolve(runtimeRoot, "browser");
const configRuntime = resolve(runtimeRoot, "config");
const legalRuntime = resolve(runtimeRoot, "legal");
const binaries = resolve(tauriRoot, "binaries");

// Always assemble from an empty tree so a previous host's browser, broker, or
// public build configuration can never leak into an installer.
await rm(runtimeRoot, { recursive: true, force: true });
await rm(binaries, { recursive: true, force: true });
await mkdir(applicationRuntime, { recursive: true, mode: 0o755 });
await mkdir(browserRuntime, { recursive: true, mode: 0o755 });
await mkdir(configRuntime, { recursive: true, mode: 0o755 });
await mkdir(legalRuntime, { recursive: true, mode: 0o755 });
await mkdir(binaries, { recursive: true, mode: 0o755 });

for (const file of ["LICENSE", "NOTICE", "PRIVACY.md", "TRADEMARKS.md"]) {
  await copyFile(resolve(root, file), resolve(legalRuntime, file));
}

const deployed = spawnSync(
  "pnpm",
  [
    "--config.strict-peer-dependencies=false",
    "--filter",
    "marketingovo",
    "--fail-if-no-match",
    "--prod",
    "deploy",
    "--legacy",
    applicationRuntime,
  ],
  { cwd: root, stdio: "inherit", shell: false },
);
if (deployed.status !== 0)
  throw new Error("Failed to assemble the desktop runtime tree");

// The browser directory is hermetic and belongs to this exact Playwright
// version. --no-shell keeps a single full Chromium build that both Playwright
// and Lighthouse can drive through the same executable path.
const browserEnvironment = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: browserRuntime,
  PLAYWRIGHT_SKIP_BROWSER_GC: "1",
};
const installedBrowser = spawnSync(
  "pnpm",
  [
    "--filter",
    "@marketingovo/core",
    "exec",
    "playwright",
    "install",
    "--no-shell",
    "chromium",
  ],
  { cwd: root, env: browserEnvironment, stdio: "inherit", shell: false },
);
if (installedBrowser.status !== 0)
  throw new Error(
    "Failed to install the lockfile-matched desktop Chromium runtime",
  );

process.env.PLAYWRIGHT_BROWSERS_PATH = browserRuntime;
process.env.PLAYWRIGHT_SKIP_BROWSER_GC = "1";
const playwrightEntry = workspacePlaywrightEntry(root);
const [{ chromium }, playwrightVersion] = await Promise.all([
  import(pathToFileURL(playwrightEntry).href),
  playwrightVersionFrom(playwrightEntry),
]);
const chromiumExecutable = chromium.executablePath();
await assertExecutable(chromiumExecutable);

const extension = process.platform === "win32" ? ".exe" : "";
const nodeDestination = resolve(
  binaries,
  `marketingovo-node-${target}${extension}`,
);
await copyFile(process.execPath, nodeDestination);
if (process.platform !== "win32") await chmod(nodeDestination, 0o755);
await assertExecutable(nodeDestination);

const publicConfig = {
  schemaVersion: PUBLIC_RUNTIME_CONFIG_VERSION,
  target,
  nodeVersion: process.versions.node,
  playwrightVersion,
  browserDirectory: "browser",
  chromiumExecutable: runtimeRelativePath(runtimeRoot, chromiumExecutable),
  googleDesktopClientId,
};
await writeFile(
  resolve(configRuntime, "public-runtime.json"),
  `${JSON.stringify(publicConfig, null, 2)}\n`,
  { encoding: "utf8", mode: 0o644 },
);

process.stdout.write(
  `Prepared Node ${process.versions.node}, Playwright ${playwrightVersion}, and bundled Chromium for ${target}.\n`,
);
