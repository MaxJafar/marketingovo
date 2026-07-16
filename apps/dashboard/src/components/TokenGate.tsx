import { useState, type FormEvent } from "react";

interface TokenGateProps {
  onUnlock(token: string): void;
  error?: string;
}

export function TokenGate({ onUnlock, error }: TokenGateProps): React.JSX.Element {
  const [token, setToken] = useState("");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = token.trim();
    if (value) onUnlock(value);
  }

  return (
    <main className="token-gate">
      <section className="token-card" aria-labelledby="unlock-title">
        <div className="brand-mark" aria-hidden="true">
          G
        </div>
        <p className="eyebrow">LOCAL INTELLIGENCE RUNTIME</p>
        <h1 id="unlock-title">Open the command center</h1>
        <p className="muted">
          Paste the one-time ticket printed by <span className="mono">golem-inteld</span>.
          It is exchanged for an HttpOnly session and never written to browser storage.
        </p>
        {error && <p className="error-banner gate-error">{error}</p>}
        <form onSubmit={submit} className="token-form">
          <label htmlFor="service-token">One-time dashboard ticket</label>
          <input
            id="service-token"
            type="password"
            autoComplete="off"
            minLength={43}
            maxLength={43}
            pattern="[A-Za-z0-9_-]{43}"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="gintel_…"
          />
          <button className="primary-button" type="submit" disabled={!token.trim()}>
            Enter workspace
          </button>
        </form>
        <p className="security-note">Loopback only · HttpOnly session · CSRF protected</p>
      </section>
    </main>
  );
}
