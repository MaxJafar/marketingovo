import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell } from "../components/AppShell.js";
import { EvidencePage } from "../pages/EvidencePage.js";
import { ResearchPage } from "../pages/ResearchPage.js";
import { RunsPage } from "../pages/RunsPage.js";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ResearchPage,
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs",
  component: RunsPage,
});

const evidenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/evidence",
  component: EvidencePage,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([researchRoute, runsRoute, evidenceRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter(): React.JSX.Element {
  return <RouterProvider router={router} />;
}
