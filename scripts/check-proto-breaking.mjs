import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const against =
  process.argv.slice(2).find((argument) => argument !== "--") ??
  process.env.BUF_BREAKING_AGAINST;

if (!against) {
  throw new Error(
    "No released Protobuf baseline is configured. Pass an explicit Buf input " +
      "as the first argument or set BUF_BREAKING_AGAINST; this gate will not " +
      "pretend that linting is a compatibility comparison.",
  );
}

const env = {
  ...process.env,
  BUF_CACHE_DIR:
    process.env.BUF_CACHE_DIR ?? resolve(root, ".marketingovo/cache/buf"),
};

execFileSync("buf", ["breaking", ".", "--against", against], {
  cwd: root,
  env,
  stdio: "inherit",
});
