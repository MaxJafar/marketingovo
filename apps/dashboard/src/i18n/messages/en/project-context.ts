/** Project context page: versioned profile, journal, and revision history. */
export const projectContext = {
  eyebrow: "Reusable strategy memory",
  title: "Project context",
  description:
    "Keep business goals, audiences, markets, constraints, and decisions beside crawl evidence so every human and agent starts from the same facts.",
  revisionSavedTitle: "Context revision saved",
  revisionSavedBody:
    "The previous revision remains immutable and available in history.",
  revisionNotSavedTitle: "Context was not saved",
  journalAppendedTitle: "Journal entry appended",
  journalAppendedBody:
    "The entry is immutable and now available to local agent resources.",
  journalNotAppendedTitle: "Journal entry was not appended",
  revisionLabel: "Revision {revision}",
  profile: {
    eyebrow: "Versioned profile",
    createFirstRevision: "Create the first revision",
    savedAt: "Saved {date}",
    summaryLabel: "Business and search summary",
    summaryPlaceholder:
      "What does the business offer, to whom, and what must organic search accomplish now?",
    oneItemPerLine: "One item per line.",
    changeSummaryLabel: "Revision summary",
    changeSummaryPlaceholder: "Added UK market and clarified demo conversion",
    changeSummaryHelp:
      "Explain what changed. Saving always creates a new immutable revision.",
    saving: "Saving revision…",
    save: "Save new revision",
  },
  profileLists: {
    audiences: {
      label: "Priority audiences",
      help: "Who must find, trust, and act on this site?",
      placeholder: "Technical SEO leads\nB2B growth teams",
    },
    markets: {
      label: "Markets",
      help: "Countries, regions, or commercial segments that change intent.",
      placeholder: "United States\nUnited Kingdom",
    },
    languages: {
      label: "Languages",
      help: "Use the labels your team recognizes; include locale when relevant.",
      placeholder: "English (en-US)\nGerman (de-DE)",
    },
    conversionGoals: {
      label: "Conversion goals",
      help: "Name the events that make organic work valuable.",
      placeholder: "Qualified demo request\nTrial activation",
    },
    priorityTopics: {
      label: "Priority topics",
      help: "Products, problems, or themes the current strategy must support.",
      placeholder: "Technical SEO automation\nLocal-first analytics",
    },
    competitors: {
      label: "Known competitors",
      help: "Brands or domains used for fair, explicit comparison.",
      placeholder: "example-competitor.com\nAlternative category leader",
    },
    constraints: {
      label: "Constraints and guardrails",
      help: "Legal, brand, platform, migration, or resourcing limits.",
      placeholder:
        "Do not change checkout URLs\nLegal review required for claims",
    },
  },
  journalKinds: {
    observation: "Observation",
    decision: "Decision",
    constraint: "Constraint",
    experiment: "Experiment",
  },
  journalForm: {
    eyebrow: "Append-only journal",
    heading: "Record what changed the strategy",
    kindLabel: "Entry type",
    sourceLabel: "Source audit (optional)",
    noLinkedAudit: "No linked audit",
    titleLabel: "Entry title",
    titlePlaceholder: "UK comparison pages convert qualified demos",
    detailLabel: "Evidence and implication",
    detailPlaceholder:
      "State what was observed or decided, why it matters, and what would invalidate it.",
    appending: "Appending…",
    append: "Append journal entry",
    immutableNote:
      "Entries cannot be edited in place. Add a later decision when evidence changes.",
  },
  journalHistory: {
    heading: "Decision journal",
    description: "Newest entries appear first; sequence numbers never change.",
    sourceRun: "Source run: {id}",
    emptyTitle: "No strategy journal yet",
    emptyDescription:
      "Append an observation, decision, constraint, or experiment when evidence changes how the team should act.",
  },
  revisionHistory: {
    heading: "Revision history",
    description: "Profile revisions are immutable and newest-first.",
  },
} as const;
