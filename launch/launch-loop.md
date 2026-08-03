# Launch loop

The launch loop is the repeatable operating path from a public product claim to
the next verified improvement. It is a readiness and learning system, not a
claim that a campaign, customer study, or release happened.

The current machine-readable cycle is
[`launch-loop.json`](launch-loop.json). It deliberately starts in `ready`
state with measured values unset. A human records observations only after a
real interaction and keeps the source window and caveat beside every number.

## The loop

1. **Prepare.** Run the release and evaluation gates, choose one audience and
   one primary CTA, and select one testable product question.
2. **Publish.** Use one launch asset and label fixtures, prereleases, and
   source-install requirements where they first appear.
3. **Observe.** Record reproducible quickstarts, substantive questions, and
   workflow outcomes. Impressions and stars are distribution signals, not
   product proof.
4. **Classify.** Put each sanitized observation in one category: setup, data,
   scoring, workflow, trust, or channel. Do not store names, emails, account
   identifiers, tokens, or raw customer URLs.
5. **Convert.** Turn a repeated or reproducible objection into a documentation
   change, issue, test, or explicitly deferred item. Link the evidence and
   name the next owner role.
6. **Verify.** Re-run the smallest relevant fixture or gate. Update release
   language only when the new evidence supports it.
7. **Repeat.** Choose the next question from the observed record, not from the
   loudest isolated request.

## Evidence contract

Every launch-cycle signal needs:

- a measurement window;
- a source or observation method;
- a baseline, or an explicit `null` when no baseline exists;
- a target and decision caveat; and
- a value, or `null` until a human records a real observation.

The loop keeps release evidence separate from audience signals. `pnpm check`
and `pnpm benchmark` can demonstrate repository behavior; neither demonstrates
adoption, retention, reach, or commercial outcomes.

Evidence is explicitly stateful: `declared` points to an existing release
record that still needs re-observation for a new tag, while `verified` means the
named command was run against the current tree. The initial cycle keeps the
release record declared and the offline benchmark verified.

## Feedback contract

Feedback is sanitized before it enters the cycle. A record contains a stable
local id, channel, date, category, short summary, evidence reference, status,
and next action. It does not contain a person's identity or a raw message dump.
Repeated feedback should become a test or issue; a one-off preference remains a
qualitative note until it recurs.

## Running the loop

Validate the committed cycle with:

```bash
pnpm validate:launch-loop
```

Run the readiness validator and the deterministic quality corpus together with:

```bash
pnpm launch:loop
```

`pnpm launch:loop` does not publish a GitHub release, send a post, enable
telemetry, or mutate the cycle file. A human still decides whether to publish
and records any resulting observations in a later edit.

## Exit criteria

A cycle is ready to close when it has at least three reproducible quickstart
observations, a categorized feedback record, every confirmed defect linked to
an issue or test, and one selected next experiment. If the evidence is not
ready, leave the cycle active and state the missing evidence rather than
rounding an estimate into a success metric.
