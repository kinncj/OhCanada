# TN-CARD — The question card

**Intent.** When the game asks the player a question, the player understands what is being asked, answers it
with one thumb, learns something from the answer either way, and is never punished or timed.

Three questions arrive during the Ottawa quest (`TN-QUEST-04`, step 3). Which three is decided by the
review scheduler (task 1.4). **The player never learns that.** The words *spaced repetition*, *FSRS*,
*algorithm*, *interval*, *card state* and *due* appear nowhere on screen, in either language. What the
player sees is a small tag — "New" or "Seen before" — and a promise that questions they get wrong come back.

That promise is printed on the card, so it is the one that wins when something else disagrees with it.
`TN-SAVE-01` used to say a question already answered is never asked again after a reload; it was amended on
2026-09-08 and `TN-RESUME-questions-after-a-reload.md` carries the whole decision. Nothing in this file
changed as a result — it is named here so a reader arriving from that side finds one story, not two.

Read `README.md` in this directory first.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-CARD-06` — *Answering with a keyboard* |
| Single switch | `TN-CARD-07` — *Answering with one switch* |
| Screen reader | `TN-CARD-08` — *The card, the options and the result are all spoken* |
| Reduced motion | `TN-CARD-09` — *No shake, no flash, no confetti* |
| 200 % text | `TN-CARD-10` — *A long question at 200 %* |
| Bilingual | `TN-CARD-11` — *The card in French* |
| Failure path | `TN-CARD-05` — *Leaving, mis-tapping and double tapping* |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `card.progress` | Question {{n}} of {{total}} | Question {{n}} sur {{total}} |
| `card.kind.new` | New | Nouvelle |
| `card.kind.seen` | Seen before | Déjà vue |
| `card.correct` | That's right! | C'est exact! |
| `card.wrong` | Not quite. | Pas tout à fait. |
| `card.answerIs` | The answer is: {{answer}} | La bonne réponse est : {{answer}} |
| `card.why` | Why: {{explanation}} | Pourquoi : {{explanation}} |
| `card.againSoon` | You will see this question again soon. | Vous reverrez cette question bientôt. |
| `card.yourAnswer` | Your answer | Votre réponse |
| `card.correctAnswer` | Correct answer | Bonne réponse |
| `card.next` | Next | Suivant |
| `card.finish` | Finish | Terminer |
| `card.close` | Close | Fermer |
| `card.closedNotice` | No problem. We will ask again later. | Pas de problème. Nous reposerons la question plus tard. |

The question, its four options and its explanation are content (`content/questions/*`), EN and FR, written
and verified by the content agents (tasks 1.7 and 1.8). Nothing in the UI writes question wording.

---

## TN-CARD-01 — A question arrives

```gherkin
Feature: The question card appearing
  As a player who reached Parliament Hill
  I want a clear question with four choices
  So that I can check what I know

  Background:
    Given the Ottawa level is playable
    And I am on the answer step of the quest

  Scenario: The card opens when I engage the landmark
    When I engage "poi.parliament-hill"
    Then the event "question/asked" is emitted
    And the element "question-card" is visible
    And "question-progress" reads "Question 1 of 3"
    And "question-prompt" shows the question wording
    And exactly four options are shown, as "option-0" to "option-3"
    And each option is at least 44 CSS px tall
    And "data-paused" is "true"

  Scenario: A question never interrupts skating
    Given I am gliding along the canal
    When one minute passes without me engaging anything
    Then no "question/asked" event is emitted
    And the element "question-card" never appears on its own

  Scenario: The player is told whether this one is new
    Then "question-kind" reads either "New" or "Seen before"
    And no other word about scheduling appears anywhere on the card

  Scenario: Nothing counts down
    When the card is open and I do nothing for two minutes
    Then the card is unchanged
    And no answer has been submitted for me
    And no timer, clock or progress bar that empties is shown

  Scenario: The three questions are the ones the scheduler chose
    When I answer all three questions in one sitting
    Then the three questions are all from this level's subject
    And no question is asked twice in that sitting
    And every question shown carries verification status "verified"
```

## TN-CARD-02 — What "scheduled" means to the player

```gherkin
Feature: Which questions come back, and when
  Scenario: A question answered wrongly comes back before one answered rightly
    Given I answered question A wrongly and question B rightly
    When the next questions are chosen for me
    Then question A is offered before question B

  Scenario: A question answered rightly is not asked again in the same sitting
    Given I answered question B rightly
    When I am asked more questions in this sitting
    Then question B is not asked again

  Scenario: A question is never asked twice in the same sitting
    When I am asked any number of questions between opening the game and closing the tab
    Then no question is put on screen twice

  Scenario: The promise made to the player is kept
    Given I answered a question wrongly and was told "You will see this question again soon."
    When I run a Study drill afterwards
    Then that question is in the drill

  Scenario: The promise is kept after a reload too, not broken by it
    Given I answered a question wrongly and was told "You will see this question again soon."
    And I closed the tab and opened the game again once it was ready to come back
    When I am asked the next question
    Then that question may be the one I got wrong, as TN-RESUME-01 requires
    And nothing is hidden from me because a reload happened in between

  Scenario: The scheduling words never appear
    When I read every string on the card in English and in French
    Then none of them contains "spaced repetition", "FSRS", "algorithm", "interval" or "due"
```

## TN-CARD-03 — A right answer

```gherkin
Feature: Answering correctly
  Background:
    Given the element "question-card" is visible

  Scenario: The card says so, and explains why
    When I tap the correct option
    Then the event "question/answered" is emitted with correct true
    And "question-feedback" reads "That's right!"
    And "question-explanation" shows the explanation for this question
    And the chosen option is marked with a tick and the words "Correct answer"
    And the marking does not rely on colour alone
    And a button "Next" is offered

  Scenario: Moving on
    Given I answered question 1 of 3
    When I tap "Next"
    Then the element "question-card" shows "Question 2 of 3"
    And the previous question's feedback is gone

  Scenario: The last question closes the card
    Given I am on question 3 of 3
    When I answer and tap "Finish"
    Then the element "question-card" is gone
    And "data-paused" is "false"
    And the quest completes as described in TN-QUEST-04

  Scenario: An answer is saved as soon as it is given
    When I answer a question
    Then the event "progress/saved" is emitted before the card moves on
```

## TN-CARD-04 — A wrong answer

```gherkin
Feature: Answering wrongly
  Background:
    Given the element "question-card" is visible

  Scenario: The player is corrected kindly, and told what is right
    When I tap a wrong option
    Then the event "question/answered" is emitted with correct false
    And "question-feedback" reads "Not quite."
    And it shows "The answer is:" followed by the correct option's wording
    And "question-explanation" shows the explanation
    And the option I chose is marked with a cross and the words "Your answer"
    And the correct option is marked with a tick and the words "Correct answer"
    And neither marking relies on colour alone

  Scenario: The player is told it will come back
    Then the card shows "You will see this question again soon."
    And no score, streak, life or penalty is shown
    And the word "wrong", "fail" or "error" is not used about the player

  Scenario: A wrong answer still counts as answered
    Then the quest step counter rises by one
    And "Next" is offered exactly as after a right answer

  Scenario: The answer cannot be changed after it is given
    When I tap another option after answering
    Then no second "question/answered" event is emitted
    And the feedback does not change
```

## TN-CARD-05 — Leaving, mis-tapping and double tapping (failure path)

```gherkin
Feature: Getting out of the card
  Background:
    Given the element "question-card" is visible

  Scenario: The card can be left without answering
    When I tap "Close" or press "Escape"
    Then the event "question/dismissed" is emitted
    And no "question/answered" event is emitted
    And a short message says "No problem. We will ask again later."
    And the quest step counter does not change
    And "data-paused" is "false"

  Scenario: A dismissed question is asked again
    Given I dismissed a question
    When I engage the landmark again
    Then the same question is offered again
    And it is not counted as wrong

  Scenario: A double tap on one option answers once
    When I tap the same option twice quickly
    Then exactly one "question/answered" event is emitted

  Scenario: The card cannot be dismissed by tapping past it
    When I tap outside the card
    Then the card stays open
    And no answer is submitted

  Scenario: The explanation is missing from the content
    Given the question has no explanation text
    Then the card still shows the result and the correct answer
    And the content check has already failed the build for the missing field
```

## TN-CARD-06 — Answering with a keyboard

```gherkin
Feature: Keyboard-only question card
  Background:
    Given I am using a keyboard only
    And the element "question-card" is visible

  Scenario: Focus starts in the card and cannot leave it
    Then focus is on the card's heading or its first option
    When I press "Tab" ten times
    Then focus is still inside "question-card"
    And the level behind the card is inert

  Scenario: Answering
    When I press "Tab" until focus is on "option-2"
    And I press "Enter"
    Then that option is submitted as my answer
    And focus moves to the feedback so it is read

  Scenario: Space and Enter both work
    When focus is on an option and I press "Space"
    Then that option is submitted

  Scenario: Escape leaves the card
    When I press "Escape"
    Then the event "question/dismissed" is emitted
    And focus returns to "interact-prompt"

  Scenario: The whole set of three is answerable from the keyboard
    When I use only the keyboard
    Then I can answer all three questions and finish the quest
```

## TN-CARD-07 — Answering with one switch

```gherkin
Feature: Single-switch question card
  Background:
    Given single-switch mode is on
    And the element "question-card" is visible

  Scenario: Short presses move through the options
    When I press the switch briefly
    Then the highlight moves from the first option to the second
    And the highlighted option is announced in "#tn-live-region"
    When I press the switch briefly three more times
    Then the highlight has returned to the first option

  Scenario: A long press answers
    Given the highlight is on "option-1"
    When I hold the switch past the hold-to-choose threshold
    Then "option-1" is submitted as my answer

  Scenario: The result and the next question are reachable
    Given I have answered
    Then "Next" is in the highlight ring
    And a long press on it moves to the next question

  Scenario: Nothing answers for the player
    When I do nothing for two minutes
    Then no answer has been submitted
    And the highlight has not moved
```

## TN-CARD-08 — The card, the options and the result are all spoken

```gherkin
Feature: The question card with a screen reader
  Scenario: The card is a named modal
    When the card opens
    Then "question-card" has role "dialog" with "aria-modal" true
    And its accessible name includes "Question 1 of 3"
    And its accessible description includes the question wording
    And the rest of the page is inert
    And the canvas is "aria-hidden"

  Scenario: Options are buttons with full text
    Then each of "option-0" to "option-3" is a button
    And each accessible name is the whole option wording, with no truncation and no "option 1" prefix that hides it

  Scenario: The result is announced, not only drawn
    When I answer wrongly
    Then "#tn-live-region" reads "Not quite. The answer is:" followed by the correct wording
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The tag is spoken as words
    Then "question-kind" is read as "New" or "Seen before"
    And it is not conveyed by an icon alone

  Scenario: Closing returns focus
    When the card closes for any reason
    Then focus returns to the control that opened it
```

## TN-CARD-09 — No shake, no flash, no confetti

```gherkin
Feature: Reduced motion on the card
  Background:
    Given reduced motion is on
    And the element "question-card" is visible

  Scenario: The card appears and changes without motion
    Then the card appears with no slide or scale
    When I answer
    Then the feedback appears with no flash, shake or bounce
    And no particle effect is drawn

  Scenario: Going to the next question is instant
    When I tap "Next"
    Then the next question replaces the current one with no transition

  Scenario: Nothing is lost by removing the motion
    Then right and wrong are still distinguished by a word and a shape
    And the correct option is still marked
```

## TN-CARD-10 — A long question at 200 %

```gherkin
Feature: Large text on the card
  Scenario: The longest question and option still fit
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the card shows the longest question in the bank
    Then the whole prompt is readable, by scrolling inside the card if needed
    And all four options are reachable
    And each option's full wording is visible, not clipped with an ellipsis
    And the page does not scroll sideways
    And every option is still at least 44 CSS px tall

  Scenario: The dyslexia-friendly font does not clip the options
    Given "setting-dyslexia-font" is on
    And text scaling is 200 %
    Then no option text overlaps another option

  Scenario: High contrast keeps the marks visible
    Given "setting-high-contrast" is on
    When I answer wrongly
    Then the tick and the cross are both visible
    And the text meets the contrast requirement against its background
```

## TN-CARD-11 — The card in French

```gherkin
Feature: The question card in French
  Background:
    Given the language is French
    And the element "question-card" is visible

  Scenario: The question and the options are French
    Then "question-progress" reads "Question 1 sur 3"
    And "question-kind" reads "Nouvelle" or "Déjà vue"
    And the prompt and all four options are the French wording of that question
    And no English word appears on the card

  Scenario: The feedback is French
    When I tap the correct option
    Then "question-feedback" reads "C'est exact!"
    And the explanation is the French explanation
    And the button reads "Suivant"

  Scenario: The correction is French
    When I tap a wrong option
    Then "question-feedback" reads "Pas tout à fait."
    And it shows "La bonne réponse est :" followed by the French wording of the correct option
    And it shows "Vous reverrez cette question bientôt."
    And the marks read "Votre réponse" and "Bonne réponse"

  Scenario: French typography is Canadian
    Then there is no space before "!" or "?" in any French string on the card
    And there is a space before ":" in "La bonne réponse est :"

  Scenario: A question with no French wording never reaches a player
    Given a question in the bank has no French prompt
    Then it is not offered in French
    And the content check has already failed the build for it

  Scenario: Switching language while a card is open
    Given the card is open in English and I have not answered
    When I change the language to French
    Then the same question is shown in French
    And the progress still reads "Question 1 sur 3"
    And no answer has been recorded
```

---

## Open questions

- **`OQ-CARD-1` — tap to answer, or select then confirm?** These scenarios answer on the first tap.
  *Recommendation:* keep it. There is no timer, so the only cost of a mis-tap is a wrong answer that the
  player will see again — and a confirm step doubles the interactions for every player, including the
  switch user. If usability testing disagrees, the change is one scenario in `TN-CARD-03`.
- **`OQ-CARD-2` — are the four options shuffled?** These scenarios use the authored order, so a test can
  name the correct option. *Recommendation:* keep the authored order in slice 1; if shuffling is wanted
  later it must use the seeded `RandomSource` so a session stays replayable, and the content agents must be
  told not to put the answer in the same position every time.
- **`OQ-CARD-3` — how does the player know how many questions are left in the level?**
  `card.progress` says "Question 1 of 3" because the quest step asks for three. In Study, the total is the
  drill size. *Recommendation:* one string, one meaning: "of" always counts the current activity, never the
  whole bank. A step resumed after a reload continues that count rather than restarting it —
  `TN-RESUME-01` asserts the card and the tracker never show two different numbers for the same step.
- **`OQ-CARD-4` — does a question ever arrive outside a quest step?** Not in these scenarios. A question
  that appears while the player is skating would be an ambush, and no scenario allows it. If the design
  wants questions at other points of interest, they arrive the same way: only on engagement.
- **`OQ-CARD-5` — what counts as "soon"?** **Answered in part, 2026-09-08.** The player is told a wrong
  question comes back soon; the scheduler decides when, and as built the shortest interval is about a
  minute, which makes the wording true. *Recommendation, unchanged:* the wording must stay true for the
  shortest interval the scheduler can produce. If FSRS is ever tuned so that a lapsed question is pushed
  days out, either this copy changes or the drill is allowed to pull it forward — and the scenarios in
  `TN-RESUME` are the ones that fail first, by design.
