import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateLaunchLoop } from "./validate-launch-loop.mjs";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "launch/launch-loop.json"), "utf8"),
);

function draft() {
  return structuredClone(manifest);
}

test("the committed launch loop is readiness-only and evidence-linked", async () => {
  const report = await validateLaunchLoop(manifest, {
    root,
    packageVersion: "1.1.0",
    now: Date.parse("2026-08-03T12:00:00.000Z"),
  });
  assert.deepEqual(report, {
    schemaVersion: "marketingovo.launch-loop.v1",
    cycleId: "2026-08-initial-public-loop",
    productVersion: "1.1.0",
    status: "ready",
    evidenceCount: 3,
    signalCount: 3,
    feedbackCount: 0,
    nextTest: "first-run-osint-option",
  });
});

test("the loop fails closed when release claims or evidence drift", async () => {
  for (const mutate of [
    (value) => (value.productVersion = "9.9.9"),
    (value) => (value.evidence[0].command = "echo passed"),
    (value) => (value.evidence[1].state = "planned"),
    (value) => (value.steps = value.steps.slice(1)),
    (value) => (value.signals[0].source = ""),
  ]) {
    const value = draft();
    mutate(value);
    await assert.rejects(
      validateLaunchLoop(value, {
        root,
        packageVersion: "1.1.0",
        now: Date.parse("2026-08-03T12:00:00.000Z"),
      }),
    );
  }
});

test("the loop rejects personal data and unmeasured claims in ready state", async () => {
  const sensitive = draft();
  sensitive.feedback = [
    {
      id: "feedback-1",
      category: "trust",
      channel: "github",
      status: "new",
      observedAt: "2026-08-03T10:00:00.000Z",
      summary: "A reviewer asked for source states.",
      evidenceSource: "launch/README.md",
      nextAction: "Add a source-state example.",
      email: "reviewer@example.invalid",
    },
  ];
  await assert.rejects(
    validateLaunchLoop(sensitive, {
      root,
      packageVersion: "1.1.0",
      now: Date.parse("2026-08-03T12:00:00.000Z"),
    }),
    /not allowed/u,
  );

  const measured = draft();
  measured.signals[0].value = 1;
  await assert.rejects(
    validateLaunchLoop(measured, {
      root,
      packageVersion: "1.1.0",
      now: Date.parse("2026-08-03T12:00:00.000Z"),
    }),
    /ready launch loop cannot claim measured/u,
  );
});
