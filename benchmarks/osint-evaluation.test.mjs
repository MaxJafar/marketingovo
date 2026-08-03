import test from "node:test";
import {
  evaluateOsintFixtureCase,
  loadOsintManifest,
} from "./osint-fixture-runner.mjs";

const manifest = await loadOsintManifest();

for (const fixture of manifest.cases) {
  test(`OSINT fixture: ${fixture.id}`, async () => {
    await evaluateOsintFixtureCase(fixture, manifest.observedAt);
  });
}
