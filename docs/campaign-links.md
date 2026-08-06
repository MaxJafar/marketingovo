# Campaign links and QR codes

Tagged links, and QR codes generated locally that never expire.

## What "free" means here

Free QR generators are usually free in the way a printer is free. The code they
give you encodes a short URL on **their** domain, they resolve it, and that
gives them a position: they can meter it, put analytics behind a login, start
charging, or simply stop. Codes printed on packaging have gone dead this way
after the company behind them changed its pricing.

A code generated here encodes the destination directly. Nothing resolves it,
so nothing can revoke it. It has no account, contacts no server, and works for
as long as the paper does — including after Marketingovo is uninstalled.

The encoder is written in this repository rather than taken from a package, for
the same reason the AWS signing is. A printed code is a commitment measured in
years, and it should not depend on anything that can be deprecated.

## Tagging is checked before the code exists

This is the only surface in the product that **refuses** rather than records.

Everywhere else, a problem is written down and the work continues, because the
output can be corrected later. A QR code cannot be. Once it is on ten thousand
leaflets the tagging inside it is fixed for the life of the leaflet, and a
finding stored beside it helps nobody holding one.

So these are refused at creation:

| Problem                      | What it costs                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Capitals or spaces           | One campaign becomes two rows that no reporting tool can merge afterwards                                                                    |
| Source and medium swapped    | Reports group by medium, so the campaign is filed under a channel that does not exist                                                        |
| Manual tags on a tagged link | A destination carrying `gclid` is already tagged; UTM parameters override the identifier supplying the cost data only that platform can give |
| Destination already tagged   | The existing parameters are overwritten, so whatever they measured stops being measured                                                      |
| A code too small to scan     | Error correction recovers damaged modules, not ones the camera never resolved                                                                |

Everything else — an unrecognised medium, plain HTTP, `utm_term` outside paid
search — is reported and stored with the link.

## Where the code will live

Asked, not inferred, because it is the only input that decides whether the code
works.

| Placement    | Level | Why                                                            |
| ------------ | ----- | -------------------------------------------------------------- |
| Screen       | L     | Nothing damages it; a sparse code reads fastest                |
| Held in hand | M     | Creases and thumb marks, without much added density            |
| Poster       | M     | Read at distance rather than damaged — size matters more       |
| Packaging    | Q     | Curved, scuffed in transit, often on an absorbent surface      |
| Outdoors     | H     | Rain, sun, partial obstruction, and nobody reprints it quickly |

Higher error correction costs modules, which makes the code denser and so
harder to scan small. That trade is why the placement question exists.

## The scannability check

Given the printed width, the module count and the two colours, the code is
judged before anyone commits to a print run:

- **Module size.** Below about 0.4mm a phone camera cannot separate adjacent
  modules, and more error correction does not help — it recovers damaged
  modules, not unresolvable ones.
- **Contrast.** Scanners threshold the image into light and dark before
  decoding. Below roughly 3:1 that step fails no matter how large the code is.
  This is where brand palettes usually break a code.
- **Inversion.** Light modules on a dark background. Many scanners handle it,
  a meaningful number do not, and there is no way to know which ones your
  audience has.
- **Quiet zone.** Four modules of margin, which is what lets a camera find the
  code's edge against a busy page. It is the first thing layout pressure
  removes.

The advice names a width that reaches "scans reliably", and that width is
tested to actually do so.

## Codes you can re-point

A QR code cannot expire — the modules encode the destination. Anything sold as
a "dynamic QR code" is a redirect, which is exactly why the seller can stop
resolving it.

Marketingovo generates the redirect configuration for a domain **you** own:
Cloudflare Worker, Netlify, Vercel, nginx or Apache. The QR encodes your short
link, so you can re-point it whenever you like and nothing can take it away.

It also makes the code sparser: a short link is a fraction of the length of a
tagged URL, so the symbol needs far fewer modules and scans at a smaller size.

Two details the generated config gets right:

- **302, never 301.** A permanent redirect is cached by the browser
  indefinitely, so re-pointing a link issued as 301 reaches only people who
  have never scanned it. Everyone who has keeps going to the old destination
  with no way to clear it remotely.
- **Expiry is only claimed where it works.** The Cloudflare Worker checks the
  date on every request. The static rewrite files cannot — they hold the date
  in a comment, and something still has to edit the file. That is the
  difference between an expiry and an intention, and the export says which one
  you have.

## Editing

Only the name, colours, placement and intended width can change. The
destination and the tagging cannot: a printed code cannot follow an edit, so a
new destination is a new link. Attempting it is an error rather than a silent
no-op, because a caller who believes they re-pointed a printed code is worse
off than one who was told they could not.

## From an agent

`marketingovo_campaign_link` builds a link or lists the existing ones. Tagging
that would lose data comes back as a refusal carrying the corrected values,
rather than as a created link with a warning attached — the agent gets the same
answer a person would, in a form it can act on without knowing the convention.
