import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";

export const LAUNCH_LOOP_SCHEMA_VERSION = "marketingovo.launch-loop.v1";

const ALLOWED_STATUSES = new Set(["ready", "active", "paused", "complete"]);
const ALLOWED_FEEDBACK_STATUSES = new Set([
  "new",
  "triaged",
  "converted",
  "deferred",
  "closed",
]);
const ALLOWED_NEXT_TEST_STATUSES = new Set(["planned", "active", "complete"]);
const ALLOWED_FEEDBACK_CATEGORIES = new Set([
  "setup",
  "data",
  "scoring",
  "workflow",
  "trust",
  "channel",
]);
const ALLOWED_FEEDBACK_CHANNELS = new Set([
  "github",
  "linkedin",
  "x",
  "community",
  "direct",
  "issue",
]);
const REQUIRED_PHASES = [
  "prepare",
  "publish",
  "observe",
  "classify",
  "convert",
  "verify",
  "repeat",
];
const REQUIRED_EVIDENCE = Object.freeze({
  "release-status": {
    kind: "release",
    source: "docs/release-status.md",
    command: "pnpm check",
    state: "declared",
  },
  "osint-evaluation": {
    kind: "evaluation",
    source: "fixtures/osint-research-v1/manifest.json",
    command: "pnpm benchmark",
    state: "verified",
  },
  "launch-kit": {
    kind: "content",
    source: "launch/README.md",
    command: "pnpm validate:launch-loop",
    state: "verified",
  },
});
const SENSITIVE_KEYS = new Set([
  "accountId",
  "cookie",
  "credential",
  "email",
  "emailAddress",
  "ipAddress",
  "password",
  "phone",
  "rawMessage",
  "rawUrl",
  "token",
]);
const PLACEHOLDER = /^(?:tbd|todo|unknown|anonymous|n\/a|none)$/iu;

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function text(value, label, { allowPlaceholder = false } = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  const result = value.trim();
  if (!allowPlaceholder && PLACEHOLDER.test(result)) {
    throw new Error(`${label} cannot be a placeholder`);
  }
  return result;
}

function finiteNumber(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number or null`);
  }
  return value;
}

function isoTimestamp(value, label, now) {
  const timestamp = Date.parse(text(value, label));
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000) {
    throw new Error(
      `${label} must be a valid timestamp no more than five minutes in the future`,
    );
  }
  return timestamp;
}

function safeRelativePath(value, label, root) {
  const candidate = text(value, label);
  if (isAbsolute(candidate) || candidate.includes("\\")) {
    throw new Error(`${label} must be a repository-relative POSIX path`);
  }
  const absolute = resolve(root, candidate);
  const escaped = relative(root, absolute);
  if (escaped === "" || escaped.startsWith("..") || isAbsolute(escaped)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { relative: candidate, absolute };
}

function assertNoSensitiveKeys(value, path = "launch-loop") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSensitiveKeys(item, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      throw new Error(`${path}.${key} is not allowed in launch notes`);
    }
    assertNoSensitiveKeys(item, `${path}.${key}`);
  }
}

async function assertSourceExists(root, source, label) {
  const { absolute } = safeRelativePath(source, label, root);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error(`${label} is not a file`);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("is not a file")) {
      throw error;
    }
    throw new Error(`${label} does not exist: ${source}`);
  }
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const id = text(item.id, `${label}[${index}].id`);
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/u.test(id)) {
      throw new Error(`${label}[${index}].id must be lowercase kebab-case`);
    }
    if (ids.has(id)) throw new Error(`Duplicate ${label} id ${id}`);
    ids.add(id);
  }
  return ids;
}

export async function validateLaunchLoop(
  manifest,
  { root, packageVersion, now = Date.now() } = {},
) {
  const repositoryRoot = root ?? resolve(import.meta.dirname, "..");
  const packageJson = packageVersion
    ? { version: packageVersion }
    : JSON.parse(
        await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
      );
  const loop = object(manifest, "launch loop");
  assertNoSensitiveKeys(loop);
  if (loop.schemaVersion !== LAUNCH_LOOP_SCHEMA_VERSION) {
    throw new Error(`launch loop schema must be ${LAUNCH_LOOP_SCHEMA_VERSION}`);
  }
  const cycleId = text(loop.cycleId, "launch loop cycleId");
  if (!/^\d{4}-\d{2}-[a-z0-9-]+$/u.test(cycleId)) {
    throw new Error("launch loop cycleId must be YYYY-MM-slug");
  }
  if (loop.productVersion !== packageJson.version) {
    throw new Error(
      `launch loop productVersion ${String(loop.productVersion)} must match package version ${packageJson.version}`,
    );
  }
  if (!ALLOWED_STATUSES.has(loop.status)) {
    throw new Error(`Unsupported launch loop status ${String(loop.status)}`);
  }
  text(loop.ownerRole, "launch loop ownerRole");
  if (loop.primaryCta !== "install-from-source") {
    throw new Error(
      "launch loop primaryCta must remain install-from-source until another channel is verified",
    );
  }

  const cadence = object(loop.cadence, "launch loop cadence");
  text(cadence.review, "launch loop cadence.review");
  text(cadence.publish, "launch loop cadence.publish");
  if (
    !Number.isInteger(cadence.feedbackSlaDays) ||
    cadence.feedbackSlaDays < 1 ||
    cadence.feedbackSlaDays > 30
  ) {
    throw new Error(
      "launch loop cadence.feedbackSlaDays must be an integer from 1 to 30",
    );
  }

  if (
    !Array.isArray(loop.evidence) ||
    loop.evidence.length < Object.keys(REQUIRED_EVIDENCE).length
  ) {
    throw new Error(
      "launch loop needs release, evaluation, and launch-kit evidence",
    );
  }
  const evidenceIds = uniqueIds(loop.evidence, "launch loop evidence");
  for (const [id, expected] of Object.entries(REQUIRED_EVIDENCE)) {
    if (!evidenceIds.has(id))
      throw new Error(`Missing required launch evidence ${id}`);
    const entry = loop.evidence.find((item) => item.id === id);
    if (
      entry.kind !== expected.kind ||
      entry.source !== expected.source ||
      entry.command !== expected.command
    ) {
      throw new Error(
        `Launch evidence ${id} must name its canonical source and command`,
      );
    }
    if (entry.state !== expected.state) {
      throw new Error(`Launch evidence ${id} must use state ${expected.state}`);
    }
    text(entry.note, `launch loop evidence ${id}.note`);
    await assertSourceExists(
      repositoryRoot,
      entry.source,
      `launch loop evidence ${id}.source`,
    );
  }

  if (!Array.isArray(loop.signals) || loop.signals.length < 3) {
    throw new Error("launch loop needs at least three measured signals");
  }
  uniqueIds(loop.signals, "launch loop signal");
  for (const [index, signal] of loop.signals.entries()) {
    const label = `launch loop signal[${index}]`;
    text(signal.label, `${label}.label`);
    text(signal.unit, `${label}.unit`);
    finiteNumber(signal.value, `${label}.value`, { nullable: true });
    finiteNumber(signal.baseline, `${label}.baseline`, { nullable: true });
    finiteNumber(signal.target, `${label}.target`);
    text(signal.window, `${label}.window`);
    text(signal.source, `${label}.source`);
    text(signal.caveat, `${label}.caveat`);
  }
  if (loop.status === "ready") {
    if (loop.feedback?.length !== 0)
      throw new Error(
        "A ready launch loop cannot contain feedback observations",
      );
    if (loop.signals.some((signal) => signal.value !== null)) {
      throw new Error(
        "A ready launch loop cannot claim measured signal values",
      );
    }
  }

  if (!Array.isArray(loop.feedback) || loop.feedback.length > 50) {
    throw new Error(
      "launch loop feedback must be an array with at most 50 items",
    );
  }
  uniqueIds(loop.feedback, "launch loop feedback");
  for (const [index, item] of loop.feedback.entries()) {
    const label = `launch loop feedback[${index}]`;
    if (!ALLOWED_FEEDBACK_CATEGORIES.has(item.category)) {
      throw new Error(`${label}.category is not an allowed feedback category`);
    }
    if (!ALLOWED_FEEDBACK_CHANNELS.has(item.channel)) {
      throw new Error(`${label}.channel is not an allowed feedback channel`);
    }
    if (!ALLOWED_FEEDBACK_STATUSES.has(item.status)) {
      throw new Error(`${label}.status is not an allowed feedback status`);
    }
    isoTimestamp(item.observedAt, `${label}.observedAt`, now);
    text(item.summary, `${label}.summary`);
    text(item.evidenceSource, `${label}.evidenceSource`);
    text(item.nextAction, `${label}.nextAction`);
    await assertSourceExists(
      repositoryRoot,
      item.evidenceSource,
      `${label}.evidenceSource`,
    );
  }

  if (
    !Array.isArray(loop.steps) ||
    loop.steps.length !== REQUIRED_PHASES.length
  ) {
    throw new Error(
      `launch loop must contain exactly ${REQUIRED_PHASES.length} operating phases`,
    );
  }
  const phases = loop.steps.map((step, index) => {
    const label = `launch loop steps[${index}]`;
    text(step.id, `${label}.id`);
    const phase = text(step.phase, `${label}.phase`);
    text(step.ownerRole, `${label}.ownerRole`);
    text(step.exitEvidence, `${label}.exitEvidence`);
    return phase;
  });
  if (JSON.stringify(phases) !== JSON.stringify(REQUIRED_PHASES)) {
    throw new Error(`launch loop phases must be ${REQUIRED_PHASES.join(", ")}`);
  }

  const nextTest = object(loop.nextTest, "launch loop nextTest");
  text(nextTest.id, "launch loop nextTest.id");
  if (!ALLOWED_NEXT_TEST_STATUSES.has(nextTest.status)) {
    throw new Error("launch loop nextTest.status is not an allowed status");
  }
  text(nextTest.ownerRole, "launch loop nextTest.ownerRole");
  text(nextTest.hypothesis, "launch loop nextTest.hypothesis");
  text(nextTest.measure, "launch loop nextTest.measure");
  text(nextTest.decisionRule, "launch loop nextTest.decisionRule");
  await assertSourceExists(
    repositoryRoot,
    nextTest.evidenceSource,
    "launch loop nextTest.evidenceSource",
  );

  if (!Array.isArray(loop.notes) || loop.notes.length === 0) {
    throw new Error(
      "launch loop needs an explicit note about claim boundaries",
    );
  }
  loop.notes.forEach((note, index) =>
    text(note, `launch loop notes[${index}]`),
  );

  return {
    schemaVersion: LAUNCH_LOOP_SCHEMA_VERSION,
    cycleId,
    productVersion: packageJson.version,
    status: loop.status,
    evidenceCount: loop.evidence.length,
    signalCount: loop.signals.length,
    feedbackCount: loop.feedback.length,
    nextTest: nextTest.id,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = resolve(import.meta.dirname, "..");
  const manifest = JSON.parse(
    await readFile(resolve(root, "launch/launch-loop.json"), "utf8"),
  );
  const report = await validateLaunchLoop(manifest, { root });
  process.stdout.write(
    `Validated launch loop ${report.cycleId}: ${report.status}; ${report.evidenceCount} evidence items, ${report.signalCount} signals, ${report.feedbackCount} feedback items; next test ${report.nextTest}.\n`,
  );
}
