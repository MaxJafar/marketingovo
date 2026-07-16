import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { releaseAssetName, sha256File } from "./release-policy.mjs";
import {
  selectUpgradeBaseline,
  stableRelease,
} from "./upgrade-baseline-policy.mjs";

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
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

const target = flag("--target");
const currentTag = flag("--current-tag");
const outputFlag = flag("--output");
if (!target || !/^[a-z0-9_-]+$/iu.test(target) || !currentTag || !outputFlag) {
  throw new Error(
    "usage: node scripts/prepare-upgrade-baseline.mjs --target TARGET --current-tag TAG --output FILE",
  );
}

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, outputFlag);
const rootManifest = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const currentVersion = rootManifest.version;
if (currentTag !== `v${currentVersion}`) {
  throw new Error(
    `Current source version ${currentVersion} does not match ${currentTag}`,
  );
}

const baselineTag = process.env.GOLEMSEO_UPGRADE_BASELINE_TAG?.trim();
if (!baselineTag) {
  if (stableRelease(currentVersion)) {
    throw new Error(
      "GOLEMSEO_UPGRADE_BASELINE_TAG is required for a stable native release",
    );
  }
  await mkdir(resolve(output, ".."), { recursive: true, mode: 0o755 });
  await writeFile(
    output,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        available: false,
        target,
        currentVersion,
        reason: "not-configured-for-prerelease",
      },
      null,
      2,
    )}\n`,
    { mode: 0o644 },
  );
  process.stdout.write(
    `No upgrade baseline configured for prerelease ${currentVersion}.\n`,
  );
  process.exit(0);
}

const repository = process.env.GITHUB_REPOSITORY?.trim();
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
  throw new Error("GITHUB_REPOSITORY is required to resolve upgrade evidence");
}
const release = JSON.parse(
  run("gh", [
    "release",
    "view",
    baselineTag,
    "--repo",
    repository,
    "--json",
    "isDraft,tagName",
  ]),
);
if (release.isDraft || release.tagName !== baselineTag) {
  throw new Error("Upgrade baseline must be a published release");
}

const baselineDirectory = resolve(
  root,
  "artifacts",
  "upgrade-baselines",
  target,
);
await rm(baselineDirectory, { recursive: true, force: true });
await mkdir(baselineDirectory, { recursive: true, mode: 0o755 });
const verificationName = `release-verification-${target}.json`;
run("gh", [
  "release",
  "download",
  baselineTag,
  "--repo",
  repository,
  "--dir",
  baselineDirectory,
  "--pattern",
  verificationName,
]);
const verificationPath = resolve(baselineDirectory, verificationName);
const verification = JSON.parse(await readFile(verificationPath, "utf8"));
const selected = selectUpgradeBaseline(verification, {
  target,
  currentVersion,
  baselineTag,
});

const names = [releaseAssetName(target, selected.installer.path)];
if (selected.signature) {
  names.push(releaseAssetName(target, selected.signature.path));
}
for (const name of names) {
  run("gh", [
    "release",
    "download",
    baselineTag,
    "--repo",
    repository,
    "--dir",
    baselineDirectory,
    "--pattern",
    name,
  ]);
}
const installerPath = resolve(
  baselineDirectory,
  releaseAssetName(target, selected.installer.path),
);
if ((await sha256File(installerPath)) !== selected.installer.sha256) {
  throw new Error("Downloaded upgrade baseline installer hash does not match");
}

let signaturePath = null;
if (selected.signature) {
  signaturePath = resolve(
    baselineDirectory,
    releaseAssetName(target, selected.signature.path),
  );
  if ((await sha256File(signaturePath)) !== selected.signature.sha256) {
    throw new Error(
      "Downloaded upgrade baseline signature hash does not match",
    );
  }
  const updaterPublicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
  if (!updaterPublicKey || updaterPublicKey.length < 32) {
    throw new Error(
      "TAURI_UPDATER_PUBLIC_KEY is required to verify the upgrade baseline",
    );
  }
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
      installerPath,
      signaturePath,
    ],
    {
      env: {
        ...process.env,
        GOLEMSEO_TAURI_UPDATER_PUBLIC_KEY: updaterPublicKey,
      },
    },
  );
}

const portablePath = (path) => relative(root, path).split(sep).join("/");
const evidence = {
  schemaVersion: 1,
  available: true,
  target,
  currentVersion,
  tag: selected.tag,
  version: selected.version,
  installerPath: portablePath(installerPath),
  installerSha256: selected.installer.sha256,
  signaturePath: signaturePath ? portablePath(signaturePath) : null,
  signatureSha256: selected.signature?.sha256 ?? null,
  verificationRecordSha256: await sha256File(verificationPath),
};
await mkdir(resolve(output, ".."), { recursive: true, mode: 0o755 });
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, {
  mode: 0o644,
});
JSON.parse(await readFile(output, "utf8"));
process.stdout.write(
  `Prepared verified ${selected.version} upgrade baseline for ${target}.\n`,
);
