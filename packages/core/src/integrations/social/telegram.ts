import { createSafeProviderFetch } from "@marketingovo/integrations";
import {
  asRecord,
  failureFromStatus,
  multipartBody,
  PublishFailure,
  readBoundedJson,
  type PublishOutcome,
  type PublishRequest,
  type ResolvedAttachment,
  type SocialPublisher,
} from "./publisher.js";

/**
 * Telegram publishing.
 *
 * The simplest of the four by a wide margin: a bot token that never expires,
 * no OAuth, no app review, and direct multipart upload. Nothing an operator
 * posts here passes through a third party.
 *
 * The bot must be an administrator of the target channel with permission to
 * post. Telegram reports that failure as a 400 with a readable description
 * rather than a 403, so the description is preserved rather than replaced with
 * a generic message.
 */

const TELEGRAM_HOST = "api.telegram.org";
const MAX_CAPTION_LENGTH = 1_024;
const MAX_MESSAGE_LENGTH = 4_096;

export interface TelegramPublisherOptions {
  botToken: string;
  /** `@channelname` or a numeric chat id. */
  providerFetch?: typeof fetch;
}

interface TelegramResponse {
  ok?: unknown;
  result?: unknown;
  description?: unknown;
  error_code?: unknown;
  parameters?: { retry_after?: unknown };
}

export class TelegramPublisher implements SocialPublisher {
  readonly platform = "telegram" as const;
  private readonly botToken: string;
  private readonly providerFetch: typeof fetch;

  constructor(options: TelegramPublisherOptions) {
    const token = options.botToken.trim();
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      throw new PublishFailure(
        "credential_invalid",
        "The Telegram bot token is not in the `<id>:<secret>` form @BotFather issues.",
        { retryable: false },
      );
    }
    this.botToken = token;
    this.providerFetch =
      options.providerFetch ??
      createSafeProviderFetch({ allowedHosts: [TELEGRAM_HOST] });
  }

  private endpoint(method: string): string {
    // The token is a path segment because Telegram's API has no header form.
    // It is encoded, never logged, and the transport refuses redirects so it
    // cannot be forwarded to another host.
    return `https://${TELEGRAM_HOST}/bot${encodeURIComponent(this.botToken)}/${method}`;
  }

  private async call(
    method: string,
    body: Uint8Array | string,
    contentType: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.providerFetch(this.endpoint(method), {
        method: "POST",
        headers: { "content-type": contentType, accept: "application/json" },
        body: body as unknown as BodyInit,
        redirect: "error",
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      // The request may or may not have reached Telegram. Saying so is the
      // only honest answer; the job decides what to do about it.
      throw new PublishFailure(
        "provider_unavailable",
        `Telegram could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
        { indeterminate: true },
      );
    }

    const payload = (await readBoundedJson(response)) as TelegramResponse;
    if (!response.ok || payload.ok !== true) {
      const description =
        typeof payload.description === "string" ? payload.description : "";
      const retryAfter = Number(payload.parameters?.retry_after);
      if (response.status === 429 || Number.isFinite(retryAfter)) {
        throw new PublishFailure(
          "rate_limited",
          `Telegram is rate limiting this bot${Number.isFinite(retryAfter) ? `; retry after ${retryAfter}s` : ""}. ${description}`.trim(),
        );
      }
      // Telegram reports "bot is not a member" and "not enough rights" as 400,
      // which the generic status mapping would call a rejected post. The
      // operator's fix is different, so the distinction is worth making here.
      if (
        /not enough rights|not a member|chat not found|bot was blocked/i.test(
          description,
        )
      ) {
        throw new PublishFailure(
          "permission_denied",
          `Telegram refused: ${description}. Add the bot to the channel as an administrator with permission to post.`,
          { retryable: false },
        );
      }
      throw failureFromStatus(response.status, description);
    }
    return asRecord(payload.result);
  }

  async publish(request: PublishRequest): Promise<PublishOutcome> {
    const chatId = request.externalId.trim();
    if (!chatId) {
      throw new PublishFailure(
        "rejected_by_platform",
        "A Telegram chat id or @channelname is required.",
        { retryable: false },
      );
    }
    const text = composeText(request.body, request.linkUrl ?? null);
    const attachments = request.attachments;

    if (attachments.length === 0) {
      if (text.length > MAX_MESSAGE_LENGTH) {
        throw new PublishFailure(
          "rejected_by_platform",
          `Telegram accepts ${MAX_MESSAGE_LENGTH} characters and this message is ${text.length}.`,
          { retryable: false },
        );
      }
      const form = new URLSearchParams({
        chat_id: chatId,
        text,
        // Plain text: the composer writes prose, and interpreting a stray
        // underscore as markup would silently change what the operator wrote.
        parse_mode: "",
        disable_web_page_preview: "false",
      });
      const result = await this.call(
        "sendMessage",
        form.toString(),
        "application/x-www-form-urlencoded",
        request.signal,
      );
      return this.outcome(chatId, result, { chat_id: chatId, text });
    }

    // A caption is shorter than a message. Rather than truncating what the
    // operator wrote, the overflow is sent as a follow-up message — the post
    // stays complete and nothing is silently dropped.
    const caption = text.slice(0, MAX_CAPTION_LENGTH);
    const overflow = text.slice(MAX_CAPTION_LENGTH);
    const first = attachments[0]!;
    const result =
      attachments.length === 1
        ? await this.sendSingle(chatId, first, caption, request.signal)
        : await this.sendGroup(chatId, attachments, caption, request.signal);

    if (overflow.trim()) {
      await this.call(
        "sendMessage",
        new URLSearchParams({ chat_id: chatId, text: overflow }).toString(),
        "application/x-www-form-urlencoded",
        request.signal,
      );
    }

    return this.outcome(chatId, result, {
      chat_id: chatId,
      caption,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        mediaType: attachment.mediaType,
      })),
      ...(overflow.trim() ? { continuation: overflow } : {}),
    });
  }

  private async sendSingle(
    chatId: string,
    attachment: ResolvedAttachment,
    caption: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const bytes = requireBytes(attachment);
    const method = attachment.kind === "video" ? "sendVideo" : "sendPhoto";
    const field = attachment.kind === "video" ? "video" : "photo";
    const { body, contentType } = multipartBody([
      { name: "chat_id", value: chatId },
      ...(caption ? [{ name: "caption", value: caption }] : []),
      {
        name: field,
        filename: attachment.filename,
        contentType: attachment.mediaType,
        bytes,
      },
    ]);
    return this.call(method, body, contentType, signal);
  }

  private async sendGroup(
    chatId: string,
    attachments: readonly ResolvedAttachment[],
    caption: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    // `sendMediaGroup` returns an array of messages; the first is the anchor
    // the permalink points at.
    const media = attachments.map((attachment, index) => ({
      type: attachment.kind === "video" ? "video" : "photo",
      media: `attach://file${index}`,
      ...(index === 0 && caption ? { caption } : {}),
    }));
    const { body, contentType } = multipartBody([
      { name: "chat_id", value: chatId },
      { name: "media", value: JSON.stringify(media) },
      ...attachments.map((attachment, index) => ({
        name: `file${index}`,
        filename: attachment.filename,
        contentType: attachment.mediaType,
        bytes: requireBytes(attachment),
      })),
    ]);
    const result = await this.call("sendMediaGroup", body, contentType, signal);
    return Array.isArray(result) ? asRecord((result as unknown[])[0]) : result;
  }

  private outcome(
    chatId: string,
    result: Record<string, unknown>,
    request: Record<string, unknown>,
  ): PublishOutcome {
    const messageId = result.message_id;
    if (typeof messageId !== "number") {
      throw new PublishFailure(
        "response_invalid",
        "Telegram accepted the post but returned no message id, so it cannot be recorded.",
      );
    }
    const chat = result.chat;
    const username =
      chat && typeof chat === "object"
        ? (chat as { username?: unknown }).username
        : undefined;
    return {
      providerId: String(messageId),
      // Only public channels with a username have a linkable URL. A private
      // group genuinely has none, and inventing one would be worse than null.
      permalink:
        typeof username === "string" && username
          ? `https://t.me/${username}/${messageId}`
          : null,
      request: { ...request, chat_id: chatId },
    };
  }
}

function requireBytes(attachment: ResolvedAttachment): Uint8Array {
  if (!attachment.bytes) {
    throw new PublishFailure(
      "media_unusable",
      `The attachment ${attachment.filename} has no local bytes to upload.`,
      { retryable: false },
    );
  }
  return attachment.bytes;
}

function composeText(body: string, linkUrl: string | null): string {
  const trimmed = body.trim();
  if (!linkUrl) return trimmed;
  // Telegram auto-links bare URLs, so appending is enough; embedding it in
  // markup would need a parse mode that changes the rest of the text.
  return trimmed.includes(linkUrl) ? trimmed : `${trimmed}\n\n${linkUrl}`;
}
