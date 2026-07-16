import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { CredentialRef, CredentialStore } from "@golem-seo/credentials";

const DEVICE_CREDENTIAL_REF: CredentialRef = {
  provider: "golemworkers",
  account: "default",
  kind: "device",
};

const GOLEM_WORKERS_API_ORIGIN = "https://golemworkers.com";

interface DeviceCredential {
  version: 1;
  deviceId: string;
  orgId: string;
  deviceToken: string;
  expiresAt: string;
}

interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
}

interface PendingAuthorization extends DeviceAuthorization {
  state: "pending";
}

export interface GolemWorkersLinkStatus {
  state: "disconnected" | "pending" | "connected" | "failed";
  verificationUrl: string | null;
  userCode: string | null;
  expiresAt: string | null;
  orgId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface GolemWorkersBridgeOptions {
  dataDir: string;
  credentialStore: CredentialStore;
  /** @deprecated The bridge is pinned to https://golemworkers.com. */
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  requestTimeoutMs?: number;
}

export class GolemWorkersBridgeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GolemWorkersBridgeError";
    this.status = status;
    this.code = code;
  }
}

function validateApiBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `The GolemWorkers API origin is pinned to ${GOLEM_WORKERS_API_ORIGIN}`,
    );
  }
  if (
    url.origin !== GOLEM_WORKERS_API_ORIGIN ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `The GolemWorkers API origin is pinned to ${GOLEM_WORKERS_API_ORIGIN}`,
    );
  }
  return GOLEM_WORKERS_API_ORIGIN;
}

function ensureDeviceId(path: string): string {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8").trim();
    if (/^[0-9a-f-]{36}$/iu.test(current)) return current;
    throw new Error("The Golem SEO device identifier file is invalid");
  }
  const value = randomUUID();
  writeFileSync(path, `${value}\n`, { mode: 0o600, flag: "wx" });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* platform ACL may own this */
  }
  return value;
}

function parseIsoDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new GolemWorkersBridgeError(
      502,
      "invalid_hosted_response",
      `GolemWorkers returned an invalid ${field}`,
    );
  }
  return new Date(Date.parse(value)).toISOString();
}

function parseAuthorization(value: unknown): DeviceAuthorization {
  if (!value || typeof value !== "object") {
    throw new GolemWorkersBridgeError(
      502,
      "invalid_hosted_response",
      "GolemWorkers returned an invalid authorization response",
    );
  }
  const body = value as Record<string, unknown>;
  const verificationUri =
    typeof body.verificationUri === "string" ? body.verificationUri : "";
  let verification: URL;
  try {
    verification = new URL(verificationUri);
  } catch {
    throw new GolemWorkersBridgeError(
      502,
      "invalid_hosted_response",
      "GolemWorkers returned an invalid verification URL",
    );
  }
  if (
    verification.origin !== GOLEM_WORKERS_API_ORIGIN ||
    verification.username ||
    verification.password
  ) {
    throw new GolemWorkersBridgeError(
      502,
      "invalid_hosted_response",
      "GolemWorkers returned an unsafe verification URL",
    );
  }
  if (
    typeof body.deviceCode !== "string" ||
    body.deviceCode.length < 20 ||
    typeof body.userCode !== "string" ||
    body.userCode.length < 4 ||
    typeof body.intervalSeconds !== "number" ||
    !Number.isFinite(body.intervalSeconds)
  ) {
    throw new GolemWorkersBridgeError(
      502,
      "invalid_hosted_response",
      "GolemWorkers returned an incomplete authorization response",
    );
  }
  return {
    deviceCode: body.deviceCode,
    userCode: body.userCode,
    verificationUri: verification.href,
    expiresAt: parseIsoDate(body.expiresAt, "authorization expiry"),
    intervalSeconds: Math.max(
      1,
      Math.min(30, Math.trunc(body.intervalSeconds)),
    ),
  };
}

function parseCredential(secret: Uint8Array): DeviceCredential {
  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(secret).toString("utf8"));
  } catch {
    throw new Error("The stored GolemWorkers device credential is invalid");
  }
  if (!body || typeof body !== "object")
    throw new Error("The stored GolemWorkers device credential is invalid");
  const record = body as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.deviceId !== "string" ||
    !record.deviceId ||
    typeof record.orgId !== "string" ||
    !record.orgId ||
    typeof record.deviceToken !== "string" ||
    record.deviceToken.length < 20
  ) {
    throw new Error("The stored GolemWorkers device credential is invalid");
  }
  return {
    version: 1,
    deviceId: record.deviceId,
    orgId: record.orgId,
    deviceToken: record.deviceToken,
    expiresAt: parseIsoDate(record.expiresAt, "device token expiry"),
  };
}

function defaultSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class GolemWorkersBridge {
  readonly deviceId: string;
  readonly #apiBaseUrl: string;
  readonly #credentialStore: CredentialStore;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => number;
  readonly #sleep: (delayMs: number, signal: AbortSignal) => Promise<void>;
  readonly #requestTimeoutMs: number;
  #pending: PendingAuthorization | null = null;
  #lastFailure: { code: string; message: string } | null = null;
  #pollController: AbortController | null = null;

  constructor(options: GolemWorkersBridgeOptions) {
    this.#apiBaseUrl = validateApiBaseUrl(
      options.apiBaseUrl ?? GOLEM_WORKERS_API_ORIGIN,
    );
    this.deviceId = ensureDeviceId(join(options.dataDir, "device-id"));
    this.#credentialStore = options.credentialStore;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("GolemWorkers request timed out")),
      this.#requestTimeoutMs,
    );
    const signal = init.signal
      ? AbortSignal.any([controller.signal, init.signal])
      : controller.signal;
    try {
      return await this.#fetch(`${this.#apiBaseUrl}${path}`, {
        ...init,
        redirect: "error",
        signal,
      });
    } catch (error) {
      throw new GolemWorkersBridgeError(
        502,
        "hosted_unavailable",
        error instanceof Error ? error.message : "GolemWorkers is unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async #problem(response: Response): Promise<GolemWorkersBridgeError> {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      /* non-JSON upstream error */
    }
    const code =
      typeof body.code === "string" ? body.code : "hosted_request_failed";
    const message =
      typeof body.detail === "string"
        ? body.detail
        : typeof body.title === "string"
          ? body.title
          : `GolemWorkers request failed (${response.status})`;
    return new GolemWorkersBridgeError(response.status, code, message);
  }

  async start(): Promise<GolemWorkersLinkStatus> {
    const response = await this.#request("/v1/device/authorizations", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ deviceId: this.deviceId }),
    });
    if (!response.ok) throw await this.#problem(response);
    const authorization = parseAuthorization(await response.json());
    this.#pollController?.abort(
      new Error("A newer device authorization was started"),
    );
    this.#pollController = new AbortController();
    this.#pending = { ...authorization, state: "pending" };
    this.#lastFailure = null;
    void this.#poll(authorization, this.#pollController.signal);
    return this.status();
  }

  async #poll(
    authorization: DeviceAuthorization,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      while (
        !signal.aborted &&
        this.#now() < Date.parse(authorization.expiresAt)
      ) {
        const response = await this.#request("/v1/device/token", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            deviceId: this.deviceId,
            deviceCode: authorization.deviceCode,
          }),
          signal,
        });
        if (response.status === 428) {
          await this.#sleep(authorization.intervalSeconds * 1_000, signal);
          continue;
        }
        if (!response.ok) throw await this.#problem(response);
        const body = (await response.json()) as Record<string, unknown>;
        if (
          typeof body.deviceToken !== "string" ||
          body.deviceToken.length < 20 ||
          typeof body.orgId !== "string" ||
          !body.orgId
        ) {
          throw new GolemWorkersBridgeError(
            502,
            "invalid_hosted_response",
            "GolemWorkers returned an invalid device token response",
          );
        }
        const credential: DeviceCredential = {
          version: 1,
          deviceId: this.deviceId,
          orgId: body.orgId,
          deviceToken: body.deviceToken,
          expiresAt: parseIsoDate(body.expiresAt, "device token expiry"),
        };
        const encoded = Buffer.from(JSON.stringify(credential), "utf8");
        try {
          await this.#credentialStore.put(DEVICE_CREDENTIAL_REF, encoded);
        } finally {
          encoded.fill(0);
        }
        this.#pending = null;
        this.#lastFailure = null;
        return;
      }
      if (!signal.aborted) {
        this.#pending = null;
        this.#lastFailure = {
          code: "device_code_expired",
          message: "The GolemWorkers device authorization expired",
        };
      }
    } catch (error) {
      if (signal.aborted) return;
      this.#pending = null;
      this.#lastFailure = {
        code:
          error instanceof GolemWorkersBridgeError
            ? error.code
            : "hosted_unavailable",
        message:
          error instanceof Error
            ? error.message
            : "GolemWorkers device linking failed",
      };
    }
  }

  async #credential(): Promise<DeviceCredential | null> {
    const secret = await this.#credentialStore.get(DEVICE_CREDENTIAL_REF);
    if (!secret) return null;
    try {
      const credential = parseCredential(secret);
      if (Date.parse(credential.expiresAt) <= this.#now()) {
        await this.#credentialStore.delete(DEVICE_CREDENTIAL_REF);
        return null;
      }
      return credential;
    } finally {
      secret.fill(0);
    }
  }

  async status(): Promise<GolemWorkersLinkStatus> {
    const credential = await this.#credential();
    if (credential) {
      return {
        state: "connected",
        verificationUrl: null,
        userCode: null,
        expiresAt: credential.expiresAt,
        orgId: credential.orgId,
        errorCode: null,
        errorMessage: null,
      };
    }
    if (this.#pending) {
      return {
        state: "pending",
        verificationUrl: this.#pending.verificationUri,
        userCode: this.#pending.userCode,
        expiresAt: this.#pending.expiresAt,
        orgId: null,
        errorCode: null,
        errorMessage: null,
      };
    }
    return {
      state: this.#lastFailure ? "failed" : "disconnected",
      verificationUrl: null,
      userCode: null,
      expiresAt: null,
      orgId: null,
      errorCode: this.#lastFailure?.code ?? null,
      errorMessage: this.#lastFailure?.message ?? null,
    };
  }

  async importProject(bundle: Uint8Array): Promise<unknown> {
    const credential = await this.#credential();
    if (!credential) {
      throw new GolemWorkersBridgeError(
        409,
        "golemworkers_not_connected",
        "Connect GolemWorkers before importing this project",
      );
    }
    const response = await this.#request("/v1/imports/golemseo", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credential.deviceToken}`,
        "content-type": "application/vnd.golemseo+json",
        "x-device-id": credential.deviceId,
        "x-device-org": credential.orgId,
      },
      body: Buffer.from(bundle),
    });
    if (!response.ok) throw await this.#problem(response);
    return await response.json();
  }

  async disconnect(): Promise<void> {
    this.#pollController?.abort(new Error("Device linking cancelled"));
    this.#pollController = null;
    this.#pending = null;
    this.#lastFailure = null;
    await this.#credentialStore.delete(DEVICE_CREDENTIAL_REF);
  }

  close(): void {
    this.#pollController?.abort(new Error("Local server closed"));
    this.#pollController = null;
  }
}
