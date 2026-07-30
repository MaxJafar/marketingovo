// Logger interface for module-internal logging.
//
// A module should not write to stdout/stderr directly — it should
// use the logger from its context. The composer wires up a real
// logger (e.g. pino, console-with-tee) in production and a quiet
// logger in tests.
//
// We don't pull in pino/winston as a hard dep yet. The default
// implementation writes to console with a marketingovo prefix; an
// adapter to pino can be added in Sprint 15 (enterprise hardening)
// when observability becomes a hard requirement.

import { redactSecrets } from "./audit.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  /** Return a child logger that automatically tags every line with `bindings`. */
  child(bindings: Record<string, unknown>): Logger;
}

/** Default console-backed logger. Prefix: `[marketingovo]`. */
export class ConsoleLogger implements Logger {
  private readonly prefix: string;
  private readonly bindings: Record<string, unknown>;

  constructor(bindings: Record<string, unknown> = {}) {
    this.prefix = "[marketingovo]";
    this.bindings = bindings;
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const ts = new Date().toISOString();
    const safeMessage = redactSecrets(message) as string;
    const all = redactSecrets({ ...this.bindings, ...context }) as Record<
      string,
      unknown
    >;
    const ctxStr =
      Object.keys(all).length === 0 ? "" : " " + JSON.stringify(all);
    // All log levels go to stderr. stdout is reserved for the
    // command's structured output (JSON for audit, markdown for
    // report, etc.) — mixing logs into stdout would corrupt
    // pipe-friendly output.
    // eslint-disable-next-line no-console
    const stream = console.error;
    stream(
      `${ts} ${level.toUpperCase().padEnd(5)} ${this.prefix} ${safeMessage}${ctxStr}`,
    );
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.emit("error", message, context);
  }
  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}

/** Logger that swallows all output. Useful in tests. */
export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): Logger {
    return this;
  }
}
