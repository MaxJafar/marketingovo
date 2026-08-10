// Turning a module matrix into something you can put on a poster.
//
// SVG is the primary format because print is the point: a vector code is
// exact at any size, and a printer will not resample it into blur. PNG is
// produced through Node's own zlib so raster output needs no dependency
// either.

import { deflateSync } from "node:zlib";
import type { QrMatrix } from "./encode.js";

export interface QrRenderOptions {
  /**
   * Modules of empty margin. The standard requires four, and scanners really
   * do fail without it — the quiet zone is how a camera finds the code's edge
   * against a busy page.
   */
  quietZone?: number;
  /** Any CSS colour for SVG; `#rrggbb` for PNG. */
  darkColor?: string;
  lightColor?: string;
  /** Omits the light background entirely, for placing on artwork. */
  transparent?: boolean;
  /** Pixels per module. PNG only. */
  scale?: number;
}

const DEFAULTS = {
  quietZone: 4,
  darkColor: "#000000",
  lightColor: "#ffffff",
  scale: 8,
} as const;

function resolveQuietZone(options: QrRenderOptions): number {
  return Math.max(0, Math.min(16, options.quietZone ?? DEFAULTS.quietZone));
}

/**
 * SVG, as a single path.
 *
 * One path rather than a rect per module keeps a version 40 code around 40kB
 * instead of 300kB, and stops print software from rendering hairline seams
 * between adjacent modules.
 */
export function renderQrSvg(
  matrix: QrMatrix,
  options: QrRenderOptions = {},
): string {
  const quiet = resolveQuietZone(options);
  const extent = matrix.size + quiet * 2;
  const dark = options.darkColor ?? DEFAULTS.darkColor;
  const light = options.lightColor ?? DEFAULTS.lightColor;

  const segments: string[] = [];
  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.modules[y]!;
    let x = 0;
    while (x < matrix.size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      // Runs are merged horizontally; a typical code has far fewer runs than
      // dark modules, and adjacent squares in one subpath never seam.
      let run = 1;
      while (x + run < matrix.size && row[x + run]) run += 1;
      segments.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`);
      x += run;
    }
  }

  const background = options.transparent
    ? ""
    : `<rect width="${extent}" height="${extent}" fill="${light}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"`,
    ` width="${extent * 4}" height="${extent * 4}" shape-rendering="crispEdges"`,
    ` role="img" aria-label="QR code">`,
    background,
    `<path fill="${dark}" d="${segments.join("")}"/>`,
    `</svg>`,
  ].join("");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, body: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + body.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length);
  chunk.set(typeBytes, 4);
  chunk.set(body, 8);
  view.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
  return chunk;
}

function parseHexColor(value: string, fallback: [number, number, number]) {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!match) return fallback;
  const hex = match[1]!;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ] as [number, number, number];
}

/**
 * PNG, written by hand.
 *
 * Truecolour rather than the more compact one-bit greyscale, because brand
 * colours are the first thing anyone asks for and refusing them just means
 * the code gets recoloured in an image editor, where nothing checks contrast.
 */
export function renderQrPng(
  matrix: QrMatrix,
  options: QrRenderOptions = {},
): Uint8Array {
  const quiet = resolveQuietZone(options);
  const scale = Math.max(1, Math.min(64, options.scale ?? DEFAULTS.scale));
  const modulesPerSide = matrix.size + quiet * 2;
  const extent = modulesPerSide * scale;

  const dark = parseHexColor(
    options.darkColor ?? DEFAULTS.darkColor,
    [0, 0, 0],
  );
  const light = parseHexColor(
    options.lightColor ?? DEFAULTS.lightColor,
    [255, 255, 255],
  );

  const stride = extent * 3 + 1;
  const raw = new Uint8Array(stride * extent);
  for (let pixelY = 0; pixelY < extent; pixelY += 1) {
    const rowStart = pixelY * stride;
    // Filter type 0. Adaptive filtering would compress better, but a QR is a
    // few kilobytes either way and this stays auditable.
    raw[rowStart] = 0;
    const moduleY = Math.floor(pixelY / scale) - quiet;
    const row =
      moduleY >= 0 && moduleY < matrix.size ? matrix.modules[moduleY]! : null;
    for (let pixelX = 0; pixelX < extent; pixelX += 1) {
      const moduleX = Math.floor(pixelX / scale) - quiet;
      const isDark =
        row !== null && moduleX >= 0 && moduleX < matrix.size && row[moduleX]!;
      const colour = isDark ? dark : light;
      const offset = rowStart + 1 + pixelX * 3;
      raw[offset] = colour[0];
      raw[offset + 1] = colour[1];
      raw[offset + 2] = colour[2];
    }
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, extent);
  headerView.setUint32(4, extent);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
    pngChunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}
