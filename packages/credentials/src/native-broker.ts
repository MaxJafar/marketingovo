import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  CredentialRef,
  CredentialStatus,
  CredentialStore,
  NativeCredentialBroker,
} from "./index.js";

interface BrokerResponse {
  request_id: string;
  ok: boolean;
  exists?: boolean;
  secret_base64?: string;
  error?: string;
}

interface PendingRequest {
  resolve(value: BrokerResponse): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

const refKey = (ref: CredentialRef): string =>
  Buffer.from(
    JSON.stringify({
      provider: ref.provider,
      account: ref.account,
      kind: ref.kind,
    }),
    "utf8",
  ).toString("base64url");

const masked = (secret: Uint8Array): string => {
  const value = Buffer.from(secret).toString("utf8").trim();
  return value.length > 4 ? `••••${value.slice(-4)}` : "••••";
};

// Keep the broker's environment deliberately small while preserving the OS
// session values required by Keychain, Credential Manager, and Secret Service.
// In particular, Linux desktop vaults are unreachable without the D-Bus
// session address inherited by the GUI application.
const BROKER_ENVIRONMENT_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "USERNAME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "PATHEXT",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "__CF_USER_TEXT_ENCODING",
] as const;

function nativeBrokerEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    BROKER_ENVIRONMENT_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

export class NativeBrokerCredentialStore implements NativeCredentialBroker {
  readonly backendName: NativeCredentialBroker["backendName"];
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly metadata = new Map<
    string,
    { updatedAt: string; maskedIdentifier: string }
  >();
  private closed = false;

  constructor(
    binaryPath: string,
    options: {
      timeoutMs?: number;
      backendName?: NativeCredentialBroker["backendName"];
    } = {},
  ) {
    this.backendName =
      options.backendName ??
      (process.platform === "darwin"
        ? "macos-keychain"
        : process.platform === "win32"
          ? "windows-credential-manager"
          : "linux-secret-service");
    const timeoutMs = options.timeoutMs ?? 10_000;
    this.child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
      env: nativeBrokerEnvironment(),
    });
    this.child.stderr.on("data", () => undefined);
    this.child.once("error", () =>
      this.rejectAll(new Error("Native credential broker is unavailable")),
    );
    this.child.once("exit", () =>
      this.rejectAll(new Error("Native credential broker stopped")),
    );
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      let response: BrokerResponse;
      try {
        response = JSON.parse(line) as BrokerResponse;
      } catch {
        return;
      }
      const pending = this.pending.get(response.request_id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.request_id);
      if (response.ok) pending.resolve(response);
      else
        pending.reject(
          new Error(
            `Credential broker operation failed (${response.error ?? "unknown"})`,
          ),
        );
    });
    this.requestTimeoutMs = timeoutMs;
  }

  private readonly requestTimeoutMs: number;

  private rejectAll(error: Error): void {
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(payload: Record<string, unknown>): Promise<BrokerResponse> {
    if (this.closed)
      return Promise.reject(new Error("Native credential broker is closed"));
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Native credential broker timed out"));
      }, this.requestTimeoutMs);
      timer.unref();
      this.pending.set(requestId, { resolve, reject, timer });
      this.child.stdin.write(
        `${JSON.stringify({ ...payload, request_id: requestId })}\n`,
        (error) => {
          if (!error) return;
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(new Error("Native credential broker write failed"));
        },
      );
    });
  }

  async put(ref: CredentialRef, secret: Uint8Array): Promise<void> {
    if (secret.byteLength === 0)
      throw new Error("Credential secret cannot be empty");
    const copy = Buffer.from(secret);
    const secretBase64 = copy.toString("base64");
    copy.fill(0);
    await this.request({
      operation: "put",
      key: refKey(ref),
      secret_base64: secretBase64,
    });
    this.metadata.set(refKey(ref), {
      updatedAt: new Date().toISOString(),
      maskedIdentifier: masked(secret),
    });
  }

  async get(ref: CredentialRef): Promise<Uint8Array | null> {
    const result = await this.request({ operation: "get", key: refKey(ref) });
    return result.exists && result.secret_base64
      ? new Uint8Array(Buffer.from(result.secret_base64, "base64"))
      : null;
  }

  async delete(ref: CredentialRef): Promise<void> {
    await this.request({ operation: "delete", key: refKey(ref) });
    this.metadata.delete(refKey(ref));
  }

  async status(ref: CredentialRef): Promise<CredentialStatus> {
    const result = await this.request({
      operation: "status",
      key: refKey(ref),
    });
    const metadata = this.metadata.get(refKey(ref));
    return {
      exists: result.exists === true,
      backend: "os",
      updatedAt: metadata?.updatedAt ?? null,
      maskedIdentifier: metadata?.maskedIdentifier ?? null,
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.child.kill();
    this.rejectAll(new Error("Native credential broker closed"));
  }
}
