# Asset Brief: marketingovo-mascots-refresh

Status: `approved_for_generation`  
Asset family: `mascot`  
Intended in-game use: `Marketingovo dashboard welcome banner, sidebar boot-log companion, and favicon source`  
Destination: `apps/dashboard/public/pixel/mascot/`

## Authority

- Art-bible version: `1.0.0 draft` — [ASSET_ART_BIBLE.md](./ASSET_ART_BIBLE.md)
- Style-lock version: `1.0.0 draft` — [asset_style_lock.json](./asset_style_lock.json)
- Visual anchors and roles: `packet` (style/material), `runbook`
  (production), `reference-screen` (review-only composition)
- Approval scope and unresolved decisions: preserve the packet's mascot
  silhouettes and exact grids; owner promotion of the lock remains open.

## Asset contract

- Primary request: conform or regenerate the three named mascot subjects as
  crisp pixel sprites while preserving their locked anchor poses.
- Aspect ratio / dimensions: `cat-hero 48x42 -> 192x168`; `monitor-buddy
44x40 -> 176x160`; `cat-mark 16x16 -> 64x64`.
- Composition and safe areas: transparent padding around the subject; no
  speech bubble, UI copy, or unrelated decoration; keep the cat's left raised
  paw visible and the monitor's smile centred in its screen.
- Subject or surface: friendly robot cat with cyan headphones and chest
  heart; chunky cyan CRT with pink headphones and antenna heart; front-facing
  cat head without headphones.
- Allowed variation: packet-approved palette-step shading and small silhouette
  cleanup only.
- Required invariants: binary alpha, exact packet palette, 1px dark outline,
  native-grid cells, integer scale 4, cat paw wave, monitor smile, cat-mark
  legibility at 16 CSS px.
- Forbidden traits: blur, gradients, glow, anti-aliasing, soft shadow, baked
  text, extra characters, realistic proportions, or green-key pixels in the
  final alpha output.
- Text / logo strategy: no text in mascot art; wordmark remains separate and
  is drawn with licensed Departure Mono.
- Output / alpha requirement: keyed source may be temporary; final output is
  transparent straight binary-alpha PNG.

## Prompt record

The exact generation briefs are split into [asset-brief-cat-hero.md](./asset-brief-cat-hero.md)
and [asset-brief-monitor-buddy.md](./asset-brief-monitor-buddy.md). Use the
full identity block from the style lock followed by the bounded subject phrase
from the packet, then:

`Generate at 1024x1024 on a perfectly flat #00ff00 chroma-key background with
generous padding. Pixel art sprite on the specified native grid, flat solid
palette blocks, hard aliased edges, one-design-pixel dark outline, no text, no
logo, no shadow, no gradient, no blur, no glow, no background scenery, no
anti-aliasing. Preserve the requested silhouette and all named pose/face
invariants. The green key colour must not appear in the subject.`

## Review record

- Tool mode and provider output ID: `built-in ImageGen for the two refreshed
candidates; see the per-asset briefs for exact IDs`
- Source/output paths, hashes, and dimensions: `recorded in
docs/design/asset-ledger.md and the per-asset briefs`
- Post-processing command and inputs: `remove_chroma_key.py` to a temporary
  alpha source, then `node scripts/pixelize-asset.mjs` with the packet grid,
  `--scale 4`, and `--report`.
- Full-size and in-game inspection: `pending until the dashboard build is
refreshed`
- Drift check: `pending; must preserve mascot contract and pass palette/alpha
audit`
- Promotion decision and approver: `development candidate; owner approval
pending`
