import { randomBytes } from "node:crypto";

// The publisher interface every platform implements.
//
// Deliberately small. A publisher takes a fully-resolved post and returns what
// the provider said, or throws with a reason an operator can act on. It does
// not decide whether to send, does not retry, does not record — those belong
// to the job that calls it, because they must behave identically across
// platforms and a per-platform copy would eventually not.

export type SocialPlatform = "telegram" | "x" | "facebook-page" | "instagram";

/** One attachment, already resolved to whichever form the platform needs. */
export interface ResolvedAttachment {
  mediaType: string;
  kind: "image" | "video";
  filename: string;
  /** The bytes, for platforms that accept an upload. */
  bytes?: Uint8Array;
  /** A public URL, for platforms that fetch the asset themselves. */
  publicUrl?: string;
}

export interface PublishRequest {
  /** The provider's own identifier for the destination. */
  externalId: string;
  body: string;
  attachments: readonly ResolvedAttachment[];
  /** Appended by publishers whose platform does not auto-link. */
  linkUrl?: string | null;
  signal?: AbortSignal;
}

export interface PublishOutcome {
  /** The provider's identifier for what it created. */
  providerId: string;
  /** A link to the live post, when the provider returns enough to build one. */
  permalink: string | null;
  /**
   * The exact request as sent, for the immutable record.
   *
   * Built by the publisher rather than the caller because only the publisher
   * knows what it actually put on the wire — the caller's draft is not the
   * request, and recording the draft would answer the wrong question later.
   */
  request: Record<string, unknown>;
}

/**
 * Why a send failed, in terms the job can act on.
 *
 * `retryable` is the important one: a rate limit or a 5xx should be tried
 * again, while a rejected creative or a revoked token should not, because
 * retrying those burns the operator's quota to produce the same refusal.
 */
export type PublishFailureCode =
  | "credential_invalid"
  | "permission_denied"
  | "rate_limited"
  | "rejected_by_platform"
  | "media_unusable"
  | "provider_unavailable"
  | "response_invalid";

export class PublishFailure extends Error {
  readonly code: PublishFailureCode;
  readonly retryable: boolean;
  /** Set when the request left but its outcome is unknown. */
  readonly indeterminate: boolean;

  constructor(
    code: PublishFailureCode,
    message: string,
    options: { retryable?: boolean; indeterminate?: boolean } = {},
  ) {
    super(message);
    this.name = "PublishFailure";
    this.code = code;
    this.retryable =
      options.retryable ??
      (code === "rate_limited" || code === "provider_unavailable");
    this.indeterminate = options.indeterminate ?? false;
  }
}

export interface SocialPublisher {
  readonly platform: SocialPlatform;
  publish(request: PublishRequest): Promise<PublishOutcome>;
}

/**
 * Reads a provider response body without letting a hostile or broken endpoint
 * stream unboundedly into memory.
 */
export async function readBoundedJson(
  response: Response,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    throw new PublishFailure(
      "response_invalid",
      "The provider returned a response larger than this client will read.",
    );
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PublishFailure(
      "response_invalid",
      "The provider returned a response larger than this client will read.",
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublishFailure(
      "response_invalid",
      `The provider returned a body that was not JSON (status ${response.status}).`,
    );
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublishFailure(
      "response_invalid",
      "The provider returned a response that was not an object.",
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Builds a multipart body without a dependency.
 *
 * Three of the four publishers upload bytes, and they all need this. Node's
 * `FormData` would also work, but constructing the body explicitly keeps the
 * exact bytes sent visible in one place — which is the same reason the publish
 * record stores the request rather than a summary.
 */
export function multipartBody(
  parts: ReadonlyArray<
    | { name: string; value: string }
    | {
        name: string;
        filename: string;
        contentType: string;
        bytes: Uint8Array;
      }
  >,
): { body: Uint8Array; contentType: string } {
  // Random rather than derived from the content: a boundary that could appear
  // inside an uploaded file would truncate the upload at that byte, and image
  // and video payloads are exactly where an arbitrary byte sequence occurs.
  const boundary = `----marketingovo${randomBytes(16).toString("hex")}`;
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  for (const part of parts) {
    if ("value" in part) {
      chunks.push(
        encoder.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`,
        ),
      );
      continue;
    }
    chunks.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.filename.replace(/"/g, "")}"\r\n` +
          `Content-Type: ${part.contentType}\r\n\r\n`,
      ),
    );
    chunks.push(part.bytes);
    chunks.push(encoder.encode("\r\n"));
  }
  chunks.push(encoder.encode(`--${boundary}--\r\n`));

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Maps an HTTP status onto a failure code when the provider gives no better
 * signal. Publishers override this with their own error vocabulary where they
 * have one, because a status alone rarely distinguishes "your token died"
 * from "this account cannot post here".
 */
export function failureFromStatus(
  status: number,
  detail: string,
): PublishFailure {
  if (status === 401) {
    return new PublishFailure(
      "credential_invalid",
      `The provider rejected the credential. Reconnect the account. ${detail}`.trim(),
      { retryable: false },
    );
  }
  if (status === 403) {
    return new PublishFailure(
      "permission_denied",
      `The account is not permitted to post here. Check its role and the granted scopes. ${detail}`.trim(),
      { retryable: false },
    );
  }
  if (status === 429) {
    return new PublishFailure(
      "rate_limited",
      `The provider is rate limiting this account. ${detail}`.trim(),
    );
  }
  if (status >= 500) {
    return new PublishFailure(
      "provider_unavailable",
      `The provider returned a server error (${status}). ${detail}`.trim(),
    );
  }
  return new PublishFailure(
    "rejected_by_platform",
    `The provider refused the post (${status}). ${detail}`.trim(),
    { retryable: false },
  );
}
