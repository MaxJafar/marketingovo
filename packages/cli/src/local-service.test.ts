import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  findExistingDashboard,
  issueDashboardUrl,
  startOrReuseLocalService,
} from "./local-service.js";

describe("local desktop service lifecycle", () => {
  it("issues a dashboard URL from an existing daemon with the local service token", async () => {
    const dataDirectory = mkdtempSync(
      join(tmpdir(), "marketingovo-cli-existing-"),
    );
    writeFileSync(
      join(dataDirectory, "service-token"),
      "local-service-secret\n",
      { mode: 0o600 },
    );
    const token = "A".repeat(43);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe(
        "http://127.0.0.1:3210/api/v1/session/bootstrap-token",
      );
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer local-service-secret",
      );
      return new Response(
        JSON.stringify({
          token,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    await expect(
      issueDashboardUrl(dataDirectory, 3210, fetchImpl),
    ).resolves.toBe(`http://127.0.0.1:3210/#token=${token}`);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("treats a missing or unauthenticated daemon as unavailable", async () => {
    const missing = mkdtempSync(join(tmpdir(), "marketingovo-cli-missing-"));
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      findExistingDashboard(missing, 3210, fetchImpl),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    writeFileSync(join(missing, "service-token"), "stale-secret\n", {
      mode: 0o600,
    });
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 401, title: "Authentication required" }),
        {
          status: 401,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    await expect(
      findExistingDashboard(missing, 3210, fetchImpl),
    ).resolves.toBeNull();
  });

  it("reuses a service before starting another database owner", async () => {
    const start = vi.fn(async () => ({ id: "owned" }));
    const resolution = await startOrReuseLocalService({
      findExisting: async () => "http://127.0.0.1:3210/#token=existing",
      waitForExisting: async () => null,
      start,
      issueDashboardUrl: async () => "unused",
      close: async () => undefined,
    });

    expect(resolution).toEqual({
      dashboardUrl: "http://127.0.0.1:3210/#token=existing",
      service: null,
      reused: true,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("recovers a startup race when another daemon wins the port", async () => {
    const collision = Object.assign(new Error("address in use"), {
      code: "EADDRINUSE",
    });
    const waitForExisting = vi.fn(
      async () => "http://127.0.0.1:3210/#token=race-winner",
    );
    const resolution = await startOrReuseLocalService({
      findExisting: async () => null,
      waitForExisting,
      start: async () => {
        throw collision;
      },
      issueDashboardUrl: async () => "unused",
      close: async () => undefined,
    });

    expect(resolution).toEqual({
      dashboardUrl: "http://127.0.0.1:3210/#token=race-winner",
      service: null,
      reused: true,
    });
    expect(waitForExisting).toHaveBeenCalledOnce();
  });

  it("closes a newly started daemon if dashboard ticket issuance fails", async () => {
    const service = { id: "owned" };
    const close = vi.fn(async () => undefined);
    await expect(
      startOrReuseLocalService({
        findExisting: async () => null,
        waitForExisting: async () => null,
        start: async () => service,
        issueDashboardUrl: async () => {
          throw new Error("ticket failed");
        },
        close,
      }),
    ).rejects.toThrow("ticket failed");
    expect(close).toHaveBeenCalledWith(service);
  });
});
