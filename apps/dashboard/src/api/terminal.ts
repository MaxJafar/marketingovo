import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest } from "./client";

/**
 * Browser half of the terminal session bus.
 *
 * The dashboard never talks to a model. It posts what the marketer typed to the
 * local daemon and listens on an event stream; an agent harness attached over
 * MCP does the thinking and writes back through the same daemon. So everything
 * here is transport — there is no prompt, no key, and no model behaviour in the
 * browser bundle at all.
 */

export type TerminalRole = "user" | "agent" | "system";
export type TerminalKind = "message" | "thought" | "tool" | "error" | "status";

export interface TerminalEvent {
  id: string;
  seq: number;
  role: TerminalRole;
  kind: TerminalKind;
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

interface StreamEnvelope {
  type: "event" | "presence" | "heartbeat";
  event?: TerminalEvent;
  presence?: TerminalPresence;
}

export type TerminalConnection =
  "connecting" | "live" | "reconnecting" | "failed";

const IDLE_PRESENCE: TerminalPresence = {
  attached: false,
  agent: null,
  busy: false,
};

export async function createTerminalSession(
  projectId: string | null,
): Promise<TerminalSession> {
  const result = await apiRequest<TerminalSession>("/agent/sessions", {
    method: "POST",
    body: JSON.stringify(projectId ? { projectId } : {}),
  });
  return result.data;
}

export async function fetchTerminalSession(
  sessionId: string,
): Promise<TerminalSession> {
  const result = await apiRequest<{ session: TerminalSession }>(
    `/agent/sessions/${encodeURIComponent(sessionId)}`,
  );
  return result.data.session;
}

/**
 * One session per browser tab, surviving reloads.
 *
 * sessionStorage rather than localStorage because the scope wanted is exactly a
 * tab: two windows open side by side are two conversations, but hitting refresh
 * is still the same one. Without this, every reload stranded a session on the
 * daemon and an attaching harness had to guess which of several identical "New
 * session" entries the human was actually looking at.
 */
const SESSION_STORAGE_KEY = "marketingovo:terminal-session:v1";

function readStoredSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(sessionId: string): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    /* storage can be denied; the session still works for this page life */
  }
}

// Shared so React's double-invoked mount effect resolves to one session rather
// than racing two creates.
let inFlightSession: Promise<TerminalSession> | null = null;

export function resumeOrCreateTerminalSession(
  projectId: string | null,
): Promise<TerminalSession> {
  inFlightSession ??= (async () => {
    const stored = readStoredSessionId();
    if (stored) {
      try {
        return await fetchTerminalSession(stored);
      } catch {
        /* the daemon restarted or evicted it; fall through and make a new one */
      }
    }
    const created = await createTerminalSession(projectId);
    storeSessionId(created.id);
    return created;
  })().finally(() => {
    inFlightSession = null;
  });
  return inFlightSession;
}

export async function sendTerminalMessage(
  sessionId: string,
  text: string,
): Promise<TerminalEvent> {
  const result = await apiRequest<TerminalEvent>(
    `/agent/sessions/${encodeURIComponent(sessionId)}/messages`,
    { method: "POST", body: JSON.stringify({ text }) },
  );
  return result.data;
}

export async function cancelTerminalTurn(sessionId: string): Promise<void> {
  await apiRequest<null>(
    `/agent/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  );
}

export interface UseTerminalSession {
  sessionId: string | null;
  events: TerminalEvent[];
  presence: TerminalPresence;
  connection: TerminalConnection;
  error: string | null;
  sending: boolean;
  send: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
}

export function useTerminalSession(
  projectId: string | null,
): UseTerminalSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const [presence, setPresence] = useState<TerminalPresence>(IDLE_PRESENCE);
  const [connection, setConnection] =
    useState<TerminalConnection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Tracked outside state so the stream can resume from the right point without
  // the effect re-subscribing on every appended line.
  const lastSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setConnection("connecting");
    setEvents([]);
    setPresence(IDLE_PRESENCE);
    lastSeqRef.current = 0;

    resumeOrCreateTerminalSession(projectId)
      .then((session) => {
        if (cancelled) return;
        setSessionId(session.id);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setConnection("failed");
        setError(
          cause instanceof Error
            ? cause.message
            : "The local service is unreachable.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof EventSource === "undefined") {
      // jsdom and older embedded webviews have no EventSource. Sending still
      // works; the transcript simply stops updating on its own.
      setConnection("failed");
      return;
    }

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const open = () => {
      if (closed) return;
      // The session cookie rides along because the stream is same-origin, which
      // is why this needs no Authorization header EventSource could not set.
      source = new EventSource(
        `${API_BASE_URL}/agent/sessions/${encodeURIComponent(sessionId)}/stream?since=${lastSeqRef.current}`,
      );

      source.onopen = () => {
        attempt = 0;
        setConnection("live");
        setError(null);
      };

      source.onmessage = (message: MessageEvent<string>) => {
        let envelope: StreamEnvelope;
        try {
          envelope = JSON.parse(message.data) as StreamEnvelope;
        } catch {
          return;
        }
        if (envelope.type === "presence" && envelope.presence) {
          setPresence(envelope.presence);
          return;
        }
        if (envelope.type === "event" && envelope.event) {
          const event = envelope.event;
          lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
          setEvents((current) =>
            // A reconnect replays from `since`, and a racing POST response can
            // land the same line twice. Sequence numbers make the guard exact.
            current.some((existing) => existing.seq === event.seq)
              ? current
              : [...current, event].sort((a, b) => a.seq - b.seq),
          );
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        setConnection("reconnecting");
        attempt += 1;
        // Backoff caps quickly: this is a loopback service, so a long wait only
        // makes a restarted daemon feel broken.
        retry = setTimeout(open, Math.min(500 * 2 ** (attempt - 1), 5_000));
      };
    };

    open();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [sessionId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId) return;
      setSending(true);
      try {
        const event = await sendTerminalMessage(sessionId, trimmed);
        // Echo immediately rather than waiting for the stream: a prompt that
        // seems to swallow what you typed feels broken even when it is not.
        lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
        setEvents((current) =>
          current.some((existing) => existing.seq === event.seq)
            ? current
            : [...current, event].sort((a, b) => a.seq - b.seq),
        );
        setError(null);
      } catch (cause: unknown) {
        setError(
          cause instanceof Error ? cause.message : "That message was not sent.",
        );
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  const cancel = useCallback(async () => {
    if (!sessionId) return;
    try {
      await cancelTerminalTurn(sessionId);
    } catch {
      /* the interrupt is advisory; the transcript will show what happened */
    }
  }, [sessionId]);

  return {
    sessionId,
    events,
    presence,
    connection,
    error,
    sending,
    send,
    cancel,
  };
}
