import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const result = spawnSync(
  "pnpm",
  ["list", "--recursive", "--json", "--depth", "Infinity"],
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  },
);
if (result.status !== 0)
  throw new Error(result.stderr || "Unable to enumerate dependencies");

const projects = JSON.parse(result.stdout);
const components = new Map();
const add = (name, version, license) => {
  if (typeof name !== "string" || typeof version !== "string") return;
  const key = `${name}@${version}`;
  if (components.has(key)) return;
  components.set(key, {
    type: "library",
    "bom-ref": `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    name,
    version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    ...(typeof license === "string"
      ? { licenses: [{ license: { id: license } }] }
      : {}),
  });
};
const visit = (dependencies) => {
  if (!dependencies || typeof dependencies !== "object") return;
  for (const [name, value] of Object.entries(dependencies)) {
    if (!value || typeof value !== "object") continue;
    add(name, value.version, value.license);
    visit(value.dependencies);
  }
};
for (const project of projects) {
  add(project.name, project.version, project.license);
  visit(project.dependencies);
  visit(project.devDependencies);
}

const serial = createHash("sha256")
  .update([...components.keys()].sort().join("\n"))
  .digest("hex");
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${serial.slice(0, 8)}-${serial.slice(8, 12)}-${serial.slice(12, 16)}-${serial.slice(16, 20)}-${serial.slice(20, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: "agentseo-community",
      version: "0.11.0-alpha.0",
    },
    tools: {
      components: [
        { type: "application", name: "agentseo-sbom-generator", version: "1" },
      ],
    },
  },
  components: [...components.values()].sort((left, right) =>
    left["bom-ref"].localeCompare(right["bom-ref"]),
  ),
};
const outputDirectory = resolve(root, "artifacts");
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "agentseo.cdx.json"),
  `${JSON.stringify(sbom, null, 2)}\n`,
);
process.stdout.write(
  `Wrote CycloneDX 1.6 SBOM with ${components.size} components.\n`,
);
