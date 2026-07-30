import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { validateUpgradeLifecycleEvidence } from "./upgrade-baseline-policy.mjs";

export const RELEASE_VERIFICATION_SCHEMA_VERSION = 2;

export const CANONICAL_RELEASE_REPOSITORY = "MaxJafar/marketingovo";

export function releasePlatform(target) {
  if (/apple-darwin$/u.test(target)) return "macos";
  if (/pc-windows-msvc$/u.test(target)) return "windows";
  if (/unknown-linux-gnu$/u.test(target)) return "linux";
  throw new Error(`Unsupported release target: ${target}`);
}

export function releaseAssetName(target, artifactPath) {
  releasePlatform(target);
  if (
    typeof artifactPath !== "string" ||
    !artifactPath ||
    /[\u0000-\u001f\u007f]/u.test(artifactPath)
  ) {
    throw new Error(
      "Release artifact path is empty or contains control characters",
    );
  }
  const name = basename(artifactPath);
  if (!name || name === "." || name === "..") {
    throw new Error(`Release artifact has no safe basename: ${artifactPath}`);
  }
  return `${target}--${name}`;
}

export function requiredReleaseEnvironment(target) {
  const platform = releasePlatform(target);
  const common = [
    "TAURI_UPDATER_PUBLIC_KEY",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ];
  if (platform === "macos") {
    return [
      ...common,
      "APPLE_CERTIFICATE",
      "APPLE_CERTIFICATE_PASSWORD",
      "APPLE_SIGNING_IDENTITY",
      "APPLE_ID",
      "APPLE_PASSWORD",
      "APPLE_TEAM_ID",
    ];
  }
  if (platform === "windows") {
    return [...common, "WINDOWS_CERTIFICATE", "WINDOWS_CERTIFICATE_PASSWORD"];
  }
  return common;
}

export function validateReleaseEnvironment(target, environment = process.env) {
  const missing = requiredReleaseEnvironment(target).filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Release signing configuration is incomplete; missing ${missing.join(", ")}`,
    );
  }
}

function classifyArtifact(path, target) {
  const normalized = path.split(sep).join("/");
  if (releasePlatform(target) === "linux" && normalized.endsWith(".deb.sig")) {
    return "installer-signature";
  }
  if (normalized.endsWith(".sig")) return "updater-signature";
  if (
    normalized.endsWith(".app.tar.gz") ||
    normalized.endsWith(".AppImage.tar.gz") ||
    normalized.endsWith(".msi.zip")
  ) {
    return "updater-payload";
  }
  const platform = releasePlatform(target);
  if (platform === "macos" && normalized.endsWith(".dmg")) return "installer";
  if (platform === "windows" && normalized.endsWith(".msi"))
    return "installer-updater-payload";
  if (platform === "linux" && normalized.endsWith(".AppImage")) {
    return "installer-updater-payload";
  }
  if (platform === "linux" && normalized.endsWith(".deb")) return "installer";
  return null;
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Release bundle contains a symbolic link: ${path}`);
    }
    if (entry.isDirectory()) {
      if (!entry.name.endsWith(".app")) files.push(...(await filesUnder(path)));
    } else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function sha256File(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export async function collectReleaseArtifacts(bundleRoot, target) {
  const candidates = await filesUnder(bundleRoot);
  const artifacts = candidates
    .map((path) => ({ path, role: classifyArtifact(path, target) }))
    .filter((artifact) => artifact.role !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
  const installers = artifacts.filter(({ role }) => role.includes("installer"));
  const updaterPayloads = artifacts.filter(({ role }) =>
    role.includes("updater-payload"),
  );
  const updaterSignatures = artifacts.filter(
    ({ role }) => role === "updater-signature",
  );
  const installerSignatures = artifacts.filter(
    ({ role }) => role === "installer-signature",
  );

  const platform = releasePlatform(target);
  const requiredInstallerSuffixes =
    platform === "macos"
      ? [".dmg"]
      : platform === "windows"
        ? [".msi"]
        : [".AppImage", ".deb"];
  for (const suffix of requiredInstallerSuffixes) {
    if (!installers.some(({ path }) => path.endsWith(suffix))) {
      throw new Error(
        `Release bundle is missing its required ${suffix} installer`,
      );
    }
  }
  if (updaterPayloads.length === 0) {
    throw new Error("Release bundle contains no signed updater payload");
  }

  const artifactPaths = new Set(artifacts.map(({ path }) => path));
  for (const { path } of updaterPayloads) {
    if (!artifactPaths.has(`${path}.sig`)) {
      throw new Error(`Updater payload has no detached signature: ${path}`);
    }
  }
  for (const { path } of updaterSignatures) {
    const payload = path.slice(0, -".sig".length);
    if (!artifactPaths.has(payload)) {
      throw new Error(`Detached updater signature has no payload: ${path}`);
    }
    const signature = (await readFile(path, "utf8")).trim();
    if (signature.length < 64 || !/^[A-Za-z0-9+/=]+$/u.test(signature)) {
      throw new Error(`Updater signature is empty or malformed: ${path}`);
    }
  }
  if (platform === "linux") {
    const debInstallers = artifacts.filter(
      ({ role, path }) => role === "installer" && path.endsWith(".deb"),
    );
    for (const { path } of debInstallers) {
      if (!artifactPaths.has(`${path}.sig`)) {
        throw new Error(
          `Linux deb has no release-key detached signature: ${path}`,
        );
      }
    }
  }
  for (const { path } of installerSignatures) {
    const payload = path.slice(0, -".sig".length);
    if (!artifactPaths.has(payload)) {
      throw new Error(`Detached installer signature has no payload: ${path}`);
    }
    const signature = (await readFile(path, "utf8")).trim();
    if (signature.length < 64 || !/^[A-Za-z0-9+/=]+$/u.test(signature)) {
      throw new Error(`Installer signature is empty or malformed: ${path}`);
    }
  }

  return Promise.all(
    artifacts.map(async ({ path, role }) => ({
      path: relative(bundleRoot, path).split(sep).join("/"),
      role,
      sha256: await sha256File(path),
    })),
  );
}

export async function validateVerificationRecord(
  record,
  { target, bundleRoot },
) {
  if (
    record?.schemaVersion !== RELEASE_VERIFICATION_SCHEMA_VERSION ||
    record.target !== target ||
    typeof record.version !== "string" ||
    !["macos", "windows", "linux"].includes(record.platform) ||
    !Array.isArray(record.artifacts) ||
    record.artifacts.length === 0 ||
    typeof record.platformVerification !== "object" ||
    record.platformVerification === null
  ) {
    throw new Error(
      "Release verification record is malformed or for another target",
    );
  }
  const discovered = await collectReleaseArtifacts(bundleRoot, target);
  if (JSON.stringify(discovered) !== JSON.stringify(record.artifacts)) {
    throw new Error(
      "Release artifacts changed after native signature verification; refusing to create a manifest",
    );
  }
  const platform = releasePlatform(target);
  if (record.platform !== platform) {
    throw new Error("Release verification platform does not match its target");
  }
  const lifecycle = record.platformVerification.lifecycleEvidence;
  const installerSuffix =
    platform === "macos" ? ".dmg" : platform === "windows" ? ".msi" : ".deb";
  const lifecycleInstallers = discovered.filter(
    ({ role, path }) =>
      role.includes("installer") && path.endsWith(installerSuffix),
  );
  if (
    lifecycleInstallers.length !== 1 ||
    lifecycle?.schemaVersion !== 2 ||
    lifecycle.target !== target ||
    lifecycle.platform !== platform ||
    lifecycle.version !== record.version ||
    lifecycle.installerSha256 !== lifecycleInstallers[0].sha256 ||
    lifecycle.install !== "verified" ||
    lifecycle.stop !== "verified" ||
    lifecycle.uninstall !== "verified" ||
    lifecycle.backgroundServiceAfterUninstall !== "stopped" ||
    lifecycle.userDataAfterUninstall !== "retained" ||
    lifecycle.backgroundHealth?.status !== "ok" ||
    lifecycle.backgroundHealth?.version !==
      (lifecycle.upgrade === "verified"
        ? lifecycle.baselineVersion
        : record.version)
  ) {
    throw new Error(
      `${platform} installer lifecycle evidence is missing, malformed, or does not match the verified installer`,
    );
  }
  validateUpgradeLifecycleEvidence(lifecycle, record.version);
  if (
    platform === "windows"
      ? lifecycle.loginRegistrationAfterUninstall !== "removed" ||
        lifecycle.installedProcessesAfterUninstall !== "removed" ||
        lifecycle.executableAfterUninstall !== "removed" ||
        lifecycle.processTreeOwnership !== "verified" ||
        lifecycle.singleInstanceActivation !== "verified" ||
        !Number.isInteger(lifecycle.ownedChildProcessCount) ||
        lifecycle.ownedChildProcessCount < 1
      : lifecycle.serviceDefinitionAfterUninstall !== "removed" ||
        lifecycle.installedPackageAfterUninstall !== "removed" ||
        lifecycle.processOwnership !== "verified" ||
        lifecycle.singleInstanceActivation !== "verified" ||
        !Number.isInteger(lifecycle.installedProcessCount) ||
        lifecycle.installedProcessCount < 1
  ) {
    throw new Error(
      `${platform} lifecycle cleanup and installed-process ownership evidence is incomplete`,
    );
  }
  if (
    platform === "macos" &&
    !(
      record.platformVerification.codeSignature === "verified" &&
      record.platformVerification.gatekeeper === "accepted" &&
      record.platformVerification.notarizationTicket === "validated" &&
      record.platformVerification.stapling === "validated" &&
      record.platformVerification.installLifecycle === "verified" &&
      record.platformVerification.backgroundStartup === "verified" &&
      record.platformVerification.backgroundService ===
        "healthy-before-uninstall" &&
      record.platformVerification.stopLifecycle === "verified" &&
      record.platformVerification.uninstallCleanup === "verified" &&
      record.updater?.detachedSignatures === "cryptographically-verified"
    )
  ) {
    throw new Error(
      "macOS signing, notarization, Gatekeeper and destructive installer lifecycle were not verified",
    );
  }
  if (
    platform === "windows" &&
    !(
      record.platformVerification.authenticode === "valid" &&
      record.platformVerification.timestamp === "present" &&
      record.platformVerification.installLifecycle === "verified" &&
      record.platformVerification.loginStartup === "verified" &&
      record.platformVerification.backgroundService ===
        "healthy-before-uninstall" &&
      record.platformVerification.stopLifecycle === "verified" &&
      record.platformVerification.processTreeCleanup === "verified" &&
      record.platformVerification.uninstallCleanup === "verified" &&
      record.updater?.detachedSignatures === "cryptographically-verified"
    )
  ) {
    throw new Error(
      "Windows Authenticode, timestamp, install, stop, upgrade policy, login startup, service health, process-tree cleanup and uninstall cleanup were not verified",
    );
  }
  if (
    platform === "linux" &&
    (record.platformVerification.nativePackageSignature !== "not-applicable" ||
      record.platformVerification.installLifecycle !== "verified" ||
      record.platformVerification.backgroundStartup !== "verified" ||
      record.platformVerification.backgroundService !==
        "healthy-before-uninstall" ||
      record.platformVerification.stopLifecycle !== "verified" ||
      record.platformVerification.uninstallCleanup !== "verified" ||
      record.updater?.detachedSignatures !== "cryptographically-verified")
  ) {
    throw new Error(
      "Linux native package signing and destructive installer lifecycle status are not explicit",
    );
  }
  if (platform === "linux") {
    const appImages = discovered.filter(
      ({ role, path }) =>
        role.includes("installer") && path.endsWith(".AppImage"),
    );
    if (
      appImages.length !== 1 ||
      lifecycle.appImage?.sha256 !== appImages[0].sha256 ||
      lifecycle.appImage?.backgroundHealth?.status !== "ok" ||
      lifecycle.appImage?.backgroundHealth?.version !== record.version ||
      lifecycle.appImage?.stop !== "verified"
    ) {
      throw new Error(
        "Linux AppImage execution and shutdown evidence is missing or malformed",
      );
    }
  }
  return discovered;
}

export async function assertRegularFileInside(root, relativePath) {
  if (
    typeof relativePath !== "string" ||
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`Unsafe release artifact path: ${String(relativePath)}`);
  }
  const path = resolve(root, relativePath);
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Release artifact is not a regular file: ${relativePath}`);
  }
  return path;
}
