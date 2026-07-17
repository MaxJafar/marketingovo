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
  it("accepts .agentseo and .golemseo file extensions", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: {}, meta: {} });

    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useImportProject(), { wrapper });

    // Test .agentseo
    const agentseoFile = {
      name: "test.agentseo",
      type: "application/json",
      size: 10,
      text: () => Promise.resolve("{}"),
    } as any as File;
    result.current.mutate(agentseoFile);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);

    // Test .golemseo
    const golemseoFile = {
      name: "test.golemseo",
      type: "application/json",
      size: 10,
      text: () => Promise.resolve("{}"),
    } as any as File;
    result.current.mutate(golemseoFile);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);

    // Test invalid extension
    const invalidFile = {
      name: "test.txt",
      type: "text/plain",
      size: 10,
      text: () => Promise.resolve("{}"),
    } as any as File;
    result.current.mutate(invalidFile);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(
      /Choose a file with the \.agentseo or \.golemseo extension/,
    );

    vi.restoreAllMocks();
  });
});
