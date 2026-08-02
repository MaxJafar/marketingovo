import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  Action,
  ActionCheckpoint,
  ActionEvidenceWorkspace,
  ActionOutcomeObservation,
  ActionVerificationStart,
  AppendProjectContextJournalInput,
  Capabilities,
  CreateProjectInput,
  DeleteProjectInput,
  ExtractionPreview,
  ExtractionRuleTemplateCatalog,
  ExtractionRuleWorkspace,
  Integration,
  IssueInstance,
  IssueReviewItem,
  IssueReviewListOptions,
  IssueReviewPage,
  ProblemDetails,
  PreviewExtractionRulesInput,
  Project,
  ProjectDeletionReceipt,
  ProjectContextJournalEntry,
  ProjectContextWorkspace,
  ProjectOverview,
  Run,
  RunComparison,
  RunEvidenceListOptions,
  RunEvidencePage,
  RunLinkExplorer,
  RunLinkExplorerOptions,
  RunReplay,
  RunEvent,
  Schedule,
  StartRunInput,
  UpdateActionInput,
  UpdateExtractionRulesInput,
  UpdateIssueAdjudicationInput,
  UpdateProjectContextInput,
} from "@marketingovo/contracts";
import type {
  MarketingovoProjectBundleV2,
  ProjectImportResult,
} from "@marketingovo/contracts/project-bundle";
import {
  DEFAULT_LOCAL_API_BASE_URL,
  validateLocalApiBaseUrl,
} from "./local-api.js";

export { validateLocalApiBaseUrl } from "./local-api.js";
export {
  createGeneratedMarketingovoClient,
  createGeneratedMarketingovoClientFromTokenFile,
  type GeneratedMarketingovoClientOptions,
  type MarketingovoOpenApiPaths,
} from "./generated-client.js";

/** One line in a dashboard terminal, from either side of the conversation. */
export interface TerminalEvent {
  id: string;
  seq: number;
  role: "user" | "agent" | "system";
  kind: "message" | "thought" | "tool" | "error" | "status";
  text: string;
  tool?: string;
  createdAt: string;
}

export interface TerminalAttachment {
  agentId: string;
  label: string;
  harness: string;
  attachedAt: string;
  lastSeenAt: string;
}

export interface TerminalPresence {
  attached: boolean;
  agent: TerminalAttachment | null;
  busy: boolean;
}

export interface TerminalSession {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalSessionSummary extends TerminalSession {
  presence: TerminalPresence;
}

export interface TerminalTranscript {
  session: TerminalSession;
  events: TerminalEvent[];
  presence: TerminalPresence;
}

export interface TerminalAttachResult {
  agentId: string;
  attachment: TerminalAttachment;
  backlog: TerminalEvent[];
  session: TerminalSession;
}

export interface TerminalWaitResult {
  messages: TerminalEvent[];
  cancelRequested: boolean;
}

export class MarketingovoApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;
  constructor(status: number, problem: ProblemDetails | null) {
    super(
      problem?.detail ??
        problem?.title ??
        `Marketingovo API request failed (${status})`,
    );
    this.name = "MarketingovoApiError";
    this.status = status;
    this.problem = problem;
  }
}

export interface MarketingovoClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class MarketingovoClient {
  readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: MarketingovoClientOptions = {}) {
    this.baseUrl = validateLocalApiBaseUrl(
      options.baseUrl ?? DEFAULT_LOCAL_API_BASE_URL,
    );
    this.token = options.token;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  static async fromTokenFile(
    path: string,
    options: Omit<MarketingovoClientOptions, "token"> = {},
  ): Promise<MarketingovoClient> {
    // Validate the destination before reading token material from disk.
    const baseUrl = validateLocalApiBaseUrl(
      options.baseUrl ?? DEFAULT_LOCAL_API_BASE_URL,
    );
    const token = (await readFile(path, "utf8")).trim();
    if (!token) throw new Error("Marketingovo service token file is empty");
    return new MarketingovoClient({ ...options, baseUrl, token });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Marketingovo API request timed out")),
      this.timeoutMs,
    );
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("content-type"))
      headers.set("content-type", "application/json");
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
        redirect: "error",
      });
      if (!response.ok) {
        let problem: ProblemDetails | null = null;
        try {
          problem = (await response.json()) as ProblemDetails;
        } catch {
          /* response is not JSON */
        }
        throw new MarketingovoApiError(response.status, problem);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestBytes(
    path: string,
    init: RequestInit = {},
  ): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Marketingovo API request timed out")),
      this.timeoutMs,
    );
    const headers = new Headers(init.headers);
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
        redirect: "error",
      });
      if (!response.ok) {
        let problem: ProblemDetails | null = null;
        try {
          problem = (await response.json()) as ProblemDetails;
        } catch {
          /* response is not JSON */
        }
        throw new MarketingovoApiError(response.status, problem);
      }
      return new Uint8Array(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  }

  health = () =>
    this.request<{
      status: string;
      database: string;
      queue: string;
      version: string;
    }>("/health");
  capabilities = () => this.request<Capabilities>("/capabilities");
  sessions = {
    issueBootstrapToken: () =>
      this.request<{ token: string; expiresAt: string }>(
        "/session/bootstrap-token",
        { method: "POST" },
      ),
  };

  /**
   * The dashboard's terminal, from the agent's side. These routes envelope
   * their payloads as `{ data, meta }`, unlike the older project routes, so
   * each call unwraps `data` to keep the SDK surface consistent.
   */
  terminal = {
    list: () =>
      this.request<{ data: { items: TerminalSessionSummary[] } }>(
        "/agent/sessions",
      ).then((body) => body.data.items),
    transcript: (sessionId: string, since = 0) =>
      this.request<{ data: TerminalTranscript }>(
        `/agent/sessions/${encodeURIComponent(sessionId)}?since=${since}`,
      ).then((body) => body.data),
    attach: (sessionId: string, input: { label: string; harness: string }) =>
      this.request<{ data: TerminalAttachResult }>(
        `/agent/sessions/${encodeURIComponent(sessionId)}/attach`,
        { method: "POST", body: JSON.stringify(input) },
      ).then((body) => body.data),
    wait: (sessionId: string, agentId: string, waitMs: number) =>
      this.request<{ data: TerminalWaitResult }>(
        `/agent/sessions/${encodeURIComponent(sessionId)}/wait`,
        {
          method: "POST",
          body: JSON.stringify({ agentId, waitMs }),
          // The daemon holds this request open on purpose. The client deadline
          // has to outlast the server's park or every successful long poll
          // would surface as a timeout.
          signal: AbortSignal.timeout(waitMs + 10_000),
        },
      ).then((body) => body.data),
    say: (
      sessionId: string,
      input: {
        agentId: string;
        text: string;
        kind?: "message" | "thought" | "tool" | "error";
        tool?: string;
      },
    ) =>
      this.request<{ data: TerminalEvent }>(
        `/agent/sessions/${encodeURIComponent(sessionId)}/emit`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "message", ...input }),
        },
      ).then((body) => body.data),
    detach: (sessionId: string, agentId: string) =>
      this.request<void>(
        `/agent/sessions/${encodeURIComponent(sessionId)}/detach`,
        { method: "POST", body: JSON.stringify({ agentId }) },
      ),
  };
  projects = {
    list: () => this.request<Project[]>("/projects"),
    create: (input: CreateProjectInput) =>
      this.request<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    overview: (id: string) =>
      this.request<ProjectOverview>(
        `/projects/${encodeURIComponent(id)}/overview`,
      ),
    delete: (id: string, input: Omit<DeleteProjectInput, "projectId">) =>
      this.request<ProjectDeletionReceipt>(
        `/projects/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          body: JSON.stringify(input),
        },
      ),
  };
  context = {
    get: (projectId: string) =>
      this.request<ProjectContextWorkspace>(
        `/projects/${encodeURIComponent(projectId)}/context`,
      ),
    update: (
      projectId: string,
      input: Omit<UpdateProjectContextInput, "projectId">,
    ) =>
      this.request<ProjectContextWorkspace>(
        `/projects/${encodeURIComponent(projectId)}/context`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    append: (
      projectId: string,
      input: Omit<AppendProjectContextJournalInput, "projectId">,
    ) =>
      this.request<ProjectContextJournalEntry>(
        `/projects/${encodeURIComponent(projectId)}/context/journal`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  };
  extractionRules = {
    templates: () =>
      this.request<ExtractionRuleTemplateCatalog>("/extraction-rule-templates"),
    get: (projectId: string) =>
      this.request<ExtractionRuleWorkspace>(
        `/projects/${encodeURIComponent(projectId)}/extraction-rules`,
      ),
    update: (
      projectId: string,
      input: Omit<UpdateExtractionRulesInput, "projectId">,
    ) =>
      this.request<ExtractionRuleWorkspace>(
        `/projects/${encodeURIComponent(projectId)}/extraction-rules`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    preview: (
      projectId: string,
      input: Omit<PreviewExtractionRulesInput, "projectId">,
    ) =>
      this.request<ExtractionPreview>(
        `/projects/${encodeURIComponent(projectId)}/extraction-rules/preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
  runs = {
    list: (projectId?: string) =>
      this.request<Run[]>(
        `/runs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
      ),
    get: (id: string) => this.request<Run>(`/runs/${encodeURIComponent(id)}`),
    start: (input: StartRunInput, idempotencyKey = randomUUID()) =>
      this.request<Run>("/runs", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      }),
    replay: (id: string, idempotencyKey: string = randomUUID()) =>
      this.request<RunReplay>(`/runs/${encodeURIComponent(id)}/replay`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    compare: (currentRunId: string, baselineRunId: string) =>
      this.request<RunComparison>(
        `/runs/${encodeURIComponent(currentRunId)}/comparison?baselineRunId=${encodeURIComponent(baselineRunId)}`,
      ),
    cancel: (id: string) =>
      this.request<Run>(`/runs/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      }),
    issues: (id: string) =>
      this.request<IssueInstance[]>(`/runs/${encodeURIComponent(id)}/issues`),
    evidence: (id: string, options: Partial<RunEvidenceListOptions> = {}) => {
      const query = new URLSearchParams({
        section: options.section ?? "crawl",
      });
      if (options.limit !== undefined)
        query.set("limit", String(options.limit));
      if (options.offset !== undefined)
        query.set("offset", String(options.offset));
      if (options.search) query.set("search", options.search);
      return this.request<RunEvidencePage>(
        `/runs/${encodeURIComponent(id)}/evidence?${query.toString()}`,
      );
    },
    links: (id: string, options: RunLinkExplorerOptions) => {
      const query = new URLSearchParams({
        pageUrl: options.pageUrl,
        direction: options.direction,
      });
      if (options.limit !== undefined)
        query.set("limit", String(options.limit));
      if (options.offset !== undefined)
        query.set("offset", String(options.offset));
      if (options.search) query.set("search", options.search);
      return this.request<RunLinkExplorer>(
        `/runs/${encodeURIComponent(id)}/links?${query.toString()}`,
      );
    },
  };
  issues = {
    list: (projectId: string, options: IssueReviewListOptions = {}) => {
      const query = new URLSearchParams({ projectId });
      if (options.limit !== undefined)
        query.set("limit", String(options.limit));
      if (options.offset !== undefined)
        query.set("offset", String(options.offset));
      if (options.status) query.set("status", options.status);
      if (options.severity) query.set("severity", options.severity);
      if (options.search) query.set("search", options.search);
      return this.request<IssueReviewPage>(`/issues?${query.toString()}`);
    },
    update: (fingerprint: string, input: UpdateIssueAdjudicationInput) =>
      this.request<IssueReviewItem>(
        `/issues/${encodeURIComponent(fingerprint)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
  };
  actions = {
    list: (projectId?: string) =>
      this.request<Action[]>(
        `/actions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
      ),
    update: (id: string, input: UpdateActionInput) =>
      this.request<Action>(`/actions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    evidence: (
      id: string,
      options: { limit?: number; cursor?: string } = {},
    ) => {
      const query = new URLSearchParams();
      if (options.limit !== undefined)
        query.set("limit", String(options.limit));
      if (options.cursor) query.set("cursor", options.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return this.request<ActionEvidenceWorkspace>(
        `/actions/${encodeURIComponent(id)}/evidence${suffix}`,
      );
    },
    createCheckpoint: (id: string) =>
      this.request<ActionCheckpoint>(
        `/actions/${encodeURIComponent(id)}/checkpoints`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    verify: (
      id: string,
      checkpointId: string,
      idempotencyKey: string = randomUUID(),
    ) =>
      this.request<ActionVerificationStart>(
        `/actions/${encodeURIComponent(id)}/verify`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ checkpointId }),
        },
      ),
    outcomes: (id: string) =>
      this.request<ActionOutcomeObservation[]>(
        `/actions/${encodeURIComponent(id)}/outcomes`,
      ),
  };
  integrations = {
    list: (projectId?: string) =>
      this.request<Integration[]>(
        `/integrations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
      ),
    configure: (
      provider: string,
      projectId: string,
      configuration: Record<string, unknown>,
    ) =>
      this.request<Integration>(
        `/integrations/${encodeURIComponent(provider)}/configuration`,
        {
          method: "PATCH",
          body: JSON.stringify({ projectId, configuration }),
        },
      ),
    saveCredentials: (
      provider: string,
      credentials: Record<string, string>,
      account = "default",
    ) =>
      this.request<Integration>(
        `/integrations/${encodeURIComponent(provider)}/credentials`,
        {
          method: "POST",
          body: JSON.stringify({ account, credentials }),
        },
      ),
    startOAuth: (provider: string, account = "default") =>
      this.request<{ authorizationUrl: string; expiresAt: string }>(
        `/integrations/${encodeURIComponent(provider)}/auth/start`,
        {
          method: "POST",
          body: JSON.stringify({ account }),
        },
      ),
    test: (provider: string, projectId?: string) =>
      this.request<Integration>(
        `/integrations/${encodeURIComponent(provider)}/test`,
        {
          method: "POST",
          body: JSON.stringify(projectId ? { projectId } : {}),
        },
      ),
    remove: (provider: string) =>
      this.request<void>(`/integrations/${encodeURIComponent(provider)}`, {
        method: "DELETE",
      }),
  };
  schedules = {
    list: (projectId?: string) =>
      this.request<Schedule[]>(
        `/schedules${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
      ),
    create: (input: Omit<Schedule, "id" | "createdAt" | "updatedAt">) =>
      this.request<Schedule>("/schedules", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (
      id: string,
      input: Partial<
        Pick<Schedule, "cron" | "timezone" | "enabled" | "nextRunAt">
      >,
    ) =>
      this.request<Schedule>(`/schedules/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      this.request<void>(`/schedules/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  };
  reports = {
    get: (runId: string, format: "html" | "pdf" | "csv" | "json" = "html") =>
      this.requestBytes(
        `/runs/${encodeURIComponent(runId)}/report?format=${encodeURIComponent(format)}`,
      ),
  };
  exportProject = (projectId: string) =>
    this.requestBytes("/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
  importProject = (bundle: Uint8Array | string | MarketingovoProjectBundleV2) =>
    this.request<ProjectImportResult>("/import", {
      method: "POST",
      headers: {
        "content-type": "application/vnd.marketingovo.project+json",
      },
      body:
        bundle instanceof Uint8Array
          ? Buffer.from(bundle).toString("utf8")
          : typeof bundle === "string"
            ? bundle
            : JSON.stringify(bundle),
    });
  async *watchRun(runId: string, after = 0): AsyncGenerator<RunEvent> {
    const headers = new Headers({ accept: "text/event-stream" });
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    const response = await this.fetchImpl(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/events?after=${after}`,
      { headers, redirect: "error" },
    );
    if (!response.ok || !response.body)
      throw new MarketingovoApiError(response.status, null);
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";
    let eventType = "message";
    let eventId = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          let data = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("id: ")) eventId = Number(line.slice(4));
            else if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          const payload = JSON.parse(data) as Record<string, unknown>;
          yield {
            id: eventId,
            runId,
            type: eventType,
            at: new Date().toISOString(),
            payload,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
