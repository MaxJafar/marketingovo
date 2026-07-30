import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertRegularFileInside,
  CANONICAL_RELEASE_REPOSITORY,
  RELEASE_VERIFICATION_SCHEMA_VERSION,
  releaseAssetName,
  sha256File,
} from "./release-policy.mjs";
import { parseReleaseVersion } from "./upgrade-baseline-policy.mjs";

export const UPDATER_TARGETS = Object.freeze([
  Object.freeze({
    target: "aarch64-apple-darwin",
    platform: "macos",
    platformKey: "darwin-aarch64",
    payloadSuffix: ".app.tar.gz",
  }),
  Object.freeze({
    target: "x86_64-apple-darwin",
    platform: "macos",
    platformKey: "darwin-x86_64",
    payloadSuffix: ".app.tar.gz",
  }),
  Object.freeze({
    target: "x86_64-pc-windows-msvc",
    platform: "windows",
    platformKey: "windows-x86_64",
    payloadSuffix: ".msi",
  }),
  Object.freeze({
    target: "x86_64-unknown-linux-gnu",
    platform: "linux",
    platformKey: "linux-x86_64",
    payloadSuffix: ".AppImage",
  }),
]);

export const CANONICAL_UPDATER_ENDPOINT = `https://github.com/${CANONICAL_RELEASE_REPOSITORY}/releases/latest/download/latest.json`;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/=]+$/u;

function updaterPair(record, specification) {
  if (
    record?.schemaVersion !== RELEASE_VERIFICATION_SCHEMA_VERSION ||
    record.target !== specification.target ||
    record.platform !== specification.platform ||
    typeof record.version !== "string" ||
    !Array.isArray(record.artifacts) ||
    record.updater?.detachedSignatures !== "cryptographically-verified" ||
    !SHA256_PATTERN.test(record.updater?.publicKeySha256 ?? "")
  ) {
    throw new Error(
      `Updater verification record is malformed for ${specification.target}`,
    );
  }
  parseReleaseVersion(record.version);
  const payloads = record.artifacts.filter(
    (artifact) =>
      artifact?.role?.includes("updater-payload") &&
      artifact.path?.endsWith(specification.payloadSuffix) &&
      SHA256_PATTERN.test(artifact.sha256 ?? ""),
  );
  if (payloads.length !== 1) {
    throw new Error(
      `Expected exactly one ${specification.payloadSuffix} updater payload for ${specification.target}`,
    );
  }
  const payload = payloads[0];
  const signatures = record.artifacts.filter(
    (artifact) =>
      artifact?.role === "updater-signature" &&
      artifact.path === `${payload.path}.sig` &&
      SHA256_PATTERN.test(artifact.sha256 ?? ""),
  );
  if (signatures.length !== 1) {
    throw new Error(
      `Updater payload has no unique verified signature for ${specification.target}`,
    );
  }
  return { payload, signature: signatures[0] };
}

export function updaterReleaseAssetNames(records) {
  if (!Array.isArray(records)) {
    throw new Error("Updater records must be an array");
  }
  const byTarget = new Map(records.map((record) => [record?.target, record]));
  if (byTarget.size !== UPDATER_TARGETS.length) {
    throw new Error(
      "Updater metadata requires one record for every release target",
    );
  }
  return UPDATER_TARGETS.flatMap((specification) => {
    const record = byTarget.get(specification.target);
    const { payload, signature } = updaterPair(record, specification);
    return [
      releaseAssetName(specification.target, payload.path),
      releaseAssetName(specification.target, signature.path),
    ];
  });
}

export async function buildUpdaterMetadata({
  records,
  assetRoot,
  repository,
  tag,
}) {
  if (repository !== CANONICAL_RELEASE_REPOSITORY) {
    throw new Error(
      `Updater metadata can only target ${CANONICAL_RELEASE_REPOSITORY}`,
    );
  }
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u.test(tag ?? "")) {
    throw new Error(
      "Updater metadata requires an exact v-prefixed release tag",
    );
  }
  if (typeof assetRoot !== "string" || !assetRoot) {
    throw new Error("Updater metadata requires an asset root");
  }
  if (!Array.isArray(records) || records.length !== UPDATER_TARGETS.length) {
    throw new Error("Updater metadata requires every canonical target record");
  }
  const byTarget = new Map();
  for (const record of records) {
    if (byTarget.has(record?.target)) {
      throw new Error(`Duplicate updater target: ${String(record?.target)}`);
    }
    byTarget.set(record?.target, record);
  }

  let version = null;
  let publicKeySha256 = null;
  const platforms = {};
  for (const specification of UPDATER_TARGETS) {
    const record = byTarget.get(specification.target);
    const { payload, signature } = updaterPair(record, specification);
    version ??= record.version;
    publicKeySha256 ??= record.updater.publicKeySha256;
    if (
      record.version !== version ||
      record.updater.publicKeySha256 !== publicKeySha256
    ) {
      throw new Error(
        "Updater records disagree on release version or embedded public key",
      );
    }
    const payloadName = releaseAssetName(specification.target, payload.path);
    const signatureName = releaseAssetName(
      specification.target,
      signature.path,
    );
    const payloadPath = await assertRegularFileInside(assetRoot, payloadName);
    const signaturePath = await assertRegularFileInside(
      assetRoot,
      signatureName,
    );
    if (
      (await sha256File(payloadPath)) !== payload.sha256 ||
      (await sha256File(signaturePath)) !== signature.sha256
    ) {
      throw new Error(
        `Updater assets changed after native verification for ${specification.target}`,
      );
    }
    const signatureContent = (await readFile(signaturePath, "utf8")).trim();
    if (
      signatureContent.length < 64 ||
      !SIGNATURE_PATTERN.test(signatureContent)
    ) {
      throw new Error(
        `Updater signature content is malformed for ${specification.target}`,
      );
    }
    platforms[specification.platformKey] = {
      signature: signatureContent,
      url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(payloadName)}`,
    };
  }
  if (tag !== `v${version}`) {
    throw new Error(`Updater records for ${version} do not match tag ${tag}`);
  }
  return {
    version,
    notes: `AGENTseo ${version}. Platform-verified AGENTseo release.`,
    platforms,
  };
}

export async function readUpdaterRecords(assetRoot) {
  return Promise.all(
    UPDATER_TARGETS.map(async ({ target }) =>
      JSON.parse(
        await readFile(
          resolve(assetRoot, `release-verification-${target}.json`),
          "utf8",
        ),
      ),
    ),
  );
}
