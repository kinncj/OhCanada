# ADR-0054: A promised count is not paced by the day's new-question budget

- Status: Accepted (2026-09-17)
- **Extends ADR-0036 and ADR-0048. It amends neither.** A level still asks its own subject, a task step still
  asks everything it has left where the player is standing, and a stop with no task still asks only what it
  told. What is decided here is who the scheduler's `dailyNewLimit` applies to.
- Slice: A9 (fourth live-site audit, 2026-09-17).
- Numbering: `main` holds ADR-0001…ADR-0052, and ADR-0052 recorded 0050 and 0051 as spent. 0053 is the first
  number above that high-water mark, taken for the reason ADR-0052 states: a number is retired by having been
  used, and an ADR filed below the ones it builds on reads as older than them for ever.
- Criteria: the rules below, held by the tests named under Consequences.

## Context

A fourth live-site audit found **Peggy's Cove cannot be completed**, which leaves Québec City and every level
after it Locked for every new player. Seen on two independent runs.

What the audit saw: the lighthouse's giver says "…then three questions", the tracker reads
`Answer 3 questions about English and French in Canada`, and **exactly one question appears**. It carries no
counter, and the only button after answering it is "Finish". The tracker then reads "Answer 3 questions" for
ever: the two remaining stops give plain fact cards, walking back offers only "Done. See this one again", and
the end of the level draws "Your task here is not finished yet" with no stamp. The first question differed
between the two runs, so the pool is neither empty nor broken.

### The cause

**Not content, and not the quest document.** All five ids in the step's `questionPool`
(`wwa-22`, `wwa-23`, `wwa-24`, `wwa-25`, `wwa-31`) are `verified` for the `sourceHash` they cite, carry
evidence, are bilingual in prompt, explanation and all four options, and sit in `who-we-are`, which is Peggy's
Cove's `subject`. `an-answer-steps-pool-can-fill-its-count.test.ts` was green and was right to be.

**The scheduler's daily new-question budget did it.** `selectQuestions` ranks a pool in three tiers and caps
the middle one:

```ts
const newBudget = Math.max(0, settings.dailyNewLimit - introducedToday(reviews, now));
...[...fresh].sort(byKeyThenJitter).slice(0, newBudget),
```

`dailyNewLimit` is **10** (`content/game.config.json#/scheduler`). Unlocking Peggy's Cove requires finishing
Halifax's task (ADR-0036 §1: the stamp is for the task), and Halifax's quest asks **2 + 2 + 3 + 2 = 9**
questions, every one of them new to a new player. That leaves a budget of **one** for the rest of that UTC
day. Peggy's Cove's first `answer` step asks three from a pool of five nobody has met, so the draw comes back
with exactly one — and every later draw that day comes back with none.

**Nothing recovers it.** A never-seen question is pushed with `due: true`, so `heldBack` is false for it and
the relaxation pass at the end of `selectQuestions` — which exists precisely to avoid a short draw — can only
bring back questions the *window* held, never one the *budget* cut. The draw is short, silently, with no
error: `Result` is `ok`. `counterForDrawn` then honestly counts to what was drawn, collapsing the counter to
`{ answered: 0, total: 1 }`, and ADR-0036 §3's "no counter for one question" correctly draws no counter at
all. Every visible symptom the audit listed is a downstream component behaving exactly as specified over a
draw that should never have been short.

**This is not specific to Peggy's Cove.** Any `answer` step drawing new questions after the day's ten are
spent gets the same short draw. Peggy's Cove is simply the one every new player meets first, because the only
route to it spends nine of the ten immediately before it. The audit's other levels chained correctly because
each was reached with budget in hand.

## Decision

### 1. `dailyNewLimit` paces Study, and does not pace a promised count

`SelectionRequest.dailyNewLimitApplies` (default `true`) is `false` for a draw whose count the game has
**already promised the player on screen**. In shipped behaviour that is exactly one thing: a quest `answer`
step, whose `count` the HUD prints as "Answer 3 questions" before a single question is asked.

The limit is TN-STUDY-02's — "new questions, but not all at once" — and it is a *pacing* rule for a drill the
player chose to take and may leave at any time. A task step is not that. It is a bounded assessment the quest
named a number for, the player accepted, and cannot finish by any other route. Pacing it does not slow
learning down; it makes the level unfinishable and the next nine unreachable.

`Study` passes nothing and keeps the cap. The exam is untouched: `exam-session.ts` allocates its own quotas
and never calls the scheduler.

**Why a bypass and not a bigger number.** Raising `dailyNewLimit` moves the cliff without removing it —
Halifax's 9 and Peggy's Cove's 6 are 15 on day one, and the ten levels ask 60 — and it would still be a silent
short draw at whatever the new number is. The defect is not that the budget is too small; it is that a budget
was consulted about a question the game had committed to asking.

**Why not lower the counts.** The pools can fill the counts. Lowering a count to fit a budget would be hiding
a scheduler defect in the content, and would shorten the teaching to do it.

### 2. A task that cannot be filled does not ship

The audit's own question: a quest that promises three questions and can ask one is a state to refuse at build
time, not to recover from at runtime. `an-answer-steps-pool-can-fill-its-count.test.ts` already checks the
pool against the step's count, and was green throughout — it measures the *document*, and the defect was in
the *sitting*.

So the gate is extended by a second one that plays the game:
`a-quests-answer-steps-fill-in-one-sitting.test.ts` walks every level in `journey` order, on one UTC day, from
one fresh save, through the real bank, the real `landmarkDraw` and the real `StudySession`, answering every
question it is asked — and requires every `answer` step's first draw to hand back its whole `count`. It fails
on the old behaviour at Peggy's Cove's first step, which is the audit reproduced as an assertion.

### 3. The missing progress line is a symptom, and is already fixed by rule 1

"Question 1 of 3" was absent because the draw was short, not because the in-level card cannot count. The card
counts the task (`QuestionView.progress`, ADR-0036 §3), `counterForDrawn` collapsed the total to 1 honestly,
and `counts()` correctly hides a counter of one. With rule 1 the step draws three, the counter reads
"Question 1 of 3", and the button reads "Next". **No card change belongs in this fix**, and none is made.

## Consequences

- **A first-day player can finish every level.** Sixty task questions on one day, where ten were the ceiling.
- **The daily limit now means what its name says** — a cap on new material the player did not ask for — and is
  unchanged for Study, which is the only place TN-STUDY-02 ever asserted it.
- **A task step may introduce a question whose moment the scheduler would have chosen differently.** Accepted:
  the quest already chose, by naming a pool and a count.
- **Tests.** `a-quests-answer-steps-fill-in-one-sitting.test.ts` is new. `question-scheduler.test.ts` gains the
  blocker reproduced at the scheduler and the unchanged Study pacing beside it;
  `landmark-questions.test.ts` gains the scope flag on a task draw and its absence on a stop with none.

## Alternatives considered

- **Raise `dailyNewLimit`.** Rejected above: it moves the cliff and keeps it silent.
- **Lower the steps' counts to fit the budget.** Rejected: the content can fill them, and this would hide a
  scheduler defect in the quest documents.
- **Let the relaxation pass bring back budget-cut questions.** Rejected: it would quietly defeat the limit for
  Study too, which is the one place the limit is wanted, and `heldBack` would stop meaning "the window held
  it".
- **Make the short draw an error card.** Rejected: it tells the player the game is broken instead of asking
  the question it promised. `TN-QUEST-05`'s notice stays for a step that genuinely cannot start.
