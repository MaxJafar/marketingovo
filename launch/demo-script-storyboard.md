# 60–90 second demo script and storyboard

Target runtime: 82 seconds. Record at 1440p or higher, then export landscape and vertical crops. Use a fixture project labeled “Demo data.” Do not show real credentials, account names, queries, customer URLs, local file paths, or tokens.

## Storyboard

| Time   | Visual                                                                                                  | Voiceover                                                                                                                                                                    | On-screen copy                                                                                                           | Proof requirement                                                               |
| ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 0–6s   | Start on a dense audit export, then cut to the AGENTseo Top 5 Actions view.                             | “An SEO audit can find a thousand issues and still leave one question: what should we fix first?”                                                                            | `From issue volume → to a defensible decision`                                                                           | The issue export must be clearly labeled illustrative.                          |
| 6–14s  | Terminal runs `npx @agentseoapp/cli serve`; browser opens the local dashboard.                          | “AGENTseo is a local-first SEO operations system. Community Edition runs on your machine with no product account.”                                                           | `Local-first · No product account · Telemetry off by default`                                                            | Capture the actual start command and local address.                             |
| 14–24s | Open a demo site overview. Pause on source tiles showing available, stale, and unavailable.             | “It keeps source state honest. Fresh evidence, stale evidence, and missing evidence are different claims.”                                                                   | `Missing ≠ zero`                                                                                                         | Show at least two distinct source states from the fixture.                      |
| 24–34s | Start an audit, then show queued/running before the completed fixture run.                              | “Runs are asynchronous, so queued work is never presented as a finished audit.”                                                                                              | `queued → running → succeeded / partial / failed / cancelled`                                                            | Do not edit out the state transition in a way that suggests instant completion. |
| 34–49s | Open the first action. Highlight evidence, affected URLs, impact, effort, confidence, and verification. | “The output is an action queue. Every useful action explains what matters, where the evidence came from, how much work it may take, and how to verify the fix.”              | `Impact · Effort · Confidence · Evidence · Verification`                                                                 | Use an actual action shape from the fixture, not a composited card.             |
| 49–61s | Open the priority explanation and reveal the documented weighted inputs.                                | “The current priority model is transparent. It ranks work with severity, exposure, reach, confidence, and effort. It is a heuristic — not a traffic forecast.”               | `priority-v1 is documented and inspectable`                                                                              | Keep the formula readable for at least two seconds.                             |
| 61–71s | Change one demo action to done or show a before/after comparison, then start a verification run.        | “After the change, re-run the audit and record whether the action verifies. The workflow closes the loop instead of ending at export.”                                       | `Fix → re-audit → verify`                                                                                                | If using comparison data, show the two run dates or run IDs.                    |
| 71–82s | End card with install command, GitHub, and Full link.                                                   | “AGENTseo `0.11` is an alpha for design partners and contributors. AGENTseo is Apache-2.0 open source. Try it locally, or use GolemWorkers Full for managed team workflows.” | `Apache-2.0 open source`<br>`npx @agentseoapp/cli serve`<br>`github.com/GolemWorkers/agentseo`<br>`golemworkers.com/seo` | Keep the alpha, license, and Community/Full distinction on screen.              |

## Clean voiceover transcript

An SEO audit can find a thousand issues and still leave one question: what should we fix first?

AGENTseo is a local-first SEO operations system. Community Edition runs on your machine with no product account.

It keeps source state honest. Fresh evidence, stale evidence, and missing evidence are different claims.

Runs are asynchronous, so queued work is never presented as a finished audit.

The output is an action queue. Every useful action explains what matters, where the evidence came from, how much work it may take, and how to verify the fix.

The current priority model is transparent. It ranks work with severity, exposure, reach, confidence, and effort. It is a heuristic — not a traffic forecast.

After the change, re-run the audit and record whether the action verifies. The workflow closes the loop instead of ending at export.

AGENTseo `0.11` is an alpha for design partners and contributors. AGENTseo is Apache-2.0 open source. Try it locally, or use GolemWorkers Full for managed team workflows.

## Recording checklist

- Use a clean browser profile with notifications disabled.
- Use a fixture project and place “Demo data” in the project name.
- Increase UI zoom until labels remain legible in a mobile feed.
- Capture pointer movement slowly; do not circle every element.
- Keep secrets, token files, provider identifiers, and personal paths outside the frame.
- Add captions from the clean transcript and check them manually.
- Add the storyboard alt text to the video post: “A local AGENTseo alpha workflow moves from explicit data-source states to an evidence-backed action, a transparent priority explanation, and a verification run.”
- End on the CTA card for at least three seconds.

## Optional 60-second cut

Remove the terminal start sequence after its first two seconds, shorten source states to six seconds, and combine the priority and action scenes. Keep the alpha qualifier, “Missing ≠ zero,” and the Community/Full distinction.
