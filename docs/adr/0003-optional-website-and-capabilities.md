# ADR 0003 — A workspace is the unit; a website is optional

Status: accepted, 2026-08-04

## Context

Marketingovo was built as an SEO auditor, and the data model said so. A project
**was** a website: `projects.canonical_url` was `NOT NULL`, `createProject` ran
`new URL(input.canonicalUrl)` and threw without one, and the dashboard's shared
`QueryState` refused to render 13 of its 22 pages behind a single notice reading
_"Add a site to begin"_.

That assumption stopped being true. The product already shipped OSINT research
over explicitly supplied public targets, social research, keyword research from
seeds, and content planning — none of which need the operator to own a website.
An agency evaluating a prospect, a brand running paid and social before its site
is live, and a marketer researching a competitor were all required to invent a
URL before the product would show them anything.

The dashboard had also diverged into two conventions. The older `QueryState`
pages refused to render without a site. The newer pixel-styled pages rendered
their structure with a labelled `demo` sample and a "connect a source" hint —
the behavior we actually want, already documented as a house rule in
`apps/dashboard/src/lib/intel.ts`.

## Decision

**A workspace is the unit of work. A website is one optional asset it may hold.**

`projects.canonical_url` becomes nullable (migration 13, table rebuild following
the pattern established by migration 5). `NULL` means "no website yet" and is
kept distinct from an empty string, so no downstream guard can read a plausible
`""` and treat an absent site as a present one. A workspace with no website has
no `sites` row at all rather than a row holding a placeholder.

**Capabilities replace the blanket gate.** A workspace reports what it can
currently do — `website`, `search-console`, `analytics`, `serp`, and the
reserved `ads` and `social` — derived on every read from the project row and the
connector list. There is no capability state of its own to fall out of date.

Each surface declares what it needs, and a missing capability carries both the
reason and the single step that supplies it. `GET /api/v1/projects/:id/capabilities`
returns those remedies alongside the verdict.

**Work that genuinely needs a website fails closed, and says why.** Crawling has
no honest degraded mode: an empty crawl would present "we never looked" as "we
looked and found nothing". `audit` and `compare` now raise a typed
`workspace_has_no_website` problem (422) at `runs.start`, before a run row or job
exists — queuing work certain to fail would leave a brand-new workspace holding a
red run for a configuration problem fixable in one step. Everything else runs:
keyword research and content planning work from seeds, and OSINT researches
whichever public targets it was handed.

**`connected` is not the same as usable.** A provider still cannot answer a
question about a workspace until it has been pointed at the right property, so
the `search-console` and `analytics` capabilities require both a credential and
its project mapping.

## Alternatives rejected

**Hide surfaces that cannot run.** A page with no link into it is, from the
operator's side, a page that does not exist. Hiding also destroys the reason —
someone who cannot find Audits learns nothing about why.

**Let the surfaces render empty.** This is the failure mode the product exists to
avoid. An empty issue list is indistinguishable from a clean site.

**Rename `site` to `workspace` throughout now.** Correct eventually, but the REST
API, SDK, CLI and bundle format are pinned stable at 1.1.0 and breaking them
requires a major version. The rename is deferred to 2.0 so it happens once,
alongside the channel layer ([ADR 0004](0004-channel-account-model.md)), rather
than twice.

## Compatibility

This ships additively as 1.2.0.

- `POST /api/v1/sites` still accepts `{ name, url }` unchanged; omitting `url` is
  the new path. `CreateProjectInputSchema.canonicalUrl` became optional, so every
  previously valid request body still validates.
- `ProjectSchema.canonicalUrl` widened from a URL to `string | null`. This is a
  response widening, and worth stating plainly rather than glossing: a consumer
  typed against a non-null string will see a type change. It can only be
  _observed_ for workspaces created without a website, which cannot exist in any
  database written before this version.
- `PATCH /api/v1/settings` accepts `siteUrl: null` or `""` to detach a website.
  Absent still means "leave it alone" — collapsing the two would make a website
  impossible to remove once added.

## Consequence

The dashboard's `QueryState` no-workspace branch now means exactly that: no
workspace exists. It no longer conflates "you have not chosen a site" with "you
cannot use this product".

`ads` and `social` are named in the capability vocabulary before their
connectors exist, and are reported as unavailable with an honest reason rather
than omitted. Surfaces written against them today will not need renaming when
[ADR 0004](0004-channel-account-model.md) lands.
