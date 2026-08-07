import {
  classifyMetaGraphFailure,
  metaGraphUrl,
  normalizeGraphVersion,
  safeMetaGraphFetch,
} from "@marketingovo/integrations";
import {
  asRecord,
  multipartBody,
  PublishFailure,
  readBoundedJson,
  type PublishOutcome,
  type PublishRequest,
  type SocialPublisher,
} from "./publisher.js";

/**
 * Facebook Page and Instagram publishing, on the Meta credential already
 * connected for ads.
 *
 * The two differ in a way that decides the whole media pipeline. A Facebook
 * Page accepts an uploaded photo. Instagram does not: its Content Publishing
 * API takes an `image_url`, fetches the asset itself, and offers no upload
 * endpoint at all. An Instagram post therefore requires an asset that is
 * already reachable at a public HTTPS URL, and there is no local-only path to
 * one.
 *
 * Instagram also publishes in two steps — create a container, then publish it
 * — and the gap between them is a real failure mode: a created container that
 * is never published is an invisible draft that still counts toward nothing,
 * while a published container cannot be recalled. The container id is
 * therefore reported as the indeterminate marker if the second call fails.
 */

async function metaCall(
  url: URL,
  init: {
    body: Uint8Array | string;
    contentType: string;
    accessToken: string;
    providerFetch: typeof fetch;
    signal?: AbortSignal;
  },
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await init.providerFetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${init.accessToken}`,
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
      `Meta could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
      { indeterminate: true },
    );
  }

  const payload = await readBoundedJson(response);
  if (!response.ok) {
    const graphError = classifyMetaGraphFailure(response.status, payload);
    const code =
      graphError.code === "meta_rate_limited"
        ? "rate_limited"
        : graphError.code === "meta_permission_denied"
          ? "permission_denied"
          : graphError.code === "meta_unavailable"
            ? "provider_unavailable"
            : graphError.code === "meta_token_expired" ||
                graphError.code === "meta_token_invalid"
              ? "credential_invalid"
              : "rejected_by_platform";
    throw new PublishFailure(code, graphError.message, {
      retryable: code === "rate_limited" || code === "provider_unavailable",
    });
  }
  return asRecord(payload);
}

export interface MetaPublisherOptions {
  accessToken: string;
  graphVersion?: string;
  providerFetch?: typeof fetch;
}

export class FacebookPagePublisher implements SocialPublisher {
  readonly platform = "facebook-page" as const;
  private readonly accessToken: string;
  private readonly graphVersion: string;
  private readonly providerFetch: typeof fetch;

  constructor(options: MetaPublisherOptions) {
    this.accessToken = options.accessToken.trim();
    this.graphVersion = normalizeGraphVersion(options.graphVersion);
    this.providerFetch = options.providerFetch ?? safeMetaGraphFetch;
    if (!this.accessToken) {
      throw new PublishFailure(
        "credential_invalid",
        "A Page access token is required to post to a Facebook Page.",
        { retryable: false },
      );
    }
  }

  async publish(request: PublishRequest): Promise<PublishOutcome> {
    const pageId = request.externalId.trim();
    const message = composeText(request.body, request.linkUrl ?? null);
    const attachment = request.attachments[0];

    if (request.attachments.length > 1) {
      // A multi-photo Page post needs unpublished photo containers plus an
      // attached_media feed post. Supporting one photo honestly beats
      // half-supporting several and leaving orphaned unpublished uploads on
      // the operator's Page when the second call fails.
      throw new PublishFailure(
        "rejected_by_platform",
        "This connector posts one photo per Facebook Page post. Split the post, or publish the album from Meta's own composer.",
        { retryable: false },
      );
    }

    if (!attachment) {
      const body = new URLSearchParams({ message });
      const result = await metaCall(
        metaGraphUrl(this.graphVersion, `${pageId}/feed`),
        {
          body: body.toString(),
          contentType: "application/x-www-form-urlencoded",
          accessToken: this.accessToken,
          providerFetch: this.providerFetch,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );
      return this.outcome(pageId, result, { message });
    }

    if (attachment.kind === "video") {
      throw new PublishFailure(
        "rejected_by_platform",
        "Video posts to a Facebook Page use Meta's resumable upload protocol, which this connector does not implement. Post the video from Meta's composer.",
        { retryable: false },
      );
    }
    if (!attachment.bytes) {
      throw new PublishFailure(
        "media_unusable",
        `The attachment ${attachment.filename} has no local bytes to upload.`,
        { retryable: false },
      );
    }

    const { body, contentType } = multipartBody([
      { name: "caption", value: message },
      {
        name: "source",
        filename: attachment.filename,
        contentType: attachment.mediaType,
        bytes: attachment.bytes,
      },
    ]);
    const result = await metaCall(
      metaGraphUrl(this.graphVersion, `${pageId}/photos`),
      {
        body,
        contentType,
        accessToken: this.accessToken,
        providerFetch: this.providerFetch,
        ...(request.signal ? { signal: request.signal } : {}),
      },
    );
    return this.outcome(pageId, result, {
      caption: message,
      attachment: {
        filename: attachment.filename,
        mediaType: attachment.mediaType,
      },
    });
  }

  private outcome(
    pageId: string,
    result: Record<string, unknown>,
    request: Record<string, unknown>,
  ): PublishOutcome {
    // A feed post returns `id`; a photo returns `post_id` alongside its own.
    const postId =
      typeof result.post_id === "string"
        ? result.post_id
        : typeof result.id === "string"
          ? result.id
          : null;
    if (!postId) {
      throw new PublishFailure(
        "response_invalid",
        "Facebook accepted the post but returned no id, so it cannot be recorded.",
      );
    }
    return {
      providerId: postId,
      permalink: `https://www.facebook.com/${postId.includes("_") ? postId.replace("_", "/posts/") : `${pageId}/posts/${postId}`}`,
      request,
    };
  }
}

export class InstagramPublisher implements SocialPublisher {
  readonly platform = "instagram" as const;
  private readonly accessToken: string;
  private readonly graphVersion: string;
  private readonly providerFetch: typeof fetch;

  constructor(options: MetaPublisherOptions) {
    this.accessToken = options.accessToken.trim();
    this.graphVersion = normalizeGraphVersion(options.graphVersion);
    this.providerFetch = options.providerFetch ?? safeMetaGraphFetch;
    if (!this.accessToken) {
      throw new PublishFailure(
        "credential_invalid",
        "An access token with instagram_content_publish is required to post to Instagram.",
        { retryable: false },
      );
    }
  }

  async publish(request: PublishRequest): Promise<PublishOutcome> {
    const igUserId = request.externalId.trim();
    const caption = composeText(request.body, request.linkUrl ?? null);
    const attachments = request.attachments;

    if (attachments.length === 0) {
      throw new PublishFailure(
        "rejected_by_platform",
        "Instagram has no text-only post. Attach an image or video.",
        { retryable: false },
      );
    }
    const withoutUrl = attachments.filter(
      (attachment) => !attachment.publicUrl,
    );
    if (withoutUrl.length > 0) {
      // The defining constraint of this platform, stated where it happens.
      throw new PublishFailure(
        "media_unusable",
        `Instagram fetches media from a public URL rather than accepting an upload, and ${withoutUrl.length} attachment(s) are only stored locally. Publish them to your own storage first, or supply a URL you already host.`,
        { retryable: false },
      );
    }

    const containerIds: string[] = [];
    for (const attachment of attachments) {
      const parameters = new URLSearchParams({
        ...(attachment.kind === "video"
          ? { video_url: attachment.publicUrl!, media_type: "REELS" }
          : { image_url: attachment.publicUrl! }),
        // A carousel child carries no caption; the parent does.
        ...(attachments.length === 1
          ? { caption }
          : { is_carousel_item: "true" }),
      });
      const created = await metaCall(
        metaGraphUrl(this.graphVersion, `${igUserId}/media`),
        {
          body: parameters.toString(),
          contentType: "application/x-www-form-urlencoded",
          accessToken: this.accessToken,
          providerFetch: this.providerFetch,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );
      const id = created.id;
      if (typeof id !== "string" || !id) {
        throw new PublishFailure(
          "response_invalid",
          "Instagram accepted the media container but returned no id.",
        );
      }
      containerIds.push(id);
    }

    let creationId = containerIds[0]!;
    if (containerIds.length > 1) {
      const carousel = await metaCall(
        metaGraphUrl(this.graphVersion, `${igUserId}/media`),
        {
          body: new URLSearchParams({
            media_type: "CAROUSEL",
            children: containerIds.join(","),
            caption,
          }).toString(),
          contentType: "application/x-www-form-urlencoded",
          accessToken: this.accessToken,
          providerFetch: this.providerFetch,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );
      const id = carousel.id;
      if (typeof id !== "string" || !id) {
        throw new PublishFailure(
          "response_invalid",
          "Instagram accepted the carousel container but returned no id.",
        );
      }
      creationId = id;
    }

    let published: Record<string, unknown>;
    try {
      published = await metaCall(
        metaGraphUrl(this.graphVersion, `${igUserId}/media_publish`),
        {
          body: new URLSearchParams({ creation_id: creationId }).toString(),
          contentType: "application/x-www-form-urlencoded",
          accessToken: this.accessToken,
          providerFetch: this.providerFetch,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );
    } catch (error) {
      // The container exists on Instagram's side and this attempt did not
      // publish it. Retrying the whole post would create a second container;
      // saying so lets the job stop rather than duplicate.
      throw new PublishFailure(
        error instanceof PublishFailure ? error.code : "provider_unavailable",
        `${error instanceof Error ? error.message : "The publish step failed."} A media container (${creationId}) was already created and was not published; retrying this post would create another.`,
        {
          retryable: false,
          indeterminate:
            error instanceof PublishFailure ? error.indeterminate : true,
        },
      );
    }

    const id = published.id;
    if (typeof id !== "string" || !id) {
      throw new PublishFailure(
        "response_invalid",
        "Instagram published the post but returned no id, so it cannot be recorded.",
      );
    }
    return {
      providerId: id,
      // Instagram's shortcode is not in the publish response, and building a
      // permalink from the media id does not resolve. Null is the honest
      // answer; the operator can open the post from their profile.
      permalink: null,
      request: {
        caption,
        media: attachments.map((attachment) => ({
          url: attachment.publicUrl,
          kind: attachment.kind,
        })),
        creation_id: creationId,
      },
    };
  }
}

function composeText(body: string, linkUrl: string | null): string {
  const trimmed = body.trim();
  if (!linkUrl || trimmed.includes(linkUrl)) return trimmed;
  return `${trimmed}\n\n${linkUrl}`;
}
