// URL safety: validation, normalization, and SSRF guard.
//
// Rules:
//   1. Only http: and https: schemes are accepted.
//   2. Hosts are resolved to IP(s); every resolved IP must be public.
//   3. loopback, private, link-local, multicast, reserved, and unspecified
//      ranges are blocked unless allowPrivate=true is passed.
//   4. To mitigate DNS rebinding, the caller can pass a "pin" function that
//      fetches by IP and validates Host header separately. The frontier is
//      expected to use the resolved IP at request time.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Ports whose well-known service is not a website. Deliberately a blocklist:
// an allowlist of 80/443 would refuse legitimate sites served on 8000 or 3000
// while adding nothing, since internal targets are already blocked by address.
const BLOCKED_PORTS = new Set([
  "22",
  "23",
  "25",
  "110",
  "143",
  "445",
  "465",
  "587",
  "993",
  "995",
  "1433",
  "1521",
  "3306",
  "3389",
  "5432",
  "5984",
  "6379",
  "7001",
  "8020",
  "9042",
  "9200",
  "9300",
  "11211",
  "27017",
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface NormalizedUrl {
  href: string;
  protocol: "http:" | "https:";
  host: string;
  port: string;
  path: string;
}

export function normalizeUrl(input: string): NormalizedUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError(`invalid URL: ${input}`);
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new UnsafeUrlError(`scheme not allowed: ${url.protocol}`);
  }
  if (!url.hostname) {
    throw new UnsafeUrlError("missing hostname");
  }
  // Credentials in a URL are sent to whatever the host resolves to and then
  // persist in stored evidence, reports and logs. A crawl target never needs
  // them, so they are refused rather than stripped: silently dropping them
  // would change which resource was fetched without saying so.
  if (url.username !== "" || url.password !== "") {
    throw new UnsafeUrlError("credentials must not travel in a crawl URL");
  }
  // Speaking HTTP to a well-known non-HTTP service port is almost never a
  // website. The private-address checks in resolveSafeAddresses already stop
  // the common internal targets; this closes the case of a *public* host that
  // exposes one of these services.
  if (url.port !== "" && BLOCKED_PORTS.has(url.port)) {
    throw new UnsafeUrlError(
      `port ${url.port} is a well-known non-HTTP service`,
    );
  }
  // Fragments never reach the HTTP server and must not create duplicate crawl
  // or verification entries for the same resource.
  url.hash = "";
  // Strip default ports so duplicate URLs collapse.
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (url.protocol === "https:" && port === "443") url.port = "";
  if (url.protocol === "http:" && port === "80") url.port = "";
  return {
    href: url.toString(),
    protocol: url.protocol as "http:" | "https:",
    host: url.host.toLowerCase(),
    port: url.port,
    path: url.pathname + url.search,
  };
}

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)
  ) {
    return true; // treat malformed as private to be safe
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // shared CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 88 && parts[2] === 99) return true; // 6to4 anycast
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true; // multicast / reserved
  if (a >= 240) return true; // reserved / broadcast
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped: check the embedded IPv4 part.
    const v4 = lower.slice("::ffff:".length);
    return isPrivateIPv4(v4);
  }
  // Treat anything outside 2000::/3 as potentially non-routable / private.
  if (!lower.startsWith("2") || lower.startsWith("2000:0:0:0:0:0:0:0")) {
    // 2000::/3 covers global unicast. Anything else (including "2000:0:...")
    // is non-global. Be strict: only the 2000::/3 prefix is allowed.
    if (lower.startsWith("2000:")) {
      // Need full prefix check. The first 3 bits must be 001.
      // 0x20 == 0b0010_0000. 2000::/3 means leading 3 bits "001".
      // Simple approximation: if first hex char '2', we are in /4 not /3.
      // For safety, treat "2" prefix as the only public block. The byte
      // after the first colon matters; this is a coarse check that errs
      // toward false positives (treats some public addresses as private),
      // which is the safe direction.
      const firstByte = Number.parseInt(lower.slice(0, 2), 16);
      const top3 = firstByte >> 5; // top 3 bits
      if (top3 !== 1) return true;
      return false;
    }
    return true;
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true; // unknown family treated as private
}

/** Addresses reserved by major cloud providers for instance metadata. */
export function isCloudMetadataIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, "");
  return (
    normalized === "169.254.169.254" ||
    normalized === "169.254.170.2" ||
    normalized === "100.100.100.200" ||
    normalized === "fd00:ec2::254"
  );
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface SafeEgressTarget {
  url: NormalizedUrl;
  addresses: ResolvedAddress[];
}

function hostnameOnly(host: string): string {
  const value = host.trim();
  if (isIP(value)) return value;
  // URL.host wraps IPv6 literals in brackets and may append a port.
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close > 0) return value.slice(1, close);
  }
  return value.replace(/:\d+$/, "");
}

/**
 * Normalizes a host for allowlist comparison: strips IPv6 brackets, a trailing
 * root dot, and case. Matches the renderer's normalization so a host authorized
 * for browser subresources is authorized here and nowhere else differs.
 */
function normalizeAllowlistHost(host: string): string {
  return host
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

/**
 * Decides whether a private address may be reached for this host.
 *
 * `allowPrivate` alone opens every private range, which is the right default
 * only for an operator who typed `--allow-private`. When a caller supplies an
 * allowlist it is naming the exact hosts it authorized, so anything else stays
 * blocked even though private access is nominally on. An empty or absent
 * allowlist preserves the older blanket behaviour.
 */
function privateAccessPermitted(
  hostOnly: string,
  allowPrivate: boolean,
  privateHostAllowlist: readonly string[] | undefined,
): boolean {
  if (!allowPrivate) return false;
  if (!privateHostAllowlist || privateHostAllowlist.length === 0) return true;
  const allowed = new Set(privateHostAllowlist.map(normalizeAllowlistHost));
  return allowed.has(normalizeAllowlistHost(hostOnly));
}

export async function resolveSafeAddresses(
  host: string,
  allowPrivate: boolean,
  privateHostAllowlist?: readonly string[],
): Promise<ResolvedAddress[]> {
  // Strip any port that may have been included in a raw host string.
  // URL parsing already does this, but a defensive call costs nothing.
  const hostOnly = hostnameOnly(host);
  const privateAllowed = privateAccessPermitted(
    hostOnly,
    allowPrivate,
    privateHostAllowlist,
  );
  // If host is already an IP literal, validate it directly.
  if (isIP(hostOnly)) {
    if (isCloudMetadataIp(hostOnly)) {
      throw new UnsafeUrlError(`cloud metadata address blocked: ${hostOnly}`);
    }
    if (!privateAllowed && isPrivateIp(hostOnly)) {
      throw new UnsafeUrlError(`private/loopback address blocked: ${hostOnly}`);
    }
    return [{ address: hostOnly, family: isIP(hostOnly) as 4 | 6 }];
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(hostOnly, { all: true, verbatim: true });
  } catch (err) {
    throw new UnsafeUrlError(
      `DNS resolution failed for ${hostOnly}: ${(err as Error).message}`,
    );
  }
  if (addrs.length === 0) {
    throw new UnsafeUrlError(`no addresses for host: ${hostOnly}`);
  }
  for (const a of addrs) {
    if (isCloudMetadataIp(a.address)) {
      throw new UnsafeUrlError(
        `cloud metadata address in DNS for ${hostOnly}: ${a.address}`,
      );
    }
    if (!privateAllowed && isPrivateIp(a.address)) {
      throw new UnsafeUrlError(
        `private/loopback address in DNS for ${hostOnly}: ${a.address}`,
      );
    }
  }
  return addrs.map((a) => ({ address: a.address, family: a.family as 4 | 6 }));
}

/**
 * Validate and resolve an outbound HTTP(S) target in one operation.
 * Call this for every initial request and redirect hop. Browser callers
 * must additionally apply it to every subresource request.
 */
export async function resolveSafeEgressTarget(
  rawUrl: string,
  allowPrivate = false,
  privateHostAllowlist?: readonly string[],
): Promise<SafeEgressTarget> {
  const url = normalizeUrl(rawUrl);
  const hostname = hostnameOnly(new URL(url.href).host);
  const addresses = await resolveSafeAddresses(
    hostname,
    allowPrivate,
    privateHostAllowlist,
  );
  return { url, addresses };
}

export function ensureSameHostOrAllowed(
  start: NormalizedUrl,
  next: NormalizedUrl,
  allowCrossHostRedirect: boolean,
): void {
  if (start.host === next.host) return;
  if (!allowCrossHostRedirect) {
    throw new UnsafeUrlError(
      `cross-host redirect blocked: ${start.host} -> ${next.host}`,
    );
  }
}
