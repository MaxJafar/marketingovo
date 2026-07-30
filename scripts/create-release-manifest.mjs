import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  assertRegularFileInside,
  releaseAssetName,
  releasePlatform,
  sha256File,
  validateVerificationRecord,
} from "./release-policy.mjs";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
if (!target || !/^[a-z0-9_-]+$/iu.test(target)) {
  throw new Error(
    "usage: node scripts/create-release-manifest.mjs --target <Rust target triple>",
  );
}

const root = resolve(import.meta.dirname, "..");
const bundleRoot = resolve(
  root,
  "apps/desktop/src-tauri/target",
  target,
  "release/bundle",
);
const verificationPath = resolve(
  root,
  "artifacts",
  `release-verification-${target}.json`,
);
const output = resolve(root, "artifacts", `release-${target}`);
const updaterOutput = resolve(root, "artifacts", `updater-${target}`);
const verification = JSON.parse(await readFile(verificationPath, "utf8"));
const artifacts = await validateVerificationRecord(verification, {
  target,
  bundleRoot,
});

await rm(output, { recursive: true, force: true });
await rm(updaterOutput, { recursive: true, force: true });
await mkdir(output, { recursive: true, mode: 0o755 });
await mkdir(updaterOutput, { recursive: true, mode: 0o755 });
const names = new Set();
const checksums = [];
for (const artifact of artifacts) {
  const source = await assertRegularFileInside(bundleRoot, artifact.path);
  if ((await sha256File(source)) !== artifact.sha256) {
    throw new Error(
      `Release artifact changed after verification: ${artifact.path}`,
    );
  }
  const name = releaseAssetName(target, artifact.path);
  if (names.has(name)) {
    throw new Error(
      `Release artifact names collide after flattening for upload: ${name}`,
    );
  }
  names.add(name);
  await copyFile(source, resolve(output, name));
  if (
    artifact.role.includes("updater-payload") ||
    artifact.role === "updater-signature"
  ) {
    await copyFile(source, resolve(updaterOutput, name));
  }
  checksums.push(`${artifact.sha256}  ${name}`);
}
await writeFile(
  resolve(output, `SHA256SUMS-${target}.txt`),
  `${checksums.sort().join("\n")}\n`,
  { mode: 0o644 },
);
await copyFile(
  verificationPath,
  resolve(output, `release-verification-${target}.json`),
);
await copyFile(
  verificationPath,
  resolve(updaterOutput, `release-verification-${target}.json`),
);
const lifecycleName = `${releasePlatform(target)}-installer-lifecycle-${target}.json`;
await copyFile(
  resolve(root, "artifacts", lifecycleName),
  resolve(output, lifecycleName),
);
await copyFile(
  resolve(root, "artifacts/marketingovo.cdx.json"),
  resolve(output, `marketingovo-${target}.cdx.json`),
);
await copyFile(
  resolve(root, "LICENSE"),
  resolve(output, `LICENSE-${target}.txt`),
);
await copyFile(
  resolve(root, "NOTICE"),
  resolve(output, `NOTICE-${target}.txt`),
);
process.stdout.write(
  `Prepared verified release payload for ${artifacts.length} artifact(s) in ${basename(output)}.\n`,
);
