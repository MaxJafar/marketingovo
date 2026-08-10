// Reed-Solomon error correction over GF(256).
//
// This is what lets a QR code survive being scuffed, folded, printed badly or
// partly covered. It is also the reason the encoder is written here rather
// than pulled from a package: a QR code the operator prints on ten thousand
// leaflets should keep working for as long as paper lasts, which means the
// thing that generated it should have no runtime, no service and no
// dependency that can be deprecated out from under it.
//
// The field is GF(2^8) with the primitive polynomial 0x11D, as ISO/IEC 18004
// specifies. Everything below is ordinary polynomial arithmetic in that field.

const PRIMITIVE = 0x11d;

/** Antilog and log tables, built once. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value;
    LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= PRIMITIVE;
  }
  // The second half repeats so a product of two exponents never needs a
  // modulo in the inner loop.
  for (let index = 255; index < 512; index += 1) {
    EXP[index] = EXP[index - 255]!;
  }
}

export function gfMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return EXP[LOG[left]! + LOG[right]!]!;
}

/**
 * The generator polynomial for `degree` error-correction codewords.
 *
 * The product of (x - 2^i) for i in 0..degree-1, which is what the divisor
 * has to be for the remainder to correct that many symbol errors.
 */
export function generatorPolynomial(degree: number): Uint8Array {
  if (degree < 1 || degree > 255) {
    throw new RangeError("Reed-Solomon degree must be between 1 and 255");
  }
  // Coefficients run highest power first, so index 0 is the leading term.
  // The division below wants them in that order and without the leading 1,
  // which is why the result is sliced.
  let result = new Uint8Array([1]);
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    // Multiply by (x + root); in this field subtraction and addition are the
    // same operation, so the roots need no sign.
    const next = new Uint8Array(result.length + 1);
    for (let position = 0; position < result.length; position += 1) {
      next[position]! ^= result[position]!;
      next[position + 1]! ^= gfMultiply(result[position]!, root);
    }
    result = next;
    root = gfMultiply(root, 0x02);
  }
  return result.slice(1);
}

/**
 * The error-correction codewords for one block.
 *
 * Polynomial long division of the data by the generator; the remainder is the
 * correction. Written as a shift register because that is both the clearest
 * expression of the division and the fastest one.
 */
export function reedSolomonRemainder(
  data: Uint8Array,
  degree: number,
): Uint8Array {
  const generator = generatorPolynomial(degree);
  const remainder = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.copyWithin(0, 1);
    remainder[remainder.length - 1] = 0;
    for (let index = 0; index < remainder.length; index += 1) {
      remainder[index]! ^= gfMultiply(generator[index]!, factor);
    }
  }
  return remainder;
}
