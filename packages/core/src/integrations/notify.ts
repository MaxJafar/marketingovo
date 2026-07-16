// Notification dispatcher. Pure function over a Notification
// payload. Three channels:
//
//   1. stdout: always available, always-on. Writes a one-line
//      summary to stderr (logs channel) and a full JSON payload
//      to stdout if the operator wants to pipe it. This is the
//      "no config" default.
//
//   2. webhook: HTTP POST. POST the payload as JSON to a
//      configured URL. Configured via AGENTSEO_WEBHOOK_URL env
//      or per-call url param. Headers optional. Best for Slack
//      incoming webhooks, n8n, Make.com, custom backends.
//
//   3. telegram: Telegram Bot API. Sends a message via
//      sendMessage to the configured chat_id. Configured via
//      AGENTSEO_TELEGRAM_BOT_TOKEN + AGENTSEO_TELEGRAM_CHAT_ID.
//
// All channels are independent best-effort. A failure in one
// doesn't affect the others. Results are returned per-channel
// so the caller (CLI) can report them.

import { createHmac, randomUUID } from "node:crypto";
import { resolveSafeAddresses } from "../core/safe-url.js";
import { envStr } from "../env.js";

export type NotifyChannel = "stdout" | "webhook" | "telegram";

export type NotifySeverity = "info" | "warning" | "critical";

export interface NotificationPayload {
  /** Short headline, e.g. "Site regression detected". */
  title: string;
  /** Severity for routing (telegram uses HTML emphasis;
   *  webhook doesn't care; stdout tags it). */
  severity: NotifySeverity;
  /** The site this is about. */
  url: string;
  /** One-paragraph human summary. */
  summary: string;
  /** Optional structured fields for downstream consumers. */
  details?: Record<string, unknown>;
  /** ISO timestamp of the event. */
  timestamp?: string;
}

export interface NotifyOptions {
  channels?: readonly NotifyChannel[];
  /** Webhook URL (otherwise: AGENTSEO_WEBHOOK_URL env). */
  webhookUrl?: string;
  /** Telegram bot token (otherwise: AGENTSEO_TELEGRAM_BOT_TOKEN env). */
  telegramBotToken?: string;
  /** Telegram chat id (otherwise: AGENTSEO_TELEGRAM_CHAT_ID env). */
  telegramChatId?: string;
  /** Optional HMAC secret (otherwise: AGENTSEO_WEBHOOK_SECRET env). */
  webhookSecret?: string;
  /** Override host validation (tests only). */
  webhookHostValidator?: (hostname: string) => Promise<void>;
  /** Per-channel timeout in ms. Default 5_000. */
  timeoutMs?: number;
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
}

export interface ChannelResult {
  channel: NotifyChannel;
  ok: boolean;
  error: string | null;
  durationMs: number;
}

const DEFAULT_CHANNELS: readonly NotifyChannel[] = ["stdout"];

export function isAvailable(): boolean {
  return typeof fetch === "function";
}

/**
 * Dispatch a notification to one or more channels. Returns a
 * per-channel result so the caller can show "webhook failed
 * with timeout, telegram delivered" feedback to the operator.
 */
export async function notify(
  payload: NotificationPayload,
  opts: NotifyOptions = {},
): Promise<ChannelResult[]> {
  const channels =
    opts.channels && opts.channels.length > 0
      ? opts.channels
      : DEFAULT_CHANNELS;
  const tasks = channels.map((c) => dispatchOne(payload, c, opts));
  return Promise.all(tasks);
}

async function dispatchOne(
  payload: NotificationPayload,
  channel: NotifyChannel,
  opts: NotifyOptions,
): Promise<ChannelResult> {
  const started = Date.now();
  try {
    switch (channel) {
      case "stdout":
        writeStdout(payload);
        return {
          channel,
          ok: true,
          error: null,
          durationMs: Date.now() - started,
        };
      case "webhook": {
        const url =
          opts.webhookUrl ??
          envStr("AGENTSEO_WEBHOOK_URL", "SCREAMINGCLAW_WEBHOOK_URL", "");
        if (!url) {
          return {
            channel,
            ok: false,
            error:
              "no webhook URL (set AGENTSEO_WEBHOOK_URL or pass webhookUrl)",
            durationMs: Date.now() - started,
          };
        }
        return await postWebhook(
          payload,
          url,
          opts.timeoutMs ?? 5_000,
          opts.fetchImpl,
          opts.webhookSecret ??
            envStr(
              "AGENTSEO_WEBHOOK_SECRET",
              "SCREAMINGCLAW_WEBHOOK_SECRET",
              "",
            ),
          opts.webhookHostValidator,
        );
      }
      case "telegram": {
        const token =
          opts.telegramBotToken ??
          envStr(
            "AGENTSEO_TELEGRAM_BOT_TOKEN",
            "SCREAMINGCLAW_TELEGRAM_BOT_TOKEN",
            "",
          );
        const chatId =
          opts.telegramChatId ??
          envStr(
            "AGENTSEO_TELEGRAM_CHAT_ID",
            "SCREAMINGCLAW_TELEGRAM_CHAT_ID",
            "",
          );
        if (!token || !chatId) {
          return {
            channel,
            ok: false,
            error:
              "missing AGENTSEO_TELEGRAM_BOT_TOKEN or AGENTSEO_TELEGRAM_CHAT_ID",
            durationMs: Date.now() - started,
          };
        }
        return await postTelegram(
          payload,
          token,
          chatId,
          opts.timeoutMs ?? 5_000,
          opts.fetchImpl ?? fetch,
        );
      }
      default:
        return {
          channel,
          ok: false,
          error: `unknown channel: ${channel as string}`,
          durationMs: Date.now() - started,
        };
    }
  } catch (err) {
    return {
      channel,
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - started,
    };
  }
}

function writeStdout(p: NotificationPayload): void {
  const ts = p.timestamp ?? new Date().toISOString();
  // The summary line goes to stderr (logs channel) and a
  // structured JSON envelope goes to stdout (pipe-friendly).
  // Same convention as the audit command: stderr is logs,
  // stdout is the structured output.
  process.stderr.write(
    `[notify:${p.severity}] ${ts} ${p.title} — ${p.url}\n${p.summary}\n`,
  );
  process.stdout.write(JSON.stringify(p, null, 2) + "\n");
}

async function postWebhook(
  payload: NotificationPayload,
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch | undefined,
  secret: string,
  hostValidator?: (hostname: string) => Promise<void>,
): Promise<ChannelResult> {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return {
        channel: "webhook",
        ok: false,
        error: "webhook URL must use HTTPS",
        durationMs: Date.now() - started,
      };
    }
    if (parsed.username || parsed.password) {
      return {
        channel: "webhook",
        ok: false,
        error: "webhook URL must not contain credentials",
        durationMs: Date.now() - started,
      };
    }
    if (hostValidator) await hostValidator(parsed.hostname);
    const addresses = hostValidator
      ? []
      : await resolveSafeAddresses(parsed.hostname, false);

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const eventId = randomUUID();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-agentseo-event-id": eventId,
      "x-agentseo-timestamp": timestamp,
      // These headers are a deliberate 1.x webhook compatibility boundary.
      // Mirror canonical values exactly so legacy verifiers never observe a
      // different event identity or signed timestamp during migration.
      "x-golemseo-event-id": eventId,
      "x-golemseo-timestamp": timestamp,
    };
    if (secret) {
      const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
      headers["x-agentseo-signature"] = signature;
      headers["x-golemseo-signature"] = signature;
    }
    if (fetchImpl) {
      const res = await fetchImpl(parsed.toString(), {
        method: "POST",
        headers,
        body,
        // Never let fetch follow a redirect to an unvalidated/private host.
        redirect: "error",
        signal: ac.signal,
      });
      if (!res.ok) {
        return {
          channel: "webhook",
          ok: false,
          error: `HTTP ${res.status}`,
          durationMs: Date.now() - started,
        };
      }
    } else {
      const address = addresses[0];
      if (!address)
        throw new Error("webhook target did not resolve to a safe address");
      const undici = await import("undici");
      const dispatcher = new undici.Agent({
        connect: {
          timeout: timeoutMs,
          lookup: ((
            _hostname: string,
            _options: unknown,
            callback: (
              error: Error | null,
              result: string,
              family: number,
            ) => void,
          ) => {
            callback(null, address.address, address.family);
          }) as never,
        },
      });
      try {
        const res = await undici.request(parsed.toString(), {
          method: "POST",
          headers,
          body,
          dispatcher,
          signal: ac.signal,
        });
        await res.body.dump();
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return {
            channel: "webhook",
            ok: false,
            error: `HTTP ${res.statusCode}`,
            durationMs: Date.now() - started,
          };
        }
      } finally {
        await dispatcher.close();
      }
    }
    return {
      channel: "webhook",
      ok: true,
      error: null,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      channel: "webhook",
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function postTelegram(
  payload: NotificationPayload,
  token: string,
  chatId: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<ChannelResult> {
  const started = Date.now();
  // Telegram supports a small subset of HTML. We map severity to
  // a prefix and wrap the body. The payload is converted to a
  // human-readable message; the original JSON is included in a
  // <pre> block so operators can copy-paste it.
  const icon =
    payload.severity === "critical"
      ? "🔴"
      : payload.severity === "warning"
        ? "🟡"
        : "🟢";
  const text =
    `${icon} <b>${escapeHtml(payload.title)}</b>\n` +
    `<i>${escapeHtml(payload.url)}</i>\n\n` +
    `${escapeHtml(payload.summary)}\n\n` +
    `<pre>${escapeHtml(JSON.stringify(payload.details ?? {}, null, 2))}</pre>`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      redirect: "error",
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        channel: "telegram",
        ok: false,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
        durationMs: Date.now() - started,
      };
    }
    return {
      channel: "telegram",
      ok: true,
      error: null,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      channel: "telegram",
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Build a NotificationPayload from an AuditDelta. Used by the
 * `watch` CLI to turn a regression result into a notification.
 */
export function deltaToNotification(
  delta: {
    regressionScore: number;
    newIssues: Array<{ id: string; priority: string; message: string }>;
    resolvedIssues: Array<{ id: string; priority: string }>;
    previousRunId: string | null;
    currentRunId: string;
    summary: string;
  },
  url: string,
): NotificationPayload {
  let severity: NotifySeverity = "info";
  if (delta.regressionScore > 15) severity = "critical";
  else if (delta.regressionScore > 5) severity = "warning";

  const title =
    severity === "critical"
      ? "🔴 Site regression detected"
      : severity === "warning"
        ? "🟡 New SEO issues detected"
        : "🟢 SEO audit clean";

  return {
    title,
    severity,
    url,
    summary: delta.summary,
    details: {
      regressionScore: delta.regressionScore,
      newCount: delta.newIssues.length,
      resolvedCount: delta.resolvedIssues.length,
      newIssues: delta.newIssues
        .slice(0, 20)
        .map((i) => ({ id: i.id, priority: i.priority, message: i.message })),
      currentRunId: delta.currentRunId,
      previousRunId: delta.previousRunId,
    },
    timestamp: new Date().toISOString(),
  };
}
