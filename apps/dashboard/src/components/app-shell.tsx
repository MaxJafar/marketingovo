import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { Icon, type IconName } from "./icon";

const primaryNav: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/", label: "Overview", icon: "overview" },
  { to: "/context", label: "Project context", icon: "context" },
  { to: "/actions", label: "Actions", icon: "actions" },
  { to: "/issues", label: "Issue review", icon: "issues" },
  { to: "/audits", label: "Audits", icon: "audits" },
  { to: "/pages", label: "Pages", icon: "pages" },
  { to: "/keywords", label: "Keywords & content", icon: "keywords" },
  { to: "/competitors", label: "Competitors", icon: "competitors" },
];

const operationsNav: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/monitoring", label: "Monitoring", icon: "monitoring" },
  { to: "/reports", label: "Reports", icon: "reports" },
  { to: "/integrations", label: "Integrations", icon: "integrations" },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/system", label: "System health", icon: "health" },
];

const routeTitles: ReadonlyArray<{
  matches: (pathname: string) => boolean;
  title: string;
}> = [
  { matches: (pathname) => pathname === "/", title: "Overview" },
  {
    matches: (pathname) => pathname === "/context",
    title: "Project context",
  },
  {
    matches: (pathname) => pathname.startsWith("/actions/"),
    title: "Action evidence",
  },
  { matches: (pathname) => pathname === "/actions", title: "Actions" },
  { matches: (pathname) => pathname === "/issues", title: "Issue review" },
  {
    matches: (pathname) => pathname.startsWith("/audits/"),
    title: "Audit details",
  },
  { matches: (pathname) => pathname === "/audits", title: "Audits" },
  { matches: (pathname) => pathname === "/pages", title: "Pages" },
  {
    matches: (pathname) => pathname === "/keywords",
    title: "Keywords & content",
  },
  {
    matches: (pathname) => pathname === "/competitors",
    title: "Competitors",
  },
  {
    matches: (pathname) => pathname === "/monitoring",
    title: "Monitoring",
  },
  { matches: (pathname) => pathname === "/reports", title: "Reports" },
  {
    matches: (pathname) => pathname === "/integrations",
    title: "Integrations",
  },
  { matches: (pathname) => pathname === "/settings", title: "Settings" },
  {
    matches: (pathname) => pathname === "/system",
    title: "System health",
  },
  {
    matches: (pathname) => pathname === "/onboarding",
    title: "Setup guide",
  },
];

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function routeTitleForPathname(pathname: string): string {
  return (
    routeTitles.find((route) => route.matches(pathname))?.title ??
    "Page not found"
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: typeof primaryNav;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="nav-group">
      <span className="nav-label">{label}</span>
      <nav aria-label={label}>
        {items.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link ${active ? "nav-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [routeAnnouncement, setRouteAnnouncement] = useState("");
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isMobile = useMediaQuery("(max-width: 820px)");
  const { sites, siteId, setSiteId, isLoading } = useSite();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);
  const restoreMenuFocusRef = useRef(false);
  const routeTitle = routeTitleForPathname(pathname);

  const closeMobileNavigation = useCallback((restoreFocus = true) => {
    restoreMenuFocusRef.current = restoreFocus;
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    document.title = `${routeTitle} | Marketingovo`;
    setRouteAnnouncement(`${routeTitle} page loaded.`);
    if (previousPathnameRef.current !== pathname) {
      mainRef.current?.focus();
    }
    previousPathnameRef.current = pathname;
  }, [pathname, routeTitle]);

  useEffect(() => {
    if (!mobileOpen && restoreMenuFocusRef.current) {
      restoreMenuFocusRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!isMobile && mobileOpen) closeMobileNavigation(false);
  }, [closeMobileNavigation, isMobile, mobileOpen]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileOpen]);

  function trapDrawerFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (!isMobile || !mobileOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobileNavigation(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
        [],
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true",
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const mobileSidebarHidden = isMobile && !mobileOpen;
  const workspaceHidden = isMobile && mobileOpen;
  const onboardingActive = pathname === "/onboarding";

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        aria-hidden={workspaceHidden || undefined}
        tabIndex={workspaceHidden ? -1 : undefined}
      >
        Skip to content
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {routeAnnouncement}
      </div>
      <aside
        id="mobile-navigation"
        ref={sidebarRef}
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Main navigation"
        aria-hidden={mobileSidebarHidden || undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        role={isMobile ? "dialog" : undefined}
        inert={mobileSidebarHidden ? true : undefined}
        onKeyDown={trapDrawerFocus}
      >
        <div className="brand-row">
          <Link
            to="/"
            className="brand"
            onClick={() => closeMobileNavigation(false)}
            aria-label="Marketingovo home"
          >
            <img
              className="brand-mark"
              src="/marketingovo-icon.png"
              alt=""
              width="38"
              height="38"
            />
            <span>
              <strong>Marketingovo</strong>
              <small>SEO control panel</small>
            </span>
          </Link>
          <button
            ref={closeButtonRef}
            className="icon-button sidebar-close"
            type="button"
            onClick={() => closeMobileNavigation(true)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>
        <NavGroup
          label="Workspace"
          items={primaryNav}
          pathname={pathname}
          onNavigate={() => closeMobileNavigation(false)}
        />
        <NavGroup
          label="Operations"
          items={operationsNav}
          pathname={pathname}
          onNavigate={() => closeMobileNavigation(false)}
        />
        <Link
          to="/onboarding"
          className="setup-card"
          aria-current={onboardingActive ? "page" : undefined}
          onClick={() => closeMobileNavigation(false)}
        >
          <span>Setup guide</span>
          <strong>Connect data and run a baseline</strong>
          <Icon name="arrow" />
        </Link>
      </aside>
      {mobileOpen && isMobile ? (
        <div
          className="sidebar-scrim"
          aria-hidden="true"
          onClick={() => closeMobileNavigation(true)}
        />
      ) : null}
      <div
        className="workspace"
        aria-hidden={workspaceHidden || undefined}
        inert={workspaceHidden ? true : undefined}
      >
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="icon-button mobile-menu"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isMobile ? mobileOpen : undefined}
            aria-controls="mobile-navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="site-switcher">
            <label htmlFor="site-select">Active site</label>
            <select
              id="site-select"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              disabled={isLoading || sites.length === 0}
            >
              {sites.length === 0 ? (
                <option value="">No site connected</option>
              ) : (
                sites.map((site) => (
                  <option value={site.id} key={site.id}>
                    {site.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="topbar-actions">
            <Link
              to="/onboarding"
              className="topbar-link"
              aria-current={onboardingActive ? "page" : undefined}
            >
              <Icon name="plus" /> Add site
            </Link>
            <span className="environment-pill">
              <span /> Local
            </span>
          </div>
        </header>
        <main
          ref={mainRef}
          id="main-content"
          className="main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
