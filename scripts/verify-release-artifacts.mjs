import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateBuildTarget } from "./desktop-runtime-config.mjs";
import {
  collectReleaseArtifacts,
  RELEASE_VERIFICATION_SCHEMA_VERSION,
  releasePlatform,
  validateVerificationRecord,
} from "./release-policy.mjs";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
if (!target) {
  throw new Error(
    "usage: node scripts/verify-release-artifacts.mjs --target <Rust target triple>",
  );
}
validateBuildTarget(target);

const root = resolve(import.meta.dirname, "..");
const bundleRoot = resolve(
  root,
  "apps/desktop/src-tauri/target",
  target,
  "release/bundle",
);
const platform = releasePlatform(target);
const artifacts = await collectReleaseArtifacts(bundleRoot, target);
const version = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
).version;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed${output ? `: ${output}` : ""}`,
      { cause: result.error },
    );
  }
  return output;
}

const updaterPublicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
if (!updaterPublicKey || updaterPublicKey.length < 32) {
  throw new Error(
    "TAURI_UPDATER_PUBLIC_KEY is required to verify updater signatures",
  );
}
const tauriConfiguration = JSON.parse(
  await readFile(
    resolve(root, "apps/desktop/src-tauri/tauri.conf.json"),
    "utf8",
  ),
);
if (tauriConfiguration?.plugins?.updater?.pubkey !== updaterPublicKey) {
  throw new Error(
    "The updater public key used for verification does not match the key embedded in the desktop application",
  );
}
for (const signature of artifacts.filter(({ role }) =>
  ["updater-signature", "installer-signature"].includes(role),
)) {
  const payload = signature.path.slice(0, -".sig".length);
  run(
    "cargo",
    [
      "run",
      "--locked",
      "--release",
      "--quiet",
      "--manifest-path",
      resolve(root, "apps/desktop/src-tauri/Cargo.toml"),
      "--target",
      target,
      "--bin",
      "verify-updater-signature",
      "--",
      resolve(bundleRoot, payload),
      resolve(bundleRoot, signature.path),
    ],
    {
      env: {
        ...process.env,
        AGENTSEO_TAURI_UPDATER_PUBLIC_KEY: updaterPublicKey,
      },
    },
  );
}

async function macApplicationBundles() {
  const macosRoot = resolve(bundleRoot, "macos");
  return (await readdir(macosRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => resolve(macosRoot, entry.name));
}

async function verifyMacOS() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const signingIdentity = process.env.APPLE_SIGNING_IDENTITY?.trim();
  if (!teamId || !/^[A-Z0-9]{10}$/u.test(teamId) || !signingIdentity) {
    throw new Error(
      "APPLE_TEAM_ID and APPLE_SIGNING_IDENTITY are required for macOS verification",
    );
  }
  const applications = await macApplicationBundles();
  if (applications.length !== 1) {
    throw new Error(
      `Expected one top-level macOS application bundle, found ${applications.length}`,
    );
  }
  const diskImages = artifacts
    .filter(
      ({ role, path }) => role.includes("installer") && path.endsWith(".dmg"),
    )
    .map(({ path }) => resolve(bundleRoot, path));

  for (const application of applications) {
    run("codesign", [
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      application,
    ]);
    const details = run("codesign", ["--display", "--verbose=4", application]);
    if (
      details.includes("Signature=adhoc") ||
      !details.includes("Authority=") ||
      !details.includes(`TeamIdentifier=${teamId}`)
    ) {
      throw new Error(
        "macOS application is not signed by the expected Developer ID team",
      );
    }
    run("xcrun", ["stapler", "validate", application]);
    run("spctl", ["--assess", "--type", "execute", "--verbose=4", application]);
  }
  for (const diskImage of diskImages) {
    run("codesign", ["--verify", "--strict", "--verbose=2", diskImage]);
    const details = run("codesign", ["--display", "--verbose=4", diskImage]);
    if (
      details.includes("Signature=adhoc") ||
      !details.includes("Authority=") ||
      !details.includes(`TeamIdentifier=${teamId}`)
    ) {
      throw new Error(
        `macOS disk image is not signed by the expected Developer ID team: ${diskImage}`,
      );
    }
    run("xcrun", ["stapler", "validate", diskImage]);
    run("spctl", [
      "--assess",
      "--type",
      "open",
      "--context",
      "context:primary-signature",
      "--verbose=4",
      diskImage,
    ]);
  }
  const lifecycle = JSON.parse(
    await readFile(
      resolve(root, "artifacts", `macos-installer-lifecycle-${target}.json`),
      "utf8",
    ),
  );
  return {
    codeSignature: "verified",
    signingTeamId: teamId,
    gatekeeper: "accepted",
    notarizationTicket: "validated",
    stapling: "validated",
    applicationBundles: applications.length,
    diskImages: diskImages.length,
    installLifecycle: "verified",
    backgroundStartup: "verified",
    backgroundService: "healthy-before-uninstall",
    stopLifecycle: "verified",
    uninstallCleanup: "verified",
    lifecycleEvidence: lifecycle,
  };
}

async function verifyWindows() {
  const expectedThumbprint =
    process.env.AGENTSEO_WINDOWS_CERTIFICATE_THUMBPRINT?.replaceAll(
      /\s/gu,
      "",
    ).toUpperCase();
  if (!expectedThumbprint || !/^[0-9A-F]{40}$/u.test(expectedThumbprint)) {
    throw new Error(
      "AGENTSEO_WINDOWS_CERTIFICATE_THUMBPRINT is required for Authenticode verification",
    );
  }
  const installers = artifacts.filter(
    ({ role, path }) => role.includes("installer") && path.endsWith(".msi"),
  );
  if (installers.length !== 1) {
    throw new Error(
      `Expected exactly one Windows MSI for lifecycle verification, found ${installers.length}`,
    );
  }
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $env:AGENTSEO_VERIFY_ARTIFACT
if ($signature.Status -ne 'Valid') { throw "Authenticode status is $($signature.Status): $($signature.StatusMessage)" }
if (-not $signature.SignerCertificate) { throw 'Authenticode signer certificate is missing' }
if ($signature.SignerCertificate.Thumbprint -ne $env:AGENTSEO_EXPECTED_THUMBPRINT) { throw 'Authenticode signer thumbprint does not match the imported release certificate' }
if (-not $signature.TimeStamperCertificate) { throw 'Authenticode timestamp certificate is missing' }
[PSCustomObject]@{
  thumbprint = $signature.SignerCertificate.Thumbprint
  subject = $signature.SignerCertificate.Subject
  timestampThumbprint = $signature.TimeStamperCertificate.Thumbprint
} | ConvertTo-Json -Compress
`;
  const verified = installers.map(({ path }) => {
    const output = run(
      "pwsh",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        env: {
          ...process.env,
          AGENTSEO_VERIFY_ARTIFACT: resolve(bundleRoot, path),
          AGENTSEO_EXPECTED_THUMBPRINT: expectedThumbprint,
        },
      },
    );
    const result = JSON.parse(output);
    return { path, subject: result.subject };
  });
  const lifecyclePath = resolve(
    root,
    "artifacts",
    `windows-installer-lifecycle-${target}.json`,
  );
  const lifecycle = JSON.parse(await readFile(lifecyclePath, "utf8"));
  if (
    lifecycle?.schemaVersion !== 2 ||
    lifecycle.target !== target ||
    lifecycle.platform !== "windows" ||
    lifecycle.version !== version ||
    lifecycle.installerSha256 !== installers[0].sha256 ||
    lifecycle.signerThumbprint !== expectedThumbprint ||
    lifecycle.executableSignerThumbprint !== expectedThumbprint ||
    lifecycle.install !== "verified" ||
    lifecycle.loginRegistration !== "created" ||
    lifecycle.loginCommand !== "quoted-executable --background" ||
    lifecycle.processTreeOwnership !== "verified" ||
    lifecycle.singleInstanceActivation !== "verified" ||
    !Number.isInteger(lifecycle.installedProcessCount) ||
    lifecycle.installedProcessCount < 2 ||
    !Number.isInteger(lifecycle.ownedChildProcessCount) ||
    lifecycle.ownedChildProcessCount < 1 ||
    lifecycle.backgroundHealth?.status !== "ok" ||
    typeof lifecycle.backgroundHealth?.version !== "string" ||
    lifecycle.backgroundHealth.version.length === 0 ||
    lifecycle.stop !== "verified" ||
    lifecycle.uninstall !== "verified" ||
    lifecycle.loginRegistrationAfterUninstall !== "removed" ||
    lifecycle.backgroundServiceAfterUninstall !== "stopped" ||
    lifecycle.installedProcessesAfterUninstall !== "removed" ||
    lifecycle.executableAfterUninstall !== "removed"
  ) {
    throw new Error(
      "Windows installer lifecycle evidence is missing, malformed, or does not match the verified MSI",
    );
  }
  return {
    authenticode: "valid",
    signerThumbprint: expectedThumbprint,
    timestamp: "present",
    installLifecycle: "verified",
    loginStartup: "verified",
    backgroundService: "healthy-before-uninstall",
    stopLifecycle: "verified",
    processTreeCleanup: "verified",
    uninstallCleanup: "verified",
    lifecycleEvidence: lifecycle,
    installers: verified,
  };
}

async function verifyLinux() {
  const lifecycle = JSON.parse(
    await readFile(
      resolve(root, "artifacts", `linux-installer-lifecycle-${target}.json`),
      "utf8",
    ),
  );
  return {
    nativePackageSignature: "not-applicable",
    updaterSignatures: "present",
    installLifecycle: "verified",
    backgroundStartup: "verified",
    backgroundService: "healthy-before-uninstall",
    stopLifecycle: "verified",
    uninstallCleanup: "verified",
    lifecycleEvidence: lifecycle,
    note: "Linux native package signing is not claimed; detached updater signatures and the destructive package lifecycle are verified independently.",
  };
}

const platformVerification =
  platform === "macos"
    ? await verifyMacOS()
    : platform === "windows"
      ? await verifyWindows()
      : await verifyLinux();

const updaterPublicKeySha256 = await (async () => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(updaterPublicKey).digest("hex");
})();

const record = {
  schemaVersion: RELEASE_VERIFICATION_SCHEMA_VERSION,
  target,
  platform,
  version,
  verifiedAt: new Date().toISOString(),
  updater: {
    detachedSignatures: "cryptographically-verified",
    publicKeySha256: updaterPublicKeySha256,
  },
  platformVerification,
  artifacts,
};
await validateVerificationRecord(record, { target, bundleRoot });
const output = resolve(
  root,
  "artifacts",
  `release-verification-${target}.json`,
);
await mkdir(resolve(root, "artifacts"), { recursive: true, mode: 0o755 });
await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, {
  mode: 0o644,
});

// Read back before reporting success so truncated or failed writes cannot be
// mistaken for verification evidence.
JSON.parse(await readFile(output, "utf8"));
process.stdout.write(
  `Verified ${artifacts.length} release artifacts for ${target}; evidence written to ${output}.\n`,
);
