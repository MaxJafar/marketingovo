import { describe, expect, it, vi } from "vitest";
import {
  createSafeProviderFetch,
  isBlockedProviderAddress,
  resolvePublicProviderAddresses,
  safeGoogleOAuthFetch,
  type ProviderAddress,
  type ProviderDnsResolver,
  type ProviderTransport,
} from "./provider-fetch.js";

const PUBLIC_V4: ProviderAddress = { address: "8.8.8.8", family: 4 };

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("provider address policy", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "100.100.100.200",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2002:0808:0808::1",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedProviderAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2607:f8b0:4005:805::200e"])(
    "allows globally routable address %s",
    (address) => {
      expect(isBlockedProviderAddress(address)).toBe(false);
    },
  );

  it("rejects a mixed public/private DNS answer instead of selecting the public entry", async () => {
    await expect(
      resolvePublicProviderAddresses("api.example.test", async () => [
        PUBLIC_V4,
        { address: "169.254.169.254", family: 4 },
      ]),
    ).rejects.toMatchObject({
      code: "address_blocked",
    });
  });

  it("rejects empty, malformed, and family-confused DNS answers", async () => {
    await expect(
      resolvePublicProviderAddresses("api.example.test", async () => []),
    ).rejects.toMatchObject({ code: "dns_failed" });
    await expect(
      resolvePublicProviderAddresses("api.example.test", async () => [
        { address: "not-an-ip", family: 4 },
      ]),
    ).rejects.toMatchObject({ code: "address_blocked" });
    await expect(
      resolvePublicProviderAddresses("api.example.test", async () => [
        { address: "8.8.8.8", family: 6 },
      ]),
    ).rejects.toMatchObject({ code: "address_blocked" });
  });
});

describe("exact-host provider fetch", () => {
  it("keeps the OAuth transport narrower than the connector host union", async () => {
    await expect(
      safeGoogleOAuthFetch("https://accounts.google.com/o/oauth2/v2/auth"),
    ).rejects.toMatchObject({ code: "endpoint_not_allowed" });
  });

  it("pins a validated address while preserving the HTTPS hostname and forcing redirect errors", async () => {
    const pins: Array<{ hostname: string; address: ProviderAddress }> = [];
    const transport = vi.fn<ProviderTransport>(async (input, init) => {
      expect(init.dispatcher).toBeDefined();
      expect(init.redirect).toBe("error");
      expect(String(input)).toBe("https://api.example.test/v1?q=safe");
      return jsonResponse({ ok: true });
    });
    const safeFetch = createSafeProviderFetch({
      allowedHosts: ["api.example.test"],
      resolver: async () => [PUBLIC_V4],
      transport,
      onAddressPinned: (hostname, address) => pins.push({ hostname, address }),
    });

    try {
      const response = await safeFetch("https://api.example.test/v1?q=safe", {
        redirect: "follow",
      });
      expect(response.ok).toBe(true);
      expect(transport).toHaveBeenCalledOnce();
      expect(pins).toEqual([
        { hostname: "api.example.test", address: PUBLIC_V4 },
      ]);
    } finally {
      await safeFetch.close();
    }
  });

  it.each([
    "http://api.example.test/v1",
    "https://api.example.test:444/v1",
    "https://user:password@api.example.test/v1",
    "https://api.example.test./v1",
    "https://api.example.test.evil.invalid/v1",
    "https://sub.api.example.test/v1",
    "https://127.0.0.1/v1",
  ])("rejects endpoint outside the exact HTTPS policy: %s", async (url) => {
    const transport = vi.fn<ProviderTransport>(async () => jsonResponse({}));
    const safeFetch = createSafeProviderFetch({
      allowedHosts: ["api.example.test"],
      resolver: async () => [PUBLIC_V4],
      transport,
    });
    try {
      await expect(safeFetch(url)).rejects.toMatchObject({
        code: "endpoint_not_allowed",
      });
      expect(transport).not.toHaveBeenCalled();
    } finally {
      await safeFetch.close();
    }
  });

  it("rejects a caller-supplied Host header", async () => {
    const transport = vi.fn<ProviderTransport>(async () => jsonResponse({}));
    const safeFetch = createSafeProviderFetch({
      allowedHosts: ["api.example.test"],
      resolver: async () => [PUBLIC_V4],
      transport,
    });
    try {
      await expect(
        safeFetch("https://api.example.test/v1", {
          headers: { host: "169.254.169.254" },
        }),
      ).rejects.toMatchObject({ code: "endpoint_not_allowed" });
      expect(transport).not.toHaveBeenCalled();
    } finally {
      await safeFetch.close();
    }
  });

  it("resolves every call and blocks a DNS-rebinding answer before transport", async () => {
    let resolution = 0;
    const resolver: ProviderDnsResolver = async () => {
      resolution += 1;
      return resolution === 1
        ? [PUBLIC_V4]
        : [{ address: "127.0.0.1", family: 4 }];
    };
    const transport = vi.fn<ProviderTransport>(async () =>
      jsonResponse({ ok: true }),
    );
    const safeFetch = createSafeProviderFetch({
      allowedHosts: ["api.example.test"],
      resolver,
      transport,
    });

    try {
      await expect(
        safeFetch("https://api.example.test/v1"),
      ).resolves.toHaveProperty("status", 200);
      await expect(
        safeFetch("https://api.example.test/v1"),
      ).rejects.toMatchObject({ code: "address_blocked" });
      expect(resolution).toBe(2);
      expect(transport).toHaveBeenCalledOnce();
    } finally {
      await safeFetch.close();
    }
  });

  it("rejects redirect responses defensively even when an injected transport returns one", async () => {
    const safeFetch = createSafeProviderFetch({
      allowedHosts: ["api.example.test"],
      resolver: async () => [PUBLIC_V4],
      transport: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.invalid/steal" },
        }),
    });

    try {
      await expect(
        safeFetch("https://api.example.test/oauth", {
          headers: { authorization: "Bearer secret" },
        }),
      ).rejects.toMatchObject({ code: "redirect_blocked" });
    } finally {
      await safeFetch.close();
    }
  });
});
