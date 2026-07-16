import { validateBuildTarget } from "./desktop-runtime-config.mjs";
import {
  requiredReleaseEnvironment,
  validateReleaseEnvironment,
} from "./release-policy.mjs";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
if (!target) {
  throw new Error(
    "usage: node scripts/validate-release-environment.mjs --target <Rust target triple>",
  );
}
validateBuildTarget(target);
validateReleaseEnvironment(target);
process.stdout.write(
  `Release environment is complete for ${target} (${requiredReleaseEnvironment(target).length} required signing values present).\n`,
);
