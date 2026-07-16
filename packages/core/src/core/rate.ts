// Per-host token bucket rate limiter. One bucket per host.
//
// Capacity = ceil(rps). Refill rate = rps tokens/sec. We pre-allocate
// integer tokens; fractional refill is accumulated.

export class RateLimiter {
  private readonly rps: number;
  private readonly capacity: number;
  private readonly buckets = new Map<
    string,
    { tokens: number; last: number }
  >();

  constructor(rps: number) {
    this.rps = rps;
    this.capacity = Math.max(1, Math.ceil(rps));
  }

  /**
   * Wait until a token is available for `host`, then consume one.
   * Returns the number of milliseconds we actually waited.
   */
  async acquire(host: string): Promise<number> {
    const now = Date.now();
    let bucket = this.buckets.get(host);
    if (!bucket) {
      bucket = { tokens: this.capacity, last: now };
      this.buckets.set(host, bucket);
    }
    const elapsedSec = (now - bucket.last) / 1000;
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsedSec * this.rps,
    );
    bucket.last = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    const deficit = 1 - bucket.tokens;
    const waitMs = Math.ceil((deficit / this.rps) * 1000);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    bucket.last = Date.now();
    bucket.tokens = 0;
    return waitMs;
  }

  clear(): void {
    this.buckets.clear();
  }
}
