import { describe, expect, it } from "vitest";
import {
  dataCodewordCount,
  encodeQr,
  maskPenalty,
  QrCapacityError,
  selectMode,
  type ErrorCorrectionLevel,
  type QrMatrix,
} from "./encode.js";
import {
  generatorPolynomial,
  gfMultiply,
  reedSolomonRemainder,
} from "./galois.js";

/**
 * A QR code is only correct if a scanner can read it, and there is no scanner
 * in a unit test. So the encoder is checked by decoding its own output: the
 * decoder below re-derives the mask from the format bits, unmasks, walks the
 * same zigzag, de-interleaves the blocks and reads the mode header back.
 *
 * That covers the parts that are easy to get subtly wrong and impossible to
 * eyeball — a decoder written against the specification rather than against
 * the encoder is the closest thing to an independent check available offline.
 */

const ECL_BY_FORMAT_BITS: Record<number, ErrorCorrectionLevel> = {
  1: "L",
  0: "M",
  3: "Q",
  2: "H",
};

// Transcribed independently of the encoder, so a typo in either table shows
// up as a failed round trip rather than as two files agreeing on a mistake.
// Versions 1 to 10, which is everything a campaign URL reaches.
const ECC_PER_BLOCK: Record<ErrorCorrectionLevel, readonly number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

const BLOCKS: Record<ErrorCorrectionLevel, readonly number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function isFunctionModule(size: number, version: number, x: number, y: number) {
  // Finder patterns with separators, and the format strips beside them.
  if (x <= 8 && y <= 8) return true;
  if (x >= size - 8 && y <= 8) return true;
  if (x <= 8 && y >= size - 8) return true;
  // Timing patterns.
  if (x === 6 || y === 6) return true;
  // Version information blocks.
  if (version >= 7) {
    if (x < 6 && y >= size - 11 && y < size - 8) return true;
    if (y < 6 && x >= size - 11 && x < size - 8) return true;
  }
  // Alignment patterns.
  const count = Math.floor(version / 7) + 2;
  if (version >= 2) {
    const step =
      version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const positions = [6];
    for (let position = size - 7; positions.length < count; position -= step) {
      positions.splice(1, 0, position);
    }
    for (const centerY of positions) {
      for (const centerX of positions) {
        const atFinder =
          (centerX === 6 && centerY === 6) ||
          (centerX === 6 && centerY === size - 7) ||
          (centerX === size - 7 && centerY === 6);
        if (atFinder) continue;
        if (Math.abs(x - centerX) <= 2 && Math.abs(y - centerY) <= 2)
          return true;
      }
    }
  }
  return false;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** Reads the format strip beside the top-left finder and undoes the BCH mask. */
function readFormat(matrix: QrMatrix): {
  ecl: ErrorCorrectionLevel;
  mask: number;
} {
  const read = (x: number, y: number) => (matrix.modules[y]![x]! ? 1 : 0);
  let bits = 0;
  for (let index = 0; index <= 5; index += 1) bits |= read(8, index) << index;
  bits |= read(8, 7) << 6;
  bits |= read(8, 8) << 7;
  bits |= read(7, 8) << 8;
  for (let index = 9; index < 15; index += 1) {
    bits |= read(14 - index, 8) << index;
  }
  const value = (bits ^ 0x5412) >>> 10;
  return { ecl: ECL_BY_FORMAT_BITS[value >>> 3]!, mask: value & 7 };
}

function decode(matrix: QrMatrix): string {
  const { size, version } = matrix;
  const { ecl, mask } = readFormat(matrix);

  // Unmask, then walk the placement order and collect the bit stream.
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    const column = right <= 6 ? right - 1 : right;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = column - offset;
        const upward = ((column + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (isFunctionModule(size, version, x, y)) continue;
        const raw = matrix.modules[y]![x]!;
        bits.push((maskBit(mask, x, y) ? !raw : raw) ? 1 : 0);
      }
    }
  }

  const codewords: number[] = [];
  for (let index = 0; index + 7 < bits.length; index += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1)
      byte = (byte << 1) | bits[index + bit]!;
    codewords.push(byte);
  }

  // De-interleave: rebuild the block lengths, then read column-wise the way
  // the encoder wrote them.
  const blockCount = BLOCKS[ecl][version - 1];
  const eccPerBlock = ECC_PER_BLOCK[ecl][version - 1];
  if (blockCount === undefined || eccPerBlock === undefined) {
    // Loudly, rather than returning an empty string that reads as a decode
    // failure and sends you hunting through the encoder.
    throw new Error(
      `The test decoder only covers versions 1-10; this case produced version ${version}.`,
    );
  }
  const totalCodewords = codewords.length;
  const shortBlockCount = blockCount - (totalCodewords % blockCount);
  const shortBlockLength = Math.floor(totalCodewords / blockCount);
  const lengths = Array.from(
    { length: blockCount },
    (_, index) =>
      shortBlockLength - eccPerBlock + (index < shortBlockCount ? 0 : 1),
  );

  const blocks: number[][] = lengths.map(() => []);
  let cursor = 0;
  for (let index = 0; index < Math.max(...lengths); index += 1) {
    for (let block = 0; block < blockCount; block += 1) {
      if (index < lengths[block]!) blocks[block]!.push(codewords[cursor++]!);
    }
  }
  const data = blocks.flat();

  // Read the mode header and the payload out of the data codewords.
  const dataBits: number[] = [];
  for (const byte of data) {
    for (let bit = 7; bit >= 0; bit -= 1) dataBits.push((byte >>> bit) & 1);
  }
  let position = 0;
  const take = (count: number): number => {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value = (value << 1) | dataBits[position++]!;
    }
    return value;
  };

  const mode = take(4);
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const countBits =
    mode === 1
      ? [10, 12, 14][group]!
      : mode === 2
        ? [9, 11, 13][group]!
        : [8, 16, 16][group]!;
  const count = take(countBits);

  if (mode === 1) {
    let text = "";
    let remaining = count;
    while (remaining >= 3) {
      text += String(take(10)).padStart(3, "0");
      remaining -= 3;
    }
    if (remaining === 2) text += String(take(7)).padStart(2, "0");
    else if (remaining === 1) text += String(take(4));
    return text;
  }
  if (mode === 2) {
    let text = "";
    let remaining = count;
    while (remaining >= 2) {
      const pair = take(11);
      text += ALPHANUMERIC[Math.floor(pair / 45)]! + ALPHANUMERIC[pair % 45]!;
      remaining -= 2;
    }
    if (remaining === 1) text += ALPHANUMERIC[take(6)]!;
    return text;
  }
  const bytes = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) bytes[index] = take(8);
  return new TextDecoder().decode(bytes);
}

describe("Reed-Solomon", () => {
  it("produces a codeword divisible by the generator", () => {
    // The defining property: a correct codeword evaluates to zero at each
    // root of the generator. This checks the arithmetic without depending on
    // a transcribed table of expected bytes.
    const data = Uint8Array.from([32, 91, 11, 120, 209, 114, 220, 77, 67, 64]);
    const degree = 13;
    const full = [...data, ...reedSolomonRemainder(data, degree)];
    for (let index = 0; index < degree; index += 1) {
      let root = 1;
      for (let step = 0; step < index; step += 1) root = gfMultiply(root, 2);
      let evaluated = 0;
      for (const coefficient of full) {
        evaluated = gfMultiply(evaluated, root) ^ coefficient;
      }
      expect(evaluated).toBe(0);
    }
  });

  it("builds generator polynomials of the requested degree", () => {
    expect(generatorPolynomial(7)).toHaveLength(7);
    expect(generatorPolynomial(30)).toHaveLength(30);
    expect(() => generatorPolynomial(0)).toThrow(RangeError);
  });
});

describe("mode selection", () => {
  it("picks the tightest mode the content allows", () => {
    expect(selectMode("0800123456")).toBe("numeric");
    expect(selectMode("HTTPS://EXAMPLE.COM")).toBe("alphanumeric");
    expect(selectMode("https://example.com")).toBe("byte");
  });

  it("keeps an uppercase URL materially smaller than a lowercase one", () => {
    // Not a detail: alphanumeric mode is 5.5 bits per character against 8, and
    // fewer modules is the difference between a scannable code on a business
    // card and one that is not.
    const upper = encodeQr("HTTPS://EXAMPLE.COM/SUMMER-SALE-2026-OFFER-PAGE");
    const lower = encodeQr("https://example.com/summer-sale-2026-offer-page");
    expect(upper.version).toBeLessThan(lower.version);
  });
});

describe("structure", () => {
  it("places finder patterns at exactly three corners", () => {
    const matrix = encodeQr("https://example.com/campaign");
    const { size, modules } = matrix;
    const finderAt = (originX: number, originY: number) => {
      for (let dy = 0; dy < 7; dy += 1) {
        for (let dx = 0; dx < 7; dx += 1) {
          const distance = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          const expected = distance !== 2;
          if (modules[originY + dy]![originX + dx] !== expected) return false;
        }
      }
      return true;
    };
    expect(finderAt(0, 0)).toBe(true);
    expect(finderAt(size - 7, 0)).toBe(true);
    expect(finderAt(0, size - 7)).toBe(true);
    // The missing fourth corner is how a scanner works out the rotation.
    expect(finderAt(size - 7, size - 7)).toBe(false);
  });

  it("draws alternating timing patterns and the dark module", () => {
    const matrix = encodeQr("https://example.com/campaign");
    for (let index = 8; index < matrix.size - 8; index += 1) {
      expect(matrix.modules[6]![index]).toBe(index % 2 === 0);
      expect(matrix.modules[index]![6]).toBe(index % 2 === 0);
    }
    expect(matrix.modules[matrix.size - 8]![8]).toBe(true);
  });

  it("sizes the symbol from its version", () => {
    for (const version of [1, 2, 7, 10]) {
      const matrix = encodeQr("A".repeat(dataCodewordCount(version, "L") - 3), {
        errorCorrection: "L",
      });
      expect(matrix.size).toBe(matrix.version * 4 + 17);
    }
  });
});

describe("round trip", () => {
  const cases: Array<{ text: string; ecl: ErrorCorrectionLevel }> = [
    { text: "HELLO WORLD", ecl: "Q" },
    { text: "https://example.com/", ecl: "M" },
    { text: "0800123456", ecl: "L" },
    {
      text: "https://example.com/?utm_source=flyer&utm_medium=print",
      ecl: "H",
    },
    { text: "Ярмарка · 2026", ecl: "M" },
    { text: "https://example.com/" + "a".repeat(200), ecl: "L" },
  ];

  for (const { text, ecl } of cases) {
    it(`decodes back to ${JSON.stringify(text.slice(0, 32))} at level ${ecl}`, () => {
      const matrix = encodeQr(text, { errorCorrection: ecl });
      expect(decode(matrix)).toBe(text);
    });
  }

  it("decodes correctly under every mask", () => {
    for (let mask = 0; mask < 8; mask += 1) {
      const matrix = encodeQr("https://example.com/x", { mask });
      expect(readFormat(matrix).mask).toBe(mask);
      expect(decode(matrix)).toBe("https://example.com/x");
    }
  });

  it("decodes a multi-block symbol, proving interleaving", () => {
    // Version 5-Q upward uses four blocks; a broken interleave still decodes
    // at version 1, which is why this case exists separately.
    const text = "https://example.com/" + "b".repeat(60);
    const matrix = encodeQr(text, { errorCorrection: "Q" });
    expect(matrix.version).toBeGreaterThanOrEqual(5);
    expect(decode(matrix)).toBe(text);
  });

  it("records the level it actually used", () => {
    const matrix = encodeQr("https://example.com/", { errorCorrection: "H" });
    expect(readFormat(matrix).ecl).toBe("H");
    expect(matrix.errorCorrection).toBe("H");
  });
});

describe("masking", () => {
  it("chooses the least-penalised mask", () => {
    const text = "https://example.com/summer";
    const chosen = encodeQr(text);
    const penalties = Array.from({ length: 8 }, (_, mask) =>
      maskPenalty(encodeQr(text, { mask }).modules),
    );
    expect(penalties[chosen.mask]).toBe(Math.min(...penalties));
  });

  it("penalises long runs and finder-like patterns", () => {
    const blank = Array.from({ length: 21 }, () =>
      Array.from({ length: 21 }, () => false),
    );
    // An all-light grid is maximally penalised: long runs everywhere, every
    // 2x2 uniform, and the darkness ratio at its worst.
    expect(maskPenalty(blank)).toBeGreaterThan(1000);
  });
});

describe("capacity", () => {
  it("refuses content that cannot fit", () => {
    expect(() => encodeQr("a".repeat(3000), { errorCorrection: "H" })).toThrow(
      QrCapacityError,
    );
    expect(() => encodeQr("")).toThrow(QrCapacityError);
  });

  it("explains the refusal in terms the operator can act on", () => {
    expect(() => encodeQr("a".repeat(200), { maxVersion: 2 })).toThrow(
      /Shorten the URL, or lower the error-correction level/,
    );
  });

  it("matches the published data capacities", () => {
    // Spot checks against the specification's capacity table.
    expect(dataCodewordCount(1, "L")).toBe(19);
    expect(dataCodewordCount(1, "H")).toBe(9);
    expect(dataCodewordCount(10, "M")).toBe(216);
    expect(dataCodewordCount(40, "L")).toBe(2956);
    expect(dataCodewordCount(40, "H")).toBe(1276);
  });
});
