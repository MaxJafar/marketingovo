# Task packet — generate and install the terminal UI sprites

**Executor:** Codex, using an image-generation plugin
**Companion spec:** [terminal-ui-asset-packet.md](./terminal-ui-asset-packet.md) — the
authoritative description of every asset. This packet is the _runbook_: prompts
to generate with, the tool that conforms the output, and where each file goes.
**Scope:** 37 PNGs + 1 font. Nothing else in the repo needs to change except the
one favicon edit in §7.

---

## 1. Before you start

The dashboard already renders inline SVG stand-ins for every one of these
sprites, so the UI is not broken while you work and you can install assets one
at a time. Dropping a correctly named file at the correct path is the entire
integration — `PixelSprite` probes for it and upgrades itself. **No component
code needs editing.**

Read §2 before generating anything. The generation step alone will not produce
usable output.

---

## 2. The loop: generate → conform → verify

### Why the middle step is not optional

An image model cannot output pixel art. It outputs a _picture of_ pixel art:
anti-aliased edges, a few thousand near-duplicate colours, a feathered alpha
halo, and a "grid" that drifts by fractions of a pixel across the canvas. The
dashboard scales every sprite with `image-rendering: pixelated`, which magnifies
each of those artefacts instead of hiding them.

So every generated image goes through the conform tool, which resamples it to
its true design grid, snaps each cell to the project palette, forces alpha to be
strictly binary, and scales back up with nearest-neighbour. Its output satisfies
the acceptance checklist by construction.

```bash
node scripts/pixelize-asset.mjs <generated.png> --grid 16x16 --scale 4 --out apps/dashboard/public/pixel/nav/dashboard.png
```

The tool is dependency-free (it decodes and encodes PNG using only `node:zlib`),
so it runs in a bare checkout with no install step.

**Options you will need:**

| Flag         | Meaning                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `--grid WxH` | Native design grid. Taken from the per-asset table below. Required.                                                          |
| `--scale N`  | Integer upscale for the exported file. Always `4` here.                                                                      |
| `--out PATH` | Destination. Directories are created for you.                                                                                |
| `--mask`     | Emit a pure white silhouette. **Use for every §4 nav glyph.**                                                                |
| `--report`   | Print the colour census, useful when an asset looks wrong.                                                                   |
| `--alpha N`  | Coverage cutoff, 0–1. Default `0.5`; raise toward `0.7` if a glyph comes out fat, lower toward `0.3` if thin details vanish. |

It warns when cells land far from the palette (the prompt drifted) or when every
cell is transparent (the subject was not on a transparent background).

### Generate at high resolution

Ask the generator for **1024×1024** regardless of the target grid. More source
pixels per cell means a better average when it is resampled. Do not try to make
the generator output 16×16 directly — it will produce a blurry mess.

---

## 3. Prompt construction

Build each prompt as **prefix + subject + suffix**. Only the subject changes.

**Prefix**

> `pixel art sprite, <GRID> pixel grid, retro 16-bit game asset, flat solid
colour blocks, hard aliased edges, 1px dark outline, centred single object,
transparent background,`

**Suffix**

> `, limited palette, no gradients, no anti-aliasing, no drop shadow, no blur,
no text, no lettering, no background scenery, no border frame, front view,
high contrast`

**Negative prompt** (if the plugin supports one)

> `photorealistic, 3d render, soft shading, gradient, glow, bloom, blurry,
anti-aliased, watermark, signature, text, letters, numbers, busy background,
multiple objects, drop shadow`

**Colour direction.** Name hex values in the subject line. The conform step
snaps to the palette regardless, but a generation that started in-palette snaps
far more faithfully — the difference between a cyan monitor and a grey one.

---

## 4. Nav glyphs — `--mask`

**Grid:** `16x16` · **Scale:** `4` → 64×64 · **Destination:** `apps/dashboard/public/pixel/nav/`

These become CSS masks, so colour in the generated image is discarded. Generate
them as **solid white shapes on transparent** and always pass `--mask`. What
matters is the silhouette: interior detail must read as _holes_, the way a
stencil works.

Eight sit inside a 1px rounded-square frame; two are free-standing. Generate the
frame once and reuse the same framing across all eight so the rail aligns.

| File                  | Frame  | Subject phrase                                                                                    |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `dashboard.png`       | yes    | `a simple house with a triangular roof and one door opening, inside a thin square frame`          |
| `seo-analytics.png`   | **no** | `a magnifying glass with a hollow circular lens and a thick diagonal handle`                      |
| `social-research.png` | **no** | `a plain heart shape`                                                                             |
| `content-intel.png`   | yes    | `a document page with a folded top-right corner and three text lines, inside a thin square frame` |
| `competitors.png`     | yes    | `three ascending bars of a bar chart, inside a thin square frame`                                 |
| `keyword-lab.png`     | yes    | `an Erlenmeyer flask with a narrow neck and two bubbles, inside a thin square frame`              |
| `backlinks.png`       | yes    | `two interlocking chain links at a diagonal, inside a thin square frame`                          |
| `reports.png`         | yes    | `a clipboard with a tab at the top and two lines of text, inside a thin square frame`             |
| `alerts.png`          | yes    | `a notification bell with a flat base bar and a small clapper`                                    |
| `notes.png`           | yes    | `a sticky note with the bottom-right corner folded, inside a thin square frame`                   |

```bash
node scripts/pixelize-asset.mjs raw-dashboard.png --grid 16x16 --scale 4 --mask \
  --out apps/dashboard/public/pixel/nav/dashboard.png
```

---

## 5. Full-colour sprites

All use `--scale 4` and **no** `--mask`.

### 5.1 KPI badges — grid `24x24` → 96×96 · `public/pixel/kpi/`

| File             | Subject phrase                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `visibility.png` | `a magnifying glass in hot pink #ff5fb0 with a thick lens ring and a lower-right handle, dark outline #0b0916`                       |
| `traffic.png`    | `a square chart frame in cyan #3fe3e0 containing an ascending zig-zag line with an arrowhead at the top right, dark outline #0b0916` |
| `mentions.png`   | `a rounded speech bubble in hot pink #ff5fb0 with a tail at the lower left and three pale dots inside, dark outline #0b0916`         |
| `sentiment.png`  | `a heart in cyan #3fe3e0 with a light highlight wedge in the upper-left lobe, dark outline #0b0916`                                  |

### 5.2 Panel marks — grid `16x16` → 64×64 · `public/pixel/panel/`

| File         | Subject phrase                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `coffee.png` | `a steaming coffee mug, pale lilac cup with a hot pink #ff5fb0 handle and two cyan #3fe3e0 steam curls`        |
| `chat.png`   | `a speech bubble outlined in cyan #3fe3e0 with a hot pink #ff5fb0 tail`                                        |
| `star.png`   | `a five-pointed star in gold #ffd76a with one lighter highlight pixel`                                         |
| `target.png` | `a dartboard with concentric rings alternating hot pink #ff5fb0 and near-black, and a gold #ffd76a centre dot` |
| `feed.png`   | `a folded newspaper in pale lilac with cyan #3fe3e0 text lines and a small masthead block`                     |

### 5.3 Feed badges — grid `20x20` → 80×80 · `public/pixel/feed/`

Each is a filled dark rounded-square tile with a 1px accent border and a small
glyph inside.

| File            | Subject phrase                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `strategy.png`  | `a dark tile with a cyan #3fe3e0 border containing a three-bar ascending bar chart`                                   |
| `trend.png`     | `a dark tile with a hot pink #ff5fb0 border containing a crosshair target ring with a centre dot and four tick marks` |
| `benchmark.png` | `a dark tile with a hot pink #ff5fb0 border containing two overlapping person silhouettes, head and shoulders`        |

### 5.4 Social marks — grid `16x16` → 64×64 · `public/pixel/social/`

Stylised house-palette interpretations, recognisable by silhouette. **Do not
reproduce official logo geometry pixel-for-pixel** — these are a data-source
legend, not brand assets. Flag back if a result looks like a literal trademark.

| File            | Subject phrase                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `twitter.png`   | `a simplified bird in flight with a raised wing, sky blue #3fa8f0`                                                 |
| `instagram.png` | `a rounded-square camera outline in hot pink #ff5fb0 with a circular lens and one highlight dot`                   |
| `tiktok.png`    | `an eighth music note in pale white with a cyan #3fe3e0 offset edge on the left and hot pink #ff5fb0 on the right` |
| `reddit.png`    | `a round alien head in orange #ff7a3c with two antenna dots and two white eyes`                                    |

### 5.5 Mascots · `public/pixel/mascot/`

The personality of the product. Spend the most time here and iterate.

| File                | Grid    | Export  | Subject phrase                                                                                                                                                                                                                                                                      |
| ------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cat-hero.png`      | `48x42` | 192×168 | `a seated friendly robot cat, near-white #f4f0ff fur with lilac #cfc6e8 shading, pink #ff9ad0 inner ears and cheek blush, black dot eyes, wearing cyan #3fe3e0 headphones, a small hot pink #ff5fb0 heart on the chest, left front paw raised waving, tail curling up on the right` |
| `cat-mark.png`      | `16x16` | 64×64   | `the head only of a friendly white cat, near-white #f4f0ff fur, pink #ff9ad0 inner ears, black dot eyes, pink cheek blush, no headphones`                                                                                                                                           |
| `monitor-buddy.png` | `44x40` | 176×160 | `a chunky retro CRT monitor character, cyan #3fe3e0 shell with darker teal #2aa8a6 shading, dark navy screen showing two white dot eyes and a wide smile, hot pink #ff5fb0 headphones clamped over the top, a thin antenna with a pink heart at the tip, small feet`                |
| `blob-buddy.png`    | `20x24` | 80×96   | `a small round ghost blob in hot pink #ff5fb0 with darker pink #c73d84 shading, a flat domed top, a wavy scalloped bottom edge, two black dot eyes, two tiny arm nubs`                                                                                                              |

`cat-mark.png` must stay legible at 16 CSS px — it is also the favicon source.

### 5.6 Sparkles — grid `8x8` → 32×32 · `public/pixel/deco/`

| File               | Subject phrase                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `sparkle-ink.png`  | `a four-pointed twinkle sparkle, white #f2edff core tapering to pale lilac tips`            |
| `sparkle-pink.png` | `a four-pointed twinkle sparkle, light pink #ff9ad0 core tapering to hot pink #ff5fb0 tips` |
| `sparkle-cyan.png` | `a four-pointed twinkle sparkle, pale cyan #7ff0ee core tapering to cyan #3fe3e0 tips`      |
| `star-gold.png`    | `a small five-pointed star filling the frame, gold #ffd76a with a lighter highlight`        |

---

## 6. Font

Not an image-generation task — a vendoring task.

- Obtain **Departure Mono** (SIL OFL 1.1). Acceptable substitutes if
  unavailable: **Silkscreen** or **Pixelify Sans**, both OFL 1.1. State which
  you used.
- Convert and place:
  - `apps/dashboard/public/pixel/font/departure-mono.woff2`
  - `apps/dashboard/public/pixel/font/departure-mono.woff`
- Subset to Latin-1 plus `→ ↑ ↓ ✓ ✗ ★ ♥ • ▸ ░ ▒ █`. Target under 40 KB.
- **Licensing — the repo gates on this:**
  - add the upstream licence at `apps/dashboard/public/pixel/font/OFL.txt`;
  - add an attribution entry to the root `NOTICE` naming the font, its author,
    and OFL 1.1;
  - confirm the licence permits web embedding and redistribution.

`pixel.css` already declares the `@font-face`, including `local()` sources.
Dropping the files in activates it with no code change.

---

## 7. Favicons — the one code edit

Generate from `cat-mark.png`, on an **opaque `#12101f` background** (favicons
render against light browser chrome, so transparency looks broken).

| File              | Size                                 | Destination              |
| ----------------- | ------------------------------------ | ------------------------ |
| `favicon-16.png`  | 16×16                                | `apps/dashboard/public/` |
| `favicon-32.png`  | 32×32                                | `apps/dashboard/public/` |
| `favicon-180.png` | 180×180 (cat centred, ~16px padding) | `apps/dashboard/public/` |

Then, **and only once those three files exist**, replace the icon line in
`apps/dashboard/index.html`:

```html
<!-- before -->
<link rel="icon" type="image/png" href="/marketingovo-icon.png" />

<!-- after -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" href="/favicon-180.png" />
```

Making this edit before the files land leaves the app with no working favicon,
because the daemon answers a missing static path with `index.html` rather than a 404.

---

## 8. Insertion map

Every path below is already referenced in committed code. This table is how you
confirm an asset actually reached the screen rather than sitting unused on disk.

| Asset group                     | Consumed by                                        | Visible on                 |
| ------------------------------- | -------------------------------------------------- | -------------------------- |
| `nav/*.png`                     | `components/app-shell.tsx` → `PixelMaskIcon`       | Section rail, every page   |
| `kpi/*.png`                     | `pages/dashboard.tsx` → `Stat`                     | The four headline cards    |
| `panel/coffee,star,target,feed` | `pages/dashboard.tsx` → `Panel`                    | Panel header corners       |
| `panel/chat.png`                | `pages/dashboard.tsx`, `pages/social-research.tsx` | Social panels              |
| `panel/feed.png`                | `pages/content-intel.tsx`                          | Content gaps panel         |
| `feed/*.png`                    | `pages/dashboard.tsx`, `pages/content-intel.tsx`   | Content intel rows         |
| `social/*.png`                  | `pages/dashboard.tsx`, `pages/social-research.tsx` | Platform legends           |
| `mascot/cat-mark.png`           | `components/app-shell.tsx`                         | Sidebar logo lockup        |
| `mascot/monitor-buddy.png`      | `components/app-shell.tsx`                         | Under the boot log         |
| `mascot/cat-hero.png`           | `pages/dashboard.tsx`                              | Welcome banner             |
| `mascot/blob-buddy.png`         | `pages/dashboard.tsx`                              | Bottom-right corner        |
| `deco/*.png`                    | `pages/dashboard.tsx`                              | Sparkles around the banner |
| `font/departure-mono.*`         | `pixel.css` `@font-face`                           | All type                   |
| `favicon-*.png`                 | `apps/dashboard/index.html` (§7)                   | Browser tab                |

---

## 9. Verify

```bash
node scripts/pixelize-asset.mjs <any-output>.png --grid 16x16 --scale 4 --out /tmp/check.png --report
```

Then look at the result in the running app:

```bash
pnpm --filter @marketingovo/dashboard build && node packages/cli/scripts/copy-dashboard.mjs
```

Restart the local service before checking — it enumerates its static routes at
boot, so a running daemon will not serve newly added files.

Compare against the reference mock at 1400×940. Pay attention to:

- the rail: all ten glyphs should share one optical weight and frame alignment;
- the KPI row: badges should read at a glance at 40px;
- the banner: the cat's raised paw is the pose, and it must be obvious;
- the sidebar: the monitor character's smile should be legible at 128px.

---

## 10. Definition of done

- [ ] 37 PNGs present at the §4–§7 paths, each produced through `pixelize-asset.mjs`
- [ ] Every nav glyph generated with `--mask` (single white colour in the census)
- [ ] No `pixelize-asset.mjs` palette or transparency warnings left unexplained
- [ ] Font files, `OFL.txt`, and the `NOTICE` entry in place
- [ ] `index.html` favicon block swapped, after the favicon files exist
- [ ] Editable sources kept at `assets/pixel/src/`
- [ ] `pnpm format && pnpm build` clean
- [ ] A 1400×940 screenshot of the dashboard attached to the completed task

## 11. Priority

If this is split across passes, deliver in this order — earlier groups carry the
most visual weight:

1. §5.5 mascots (`cat-hero`, `monitor-buddy`, `cat-mark`)
2. §4 nav glyphs — the stand-ins are weakest there
3. §6 font — the single biggest fidelity jump
4. §5.1 KPI badges
5. §5.2–5.4 panel marks, feed badges, social marks
6. §5.6 sparkles, §7 favicons, `blob-buddy`
