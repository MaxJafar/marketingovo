import { createHash, createHmac } from "node:crypto";
import { createSafeProviderFetch } from "./provider-fetch.js";

/**
 * Puts one asset in the operator's own object storage and returns its public
 * URL.
 *
 * This exists for exactly one reason: Instagram's Content Publishing API
 * fetches media from a public URL and has no upload endpoint, and a tool bound
 * to 127.0.0.1 has no public URL to give it. Every other supported platform
 * takes bytes directly and never reaches this code.
 *
 * SigV4 is implemented here rather than pulled from an SDK. The signing
 * algorithm is about a hundred lines and stable since 2012; an SDK would add
 * tens of megabytes and its own transport to a product whose entire egress
 * story is one audited fetch wrapper.
 */

export type MediaRelayErrorCode =
  | "relay_not_configured"
  | "relay_endpoint_invalid"
  | "relay_rejected"
  | "relay_unreachable";

export class MediaRelayError extends Error {
  readonly code: MediaRelayErrorCode;

  constructor(code: MediaRelayErrorCode, message: string) {
    super(message);
    this.name = "MediaRelayError";
    this.code = code;
  }
}

export interface MediaRelayCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Temporary credentials also carry a session token. */
  sessionToken?: string;
}

export interface MediaRelayTarget {
  /** Exact host, no scheme and no path. */
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
  forcePathStyle?: boolean;
}

const SERVICE = "s3";
const sha256Hex = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const hmac = (key: Uint8Array | string, value: string): Buffer =>
  createHmac("sha256", key).update(value, "utf8").digest();

/**
 * Percent-encodes for SigV4, which is stricter than `encodeURIComponent`:
 * every character outside the unreserved set must be escaped, and a path
 * segment's slashes must survive.
 */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function validateEndpoint(endpoint: string): string {
  const host = endpoint.trim().toLowerCase();
  if (
    !host ||
    host.length > 253 ||
    !/^[a-z0-9.-]+$/.test(host) ||
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.includes("..") ||
    // An IP literal would bypass the DNS validation the transport performs.
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    throw new MediaRelayError(
      "relay_endpoint_invalid",
      "The storage endpoint must be a single exact hostname, without a scheme, port or path.",
    );
  }
  return host;
}

/** `20260806T091500Z` and its `20260806` date prefix. */
function amazonTimestamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = `${now.toISOString().replace(/[:-]|\.\d{3}/g, "")}`;
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Signs a single PUT.
 *
 * Exported separately from the upload so the signature can be tested against
 * AWS's published example vectors without a network or a bucket.
 */
export function signObjectPut(input: {
  target: MediaRelayTarget;
  credentials: MediaRelayCredentials;
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  now: Date;
}): SignedRequest {
  const host = validateEndpoint(input.target.endpoint);
  const bucket = input.target.bucket.trim();
  if (!bucket) {
    throw new MediaRelayError(
      "relay_endpoint_invalid",
      "A bucket name is required.",
    );
  }

  // Virtual-hosted style is the default; MinIO and some clones need path style.
  const pathStyle = input.target.forcePathStyle === true;
  const requestHost = pathStyle ? host : `${bucket}.${host}`;
  const encodedKey = input.objectKey
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
  const canonicalUri = pathStyle
    ? `/${encodeRfc3986(bucket)}/${encodedKey}`
    : `/${encodedKey}`;

  const { amzDate, dateStamp } = amazonTimestamps(input.now);
  const payloadHash = sha256Hex(input.body);

  const headers: Record<string, string> = {
    host: requestHost,
    "content-type": input.contentType,
    "content-length": String(input.body.byteLength),
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(input.credentials.sessionToken
      ? { "x-amz-security-token": input.credentials.sessionToken }
      : {}),
  };

  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${input.target.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${input.credentials.secretAccessKey}`, dateStamp),
        input.target.region,
      ),
      SERVICE,
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    url: `https://${requestHost}${canonicalUri}`,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** The URL the object is publicly readable from, per the operator's config. */
export function publicUrlFor(
  target: MediaRelayTarget,
  objectKey: string,
): string {
  const base = target.publicBaseUrl.replace(/\/+$/, "");
  const encoded = objectKey
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
  return `${base}/${encoded}`;
}

export interface UploadMediaOptions {
  target: MediaRelayTarget;
  credentials: MediaRelayCredentials;
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

/**
 * Uploads and returns the public URL.
 *
 * The transport is built for this one operator-declared host. That is the only
 * place in the product where the exact-host allowlist is authored at runtime
 * rather than compiled in, and it is confined to infrastructure the operator
 * owns. Every other guarantee still applies and is still enforced per call:
 * HTTPS only, DNS re-resolved, non-public addresses refused, redirects refused.
 */
export async function uploadMediaToRelay(
  options: UploadMediaOptions,
): Promise<string> {
  const host = validateEndpoint(options.target.endpoint);
  const pathStyle = options.target.forcePathStyle === true;
  const signed = signObjectPut({
    target: options.target,
    credentials: options.credentials,
    objectKey: options.objectKey,
    body: options.body,
    contentType: options.contentType,
    now: (options.now ?? (() => new Date()))(),
  });

  const fetchImpl =
    options.fetchImpl ??
    createSafeProviderFetch({
      allowedHosts: [
        pathStyle ? host : `${options.target.bucket.trim()}.${host}`,
      ],
    });

  let response: Response;
  try {
    response = await fetchImpl(signed.url, {
      method: "PUT",
      // `host` is set by the transport itself and must not be sent explicitly;
      // the signature covers its value, not its presence in this object.
      headers: Object.fromEntries(
        Object.entries(signed.headers).filter(([name]) => name !== "host"),
      ),
      body: options.body as unknown as BodyInit,
      redirect: "error",
    });
  } catch (error) {
    throw new MediaRelayError(
      "relay_unreachable",
      `The storage endpoint could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  if (!response.ok) {
    // S3 returns its reason as an XML body. The status alone cannot tell an
    // operator whether the key was wrong, the bucket policy refused, or the
    // clock is skewed, and those need different fixes.
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new MediaRelayError(
      "relay_rejected",
      `The storage endpoint rejected the upload with status ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  return publicUrlFor(options.target, options.objectKey);
}
