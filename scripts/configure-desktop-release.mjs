import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CANONICAL_RELEASE_REPOSITORY } from "./release-policy.mjs";
import { CANONICAL_UPDATER_ENDPOINT } from "./updater-metadata-policy.mjs";

const placeholder = "__GOLEM_SEO_UPDATER_PUBLIC_KEY__";
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
if (!publicKey || publicKey === placeholder || publicKey.length < 32) {
  throw new Error(
    "TAURI_UPDATER_PUBLIC_KEY must contain the release updater public key",
  );
}

const configPath = resolve(
  import.meta.dirname,
  "../apps/desktop/src-tauri/tauri.conf.json",
);
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  JSON.stringify(config?.plugins?.updater?.endpoints) !==
  JSON.stringify([CANONICAL_UPDATER_ENDPOINT])
) {
  throw new Error(
    "Desktop updater endpoint is not the canonical static channel",
  );
}
const repository = process.env.GITHUB_REPOSITORY?.trim();
if (repository && repository !== CANONICAL_RELEASE_REPOSITORY) {
  throw new Error(
    `Signed public installers can only be built from ${CANONICAL_RELEASE_REPOSITORY}`,
  );
}
const configured = config?.plugins?.updater?.pubkey;
if (configured !== placeholder && configured !== publicKey) {
  throw new Error("Refusing to replace an unexpected updater public key");
}
config.plugins.updater.pubkey = publicKey;

if (process.platform === "win32") {
  const thumbprint =
    process.env.GOLEMSEO_WINDOWS_CERTIFICATE_THUMBPRINT?.replaceAll(
      /\s/gu,
      "",
    ).toUpperCase();
  if (!thumbprint || !/^[0-9A-F]{40}$/u.test(thumbprint)) {
    throw new Error(
      "GOLEMSEO_WINDOWS_CERTIFICATE_THUMBPRINT must contain the imported Windows signing certificate thumbprint",
    );
  }
  config.bundle.windows = {
    ...config.bundle.windows,
    certificateThumbprint: thumbprint,
    digestAlgorithm: "sha256",
    timestampUrl: "https://timestamp.digicert.com",
  };
}

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
  mode: 0o644,
});
process.stdout.write(
  `Configured signed updates${process.platform === "win32" ? " and Windows Authenticode" : ""} for this release build.\n`,
);
