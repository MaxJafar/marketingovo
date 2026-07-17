import type { components } from "./generated/openapi.js";

export type Health = components["schemas"]["Health"];
export type DashboardSession = components["schemas"]["Session"];
export type Run = components["schemas"]["Run"];
export type RunDetail = components["schemas"]["RunDetail"];
export type RunEvent = components["schemas"]["RunEvent"];
export type ComparisonStartRequest =
  components["schemas"]["ComparisonStartRequest"];
export type ResearchStartRequest =
  components["schemas"]["ResearchStartRequest"];
export type ImportPreview = components["schemas"]["ImportPreview"];
export type ComparisonReport = components["schemas"]["ComparisonReport"];
export type SearchResult = components["schemas"]["SearchResult"];
export type Entity = components["schemas"]["Entity"];
export type MonitoringStatus = components["schemas"]["MonitoringStatus"];

export interface ClientOptions {
  baseUrl?: string;
  token?: string;
  csrfToken?: string;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface RunEventStreamOptions {
  signal?: AbortSignal;
  afterSequence?: number;
  reconnect?: boolean;
  maxReconnects?: number;
  reconnectDelayMs?: number;
}

export class GolemIntelApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "GolemIntelApiError";
  }
}

const LOOPBACK_BASE_URL = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;

export function validateLoopbackBaseUrl(value: string): string {
  const match = LOOPBACK_BASE_URL.exec(value);
  const port = match?.[1] ? Number(match[1]) : 0;
  if (!match || port < 1 || port > 65_535) {
    throw new TypeError(
      "Golem Intel API URL must be an exact http://127.0.0.1:<port> origin",
    );
  }
  return value;
}

function defaultBaseUrl(): string {
  const browserOrigin = globalThis.location?.origin;
  if (browserOrigin && browserOrigin !== "null") {
    return validateLoopbackBaseUrl(browserOrigin);
  }
  return "http://127.0.0.1:7465";
}

function resolveBaseUrl(value: string | undefined): string {
  return value ? validateLoopbackBaseUrl(value) : defaultBaseUrl();
}

function parseProblem(body: unknown, status: number): GolemIntelApiError {
  if (body && typeof body === "object") {
    const problem = body as {
      title?: string;
      detail?: string;
      code?: string;
    };
    return new GolemIntelApiError(
      problem.detail ?? problem.title ?? `Request failed with ${status}`,
      status,
      problem.code,
      body,
    );
  }
  return new GolemIntelApiError(`Request failed with ${status}`, status);
}

function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export function parseServerSentEvent(block: string): RunEvent | undefined {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return undefined;
  return JSON.parse(data) as RunEvent;
}

function eventStreamOptions(
  value: AbortSignal | RunEventStreamOptions | undefined,
): RunEventStreamOptions {
  if (value && "aborted" in value && "addEventListener" in value) {
    return { signal: value as AbortSignal };
  }
  return value ?? {};
}

async function waitForReconnect(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function bootstrapDashboardSession(
  token: string,
  options: Pick<ClientOptions, "baseUrl" | "fetch"> = {},
): Promise<DashboardSession> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;
  const response = await fetcher(`${baseUrl}/v1/session/bootstrap`, {
    method: "POST",
    credentials: "same-origin",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw parseProblem(body, response.status);
  return body as DashboardSession;
}

export class GolemIntelClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly token?: string;
  readonly csrfToken?: string;
  readonly credentials: RequestCredentials;
  readonly fetcher: typeof globalThis.fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.token = options.token;
    this.csrfToken = options.csrfToken;
    this.credentials = options.credentials ?? "same-origin";
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const method = (init.method ?? "GET").toUpperCase();
    if (this.csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-Golem-CSRF", this.csrfToken);
    }
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        credentials: this.credentials,
        redirect: "error",
        signal: init.signal ?? controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body: unknown = contentType.includes("json")
        ? await response.json()
        : await response.text();
      if (!response.ok) throw parseProblem(body, response.status);
      return body as T;
    } catch (error) {
      if (error instanceof GolemIntelApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new GolemIntelApiError(
          "Request timed out or was cancelled",
          0,
          "aborted",
        );
      }
      throw new GolemIntelApiError(
        error instanceof Error ? error.message : "Local API unavailable",
        0,
        "api_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  health(): Promise<Health> {
    return this.request<Health>("/v1/health");
  }

  session = {
    get: (): Promise<DashboardSession> =>
      this.request<DashboardSession>("/v1/session"),
  };

  comparisons = {
    start: (input: ComparisonStartRequest): Promise<Run> =>
      this.request<Run>("/v1/comparisons", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  research = {
    start: (input: ResearchStartRequest): Promise<Run> =>
      this.request<Run>("/v1/research", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  datasets = {
    previewCompetitivePulse: (input: BodyInit): Promise<ImportPreview> =>
      this.request<ImportPreview>("/v1/datasets/competitive-pulse/preview", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "X-Golem-Import-Attestation":
            "public-permitted-brand-competitive-research.v1",
        },
        body: input,
      }),
    get: (datasetId: string): Promise<ImportPreview> =>
      this.request<ImportPreview>(
        `/v1/datasets/${encodeURIComponent(datasetId)}`,
      ),
    delete: (datasetId: string): Promise<ImportPreview> =>
      this.request<ImportPreview>(
        `/v1/datasets/${encodeURIComponent(datasetId)}`,
        { method: "DELETE" },
      ),
  };

  runs = {
    list: (projectId?: string, limit = 50): Promise<Run[]> =>
      this.request<Run[]>(
        `/v1/runs${queryString({ project_id: projectId, limit })}`,
      ),
    get: (runId: string): Promise<RunDetail> =>
      this.request<RunDetail>(`/v1/runs/${encodeURIComponent(runId)}`),
    cancel: (runId: string, reason?: string): Promise<Run> =>
      this.request<Run>(`/v1/runs/${encodeURIComponent(runId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ ...(reason ? { reason } : {}) }),
      }),
    replay: (runId: string): Promise<Run> =>
      this.request<Run>(`/v1/runs/${encodeURIComponent(runId)}/replay`, {
        method: "POST",
      }),
    report: (runId: string): Promise<ComparisonReport> =>
      this.request<ComparisonReport>(
        `/v1/runs/${encodeURIComponent(runId)}/report`,
      ),
  };

  search(q: string, limit = 20): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(
      `/v1/search${queryString({ q, limit })}`,
    );
  }

  entity(entityId: string): Promise<Entity> {
    return this.request<Entity>(`/v1/entities/${encodeURIComponent(entityId)}`);
  }

  monitoringStatus(): Promise<MonitoringStatus> {
    return this.request<MonitoringStatus>("/v1/monitoring/status");
  }

  async *streamRunEvents(
    runId: string,
    signalOrOptions?: AbortSignal | RunEventStreamOptions,
  ): AsyncGenerator<RunEvent> {
    const options = eventStreamOptions(signalOrOptions);
    const reconnect = options.reconnect ?? false;
    const maximumReconnects = options.maxReconnects ?? 3;
    const reconnectDelayMs = options.reconnectDelayMs ?? 250;
    if (
      !Number.isSafeInteger(options.afterSequence ?? 0) ||
      (options.afterSequence ?? 0) < 0 ||
      !Number.isInteger(maximumReconnects) ||
      maximumReconnects < 0 ||
      reconnectDelayMs < 0
    ) {
      throw new TypeError(
        "Event stream cursor and reconnect settings are invalid",
      );
    }
    let cursor = options.afterSequence ?? 0;
    let reconnects = 0;

    while (true) {
      const headers = new Headers({ Accept: "text/event-stream" });
      if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
      if (cursor > 0) headers.set("Last-Event-ID", String(cursor));
      let reader: ReadableStreamDefaultReader<string> | undefined;
      try {
        const response = await this.fetcher(
          `${this.baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`,
          {
            headers,
            signal: options.signal,
            credentials: this.credentials,
            redirect: "error",
          },
        );
        if (!response.ok || !response.body) {
          throw new GolemIntelApiError(
            `Event stream failed with ${response.status}`,
            response.status,
          );
        }
        reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let pending = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) return;
          pending += value.replaceAll("\r\n", "\n");
          let boundary = pending.indexOf("\n\n");
          while (boundary >= 0) {
            const block = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            const event = parseServerSentEvent(block);
            if (event && event.sequence > cursor) {
              cursor = event.sequence;
              reconnects = 0;
              yield event;
            }
            boundary = pending.indexOf("\n\n");
          }
        }
      } catch (error) {
        if (options.signal?.aborted) {
          throw new GolemIntelApiError(
            "Event stream was cancelled",
            0,
            "aborted",
          );
        }
        if (
          !reconnect ||
          reconnects >= maximumReconnects ||
          (error instanceof GolemIntelApiError &&
            error.status > 0 &&
            error.status < 500)
        ) {
          if (error instanceof GolemIntelApiError) throw error;
          throw new GolemIntelApiError(
            error instanceof Error ? error.message : "Event stream unavailable",
            0,
            "stream_unavailable",
          );
        }
        reconnects += 1;
        await waitForReconnect(reconnectDelayMs, options.signal);
      } finally {
        if (reader) {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      }
    }
  }
}
