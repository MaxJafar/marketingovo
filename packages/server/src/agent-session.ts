import { randomUUID } from "node:crypto";
import { Type, type Static } from "@sinclair/typebox";

/**
 * The terminal on the dashboard is not a chatbot the daemon implements. It is a
 * two-sided pipe: a human types on the website, and an agent harness the user
 * already trusts — Claude Code, Codex, anything that speaks MCP — attaches from
 * the other side and answers.
 *
 * That shape is deliberate. The daemon holds a marketer's provider credentials
 * and their crawl history, so putting a model API key next to that data would
 * widen the blast radius of the one process we most want to stay boring. The
 * harness already has a model, already has the user's consent to act, and
 * already reaches the six public tools over MCP. It only lacked a way to be
 * spoken to from the browser. This module is that missing channel and nothing
 * more: it stores turns, wakes waiting readers, and expires leases.
 *
 * The two sides authenticate differently and that difference is load-bearing.
 * The browser arrives with a same-origin session cookie plus a CSRF token; the
 * harness arrives with the local service token. Neither can impersonate the
 * other, so "who said this" is decided by the transport rather than by a role
 * field a caller could set.
 */

export type SessionEventRole = "user" | "agent" | "system";

export type SessionEventKind =
  "message" | "thought" | "tool" | "error" | "status";

export interface SessionEvent {
  id: string;
  seq: number;
  role: SessionEventRole;
  kind: SessionEventKind;
  text: string;
  tool?: string;
  createdAt: string;
}

export interface AgentAttachment {
  agentId: string;
  label: string;
  harness: string;
  attachedAt: string;
  lastSeenAt: string;
}

export interface TerminalSession {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession extends TerminalSession {
  events: SessionEvent[];
  nextSeq: number;
  /** Turns typed by the human that no attached agent has collected yet. */
  pending: SessionEvent[];
  attachment: AgentAttachment | null;
  attachmentExpiresAt: number;
  /** Set when the human asks the current turn to stop; cleared on collection. */
  cancelRequested: boolean;
  waiters: Set<Waiter>;
  listeners: Set<SessionListener>;
}

interface Waiter {
  resolve: (value: WaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WaitResult {
  messages: SessionEvent[];
  cancelRequested: boolean;
}

export type SessionListener = (event: StreamEnvelope) => void;

export interface StreamEnvelope {
  type: "event" | "presence" | "heartbeat";
  event?: SessionEvent;
  presence?: PresenceSnapshot;
}

export interface PresenceSnapshot {
  attached: boolean;
  agent: AgentAttachment | null;
  /** True while the human's turn is collected but unanswered. */
  busy: boolean;
}

/** History is bounded: this is a live console, not an audit log. */
const MAX_EVENTS = 500;
const MAX_TEXT_LENGTH = 20_000;
const DEFAULT_LEASE_MS = 90_000;
const MAX_WAIT_MS = 25_000;
const MAX_SESSIONS = 24;

export class AgentSessionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AgentSessionError";
    this.status = status;
    this.code = code;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AgentSessionError(
      "A session message cannot be empty.",
      400,
      "empty_message",
    );
  }
  return trimmed.length > MAX_TEXT_LENGTH
    ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}\n…[truncated]`
    : trimmed;
}

/**
 * A first line makes a far better session label than a truncated blob, because
 * the thing a marketer typed first is almost always the thing they came to do.
 */
function titleFromText(value: string): string {
  const firstLine = value.split("\n", 1)[0]!.trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

export class AgentSessionStore {
  readonly #sessions = new Map<string, StoredSession>();
  readonly #leaseMs: number;
  readonly #now: () => number;

  constructor(options: { leaseMs?: number; now?: () => number } = {}) {
    this.#leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.#now = options.now ?? Date.now;
  }

  create(projectId: string | null): TerminalSession {
    // Oldest-first eviction keeps a long-lived daemon from accumulating dead
    // consoles after a browser reload storm, while never dropping the tab the
    // user is most likely still looking at.
    if (this.#sessions.size >= MAX_SESSIONS) {
      const oldest = [...this.#sessions.values()].sort((left, right) =>
        left.updatedAt.localeCompare(right.updatedAt),
      )[0];
      if (oldest) this.#close(oldest);
    }
    const timestamp = nowIso();
    const session: StoredSession = {
      id: randomUUID(),
      projectId,
      title: "New session",
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
      nextSeq: 1,
      pending: [],
      attachment: null,
      attachmentExpiresAt: 0,
      cancelRequested: false,
      waiters: new Set(),
      listeners: new Set(),
    };
    this.#sessions.set(session.id, session);
    return this.#snapshot(session);
  }

  list(): Array<TerminalSession & { presence: PresenceSnapshot }> {
    return [...this.#sessions.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) => ({
        ...this.#snapshot(session),
        presence: this.presence(session.id),
      }));
  }

  transcript(
    id: string,
    since = 0,
  ): { session: TerminalSession; events: SessionEvent[] } {
    const session = this.#require(id);
    return {
      session: this.#snapshot(session),
      events: session.events.filter((event) => event.seq > since),
    };
  }

  presence(id: string): PresenceSnapshot {
    const session = this.#require(id);
    this.#expireLease(session);
    return {
      attached: session.attachment !== null,
      agent: session.attachment,
      // Nothing pending plus a live agent plus a user turn already spoken means
      // the harness is mid-answer. That is the state the terminal renders as a
      // blinking "agent is working" line.
      busy:
        session.attachment !== null &&
        session.pending.length === 0 &&
        session.events.at(-1)?.role === "user",
    };
  }

  /** The human speaks. Wakes any harness parked in a long poll. */
  say(id: string, text: string): SessionEvent {
    const session = this.#require(id);
    const event = this.#append(session, {
      role: "user",
      kind: "message",
      text: clampText(text),
    });
    if (session.title === "New session") {
      session.title = titleFromText(event.text);
    }
    session.pending.push(event);
    this.#drainWaiters(session);
    return event;
  }

  /** The agent speaks. Streams straight to every open browser terminal. */
  emit(
    id: string,
    input: { kind: SessionEventKind; text: string; tool?: string },
  ): SessionEvent {
    const session = this.#require(id);
    if (!session.attachment) {
      throw new AgentSessionError(
        "Attach to the session before emitting into it.",
        409,
        "agent_not_attached",
      );
    }
    this.#touchLease(session);
    return this.#append(session, {
      role: "agent",
      kind: input.kind,
      text: clampText(input.text),
      ...(input.tool ? { tool: input.tool } : {}),
    });
  }

  note(id: string, text: string): SessionEvent {
    const session = this.#require(id);
    return this.#append(session, {
      role: "system",
      kind: "status",
      text: clampText(text),
    });
  }

  attach(
    id: string,
    input: { label: string; harness: string },
  ): { attachment: AgentAttachment; backlog: SessionEvent[] } {
    const session = this.#require(id);
    this.#expireLease(session);
    if (session.attachment) {
      throw new AgentSessionError(
        `Another agent (${session.attachment.label}) already holds this session. Wait for its lease to lapse or detach it first.`,
        409,
        "session_already_attached",
      );
    }
    const timestamp = nowIso();
    session.attachment = {
      agentId: randomUUID(),
      label: input.label,
      harness: input.harness,
      attachedAt: timestamp,
      lastSeenAt: timestamp,
    };
    session.attachmentExpiresAt = this.#now() + this.#leaseMs;
    this.#append(session, {
      role: "system",
      kind: "status",
      text: `${input.label} attached over ${input.harness}.`,
    });
    this.#publishPresence(session);
    const backlog = session.pending.splice(0, session.pending.length);
    return { attachment: session.attachment, backlog };
  }

  detach(id: string, agentId: string): void {
    const session = this.#require(id);
    if (!session.attachment || session.attachment.agentId !== agentId) {
      throw new AgentSessionError(
        "This agent does not hold the session.",
        409,
        "agent_not_attached",
      );
    }
    const label = session.attachment.label;
    session.attachment = null;
    session.attachmentExpiresAt = 0;
    this.#append(session, {
      role: "system",
      kind: "status",
      text: `${label} detached.`,
    });
    this.#publishPresence(session);
  }

  /**
   * Long-poll for the next human turn. MCP tools are request/response, so a
   * harness cannot be pushed to; it asks, and we hold the request open until
   * there is something worth waking up for. Returning an empty result on
   * timeout is the normal case, not an error — the harness simply asks again,
   * and the round trip doubles as a lease heartbeat.
   */
  async wait(id: string, agentId: string, waitMs: number): Promise<WaitResult> {
    const session = this.#require(id);
    if (!session.attachment || session.attachment.agentId !== agentId) {
      throw new AgentSessionError(
        "This agent does not hold the session.",
        409,
        "agent_not_attached",
      );
    }
    this.#touchLease(session);

    const immediate = this.#collect(session);
    if (immediate.messages.length > 0 || immediate.cancelRequested) {
      return immediate;
    }

    const bounded = Math.max(0, Math.min(waitMs, MAX_WAIT_MS));
    if (bounded === 0) return immediate;

    return new Promise<WaitResult>((resolve) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          session.waiters.delete(waiter);
          resolve({ messages: [], cancelRequested: false });
        }, bounded),
      };
      session.waiters.add(waiter);
    });
  }

  /** The human interrupts. Delivered to the harness on its next poll. */
  cancel(id: string): void {
    const session = this.#require(id);
    session.cancelRequested = true;
    this.#append(session, {
      role: "system",
      kind: "status",
      text: "Interrupt requested.",
    });
    this.#drainWaiters(session);
  }

  subscribe(id: string, listener: SessionListener): () => void {
    const session = this.#require(id);
    session.listeners.add(listener);
    return () => {
      session.listeners.delete(listener);
    };
  }

  delete(id: string): void {
    const session = this.#require(id);
    this.#close(session);
  }

  /** Test and shutdown seam: release every timer and open stream. */
  dispose(): void {
    for (const session of [...this.#sessions.values()]) this.#close(session);
  }

  #close(session: StoredSession): void {
    for (const waiter of session.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve({ messages: [], cancelRequested: false });
    }
    session.waiters.clear();
    session.listeners.clear();
    this.#sessions.delete(session.id);
  }

  #require(id: string): StoredSession {
    const session = this.#sessions.get(id);
    if (!session) {
      throw new AgentSessionError(
        "That terminal session does not exist.",
        404,
        "session_not_found",
      );
    }
    return session;
  }

  #snapshot(session: StoredSession): TerminalSession {
    return {
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  #append(
    session: StoredSession,
    input: {
      role: SessionEventRole;
      kind: SessionEventKind;
      text: string;
      tool?: string;
    },
  ): SessionEvent {
    const event: SessionEvent = {
      id: randomUUID(),
      seq: session.nextSeq++,
      role: input.role,
      kind: input.kind,
      text: input.text,
      ...(input.tool ? { tool: input.tool } : {}),
      createdAt: nowIso(),
    };
    session.events.push(event);
    if (session.events.length > MAX_EVENTS) {
      session.events.splice(0, session.events.length - MAX_EVENTS);
    }
    session.updatedAt = event.createdAt;
    this.#publish(session, { type: "event", event });
    return event;
  }

  #collect(session: StoredSession): WaitResult {
    const messages = session.pending.splice(0, session.pending.length);
    const cancelRequested = session.cancelRequested;
    session.cancelRequested = false;
    return { messages, cancelRequested };
  }

  #drainWaiters(session: StoredSession): void {
    if (session.waiters.size === 0) return;
    const result = this.#collect(session);
    if (result.messages.length === 0 && !result.cancelRequested) return;
    // Exactly one waiter is woken and the rest keep sleeping: a turn delivered
    // twice would have two agents answering the same question into one console.
    const [waiter] = session.waiters;
    if (!waiter) {
      session.pending.unshift(...result.messages);
      session.cancelRequested = result.cancelRequested;
      return;
    }
    session.waiters.delete(waiter);
    clearTimeout(waiter.timer);
    waiter.resolve(result);
  }

  #touchLease(session: StoredSession): void {
    if (!session.attachment) return;
    session.attachment.lastSeenAt = nowIso();
    session.attachmentExpiresAt = this.#now() + this.#leaseMs;
  }

  /**
   * A harness that crashes mid-turn cannot detach itself, and a console stuck
   * on "agent online" forever is worse than one that admits the agent is gone.
   * The lease decides liveness by silence rather than by a clean goodbye.
   */
  #expireLease(session: StoredSession): void {
    if (!session.attachment) return;
    if (session.attachmentExpiresAt > this.#now()) return;
    const label = session.attachment.label;
    session.attachment = null;
    session.attachmentExpiresAt = 0;
    this.#append(session, {
      role: "system",
      kind: "status",
      text: `${label} stopped responding; the session lease lapsed.`,
    });
    this.#publishPresence(session);
  }

  #publish(session: StoredSession, envelope: StreamEnvelope): void {
    for (const listener of session.listeners) {
      try {
        listener(envelope);
      } catch {
        /* a dead stream must not stall the others */
      }
    }
  }

  #publishPresence(session: StoredSession): void {
    this.#publish(session, {
      type: "presence",
      presence: {
        attached: session.attachment !== null,
        agent: session.attachment,
        busy: false,
      },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Wire schemas                                                        */
/* ------------------------------------------------------------------ */

export const SessionEventSchema = Type.Object(
  {
    id: Type.String(),
    seq: Type.Integer(),
    role: Type.Union([
      Type.Literal("user"),
      Type.Literal("agent"),
      Type.Literal("system"),
    ]),
    kind: Type.Union([
      Type.Literal("message"),
      Type.Literal("thought"),
      Type.Literal("tool"),
      Type.Literal("error"),
      Type.Literal("status"),
    ]),
    text: Type.String(),
    tool: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const AgentAttachmentSchema = Type.Object(
  {
    agentId: Type.String(),
    label: Type.String(),
    harness: Type.String(),
    attachedAt: Type.String({ format: "date-time" }),
    lastSeenAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const PresenceSchema = Type.Object(
  {
    attached: Type.Boolean(),
    agent: Type.Union([AgentAttachmentSchema, Type.Null()]),
    busy: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const TerminalSessionSchema = Type.Object(
  {
    id: Type.String(),
    projectId: Type.Union([Type.String(), Type.Null()]),
    title: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const SessionTranscriptSchema = Type.Object(
  {
    session: TerminalSessionSchema,
    events: Type.Array(SessionEventSchema),
    presence: PresenceSchema,
  },
  { additionalProperties: false },
);

export const CreateSessionInputSchema = Type.Object(
  { projectId: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })) },
  { additionalProperties: false },
);

export const SaySessionInputSchema = Type.Object(
  { text: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }) },
  { additionalProperties: false },
);

export const AttachSessionInputSchema = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 80 }),
    harness: Type.String({ minLength: 1, maxLength: 80 }),
  },
  { additionalProperties: false },
);

export const EmitSessionInputSchema = Type.Object(
  {
    agentId: Type.String({ minLength: 1 }),
    kind: Type.Union([
      Type.Literal("message"),
      Type.Literal("thought"),
      Type.Literal("tool"),
      Type.Literal("error"),
    ]),
    text: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
    tool: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  },
  { additionalProperties: false },
);

export const WaitSessionInputSchema = Type.Object(
  {
    agentId: Type.String({ minLength: 1 }),
    waitMs: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_WAIT_MS })),
  },
  { additionalProperties: false },
);

export const WaitResultSchema = Type.Object(
  {
    messages: Type.Array(SessionEventSchema),
    cancelRequested: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const DetachSessionInputSchema = Type.Object(
  { agentId: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export type CreateSessionInput = Static<typeof CreateSessionInputSchema>;
export type SaySessionInput = Static<typeof SaySessionInputSchema>;
export type AttachSessionInput = Static<typeof AttachSessionInputSchema>;
export type EmitSessionInput = Static<typeof EmitSessionInputSchema>;
export type WaitSessionInput = Static<typeof WaitSessionInputSchema>;
export type DetachSessionInput = Static<typeof DetachSessionInputSchema>;
