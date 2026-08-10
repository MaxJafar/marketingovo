/**
 * What a file actually is, decided from its bytes.
 *
 * A filename extension and a multipart `Content-Type` are both supplied by the
 * caller, and neither is evidence about the content. Sniffing matters here for
 * two separate reasons: a platform will reject a file whose real type does not
 * match what we declared to it, and an upload endpoint that trusts a declared
 * type is a way to store something the operator did not intend.
 *
 * Deliberately narrow. Only the formats the supported platforms actually
 * accept are recognized; anything else is refused with its detected type
 * named, rather than passed through and rejected later by a provider.
 */

export type SniffedMediaKind = "image" | "video";

export interface SniffedMedia {
  mediaType: string;
  kind: SniffedMediaKind;
  /** Present when the dimensions are cheaply readable from the header. */
  width: number | null;
  height: number | null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  Array.from(bytes.slice(offset, offset + length))
    .map((byte) => String.fromCharCode(byte))
    .join("");

/** PNG carries width and height as big-endian 32-bit values in the IHDR. */
function pngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.byteLength < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * JPEG dimensions live in whichever SOF segment appears first, so the marker
 * chain has to be walked. Bounded to the first 64 KiB: a JPEG that has not
 * declared its size by then is malformed for our purposes, and walking an
 * arbitrary file looking for a two-byte marker is how a parser becomes a
 * denial-of-service surface.
 */
function jpegDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const limit = Math.min(bytes.byteLength, 65_536);
  let offset = 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 9 < limit) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    // SOF0..SOF15, excluding the non-frame markers in that range.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

export function sniffMedia(bytes: Uint8Array): SniffedMedia | null {
  if (bytes.byteLength < 12) return null;

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const dimensions = pngDimensions(bytes);
    return {
      mediaType: "image/png",
      kind: "image",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const dimensions = jpegDimensions(bytes);
    return {
      mediaType: "image/jpeg",
      kind: "image",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }

  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return {
      mediaType: "image/webp",
      kind: "image",
      width: null,
      height: null,
    };
  }

  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      mediaType: "image/gif",
      kind: "image",
      // GIF stores dimensions little-endian, immediately after the signature.
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  }

  // ISO base media: a `ftyp` box at offset 4. Covers MP4 and MOV, which is
  // every video format the supported platforms take.
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    return {
      mediaType: brand === "qt  " ? "video/quicktime" : "video/mp4",
      kind: "video",
      width: null,
      height: null,
    };
  }

  return null;
}

/** Extension for a sniffed type, used only for the stored filename. */
export function extensionForMediaType(mediaType: string): string {
  switch (mediaType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/quicktime":
      return "mov";
    case "video/mp4":
      return "mp4";
    default:
      return "bin";
  }
}
