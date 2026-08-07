# Task packet — visual refresh: make every asset actually crisp

**Executor:** Codex, with an image-generation plugin.
**Companion documents:**
[terminal-ui-asset-packet.md](./terminal-ui-asset-packet.md) — the
authoritative spec for every sprite (grids, palette, roles) — and
[codex-image-generation-packet.md](./codex-image-generation-packet.md) — the
generate → conform → verify runbook and the `scripts/pixelize-asset.mjs`
conform tool. This packet does not repeat them; it is the **defect list and
work order** for redoing what the first pass got wrong.

**Why this packet exists:** the shipped assets read as blurred and low-def in
the running dashboard. The causes are concrete and listed below — each work
order names its defect, its fix, and its acceptance check.

---

## 0. Ground rules (from the companion docs; they still bind)

- Never install raw generator output. Every sprite goes through
  `node scripts/pixelize-asset.mjs <src> --grid WxH --scale 4 --out <dest>`
  with the grid from the asset spec. Generate at 1024×1024, always.
- Colors snap to the `--px-*` palette; alpha is strictly binary; the exported
  scale is a whole-number multiple of the design grid.
- Dropping a correctly named file at the correct path is the entire
  integration. No component code changes.
- `apps/dashboard/dist` and `packages/cli/dashboard` are build artifacts —
  never edit them; rebuild instead.

---

## 1. Install the pixel font (highest impact, zero generation)

**Defect:** `apps/dashboard/src/pixel.css` declares `@font-face` for
"Departure Mono" at `/pixel/font/departure-mono.woff2` and `.woff`, but
`apps/dashboard/public/pixel/font/` **does not exist**. Every character in
the console — including the hero bubble in the screenshots — falls back to a
soft anti-aliased platform monospace, which is most of why the UI reads as
blurry. The Vite build even warns about the unresolved references.

**Fix:**

1. Download Departure Mono (https://departuremono.com, SIL OFL 1.1) and place
   `departure-mono.woff2` and `departure-mono.woff` in
   `apps/dashboard/public/pixel/font/`.
2. Put the font's `OFL.txt` beside them, and add a Departure Mono / OFL
   attribution block to the repository `NOTICE` file. The npm license gate
   only scans package dependencies, so a vendored font must carry its licence
   text in-tree to keep the repo distribution-clean.
3. Rebuild and confirm the Vite warning about `/pixel/font/…` is gone.

**Accept when:** the dashboard renders UI text with hard pixel edges at 100%
zoom (no sub-pixel grey fringing on glyph stems), and `pnpm --filter
@marketingovo/dashboard build` emits no font-resolution warning.

## 2. Re-conform every sprite that fails the grid test

**Defect:** several installed sprites — `mascot/cat-hero.png` and
`mascot/monitor-buddy.png` visibly — have a drifting design grid: cells of
mixed sizes, ragged single-pixel steps along contours, and off-palette
transition colors. That is the signature of raw generator output conformed
with the wrong `--grid`, or not conformed at all. Scaled by
`image-rendering: pixelated`, the drift magnifies into the mushiness in the
screenshots.

**Fix:** for **every** file under `apps/dashboard/public/pixel/`, re-run the
conform loop from the runbook against its 1024×1024 source in
`assets/pixel/src/` (regenerate sources that cannot conform cleanly — the
runbook's prompt tables are still current):

```bash
node scripts/pixelize-asset.mjs assets/pixel/src/<name>-source.png \
  --grid <from the asset spec> --scale 4 --report \
  --out apps/dashboard/public/pixel/<dir>/<name>.png
```

Treat any `--report` warning (off-palette cells, drifted grid, non-binary
alpha) as a failure: fix the source or the flags, never hand-wave it.

**Accept when:** for each sprite, `--report` is clean, and a 400% zoom of the
installed PNG shows uniform square cells with no intermediate colors along
edges. Nav glyphs additionally pass the `--mask` silhouette rule from the
runbook.

## 3. Rebuild the wordmark lockup as drawn pixel type

**Defect:** `pixel/brand/marketingovo-lockup.png` has letterforms with
inconsistent stroke widths and a wobbling baseline — pixel-_styled_ type from
a generator, not pixel type. On the masthead it is the first blurry thing a
visitor sees.

**Fix:** do not generate this one. Set "marketingovo" in Departure Mono (from
§1) at its native pixel size, rasterize at integer scale, split the two-tone
coloring (`marketing` pink `--px-pink`, `ovo` cyan `--px-cyan`) per the asset
spec, and conform the cat mark beside it on its own grid. Letterforms must
sit on one shared baseline with identical cell sizes.

**Accept when:** every glyph baseline aligns to the same pixel row, stroke
width is uniform per glyph, and the file passes the same 400% inspection as
§2.

## 4. Brand images: icon, README poster, favicons

**Defects:**

- `assets/brand/marketingovo-icon.png` (1.4 MB) and
  `marketingovo-readme-poster.png` (1.3 MB) are soft — generator output at
  final size rather than crisp pixel art upscaled nearest-neighbour.
- The favicons (16/32/180) were derived from the soft icon, so they smear at
  actual favicon size.

**Fix:**

1. Regenerate the icon subject, conform to its design grid, then export with
   nearest-neighbour at the sizes the installers need (the desktop config
   consumes this file); keep the master at a clean integer scale.
2. Re-derive `favicon-16/32/180.png` from the conformed icon with
   nearest-neighbour only — never bicubic.
3. Re-compose the README poster from **conformed** sprites and §1 type at 2×
   the display width (README renders ~830 px wide, so ≥1660 px), then export
   PNG. Compress with lossless `oxipng`/`zopflipng`.

**Accept when:** the poster shows hard pixel edges at GitHub's display width,
the icon has zero anti-aliased edge pixels at 100%, and each favicon is
legible at its real size in a browser tab.

## 5. Source hygiene (repo weight)

**Defect:** `assets/pixel/src/` carries ~27 generator sources at ~1 MB each
(~25 MB of repo history per regeneration round). They are inputs, not
shipped assets.

**Fix:** after §2–§4 land, losslessly optimize every kept source
(`oxipng -o max`), and delete sources for sprites that were replaced rather
than regenerated. Do not add new full-resolution intermediates to the repo;
conform locally and commit only the source + the conformed output.

**Accept when:** `git ls-files assets/pixel/src | xargs du -ch` totals under
10 MB and every kept source still round-trips through §2 cleanly.

## 6. Verify in the running product, then repackage

1. `pnpm --filter @marketingovo/dashboard build`, then copy `dist` into
   `packages/cli/dashboard` (on Windows use an explicit copy — the
   `copy-dashboard.mjs` step is known to crash there; see the repo memory
   note).
2. Run the packaged journey with axe: `pnpm test:e2e`. The sprite swap must
   not introduce contrast or accessible-name regressions (sprites are
   decorative; their `PixelSprite` fallbacks carry the semantics).
3. Screenshot the console home at devicePixelRatio 1 and 2. Both must show
   hard pixel edges — HiDPI is where nearest-neighbour mistakes show first.

## Out of scope

- No component or CSS changes beyond the §1 font files (the `@font-face`
  already points at the right paths).
- No palette changes — `--px-*` values are contrast-checked and locked.
- The README poster's composition may change; the claims printed on it may
  not (see `launch/README.md` canonical-claims rules).
