import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  NPM_RELEASE_SCHEMA_VERSION,
  assertSourceTag,
  npmDistributionTag,
  readNpmReleaseWorkspace,
  tarballHashes,
  validatePackedManifest,
} from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const sourceTagFlag = process.argv.indexOf("--tag");
const sourceTag =
  sourceTagFlag >= 0
    ? process.argv[sourceTagFlag + 1]
    : process.env.GITHUB_REF_NAME;
const workspace = await readNpmReleaseWorkspace(root);
assertSourceTag(sourceTag, workspace.version);

const output = resolve(root, "artifacts/npm-release");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true, mode: 0o755 });
const packageNames = new Set(
  workspace.packages.map(({ manifest }) => manifest.name),
);
const releasePackages = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
      { cause: result.error },
    );
  }
  return result.stdout;
}

for (const sourcePackage of workspace.packages) {
  const before = new Set(await readdir(output));
  run("pnpm", ["pack", "--pack-destination", output], {
    cwd: resolve(root, sourcePackage.directory),
  });
  const created = (await readdir(output)).filter(
    (name) => !before.has(name) && name.endsWith(".tgz"),
  );
  assert.equal(
    created.length,
    1,
    `${sourcePackage.manifest.name} must produce exactly one tarball`,
  );
  const tarball = created[0];
  const tarballPath = resolve(output, tarball);
  const packedManifest = JSON.parse(
    run("tar", ["-xOf", tarballPath, "package/package.json"]),
  );
  validatePackedManifest(
    packedManifest,
    sourcePackage,
    workspace.version,
    packageNames,
  );
  const entries = run("tar", ["-tzf", tarballPath]).split(/\r?\n/u);
  for (const required of [
    "package/package.json",
    "package/LICENSE",
    "package/NOTICE",
  ]) {
    assert.ok(
      entries.includes(required),
      `${sourcePackage.manifest.name} tarball is missing ${required}`,
    );
  }
  assert.ok(
    entries.some((entry) => /^package\/dist\/.+\.js$/u.test(entry)),
    `${sourcePackage.manifest.name} tarball contains no built JavaScript`,
  );
  releasePackages.push({
    name: packedManifest.name,
    version: packedManifest.version,
    directory: sourcePackage.directory,
    tarball: basename(tarballPath),
    ...(await tarballHashes(tarballPath)),
  });
}

const manifest = {
  schemaVersion: NPM_RELEASE_SCHEMA_VERSION,
  version: workspace.version,
  sourceTag,
  npmTag: npmDistributionTag(workspace.version),
  preparedAt: new Date().toISOString(),
  packages: releasePackages,
};
const manifestPath = resolve(output, "npm-release-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  mode: 0o644,
});
JSON.parse(await readFile(manifestPath, "utf8"));
process.stdout.write(
  `Prepared ${releasePackages.length} topologically ordered npm tarballs for ${sourceTag} (${manifest.npmTag}).\n`,
);
