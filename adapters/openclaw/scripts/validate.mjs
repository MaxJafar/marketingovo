import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "openclaw.plugin.json"), "utf8"),
);
const expected = [
  "golem_intel_research_start",
  "golem_intel_compare_start",
  "golem_intel_run_get",
  "golem_intel_search",
  "golem_intel_entity_get",
  "golem_intel_monitoring_status",
];
if (manifest.id !== "golem-intel") throw new Error("OpenClaw id drifted");
if (JSON.stringify(manifest.contracts.tools) !== JSON.stringify(expected)) {
  throw new Error("OpenClaw public tool contract drifted");
}

