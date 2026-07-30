import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer } from "./index.js";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
}

const runtime = new MarketingovoLocalRuntime({
  // This is an ephemeral generator path, not a persisted-data migration.
  dataDir: mkdtempSync(join(tmpdir(), "marketingovo-openapi-")),
  version: "1.0.0",
});
const server = await createLocalServer({ runtime, port: 3210 });
try {
  await server.app.ready();
  const document = sortValue(server.app.swagger());
  writeFileSync(
    new URL("./openapi.json", import.meta.url),
    `${JSON.stringify(document, null, 2)}\n`,
    { mode: 0o644 },
  );
} finally {
  await server.close();
}
