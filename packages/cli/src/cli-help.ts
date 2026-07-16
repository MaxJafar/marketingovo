export function renderCliHelp(version: string): string {
  return `AGENTseo ${version}

Usage:
  agentseo serve [--port 3210] [--data-dir PATH] [--credential-broker PATH] [--master-password-file PATH]
  agentseo project list|create|show|export|import|delete
  agentseo audit <project-id> [--render static|js] [--collect-vitals]
  agentseo run list|show|compare|links|replay|watch|cancel|issues
  agentseo issue list <project-id> [--status STATE] [--severity LEVEL] [--search TEXT] | review <project-id> <fingerprint> <open|ignored|false-positive> [--reason-file PATH]
  agentseo context show <project-id> | update <project-id> --profile-file PATH --change-summary-file PATH | append <project-id> <kind> --title-file PATH --detail-file PATH [--source-run ID]
  agentseo integration list | test <provider> [--project ID] | remove <provider>
  agentseo extraction templates
  agentseo migrate <legacy-project-directory>
  agentseo backup <destination.db>
  agentseo restore <backup.db> --confirm [--expected-sha256 HASH]
  agentseo service install --credential-broker PATH [--chromium-executable PATH] [--browser-directory PATH] [--google-desktop-client-id ID] | status | uninstall
  agentseo doctor

Connection options:
  --data-dir PATH             Data root (AGENTSEO_DATA_DIR)
  --service-token-file PATH   Service token file (AGENTSEO_SERVICE_TOKEN_FILE)
  --api-url URL               Loopback API URL (AGENTSEO_API_URL)
  --port PORT                 Port for the default API URL only (default: 3210)
`;
}
