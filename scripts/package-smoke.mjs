import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  readNpmReleaseWorkspace,
  validatePackedManifest,
} from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const workspace = await readNpmReleaseWorkspace(root);
const packageNames = new Set(
  workspace.packages.map(({ manifest }) => manifest.name),
);
const output = await mkdtemp(join(tmpdir(), "marketingovo-pack-"));
const consumer = await mkdtemp(join(tmpdir(), "marketingovo-consumer-"));
const tarballs = [];
try {
  for (const [flag, expected] of [
    ["--version", workspace.version],
    ["-v", workspace.version],
    ["--help", "Usage:"],
  ]) {
    const cli = spawnSync(
      process.execPath,
      [resolve(root, "packages/cli/dist/cli.js"), flag],
      { encoding: "utf8", shell: false },
    );
    assert.equal(
      cli.status,
      0,
      `marketingovo ${flag} failed:\n${cli.stdout}\n${cli.stderr}`,
    );
    assert.match(cli.stdout, new RegExp(expected.replaceAll(".", "\\."), "u"));
  }

  for (const sourcePackage of workspace.packages) {
    const directory = sourcePackage.directory;
    const absolute = resolve(root, directory);
    const before = new Set(await readdir(output));
    const packed = spawnSync("pnpm", ["pack", "--pack-destination", output], {
      cwd: absolute,
      encoding: "utf8",
      shell: false,
    });
    assert.equal(
      packed.status,
      0,
      `${directory} failed to pack:\n${packed.stdout}\n${packed.stderr}`,
    );
    const archive = (await readdir(output)).find(
      (name) => !before.has(name) && name.endsWith(".tgz"),
    );
    assert.ok(archive, `${directory} did not produce a tarball`);
    const listed = spawnSync("tar", ["-tzf", resolve(output, archive)], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(listed.status, 0, `${archive} is not a readable tarball`);
    const entries = listed.stdout.split(/\r?\n/u);
    assert.ok(
      entries.includes("package/package.json"),
      `${archive} is missing package.json`,
    );
    assert.ok(
      entries.includes("package/LICENSE"),
      `${archive} is missing the Apache-2.0 license terms`,
    );
    assert.ok(
      entries.includes("package/NOTICE"),
      `${archive} is missing the Marketingovo attribution notice`,
    );
    assert.ok(
      entries.some((entry) => /^package\/dist\/.+\.js$/u.test(entry)),
      `${archive} is missing built JavaScript`,
    );
    const packedJson = spawnSync(
      "tar",
      ["-xOf", resolve(output, archive), "package/package.json"],
      { encoding: "utf8", shell: false },
    );
    assert.equal(
      packedJson.status,
      0,
      `${archive} package.json could not be read`,
    );
    validatePackedManifest(
      JSON.parse(packedJson.stdout),
      sourcePackage,
      workspace.version,
      packageNames,
    );
    tarballs.push({
      name: sourcePackage.manifest.name,
      path: resolve(output, archive),
    });
  }
  await writeFile(
    resolve(consumer, "package.json"),
    `${JSON.stringify(
      {
        name: "marketingovo-clean-install-smoke",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies: Object.fromEntries(
          tarballs.map(({ name, path }) => [name, `file:${path}`]),
        ),
        pnpm: {
          overrides: Object.fromEntries(
            tarballs.map(({ name, path }) => [name, `file:${path}`]),
          ),
        },
      },
      null,
      2,
    )}\n`,
  );
  const installTarballs =
    process.env.CI === "true" ||
    process.env.MARKETINGOVO_NPM_INSTALL_SMOKE === "1" ||
    process.env.MARKETINGOVO_NPM_INSTALL_SMOKE === "1";
  if (installTarballs) {
    const installed = spawnSync(
      "pnpm",
      [
        "install",
        "--prefer-offline",
        "--ignore-scripts",
        "--no-frozen-lockfile",
      ],
      { cwd: consumer, encoding: "utf8", shell: false },
    );
    assert.equal(
      installed.status,
      0,
      `clean tarball installation failed:\n${installed.stdout}\n${installed.stderr}`,
    );
    const installedCli = spawnSync(
      process.execPath,
      [resolve(consumer, "node_modules/marketingovo/dist/cli.js"), "--version"],
      { cwd: consumer, encoding: "utf8", shell: false },
    );
    assert.equal(
      installedCli.status,
      0,
      `installed CLI failed:\n${installedCli.stdout}\n${installedCli.stderr}`,
    );
    assert.equal(installedCli.stdout.trim(), workspace.version);
  }
  process.stdout.write(
    `${installTarballs ? "Packed, installed and executed" : "Packed and inspected"} ${workspace.packages.length} private artifacts.\n`,
  );
} finally {
  await Promise.all(
    [output, consumer].map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
}
