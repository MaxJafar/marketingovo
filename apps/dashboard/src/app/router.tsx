import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { NotFoundPage } from "../pages/not-found";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const routes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: lazyRouteComponent(
      () => import("../pages/dashboard"),
      "DashboardPage",
    ),
  }),
  // The original metric-led overview stays reachable: the console home is a
  // briefing, and this is still the page to open when you want the numbers
  // with their coverage and freshness stated in full.
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/overview",
    component: lazyRouteComponent(
      () => import("../pages/overview"),
      "OverviewPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/social",
    component: lazyRouteComponent(
      () => import("../pages/social-research"),
      "SocialResearchPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/ads",
    component: lazyRouteComponent(
      () => import("../pages/ad-cabinets"),
      "AdCabinetsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
    component: lazyRouteComponent(
      () => import("../pages/content-calendar"),
      "ContentCalendarPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/report",
    component: lazyRouteComponent(
      () => import("../pages/marketing-report"),
      "MarketingReportPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/links",
    component: lazyRouteComponent(
      () => import("../pages/campaign-links"),
      "CampaignLinksPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/email",
    component: lazyRouteComponent(
      () => import("../pages/email-builder"),
      "EmailBuilderPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/osint",
    component: lazyRouteComponent(
      () => import("../pages/osint-research"),
      "OsintResearchPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/content",
    component: lazyRouteComponent(
      () => import("../pages/content-intel"),
      "ContentIntelPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/backlinks",
    component: lazyRouteComponent(
      () => import("../pages/backlinks"),
      "BacklinksPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/actions",
    component: lazyRouteComponent(
      () => import("../pages/actions"),
      "ActionsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/context",
    component: lazyRouteComponent(
      () => import("../pages/project-context"),
      "ProjectContextPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/actions/$actionId",
    component: lazyRouteComponent(
      () => import("../pages/action-detail"),
      "ActionDetailPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/issues",
    component: lazyRouteComponent(
      () => import("../pages/issues"),
      "IssuesPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/audits",
    component: lazyRouteComponent(
      () => import("../pages/audits"),
      "AuditsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/audits/$runId",
    component: lazyRouteComponent(
      () => import("../pages/audit-detail"),
      "AuditDetailPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/pages",
    component: lazyRouteComponent(() => import("../pages/pages"), "PagesPage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/keywords",
    component: lazyRouteComponent(
      () => import("../pages/keywords"),
      "KeywordsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/competitors",
    component: lazyRouteComponent(
      () => import("../pages/competitors"),
      "CompetitorsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/monitoring",
    component: lazyRouteComponent(
      () => import("../pages/monitoring"),
      "MonitoringPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/reports",
    component: lazyRouteComponent(
      () => import("../pages/reports"),
      "ReportsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/integrations",
    component: lazyRouteComponent(
      () => import("../pages/integrations"),
      "IntegrationsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: lazyRouteComponent(
      () => import("../pages/settings"),
      "SettingsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/system",
    component: lazyRouteComponent(
      () => import("../pages/system-health"),
      "SystemHealthPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding",
    component: lazyRouteComponent(
      () => import("../pages/wizard"),
      "WizardPage",
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    // The original checklist stays reachable: it tracks progress across a
    // workspace's whole life, where the wizard only covers first setup.
    path: "/setup-checklist",
    component: lazyRouteComponent(
      () => import("../pages/onboarding"),
      "OnboardingPage",
    ),
  }),
];

const routeTree = rootRoute.addChildren(routes);
export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
