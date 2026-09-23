# ADR-0070: A judged question offers the passage it rests on, and the exam stays unaided

- Status: Accepted (2026-09-23)
- Settles: whether and when a question card may open a lesson passage; how the passage is found; what the
  card is given; what happens when there is none; and how the distance between the questions and the
  teaching is measured and held.
- **Amends ADR-0063 §6 in one respect**: the lesson catalogue is still one catalogue, lazily imported and
  off the initial payload, but "a chapter is a chunk fetched on first open" is no longer the only way a
  chunk is fetched. A question card fetches **every** chapter once per sitting, on the first card. §4.
- **Amends `TN-RESULT`'s review layout** (a story, not an ADR, recorded here because it is a consequence):
  the way out of the review is drawn above the list, so `TN-RESULT-09` stays true now that items can carry a
  control. §3.
- **Amends nothing in ADR-0036, ADR-0048, ADR-0057 or ADR-0061.** §6 lists what does not move, because each
  is the easy over-reading.
- Story: `docs/stories/TN-TEACHBACK-read-about-this.md`.
- Numbering. `git log --all --name-only -- docs/adr` shows 0066 as the high-water mark on `main` and 0067 on
  an unmerged branch; 0068 and 0069 are reserved by other agents working concurrently. **0070 is the first
  number free of all of them.** The bare numbers in this paragraph carry no prefix on purpose: the contract
  gate resolves every prefixed token to a file in `docs/adr`, and three of them are not on this branch.

## Context

The owner's goal: *the learning content matches the quests and the questions. Every question has a lesson
passage with the same proposition, and the player meets it before being asked.*

Measured on `origin/main` at `7441451`, with the code the game runs (`sharesProposition`, the
shippable-passage filter, ADR-0003's grant):

| | Count |
|---|---|
| Verified questions | 493 |
| Readable lesson passages | 302 |
| Verified questions with a readable passage sharing their proposition | **25** |
| — of which the passage is filed under a different chapter than the question cites | 1 (`wwa-25-new-brunswick-bilingual`, told in `regions-04-new-brunswick`) |
| — of which the proposition is told in more than one lesson | 0 |
| Pooled questions (one per `answer` step naming them) | 493 |
| Pooled questions met in their level before the step that asks them | **83** |

So the goal is far off on both halves, and nothing on this branch may close it: closing it is content
(new passages, `read` steps, re-quoted blurbs), each needing a verifier's grant. What this branch can do is
(i) make the 25 links that exist *useful* to a player now, and (ii) make the distance visible on every run
and impossible to widen silently.

## Decision

### 1. After an answer is judged, the card offers "Read about this"

In a level, in Study, and in the exam **review**, once the card has judged an answer it may offer one more
control, **"Read about this"** / « Lire à ce sujet », which opens the lesson reader (`app/ui/lesson-reader.ts`,
the same reader a `read` step opens) on the passage or passages that share the question's proposition.
Closing the reader returns focus — and the single-switch highlight — to the control that opened it.

**Never during a live exam question.** `app/ui/exam-screen.ts` is not touched and has no such control; the
exam controller asks for readings only after the result is on screen. An exam that let the player read the
guide mid-question would not mirror IRCC's test, which is its whole purpose (ADR-0057 §5).

**Not before the answer is judged.** Opening the passage first would turn the card into an open-book
question, and the card's purpose in a level is to check what the level taught. After judgement the card has
already done that; reading is what the explanation invites next.

**It is not a second way on** (ADR-0036 §3). It is drawn after "Next"/"Finish" and before "Close", so the
way on is still the first control a keyboard or a switch meets after the result; the reader returns to the
card rather than advancing anything.

### 2. No passage, no control

When no readable passage shares the proposition, or the catalogue cannot be loaded, the card draws **no**
control — not a disabled one. A disabled control would be a promise the game cannot keep on 468 of 493
questions today, announced to a screen-reader player on every card.

### 3. The screen is given title and prose, and nothing else (ADR-0063 §6)

The rule lives in `app/application`:

- `app/application/content/question-passages.ts` — `passagesSharingProposition` walks the catalogue with
  `sharesProposition` and keeps only passages `passageVerdict` finds readable under the injected grant;
  `readingForQuestion` picks **one lesson** (the reader is named by one title): the lesson telling the
  proposition in the most passages, the first in catalogue order on a tie.
- `app/application/use-cases/read-about-question.ts` — reaches the lazy catalogue through the
  `LessonLibrary` port, once per sitting.

`app/bootstrap` wires it (`createQuestionReadings(lessonLibrary, grantsPassage)` in `main.ts`) and localises
the result into a `LessonReaderView` (`questionReaderView` in `lesson-reading.ts`). The card and the review
receive that view — one language, no `fact`, no verification data — and resolve nothing.

In the exam review the items can now carry a control, so the review's way out is drawn **above** the list.
`TN-RESULT-09` requires that a switch reach a way out "without visiting every item first", which with twenty
items is only true of a control that comes first.

### 4. The whole catalogue, lazily, once — the amendment to ADR-0063 §6

A `read` step names a lesson, so it fetches one chapter. A question names a *sentence*, and a proposition's
identity is corpus-wide (ADR-0028 §4): one of the 25 links today crosses chapters. Restricting the search to
the question's cited chapter would hide it.

So on the first question card of a sitting the index is read (free — module paths) and every chapter chunk is
fetched in parallel, once. The initial payload does not move: nothing is fetched at boot, the chunks are the
ones the level reader and Learn already use, and they total about 550 KB of JSON before compression. A chunk
that fails is left out of that answer and asked for again next time; nothing is memoised on failure.

### 5. The gate is a ratchet, because today most questions fail both halves

`tests/unit/contracts/a-question-teaches-back-to-its-passage.test.ts` measures and prints:

- **(a)** verified questions with no readable lesson passage sharing their proposition;
- **(b)** pooled questions not met in their level before the `answer` step that pools them — met meaning a
  readable passage named by a `read` step at a lower index in the same quest (the same or an earlier stop,
  ADR-0063 §5), or one of the level's granted told facts: a landmark blurb, the territorial statement, or a
  quest line (step dialogue at a lower index, `declinedLine`, `reminderLine`; never `afterLine` or
  `doneLine`).

The counts are recorded in `tests/unit/contracts/teach-back-baseline.json` — **468** and **410** at this
commit — and may only go down. A rise fails with the offenders listed. A fall fails too, with the new number
to write down, so the baseline carries no slack for a later regression to hide in: **a content change that
lowers a count updates the baseline in the same commit.** The corpus must be non-empty and something must be
linked, so the gate cannot pass by measuring nothing (ADR-0024).

### 6. What does not move

- **ADR-0057 §5.** Study and the exam still ask the whole bank; nothing here narrows a draw.
- **ADR-0061 §4 and ADR-0063 §5.** A passage read *after* the answer, from the card, is not "told" by the
  level for ADR-0057's purposes. Gate (b) counts only what precedes the step.
- **ADR-0048 and ADR-0036 §2.** What a stop asks is unchanged.
- **ADR-0003.** No passage is shown that the shippable-passage filter refuses; no new claim is authored.

## What this makes impossible

- A "Read about this" control on a live exam question.
- A control before the answer is judged, or a disabled control for a question with nothing to read.
- A card or review that resolves a passage, reads a `fact` block, or chooses a language.
- A rise in either teach-back count without a red build.

## Alternatives considered

- **Offer it before answering, as a hint.** Rejected: it makes every in-level question open-book, and the
  exam could not share the card's behaviour without breaking IRCC parity.
- **Search only the question's cited chapter**, keeping ADR-0063 §6's one-chunk laziness. Rejected on the
  measurement: it loses a real link today and more as the corpus grows, silently.
- **A precomputed question→passage index shipped in the bundle.** Rejected: a second home for the
  proposition rule that can drift from `sharesProposition`, and an index in the initial payload.
- **Show a disabled control where nothing matches.** Rejected in §2.
- **Make (a) and (b) absolute.** Rejected: red on content this branch may not write, with no way to land.

## Consequences

- 25 questions offer "Read about this" today; the other 468 offer nothing until content links them.
- Every future `read` step, re-quoted blurb or new passage moves one of the two counts, and the author sees
  it on the next test run.
- `TN-RESULT`'s review draws "Back" above its list.

### Rules stated here that no gate can express

- **Whether the passage teaches what the question asks.** A shared quote is an identity, not a lesson
  (ADR-0057 §6).
- **Whether the player read it.** Nothing requires it and nothing should (ADR-0052 §1).

## References

- ADR-0003, ADR-0024, ADR-0028, ADR-0036, ADR-0048, ADR-0057, ADR-0061, ADR-0063.
- `docs/stories/TN-TEACHBACK-read-about-this.md`, `docs/stories/TN-RESULT-exam-results.md`.
