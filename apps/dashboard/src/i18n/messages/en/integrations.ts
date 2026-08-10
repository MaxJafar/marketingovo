/** Integrations page: connector cards and their credential sub-forms. */
export const integrations = {
  eyebrow: "Connected data",
  title: "Integrations",
  description:
    "Bring search, analytics, crawling, and content signals into one defensible decision layer.",
  vaultNoticeTitle: "Credentials stay out of the browser",
  vaultNoticeBody:
    "Secret values are submitted to the local API for encrypted server-side storage. The UI only receives connection status and safe account labels.",
  testFailedTitle: "Connection test failed",
  testCompleteTitle: "Connection test complete",
  testCompleteBody: "The integration status has been refreshed.",
  removedTitle: "Local credential removed",
  removedBody:
    "The provider is disconnected from Marketingovo. Any non-secret site mapping remains available for a later reconnect.",
  cancel: "Cancel",
  credentialForm: {
    apiKeyLabel: "API key",
    title: "Connect {name}",
    intro:
      "Credentials are sent directly to the local API. This dashboard never stores them in browser storage or reads them back.",
    closeAria: "Close credential form",
    textHelp: "Enter the account identifier supplied by the platform.",
    secretHelp:
      "Stored by the API credential vault; never returned to the browser.",
    notSavedTitle: "Credentials were not saved",
    saving: "Saving securely…",
    saveAndConnect: "Save and connect",
    continue: "Continue",
  },
  configurationForm: {
    title: "Configure {name}",
    intro:
      "These non-secret settings are stored per site, so one local workspace can map several sites to different provider properties.",
    closeAria: "Close configuration form",
    help: "This setting contains no secret credential material.",
    notSavedTitle: "Configuration was not saved",
    saving: "Saving…",
    save: "Save configuration",
  },
  removal: {
    title: "Revoke local access to {name}",
    intro:
      "Delete this credential from the operating-system-backed local vault and disconnect it from every local project. Non-secret site mappings stay in place for a later reconnect.",
    closeAria: "Close credential removal",
    providerNoticeTitle: "Provider access may remain active",
    providerNoticeBody:
      "Marketingovo can delete its local copy, but it cannot deactivate an API key or OAuth grant at the provider. Use the provider setup page when you need to revoke the credential at its source.",
    acknowledgement:
      "I understand this disconnects {name} across every local project.",
    notRemovedTitle: "Credential was not removed",
    removing: "Removing…",
    remove: "Remove local credential",
  },
  card: {
    categoryFallback: "Data source",
    descriptionFallback: "No integration description was returned.",
    account: "Account",
    notConnected: "Not connected",
    lastVerifiedSync: "Last verified sync",
    quotaRemaining: "Quota remaining",
    quotaReset: "Quota reset",
    rotateCredentials: "Rotate credentials",
    addOptionalApiKey: "Add optional API key",
    connectApiKey: "Connect API key",
    connectCredentials: "Connect credentials",
    connectAccount: "Connect account",
    reconnectAccount: "Reconnect account",
    editSiteMapping: "Edit site mapping",
    configureSite: "Configure site",
    testConnection: "Test connection",
    revokeAria: "Revoke {name} local access",
    revoke: "Revoke local access",
  },
  emptyTitle: "No integrations available",
  emptyDescription:
    "The API did not return an integration catalog. Check system health and server configuration.",
} as const;
