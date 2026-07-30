import { constants } from "node:fs";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SERVICE_TOKEN_FILE_BYTES, clientFromTokenFile } from "./node.js";

const validToken = "A".repeat(43);
let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "agentintel-sdk-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function tokenFile(
  name: string,
  content: string,
  mode = 0o600,
): Promise<string> {
  const path = join(directory, name);
  await writeFile(path, content, { mode });
  await chmod(path, mode);
  return path;
}

describe("clientFromTokenFile", () => {
  it("accepts a private regular file containing one exact token", async () => {
    const path = await tokenFile("service-token", `${validToken}\n`);
    const client = await clientFromTokenFile(path);
    expect(client.token).toBe(validToken);
  });

  it.each([
    ["short", "a".repeat(42)],
    ["long", "a".repeat(44)],
    ["non-base64url", `${"a".repeat(42)}+`],
    ["leading whitespace", ` ${validToken}`],
    ["extra newline", `${validToken}\n\n`],
  ])("rejects a %s token", async (_label, content) => {
    const path = await tokenFile("service-token", content);
    await expect(clientFromTokenFile(path)).rejects.toThrow(
      /exactly 43 base64url characters/u,
    );
  });

  it("rejects a symbolic link even when its target is private", async () => {
    const target = await tokenFile("target-token", validToken);
    const link = join(directory, "service-token");
    await symlink(target, link);
    await expect(clientFromTokenFile(link)).rejects.toThrow(/non-symlink/u);
  });

  it("rejects a non-regular token path", async () => {
    await expect(clientFromTokenFile(directory)).rejects.toThrow(
      /regular non-symlink file/u,
    );
  });

  it("rejects an oversized token file before reading it", async () => {
    const path = await tokenFile(
      "service-token",
      "a".repeat(MAX_SERVICE_TOKEN_FILE_BYTES + 1),
    );
    await expect(clientFromTokenFile(path)).rejects.toThrow(/too large/u);
  });

  it.skipIf(process.platform === "win32")(
    "rejects permissions broader than owner-only",
    async () => {
      const path = await tokenFile("service-token", validToken, 0o640);
      await expect(clientFromTokenFile(path)).rejects.toThrow(
        /0600 or stricter/u,
      );
    },
  );

  it("rejects a hostile API origin before bearer use", async () => {
    const path = await tokenFile("service-token", validToken);
    const fetcher = vi.fn<typeof globalThis.fetch>();
    await expect(
      clientFromTokenFile(path, {
        baseUrl: "http://attacker.invalid:7465",
        fetch: fetcher,
      }),
    ).rejects.toThrow(/exact http:\/\/127\.0\.0\.1:<port> origin/u);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("opens Unix token files without following a replacement symlink", () => {
    if (process.platform !== "win32") {
      expect(constants.O_NOFOLLOW).toBeTypeOf("number");
    }
  });
});
