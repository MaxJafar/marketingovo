import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  NPM_PUBLICATION_ENABLED,
  PRIVATE_WORKSPACE_IDENTITIES,
  assertNpmPublicationDisabled,
  readNpmReleaseWorkspace,
  validatePackedManifest,
} from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");

test("the frozen workspace graph uses only private Marketingovo package identities", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  assert.equal(workspace.packages.length, 13);
  // 17 after the never-published legacy Codex plugin workspace was removed.
  assert.equal(workspace.versioned.length, 17);
  assert.equal(
    workspace.versioned.find(({ directory }) => directory === "packages/cli")
      ?.manifest.name,
    "marketingovo",
  );
  assert.deepEqual(
    new Set(workspace.versioned.map(({ manifest }) => manifest.name)),
    new Set(Object.values(PRIVATE_WORKSPACE_IDENTITIES)),
  );
  for (const { manifest } of workspace.versioned) {
    assert.equal(manifest.private, true, `${manifest.name} must be private`);
    assert.equal(
      Object.hasOwn(manifest, "publishConfig"),
      false,
      `${manifest.name} must not contain publishConfig`,
    );
    assert.match(
      manifest.scripts.prepublishOnly,
      /npm-publication-disabled\.mjs direct-package-publish$/u,
      `${manifest.name} must reject direct publication`,
    );
  }
});

test("private packable packages remain topologically ordered", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  const positions = new Map(
    workspace.packages.map(({ manifest }, index) => [manifest.name, index]),
  );
  for (const { manifest } of workspace.packages) {
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
      "devDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (!positions.has(dependency)) continue;
        assert.ok(
          positions.get(dependency) < positions.get(manifest.name),
          `${dependency} must precede ${manifest.name}`,
        );
      }
    }
  }
});

test("packed artifacts retain private metadata and deterministic local versions", async () => {
  const workspace = await readNpmReleaseWorkspace(root);
  const sourcePackage = workspace.packages.find(
    ({ manifest }) => manifest.name === "@marketingovo/application",
  );
  const packageNames = new Set(
    workspace.packages.map(({ manifest }) => manifest.name),
  );
  const packed = structuredClone(sourcePackage.manifest);
  packed.dependencies["@marketingovo/contracts"] = workspace.version;
  assert.doesNotThrow(() =>
    validatePackedManifest(
      packed,
      sourcePackage,
      workspace.version,
      packageNames,
    ),
  );
  packed.private = false;
  assert.throws(
    () =>
      validatePackedManifest(
        packed,
        sourcePackage,
        workspace.version,
        packageNames,
      ),
    /private identity/u,
  );
});

test("the milestone publication gate is explicitly fail-closed", async () => {
  assert.equal(NPM_PUBLICATION_ENABLED, false);
  assert.throws(
    () => assertNpmPublicationDisabled("test publication"),
    /disabled for the independence-migration milestone/u,
  );

  const rootManifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  for (const command of ["npm:prepare-release", "npm:publish-release"]) {
    assert.equal(
      rootManifest.scripts[command],
      `node scripts/npm-publication-disabled.mjs ${command}`,
    );
    const result = spawnSync("pnpm", [command], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    assert.notEqual(result.status, 0, `${command} must fail`);
    assert.match(
      `${result.stdout}${result.stderr}`,
      /disabled for the independence-migration milestone/u,
    );
  }
});

test("the legacy direct publisher also fails before registry access", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts/publish-npm-release.mjs")],
    { cwd: root, encoding: "utf8", shell: false },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /disabled for the independence-migration milestone/u,
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /npm view|npm publish/u,
  );
});

test("a direct package publish attempt is stopped by the lifecycle guard", () => {
  const result = spawnSync("npm", ["publish", "--dry-run", "--tag", "next"], {
    cwd: resolve(root, "packages/cli"),
    encoding: "utf8",
    shell: false,
  });
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /disabled for the independence-migration milestone/u,
  );
});
