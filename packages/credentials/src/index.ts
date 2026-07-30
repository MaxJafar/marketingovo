import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { argon2id } from "@noble/hashes/argon2";

export interface CredentialRef {
  provider: string;
  account: string;
  kind: string;
}

export interface CredentialStatus {
  exists: boolean;
  backend: "os" | "encrypted-file" | "memory";
  updatedAt: string | null;
  maskedIdentifier: string | null;
}

export interface CredentialStore {
  put(ref: CredentialRef, secret: Uint8Array): Promise<void>;
  get(ref: CredentialRef): Promise<Uint8Array | null>;
  delete(ref: CredentialRef): Promise<void>;
  status(ref: CredentialRef): Promise<CredentialStatus>;
}

/**
 * Versioned OAuth payload stored behind CredentialStore. This type must never
 * be embedded in API responses or the integrations metadata database.
 */
export interface StoredOAuthCredential {
  version: 1;
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
}

export function oauthCredentialRef(
  provider: string,
  account = "default",
): CredentialRef {
  const normalizedProvider = provider.trim();
  const normalizedAccount = account.trim();
  if (!normalizedProvider || !normalizedAccount)
    throw new Error("OAuth credential provider and account are required");
  return {
    provider: normalizedProvider,
    account: normalizedAccount,
    kind: "oauth",
  };
}

function validatedOAuthCredential(value: unknown): StoredOAuthCredential {
  if (!value || typeof value !== "object")
    throw new Error("Invalid OAuth credential payload");
  const record = value as Record<string, unknown>;
  const expiresAt =
    typeof record.expiresAt === "string"
      ? Date.parse(record.expiresAt)
      : Number.NaN;
  if (
    record.version !== 1 ||
    typeof record.provider !== "string" ||
    !record.provider.trim() ||
    typeof record.accessToken !== "string" ||
    !record.accessToken ||
    typeof record.refreshToken !== "string" ||
    !record.refreshToken ||
    typeof record.tokenType !== "string" ||
    !record.tokenType ||
    !Number.isFinite(expiresAt) ||
    !Array.isArray(record.scopes) ||
    record.scopes.some((scope) => typeof scope !== "string" || !scope)
  ) {
    throw new Error("Invalid OAuth credential payload");
  }
  return {
    version: 1,
    provider: record.provider.trim(),
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    tokenType: record.tokenType,
    // Canonical ISO text makes the expiry absolute and portable.
    expiresAt: new Date(expiresAt).toISOString(),
    scopes: [...new Set(record.scopes as string[])],
  };
}

export function encodeOAuthCredential(
  value: StoredOAuthCredential,
): Uint8Array {
  return Buffer.from(JSON.stringify(validatedOAuthCredential(value)), "utf8");
}

export function decodeOAuthCredential(
  secret: Uint8Array,
): StoredOAuthCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(secret).toString("utf8"));
  } catch {
    throw new Error("Invalid OAuth credential payload");
  }
  return validatedOAuthCredential(parsed);
}

export interface NativeCredentialBroker extends CredentialStore {
  readonly backendName:
    "macos-keychain" | "windows-credential-manager" | "linux-secret-service";
}

const keyFor = (ref: CredentialRef): string =>
  `${ref.provider}\u001f${ref.account}\u001f${ref.kind}`;
const aadFor = (ref: CredentialRef): Buffer =>
  Buffer.from(
    JSON.stringify({
      provider: ref.provider,
      account: ref.account,
      kind: ref.kind,
      secretVersion: 1,
    }),
    "utf8",
  );

interface VaultEntry {
  nonce: string;
  ciphertext: string;
  tag: string;
  updatedAt: string;
  maskedIdentifier: string;
}

interface VaultFile {
  version: 1;
  kdf: {
    name: "argon2id";
    salt: string;
    time: number;
    memoryKiB: number;
    parallelism: number;
  };
  entries: Record<string, VaultEntry>;
}

function masked(secret: Uint8Array): string {
  const text = Buffer.from(secret).toString("utf8").trim();
  if (text.length <= 4) return "••••";
  return `••••${text.slice(-4)}`;
}

function deriveKey(password: string, file: VaultFile): Buffer {
  if (password.length < 12)
    throw new Error("The vault master password must be at least 12 characters");
  return Buffer.from(
    argon2id(
      Buffer.from(password, "utf8"),
      Buffer.from(file.kdf.salt, "base64"),
      {
        t: file.kdf.time,
        m: file.kdf.memoryKiB,
        p: file.kdf.parallelism,
        dkLen: 32,
      },
    ),
  );
}

export class EncryptedFileCredentialStore implements CredentialStore {
  readonly path: string;
  private readonly masterPassword: string;

  constructor(path: string, masterPassword: string) {
    this.path = path;
    this.masterPassword = masterPassword;
    if (masterPassword.length < 12)
      throw new Error(
        "The vault master password must be at least 12 characters",
      );
  }

  private read(): VaultFile {
    if (!existsSync(this.path)) {
      return {
        version: 1,
        kdf: {
          name: "argon2id",
          salt: randomBytes(16).toString("base64"),
          time: 3,
          memoryKiB: 65_536,
          parallelism: 1,
        },
        entries: {},
      };
    }
    const parsed = JSON.parse(readFileSync(this.path, "utf8")) as VaultFile;
    if (
      parsed.version !== 1 ||
      parsed.kdf?.name !== "argon2id" ||
      !parsed.entries
    ) {
      throw new Error("Unsupported or corrupt AGENTseo vault");
    }
    return parsed;
  }

  private write(file: VaultFile): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    try {
      chmodSync(dirname(this.path), 0o700);
    } catch {
      /* platform ACL may own this */
    }
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, this.path);
    try {
      chmodSync(this.path, 0o600);
    } catch {
      /* platform ACL may own this */
    }
  }

  async put(ref: CredentialRef, secret: Uint8Array): Promise<void> {
    if (secret.byteLength === 0)
      throw new Error("Credential secret cannot be empty");
    const file = this.read();
    const key = deriveKey(this.masterPassword, file);
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(aadFor(ref));
      const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
      file.entries[keyFor(ref)] = {
        nonce: nonce.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        updatedAt: new Date().toISOString(),
        maskedIdentifier: masked(secret),
      };
      this.write(file);
    } finally {
      key.fill(0);
    }
  }

  async get(ref: CredentialRef): Promise<Uint8Array | null> {
    const file = this.read();
    const entry = file.entries[keyFor(ref)];
    if (!entry) return null;
    const key = deriveKey(this.masterPassword, file);
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(entry.nonce, "base64"),
      );
      decipher.setAAD(aadFor(ref));
      decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
      return new Uint8Array(
        Buffer.concat([
          decipher.update(Buffer.from(entry.ciphertext, "base64")),
          decipher.final(),
        ]),
      );
    } catch {
      throw new Error(
        "Vault authentication failed: wrong password or modified data",
      );
    } finally {
      key.fill(0);
    }
  }

  async delete(ref: CredentialRef): Promise<void> {
    const file = this.read();
    delete file.entries[keyFor(ref)];
    this.write(file);
  }

  async status(ref: CredentialRef): Promise<CredentialStatus> {
    const entry = this.read().entries[keyFor(ref)];
    return {
      exists: Boolean(entry),
      backend: "encrypted-file",
      updatedAt: entry?.updatedAt ?? null,
      maskedIdentifier: entry?.maskedIdentifier ?? null,
    };
  }
}

export class MemoryCredentialStore implements CredentialStore {
  private readonly entries = new Map<
    string,
    { secret: Uint8Array; updatedAt: string; maskedIdentifier: string }
  >();

  async put(ref: CredentialRef, secret: Uint8Array): Promise<void> {
    this.entries.set(keyFor(ref), {
      secret: new Uint8Array(secret),
      updatedAt: new Date().toISOString(),
      maskedIdentifier: masked(secret),
    });
  }
  async get(ref: CredentialRef): Promise<Uint8Array | null> {
    const entry = this.entries.get(keyFor(ref));
    return entry ? new Uint8Array(entry.secret) : null;
  }
  async delete(ref: CredentialRef): Promise<void> {
    this.entries.delete(keyFor(ref));
  }
  async status(ref: CredentialRef): Promise<CredentialStatus> {
    const entry = this.entries.get(keyFor(ref));
    return {
      exists: Boolean(entry),
      backend: "memory",
      updatedAt: entry?.updatedAt ?? null,
      maskedIdentifier: entry?.maskedIdentifier ?? null,
    };
  }
}

export class LockedCredentialStore implements CredentialStore {
  private readonly message =
    "Credential vault is locked. Configure the native broker or provide a master password.";

  async put(): Promise<void> {
    throw new Error(this.message);
  }
  async get(): Promise<Uint8Array | null> {
    return null;
  }
  async delete(): Promise<void> {
    throw new Error(this.message);
  }
  async status(): Promise<CredentialStatus> {
    return {
      exists: false,
      backend: "memory",
      updatedAt: null,
      maskedIdentifier: null,
    };
  }
}

export { NativeBrokerCredentialStore } from "./native-broker.js";
