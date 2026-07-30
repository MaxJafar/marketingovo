import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeOAuthCredential,
  encodeOAuthCredential,
  EncryptedFileCredentialStore,
  oauthCredentialRef,
} from "./index.js";

const ARGON2_TEST_TIMEOUT_MS = 30_000;

describe("EncryptedFileCredentialStore", () => {
  it(
    "round-trips an authenticated secret without writing plaintext",
    async () => {
      const path = join(
        mkdtempSync(join(tmpdir(), "agentseo-vault-")),
        "vault.json",
      );
      const store = new EncryptedFileCredentialStore(
        path,
        "a very strong local password",
      );
      const ref = { provider: "serpapi", account: "default", kind: "api-key" };
      await store.put(ref, Buffer.from("secret-value-1234"));
      expect(Buffer.from((await store.get(ref))!).toString()).toBe(
        "secret-value-1234",
      );
      expect(readFileSync(path, "utf8")).not.toContain("secret-value-1234");
      expect((await store.status(ref)).maskedIdentifier).toBe("••••1234");
    },
    ARGON2_TEST_TIMEOUT_MS,
  );

  it(
    "detects a wrong master password",
    async () => {
      const path = join(
        mkdtempSync(join(tmpdir(), "agentseo-vault-")),
        "vault.json",
      );
      const ref = { provider: "gsc", account: "default", kind: "oauth" };
      await new EncryptedFileCredentialStore(
        path,
        "the correct master password",
      ).put(ref, Buffer.from("refresh-token"));
      await expect(
        new EncryptedFileCredentialStore(
          path,
          "the incorrect master password",
        ).get(ref),
      ).rejects.toThrow(/authentication failed/);
    },
    ARGON2_TEST_TIMEOUT_MS,
  );

  it(
    "stores a versioned OAuth token set with an absolute expiry only in the vault",
    async () => {
      const path = join(
        mkdtempSync(join(tmpdir(), "agentseo-vault-")),
        "vault.json",
      );
      const store = new EncryptedFileCredentialStore(
        path,
        "another strong local password",
      );
      const ref = oauthCredentialRef("google-search-console");
      const encoded = encodeOAuthCredential({
        version: 1,
        provider: "google-search-console",
        accessToken: "access-secret-value",
        refreshToken: "refresh-secret-value",
        tokenType: "Bearer",
        expiresAt: "2026-07-15T10:00:00+00:00",
        scopes: ["scope:a", "scope:a"],
      });
      await store.put(ref, encoded);

      const stored = await store.get(ref);
      expect(stored).not.toBeNull();
      expect(decodeOAuthCredential(stored!)).toEqual({
        version: 1,
        provider: "google-search-console",
        accessToken: "access-secret-value",
        refreshToken: "refresh-secret-value",
        tokenType: "Bearer",
        expiresAt: "2026-07-15T10:00:00.000Z",
        scopes: ["scope:a"],
      });
      const vault = readFileSync(path, "utf8");
      expect(vault).not.toContain("access-secret-value");
      expect(vault).not.toContain("refresh-secret-value");
    },
    ARGON2_TEST_TIMEOUT_MS,
  );
});
