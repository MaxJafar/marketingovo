import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { deleteMutate } = vi.hoisted(() => ({ deleteMutate: vi.fn() }));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1", setSiteId: vi.fn() }),
}));

vi.mock("../api/queries", () => ({
  useSettings: () => ({
    data: {
      data: {
        siteName: "Example",
        siteUrl: "https://example.com",
        timezone: "UTC",
      },
      meta: { state: "fresh" },
    },
    dataUpdatedAt: 1,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateSettings: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  useExportProject: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useImportProject: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  useDeleteProject: () => ({
    mutate: deleteMutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  useExtractionRules: () => ({
    data: {
      data: { projectId: "project-1", current: null, history: [] },
      meta: { state: "missing" },
    },
    isLoading: false,
    error: null,
  }),
  useExtractionRuleTemplates: () => ({
    data: {
      data: { templates: [] },
      meta: { state: "fresh" },
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUpdateExtractionRules: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  usePreviewExtractionRules: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
}));

import { SettingsPage } from "../pages/settings";

describe("Project import control", () => {
  afterEach(cleanup);

  it("gives the hidden file input an accessible label and a visible-focus wrapper", () => {
    render(<SettingsPage />);

    const input = screen.getByLabelText("Import project");
    input.focus();

    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(
      /Imports always create a new local project/i,
    );
    expect(input.closest("label")).toHaveClass("project-import-label");
  });

  it("requires an exact project-name confirmation before permanent deletion", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete project" }));
    const confirmation = screen.getByLabelText(
      "Type the project name to confirm",
    );
    const submit = screen.getByRole("button", {
      name: "Permanently delete project",
    });

    expect(confirmation).toHaveAccessibleDescription(
      /Enter Example exactly\. This action cannot be undone/u,
    );
    expect(submit).toBeDisabled();
    await user.type(confirmation, "example");
    expect(submit).toBeDisabled();
    await user.clear(confirmation);
    await user.type(confirmation, "Example");
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(deleteMutate).toHaveBeenCalledWith("Example", expect.any(Object));
  });
});
