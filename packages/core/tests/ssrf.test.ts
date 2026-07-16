import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIp,
  isCloudMetadataIp,
  UnsafeUrlError,
  resolveSafeAddresses,
  resolveSafeEgressTarget,
} from "../src/core/safe-url.js";

describe("normalizeUrl", () => {
  it("accepts http and https", () => {
    expect(normalizeUrl("https://example.com/").href).toContain("example.com");
    expect(normalizeUrl("http://example.com/path").href).toContain("/path");
  });

  it("rejects non-http schemes", () => {
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("ftp://example.com/")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("gopher://example.com/")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("jar:http://example.com/!/x")).toThrow(
      UnsafeUrlError,
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => normalizeUrl("not a url")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("")).toThrow(UnsafeUrlError);
  });

  it("strips default ports", () => {
    const a = normalizeUrl("https://example.com:443/x");
    const b = normalizeUrl("https://example.com/x");
    expect(a.href).toBe(b.href);
  });

  it("drops fragments because they do not identify a different HTTP fetch", () => {
    expect(normalizeUrl("https://example.com/page#details").href).toBe(
      "https://example.com/page",
    );
  });
});

describe("isPrivateIPv4", () => {
  const cases: Array<[string, boolean]> = [
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["127.0.0.1", true],
    ["127.255.255.254", true],
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.32.0.1", false],
    ["192.168.0.1", true],
    ["192.169.0.1", false],
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["100.127.255.254", true],
    ["0.0.0.0", true],
    ["224.0.0.1", true],
    ["255.255.255.255", true],
    ["198.18.0.1", true],
    ["198.51.100.1", true],
    ["203.0.113.1", true],
  ];
  for (const [ip, expected] of cases) {
    it(`${ip} -> ${expected}`, () => {
      expect(isPrivateIPv4(ip)).toBe(expected);
    });
  }

  it("treats malformed IPv4 as private", () => {
    expect(isPrivateIPv4("999.0.0.1")).toBe(true);
    expect(isPrivateIPv4("1.2.3")).toBe(true);
  });
});

describe("isPrivateIPv6", () => {
  it("blocks loopback and link-local", () => {
    expect(isPrivateIPv6("::1")).toBe(true);
    expect(isPrivateIPv6("fe80::1")).toBe(true);
  });
  it("blocks unique-local fc00::/7", () => {
    expect(isPrivateIPv6("fc00::1")).toBe(true);
    expect(isPrivateIPv6("fd00::1")).toBe(true);
  });
  it("blocks multicast", () => {
    expect(isPrivateIPv6("ff02::1")).toBe(true);
  });
  it("blocks IPv4-mapped private", () => {
    expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIPv6("::ffff:10.0.0.1")).toBe(true);
  });
});

describe("isPrivateIp", () => {
  it("dispatches by family", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("cloud metadata denylist", () => {
  it("recognizes common IPv4, mapped IPv4, and IPv6 metadata addresses", () => {
    expect(isCloudMetadataIp("169.254.169.254")).toBe(true);
    expect(isCloudMetadataIp("::ffff:169.254.169.254")).toBe(true);
    expect(isCloudMetadataIp("100.100.100.200")).toBe(true);
    expect(isCloudMetadataIp("fd00:ec2::254")).toBe(true);
    expect(isCloudMetadataIp("127.0.0.1")).toBe(false);
  });

  it("blocks metadata even when private-site crawling is enabled", async () => {
    await expect(resolveSafeAddresses("169.254.169.254", true)).rejects.toThrow(
      /metadata/,
    );
    await expect(resolveSafeAddresses("100.100.100.200", true)).rejects.toThrow(
      /metadata/,
    );
    await expect(resolveSafeAddresses("fd00:ec2::254", true)).rejects.toThrow(
      /metadata/,
    );
  });
});

describe("resolveSafeAddresses", () => {
  it("validates IP literal input", async () => {
    await expect(resolveSafeAddresses("127.0.0.1", false)).rejects.toThrow(
      /private/,
    );
    await expect(resolveSafeAddresses("8.8.8.8", false)).resolves.toEqual([
      { address: "8.8.8.8", family: 4 },
    ]);
  });

  it("rejects private DNS for public hostnames when allowPrivate=false", async () => {
    // localhost resolves to 127.0.0.1 in any normal environment.
    await expect(resolveSafeAddresses("localhost", false)).rejects.toThrow(
      /private|DNS/,
    );
  });

  it("allows private addresses when explicitly enabled", async () => {
    const result = await resolveSafeAddresses("127.0.0.1", true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.address).toBe("127.0.0.1");
  });

  it("fails closed on DNS resolution errors", async () => {
    await expect(
      resolveSafeAddresses("this-host-should-not-exist.invalid", false),
    ).rejects.toThrow(/resolution/);
  });

  it("strips port from host before IP/DNS check", async () => {
    // Regression: a raw host string with a port must not trigger DNS
    // lookup against "127.0.0.1:8080" (ENOTFOUND leak).
    await expect(resolveSafeAddresses("127.0.0.1:8080", false)).rejects.toThrow(
      /private|loopback/,
    );
    await expect(resolveSafeAddresses("127.0.0.1:8080", true)).resolves.toEqual(
      [{ address: "127.0.0.1", family: 4 }],
    );
  });
});

describe("resolveSafeEgressTarget", () => {
  it("combines scheme validation, DNS/IP validation, and normalization", async () => {
    await expect(
      resolveSafeEgressTarget("http://127.0.0.1:8080/x", false),
    ).rejects.toThrow(/private|loopback/);
    await expect(
      resolveSafeEgressTarget("http://127.0.0.1:8080/x", true),
    ).resolves.toMatchObject({
      url: { href: "http://127.0.0.1:8080/x" },
    });
    await expect(
      resolveSafeEgressTarget("file:///etc/passwd", true),
    ).rejects.toThrow(/scheme/);
  });
});
