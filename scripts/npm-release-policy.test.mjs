import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  NPM_PUBLICATION_ENABLED,
  WORKSPACE_IDENTITIES,
  PUBLIC_PACKABLE_WORKSPACE_DIRECTORIES,
  assertNpmPublicationDisabled,
  readNpmReleaseWorkspace,
  validatePackedManifest,
} from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");

test("the frozen workspace graph separates public packages from private apps", async () => {
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
    new Set(Object.values(WORKSPACE_IDENTITIES)),
  );
  for (const { directory, manifest } of workspace.versioned) {
    if (PUBLIC_PACKABLE_WORKSPACE_DIRECTORIES.includes(directory)) {
      assert.notEqual(
        manifest.private,
        true,
        `${manifest.name} must be public`,
      );
      if (manifest.name.startsWith("@")) {
        assert.equal(manifest.publishConfig?.access, "public");
      }
      assert.equal(manifest.scripts?.prepublishOnly, undefined);
    } else {
      assert.equal(manifest.private, true, `${manifest.name} must be private`);
      assert.equal(Object.hasOwn(manifest, "publishConfig"), false);
      assert.match(
        manifest.scripts.prepublishOnly,
        /npm-publication-disabled\.mjs direct-package-publish$/u,
      );
    }
  }
});

test("public packable packages remain topologically ordered", async () => {
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

test("packed artifacts retain public metadata and deterministic local versions", async () => {
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
  packed.private = true;
  assert.throws(
    () =>
      validatePackedManifest(
        packed,
        sourcePackage,
        workspace.version,
        packageNames,
      ),
    /public identity/u,
  );
});

test("the public publication gate is enabled only for the tagged workflow", async () => {
  assert.equal(NPM_PUBLICATION_ENABLED, true);
  assert.throws(
    () => assertNpmPublicationDisabled("private package publication"),
    /private workspace packages/u,
  );

  const rootManifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  assert.equal(
    rootManifest.scripts["npm:prepare-release"],
    "node scripts/prepare-npm-release.mjs",
  );
  assert.equal(
    rootManifest.scripts["npm:publish-release"],
    "node scripts/publish-npm-release.mjs",
  );
});

test("the legacy direct publisher also fails before registry access", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts/publish-npm-release.mjs")],
    { cwd: root, encoding: "utf8", shell: false },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /canonical tag workflow/u);
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /npm view|npm publish/u,
  );
});

test("the CLI package is publicly packable", () => {
  const result = spawnSync("npm", ["publish", "--dry-run", "--tag", "next"], {
    cwd: resolve(root, "packages/cli"),
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /marketingovo@1\.1\.0/u);
});
