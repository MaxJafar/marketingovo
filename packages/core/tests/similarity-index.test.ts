import { describe, expect, it } from "vitest";
import {
  findJaccardPairs,
  findPackedSignaturePairs,
  jaccardSimilarity,
} from "../src/checks/similarity-index.js";

function packBytes(bytes: readonly number[]): bigint {
  let packed = 0n;
  for (const byte of bytes) {
    packed = (packed << 8n) | BigInt(byte & 0xff);
  }
  return packed;
}

function syntheticSignature(seed: number): bigint {
  const bytes: number[] = [];
  let state = (seed + 1) >>> 0;
  for (let i = 0; i < 64; i++) {
    state = (state + 0x9e3779b9) >>> 0;
    let mixed = state;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x21f0aaad);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x735a2d97);
    mixed ^= mixed >>> 15;
    bytes.push(mixed & 0xff);
  }
  return packBytes(bytes);
}

function pairKeys(pairs: Array<{ left: number; right: number }>): string[] {
  return pairs.map(({ left, right }) => `${left}:${right}`).sort();
}

describe("packed signature candidate index", () => {
  it("retains a threshold pair even when mismatches span every possible band", () => {
    const left = new Array<number>(64).fill(7);
    const right = [...left];

    // At a 0.7 threshold, 45/64 components must match. The index creates 20
    // bands, so distribute 19 mismatches across 19 different bands. Only the
    // final band is equal; the qualifying pair must still be a candidate.
    let bandStart = 0;
    for (let band = 0; band < 19; band++) {
      right[bandStart] = 19 + band;
      bandStart += band < 4 ? 4 : 3;
    }

    const result = findPackedSignaturePairs(
      [packBytes(left), packBytes(right)],
      { componentCount: 64, threshold: 0.7 },
    );

    expect(result.pairs).toEqual([{ left: 0, right: 1, similarity: 45 / 64 }]);
    expect(result.candidateComparisons).toBe(1);
  });

  it("keeps a high-volume synthetic corpus far below all-pairs work", () => {
    const corpusSize = 20_000;
    const signatures = Array.from({ length: corpusSize }, (_, i) =>
      syntheticSignature(i),
    );

    const result = findPackedSignaturePairs(signatures, {
      componentCount: 64,
      threshold: 0.7,
    });

    expect(result.pairs).toEqual([]);
    expect(result.candidateComparisons).toBeLessThan(corpusSize * 2);
    expect(result.candidateComparisons).toBeLessThan(
      (corpusSize * (corpusSize - 1)) / 10_000,
    );
  });
});

describe("Jaccard prefix index", () => {
  it("returns exactly the same threshold pairs as exhaustive comparison", () => {
    const universe = Array.from({ length: 8 }, (_, i) => `token-${i}`);
    const sets: Set<string>[] = [];
    for (let mask = 1; mask < 1 << universe.length; mask++) {
      const set = new Set<string>();
      for (let bit = 0; bit < universe.length; bit++) {
        if ((mask & (1 << bit)) !== 0) set.add(universe[bit]!);
      }
      sets.push(set);
    }

    const expected: Array<{ left: number; right: number }> = [];
    for (let left = 0; left < sets.length; left++) {
      for (let right = left + 1; right < sets.length; right++) {
        if (jaccardSimilarity(sets[left]!, sets[right]!) >= 0.7) {
          expected.push({ left, right });
        }
      }
    }

    const actual = findJaccardPairs(sets, 0.7);
    expect(pairKeys(actual.pairs)).toEqual(pairKeys(expected));
  });

  it("indexes rare title shingles instead of comparing a shared brand corpus", () => {
    const corpusSize = 20_000;
    const sets = Array.from(
      { length: corpusSize },
      (_, i) =>
        new Set(["shared brand", `unique topic ${i}`, `unique intent ${i}`]),
    );

    const result = findJaccardPairs(sets, 0.7);

    expect(result.pairs).toEqual([]);
    expect(result.candidateComparisons).toBe(0);
  });
});
