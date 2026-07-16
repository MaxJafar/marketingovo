import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { previewMutate, updateMutate, extractionWorkspace } = vi.hoisted(() => ({
  previewMutate: vi.fn(),
  updateMutate: vi.fn(),
  extractionWorkspace: {
    projectId: "project-1",
    revision: 3,
    rules: [
      {
        id: "price-rule",
        label: "Price",
        selector: ".price",
        type: "text" as const,
        attribute: null,
        regex: null,
        enabled: true,
      },
    ],
  },
}));

vi.mock("../api/queries", () => ({
  useExtractionRuleTemplates: () => ({
    data: {
      data: {
        version: "extraction-template-catalog-v1",
        importMode: "review_required",
        templates: [
          {
            id: "social-preview-meta",
            name: "Social preview metadata",
            category: "social",
            description: "Capture shared-link preview fields.",
            recommendedPage: "A representative landing page.",
            assumptions: [
              "The page emits standard meta tags.",
              "Preview representative templates before saving.",
            ],
            rules: [
              {
                id: "social-og-title",
                label: "Open Graph title",
                selector: "meta[property='og:title']",
                type: "attribute",
                attribute: "content",
                regex: null,
                enabled: true,
              },
              {
                id: "social-og-image",
                label: "Open Graph image",
                selector: "meta[property='og:image']",
                type: "attribute",
                attribute: "content",
                regex: null,
                enabled: true,
              },
            ],
          },
          {
            id: "conflicting-price",
            name: "Price field",
            category: "commerce",
            description: "Capture a price.",
            recommendedPage: "A product page.",
            assumptions: ["The selector matches a visible price."],
            rules: [
              {
                id: "template-price",
                label: "Price",
                selector: ".price",
                type: "text",
                attribute: null,
                regex: null,
                enabled: true,
              },
            ],
          },
        ],
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useExtractionRules: () => ({
    data: {
      data: {
        projectId: extractionWorkspace.projectId,
        current: {
          projectId: extractionWorkspace.projectId,
          revision: extractionWorkspace.revision,
          configurationHash: "a".repeat(64),
          rules: extractionWorkspace.rules,
          changeSummary: "Capture price",
          actor: "local-user",
          createdAt: "2026-07-15T12:00:00.000Z",
        },
        history: [],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
  }),
  useUpdateExtractionRules: () => ({
    mutate: updateMutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  usePreviewExtractionRules: () => ({
    mutate: previewMutate,
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
}));

import { ExtractionRulesCard } from "../components/extraction-rules-card";

describe("Custom extraction rule editor", () => {
  afterEach(() => {
    cleanup();
    previewMutate.mockReset();
    updateMutate.mockReset();
    extractionWorkspace.projectId = "project-1";
    extractionWorkspace.revision = 3;
    extractionWorkspace.rules = [
      {
        id: "price-rule",
        label: "Price",
        selector: ".price",
        type: "text",
        attribute: null,
        regex: null,
        enabled: true,
      },
    ];
  });

  it("keeps draft preview separate from versioned persistence", async () => {
    const user = userEvent.setup();
    render(
      <ExtractionRulesCard siteId="project-1" siteUrl="https://example.com/" />,
    );

    expect(screen.getByLabelText("Current rule set")).toHaveTextContent(
      "Revision 3",
    );
    expect(
      screen.getByText(/Draft rules are never saved by previewing/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Add rule" })).toBeEnabled();
    const selector = await screen.findByLabelText("CSS selector");
    fireEvent.change(selector, { target: { value: "[itemprop='price']" } });
    await user.clear(screen.getByLabelText("Page URL"));
    await user.type(
      screen.getByLabelText("Page URL"),
      "https://example.com/product",
    );
    await user.click(screen.getByRole("button", { name: "Preview draft" }));

    expect(previewMutate).toHaveBeenCalledWith({
      url: "https://example.com/product",
      renderMode: "static",
      allowPrivateHost: false,
      rules: [
        expect.objectContaining({
          id: "price-rule",
          selector: "[itemprop='price']",
        }),
      ],
    });
    expect(updateMutate).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Revision summary"),
      "Use product schema price",
    );
    await user.click(screen.getByRole("button", { name: "Save revision" }));
    expect(updateMutate).toHaveBeenCalledWith({
      changeSummary: "Use product schema price",
      rules: [expect.objectContaining({ selector: "[itemprop='price']" })],
    });
  });

  it("requires field review and imports a template only into the unsaved draft", async () => {
    const user = userEvent.setup();
    render(
      <ExtractionRulesCard siteId="project-1" siteUrl="https://example.com/" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Review Social preview metadata" }),
    );
    expect(
      screen.getByRole("table", { name: "Social preview metadata fields" }),
    ).toHaveTextContent("meta[property='og:title']");
    expect(screen.getByText("Assumptions to verify")).toBeVisible();
    expect(screen.getByText(/Templates never write a revision/i)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Add 2 fields to draft" }),
    );
    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Template added to draft")).toBeVisible();

    await user.type(
      screen.getByLabelText("Revision summary"),
      "Add social preview evidence",
    );
    await user.click(screen.getByRole("button", { name: "Save revision" }));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const saved = updateMutate.mock.calls[0]?.[0] as {
      changeSummary: string;
      rules: Array<{ id: string; label: string }>;
    };
    expect(saved.changeSummary).toBe("Add social preview evidence");
    expect(saved.rules.map((rule) => rule.label)).toEqual([
      "Price",
      "Open Graph title",
      "Open Graph image",
    ]);
    expect(saved.rules[1]?.id).not.toBe("social-og-title");
    expect(saved.rules[2]?.id).not.toBe("social-og-image");
  });

  it("blocks a template whose field label already exists in the draft", async () => {
    const user = userEvent.setup();
    render(
      <ExtractionRulesCard siteId="project-1" siteUrl="https://example.com/" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Review Price field" }),
    );
    expect(screen.getByText("Resolve field conflicts")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add 1 field to draft" }),
    ).toBeDisabled();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("does not expose a stale draft when two projects share a revision number", async () => {
    const user = userEvent.setup();
    const view = render(
      <ExtractionRulesCard siteId="project-1" siteUrl="https://one.example/" />,
    );
    const label = await screen.findByLabelText("Field label");
    await user.clear(label);
    await user.type(label, "Unsaved project one draft");

    extractionWorkspace.projectId = "project-2";
    extractionWorkspace.rules = [
      {
        id: "author-rule",
        label: "Author",
        selector: ".author",
        type: "text",
        attribute: null,
        regex: null,
        enabled: true,
      },
    ];
    view.rerender(
      <ExtractionRulesCard siteId="project-2" siteUrl="https://two.example/" />,
    );

    expect(await screen.findByDisplayValue("Author")).toBeVisible();
    expect(screen.queryByDisplayValue("Unsaved project one draft")).toBeNull();
  });
});
