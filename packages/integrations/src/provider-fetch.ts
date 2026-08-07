import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { connectorEgressHosts } from "./egress.js";

/** A DNS answer that has been validated before it can reach a socket. */
export interface ProviderAddress {
  address: string;
  family: 4 | 6;
}

export type ProviderDnsResolver = (
  hostname: string,
) => Promise<readonly ProviderAddress[]>;

type PinnedRequestInit = RequestInit & { dispatcher: Dispatcher };

export type ProviderTransport = (
  input: Parameters<typeof fetch>[0],
  init: PinnedRequestInit,
) => Promise<Response>;

export type SafeProviderFetch = typeof fetch & {
  /** Closes cached provider connections. Primarily useful for short-lived tools. */
  close(): Promise<void>;
};

export interface SafeProviderFetchOptions {
  /** Exact DNS names. Wildcards and suffix matching are intentionally unsupported. */
  allowedHosts?: readonly string[];
  /** Test seam. Production callers should use the system resolver. */
  resolver?: ProviderDnsResolver;
  /** Test seam below the policy and DNS-pinning layers. */
  transport?: ProviderTransport;
  /** Optional diagnostic hook; receives no URL, query, headers, or credentials. */
  onAddressPinned?: (hostname: string, address: ProviderAddress) => void;
  maxCachedDispatchers?: number;
}

export type ProviderEgressErrorCode =
  | "endpoint_not_allowed"
  | "dns_failed"
  | "address_blocked"
  | "redirect_blocked";

export class ProviderEgressError extends Error {
  readonly code: ProviderEgressErrorCode;

  constructor(code: ProviderEgressErrorCode, message: string) {
    super(message);
    this.name = "ProviderEgressError";
    this.code = code;
  }
}

const DEFAULT_MAX_DISPATCHERS = 32;
const REDIRECT_STATUSES = new Set([300, 301, 302, 303, 305, 307, 308]);

export const allConnectorEgressHosts = Object.freeze([
  ...new Set(Object.values(connectorEgressHosts).flat()),
]);

function parseIpv4(address: string): [number, number, number, number] | null {
  const octets = address.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some(
      (value, index) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255 ||
        String(value) !== address.split(".")[index],
    )
  ) {
    return null;
  }
  return octets as [number, number, number, number];
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;

  // Unspecified, private, loopback, CGNAT, link-local, documentation,
  // benchmarking, multicast and reserved address space.
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function parseIpv6(address: string): readonly number[] | null {
  if (address.includes("%") || address.split("::").length > 2) return null;
  let source = address.toLowerCase();

  if (source.includes(".")) {
    const lastColon = source.lastIndexOf(":");
    if (lastColon < 0) return null;
    const ipv4 = parseIpv4(source.slice(lastColon + 1));
    if (!ipv4) return null;
    source = `${source.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const hasCompression = source.includes("::");
  const [leftRaw = "", rightRaw = ""] = source.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = hasCompression && rightRaw ? rightRaw.split(":") : [];
  if (!hasCompression && left.length !== 8) return null;
  if (hasCompression && left.length + right.length >= 8) return null;

  const missing = hasCompression ? 8 - left.length - right.length : 0;
  const parts = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (
    parts.length !== 8 ||
    parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))
  ) {
    return null;
  }
  return parts.map((part) => Number.parseInt(part, 16));
}

function isBlockedIpv6(address: string): boolean {
  const words = parseIpv6(address);
  if (!words) return true;

  const ipv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  // Reject the mapped form itself, even when the embedded IPv4 address is
  // public. This prevents parser/normalization disagreements between layers.
  if (ipv4Mapped) return true;

  const first = words[0] ?? 0;
  const second = words[1] ?? 0;

  // Only globally routable 2000::/3 addresses are eligible. Explicitly
  // reject Teredo and documentation space even though both sit in /3.
  if ((first & 0xe000) !== 0x2000) return true;
  if (first === 0x2001 && (second === 0 || second === 0x0db8)) return true;
  if (first === 0x2002) return true; // 6to4 embeds an IPv4 destination.
  return false;
}

export function isBlockedProviderAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

export const systemProviderDnsResolver: ProviderDnsResolver = async (
  hostname,
) => {
  try {
    const results = await dnsLookup(hostname, { all: true, verbatim: true });
    return results.map(({ address, family }) => ({
      address,
      family: family as 4 | 6,
    }));
  } catch {
    // DNS implementation details are intentionally not copied into logs that
    // may also contain request context.
    throw new ProviderEgressError(
      "dns_failed",
      `DNS resolution failed for approved provider host ${hostname}`,
    );
  }
};

export async function resolvePublicProviderAddresses(
  hostname: string,
  resolver: ProviderDnsResolver = systemProviderDnsResolver,
): Promise<readonly ProviderAddress[]> {
  let results: readonly ProviderAddress[];
  try {
    results = await resolver(hostname);
  } catch (error) {
    if (error instanceof ProviderEgressError) throw error;
    throw new ProviderEgressError(
      "dns_failed",
      `DNS resolution failed for approved provider host ${hostname}`,
    );
  }
  if (results.length === 0) {
    throw new ProviderEgressError(
      "dns_failed",
      `DNS returned no addresses for approved provider host ${hostname}`,
    );
  }

  const unique = new Map<string, ProviderAddress>();
  for (const result of results) {
    const actualFamily = isIP(result.address);
    if (
      (actualFamily !== 4 && actualFamily !== 6) ||
      actualFamily !== result.family ||
      isBlockedProviderAddress(result.address)
    ) {
      throw new ProviderEgressError(
        "address_blocked",
        `Provider DNS returned a non-public address for ${hostname}`,
      );
    }
    unique.set(`${actualFamily}:${result.address}`, {
      address: result.address,
      family: actualFamily,
    });
  }
  return [...unique.values()];
}

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
  try {
    if (typeof input === "string") return new URL(input);
    if (input instanceof URL) return new URL(input.toString());
    return new URL(input.url);
  } catch {
    throw new ProviderEgressError(
      "endpoint_not_allowed",
      "Provider endpoint URL is invalid",
    );
  }
}

function normalizedHostSet(hosts: readonly string[]): ReadonlySet<string> {
  const normalized = new Set<string>();
  for (const host of hosts) {
    const value = host.trim().toLowerCase();
    if (
      !value ||
      value.endsWith(".") ||
      value.includes("*") ||
      value.includes(":") ||
      isIP(value)
    ) {
      throw new TypeError(`Invalid exact provider host: ${host}`);
    }
    normalized.add(value);
  }
  if (normalized.size === 0) {
    throw new TypeError("At least one exact provider host is required");
  }
  return normalized;
}

function hasForbiddenHostHeader(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): boolean {
  const inputHeaders =
    typeof input !== "string" && !(input instanceof URL)
      ? new Headers(input.headers)
      : new Headers();
  const overrideHeaders = new Headers(init?.headers);
  return inputHeaders.has("host") || overrideHeaders.has("host");
}

const defaultProviderTransport: ProviderTransport = async (input, init) =>
  (await undiciFetch(input as never, init as never)) as unknown as Response;

/**
 * Creates an HTTPS-only fetch that resolves and validates DNS for every call,
 * then pins the validated address in Undici's socket lookup while preserving
 * the original hostname for TLS certificate verification and SNI.
 */
export function createSafeProviderFetch(
  options: SafeProviderFetchOptions = {},
): SafeProviderFetch {
  const allowedHosts = normalizedHostSet(
    options.allowedHosts ?? allConnectorEgressHosts,
  );
  const resolver = options.resolver ?? systemProviderDnsResolver;
  const transport = options.transport ?? defaultProviderTransport;
  const requestedMax = options.maxCachedDispatchers ?? DEFAULT_MAX_DISPATCHERS;
  const maxDispatchers = Number.isInteger(requestedMax)
    ? Math.max(1, Math.min(128, requestedMax))
    : DEFAULT_MAX_DISPATCHERS;
  const dispatchers = new Map<string, Agent>();

  const getDispatcher = (hostname: string, address: ProviderAddress): Agent => {
    const key = `${hostname}|${address.family}|${address.address}`;
    const existing = dispatchers.get(key);
    if (existing) return existing;

    const dispatcher = new Agent({
      connect: {
        autoSelectFamily: false,
        // The URL hostname is deliberately left untouched. This callback only
        // chooses the socket address, so TLS still verifies/SNI-routes the exact
        // provider DNS name.
        lookup: ((
          _hostname: string,
          lookupOptions: { all?: boolean },
          callback: (...args: unknown[]) => void,
        ) => {
          if (lookupOptions.all) {
            callback(null, [address]);
          } else {
            callback(null, address.address, address.family);
          }
        }) as never,
      },
      pipelining: 1,
    });
    if (dispatchers.size >= maxDispatchers) {
      const oldest = dispatchers.keys().next().value as string | undefined;
      if (oldest) {
        const evicted = dispatchers.get(oldest);
        dispatchers.delete(oldest);
        if (evicted) void evicted.close();
      }
    }
    dispatchers.set(key, dispatcher);
    return dispatcher;
  };

  const safeFetch = (async (input, init) => {
    const url = requestUrl(input);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (url.port !== "" && url.port !== "443") ||
      url.username ||
      url.password ||
      hostname.endsWith(".") ||
      !allowedHosts.has(hostname) ||
      hasForbiddenHostHeader(input, init)
    ) {
      throw new ProviderEgressError(
        "endpoint_not_allowed",
        "Provider request is outside the exact HTTPS egress policy",
      );
    }

    // DNS is intentionally resolved on every call, even when a dispatcher for
    // a previous address is cached. A rebinding answer therefore fails policy
    // before any cached connection can be selected.
    const addresses = await resolvePublicProviderAddresses(hostname, resolver);
    const address = addresses[0];
    if (!address) {
      throw new ProviderEgressError(
        "dns_failed",
        `DNS returned no addresses for approved provider host ${hostname}`,
      );
    }
    options.onAddressPinned?.(hostname, address);
    const dispatcher = getDispatcher(hostname, address);
    const response = await transport(input, {
      ...init,
      // Authorization, OAuth codes and API keys must never follow a redirect.
      redirect: "error",
      dispatcher,
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      void response.body?.cancel().catch(() => undefined);
      throw new ProviderEgressError(
        "redirect_blocked",
        "Provider redirects are not allowed",
      );
    }
    return response;
  }) as SafeProviderFetch;

  safeFetch.close = async () => {
    const agents = [...dispatchers.values()];
    dispatchers.clear();
    await Promise.all(agents.map(async (agent) => agent.close()));
  };
  return safeFetch;
}

/** Default exact-host transport for first-party connector endpoints. */
export const safeConnectorFetch = createSafeProviderFetch();

/** Narrower transport used by installed-app Google OAuth token exchange. */
export const safeGoogleOAuthFetch = createSafeProviderFetch({
  allowedHosts: ["oauth2.googleapis.com"],
});

export const safeGoogleSearchConsoleFetch = createSafeProviderFetch({
  allowedHosts: ["www.googleapis.com"],
});

export const safeGoogleAnalyticsFetch = createSafeProviderFetch({
  allowedHosts: ["analyticsdata.googleapis.com"],
});

export const safePageSpeedFetch = createSafeProviderFetch({
  allowedHosts: ["pagespeedonline.googleapis.com"],
});

/** Meta Marketing, Pages and Instagram reads all share one Graph host. */
export const safeMetaGraphFetch = createSafeProviderFetch({
  allowedHosts: ["graph.facebook.com"],
});

/**
 * Google Ads is queried with GAQL, so one host serves every read.
 *
 * Deliberately excludes `ads.google.com`: findings deep-link there for the
 * operator's browser to open, and the daemon must never follow one.
 */
export const safeGoogleAdsFetch = createSafeProviderFetch({
  allowedHosts: ["googleads.googleapis.com"],
});
