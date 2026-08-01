import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentIntelClient } from "@agentintel/sdk";
import { IntelClientProvider } from "../api/client-context.js";
import { EvidencePage } from "../pages/EvidencePage.js";
import { RunsPage } from "../pages/RunsPage.js";

afterEach(cleanup);

function mount(node: React.ReactNode, client: Partial<AgentIntelClient>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntelClientProvider client={client as AgentIntelClient}>
        {node}
      </IntelClientProvider>
    </QueryClientProvider>,
  );
}

describe("Reports & runs workspace", () => {
  it("lists stored runs and offers replay only once a run is terminal", async () => {
    const client = {
      runs: {
        list: vi.fn(async () => [
          {
            id: "run-done",
            workflow: "compare",
            status: "succeeded",
            created_at: "2026-07-30T10:00:00Z",
          },
          {
            id: "run-live",
            workflow: "research",
            status: "running",
            created_at: "2026-07-30T11:00:00Z",
          },
        ]),
        cancel: vi.fn(),
        replay: vi.fn(),
      },
    };
    mount(<RunsPage />, client as unknown as Partial<AgentIntelClient>);

    expect(await screen.findByText("run-done")).toBeTruthy();
    expect(screen.getByText("run-live")).toBeTruthy();
    // A finished run can be replayed; a running one can only be cancelled.
    expect(screen.getByRole("button", { name: "Replay" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("says a partial run has reduced confidence rather than presenting it as complete", async () => {
    const client = {
      runs: {
        list: vi.fn(async () => [
          { id: "run-partial", workflow: "compare", status: "partial" },
        ]),
        cancel: vi.fn(),
        replay: vi.fn(),
      },
    };
    mount(<RunsPage />, client as unknown as Partial<AgentIntelClient>);
    expect(await screen.findByText(/confidence is reduced/u)).toBeTruthy();
  });

  it("renders an absent timestamp as unavailable instead of inventing one", async () => {
    const client = {
      runs: {
        list: vi.fn(async () => [
          { id: "run-nodate", workflow: "compare", status: "queued" },
        ]),
        cancel: vi.fn(),
        replay: vi.fn(),
      },
    };
    mount(<RunsPage />, client as unknown as Partial<AgentIntelClient>);
    expect(await screen.findByLabelText("unavailable")).toBeTruthy();
  });
});

describe("Datasets & evidence workspace", () => {
  it("searches committed evidence and shows what was stored", async () => {
    const search = vi.fn(async () => [
      {
        kind: "observation",
        id: "obs-1",
        label: "Northstar Labs publishing cadence",
        excerpt: "10.5 days per item across 3 entries",
        confidence: 0.92,
      },
    ]);
    mount(<EvidencePage />, { search } as unknown as Partial<AgentIntelClient>);

    await userEvent.type(screen.getByLabelText(/Search committed evidence/u), "northstar");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Northstar Labs publishing cadence")).toBeTruthy();
    expect(screen.getByText("0.92")).toBeTruthy();
    await waitFor(() => expect(search).toHaveBeenCalledWith("northstar"));
  });

  // An empty result means nothing was collected. Saying "no results" without
  // that distinction invites reading absence as evidence of absence.
  it("distinguishes nothing collected from nothing existing", async () => {
    const search = vi.fn(async () => []);
    mount(<EvidencePage />, { search } as unknown as Partial<AgentIntelClient>);

    await userEvent.type(screen.getByLabelText(/Search committed evidence/u), "unknown");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(/this is not a statement that it does not exist/u),
    ).toBeTruthy();
  });

  it("does not search until a term is entered", () => {
    const search = vi.fn(async () => []);
    mount(<EvidencePage />, { search } as unknown as Partial<AgentIntelClient>);
    expect(search).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Search" }).hasAttribute("disabled")).toBe(true);
  });
});
