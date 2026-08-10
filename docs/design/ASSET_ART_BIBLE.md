# Marketingovo Terminal UI Asset Art Bible

Status: `draft`  
Version: `1.0.0`  
Owner / approval record: `Marketingovo product owner; promotion to approved/locked is pending review`  
Machine companion: [asset_style_lock.json](./asset_style_lock.json)

## Authority and scope

- [terminal-ui-asset-packet.md](./terminal-ui-asset-packet.md) — approved
  palette, grids, sprite roles, placement, and delivery constraints. Role:
  style, material, and composition authority.
- [codex-image-generation-packet.md](./codex-image-generation-packet.md) —
  generation/conform/verification workflow. Role: production authority.
- The supplied dashboard screenshot — review-only composition and mood
  reference; it does not override the packet's exact palette or grids.

The packet defines a product UI asset family, not gameplay art. It is the
limit of what may be derived: no new characters, brand marks, text, claims, or
third-party trade dress may be inferred from the screenshot.

## Brand promise

Marketingovo should feel like a friendly, capable intelligence terminal: a
small machine that turns noisy marketing signals into a readable operating
surface. The pixel language makes a data-heavy dashboard feel approachable
without weakening its evidence-first, local-first product character.

## Locked visual signature

- **Medium and materials:** authored low-resolution pixel art, exported only by
  integer nearest-neighbour scaling; flat solid colour blocks and binary alpha.
- **Shape language and layout:** chunky readable silhouettes, square corners,
  one-design-pixel outlines, simple dot faces, and intentional transparent
  gaps for mask glyphs.
- **Lighting and depth:** flat graphic lighting; depth comes from palette ramps,
  not blur, glow, gradients, bevels, or soft shadows.
- **Palette:** the exact `--px-*` palette in the terminal packet, including
  `#12101f`, `#1a1730`, `#2f2850`, pink/cyan ramps, neutral ink, cat fur, and
  monitor shell colours. Twitter blue `#3fa8f0` and Reddit orange `#ff7a3c`
  are sanctioned platform-mark exceptions only.
- **Texture and motion cues:** restrained CRT/terminal mood; no noise or
  texture inside sprites; live CSS may provide scanlines and state animation.
- **Typography behavior:** live DOM text only. Use the vendored Departure Mono
  font and its documented fallback stack; never bake UI copy into raster art.
- **Brand-mark behavior:** the cat mark and wordmark are separate assets; the
  wordmark is drawn with licensed live pixel type/rasterized at integer scale,
  not generated lettering.

## Visual anchors

| ID               | Path or source                                                            | Role           | Permitted use                   | Immutable traits                                    |
| ---------------- | ------------------------------------------------------------------------- | -------------- | ------------------------------- | --------------------------------------------------- |
| packet           | `docs/design/terminal-ui-asset-packet.md`                                 | style/material | all Marketingovo pixel sprites  | exact grids, palette, roles, binary alpha           |
| runbook          | `docs/design/codex-image-generation-packet.md`                            | production     | generation and conform workflow | 1024-ish source, `pixelize-asset.mjs`, scale 4      |
| reference-screen | `user-provided: codex-clipboard-1b13522e-fd65-43b5-ba13-0b760f552717.png` | composition    | mood and placement review only  | dark terminal frame, neon pink/cyan, kawaii mascots |

## Asset-family contracts

### Navigation mask glyphs

Use a 16x16 native grid, exported to 64x64, pure white silhouette on
transparent binary alpha. Framed glyphs share one rounded-square frame;
free-standing magnifier and heart do not. No colour, shading, text, or
third-party logo geometry.

### Full-colour UI sprites

Use the packet's native grid and scale 4. Use only the canonical palette and
one-pixel outlines/shading where specified. Keep the subject centred with
transparent negative space and no baked labels.

### Mascots

Keep the cat, monitor, and blob as friendly rounded pixel characters with
simple faces and clearly readable silhouettes at their actual CSS sizes. The
cat's raised left paw, monitor's smile, and blob's scalloped lower edge are
required anchors; do not add speech bubbles or UI copy.

### Brand and favicon assets

Use editable/licensed type for the wordmark and derive favicons from the
conformed cat mark on opaque `#12101f`. Do not derive them from the unrelated
3D installer icon.

## Non-negotiable prohibitions

- anti-aliasing, semi-transparent edge pixels, blur, glow, bloom, gradients,
  bevels, drop shadows, or mixed-size grid cells;
- AI-rendered UI text, wordmarks, labels, numbers, or claims inside sprites;
- palette substitutions, unapproved hues, or a non-binary alpha channel;
- literal reproduction of third-party social logos or copied trade dress;
- realistic anatomy, corporate stock illustration, or extra characters/props;
- using `assets/brand/marketingovo-icon.png` as a source for terminal UI art.

## Production and provenance rules

Generator sources live under `assets/pixel/src/`; shipping sprites live under
`apps/dashboard/public/pixel/`. Clean chroma-key source images in a temporary
workspace, run `node scripts/pixelize-asset.mjs` with the packet grid and
`--scale 4`, then inspect the native grid and in-product crop. Preserve the
raw source plus the conformed output when a source remains useful; do not add
new untracked full-resolution intermediates. Final PNGs must be lossless,
binary-alpha, palette-snapped, and nearest-neighbour scaled. Keep UI text live
in the engine and record source, roles, prompt/workflow, post-processing,
dimensions, hashes, review result, and promotion state in the asset ledger.

## Open decisions

- Owner approval is required before promoting this draft lock to
  `approved`/`locked` production authority.
- Confirm whether a future font subset should retain the full box-drawing set
  currently shipped by Departure Mono or be reduced to the packet's explicit
  symbol list.

## Change control

Change a locked palette, grid, character silhouette, type strategy, or logo
geometry only through a versioned amendment naming the decision owner,
rationale, affected asset family, migration plan, and review date. Regenerate
affected briefs after an amendment; do not silently reinterpret old prompts.
