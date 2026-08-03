import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runOsintResearch } from "../packages/core/dist/index.js";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "fixtures/osint-research-v1/manifest.json");

const EXPECTED_POLICY = {
  collection: "public_web_only",
  personalData: "disabled",
  identityResolution: "disabled",
  authenticatedCollection: "disabled",
  darkWebCollection: "disabled",
};

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalizedTarget(value) {
  const url = new URL(requiredText(value, "target URL"));
  if (url.protocol !== "https:")
    throw new Error(`OSINT fixture target must use HTTPS: ${url.href}`);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `OSINT fixture target must not carry credentials or state: ${url.href}`,
    );
  }
  url.pathname = url.pathname || "/";
  return url.href;
}

function dedupeTargets(values) {
  const seen = new Set();
  const targets = [];
  for (const value of values) {
    const target = normalizedTarget(value);
    if (seen.has(target)) continue;
    seen.add(target);
    targets.push(target);
    if (targets.length === 5) break;
  }
  return targets;
}

function validateManifest(manifest) {
  if (!record(manifest))
    throw new Error("OSINT fixture manifest must be an object");
  assert.equal(manifest.schemaVersion, "marketingovo.osint-evaluation.v1");
  assert.equal(manifest.version, 1);
  const observedAt = requiredText(manifest.observedAt, "manifest.observedAt");
  assert.doesNotThrow(() => new Date(observedAt).toISOString());
  if (!Array.isArray(manifest.cases) || manifest.cases.length < 4) {
    throw new Error("OSINT fixture manifest needs at least four cases");
  }
  const ids = new Set();
  for (const fixture of manifest.cases) {
    if (!record(fixture))
      throw new Error("Each OSINT fixture case must be an object");
    const id = requiredText(fixture.id, "fixture.id");
    if (ids.has(id)) throw new Error(`Duplicate OSINT fixture case ${id}`);
    ids.add(id);
    if (!Array.isArray(fixture.targetUrls) || fixture.targetUrls.length === 0) {
      throw new Error(`Fixture ${id} needs at least one target URL`);
    }
    for (const target of fixture.targetUrls) {
      const parsed = new URL(normalizedTarget(target));
      if (!fixture.privateTarget && !parsed.hostname.endsWith(".invalid")) {
        throw new Error(
          `Fixture ${id} must use a reserved .invalid target host: ${parsed.hostname}`,
        );
      }
    }
    if (fixture.pages !== undefined && !Array.isArray(fixture.pages)) {
      throw new Error(`Fixture ${id}.pages must be an array`);
    }
    if (fixture.pageTemplate !== undefined && !record(fixture.pageTemplate)) {
      throw new Error(`Fixture ${id}.pageTemplate must be an object`);
    }
    if (!record(fixture.expect)) {
      throw new Error(`Fixture ${id}.expect must be an object`);
    }
    if (
      fixture.pages === undefined &&
      fixture.pageTemplate === undefined &&
      !fixture.crawlError &&
      !fixture.privateTarget
    ) {
      throw new Error(
        `Fixture ${id} needs pages, pageTemplate, or an explicit failure`,
      );
    }
  }
  return manifest;
}

export async function loadOsintManifest() {
  return validateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
}

function parsedPage(target, spec) {
  const value = record(spec) ?? {};
  const finalUrl = normalizedTarget(value.finalUrl ?? value.url ?? target);
  const canonical =
    typeof value.canonical === "string"
      ? value.canonical.replaceAll("{{TARGET}}", target)
      : (value.canonical ?? null);
  return {
    finalUrl,
    htmlLang: "en",
    title: value.title ?? null,
    metaDescription: value.metaDescription ?? null,
    canonical,
    robotsMeta: null,
    hreflang: [],
    h1: [],
    h2: [],
    images: [],
    imagesWithoutDimensions: [],
    picturesMissingImg: 0,
    internalLinks: Array.isArray(value.internalLinks)
      ? value.internalLinks
      : [],
    externalLinks: Array.isArray(value.externalLinks)
      ? value.externalLinks
      : [],
    nofollowLinks: [],
    wordCount: 32,
    text: "Synthetic public-web evaluation page.",
    hasViewport: true,
    viewportContent: "width=device-width",
    domNodeCount: 12,
    duplicateIds: [],
    ogTitle: null,
    ogDescription: null,
    jsonLd: Array.isArray(value.jsonLd) ? value.jsonLd : [],
  };
}

function pageFor(target, spec) {
  const value = record(spec) ?? {};
  const url = normalizedTarget(
    String(value.url ?? target).replaceAll("{{TARGET}}", target),
  );
  return {
    url,
    finalUrl: normalizedTarget(
      String(value.finalUrl ?? url).replaceAll("{{TARGET}}", target),
    ),
    status: 200,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: 512,
    redirectChain: [],
    headers: record(value.headers) ?? {},
    robotsAllowed:
      value.robotsAllowed === undefined ? true : value.robotsAllowed,
    parsed: parsedPage(target, { ...value, url }),
    error: null,
    fetchDurationMs: 1,
    extractions: [],
  };
}

function fixturePages(fixture, target) {
  if (Array.isArray(fixture.pages))
    return fixture.pages.map((page) => pageFor(target, page));
  if (record(fixture.pageTemplate))
    return [pageFor(target, fixture.pageTemplate)];
  return [];
}

function fixtureOutcome(fixture, target, observedAt) {
  const pages = fixturePages(fixture, target);
  return {
    report: {
      startUrl: target,
      sitemap: fixture.sitemap,
    },
    runId: `fixture-${fixture.id}`,
    index: {
      startUrl: target,
      pages: new Map(pages.map((page) => [page.url, page])),
      robots: new Map(),
      finishedAt: observedAt,
      durationMs: 1,
      config: {},
    },
  };
}

function noFeed(target) {
  return {
    target,
    cadence: null,
    unavailable: "no-feed-discovered",
  };
}

function fixtureCadence(fixture, target) {
  const configured = record(fixture.cadence);
  if (!configured) return noFeed(target);
  return {
    ...configured,
    target,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertDossierInvariants(dossier, calls) {
  assert.equal(dossier.schemaVersion, "osint-dossier.v1");
  assert.equal(dossier.workflow, "osint-research");
  assert.deepEqual(dossier.policy, EXPECTED_POLICY);
  assert.ok(Number.isInteger(dossier.sourceBudget));
  assert.ok(dossier.sourceBudget >= 1 && dossier.sourceBudget <= 5);
  assert.match(dossier.generatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(dossier.provenance.captureMethod, "same_origin_public_crawl");
  assert.equal(dossier.provenance.claimHashAlgorithm, "sha256");
  assert.match(dossier.provenance.evidenceDigest, /^[a-f0-9]{64}$/u);

  const evidence = dossier.targets.flatMap((target) => target.evidence);
  const claimHashes = evidence.map((item) => item.claimHash).sort();
  assert.equal(dossier.provenance.evidenceCount, evidence.length);
  assert.equal(
    dossier.provenance.evidenceDigest,
    sha256(JSON.stringify(claimHashes)),
  );
  assert.equal(
    dossier.provenance.sourceCount,
    new Set(
      evidence
        .map((item) => item.sourceUrl)
        .filter((sourceUrl) => sourceUrl !== null),
    ).size,
  );

  const evidenceIds = new Set();
  for (const item of evidence) {
    assert.match(item.claimHash, /^[a-f0-9]{64}$/u);
    assert.equal(item.sourceClass, "public_web");
    assert.match(item.observedAt, /^\d{4}-\d{2}-\d{2}T/u);
    if (item.sourceUrl !== null) {
      const source = new URL(item.sourceUrl);
      assert.equal(source.protocol, "https:");
    }
    assert.equal(
      evidenceIds.has(item.id),
      false,
      `duplicate evidence id ${item.id}`,
    );
    evidenceIds.add(item.id);
  }
  for (const finding of dossier.findings) {
    for (const evidenceId of finding.evidenceIds) {
      assert.equal(
        evidenceIds.has(evidenceId),
        true,
        `finding cites unknown evidence ${evidenceId}`,
      );
    }
  }
  for (const target of dossier.targets) {
    const entityIds = new Set();
    for (const item of target.entities) {
      assert.equal(item.exactMatch, true);
      assert.equal(
        entityIds.has(item.id),
        false,
        `duplicate entity id ${item.id}`,
      );
      entityIds.add(item.id);
    }
    for (const edge of target.relationships) {
      assert.equal(entityIds.has(edge.fromEntityId), true);
      assert.equal(entityIds.has(edge.toEntityId), true);
      for (const evidenceId of edge.evidenceIds) {
        assert.equal(evidenceIds.has(evidenceId), true);
      }
    }
  }
  assert.equal(calls.length, dossier.targets.length);
  for (const call of calls) {
    assert.equal(call.limits.allowPrivate, false);
    assert.deepEqual(call.privateHostAllowlist, []);
  }
}

function findEvidence(target, expected) {
  return target.evidence.find((item) =>
    Object.entries(expected).every(([key, value]) => {
      if (key === "value")
        return JSON.stringify(item.value) === JSON.stringify(value);
      return item[key] === value;
    }),
  );
}

function assertFixtureExpectation(fixture, dossier) {
  const expected = record(fixture.expect) ?? {};
  const targets = dossier.targets;
  if (expected.targetCount !== undefined)
    assert.equal(targets.length, expected.targetCount);
  if (expected.targetUrls !== undefined) {
    assert.deepEqual(
      targets.map((target) => target.targetUrl),
      expected.targetUrls,
    );
  }
  if (expected.coverageState !== undefined)
    assert.equal(dossier.coverage.state, expected.coverageState);
  if (expected.targetStatus !== undefined) {
    for (const target of targets)
      assert.equal(target.status, expected.targetStatus);
  }
  if (expected.pagesObserved !== undefined) {
    for (const target of targets)
      assert.equal(target.pagesObserved, expected.pagesObserved);
  }
  const primary = targets[0];
  assert.ok(primary, `${fixture.id} produced no primary target`);
  for (const item of expected.requiredEvidence ?? []) {
    assert.ok(
      findEvidence(primary, item),
      `${fixture.id} missing evidence ${JSON.stringify(item)}`,
    );
  }
  for (const item of expected.requiredEvidenceStates ?? []) {
    assert.ok(
      findEvidence(primary, item),
      `${fixture.id} missing evidence state ${JSON.stringify(item)}`,
    );
  }
  for (const type of expected.requiredRelationshipTypes ?? []) {
    assert.ok(
      primary.relationships.some((item) => item.type === type),
      `${fixture.id} missing relationship ${type}`,
    );
  }
  for (const title of expected.requiredFindingTitles ?? []) {
    assert.ok(
      dossier.findings.some((item) => item.title === title),
      `${fixture.id} missing finding ${title}`,
    );
  }
  for (const title of expected.absentFindingTitles ?? []) {
    assert.equal(
      dossier.findings.some((item) => item.title === title),
      false,
      `${fixture.id} invented finding ${title}`,
    );
  }
}

export async function evaluateOsintFixtureCase(fixture, observedAt) {
  const calls = [];
  const dossier = await runOsintResearch({
    targetUrls: fixture.targetUrls,
    now: new Date(observedAt),
    crawlFn: async (options) => {
      calls.push({
        startUrl: options.startUrl,
        limits: options.limits,
        privateHostAllowlist: options.privateHostAllowlist,
      });
      if (fixture.privateTarget && options.limits.allowPrivate !== true) {
        throw new Error("fixture private target blocked by public-only policy");
      }
      if (fixture.crawlError) throw new Error(fixture.crawlError);
      return fixtureOutcome(fixture, options.startUrl, observedAt);
    },
    cadenceFn: async (target) => fixtureCadence(fixture, target),
  });
  assertDossierInvariants(dossier, calls);
  assertFixtureExpectation(fixture, dossier);
  return {
    id: fixture.id,
    targets: dossier.targets.length,
    pagesObserved: dossier.coverage.pagesObserved,
    evidenceAvailable: dossier.coverage.evidenceAvailable,
    coverage: dossier.coverage.state,
    evidenceDigest: dossier.provenance.evidenceDigest,
  };
}

export async function evaluateOsintFixtures(manifest) {
  const corpus = manifest ?? (await loadOsintManifest());
  const results = [];
  for (const fixture of corpus.cases) {
    results.push(await evaluateOsintFixtureCase(fixture, corpus.observedAt));
  }
  return {
    corpus: corpus.name,
    corpusVersion: corpus.version,
    caseCount: results.length,
    cases: results,
    passed: true,
  };
}
