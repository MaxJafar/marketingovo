import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "openclaw.plugin.json"), "utf8"),
);
const expected = [
  "agentintel_research_start",
  "agentintel_compare_start",
  "agentintel_run_get",
  "agentintel_search",
  "agentintel_entity_get",
  "agentintel_monitoring_status",
];
if (manifest.id !== "agentintel") throw new Error("OpenClaw id drifted");
if (JSON.stringify(manifest.contracts.tools) !== JSON.stringify(expected)) {
  throw new Error("OpenClaw public tool contract drifted");
}
