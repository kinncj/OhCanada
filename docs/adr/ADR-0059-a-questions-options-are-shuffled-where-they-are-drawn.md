# ADR-0059: A question's options are shuffled where they are drawn, not where they are written

- Status: Accepted (2026-09-17)
- Resolves `OQ-CARD-2` (`docs/stories/TN-CARD-question-card.md`), which parked the question in slice 1 and
  took the answer this reverses.
- Amends the `TN-CARD` note "the options keep their authored order"; `TN-EXAM` and `TN-RESULT` inherit the
  same change and no scenario in either changes its wording.
- Slice: A10 (`docs/plan/slices.md`).
- Criteria: the rules below, held by the tests named under Consequences.
- Numbering: 0056 is the high-water mark across every ref this repository can see, so this is 0057. The hole
  at 0038 and the number 0050 — spent by a dropped draft — stay spent, for the reason ADR-0052 recorded and
  ADR-0056 restated.

## Context

The fifth live-site audit (2026-09-17) tapped **the first option on every question** and scored:

| Level | Subject | Score by tapping option 1 |
|---|---|---|
| Halifax | `rights` | 9 / 9 |
| Peggy's Cove | `who-we-are` | 6 / 6 |
| Winnipeg | `justice` | 7 / 7 |
| Québec City | `history` | 9 / 9 |

Thirty-one questions in a row, across independent browser sessions, in **both languages** (Halifax FR 9/9,
Winnipeg FR 7/7). In Peggy's Cove the marking was read straight off the DOM: `data-tn-answer="correct"` sat
on `option-0` for all three lighthouse questions. Six other levels were properly spread — Vancouver 2/7,
the Alberta foothills 3/9, the North 3/5, Toronto FR 3/8 — which is the clue that made this diagnosable in
one measurement rather than one play-through.

### The cause is two true sentences and one thing nobody wrote

**Three artefacts promise a shuffle.** `content/schemas/question.schema.json` has said since it was written:

> Answer order is fixed by the author; shuffling is a presentation decision the domain makes from a seed.

`docs/guidelines/anatomy-of-a-question.md`, which is what a `content-author` reads before writing anything,
says it to the author directly:

> Do not shuffle the options to hide the answer; the game shuffles them at play time from a seed.

And `app/adapters/random/seeded-random.ts` documented its own `shuffle` as the thing that does it:
"`TN-CARD` shuffles the four options".

**Nothing shuffles anything.** `grep` over `app/` finds exactly three `shuffle(` call sites, all three in
`app/application/use-cases/exam-session.ts`, and all three about *which questions are drawn*, never about
the order of four options. `app/bootstrap/quiz.ts` mapped `question.options` straight through and passed
`question.correctIndex` beside it; `app/bootstrap/exam.ts` did the same in `viewAt`. Both said so in a
comment citing `OQ-CARD-2`.

**`OQ-CARD-2` is where the two halves were separated.** Written in slice 1, it asked "are the four options
shuffled?" and recommended: *"keep the authored order in slice 1; if shuffling is wanted later it must use
the seeded `RandomSource` so a session stays replayable, and the content agents must be told not to put the
answer in the same position every time."* The first clause was implemented. The third clause — tell the
authors — was never done, and the guideline in front of every author said the opposite of it.

So the authors did the correct thing with the instruction they were given. Measured over the 498 questions
in the tree:

| Subject | Level | `correctIndex` 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| `history` | Québec City | **96** | 0 | 0 | 1 |
| `justice` | Winnipeg | **40** | 0 | 0 | 0 |
| `modern-canada` | Prairie rail | **40** | 0 | 0 | 0 |
| `rights` | Halifax | **38** | 0 | 1 | 0 |
| `who-we-are` | Peggy's Cove | **46** | 1 | 0 | 1 |
| `economy` | Alberta foothills | 15 | 17 | 10 | 9 |
| `elections` | Toronto | 8 | 16 | 10 | 3 |
| `government` | Ottawa | 9 | 17 | 14 | 4 |
| `regions` | The North | 17 | 16 | 18 | 8 |
| `symbols` | Vancouver | 9 | 12 | 12 | 10 |

The four levels the audit found are the first four rows. **The fifth row is the Prairies**, which is equally
broken and which the audit never caught — ADR-0048 means a stop with no task running asks only what it told,
and a rider who declines the task is asked almost nothing. A defect that is only visible on one route is
still shipped on every route.

### Why the six good subjects are good

Nothing in the pipeline made them good. They were written by authors who happened to vary the position, and
`economy`, `elections` and `government` are the three oldest banks. The difference between a passing subject
and a failing one here is authoring habit, and an authoring habit is not a control.

## Decision

**Where an option is drawn on screen is a presentation decision, made from a seed, every time a card is
presented. The authored `correctIndex` remains the one true key and is what gets written down.**

### 1. The shuffle is a domain rule, in one module

`app/domain/entities/asked-question.ts`. Pure, no clock, no framework, taking the same structural
`Randomness` the scheduler takes, so a composition root hands it a seeded stream and any complaint about
option order replays from its seed.

It is in `app/domain` and not in `app/ui` or `app/bootstrap` because it is a *rule about what the player is
allowed to be shown*, and ADR-0005's `outer-layers-use-domain-vocabulary-only` exists precisely so a rule
does not end up executed inside a DOM screen where the >= 90% domain coverage gate never runs it.

`OptionOrder` is **presented position -> authored index**, and both directions are needed:

- `authoredAt(order, shown)` turns a tap into the index that gets recorded;
- `shownAt(order, authored)` finds where something already recorded is sitting on screen.

### 2. Nothing that is written down changes

`ExamAnswer`, `ReviewRecord` and every save in the wild store **authored** indices, and correctness is
`chosenIndex === correctIndex` with no `correct` flag anywhere (ADR-0027). So the conversion happens at the
card's edge and nothing downstream learns that a shuffle occurred:

- `createDrillRunner` converts in its `onAnswer` before calling the recorder;
- the exam controller converts in `choose` before `withChoice` and before `deps.record`.

**No save migration, and no re-grading of any existing save.** That is the property that made this the
cheap fix rather than the expensive one, and it is the reason the conversion is at the edge rather than
somewhere convenient in the middle.

### 3. An order lasts exactly as long as the thing the player is looking at

A position must never become a *durable* property of a card — that is the whole point, and a single global
per-question seed would simply move the defect from "the answer is always first" to "the answer is always
where it was last time". But "never durable" is not the same as "changes under the player's hands", and the
unit that must not change is the thing in front of them:

| Where | The order lasts | Why |
|---|---|---|
| A level, and Study | One presentation | A question is presented once per encounter. The same question met again in the same sitting is shuffled again. |
| An exam | One attempt | `TN-EXAM-03` lets the player go back and change an answer, so the paper must not rewrite itself while it is being written. |

The exam's orders are therefore **derived from the attempt**, seeded from `ExamInProgress.startedAt` — a
number the save already carries — so `begin` and `carryOn` build the identical map and an exam picked back
up after the tab was closed is the paper that was left. Nothing is written to the save to achieve it: the
order is a pure function of a value already there, so there is no schema change and no migration. A
different attempt has a different `startedAt`, and so a fresh set of orders.

**This part was wrong when this ADR was first accepted**, and is corrected here rather than quietly: the
first implementation re-drew the exam's orders on `carryOn`, so a resumed exam came back with its options
rearranged. The original argument for a fresh order — "a per-question seed moves the defect" — is about
repeat encounters *across* sittings and does not reach *within* one attempt, where the player's model is
that the paper in front of them holds still. `tests/e2e/exam.spec.ts`'s abandon-and-resume scenario caught
it, and was right to.

Each consumer draws from a stream of its own — `random.fork('options')` for the level and Study, a stream
seeded per attempt for the exam — so shuffling a card can never shift which questions the scheduler brings
up. `app/bootstrap/main.ts` already promised exactly this in a comment about a fork that did not yet exist.

### 4. The exam and Study are the same decision

Study reuses the in-level card through one `createDrillRunner`, so it was affected identically and is fixed
by the same change. The exam has its own screen and its own controller, and is fixed separately in
`viewAt`, `choose` and `reviewItem`.

**Could a player have passed the exam this way?** Not reliably, and the arithmetic is worth recording rather
than reassuring about. An exam is 20 questions across 10 shipping subjects, so about two per subject. Five
of the ten subjects key effectively every question to option 1, giving about 10 right; the other five sit
near chance at roughly 24% index-0, giving about 2.4 more. So tapping option 1 scored about **12 or 13 of
20 against a pass mark of 15** — not a pass, but two and a half times what guessing earns, and close enough
that variance would get there sometimes. The exam was less broken than a level only by accident of how the
quotas fall.

The **review after the exam** shows the options in the order the player saw them. A review that rearranged
the question under the player would be describing a different card from the one they answered.

### 5. Content is not re-keyed, and no verification block is touched

The five clustered subjects stay exactly as authored. Three reasons, in order of weight:

1. **It would not stay fixed.** Re-keying 260 questions works until the next author writes a question with
   the right answer first — which the guideline tells them to do, and should keep telling them, because a
   reviewer who cannot see the answer at a glance reviews worse. A shuffle at presentation cannot be undone
   by an author. A content fix can be undone by the next commit.
2. **It is not a content defect.** Every one of those 260 questions is true, sourced, verified for the hash
   it cites, bilingual and carrying three real distractors. Nothing about them is wrong. What was wrong was
   the program.
3. **It costs 260 re-grants and buys nothing.** Under ADR-0003 an author may not touch a `verification`
   block, and changing `correctIndex` is an edit to the claim, so every one of those questions would go back
   to a verifier — for a change no learner can perceive once §1 is in.

### 6. The gate measures the presentation, not the bank

`tests/unit/contracts/an-answer-is-not-always-in-the-same-place.test.ts`.

The obvious gate — "no subject may have too many questions keyed to index 0" — is refused, because it is
red on content that is correct (see §5) and because it measures the wrong thing. What harmed the learner is
where the key lands **on screen**. So the gate runs the shipped generator over the shipped bank through the
shipped ordering function and asserts about what a player would see:

- **no subject puts more than 60% of its keys on any one visible position**, over eight pinned sittings;
- **each of the four positions holds 25% ± 4 points of every correct answer drawn**, across the whole bank —
  which is the assertion that catches a shuffle that is present but biased. This generator has shipped
  exactly that bug before: a cold start once made the first shuffle identical for every seed from 1 to 40.

Measured: the worst any subject reaches under the shuffle is 43.8% over the pinned seeds and 53.8% over
seeds 1–400, against 95.8%–100% for the five broken subjects presented as authored. Aggregate shares are
24.95 / 23.77 / 25.70 / 25.58.

**It has been seen to fail**, as `docs/plan/slices.md` Rules require, and by assertion rather than by a
comment claiming somebody checked once: the same checker is run over the authored presentation — the thing
that actually shipped — and must name at least one subject, and over a synthetic answer-first bank, which
it must flag and must clear once shuffled. The seeds are pinned, so the file cannot flake.

## Consequences

- **A learner can no longer clear a level without reading it.** The four audited levels, and the Prairies.
- **The browser suites are unaffected**, which was checked before the change rather than discovered after.
  Six e2e specs answer by clicking `option-0`; none of them asserts that it is correct — they assert
  `/That's right!|Not quite\./`, and a wrong answer still completes a quest step (ADR-0048) and cannot fail
  a level (ADR-0052). One stale comment in `study-and-settings.spec.ts` said "in the authored order" and is
  corrected.
- **Two unit tests name an option by the index their fixture wrote**, and are given `AUTHORED_ORDER`
  explicitly rather than having their assertions loosened. That constant exists for them; no production
  path uses it, and `questionView` takes its order as a **required** argument so no caller can fall back to
  the shipped defect by forgetting one.
- **`docs/guidelines/anatomy-of-a-question.md` and `question.schema.json` become true**, having been
  aspirational since they were written. Neither changes.
- **The five clustered subjects are left for an author**, and that work is now optional rather than urgent:
  the row in `docs/plan/slices.md` records it as content owed, not as a blocker.

## Alternatives considered

**Re-key the content and gate `correctIndex` on disk.** Rejected under §5. It is the fix that looks like the
fix and lasts exactly one commit, and its gate would be red against an authoring guideline this project
wants to keep.

**Shuffle once per question, seeded by question id.** Rejected under §3. It is stable across sittings, so
the second time a learner meets a card the position is a hint, and spaced repetition guarantees a second
time.

**Shuffle at content build time, baking a permuted bank into the artefact.** Rejected: it is the content fix
with extra machinery, it makes the shipped artefact disagree with the repository, and a reviewer reading a
failed question in the build would be reading different options from the ones in the file.

**Leave the exam alone and fix only levels.** Rejected. The exam is the one place in the game with a pass
mark, so it is the one place where an unearned 12 of 20 has a consequence beyond a wasted learning moment.
