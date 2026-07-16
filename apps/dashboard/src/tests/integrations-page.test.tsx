import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveCredentials: vi.fn(),
  refetch: vi.fn(),
  removeIntegration: vi.fn(),
  testIntegration: vi.fn(),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../components/golemworkers-link-card", () => ({
  GolemWorkersLinkCard: () => null,
}));

vi.mock("../api/queries", () => ({
  useIntegrations: () => ({
    data: {
      data: {
        items: [
          {
            id: "pagespeed-insights",
            name: "PageSpeed Insights",
            category: "Data source",
            status: "not_configured",
            description: "CrUX, Lighthouse and Core Web Vitals",
            accountLabel: null,
            lastSyncAt: null,
            quota: null,
            lastError: null,
            permissions: [],
            supportsApiKey: true,
            setupUrl: null,
            credentialFields: [
              {
                key: "apiKey",
                label: "API key (optional)",
                type: "secret",
                required: false,
              },
            ],
            configuration: {},
            configurationFields: [],
          },
          {
            id: "serpapi",
            name: "SerpAPI",
            category: "Data source",
            status: "connected",
            description: "Search results",
            accountLabel: "se•••ey",
            lastSyncAt: "2026-07-16T08:00:00.000Z",
            quota: null,
            lastError: null,
            permissions: [],
            supportsApiKey: true,
            setupUrl: null,
            credentialFields: [
              {
                key: "apiKey",
                label: "API key",
                type: "secret",
                required: true,
              },
            ],
            configuration: {},
            configurationFields: [],
          },
        ],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useSaveIntegrationCredentials: () => ({
    mutate: mocks.saveCredentials,
    isPending: false,
    isError: false,
    error: null,
  }),
  useSaveIntegrationConfiguration: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useRemoveIntegration: () => ({
    mutate: mocks.removeIntegration,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
  useTestIntegration: () => ({
    mutate: mocks.testIntegration,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import { IntegrationsPage } from "../pages/integrations";

describe("IntegrationsPage optional credentials", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets PageSpeed use public quota without submitting an empty secret", async () => {
    const user = userEvent.setup();
    render(<IntegrationsPage />);

    await user.click(
      screen.getByRole("button", { name: "Add optional API key" }),
    );
    const apiKey = screen.getByLabelText(/API key \(optional\)/u);
    expect(apiKey).not.toBeRequired();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(mocks.saveCredentials).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Add optional API key" }),
    ).toBeInTheDocument();
  });

  it("stores a supplied PageSpeed key through the write-only mutation", async () => {
    const user = userEvent.setup();
    render(<IntegrationsPage />);

    await user.click(
      screen.getByRole("button", { name: "Add optional API key" }),
    );
    await user.type(
      screen.getByLabelText(/API key \(optional\)/u),
      "optional-pagespeed-key",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(mocks.saveCredentials).toHaveBeenCalledWith(
      {
        integrationId: "pagespeed-insights",
        credentials: { apiKey: "optional-pagespeed-key" },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("requires an explicit acknowledgement before deleting a shared local credential", async () => {
    const user = userEvent.setup();
    render(<IntegrationsPage />);

    await user.click(
      screen.getByRole("button", {
        name: "Revoke SerpAPI local access",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Revoke local access to SerpAPI",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot deactivate an API key or OAuth grant/u),
    ).toBeInTheDocument();

    const removeButton = screen.getByRole("button", {
      name: "Remove local credential",
    });
    expect(removeButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /disconnects SerpAPI across every local project/u,
      }),
    );
    await user.click(removeButton);

    expect(mocks.removeIntegration).toHaveBeenCalledWith(
      "serpapi",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
