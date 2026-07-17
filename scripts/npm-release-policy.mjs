import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const NPM_RELEASE_SCHEMA_VERSION = 1;
export const NPM_REGISTRY = "https://registry.npmjs.org/";
export const NPM_PUBLICATION_ENABLED = false;

// Repository/domain ownership and public release are separate human gates.
// Keep this legacy coordinate only for validating old release artifacts; it is
// not AGENTseo product identity and must not authorize publication.
export const SOURCE_REPOSITORY = "GolemWorkers/golem-seo";

export const PRIVATE_PACKABLE_WORKSPACE_DIRECTORIES = Object.freeze([
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

export const PRIVATE_WORKSPACE_IDENTITIES = Object.freeze({
  "adapters/openclaw": "@agentseoapp/openclaw",
  "apps/dashboard": "@agentseoapp/dashboard",
  "apps/desktop": "@agentseoapp/desktop",
  "apps/docs": "@agentseoapp/docs",
  "packages/application": "@agentseoapp/application",
  "packages/cli": "agentseo",
  "packages/contracts": "@agentseoapp/contracts",
  "packages/core": "@agentseoapp/core",
  "packages/credentials": "@agentseoapp/credentials",
  "packages/integrations": "@agentseoapp/integrations",
  "packages/legacy-import": "@agentseoapp/legacy-import",
  "packages/mcp": "@agentseoapp/mcp",
  "packages/runtime": "@agentseoapp/runtime",
  "packages/sdk": "@agentseoapp/sdk",
  "packages/server": "@agentseoapp/server",
  "packages/storage-sqlite": "@agentseoapp/storage-sqlite",
  "plugins/codex/agentseo": "@agentseoapp/codex-plugin",
  "plugins/codex/golem-seo": "@agentseoapp/codex-plugin-legacy",
});

const DEPENDENCY_FIELDS = Object.freeze([
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
]);
const FORBIDDEN_PACKAGE_PREFIXES = Object.freeze([
  "@golem-seo/",
  "@agent-seo/",
  "@agentseo/",
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertReleaseVersion(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u.test(version)
  ) {
    throw new Error(`Invalid workspace version: ${String(version)}`);
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
    throw new Error("Private workspace package names must be unique");
  }
  const packageNames = new Set(byName.keys());
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  const visit = (item) => {
    const name = item.manifest.name;
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Private package dependency cycle includes ${name}`);
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

function validatePrivateManifest(item, version, workspaceNames) {
  const { directory, manifest } = item;
  const expectedName = PRIVATE_WORKSPACE_IDENTITIES[directory];
  if (manifest.name !== expectedName) {
    throw new Error(
      `${directory} must use the frozen private identity ${expectedName}`,
    );
  }
  if (manifest.version !== version) {
    throw new Error(
      `${manifest.name} version ${manifest.version} does not match ${version}`,
    );
  }
  if (manifest.private !== true) {
    throw new Error(`${manifest.name} must remain private for this milestone`);
  }
  if (Object.hasOwn(manifest, "publishConfig")) {
    throw new Error(
      `${manifest.name} must not declare public publication metadata`,
    );
  }
  const publicationGuard = directory.startsWith("plugins/")
    ? "node ../../../scripts/npm-publication-disabled.mjs direct-package-publish"
    : "node ../../scripts/npm-publication-disabled.mjs direct-package-publish";
  if (manifest.scripts?.prepublishOnly !== publicationGuard) {
    throw new Error(
      `${manifest.name} must retain the fail-closed direct publication guard`,
    );
  }
  for (const field of DEPENDENCY_FIELDS) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (
        FORBIDDEN_PACKAGE_PREFIXES.some((prefix) =>
          dependency.startsWith(prefix),
        )
      ) {
        throw new Error(
          `${manifest.name} uses forbidden package identity ${dependency}`,
        );
      }
      if (workspaceNames.has(dependency) && range !== "workspace:*") {
        throw new Error(
          `${manifest.name} must resolve private workspace dependency ${dependency} with workspace:*`,
        );
      }
    }
  }
}

export async function readNpmReleaseWorkspace(root) {
  const rootManifest = await readJson(resolve(root, "package.json"));
  const version = assertReleaseVersion(rootManifest.version);
  if (rootManifest.private !== true) {
    throw new Error("The AGENTseo workspace root must remain private");
  }
  if (
    rootManifest.scripts?.prepublishOnly !==
    "node scripts/npm-publication-disabled.mjs direct-package-publish"
  ) {
    throw new Error("The workspace root must retain the publication guard");
  }

  const versioned = await Promise.all(
    Object.keys(PRIVATE_WORKSPACE_IDENTITIES).map(async (directory) => ({
      directory,
      manifest: await readJson(resolve(root, directory, "package.json")),
    })),
  );
  const workspaceNames = new Set(Object.values(PRIVATE_WORKSPACE_IDENTITIES));
  if (workspaceNames.size !== versioned.length) {
    throw new Error("Frozen private workspace identities must be unique");
  }
  for (const item of versioned) {
    validatePrivateManifest(item, version, workspaceNames);
  }

  const packable = versioned.filter(({ directory }) =>
    PRIVATE_PACKABLE_WORKSPACE_DIRECTORIES.includes(directory),
  );
  return {
    version,
    packages: sortPackagesTopologically(packable),
    versioned,
  };
}

export function assertNpmPublicationDisabled(operation = "npm publication") {
  if (NPM_PUBLICATION_ENABLED !== false) {
    throw new Error("The npm publication gate is not fail-closed");
  }
  throw new Error(
    `${operation} is disabled for the independence-migration milestone; package ownership and public release require explicit human approval`,
  );
}

// Retained only so old artifact verification remains deterministic. Neither
// helper authorizes preparation or publication while the gate above is closed.
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
    packedManifest.private !== true ||
    Object.hasOwn(packedManifest, "publishConfig")
  ) {
    throw new Error(
      `Packed metadata does not preserve the private identity of ${sourcePackage.manifest.name}@${releaseVersion}`,
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
    throw new Error(
      "npm artifact manifest is malformed or for another version",
    );
  }
  const expectedNames = workspace.packages.map(
    ({ manifest: item }) => item.name,
  );
  const actualNames = manifest.packages.map((item) => item.name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error("npm artifact manifest package order is not topological");
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
      throw new Error(`Invalid npm artifact entry for ${String(item.name)}`);
    }
  }
  return manifest;
}
