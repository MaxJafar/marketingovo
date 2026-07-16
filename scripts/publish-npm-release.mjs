import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  NPM_REGISTRY,
  SOURCE_REPOSITORY,
  assertNpmPublicationDisabled,
  assertSourceTag,
  readNpmReleaseWorkspace,
  tarballHashes,
  validateNpmReleaseManifest,
} from "./npm-release-policy.mjs";

assertNpmPublicationDisabled("direct npm publication");

const root = resolve(import.meta.dirname, "..");
const releaseRoot = resolve(root, "artifacts/npm-release");
const workspace = await readNpmReleaseWorkspace(root);
const sourceTag = process.env.GITHUB_REF_NAME;
assertSourceTag(sourceTag, workspace.version);
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_OS !== "Linux" ||
  process.env.GITHUB_REF_TYPE !== "tag" ||
  process.env.GITHUB_REPOSITORY !== SOURCE_REPOSITORY ||
  !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
  !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
) {
  throw new Error(
    "npm publication is allowed only from the canonical tag workflow on a GitHub-hosted Linux runner with OIDC enabled",
  );
}

const manifestPath = resolve(releaseRoot, "npm-release-manifest.json");
const manifest = validateNpmReleaseManifest(
  JSON.parse(await readFile(manifestPath, "utf8")),
  workspace,
);

function npm(args, { allowMissing = false } = {}) {
  const result = spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (
    allowMissing &&
    result.status !== 0 &&
    /(?:E404|404 Not Found)/u.test(output)
  ) {
    return null;
  }
  if (result.error || result.status !== 0) {
    throw new Error(
      `npm ${args.join(" ")} failed${output ? `:\n${output}` : ""}`,
      { cause: result.error },
    );
  }
  return (result.stdout ?? "").trim();
}

const npmVersion = npm(["--version"]);
const [npmMajor = 0, npmMinor = 0] = npmVersion
  .split(".")
  .slice(0, 2)
  .map(Number);
if (npmMajor < 11 || (npmMajor === 11 && npmMinor < 5)) {
  throw new Error(
    `npm 11.5.1 or newer is required for OIDC; found ${npmVersion}`,
  );
}

function registryJson(coordinate, field, options = {}) {
  const output = npm(
    ["view", coordinate, field, "--json", "--registry", NPM_REGISTRY],
    options,
  );
  if (output === null || output === "") return null;
  return JSON.parse(output);
}

const published = [];
for (const item of manifest.packages) {
  const tarballPath = resolve(releaseRoot, item.tarball);
  const hashes = await tarballHashes(tarballPath);
  if (hashes.sha256 !== item.sha256 || hashes.integrity !== item.integrity) {
    throw new Error(`${item.tarball} changed after npm release preparation`);
  }
  const coordinate = `${item.name}@${item.version}`;
  let registryIntegrity = registryJson(coordinate, "dist.integrity", {
    allowMissing: true,
  });
  let status = "already-present";
  if (registryIntegrity === null) {
    npm([
      "publish",
      tarballPath,
      "--access",
      "public",
      "--tag",
      manifest.npmTag,
      "--provenance",
      "--ignore-scripts",
      "--registry",
      NPM_REGISTRY,
    ]);
    status = "published";
    registryIntegrity = registryJson(coordinate, "dist.integrity");
  }
  if (registryIntegrity !== item.integrity) {
    throw new Error(
      `${coordinate} registry integrity does not match the prepared tarball`,
    );
  }
  const attestations = registryJson(coordinate, "dist.attestations");
  if (
    !attestations ||
    typeof attestations !== "object" ||
    Object.keys(attestations).length === 0
  ) {
    throw new Error(`${coordinate} has no npm registry provenance attestation`);
  }
  published.push({
    name: item.name,
    version: item.version,
    status,
    integrity: registryIntegrity,
    provenance: "registry-attestation-present",
  });
}

const evidencePath = resolve(releaseRoot, "npm-publication.json");
await writeFile(
  evidencePath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      sourceTag,
      version: workspace.version,
      npmTag: manifest.npmTag,
      registry: NPM_REGISTRY,
      publishedAt: new Date().toISOString(),
      authentication: "github-actions-oidc",
      packages: published,
    },
    null,
    2,
  )}\n`,
  { mode: 0o644 },
);
JSON.parse(await readFile(evidencePath, "utf8"));
process.stdout.write(
  `Verified npm publication and provenance for ${published.length} packages.\n`,
);
