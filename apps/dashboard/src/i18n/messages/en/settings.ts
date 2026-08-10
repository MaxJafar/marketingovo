export const settings = {
  eyebrow: "Workspace configuration",
  title: "Settings",
  description:
    "Update site identity and the reporting preferences stored with this local project.",
  languageTitle: "Language",
  languageDescription:
    "Interface language for this console on this device. Data, reports, and agent surfaces are not translated.",
  languageLabel: "Interface language",
  savedTitle: "Settings saved",
  savedBody: "The local API accepted the updated workspace settings.",
  notSavedTitle: "Settings were not saved",
  notExportedTitle: "Project was not exported",
  notImportedTitle: "Project was not imported",
  importedTitle: "Project imported",
  importedSummary:
    "Imported {runs} runs, {actions} actions, {contextVersions} context revisions, {contextEntries} journal entries, {extractionRuleVersions} extraction-rule revisions, and {artifacts} report artifacts. Schedules are disabled and {reconnect}.",
  reconnectList: "these integrations must be reconnected: {providers}",
  reconnectNone: "no integration reconnection is required",
  notDeletedTitle: "Project was not deleted",
  deletedTitle: "Local project deleted",
  deletedSummary:
    "Removed {runs} runs, {issueInstances} issue observations, {actions} actions, {extractionRuleVersions} extraction-rule revisions, and {artifacts} artifacts. {cleanup} Global integration credentials were retained for other projects.",
  cleanupComplete: "Filesystem cleanup completed.",
  cleanupScheduled:
    "Filesystem cleanup is scheduled for the next service start.",
  siteIdentity: "Site identity",
  siteName: "Site name",
  canonicalUrl: "Canonical URL",
  reporting: "Reporting",
  timezone: "Timezone",
  reportingCurrency: "Reporting currency",
  retentionTarget: "Local retention target (days)",
  reportPreferences: "Report preferences",
  alertEmail: "Report contact email",
  alertEmailHelp:
    "Stored locally as report metadata. Marketingovo does not send hosted email alerts.",
  weeklyDigest: "Weekly digest preference",
  weeklyDigestHelp:
    "Include weekly priorities, trends, and regressions when generating digest reports.",
  saving: "Saving…",
  save: "Save settings",
  portabilityTitle: "Project portability",
  portabilityBodyBefore: "Export a versioned",
  portabilityBodyAfter:
    "bundle with audit history, actions, metrics, Project Context revisions, the marketer journal, custom rules, connector settings, and bounded report artifacts. Credentials, tokens, cookies, headers, and local file paths are never included.",
  exporting: "Exporting…",
  exportProject: "Export project",
  importing: "Importing…",
  importProject: "Import project",
  importHelp:
    "Imports always create a new local project, remap identifiers, preserve issue fingerprints, context, extraction rules, and the configuration snapshot behind every run, disable imported schedules, and require integrations to be reconnected.",
  dangerZone: "Danger zone",
  deleteTitle: "Delete local project",
  deleteBody1:
    "Permanently remove this project, its runs, raw evidence, action history, Project Context, extraction-rule revisions, schedules, settings, and report artifacts from this device. Export the project first if you may need it again.",
  deleteBody2:
    "Global BYOK credentials are intentionally retained because they may serve other projects. Revoke them separately from Integrations.",
  deleteProject: "Delete project",
  confirmLabel: "Type the project name to confirm",
  confirmHelpBefore: "Enter",
  confirmHelpAfter: "exactly. This action cannot be undone.",
  cancel: "Cancel",
  deleting: "Deleting…",
  permanentlyDelete: "Permanently delete project",
} as const;
