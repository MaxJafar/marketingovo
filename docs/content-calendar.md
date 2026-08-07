# Content calendar

One post, several platforms, one place to schedule and approve it.

Write a post once, send it to Telegram, X, a Facebook Page and Instagram, and
see what actually happened to each. The mechanics are in
[ADR 0006](adr/0006-publishing-mechanics.md); the safety model they satisfy is
[ADR 0005](adr/0005-outbound-publish-safety.md).

## How a post reaches a platform

```
brief → deliverable → publish intent × N (one per destination)
                          │ scheduled time + timezone
                          ▼ you approve, in the dashboard, in a browser
                          └── durable job, fires at the scheduled moment
                                └── publish record — what was sent, what came back
```

A post going to four platforms is **one piece of copy and four intents**. Each
is approved, scheduled, sent, recorded and failed separately, so a campaign
where Telegram succeeded and X was rate limited says exactly that. There is no
campaign-level "failed" that could hide a post already live.

## The three things worth knowing before you rely on it

**Rescheduling clears the approval.** The time is part of what you approved — a
post you agreed to for Tuesday morning is not the same post on Saturday night.
Moving it drops the intent back to unapproved and says so. It is one extra
click, and it is the reason an unattended send is defensible at all.

**An unknown outcome stays unknown.** If the daemon is killed between sending a
request and recording the reply, the post is reported as _indeterminate_, not as
failed. Marketingovo will not resend on its own. Telling you "failed" about a
post that actually went out is how a tool publishes something twice to your
audience; the honest answer is to say what is known and let you check.

**Scheduled posts fire with nobody watching.** That is what a calendar is. What
makes it safe is that you approved this exact payload at this exact time
beforehand, and any change to either voids the approval.

## Media

Files you upload stay on this machine. Telegram, X and Facebook receive the
bytes directly at send time — no third party sees them.

**Instagram is the exception, and it is Instagram's constraint, not a choice.**
Its Content Publishing API takes an `image_url` and fetches the asset itself;
there is no upload endpoint, and there is no text-only Instagram post. So an
Instagram post needs an asset reachable at a public HTTPS URL. Two ways to get
one, both yours:

- **Paste a URL you already host** — your site, your CDN. Nothing is uploaded.
- **Configure your own object storage** — S3, Cloudflare R2, Backblaze B2,
  MinIO, anything speaking the S3 API. Credentials live in the local vault, and
  "Publish to my storage" signs a single PUT into a bucket you own.

The relay button is separate and labelled, and only appears for assets that need
it. It is also browser-only: sending a local file off this machine is a decision
a person makes, not an attached agent.

Uploads are identified by sniffing the file signature, not by the filename or
the declared content type — both of those are supplied by the caller. A file
that is not a PNG, JPEG, WebP, GIF, MP4 or MOV is refused at upload rather than
at 09:00 by a provider.

## Connecting each platform

### Telegram

The easiest by a wide margin, and the best one to prove the pipeline with.

1. Message [@BotFather](https://t.me/BotFather) and create a bot.
2. Add the bot to your channel as an **administrator with permission to post**.
3. Paste the token in **Integrations → Telegram**.
4. Link the channel in the calendar as `@yourchannel`.

No OAuth, no app review, no expiry, and you can revoke it in one message.
Telegram reports "the bot is not an admin here" as a 400, so that specific case
is surfaced with its own instruction rather than a generic refusal.

### X (Twitter)

1. Register your own app in the X developer portal with OAuth 2.0 enabled and
   a `http://127.0.0.1/oauth/callback` style loopback redirect.
2. Put the client ID in the connector's configuration.
3. Connect, and grant the posting permission.

**The free tier caps writes at a few hundred posts per month.** Hitting it is a
normal event, not an edge case, so a 429 here carries X's reported reset time
and says the limit may be monthly rather than a short window. X also rotates
its refresh token on every refresh, so an interrupted refresh needs a reconnect;
the new token is persisted before the access token is used, which is what keeps
that rare rather than routine.

### Facebook Pages and Instagram

Both use the Meta credential already connected for ads, but publishing needs
scopes reading did not: `pages_manage_posts` for a Page, and
`instagram_content_publish` plus a linked Instagram Business or Creator account
for Instagram. Regenerate the System User token with those scopes and paste it
again.

One photo per Page post, and Page videos are not supported: Meta's resumable
upload protocol is the only way to send one, and half-implementing it would
leave orphaned unpublished uploads on your Page when the second call fails.

Instagram allows **25 published posts per 24 hours per account**. That ceiling is
checked locally before a post is sent, because a calendar that discovers it at
09:00 has failed at the one job a calendar has.

## What an agent can and cannot do

An attached agent can write the brief, the copy for every platform, and stage
the exact payload. It can propose a time — scheduling clears any approval, so a
proposed time cannot cause a send.

It cannot approve, publish, or relay a file to public storage. All three require
the browser's own session transport and are refused for the local service token
that agent tooling holds. This is not a permission flag or a confirmation prompt
the model answers; both are things a confused or prompt-injected agent talks its
way past, because their enforcement lives inside the thing being controlled.

## What is recorded

Every attempt writes a `publish_record` holding the **exact request** and the
provider's own response identifier — not a summary. When a post misbehaves the
question is always "what did we actually send", and reconstructing it from a
template plus current data is not an answer, because the template may have
changed since.

Records are immutable and outlive the intent, the deliverable and the brief.
Deleting a draft does not erase the evidence that something went out under your
name.
