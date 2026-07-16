import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: apiRequestMock }));

import { GolemWorkersLinkCard } from "../components/golemworkers-link-card";

function renderCard(projectId = "project-1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GolemWorkersLinkCard projectId={projectId} />
    </QueryClientProvider>,
  );
}

describe("GolemWorkersLinkCard", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("shows only the safe user code and HTTPS approval link while authorization is pending", async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        state: "pending",
        verificationUrl: "https://golemworkers.com/seo/device",
        userCode: "ABCD-1234",
        expiresAt: "2026-07-15T12:10:00.000Z",
        orgId: null,
        errorCode: null,
        errorMessage: null,
      },
      meta: { state: "unknown" },
    });

    renderCard();

    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /approve device/i }),
    ).toHaveAttribute("href", "https://golemworkers.com/seo/device");
    expect(document.body.textContent).not.toContain("deviceToken");
    expect(document.body.textContent).not.toContain("deviceCode");
  });

  it("imports the selected local project only after a connected status", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/golemworkers/device/status") {
        return {
          data: {
            state: "connected",
            verificationUrl: null,
            userCode: null,
            expiresAt: "2026-10-15T12:00:00.000Z",
            orgId: "org-a",
            errorCode: null,
            errorMessage: null,
          },
          meta: { state: "unknown" },
        };
      }
      if (path === "/golemworkers/import") {
        return {
          data: {
            import: {
              projectId: "hosted-1",
              runCount: 2,
              actionCount: 3,
              issueCount: 4,
            },
          },
          meta: { state: "unknown" },
        };
      }
      throw new Error(`Unexpected request ${path}`);
    });

    renderCard("local-project");
    await userEvent.click(
      await screen.findByRole("button", { name: "Import this site" }),
    );

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/golemworkers/import",
        expect.objectContaining({
          body: JSON.stringify({ projectId: "local-project" }),
        }),
      ),
    );
    expect(
      await screen.findByText(/hosted project hosted-1/i),
    ).toBeInTheDocument();
  });
});
