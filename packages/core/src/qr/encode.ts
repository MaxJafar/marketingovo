// A QR encoder, per ISO/IEC 18004.
//
// Written here rather than taken from a package, deliberately. A marketer who
// prints a QR code on ten thousand leaflets is making a commitment measured in
// years, and the industry's answer to that has been to sell them a "dynamic"
// code that stops resolving when a subscription lapses. A code produced here
// encodes its destination directly: no service resolves it, nothing can revoke
// it, and it keeps working for as long as the paper does.
//
// The algorithm is fully specified and unchanging, which is exactly the kind
// of thing worth owning outright.

import { reedSolomonRemainder } from "./galois.js";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

/** How much of the code can be destroyed and still decode. */
export const ERROR_CORRECTION_RECOVERY: Readonly<
  Record<ErrorCorrectionLevel, number>
> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

const ECL_ORDER: readonly ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

/** Format-info bit pattern per level. Not the same order as the table index. */
const ECL_FORMAT_BITS: Readonly<Record<ErrorCorrectionLevel, number>> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

// Index 0 is unused so version numbers index directly. Straight from the
// specification's tables; they are the one part of QR nobody derives.
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  // prettier-ignore
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // prettier-ignore
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // prettier-ignore
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // prettier-ignore
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  // prettier-ignore
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // prettier-ignore
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // prettier-ignore
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // prettier-ignore
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export type QrMode = "numeric" | "alphanumeric" | "byte";

export interface QrMatrix {
  /** Module count per side, excluding the quiet zone. */
  readonly size: number;
  readonly version: number;
  readonly errorCorrection: ErrorCorrectionLevel;
  readonly mask: number;
  readonly mode: QrMode;
  /** Row-major; true is a dark module. */
  readonly modules: readonly (readonly boolean[])[];
}

/** Total data modules for a version, before error correction is subtracted. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2;
    result -= (25 * alignmentCount - 10) * alignmentCount - 55;
    // Version information occupies two 3×6 blocks from version 7.
    if (version >= 7) result -= 36;
  }
  return result;
}

export function dataCodewordCount(
  version: number,
  ecl: ErrorCorrectionLevel,
): number {
  const level = ECL_ORDER.indexOf(ecl);
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[level]![version]! *
      NUM_ERROR_CORRECTION_BLOCKS[level]![version]!
  );
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  // Version 32 is the one case the general formula gets wrong; the
  // specification lists it explicitly.
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let position = size - 7; positions.length < count; position -= step) {
    positions.splice(1, 0, position);
  }
  return positions;
}

/**
 * The tightest mode this text fits.
 *
 * Numeric packs 3 digits into 10 bits and alphanumeric 2 characters into 11,
 * against 8 bits per byte otherwise — so a phone number or an uppercase URL
 * produces a visibly less dense code, which is the difference between a
 * scannable business card and an unscannable one.
 */
export function selectMode(text: string): QrMode {
  if (/^[0-9]*$/.test(text)) return "numeric";
  if ([...text].every((character) => ALPHANUMERIC.includes(character))) {
    return "alphanumeric";
  }
  return "byte";
}

function characterCountBits(mode: QrMode, version: number): number {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  if (mode === "numeric") return [10, 12, 14][group]!;
  if (mode === "alphanumeric") return [9, 11, 13][group]!;
  return [8, 16, 16][group]!;
}

const MODE_INDICATOR: Readonly<Record<QrMode, number>> = {
  numeric: 1,
  alphanumeric: 2,
  byte: 4,
};

class BitBuffer {
  private readonly bits: number[] = [];

  append(value: number, length: number): void {
    for (let index = length - 1; index >= 0; index -= 1) {
      this.bits.push((value >>> index) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  padToByte(): void {
    while (this.bits.length % 8 !== 0) this.bits.push(0);
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(this.bits.length / 8);
    this.bits.forEach((bit, index) => {
      if (bit) bytes[index >>> 3]! |= 0x80 >>> (index & 7);
    });
    return bytes;
  }
}

function encodeSegment(text: string, mode: QrMode, buffer: BitBuffer): void {
  if (mode === "numeric") {
    for (let index = 0; index < text.length; index += 3) {
      const chunk = text.slice(index, index + 3);
      buffer.append(Number(chunk), chunk.length * 3 + 1);
    }
    return;
  }
  if (mode === "alphanumeric") {
    for (let index = 0; index < text.length; index += 2) {
      const first = ALPHANUMERIC.indexOf(text[index]!);
      if (index + 1 < text.length) {
        buffer.append(first * 45 + ALPHANUMERIC.indexOf(text[index + 1]!), 11);
      } else {
        buffer.append(first, 6);
      }
    }
    return;
  }
  // Byte mode carries UTF-8, which is what every scanner built in the last
  // fifteen years assumes when the ECI header is absent.
  for (const byte of new TextEncoder().encode(text)) {
    buffer.append(byte, 8);
  }
}

function segmentBitLength(text: string, mode: QrMode, version: number): number {
  const header = 4 + characterCountBits(mode, version);
  if (mode === "numeric") {
    const groups = Math.floor(text.length / 3);
    const remainder = text.length % 3;
    return header + groups * 10 + (remainder === 0 ? 0 : remainder * 3 + 1);
  }
  if (mode === "alphanumeric") {
    return header + Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
  }
  return header + new TextEncoder().encode(text).length * 8;
}

function characterCount(text: string, mode: QrMode): number {
  return mode === "byte" ? new TextEncoder().encode(text).length : text.length;
}

/** Interleaves data and error-correction blocks, as the standard requires. */
function buildCodewords(
  data: Uint8Array,
  version: number,
  ecl: ErrorCorrectionLevel,
): Uint8Array {
  const level = ECL_ORDER.indexOf(ecl);
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level]![version]!;
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[level]![version]!;
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockCount = blockCount - (totalCodewords % blockCount);
  const shortBlockLength = Math.floor(totalCodewords / blockCount);

  const blocks: Array<{ data: Uint8Array; ecc: Uint8Array }> = [];
  let offset = 0;
  for (let index = 0; index < blockCount; index += 1) {
    const length =
      shortBlockLength - eccPerBlock + (index < shortBlockCount ? 0 : 1);
    const blockData = data.slice(offset, offset + length);
    offset += length;
    blocks.push({
      data: blockData,
      ecc: reedSolomonRemainder(blockData, eccPerBlock),
    });
  }

  const result: number[] = [];
  const longestData = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < longestData; index += 1) {
    for (const block of blocks) {
      // Short blocks are simply absent at their missing position rather than
      // padded, which is what interleaving means here.
      if (index < block.data.length) result.push(block.data[index]!);
    }
  }
  for (let index = 0; index < eccPerBlock; index += 1) {
    for (const block of blocks) result.push(block.ecc[index]!);
  }
  return Uint8Array.from(result);
}

/** BCH(15,5) for format information, and BCH(18,6) for version. */
function bchRemainder(value: number, generator: number, bits: number): number {
  let result = value << bits;
  const generatorBits = 32 - Math.clz32(generator);
  for (
    let index = 32 - Math.clz32(result);
    index >= generatorBits;
    index -= 1
  ) {
    if ((result >>> (index - 1)) & 1) {
      result ^= generator << (index - generatorBits);
    }
  }
  return result & ((1 << bits) - 1);
}

interface Grid {
  modules: boolean[][];
  reserved: boolean[][];
}

function drawFunctionPatterns(grid: Grid, version: number, size: number): void {
  const set = (x: number, y: number, dark: boolean): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    grid.modules[y]![x] = dark;
    grid.reserved[y]![x] = true;
  };

  // Timing patterns run the full width and height at row and column 6.
  for (let index = 0; index < size; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }

  // Finder patterns, with their separators, at three corners. The missing
  // fourth corner is what tells a scanner the code's orientation.
  for (const [originX, originY] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const distance = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        set(originX + dx, originY + dy, distance !== 2 && distance <= 3);
      }
    }
  }

  const positions = alignmentPositions(version);
  for (const centerY of positions) {
    for (const centerX of positions) {
      // The three corners already hold finder patterns.
      const atFinder =
        (centerX === 6 && centerY === 6) ||
        (centerX === 6 && centerY === size - 7) ||
        (centerX === size - 7 && centerY === 6);
      if (atFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(
            centerX + dx,
            centerY + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
  }

  // Reserve the format-information strips; the values are written after the
  // mask is chosen, since they encode which mask was used.
  //
  // Reserving here must not overwrite: the strips cross the timing patterns
  // at (6,8) and (8,6), and those two modules belong to the timing patterns
  // and keep their values. The format bits are laid out to step over them.
  const reserve = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    if (!grid.reserved[y]![x]) grid.modules[y]![x] = false;
    grid.reserved[y]![x] = true;
  };

  // The copies are not the same length. Beside the top-left finder the strip
  // spans nine modules because of those timing crossings; the others span
  // eight — reserving nine there steals a data module and shifts every
  // codeword after it by one bit.
  for (let index = 0; index <= 8; index += 1) {
    reserve(index, 8);
    reserve(8, index);
  }
  for (let index = 0; index < 8; index += 1) {
    reserve(size - 1 - index, 8);
    reserve(8, size - 1 - index);
  }
  // The dark module is always set, and always here.
  set(8, size - 8, true);

  if (version >= 7) {
    const bits = (version << 12) | bchRemainder(version, 0x1f25, 12);
    for (let index = 0; index < 18; index += 1) {
      const dark = ((bits >>> index) & 1) === 1;
      const a = Math.floor(index / 3);
      const b = (index % 3) + size - 11;
      set(a, b, dark);
      set(b, a, dark);
    }
  }
}

function drawFormatBits(
  grid: Grid,
  size: number,
  ecl: ErrorCorrectionLevel,
  mask: number,
): void {
  const value = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  // The XOR keeps an all-zero format from producing a blank strip, which no
  // scanner could distinguish from damage.
  const bits = ((value << 10) | bchRemainder(value, 0x537, 10)) ^ 0x5412;

  const set = (x: number, y: number, dark: boolean): void => {
    grid.modules[y]![x] = dark;
    grid.reserved[y]![x] = true;
  };

  for (let index = 0; index <= 5; index += 1) {
    set(8, index, ((bits >>> index) & 1) === 1);
  }
  set(8, 7, ((bits >>> 6) & 1) === 1);
  set(8, 8, ((bits >>> 7) & 1) === 1);
  set(7, 8, ((bits >>> 8) & 1) === 1);
  for (let index = 9; index < 15; index += 1) {
    set(14 - index, 8, ((bits >>> index) & 1) === 1);
  }

  // The second copy, so a damaged corner does not make the code unreadable.
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, ((bits >>> index) & 1) === 1);
  }
  for (let index = 8; index < 15; index += 1) {
    set(8, size - 15 + index, ((bits >>> index) & 1) === 1);
  }
  set(8, size - 8, true);
}

/** Places codewords in the upward/downward zigzag the standard defines. */
function drawCodewords(grid: Grid, size: number, codewords: Uint8Array): void {
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    const column = right <= 6 ? right - 1 : right;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = column - offset;
        const upward = ((column + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (grid.reserved[y]![x]) continue;
        const bit =
          bitIndex < codewords.length * 8 &&
          ((codewords[bitIndex >>> 3]! >>> (7 - (bitIndex & 7))) & 1) === 1;
        grid.modules[y]![x] = bit;
        bitIndex += 1;
      }
    }
  }
}

function applyMask(grid: Grid, size: number, mask: number): void {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (grid.reserved[y]![x]) continue;
      let invert = false;
      switch (mask) {
        case 0:
          invert = (x + y) % 2 === 0;
          break;
        case 1:
          invert = y % 2 === 0;
          break;
        case 2:
          invert = x % 3 === 0;
          break;
        case 3:
          invert = (x + y) % 3 === 0;
          break;
        case 4:
          invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
          break;
        case 5:
          invert = ((x * y) % 2) + ((x * y) % 3) === 0;
          break;
        case 6:
          invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
        default:
          invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
      }
      if (invert) grid.modules[y]![x] = !grid.modules[y]![x];
    }
  }
}

/**
 * The specification's penalty rules.
 *
 * Masking exists so a code does not accidentally contain large blank areas or
 * shapes that look like finder patterns, either of which makes a scanner
 * hesitate or fail. All eight masks are tried and the least-penalised wins,
 * which is why small errors in the weights here degrade legibility rather
 * than correctness.
 */
export function maskPenalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: runs of five or more identical modules in a row or column.
  for (const vertical of [false, true]) {
    for (let outer = 0; outer < size; outer += 1) {
      let runColour = false;
      let runLength = 0;
      for (let inner = 0; inner < size; inner += 1) {
        const dark = vertical
          ? modules[inner]![outer]!
          : modules[outer]![inner]!;
        if (dark === runColour) {
          runLength += 1;
          if (runLength === 5) penalty += 3;
          else if (runLength > 5) penalty += 1;
        } else {
          runColour = dark;
          runLength = 1;
        }
      }
    }
  }

  // Rule 2: every 2×2 block of one colour.
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const colour = modules[y]![x]!;
      if (
        colour === modules[y]![x + 1] &&
        colour === modules[y + 1]![x] &&
        colour === modules[y + 1]![x + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: the 1:1:3:1:1 finder-like pattern with four light modules beside
  // it, which is what actually confuses a scanner looking for the corners.
  const pattern = [true, false, true, true, true, false, true];
  const matches = (read: (index: number) => boolean, start: number): boolean =>
    pattern.every((value, index) => read(start + index) === value);

  for (const vertical of [false, true]) {
    for (let outer = 0; outer < size; outer += 1) {
      const read = (index: number): boolean =>
        index < 0 || index >= size
          ? false
          : vertical
            ? modules[index]![outer]!
            : modules[outer]![index]!;
      for (let start = 0; start <= size - 7; start += 1) {
        if (!matches(read, start)) continue;
        const before = [1, 2, 3, 4].every((gap) => !read(start - gap));
        const after = [0, 1, 2, 3].every((gap) => !read(start + 7 + gap));
        if (before || after) penalty += 40;
      }
    }
  }

  // Rule 4: deviation from an even split of dark and light.
  let dark = 0;
  for (const row of modules) for (const module of row) if (module) dark += 1;
  const percent = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

export interface EncodeQrOptions {
  /** Minimum level. A denser code may still be produced if the text demands. */
  errorCorrection?: ErrorCorrectionLevel;
  /** Fixes the mask instead of choosing the least-penalised one. Tests only. */
  mask?: number;
  /** Refuses anything larger, so a print job cannot silently become unusable. */
  maxVersion?: number;
}

export class QrCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrCapacityError";
  }
}

export function encodeQr(
  text: string,
  options: EncodeQrOptions = {},
): QrMatrix {
  if (!text) throw new QrCapacityError("Nothing to encode.");
  const ecl = options.errorCorrection ?? "M";
  const maxVersion = Math.min(40, Math.max(1, options.maxVersion ?? 40));
  const mode = selectMode(text);

  let version = 0;
  for (let candidate = 1; candidate <= maxVersion; candidate += 1) {
    if (
      segmentBitLength(text, mode, candidate) <=
      dataCodewordCount(candidate, ecl) * 8
    ) {
      version = candidate;
      break;
    }
  }
  if (version === 0) {
    throw new QrCapacityError(
      `This content needs more capacity than a version ${maxVersion} code at level ${ecl} provides. Shorten the URL, or lower the error-correction level.`,
    );
  }

  const buffer = new BitBuffer();
  buffer.append(MODE_INDICATOR[mode], 4);
  buffer.append(characterCount(text, mode), characterCountBits(mode, version));
  encodeSegment(text, mode, buffer);

  const capacityBits = dataCodewordCount(version, ecl) * 8;
  buffer.append(0, Math.min(4, capacityBits - buffer.length));
  buffer.padToByte();
  const data = new Uint8Array(dataCodewordCount(version, ecl));
  const encoded = buffer.toBytes();
  data.set(encoded);
  // The alternating pad bytes are specified rather than arbitrary; a scanner
  // uses them to confirm it read to the end of the data.
  for (
    let index = encoded.length, pad = 0xec;
    index < data.length;
    index += 1
  ) {
    data[index] = pad;
    pad = pad === 0xec ? 0x11 : 0xec;
  }

  const codewords = buildCodewords(data, version, ecl);
  const size = version * 4 + 17;

  const build = (mask: number): Grid => {
    const grid: Grid = {
      modules: Array.from({ length: size }, () =>
        Array.from({ length: size }, () => false),
      ),
      reserved: Array.from({ length: size }, () =>
        Array.from({ length: size }, () => false),
      ),
    };
    drawFunctionPatterns(grid, version, size);
    drawCodewords(grid, size, codewords);
    applyMask(grid, size, mask);
    drawFormatBits(grid, size, ecl, mask);
    return grid;
  };

  let chosenMask = options.mask ?? 0;
  if (options.mask === undefined) {
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 8; mask += 1) {
      const penalty = maskPenalty(build(mask).modules);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        chosenMask = mask;
      }
    }
  }

  return {
    size,
    version,
    errorCorrection: ecl,
    mask: chosenMask,
    mode,
    modules: build(chosenMask).modules,
  };
}
