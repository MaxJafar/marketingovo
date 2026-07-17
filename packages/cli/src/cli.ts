#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ProjectContextJournalKind,
  ProjectContextProfile,
} from "@agentseoapp/contracts";
import {
  EncryptedFileCredentialStore,
  LockedCredentialStore,
  NativeBrokerCredentialStore,
} from "@agentseoapp/credentials";
import { importLegacyData } from "@agentseoapp/legacy-import";
import {
  AgentSeoLocalRuntime,
  defaultDataDirectory,
} from "@agentseoapp/runtime";
import { AgentSeoClient } from "@agentseoapp/sdk";
import { createLocalServer, type LocalServer } from "@agentseoapp/server";
import {
  createDatabaseBackup,
  GolemDatabase,
  restoreDatabaseBackup,
} from "@agentseoapp/storage-sqlite";
import {
  findExistingDashboard,
  issueDashboardUrl,
  startOrReuseLocalService,
  waitForExistingDashboard,
} from "./local-service.js";
import { acquireDataDirectoryDaemonLease } from "./daemon-lease.js";
import {
  createServiceDefinition,
  serviceDefinitionPath,
  validateCredentialBrokerPath,
  WINDOWS_TASK_NAME,
  type ServicePlatform,
} from "./service-definition.js";
import {
  readCompatibleEnvironmentVariable,
  resolveCliConnectionOptions,
  resolveCliDataDirectory,
} from "./compatibility.js";
import { renderCliHelp } from "./cli-help.js";

const VERSION = "0.11.0-alpha.0";

interface ParsedArgs {
  command: string;
  rest: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...tokens] = argv;
  const rest: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split("=", 2);
    if (inline !== undefined) {
      flags.set(name!, inline);
      continue;
    }
    const next = tokens[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name!, next);
      index++;
    } else flags.set(name!, true);
  }
  return { command, rest, flags };
}

function dataDirectory(flags: Map<string, string | boolean>): string {
  return resolveCliDataDirectory({
    flags,
    environment: process.env,
    currentWorkingDirectory: process.cwd(),
    defaultDataDirectory: defaultDataDirectory(),
  });
}

function connectionOptions(flags: Map<string, string | boolean>) {
  return resolveCliConnectionOptions({
    flags,
    environment: process.env,
    currentWorkingDirectory: process.cwd(),
    defaultDataDirectory: defaultDataDirectory(),
  });
}

function dashboardDirectory(): string | undefined {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const bundled = resolve(packageRoot, "dashboard");
  const repository = resolve(process.cwd(), "apps/dashboard/dist");
  return existsSync(join(bundled, "index.html"))
    ? bundled
    : existsSync(join(repository, "index.html"))
      ? repository
      : undefined;
}

interface DesktopRuntimeFlags {
  chromiumExecutable?: string;
  browserDirectory?: string;
  googleDesktopClientId?: string;
}

function optionalStringFlag(
  flags: Map<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags.get(name);
  if (value === true) throw new Error(`--${name} requires a value`);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function desktopRuntimeFlags(
  flags: Map<string, string | boolean>,
): DesktopRuntimeFlags {
  const chromiumValue = optionalStringFlag(flags, "chromium-executable");
  const browserValue = optionalStringFlag(flags, "browser-directory");
  const clientId = optionalStringFlag(flags, "google-desktop-client-id");
  const chromiumExecutable = chromiumValue ? resolve(chromiumValue) : undefined;
  const browserDirectory = browserValue ? resolve(browserValue) : undefined;
  if (chromiumExecutable && !statSync(chromiumExecutable).isFile()) {
    throw new Error(
      `Desktop Chromium executable is not a file: ${chromiumExecutable}`,
    );
  }
  if (browserDirectory && !statSync(browserDirectory).isDirectory()) {
    throw new Error(
      `Desktop browser directory is not a directory: ${browserDirectory}`,
    );
  }
  if (
    clientId &&
    !(
      clientId.length <= 255 &&
      clientId.endsWith(".apps.googleusercontent.com") &&
      !clientId.includes("..") &&
      /^[A-Za-z0-9.-]+$/u.test(clientId)
    )
  ) {
    throw new Error(
      "--google-desktop-client-id is not a valid public client ID",
    );
  }
  return {
    chromiumExecutable,
    browserDirectory,
    googleDesktopClientId: clientId,
  };
}

function applyDesktopRuntimeFlags(options: DesktopRuntimeFlags): void {
  if (options.chromiumExecutable) {
    process.env.AGENTSEO_CHROME_PATH = options.chromiumExecutable;
  }
  if (options.browserDirectory) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = options.browserDirectory;
    process.env.PLAYWRIGHT_SKIP_BROWSER_GC = "1";
  }
  if (options.googleDesktopClientId) {
    process.env.AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID =
      options.googleDesktopClientId;
  }
}

function vaultFor(root: string, flags: Map<string, string | boolean>) {
  const brokerFlag = flags.get("credential-broker");
  const brokerPath =
    typeof brokerFlag === "string"
      ? resolve(brokerFlag)
      : readCompatibleEnvironmentVariable("AGENTSEO_CREDENTIAL_BROKER", [
          "GOLEMSEO_CREDENTIAL_BROKER",
          "GOLEM_SEO_CREDENTIAL_BROKER",
        ]);
  if (brokerPath) {
    if (!existsSync(brokerPath))
      throw new Error(`Native credential broker not found: ${brokerPath}`);
    return new NativeBrokerCredentialStore(brokerPath);
  }
  const passwordFile = flags.get("master-password-file");
  const password =
    typeof passwordFile === "string"
      ? readFileSync(resolve(passwordFile), "utf8").trim()
      : readCompatibleEnvironmentVariable("AGENTSEO_MASTER_PASSWORD", [
          "GOLEMSEO_MASTER_PASSWORD",
          "GOLEM_SEO_MASTER_PASSWORD",
        ]);
  if (!password) {
    process.stderr.write(
      "Warning: credential vault is locked. Restart with --credential-broker, --master-password-file, or AGENTSEO_MASTER_PASSWORD before connecting integrations.\n",
    );
    return new LockedCredentialStore();
  }
  return new EncryptedFileCredentialStore(join(root, "vault.json"), password);
}

async function serve(args: ParsedArgs): Promise<void> {
  const root = dataDirectory(args.flags);
  const runtimeFlags = desktopRuntimeFlags(args.flags);
  applyDesktopRuntimeFlags(runtimeFlags);
  const portValue = args.flags.get("port");
  const port = typeof portValue === "string" ? Number(portValue) : 3210;
  if (!Number.isInteger(port) || port < 1024 || port > 65_535)
    throw new Error("--port must be an integer from 1024 to 65535");
  const printResolution = (
    dashboardUrl: string,
    activePort: number,
    reused: boolean,
  ): void => {
    process.stdout.write(`AGENTseo ${VERSION}\n`);
    process.stdout.write(`Service: ${reused ? "reused" : "started"}\n`);
    process.stdout.write(`Dashboard: ${dashboardUrl}\n`);
    process.stdout.write(`API: http://127.0.0.1:${activePort}/api/v1\n`);
    process.stdout.write(
      `Service token: ${join(root, "service-token")} (0600; never paste it into the dashboard)\n`,
    );
  };

  // Preserve the fast authenticated same-port reuse path before touching the
  // writer lease. This also supports a pre-lease daemon during upgrades.
  const samePortDashboard = await findExistingDashboard(root, port);
  if (samePortDashboard) {
    printResolution(samePortDashboard, port, true);
    return;
  }

  const leaseAttempt = acquireDataDirectoryDaemonLease(root, port);
  if (leaseAttempt.status === "held") {
    const ownerPort = leaseAttempt.owner.port;
    const ownerDashboard = await waitForExistingDashboard(root, ownerPort, {
      attempts: 50,
      intervalMs: 100,
    });
    if (!ownerDashboard) {
      throw new Error(
        `This data directory is owned by AGENTseo PID ${leaseAttempt.owner.pid} on port ${ownerPort}, but its authenticated API is not ready`,
      );
    }
    printResolution(ownerDashboard, ownerPort, true);
    return;
  }

  const lease = leaseAttempt.lease;
  try {
    const resolution = await startOrReuseLocalService<LocalServer>({
      findExisting: () => findExistingDashboard(root, port),
      waitForExisting: () => waitForExistingDashboard(root, port),
      start: async () => {
        const runtime = new AgentSeoLocalRuntime({
          dataDir: root,
          credentialStore: vaultFor(root, args.flags),
          version: VERSION,
        });
        const server = await createLocalServer({
          runtime,
          port,
          dashboardDir: dashboardDirectory(),
          logger: args.flags.has("verbose"),
        });
        try {
          await server.listen();
          return server;
        } catch (error) {
          await server.close().catch(() => undefined);
          throw error;
        }
      },
      issueDashboardUrl: () => issueDashboardUrl(root, port),
      close: (server) => server.close(),
    });
    printResolution(resolution.dashboardUrl, port, resolution.reused);
    if (!resolution.service) {
      lease.release();
      return;
    }
    const server = resolution.service;
    const close = async () => {
      try {
        await server.close();
      } finally {
        lease.release();
      }
      process.exit(0);
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
    await new Promise<void>(() => undefined);
  } catch (error) {
    lease.release();
    throw error;
  }
}

async function clientFor(
  flags: Map<string, string | boolean>,
): Promise<AgentSeoClient> {
  const connection = connectionOptions(flags);
  return AgentSeoClient.fromTokenFile(connection.serviceTokenFile, {
    baseUrl: connection.apiUrl,
  });
}

function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function project(args: ParsedArgs): Promise<void> {
  const [subcommand = "list", ...rest] = args.rest;
  const client = await clientFor(args.flags);
  if (subcommand === "list") return json(await client.projects.list());
  if (subcommand === "create") {
    const [name, canonicalUrl] = rest;
    if (!name || !canonicalUrl)
      throw new Error("usage: agentseo project create <name> <https-url>");
    return json(await client.projects.create({ name, canonicalUrl }));
  }
  if (subcommand === "show") {
    if (!rest[0]) throw new Error("usage: agentseo project show <project-id>");
    return json(await client.projects.overview(rest[0]));
  }
  if (subcommand === "export") {
    const [projectId, output] = rest;
    if (!projectId || !output)
      throw new Error(
        "usage: agentseo project export <project-id> <output.golemseo>",
      );
    const destination = resolve(output);
    if (!destination.endsWith(".golemseo"))
      throw new Error("The export filename must end in .golemseo");
    const bytes = await client.exportProject(projectId);
    writeFileSync(destination, bytes, { mode: 0o600, flag: "wx" });
    return json({ path: destination, bytes: bytes.byteLength });
  }
  if (subcommand === "import") {
    const source = rest[0];
    if (!source)
      throw new Error("usage: agentseo project import <project.golemseo>");
    const path = resolve(source);
    if (!path.endsWith(".golemseo"))
      throw new Error("The import filename must end in .golemseo");
    if (!statSync(path).isFile())
      throw new Error("The import path is not a file");
    return json(await client.importProject(readFileSync(path)));
  }
  if (subcommand === "delete") {
    const projectId = rest[0];
    if (!projectId) {
      throw new Error(
        "usage: agentseo project delete <project-id> --confirm-name-file PATH",
      );
    }
    const confirmation = readBoundedInputFile(
      args.flags,
      "confirm-name-file",
      4_096,
    );
    if (!confirmation || confirmation.length > 160) {
      throw new Error(
        "The project-name confirmation must contain 1 to 160 characters",
      );
    }
    return json(await client.projects.delete(projectId, { confirmation }));
  }
  throw new Error(`Unknown project command: ${subcommand}`);
}

async function audit(args: ParsedArgs): Promise<void> {
  const projectId = args.rest[0];
  if (!projectId)
    throw new Error("usage: agentseo audit <project-id> [--render static|js]");
  const client = await clientFor(args.flags);
  const render = args.flags.get("render");
  const run = await client.runs.start(
    {
      projectId,
      workflowId: "audit",
      options: {
        renderMode: render === "js" ? "js" : "static",
        collectVitals: args.flags.has("collect-vitals"),
      },
    },
    randomUUID(),
  );
  json(run);
}

async function runCommand(args: ParsedArgs): Promise<void> {
  const [subcommand = "list", id] = args.rest;
  const client = await clientFor(args.flags);
  if (subcommand === "list")
    return json(
      await client.runs.list(
        typeof args.flags.get("project") === "string"
          ? String(args.flags.get("project"))
          : undefined,
      ),
    );
  if (!id) throw new Error(`usage: agentseo run ${subcommand} <run-id>`);
  if (subcommand === "show") return json(await client.runs.get(id));
  if (subcommand === "compare") {
    const baselineRunId = optionalStringFlag(args.flags, "baseline");
    if (!baselineRunId) {
      throw new Error(
        "usage: agentseo run compare <current-run-id> --baseline <baseline-run-id>",
      );
    }
    return json(await client.runs.compare(id, baselineRunId));
  }
  if (subcommand === "links") {
    const pageUrl = optionalStringFlag(args.flags, "url");
    if (!pageUrl) {
      throw new Error(
        "usage: agentseo run links <run-id> --url <https-url> [--direction inlinks|outlinks] [--limit N] [--offset N] [--search TEXT]",
      );
    }
    let parsedPageUrl: URL;
    try {
      parsedPageUrl = new URL(pageUrl);
    } catch {
      throw new Error("--url must be an absolute HTTP or HTTPS URL");
    }
    if (
      parsedPageUrl.protocol !== "http:" &&
      parsedPageUrl.protocol !== "https:"
    ) {
      throw new Error("--url must be an absolute HTTP or HTTPS URL");
    }
    const direction = optionalStringFlag(args.flags, "direction") ?? "inlinks";
    if (direction !== "inlinks" && direction !== "outlinks") {
      throw new Error("--direction must be inlinks or outlinks");
    }
    const limitValue = optionalStringFlag(args.flags, "limit");
    const offsetValue = optionalStringFlag(args.flags, "offset");
    const limit = limitValue === undefined ? 50 : Number(limitValue);
    const offset = offsetValue === undefined ? 0 : Number(offsetValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      throw new Error("--limit must be an integer from 1 to 250");
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
      throw new Error("--offset must be an integer from 0 to 1000000");
    }
    const search = optionalStringFlag(args.flags, "search");
    if (search && search.length > 160) {
      throw new Error("--search must contain at most 160 characters");
    }
    return json(
      await client.runs.links(id, {
        pageUrl: parsedPageUrl.toString(),
        direction,
        limit,
        offset,
        ...(search ? { search } : {}),
      }),
    );
  }
  if (subcommand === "replay")
    return json(await client.runs.replay(id, randomUUID()));
  if (subcommand === "cancel") return json(await client.runs.cancel(id));
  if (subcommand === "issues") return json(await client.runs.issues(id));
  if (subcommand === "watch") {
    for await (const event of client.watchRun(id)) json(event);
    return;
  }
  throw new Error(`Unknown run command: ${subcommand}`);
}

async function issueCommand(args: ParsedArgs): Promise<void> {
  const [subcommand = "list", projectId, fingerprint, decision] = args.rest;
  if (!projectId) {
    throw new Error(
      "usage: agentseo issue list <project-id> | issue review <project-id> <fingerprint> <open|ignored|false-positive>",
    );
  }
  const client = await clientFor(args.flags);
  if (subcommand === "list") {
    const limitValue = optionalStringFlag(args.flags, "limit");
    const offsetValue = optionalStringFlag(args.flags, "offset");
    const limit = limitValue === undefined ? 50 : Number(limitValue);
    const offset = offsetValue === undefined ? 0 : Number(offsetValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 250)
      throw new Error("--limit must be an integer from 1 to 250");
    if (!Number.isInteger(offset) || offset < 0)
      throw new Error("--offset must be a non-negative integer");
    const rawStatus = optionalStringFlag(args.flags, "status");
    const status = rawStatus?.replace("false-positive", "false_positive");
    if (
      status &&
      !["open", "resolved", "ignored", "false_positive"].includes(status)
    ) {
      throw new Error(
        "--status must be open, resolved, ignored, or false-positive",
      );
    }
    const severity = optionalStringFlag(args.flags, "severity");
    if (
      severity &&
      !["critical", "high", "medium", "low", "info"].includes(severity)
    ) {
      throw new Error(
        "--severity must be critical, high, medium, low, or info",
      );
    }
    const search = optionalStringFlag(args.flags, "search");
    if (search && search.length > 160)
      throw new Error("--search must contain at most 160 characters");
    return json(
      await client.issues.list(projectId, {
        limit,
        offset,
        ...(status
          ? {
              status: status as
                "open" | "resolved" | "ignored" | "false_positive",
            }
          : {}),
        ...(severity
          ? {
              severity: severity as
                "critical" | "high" | "medium" | "low" | "info",
            }
          : {}),
        ...(search ? { search } : {}),
      }),
    );
  }
  if (subcommand === "review") {
    if (!fingerprint || !decision)
      throw new Error(
        "usage: agentseo issue review <project-id> <fingerprint> <open|ignored|false-positive> [--reason-file PATH]",
      );
    if (!/^[a-f0-9]{16,128}$/iu.test(fingerprint))
      throw new Error("The issue fingerprint is invalid");
    const status = decision.replace("false-positive", "false_positive");
    if (!["open", "ignored", "false_positive"].includes(status))
      throw new Error(
        "The review decision must be open, ignored, or false-positive",
      );
    const reasonPath = optionalStringFlag(args.flags, "reason-file");
    if (status === "open" && reasonPath)
      throw new Error("Reopening does not accept --reason-file");
    let note: string | null = null;
    if (status !== "open") {
      if (!reasonPath)
        throw new Error(
          "Ignored and false-positive reviews require --reason-file so the reason does not enter shell history",
        );
      const path = resolve(reasonPath);
      const file = statSync(path);
      if (!file.isFile() || file.size > 8_192)
        throw new Error(
          "--reason-file must be a regular file no larger than 8 KiB",
        );
      note = readFileSync(path, "utf8").trim();
      if (note.length < 3 || note.length > 2_000)
        throw new Error("The review reason must contain 3 to 2,000 characters");
    }
    return json(
      await client.issues.update(fingerprint, {
        projectId,
        status: status as "open" | "ignored" | "false_positive",
        note,
      }),
    );
  }
  throw new Error(`Unknown issue command: ${subcommand}`);
}

function readBoundedInputFile(
  flags: Map<string, string | boolean>,
  name: string,
  maxBytes: number,
): string {
  const source = optionalStringFlag(flags, name);
  if (!source) throw new Error(`--${name} requires a file path`);
  const path = resolve(source);
  const file = statSync(path);
  if (!file.isFile() || file.size > maxBytes) {
    throw new Error(
      `--${name} must be a regular file no larger than ${maxBytes} bytes`,
    );
  }
  return readFileSync(path, "utf8").trim();
}

async function contextCommand(args: ParsedArgs): Promise<void> {
  const [subcommand = "show", projectId, kindValue] = args.rest;
  if (!projectId) {
    throw new Error(
      "usage: agentseo context show <project-id> | update <project-id> --profile-file PATH --change-summary-file PATH | append <project-id> <observation|decision|constraint|experiment> --title-file PATH --detail-file PATH [--source-run ID]",
    );
  }
  const client = await clientFor(args.flags);
  if (subcommand === "show") return json(await client.context.get(projectId));
  if (subcommand === "update") {
    const rawProfile = readBoundedInputFile(args.flags, "profile-file", 65_536);
    const changeSummary = readBoundedInputFile(
      args.flags,
      "change-summary-file",
      1_024,
    );
    if (changeSummary.length < 3 || changeSummary.length > 240) {
      throw new Error(
        "The context change summary must contain 3 to 240 characters",
      );
    }
    let profile: unknown;
    try {
      profile = JSON.parse(rawProfile) as unknown;
    } catch {
      throw new Error("--profile-file must contain valid JSON");
    }
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error("--profile-file must contain a JSON object");
    }
    return json(
      await client.context.update(projectId, {
        profile: profile as ProjectContextProfile,
        changeSummary,
      }),
    );
  }
  if (subcommand === "append") {
    const allowedKinds: ProjectContextJournalKind[] = [
      "observation",
      "decision",
      "constraint",
      "experiment",
    ];
    if (
      !kindValue ||
      !allowedKinds.includes(kindValue as ProjectContextJournalKind)
    ) {
      throw new Error(
        "The context entry kind must be observation, decision, constraint, or experiment",
      );
    }
    const title = readBoundedInputFile(args.flags, "title-file", 4_096);
    const detail = readBoundedInputFile(args.flags, "detail-file", 8_192);
    if (title.length < 3 || title.length > 160)
      throw new Error(
        "The context entry title must contain 3 to 160 characters",
      );
    if (detail.length < 3 || detail.length > 2_000)
      throw new Error(
        "The context entry detail must contain 3 to 2,000 characters",
      );
    return json(
      await client.context.append(projectId, {
        kind: kindValue as ProjectContextJournalKind,
        title,
        detail,
        sourceRunId: optionalStringFlag(args.flags, "source-run") ?? null,
      }),
    );
  }
  throw new Error(`Unknown context command: ${subcommand}`);
}

async function integration(args: ParsedArgs): Promise<void> {
  const [subcommand = "list", provider] = args.rest;
  const client = await clientFor(args.flags);
  if (subcommand === "list") return json(await client.integrations.list());
  if (!provider)
    throw new Error(`usage: agentseo integration ${subcommand} <provider>`);
  if (subcommand === "test") {
    const project = args.flags.get("project");
    return json(
      await client.integrations.test(
        provider,
        typeof project === "string" ? project : undefined,
      ),
    );
  }
  if (subcommand === "remove") {
    await client.integrations.remove(provider);
    return;
  }
  throw new Error(
    "Connect and rotate credentials from the local dashboard so secrets never enter shell history.",
  );
}

async function extractionCommand(args: ParsedArgs): Promise<void> {
  const [subcommand = "templates"] = args.rest;
  if (subcommand !== "templates") {
    throw new Error("usage: agentseo extraction templates");
  }
  const client = await clientFor(args.flags);
  return json(await client.extractionRules.templates());
}

async function doctor(args: ParsedArgs): Promise<void> {
  const connection = connectionOptions(args.flags);
  const root = connection.dataDirectory;
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  checks.push({
    name: "Node.js",
    ok: Number(process.versions.node.split(".")[0]) === 24,
    detail: process.versions.node,
  });
  checks.push({ name: "Data directory", ok: existsSync(root), detail: root });
  checks.push({
    name: "Service token",
    ok: existsSync(connection.serviceTokenFile),
    detail: connection.serviceTokenFile,
  });
  checks.push({
    name: "Dashboard assets",
    ok: Boolean(dashboardDirectory()),
    detail: dashboardDirectory() ?? "missing",
  });
  try {
    const client = await clientFor(args.flags);
    const health = await client.health();
    checks.push({
      name: "Local API",
      ok: health.status === "ok",
      detail: `${health.database}; ${health.queue}`,
    });
  } catch (error) {
    checks.push({
      name: "Local API",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  json({ ok: checks.every((check) => check.ok), checks });
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

async function migrate(args: ParsedArgs): Promise<void> {
  const source = args.rest[0];
  if (!source) {
    throw new Error(
      "usage: agentseo migrate <legacy-project-directory> [--data-dir PATH] [--master-password-file PATH]",
    );
  }
  const destination = dataDirectory(args.flags);
  if (resolve(source) === resolve(destination)) {
    throw new Error(
      "The legacy source and the new application data directory must be different",
    );
  }
  const passwordFile = args.flags.get("master-password-file");
  const password =
    typeof passwordFile === "string"
      ? readFileSync(resolve(passwordFile), "utf8").trim()
      : readCompatibleEnvironmentVariable("AGENTSEO_MASTER_PASSWORD", [
          "GOLEMSEO_MASTER_PASSWORD",
          "GOLEM_SEO_MASTER_PASSWORD",
        ]);
  const credentialStore = password
    ? new EncryptedFileCredentialStore(
        join(destination, "vault.json"),
        password,
      )
    : undefined;
  if (!credentialStore) {
    process.stderr.write(
      "Credential vault is locked; project history will be imported and detected secrets will remain in their original files.\n",
    );
  }
  const receipt = await importLegacyData({
    sourceDirectory: resolve(source),
    destinationDirectory: destination,
    credentialStore,
  });
  json(receipt);
}

function offlineLease(args: ParsedArgs) {
  const root = dataDirectory(args.flags);
  const attempt = acquireDataDirectoryDaemonLease(root, 3210);
  if (attempt.status === "held") {
    throw new Error(
      `Stop AGENTseo before this operation; PID ${attempt.owner.pid} owns the data directory`,
    );
  }
  return attempt.lease;
}

async function backupCommand(args: ParsedArgs): Promise<void> {
  const destination = args.rest[0];
  if (!destination) {
    throw new Error(
      "usage: agentseo backup <destination.db> [--data-dir PATH]",
    );
  }
  const root = dataDirectory(args.flags);
  const databasePath = join(root, "golem-seo.db");
  if (!existsSync(databasePath)) {
    throw new Error("No AGENTseo database exists in this data directory");
  }
  const lease = offlineLease(args);
  let database: GolemDatabase | undefined;
  try {
    database = new GolemDatabase({ path: databasePath });
    json(await createDatabaseBackup(database, resolve(destination)));
  } finally {
    database?.close();
    lease.release();
  }
}

async function restoreCommand(args: ParsedArgs): Promise<void> {
  const source = args.rest[0];
  if (!source) {
    throw new Error(
      "usage: agentseo restore <backup.db> --confirm [--expected-sha256 HASH] [--data-dir PATH]",
    );
  }
  if (!args.flags.has("confirm")) {
    throw new Error(
      "Restore replaces the active local database. Re-run with --confirm after stopping AGENTseo.",
    );
  }
  const expected = args.flags.get("expected-sha256");
  if (expected !== undefined && typeof expected !== "string") {
    throw new Error("--expected-sha256 requires a hash value");
  }
  const root = dataDirectory(args.flags);
  const lease = offlineLease(args);
  try {
    json(
      await restoreDatabaseBackup(
        resolve(source),
        join(root, "golem-seo.db"),
        expected,
      ),
    );
  } finally {
    lease.release();
  }
}

function servicePlatform(): ServicePlatform {
  if (
    process.platform === "darwin" ||
    process.platform === "linux" ||
    process.platform === "win32"
  ) {
    return process.platform;
  }
  throw new Error(`Background startup is not supported on ${process.platform}`);
}

function currentWindowsUserId(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const username = process.env.USERNAME?.trim() || userInfo().username.trim();
  const domain = process.env.USERDOMAIN?.trim();
  if (!username) return undefined;
  return domain && !username.includes("\\")
    ? `${domain}\\${username}`
    : username;
}

function backgroundServiceBroker(args: ParsedArgs): string {
  if (args.flags.has("master-password-file")) {
    throw new Error(
      "Background services do not persist master-password configuration. Install with --credential-broker PATH.",
    );
  }
  const flag = args.flags.get("credential-broker");
  if (flag === true) throw new Error("--credential-broker requires a path");
  const configured =
    typeof flag === "string"
      ? flag
      : readCompatibleEnvironmentVariable("AGENTSEO_CREDENTIAL_BROKER", [
          "GOLEMSEO_CREDENTIAL_BROKER",
          "GOLEM_SEO_CREDENTIAL_BROKER",
        ]);
  if (!configured) {
    throw new Error(
      "service install requires --credential-broker PATH (or AGENTSEO_CREDENTIAL_BROKER); master passwords are never written to service definitions",
    );
  }
  return validateCredentialBrokerPath(resolve(configured));
}

function installedServiceDefinition(
  args: ParsedArgs,
  options: { startImmediately?: boolean } = {},
) {
  const platform = servicePlatform();
  const root = dataDirectory(args.flags);
  const runtimeFlags = desktopRuntimeFlags(args.flags);
  return createServiceDefinition({
    platform,
    homeDirectory: homedir(),
    userId: process.getuid?.(),
    windowsUserId: currentWindowsUserId(),
    executable: process.execPath,
    cliPath: fileURLToPath(import.meta.url),
    dataDirectory: root,
    credentialBrokerPath: backgroundServiceBroker(args),
    chromiumExecutable: runtimeFlags.chromiumExecutable,
    browserDirectory: runtimeFlags.browserDirectory,
    googleDesktopClientId: runtimeFlags.googleDesktopClientId,
    startImmediately: options.startImmediately,
  });
}

function installServiceDefinition(
  definition: ReturnType<typeof createServiceDefinition>,
): void {
  mkdirSync(dirname(definition.path), { recursive: true, mode: 0o700 });
  writeFileSync(definition.path, definition.content, { mode: 0o600 });
  chmodSync(definition.path, 0o600);
  for (const command of definition.installCommands) {
    execFileSync(command[0]!, command.slice(1), { stdio: "inherit" });
  }
}

function service(args: ParsedArgs): void {
  const [subcommand = "status"] = args.rest;
  const platform = servicePlatform();
  const path = serviceDefinitionPath(
    platform,
    homedir(),
    dataDirectory(args.flags),
  );
  if (subcommand === "install") {
    installServiceDefinition(installedServiceDefinition(args));
    return;
  }
  if (subcommand === "uninstall") {
    if (platform === "darwin" && existsSync(path))
      execFileSync(
        "launchctl",
        ["bootout", `gui/${process.getuid?.()}`, path],
        {
          stdio: "inherit",
        },
      );
    if (platform === "linux")
      execFileSync(
        "systemctl",
        ["--user", "disable", "--now", "golem-seo.service"],
        { stdio: "inherit" },
      );
    if (platform === "win32") {
      try {
        execFileSync("schtasks.exe", ["/End", "/TN", WINDOWS_TASK_NAME], {
          stdio: "ignore",
        });
      } catch {
        // An installed task is allowed to be idle during removal.
      }
      execFileSync(
        "schtasks.exe",
        ["/Delete", "/TN", WINDOWS_TASK_NAME, "/F"],
        { stdio: "inherit" },
      );
    }
    rmSync(path, { force: true });
    if (platform === "linux")
      execFileSync("systemctl", ["--user", "daemon-reload"], {
        stdio: "inherit",
      });
    return;
  }
  if (subcommand === "status") {
    const command =
      platform === "darwin"
        ? [
            "launchctl",
            "print",
            `gui/${process.getuid?.()}/com.golemworkers.golem-seo`,
          ]
        : platform === "linux"
          ? ["systemctl", "--user", "status", "golem-seo.service"]
          : [
              "schtasks.exe",
              "/Query",
              "/TN",
              WINDOWS_TASK_NAME,
              "/V",
              "/FO",
              "LIST",
            ];
    execFileSync(command[0]!, command.slice(1), { stdio: "inherit" });
    return;
  }
  throw new Error(`Unknown service command: ${subcommand}`);
}

function help(): void {
  process.stdout.write(renderCliHelp(VERSION));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (
    args.flags.has("version") ||
    args.command === "version" ||
    args.command === "--version" ||
    args.command === "-v"
  )
    return process.stdout.write(`${VERSION}\n`) as unknown as void;
  switch (args.command) {
    case "serve":
      return serve(args);
    case "project":
      return project(args);
    case "audit":
      return audit(args);
    case "run":
      return runCommand(args);
    case "issue":
      return issueCommand(args);
    case "context":
      return contextCommand(args);
    case "integration":
      return integration(args);
    case "extraction":
      return extractionCommand(args);
    case "migrate":
      return migrate(args);
    case "backup":
      return backupCommand(args);
    case "restore":
      return restoreCommand(args);
    case "service":
      return service(args);
    case "doctor":
      return doctor(args);
    case "help":
    case "--help":
    case "-h":
      return help();
    default:
      help();
      throw new Error(`Unknown command: ${args.command}`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `agentseo: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
