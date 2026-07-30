import type { PropsWithChildren } from "react";

const workspaces = [
  "Briefing",
  "Research",
  "Companies & Brands",
  "Creators",
  "Compare",
  "Trends",
  "Graph",
  "Watchlists & Alerts",
  "Datasets & Evidence",
  "Reports & Runs",
  "Sources",
  "Governance",
  "System Health",
] as const;

export function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark small" aria-hidden="true">
            G
          </span>
          <span>
            <strong>AGENTintel</strong>
            <small>Community · local</small>
          </span>
        </div>
        <nav aria-label="Intelligence workspaces">
          <ul className="workspace-list">
            {workspaces.map((workspace) => (
              <li key={workspace}>
                {workspace === "Research" ? (
                  <a href="/" aria-current="page" className="active">
                    <span>{workspace}</span>
                  </a>
                ) : (
                  <span className="future" aria-disabled="true">
                    <span>{workspace}</span>
                    <small>soon</small>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="policy-state">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Policy gate active
            <small>public · authorized · licensed</small>
          </span>
        </div>
      </aside>
      <main className="main-canvas">{children}</main>
    </div>
  );
}
