# TN-STANDING — What a level says about how I did, and what a wrong answer is worth

**Intent.** A player learns what their stamp is for, reads a plain count of what they got right, is never
congratulated by a card whose own numbers say otherwise, and always has a named way back to the questions
they got wrong — in their language, with no level that can be failed and no level that can be lost.

Read `README.md` in this directory first. `TN-DONE-finishing-a-level.md` owns the completion card — when it
appears, its chrome, its two per-level rows and its ways on — and this file does not restate any of it. What
this file owns is **what that card may claim about the player's answers**, and the rule that decides it.

## Why this file exists

A third live-site audit, 2026-09-16, found two things and they are one thing.

**Nothing in a level can be failed.** A player can answer every question wrong and still earn the stamp, and
levels 2 to 10 still unlock. Verified down to **0 of 6** on the North.

**The card then contradicts itself**, in both languages, on at least three levels:

| Level | What the card said, above | What the card said, below |
|---|---|---|
| The Alberta foothills | You rode across the ranch, from the gate out to the herd, and answered every question along the way about Canada's economy. | Right answers in this level: 2 out of 9 |
| Toronto | You rode the whole boulevard, all the way to the big square, and answered every question along the way about voting and ridings. | Right answers in this level: 1 out of 8 |
| The North | Vous avez parcouru la plage de galets, du bateau jusqu'au bois flotté, et répondu à toutes les questions laissées ici sur les régions du Canada. | Bonnes réponses dans ce niveau : 0 sur 6 |

**The sentence that reads as a lie is true.** The player really did answer every question along the way;
"answered" is not "answered rightly". That is why it survived authoring, verification and two audits: it
**reports a fact and praises by implication in one sentence**, and only the second half is wrong. So the rule
this file writes is not "do not congratulate the player". It is:

> **One sentence, one fact.** No sentence on the completion card may fuse what the player *did* with how
> they *did*. Only the two rows that count answers may say anything about answers.

The second finding — that a level has no fail path — is answered by a decision rather than by a fail card,
and the decision is written out below so that the next audit reads it as intended rather than as the same
defect a fourth time.

## The ruling

1. **A stamp is for the task, and it means "I went and did this" — never "I know this."** ADR-0036 is
   unchanged. Nothing about a stamp depends on being right, on any level, in any mode.
2. **A level cannot be failed, and that is a decision and not an omission.** There is no level pass mark, no
   level fail card, no retake requirement and no score that closes anything.
3. **The stamp and the unlock stay the same token.** `unlockedLevelIds` counts stamps
   (ADR-0036, *"Unlocking follows stamps, unchanged"*), so splitting them means a second thing to count in
   `content/game.config.json` — and two sources of "open" is the alternative ADR-0036 already refused from
   the other side.
4. **A wrong answer costs exactly one thing, and from now on the player can see it: the question comes
   back.** That promise is already printed on the question card (`card.againSoon`, `TN-CARD-04`). The
   completion card now counts it and offers the way to it.
5. **No sentence on the completion card may state or imply how well the player did**, except the two rows
   whose whole job is to say so. This binds the heading, the stamp sentence, the next-level line **and the
   giver's own `doneLine`**, which is content and is where the audit found it.
6. **The all-wrong card differs from the half-right card only in its numbers.** Same rows, same words, same
   colours, same controls. A special register for a bad result is a mark with a kind face on it.
7. **The one verdict in this game is the practice exam's, fifteen of twenty.** No level, card or passport
   gives a second one, and none of them tells the player whether they are ready.

## Why the stamp is not blocked at fifteen of twenty

This was the obvious fix and it is refused, for four reasons in descending order of weight.

1. **`CLAUDE.md` puts the pass mark inside Exam mode.** The exam mirrors IRCC — twenty questions, fifteen to
   pass, thirty minutes — and the levels are the teaching that comes before it. Applying the exam's bar to
   the teaching turns every level into an exam the player can lose, which is the same shape the "timer only
   in Exam mode" rule exists to prevent: the game stops being a place to learn and becomes a place to be
   measured, everywhere, all the time.
2. **It withholds the teaching from the player who needs it most.** The audience is newcomers, many of them
   reading in a second language. A player who scores 3 of 9 is the audience — not a failure case — and the
   material they would be locked out of is the material they scored 3 of 9 on. A lock spends their effort on
   a wall instead of on the next chapter.
3. **It is a dead end waiting for a short bank.** Six `answer` steps hold pools of exactly their count
   (slice L1), so a replay asks the same questions; level 8 shipped with a subject bank below `CLAUDE.md`'s
   floor (`OQ-ALBERTA-2`). A player who cannot clear three quarters of a small fixed pool would have nowhere
   left to go, and **nothing may become a dead end** is a hard rule, not a preference.
4. **It makes the stamp mean something the passport does not say.** `passport.intro` promises a stamp for
   finishing a level's task. A score condition puts arithmetic in that sentence, in two languages, at
   grade 6, on the one screen that explains the game's only token.

## Why the stamp and the unlock are not split

The serious alternative, and the only design that would make a stamp mean *knowing*: the stamp is earned by
getting this level's questions right, and the next level is unlocked by the task. Progress would never be
blocked and the passport would become a real record. It is refused for three reasons.

- **Unlocking counts stamps.** `unlockRules.stampsToUnlockNext` reads the stamps in the save. A mastery
  stamp needs a second currency for the unlock to count, and the first thing a second currency can produce
  is a player who has earned neither.
- **"All of this level's questions right" has no stable meaning.** A pool that holds exactly its count asks
  the same questions again; a larger pool draws differently; four of the thirty-five landmarks ask nothing
  outside a task (ADR-0048). The same effort would earn the stamp on one level and not on another, for
  reasons the player cannot see.
- **Ten empty slots in the passport of the player finding it hardest is a star rating with a picture on it**,
  and this directory refuses stars (`README.md`: *a game that teaches never marks the player down*).

If the project owner wants it anyway, what changes is written down so the cost is visible: a new ADR
amending ADR-0036, a second counted thing in `content/game.config.json`, a reworded `passport.intro`, a
fourth passport state, and rules 1 and 3 above.

## What the card says, case by case

`quest-complete-progress` is unchanged and still carries exactly one of `level.complete.score` and
`level.complete.none` (`TN-DONE`). Everything in this table below that row is new.

| What happened in this level | `quest-complete-progress` | `quest-complete-coming-back` | `quest-complete-practise` |
|---|---|---|---|
| No question was answered | `level.complete.none` | absent | absent |
| Every answer was right | `level.complete.score` | `level.complete.allRight` | absent |
| Some answers were wrong | `level.complete.score` | `level.complete.comingBack.*` | present |
| Every answer was wrong | `level.complete.score` | `level.complete.comingBack.*` | present |

**"Coming back" counts the questions this level asked in this sitting that the player got wrong.** It is not
a readout of everything the scheduler has due, and it must never become one: a player who got all six right
would otherwise read "6 questions will come back", which is true of a spaced-repetition scheduler and reads
as a punishment. The count is the promise the question card already made, added up — nothing more.

**The words *spaced repetition*, *FSRS*, *scheduler*, *due* and *interval* stay off the screen**, as they are
everywhere else (`TN-CARD-02`). "Will come back" is the whole of what the player is told, because it is the
whole of what the player needs.

## Player-facing copy

**Proposed rows, pending ratification (`COPY_GAPS`), third live-site audit.**

| Key | EN | FR |
|---|---|---|
| `level.complete.comingBack.one` | You will see {{n}} question from this level again. | Vous reverrez {{n}} question de ce niveau. |
| `level.complete.comingBack.other` | You will see {{n}} questions from this level again. | Vous reverrez {{n}} questions de ce niveau. |
| `level.complete.allRight` | You got every question in this level right. | Vous avez bien répondu à toutes les questions de ce niveau. |
| `level.complete.practise` | Practise these questions | Réviser ces questions |

**`comingBack` carries a counted noun and therefore two rows in each language**, chosen by
`Intl.PluralRules` for the active locale and never by comparing the count to one (`TN-COPY`, rules 2 and 3).
Rule 1's preferred shape — a noun in front of the number and a preposition after it — was tried and refused:
"Coming back: 7 of 9" is a second score line under the first, on the one card that must not look like a
report card. This is rule 1 losing to what the sentence has to *mean*, and it is recorded here rather than
argued again.

**The verb is the question card's own.** `card.againSoon` reads "You will see this question again soon." /
« Vous reverrez cette question bientôt. » These rows are that promise counted, in the same words, so a player
meets one sentence twice rather than two sentences once. The word "soon" is dropped, because the card offers
the route now and a promise about time is a promise this file cannot keep (`OQ-CARD-5`).

**`level.complete.allRight` is not `study.summary.allRight`**, for the reason `TN-DONE` gives about
`level.complete.score`: a drill is a set the player asked for and a level is whatever a level happened to
ask, and `TN-STUDY` must stay free to reword its own summary. **`level.complete.practise` is not
`exam.result.practise`** for the same reason and one more — that control practises the questions missed in an
*exam*, and this one practises the questions missed in *this level*.

**No French row here needs gender agreement.** « reposée », « reverrez » and « répondu » agree with the
question or with nothing, never with the player, and no row contains `(e)`, `·e` or a bracketed ending
(`docs/content-review.md` §8.6).

Keys and things this card draws that this file does not own:

| What | Owned by |
|---|---|
| The card, its chrome, its two per-level rows, its ways on | `TN-DONE-finishing-a-level.md` |
| `quest.done.title`, `common.keepPlaying` | `TN-QUEST-parliament-hill.md` |
| `level.complete.title`, `level.complete.none`, `level.complete.score` | `TN-DONE-finishing-a-level.md` |
| The giver's own last line | the quest document's `doneLine`, ruled there by `TN-DIALOGUE` |
| `card.againSoon`, and what a wrong answer does on the question card | `TN-CARD-question-card.md` |
| The exam's verdict, its pass mark and its by-subject rows | `TN-RESULT-exam-results.md` |
| The stamp once it is in the passport, and `passport.intro` | `TN-PASSPORT-my-passport.md` |
| Which level opens next, and why | `TN-MAP-level-select.md` |
| Plurals and how a count is shaped | `TN-COPY-strings-and-counts.md` |

## Two markers this file proposes

| `data-testid` | What it marks |
|---|---|
| `quest-complete-coming-back` | The line under the count: `level.complete.allRight`, or `level.complete.comingBack.*`. Never both, never empty when it is present, absent when no question was answered. |
| `quest-complete-practise` | The control that opens a drill of the questions this level asked and the player got wrong. Present only while at least one is coming back, and **never the primary action**. |

## What no sentence on this card may say

This list is in addition to `TN-DONE`'s, and every item was found on the shipped card.

1. **No sentence may claim the player answered "every question"**, in either language, as anything other
   than the count itself. The three shipped `doneLine`s above are the instances; the other seven levels'
   have to be read for the same shape.
2. **A giver's `doneLine` describes where the player went and what the place was**, and says nothing about
   answering — right, wrong or at all. The two rows that count answers are recomputed each time; a sentence
   written months ago in `content/quests/` cannot be.
3. **No praise for the answering.** Not "well done", "great", "perfect", "nice work", « bravo », « parfait »,
   « excellent » — anywhere on the card. "Task done!" stays, because it names what finished and not how it
   went.
4. **Nothing drawn as an error.** No red as the only signal, no warning triangle, no cross, and none of
   "failed", "wrong", "missed", "poor", "only", "just", « échec », « échoué », « erreur », « faute ».
5. **No percentage, grade, letter, star, streak, rank or badge**, and nothing that compares this level to
   another, to a target, or to another player (`TN-DONE`, rule 4).
6. **Nothing about readiness.** No sentence says the player is ready for the exam, is nearly ready, or is
   not — on this card, on the passport or on the map. Fifteen of twenty is the exam's sentence to say
   (`TN-RESULT-01`).
7. **No instruction.** The card states what is true and offers controls; it never tells the player they
   should have done something, or should do something now.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-STANDING-08` |
| Single switch | `TN-STANDING-08` |
| Screen reader | `TN-STANDING-09` |
| Reduced motion | `TN-STANDING-09` |
| 200 % text | `TN-STANDING-09` |
| Bilingual | `TN-STANDING-10`, and `TN-STANDING-03` carries both languages in its examples |
| Failure path | `TN-STANDING-04` (the sentences that contradict the count, and the gates that refuse them), `TN-STANDING-07` (nothing becomes a dead end) |

---

## TN-STANDING-01 — Every answer right

```gherkin
Feature: The card when nothing is coming back
  As a player who got everything right in a level
  I want to be told so plainly, once
  So that the card is a record of what happened and not a prize

  Background:
    Given the Halifax level is playable
    And I have accepted its task

  Scenario: The card says what I got and that nothing is waiting
    Given I answered 9 questions in this level and all 9 were right
    When I finish the level's task
    Then the element "quest-complete-card" is visible
    And the element "quest-complete-progress" reads "Right answers in this level: 9 out of 9"
    And the element "quest-complete-coming-back" reads "You got every question in this level right."
    And the element "quest-complete-practise" is not present

  Scenario: It is a statement, not a prize
    Then no sentence on the card contains "well done", "great", "perfect" or "nice work"
    And no percentage, grade, star, streak or badge is shown
    And nothing on the card says I am ready for the exam
    And nothing on the card compares this level to another

  Scenario: The stamp and the next level are unchanged
    Then the event "stamp/earned" is emitted for "halifax"
    And "quest-complete-stamp" reads "You earned the Halifax stamp."
    And the level that just opened is offered, as TN-DONE-04 describes

  Scenario: A perfect run is not a firework
    Then no confetti or particle is drawn
    And "scene-state" reports "data-particles" equal to "0"
    And nothing counts up
```

## TN-STANDING-02 — Some answers wrong

```gherkin
Feature: The card when questions are coming back
  As a player who got some of them wrong
  I want to know how many are coming back and how to get to them
  So that a wrong answer is worth something I can act on

  Background:
    Given the Alberta foothills level is playable
    And I have accepted its task

  Scenario: The count and the questions coming back are two lines
    Given I answered 9 questions in this level and 2 were right
    When I finish the level's task
    Then "quest-complete-progress" reads "Right answers in this level: 2 out of 9"
    And "quest-complete-coming-back" reads "You will see 7 questions from this level again."
    And the two lines are drawn as two lines, never joined into one sentence

  Scenario: The way back to them is on the card
    Then a control "quest-complete-practise" is offered, reading "Practise these questions"
    And it is at least 44 CSS px wide and tall
    And it is not the primary action
    And "quest-complete-next" is still the primary action while there is a level to offer

  Scenario: Taking it opens a drill of the questions I got wrong
    When I take "quest-complete-practise"
    Then the event "study/started" is emitted
    And the element "study-screen" is visible
    And the drill contains the questions I got wrong in this level
    And the promise printed in TN-CARD-04 is kept for them

  Scenario: The line counts this visit, not everything the game has scheduled
    Given I answered 9 questions in this level and all 9 were right
    Then "quest-complete-coming-back" does not name any number
    And it reads "You got every question in this level right."

  Scenario: It reads correctly at one
    Given I answered 9 questions in this level and 8 were right
    Then "quest-complete-coming-back" reads "You will see 1 question from this level again."
    And it does not read "1 questions"

  Scenario: Nothing on the card marks me down
    Then no sentence contains "failed", "wrong", "missed", "poor", "only" or "just"
    And nothing on the card is drawn as an error, a warning or a red state
    And no sentence tells me I should have done better
```

## TN-STANDING-03 — Every answer wrong

This is the audit's card: the North, six questions, none right.

```gherkin
Feature: The all-wrong card is the same card
  As a player who got every question wrong
  I want the same plain card everybody else gets
  So that the game is still somewhere I can learn rather than somewhere I lost

  Background:
    Given the North level is playable
    And I have accepted its task

  Scenario: The same rows, and only the numbers differ
    Given I answered 6 questions in this level and 0 were right
    When I finish the level's task
    Then "quest-complete-progress" reads "Right answers in this level: 0 out of 6"
    And "quest-complete-coming-back" reads "You will see 6 questions from this level again."
    And "quest-complete-practise" is offered
    And no word on the card differs from the reading at 2 right out of 9, apart from the numbers

  Scenario: No sentence above the count contradicts it
    Then the line the giver speaks does not contain "answered every question"
    And in French it does not contain "répondu à toutes les questions"
    And no sentence on the card says or implies that I answered anything rightly
    And "Task done!" is the only thing on the card that says the task finished

  Scenario: There is no fail card, and this is not one
    Then the card does not report "data-reason" equal to "failed"
    And no heading, sentence or picture on it calls this a failure
    And nothing on it is red as the only signal of anything
    And no control on it is disabled because of my answers

  Scenario: The stamp is earned and the next level opens
    Then the event "stamp/earned" is emitted for "the-north"
    And "quest-complete-stamp" reads "You earned the North stamp."
    And the level after this one in "unlockRules.order" is open on the map
    And that is this file's rule 2, asserted on purpose and not by accident

  Scenario: The same card in French
    Given the language is French
    Then "quest-complete-progress" reads "Bonnes réponses dans ce niveau : 0 sur 6"
    And "quest-complete-coming-back" reads "Vous reverrez 6 questions de ce niveau."
    And the control reads "Réviser ces questions"
    And no English word appears in "quest-complete-card"
```

## TN-STANDING-04 — Sentences that contradict the count (failure path)

```gherkin
Feature: A card cannot praise what its own numbers deny
  Scenario: The three shipped lines the audit found are refused
    Given a quest document's "doneLine" contains "answered every question along the way"
    When the content check runs
    Then the build fails, naming the quest and the field
    And the message says a done line describes where the player went, not how they answered
    And the same check fails for "répondu à toutes les questions"

  Scenario: Every quest is checked, not only the three that were seen
    Then the check reads the "doneLine" of every document under "content/quests"
    And it reads both languages of each
    And it reports every offender, not only the first

  Scenario: The rule is about answering, not about warmth
    Given a done line reads "You rode across the ranch, from the gate out to the herd."
    Then the check passes it
    And a line that adds "and got them all right" fails
    And a line that adds "and answered every question" fails
    And a line that adds "and learned a lot about Canada's economy" fails

  Scenario: No other line on the card may carry the claim either
    Then no stamp sentence in either language says anything about answers
    And "level.complete.nextOpen" says nothing about answers
    And the heading says only what finished

  Scenario: The two counting rows are the only place a number about answers appears
    Then exactly one of "level.complete.score" and "level.complete.none" is drawn
    And "quest-complete-coming-back" is the only other element naming a number of questions
    And no third element on the card carries a count of anything I answered

  Scenario: A missing coming-back row draws nothing rather than something else
    Given this build has no "level.complete.comingBack.other" row in the active language
    Then "quest-complete-coming-back" is not present
    And no other level's or screen's sentence is drawn in its place
    And nothing reads as "TBD", "???", an empty box or a placeholder
    And the build has already failed the check for the missing row

  Scenario: The gates are proven by failing fixtures
    Then a fixture exists for each check above
    And each is asserted to fail
    And the fixtures include the three lines this file quotes, word for word
    And a change that makes any of them pass fails this suite
```

## TN-STANDING-05 — Playing the level again

```gherkin
Feature: Coming back to a level I have finished
  As a player who got a lot wrong
  I want to play the level again and meet those questions
  So that the way to get better is the game itself

  Background:
    Given I finished the North with 0 of 6 right
    And its stamp is in my passport

  Scenario: Nothing makes me replay, and nothing stops me
    Then no screen tells me to play this level again
    And the level is still open on the map, as TN-MAP-02 describes
    And nothing counts down towards anything

  Scenario: The questions I got wrong are the ones I meet
    When I play the level again and engage its landmarks
    Then the questions I answered wrongly are asked before ones I answered rightly
    And this is the rule TN-CARD-02 and TN-STUDY-02 already state

  Scenario: The card counts this visit
    Given I answer 6 questions in this visit and 4 are right
    When I reach the end of the level
    Then "quest-complete-progress" reads "Right answers in this level: 4 out of 6"
    And it does not show the count from the visit before
    And "quest-complete-coming-back" reads "You will see 2 questions from this level again."

  Scenario: A better replay is not celebrated and a worse one is not scolded
    Then no sentence compares this visit to the last one
    And no improvement, streak or best is drawn
    And no sentence says I did worse than before

  Scenario: The stamp is neither earned twice nor taken away
    Then no second "stamp/earned" event is emitted
    And the passport still contains exactly one stamp for this level
    And no replay can remove a stamp, whatever I answer
```

## TN-STANDING-06 — Where a player sees where they stand

```gherkin
Feature: One verdict, in one place
  As a player preparing for a real exam
  I want one honest measure of how ready I am
  So that I am not reading a verdict into a level's card

  Scenario: The exam is the only thing that says pass or not
    Then the only screen in this game that reports passing is "exam-result"
    And it says "You passed" or "Not this time", as TN-RESULT-01 and TN-RESULT-02 describe
    And it says "You need 15 out of 20 to pass."

  Scenario: No level says anything about being ready
    Given I have finished every level
    Then no completion card, map card or passport slot says I am ready for the exam
    And none says I am not ready
    And none draws a percentage, an average or a total across levels

  Scenario: The passport keeps the last exam and nothing else about how I did
    Then "passport-exam" shows the most recent finished exam, as TN-PASSPORT-06 describes
    And no level's answers are reported on the passport
    And no best, average, streak or attempt count is drawn anywhere

  Scenario: The route to getting better is practice, not a verdict
    Given questions from a level are coming back
    Then the card offers "Practise these questions" and nothing else about my standing
    And Study is reachable from the menu, as TN-STUDY-01 describes
    And nothing on the card offers to start an exam
```

## TN-STANDING-07 — Nothing becomes a dead end (failure path)

```gherkin
Feature: A player who gets everything wrong can still reach the end of the game
  Scenario: Ten levels, every answer wrong, and the whole game is still reachable
    Given I answer every question in every level wrongly
    When I finish each level's task in turn
    Then a stamp is earned for each level
    And every level in "unlockRules.order" becomes open in turn
    And I reach the North and can open it
    And the practice exam can be started

  Scenario: No control is closed because of how I answered
    Then no control on any screen is disabled, hidden or "aria-disabled" because of an answer
    And no level card reads "Locked" for a reason about answers
    And "map.locked.after" and "map.locked.stamps" are the only reasons a level is locked

  Scenario: A level whose bank is short still tells the truth
    Given a level's subject has fewer verified questions than the floor
    And the level asked me 3 questions and I got none right
    Then "quest-complete-progress" reads "Right answers in this level: 0 out of 3"
    And "quest-complete-coming-back" reads "You will see 3 questions from this level again."
    And no sentence mentions the size of any question bank

  Scenario: A level that asked nothing says so and offers no practice
    Given I answered no question in this level
    Then "quest-complete-progress" reads the sentence about answering nothing, as TN-DONE-02 requires
    And "quest-complete-coming-back" is not present
    And "quest-complete-practise" is not present

  Scenario: Storage cannot be written when the level is finished
    Given local storage cannot be read or written
    Then the card is still drawn in full, with both of its lines
    And the element "storage-warning" is visible
    And no sentence claims the answers were saved
    And no sentence claims progress was lost

  Scenario: Nothing on this card expires
    When I do nothing for two minutes
    Then the card is unchanged
    And nothing counts down
    And no control has been taken for me
```

## TN-STANDING-08 — The card from the keyboard and with one switch

```gherkin
Feature: Everybody can read how they did and take the way back
  Scenario: The new control is in the order, in the right place
    Given I am using a keyboard only
    And questions from this level are coming back
    Then "quest-complete-next", "quest-complete-practise", "quest-complete-map" and
      "quest-complete-keep-playing" all receive focus with "Tab", in reading order
    And each activates with "Enter"
    And each focus indicator is visible and is not colour alone

  Scenario: Focus is not moved by how I did
    Then focus lands where TN-DONE-06 puts it, whatever my answers were
    And the card at 0 right and the card at 9 right place focus identically

  Scenario: The card is completable with one switch
    Given single-switch mode is on
    When I press the switch briefly through the whole card
    Then the highlight visits every control, including "quest-complete-practise", and wraps
    And each control's name is announced as the highlight arrives
    When I hold the switch past the hold-to-choose threshold on "Practise these questions"
    Then the drill opens

  Scenario: Nothing scans and nothing expires
    Given single-switch mode is on
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing has been chosen for me

  Scenario: A card with no practice control has one fewer stop, and nothing else changes
    Given every answer in this level was right
    Then the switch ring and the tab order contain no "quest-complete-practise"
    And every other control is reached in the same order as before
```

## TN-STANDING-09 — With a screen reader, with motion off, and at 200 %

```gherkin
Feature: How I did is spoken once and fits
  Scenario: The two lines are read as two phrases
    Then "quest-complete-progress" and "quest-complete-coming-back" are each text in the accessibility tree
    And each is read as one phrase, with its numbers not separated from the words around them
    And neither has an "aria-live" attribute of its own

  Scenario: Arriving is announced once, and what is announced does not depend on how I did
    When the card appears
    Then "#tn-live-region" reads the heading, the stamp sentence and the count, once
    And it is not repeated while the card stays open
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The control is named by what it does
    Then the accessible name of "quest-complete-practise" is "Practise these questions"
    And it is not named by a number
    And it names no input, so it says neither "tap" nor "press"

  Scenario: Reduced motion
    Given reduced motion is on
    When the card appears after a level in which every answer was wrong
    Then it appears with no slide, fade, bounce or scale
    And nothing shakes, flashes or pulses
    And the card after a level in which every answer was right appears the same way

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then both lines are fully visible, by scrolling inside the card if needed
    And no line is truncated with an ellipsis
    And every control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways

  Scenario: The longest French strings on these two rows fit
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Vous avez bien répondu à toutes les questions de ce niveau." is visible
    And the whole of "Vous reverrez 7 questions de ce niveau." is visible
    And the whole of "Réviser ces questions" is visible on its control

  Scenario: High contrast
    Given "High contrast" is on
    Then both lines meet the contrast requirement against their background
    And nothing about how I did is conveyed by colour

  Scenario: axe-core is clean on this card in both states
    When axe-core runs against the whole page with the card open at 0 right and at 9 right
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for those scans
    And both scans pass with no violations
```

## TN-STANDING-10 — Both languages

```gherkin
Feature: How I did, in French
  Background:
    Given the language is French

  Scenario: The two lines are French
    Given I answered 9 questions in this level and 2 were right
    Then "quest-complete-progress" reads "Bonnes réponses dans ce niveau : 2 sur 9"
    And "quest-complete-coming-back" reads "Vous reverrez 7 questions de ce niveau."
    And there is a space before the colon
    And no English word appears in "quest-complete-card"

  Scenario: The French agrees with the question and never with me
    Given I answered 9 questions in this level and 8 were right
    Then it reads "Vous reverrez 1 question de ce niveau."
    And it does not read "1 questions"
    And no string on the card contains "(e)", "·e" or a bracketed ending
    And the form is chosen by the plural rules of the active locale

  Scenario: Zero is singular in French and plural in English
    When the string "level.complete.comingBack" is rendered with n equal to 0
    Then it is not drawn at all, because nothing is coming back
    And "level.complete.allRight" is drawn in its place when at least one answer was given

  Scenario: The clean sweep is French
    Given every answer in this level was right
    Then it reads "Vous avez bien répondu à toutes les questions de ce niveau."
    And it does not read "Vous avez tout bon.", which belongs to the drill's summary

  Scenario: Both languages or neither
    Then every key this card draws has a value in "en" and in "fr"
    And a key present in one language and absent in the other fails the content check
    And a quest's "doneLine" with only one language fails it too

  Scenario: Changing the language while the card is open redraws both lines
    Given the card is open in English showing 2 out of 9
    When I change the language to French
    Then both lines are French
    And the numbers are unchanged
    And the card is still open and no control has been taken
```

---

## Open questions

- **`OQ-STANDING-1` — should a stamp ever depend on being right?** The four reasons above say no, and the
  refusal is the whole product decision in this file. *Recommendation:* keep the stamp for the task, keep the
  unlock with the stamp, and let the wrong answer be paid for by coming back. If the project owner wants a
  mastery stamp, it is a new ADR amending ADR-0036, a second counted thing in `content/game.config.json`, a
  reworded `passport.intro` and a fourth passport state — and this file's rules 1 and 3 are what change.
  **What must not happen is a score gate added quietly to the unlock**, because unlocking counts stamps and
  the first symptom is a player who can open nothing.
- **`OQ-STANDING-2` — the card now offers four controls and may want five.** "Play next level", "Choose a
  level", "Keep playing", "See my passport" and now "Practise these questions". *Recommendation:* if one has
  to go it is the passport, which the menu and the map both already offer, and which `OQ-DONE-5` records as
  the one control the two completion paths disagree about. The practice control earns its place because it is
  the only one that does the learning; the passport control is the only one with two other homes.
- **`OQ-STANDING-3` — "coming back" counts this sitting, and a reload can make that a lie.** The count is the
  questions this level asked *in this sitting* that were answered wrongly. A player who answers two wrongly,
  closes the tab, comes back and finishes reads a smaller number than the level deserves. This is
  `OQ-DONE-6`'s question about what "in this level" counts, arriving at a second row. *Recommendation:* count
  what this level asked, whenever it asked it, if the save can answer that; and if it cannot, count the
  sitting, because a number that is too small is a promise the game over-keeps rather than under-keeps.
  Routed with `OQ-SAVE-1`; `content/schemas/progress.schema.json` is not this directory's to edit.
- **`OQ-STANDING-4` — the drill the practice control opens is not scoped to this level.** Study draws from
  every bank (ADR-0036 §2) and puts wrong answers first, so the questions do come first — but the drill is
  not *only* them, and the control's words promise "these questions". *Recommendation:* either scope the
  drill to the ids the card counted, which is the smaller change and what `TN-RESULT-02` already implies for
  the exam, or reword the control to "Practise now". This is `OQ-STUDY-2`'s subject-chosen drill asked from a
  third direction, and three screens asking for the same thing is usually one thing.
- **`OQ-STANDING-5` — this needs an ADR, and it is the architect's to write.** Two of the rulings reach
  outside this directory: the completion card gains a row and a control (`app/ui`), and rule 5 binds a field
  in `content/quests/*` that a story may describe and may not edit. It extends ADR-0036 rather than amending
  it — the stamp is still for the task — and it would carry the refusal of the score gate so that the next
  audit finds a decision instead of a defect. *Recommendation:* one ADR, numbered after 0049, with this file
  as its acceptance.
- **`OQ-STANDING-6` — three shipped `doneLine`s are wrong and seven have not been read.** Toronto's, the
  Alberta foothills' and the North's are quoted above from the audit's own screenshots. They are content: an
  author rewrites them and a verifier grants them, and this directory neither writes nor approves them.
  `docs/plan/slices.md` already records the North's as owed for a different reason, so two findings meet on
  one line. *Recommendation:* read all ten in one pass against rule 2, in both languages, before any of them
  is rewritten one at a time.
- **`OQ-STANDING-7` — should a level ever tell a player they look ready for the exam?** It would be the most
  useful sentence in the game and the easiest to get wrong: the levels teach ten subjects and the exam draws
  twenty questions across them, so a level knows nothing about readiness and would be guessing out loud.
  *Recommendation:* no, and rule 7 says so. If the owner wants a readiness signal, it belongs on the
  passport, it is computed from exam attempts and from nothing else, and it is a new story.
- **`OQ-STANDING-8` — this file is not yet in `README.md`'s directory table.** The row it needs is
  `` | `TN-STANDING-how-i-did-in-a-level.md` | `TN-STANDING` | What a stamp means, why a level cannot be failed, what a wrong answer costs, and what the card may claim | ``, and the amendment paragraph above the table has not been written either. *Recommendation:* add both in the next pass over this directory, so a reader who arrives at the index finds ten files and not nine.
