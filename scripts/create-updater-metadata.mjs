import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildUpdaterMetadata,
  readUpdaterRecords,
} from "./updater-metadata-policy.mjs";

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = resolve(import.meta.dirname, "..");
const assets = flag("--assets");
const output = flag("--output");
const repository = flag("--repository") ?? process.env.GITHUB_REPOSITORY;
const tag = flag("--tag") ?? process.env.GITHUB_REF_NAME;
if (!assets || !output || !repository || !tag) {
  throw new Error(
    "usage: node scripts/create-updater-metadata.mjs --assets DIRECTORY --output FILE --repository OWNER/REPO --tag vVERSION",
  );
}

const assetRoot = resolve(root, assets);
const outputPath = resolve(root, output);
const records = await readUpdaterRecords(assetRoot);
const metadata = await buildUpdaterMetadata({
  records,
  assetRoot,
  repository,
  tag,
});
await mkdir(dirname(outputPath), { recursive: true, mode: 0o755 });
await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, {
  mode: 0o644,
});
const written = JSON.parse(await readFile(outputPath, "utf8"));
if (JSON.stringify(written) !== JSON.stringify(metadata)) {
  throw new Error("Updater metadata changed while it was written");
}
process.stdout.write(
  `Prepared signed updater metadata for ${Object.keys(metadata.platforms).length} targets at ${outputPath}.\n`,
);
