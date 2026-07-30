// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingPage } from "../pages/onboarding";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

vi.mock("../context/site-context", () => ({
  useSite: () => ({
    siteId: "test-site-id",
    site: { url: "https://example.com" },
  }),
}));

vi.mock("../api/queries", () => ({
  useCreateSite: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useIntegrations: () => ({ data: { data: { items: [] } } }),
  useRuns: () => ({ data: { data: { items: [] } } }),
  useMonitoring: () => ({ data: { data: { schedules: [] } } }),
  useStartAudit: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useCreateSchedule: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

describe("OnboardingPage localStorage migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("migrates the legacy golem-seo onboarding preferences key and deletes it", async () => {
    const legacyPrefs = {
      goal: "technical_health",
      crawlOnly: true,
      actionsReviewed: true,
    };
    window.localStorage.setItem(
      "golem-seo:onboarding:v1:test-site-id",
      JSON.stringify(legacyPrefs),
    );

    const client = new QueryClient();
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: OnboardingPage,
    });
    const routeTree = rootRoute.addChildren([indexRoute]);
    const router = createRouter({ routeTree, history: createMemoryHistory() });

    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    // If migration succeeded, the goal button for "technical_health" should be pressed
    await waitFor(() => {
      expect(
        window.localStorage.getItem("agentseo:onboarding:v1:test-site-id"),
      ).toEqual(JSON.stringify(legacyPrefs));
    });
    expect(
      window.localStorage.getItem("golem-seo:onboarding:v1:test-site-id"),
    ).toBeNull();
  });
});
