import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expectedRustTarget,
  rejectGoogleClientSecrets,
  runtimeRelativePath,
  validateGoogleDesktopClientId,
} from "../../../scripts/desktop-runtime-config.mjs";
import { CANONICAL_UPDATER_ENDPOINT } from "../../../scripts/updater-metadata-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(
  await readFile(resolve(root, "src-tauri/tauri.conf.json"), "utf8"),
);
const launcher = await readFile(resolve(root, "src-tauri/src/lib.rs"), "utf8");
const startupShell = await readFile(resolve(root, "shell/index.html"), "utf8");
const cargoManifest = await readFile(
  resolve(root, "src-tauri/Cargo.toml"),
  "utf8",
);
const capability = JSON.parse(
  await readFile(resolve(root, "src-tauri/capabilities/default.json"), "utf8"),
);
const startupFragmentPath = resolve(
  root,
  "src-tauri/windows/fragments/background-startup.wxs",
);
const startupFragment = await readFile(startupFragmentPath, "utf8");
assert.equal(config.productName, "Marketingovo");
assert.equal(config.identifier, "io.github.maxjafar.marketingovo");
assert.equal(config.bundle.active, true);
assert.equal(config.bundle.createUpdaterArtifacts, true);
assert.equal(config.bundle.publisher, "MaxJafar");
assert.equal(
  config.bundle.homepage,
  "https://github.com/MaxJafar/marketingovo",
);
assert.equal(config.bundle.license, "Apache-2.0");
assert.equal(config.bundle.licenseFile, "../../../LICENSE");
assert.deepEqual(config.bundle.externalBin, ["binaries/marketingovo-node"]);
assert.ok(
  launcher.includes('.sidecar("marketingovo-node")'),
  "desktop launcher must use the product-scoped Node sidecar name",
);
assert.ok(
  !launcher.includes('.sidecar("node")'),
  "desktop launcher must never use a system-conflicting generic sidecar name",
);
assert.deepEqual(config.bundle.resources, ["runtime/**/*"]);
assert.equal(
  config.plugins.updater.pubkey,
  "__MARKETINGOVO_UPDATER_PUBLIC_KEY__",
);
assert.deepEqual(config.plugins.updater.endpoints, [
  CANONICAL_UPDATER_ENDPOINT,
]);
assert.deepEqual(
  capability.permissions,
  [],
  "the webview must not receive shell, updater, or other privileged Tauri commands",
);
assert.ok(
  launcher.includes("use tauri_plugin_updater::UpdaterExt"),
  "desktop launcher must invoke the updater instead of merely registering it",
);
assert.match(launcher, /\.updater_builder\(\)[\s\S]*\.check\(\)/u);
assert.match(launcher, /\.download_and_install\(/u);
assert.ok(
  launcher.includes("UPDATE_CHECK_TIMEOUT"),
  "desktop update checks must have a bounded timeout",
);
assert.ok(
  launcher.includes('argument == "--no-update"'),
  "desktop users must have an explicit update-check opt-out",
);
assert.ok(
  launcher.includes('std::env::var("MARKETINGOVO_AUTO_UPDATE")'),
  "desktop services must expose a documented update-check policy override",
);
assert.match(startupShell, /id="startup-status"/u);
assert.match(startupShell, /aria-live="polite"/u);
for (const requiredArgument of [
  "--credential-broker",
  "--chromium-executable",
  "--browser-directory",
  "--google-desktop-client-id",
]) {
  assert.ok(
    launcher.includes(requiredArgument),
    `Desktop launcher is missing ${requiredArgument}`,
  );
}
assert.ok(launcher.includes('argument == "--background"'));
assert.ok(
  launcher.includes("should_open_dashboard(!open_dashboard, window_opened)"),
);
assert.match(cargoManifest, /tauri-plugin-single-instance = "2"/u);
assert.match(launcher, /tauri_plugin_single_instance::init/u);
assert.match(launcher, /activate_existing_instance\(handle, &arguments\)/u);
const singleInstancePlugin = launcher.indexOf(
  ".plugin(tauri_plugin_single_instance::init",
);
const shellPlugin = launcher.indexOf(".plugin(tauri_plugin_shell::init())");
const updaterPlugin = launcher.indexOf(
  ".plugin(tauri_plugin_updater::Builder::new().build())",
);
assert.ok(
  singleInstancePlugin >= 0 &&
    singleInstancePlugin < shellPlugin &&
    singleInstancePlugin < updaterPlugin,
  "single-instance must be the first registered Tauri plugin",
);
assert.deepEqual(config.bundle.windows.wix.fragmentPaths, [
  "./windows/fragments/background-startup.wxs",
]);
assert.deepEqual(config.bundle.windows.wix.componentRefs, [
  "AgentSeoBackgroundStartup",
]);
assert.match(startupFragment, /DirectoryRef Id="INSTALLDIR"/u);
assert.match(startupFragment, /Component Id="AgentSeoBackgroundStartup"/u);
assert.match(startupFragment, /Action="createAndRemoveOnUninstall"/u);
assert.match(startupFragment, /Value="&quot;\[#Path\]&quot; --background"/u);
assert.doesNotMatch(
  startupFragment,
  /master-password|credential|secret|token/iu,
);
assert.doesNotMatch(
  launcher.split("#[cfg(test)]", 1)[0] ?? "",
  /master-password/iu,
);
await Promise.all(
  [
    "src-tauri/Cargo.toml",
    "src-tauri/build.rs",
    "src-tauri/capabilities/default.json",
    "src-tauri/src/main.rs",
    "src-tauri/windows/fragments/background-startup.wxs",
    "shell/index.html",
    "shell/styles.css",
  ].map((path) => access(resolve(root, path))),
);

assert.equal(expectedRustTarget("darwin", "arm64"), "aarch64-apple-darwin");
assert.equal(expectedRustTarget("darwin", "x64"), "x86_64-apple-darwin");
assert.equal(expectedRustTarget("linux", "x64"), "x86_64-unknown-linux-gnu");
assert.equal(expectedRustTarget("win32", "x64"), "x86_64-pc-windows-msvc");
assert.equal(
  validateGoogleDesktopClientId("123-public.apps.googleusercontent.com", {
    required: true,
  }),
  "123-public.apps.googleusercontent.com",
);
assert.equal(validateGoogleDesktopClientId("", { required: false }), null);
assert.throws(() =>
  validateGoogleDesktopClientId("not-a-google-client", { required: true }),
);
assert.doesNotThrow(() => rejectGoogleClientSecrets({}));
assert.throws(() =>
  rejectGoogleClientSecrets({
    MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_SECRET: "forbidden",
  }),
);
assert.throws(() =>
  rejectGoogleClientSecrets({
    GOLEMSEO_GOOGLE_DESKTOP_CLIENT_SECRET: "forbidden",
  }),
);
assert.equal(
  runtimeRelativePath("/runtime", "/runtime/browser/chrome"),
  "browser/chrome",
);
assert.throws(() => runtimeRelativePath("/runtime", "/outside/chrome"));
process.stdout.write("Desktop shell configuration is structurally valid.\n");
