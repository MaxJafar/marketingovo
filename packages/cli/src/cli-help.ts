export function renderCliHelp(version: string): string {
  return `Marketingovo ${version}

Usage:
  marketingovo serve [--port 3210] [--data-dir PATH] [--credential-broker PATH] [--master-password-file PATH]
  marketingovo project list|create|show|export|import|delete
  marketingovo audit <project-id> [--render static|js] [--collect-vitals]
  marketingovo osint <project-id> [public-target-url ...] [--max-urls N]
  marketingovo run list|show|compare|links|replay|watch|cancel|issues
  marketingovo issue list <project-id> [--status STATE] [--severity LEVEL] [--search TEXT] | review <project-id> <fingerprint> <open|ignored|false-positive> [--reason-file PATH]
  marketingovo context show <project-id> | update <project-id> --profile-file PATH --change-summary-file PATH | append <project-id> <kind> --title-file PATH --detail-file PATH [--source-run ID]
  marketingovo integration list | test <provider> [--project ID] | remove <provider>
  marketingovo extraction templates
  marketingovo migrate <legacy-project-directory>
  marketingovo backup <destination.db>
  marketingovo restore <backup.db> --confirm [--expected-sha256 HASH]
  marketingovo service install --credential-broker PATH [--chromium-executable PATH] [--browser-directory PATH] [--google-desktop-client-id ID] | status | uninstall
  marketingovo doctor

Connection options:
  --data-dir PATH             Data root (MARKETINGOVO_DATA_DIR)
  --service-token-file PATH   Service token file (MARKETINGOVO_SERVICE_TOKEN_FILE)
  --api-url URL               Loopback API URL (MARKETINGOVO_API_URL)
  --port PORT                 Port for the default API URL only (default: 3210)
`;
}
