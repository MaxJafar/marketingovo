import { describe, expect, it } from "vitest";
import { withProtocol } from "../pages/wizard";

// A bare host is what people actually type. https is right for a real domain
// and wrong for loopback, where forcing TLS produces a connection failure the
// setup form gives the user no way to diagnose.
describe("scheme defaulting during setup", () => {
  it("assumes https for a real domain", () => {
    expect(withProtocol("acme.example")).toBe("https://acme.example");
    expect(withProtocol("www.acme.example/shop")).toBe(
      "https://www.acme.example/shop",
    );
  });

  it("assumes http for loopback, which rarely speaks TLS", () => {
    expect(withProtocol("127.0.0.1:4501")).toBe("http://127.0.0.1:4501");
    expect(withProtocol("localhost:3000")).toBe("http://localhost:3000");
  });

  it("never overrides a scheme the user typed", () => {
    expect(withProtocol("http://acme.example")).toBe("http://acme.example");
    expect(withProtocol("https://localhost:8443")).toBe(
      "https://localhost:8443",
    );
  });

  it("returns empty for blank input rather than a bare scheme", () => {
    expect(withProtocol("   ")).toBe("");
  });
});
