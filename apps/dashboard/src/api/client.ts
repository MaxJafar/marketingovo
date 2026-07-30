import type { ApiEnvelope, DataMeta } from "./contracts";

const API_VERSION_PATH = "/api/v1";

function normalizeBaseUrl(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) return API_VERSION_PATH;
  return configured.replace(/\/$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

let csrfToken: string | null = null;
let sessionPromise: Promise<void> | null = null;

const API_UNAVAILABLE_MESSAGE =
  "The AGENTseo API is unavailable. Check the local service and try again.";

function bootstrapTokenFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return fragment.get("token");
}

async function ensureSession(): Promise<void> {
  if (csrfToken) return;
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const bootstrapToken = bootstrapTokenFromFragment();
    const path = bootstrapToken ? "/session/bootstrap" : "/session";
    const response = await fetchApi(`${API_BASE_URL}${path}`, {
      method: bootstrapToken ? "POST" : "GET",
      credentials: "same-origin",
      headers: bootstrapToken
        ? { "Content-Type": "application/json", Accept: "application/json" }
        : { Accept: "application/json" },
      body: bootstrapToken
        ? JSON.stringify({ token: bootstrapToken })
        : undefined,
    });
    const body = (await parseResponseBody(response)) as
      { csrf?: string } | undefined;
    if (!response.ok) throw errorFromBody(body, response.status);
    if (!body?.csrf) {
      throw new ApiError(
        "The local service returned an invalid session response.",
        502,
        "invalid_session_response",
      );
    }
    csrfToken = body.csrf;
    if (bootstrapToken && typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  })().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiResult<T> {
  data: T;
  meta: DataMeta;
}

async function fetchApi(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(API_UNAVAILABLE_MESSAGE, 0, "api_unavailable");
  }
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(value && typeof value === "object" && "data" in value);
}

function requiresIdempotencyKey(path: string): boolean {
  return (
    path === "/runs" ||
    /^\/runs\/[^/]+\/replay(?:\?|$)/u.test(path) ||
    /^\/actions\/[^/]+\/verify(?:\?|$)/u.test(path)
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    const text = await response.text();
    return text || undefined;
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorFromBody(body: unknown, status: number): ApiError {
  if (body && typeof body === "object") {
    const payload = body as {
      error?: { message?: string; code?: string; details?: unknown };
      message?: string;
      detail?: string;
      code?: string;
      details?: unknown;
    };
    const error = payload.error ?? payload;
    return new ApiError(
      error.message ?? payload.detail ?? `Request failed with status ${status}`,
      status,
      error.code,
      error.details,
    );
  }
  return new ApiError(
    typeof body === "string" ? body : `Request failed with status ${status}`,
    status,
  );
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  await ensureSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-AGENTseo-Client", "dashboard");
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken)
    headers.set("X-AGENTseo-CSRF", csrfToken);
  if (
    method === "POST" &&
    requiresIdempotencyKey(path) &&
    !headers.has("Idempotency-Key")
  ) {
    headers.set("Idempotency-Key", crypto.randomUUID());
  }

  const response = await fetchApi(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    signal: init.signal,
  });

  const body = await parseResponseBody(response);
  if (!response.ok) throw errorFromBody(body, response.status);

  if (isEnvelope<T>(body)) {
    return { data: body.data, meta: body.meta ?? { state: "unknown" } };
  }

  return { data: body as T, meta: { state: "unknown" } };
}

export async function apiDownload(
  path: string,
  init: RequestInit = {},
): Promise<Blob> {
  await ensureSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.agentseo.project+json");
  headers.set("X-AGENTseo-Client", "dashboard");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-AGENTseo-CSRF", csrfToken);
  }
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetchApi(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    signal: init.signal,
  });
  if (!response.ok) {
    const body = await parseResponseBody(response);
    throw errorFromBody(body, response.status);
  }
  return response.blob();
}

export function withQuery(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}
