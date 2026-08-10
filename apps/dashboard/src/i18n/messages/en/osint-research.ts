/** Public-web OSINT page: pass form, dossier cards, trust, findings, history. */
export const osintResearch = {
  eyebrow: "Product priority · intelligence layer",
  title: "Public-web OSINT",
  description:
    "Build a bounded, source-linked dossier from your site and up to four explicitly supplied public targets. The graph preserves what was observed without turning missing data into a claim.",
  available: "Available",
  sourceLink: "source",
  citedEvidenceOne: "{count} cited evidence item",
  citedEvidenceMany: "{count} cited evidence items",
  confidencePct: "{confidence}% confidence",
  evidence: {
    confidence: "{label} · {confidence}% confidence",
    observedAt: "· observed {date}",
    claimLabel: "· claim",
  },
  form: {
    title: "Start an evidence pass",
    description:
      "The project site is included automatically. Add public competitor, partner, newsroom, or reference URLs when they are in scope.",
    targetsLabel: "Additional public targets",
    targetsHelp:
      "Up to four URLs, one per line. HTTPS only; no credentials, cookies, account probes, or people-search pivots.",
    queueing: "Queueing public-web research…",
    run: "Run OSINT pass",
    invalidTarget: "Use an explicit public https:// URL: {url}",
    rejectedTitle: "Target list was not accepted",
    failedTitle: "OSINT run could not start",
    queuedTitle: "OSINT run queued",
    queuedBody:
      "The run is being collected with public-web limits. This page will refresh when its evidence dossier is persisted.",
  },
  target: {
    eyebrow: "Target dossier",
    pagesObserved: "Pages observed",
    availableEvidence: "Available evidence",
    graphEntities: "Graph entities",
    graphLinks: "Graph links",
    finalUrl: "Final URL:",
    publishingSignalTitle: "Public publishing signal",
    cadenceItemsOne: "{count} dated item in the observed feed",
    cadenceItemsMany: "{count} dated items in the observed feed",
    cadenceUnavailable: "; cadence is unavailable without a measured interval.",
    cadenceAverage: "; average interval {days} days.",
    cadenceDisclaimer: "This is publication evidence, not reach or engagement.",
    notObservedTitle: "Target was not fully observed",
  },
  coverage: {
    title: "Coverage and policy",
    description:
      "Every observation keeps its source and evidence state. A missing signal is never turned into zero.",
    coverage: "Coverage",
    targetsCompleted: "Targets completed",
    pagesObserved: "Pages observed",
    evidenceAvailable: "Evidence available",
    publicWebOnly: "Public web only",
    personalDataDisabled: "Personal data disabled",
    identityResolutionDisabled: "Identity resolution disabled",
    authenticatedCollectionDisabled: "Authenticated collection disabled",
    darkWebDisabled: "Dark web disabled",
  },
  trust: {
    title: "Trust and provenance",
    description:
      "Stable claim fingerprints make repeat passes auditable without presenting a public-web observation as independently verified truth.",
    claimFingerprints: "Claim fingerprints",
    sourceUrlsRecorded: "Source URLs recorded",
    integrityRecord: "Integrity record",
    recorded: "Recorded",
    incomplete: "Incomplete",
    legacyDossier: "Legacy dossier",
    fingerprintAlgorithm: "Fingerprint algorithm",
    evidenceDigest: "Evidence digest:",
    olderFormatTitle: "Older dossier format",
    olderFormatBody:
      "This saved pass predates claim fingerprints. Run a new public-web pass to record provenance for every observation.",
    fingerprintScope:
      "Fingerprints cover the observed claim fields and intentionally exclude capture time. The digest detects report changes; it does not certify that a source is accurate or authoritative.",
  },
  findings: {
    title: "Findings",
    description:
      "Descriptive, evidence-linked observations from the public web.",
    empty: "No findings were supported by the observed evidence.",
  },
  history: {
    title: "Pass history",
    comparedDescription:
      "Cited public-web changes since {date}. A blocked target is excluded instead of being treated as a disappearance.",
    firstPassDescription:
      "Run a second public-web pass to compare exact signals over time.",
    baseline:
      "The first pass establishes the baseline. Later passes report added, removed, and changed evidence without making identity claims.",
    noChanges: "No supported public signal changed since the previous pass.",
    targetLabel: "· target",
  },
  dossiers: {
    title: "Target dossiers",
    generatedOne: "Generated {date} · {count} bounded source target.",
    generatedMany: "Generated {date} · {count} bounded source targets.",
  },
  limitations: {
    title: "Known limitations",
    description:
      "These constraints are part of the dossier contract, not a hidden gap in the UI.",
  },
  noDossierTitle: "No OSINT dossier yet",
  noDossierBody:
    "Run a public-web pass above to create the first evidence-linked dossier for this project.",
} as const;
