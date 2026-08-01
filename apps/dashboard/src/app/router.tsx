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
      () => import("../pages/overview"),
      "OverviewPage",
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
