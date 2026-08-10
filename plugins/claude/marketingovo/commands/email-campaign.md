---
description: Build a brand-consistent HTML email that survives real inboxes.
---

Build an HTML email for the campaign described in $ARGUMENTS.

1. Call `marketingovo_brand_kit` for the project named in $ARGUMENTS. Ask which
   project is meant if it is ambiguous — never guess. Use its colours, type
   stacks, content width, voice and prohibitions. The footer fields are not
   optional decoration: the postal address and the unsubscribe merge tag are
   legally required in commercial mail.
2. Write the HTML. Email is not the web:
   - lay out with nested tables and `role="presentation"`, never flexbox or
     grid — Outlook on Windows renders with Microsoft Word and has neither;
   - give every image `alt` text and a `width` attribute, because Outlook
     blocks remote images by default and the alt is what most people see;
   - end every font stack with a generic family, since web fonts are ignored
     by Outlook and Gmail's mobile apps;
   - keep the whole document under 102KB or Gmail clips it, hiding the footer
     and the unsubscribe link behind a "view entire message" link.
3. Call `marketingovo_email_draft` without a `template_id` and read the
   findings. Each one names a real client and what it does. Fix them and
   resubmit. Do not explain a finding away — the report is the specification.
4. When nothing blocking or error-level remains, call it once more with the
   `template_id` to save it.
5. Report what you built, the revision, and any warnings you deliberately left.

Marketingovo does not send email. Say the HTML is ready to export into the
operator's own email service; never describe a campaign as sent.
