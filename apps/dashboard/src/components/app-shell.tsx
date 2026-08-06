import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useIntegrations } from "../api/queries";
import { useTerminalSession } from "../api/terminal";
import { agentStatus, PixelTerminal } from "./pixel-terminal";
import { PixelMaskIcon, PixelSprite } from "./pixel-sprite";
import { mascotGlyphs, navGlyphs } from "./pixel-glyphs";

/**
 * The console frame: brand block, command bar, section rail, boot log, and the
 * agent prompt that runs along the bottom of every page.
 *
 * The rail's headline sections are the product's own map rather than a restyling of
 * the old sidebar — "SEO analytics" and "keyword lab" are how a marketer
 * describes this work, and each one points at a route that already does it.
 */

interface NavItem {
  to: string;
  label: string;
  glyph: string;
  title: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", glyph: "dashboard", title: "Dashboard" },
  {
    to: "/audits",
    label: "SEO Analytics",
    glyph: "seo-analytics",
    title: "SEO analytics",
  },
  {
    to: "/calendar",
    label: "Calendar",
    glyph: "calendar",
    title: "Content calendar — schedule and publish across platforms",
  },
  {
    to: "/report",
    label: "Report",
    glyph: "report",
    title: "Cross-channel report for clients",
  },
  {
    to: "/links",
    label: "Links & QR",
    glyph: "links",
    title: "Campaign links and QR codes that never expire",
  },
  {
    to: "/email",
    label: "Email",
    glyph: "email",
    title: "Email builder — brand kit and campaign HTML",
  },
  {
    to: "/ads",
    label: "Ad Cabinets",
    glyph: "ad-cabinets",
    title: "Ad cabinets — Meta and Google Ads",
  },
  {
    to: "/social",
    label: "Social Research",
    glyph: "social-research",
    title: "Social research",
  },
  {
    to: "/osint",
    label: "OSINT Layer",
    glyph: "osint",
    title: "OSINT layer",
  },
  {
    to: "/content",
    label: "Content Intel",
    glyph: "content-intel",
    title: "Content intel",
  },
  {
    to: "/competitors",
    label: "Competitors",
    glyph: "competitors",
    title: "Competitors",
  },
  {
    to: "/keywords",
    label: "Keyword Lab",
    glyph: "keyword-lab",
    title: "Keyword lab",
  },
  {
    to: "/backlinks",
    label: "Backlinks",
    glyph: "backlinks",
    title: "Backlinks",
  },
  { to: "/reports", label: "Reports", glyph: "reports", title: "Reports" },
  { to: "/monitoring", label: "Alerts", glyph: "alerts", title: "Alerts" },
  { to: "/context", label: "Notes", glyph: "notes", title: "Notes" },
];

/**
 * The workbenches the headline sections do not cover.
 *
 * These are full pages, not detail views: the action queue, issue review, the
 * page inventory, connectors, settings and health. Giving them a dense
 * secondary cluster rather than rail entries of their own keeps the primary
 * rail readable while making sure nothing that works is unreachable — a page
 * with no link into it is, from the operator's side, a page that does not exist.
 */
const UTILITY_NAV: Array<{ to: string; label: string }> = [
  { to: "/actions", label: "Actions" },
  { to: "/issues", label: "Issue review" },
  { to: "/pages", label: "Pages" },
  { to: "/integrations", label: "Integrations" },
  { to: "/settings", label: "Settings" },
  { to: "/system", label: "System health" },
];

/** Routes reachable from within a section rather than from the rail itself. */
const SECONDARY_TITLES: ReadonlyArray<[RegExp, string]> = [
  [/^\/audits\/.+/u, "Audit details"],
  [/^\/actions\/.+/u, "Action evidence"],
  [/^\/actions$/u, "Actions"],
  [/^\/issues$/u, "Issue review"],
  [/^\/pages$/u, "Pages"],
  [/^\/integrations$/u, "Integrations"],
  [/^\/settings$/u, "Settings"],
  [/^\/system$/u, "System health"],
  [/^\/onboarding$/u, "Setup guide"],
  [/^\/setup-checklist$/u, "Setup checklist"],
];

export function routeTitleForPathname(pathname: string): string {
  const exact = NAV.find((item) =>
    item.to === "/" ? pathname === "/" : pathname === item.to,
  );
  if (exact) return exact.title;
  const secondary = SECONDARY_TITLES.find(([pattern]) =>
    pattern.test(pathname),
  );
  if (secondary) return secondary[1];
  const nested = NAV.find(
    (item) => item.to !== "/" && pathname.startsWith(`${item.to}/`),
  );
  return nested?.title ?? "Page not found";
}

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

/**
 * The boot log is not decoration. Each line is a configured connector and its
 * real state, which makes the most console-looking element on the page also the
 * fastest answer to "is my data actually flowing".
 */
function BootLog({ siteId }: { siteId: string }) {
  const integrations = useIntegrations(siteId);
  const items = integrations.data?.data.items ?? [];

  const lines: Array<{ text: string; state: "ok" | "pending" | "fail" }> = [
    { text: "connecting to data sources...", state: "ok" },
  ];

  if (integrations.isLoading) {
    lines.push({ text: "probing connectors", state: "pending" });
  } else if (items.length === 0) {
    lines.push({ text: "no connectors configured", state: "pending" });
    lines.push({ text: "open integrations to connect", state: "pending" });
  } else {
    for (const integration of items) {
      const ok = integration.status === "connected";
      const failed =
        integration.status === "failed" || integration.status === "expired";
      lines.push({
        text: `${integration.name.toLowerCase()} [ ${
          ok ? "OK" : failed ? "FAIL" : integration.status.replace(/_/gu, " ")
        } ]`,
        state: ok ? "ok" : failed ? "fail" : "pending",
      });
    }
    const connected = items.filter(
      (integration) => integration.status === "connected",
    ).length;
    lines.push({
      text:
        connected === items.length
          ? "data sync complete ✓"
          : `${connected}/${items.length} sources live`,
      state: connected === items.length ? "ok" : "pending",
    });
  }

  return (
    // Deliberately unnamed: an aria-label here would override the visible
    // "Terminal" heading as this region's name, and the scrollable group inside
    // already carries one.
    <section className="pixel-panel pixel-bootlog">
      <div className="pixel-panel-head">
        <h2>Terminal</h2>
        <span className="pixel-bootlog-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
      {/* The connector list scrolls once enough sources are configured, and a
          scroll container that nothing inside can take focus is unreachable
          from the keyboard. Making the region itself focusable and naming it is
          what lets someone arrow through it without a pointer. */}
      <div
        className="pixel-bootlog-body"
        tabIndex={0}
        role="group"
        aria-label="Connector boot log"
      >
        <ul>
          {lines.map((line) => (
            <li key={line.text} data-state={line.state}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { siteId, sites, setSiteId, isLoading } = useSite();
  const session = useTerminalSession(siteId || null);
  const status = agentStatus(session);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const routeTitle = routeTitleForPathname(pathname);

  useEffect(() => {
    document.title = `${routeTitle} | Marketingovo`;
    setAnnouncement(`${routeTitle} page loaded.`);
    if (previousPathname.current !== pathname) mainRef.current?.focus();
    previousPathname.current = pathname;
  }, [pathname, routeTitle]);

  return (
    <div className="pixel-frame">
      <a className="pixel-skip" href="#main-content">
        Skip to content
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <Link to="/" className="pixel-brand" aria-label="Marketingovo home">
        <img
          className="pixel-brand-lockup"
          src="/pixel/brand/marketingovo-lockup.png"
          alt=""
          width={232}
          height={32}
        />
      </Link>

      <header className="pixel-topbar">
        <div className="pixel-cmdline">
          <span className="pixel-cmdline-sigil" aria-hidden="true">
            $
          </span>
          <span aria-hidden="true">
            marketingovo --intel-mode=active --site=
          </span>
          {/* The `--site=` argument is the real project switcher rather than a
              caption. Writing it as a flag value keeps the console conceit
              intact while restoring the control a multi-project operator needs;
              a decorative command line that could not change anything would be
              a worse trade than a slightly less pure one. */}
          <label className="sr-only" htmlFor="site-select">
            Active site
          </label>
          <select
            id="site-select"
            className="pixel-cmdline-select"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            disabled={isLoading || sites.length === 0}
          >
            {sites.length === 0 ? (
              <option value="">none</option>
            ) : (
              sites.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.name.toLowerCase().replace(/\s+/gu, "_")}
                </option>
              ))
            )}
          </select>
          <Link to="/onboarding" className="pixel-cmdline-action">
            + add site
          </Link>
          <span className="pixel-status" data-state={status.state}>
            <span className="pixel-status-dot" aria-hidden="true" />
            {status.label}
          </span>
        </div>
        <div className="pixel-window-buttons" aria-hidden="true">
          {/* Chrome for the conceit only — a web page cannot minimise itself,
              so these stay inert rather than pretending to be functional. */}
          <span className="pixel-window-button" data-variant="min">
            –
          </span>
          <span className="pixel-window-button" data-variant="max">
            □
          </span>
          <span className="pixel-window-button" data-variant="close">
            ✕
          </span>
        </div>
      </header>

      <aside
        className="pixel-rail"
        data-collapsed={railCollapsed}
        aria-label="Sections"
      >
        <button
          type="button"
          className="pixel-rail-toggle"
          onClick={() => setRailCollapsed((current) => !current)}
          aria-expanded={!railCollapsed}
        >
          {railCollapsed ? "▸ sections" : "▾ sections"}
        </button>
        <nav className="pixel-nav">
          {NAV.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="pixel-nav-link"
                aria-current={active ? "page" : undefined}
              >
                {active ? (
                  <span className="pixel-nav-caret" aria-hidden="true">
                    &gt;
                  </span>
                ) : null}
                <PixelMaskIcon
                  src={`/pixel/nav/${item.glyph}.png`}
                  fallback={navGlyphs[item.glyph]}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <BootLog siteId={siteId} />
        <div className="pixel-rail-mascot">
          <PixelSprite
            src="/pixel/mascot/monitor-buddy.png"
            fallback={mascotGlyphs.monitor}
            size={128}
            height={116}
          />
        </div>
        <nav className="pixel-subnav" aria-label="Workbenches">
          <span className="pixel-subnav-label">Workbenches</span>
          {UTILITY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="pixel-subnav-link"
              aria-current={isActive(pathname, item.to) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* The checklist tracks setup across a workspace's whole life, where
            the wizard behind "+ add site" only covers first creation. It had no
            entry point at all after the console shell replaced the old sidebar,
            which left a supported surface unreachable. */}
        <Link to="/setup-checklist" className="pixel-rail-setup">
          Setup checklist
        </Link>
        <p className="pixel-rail-status">
          system status: {status.state === "offline" ? "standby" : "optimal"}
        </p>
      </aside>

      {/* tabIndex 0, not -1: the main column is a scroll container at desktop
          widths, and a scrollable region that cannot be reached by keyboard is
          content only a pointer can read. It still accepts the programmatic
          focus that announces a route change. */}
      <main ref={mainRef} id="main-content" className="pixel-main" tabIndex={0}>
        <Outlet />
      </main>

      <PixelTerminal session={session} />

      <footer className="pixel-footer">
        <span>
          © {new Date().getFullYear()} marketingovo{" "}
          <span className="pixel-footer-heart">♥</span>
        </span>
        <span>
          <span className="pixel-footer-heart">♥</span> data is beautiful{" "}
          <span className="pixel-footer-heart">♥</span>
        </span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}
