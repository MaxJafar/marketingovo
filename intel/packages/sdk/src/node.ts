import { constants, type Stats } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AgentIntelClient, type ClientOptions } from "./client.js";

export const MAX_SERVICE_TOKEN_FILE_BYTES = 128;
const SERVICE_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

export function validateServiceToken(value: string): string {
  if (!SERVICE_TOKEN.test(value)) {
    throw new Error(
      "AGENTintel service token must be exactly 43 base64url characters",
    );
  }
  return value;
}

function validateTokenFileStat(tokenFile: string, stat: Stats): void {
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `AGENTintel service token must be a regular non-symlink file: ${tokenFile}`,
    );
  }
  if (stat.size > MAX_SERVICE_TOKEN_FILE_BYTES) {
    throw new Error(`AGENTintel service token file is too large: ${tokenFile}`);
  }
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error(
      `AGENTintel service token permissions must be 0600 or stricter: ${tokenFile}`,
    );
  }
}

export async function readServiceTokenFile(tokenFile: string): Promise<string> {
  const pathStat = await lstat(tokenFile);
  validateTokenFileStat(tokenFile, pathStat);

  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const handle = await open(tokenFile, constants.O_RDONLY | noFollow);
  try {
    const openStat = await handle.stat();
    validateTokenFileStat(tokenFile, openStat);
    if (
      process.platform !== "win32" &&
      (pathStat.dev !== openStat.dev || pathStat.ino !== openStat.ino)
    ) {
      throw new Error(
        `AGENTintel service token file changed while opening: ${tokenFile}`,
      );
    }
    const buffer = Buffer.alloc(MAX_SERVICE_TOKEN_FILE_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const next = await handle.read(
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        bytesRead,
      );
      if (next.bytesRead === 0) break;
      bytesRead += next.bytesRead;
    }
    if (bytesRead > MAX_SERVICE_TOKEN_FILE_BYTES) {
      throw new Error(
        `AGENTintel service token file is too large: ${tokenFile}`,
      );
    }
    const raw = buffer.subarray(0, bytesRead).toString("utf8");
    const token = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
    return validateServiceToken(token);
  } finally {
    await handle.close();
  }
}

export function defaultAgentIntelDataDirectory(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "AGENTintel");
  }
  if (process.platform === "win32") {
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "AGENTintel",
    );
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "agentintel",
  );
}

export async function clientFromTokenFile(
  tokenFile = join(defaultAgentIntelDataDirectory(), "service-token"),
  options: Omit<ClientOptions, "token"> = {},
): Promise<AgentIntelClient> {
  const token = await readServiceTokenFile(tokenFile);
  return new AgentIntelClient({ ...options, token });
}
