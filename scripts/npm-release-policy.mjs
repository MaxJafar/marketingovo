import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { CANONICAL_RELEASE_REPOSITORY } from "./release-policy.mjs";

export const NPM_RELEASE_SCHEMA_VERSION = 1;
export const NPM_REGISTRY = "https://registry.npmjs.org/";
export const SOURCE_REPOSITORY = CANONICAL_RELEASE_REPOSITORY;
export const SOURCE_REPOSITORY_URL = `https://github.com/${SOURCE_REPOSITORY}.git`;

export const PUBLISHABLE_WORKSPACE_DIRECTORIES = Object.freeze([
  "packages/contracts",
  "packages/application",
  "packages/storage-sqlite",
  "packages/credentials",
  "packages/integrations",
  "packages/core",
  "packages/legacy-import",
  "packages/runtime",
  "packages/sdk",
  "packages/server",
  "packages/cli",
  "packages/mcp",
  "adapters/openclaw",
]);

const PRIVATE_VERSIONED_WORKSPACE_DIRECTORIES = Object.freeze([
  "apps/dashboard",
  "apps/desktop",
  "apps/docs",
  "plugins/codex/golem-seo",
]);
const DEPENDENCY_FIELDS = Object.freeze([
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertReleaseVersion(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u.test(version)
  ) {
    throw new Error(`Invalid release version: ${String(version)}`);
  }
  return version;
}

function localDependencyNames(manifest, packageNames) {
  const names = new Set();
  for (const field of DEPENDENCY_FIELDS) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      if (packageNames.has(dependency)) names.add(dependency);
    }
  }
  return [...names].sort();
}

export function sortPackagesTopologically(packages) {
  const byName = new Map(packages.map((item) => [item.manifest.name, item]));
  if (byName.size !== packages.length) {
    throw new Error("Publishable package names must be unique");
  }
  const packageNames = new Set(byName.keys());
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  const visit = (item) => {
    const name = item.manifest.name;
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Publishable package dependency cycle includes ${name}`);
    }
    visiting.add(name);
    for (const dependency of localDependencyNames(
      item.manifest,
      packageNames,
    )) {
      visit(byName.get(dependency));
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(item);
  };

  for (const item of [...packages].sort((left, right) =>
    left.manifest.name.localeCompare(right.manifest.name),
  )) {
    visit(item);
  }
  return ordered;
}

function validatePublishableManifest(item, releaseVersion, packageNames) {
  const { directory, manifest } = item;
  if (
    typeof manifest.name !== "string" ||
    !manifest.name.startsWith("@golem-seo/") ||
    manifest.private === true
  ) {
    throw new Error(`${directory} is not a public @golem-seo package`);
  }
  if (manifest.version !== releaseVersion) {
    throw new Error(
      `${manifest.name} version ${manifest.version} does not match ${releaseVersion}`,
    );
  }
  if (manifest.license !== "Elastic-2.0") {
    throw new Error(`${manifest.name} must declare Elastic-2.0`);
  }
  if (
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig?.registry !== NPM_REGISTRY ||
    manifest.publishConfig?.provenance !== true
  ) {
    throw new Error(
      `${manifest.name} must fail closed on public npm provenance publication`,
    );
  }
  if (
    manifest.repository?.url !== SOURCE_REPOSITORY_URL ||
    manifest.repository?.directory !== directory
  ) {
    throw new Error(
      `${manifest.name} repository metadata must point to its canonical workspace`,
    );
  }
  if (manifest.homepage !== "https://golemworkers.com/seo") {
    throw new Error(`${manifest.name} has an unexpected homepage`);
  }
  if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
    throw new Error(`${manifest.name} must publish a built dist directory`);
  }
  for (const notice of ["LICENSE", "NOTICE"]) {
    if (!manifest.files.includes(notice)) {
      throw new Error(`${manifest.name} does not publish ${notice}`);
    }
  }
  for (const field of DEPENDENCY_FIELDS) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      if (
        dependency.startsWith("@golem-seo/") &&
        !packageNames.has(dependency)
      ) {
        throw new Error(
          `${manifest.name} has an unpublished runtime dependency on ${dependency}`,
        );
      }
    }
  }
}

function cargoPackageVersion(source, packageName) {
  const packageBlock = source.match(/\[package\]([\s\S]*?)(?:\n\[|$)/u)?.[1];
  const name = packageBlock?.match(/^name\s*=\s*"([^"]+)"\s*$/mu)?.[1];
  const version = packageBlock?.match(/^version\s*=\s*"([^"]+)"\s*$/mu)?.[1];
  if (name !== packageName || !version) {
    throw new Error(`Could not read ${packageName} version from Cargo.toml`);
  }
  return version;
}

export async function readNpmReleaseWorkspace(root) {
  const rootManifest = await readJson(resolve(root, "package.json"));
  const version = assertReleaseVersion(rootManifest.version);
  const versionedDirectories = [
    ...PUBLISHABLE_WORKSPACE_DIRECTORIES,
    ...PRIVATE_VERSIONED_WORKSPACE_DIRECTORIES,
  ];
  const versioned = await Promise.all(
    versionedDirectories.map(async (directory) => ({
      directory,
      manifest: await readJson(resolve(root, directory, "package.json")),
    })),
  );
  for (const item of versioned) {
    if (item.manifest.version !== version) {
      throw new Error(
        `${item.directory} version ${item.manifest.version} does not match ${version}`,
      );
    }
  }

  const tauri = await readJson(
    resolve(root, "apps/desktop/src-tauri/tauri.conf.json"),
  );
  if (tauri.version !== version) {
    throw new Error(
      `Tauri version ${tauri.version} does not match workspace ${version}`,
    );
  }
  for (const [path, packageName] of [
    ["apps/desktop/src-tauri/Cargo.toml", "golem-seo-desktop"],
    [
      "packages/credential-broker-native/Cargo.toml",
      "golem-seo-credential-broker",
    ],
  ]) {
    const cargoVersion = cargoPackageVersion(
      await readFile(resolve(root, path), "utf8"),
      packageName,
    );
    if (cargoVersion !== version) {
      throw new Error(
        `${packageName} version ${cargoVersion} does not match workspace ${version}`,
      );
    }
  }

  const publishable = versioned.filter(({ directory }) =>
    PUBLISHABLE_WORKSPACE_DIRECTORIES.includes(directory),
  );
  const packageNames = new Set(
    publishable.map(({ manifest }) => manifest.name),
  );
  for (const item of publishable) {
    validatePublishableManifest(item, version, packageNames);
  }
  return {
    version,
    packages: sortPackagesTopologically(publishable),
  };
}

export function npmDistributionTag(version) {
  assertReleaseVersion(version);
  return version.includes("-") ? "next" : "latest";
}

export function assertSourceTag(sourceTag, version) {
  if (sourceTag !== `v${version}`) {
    throw new Error(
      `Release tag ${String(sourceTag)} does not match workspace version v${version}`,
    );
  }
}

export function validatePackedManifest(
  packedManifest,
  sourcePackage,
  releaseVersion,
  packageNames,
) {
  if (
    packedManifest.name !== sourcePackage.manifest.name ||
    packedManifest.version !== releaseVersion ||
    packedManifest.private === true
  ) {
    throw new Error(
      `Packed metadata does not match ${sourcePackage.manifest.name}@${releaseVersion}`,
    );
  }
  const serialized = JSON.stringify(packedManifest);
  if (serialized.includes("workspace:")) {
    throw new Error(
      `${packedManifest.name} tarball still contains a workspace protocol`,
    );
  }
  for (const field of DEPENDENCY_FIELDS) {
    for (const [dependency, range] of Object.entries(
      packedManifest[field] ?? {},
    )) {
      if (packageNames.has(dependency) && range !== releaseVersion) {
        throw new Error(
          `${packedManifest.name} must pin ${dependency} to ${releaseVersion} in the tarball`,
        );
      }
    }
  }
  return packedManifest;
}

export async function tarballHashes(path) {
  const bytes = await readFile(path);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  };
}

export function validateNpmReleaseManifest(manifest, workspace) {
  if (
    manifest?.schemaVersion !== NPM_RELEASE_SCHEMA_VERSION ||
    manifest.version !== workspace.version ||
    manifest.sourceTag !== `v${workspace.version}` ||
    manifest.npmTag !== npmDistributionTag(workspace.version) ||
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== workspace.packages.length
  ) {
    throw new Error("npm release manifest is malformed or for another version");
  }
  const expectedNames = workspace.packages.map(
    ({ manifest: item }) => item.name,
  );
  const actualNames = manifest.packages.map((item) => item.name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error("npm release manifest package order is not topological");
  }
  for (const item of manifest.packages) {
    if (
      item.version !== workspace.version ||
      basename(item.tarball) !== item.tarball ||
      !item.tarball.endsWith(".tgz") ||
      !/^[a-f0-9]{64}$/u.test(item.sha256) ||
      typeof item.integrity !== "string" ||
      !item.integrity.startsWith("sha512-")
    ) {
      throw new Error(`Invalid npm release entry for ${String(item.name)}`);
    }
  }
  return manifest;
}
