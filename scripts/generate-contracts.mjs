import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bin = resolve(root, "node_modules/.bin");
const goBin = resolve(homedir(), "go/bin");
const env = {
  ...process.env,
  PATH: [goBin, bin, process.env.PATH].filter(Boolean).join(delimiter),
  BUF_CACHE_DIR:
    process.env.BUF_CACHE_DIR ?? resolve(root, ".marketingovo/cache/buf"),
};

// Protobuf bindings for the intel daemon's worker protocol, in Go, Python and
// TypeScript. Targets come from buf.gen.yaml.
//
// This script deliberately does not generate TypeScript types from
// contracts/openapi/marketingovo-intel.openapi.yaml. That document describes
// the intel daemon's own API, and nothing consumes it as TypeScript. The
// product SDK's types are generated separately by
// packages/sdk/scripts/generate-openapi-types.mjs from the product server's
// own OpenAPI document, and `pnpm --filter @marketingovo/sdk generate:check`
// guards them on every build, typecheck and lint.
execFileSync("buf", ["generate"], { cwd: root, env, stdio: "inherit" });
