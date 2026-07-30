// Legacy v0 compatibility is importer-only. A synthetic fixture proves that
// old manifest shapes are not active AGENTseo contracts.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("legacy v0 quarantine", () => {
  it("moves the old manifest out of the core package", () => {
    expect(existsSync(resolve(import.meta.dirname, "../plugin.json"))).toBe(
      false,
    );
    const path = resolve(
      import.meta.dirname,
      "../../../migrations/legacy-v0/plugin.json",
    );
    expect(existsSync(path)).toBe(true);
    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      private?: boolean;
      quarantined?: boolean;
      synthetic?: boolean;
      license?: string;
      tools?: unknown[];
    };
    expect(manifest.private).toBe(false);
    expect(manifest.quarantined).toBe(true);
    expect(manifest.synthetic).toBe(true);
    expect(manifest.license).toBe("Apache-2.0");
    expect(manifest.tools?.length).toBeGreaterThan(6);
  });
});
