import { execFileSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertExecutable,
  PUBLIC_RUNTIME_CONFIG_VERSION,
  runtimeRelativePath,
  validateBuildTarget,
  validateGoogleDesktopClientId,
} from "./desktop-runtime-config.mjs";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
if (!target) {
  throw new Error(
    "usage: node scripts/verify-desktop-runtime.mjs --target <Rust target triple> [--require-broker] [--require-google-client-id] [--launch-browser]",
  );
}
validateBuildTarget(target);

const root = resolve(import.meta.dirname, "..");
const tauriRoot = resolve(root, "apps/desktop/src-tauri");
const runtimeRoot = resolve(tauriRoot, "runtime");
const configPath = resolve(runtimeRoot, "config/public-runtime.json");
const source = await readFile(configPath, "utf8");
if (/client[_-]?secret/iu.test(source))
  throw new Error(
    "Desktop public runtime config contains a forbidden client-secret field",
  );
const config = JSON.parse(source);

for (const file of ["LICENSE", "NOTICE", "PRIVACY.md", "TRADEMARKS.md"]) {
  const [canonical, packaged] = await Promise.all([
    readFile(resolve(root, file)),
    readFile(resolve(runtimeRoot, "legal", file)),
  ]);
  if (!canonical.equals(packaged)) {
    throw new Error(
      `Packaged legal resource ${file} does not match the repository source`,
    );
  }
}

if (config.schemaVersion !== PUBLIC_RUNTIME_CONFIG_VERSION)
  throw new Error("Unsupported desktop public runtime config version");
if (config.target !== target)
  throw new Error(
    `Desktop runtime target mismatch: ${config.target} != ${target}`,
  );
if (config.nodeVersion !== process.versions.node)
  throw new Error(
    `Desktop Node sidecar mismatch: ${config.nodeVersion} != ${process.versions.node}`,
  );
if (
  typeof config.playwrightVersion !== "string" ||
  !/^\d+\.\d+\.\d+(?:[-+].+)?$/u.test(config.playwrightVersion)
) {
  throw new Error("Desktop runtime does not declare its Playwright version");
}
if (config.browserDirectory !== "browser")
  throw new Error("Desktop runtime browser directory is not canonical");
validateGoogleDesktopClientId(config.googleDesktopClientId, {
  required: process.argv.includes("--require-google-client-id"),
});

const chromiumExecutable = resolve(runtimeRoot, config.chromiumExecutable);
if (
  runtimeRelativePath(runtimeRoot, chromiumExecutable) !==
  config.chromiumExecutable
) {
  throw new Error(
    "Desktop Chromium path is not normalized inside the runtime resource tree",
  );
}
await assertExecutable(chromiumExecutable);

// Prove the deployed production graph contains the same resolver exercised by
// the source tests. This catches stale `dist` trees before an installer can be
// signed.
const deployedChromiumResolver = resolve(
  runtimeRoot,
  "app/node_modules/.pnpm/node_modules/@agentseoapp/core/dist/chromium-runtime.js",
);
await access(deployedChromiumResolver);
process.env.GOLEMSEO_CHROME_PATH = chromiumExecutable;
const { resolveChromiumExecutablePath } = await import(
  pathToFileURL(deployedChromiumResolver).href
);
if ((await resolveChromiumExecutablePath()) !== chromiumExecutable) {
  throw new Error("The deployed engine did not resolve packaged Chromium");
}

const extension = process.platform === "win32" ? ".exe" : "";
const nodeExecutable = resolve(
  tauriRoot,
  "binaries",
  `golem-seo-node-${target}${extension}`,
);
await assertExecutable(nodeExecutable);
const bundledNodeVersion = execFileSync(nodeExecutable, ["--version"], {
  encoding: "utf8",
}).trim();
if (bundledNodeVersion !== `v${config.nodeVersion}`) {
  throw new Error(
    `Bundled Node reports ${bundledNodeVersion}; expected v${config.nodeVersion}`,
  );
}

if (process.argv.includes("--require-broker")) {
  const broker = resolve(
    runtimeRoot,
    "broker",
    `golem-seo-credential-broker${extension}`,
  );
  await assertExecutable(broker);
}

if (process.argv.includes("--launch-browser")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(
    runtimeRoot,
    config.browserDirectory,
  );
  process.env.PLAYWRIGHT_SKIP_BROWSER_GC = "1";
  const packageStore = resolve(runtimeRoot, "app/node_modules/.pnpm");
  const candidates = (await readdir(packageStore))
    .filter((name) => name.startsWith(`playwright@${config.playwrightVersion}`))
    .sort();
  if (candidates.length !== 1) {
    throw new Error(
      `Expected one deployed Playwright ${config.playwrightVersion} package, found ${candidates.length}`,
    );
  }
  const entry = resolve(
    packageStore,
    candidates[0],
    "node_modules/playwright/index.mjs",
  );
  const { chromium } = await import(pathToFileURL(entry).href);
  const browser = await chromium.launch({
    executablePath: chromiumExecutable,
    headless: true,
    chromiumSandbox: true,
    args: ["--disable-background-networking", "--disable-quic"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<!doctype html><title>Golem SEO runtime smoke</title>",
    );
    if ((await page.title()) !== "Golem SEO runtime smoke")
      throw new Error("Bundled Chromium smoke page failed");
    await page.close();
  } finally {
    await browser.close();
  }
}

process.stdout.write(
  `Desktop runtime verified for ${target}: Node ${config.nodeVersion}, Playwright ${config.playwrightVersion}, bundled sandboxed Chromium, native vault${config.googleDesktopClientId ? ", and Google Desktop OAuth" : ""}.\n`,
);
