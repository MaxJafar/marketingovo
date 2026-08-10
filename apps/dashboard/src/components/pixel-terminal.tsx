import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TerminalEvent, UseTerminalSession } from "../api/terminal";
import { fmt, getMessages, useI18n, type Messages } from "../i18n";

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

function whoLabel(event: TerminalEvent, messages: Messages): string {
  if (event.role === "agent" && event.kind === "tool") {
    return event.tool ? `tool:${event.tool}` : "tool";
  }
  const who = messages.shell.terminal.who;
  if (event.role === "user") return who.user;
  if (event.role === "agent") return who.agent;
  if (event.role === "system") return who.system;
  return event.role;
}

export function PixelTerminal({ session }: { session: UseTerminalSession }) {
  const { t } = useI18n();
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
          aria-label={t.shell.terminal.transcriptLabel}
        >
          <div className="pixel-panel-head">
            <h2>{t.shell.terminal.heading}</h2>
            <button
              type="button"
              className="pixel-linklike pixel-panel-mark"
              onClick={() => setExpanded(false)}
            >
              {t.shell.terminal.hide}
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
                <span className="pixel-line-who">{whoLabel(event, t)}&gt;</span>
                <span className="pixel-line-text">{event.text}</span>
              </p>
            ))}
            {presence.busy ? (
              <p className="pixel-line" data-role="agent" data-kind="thought">
                <span className="pixel-line-who">
                  {t.shell.terminal.who.agent}&gt;
                </span>
                <span className="pixel-line-text">
                  {t.shell.terminal.working} <span className="pixel-caret" />
                </span>
              </p>
            ) : null}
          </div>
          <p className="pixel-transcript-hint">
            {presence.attached ? (
              <>
                {t.shell.terminal.attachedPrefix}{" "}
                <code>{presence.agent?.label}</code>{" "}
                {t.shell.terminal.attachedOver}{" "}
                <code>{presence.agent?.harness}</code>.{" "}
                <button
                  type="button"
                  className="pixel-linklike"
                  onClick={() => void cancel()}
                >
                  {t.shell.terminal.interrupt}
                </button>
              </>
            ) : (
              <>
                {t.shell.terminal.noAgentBefore}{" "}
                <code>marketingovo_session_attach</code>{" "}
                {t.shell.terminal.noAgentAfter}
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
            {t.shell.terminal.promptLabel}
          </label>
          <input
            id="pixel-prompt-input"
            className="pixel-prompt-input"
            value={draft}
            onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            placeholder={t.shell.terminal.promptPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          {hasTranscript && !expanded ? (
            <button
              type="button"
              className="pixel-linklike"
              onClick={() => setExpanded(true)}
            >
              {fmt(t.shell.terminal.show, { count: events.length })}
            </button>
          ) : null}
        </div>
        <button
          className="pixel-prompt-send"
          type="submit"
          disabled={sending || draft.trim().length === 0}
          aria-label={t.shell.terminal.send}
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
        <p className="pixel-note">{t.shell.terminal.reconnecting}</p>
      ) : null}
    </div>
  );
}

/** Presence summary for the top bar, so the header states agent liveness. */
export function agentStatus(
  session: UseTerminalSession,
  messages: Messages = getMessages(),
): {
  state: "online" | "busy" | "offline";
  label: string;
} {
  const status = messages.shell.terminal.status;
  if (session.connection === "failed") {
    return { state: "offline", label: status.serviceOffline };
  }
  if (session.presence.busy) {
    return { state: "busy", label: status.agentWorking };
  }
  if (session.presence.attached) {
    return { state: "online", label: status.agentOnline };
  }
  return { state: "offline", label: status.noAgent };
}
