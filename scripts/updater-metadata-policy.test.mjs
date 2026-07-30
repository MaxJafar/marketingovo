import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CANONICAL_RELEASE_REPOSITORY,
  releaseAssetName,
  sha256File,
} from "./release-policy.mjs";
import {
  buildUpdaterMetadata,
  UPDATER_TARGETS,
  updaterReleaseAssetNames,
} from "./updater-metadata-policy.mjs";

async function fixture() {
  const assetRoot = await mkdtemp(join(tmpdir(), "agentseo-updater-metadata-"));
  const version = "0.11.0-alpha.0";
  const records = [];
  for (const specification of UPDATER_TARGETS) {
    const payloadPath =
      specification.platform === "macos"
        ? "macos/AGENTseo.app.tar.gz"
        : specification.platform === "windows"
          ? "msi/AGENTseo.msi"
          : "appimage/AGENTseo.AppImage";
    const signaturePath = `${payloadPath}.sig`;
    const payloadName = releaseAssetName(specification.target, payloadPath);
    const signatureName = releaseAssetName(specification.target, signaturePath);
    const payloadFile = join(assetRoot, payloadName);
    const signatureFile = join(assetRoot, signatureName);
    await writeFile(payloadFile, `verified ${specification.target} payload`);
    await writeFile(signatureFile, "A".repeat(88));
    records.push({
      schemaVersion: 2,
      target: specification.target,
      platform: specification.platform,
      version,
      updater: {
        detachedSignatures: "cryptographically-verified",
        publicKeySha256: "c".repeat(64),
      },
      artifacts: [
        {
          path: payloadPath,
          role:
            specification.platform === "macos"
              ? "updater-payload"
              : "installer-updater-payload",
          sha256: await sha256File(payloadFile),
        },
        {
          path: signaturePath,
          role: "updater-signature",
          sha256: await sha256File(signatureFile),
        },
      ],
    });
  }
  return { assetRoot, records, version };
}

test("static updater metadata covers every canonical target with verified bytes", async () => {
  const { assetRoot, records, version } = await fixture();
  const metadata = await buildUpdaterMetadata({
    records,
    assetRoot,
    repository: CANONICAL_RELEASE_REPOSITORY,
    tag: `v${version}`,
  });
  assert.equal(metadata.version, version);
  assert.deepEqual(Object.keys(metadata.platforms), [
    "darwin-aarch64",
    "darwin-x86_64",
    "windows-x86_64",
    "linux-x86_64",
  ]);
  assert.equal(
    new Set(updaterReleaseAssetNames(records)).size,
    UPDATER_TARGETS.length * 2,
    "target-prefixed payload and signature names must not collide",
  );
  for (const platform of Object.values(metadata.platforms)) {
    assert.equal(platform.signature, "A".repeat(88));
    assert.match(
      platform.url,
      /^https:\/\/github\.com\/GolemWorkers\/agentseo\/releases\/download\/v0\.11\.0-alpha\.0\//u,
    );
  }
});

test("updater metadata fails closed on tampering, target gaps and key drift", async () => {
  const { assetRoot, records, version } = await fixture();
  const linux = records.find(({ platform }) => platform === "linux");
  const linuxPayload = linux.artifacts.find(({ role }) =>
    role.includes("updater-payload"),
  );
  await writeFile(
    join(assetRoot, releaseAssetName(linux.target, linuxPayload.path)),
    "tampered payload",
  );
  await assert.rejects(
    buildUpdaterMetadata({
      records,
      assetRoot,
      repository: CANONICAL_RELEASE_REPOSITORY,
      tag: `v${version}`,
    }),
    /changed after native verification/u,
  );

  const fresh = await fixture();
  await assert.rejects(
    buildUpdaterMetadata({
      records: fresh.records.slice(1),
      assetRoot: fresh.assetRoot,
      repository: CANONICAL_RELEASE_REPOSITORY,
      tag: `v${version}`,
    }),
    /every canonical target/u,
  );
  fresh.records[1].updater.publicKeySha256 = "d".repeat(64);
  await assert.rejects(
    buildUpdaterMetadata({
      records: fresh.records,
      assetRoot: fresh.assetRoot,
      repository: CANONICAL_RELEASE_REPOSITORY,
      tag: `v${version}`,
    }),
    /disagree on release version or embedded public key/u,
  );
});

test("updater metadata refuses a non-canonical publication repository", async () => {
  const { assetRoot, records, version } = await fixture();
  await assert.rejects(
    buildUpdaterMetadata({
      records,
      assetRoot,
      repository: "fork/agentseo",
      tag: `v${version}`,
    }),
    /can only target GolemWorkers\/agentseo/u,
  );
});
