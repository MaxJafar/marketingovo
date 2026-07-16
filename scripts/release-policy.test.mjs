import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectReleaseArtifacts,
  releaseAssetName,
  requiredReleaseEnvironment,
  validateReleaseEnvironment,
  validateVerificationRecord,
} from "./release-policy.mjs";
import {
  compareReleaseVersions,
  selectUpgradeBaseline,
  validateUpgradeLifecycleEvidence,
} from "./upgrade-baseline-policy.mjs";

test("upgrade baseline policy orders prereleases and rejects unverified installers", () => {
  assert.equal(compareReleaseVersions("0.11.0-alpha.2", "0.11.0-rc.1"), -1);
  assert.equal(compareReleaseVersions("1.0.0-rc.2", "1.0.0"), -1);
  const target = "x86_64-pc-windows-msvc";
  const installer = {
    path: "msi/Golem SEO_1.0.0-rc.1_x64_en-US.msi",
    role: "installer-updater-payload",
    sha256: "a".repeat(64),
  };
  const signature = {
    path: `${installer.path}.sig`,
    role: "updater-signature",
    sha256: "b".repeat(64),
  };
  const record = {
    schemaVersion: 2,
    target,
    version: "1.0.0-rc.1",
    updater: { detachedSignatures: "cryptographically-verified" },
    platformVerification: {
      authenticode: "valid",
      timestamp: "present",
      installLifecycle: "verified",
    },
    artifacts: [installer, signature],
  };
  assert.deepEqual(
    selectUpgradeBaseline(record, {
      target,
      currentVersion: "1.0.0",
      baselineTag: "v1.0.0-rc.1",
    }),
    {
      tag: "v1.0.0-rc.1",
      version: "1.0.0-rc.1",
      installer,
      signature,
    },
  );
  assert.throws(
    () =>
      selectUpgradeBaseline(
        { ...record, artifacts: [installer] },
        {
          target,
          currentVersion: "1.0.0",
          baselineTag: "v1.0.0-rc.1",
        },
      ),
    /detached signature/u,
  );
});

test("stable lifecycle policy cannot downgrade upgrade evidence to a prerelease waiver", () => {
  assert.equal(
    validateUpgradeLifecycleEvidence(
      { upgrade: "not-tested-prerelease" },
      "1.0.0-rc.1",
    ),
    "not-required-for-prerelease",
  );
  assert.throws(
    () =>
      validateUpgradeLifecycleEvidence(
        { upgrade: "not-tested-prerelease" },
        "1.0.0",
      ),
    /older signed installer/u,
  );
  assert.equal(
    validateUpgradeLifecycleEvidence(
      {
        upgrade: "verified",
        baselineVersion: "1.0.0-rc.1",
        baselineInstallerSha256: "c".repeat(64),
        dataSurvivedUpgrade: "verified",
        healthAfterUpgrade: { status: "ok" },
        versionAfterUpgrade: "1.0.0",
      },
      "1.0.0",
    ),
    "verified",
  );
});

test("macOS releases fail closed when any signing or notarization input is missing", () => {
  const names = requiredReleaseEnvironment("aarch64-apple-darwin");
  const environment = Object.fromEntries(
    names.map((name) => [name, "configured"]),
  );
  delete environment.APPLE_TEAM_ID;
  assert.throws(
    () => validateReleaseEnvironment("aarch64-apple-darwin", environment),
    /APPLE_TEAM_ID/u,
  );
});

test("artifact collection requires a detached updater signature", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const dmg = join(root, "dmg", "Golem SEO.dmg");
  const updater = join(root, "macos", "Golem SEO.app.tar.gz");
  await mkdir(join(root, "dmg"), { recursive: true });
  await mkdir(join(root, "macos"), { recursive: true });
  await writeFile(dmg, "installer");
  await writeFile(updater, "updater");
  await assert.rejects(
    collectReleaseArtifacts(root, "aarch64-apple-darwin"),
    /no detached signature/u,
  );
});

test("artifact collection records payload hashes rather than trusting extensions", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const dmg = join(root, "dmg", "Golem SEO.dmg");
  const updater = join(root, "macos", "Golem SEO.app.tar.gz");
  await mkdir(join(root, "dmg"), { recursive: true });
  await mkdir(join(root, "macos"), { recursive: true });
  await writeFile(dmg, "installer");
  await writeFile(updater, "updater");
  await writeFile(`${updater}.sig`, "A".repeat(88));
  const artifacts = await collectReleaseArtifacts(root, "aarch64-apple-darwin");
  assert.deepEqual(artifacts.map(({ role }) => role).sort(), [
    "installer",
    "updater-payload",
    "updater-signature",
  ]);
  assert.ok(artifacts.every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256)));
});

test("Tauri v2 Windows MSI must have a detached signature", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const msi = join(root, "msi", "Golem SEO.msi");
  await mkdir(join(root, "msi"), { recursive: true });
  await writeFile(msi, "installer");
  await writeFile(`${msi}.sig`, "A".repeat(88));
  const artifacts = await collectReleaseArtifacts(
    root,
    "x86_64-pc-windows-msvc",
  );
  assert.deepEqual(artifacts.map(({ role }) => role).sort(), [
    "installer-updater-payload",
    "updater-signature",
  ]);
});

test("published artifact names remain unique across native targets", () => {
  assert.notEqual(
    releaseAssetName("aarch64-apple-darwin", "macos/Golem SEO.app.tar.gz"),
    releaseAssetName("x86_64-apple-darwin", "macos/Golem SEO.app.tar.gz"),
  );
  assert.throws(() =>
    releaseAssetName("aarch64-apple-darwin", "bad\nasset.tar.gz"),
  );
});

test("manifest validation rejects bytes changed after platform verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const dmg = join(root, "dmg", "Golem SEO.dmg");
  const updater = join(root, "macos", "Golem SEO.app.tar.gz");
  await mkdir(join(root, "dmg"), { recursive: true });
  await mkdir(join(root, "macos"), { recursive: true });
  await writeFile(dmg, "verified installer");
  await writeFile(updater, "verified updater");
  await writeFile(`${updater}.sig`, "A".repeat(88));
  const target = "aarch64-apple-darwin";
  const version = "0.11.0-alpha.0";
  const artifacts = await collectReleaseArtifacts(root, target);
  const installer = artifacts.find(({ path }) => path.endsWith(".dmg"));
  const record = {
    schemaVersion: 2,
    target,
    platform: "macos",
    version,
    updater: { detachedSignatures: "cryptographically-verified" },
    platformVerification: {
      codeSignature: "verified",
      gatekeeper: "accepted",
      notarizationTicket: "validated",
      stapling: "validated",
      installLifecycle: "verified",
      backgroundStartup: "verified",
      backgroundService: "healthy-before-uninstall",
      stopLifecycle: "verified",
      uninstallCleanup: "verified",
      lifecycleEvidence: {
        schemaVersion: 2,
        target,
        platform: "macos",
        version,
        installerSha256: installer.sha256,
        install: "verified",
        stop: "verified",
        upgrade: "not-tested-prerelease",
        uninstall: "verified",
        backgroundHealth: { status: "ok", version },
        serviceDefinitionAfterUninstall: "removed",
        backgroundServiceAfterUninstall: "stopped",
        installedPackageAfterUninstall: "removed",
        processOwnership: "verified",
        singleInstanceActivation: "verified",
        installedProcessCount: 2,
        userDataAfterUninstall: "retained",
      },
    },
    artifacts,
  };
  await validateVerificationRecord(record, { target, bundleRoot: root });
  await writeFile(dmg, "tampered installer");
  await assert.rejects(
    validateVerificationRecord(record, { target, bundleRoot: root }),
    /changed after native signature verification/u,
  );
});

test("Windows verification records fail closed without the full installer lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const msi = join(root, "msi", "Golem SEO.msi");
  await mkdir(join(root, "msi"), { recursive: true });
  await writeFile(msi, "installer");
  await writeFile(`${msi}.sig`, "A".repeat(88));
  const target = "x86_64-pc-windows-msvc";
  const version = "0.11.0-alpha.0";
  const artifacts = await collectReleaseArtifacts(root, target);
  const installer = artifacts.find(({ path }) => path.endsWith(".msi"));
  const record = {
    schemaVersion: 2,
    target,
    platform: "windows",
    version,
    updater: { detachedSignatures: "cryptographically-verified" },
    platformVerification: {
      authenticode: "valid",
      timestamp: "present",
    },
    artifacts,
  };
  await assert.rejects(
    validateVerificationRecord(record, { target, bundleRoot: root }),
    /installer lifecycle/u,
  );
  Object.assign(record.platformVerification, {
    installLifecycle: "verified",
    loginStartup: "verified",
    backgroundService: "healthy-before-uninstall",
    stopLifecycle: "verified",
    processTreeCleanup: "verified",
    uninstallCleanup: "verified",
    lifecycleEvidence: {
      schemaVersion: 2,
      target,
      platform: "windows",
      version,
      installerSha256: installer.sha256,
      install: "verified",
      stop: "verified",
      upgrade: "not-tested-prerelease",
      uninstall: "verified",
      backgroundHealth: { status: "ok", version },
      processTreeOwnership: "verified",
      singleInstanceActivation: "verified",
      ownedChildProcessCount: 1,
      loginRegistrationAfterUninstall: "removed",
      backgroundServiceAfterUninstall: "stopped",
      installedProcessesAfterUninstall: "removed",
      executableAfterUninstall: "removed",
      userDataAfterUninstall: "retained",
    },
  });
  await validateVerificationRecord(record, { target, bundleRoot: root });
});

test("Linux verification requires deb lifecycle and AppImage execution evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "golem-release-policy-"));
  const deb = join(root, "deb", "Golem SEO.deb");
  const appImage = join(root, "appimage", "Golem SEO.AppImage");
  await mkdir(join(root, "deb"), { recursive: true });
  await mkdir(join(root, "appimage"), { recursive: true });
  await writeFile(deb, "deb installer");
  await writeFile(`${deb}.sig`, "A".repeat(88));
  await writeFile(appImage, "appimage installer");
  await writeFile(`${appImage}.sig`, "A".repeat(88));
  const target = "x86_64-unknown-linux-gnu";
  const version = "0.11.0-alpha.0";
  const artifacts = await collectReleaseArtifacts(root, target);
  assert.deepEqual(
    artifacts.map(({ role }) => role).sort(),
    [
      "installer",
      "installer-signature",
      "installer-updater-payload",
      "updater-signature",
    ].sort(),
  );
  const debArtifact = artifacts.find(({ path }) => path.endsWith(".deb"));
  const appImageArtifact = artifacts.find(({ path }) =>
    path.endsWith(".AppImage"),
  );
  const lifecycleEvidence = {
    schemaVersion: 2,
    target,
    platform: "linux",
    version,
    installerSha256: debArtifact.sha256,
    install: "verified",
    stop: "verified",
    upgrade: "not-tested-prerelease",
    uninstall: "verified",
    backgroundHealth: { status: "ok", version },
    serviceDefinitionAfterUninstall: "removed",
    backgroundServiceAfterUninstall: "stopped",
    installedPackageAfterUninstall: "removed",
    processOwnership: "verified",
    singleInstanceActivation: "verified",
    installedProcessCount: 2,
    userDataAfterUninstall: "retained",
    appImage: {
      sha256: appImageArtifact.sha256,
      backgroundHealth: { status: "ok", version },
      stop: "verified",
    },
  };
  const record = {
    schemaVersion: 2,
    target,
    platform: "linux",
    version,
    updater: { detachedSignatures: "cryptographically-verified" },
    platformVerification: {
      nativePackageSignature: "not-applicable",
      installLifecycle: "verified",
      backgroundStartup: "verified",
      backgroundService: "healthy-before-uninstall",
      stopLifecycle: "verified",
      uninstallCleanup: "verified",
      lifecycleEvidence,
    },
    artifacts,
  };
  await validateVerificationRecord(record, { target, bundleRoot: root });
  lifecycleEvidence.appImage.sha256 = "0".repeat(64);
  await assert.rejects(
    validateVerificationRecord(record, { target, bundleRoot: root }),
    /AppImage execution/u,
  );
});

test("the release workflow executes every destructive native lifecycle gate", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const lifecycle = await readFile(
    new URL("./verify-windows-installer-lifecycle.ps1", import.meta.url),
    "utf8",
  );
  const unixLifecycle = await readFile(
    new URL("./verify-unix-installer-lifecycle.mjs", import.meta.url),
    "utf8",
  );
  const baseline = await readFile(
    new URL("./prepare-upgrade-baseline.mjs", import.meta.url),
    "utf8",
  );
  const desktopLauncher = await readFile(
    new URL("../apps/desktop/src-tauri/src/lib.rs", import.meta.url),
    "utf8",
  );
  const desktopCapability = JSON.parse(
    await readFile(
      new URL(
        "../apps/desktop/src-tauri/capabilities/default.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.match(workflow, /verify-windows-installer-lifecycle\.ps1/u);
  assert.match(workflow, /verify-unix-installer-lifecycle\.mjs/u);
  assert.match(workflow, /prepare-upgrade-baseline\.mjs/u);
  assert.match(workflow, /tauri signer sign/u);
  assert.match(workflow, /publish-updater-metadata:/u);
  assert.match(workflow, /create-updater-metadata\.mjs/u);
  assert.match(workflow, /verified-updater-\$\{\{ matrix\.target \}\}/u);
  assert.match(workflow, /needs: publish-updater-metadata/u);
  assert.match(workflow, /GOLEMSEO_UPGRADE_BASELINE_TAG/u);
  assert.match(lifecycle, /GITHUB_ACTIONS/u);
  assert.match(lifecycle, /--background/u);
  assert.match(lifecycle, /Wait-ForHealthyService/u);
  assert.match(lifecycle, /Get-CimInstance -ClassName Win32_Process/u);
  assert.match(lifecycle, /processTreeOwnership = "verified"/u);
  assert.match(lifecycle, /loginRegistrationAfterUninstall = "removed"/u);
  assert.match(lifecycle, /backgroundServiceAfterUninstall = "stopped"/u);
  assert.match(lifecycle, /installedProcessesAfterUninstall = "removed"/u);
  assert.match(lifecycle, /Test-UpgradeCanary/u);
  assert.match(lifecycle, /Get-OwnedDataDirectory/u);
  assert.match(lifecycle, /upgrade = \$upgradeStatus/u);
  assert.match(lifecycle, /Test-SingleInstanceActivation/u);
  assert.match(lifecycle, /singleInstanceActivation = "verified"/u);
  assert.match(unixLifecycle, /GITHUB_ACTIONS/u);
  assert.match(unixLifecycle, /\["service", "install"\]/u);
  assert.match(unixLifecycle, /createCanary/u);
  assert.match(unixLifecycle, /verifyCanary/u);
  assert.match(unixLifecycle, /xvfb-run/u);
  assert.match(unixLifecycle, /verifySingleInstanceActivation/u);
  assert.match(unixLifecycle, /singleInstanceActivation: "verified"/u);
  assert.match(unixLifecycle, /userDataAfterUninstall: "retained"/u);
  assert.match(baseline, /stable native release/u);
  assert.match(baseline, /verify-updater-signature/u);
  assert.match(desktopLauncher, /UpdaterExt/u);
  assert.match(desktopLauncher, /\.updater_builder\(\)/u);
  assert.match(desktopLauncher, /\.download_and_install\(/u);
  assert.match(desktopLauncher, /GOLEMSEO_AUTO_UPDATE/u);
  assert.match(desktopLauncher, /--no-update/u);
  assert.match(desktopLauncher, /tauri_plugin_single_instance::init/u);
  assert.match(desktopLauncher, /activate_existing_instance/u);
  assert.deepEqual(
    desktopCapability.permissions,
    [],
    "the dashboard webview must not be able to spawn processes or drive updates",
  );
  assert.ok(
    desktopLauncher.indexOf("tauri_plugin_single_instance::init") <
      desktopLauncher.indexOf("tauri_plugin_shell::init"),
  );
});

test("the exact-tag release waits for browser, advisory, secret and CodeQL evidence", async () => {
  const [releaseWorkflow, communityWorkflow] = await Promise.all([
    readFile(
      new URL("../.github/workflows/release.yml", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  ]);

  assert.match(
    releaseWorkflow,
    /source-evidence:[\s\S]*needs: release-approval/u,
  );
  assert.match(
    releaseWorkflow,
    /native:[\s\S]*needs: \[release-approval, source-evidence\]/u,
  );
  assert.match(releaseWorkflow, /pnpm audit:dependencies/u);
  assert.match(releaseWorkflow, /pnpm test:e2e/u);
  assert.match(releaseWorkflow, /gitleaks\/gitleaks-action@v2/u);
  assert.match(releaseWorkflow, /github\/codeql-action\/init@v4/u);
  assert.match(releaseWorkflow, /github\/codeql-action\/analyze@v4/u);
  assert.equal(
    releaseWorkflow.match(/rustsec\/audit-check@v2\.0\.0/gu)?.length,
    2,
  );
  assert.equal(
    communityWorkflow.match(/rustsec\/audit-check@v2\.0\.0/gu)?.length,
    2,
  );
});
