const PRIORITY_ORDER = new Map([
  ["High", 4],
  ["Medium", 3],
  ["Low", 2],
  ["Info", 1],
]);

function assertProbability(value, label) {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new Error(`${label} must be a number between 0 and 1`);
  }
}

function normalizePath(path) {
  if (path === null) return null;
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(
      `Benchmark paths must start with /; received ${String(path)}`,
    );
  }
  const parsed = new URL(path, "https://benchmark.invalid");
  return `${parsed.pathname}${parsed.search}`;
}

export function issueInstanceKey(ruleId, path) {
  if (typeof ruleId !== "string" || ruleId.trim().length === 0) {
    throw new Error("Benchmark ruleId must be a non-empty string");
  }
  return `${ruleId.trim()}::${normalizePath(path) ?? "@site"}`;
}

export function validateCorpusManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Benchmark manifest must be an object");
  }
  if (!Array.isArray(manifest.expectedInstances)) {
    throw new Error("Benchmark manifest expectedInstances must be an array");
  }
  if (!Array.isArray(manifest.controlPaths)) {
    throw new Error("Benchmark manifest controlPaths must be an array");
  }
  assertProbability(manifest.minimumRecall, "minimumRecall");
  assertProbability(
    manifest.maximumHighSeverityFalsePositiveRate,
    "maximumHighSeverityFalsePositiveRate",
  );
  if (
    !Number.isInteger(manifest.minimumLabeledInstances) ||
    manifest.minimumLabeledInstances < 1
  ) {
    throw new Error("minimumLabeledInstances must be a positive integer");
  }
  if (
    !Number.isInteger(manifest.minimumControlPaths) ||
    manifest.minimumControlPaths < 1
  ) {
    throw new Error("minimumControlPaths must be a positive integer");
  }
  if (manifest.expectedInstances.length < manifest.minimumLabeledInstances) {
    throw new Error(
      `Benchmark corpus has ${manifest.expectedInstances.length} labeled instances; at least ${manifest.minimumLabeledInstances} are required`,
    );
  }
  if (manifest.controlPaths.length < manifest.minimumControlPaths) {
    throw new Error(
      `Benchmark corpus has ${manifest.controlPaths.length} control paths; at least ${manifest.minimumControlPaths} are required`,
    );
  }

  const expectedKeys = new Set();
  for (const instance of manifest.expectedInstances) {
    if (!instance || typeof instance !== "object") {
      throw new Error("Each expected benchmark instance must be an object");
    }
    if (!PRIORITY_ORDER.has(instance.priority)) {
      throw new Error(
        `Unsupported expected priority ${String(instance.priority)} for ${String(instance.ruleId)}`,
      );
    }
    const key = issueInstanceKey(instance.ruleId, instance.path);
    if (expectedKeys.has(key)) {
      throw new Error(`Duplicate expected benchmark instance ${key}`);
    }
    expectedKeys.add(key);
  }

  const controlPaths = manifest.controlPaths.map(normalizePath);
  if (controlPaths.some((path) => path === null)) {
    throw new Error("Control paths cannot use the site-level null path");
  }
  if (new Set(controlPaths).size !== controlPaths.length) {
    throw new Error("Benchmark controlPaths must be unique");
  }
  return manifest;
}

function pathFromUrl(value) {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

export function observedIssueInstances(issues) {
  const byKey = new Map();
  for (const issue of issues) {
    if (!issue || typeof issue !== "object") continue;
    const ruleId = issue.id;
    if (typeof ruleId !== "string" || ruleId.length === 0) continue;
    const priority = PRIORITY_ORDER.has(issue.priority)
      ? issue.priority
      : "Info";
    const paths =
      Array.isArray(issue.urls) && issue.urls.length > 0
        ? issue.urls.map(pathFromUrl)
        : [null];
    for (const path of paths) {
      const key = issueInstanceKey(ruleId, path);
      const previous = byKey.get(key);
      if (
        !previous ||
        PRIORITY_ORDER.get(priority) > PRIORITY_ORDER.get(previous.priority)
      ) {
        byKey.set(key, { key, ruleId, path, priority });
      }
    }
  }
  return [...byKey.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function assessCorpus(manifestInput, issues) {
  const manifest = validateCorpusManifest(manifestInput);
  const observed = observedIssueInstances(issues);
  const observedByKey = new Map(
    observed.map((instance) => [instance.key, instance]),
  );
  const expected = manifest.expectedInstances
    .map((instance) => ({
      ...instance,
      path: normalizePath(instance.path),
      key: issueInstanceKey(instance.ruleId, instance.path),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const expectedByKey = new Map(
    expected.map((instance) => [instance.key, instance]),
  );
  const found = expected.filter((instance) => observedByKey.has(instance.key));
  const missed = expected.filter(
    (instance) => !observedByKey.has(instance.key),
  );
  const priorityMismatches = found
    .filter(
      (instance) =>
        observedByKey.get(instance.key)?.priority !== instance.priority,
    )
    .map((instance) => ({
      key: instance.key,
      expected: instance.priority,
      observed: observedByKey.get(instance.key)?.priority,
    }));
  const expectedHigh = new Set(
    expected
      .filter((instance) => instance.priority === "High")
      .map((instance) => instance.key),
  );
  const highObserved = observed.filter(
    (instance) => instance.priority === "High",
  );
  const unexpectedHigh = highObserved.filter(
    (instance) => !expectedHigh.has(instance.key),
  );
  const controlPaths = new Set(manifest.controlPaths.map(normalizePath));
  const unexpectedHighOnControls = unexpectedHigh.filter((instance) =>
    controlPaths.has(instance.path),
  );
  const recall = expected.length === 0 ? 0 : found.length / expected.length;
  const highSeverityFalsePositiveRate =
    highObserved.length === 0 ? 0 : unexpectedHigh.length / highObserved.length;
  const correctnessPassed =
    recall >= manifest.minimumRecall &&
    highSeverityFalsePositiveRate <=
      manifest.maximumHighSeverityFalsePositiveRate &&
    priorityMismatches.length === 0 &&
    unexpectedHighOnControls.length === 0;

  return {
    labeledInstanceCount: expected.length,
    observedInstanceCount: observed.length,
    controlPathCount: controlPaths.size,
    recall,
    highSeverityFalsePositiveRate,
    found: found.map((instance) => instance.key),
    missed: missed.map((instance) => instance.key),
    unexpectedHigh: unexpectedHigh.map((instance) => instance.key),
    unexpectedHighOnControls: unexpectedHighOnControls.map(
      (instance) => instance.key,
    ),
    priorityMismatches,
    observedInstances: observed,
    unlabelledObserved: observed
      .filter((instance) => !expectedByKey.has(instance.key))
      .map((instance) => instance.key),
    correctnessPassed,
  };
}
