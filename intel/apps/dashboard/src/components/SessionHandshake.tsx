export interface SessionHandshakeProps {
  restoring?: boolean;
}

export function SessionHandshake({
  restoring = false,
}: SessionHandshakeProps): React.JSX.Element {
  return (
    <main className="token-gate" aria-live="polite">
      <section className="token-card handshake-card">
        <div className="brand-mark" aria-hidden="true">
          G
        </div>
        <p className="eyebrow">
          {restoring
            ? "RESTORING LOOPBACK SESSION"
            : "SECURING LOOPBACK SESSION"}
        </p>
        <h1>
          {restoring
            ? "Reopening the evidence room"
            : "Opening the evidence room"}
        </h1>
        <p className="muted">
          {restoring
            ? "Recovering the CSRF binding from the existing HttpOnly session."
            : "Exchanging the one-time ticket and binding this tab to an HttpOnly session."}
        </p>
        <div className="handshake-track" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
