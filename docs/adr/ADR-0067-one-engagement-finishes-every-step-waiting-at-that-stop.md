# ADR-0067: One engagement finishes every step waiting at that stop

- Status: Accepted (2026-09-23)
- Settles: whether a `read` step may share a stop with a `visit` (or another `read`, or a `collect`) naming
  the same landmark, which ADR-0065's tier 1 needs and the runtime did not allow.
- **Amends ADR-0036** in one respect: the landmark chain (card → passages → the step's lines → the
  question) now runs over **every** arrival step in a row naming the engaged landmark, not over the one
  current step. The chain's order and its one-continuation contract are unchanged.
- **Retires a constraint recorded in ADR-0063 (content obligation closure) and ADR-0065 (Context, "The
  stop ceiling")**: "a `read` step … may **not** share [a stop] with a `visit`". Neither ADR decided that;
  both measured it. ADR-0065's ceiling on `answer` steps per stop is **unchanged** — see §2.
- Moves no domain rule. `progressQuest` still matches one event against the current step only
  (`TN-QUEST-04`); nothing is skipped and nothing is queued.
- Slice: L5 (`docs/plan/slices.md`), ADR-0065 tier 1.
- Numbering. `git log --all --name-only -- docs/adr` after `git fetch`, and every remote head
  (`main`, `archive/v0.1`, `read-step-at-dows-lake`, `task-strip-gate`), top out at ADR-0066. 0067 is the
  first number above it.

## Context

`QuestController.visited(target)` (`app/bootstrap/quest.ts`) advanced **exactly one** step per
engagement: if the current step was a `visit`/`collect`/`read` naming the target, it called
`progressQuest` once and returned. A quest written `visit rideau-locks → read rideau-locks → answer`
therefore finished the `visit` at the locks and left the `read` step current **while the player stood in
front of the locks** — the tracker read "Stop and read at the Rideau Locks", the question after the card
was drawn for no task, and the quest waited for a second tap on a card the player had just closed.

`tests/unit/contracts/a-quests-answer-steps-fill-in-one-sitting.test.ts` models one engagement per stop
in x order, so it reported the quest unfinished — which is what happened when the first `read` step was
attempted at the Rideau Locks. The step had to be given a stop of its own (Dow's Lake, drawn for it), and
because seven of ten levels place exactly as many non-`answer` steps as stops, **tier 1 had nowhere to put
a `read` step on the 43 stops that already exist.**

## Decision

### 1. One engagement is one arrival, and it finishes the whole run

Engaging a landmark finishes every **consecutive** `visit`, `collect` or `read` step, from the current
step on, whose `targetId` names that landmark. Each is completed in order by its own `progressQuest`
event. The run ends at the first step that is:

- an `answer` step — so the question still comes before whatever follows it;
- a `talk` step — completed only by accepting an offer (`acceptQuest`), never by walking up;
- a step naming anywhere else — so nothing is skipped.

The rule is one pure function, `stepsFinishedOnArrival` in `app/bootstrap/arrival.ts`. The controller
advances by it and the one-sitting walk walks by it, so the gate cannot model a different game.

**Why the composition root and not the domain.** The domain's rule is per event: one event, the current
step, no skipping. What one *engagement* amounts to — how many arrival events a tap on a landmark is — is
an interpretation of a player action, and that already lives beside `visited()` (it is where `read` was
made to complete on arrival, ADR-0063). Folding it into `progressQuest` would make the domain decide
which event kinds share a target, for one caller.

### 2. What one engagement shows

One chain, in the order it already had: **card → every passage of every `read` step in the run, in step
order, in one reader → each step's lines, in step order, one dialogue per step (a dialogue has one
speaker) → the question.** The caller's continuation is paid once, after the last line. A run of one is
exactly what it was.

### 3. The budget is per stop, and now it has a gate

ADR-0065 §3.3 already counts "every `read` step sharing a `targetId`" together. That sentence is now what
one reader sheet holds, so it is gated:
`tests/unit/contracts/a-stop-reads-at-most-four-passages.test.ts` sums passages and words per quest per
stop over the real lesson corpus (≤ 4 passages, ≤ 120 words in either language). Dow's Lake measures 2
passages, 48 words EN / 59 FR — the figures the ADR-0065 row recorded.

This is a unit gate, written because this change made the budget load-bearing before its owner's gate
existed. **It does not discharge ADR-0065's infra obligation (due 2026-12-21)**, which asks for the gate
in `scripts/lib/lesson-passages.mjs` with counts reported as numbers; when that lands, this file is
deleted or folded into it.

### 4. What does not change

- The `answer`-step ceiling in ADR-0065's Context: a stop still fills at most one `answer` step in one
  pass, so a quest still holds no more `answer` steps than its level places stops.
- A step that comes **back** to a stop after that stop's question is still unreachable in one pass, and
  the walk still says so.
- Content: no quest moves. Converting existing stops to `visit → read` is content's work under ADR-0065.

## Alternatives considered

- **Keep one step per engagement and let the player tap twice.** Rejected: the second tap re-shows a card
  just read, spends a question on no task, and the walk — correctly — calls it a stall.
- **A domain `progressQuestRun`.** Rejected for §1's reason; also every existing caller of `progressQuest`
  would keep its per-event contract, so the domain would carry two rules for one caller.
- **Merge `read` into `visit` (a `visit` carrying `passages`).** Rejected: ADR-0063 §3 gives a read step
  one voice and forbids `passages` beside `dialogue` on one step; two steps keep that.

## Consequences

- Tier 1 can place a `read` step directly after the `visit` at any existing stop, without new art.
- `QuestController.awaits(target)` answers from the same rule, so the prompt's "still to do" agrees with
  what the tap will finish.
