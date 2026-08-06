# Email builder

Upload your brand, let an agent write the HTML, and get back an email that
survives a real inbox.

The split is the point: **the agent composes, the product enforces.** Nothing
an agent writes is trusted. Every compile sanitizes it, inlines the CSS, and
checks the result against what email clients actually do — then hands back a
report specific enough to fix.

## Why this is harder than a web page

Email HTML is not web HTML, and the differences are not stylistic:

- **Outlook on Windows renders with Microsoft Word.** No flexbox, no grid, no
  positioning, no shadows, no transforms. A layout built the modern way
  collapses into a stack.
- **Gmail clips at 102KB**, hiding everything past the cut behind a "view
  entire message" link — usually including the footer and the unsubscribe link.
- **Outlook blocks remote images by default**, so alt text is what most
  recipients read first.
- **Gmail strips `<style>`** from a forwarded or clipped message, which is why
  every declaration has to be inlined onto the element.
- **Web fonts are ignored** by Outlook and Gmail's mobile apps, so a stack
  without a generic family at the end falls back to the client's own default.

Nobody should have to hold all that in their head, and a language model cannot
be relied on to remember it. So the product checks, and names the client.

## The brand kit

Structured tokens, versioned like project context. Every save appends a
revision, so an email built last quarter can still say which brand it was
built against.

| Field                     | Why it is here                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours                   | Named with their intended use, so an agent picks one for the right reason. Six-digit hex only — clients disagree about `rgba()` and three-digit hex, and Word is the least forgiving. |
| Type stacks               | Checked for a generic family at the end, because a stack naming only a custom face specifies nothing for most recipients.                                                             |
| Logo                      | A media asset from the library.                                                                                                                                                       |
| Content width             | 600px is the long-standing safe default.                                                                                                                                              |
| Voice and prohibitions    | Read by the agent writing the copy.                                                                                                                                                   |
| **Postal address**        | Legally required in commercial mail in most jurisdictions.                                                                                                                            |
| **Unsubscribe merge tag** | Your ESP's own spelling — Mailchimp's, a handlebars form, whatever it uses. Stored verbatim, because guessing produces a dead link in a legally required place.                       |

Upload a guideline document alongside it if you have one. It is **reference
material, never authoritative**: an agent may propose token values from what it
can read, and a person confirms them. A token that matters is entered in the
kit, where the validator can check against it.

## The loop

An agent, or you:

1. Read the brand kit.
2. Write HTML.
3. Compile it — nothing is stored.
4. Read the findings, fix them, compile again.
5. Save once, when nothing blocking or error-level is left.

That fourth step is why this works. The report names a client and a behaviour,
which a model can act on, rather than saying "invalid CSS", which it cannot.

**Start from the brand kit** produces a table-based document already built from
your tokens that passes every check — faster than writing markup and
discovering Outlook's constraints one finding at a time.

## What the compiler does

**Sanitize.** Parsed with linkedom, which never executes or fetches anything.
Removes `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, meta refresh,
every `on*` handler, `javascript:` and `data:` URLs, CSS `expression()` and
`behavior`, and `@import`. Also removes forms and form controls — no major
email client submits one, so an interactive control in an email is something
that looks clickable and does nothing.

ESP merge tags survive. `{{unsubscribe_url}}` is not a URL and never parses as
one, and stripping it would remove the legally required unsubscribe link from
every template built here.

**Inline.** Stylesheet declarations are moved onto elements by specificity.
Media queries, pseudo-classes and `@font-face` are kept in a retained `<style>`
block, because they have no inline equivalent at all. A style you wrote
directly on an element always wins — it is the most specific statement of
intent in the document.

**Validate.** Each finding carries a severity, the clients it affects, and the
one change that fixes it:

| Severity   | Meaning                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| `blocking` | The compiler removed something. The document you have is not the one you submitted. |
| `error`    | A client will visibly break.                                                        |
| `warning`  | One client degrades.                                                                |
| `info`     | Worth knowing, nothing more.                                                        |

Checked: Outlook-unsupported CSS, images without alt or width, non-https
images, layout tables without `role="presentation"`, empty links, WCAG contrast
below 4.5:1, missing preheader, missing unsubscribe tag, missing postal
address, font stacks without a fallback, off-brand colours and type, and Gmail
clipping.

Off-brand colours are reported at `info` and **never corrected**. A shade
outside the palette is often deliberate, and silently rewriting it would change
a design decision without telling anyone.

## Preview

Rendered in an iframe with `sandbox=""` — no scripts, no same-origin access, no
navigation. The compiler already stripped what it could, but a preview that
executed what it displays would undo that.

The plain-text alternative is derived from the compiled document, so the two
can never disagree about what the email says. It is not optional in practice:
a message with no text part scores worse with spam filters.

## What this does not do

**It does not send.** The output is HTML to export into your own email service,
which already owns your list, your consent records, your unsubscribe handling
and your bounce processing — and is already set up to be legally responsible
for them. Adding a sending path here would mean rebuilding all of that, and the
compliance surface is the real cost, not the API.

## Agent tools

| Tool                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `marketingovo_brand_kit`       | Read the tokens, voice, prohibitions and legal footer          |
| `marketingovo_email_draft`     | Compile and validate; save a revision by passing `template_id` |
| `marketingovo_email_templates` | List templates, or read one with its full revision history     |

Plus the `/email-campaign` slash command in the Claude Code plugin.
