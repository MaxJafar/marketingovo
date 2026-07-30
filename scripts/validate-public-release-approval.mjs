import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  readNpmReleaseWorkspace,
  assertSourceTag,
} from "./npm-release-policy.mjs";
import {
  requiresPublicAcceptance,
  validatePublicReleaseAcceptance,
} from "./public-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const tagFlag = process.argv.indexOf("--tag");
const tag =
  tagFlag >= 0 ? process.argv[tagFlag + 1] : process.env.GITHUB_REF_NAME;
const workspace = await readNpmReleaseWorkspace(root);
assertSourceTag(tag, workspace.version);

if (!requiresPublicAcceptance(workspace.version)) {
  process.stdout.write(
    `Validated prerelease tag ${tag}; stable design-partner and legal acceptance is not claimed.\n`,
  );
} else {
  const path = resolve(root, "release/acceptance", `${workspace.version}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  validatePublicReleaseAcceptance(record, workspace.version);
  const gates = Object.keys(record.evidence).length;
  const deferred = record.deferredChannels.length;
  process.stdout.write(
    `Validated release-owner and licence-compliance approval for ${tag}, ` +
      `${gates} recorded quality gate(s), and ${deferred} declared deferred ` +
      `distribution channel(s).\n`,
  );
}
