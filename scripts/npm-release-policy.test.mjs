import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertSourceTag,
  npmDistributionTag,
  readNpmReleaseWorkspace,
  validateNpmReleaseManifest,
  validatePackedManifest,
} from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");

test("the publishable workspace is version-locked and topologically ordered", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  assert.match(workspace.version, /^\d+\.\d+\.\d+(?:-.+)?$/u);
  assert.equal(workspace.packages.length, 13);
  const positions = new Map(
    workspace.packages.map(({ manifest }, index) => [manifest.name, index]),
  );
  for (const { manifest } of workspace.packages) {
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (!positions.has(dependency)) continue;
        assert.ok(
          positions.get(dependency) < positions.get(manifest.name),
          `${dependency} must be published before ${manifest.name}`,
        );
      }
    }
  }
});

test("stable and prerelease versions use safe npm distribution tags", () => {
  assert.equal(npmDistributionTag("1.0.0"), "latest");
  assert.equal(npmDistributionTag("1.0.0-rc.2"), "next");
  assert.doesNotThrow(() => assertSourceTag("v1.0.0", "1.0.0"));
  assert.throws(() => assertSourceTag("v1.0.1", "1.0.0"), /does not match/u);
});

test("packed manifests reject workspace protocols and drifting local versions", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  const sourcePackage = workspace.packages.find(
    ({ manifest }) => manifest.name === "@golem-seo/application",
  );
  const packageNames = new Set(
    workspace.packages.map(({ manifest }) => manifest.name),
  );
  const packed = structuredClone(sourcePackage.manifest);
  packed.dependencies["@golem-seo/contracts"] = workspace.version;
  assert.doesNotThrow(() =>
    validatePackedManifest(
      packed,
      sourcePackage,
      workspace.version,
      packageNames,
    ),
  );
  packed.dependencies["@golem-seo/contracts"] = "workspace:*";
  assert.throws(
    () =>
      validatePackedManifest(
        packed,
        sourcePackage,
        workspace.version,
        packageNames,
      ),
    /workspace protocol/u,
  );
  packed.dependencies["@golem-seo/contracts"] = "0.0.1";
  assert.throws(
    () =>
      validatePackedManifest(
        packed,
        sourcePackage,
        workspace.version,
        packageNames,
      ),
    /must pin/u,
  );
});

test("npm release manifests preserve the verified topological package order", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  const manifest = {
    schemaVersion: 1,
    version: workspace.version,
    sourceTag: `v${workspace.version}`,
    npmTag: "next",
    packages: workspace.packages.map(({ manifest: item }, index) => ({
      name: item.name,
      version: workspace.version,
      tarball: `package-${index}.tgz`,
      sha256: "a".repeat(64),
      integrity: "sha512-valid",
    })),
  };
  assert.equal(validateNpmReleaseManifest(manifest, workspace), manifest);
  manifest.packages.reverse();
  assert.throws(
    () => validateNpmReleaseManifest(manifest, workspace),
    /topological/u,
  );
});

test("the tag workflow publishes only after native verification and checks registry provenance", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const publisher = await readFile(
    new URL("./publish-npm-release.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /publish-npm:[\s\S]*needs: \[release-approval, native\]/u,
  );
  assert.match(workflow, /environment: npm-production/u);
  assert.match(workflow, /npm install --global npm@11\.18\.0/u);
  assert.match(workflow, /pnpm npm:publish-release/u);
  assert.match(workflow, /id-token: write/u);
  assert.match(publisher, /ACTIONS_ID_TOKEN_REQUEST_URL/u);
  assert.match(publisher, /dist\.attestations/u);
  assert.match(publisher, /registry integrity does not match/u);
});
