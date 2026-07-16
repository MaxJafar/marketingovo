import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";
import {
  assertRegularFileInside,
  releasePlatform,
  sha256File,
} from "./release-policy.mjs";

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
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

async function regularExecutable(path) {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o111) === 0) {
    throw new Error(`Expected an executable regular file: ${path}`);
  }
  return path;
}

async function health() {
  try {
    const response = await fetch("http://127.0.0.1:3210/api/v1/health", {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function waitForHealth(expectedVersion) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const current = await health();
    if (current?.status === "ok" && current.version === expectedVersion) {
      return current;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(
    `Installed background service did not report version ${expectedVersion}`,
  );
}

async function waitForStopped() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if ((await health()) === null) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("Background service remained reachable after stop");
}

function processRows() {
  return run("ps", ["-axo", "pid=,ppid=,command="])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(?<pid>\d+)\s+(?<ppid>\d+)\s+(?<command>.+)$/u.exec(line);
      return match?.groups
        ? {
            pid: Number(match.groups.pid),
            ppid: Number(match.groups.ppid),
            command: match.groups.command,
          }
        : null;
    })
    .filter(Boolean);
}

function installedProcesses(layout) {
  return processRows().filter(
    (process) =>
      process.command.includes(layout.sidecar) &&
      process.command.includes(layout.cli),
  );
}

function launcherProcesses(layout) {
  return processRows().filter((process) =>
    process.command.includes(layout.launcher),
  );
}

function serviceDefinition(platform) {
  return platform === "macos"
    ? resolve(
        homedir(),
        "Library/LaunchAgents/com.golemworkers.golem-seo.plist",
      )
    : resolve(homedir(), ".config/systemd/user/golem-seo.service");
}

async function serviceLayout(runtimeRoot, sidecar) {
  const publicConfig = JSON.parse(
    await readFile(resolve(runtimeRoot, "config/public-runtime.json"), "utf8"),
  );
  if (
    publicConfig?.schemaVersion !== 1 ||
    typeof publicConfig.browserDirectory !== "string" ||
    typeof publicConfig.chromiumExecutable !== "string" ||
    typeof publicConfig.googleDesktopClientId !== "string" ||
    !publicConfig.googleDesktopClientId.endsWith(".apps.googleusercontent.com")
  ) {
    throw new Error(
      "Installed desktop public runtime configuration is invalid",
    );
  }
  const layout = {
    runtimeRoot,
    sidecar: await regularExecutable(sidecar),
    cli: resolve(runtimeRoot, "app/dist/cli.js"),
    broker: resolve(runtimeRoot, "broker/golem-seo-credential-broker"),
    browserDirectory: resolve(runtimeRoot, publicConfig.browserDirectory),
    chromiumExecutable: resolve(runtimeRoot, publicConfig.chromiumExecutable),
    googleDesktopClientId: publicConfig.googleDesktopClientId,
  };
  await Promise.all([
    access(layout.cli),
    regularExecutable(layout.broker),
    regularExecutable(layout.chromiumExecutable),
    stat(layout.browserDirectory),
  ]);
  return layout;
}

function cliArgs(layout, dataDirectory, command) {
  return [
    layout.cli,
    ...command,
    "--data-dir",
    dataDirectory,
    "--credential-broker",
    layout.broker,
    "--chromium-executable",
    layout.chromiumExecutable,
    "--browser-directory",
    layout.browserDirectory,
    "--google-desktop-client-id",
    layout.googleDesktopClientId,
  ];
}

async function startService(layout, dataDirectory, expectedVersion) {
  run(layout.sidecar, cliArgs(layout, dataDirectory, ["service", "install"]));
  const definition = serviceDefinition(platform);
  await access(definition);
  const serviceHealth = await waitForHealth(expectedVersion);
  const processes = installedProcesses(layout);
  if (processes.length < 1) {
    throw new Error(
      "Background service health exists without the installed packaged runtime process",
    );
  }
  run(layout.sidecar, [
    layout.cli,
    "service",
    "status",
    "--data-dir",
    dataDirectory,
  ]);
  return { serviceHealth, processes };
}

async function stopService(layout, dataDirectory) {
  run(layout.sidecar, [
    layout.cli,
    "service",
    "uninstall",
    "--data-dir",
    dataDirectory,
  ]);
  await waitForStopped();
  try {
    await access(serviceDefinition(platform));
    throw new Error("Background service definition remains after stop");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (installedProcesses(layout).length !== 0) {
    throw new Error("Packaged background process remains after service stop");
  }
}

function createCanary(layout, dataDirectory) {
  const response = JSON.parse(
    run(layout.sidecar, [
      layout.cli,
      "project",
      "create",
      "Native upgrade canary",
      "https://example.com",
      "--data-dir",
      dataDirectory,
    ]),
  );
  const project = response?.data ?? response;
  if (
    typeof project?.id !== "string" ||
    project.name !== "Native upgrade canary"
  ) {
    throw new Error("Could not create the pre-upgrade data canary");
  }
  return project.id;
}

function verifyCanary(layout, dataDirectory, projectId) {
  const response = JSON.parse(
    run(layout.sidecar, [
      layout.cli,
      "project",
      "list",
      "--data-dir",
      dataDirectory,
    ]),
  );
  const projects = response?.data ?? response;
  if (
    !Array.isArray(projects) ||
    !projects.some(
      (project) =>
        project.id === projectId && project.name === "Native upgrade canary",
    )
  ) {
    throw new Error("Project data did not survive the installer upgrade");
  }
}

async function findMacApplication(mountPoint) {
  const applications = (await readdir(mountPoint, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => resolve(mountPoint, entry.name));
  if (applications.length !== 1) {
    throw new Error(
      `Mounted DMG must contain exactly one application, found ${applications.length}`,
    );
  }
  return applications[0];
}

async function installMac(dmgPath, applicationPath, mountPoint) {
  await rm(mountPoint, { recursive: true, force: true });
  await mkdir(mountPoint, { recursive: true, mode: 0o700 });
  run("hdiutil", [
    "attach",
    "-nobrowse",
    "-readonly",
    "-mountpoint",
    mountPoint,
    dmgPath,
  ]);
  try {
    const source = await findMacApplication(mountPoint);
    run("sudo", ["ditto", source, applicationPath]);
  } finally {
    run("hdiutil", ["detach", mountPoint]);
  }
}

function verifyMacApplication(applicationPath) {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!teamId || !/^[A-Z0-9]{10}$/u.test(teamId)) {
    throw new Error("APPLE_TEAM_ID is required for lifecycle verification");
  }
  run("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    applicationPath,
  ]);
  const details = run("codesign", [
    "--display",
    "--verbose=4",
    applicationPath,
  ]);
  if (
    details.includes("Signature=adhoc") ||
    !details.includes(`TeamIdentifier=${teamId}`)
  ) {
    throw new Error("Installed macOS application signer does not match");
  }
  run("xcrun", ["stapler", "validate", applicationPath]);
  run("spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    applicationPath,
  ]);
}

async function macLayout(applicationPath) {
  const layout = await serviceLayout(
    resolve(applicationPath, "Contents/Resources/runtime"),
    resolve(applicationPath, "Contents/MacOS/golem-seo-node"),
  );
  const executableDirectory = resolve(applicationPath, "Contents/MacOS");
  const launchers = [];
  for (const entry of await readdir(executableDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || entry.name === "golem-seo-node") continue;
    const candidate = resolve(executableDirectory, entry.name);
    const metadata = await stat(candidate);
    if ((metadata.mode & 0o111) !== 0) launchers.push(candidate);
  }
  if (launchers.length !== 1) {
    throw new Error(
      `Installed macOS application must contain one desktop launcher, found ${launchers.length}`,
    );
  }
  return { ...layout, launcher: launchers[0] };
}

function linuxPackageName(debPath) {
  const name = run("dpkg-deb", ["-f", debPath, "Package"]).trim();
  if (!/^golem-seo(?:-desktop)?$/u.test(name)) {
    throw new Error(`Unexpected Linux package name: ${name}`);
  }
  return name;
}

function linuxPackageInstalled(packageName) {
  const result = spawnSync(
    "dpkg-query",
    ["-W", "-f=${db:Status-Status}", packageName],
    { encoding: "utf8" },
  );
  return result.status === 0 && result.stdout.trim() === "installed";
}

function installLinux(debPath) {
  run("sudo", ["dpkg", "--install", debPath]);
}

async function linuxLayout(packageName) {
  const files = run("dpkg-query", ["-L", packageName])
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean);
  const configFiles = files.filter((path) =>
    path.endsWith("/runtime/config/public-runtime.json"),
  );
  const sidecars = files.filter((path) => basename(path) === "golem-seo-node");
  const launchers = files.filter(
    (path) => basename(path) === "golem-seo-desktop",
  );
  if (
    configFiles.length !== 1 ||
    sidecars.length !== 1 ||
    launchers.length !== 1
  ) {
    throw new Error(
      "Installed Linux package does not contain one launcher and product-scoped runtime",
    );
  }
  return {
    ...(await serviceLayout(
      resolve(configFiles[0], "../.."),
      resolve(sidecars[0]),
    )),
    launcher: await regularExecutable(resolve(launchers[0])),
  };
}

async function stopProcessGroup(child) {
  if (child.exitCode !== null || !Number.isInteger(child.pid)) return;
  process.kill(-child.pid, "SIGTERM");
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolveWait) => setTimeout(() => resolveWait(true), 15_000)),
  ]);
  if (timedOut && child.exitCode === null) {
    process.kill(-child.pid, "SIGKILL");
    await exited;
  }
}

function spawnDesktop(layout, arguments_, detached) {
  const command = platform === "linux" ? "xvfb-run" : layout.launcher;
  const args =
    platform === "linux" ? ["-a", layout.launcher, ...arguments_] : arguments_;
  return spawn(command, args, {
    env: process.env,
    detached,
    stdio: "ignore",
  });
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      rejectExit(
        new Error("Desktop activation did not exit within the timeout"),
      );
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

async function verifySingleInstanceActivation(layout) {
  const primary = spawnDesktop(layout, ["--background", "--no-update"], true);
  try {
    await new Promise((resolveSpawn, rejectSpawn) => {
      primary.once("spawn", resolveSpawn);
      primary.once("error", rejectSpawn);
    });
    const primaryDeadline = Date.now() + 30_000;
    let before = [];
    while (Date.now() < primaryDeadline) {
      before = launcherProcesses(layout);
      if (primary.exitCode === null && before.length >= 1) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
    if (primary.exitCode !== null || before.length < 1) {
      throw new Error(
        "The installed desktop launcher did not remain alive in background mode",
      );
    }

    const beforeIds = new Set(before.map(({ pid }) => pid));
    const secondary = spawnDesktop(layout, ["--no-update"], false);
    const secondaryExit = await waitForChildExit(secondary, 20_000);
    if (secondaryExit.code !== 0 || secondaryExit.signal !== null) {
      throw new Error(
        `Single-instance activation exited abnormally: ${secondaryExit.code ?? secondaryExit.signal}`,
      );
    }

    const handoffDeadline = Date.now() + 30_000;
    while (Date.now() < handoffDeadline) {
      const after = launcherProcesses(layout);
      const sameOwners =
        after.length === before.length &&
        after.every(({ pid }) => beforeIds.has(pid));
      if (sameOwners && primary.exitCode === null && (await health())) {
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
    throw new Error(
      "A second desktop launch created a competing process instead of activating the existing launcher",
    );
  } finally {
    await stopProcessGroup(primary);
    if ((await health()) === null) {
      throw new Error(
        "Stopping the desktop activation owner also stopped the independently installed background service",
      );
    }
  }
}

async function verifyAppImage(appImagePath, currentVersion, temporaryRoot) {
  await regularExecutable(appImagePath);
  const appImageHome = resolve(temporaryRoot, "appimage-home");
  await mkdir(appImageHome, { recursive: true, mode: 0o700 });
  const child = spawn("xvfb-run", ["-a", appImagePath, "--background"], {
    env: {
      ...process.env,
      HOME: appImageHome,
      XDG_CACHE_HOME: resolve(appImageHome, ".cache"),
      XDG_CONFIG_HOME: resolve(appImageHome, ".config"),
      XDG_DATA_HOME: resolve(appImageHome, ".local/share"),
      APPIMAGE_EXTRACT_AND_RUN: "1",
    },
    detached: true,
    stdio: "ignore",
  });
  try {
    await new Promise((resolveSpawn, rejectSpawn) => {
      child.once("spawn", resolveSpawn);
      child.once("error", rejectSpawn);
    });
    const appImageHealth = await waitForHealth(currentVersion);
    if (child.exitCode !== null) {
      throw new Error("AppImage launcher exited before lifecycle verification");
    }
    return appImageHealth;
  } finally {
    await stopProcessGroup(child);
    await waitForStopped();
  }
}

const target = flag("--target");
const installerFlag = flag("--installer");
const baselineFlag = flag("--baseline");
const evidenceFlag = flag("--evidence");
const appImageFlag = flag("--appimage");
if (!target || !installerFlag || !baselineFlag || !evidenceFlag) {
  throw new Error(
    "usage: node scripts/verify-unix-installer-lifecycle.mjs --target TARGET --installer FILE --baseline FILE --evidence FILE [--appimage FILE]",
  );
}
const platform = releasePlatform(target);
if (!["macos", "linux"].includes(platform)) {
  throw new Error(`Unsupported Unix lifecycle target: ${target}`);
}
const expectedRunner = platform === "macos" ? "macOS" : "Linux";
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_OS !== expectedRunner
) {
  throw new Error(
    "The destructive Unix installer lifecycle gate may run only on its matching ephemeral GitHub-hosted runner",
  );
}

const root = resolve(import.meta.dirname, "..");
const packageManifest = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const currentVersion = packageManifest.version;
const currentInstaller = resolve(root, installerFlag);
const evidencePath = resolve(root, evidenceFlag);
const baselinePath = resolve(root, baselineFlag);
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
if (
  baseline?.schemaVersion !== 1 ||
  baseline.target !== target ||
  baseline.currentVersion !== currentVersion ||
  typeof baseline.available !== "boolean"
) {
  throw new Error(
    "Upgrade baseline metadata is malformed or for another target",
  );
}
const currentSuffix = platform === "macos" ? ".dmg" : ".deb";
if (!currentInstaller.endsWith(currentSuffix)) {
  throw new Error(`Lifecycle installer must be a ${currentSuffix} file`);
}
await access(currentInstaller);
const currentInstallerSha256 = await sha256File(currentInstaller);

let baselineInstaller = null;
if (baseline.available) {
  baselineInstaller = await assertRegularFileInside(
    root,
    baseline.installerPath,
  );
  if (
    (await sha256File(baselineInstaller)) !== baseline.installerSha256 ||
    !baselineInstaller.endsWith(currentSuffix)
  ) {
    throw new Error("Upgrade baseline installer does not match its metadata");
  }
}

const runnerTemporaryValue = process.env.RUNNER_TEMP?.trim();
if (!runnerTemporaryValue) {
  throw new Error(
    "RUNNER_TEMP is required for destructive lifecycle isolation",
  );
}
const runnerTemporary = resolve(runnerTemporaryValue);
const temporaryRoot = resolve(
  runnerTemporary,
  `golem-seo-native-lifecycle-${target}`,
);
if (relative(runnerTemporary, temporaryRoot).startsWith(`..${sep}`)) {
  throw new Error("Unsafe lifecycle temporary directory");
}
await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(temporaryRoot, { recursive: true, mode: 0o700 });
const dataDirectory = resolve(temporaryRoot, "data");
const definition = serviceDefinition(platform);
if ((await health()) !== null) {
  throw new Error("Golem SEO port is already occupied on the ephemeral runner");
}
try {
  await access(definition);
  throw new Error(
    "A Golem SEO background service already exists on the runner",
  );
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

let installed = false;
let packageName = null;
let layout = null;
let initialHealth = null;
let currentHealth = null;
let processCount = 0;
let canaryProjectId = null;
let appImageHealth = null;
const applicationPath = "/Applications/Golem SEO.app";
const mountPoint = resolve(temporaryRoot, "mounted-dmg");

try {
  if (platform === "macos") {
    try {
      await access(applicationPath);
      throw new Error("Golem SEO is already installed on the ephemeral runner");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await installMac(
      baselineInstaller ?? currentInstaller,
      applicationPath,
      mountPoint,
    );
    installed = true;
    verifyMacApplication(applicationPath);
    layout = await macLayout(applicationPath);
  } else {
    packageName = linuxPackageName(baselineInstaller ?? currentInstaller);
    if (linuxPackageInstalled(packageName)) {
      throw new Error("Golem SEO package is already installed on the runner");
    }
    installLinux(baselineInstaller ?? currentInstaller);
    installed = true;
    layout = await linuxLayout(packageName);
  }

  const initialVersion = baseline.available ? baseline.version : currentVersion;
  const initial = await startService(layout, dataDirectory, initialVersion);
  initialHealth = initial.serviceHealth;
  processCount = initial.processes.length;
  canaryProjectId = createCanary(layout, dataDirectory);

  if (baseline.available) {
    await stopService(layout, dataDirectory);
    if (platform === "macos") {
      run("sudo", ["/bin/rm", "-rf", applicationPath]);
      installed = false;
      await installMac(currentInstaller, applicationPath, mountPoint);
      installed = true;
      verifyMacApplication(applicationPath);
      layout = await macLayout(applicationPath);
    } else {
      const currentPackageName = linuxPackageName(currentInstaller);
      if (currentPackageName !== packageName) {
        throw new Error("Linux upgrade changed the package identity");
      }
      installLinux(currentInstaller);
      layout = await linuxLayout(packageName);
    }
    const upgraded = await startService(layout, dataDirectory, currentVersion);
    currentHealth = upgraded.serviceHealth;
    processCount = Math.max(processCount, upgraded.processes.length);
    verifyCanary(layout, dataDirectory, canaryProjectId);
  } else {
    currentHealth = initialHealth;
  }

  await verifySingleInstanceActivation(layout);

  await stopService(layout, dataDirectory);
  if (platform === "macos") {
    run("sudo", ["/bin/rm", "-rf", applicationPath]);
    installed = false;
    try {
      await access(applicationPath);
      throw new Error("macOS application remains after uninstall");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  } else {
    run("sudo", ["dpkg", "--purge", packageName]);
    installed = false;
    if (linuxPackageInstalled(packageName)) {
      throw new Error("Linux package remains installed after purge");
    }
    if (!appImageFlag) {
      throw new Error("Linux lifecycle requires the matching AppImage");
    }
    const appImagePath = resolve(root, appImageFlag);
    appImageHealth = await verifyAppImage(
      appImagePath,
      currentVersion,
      temporaryRoot,
    );
  }

  if ((await health()) !== null) {
    throw new Error("Background service remains reachable after uninstall");
  }
  await access(resolve(dataDirectory, "golem-seo.db"));

  const evidence = {
    schemaVersion: 2,
    target,
    platform,
    version: currentVersion,
    verifiedAt: new Date().toISOString(),
    installerSha256: currentInstallerSha256,
    install: "verified",
    backgroundStartup: platform === "macos" ? "launchd" : "systemd-user",
    backgroundHealth: initialHealth,
    installedProcessCount: processCount,
    processOwnership: "verified",
    singleInstanceActivation: "verified",
    stop: "verified",
    upgrade: baseline.available ? "verified" : "not-tested-prerelease",
    baselineVersion: baseline.available ? baseline.version : null,
    baselineInstallerSha256: baseline.available
      ? baseline.installerSha256
      : null,
    healthAfterUpgrade: baseline.available ? currentHealth : null,
    versionAfterUpgrade: baseline.available ? currentHealth.version : null,
    dataSurvivedUpgrade: baseline.available ? "verified" : "not-applicable",
    uninstall: "verified",
    serviceDefinitionAfterUninstall: "removed",
    backgroundServiceAfterUninstall: "stopped",
    installedPackageAfterUninstall: "removed",
    userDataAfterUninstall: "retained",
    appImage:
      platform === "linux"
        ? {
            sha256: await sha256File(resolve(root, appImageFlag)),
            backgroundHealth: appImageHealth,
            stop: "verified",
          }
        : null,
  };
  await mkdir(dirname(evidencePath), { recursive: true, mode: 0o755 });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o644,
  });
  JSON.parse(await readFile(evidencePath, "utf8"));
  process.stdout.write(
    `Verified ${platform} install, background service, stop, ${baseline.available ? "upgrade, " : ""}uninstall${platform === "linux" ? ", and AppImage" : ""} lifecycle.\n`,
  );
} finally {
  if (layout && (await health()) !== null) {
    try {
      await stopService(layout, dataDirectory);
    } catch (error) {
      process.stderr.write(`Lifecycle cleanup warning: ${error.message}\n`);
    }
  }
  if (installed) {
    try {
      if (platform === "macos") {
        run("sudo", ["/bin/rm", "-rf", applicationPath]);
      } else if (packageName) {
        run("sudo", ["dpkg", "--purge", packageName]);
      }
    } catch (error) {
      process.stderr.write(`Installer cleanup warning: ${error.message}\n`);
    }
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
