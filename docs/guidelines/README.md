# Content guidelines

**For anyone who wants to fix a fact or add a question. You do not need to be a programmer.**

TrueNorth teaches the material on the Canadian citizenship test. People study with it for a real exam, so
a wrong fact here is as serious as a crash. That single sentence explains every unusual rule on these
pages: we have to be able to *prove* where each claim came from, and we have to notice when it stops
being true.

The most valuable thing you can send us is "this is wrong, and here is the page that shows it".

## Start here

| You want to | Go to |
|---|---|
| Report a wrong answer, a bad translation, a misleading question | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md#report-a-wrong-question-or-a-wrong-depiction) — open an issue. No setup, and it is a first-class contribution. |
| Write a new question | [`add-a-question.md`](add-a-question.md) |
| See a real question file explained line by line | [`anatomy-of-a-question.md`](anatomy-of-a-question.md) |
| Understand why you may not mark your own question verified | [`who-writes-what.md`](who-writes-what.md) |
| Understand why the official guide is sometimes wrong, and what that means for your question | [`when-the-guide-is-out-of-date.md`](when-the-guide-is-out-of-date.md) |
| Write French, or fix ours | [`both-languages.md`](both-languages.md) |
| Write a landmark blurb, an NPC line or a quest | [`dialogue-quests-and-landmarks.md`](dialogue-quests-and-landmarks.md) |
| Write or draw anything about Indigenous peoples | [`indigenous-content.md`](indigenous-content.md) |
| Run the checks before you push | [`running-the-checks.md`](running-the-checks.md) |

## The five things that surprise people

Read these now; each is explained properly in the page beside it.

1. **A question is not just a question.** It carries the source it came from, the exact passage the author
   read, a page number, a date, a "can this change without notice?" flag, and a verification block written
   by somebody else. See [`anatomy-of-a-question.md`](anatomy-of-a-question.md).
2. **You may not verify your own question, and neither may we.** A separate reader finds the passage
   independently. A check is enforced over git history, so one commit cannot both write a claim and grant
   it. Send questions unverified; that is the correct and expected state.
   See [`who-writes-what.md`](who-writes-what.md).
3. **The official guide is out of date in specific, recorded places** — the G8 still lists Russia; page 84
   still prints the pre-2018 line of *O Canada*. A question whose answer is one of those facts marks a
   *better-informed* learner wrong. See [`when-the-guide-is-out-of-date.md`](when-the-guide-is-out-of-date.md).
   If you read only one page here, read that one.
4. **Everything a player reads ships in English and French, together, in the same file.** Not later, not as
   a follow-up pull request. See [`both-languages.md`](both-languages.md).
5. **Nothing may be copied from the guide.** Paraphrase in plain language. A run of 14 or more words shared
   with the source fails the build.

## House rules for these pages

- **The decision records win.** `docs/adr/` holds the reasoning; these pages hold the instructions. Where
  they disagree, the ADR is right and the guideline is a bug — please open an issue.
  The ones behind this directory are [ADR-0003](../adr/ADR-0003-content-verification.md) (verification),
  [ADR-0010](../adr/ADR-0010-where-player-facing-text-lives.md) (where text lives) and
  [ADR-0016](../adr/ADR-0016-an-unrevised-source-is-a-different-problem-from-a-stale-cache.md) (what to do
  when the source itself is wrong).
- **The gates are strict, and every refusal has a reason.** If a check refuses your change and you cannot
  tell why from its message, that is our failure to explain, not yours to absorb. Say so in the pull request.
- **If a check fails about something you never touched, stop and tell us.** Some gates read today's date and
  can turn a green branch red overnight. Do not try to fix those; they are ours.

## Where the content lives

| Path | What it holds |
|---|---|
| `content/questions/<subject>/<id>.json` | one question per file |
| `content/sources/<id>.json` | the register of every document we quote, and what is known to be wrong in it |
| `content/quests/*.json` | quests, and what characters say during them |
| `content/levels/*.json` | levels, and the landmark blurbs a player can tap |
| `content/schemas/*.json` | the rules every file above is checked against |

The schemas are readable, and they are the real contract: each field carries a description saying what it is
for. If these pages and a schema disagree, the schema is what the build enforces.
