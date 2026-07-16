import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCorpus,
  issueInstanceKey,
  observedIssueInstances,
  validateCorpusManifest,
} from "./corpus-metrics.mjs";

function manifest(expectedInstances) {
  return {
    expectedInstances,
    controlPaths: ["/healthy-a", "/healthy-b"],
    minimumLabeledInstances: expectedInstances.length,
    minimumControlPaths: 2,
    minimumRecall: 0.95,
    maximumHighSeverityFalsePositiveRate: 0.05,
  };
}

test("uses rule and exact path as the correctness unit", () => {
  const result = assessCorpus(
    manifest([
      { ruleId: "title-missing", path: "/a", priority: "High" },
      { ruleId: "title-missing", path: "/b", priority: "High" },
    ]),
    [
      {
        id: "title-missing",
        priority: "High",
        urls: ["https://example.test/a"],
      },
    ],
  );
  assert.equal(result.recall, 0.5);
  assert.deepEqual(result.missed, ["title-missing::/b"]);
});

test("deduplicates aggregate issue URLs and preserves the highest priority", () => {
  const instances = observedIssueInstances([
    {
      id: "rule",
      priority: "Low",
      urls: ["https://example.test/a", "https://example.test/a"],
    },
    {
      id: "rule",
      priority: "High",
      urls: ["https://example.test/a"],
    },
  ]);
  assert.deepEqual(instances, [
    {
      key: "rule::/a",
      ruleId: "rule",
      path: "/a",
      priority: "High",
    },
  ]);
});

test("fails unexpected High findings on healthy control pages", () => {
  const result = assessCorpus(
    manifest([{ ruleId: "known", path: "/defect", priority: "High" }]),
    [
      {
        id: "known",
        priority: "High",
        urls: ["https://example.test/defect"],
      },
      {
        id: "surprise",
        priority: "High",
        urls: ["https://example.test/healthy-a"],
      },
    ],
  );
  assert.equal(result.correctnessPassed, false);
  assert.deepEqual(result.unexpectedHighOnControls, ["surprise::/healthy-a"]);
});

test("reports severity drift even when the expected rule and page are found", () => {
  const result = assessCorpus(
    manifest([{ ruleId: "known", path: "/defect", priority: "Medium" }]),
    [
      {
        id: "known",
        priority: "High",
        urls: ["https://example.test/defect"],
      },
    ],
  );
  assert.equal(result.correctnessPassed, false);
  assert.deepEqual(result.priorityMismatches, [
    { key: "known::/defect", expected: "Medium", observed: "High" },
  ]);
});

test("rejects duplicate expected instances and a weakened corpus", () => {
  assert.throws(
    () =>
      validateCorpusManifest({
        ...manifest([
          { ruleId: "known", path: "/defect", priority: "High" },
          { ruleId: "known", path: "/defect", priority: "High" },
        ]),
      }),
    /Duplicate expected benchmark instance/,
  );
  assert.throws(
    () =>
      validateCorpusManifest({
        ...manifest([{ ruleId: "known", path: "/defect", priority: "High" }]),
        minimumLabeledInstances: 2,
      }),
    /at least 2 are required/,
  );
});

test("supports site-level findings without inventing a URL", () => {
  assert.equal(issueInstanceKey("site-rule", null), "site-rule::@site");
  assert.deepEqual(
    observedIssueInstances([{ id: "site-rule", priority: "Low", urls: [] }]),
    [
      {
        key: "site-rule::@site",
        ruleId: "site-rule",
        path: null,
        priority: "Low",
      },
    ],
  );
});
