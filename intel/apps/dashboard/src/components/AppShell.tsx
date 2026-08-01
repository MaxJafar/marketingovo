import type { PropsWithChildren } from "react";

// Workspaces with a route are linked; the rest are declared as not yet built
// rather than hidden, so the boundary of the product is visible in the product.
const routes: Partial<Record<(typeof workspaces)[number], string>> = {
  Research: "/",
  "Reports & Runs": "/runs",
  "Datasets & Evidence": "/evidence",
};

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
            A
          </span>
          <span>
            <strong>AGENTintel</strong>
            <small>Community · local</small>
          </span>
        </div>
        <nav aria-label="Intelligence workspaces">
          <ul className="workspace-list">
            {workspaces.map((workspace) => {
              const href = routes[workspace];
              const current =
                typeof window !== "undefined" &&
                window.location.pathname === href;
              return (
                <li key={workspace}>
                  {href ? (
                    <a
                      href={href}
                      className={current ? "active" : undefined}
                      {...(current ? { "aria-current": "page" as const } : {})}
                    >
                      <span>{workspace}</span>
                    </a>
                  ) : (
                    <span className="future" aria-disabled="true">
                      <span>{workspace}</span>
                      <small>soon</small>
                    </span>
                  )}
                </li>
              );
            })}
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
