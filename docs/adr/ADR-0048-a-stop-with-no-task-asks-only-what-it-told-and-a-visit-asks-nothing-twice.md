# ADR-0048: A stop with no task asks only what it told, and a visit asks nothing twice

- Status: Accepted (2026-09-15)
- Amends: ADR-0036 §2 (rule 4's fallback to the whole subject when no step is being played) and its consequence
  "24 of the 36 landmarks … ask a question from the subject rather than about the landmark"; the `TN-CARD`
  in-level note.
- Slice: L1a (`docs/plan/slices.md`).
- Criteria: the rules below, held by the tests named under Consequences.

## Context

The second live-site audit (P2 #9) rode the Prairies with the task declined:

- the grain bins asked "Quebec held referendums on sovereignty in 1980 and again in 1995. What was the result
  both times?" (`mc-16`), tagged "New question", and the audit answered it wrongly;
- the combine harvester asked the **same** question, tagged "You have seen this question before";
- the container car asked about Bombardier (`mc-35`).

None of the three is about the place. Evidence: the audit run's screenshots `L07-quest-s0-q0.png`,
`L07-quest-s0-q0-wrong.png` and `L07-quest-s2-q2.png`, kept with that run and not in this repository.

**Cause 1: with no step being played, the draw was the whole subject.** `landmarkDraw` answered
`{ count: 1, scope: { subject, teaches } }`. `teaches` was a preference only: `scheduleReview` asks first a
question resting on the landmark's sentence, when one exists, and the scheduler fills the count from the rest of
the subject. No `modern-canada` question rests on the grain bins', the combine's or the container car's sentence —
those sentences are graded by `economy` and `regions` (`eco-43`, `eco-27`/`reg-37`, `eco-01`) — so each drew any of
the level's 40. Across the ten levels, **24 of 35 landmarks** tell a sentence that no question in their level's
subject rests on (the L1 gap list), and every one of them did the same.

**Cause 2: nothing held a question back for the visit once it came due.** `selectQuestions`' exclusion window
holds back only a question whose moment has not arrived. That is deliberate — `TN-CARD-02`'s "a question answered
wrongly is in the next drill" — but a wrong answer is due after the first learning step, one minute
(`learningStepMinutes: [1, 10]`), and missed questions are a hard tier above everything else due. The train takes
longer than a minute from the grain bins to the combine, so the question just answered wrongly was the scheduler's
first choice at the very next stop. `StudySession.recentlyAsked` was kept and passed; it could not help, because
the window is exactly what a due question skips.

## Decision

### 1. A stop with no task step asks only what it told, or nothing

When no `answer` step is being played, a landmark asks **at most one** question, and only one that rests on the
sentence its card has just told (`source.quote`, matched as ADR-0036 §2.4 matches it), inside the level's subject,
and not answered in this visit. ADR-0036 §2.4's "not asked in this sitting" holds as well: a told question the player
answered earlier in the sitting, in a Study drill over the level or on an earlier visit, is held back while it is in
the exclusion window; one put on screen and closed unanswered is asked again (`TN-CARD-05`). When there is none, the card closes back into the level: no question, no notice,
nothing in the console. An empty draw here is the rule working, not a bank that failed (`TN-QUEST-05` stays for
a step that cannot start).

Mechanically, `landmarkDraw` marks the scope `onlyWhatItTells`, and `scheduleReview` narrows the askable bank to
the preferred ids (`preferOnly`) after it has found the bank askable, and answers that draw itself rather than hand it
to the scheduler, whose fill-up relaxes the exclusion window, so "nothing to ask here" and "the questions
are not ready" stay two different answers.

**Why this, and not the other candidates.**

- **It is ADR-0036's promise kept without the fallback that broke it.** "A landmark asks what it just told" is the
  learning moment: read a true sentence, standing in front of the thing, and be asked about that sentence. A
  question about Québec's referendums after a card about Saskatchewan's grain teaches the opposite — that the card
  and the question after it have nothing to do with each other.
- **Asking the stop's task pool was rejected.** Each pool is about what the `visit` step's dialogue teaches — the
  grain bins' pool is life after the war (1951, oil in 1947, the vote) — and a player who declined the task never
  hears that dialogue; the landmark's card tells its blurb. A pool question outside the task is a quiz on something
  not taught. It would also spend the task's questions before the task: seven pools hold exactly their count (the
  combine's is `mc-01`, `mc-08`), so a player who accepted later would be asked them again. And three landmarks are
  no stop of any task (Ottawa's Rideau locks, Peggy's Cove's granite shore, the North's spruce stand).
- **Asking another subject's question on the same sentence was rejected.** ADR-0030 §2: a level asks its own
  subject. Toronto's streetcar sentence is `government`'s to grade.
- **The cost is stated, not hidden.** Outside a task, 24 of 35 landmarks now ask nothing until content fills the L1
  gap list. Every level ships a task, the task is where a level assesses, and Study draws from every bank.

### 2. Nothing is asked twice in one level visit

- **A visit** is one opening of a level: from loading it to leaving it. The list lives with the level in the
  composition root (`openLevel`), and nothing about it is saved.
- **Answers, not draws, spend a question.** A card closed unanswered is asked again at the landmark (`TN-CARD-05`).
- **Every landmark draw is told what the visit has answered** (`DrillScope.answeredHere`), and `scheduleReview`
  removes those ids before anything else looks at the bank: before the preference, the missed tier and the
  exclusion window.
- **A stop with no task step asks nothing rather than repeat.**
- **A task step whose scope the visit has spent asks again what it answered**, least recently answered first and
  only as many as it is short (`repeatWhenExhausted`), because a step the player cannot finish is a dead end. In
  shipped content that can happen only one way: a question answered at a stop with no `answer` step being played that also sits
  in a pool holding exactly its count — the grain elevator tells the sentence `mc-08` rests on, and `mc-08` is one
  of the combine's two. Otherwise pools within a quest do not overlap and a wrong answer still completes a step.
- **It says so.** `quest.askedAgain` — "You have already answered some of these questions here." / « Vous avez déjà
  répondu à certaines de ces questions ici. » — in the HUD notice and the live region, cleared when that set of
  questions ends. "Some", because the set can mix new and repeated questions: the combine after the grain elevator
  asks `mc-01` new and `mc-08` again. The card's tag says which one the player has seen before.
- **Study is unchanged.** It passes no scope. A drill taken from the menu over a level does not count toward the
  visit, and `TN-CARD-02`'s wrong-answers-come-back promise still holds for it.

### Copy

One row, `quest.askedAgain`, written by `app/ui` and listed in `COPY_GAPS` for the product owner to ratify.

## Consequences

**What each level asks outside a task**, measured over the shipped content on 2026-09-15 (a verified question in
the level's subject resting on the landmark's own `source.quote`):

| Level (subject) | Asks, one per engagement | Asks nothing | Gives the task (a dialogue, no card) |
|---|---|---|---|
| Halifax (rights) | `market-stall` (`rights-25`) | `town-clock`, `pier-21`, `harbour-tug` | |
| Peggy's Cove (who-we-are) | — | `granite-shore`, `fish-store`, `village-house` | `peggys-point-light` |
| Québec City (history) | `chateau-frontenac` (`hist-12`), `city-wall` (`hist-17`) | `terrace-kiosk` | |
| Ottawa (government) | — | `rideau-locks`, `library-of-parliament`, `parliament-hill`, `warming-hut` | |
| Toronto (elections) | — | `streetcar`, `cn-tower`, `nathan-phillips-square` | |
| Winnipeg (justice) | `human-rights-museum` (`jus-12`) | `footbridge`, `autumn-maple` | |
| The Prairies (modern-canada) | `grain-elevator` (`mc-08`) | `grain-bins`, `combine-harvester`, `container-car` | |
| Alberta foothills (economy) | `ranch-barn` (`eco-11`), `pump-jack` (`eco-30`), `beef-cattle` (`eco-46`) | `ranch-gate` | |
| Vancouver (symbols) | `canada-place` (`sym-04`, `sym-05`) | `marina`, `bulk-carrier` | |
| The North (regions) | `driftwood` (`reg-51`) | `spruce-stand` | `yukon-river-sternwheeler` |

While an `answer` step is being played nothing changes: it still asks everything it has left wherever the player is
standing (ADR-0036 §2.2), narrowed by its pool, counted by the card, with the landmark's own question first. While a
task is on a `visit` or `talk` step, a landmark that is not the step's target, or one engaged again, follows rule 1:
the rule is about the step being played, not about whether a task was accepted.

- **The L1 gap list is now what makes a stop with no task ask anything.** Re-pointing a blurb to the sentence an
  authored question rests on is the content fix, as before.
- **Tests.** `tests/unit/contracts/a-stop-outside-a-task-asks-only-what-it-told.test.ts` (new) draws every
  landmark of every level through the real rule, session and bank, and fails on any candidate that does not rest on
  the landmark's sentence or any repeat within a visit. `tests/e2e/stops-without-a-task.spec.ts` (new) rides the
  Prairies with the task declined. `landmark-questions.test.ts`, `schedule-review.test.ts` and
  `study-session.test.ts` gained cases that fail on the old behaviour, including the audit's repeat reproduced
  over the shipped bank. `copy.test.ts` pins the new gap (73). `study-and-settings.spec.ts`'s "reaching a landmark
  teaches, then asks" walks past the Town Clock, which asks nothing now, to the market stall.

## Alternatives considered

- **Ask the task pool of the stop.** Rejected above: untaught material, and it spends pools that hold exactly their
  count.
- **Keep the subject fallback and only fix the repeat.** Rejected: the grain bins and the container car would still
  ask about referendums and snowmobiles.
- **Drop the scheduler's due bypass for everyone.** Rejected: "a question answered wrongly is in the next drill"
  is Study's promise (`TN-CARD-02`, `TN-STUDY`), and the repeat is a property of a level visit, not of the
  scheduler.
- **Count drawn questions rather than answered ones.** Rejected: a question closed unanswered would never be asked
  again in the visit, against `TN-CARD-05`, and a task step would repeat questions the player never answered.
- **Repeat at a stop with no task once its own question is spent.** Rejected: nothing depends on it, and "Done. See
  this one again" re-opens the card, which is the fact the player came back for.
