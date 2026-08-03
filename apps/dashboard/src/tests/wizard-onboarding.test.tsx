import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSite: vi.fn(),
  updateContext: vi.fn(),
  saveCredentials: vi.fn(),
  startAudit: vi.fn(),
  startWorkflow: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("../api/queries", () => ({
  useCreateSite: () => ({ mutateAsync: mocks.createSite }),
  useIntegrations: () => ({
    data: { data: { items: [] } },
  }),
  useSaveIntegrationCredentials: () => ({
    mutateAsync: mocks.saveCredentials,
  }),
  useStartAudit: () => ({ mutateAsync: mocks.startAudit }),
  useStartWorkflow: () => ({ mutateAsync: mocks.startWorkflow }),
  useUpdateProjectContext: () => ({ mutateAsync: mocks.updateContext }),
}));

import { WizardPage } from "../pages/wizard";

async function reachLaunch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Brand name"), "Acme Running");
  await user.type(
    screen.getByRole("textbox", { name: /^Website/u }),
    "acme.example",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Where else does the brand live?");

  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Who are you measured against?");
  await user.type(
    screen.getByRole("textbox", { name: /^Competitor domains/u }),
    "competitor.example",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Connect your data");

  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Ready to run");
}

describe("setup wizard first-run launch", () => {
  beforeEach(() => {
    mocks.createSite.mockResolvedValue({ data: { id: "project-1" } });
    mocks.updateContext.mockResolvedValue({ data: {} });
    mocks.saveCredentials.mockResolvedValue({ data: {} });
    mocks.startAudit.mockResolvedValue({ data: { id: "audit-1" } });
    mocks.startWorkflow.mockResolvedValue({ data: { id: "workflow-1" } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("includes a bounded OSINT pass by default and uses explicit competitor URLs", async () => {
    const user = userEvent.setup();
    render(<WizardPage />);
    await reachLaunch(user);

    const osint = screen.getByRole("checkbox", {
      name: /Include the public-web OSINT dossier/i,
    });
    expect(osint).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Start the first runs" }),
    );

    await waitFor(() => expect(mocks.startWorkflow).toHaveBeenCalledTimes(2));
    expect(mocks.startWorkflow).toHaveBeenNthCalledWith(1, {
      projectId: "project-1",
      workflowId: "compare",
      options: expect.objectContaining({
        competitorUrls: ["https://competitor.example"],
      }),
    });
    expect(mocks.startWorkflow).toHaveBeenNthCalledWith(2, {
      projectId: "project-1",
      workflowId: "osint-research",
      options: {
        targetUrls: ["https://competitor.example"],
        maxUrls: 12,
      },
    });
    expect(
      await screen.findByText(/Public-web OSINT dossier queued/i),
    ).toBeInTheDocument();
  });

  it("keeps OSINT off for a private primary site even when the audit is authorized", async () => {
    const user = userEvent.setup();
    render(<WizardPage />);
    await user.type(screen.getByLabelText("Brand name"), "Local Acme");
    await user.type(
      screen.getByRole("textbox", { name: /^Website/u }),
      "127.0.0.1:4501",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Where else does the brand live?");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Who are you measured against?");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Connect your data");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Ready to run");

    const osint = screen.getByRole("checkbox", {
      name: /Include the public-web OSINT dossier/i,
    });
    expect(osint).toBeDisabled();
    expect(
      screen.getByText(/OSINT stays off for 127\.0\.0\.1/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Start the first runs" }),
    );
    await waitFor(() => expect(mocks.startAudit).toHaveBeenCalled());
    expect(mocks.startWorkflow).not.toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "osint-research" }),
    );
  });
});
