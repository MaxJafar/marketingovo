// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteProvider, useSite } from "../context/site-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../api/queries", () => ({
  useSites: () => ({
    data: { data: { items: [{ id: "legacy-site-id", name: "Legacy Site" }] } },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("SiteContext localStorage migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("migrates legacy golem-seo selected-site key and deletes it", () => {
    window.localStorage.setItem("golem-seo:selected-site:v1", "legacy-site-id");

    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <SiteProvider>{children}</SiteProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useSite(), { wrapper });

    expect(result.current.siteId).toBe("legacy-site-id");
    expect(window.localStorage.getItem("agentseo:selected-site:v1")).toBe(
      "legacy-site-id",
    );
    expect(
      window.localStorage.getItem("golem-seo:selected-site:v1"),
    ).toBeNull();
  });
});
