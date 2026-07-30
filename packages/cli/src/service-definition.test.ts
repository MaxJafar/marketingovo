import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createServiceDefinition,
  quoteSystemdArgument,
  quoteWindowsArgument,
  serviceDefinitionPath,
  validateCredentialBrokerPath,
  WINDOWS_TASK_NAME,
} from "./service-definition.js";

function executableFixture(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), "agentseo-service-definition-"));
  const path = join(directory, name);
  writeFileSync(path, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

describe("background service definitions", () => {
  it("writes valid escaped launchd argv and persists only the broker path", () => {
    const broker = validateCredentialBrokerPath(
      executableFixture('broker & <vault> "official"'),
    );
    const definition = createServiceDefinition({
      platform: "darwin",
      homeDirectory: "/Users/SEO & Growth",
      userId: 501,
      executable: '/Applications/Golem & SEO/node "24"',
      cliPath: "/Users/SEO & Growth/golem<seo>/cli.js",
      dataDirectory: "/Users/SEO & Growth/Data's <local>",
      credentialBrokerPath: broker,
    });

    expect(definition.content).toContain(
      "<string>/Applications/Golem &amp; SEO/node &quot;24&quot;</string>",
    );
    expect(definition.content).toContain(
      "<string>/Users/SEO &amp; Growth/golem&lt;seo&gt;/cli.js</string>",
    );
    expect(definition.content).toContain(
      "<string>--credential-broker</string>",
    );
    expect(definition.content).toContain(
      broker
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;"),
    );
    expect(definition.content).not.toContain("master-password");
    expect(definition.installCommands).toEqual([
      [
        "launchctl",
        "bootstrap",
        "gui/501",
        "/Users/SEO & Growth/Library/LaunchAgents/com.golemworkers.agentseo.plist",
      ],
    ]);
  });

  it("quotes systemd argv without invoking a shell or expanding $ and %", () => {
    const broker = validateCredentialBrokerPath(
      executableFixture('broker $vault% "safe"; &'),
    );
    const definition = createServiceDefinition({
      platform: "linux",
      homeDirectory: "/home/SEO Growth",
      executable: "/opt/AGENTseo/node$24%",
      cliPath: '/opt/AGENTseo/cli "release"; rm -rf.js',
      dataDirectory: "/home/SEO Growth/data;$HOME%prod",
      credentialBrokerPath: broker,
    });

    expect(definition.content).toContain(
      'ExecStart="/opt/AGENTseo/node$$24%%" "/opt/AGENTseo/cli \\"release\\"; rm -rf.js" "serve" "--data-dir" "/home/SEO Growth/data;$$HOME%%prod" "--credential-broker"',
    );
    expect(definition.content).toContain(quoteSystemdArgument(broker));
    expect(definition.content).not.toContain("master-password");
    expect(definition.installCommands).toEqual([
      ["systemctl", "--user", "daemon-reload"],
      ["systemctl", "--user", "enable", "--now", "agentseo.service"],
    ]);
  });

  it("rejects a non-executable credential broker", () => {
    const directory = mkdtempSync(join(tmpdir(), "agentseo-service-broker-"));
    const broker = join(directory, "broker");
    writeFileSync(broker, "not executable", { mode: 0o600 });
    expect(() => validateCredentialBrokerPath(broker)).toThrow();
  });

  it("creates a least-privilege Windows login task with the complete packaged runtime", () => {
    const dataDirectory = "C:\\Users\\SEO & Growth\\AppData\\Local\\AGENTseo";
    const definition = createServiceDefinition({
      platform: "win32",
      homeDirectory: "C:\\Users\\SEO & Growth",
      windowsUserId: "ACME\\SEO & Growth",
      executable: "C:\\Program Files\\AGENTseo\\node.exe",
      cliPath: "C:\\Program Files\\AGENTseo\\runtime\\app\\dist\\cli.js",
      dataDirectory,
      credentialBrokerPath:
        "C:\\Program Files\\AGENTseo\\runtime\\broker\\credential-broker.exe",
      chromiumExecutable:
        "C:\\Program Files\\AGENTseo\\runtime\\browser\\chrome.exe",
      browserDirectory: "C:\\Program Files\\AGENTseo\\runtime\\browser",
      googleDesktopClientId: "public-client.apps.googleusercontent.com",
    });

    expect(definition.path).toBe(
      serviceDefinitionPath("win32", "C:\\Users\\SEO & Growth", dataDirectory),
    );
    expect(definition.content).toContain(
      "<LogonType>InteractiveToken</LogonType>",
    );
    expect(definition.content).toContain("<RunLevel>LeastPrivilege</RunLevel>");
    expect(definition.content).toContain(
      "<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
    );
    expect(definition.content).toContain("<RestartOnFailure>");
    expect(definition.content).toContain("ACME\\SEO &amp; Growth");
    expect(definition.content).toContain("--chromium-executable");
    expect(definition.content).toContain("--browser-directory");
    expect(definition.content).toContain("--google-desktop-client-id");
    expect(definition.content).toContain(
      "C:\\Program Files\\AGENTseo\\runtime\\app\\dist",
    );
    expect(definition.content).not.toContain("master-password");
    expect(definition.content).not.toContain("<Password>");
    expect(definition.installCommands).toEqual([
      [
        "schtasks.exe",
        "/Create",
        "/TN",
        WINDOWS_TASK_NAME,
        "/XML",
        definition.path,
        "/F",
      ],
      ["schtasks.exe", "/Run", "/TN", WINDOWS_TASK_NAME],
    ]);
  });

  it("can refresh a Windows login task without racing the desktop-owned daemon", () => {
    const definition = createServiceDefinition({
      platform: "win32",
      homeDirectory: "C:\\Users\\SEO",
      windowsUserId: "SEO",
      executable: "C:\\AGENTseo\\node.exe",
      cliPath: "C:\\AGENTseo\\cli.js",
      dataDirectory: "C:\\Users\\SEO\\AGENTseo",
      credentialBrokerPath: "C:\\AGENTseo\\broker.exe",
      startImmediately: false,
    });
    expect(definition.installCommands).toHaveLength(1);
    expect(definition.installCommands[0]).toContain("/Create");
  });

  it("quotes Windows argv without a command interpreter and rejects expansion markers", () => {
    expect(quoteWindowsArgument("plain-value")).toBe("plain-value");
    expect(quoteWindowsArgument("two words")).toBe('"two words"');
    expect(quoteWindowsArgument('value with "quote"')).toBe(
      '"value with \\"quote\\""',
    );
    expect(() => quoteWindowsArgument("%APPDATA%\\AGENTseo")).toThrow(
      "environment expansion marker",
    );
  });

  it("rejects newlines before they can alter a service definition", () => {
    expect(() => quoteSystemdArgument("safe\nEnvironment=LEAKED=1")).toThrow(
      "forbidden control character",
    );
    expect(() => quoteSystemdArgument("safe\u0001invalid-xml")).toThrow(
      "forbidden control character",
    );
  });
});
