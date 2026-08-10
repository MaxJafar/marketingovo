/** Guided setup: the seven-step onboarding checklist and its cards. */
export const onboarding = {
  eyebrow: "Guided setup",
  title: "Reach your first useful insight",
  description:
    "Create a workspace, choose the evidence and outcome, then activate repeat monitoring. A website is optional and unlocks crawling and audits.",
  apiUnavailableTitle: "The local API is unavailable",
  progressLabel: "Onboarding progress",
  progressSummary: "Step {current} of {total}: {label}.",
  stepCompleted: "Completed.",
  stepOptionalIncomplete: "Optional, not completed.",
  stepCurrent: "Current step.",
  stepIncomplete: "Not completed.",
  steps: {
    createWorkspace: {
      label: "Create a workspace",
      description: "Name the brand this workspace is for.",
    },
    addWebsite: {
      label: "Add a website",
      description: "Optional. Required only for crawling and SEO audits.",
    },
    connectData: {
      label: "Connect data",
      description: "Connect a source or choose crawl-only analysis.",
    },
    chooseGoal: {
      label: "Choose a goal",
      description: "Tell the audit what outcome matters now.",
    },
    runBaseline: {
      label: "Run a baseline",
      description: "Create your first technical snapshot.",
    },
    reviewActions: {
      label: "Review actions",
      description: "Choose the highest-value next move.",
    },
    activateMonitoring: {
      label: "Activate monitoring",
      description: "Schedule repeat audits for regressions.",
    },
  },
  goals: {
    technicalHealth: {
      title: "Improve technical health",
      description:
        "Prioritize indexability, crawlability, performance, and regressions.",
    },
    qualifiedTraffic: {
      title: "Grow qualified traffic",
      description:
        "Find pages and queries with the strongest realistic upside.",
    },
    organicKeyEvents: {
      title: "Increase organic key events",
      description:
        "Weight recommendations by analytics and conversion exposure.",
    },
    contentOpportunities: {
      title: "Plan content opportunities",
      description:
        "Surface topic gaps and turn demand into an evidence-backed plan.",
    },
  },
  loading: {
    kicker: "Checking local API",
    title: "Loading your workspace…",
    body: "The dashboard is confirming whether a site is already configured.",
  },
  create: {
    kicker: "Step 1 of 7",
    title: "Create your first workspace",
    body: "A workspace holds this brand’s channels, research and notes. A website is optional — add one only if you want crawling and SEO audits.",
    notAddedTitle: "Site was not added",
    addedTitle: "Site added",
    addedBody:
      "Continue by connecting at least one source or choosing crawl-only analysis.",
    nameLabel: "Workspace name",
    urlLabel: "Canonical URL",
    optional: "Optional",
    urlHelp:
      "Leave blank to work on social, ads and research first. You can add a website any time from Settings.",
    creating: "Creating workspace…",
    submit: "Create workspace",
  },
  workspace: {
    kicker: "Active workspace",
    noWebsite: "No website — crawling and audits are off.",
  },
  evidence: {
    kicker: "Step 3 of 7",
    title: "Choose your evidence",
    body: "Connect platforms your team trusts, or start with crawl data and add integrations later. Missing sources reduce confidence; they never become fake zeroes.",
    connectedIntegrations: "connected integrations",
    crawlOnlyTitle: "Crawl-only analysis selected",
    crawlOnlyBody:
      "The baseline can run now. Connect GSC or GA4 later to improve confidence and exposure scoring.",
    manageIntegrations: "Manage integrations",
    crawlOnlyButton: "Continue with crawl data only",
  },
  goal: {
    kicker: "Step 4 of 7",
    title: "Choose the outcome that matters now",
    body: "The selected goal is stored with the audit run so its purpose is explicit in history and agent workflows.",
    groupLabel: "Primary SEO goal",
  },
  baseline: {
    kicker: "Step 5 of 7",
    title: "Build the baseline",
    body: "A full audit gives actions URL-level evidence and creates a reference point for monitoring.",
    needsWebsiteTitle: "This step needs a website",
    needsWebsiteBefore: "A baseline audit crawls your site. Add a website in",
    needsWebsiteLink: "Settings",
    needsWebsiteAfter:
      "to unlock it, or skip ahead — the rest of this workspace works without one.",
    chooseGoalTitle: "Choose a goal first",
    chooseGoalBody: "Select the outcome above before starting the baseline.",
    notStartedTitle: "Audit could not start",
    queuedTitle: "Audit queued",
    queuedBody:
      "Track the run from audit history. Actions unlock only after a completed or partial result is available.",
    privateAccessSummary: "Private-site access",
    privateAccessLabel:
      "Allow this exact hostname to access a private network for this audit",
    privateAccessHelp:
      "{host} only. Loopback and private addresses remain blocked unless you approve this host; cloud metadata always stays blocked.",
    starting: "Starting audit…",
    run: "Run baseline audit",
    viewHistory: "View audit history",
  },
  firstMove: {
    kicker: "Step 6 of 7",
    title: "Choose the first move",
    body: "Compare impact, effort, confidence, and source evidence before committing resources. This step unlocks only after the baseline produces a completed or partial result.",
    reviewActions: "Review prioritized actions",
    lockedReason: "Waiting for a completed baseline run.",
  },
  monitoring: {
    kicker: "Step 7 of 7",
    title: "Activate local monitoring",
    body: "Create a durable weekly audit at 06:00 every Monday in your local timezone. You can change the cadence from Monitoring.",
    notActivatedTitle: "Monitoring was not activated",
    activatedTitle: "Monitoring activated",
    activatedBody:
      "The local background service will run the weekly schedule while it is available.",
    activeTitle: "Monitoring is active",
    activeBody: "At least one enabled schedule protects this property.",
    activating: "Activating monitoring…",
    activate: "Activate weekly monitoring",
    manage: "Manage monitoring",
    lockedReason:
      "Complete the baseline and open prioritized actions before activating monitoring.",
  },
} as const;
