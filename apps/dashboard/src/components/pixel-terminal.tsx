import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TerminalEvent, UseTerminalSession } from "../api/terminal";

/**
 * The console along the bottom edge. It is a chat, but presented as a shell
 * prompt, because what sits on the other end is an agent that runs real work
 * against this workspace rather than a support bot.
 *
 * The transcript stays hidden until there is something to show, so a first load
 * looks like a bare prompt waiting for input. It expands the moment a
 * conversation exists, and the reader can fold it away again.
 *
 * The session itself is owned by the shell rather than by this component: the
 * top bar's status light and this transcript have to agree about whether an
 * agent is attached, and two independent subscriptions would eventually not.
 */

const WHO: Record<string, string> = {
  user: "you",
  agent: "agent",
  system: "sys",
};

function whoLabel(event: TerminalEvent): string {
  if (event.role === "agent" && event.kind === "tool") {
    return event.tool ? `tool:${event.tool}` : "tool";
  }
  return WHO[event.role] ?? event.role;
}

export function PixelTerminal({ session }: { session: UseTerminalSession }) {
  const { events, presence, connection, error, sending, send, cancel } =
    session;
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const hasTranscript = events.length > 0;
  const showTranscript = hasTranscript && expanded;

  // Follow the tail only while the reader is already at the tail. Yanking the
  // view down while someone is scrolled up reading is the classic console bug.
  useEffect(() => {
    if (!showTranscript || !atBottomRef.current) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [events, showTranscript]);

  function trackScroll(): void {
    const body = bodyRef.current;
    if (!body) return;
    atBottomRef.current =
      body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  }

  function submit(submitEvent: FormEvent): void {
    submitEvent.preventDefault();
    const text = draft;
    setDraft("");
    void send(text);
  }

  return (
    <div className="pixel-console">
      {showTranscript ? (
        <section
          className="pixel-panel pixel-transcript"
          aria-label="Agent session transcript"
        >
          <div className="pixel-panel-head">
            <h2>Session</h2>
            <button
              type="button"
              className="pixel-linklike pixel-panel-mark"
              onClick={() => setExpanded(false)}
            >
              hide
            </button>
          </div>
          <div
            className="pixel-transcript-body"
            ref={bodyRef}
            onScroll={trackScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {events.map((event) => (
              <p
                className="pixel-line"
                key={event.id}
                data-role={event.role}
                data-kind={event.kind}
              >
                <span className="pixel-line-who">{whoLabel(event)}&gt;</span>
                <span className="pixel-line-text">{event.text}</span>
              </p>
            ))}
            {presence.busy ? (
              <p className="pixel-line" data-role="agent" data-kind="thought">
                <span className="pixel-line-who">agent&gt;</span>
                <span className="pixel-line-text">
                  working <span className="pixel-caret" />
                </span>
              </p>
            ) : null}
          </div>
          <p className="pixel-transcript-hint">
            {presence.attached ? (
              <>
                Attached: <code>{presence.agent?.label}</code> over{" "}
                <code>{presence.agent?.harness}</code>.{" "}
                <button
                  type="button"
                  className="pixel-linklike"
                  onClick={() => void cancel()}
                >
                  interrupt
                </button>
              </>
            ) : (
              <>
                No agent attached. Point a harness at this workspace and call{" "}
                <code>marketingovo_session_attach</code> to answer here.
              </>
            )}
          </p>
        </section>
      ) : null}

      <form className="pixel-prompt" onSubmit={submit}>
        <div className="pixel-prompt-field">
          <span className="pixel-prompt-sigil" aria-hidden="true">
            marketingovo:~$
          </span>
          <label className="sr-only" htmlFor="pixel-prompt-input">
            Send a message to the attached agent
          </label>
          <input
            id="pixel-prompt-input"
            className="pixel-prompt-input"
            value={draft}
            onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            placeholder="type a command or ask anything..."
            autoComplete="off"
            spellCheck={false}
          />
          {hasTranscript && !expanded ? (
            <button
              type="button"
              className="pixel-linklike"
              onClick={() => setExpanded(true)}
            >
              show {events.length}
            </button>
          ) : null}
        </div>
        <button
          className="pixel-prompt-send"
          type="submit"
          disabled={sending || draft.trim().length === 0}
          aria-label="Send"
        >
          &gt;
        </button>
      </form>

      {error ? (
        <p className="pixel-note" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}
      {connection === "reconnecting" ? (
        <p className="pixel-note">Reconnecting to the local service…</p>
      ) : null}
    </div>
  );
}

/** Presence summary for the top bar, so the header states agent liveness. */
export function agentStatus(session: UseTerminalSession): {
  state: "online" | "busy" | "offline";
  label: string;
} {
  if (session.connection === "failed") {
    return { state: "offline", label: "service offline" };
  }
  if (session.presence.busy) return { state: "busy", label: "agent working" };
  if (session.presence.attached) {
    return { state: "online", label: "agent online" };
  }
  return { state: "offline", label: "no agent attached" };
}
