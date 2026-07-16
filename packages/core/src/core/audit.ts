// Audit log: one structured JSON line per significant event.
// Redacts obvious secrets (Authorization, Cookie, Set-Cookie, basic auth).
//
// Persists nothing to disk by default. The caller decides whether to
// write to a file.

export type AuditLevel = "info" | "warn" | "error";

export interface AuditEvent {
  ts: string;
  level: AuditLevel;
  runId: string;
  event: string;
  data?: Record<string, unknown>;
}

const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "password",
  "secret",
  "token",
  "api-key",
  "apikey",
  "client-secret",
  "clientsecret",
  "access-token",
  "accesstoken",
  "refresh-token",
  "refreshtoken",
  "private-key",
  "privatekey",
  "credential",
]);

const SECRET_SUFFIXES = [
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "privatekey",
  "credential",
];

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (REDACT_KEYS.has(lower)) return true;
  const normalized = normalizedKey(key);
  return SECRET_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export interface RedactSecretsOptions {
  /**
   * Credential values that were made available to the current operation.
   * Exact-value redaction catches accidental echoes even when a provider
   * error does not label the value as a token or API key.
   */
  exactValues?: Iterable<string>;
}

function redactString(value: string, exactValues: readonly string[]): string {
  let redacted = value;
  for (const secret of exactValues) {
    redacted = redacted.replaceAll(secret, "[REDACTED]");
  }
  return redacted
    .replace(
      /([?&](?:api[_-]?key|key|token|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)=)[^&#\s]*/gi,
      "$1[REDACTED]",
    )
    .replace(
      /(\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|passwd|authorization)\s*[:=]\s*["']?)(?!\[redacted\])[^"'&,\s}\]]+/gi,
      "$1[REDACTED]",
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@");
}

/** Recursively redact structured secrets for audit and application logs. */
export function redactSecrets(
  value: unknown,
  options: RedactSecretsOptions = {},
): unknown {
  const exactValues = [...(options.exactValues ?? [])]
    .filter((secret) => secret.length > 0 && secret !== "[REDACTED]")
    .sort((left, right) => right.length - left.length);
  const seen = new WeakSet<object>();
  const visit = (input: unknown): unknown => {
    if (typeof input === "string") return redactString(input, exactValues);
    if (input === null || typeof input !== "object") return input;
    if (input instanceof Date) return input.toISOString();
    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactString(input.message, exactValues),
      };
    }
    if (seen.has(input)) return "[Circular]";
    seen.add(input);
    try {
      if (Array.isArray(input)) return input.map((item) => visit(item));
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        out[k] = shouldRedactKey(k) ? "[REDACTED]" : visit(v);
      }
      return out;
    } finally {
      // Repeated references are safe to serialize more than once; only an
      // object on the active recursion path is a cycle.
      seen.delete(input);
    }
  };
  return visit(value);
}

export class AuditLog {
  private stream: NodeJS.WritableStream | null;
  private readonly runId: string;

  constructor(
    runId: string,
    stream: NodeJS.WritableStream | null = process.stderr,
  ) {
    this.runId = runId;
    this.stream = stream;
  }

  log(level: AuditLevel, event: string, data?: Record<string, unknown>): void {
    const payload: AuditEvent = {
      ts: new Date().toISOString(),
      level,
      runId: this.runId,
      event: redactSecrets(event) as string,
      data: data ? (redactSecrets(data) as Record<string, unknown>) : undefined,
    };
    const line = JSON.stringify(payload);
    if (this.stream) {
      this.stream.write(line + "\n");
    }
  }

  info(event: string, data?: Record<string, unknown>): void {
    this.log("info", event, data);
  }
  warn(event: string, data?: Record<string, unknown>): void {
    this.log("warn", event, data);
  }
  error(event: string, data?: Record<string, unknown>): void {
    this.log("error", event, data);
  }

  close(): void {
    this.stream = null;
  }
}

export function newRunId(): string {
  // 16 hex chars from crypto; not a secret, just a correlation id.
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
