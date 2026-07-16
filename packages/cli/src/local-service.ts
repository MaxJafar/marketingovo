import { join } from "node:path";
import { GolemSeoClient } from "@golem-seo/sdk";

export interface LocalServiceResolution<T> {
  dashboardUrl: string;
  service: T | null;
  reused: boolean;
}

export interface LocalServiceLifecycle<T> {
  findExisting(): Promise<string | null>;
  waitForExisting(): Promise<string | null>;
  start(): Promise<T>;
  issueDashboardUrl(service: T): Promise<string>;
  close(service: T): Promise<void>;
}

function localApiBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}/api/v1`;
}

export async function issueDashboardUrl(
  dataDirectory: string,
  port: number,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const client = await GolemSeoClient.fromTokenFile(
    join(dataDirectory, "service-token"),
    {
      baseUrl: localApiBaseUrl(port),
      fetch: fetchImpl,
      timeoutMs: 2_000,
    },
  );
  const ticket = await client.sessions.issueBootstrapToken();
  const expiresAt = Date.parse(ticket.expiresAt);
  if (
    !/^[A-Za-z0-9_-]{32,}$/.test(ticket.token) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    throw new Error(
      "The local service returned an invalid dashboard bootstrap ticket",
    );
  }
  return `http://127.0.0.1:${port}/#token=${encodeURIComponent(ticket.token)}`;
}

export async function findExistingDashboard(
  dataDirectory: string,
  port: number,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<string | null> {
  try {
    return await issueDashboardUrl(dataDirectory, port, fetchImpl);
  } catch {
    return null;
  }
}

export async function waitForExistingDashboard(
  dataDirectory: string,
  port: number,
  options: {
    attempts?: number;
    intervalMs?: number;
    fetch?: typeof globalThis.fetch;
    sleep?: (delayMs: number) => Promise<void>;
  } = {},
): Promise<string | null> {
  const attempts = Math.max(1, options.attempts ?? 20);
  const intervalMs = Math.max(0, options.intervalMs ?? 100);
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const dashboardUrl = await findExistingDashboard(
      dataDirectory,
      port,
      options.fetch,
    );
    if (dashboardUrl) return dashboardUrl;
    if (attempt + 1 < attempts) await sleep(intervalMs);
  }
  return null;
}

export function isAddressInUse(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (
      "code" in current &&
      (current as { code?: unknown }).code === "EADDRINUSE"
    )
      return true;
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

export async function startOrReuseLocalService<T>(
  lifecycle: LocalServiceLifecycle<T>,
): Promise<LocalServiceResolution<T>> {
  const existing = await lifecycle.findExisting();
  if (existing) return { dashboardUrl: existing, service: null, reused: true };

  let service: T | null = null;
  try {
    service = await lifecycle.start();
    const dashboardUrl = await lifecycle.issueDashboardUrl(service);
    return { dashboardUrl, service, reused: false };
  } catch (error) {
    if (service) await lifecycle.close(service).catch(() => undefined);
    if (!isAddressInUse(error)) throw error;
    const racedExisting = await lifecycle.waitForExisting();
    if (racedExisting)
      return { dashboardUrl: racedExisting, service: null, reused: true };
    throw new Error(
      "The local API port is occupied by a service that could not authenticate as this Golem SEO workspace",
      { cause: error },
    );
  }
}
