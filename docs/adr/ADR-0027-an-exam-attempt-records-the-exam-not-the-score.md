# ADR-0027: An exam attempt records the exam, and the score is read out of it

- Status: Accepted (2026-09-09)

## Context

Exam mode is fully specified — `TN-EXAM-starting-and-answering.md`, `TN-TIMER-the-exam-clock.md`,
`TN-RESULT-exam-results.md`, `TN-ATTEMPT-leaving-and-resuming-an-exam.md` — and it has been deliberately
unbuilt through three sessions for one reason, recorded four times by four screens as `OQ-EXAM-3`,
`OQ-RESULT-1`, `OQ-SAVE-8` and `OQ-ATTEMPT-1`:

> `content/schemas/progress.schema.json#/$defs/examAttempt` records `askedQuestionIds`, `correctCount`,
> `passed` and `timed`.

That is a score line. Four shipped promises need more than a score line, and none of them can be met by
computing harder:

| Promise | What the record cannot answer |
|---|---|
| Results **by subject** (`slices.md` F1, `TN-RESULT-03`) | Which questions were right. The subject is derivable per question; correctness is not derivable at all. |
| **See every question** (`TN-RESULT-05`) | What the player chose — and *unanswered* is a third state, distinct from wrong (`TN-EXAM-04`, `TN-TIMER-05`). |
| **Resuming an abandoned attempt** (`TN-ATTEMPT-02`) | The draw order, the answers so far, and that an answer may be changed until the exam ends. |
| **The clock** (`TN-TIMER-03`) | How much time is left, so it can come back paused two days later. |

Four screens found the same gap independently, which is usually the sign that the missing thing is one thing.
The UI agent proposed the shape: `answers: [{ questionId, chosenIndex: number | null, answeredAt }]` plus
`remainingMs`, making `askedQuestionIds` and `correctCount` derivable. This ADR judges that proposal, keeps
most of it, and settles the three questions it left open: what a result must carry to survive the bank
changing under it, whether the derivable fields are kept or removed, and where the unfinished exam lives.

The save format is already at version 2 with a working migration (`app/application/persistence/save-migrations.ts`,
ADR-0015's tripwire discharged), so a format change now costs one more step in a list that already exists —
which is exactly why this is the moment to make it.

## Decision

### 1. The attempt records the exam. Every total is read out of it, and no total is stored beside it

`answers[]` in draw order **replaces** `askedQuestionIds` and `correctCount`. Both are removed, not kept
alongside:

- `askedQuestionIds` is `answers.map(a => a.questionId)`.
- `correctCount` is `answers.filter(isCorrect).length`.
- "Answers given: 12 of 20" (`TN-ATTEMPT-03`) is `answers.filter(a => a.chosenIndex !== null).length` of
  `answers.length`.
- The unanswered count (`TN-RESULT`, `exam.result.unanswered`) is the complement, and is *not* the wrong
  count. That distinction is the whole reason `chosenIndex` is nullable rather than a sentinel index.

Two stores for one fact is how they start disagreeing, and neither JSON Schema nor a type can check that a
stored `correctCount` equals the answers beside it — a schema cannot count. Keeping both would leave every
consumer choosing which one to believe, and a hand-edited or half-migrated save is precisely where they
differ.

### 2. The attempt copies down what the bank might change, and nothing else

Each answer carries four fields:

| Field | Why it is on the attempt |
|---|---|
| `questionId` | The draw, in order. |
| `subjectId` | `TN-RESULT-07`: a result read a year later still shows its by-subject rows when the question has left the build. A lookup would erase the row instead. |
| `chosenIndex` (`number \| null`) | What the player chose. `null` is *unanswered*, a state `TN-EXAM-04` and `TN-TIMER-05` both require to be distinct from wrong. |
| `correctIndex` (`number`) | What was marked right **at the time**. `TN-RESULT-07`: "no score is recomputed from a bank that has changed". |

This looks like duplication of the question bank and is not: the bank says what is true *now*, the attempt
says what the player was graded against *then*. A question corrected in a later build must not retroactively
change a result a player already read.

**There is no `correct` flag.** Correctness is `chosenIndex === correctIndex`, evaluated inside the document,
and this is the one place where the shape does real work: with a stored boolean, `{ chosenIndex: null,
correct: true }` — an unanswered question that scored — is a *writable* state that has to be forbidden by a
conditional, mirrored in the shipped validator, and tested. With the index pair it cannot be written down.
The stories' phrasing ("the unanswered questions are recorded as unanswered, not as wrong") is a property of
the data rather than a rule about it.

**`answeredAt` is not taken.** It was in the UI agent's proposal and nothing in four story files reads it:
not the result, not the review, not the resume screen, and the FSRS review record keeps its own timestamps.
Per ADR-0008 it can be added when something calls it — as a nullable field, in a version where it is honest
that older attempts do not have one.

### 3. The exam in progress is not a row in the history

`ProgressSnapshot` gains `examInProgress: ExamInProgressDocument | null` beside `exams`, and the two shapes
are different documents:

```
examAttempt      { startedAt, finishedAt,  answers[], passed, timed }   -- a result, immutable
examInProgress   { startedAt,              answers[], remainingMs   }   -- live state, mutable
```

`TN-ATTEMPT-04` asks that "a document holding two attempts with no finish time fails the save schema check".
A nullable field holds at most one thing, so the state the check was meant to catch cannot be represented —
which is better than catching it, and is the same move as §2. Two more defects disappear with it:

- **`finishedAt` stops being nullable and `passed` stops being a lie.** `TN-ATTEMPT-01` says leaving an exam
  emits no result and that "no attempt is recorded as passed or not passed". In one array those two fields
  had to exist on an unfinished attempt, where `passed: false` says the player did not pass an exam they have
  not finished.
- **`remainingMs` exists only where it means something.** A finished attempt has no time left to keep, and
  nothing draws one.

They also have different lifecycles: history is appended to and never edited; the attempt in progress is
edited on every answer, is discarded by `TN-ATTEMPT-04`'s one destructive confirmation, and moves into
`exams` exactly once. Merging them is what created the cross-item constraint in the first place.

### 4. The clock is one number, and `null` is what "no clock" means

`remainingMs: number | null` on the attempt in progress. `null` means **this exam is untimed** — which is
also how `TN-TIMER`'s rule 4 (the timer may be switched off mid-exam and never back on) is recorded: the
number becomes null and the finished attempt records `timed: false`.

The in-progress attempt therefore carries **no `timed` flag**. Two fields would mean `{ timed: true,
remainingMs: null }` is writable and meaningless. The finished attempt keeps `timed`, because there the clock
is gone and whether it ran is the only thing left to say (`exam.result.withTimer`).

Milliseconds, not seconds, because everything else in this codebase that is a duration is milliseconds
(`holdToChooseMs`, `EpochMillis`); the clock still draws whole minutes (`TN-TIMER` rule 2), and rounding for
display is the screen's job. A duration is not an instant, so it stays a plain number on both sides of
`progress-document.ts` rather than becoming an `IsoInstant` (ADR-0012).

### 5. Floors: an empty `answers` is refused, and an absent one is a different refusal (ADR-0024)

`answers` is **required** and carries **`minItems: 1`**, in both attempt shapes.

- **Absent** — the document is refused for a missing required property. It is not an attempt with a default.
- **Empty** — refused by the floor, at its own path with its own message.
- Neither reduces to *the player answered nothing wrong*: an empty attempt otherwise reads as zero wrong,
  zero unanswered, and no by-subject rows to contradict a `passed` flag sitting next to it.

The floor is in the **schema**, not in a consumer, because every consumer agrees: an exam with no questions
is not an exam (ADR-0024 §2 — find the smallest thing that knows what empty means). It is *not* pinned to
`exam.questionCount` (20), which lives in `content/game.config.json`: a config change must not invalidate an
attempt a player already made, for the same reason `stampEarnedAt` is recorded rather than derived from
`unlockRules`.

`exams: []` keeps no floor and needs none — no exam taken is the normal state of a new game, and nothing
folds it into a verdict.

### 6. Save version 3, and a version-2 attempt does not survive it

`CURRENT_SAVE_VERSION` becomes 3. The 2 → 3 step sets `examInProgress: null` and **empties `exams`**.

A version-2 attempt cannot be converted, and this is not a shortcut: it records a total, and a version-3
attempt records twenty outcomes. Per-question choices, per-question subjects and the answer key as it stood
were never written down, so any conversion invents them — and the invention has a shape ADR-0024 names
exactly: twenty answers with `chosenIndex: null` would present a player's 16/20 as "answered nothing, got
nothing wrong". A migration that lies is worse than one that drops.

The loss is bounded, and the bound is checkable rather than asserted: **no shipped code path has ever written
an exam attempt.** Exam mode is unbuilt, `withExamAttempt` is called from tests only, so no save any player
holds contains one. `tests/unit/application/persistence/save-migrations.test.ts` states that and pins it.

## Alternatives considered

- **Keep `correctCount` (and `askedQuestionIds`) beside `answers`.** The compatible option: version-2
  attempts survive untouched and no migration drops anything. Rejected — it is the two-sources defect, and
  worse than usual here because nothing can adjudicate: a schema cannot count array members, so the two
  disagree silently and every screen picks a side. It also serves no real document (see §6) at the price of a
  permanent branch in every consumer.
- **Store `correct: boolean` per answer instead of `correctIndex`.** The UI agent's shape and `OQ-EXAM-3`'s
  recommendation. Rejected: it makes "unanswered but correct" writable, so the rule has to be re-stated as an
  `if`/`then`, mirrored in `progress-schema.ts` (which has no conditional machinery), and tested — three
  places to hold a rule that `correctIndex` makes unrepresentable. `correctIndex` is also strictly more
  information: the review screen can show what the right answer *was* for a question that has since changed.
- **Derive correctness from the question bank at read time, storing only `chosenIndex`.** The smallest record,
  and it fails `TN-RESULT-07` outright: a question removed from the build takes its own result with it, and a
  corrected answer key silently rewrites a result the player already saw.
- **One `exams` array with a nullable `finishedAt`, plus a schema rule that at most one item is unfinished.**
  The straight reading of `TN-ATTEMPT-04`. Rejected on the merits above (§3) — but the mechanics are worth
  recording, because they were the second reason and are a live constraint on this repository: the rule needs
  `contains` with `maxContains`, whose subschema must name `finishedAt`, and `ports-match-schemas.test.ts`
  fails any object declared outside the root or a `$def` (ADR-0007) with an exemption only for conditional
  applicators. So it would have cost either a `$def` that exists to be a predicate, plus a `SKIPPED_DEFS`
  entry, or a hole in the inline-object rule. When the shape that removes a constraint is also the shape the
  gates like, that is usually the shape.
- **Keep version-2 attempts in a legacy variant — `answers: null` meaning "recorded before this format".**
  ADR-0024's absent-versus-empty distinction, applied one level up, and it was tempting. Rejected: without
  `correctCount` such an attempt carries a `passed` flag and no number, so `exam.result.score` — the line the
  result screen is built around — cannot be drawn for it. It is a half-record every consumer must branch on
  for ever, to serve a set of documents that is empty (§6).
- **Refuse the whole save when a version-2 attempt is found**, rather than dropping it. Rejected: it trades a
  result the player does not have for the character, settings, stamps and review history they do.
- **`answeredAt` on each answer** — deferred, §2. **A per-answer `timeTakenMs`** — not proposed by any story,
  and this is a learning tool: per-question timing is a pressure metric with no screen to land on.

## Consequences

- **Exam mode is buildable.** Results by subject, "see every question", resume-after-a-closed-tab and a
  pausable clock all have somewhere to live. `TN-EXAM`, `TN-TIMER`, `TN-RESULT` and `TN-ATTEMPT` stop being
  blocked on `content/`. This ADR builds none of it.
- **The order was schema first (ADR-0007):** `content/schemas/progress.schema.json`, then
  `app/application/ports/progress-repository.ts`, then `app/domain/entities/progress.ts`, then the codec's
  mirror in `app/application/persistence/progress-schema.ts`, whose agreement with ajv is proved over several
  hundred mutations of a real save. The mirror gained `minItems`, which it had never needed.
- **`ExamAttempt` in the domain is now a finished attempt.** `withExamAttempt` appends it *and* clears
  `examInProgress`, because a finished attempt can only come from the one in progress and the two edits are
  one transition. The use case that runs an exam owns everything else.
- **Rules this change does not mechanise, stated so their silence is not read as compliance:**
  - **`passed` is recorded, not derived**, like `stampEarnedAt` — `exam.passMark` is config and may change
    under a saved result. Nothing checks that a recorded `passed` agrees with the answers beside it; that is
    the one derivable-looking field kept, and it is kept for a stated reason rather than by omission.
  - **`answers.length` is not pinned to `exam.questionCount`** (§5), so a nineteen-question attempt is a
    legal document. The use case that draws an exam is what makes it twenty.
  - **A question id may repeat inside one attempt.** `uniqueItems` compares whole objects, so it would not
    catch it; the draw is what guarantees distinctness.
- **Every schema in `content/schemas/` is now compiled by a test** — `tests/unit/contracts/every-schema-compiles.test.ts`.
  That is not this ADR's decision but it is this ADR's neighbour, and it belongs to ADR-0024's class: see the
  amendment there. `quest.schema.json` did not compile for the whole of its life until a quest document
  existed to make ajv look at it, and `progress.schema.json` — the file this ADR rewrites — has no documents
  under `content/` at all and never will.
