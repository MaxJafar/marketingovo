import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as contracts from "../packages/contracts/dist/index.js";

const requiredSchemas = [
  "ActionSchema",
  "CapabilitiesSchema",
  "ExtractionPreviewSchema",
  "ExtractionRuleSchema",
  "ExtractionRuleSetVersionSchema",
  "ExtractionRuleTemplateCatalogSchema",
  "ExtractionRuleWorkspaceSchema",
  "IssueInstanceSchema",
  "ProblemDetailsSchema",
  "ProjectOverviewSchema",
  "ProjectDeletionReceiptSchema",
  "ProjectSchema",
  "RunEventSchema",
  "RunComparisonSchema",
  "RunEvidencePageSchema",
  "RunLinkExplorerSchema",
  "RunReplaySchema",
  "RunSchema",
  "ScheduleSchema",
  "StartRunInputSchema",
];

for (const name of requiredSchemas) {
  assert.ok(contracts[name], `Missing public schema: ${name}`);
  assert.doesNotThrow(
    () => JSON.stringify(contracts[name]),
    `Schema is not serializable: ${name}`,
  );
}

const runStatuses = contracts.RunStatusSchema.anyOf.map((entry) => entry.const);
assert.deepEqual(runStatuses, [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

const workflowIds = contracts.StartRunInputSchema.properties.workflowId.anyOf
  .filter((entry) => typeof entry.const === "string")
  .map((entry) => entry.const);
assert.deepEqual(workflowIds, [
  "audit",
  "compare",
  "keyword-research",
  "content-plan",
]);

const serializedOverview = JSON.stringify(contracts.ProjectOverviewSchema);
assert.ok(
  !serializedOverview.includes('"$ref"'),
  "ProjectOverview must be self-contained for OpenAPI generation",
);

const openapi = JSON.parse(
  readFileSync(
    new URL("../packages/server/dist/openapi.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(
  openapi.openapi,
  "3.0.3",
  "The generated document must be OpenAPI 3.0.3",
);

const requiredOperations = [
  ["get", "/api/v1/health"],
  ["get", "/api/v1/capabilities"],
  ["get", "/api/v1/projects"],
  ["post", "/api/v1/projects"],
  ["delete", "/api/v1/projects/{id}"],
  ["get", "/api/v1/projects/{id}/overview"],
  ["get", "/api/v1/extraction-rule-templates"],
  ["get", "/api/v1/projects/{id}/extraction-rules"],
  ["put", "/api/v1/projects/{id}/extraction-rules"],
  ["post", "/api/v1/projects/{id}/extraction-rules/preview"],
  ["post", "/api/v1/runs"],
  ["get", "/api/v1/runs"],
  ["get", "/api/v1/runs/{id}"],
  ["get", "/api/v1/runs/{id}/comparison"],
  ["get", "/api/v1/runs/{id}/evidence"],
  ["get", "/api/v1/runs/{id}/links"],
  ["post", "/api/v1/runs/{id}/replay"],
  ["post", "/api/v1/runs/{id}/cancel"],
  ["get", "/api/v1/runs/{id}/events"],
  ["get", "/api/v1/runs/{id}/issues"],
  ["get", "/api/v1/runs/{id}/report"],
  ["get", "/api/v1/actions"],
  ["patch", "/api/v1/actions/{id}"],
  ["get", "/api/v1/integrations"],
  ["patch", "/api/v1/integrations/{provider}/configuration"],
  ["post", "/api/v1/integrations/{provider}/credentials"],
  ["post", "/api/v1/integrations/{provider}/auth/start"],
  ["get", "/api/v1/integrations/{provider}/auth/callback"],
  ["post", "/api/v1/integrations/{provider}/test"],
  ["delete", "/api/v1/integrations/{provider}"],
  ["get", "/api/v1/schedules"],
  ["post", "/api/v1/schedules"],
  ["patch", "/api/v1/schedules/{id}"],
  ["delete", "/api/v1/schedules/{id}"],
  ["post", "/api/v1/export"],
  ["post", "/api/v1/import"],
];

function operation(method, path) {
  const result = openapi.paths?.[path]?.[method];
  assert.ok(result, `OpenAPI is missing ${method.toUpperCase()} ${path}`);
  return result;
}

for (const [method, path] of requiredOperations) operation(method, path);

assert.deepEqual(
  Object.keys(openapi.paths ?? {}).filter((path) =>
    path.startsWith("/api/v1/maxjafar/"),
  ),
  [],
  "OpenAPI must not expose legacy hosted MaxJafar routes",
);

assert.ok(
  openapi.components?.securitySchemes?.localServiceToken,
  "OpenAPI is missing local service-token authentication",
);
assert.ok(
  openapi.components?.securitySchemes?.localSession,
  "OpenAPI is missing the HttpOnly local-session scheme",
);
assert.ok(
  !openapi.components?.securitySchemes?.legacyLocalSession,
  "OpenAPI must not expose a second accepted session cookie; the rebrand retired the legacy scheme rather than widening the authenticated surface",
);
assert.deepEqual(
  openapi.security,
  [{ localServiceToken: [] }, { localSession: [] }],
  "OpenAPI must require the local service token or the canonical local session by default",
);

const publicOperations = [
  ["get", "/api/v1/health"],
  ["get", "/api/v1/capabilities"],
  ["get", "/api/v1/openapi.json"],
  ["post", "/api/v1/session/bootstrap"],
  ["get", "/api/v1/integrations/{provider}/auth/callback"],
];
for (const [method, path] of publicOperations) {
  assert.deepEqual(
    operation(method, path).security,
    [],
    `${method.toUpperCase()} ${path} must be explicitly public`,
  );
}

assert.deepEqual(
  operation("post", "/api/v1/session/bootstrap-token").security,
  [{ localServiceToken: [] }],
  "Only the local service token may mint dashboard bootstrap tickets",
);

const publicKeys = new Set(
  publicOperations.map(([method, path]) => `${method} ${path}`),
);
for (const [method, path] of requiredOperations) {
  const key = `${method} ${path}`;
  if (publicKeys.has(key)) continue;
  assert.notDeepEqual(
    operation(method, path).security,
    [],
    `${method.toUpperCase()} ${path} must inherit local authentication`,
  );
}

const runStart = operation("post", "/api/v1/runs");
assert.ok(
  runStart.responses?.["202"],
  "POST /runs must document its asynchronous 202 response",
);
assert.equal(
  runStart.responses?.["200"],
  undefined,
  "POST /runs must not claim a synchronous 200 response",
);
const idempotencyHeader = runStart.parameters?.find(
  (parameter) =>
    parameter.in === "header" && parameter.name === "idempotency-key",
);
assert.ok(
  idempotencyHeader?.required,
  "POST /runs must require Idempotency-Key",
);
assert.ok(
  idempotencyHeader.schema?.minLength >= 8,
  "Idempotency-Key must have a meaningful minimum length",
);

const runReplay = operation("post", "/api/v1/runs/{id}/replay");
assert.ok(
  runReplay.responses?.["202"],
  "POST /runs/{id}/replay must document its asynchronous 202 response",
);
assert.equal(
  runReplay.responses?.["200"],
  undefined,
  "POST /runs/{id}/replay must not claim a synchronous 200 response",
);
const replayIdempotencyHeader = runReplay.parameters?.find(
  (parameter) =>
    parameter.in === "header" && parameter.name === "idempotency-key",
);
assert.ok(
  replayIdempotencyHeader?.required,
  "POST /runs/{id}/replay must require Idempotency-Key",
);
assert.ok(
  replayIdempotencyHeader.schema?.minLength >= 8,
  "Replay Idempotency-Key must have a meaningful minimum length",
);

const extractionPreview = operation(
  "post",
  "/api/v1/projects/{id}/extraction-rules/preview",
);
assert.ok(
  extractionPreview.responses?.["200"],
  "Extraction preview must document its synchronous bounded response",
);
assert.equal(
  extractionPreview.responses?.["202"],
  undefined,
  "Single-page extraction preview must not claim to queue a durable audit",
);
assert.ok(
  extractionPreview.responses?.["422"],
  "Extraction preview must document unsafe rule and target rejection",
);

const eventContent = operation("get", "/api/v1/runs/{id}/events").responses?.[
  "200"
]?.content;
assert.deepEqual(
  Object.keys(eventContent ?? {}),
  ["text/event-stream"],
  "Run progress must be documented as Server-Sent Events",
);

const reportContent = operation("get", "/api/v1/runs/{id}/report").responses?.[
  "200"
]?.content;
assert.deepEqual(
  Object.keys(reportContent ?? {}).sort(),
  ["application/json", "application/pdf", "text/csv", "text/html"],
  "The report endpoint must document every supported artifact type",
);
assert.ok(
  operation("get", "/api/v1/runs/{id}/report").responses?.["200"]?.headers?.[
    "content-disposition"
  ],
  "Report downloads must document Content-Disposition",
);

const exportOperation = operation("post", "/api/v1/export");
assert.deepEqual(
  Object.keys(exportOperation.responses?.["200"]?.content ?? {}),
  ["application/vnd.agentseo.project+json"],
  "Project export must use the versioned AGENTseo bundle media type",
);
const importOperation = operation("post", "/api/v1/import");
assert.deepEqual(
  Object.keys(importOperation.requestBody?.content ?? {}).sort(),
  ["application/json", "application/vnd.agentseo.project+json"],
  "Project import must accept JSON and the AGENTseo bundle media type",
);
assert.ok(
  importOperation.responses?.["201"],
  "Project import must document 201 Created",
);

const deleteProject = operation("delete", "/api/v1/projects/{id}");
const deleteProjectSchema =
  deleteProject.requestBody?.content?.["application/json"]?.schema;
assert.ok(
  deleteProjectSchema?.required?.includes("confirmation"),
  "Project deletion must require exact-name confirmation",
);
assert.equal(
  deleteProjectSchema?.additionalProperties,
  false,
  "Project deletion must reject unrecognized confirmation fields",
);
assert.ok(
  deleteProject.responses?.["422"],
  "Project deletion must document confirmation mismatch",
);

const runEvidence = operation("get", "/api/v1/runs/{id}/evidence");
const evidenceSection = runEvidence.parameters?.find(
  (parameter) => parameter.in === "query" && parameter.name === "section",
);
assert.deepEqual(
  evidenceSection?.schema?.enum ??
    evidenceSection?.schema?.anyOf?.flatMap((entry) => entry.enum ?? []),
  ["crawl", "redirects", "hreflang", "extractions"],
  "Run evidence must expose only the documented evidence sections",
);
const evidenceLimit = runEvidence.parameters?.find(
  (parameter) => parameter.in === "query" && parameter.name === "limit",
);
assert.equal(
  evidenceLimit?.schema?.maximum,
  250,
  "Run evidence pagination must retain the 250-record response boundary",
);

const runLinks = operation("get", "/api/v1/runs/{id}/links");
const linkDirection = runLinks.parameters?.find(
  (parameter) => parameter.in === "query" && parameter.name === "direction",
);
assert.deepEqual(
  linkDirection?.schema?.enum ??
    linkDirection?.schema?.anyOf?.flatMap((entry) => entry.enum ?? []),
  ["inlinks", "outlinks"],
  "Run links must expose only the documented graph directions",
);
const linkPageUrl = runLinks.parameters?.find(
  (parameter) => parameter.in === "query" && parameter.name === "pageUrl",
);
assert.ok(linkPageUrl?.required, "Run links must require an exact page URL");
const linkLimit = runLinks.parameters?.find(
  (parameter) => parameter.in === "query" && parameter.name === "limit",
);
assert.equal(
  linkLimit?.schema?.maximum,
  250,
  "Run links pagination must retain the 250-edge response boundary",
);

for (const [method, path] of requiredOperations) {
  const responses = operation(method, path).responses ?? {};
  assert.ok(
    Object.keys(responses).length > 0,
    `${method.toUpperCase()} ${path} has no documented responses`,
  );
  for (const [status, response] of Object.entries(responses)) {
    if (Number(status) < 400) continue;
    const mediaTypes = Object.keys(response.content ?? {});
    assert.deepEqual(
      mediaTypes,
      ["application/problem+json"],
      `${method.toUpperCase()} ${path} ${status} must use application/problem+json`,
    );
  }
}

for (const [method, path] of requiredOperations) {
  for (const parameterName of path.matchAll(/\{([^}]+)\}/g)) {
    const parameter = operation(method, path).parameters?.find(
      (entry) => entry.in === "path" && entry.name === parameterName[1],
    );
    assert.ok(
      parameter?.required,
      `${method.toUpperCase()} ${path} must document path parameter ${parameterName[1]}`,
    );
  }
}

const credentialsSchema = operation(
  "post",
  "/api/v1/integrations/{provider}/credentials",
).requestBody?.content?.["application/json"]?.schema?.properties?.credentials;
assert.equal(
  credentialsSchema?.writeOnly,
  true,
  "Connector credentials must be write-only in OpenAPI",
);

const serializedOpenapi = JSON.stringify(openapi);
for (const forbidden of [
  "accessToken",
  "refreshToken",
  "secretRef",
  "deviceToken",
  "clientSecret",
  "client_secret",
]) {
  assert.ok(
    !serializedOpenapi.includes(forbidden),
    `OpenAPI leaks internal credential field ${forbidden}`,
  );
}

process.stdout.write(
  `Validated ${requiredSchemas.length} public schemas, ${requiredOperations.length} API operations, authentication, async jobs, media types, Problem Details, and secret boundaries.\n`,
);
