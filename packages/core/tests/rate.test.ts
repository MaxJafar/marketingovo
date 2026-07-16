import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/core/rate.js";

describe("RateLimiter", () => {
  it("allows up to capacity immediately", async () => {
    const rl = new RateLimiter(5);
    const waits: number[] = [];
    for (let i = 0; i < 5; i++) {
      waits.push(await rl.acquire("example.com"));
    }
    expect(waits.every((w) => w === 0)).toBe(true);
  });

  it("blocks beyond capacity and waits", async () => {
    const rl = new RateLimiter(10);
    for (let i = 0; i < 10; i++) await rl.acquire("example.com");
    const t0 = Date.now();
    const w = await rl.acquire("example.com");
    const elapsed = Date.now() - t0;
    expect(w).toBeGreaterThan(0);
    expect(elapsed).toBeGreaterThanOrEqual(w - 5);
  });

  it("keeps buckets per host", async () => {
    const rl = new RateLimiter(5);
    for (let i = 0; i < 5; i++) await rl.acquire("a.example");
    const aWait = await rl.acquire("a.example");
    const bWait = await rl.acquire("b.example");
    expect(aWait).toBeGreaterThan(0);
    expect(bWait).toBe(0);
  });
});
