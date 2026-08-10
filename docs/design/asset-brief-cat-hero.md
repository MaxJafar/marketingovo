# Asset Brief: cat-hero-refresh

Status: `approved_for_generation`  
Asset family: `mascot`  
Intended in-game use: `Dashboard welcome banner mascot; the raised left paw is the required pose anchor`  
Destination: `apps/dashboard/public/pixel/mascot/cat-hero.png`

## Authority

- Art-bible version: `1.0.0 draft` — [ASSET_ART_BIBLE.md](./ASSET_ART_BIBLE.md)
- Style-lock version: `1.0.0 draft` — [asset_style_lock.json](./asset_style_lock.json)
- Visual anchors and roles: `packet` (style/material), `runbook`
  (production), `reference-screen` (review-only mood and placement)
- Approval scope and unresolved decisions: preserve the packet's exact 48x42
  grid, palette, cat pose, and no-text rule; owner promotion remains open.

## Asset contract

- Primary request: generate one seated friendly robot cat source candidate and
  conform it to the locked 48x42 pixel grid.
- Aspect ratio / dimensions: `48x42` native, `192x168` exported at scale 4.
- Composition and safe areas: centred, generous transparent padding after
  chroma-key removal; no speech bubble.
- Subject or surface: near-white robot cat, cyan headphones, pink inner ears
  and cheeks, pink chest heart, tail curling on the right.
- Allowed variation: palette-step shading and small silhouette cleanup only.
- Required invariants: left front paw clearly raised and waving; one-pixel
  dark outline; exact terminal palette; binary alpha; no baked text.
- Forbidden traits: green key colour in final alpha, blur, gradient, glow,
  drop shadow, realistic rendering, extra characters, props, or logos.
- Text / logo strategy: no text; live wordmark stays separate.
- Output / alpha requirement: keyed 1254x1254 source retained for provenance;
  final is transparent straight binary-alpha `192x168` PNG.

## Prompt record

```text
Use case: stylized-concept
Asset type: project-bound pixel-art source candidate for the Marketingovo terminal UI
Input images: Image 1: style reference only for the dark kawaii CRT-terminal mood, pink/cyan contrast, and friendly mascot placement; do not copy its UI text, logo geometry, or composition.
Identity block: friendly kawaii CRT-terminal pixel art; chunky rounded silhouettes; flat solid colour blocks; exact house palette accents with near-white cat fur, lilac shading, hot pink inner ears/cheeks/heart, cyan headphones, and a dark one-design-pixel outline; simple dot eyes and a tiny curved mouth; no gradients or soft rendering.
Asset contract: one seated friendly robot cat mascot only, front-facing with a slight three-quarter friendly posture; left front paw clearly raised in a wave; cyan headphones over the ears; small hot pink heart on the chest; tail curling upward on the right; transparent negative space around the silhouette; no speech bubble.
Technical block: generate a clean 1024x1024 source image with the subject centred and generously padded on a perfectly flat solid #00ff00 chroma-key background for later local removal. Keep the silhouette readable when reduced to a 48x42 design grid and exported with integer nearest-neighbour scaling. No baked text, no labels, no watermark.
Avoid block: photorealistic, 3D render, soft shading, gradients, glow, bloom, blur, anti-aliased edges, mixed-size pixels, drop shadow, background scenery, extra characters, extra props, headphones covering the raised paw, missing raised paw, missing heart, trademarked cat or robot design, text, letters, numbers, watermark.
```

## Review record

- Tool mode and provider output ID: `built-in ImageGen; exec-247f89af-367f-4c90-bb26-e41424f0a37c.png`
- Source/output paths, hashes, and dimensions: keyed source
  `assets/pixel/src/provenance/cat-hero-generated-chroma.png`, SHA-256
  `93AD4ADC26BCF87AF32544FD7BC22C3219B3137CEA5961ADB1108375A9B4181A`,
  `1254x1254`; final `192x168`, SHA-256
  `7fb31da4b1d10274d15daa2ddfe3942f9f5bb6e3cd0f8cecfd6278e3e18dab0b`.
- Post-processing command and inputs: `remove_chroma_key.py --auto-key border
--soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`,
  palette snap, then `node scripts/pixelize-asset.mjs` with `--grid 48x42
--scale 4 --report`; a second conform pass removed residual cell drift.
- Full-size and in-game inspection: `pass`; raised paw, heart, headphones,
  silhouette, binary alpha, and runtime crop are legible.
- Drift check: `pass`; final report has no palette or transparency warnings.
- Promotion decision and approver: `development candidate; owner approval
pending`
