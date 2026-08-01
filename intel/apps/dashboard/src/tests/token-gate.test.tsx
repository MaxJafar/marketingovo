import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TokenGate } from "../components/TokenGate.js";

describe("TokenGate", () => {
  it("keeps the token masked and hands it to the in-memory client", async () => {
    const onUnlock = vi.fn();
    const user = userEvent.setup();
    render(<TokenGate onUnlock={onUnlock} />);
    const input = screen.getByLabelText("One-time dashboard ticket");
    expect(input).toHaveAttribute("type", "password");
    const ticket = "a".repeat(43);
    await user.type(input, ticket);
    await user.click(screen.getByRole("button", { name: "Enter workspace" }));
    expect(onUnlock).toHaveBeenCalledWith(ticket);
  });
});
