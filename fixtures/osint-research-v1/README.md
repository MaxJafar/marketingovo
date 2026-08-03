# Public-web OSINT evaluation fixture

This is a synthetic, secret-free acceptance corpus for the bounded
`osint-research` workflow. Every target uses the reserved `.invalid` domain, or
an explicit loopback safety case, and the evaluation harness injects crawl and
feed results. The runner never contacts the URLs in this directory.

The corpus protects the product's evidence boundaries as well as its happy
path:

- exact public profile links, `sameAs` declarations, business paths, and feed
  cadence remain cited evidence;
- missing metadata and missing feeds stay unavailable instead of becoming
  invented zeros;
- a blocked target remains a failed observation and cannot look like a signal
  disappearance; and
- duplicate or oversized target lists are capped before a crawl is spent.

The machine-readable cases live in `manifest.json`. Run them with
`pnpm benchmark` or directly with `node benchmarks/osint-evaluation.mjs` after
building the workspace.
