import { describe, expect, it } from "vitest";
import { safeExternalUrl, safeSameOriginUrl } from "../components/ui";

describe("dashboard URL safety", () => {
  it("permits explicit web links but keeps authenticated downloads same-origin", () => {
    expect(safeExternalUrl("https://provider.example/setup")).toBe(
      "https://provider.example/setup",
    );
    expect(
      safeSameOriginUrl("https://provider.example/report"),
    ).toBeUndefined();
    expect(safeSameOriginUrl("/api/v1/runs/run-1/report?format=pdf")).toBe(
      `${window.location.origin}/api/v1/runs/run-1/report?format=pdf`,
    );
  });

  it("rejects executable and malformed URL schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeSameOriginUrl("data:text/html,unsafe")).toBeUndefined();
  });
});
