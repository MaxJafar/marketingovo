# Task packet — Marketingovo terminal UI pixel assets

**Requester:** Marketingovo dashboard (`apps/dashboard`)
**Executor:** Codex (asset generation)
**Status:** open — code is already merged and renders fallbacks until these land
**Target:** `apps/dashboard/public/pixel/**` (served at `/pixel/...`)
**Runbook:** [codex-image-generation-packet.md](./codex-image-generation-packet.md)
— generation prompts, the conform tool, and the insertion map. This document
stays the authority on _what each asset is_; the runbook covers _how to make it_.

---

## 1. What this is for

The dashboard has been rebuilt as a **pixel-art CRT terminal**: a fake OS window
containing a marketing intelligence console, with a live agent chat along the
bottom edge. Every panel, chart, and control is already implemented in CSS and
SVG. What is missing is the **raster art**: nav glyphs, KPI badges, platform
marks, decorative sparkles, and three mascot characters.

The UI is fully functional without these files. Each `<PixelSprite>` renders an
inline SVG fallback when its PNG is absent, so you can deliver assets
incrementally and in any order. Dropping a correctly named file into the target
path is the entire integration step — no code change is required.

> The existing `assets/brand/marketingovo-icon.png` (3D chrome golem face) is a
> **different aesthetic and is not the reference**. It stays as the desktop
> installer icon. Do not derive any asset in this packet from it.

---

## 2. Non-negotiable style rules

These apply to every asset unless a row says otherwise.

1. **True pixel art.** Authored on a fixed low-resolution grid, one design pixel
   = one solid square. No anti-aliasing, no soft edges, no gradients that blend
   across more than the listed ramp steps, no drop shadows, no blur, no bevels.
2. **Nearest-neighbour scaling only.** Author at native grid, export at the
   listed integer multiple. A 16×16 icon exported at 4× is exactly 64×64 with
   every design pixel a crisp 4×4 block.
3. **Transparent background.** Straight (non-premultiplied) alpha. Alpha is
   binary: every pixel is either fully opaque or fully transparent. No
   semi-transparent edge pixels — they read as blur once the browser scales them.
4. **Palette discipline.** Use only the hexes in §3. Do not introduce new hues.
   Shading is done by picking a darker or lighter entry from the same ramp, not
   by reducing opacity.
5. **Chunky, readable silhouettes.** These render as small as 18 CSS px. A glyph
   must be identifiable at native grid size with no scaling. Test by viewing at
   1×; if you cannot tell a flask from a bell, simplify it.
6. **1px outlines.** Where an asset has an outline it is exactly one design
   pixel wide, in the darkest entry of that asset's ramp.
7. **Kawaii, not corporate.** The characters are friendly and rounded. Faces use
   simple dot eyes and a small curved mouth. Avoid realistic proportions.
8. **No text inside any asset.** All wordmarks and labels are live DOM text so
   they stay translatable and selectable.

---

## 3. Canonical palette

Copy these exactly. The dashboard's CSS uses the same values, so any drift shows
up immediately as a colour seam between art and UI.

### Core

| Role                      | Hex       | Notes                                                    |
| ------------------------- | --------- | -------------------------------------------------------- |
| Void (page behind window) | `#07060f` | Never used inside art, listed for contrast checks        |
| Panel base                | `#12101f` | Background the art sits on — check contrast against this |
| Panel raised              | `#1a1730` | Secondary background                                     |
| Hairline                  | `#2f2850` | Panel borders                                            |

### Neon accents

| Role                      | Hex       | Ramp (dark → light)                                       |
| ------------------------- | --------- | --------------------------------------------------------- |
| **Pink** (primary/active) | `#ff5fb0` | `#8a2a5e` · `#c73d84` · `#ff5fb0` · `#ff9ad0` · `#ffd0e8` |
| **Cyan** (secondary/idle) | `#3fe3e0` | `#1a6e6d` · `#2aa8a6` · `#3fe3e0` · `#7ff0ee` · `#c4faf9` |
| **Green** (ok/online)     | `#4be8a5` | `#1c6b4b` · `#2fa877` · `#4be8a5` · `#8ff5c8`             |
| **Gold** (starred/viral)  | `#ffd76a` | `#a6791f` · `#d9a63c` · `#ffd76a` · `#ffe9a8`             |
| **Red** (alert/error)     | `#ff6b81` | `#8f2537` · `#cc3f56` · `#ff6b81` · `#ffa9b6`             |

### Neutrals

| Role                           | Hex       |
| ------------------------------ | --------- |
| Ink (brightest text/highlight) | `#f2edff` |
| Ink soft                       | `#bfb4e0` |
| Ink faint                      | `#8f83b8` |
| Shadow (outline colour)        | `#0b0916` |

### Brand-specific

| Role                | Hex       | Notes               |
| ------------------- | --------- | ------------------- |
| Cat fur base        | `#f4f0ff` | Near-white          |
| Cat fur shade       | `#cfc6e8` |                     |
| Cat ear/blush inner | `#ff9ad0` |                     |
| Monitor shell       | `#3fe3e0` | Sidebar mascot body |
| Monitor screen      | `#0f1c2e` |                     |

---

## 4. Two delivery modes

Read this carefully — it decides how you author each file.

### Mode A — **Mask silhouette** (nav glyphs only)

Authored as a **pure white `#ffffff` silhouette on transparent**. No colour, no
shading, no outline. The dashboard applies colour with a CSS mask, so one file
serves the idle (cyan), hover (light cyan), and active (pink) states.

This means: shape only. Interior detail must be conveyed by _transparent gaps_
inside the white shape, exactly as a stencil would.

### Mode B — **Full colour** (everything else)

Authored in the §3 palette with outlines and shading as described per asset.

---

## 5. Asset inventory

### 5.1 Navigation glyphs — Mode A (mask silhouette)

**Native grid:** 16×16 · **Export:** 4× → **64×64 PNG** · **Rendered at:** 18 CSS px
**Path:** `apps/dashboard/public/pixel/nav/`

Eight of the ten sit inside a **1px rounded-square frame** (a 16×16 square with
the four corner pixels removed, glyph centred in the ~10×10 interior). Two are
free-standing glyphs that fill the grid. This matches the reference mock.

| #   | File                  | Framed? | Subject                                                                                |
| --- | --------------------- | ------- | -------------------------------------------------------------------------------------- |
| N1  | `dashboard.png`       | Yes     | A simple house: triangular roof over a square body, one door gap                       |
| N2  | `seo-analytics.png`   | **No**  | Magnifying glass — circular lens (hollow centre), thick diagonal handle to lower-right |
| N3  | `social-research.png` | **No**  | Heart with a small notch, slightly rounded — reads as "sentiment"                      |
| N4  | `content-intel.png`   | Yes     | Document page with a folded top-right corner and three text lines                      |
| N5  | `competitors.png`     | Yes     | Three ascending bars (podium/ranking)                                                  |
| N6  | `keyword-lab.png`     | Yes     | Erlenmeyer flask: narrow neck, wide triangular base, two bubble gaps                   |
| N7  | `backlinks.png`       | Yes     | Two interlocking chain links at a 45° diagonal                                         |
| N8  | `reports.png`         | Yes     | Clipboard: page with a small tab at the top centre and two lines                       |
| N9  | `alerts.png`          | Yes     | Bell: dome body, flat base bar, small clapper dot below                                |
| N10 | `notes.png`           | Yes     | Sticky note with the bottom-right corner clipped diagonally                            |

**Consistency requirement:** all eight framed glyphs must use the _same_ frame —
generate the frame once and reuse it, so the icons align perfectly in the rail.

---

### 5.2 KPI badges — Mode B (full colour)

**Native grid:** 24×24 · **Export:** 4× → **96×96 PNG** · **Rendered at:** 44 CSS px
**Path:** `apps/dashboard/public/pixel/kpi/`

Large glyphs beside each headline number. Each is a filled glyph in its accent
ramp with a `#0b0916` 1px outline and one highlight step on the top-left edge.

| #   | File             | Accent ramp | Subject                                                                                                    |
| --- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| K1  | `visibility.png` | Pink        | Magnifying glass, lens ring thick enough to shade, handle to lower-right                                   |
| K2  | `traffic.png`    | Cyan        | Framed chart: a square frame containing an ascending zig-zag line with a filled arrowhead at the top-right |
| K3  | `mentions.png`   | Pink        | Rounded speech bubble with a tail at the lower-left and three ink-soft dots inside                         |
| K4  | `sentiment.png`  | Cyan        | Heart with a 2px highlight wedge in the upper-left lobe                                                    |

---

### 5.3 Panel header marks — Mode B (full colour)

**Native grid:** 16×16 · **Export:** 4× → **64×64 PNG** · **Rendered at:** 22 CSS px
**Path:** `apps/dashboard/public/pixel/panel/`

Small decorative marks pinned to the top-right of each panel. These are the
"charm" details — they should feel hand-placed and slightly playful.

| #   | File         | Subject                                                                                         |
| --- | ------------ | ----------------------------------------------------------------------------------------------- |
| P1  | `coffee.png` | Steaming mug — ink-soft cup, pink handle, two cyan steam curls rising above the rim             |
| P2  | `chat.png`   | Speech bubble outline in cyan with a pink tail                                                  |
| P3  | `star.png`   | Five-point star, gold ramp, single highlight pixel top-left                                     |
| P4  | `target.png` | Dartboard — three concentric rings alternating pink / panel-base / pink, with a gold centre dot |
| P5  | `feed.png`   | Newspaper — a page with a folded corner and a small masthead block, ink-soft with cyan lines    |

---

### 5.4 Content feed badges — Mode B (full colour)

**Native grid:** 20×20 · **Export:** 4× → **80×80 PNG** · **Rendered at:** 28 CSS px
**Path:** `apps/dashboard/public/pixel/feed/`

Rounded-square tiles (filled `#1a1730` with a 1px accent border) each containing
a small white/accent glyph. These sit at the left of each content feed row.

| #   | File            | Border | Glyph                                                           |
| --- | --------------- | ------ | --------------------------------------------------------------- |
| F1  | `strategy.png`  | Cyan   | Ascending bar chart, three bars                                 |
| F2  | `trend.png`     | Pink   | Target/crosshair — a ring with a centre dot and four tick marks |
| F3  | `benchmark.png` | Pink   | Two overlapping person silhouettes (head + shoulders)           |

---

### 5.5 Social platform marks — Mode B (full colour)

**Native grid:** 16×16 · **Export:** 4× → **64×64 PNG** · **Rendered at:** 20 CSS px
**Path:** `apps/dashboard/public/pixel/social/`

Pixel-art interpretations of each platform's mark. Keep them **recognisable by
silhouette** but rendered in our palette — these are stylised, not official
brand assets.

| #   | File            | Colour                | Subject                                                                     |
| --- | --------------- | --------------------- | --------------------------------------------------------------------------- |
| S1  | `twitter.png`   | `#3fa8f0` bird ramp   | Simplified bird in flight, wing raised                                      |
| S2  | `instagram.png` | Pink ramp             | Rounded-square camera outline, circular lens, one highlight dot top-right   |
| S3  | `tiktok.png`    | Ink + cyan + pink     | Eighth note with a cyan offset ghost edge on the left and pink on the right |
| S4  | `reddit.png`    | `#ff7a3c` orange ramp | Round alien head, two antenna dots, two white eyes                          |

> **Trademark note:** these are third-party marks rendered in a house style for
> a data-source legend. Keep them clearly stylised and do not reproduce official
> logo geometry pixel-for-pixel. Flag back if any row feels too close.

---

### 5.6 Mascots — Mode B (full colour, hero art)

**Path:** `apps/dashboard/public/pixel/mascot/`

These are the personality of the product. Spend the most time here.

#### M1 — `cat-hero.png`

- **Native grid:** 48×42 · **Export:** 4× → **192×168 PNG** · **Rendered at:** ~150 CSS px wide
- **Placement:** top-right of the welcome banner, beside a "data never sleeps"
  speech bubble that is drawn in CSS (do not include the bubble).
- **Subject:** a seated robot cat, front-facing, three-quarter friendly posture.
  - Fur `#f4f0ff` base with `#cfc6e8` shading along the lower-left and under the chin.
  - Two triangular ears, inner ear `#ff9ad0`.
  - Face: two dot eyes in `#0b0916`, a small `#ff9ad0` blush patch under each eye,
    tiny curved mouth.
  - Wearing **cyan headphones** (`#3fe3e0` band and ear cups) — the band arcs
    over the head between the ears.
  - A small **pink heart** (`#ff5fb0`) on the chest, 3×3 design pixels.
  - **Left paw raised in a wave** — this is the key pose, it must read clearly.
  - Tail curling up on the right side.
  - 1px `#0b0916` outline around the whole silhouette.

#### M2 — `monitor-buddy.png`

- **Native grid:** 44×40 · **Export:** 4× → **176×160 PNG** · **Rendered at:** ~140 CSS px wide
- **Placement:** sidebar, directly under the boot-log terminal panel.
- **Subject:** a chunky CRT monitor character.
  - Shell `#3fe3e0` with `#2aa8a6` shading on the lower and right edges.
  - Screen `#0f1c2e` inset, showing a **smiling face**: two `#f2edff` dot eyes
    and a wide curved `#f2edff` smile.
  - **Pink headphones** (`#ff5fb0`) clamped over the top of the monitor.
  - A thin **antenna** rising from the top-left with a `#ff5fb0` heart at the tip.
  - Small stand/feet at the bottom in `#2aa8a6`.
  - 1px `#0b0916` outline.

#### M3 — `blob-buddy.png`

- **Native grid:** 20×24 · **Export:** 4× → **80×96 PNG** · **Rendered at:** ~56 CSS px wide
- **Placement:** bottom-right corner, peeking over the content feed panel edge.
- **Subject:** a small pink ghost/blob.
  - Body `#ff5fb0` with `#c73d84` shading on the lower-right.
  - Flat rounded dome top, wavy bottom edge with three scallops.
  - Two `#0b0916` dot eyes, no mouth.
  - Two tiny `#ff9ad0` arm nubs.
  - 1px `#0b0916` outline.

#### M4 — `cat-mark.png`

- **Native grid:** 16×16 · **Export:** 4× → **64×64 PNG** · **Rendered at:** 34 CSS px
- **Placement:** sidebar logo lockup, immediately left of the "marketingovo"
  wordmark (wordmark is live text — do not draw it).
- **Subject:** the M1 cat's **head only**, front-facing, no headphones. Same fur
  and ear colours, dot eyes, blush. Must stay legible at 16 CSS px because it is
  also the favicon source.

---

### 5.7 Decorative sparkles — Mode B (full colour)

**Native grid:** 8×8 · **Export:** 4× → **32×32 PNG** · **Rendered at:** 12–18 CSS px
**Path:** `apps/dashboard/public/pixel/deco/`

Scattered around the welcome banner. Each is a four-point "twinkle": a vertical
and horizontal spike crossing at the centre, thickest at the middle, tapering to
a single pixel at each tip.

| #   | File               | Colour                                                           |
| --- | ------------------ | ---------------------------------------------------------------- |
| D1  | `sparkle-ink.png`  | `#f2edff` core, `#bfb4e0` tips                                   |
| D2  | `sparkle-pink.png` | `#ff9ad0` core, `#ff5fb0` tips                                   |
| D3  | `sparkle-cyan.png` | `#7ff0ee` core, `#3fe3e0` tips                                   |
| D4  | `star-gold.png`    | Five-point star, gold ramp — slightly larger, fills the 8×8 grid |

---

### 5.8 Favicon set

**Path:** `apps/dashboard/public/`

Derived from **M4 `cat-mark.png`**, on a **`#12101f` opaque background** (not
transparent — it renders against light browser chrome).

| #   | File              | Size                                                  |
| --- | ----------------- | ----------------------------------------------------- |
| I1  | `favicon-16.png`  | 16×16 (native grid, no scaling)                       |
| I2  | `favicon-32.png`  | 32×32 (2×)                                            |
| I3  | `favicon-180.png` | 180×180 (apple-touch, cat centred with ~16px padding) |

---

## 6. Font request

The UI currently falls back to the system monospace stack, which loses most of
the pixel character. Please supply a self-hosted pixel font.

- **Requested face:** [Departure Mono](https://departuremono.com/) — SIL OFL 1.1.
  If unavailable, **Silkscreen** or **Pixelify Sans** (both OFL 1.1) are
  acceptable substitutes; state which you used.
- **Deliver:**
  - `apps/dashboard/public/pixel/font/departure-mono.woff2` (primary)
  - `apps/dashboard/public/pixel/font/departure-mono.woff` (fallback)
- **Subset:** Latin-1 + `→ ↑ ↓ ✓ ✗ ★ ♥ • ▸ ░ ▒ █`. Keep it under 40 KB.
- **Licensing (required, the repo gates on this):**
  - Add the upstream OFL licence text at
    `apps/dashboard/public/pixel/font/OFL.txt`.
  - Add an attribution entry to the repo `NOTICE` file naming the font, its
    author, and the OFL 1.1 licence.
  - Confirm the licence permits web embedding and redistribution — do not ship a
    face that requires a commercial web licence.

The stylesheet already declares `--font-pixel` with the correct `@font-face`
name; dropping these files in activates it.

---

## 7. Export and delivery checklist

Every file must satisfy all of these:

- [ ] PNG-32, straight alpha, transparent background (except favicons)
- [ ] Binary alpha — zero pixels between 1 and 254 alpha
- [ ] Exact dimensions from §5, produced by nearest-neighbour upscale from the native grid
- [ ] Only hexes from §3 present (verify with a colour-count pass; unexpected hexes mean anti-aliasing crept in)
- [ ] Filename and directory exactly as listed — the code path-matches on these
- [ ] Optimised losslessly (`oxipng -o4` or `pngquant` at full quality); target under 8 KB each, mascots under 20 KB
- [ ] Legible at 1× native grid with no scaling

**Also deliver:** the editable native-grid sources (Aseprite `.aseprite`, or
lossless native-size PNGs) to `assets/pixel/src/` so the set can be revised
later without re-deriving from the exports.

---

## 8. How the code consumes these

For reference, so you can verify placement yourself.

Mask silhouettes (§5.1) are applied as CSS masks and coloured by state:

```css
.pixel-nav-icon {
  mask-image: url("/pixel/nav/dashboard.png");
  mask-size: contain;
  background-color: var(--cyan); /* becomes var(--accent) when active */
}
```

Full-colour assets (§5.2–5.7) render through a shared component that falls back
to an inline SVG when the PNG is missing:

```tsx
<PixelSprite src="/pixel/kpi/visibility.png" fallback="visibility" size={44} />
```

All raster art is scaled with `image-rendering: pixelated`, so any anti-aliased
edge you leave in the file is magnified rather than hidden.

To check your work, run the dashboard and compare against the reference mock:

```bash
pnpm --filter @marketingovo/dashboard dev
```

---

## 9. Priority order

If the work is split across passes, deliver in this order — earlier groups have
the biggest visual impact:

1. **§5.6 mascots** (M1, M2, M4) — carries the entire personality
2. **§5.1 nav glyphs** — the fallbacks are the weakest there
3. **§5.2 KPI badges**
4. **§6 font** — biggest single upgrade to overall fidelity
5. **§5.3–5.5** panel marks, feed badges, social marks
6. **§5.7 sparkles**, **§5.8 favicons**, M3 blob
