# ADR-0062: A landmark is never paced by the day's new-question budget, and the budget is Study's alone

- Status: Accepted (2026-09-19)
- **Amends ADR-0054**, which exempted a quest `answer` step's promised count from `scheduler.dailyNewLimit`.
  That exemption stands and is widened: every draw a **level** makes is exempt, a landmark stop standing
  outside a task included. ADR-0054's reasoning is not overturned — it was too narrow.
- **Amends nothing in ADR-0036 or ADR-0048.** A level still asks its own subject, a task step still asks
  what it has left where the player is standing, and a stop with no task still asks only what it told, or
  nothing. What changes is who the day's budget may silence.
- **Does not touch Study.** TN-STUDY-02's "new questions, but not all at once" is Study's pacing rule, the
  owner did not touch it, and §3 keeps it — the cap now binds Study and nothing else.
- Slice: A9 (`docs/plan/slices.md`), continuing the work ADR-0054 began.
- Numbering. **0062 is the first number above the high-water mark across every ref this repository can
  see**, checked the way ADR-0061 prescribes after a collision cost a renumber earlier in this project:
  `git log --all --name-only -- docs/adr` **and** `git ls-remote --heads origin`, with a `git fetch` before
  both. `main` (44936d5) holds ADR-0001…ADR-0037, ADR-0039…ADR-0049 and ADR-0051…ADR-0061.
  **The check was run twice, and the second run was not a formality:** at the start of this work `origin`
  published two heads, `main` and `archive/v0.1`; by the time the document was written it published two
  more, `gov-62-evidence` and `handoff-gate-flake`, neither of which existed at the first fetch. Both were
  fetched and read — `git ls-tree origin/gov-62-evidence docs/adr/` and the same for `handoff-gate-flake` —
  and both stop at ADR-0061 despite the first one's name. No ref anywhere claims 0062.
  `tests/unit/contracts/an-adr-number-is-used-once.test.ts` holds the result where the branches meet, which
  is the only place a concurrent claim can be caught.
- Criteria: the rules below, held by
  `tests/unit/contracts/a-landmark-asks-however-long-the-day-has-been.test.ts`.

## Context

### The ruling

From the product owner: **a landmark stop must bypass the daily new-question cap**, the same way a quest
`answer` step already does. A player who walks up to a landmark should always be asked something, no matter
how much they have already played today.

### What was actually shipped, measured rather than read

The ruling turns out to describe behaviour the build already has — but for a reason nobody wrote down, and
in a form that cannot survive the next change. Walking every level in `journey` order, every engageable in
player order, one UTC day, one fresh save, through the real bank and the real draw rule:

| | |
|---|---|
| Stops walked | 43 |
| New questions introduced in the sitting | **76**, against a `dailyNewLimit` of **10** |
| Stops whose draw changed when the budget was lifted entirely | **0** |

Not one landmark draw is paced today, for two unrelated reasons:

1. **A stop with a task step being played** is exempt by ADR-0054: `landmarkDraw` sets
   `dailyNewLimitApplies: false` on a promised count.
2. **A stop with no task** sets `onlyWhatItTells` (ADR-0048), and `scheduleReview` answers that branch from
   what the stop told and **returns before `selectQuestions` is ever called**. The budget is not bypassed
   there; it is never consulted.

So the second case holds the owner's ruling by accident of routing. The rule is not written anywhere, no
gate states it, and it lasts exactly as long as ADR-0048's "only what it told" does. Measured, with
`onlyWhatItTells` dropped — which is what a stop allowed to ask anything wider than its own sentence would
look like — the same journey on `origin/main` asks **18** questions and **falls silent at 17 stops** past
the budget, the first being `quebec-city/terrace-kiosk` with ten questions met that day.

### What the budget had quietly become

`introducedToday` counts every never-seen question the player met in the UTC day, from **any** source,
including the exempt ones. With levels introducing 76 against a limit of 10, the number no longer caps the
day's new material in any sense — levels blow through it by a factor of seven and nothing stops them. Its
only remaining effect is on the one activity that still obeys it. Measured at the end of that sitting:

- Study drills **5 questions, 0 of them new**.
- The same drill with the budget lifted: **5 questions, 5 of them new**.

That is the real decision this ADR has to make, and §2 makes it explicitly rather than leaving it as a
side effect of §1.

## Decision

### 1. Every draw a level makes states the exemption

`landmarkDraw` returns `dailyNewLimitApplies: false` on **both** branches — the task step's promised count
(ADR-0054, unchanged) and the stop standing outside a task (new). A landmark asks about the place the
player has walked up to; how much they have played today is not an input to that.

**This changes no draw in today's build, and that is the point of writing it.** The exemption stops being
inherited from where the draw happens to be answered and becomes a property of the draw itself. The
measurement above is the argument: relax ADR-0048's routing by one line and `origin/main` goes quiet at 17
stops, while this rule keeps every one of them asking.

A rule that is true only because of an unrelated module's early return is not a rule; it is a coincidence
with a good record so far.

### 2. `introducedToday` keeps counting every introduction, including the exempt ones

The question §1 forces: if nothing but Study is capped, does it still mean anything to count questions the
cap did not govern?

**Yes, and they keep counting.** What a new question costs is not the minute it takes to answer, it is the
reviews it owes for the rest of the month. A question first met at a landmark owes exactly what one first
met in Study owes. So the ledger measures the **day's load**, which is source-independent, and the cap then
decides the only thing it can still honestly decide: whether Study piles more on top of a day that has
already delivered.

The alternative — counting only what capped draws introduced — was rejected on the numbers. It would have
Study introduce ten more on a day that had already introduced seventy-six, which is the opposite of what a
limit named "new questions, but not all at once" is for.

**The cost, stated because it is real.** Study's new-material pacing is now set by how much the player
walked, not by Study. After a long sitting the budget is spent before Study is opened, so Study introduces
nothing new for the rest of that UTC day. Two things make that acceptable rather than merely tolerated:

- **Study is never starved by it.** A spent budget means at least `dailyNewLimit` questions were introduced
  today, and those are themselves reviewable, so the `due` and not-yet-due tiers fill the drill. Measured:
  five of five, none of them new, against five of five all new with the budget lifted.
- **It is the right shape.** A player who met seventy-six new questions walking the country should be
  consolidating them in Study, not opening ten more. What a heavy day changes is what Study is *for*.

What is given up honestly: the number is no longer a ceiling on the day's new material — levels ignore it —
and it should not be read as one. It is a ceiling on **Study's contribution to a day**, conditioned on what
the rest of the day already delivered.

### 3. Study keeps the cap, and is now the only thing that has it

`Study` passes no scope, so `dailyNewLimitApplies` is absent and defaults to `true`. TN-STUDY-02 is the only
story that ever asserted this limit, and it asserts it about a drill. The exam is untouched: `exam-session.ts`
allocates its own quotas and never calls the scheduler.

The gate states this from both sides, because an ADR that only exempted things would read as "the cap is
gone": after the same sitting, a Study drill introduces **no** new question, and the same drill with the
budget lifted introduces five.

## Consequences

- **A landmark always asks.** However long the day has been, and whatever ADR-0048's routing does next.
- **`scheduler.dailyNewLimit` means "how much new material Study adds to a day"**, and nothing wider. The
  name now overstates its reach; renaming it is a content-schema change and is not made here.
- **Study after a long sitting is consolidation, not new material.** A deliberate consequence (§2), not a
  defect to be reported as one.
- **Tests.** `a-landmark-asks-however-long-the-day-has-been.test.ts` is new and carries the failing case:
  on `origin/main` it reports 35 landmark draws still paced by the budget. One case in
  `landmark-questions.test.ts` reverses — a stop with no task asserted `dailyNewLimitApplies` was
  `undefined`, and now asserts `false`; that line was ADR-0054's ruling and is now this one's.
- **`a-quests-answer-steps-fill-in-one-sitting.test.ts` is untouched.** Its subject is a promised count
  coming back whole, which ADR-0054 decided and this does not revisit. Its docblock's note that a stop with
  no task "is still paced by `dailyNewLimit`" describes the intent this ADR reverses; the walk it performs
  is unaffected, because that draw never reached the budget anyway.

## Alternatives considered

- **Leave it alone: the behaviour is already right.** Rejected. It is right by coincidence, it is written
  down nowhere, and the mutation above shows exactly how it breaks: 17 silent stops behind a one-line
  change to a different ADR's routing.
- **Count only capped draws toward `introducedToday`.** Rejected in §2 on the numbers, and it would need the
  introducing activity persisted on every review record — a save-schema change and a migration (ADR-0026)
  bought for a worse learning outcome.
- **Raise `dailyNewLimit`, or drop it.** Rejected for the reason ADR-0054 gave: a bigger number moves a
  cliff without removing it, and dropping it discards the one rule TN-STUDY-02 actually asserts.
- **Make the cap per-drill rather than per-day.** TN-STUDY-02's scenario is written per drill ("when I run a
  drill, the number of questions I have never seen is at most the daily limit"), so this is a live reading.
  Rejected here as out of scope: it is a change to Study's own pacing, the owner ruled on landmarks, and the
  per-day ledger was a measured decision (`content/schemas/progress.schema.json` records that `reps === 1`
  let 26 of 30 questions through a limit of 10). It belongs in its own ADR if Study's pacing is revisited.
