import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { format } from "prettier";

const packageRoot = resolve(import.meta.dirname, "..");
const input = resolve(packageRoot, "../server/dist/openapi.json");
const output = resolve(packageRoot, "src/generated/openapi.ts");
const checkOnly = process.argv.includes("--check");

const document = JSON.parse(await readFile(input, "utf8"));
const ast = await openapiTS(document, {
  alphabetize: true,
  exportType: true,
});
const generated = await format(
  `// Generated from packages/server/dist/openapi.json. Do not edit.\n${astToString(ast)}`,
  { parser: "typescript" },
);

if (checkOnly) {
  const current = await readFile(output, "utf8").catch(() => "");
  if (current !== generated) {
    throw new Error(
      "Generated SDK types are stale. Run pnpm --filter @marketingovo/sdk generate after rebuilding @marketingovo/server.",
    );
  }
  process.stdout.write(
    "Generated OpenAPI SDK types match the server contract.\n",
  );
} else {
  await writeFile(output, generated, "utf8");
  process.stdout.write(
    "Generated typed SDK paths from the local OpenAPI contract.\n",
  );
}
