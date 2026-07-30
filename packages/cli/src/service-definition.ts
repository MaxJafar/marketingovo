import { constants } from "node:fs";
import { accessSync, lstatSync, realpathSync } from "node:fs";
import { join, win32 as windowsPath } from "node:path";

export type ServicePlatform = "darwin" | "linux" | "win32";

export const WINDOWS_TASK_NAME = "AGENTseo Local Service";

export interface ServiceDefinitionOptions {
  platform: ServicePlatform;
  homeDirectory: string;
  userId?: number;
  windowsUserId?: string;
  executable: string;
  cliPath: string;
  dataDirectory: string;
  credentialBrokerPath: string;
  chromiumExecutable?: string;
  browserDirectory?: string;
  googleDesktopClientId?: string;
  startImmediately?: boolean;
}

export interface ServiceDefinition {
  path: string;
  content: string;
  installCommands: string[][];
}

function rejectControlCharacters(value: string, label: string): void {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\r|\n/u.test(value)) {
    throw new Error(`${label} contains a forbidden control character`);
  }
}

export function xmlText(value: string): string {
  rejectControlCharacters(value, "launchd argument");
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function quoteSystemdArgument(value: string): string {
  rejectControlCharacters(value, "systemd argument");
  // systemd does not invoke a shell for ExecStart, but it still performs its
  // own C-style unescaping, environment expansion and %-specifier expansion.
  // Quote every argv element and neutralize those parser-level expansions.
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("$", () => "$$")
    .replaceAll("%", "%%")
    .replaceAll("\t", "\\t")}"`;
}

export function quoteWindowsArgument(value: string): string {
  rejectControlCharacters(value, "Windows task argument");
  if (value.includes("%")) {
    throw new Error(
      "Windows task argument contains a forbidden environment expansion marker",
    );
  }
  if (value.length === 0) return '""';
  if (!/[\s"]/u.test(value)) return value;

  let result = '"';
  let backslashes = 0;
  for (const character of value) {
    if (character === "\\") {
      backslashes += 1;
      continue;
    }
    if (character === '"') {
      result += "\\".repeat(backslashes * 2 + 1);
      result += '"';
      backslashes = 0;
      continue;
    }
    result += "\\".repeat(backslashes);
    result += character;
    backslashes = 0;
  }
  result += "\\".repeat(backslashes * 2);
  return `${result}"`;
}

export function validateCredentialBrokerPath(path: string): string {
  if (!path.trim()) throw new Error("--credential-broker requires a path");
  const canonical = realpathSync(path);
  const metadata = lstatSync(canonical);
  if (!metadata.isFile()) {
    throw new Error(
      `Native credential broker is not a regular file: ${canonical}`,
    );
  }
  accessSync(canonical, constants.X_OK);
  return canonical;
}

export function serviceDefinitionPath(
  platform: ServicePlatform,
  homeDirectory: string,
  dataDirectory?: string,
): string {
  if (platform === "darwin") {
    return join(
      homeDirectory,
      "Library",
      "LaunchAgents",
      "com.golemworkers.agentseo.plist",
    );
  }
  if (platform === "linux") {
    return join(
      homeDirectory,
      ".config",
      "systemd",
      "user",
      "agentseo.service",
    );
  }
  return windowsPath.join(
    dataDirectory ??
      windowsPath.join(homeDirectory, "AppData", "Local", "AGENTseo"),
    "service",
    "agentseo-login-task.xml",
  );
}

export function createServiceDefinition(
  options: ServiceDefinitionOptions,
): ServiceDefinition {
  const args = [
    options.executable,
    options.cliPath,
    "serve",
    "--data-dir",
    options.dataDirectory,
    "--credential-broker",
    options.credentialBrokerPath,
  ];
  if (options.chromiumExecutable) {
    args.push("--chromium-executable", options.chromiumExecutable);
  }
  if (options.browserDirectory) {
    args.push("--browser-directory", options.browserDirectory);
  }
  if (options.googleDesktopClientId) {
    args.push("--google-desktop-client-id", options.googleDesktopClientId);
  }
  for (const [index, value] of args.entries()) {
    rejectControlCharacters(value, `service argument ${index + 1}`);
  }

  const path = serviceDefinitionPath(
    options.platform,
    options.homeDirectory,
    options.dataDirectory,
  );
  if (options.platform === "darwin") {
    if (!Number.isSafeInteger(options.userId) || options.userId! < 0) {
      throw new Error(
        "A valid user ID is required to install the launch agent",
      );
    }
    const programArguments = args
      .map((argument) => `      <string>${xmlText(argument)}</string>`)
      .join("\n");
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.golemworkers.agentseo</string>
    <key>ProgramArguments</key>
    <array>
${programArguments}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
  </dict>
</plist>
`;
    return {
      path,
      content,
      installCommands: [
        ["launchctl", "bootstrap", `gui/${options.userId}`, path],
      ],
    };
  }

  if (options.platform === "linux") {
    const content = `[Unit]
Description=AGENTseo local service
After=network-online.target

[Service]
ExecStart=${args.map(quoteSystemdArgument).join(" ")}
Restart=on-failure
RestartSec=5s
UMask=0077

[Install]
WantedBy=default.target
`;
    return {
      path,
      content,
      installCommands: [
        ["systemctl", "--user", "daemon-reload"],
        ["systemctl", "--user", "enable", "--now", "agentseo.service"],
      ],
    };
  }

  const windowsUserId = options.windowsUserId?.trim();
  if (!windowsUserId) {
    throw new Error(
      "The current Windows user is required to install the login task",
    );
  }
  rejectControlCharacters(windowsUserId, "Windows task user");
  if (windowsUserId.includes("%")) {
    throw new Error(
      "Windows task user contains a forbidden environment expansion marker",
    );
  }
  const commandArguments = args.slice(1).map(quoteWindowsArgument).join(" ");
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>GolemWorkers</Author>
    <Description>Runs the local AGENTseo daemon for durable audits and schedules.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${xmlText(windowsUserId)}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${xmlText(windowsUserId)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlText(options.executable)}</Command>
      <Arguments>${xmlText(commandArguments)}</Arguments>
      <WorkingDirectory>${xmlText(windowsPath.dirname(options.cliPath))}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
  const installCommands = [
    ["schtasks.exe", "/Create", "/TN", WINDOWS_TASK_NAME, "/XML", path, "/F"],
  ];
  if (options.startImmediately !== false) {
    installCommands.push(["schtasks.exe", "/Run", "/TN", WINDOWS_TASK_NAME]);
  }
  return { path, content, installCommands };
}
