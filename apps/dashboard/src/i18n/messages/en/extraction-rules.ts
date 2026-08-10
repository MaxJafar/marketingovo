/** Custom extraction rules card: editor, template library, safe live preview. */
export const extractionRules = {
  eyebrow: "Evidence configuration",
  title: "Custom extraction rules",
  description:
    "Capture prices, authors, product IDs, CMS markers, or any other page field on every audit. Rules belong to this project and each saved revision remains available for reproducible run replay.",
  currentRuleSet: "Current rule set",
  revisionLabel: "Revision {revision}",
  loadingRules: "Loading extraction rules…",
  preparingEditor: "Preparing the extraction editor…",
  rulesUnavailableTitle: "Extraction rules unavailable",
  revisionSavedTitle: "Rule revision saved",
  revisionSavedBody:
    "New audits will snapshot this revision. Existing runs and their evidence remain unchanged.",
  revisionRejectedTitle: "Rule revision was rejected",
  captureOptions: {
    text: "Text content",
    html: "Inner HTML",
    attribute: "Attribute",
  },
  template: {
    eyebrow: "Review-first library",
    title: "Extraction templates",
    description:
      "Start from a curated evidence pack, inspect every selector, then add it to the unsaved draft. Templates never write a revision or start a crawl on their own.",
    policyPill: "Review required",
    loading: "Loading extraction templates…",
    catalogUnavailableTitle: "Template catalog unavailable",
    gridLabel: "Templates",
    review: "Review {name}",
    fieldsCount: "{count} fields",
    addedTitle: "Template added to draft",
    addedBody:
      "{name} fields are ready for review or preview below. Nothing is persisted until you provide a revision summary and choose Save revision.",
    reviewEyebrow: "Draft import review",
    closeReview: "Close review",
    previewOn: "Preview on",
    beforeSaving: "Before saving",
    beforeSavingBody:
      "Preview a representative URL and remove or rename fields that do not match this site.",
    assumptionsLabel: "Assumptions to verify",
    fieldsTable: "{name} fields",
    fieldColumn: "Field",
    selectorColumn: "CSS selector",
    captureColumn: "Capture",
    attributeCapture: "Attribute: {attribute}",
    conflictTitle: "Resolve field conflicts",
    conflictBodyOne:
      "Rename or remove the existing draft field: {labels}. Template labels must stay unique.",
    conflictBodyMany:
      "Rename or remove the existing draft fields: {labels}. Template labels must stay unique.",
    capacityTitle: "Rule limit exceeded",
    capacityBody:
      "This pack would exceed the 50-rule project boundary. Remove draft rules before importing it.",
    addFieldsOne: "Add {count} field to draft",
    addFieldsMany: "Add {count} fields to draft",
    freshIdsNote:
      "Fresh rule IDs are created locally; catalog IDs are never persisted as if they were user-owned configuration.",
  },
  editor: {
    listLabel: "Extraction rules",
    empty:
      "No rules yet. Add one to turn page-specific data into auditable evidence.",
    ruleLegend: "Rule {number}",
    enabled: "Enabled",
    removeRule: "Remove rule {number}",
    remove: "Remove",
    fieldLabel: "Field label",
    capture: "Capture",
    cssSelector: "CSS selector",
    attributeName: "Attribute name",
    regexLabel: "Safe regex filter",
    regexOptional: "(optional)",
    regexHelp:
      "Capture group 1 is kept when present. Backreferences, lookarounds, and ambiguous repetition are rejected.",
    addRule: "Add rule",
    revisionSummary: "Revision summary",
    savingRevision: "Saving revision…",
    saveRevision: "Save revision",
  },
  preview: {
    title: "Safe live preview",
    description:
      "Fetch one URL on the project's exact origin through the same redirect-aware egress policy used by audits. Draft rules are never saved by previewing them.",
    failedTitle: "Preview failed",
    pageUrl: "Page URL",
    rendering: "Rendering",
    renderOptions: {
      static: "Static HTML",
      js: "JavaScript",
    },
    allowPrivateHost: "Allow this exact private host",
    allowPrivateHostHelp:
      "Required only for localhost or an approved internal site. Cloud metadata addresses remain blocked.",
    renderingPreview: "Rendering preview…",
    previewDraft: "Preview draft",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} ms",
    finalUrl: "Final URL",
    resultsTable: "Extraction preview results",
    fieldColumn: "Field",
    resultColumn: "Result",
    noMatch: "No match",
    truncated: "Value truncated at the evidence boundary.",
  },
} as const;
