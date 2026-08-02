#!/usr/bin/env node
/**
 * Conform a generated image into a spec-compliant pixel-art asset.
 *
 * Image generators cannot produce pixel art. They produce a picture *of* pixel
 * art: soft edges, thousands of near-duplicate colours, a feathered alpha halo,
 * and a grid that drifts by a fraction of a pixel across the canvas. Dropping
 * that straight into the dashboard looks wrong the moment it is scaled, because
 * `image-rendering: pixelated` magnifies every one of those artefacts.
 *
 * So this is the mandatory second half of generation. It resamples the image
 * down to its true design grid, snaps every cell to the project palette, makes
 * alpha strictly binary, and scales back up with nearest-neighbour. What comes
 * out satisfies the acceptance checklist in
 * docs/design/terminal-ui-asset-packet.md by construction rather than by luck.
 *
 * Dependency-free on purpose: it decodes and encodes PNG itself using nothing
 * but node:zlib, so it runs in a bare checkout with no install step.
 *
 * Usage:
 *   node scripts/pixelize-asset.mjs <input.png> --grid 16x16 --out <dest.png>
 *   node scripts/pixelize-asset.mjs raw.png --grid 24x24 --scale 4 --out kpi.png
 *   node scripts/pixelize-asset.mjs raw.png --grid 16x16 --mask --out nav.png
 *
 * Options:
 *   --grid WxH      Native design grid. Required.
 *   --scale N       Integer upscale for the exported file. Default 4.
 *   --out PATH      Destination. Required.
 *   --mask          Emit a white silhouette (Mode A assets: the nav glyphs).
 *   --alpha N       Alpha cutoff, 0-1. Default 0.5.
 *   --palette PATH  JSON array of hex strings. Defaults to the project palette.
 *   --report        Print a colour census instead of staying quiet.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inflateSync, deflateSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/* Project palette                                                     */
/* ------------------------------------------------------------------ */

const PALETTE = [
  "#07060f",
  "#12101f",
  "#1a1730",
  "#0d0b1a",
  "#2f2850",
  "#221d3d",
  "#8a2a5e",
  "#c73d84",
  "#ff5fb0",
  "#ff9ad0",
  "#ffd0e8",
  "#1a6e6d",
  "#2aa8a6",
  "#3fe3e0",
  "#7ff0ee",
  "#c4faf9",
  "#1c6b4b",
  "#2fa877",
  "#4be8a5",
  "#8ff5c8",
  "#a6791f",
  "#d9a63c",
  "#ffd76a",
  "#ffe9a8",
  "#8f2537",
  "#cc3f56",
  "#ff6b81",
  "#ffa9b6",
  "#f2edff",
  "#bfb4e0",
  "#8f83b8",
  "#0b0916",
  "#f4f0ff",
  "#cfc6e8",
  "#0f1c2e",
  // Platform marks are the one sanctioned departure: a Twitter blue and a
  // Reddit orange that no in-house ramp covers.
  "#3fa8f0",
  "#ff7a3c",
];

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbToHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/* ------------------------------------------------------------------ */
/* PNG decode                                                          */
/* ------------------------------------------------------------------ */

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Not a PNG file.");
  }
  let offset = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  const data = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
  }

  if (!header) throw new Error("PNG is missing its IHDR chunk.");
  if (header.depth !== 8) {
    throw new Error(
      `Only 8-bit PNGs are supported; this file is ${header.depth}-bit. Re-export it as 8-bit.`,
    );
  }
  if (header.interlace !== 0) {
    throw new Error(
      "Interlaced (Adam7) PNGs are not supported. Re-export without interlacing.",
    );
  }

  const channelCount = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType];
  if (!channelCount) {
    throw new Error(`Unsupported PNG colour type ${header.colorType}.`);
  }

  const raw = inflateSync(Buffer.concat(data));
  const { width, height } = header;
  const stride = width * channelCount;
  const pixels = unfilter(raw, width, height, channelCount, stride);

  // Everything downstream works in RGBA, so normalise here once.
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * channelCount;
    const target = index * 4;
    if (header.colorType === 0) {
      rgba[target] = rgba[target + 1] = rgba[target + 2] = pixels[source];
      rgba[target + 3] = 255;
    } else if (header.colorType === 2) {
      rgba.set(pixels.subarray(source, source + 3), target);
      rgba[target + 3] = 255;
    } else if (header.colorType === 3) {
      const entry = pixels[source] * 3;
      if (!palette) throw new Error("Indexed PNG is missing its PLTE chunk.");
      rgba[target] = palette[entry];
      rgba[target + 1] = palette[entry + 1];
      rgba[target + 2] = palette[entry + 2];
      rgba[target + 3] = transparency?.[pixels[source]] ?? 255;
    } else if (header.colorType === 4) {
      rgba[target] = rgba[target + 1] = rgba[target + 2] = pixels[source];
      rgba[target + 3] = pixels[source + 1];
    } else {
      rgba.set(pixels.subarray(source, source + 4), target);
    }
  }
  return { width, height, rgba };
}

function unfilter(raw, width, height, channels, stride) {
  const out = new Uint8Array(width * height * channels);
  let previous = new Uint8Array(stride);
  let cursor = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const current = new Uint8Array(stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? current[index - channels] : 0;
      const up = previous[index];
      const upLeft = index >= channels ? previous[index - channels] : 0;
      const value = line[index];
      current[index] =
        filter === 0
          ? value
          : filter === 1
            ? (value + left) & 0xff
            : filter === 2
              ? (value + up) & 0xff
              : filter === 3
                ? (value + ((left + up) >> 1)) & 0xff
                : (value + paeth(left, up, upLeft)) & 0xff;
    }
    out.set(current, row * stride);
    previous = current;
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/* ------------------------------------------------------------------ */
/* PNG encode                                                          */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * (stride + 1)] = 0; // filter: none — the art is flat, so it wins
    Buffer.from(rgba.buffer, rgba.byteOffset + row * stride, stride).copy(
      raw,
      row * (stride + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Conform                                                             */
/* ------------------------------------------------------------------ */

/** Perceptually weighted distance — plain Euclidean over-favours blue. */
function distance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

function pixelize(image, options) {
  const { gridWidth, gridHeight, alphaCutoff, mask, palette } = options;
  const cells = new Uint8Array(gridWidth * gridHeight * 4);
  const cellWidth = image.width / gridWidth;
  const cellHeight = image.height / gridHeight;
  let worstDistance = 0;

  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const x0 = Math.floor(gx * cellWidth);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cellWidth));
      const y0 = Math.floor(gy * cellHeight);
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * cellHeight));

      // Average in premultiplied space so a transparent halo cannot drag the
      // colour of a solid cell toward whatever the generator left behind it.
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = (y * image.width + x) * 4;
          const alpha = image.rgba[index + 3] / 255;
          r += image.rgba[index] * alpha;
          g += image.rgba[index + 1] * alpha;
          b += image.rgba[index + 2] * alpha;
          a += alpha;
          count += 1;
        }
      }

      const target = (gy * gridWidth + gx) * 4;
      const coverage = a / count;
      if (coverage < alphaCutoff) continue; // stays fully transparent

      const source = [Math.round(r / a), Math.round(g / a), Math.round(b / a)];

      if (mask) {
        cells[target] = cells[target + 1] = cells[target + 2] = 255;
        cells[target + 3] = 255;
        continue;
      }

      let best = palette[0];
      let bestDistance = Infinity;
      for (const candidate of palette) {
        const d = distance(source, candidate);
        if (d < bestDistance) {
          bestDistance = d;
          best = candidate;
        }
      }
      worstDistance = Math.max(worstDistance, bestDistance);
      cells[target] = best[0];
      cells[target + 1] = best[1];
      cells[target + 2] = best[2];
      cells[target + 3] = 255;
    }
  }

  return { cells, worstDistance };
}

function upscale(cells, gridWidth, gridHeight, scale) {
  const width = gridWidth * scale;
  const height = gridHeight * scale;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < width; x += 1) {
      const sx = Math.floor(x / scale);
      const source = (sy * gridWidth + sx) * 4;
      const target = (y * width + x) * 4;
      out[target] = cells[source];
      out[target + 1] = cells[source + 1];
      out[target + 2] = cells[source + 2];
      out[target + 3] = cells[source + 3];
    }
  }
  return { width, height, rgba: out };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === "mask" || key === "report") flags.set(key, true);
    else {
      index += 1;
      flags.set(key, argv[index]);
    }
  }
  return { positional, flags };
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const input = positional[0];
  const out = flags.get("out");
  const grid = flags.get("grid");

  if (!input || !out || !grid) {
    console.error(
      "usage: node scripts/pixelize-asset.mjs <input.png> --grid WxH --out <dest.png> [--scale 4] [--mask] [--alpha 0.5] [--palette p.json] [--report]",
    );
    process.exit(2);
  }

  const match = /^(\d+)x(\d+)$/u.exec(grid);
  if (!match) throw new Error(`--grid must look like 16x16, got "${grid}"`);
  const gridWidth = Number(match[1]);
  const gridHeight = Number(match[2]);
  const scale = Number(flags.get("scale") ?? 4);
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error("--scale must be a positive integer");
  }
  const alphaCutoff = Number(flags.get("alpha") ?? 0.5);

  const paletteHex = flags.has("palette")
    ? JSON.parse(readFileSync(resolve(flags.get("palette")), "utf8"))
    : PALETTE;
  const palette = paletteHex.map(hexToRgb);

  const image = decodePng(readFileSync(resolve(input)));
  const { cells, worstDistance } = pixelize(image, {
    gridWidth,
    gridHeight,
    alphaCutoff,
    mask: flags.has("mask"),
    palette,
  });
  const scaled = upscale(cells, gridWidth, gridHeight, scale);

  const destination = resolve(out);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    encodePng(scaled.width, scaled.height, scaled.rgba),
  );

  const census = new Map();
  let opaque = 0;
  for (let index = 0; index < cells.length; index += 4) {
    if (cells[index + 3] === 0) continue;
    opaque += 1;
    const hex = rgbToHex([cells[index], cells[index + 1], cells[index + 2]]);
    census.set(hex, (census.get(hex) ?? 0) + 1);
  }

  console.log(
    `${out}  ${scaled.width}x${scaled.height}  grid ${gridWidth}x${gridHeight}  ` +
      `${census.size} colours  ${opaque}/${gridWidth * gridHeight} cells opaque`,
  );

  // A large snap distance means the generated art was not in-palette, which is
  // usually a sign the prompt drifted rather than something to quietly accept.
  if (!flags.has("mask") && worstDistance > 12_000) {
    console.warn(
      `  warning: some cells were far from the palette (${Math.round(Math.sqrt(worstDistance))} weighted units). Check the source colours against the packet.`,
    );
  }
  if (opaque === 0) {
    console.warn(
      "  warning: every cell is transparent. Is the subject on a transparent background with the right alpha?",
    );
  }

  if (flags.has("report")) {
    for (const [hex, count] of [...census].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${hex}  ${count}`);
    }
  }
}

main();
