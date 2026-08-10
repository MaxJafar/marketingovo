# Marketingovo pixel asset ledger

Snapshot: `2026-08-07`  
Authority: [ASSET_ART_BIBLE.md](./ASSET_ART_BIBLE.md) and the
[terminal UI asset packet](./terminal-ui-asset-packet.md)  
Promotion state: `development candidate; draft style lock; owner approval pending`

## Workflow record

- Non-mascot sprites were re-conformed from the existing crisp pixel masters
  with their packet grids, `--scale 4`, and `--report`; the audit returned zero
  palette/transparency warnings. Their committed sources are now native-grid,
  lossless PNGs so they remain editable without carrying opaque generator
  intermediates.
- `cat-hero` and `monitor-buddy` were regenerated with built-in ImageGen using
  the supplied screenshot as a review-only style reference. The exact prompts,
  roles, output IDs, hashes, and review notes are in
  [asset-brief-cat-hero.md](./asset-brief-cat-hero.md) and
  [asset-brief-monitor-buddy.md](./asset-brief-monitor-buddy.md).
- Generated mascot sources were cleaned with the imagegen chroma-key helper,
  palette-snapped, conformed to the packet grids, then conformed once more from
  the snapped export to remove residual cell drift. The keyed sources are
  retained under `assets/pixel/src/provenance/`.
- The wordmark was not generated: Departure Mono v1.500 was rasterized at an
  integer 4x size with live two-tone spans (`marketing` pink, `ovo` cyan),
  combined with the conformed cat mark, and snapped to a `116x16` source grid.
- Favicons were derived from the conformed `cat-mark.png` with nearest-neighbor
  scaling and opaque `#12101f` compositing. The favicon HTML block was already
  present and was left unchanged until these files landed.

## Shipping manifest

All PNGs below are binary-alpha, packet-sized, palette-audited, and losslessly
written by the conform step. Nav assets are pure `#ffffff` silhouettes.

| Asset                                 | Grid → output     | SHA-256                                                            |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `pixel/brand/marketingovo-lockup.png` | `116x16 → 464x64` | `4905f1f1ac192039149e03b183fed3541f6bf8609bb2f3c160442ef4517059ff` |
| `pixel/deco/sparkle-cyan.png`         | `8x8 → 32x32`     | `3efc7eaad6f506779832c6e260eab8228a0ad4564a56668787caff0d92bc06f8` |
| `pixel/deco/sparkle-ink.png`          | `8x8 → 32x32`     | `adf9a24f2106c92ea9eed7b16304200fd82d54c887635c2d2faa9ef7a8cbdb37` |
| `pixel/deco/sparkle-pink.png`         | `8x8 → 32x32`     | `0f4b173ac89df48c80964a0bd8e20fa97e7d6fe24b27bc78c45d096cd377aafe` |
| `pixel/deco/star-gold.png`            | `8x8 → 32x32`     | `06ff5328aacf8b0876e4ff4e3fcd3db1a7c3e5e14e996f79af4f2442d8996db4` |
| `pixel/feed/benchmark.png`            | `20x20 → 80x80`   | `83d527ed1d5172ba459689683bb049356f5559ffcc8c8922892d4ab867b759cc` |
| `pixel/feed/strategy.png`             | `20x20 → 80x80`   | `54fa38f0dc03cce9361ae570873b2338d2e7c46fbdb65849f7d7d39a85d52f34` |
| `pixel/feed/trend.png`                | `20x20 → 80x80`   | `6416d51032c072820ea60edf3cffa5ae428ebb28a5747bb3b1bbef812c417f33` |
| `pixel/kpi/mentions.png`              | `24x24 → 96x96`   | `dc55d3ae9d569c21cc923dd95ab6d19583514e3fc228fc1252fb6ebf9f1a0c17` |
| `pixel/kpi/sentiment.png`             | `24x24 → 96x96`   | `b03c2a4ced19926f472bd1866dfaeca07c3f22896cae80c413856d6f9d398e23` |
| `pixel/kpi/traffic.png`               | `24x24 → 96x96`   | `6cce57f95f0a0631e1ecfe696e4fab317649faf5b1b72ec6908970892f317b70` |
| `pixel/kpi/visibility.png`            | `24x24 → 96x96`   | `41dac1a477a5b4877909f8d6f07176728adbda6f150ebf925a8b953846a0917f` |
| `pixel/mascot/blob-buddy.png`         | `20x24 → 80x96`   | `0d28f934df614e2117e27ca163bea8a3746617c657863d813c92f2b3f5107cd7` |
| `pixel/mascot/cat-hero.png`           | `48x42 → 192x168` | `7fb31da4b1d10274d15daa2ddfe3942f9f5bb6e3cd0f8cecfd6278e3e18dab0b` |
| `pixel/mascot/cat-mark.png`           | `16x16 → 64x64`   | `7e323f362a136981db71f5221985b5dc33cbdce0883c29ea3835cb3ee102d846` |
| `pixel/mascot/monitor-buddy.png`      | `44x40 → 176x160` | `5b72ea38e485b74f4a6138ea702c057128c2b3addcbd4f0922ddcd196a65c9b4` |
| `pixel/nav/alerts.png`                | `16x16 → 64x64`   | `24a7204710204ab346891058c0c2c82a7606dd4ee77041d58ed95a575838d550` |
| `pixel/nav/backlinks.png`             | `16x16 → 64x64`   | `e226e58c1ccdc76bfba4ecef68370028945ff2fd714828fe39a1d583c7d51bcf` |
| `pixel/nav/competitors.png`           | `16x16 → 64x64`   | `b22b066b9d502f5abacf65e86c2f160ad3066967a7beaaeec7a2470708fb4f9c` |
| `pixel/nav/content-intel.png`         | `16x16 → 64x64`   | `92ca08ae937e7ebefac03805f3d23d2713fbd09a539a4c61b2e76a918790bed1` |
| `pixel/nav/dashboard.png`             | `16x16 → 64x64`   | `dfedf9d08e703cf0de3bb39c862f2a2aa080a144eb139933514e6599b9158038` |
| `pixel/nav/keyword-lab.png`           | `16x16 → 64x64`   | `38b4e09d3007a182204950c8d9ba3e4bfc6b47669596936c1683ece9c7f3139c` |
| `pixel/nav/notes.png`                 | `16x16 → 64x64`   | `1c2b4cfbfd626574ac78700409f3394247dd8d47899a69e93e10d82d6dcf022e` |
| `pixel/nav/reports.png`               | `16x16 → 64x64`   | `552f9779bc7c158cdfa0922f951ec637b061085305f6e5043d4378f8737433ea` |
| `pixel/nav/seo-analytics.png`         | `16x16 → 64x64`   | `5ef16a06ed92876fd31b5e68bbb10ab516733a7def7bee77bf0216be74a95f95` |
| `pixel/nav/social-research.png`       | `16x16 → 64x64`   | `4120627b51953f9373d847af207f058890520f021c6579a7a2fb161bf06aaf92` |
| `pixel/panel/chat.png`                | `16x16 → 64x64`   | `c80bc7277add4882fa9edb302647c25e2e64901f43053ec57b4e116d39f62240` |
| `pixel/panel/coffee.png`              | `16x16 → 64x64`   | `3f29a11566fbdd375ffe77fef9e13fbf0b941391fb2c54530f76bb1d63bddfbd` |
| `pixel/panel/feed.png`                | `16x16 → 64x64`   | `78e260bf88539f5a3bb6e17e1413266992ac76f250d0064f478169c6d77d8f8b` |
| `pixel/panel/star.png`                | `16x16 → 64x64`   | `cf9f208eba401553c2dbc4a085bf6decf4123c9f380fb5356b5ac2d5e9768831` |
| `pixel/panel/target.png`              | `16x16 → 64x64`   | `108332fdf38fefb2873e2882f686348b74ae585c7bca29762530209b5940ec90` |
| `pixel/social/instagram.png`          | `16x16 → 64x64`   | `722a5dbd94ac27ee1c5e4f9a90998b578d2553037dbf96bdebc760db7027b332` |
| `pixel/social/reddit.png`             | `16x16 → 64x64`   | `308ab629ca46aca0ded1dc0b48f303abc25f9306f4ccf46e517739bfb77ee24e` |
| `pixel/social/tiktok.png`             | `16x16 → 64x64`   | `bdf282f4831dea8b5f6e297e35eb94b5c633967a014cd5e7cabb9fe4c85c2cd6` |
| `pixel/social/twitter.png`            | `16x16 → 64x64`   | `985a2bc0a792197921289daeb06ef6777ca95a393ca36a577734dd8ddc9480eb` |

## Font and favicon record

- Departure Mono v1.500 by Helena Zhang was downloaded from the official
  [Departure Mono site](https://departuremono.com/) via the author's
  [v1.500 GitHub release](https://github.com/rektdeckard/departure-mono/releases/tag/v1.500).
  Vendored files are `departure-mono.woff2` (22,496 bytes; SHA-256
  `5B4FED1DAA90708AA9C6EE1190ABCA9DC22164A1C1DEF0020386E46B61038CFB`) and
  `departure-mono.woff` (25,256 bytes; SHA-256
  `8EDE4E8A40475D440389D1BB44201BD3067129A62C718158921B111CEB52FCA5`).
  The complete SIL OFL 1.1 text is at `apps/dashboard/public/pixel/font/OFL.txt`.
- `favicon-16.png`, `favicon-32.png`, and `favicon-180.png` are opaque
  `#12101f` composites of `cat-mark.png`, written with nearest-neighbour only;
  all have binary alpha because the final canvas is opaque.
