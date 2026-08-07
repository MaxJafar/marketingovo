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
 * X (Twitter) publishing.
 *
 * Two hosts are involved and the split is not cosmetic: posts go to the v2 API
 * on `api.twitter.com`, while media still uploads through the v1.1 endpoint on
 * `upload.twitter.com`. A media id from the second is attached by the first.
 *
 * The free tier's write cap is low enough that hitting it is a normal event
 * rather than an edge case, so a 429 here carries the reset time when X
 * reports one — an operator whose scheduled post failed needs to know whether
 * to wait an hour or upgrade a plan.
 */

const API_HOST = "api.twitter.com";
const UPLOAD_HOST = "upload.twitter.com";
const MAX_BODY_LENGTH = 280;

export interface XPublisherOptions {
  accessToken: string;
  /** The handle this token posts as, used to build a permalink. */
  username?: string | null;
  providerFetch?: typeof fetch;
}

export class XPublisher implements SocialPublisher {
  readonly platform = "x" as const;
  private readonly accessToken: string;
  private readonly username: string | null;
  private readonly providerFetch: typeof fetch;

  constructor(options: XPublisherOptions) {
    const token = options.accessToken.trim();
    if (!token) {
      throw new PublishFailure(
        "credential_invalid",
        "X is not connected. Authorize the account before posting.",
        { retryable: false },
      );
    }
    this.accessToken = token;
    this.username = options.username?.trim() || null;
    this.providerFetch =
      options.providerFetch ??
      createSafeProviderFetch({ allowedHosts: [API_HOST, UPLOAD_HOST] });
  }

  private async call(
    url: string,
    init: {
      body: Uint8Array | string;
      contentType: string;
      signal?: AbortSignal;
    },
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.providerFetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": init.contentType,
          accept: "application/json",
        },
        body: init.body as unknown as BodyInit,
        redirect: "error",
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (error) {
      throw new PublishFailure(
        "provider_unavailable",
        `X could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
        { indeterminate: true },
      );
    }

    if (response.status === 429) {
      const reset = response.headers.get("x-rate-limit-reset");
      const resetAt = Number(reset);
      throw new PublishFailure(
        "rate_limited",
        Number.isFinite(resetAt)
          ? `X is rate limiting this account until ${new Date(resetAt * 1_000).toISOString()}. The free tier caps posts per month, so this may be the monthly limit rather than a short window.`
          : "X is rate limiting this account. The free tier caps posts per month, so this may be the monthly limit rather than a short window.",
      );
    }

    const payload = await readBoundedJson(response);
    if (!response.ok) {
      const record = asRecord(payload);
      const detail =
        typeof record.detail === "string"
          ? record.detail
          : typeof record.title === "string"
            ? record.title
            : "";
      throw failureFromStatus(response.status, detail);
    }
    return asRecord(payload);
  }

  /**
   * Uploads one attachment and returns its media id.
   *
   * Simple upload only. X's chunked protocol exists for large videos, and
   * supporting it half-way would produce partial uploads that look like
   * successes; the size limit is enforced instead, with a clear reason.
   */
  private async uploadMedia(
    attachment: ResolvedAttachment,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!attachment.bytes) {
      throw new PublishFailure(
        "media_unusable",
        `The attachment ${attachment.filename} has no local bytes to upload.`,
        { retryable: false },
      );
    }
    const limit =
      attachment.kind === "video" ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (attachment.bytes.byteLength > limit) {
      throw new PublishFailure(
        "media_unusable",
        `${attachment.filename} is ${Math.round(attachment.bytes.byteLength / 1024 / 1024)}MB and this client uploads at most ${limit / 1024 / 1024}MB in one request.`,
        { retryable: false },
      );
    }

    const { body, contentType } = multipartBody([
      {
        name: "media",
        filename: attachment.filename,
        contentType: attachment.mediaType,
        bytes: attachment.bytes,
      },
    ]);
    const result = await this.call(
      `https://${UPLOAD_HOST}/1.1/media/upload.json`,
      { body, contentType, ...(signal ? { signal } : {}) },
    );
    const mediaId = result.media_id_string;
    if (typeof mediaId !== "string" || !mediaId) {
      throw new PublishFailure(
        "response_invalid",
        "X accepted the media upload but returned no media id.",
      );
    }
    return mediaId;
  }

  async publish(request: PublishRequest): Promise<PublishOutcome> {
    const text = composeText(request.body, request.linkUrl ?? null);
    if (text.length > MAX_BODY_LENGTH) {
      // Refused rather than truncated. A post cut at 280 characters mid-word
      // is published under the operator's name and cannot be taken back.
      throw new PublishFailure(
        "rejected_by_platform",
        `X accepts ${MAX_BODY_LENGTH} characters and this post is ${text.length}. Shorten it before scheduling.`,
        { retryable: false },
      );
    }
    if (request.attachments.length > 4) {
      throw new PublishFailure(
        "rejected_by_platform",
        `X accepts four attachments and this post has ${request.attachments.length}.`,
        { retryable: false },
      );
    }

    const mediaIds: string[] = [];
    for (const attachment of request.attachments) {
      mediaIds.push(await this.uploadMedia(attachment, request.signal));
    }

    const payload: Record<string, unknown> = {
      text,
      ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
    };
    const result = await this.call(`https://${API_HOST}/2/tweets`, {
      body: JSON.stringify(payload),
      contentType: "application/json",
      ...(request.signal ? { signal: request.signal } : {}),
    });

    const data = asRecord(result.data);
    const id = data.id;
    if (typeof id !== "string" || !id) {
      throw new PublishFailure(
        "response_invalid",
        "X accepted the post but returned no id, so it cannot be recorded.",
      );
    }
    return {
      providerId: id,
      permalink: this.username
        ? `https://x.com/${this.username}/status/${id}`
        : `https://x.com/i/web/status/${id}`,
      request: payload,
    };
  }
}

function composeText(body: string, linkUrl: string | null): string {
  const trimmed = body.trim();
  if (!linkUrl || trimmed.includes(linkUrl)) return trimmed;
  return `${trimmed}\n\n${linkUrl}`;
}
