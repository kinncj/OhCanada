# TN-RESUME — Which question I am asked after I come back

**Intent.** A player who closes the tab in the middle of the answer step comes back, is asked one more
question, and finishes the quest. If the question they got wrong is the one they are asked, that is the game
keeping the promise it printed on the card — not the game forgetting what they did.

This file exists because two stories promised opposite things about the same moment, and a reader who finds
that has no way to know which one the game is. `TN-SAVE-01` said the questions already answered are never
asked again after a reload; `TN-CARD-04` prints "You will see this question again soon." on every wrong
answer and `TN-CARD-02` makes missed-before-not-missed a hard rule, so the missed question is exactly what
the scheduler offers next. Both cannot hold. **`TN-CARD` won.** The reasoning is below, in the story, because
a decision that lives only in a commit message is a decision the next reader has to re-litigate.

Read `README.md` in this directory first. The card itself is `TN-CARD-question-card.md`; the step being
resumed is `TN-QUEST-04` step 3; what survives a closed tab is `TN-SAVE-save-and-reload.md`.

## The decision — 2026-09-08

**A reload does not hide a question that is ready to come back.** `TN-SAVE-01`'s fourth scenario used to
say that after a reload "the third question is asked and neither of the first two". It has been rewritten.
What that scenario was really protecting is *progress not being lost*: the count does not reset, no answer is
forgotten, and one more answer finishes the step. It was written to assert that, and reached for the
strongest observable form it could — which had the side effect of forbidding the scheduler from doing the one
thing the player was promised.

Three things made this decision cheap rather than close:

1. **`TN-SAVE` already agreed with `TN-CARD` twice in its own file.** Row 7 of its survives table promises
   "Questions I got wrong come back first", and its own first scenario asserts that after reopening "the
   question I answered wrongly is offered before the one I answered rightly". The fourth scenario
   contradicted both of those, in the same feature, before it ever met `TN-CARD`. It was the outlier, not the
   rule.
2. **One of the two promises is printed on screen and the other is not.** "You will see this question again
   soon." is player-facing copy in both languages (`card.againSoon`). "Neither of the first two is asked
   again" was never shown to anybody; it was a test step. When a promise the player can read and a promise
   only a test can read disagree, the one the player can read wins.
3. **The alternatives cost more and buy less.** Both were considered:
   - *Persist which questions a step has already asked.* Keeps both sentences literally true, at the price of
     new saved state (`TN-SAVE` currently saves the quest step, not the step's history), a schema field, a
     migration, and a rule with no observable consequence — the game would deliberately withhold the question
     it just promised to bring back, and no player could tell. It also does not rescue `TN-SAVE-01`'s first
     scenario, which asserts the missed question *is* offered on return: under this option nothing is offered
     at the Hill but a question the player has never seen, and the assertion has to move to Study anyway.
   - *Rank unseen questions above missed ones.* `TN-CARD-02` forbids it, and it is not even a fix: it widens
     the window rather than closing it, because a player who has seen the whole subject has no unseen question
     to be offered instead, and the contradiction returns unchanged. It is also backwards for a learning tool
     — it delays the question the player got wrong in favour of novelty, for the player most likely to need
     the repeat.

**What this costs, stated plainly, because it is a real cost.** The step counter counts *answers given*, not
different questions. A player who answers A wrongly, closes the tab, comes back an hour later and is asked A
again has answered three times but seen two questions. This can only happen across a reload — within one
sitting the game never asks the same question twice — and the second showing is a real review with real
feedback, so nothing is faked and no count is inflated for the player's benefit. That is a smaller price than
printing a promise and then quietly not keeping it.

## What a sitting is

**A sitting** is one run of the page: from opening the game to closing the tab. The game's memory of which
questions it has already put on screen lasts exactly one sitting and is not saved — it is transient, like the
camera position and the skater's speed. `TN-CARD-02`'s "in the same sitting" means this. Everything the
scheduler needs in order to know *when a question should come back* is saved, and is row 7 of `TN-SAVE`'s
survives table.

## Player-facing copy

This story introduces no new strings. It reuses, and does not restate:

| Key | Owned by |
|---|---|
| `card.kind.new`, `card.kind.seen`, `card.progress`, `card.againSoon` | `TN-CARD-question-card.md` |
| `quest.step.answer` | `TN-QUEST-parliament-hill.md` |

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-RESUME-04` — *Finishing the step from the keyboard after a reload* |
| Single switch | `TN-RESUME-05` — *Finishing the step with one switch after a reload* |
| Screen reader | `TN-RESUME-06` — *Coming back is announced, and so is the tag* |
| Reduced motion and 200 % text | `TN-RESUME-07` — *The resumed card under accessibility settings* |
| Bilingual | `TN-RESUME-08` — *Coming back in French* |
| Failure path | `TN-RESUME-03` — *Coming back to a step that cannot go on* |

---

## TN-RESUME-01 — Coming back to an unfinished answer step

```gherkin
Feature: One more answer finishes the step
  As a player who closed the tab half way through the questions
  I want to carry on from where I was
  So that nothing I already answered is thrown away

  Background:
    Given I accepted the Ottawa quest and engaged Parliament Hill
    And I answered question A wrongly and question B rightly
    And A is the only question I have ever answered wrongly
    And I closed the tab

  Scenario: The count survives and the card carries on from it
    Given an hour has passed, so A is ready to come back
    When I open the game again
    Then the event "progress/loaded" is emitted
    And "hud-quest-tracker" shows "Answer 3 questions (2 of 3)"
    When I engage "poi.parliament-hill"
    Then the event "question/asked" is emitted
    And "question-progress" reads "Question 3 of 3"
    And the number in "question-progress" is one more than the count in "hud-quest-tracker"

  Scenario: The question I got wrong is the one I am asked
    Given an hour has passed, so A is ready to come back
    When I open the game again and engage "poi.parliament-hill"
    Then "question-prompt" shows question A
    And "question-kind" reads "Seen before"
    And question B is not asked

  Scenario: Answering it finishes the quest
    Given an hour has passed, so A is ready to come back
    And I opened the game again and engaged "poi.parliament-hill"
    When I answer the question, right or wrong
    Then "hud-quest-tracker" shows "Answer 3 questions (3 of 3)"
    And the event "quest/step-completed" is emitted for step 3
    And the event "quest/completed" is emitted
    And the event "stamp/earned" is emitted for "ottawa"

  Scenario: Nothing I answered is treated as new
    When I open the game again
    Then neither A nor B is ever shown with "question-kind" reading "New"

  Scenario: Coming back before the missed question is ready
    Given I open the game again five seconds after answering A
    When I engage "poi.parliament-hill"
    Then the question asked is one I have never seen
    And "question-kind" reads "New"
    And question A is not asked
    And question B is not asked
```

## TN-RESUME-02 — What a reload carries, and what it releases

```gherkin
Feature: The sitting's memory ends with the sitting
  Scenario: The same question is never asked twice in one sitting
    Given the answer step is on question 1 of 3
    When I answer all three questions without closing the tab
    Then three different questions are asked
    And no question is asked twice

  Scenario: After a reload, a question that is ready may come back
    Given I answered question A wrongly and closed the tab
    And an hour has passed
    When I open the game again and am asked a question
    Then A may be asked again
    And it is marked "Seen before", not "New"
    And the card shows nothing to say the game lost track of me

  Scenario: A question answered rightly does not come back straight away
    Given I answered question B rightly and closed the tab
    And an hour has passed
    When I open the game again and answer the rest of the step
    Then question B is not asked

  Scenario: The count only ever goes up
    Given "hud-quest-tracker" showed "Answer 3 questions (2 of 3)" when I closed the tab
    When I open the game again
    Then "hud-quest-tracker" shows "Answer 3 questions (2 of 3)"
    And it never shows a lower number than it showed before

  Scenario: The count is a count of answers, not of different questions
    Given I answered A wrongly, then B, then A again after a reload
    Then "hud-quest-tracker" shows "Answer 3 questions (3 of 3)"
    And the quest completes
    And no message tells the player how the questions were chosen
```

## TN-RESUME-03 — Coming back to a step that cannot go on (failure path)

```gherkin
Feature: Resuming when the next question cannot be asked
  Scenario: The question bank will not load on the way back
    Given I answered two of the three questions and closed the tab
    When I open the game again and the question bank fails to load
    And I engage "poi.parliament-hill"
    Then a message says "The questions are not ready right now. Try again later."
    And it is announced in "#tn-live-region"
    And "hud-quest-tracker" still shows "Answer 3 questions (2 of 3)"
    And no "quest/completed" and no "stamp/earned" event is emitted
    And the skater can move away

  Scenario: Every remaining question has been quarantined
    Given I answered two of the three questions and closed the tab
    And every question left for this subject is quarantined
    When I open the game again and engage "poi.parliament-hill"
    Then the same message is shown
    And the count is not changed
    And no question card is shown with an empty prompt

  Scenario: The tab closed between the answer and "Next"
    Given I answered the second question and the feedback was on screen
    When the tab closed and I open the game again
    Then "hud-quest-tracker" shows "Answer 3 questions (2 of 3)"
    And that answer is recorded exactly once
    And no feedback from the previous sitting is shown

  Scenario: The tab closed with the card open and unanswered
    Given a question was on screen and I had not answered it
    When the tab closed and I open the game again
    Then "hud-quest-tracker" shows the same count as before the card opened
    And no answer was recorded for that question
    And that question may be asked again, and is not treated as wrong
```

## TN-RESUME-04 — Finishing the step from the keyboard after a reload

```gherkin
Feature: Keyboard-only resume
  Background:
    Given I am using a keyboard only
    And I answered two of the three questions and closed the tab

  Scenario: The last question is reachable and answerable
    When I open the game again
    And I reach "poi.parliament-hill" and engage it with the key bound to "interact"
    Then focus moves into "question-card"
    And I can answer with "Tab" and "Enter"
    And the quest completes

  Scenario: Nothing traps the player on the way back
    When I open the game again
    Then focus is inside a named region at every step from load to the completion card
    And focus is never on the body element
```

## TN-RESUME-05 — Finishing the step with one switch after a reload

```gherkin
Feature: Single-switch resume
  Background:
    Given single-switch mode is on
    And I answered two of the three questions and closed the tab

  Scenario: The step finishes with short and long presses alone
    When I open the game again and use only short and long presses
    Then I can engage Parliament Hill, answer the last question and earn the stamp

  Scenario: The highlight starts at the first item, as promised
    When I open the game again and the question card opens
    Then the highlight is on the first option
    And nothing has been chosen for me

  Scenario: Nothing advances by itself while I get my bearings
    When I do nothing for two minutes after the card opens
    Then no answer has been submitted
    And the highlight has not moved
```

## TN-RESUME-06 — Coming back is announced, and so is the tag

```gherkin
Feature: Resuming with a screen reader
  Background:
    Given I answered two of the three questions and closed the tab
    And an hour has passed

  Scenario: The step I am on is spoken, not only drawn
    When I open the game again
    Then "#tn-live-region" reads a message saying the game carried on where I left it
    And "hud-quest-tracker" is in the accessibility tree as text reading "Answer 3 questions, 2 of 3"

  Scenario: The card says which question this is
    When I engage "poi.parliament-hill"
    Then the accessible name of "question-card" includes "Question 3 of 3"
    And "question-kind" is read as "Seen before"
    And it is not conveyed by an icon alone

  Scenario: A repeat is not announced as a mistake
    Then no announcement uses the words "again already", "repeat", "error" or "wrong" about the player
    And exactly one element on the page has an "aria-live" attribute
```

## TN-RESUME-07 — The resumed card under accessibility settings

```gherkin
Feature: Reduced motion and large text on the way back
  Scenario: Coming back does not animate
    Given reduced motion is on
    And I answered two of the three questions and closed the tab
    When I open the game again and the question card opens
    Then the card appears with no slide, fade or scale
    And "scene-state" reports "data-particles" equal to "0"

  Scenario: The resumed card at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When the resumed question card is visible
    Then "question-progress" is fully visible and reads "Question 3 of 3"
    And all four options are reachable and at least 44 CSS px tall
    And the page does not scroll sideways

  Scenario: The tracker and the card do not disagree at any size
    Given text scaling is 200 %
    Then the number in "question-progress" is still one more than the count in "hud-quest-tracker"
```

## TN-RESUME-08 — Coming back in French

```gherkin
Feature: Resuming in French
  Background:
    Given the language is French
    And I answered question A wrongly and question B rightly, then closed the tab
    And an hour has passed

  Scenario: The tracker and the card are French and agree
    When I open the game again
    Then "hud-quest-tracker" shows "Répondez à 3 questions (2 sur 3)"
    When I engage "poi.parliament-hill"
    Then "question-progress" reads "Question 3 sur 3"
    And "question-kind" reads "Déjà vue"
    And no English word appears on the card

  Scenario: The question that comes back is the French wording of the same question
    Then "question-prompt" shows the French wording of question A
    And it is the same question, not a different one that happens to be in French

  Scenario: A save made in English resumes in French with the same step
    Given I answered those two questions with the game in English
    When I open the game again and change the language to French
    Then "hud-quest-tracker" shows "Répondez à 3 questions (2 sur 3)"
    And the question offered is still A
    And answering it completes the quest and shows "Mission accomplie!"

  Scenario: Nothing in the French copy explains the choice
    Then no string on the card contains "répétition espacée", "FSRS", "algorithme", "intervalle" or "échéance"
```

---

## Open questions

- **`OQ-RESUME-1` — how does a test move the clock an hour?** Every scenario here that says "an hour has
  passed" needs the time the scheduler reads to be settable, or the test waits an hour or sleeps sixty
  seconds and becomes flaky. *Recommendation:* the clock is a port with a fake in tests, and the story keeps
  saying "an hour has passed" rather than naming the fake. If no such port exists, this is the one thing in
  this file that cannot be proved, and it should be raised before task 1.4 is called done, not after.
- **`OQ-RESUME-2` — should the step ever ask more than three cards to reach three *different* questions?**
  These scenarios say no: three answers finish the step, even if two of them were the same question across a
  reload. *Recommendation:* keep it. Counting different questions means persisting which ones the step asked,
  which is the option this file rejected, and it would let a step run to four or five cards without ever
  saying so in the tracker.
- **`OQ-RESUME-3` — does this rule change for Exam mode?** Exam is twenty fixed questions and is not in this
  slice. *Recommendation:* an exam in progress is not resumable at all, so the seam does not exist there; when
  Exam mode is specified, say that explicitly rather than inheriting this file by silence.
- **`OQ-RESUME-4` — is "an hour" the right number to write in a scenario?** The real threshold is whatever the
  shortest lapse interval is, which `OQ-CARD-5` says must stay short enough for "soon" to be true. *An hour*
  is written here because it is comfortably past any such interval and reads as a plain fact to a player.
  If the scheduler is ever tuned so that a lapsed question is *not* ready an hour later, `card.againSoon` is
  the string that has become a lie, and this file's scenarios are the ones that fail first — which is the
  point.
