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
    process.env.BUF_CACHE_DIR ?? resolve(root, ".agentintel/cache/buf"),
};

execFileSync("buf", ["generate"], { cwd: root, env, stdio: "inherit" });
execFileSync(
  resolve(
    bin,
    process.platform === "win32"
      ? "openapi-typescript.cmd"
      : "openapi-typescript",
  ),
  [
    "contracts/openapi/agentintel.openapi.yaml",
    "-o",
    "packages/sdk/src/generated/openapi.ts",
  ],
  { cwd: root, env, stdio: "inherit" },
);
