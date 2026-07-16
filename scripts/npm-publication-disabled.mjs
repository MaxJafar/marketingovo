import { assertNpmPublicationDisabled } from "./npm-release-policy.mjs";

assertNpmPublicationDisabled(process.argv[2] ?? "npm publication");
