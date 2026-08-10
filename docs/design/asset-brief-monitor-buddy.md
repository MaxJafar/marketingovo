# Asset Brief: monitor-buddy-refresh

Status: `approved_for_generation`  
Asset family: `mascot`  
Intended in-game use: `Sidebar companion beneath the boot-log terminal panel`  
Destination: `apps/dashboard/public/pixel/mascot/monitor-buddy.png`

## Authority

- Art-bible version: `1.0.0 draft` — [ASSET_ART_BIBLE.md](./ASSET_ART_BIBLE.md)
- Style-lock version: `1.0.0 draft` — [asset_style_lock.json](./asset_style_lock.json)
- Visual anchors and roles: `packet` (style/material), `runbook`
  (production), `reference-screen` (review-only mood and placement)
- Approval scope and unresolved decisions: preserve the packet's exact 44x40
  grid, palette, smile, antenna heart, and no-text rule; owner promotion
  remains open.

## Asset contract

- Primary request: generate one chunky retro CRT monitor source candidate and
  conform it to the locked 44x40 pixel grid.
- Aspect ratio / dimensions: `44x40` native, `176x160` exported at scale 4.
- Composition and safe areas: centred, generous transparent padding after
  chroma-key removal; no scenery or extra props.
- Subject or surface: cyan shell with darker teal shading, dark navy screen,
  pink headphones, top-left antenna with a pink heart, teal feet.
- Allowed variation: palette-step shading and small silhouette cleanup only.
- Required invariants: two pale dot eyes, a wide curved smile, one-pixel dark
  outline, exact terminal palette, and binary alpha.
- Forbidden traits: green key colour in final alpha, blur, gradient, glow,
  drop shadow, realistic rendering, extra characters, props, or logos.
- Text / logo strategy: no text; live UI labels stay outside the sprite.
- Output / alpha requirement: keyed 1254x1254 source retained for provenance;
  final is transparent straight binary-alpha `176x160` PNG.

## Prompt record

```text
Use case: stylized-concept
Asset type: project-bound pixel-art source candidate for the Marketingovo terminal UI sidebar
Input images: Image 1: style reference only for the dark kawaii CRT-terminal mood, pink/cyan contrast, and friendly mascot placement; do not copy its UI text, logo geometry, or composition.
Identity block: friendly kawaii CRT-terminal pixel art; chunky rounded silhouettes; flat solid colour blocks; cyan monitor shell with darker teal shading, dark navy screen, hot pink headphones, simple pale-ink face, one-design-pixel dark outline; no gradients or soft rendering.
Asset contract: one chunky retro CRT monitor character only; front-facing; cyan shell; dark navy screen with two pale dot eyes and a wide smiling curved mouth; hot pink headphones clamped over the top; thin antenna from the top-left with a small pink heart at the tip; small teal feet; no extra characters or props.
Technical block: generate a clean 1024x1024 source image with the subject centred and generously padded on a perfectly flat solid #00ff00 chroma-key background for later local removal. Keep the silhouette readable when reduced to a 44x40 design grid and exported with integer nearest-neighbour scaling. No baked text, no labels, no watermark.
Avoid block: photorealistic, 3D render, soft shading, gradients, glow, bloom, blur, anti-aliased edges, mixed-size pixels, drop shadow, background scenery, extra characters, extra props, missing smile, missing antenna heart, trademarked monitor design, text, letters, numbers, watermark.
```

## Review record

- Tool mode and provider output ID: `built-in ImageGen; exec-2036ec15-804d-47de-9956-a930eba31829.png`
- Source/output paths, hashes, and dimensions: keyed source
  `assets/pixel/src/provenance/monitor-buddy-generated-chroma.png`, SHA-256
  `6AE5FBB6F9E4FF9E678BF6E6780FF26C5DE5355C29286BDB9D4F1B14EBD3386A`,
  `1254x1254`; final `176x160`, SHA-256
  `5b72ea38e485b74f4a6138ea702c057128c2b3addcbd4f0922ddcd196a65c9b4`.
- Post-processing command and inputs: `remove_chroma_key.py --auto-key border
--soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`,
  palette snap, then `node scripts/pixelize-asset.mjs` with `--grid 44x40
--scale 4 --report`; a second conform pass removed residual cell drift.
- Full-size and in-game inspection: `pass`; smile, headphones, antenna heart,
  feet, silhouette, binary alpha, and runtime crop are legible.
- Drift check: `pass`; final report has no palette or transparency warnings.
- Promotion decision and approver: `development candidate; owner approval
pending`
