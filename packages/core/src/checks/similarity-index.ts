// Deterministic candidate indexes for similarity checks.
//
// These helpers deliberately separate candidate generation from exact
// verification. They avoid an unconditional all-pairs scan while retaining
// every pair that can meet the configured threshold.

export interface SimilarityPair {
  left: number;
  right: number;
  similarity: number;
}

export interface SimilaritySearchResult {
  pairs: SimilarityPair[];
  /** Number of candidates that reached the exact similarity calculation. */
  candidateComparisons: number;
}

export interface SimilarityVisitResult {
  matchingPairs: number;
  candidateComparisons: number;
}

interface SignatureBand {
  start: number;
  length: number;
}

function assertThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new RangeError("similarity threshold must be in the range (0, 1]");
  }
}

function signatureBands(
  componentCount: number,
  threshold: number,
): SignatureBand[] {
  const requiredMatches = Math.ceil(threshold * componentCount);
  const maximumMismatches = componentCount - requiredMatches;

  // One more band than the maximum number of mismatches gives a useful
  // pigeonhole guarantee: every signature pair at or above the threshold has
  // at least one completely equal band, so it cannot be lost by the index.
  const bandCount = maximumMismatches + 1;
  const baseLength = Math.floor(componentCount / bandCount);
  const longerBands = componentCount % bandCount;
  const bands: SignatureBand[] = [];
  let start = 0;
  for (let i = 0; i < bandCount; i++) {
    const length = baseLength + (i < longerBands ? 1 : 0);
    bands.push({ start, length });
    start += length;
  }
  return bands;
}

function packedBandKey(
  signature: bigint,
  band: SignatureBand,
  componentCount: number,
): bigint {
  const trailingComponents = componentCount - band.start - band.length;
  const shift = BigInt(trailingComponents * 8);
  const mask = (1n << BigInt(band.length * 8)) - 1n;
  return (signature >> shift) & mask;
}

export function packedByteSimilarity(
  left: bigint,
  right: bigint,
  componentCount: number,
): number {
  if (left === 0n || right === 0n) return 0;
  let matches = 0;
  for (let i = 0; i < componentCount; i++) {
    const shift = BigInt((componentCount - 1 - i) * 8);
    if (((left >> shift) & 0xffn) === ((right >> shift) & 0xffn)) {
      matches += 1;
    }
  }
  return matches / componentCount;
}

/**
 * Find similar packed byte signatures through deterministic banding.
 *
 * Candidate generation is O(n * bands + candidates), instead of always
 * O(n^2). Exact byte similarity remains the final decision, so band
 * collisions cannot create false positives.
 */
export function visitPackedSignaturePairs(
  signatures: readonly bigint[],
  options: {
    componentCount: number;
    threshold: number;
  },
  visit: (pair: SimilarityPair) => void,
): SimilarityVisitResult {
  assertThreshold(options.threshold);
  if (
    !Number.isSafeInteger(options.componentCount) ||
    options.componentCount <= 0
  ) {
    throw new RangeError("componentCount must be a positive integer");
  }
  const bands = signatureBands(options.componentCount, options.threshold);
  const indexes = bands.map(() => new Map<bigint, number[]>());
  let matchingPairs = 0;
  let candidateComparisons = 0;

  for (let right = 0; right < signatures.length; right++) {
    const signature = signatures[right]!;
    // A zero signature is treated as invalid by the exact similarity function.
    if (signature === 0n) continue;

    const candidates = new Set<number>();
    for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
      const key = packedBandKey(
        signature,
        bands[bandIndex]!,
        options.componentCount,
      );
      const bucket = indexes[bandIndex]!.get(key);
      if (bucket) {
        for (const left of bucket) candidates.add(left);
      }
    }

    // Sorting keeps issue order reproducible even when a pair collides in
    // different bands.
    const orderedCandidates = [...candidates].sort((a, b) => a - b);
    for (const left of orderedCandidates) {
      candidateComparisons += 1;
      const similarity = packedByteSimilarity(
        signatures[left]!,
        signature,
        options.componentCount,
      );
      if (similarity < options.threshold) continue;
      matchingPairs += 1;
      visit({ left, right, similarity });
    }

    for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
      const key = packedBandKey(
        signature,
        bands[bandIndex]!,
        options.componentCount,
      );
      const index = indexes[bandIndex]!;
      const bucket = index.get(key);
      if (bucket) bucket.push(right);
      else index.set(key, [right]);
    }
  }

  return { matchingPairs, candidateComparisons };
}

export function findPackedSignaturePairs(
  signatures: readonly bigint[],
  options: {
    componentCount: number;
    threshold: number;
  },
): SimilaritySearchResult {
  const pairs: SimilarityPair[] = [];
  const result = visitPackedSignaturePairs(signatures, options, (pair) => {
    pairs.push(pair);
  });
  return { pairs, candidateComparisons: result.candidateComparisons };
}

export function jaccardSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  if (left.size === 0 || right.size === 0) return 0;
  const smaller = left.size <= right.size ? left : right;
  const larger = smaller === left ? right : left;
  let intersection = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

/**
 * Exact Jaccard matches through a global-frequency prefix index.
 *
 * Rare tokens are indexed first. The prefix length follows the threshold
 * overlap bound, which guarantees that every qualifying pair shares an
 * indexed prefix token. Exact Jaccard verification prevents false positives.
 */
export function findJaccardPairs(
  sets: readonly ReadonlySet<string>[],
  threshold: number,
): SimilaritySearchResult {
  assertThreshold(threshold);

  const frequency = new Map<string, number>();
  for (const set of sets) {
    for (const token of set) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const compareTokens = (left: string, right: string): number => {
    const frequencyDifference =
      (frequency.get(left) ?? 0) - (frequency.get(right) ?? 0);
    if (frequencyDifference !== 0) return frequencyDifference;
    return left < right ? -1 : left > right ? 1 : 0;
  };

  const prefixes = sets.map((set) => {
    if (set.size === 0) return [];
    const ordered = [...set].sort(compareTokens);
    const prefixLength = set.size - Math.ceil(threshold * set.size) + 1;
    return ordered.slice(0, prefixLength);
  });

  const index = new Map<string, number[]>();
  const pairs: SimilarityPair[] = [];
  let candidateComparisons = 0;

  for (let right = 0; right < sets.length; right++) {
    const rightSet = sets[right]!;
    if (rightSet.size === 0) continue;

    const candidates = new Set<number>();
    for (const token of prefixes[right]!) {
      const bucket = index.get(token);
      if (bucket) {
        for (const left of bucket) candidates.add(left);
      }
    }

    for (const left of [...candidates].sort((a, b) => a - b)) {
      const leftSet = sets[left]!;
      // The smaller set divided by the larger set is a strict upper bound on
      // Jaccard similarity. Applying it before verification is lossless.
      if (
        Math.min(leftSet.size, rightSet.size) /
          Math.max(leftSet.size, rightSet.size) <
        threshold
      ) {
        continue;
      }
      candidateComparisons += 1;
      const similarity = jaccardSimilarity(leftSet, rightSet);
      if (similarity >= threshold) pairs.push({ left, right, similarity });
    }

    for (const token of prefixes[right]!) {
      const bucket = index.get(token);
      if (bucket) bucket.push(right);
      else index.set(token, [right]);
    }
  }

  return { pairs, candidateComparisons };
}
