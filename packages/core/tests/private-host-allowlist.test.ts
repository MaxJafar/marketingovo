import { describe, expect, it } from "vitest";
import { resolveSafeAddresses, UnsafeUrlError } from "../src/core/safe-url.js";

// `allowPrivate` on its own opens every private range. That is the right
// behaviour for an operator who typed `--allow-private`, and the wrong
// behaviour for a workflow that was handed a specific internal host to analyse:
// authorising "staging.internal" must not also authorise 169.254.x, the
// container network, or the rest of the RFC1918 space.
//
// These tests pin the narrowing. The failure they guard against is silent —
// egress that is wider than the caller asked for produces no error, only
// reachability the operator never granted.

const LOOPBACK = "127.0.0.1";
const PRIVATE_V4 = "10.1.2.3";
const LINK_LOCAL = "169.254.1.1";
const METADATA = "169.254.169.254";

describe("private host allowlist narrows allowPrivate", () => {
  it("blocks private addresses outright when allowPrivate is off", async () => {
    await expect(resolveSafeAddresses(LOOPBACK, false)).rejects.toThrow(
      UnsafeUrlError,
    );
    // An allowlist must not grant access on its own.
    await expect(
      resolveSafeAddresses(LOOPBACK, false, [LOOPBACK]),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("keeps the blanket opening when no allowlist is supplied", async () => {
    // Preserves the existing `--allow-private` contract.
    await expect(resolveSafeAddresses(LOOPBACK, true)).resolves.toHaveLength(1);
    await expect(resolveSafeAddresses(PRIVATE_V4, true)).resolves.toHaveLength(
      1,
    );
    await expect(
      resolveSafeAddresses(LOOPBACK, true, []),
    ).resolves.toHaveLength(1);
  });

  it("permits exactly the hosts named in the allowlist", async () => {
    await expect(
      resolveSafeAddresses(LOOPBACK, true, [LOOPBACK]),
    ).resolves.toHaveLength(1);
  });

  // The core property: authorising one private host must not authorise the rest.
  it("refuses a private host that is not on the allowlist", async () => {
    await expect(
      resolveSafeAddresses(PRIVATE_V4, true, [LOOPBACK]),
    ).rejects.toThrow(/private\/loopback address blocked/iu);
    await expect(
      resolveSafeAddresses(LINK_LOCAL, true, [LOOPBACK]),
    ).rejects.toThrow(UnsafeUrlError);
  });

  // Cloud metadata is checked before the private-address rules, so no
  // allowlist entry can ever reach it.
  it("never allows cloud metadata, even when explicitly listed", async () => {
    await expect(
      resolveSafeAddresses(METADATA, true, [METADATA]),
    ).rejects.toThrow(/cloud metadata/iu);
  });

  it("compares hosts case-insensitively and ignores a trailing root dot", async () => {
    await expect(
      resolveSafeAddresses(LOOPBACK, true, ["127.0.0.1."]),
    ).resolves.toHaveLength(1);
  });

  it("matches an IPv6 literal whether or not the entry is bracketed", async () => {
    await expect(resolveSafeAddresses("::1", true, ["[::1]"])).resolves.toEqual(
      [{ address: "::1", family: 6 }],
    );
    await expect(resolveSafeAddresses("::1", true, ["::1"])).resolves.toEqual([
      { address: "::1", family: 6 },
    ]);
  });

  it("still resolves public hosts without consulting the allowlist", async () => {
    // A public address is unaffected by private-host policy.
    const addresses = await resolveSafeAddresses("93.184.216.34", true, [
      LOOPBACK,
    ]);
    expect(addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});
