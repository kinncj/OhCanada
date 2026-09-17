# ADR-0052: A level cannot be failed, a wrong answer comes back, and one sentence tells one fact

- Status: Accepted (2026-09-17)
- **Extends ADR-0036. It amends nothing in it.** A stamp is still earned by the task and means "I went and
  did this"; `unlockedLevelIds` still counts stamps. What is added is what the completion card may claim
  about the player's answers, and what a wrong answer is worth.
- Acceptance: `docs/stories/TN-STANDING-how-i-did-in-a-level.md`, written as `OQ-STANDING-5` asked for it.
  Rules 1–7 of that file's ruling are the product owner's; this ADR decides where each is held, by what, and
  what is left unheld.
- Slice: A8 (third live-site audit, 2026-09-16).
- Numbering: `main` holds ADR-0001…ADR-0049. ADR-0050 is a dropped draft on branch `multi-nation-source`
  and ADR-0051 is on `territory-verified`; both exist in the history this repository can see, so both
  numbers are spent whether or not their branches ever merge. **0052 is the first number above the
  high-water mark**, and it is taken rather than the free hole at 0038 on purpose: a number is retired by
  having been used, not by its document being abandoned, and a new ADR filed *below* the ADRs it builds on
  reads as older than them for ever.

## Context

A third live-site audit, on 2026-09-16, found one defect wearing two faces. Both are reproduced verbatim in
the story; the short of it:

**Nothing in a level can be failed.** A player can answer every question in a level wrong, earn the stamp,
and open the next level. Verified down to **0 of 6** on the North.

**The card then contradicts itself**, in both languages, on at least three levels. The North's, in French,
said the player « répondu à toutes les questions laissées ici sur les régions du Canada » directly above
« Bonnes réponses dans ce niveau : 0 sur 6 ». Toronto's and the Alberta foothills' said the same thing in
English above 1 of 8 and 2 of 9.

**The sentence that reads as a lie is true.** The player did answer every question along the way; "answered"
is not "answered rightly". That is why it survived authoring, verification and two audits, and it is the
whole reason this ADR exists rather than three content fixes. Read ADR-0003's five checks against it: the
passage is found, the claim is entailed, nothing false is asserted. **A verifier's checks are about truth,
and this sentence's defect is not that it is false — it is that it reports a fact and praises by implication
in one sentence, and only the second half is wrong.** No existing gate, and no existing role, is looking for
that.

Two further facts constrain the answer, and both are measured rather than assumed:

- **Six `answer` steps hold question pools of exactly their count** (slice L1), so a replay of those levels
  asks the same questions. Level 8 ships with a subject bank of 18 against `CLAUDE.md`'s floor of 30
  (`OQ-ALBERTA-2`, `OQ-DONE-7`).
- **`unlockedLevelIds` runs over the stamps in the save** (`unlockRules.stampsToUnlockNext`). There is one
  token, and it is the stamp.

## Decision

### 1. The stamp is unchanged, the unlock stays welded to it, and there is no level pass mark

**ADR-0036 §1 stands word for word.** `reachLevelEnd` gains no condition, `content/schemas/progress.schema.json`
gains no field, `content/game.config.json` gains no second counted thing, and `passport.intro` keeps its
promise: a stamp is for finishing a level's task.

**There is no level pass mark, no fail card, no retake requirement and no score that closes anything.** This
is a decision, not an omission, and it is written here so the fourth audit finds a ruling where the third
found a defect. The four reasons, in descending weight:

1. **`CLAUDE.md` puts the pass mark inside Exam mode** — twenty questions, fifteen to pass, thirty minutes.
   The levels are the teaching that comes before it. Applying the exam's bar to the teaching is the same
   shape the "timer only in Exam mode" rule exists to prevent: the game stops being a place to learn and
   becomes a place to be measured, everywhere.
2. **It withholds the teaching from the player who needs it most.** A newcomer reading in a second language
   who scores 3 of 9 is the audience, not a failure case, and the material a lock would withhold is the
   material they scored 3 of 9 on.
3. **It is a dead end waiting for a short bank**, and the numbers above say so: a fixed pool that holds
   exactly its count asks the same questions on the replay, so a player who cannot clear the bar has nowhere
   left to go. Nothing may become a dead end is a hard accessibility rule, not a preference.
4. **It makes the stamp mean something the passport does not say**, in two languages, at grade 6, on the one
   screen that explains the game's only token.

**The unlock is not split from the stamp.** A "mastery" stamp with the unlock left on the task needs a second
currency, and the first thing a second currency can produce is a player who has earned neither — which is
ADR-0036's own refusal ("a second source of *open* is two answers that can disagree on the map") arriving
from the other side. What it would cost, if a product owner wants it anyway, is recorded in
`TN-STANDING` `OQ-STANDING-1` and is a new ADR amending ADR-0036, not a change under this one.

### 2. A wrong answer stops being free: the card counts what is coming back and offers the way to it

The completion card gains one row and one control (`TN-STANDING-01` … `TN-STANDING-03`):

| What happened in this level | `quest-complete-progress` | `quest-complete-coming-back` | `quest-complete-practise` |
|---|---|---|---|
| No question was answered | `level.complete.none` | absent | absent |
| Every answer was right | `level.complete.score` | `level.complete.allRight` | absent |
| Any answer was wrong | `level.complete.score` | `level.complete.comingBack.*` | present, never primary |

**The count is the caller's arithmetic, as the score row already is.** `app/bootstrap/main.ts` holds every
input today — `answeredHere`, `correctHere`, and `answeredThisVisit`, the ids this visit has answered — so
the number is `answeredHere − correctHere` and needs no new source. `app/ui/level-complete.ts` takes the
finished sentence as data and counts nothing, exactly as it takes `progressMessage`: the module that draws
the card has never known what a question is, and this row must not be the first thing that teaches it.

**The row counts this level's wrong answers, and never the schedule.** It is the promise the question card
already made (`card.againSoon`, `TN-CARD-04`) added up — nothing more. A readout of everything the scheduler
has due would tell a player who got all six right that "6 questions will come back", which is true of spaced
repetition and reads as a punishment.

**The all-wrong card differs from the half-right card only in its numbers.** Same rows, same words, same
colours, same controls, same focus order, same announcement. No `data-reason="failed"`, no red as the only
signal, no control disabled by an answer. A special register for a bad result is a mark with a kind face on
it.

### 3. One sentence, one fact — and what a `doneLine` may describe, said positively

**No sentence on the completion card may fuse what the player did with how they did. Only the two rows whose
job is to count answers may say anything about answers.** This binds the heading, the stamp sentence, the
next-level line, and the giver's own `doneLine` — which is content, in `content/quests/*`, and is where the
audit found it.

The rule on the content field is written as a permission, not as a list of forbidden words, and the
direction is load-bearing: a prohibition invites an author to write around it, while a permission tells them
what the sentence is for.

> **A `doneLine` may describe where the player went, what the place was, and that the errand the quest named
> is finished — in the past tense, in the giver's own voice.**

It describes the route, the place and the task. It says nothing about answering: not that questions were
answered, not how many, not how well, not what was learned, and no praise for any of it. "Task done!" stays,
because it names what finished and not how it went.

The reason is not style. **The two counting rows are recomputed on every showing; a sentence written months
ago in a content document cannot be.** Any claim about answers that is authored ahead of time is a claim
about a player who has not played yet, and the audit is what that looks like on a screen.

### 4. Where the rule is enforced, and exactly what each half can and cannot catch

Both. They catch different things, and neither catches the whole rule.

**(a) A gate over quest content — the words that are mechanically visible.**

A contract test, `tests/unit/contracts/a-done-line-describes-the-route.test.ts`, over **every** document
under `content/quests/`, reading **both** languages of `doneLine.text`, reporting **every** offender with
quest id, field pointer, language and the term matched — not only the first, and not only the three the
audit saw. Specified fully enough to be built without further design decisions:

- **Matching** is on word boundaries after the normalisation the proposition gate already uses
  (`app/application/content/proposition.ts`), so casing and spacing cannot smuggle a term past it. French
  accents are significant and are not stripped.
- **Two term families, one module beside the gate**, so a list is never scattered across files:
  - *answering* — EN `answer`/`answered`/`answering`, `question`/`questions`, `right`, `correct`, `wrong`,
    `learn`/`learned`, `quiz`, `score`, `test`; FR `répond*` (`répondu`, `répondez`, `réponse`, `réponses`),
    `question`/`questions`, `bonne(s) réponse(s)`, `appris`, `juste`, `exact`;
  - *praise* — EN `well done`, `great`, `perfect`, `nice work`, `proud`, `excellent`, `amazing`; FR `bravo`,
    `parfait`, `excellent`, `félicitations`, `fier`/`fière`.
- **The three shipped lines are fixtures, quoted word for word**, and each is asserted to fail, as
  `TN-STANDING-04`'s last scenario requires. A change that makes any of them pass fails the suite.

**Why here and not somewhere else.** Not `content/schemas/quest.schema.json`: the only way to say it there
is a per-language negative-lookahead `pattern`, which no author can read and no schema can explain, and
`validate-content` walks each document against its own schema alone. Not ADR-0016 §3's banned-term machinery
in `scripts/lib/claims.mjs`: that list is about **source staleness** — terms that date a claim — and one list
firing for two unrelated reasons teaches people to ignore both. Not `verify-content` gate B: gate B checks a
claim against its source, and this rule is not about whether the sentence is true. It is about what the
sentence is *for*.

**(b) The card's own rendering — the structure, which holds whatever the words are.**

`app/ui/level-complete.ts` and its caller hold what no word list can:

- exactly one of `level.complete.score` and `level.complete.none` is drawn, never both, never empty, never
  "0 out of 0" (already true, `TN-DONE-02`);
- `quest-complete-coming-back` is **the only other element on the card that names a count of answers**, and
  no third element carries one;
- the two rows are drawn as **two elements**, never joined into one sentence — which is the defect's shape,
  made unrepresentable;
- the `doneLine` is drawn **only under "Task done!"**, never on the walk-to-the-end card (already true,
  ADR-0036, `TN-DONE` rule 6, `completionLine`'s `other-route`);
- a missing copy row draws **nothing**, never a placeholder and never another screen's sentence
  (`TN-STANDING-04`).

**What neither half catches. Stated so that silence here is not read as coverage (ADR-0019).**

1. **A warm sentence using none of the listed terms still passes.** "You rode the whole ranch and came away
   knowing it" contains no banned word and praises by implication, which is precisely the defect class. The
   gate is a tripwire on the machine-visible failure — the shipped phrasing and its family — and the rule
   itself is larger than the tripwire. The story is honest about this and so is this ADR.
2. **Implication is a judgement, and no string identifies a paraphrase.** ADR-0028 §4 settled that argument
   for propositions and it is no different here.
3. **The reader who holds the rest is the author, not the verifier.** ADR-0003's five checks are about
   entailment, distractors, translation and verbatim wording; none of them reads tone, and the offending
   line passed them correctly. So this rule is added to the **author's brief** (write to §3's permission) and
   to review of the ten lines — it is *not* a sixth verification check, and a verifier who grants a warm line
   has not made an error under ADR-0003. Saying this out loud is the point: after this ADR, a
   `verification.status = "verified"` on a `doneLine` means what it always meant, and not that the line obeys
   §3.

### 5. Who owns the new copy rows and the two markers, and how they reach ratification

**The four copy rows** — `level.complete.comingBack.one`, `level.complete.comingBack.other`,
`level.complete.allRight`, `level.complete.practise` — are written in `app/ui/copy.ts`, because that is where
every player-facing string lives until the locale bundles exist (ADR-0010), and are **listed in
`COPY_GAPS`**. `TN-STANDING`'s own table marks them *proposed, pending ratification*, so they are exactly the
state `COPY_GAPS` names: written by `app/ui`, not yet ratified by the owner of the story that will carry
them. They leave the list when the product owner ratifies or replaces the table, as ADR-0036's five and
ADR-0039's thirty-eight do. `comingBack` is a counted noun, so it is two rows per language reached through
`count()` and `Intl.PluralRules`, never by comparing the number to one — the module's existing rule, so no
new mechanism and no new type.

**The two markers are a boundary defect as proposed, and this is the fix.**
`quest-complete-coming-back` and `quest-complete-practise` name elements on a card whose chrome, rows and
ways on are owned by `TN-DONE-finishing-a-level.md`, while the rows they draw are owned by `TN-STANDING`. Two
files naming one element is two files to keep in step, and they will drift — it is the same failure ADR-0028
removed by deleting `chapters[].level`, in a documentation directory.

**Ruling: a marker's row lives in the file that owns the element; the file that owns the claim owns the
words.** So `TN-STANDING` owns what those two elements may say and proposes the markers; **`TN-DONE`'s marker
table is where they land**, and until it carries them they are proposals. Neither file needs the other's
permission to change its own half, which is the property that makes the split worth having.

### 6. The count is scoped to the sitting, and the sentence is written so that stays true

**"Questions from this level coming back" counts what this level asked *in this sitting* and the player got
wrong.** It cannot yet mean anything else: `Progress` counts reviews per question and not per level
(`app/bootstrap/main.ts` says so where it counts), and `content/schemas/progress.schema.json` records no
level against an answer. This is `OQ-STANDING-3`, and it is the same gap as `OQ-DONE-6` and `OQ-SAVE-1`
arriving at a second row.

**The ruling is that the sentence must survive the gap, and it does.** "You will see 7 questions from this
level again" is true of a sitting-scoped count: those seven really are coming back. A player who answered two
wrongly, closed the tab, came back and finished reads a number that is **too small**, which is a promise the
game over-keeps rather than one it breaks. A number that is too large would be a promise about questions that
are not coming, and that direction is not available. So the count is the sitting's until a save can answer
better, it is not quietly assumed away, and it carries a dated obligation with an owner below.

**What must not happen** while the gap is open: the row must not reach for the scheduler's due set to look
more complete. That is §2's refusal, and it would replace an under-count with a readout of the schedule.

### 7. Nothing here touches the FSRS scheduler's contract

Stated explicitly, because "the question comes back" sounds like a scheduling change and is not one.

- **A wrong answer already comes back.** `app/domain/scheduling/question-scheduler.ts` puts due questions in
  a hard tier above not-due, and missed questions in a hard tier above the rest — a guarantee, not a
  probability (`TN-CARD-02`, `TN-STUDY-02`). The card reports behaviour that already exists. It does not
  request it.
- **No port gains a query.** There is no "how many are due for this level", `ScheduleReviewInput` gains no
  field, and `Progress` gains no shape. The card reads the caller's own arithmetic (§2).
- **Even the scoped drill costs no contract change.** If `OQ-STANDING-4` is answered by scoping "Practise
  these questions" to the ids the card counted, those ids go in through the **existing** `pool` parameter —
  "a quest step's `questionPool`, which narrows the bank without choosing from it" — and the scheduler still
  chooses the order. What must not happen is the card asking its ids in its own order, which would make the
  scheduler decorative for the one drill aimed at the questions the player is worst at.
- **The words stay off the screen.** *Spaced repetition*, *FSRS*, *scheduler*, *due* and *interval* are
  forbidden in both languages (`TN-CARD-02`). "Will come back" is the whole of what the player is told.

## What this makes impossible

- **A completion card whose sentence praises what its own numbers deny**, in the shipped wordings and their
  family, in either language, on any of the ten quests — refused by a gate rather than by a reader.
- **A stamp or an unlock that depends on being right**, added quietly. It now needs an ADR amending
  ADR-0036, and `OQ-STANDING-1` names the four other things that would have to change with it.
- **A fail state on a level**, by card, by colour, by a disabled control or by a level that will not open.
- **A third element on the card carrying a count of answers**, or the two rows being joined into one
  sentence.
- **The completion card becoming a readout of the scheduler.**

What it does **not** make impossible, said once so it is not mistaken for coverage: a warm `doneLine` that
uses none of the listed terms and still implies how the player did (§4); a `doneLine` whose `verification`
block says nothing about §3, because it never did (§4); and an under-count after a reload (§6).

## Alternatives considered

- **Block the stamp below a pass mark (fifteen of twenty, or any bar).** Rejected on the four grounds in §1.
  The decisive one is measured rather than argued: with six pools holding exactly their count and one subject
  bank at 18 of 30, a bar would strand a player in a replay that asks the questions they have already failed,
  and a dead end is forbidden outright.
- **Split the stamp from the unlock — a mastery stamp, with the task still opening the next level.**
  Rejected. It is the only design under which a stamp could mean *knowing*, and it needs a second counted
  thing for the unlock; "all of this level's questions right" has no stable meaning across pools of different
  sizes; and ten empty slots in the passport of the player finding it hardest is a star rating with a picture
  on it.
- **A different card for an all-wrong level — softer, or with encouragement.** Rejected. A special register
  for a bad result tells the player the game noticed, and the two counting rows have already told them the
  truth. Same card, different numbers.
- **Fix the three shipped `doneLine`s and write no rule.** Rejected, and it is the cheapest-looking option.
  The line passed authoring, verification and two audits *because it was true*; with no rule, the next author
  writes the same shape in good faith, and the fourth audit finds it. Three edits fix three sentences; §3
  fixes the class.
- **Put the word ban in `quest.schema.json` as a `pattern`.** Rejected: a per-language negative lookahead is
  unreadable, unexplainable in a `description`, and puts a judgement about tone in the file that states
  structure.
- **Extend ADR-0016's banned-term list in `scripts/lib/claims.mjs`.** Rejected: that list dates a claim
  against its source. A list that fires for two unrelated reasons trains people to ignore both, and this rule
  would inherit a gate whose failures are about staleness.
- **Make "coming back" read the scheduler's due set for this level's subject.** Rejected: it tells a player
  who got everything right that six questions are coming back, and it puts the schedule on a screen the
  stories keep it off.
- **Drop the `doneLine` from the card.** Rejected. It is the giver's own voice closing their own errand, and
  it is the one sentence on the card that is about *this* place. The defect was one clause in three lines,
  not the line.
- **Count "coming back" across sittings now, by reading `Progress`.** Not available: a review record knows
  the question and not the level it was asked on. §6 rules on the sentence instead, and the obligation below
  carries the shape change to the owner who can make it.

## Consequences

- **The completion card gains a row and a fourth control**, so the tab order and the single-switch ring gain
  one stop when anything is coming back and are unchanged when nothing is (`TN-STANDING-08`). Focus lands
  where `TN-DONE-06` puts it whatever the answers were: the card at 0 right and the card at 9 right place
  focus identically.
- **`COPY_GAPS` grows by four rows**, all pending ratification, and `TN-DONE`'s marker table is owed two
  entries (§5).
- **Ten shipped `doneLine`s must be read against §3**, three of them known wrong. This is content work — an
  author rewrites, a verifier grants — and `docs/plan/slices.md` already records the North's as owed for a
  different reason, so two findings meet on one line.
- **No domain, port, schema or scheduler change.** The layering is untouched; `npx depcruise app common`
  reports no violations before and after, because nothing in `app/` moves under this ADR.
- **One rule here is held by review and not by a gate**, and §4 names it precisely rather than leaving it to
  be inferred from a passing suite: a sentence that implies how the player did without using a listed term.
- **A player who answers everything wrong reaches the end of the game**, earns ten stamps and can start the
  practice exam. That is the decision, asserted on purpose in `TN-STANDING-07` so that a future audit reads
  it as intended.

## Obligations

- **OBLIGATION due=2026-10-17 owner=infra** — build §4(a)'s gate:
  `tests/unit/contracts/a-done-line-describes-the-route.test.ts` over every document under
  `content/quests/`, both languages, both term families in one module beside it, reporting every offender
  with quest id, pointer, language and matched term, with the three lines this ADR's Context quotes as
  fixtures asserted to fail. Until it lands, §3 is held by review alone on a field where review has already
  passed the defect three times.
- **OBLIGATION due=2026-10-17 owner=content** — read all ten shipped `doneLine`s against §3's permission, in
  both languages, in one pass rather than one at a time, and rewrite the ones that claim anything about
  answering. Toronto's, the Alberta foothills' and the North's are known offenders from the audit's own
  screenshots; the other seven have not been read for this shape. The author rewrites and the verifier
  re-grants, in separate commits (ADR-0003).
- **OBLIGATION due=2026-11-17 owner=po** — ratify or replace the four copy rows in `TN-STANDING`'s
  "Player-facing copy" table, and adopt `quest-complete-coming-back` and `quest-complete-practise` into
  `TN-DONE`'s marker table under §5's ruling. Until both happen, four rows sit in `COPY_GAPS` and two markers
  are named by a file that does not own the element.
- **OBLIGATION due=2026-12-17 owner=persistence** — decide whether a save records the level an answer was
  given in (`OQ-STANDING-3`, `OQ-DONE-6`, `OQ-SAVE-1`, one question at three doors), and either change
  `content/schemas/progress.schema.json` and the codec so both counting rows can mean "in this level,
  whenever", or record that they mean "in this sitting" and say so where the schema is read. The date is
  deliberately the furthest of the four: §6 shows the sentence stays true either way, so nothing on screen is
  wrong while this is open — and an obligation whose breach would stop the site publishing should not be
  dated as though something were.

## References

- ADR-0036 — a stamp is for the task, and a level asks its own subject; "Unlocking follows stamps, unchanged"
- ADR-0003 — the author/verifier separation, and the five checks, none of which reads tone
- ADR-0010 — where player-facing text lives, and why a quest's own line is content
- ADR-0019 — a rule drawn round a container measures the container; name what a gate does not catch
- ADR-0024 — an empty collection must not reduce to a pass (the "no question was answered" row)
- ADR-0028 §4 — no string identifies a paraphrase
- ADR-0030 — a told claim is outside the one-proposition rule; a `doneLine` is told
- ADR-0048 — a stop with no task asks only what it told, and a visit asks nothing twice
- `docs/stories/TN-STANDING-how-i-did-in-a-level.md` (the ruling, the copy table, `OQ-STANDING-1`…`-8`),
  `TN-DONE-finishing-a-level.md` (the card, its two rows, `OQ-DONE-6`), `TN-CARD-question-card.md`
  (`card.againSoon`, `TN-CARD-02`), `TN-RESULT-exam-results.md` (the one verdict in this game)
- `app/ui/level-complete.ts`, `app/bootstrap/main.ts` (`answeredHere`, `correctHere`, `answeredThisVisit`,
  `doneLineNow`), `app/bootstrap/quest.ts` (`completionLine`), `app/domain/scheduling/question-scheduler.ts`,
  `app/application/use-cases/schedule-review.ts` (`pool`), `content/schemas/quest.schema.json` (`doneLine`)
