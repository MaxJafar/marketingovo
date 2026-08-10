import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useIntegrations } from "../api/queries";
import { useTerminalSession } from "../api/terminal";
import {
  LOCALES,
  LOCALE_LABELS,
  fmt,
  getMessages,
  useI18n,
  type Locale,
  type Messages,
} from "../i18n";
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
  glyph: string;
  key: keyof Messages["shell"]["nav"];
}

const NAV: NavItem[] = [
  { to: "/", glyph: "dashboard", key: "dashboard" },
  { to: "/audits", glyph: "seo-analytics", key: "seoAnalytics" },
  { to: "/calendar", glyph: "calendar", key: "calendar" },
  { to: "/report", glyph: "report", key: "report" },
  { to: "/links", glyph: "links", key: "links" },
  { to: "/email", glyph: "email", key: "email" },
  { to: "/ads", glyph: "ad-cabinets", key: "adCabinets" },
  { to: "/social", glyph: "social-research", key: "socialResearch" },
  { to: "/osint", glyph: "osint", key: "osint" },
  { to: "/content", glyph: "content-intel", key: "contentIntel" },
  { to: "/competitors", glyph: "competitors", key: "competitors" },
  { to: "/keywords", glyph: "keyword-lab", key: "keywordLab" },
  { to: "/backlinks", glyph: "backlinks", key: "backlinks" },
  { to: "/reports", glyph: "reports", key: "reports" },
  { to: "/monitoring", glyph: "alerts", key: "alerts" },
  { to: "/context", glyph: "notes", key: "notes" },
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
const UTILITY_NAV: Array<{
  to: string;
  key: keyof Messages["shell"]["utility"];
}> = [
  { to: "/actions", key: "actions" },
  { to: "/issues", key: "issueReview" },
  { to: "/pages", key: "pages" },
  { to: "/integrations", key: "integrations" },
  { to: "/settings", key: "settings" },
  { to: "/system", key: "systemHealth" },
];

/** Routes reachable from within a section rather than from the rail itself. */
const SECONDARY_TITLES: ReadonlyArray<
  [RegExp, keyof Messages["shell"]["secondaryTitle"]]
> = [
  [/^\/audits\/.+/u, "auditDetails"],
  [/^\/actions\/.+/u, "actionEvidence"],
  [/^\/actions$/u, "actions"],
  [/^\/issues$/u, "issueReview"],
  [/^\/pages$/u, "pages"],
  [/^\/integrations$/u, "integrations"],
  [/^\/settings$/u, "settings"],
  [/^\/system$/u, "systemHealth"],
  [/^\/onboarding$/u, "setupGuide"],
  [/^\/setup-checklist$/u, "setupChecklist"],
];

export function routeTitleForPathname(
  pathname: string,
  messages: Messages = getMessages(),
): string {
  const shell = messages.shell;
  const exact = NAV.find((item) =>
    item.to === "/" ? pathname === "/" : pathname === item.to,
  );
  if (exact) return shell.navTitle[exact.key];
  const secondary = SECONDARY_TITLES.find(([pattern]) =>
    pattern.test(pathname),
  );
  if (secondary) return shell.secondaryTitle[secondary[1]];
  const nested = NAV.find(
    (item) => item.to !== "/" && pathname.startsWith(`${item.to}/`),
  );
  return nested ? shell.navTitle[nested.key] : shell.notFoundTitle;
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
  const { t } = useI18n();
  const integrations = useIntegrations(siteId);
  const items = integrations.data?.data.items ?? [];

  const lines: Array<{ text: string; state: "ok" | "pending" | "fail" }> = [
    { text: t.shell.bootlog.connecting, state: "ok" },
  ];

  if (integrations.isLoading) {
    lines.push({ text: t.shell.bootlog.probing, state: "pending" });
  } else if (items.length === 0) {
    lines.push({ text: t.shell.bootlog.noConnectors, state: "pending" });
    lines.push({ text: t.shell.bootlog.openIntegrations, state: "pending" });
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
          ? t.shell.bootlog.syncComplete
          : fmt(t.shell.bootlog.sourcesLive, {
              connected,
              total: items.length,
            }),
      state: connected === items.length ? "ok" : "pending",
    });
  }

  return (
    // Deliberately unnamed: an aria-label here would override the visible
    // "Terminal" heading as this region's name, and the scrollable group inside
    // already carries one.
    <section className="pixel-panel pixel-bootlog">
      <div className="pixel-panel-head">
        <h2>{t.shell.bootlog.heading}</h2>
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
        aria-label={t.shell.bootlog.listLabel}
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
  const { t, locale, setLocale } = useI18n();
  const { siteId, sites, setSiteId, isLoading } = useSite();
  const session = useTerminalSession(siteId || null);
  const status = agentStatus(session, t);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const routeTitle = routeTitleForPathname(pathname, t);

  useEffect(() => {
    document.title = `${routeTitle} | Marketingovo`;
    setAnnouncement(fmt(t.shell.pageLoaded, { title: routeTitle }));
    if (previousPathname.current !== pathname) mainRef.current?.focus();
    previousPathname.current = pathname;
  }, [pathname, routeTitle, t]);

  return (
    <div className="pixel-frame">
      <a className="pixel-skip" href="#main-content">
        {t.shell.skipToContent}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <Link to="/" className="pixel-brand" aria-label={t.shell.brandHome}>
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
            {t.shell.activeSite}
          </label>
          <select
            id="site-select"
            className="pixel-cmdline-select"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            disabled={isLoading || sites.length === 0}
          >
            {sites.length === 0 ? (
              <option value="">{t.shell.noSite}</option>
            ) : (
              sites.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.name.toLowerCase().replace(/\s+/gu, "_")}
                </option>
              ))
            )}
          </select>
          <span aria-hidden="true"> --lang=</span>
          {/* The language switch rides the same conceit as `--site=`: a flag
              whose value is real. Options carry the native language name next
              to the code so the control stays legible to someone stranded in a
              locale they cannot read. */}
          <label className="sr-only" htmlFor="locale-select">
            {t.shell.language}
          </label>
          <select
            id="locale-select"
            className="pixel-cmdline-select"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {LOCALES.map((code) => (
              <option value={code} key={code}>
                {code} · {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
          <Link to="/onboarding" className="pixel-cmdline-action">
            {t.shell.addSite}
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
        aria-label={t.shell.sectionsLabel}
      >
        <button
          type="button"
          className="pixel-rail-toggle"
          onClick={() => setRailCollapsed((current) => !current)}
          aria-expanded={!railCollapsed}
        >
          {railCollapsed ? t.shell.sectionsCollapsed : t.shell.sectionsExpanded}
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
                <span>{t.shell.nav[item.key]}</span>
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
        <nav className="pixel-subnav" aria-label={t.shell.workbenches}>
          <span className="pixel-subnav-label">{t.shell.workbenches}</span>
          {UTILITY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="pixel-subnav-link"
              aria-current={isActive(pathname, item.to) ? "page" : undefined}
            >
              {t.shell.utility[item.key]}
            </Link>
          ))}
        </nav>
        {/* The checklist tracks setup across a workspace's whole life, where
            the wizard behind "+ add site" only covers first creation. It had no
            entry point at all after the console shell replaced the old sidebar,
            which left a supported surface unreachable. */}
        <Link to="/setup-checklist" className="pixel-rail-setup">
          {t.shell.setupChecklist}
        </Link>
        <p className="pixel-rail-status">
          {fmt(t.shell.systemStatus, {
            state:
              status.state === "offline"
                ? t.shell.systemStandby
                : t.shell.systemOptimal,
          })}
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
          <span className="pixel-footer-heart">♥</span> {t.shell.footerLove}{" "}
          <span className="pixel-footer-heart">♥</span>
        </span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}
