# Synthetic marketer demo

This deterministic site contains labeled SEO defects and no customer data. The
public benchmark serves it on a random loopback port, audits it with the same
Community engine, and reports detection recall, high-severity false positives,
runtime and the complete observed rule list.

Version 2 labels 26 exact `rule + page + priority` instances across response,
metadata, heading, canonical, directive, markup, structured-data, image, link and
content checks. Two separate healthy control pages must remain free of unexpected
High findings. `{{COPY}}` is expanded into route-specific long copy so thin or
exact-duplicate content does not obscure checks that are not testing thinness.
