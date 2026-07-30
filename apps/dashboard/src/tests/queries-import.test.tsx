// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useImportProject } from "../api/queries";
import { apiRequest } from "../api/client";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn(),
}));

describe("useImportProject", () => {
  it("accepts .marketingovo project bundles", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: {}, meta: {} });

    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useImportProject(), { wrapper });

    // Test the canonical .marketingovo extension
    const marketingovoFile = {
      name: "test.marketingovo",
      type: "application/json",
      size: 10,
      text: () => Promise.resolve("{}"),
    } as any as File;
    result.current.mutate(marketingovoFile);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
  });
});
