import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative, resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const bin = resolve(root, "node_modules/.bin");
const goBin = resolve(process.env.HOME ?? "", "go/bin");
const env = {
  ...process.env,
  PATH: [goBin, bin, process.env.PATH].filter(Boolean).join(delimiter),
  BUF_CACHE_DIR:
    process.env.BUF_CACHE_DIR ?? resolve(root, ".golem-intel/cache/buf"),
};

execFileSync("buf", ["lint"], { cwd: root, env, stdio: "inherit" });

const openapiPath = resolve(root, "contracts/openapi/golem-intel.openapi.yaml");
const openapi = readFileSync(openapiPath, "utf8");
const openapiDocument = parse(openapi);
const agentContracts = readFileSync(
  resolve(root, "packages/contracts/src/agent-tools.ts"),
  "utf8",
);
const generatedOpenAPIPath = resolve(
  root,
  "packages/sdk/src/generated/openapi.ts",
);
const generated = readFileSync(generatedOpenAPIPath, "utf8");
const proto = readFileSync(
  resolve(root, "contracts/proto/golem/intel/v1/worker.proto"),
  "utf8",
);
const arrowSchema = JSON.parse(
  readFileSync(resolve(root, "schemas/arrow/observations.schema.json"), "utf8"),
);
const evidenceManifestSchema = JSON.parse(
  readFileSync(
    resolve(root, "contracts/json-schema/evidence-manifest.schema.json"),
    "utf8",
  ),
);

const temporary = mkdtempSync(join(tmpdir(), "golem-intel-contracts-"));
try {
  execFileSync("buf", ["generate", "--output", temporary], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  for (const outputRoot of ["gen/go", "gen/python", "gen/typescript"]) {
    compareTrees(resolve(root, outputRoot), resolve(temporary, outputRoot));
  }

  const temporaryOpenAPI = resolve(temporary, "openapi.ts");
  execFileSync(
    resolve(
      bin,
      process.platform === "win32"
        ? "openapi-typescript.cmd"
        : "openapi-typescript",
    ),
    [openapiPath, "-o", temporaryOpenAPI],
    { cwd: root, env, stdio: "inherit" },
  );
  compareFiles(generatedOpenAPIPath, temporaryOpenAPI);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

validateOpenAPISamples(openapiDocument);

const operations = [
  "healthGet",
  "sessionBootstrap",
  "sessionGet",
  "comparisonStart",
  "researchStart",
  "runList",
  "runGet",
  "runEventsStream",
  "runCancel",
  "runReplay",
  "reportGet",
  "searchGet",
  "entityGet",
  "monitoringStatusGet",
];
for (const operation of operations) {
  if (!openapi.includes(`operationId: ${operation}`)) {
    throw new Error(`OpenAPI operation missing: ${operation}`);
  }
  if (!generated.includes(`${operation}:`)) {
    throw new Error(`Generated TypeScript operation missing: ${operation}`);
  }
}

const publicTools = [
  "golem_intel_research_start",
  "golem_intel_compare_start",
  "golem_intel_run_get",
  "golem_intel_search",
  "golem_intel_entity_get",
  "golem_intel_monitoring_status",
];
for (const tool of publicTools) {
  if (!agentContracts.includes(`name: "${tool}"`)) {
    throw new Error(`Agent projection missing: ${tool}`);
  }
}
if (
  !proto.includes("oneof message") ||
  !proto.includes("ArtifactDescriptor") ||
  !proto.includes("AnalysisWorkflow workflow") ||
  !proto.includes("string worker_version")
) {
  throw new Error(
    "Worker protocol lost its versioned envelope, workflow, provenance, or artifact contract",
  );
}
if (
  arrowSchema.properties?.schema_id?.const !== "golem.observations.v1" ||
  arrowSchema.properties?.fields?.prefixItems?.length !== 32
) {
  throw new Error("Canonical Arrow observation schema drifted");
}
if (evidenceManifestSchema.properties?.manifest_version?.const !== 1) {
  throw new Error("Evidence manifest version drifted");
}

const forbiddenAgentWords = [
  "golem_intel_contact_reveal",
  "golem_intel_delete",
  "golem_intel_outreach",
  "golem_intel_policy_set",
];
for (const tool of forbiddenAgentWords) {
  if (agentContracts.includes(tool)) {
    throw new Error(`Unsafe tool escaped the default boundary: ${tool}`);
  }
}

function generatedFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__pycache__") result.push(...generatedFiles(path));
    } else if (entry.isFile() && !entry.name.endsWith(".pyc")) {
      result.push(path);
    }
  }
  return result.sort();
}

function compareTrees(committedRoot, regeneratedRoot) {
  const committedFiles = generatedFiles(committedRoot).map((path) =>
    relative(committedRoot, path),
  );
  const regeneratedPaths = generatedFiles(regeneratedRoot).map((path) =>
    relative(regeneratedRoot, path),
  );
  if (JSON.stringify(committedFiles) !== JSON.stringify(regeneratedPaths)) {
    throw new Error(
      `Generated contract file set drifted under ${relative(root, committedRoot)}`,
    );
  }
  for (const path of committedFiles) {
    compareFiles(resolve(committedRoot, path), resolve(regeneratedRoot, path));
  }
}

function compareFiles(committedPath, regeneratedPath) {
  if (
    !statSync(committedPath).isFile() ||
    !statSync(regeneratedPath).isFile()
  ) {
    throw new Error(
      `Generated contract output is not a regular file: ${committedPath}`,
    );
  }
  if (!readFileSync(committedPath).equals(readFileSync(regeneratedPath))) {
    throw new Error(
      `Generated contract drift: run pnpm contracts:generate (${relative(root, committedPath)})`,
    );
  }
}

function validateOpenAPISamples(document) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: false,
  });
  addFormats(ajv);
  ajv.addSchema(document, "golem-intel-openapi");

  const runDetail = loadSample("run-detail.succeeded.json");
  const compareReport = loadSample("report.compare.json");
  const researchReport = loadSample("report.research.json");
  const validateRun = compile("Run");
  const validateRunDetail = compile("RunDetail");
  const validateReport = compile("ComparisonReport");
  const validateImportEvidence = compile("ImportEvidenceEntry");

  assertValid(validateRunDetail, runDetail, "run-detail.succeeded.json");
  const run = structuredClone(runDetail);
  delete run.events;
  delete run.artifacts;
  assertValid(validateRun, run, "run header projected from run detail");
  assertInvalid(
    validateRun,
    runDetail,
    "Run must reject RunDetail-only properties (allOf/additionalProperties regression)",
  );
  assertValid(validateReport, compareReport, "report.compare.json");
  assertValid(validateReport, researchReport, "report.research.json");
  assertValid(
    validateImportEvidence,
    {
      observation_id: "obs-1", entity_id: "northstar-labs", entity_name: "Northstar Labs", platform: "youtube",
      content_id: null, dimension: null, metric: "followers", metric_definition_version: "v1",
      numerator: null, denominator: null, value: 100, unit: "followers", published_at: null,
      observed_at: "2026-07-01T00:00:00Z", recorded_at: "2026-07-01T00:00:00Z",
      valid_from: "2026-07-01T00:00:00Z", valid_to: null, source_url: "https://example.invalid/northstar",
      native_id: "native-1", connector_version: "local.competitive-pulse-import@1.0.0", classification: "observed",
      confidence: 1, artifact_hash: "a".repeat(64), extraction_pointer: "obs-1", freshness_seconds: 0,
      availability: "available", coverage: 1, acquisition_mode: "user_import", data_class: "public",
      permitted_purpose: "competitive_research", retention_until: "2026-10-01T00:00:00Z", rights_state: "permitted",
    },
    "typed imported evidence entry",
  );

  assertInvalid(
    validateRunDetail,
    { ...runDetail, unexpected_contract_field: true },
    "RunDetail must reject unevaluated properties",
  );
  assertInvalid(
    validateReport,
    { ...compareReport, source_budget: 10 },
    "comparison report must reject research controls",
  );
  const researchWithoutPlan = structuredClone(researchReport);
  researchWithoutPlan.research_plan = [];
  assertInvalid(
    validateReport,
    researchWithoutPlan,
    "research report must contain a bounded research plan",
  );

  function compile(name) {
    return ajv.compile({
      $ref: `golem-intel-openapi#/components/schemas/${name}`,
    });
  }
}

function loadSample(name) {
  return JSON.parse(
    readFileSync(resolve(root, "contracts/openapi/samples", name), "utf8"),
  );
}

function assertValid(validate, value, label) {
  if (!validate(value)) {
    throw new Error(
      `${label} violates its OpenAPI schema: ${formatErrors(validate)}`,
    );
  }
}

function assertInvalid(validate, value, label) {
  if (validate(value)) throw new Error(`${label}: invalid sample was accepted`);
}

function formatErrors(validate) {
  return (validate.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}
