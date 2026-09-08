# TN-STUDY — Study mode

**Intent.** A player who wants to practise can open Study from the menu, answer a short set of questions
chosen for them, see how they did, and go again — with no timer, no score kept and no penalty.

Study reuses the question card exactly as specified in `TN-CARD-question-card.md`. This file covers getting
into a drill, what the drill contains, and the summary at the end.

Read `README.md` in this directory first.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-STUDY-06` — *A drill from the keyboard* |
| Single switch | `TN-STUDY-07` — *A drill with one switch* |
| Screen reader | `TN-STUDY-08` — *The drill and the summary are spoken* |
| Reduced motion | `TN-STUDY-09` — *The summary appears without motion* |
| 200 % text | `TN-STUDY-10` — *The summary at 200 %* |
| Bilingual | `TN-STUDY-11` — *Study in French* |
| Failure path | `TN-STUDY-03` (nothing to review), `TN-STUDY-05` (leaving part-way) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `study.open` | Study | Réviser |
| `study.title` | Study | Révision |
| `study.intro` | Practise the questions you have seen. There is no time limit. | Exercez-vous avec les questions que vous avez déjà vues. Il n'y a aucune limite de temps. |
| `study.count` | {{n}} questions | {{n}} questions |
| `study.start` | Start | Commencer |
| `study.empty.title` | Nothing to review yet | Rien à réviser pour l'instant |
| `study.empty.body` | Play a level and answer a few questions first. | Jouez d'abord à un niveau et répondez à quelques questions. |
| `study.empty.practise` | Practise new questions | S'exercer avec de nouvelles questions |
| `study.short` | You have {{n}} questions ready. We will ask those. | Vous avez {{n}} questions prêtes. Nous poserons celles-là. |
| `study.summary.title` | Finished | Terminé |
| `study.summary.score` | You got {{correct}} out of {{total}} right. | Vous avez {{correct}} bonnes réponses sur {{total}}. |
| `study.summary.comeBack` | We will ask these again: | Nous reposerons ces questions : |
| `study.summary.allRight` | You got them all right. | Vous avez tout bon. |
| `study.again` | Study again | Réviser encore |
| `study.exit` | Back to the game | Retour au jeu |
| `study.leave` | Leave | Quitter |
| `study.leaveKept` | Your answers so far are saved. | Vos réponses sont enregistrées. |

---

## TN-STUDY-01 — Opening Study and running a drill

```gherkin
Feature: A study drill
  As a player who wants to practise
  I want a short set of questions chosen for me
  So that I can revise without playing a level

  Background:
    Given I have answered at least five questions before
    And the Ottawa level is playable

  Scenario: Study is reachable from the menu
    When I tap "menu-button"
    Then a control "Study" is visible
    And it is at least 44 CSS px wide and tall

  Scenario: The drill screen says what will happen
    When I tap "Study"
    Then the element "study-screen" is visible
    And it shows the heading "Study"
    And it shows "Practise the questions you have seen. There is no time limit."
    And it shows the number of questions in the drill
    And a button "Start" is offered

  Scenario: Starting the drill
    When I tap "study-start"
    Then the event "study/started" is emitted
    And the element "question-card" is visible
    And "question-progress" reads "Question 1 of 5"

  Scenario: The drill is the size the configuration says
    Then the number of questions asked equals the drill size in "game.config.json"

  Scenario: Answering behaves exactly as it does in a level
    When I answer a question rightly
    Then the feedback is the same as in TN-CARD-03
    When I answer a question wrongly
    Then the feedback is the same as in TN-CARD-04
    And "You will see this question again soon." is shown

  Scenario: The drill finishes with a summary
    When I answer every question in the drill
    Then the event "study/finished" is emitted
    And the element "study-summary" is visible
    And it shows "You got 4 out of 5 right." when four of five were right

  Scenario: Study earns no stamp and changes no level
    When the drill finishes
    Then no "stamp/earned" event is emitted
    And no quest step changes
```

## TN-STUDY-02 — What the drill contains

```gherkin
Feature: Choosing the questions in a drill
  Scenario: Questions I got wrong come first
    Given I answered question A wrongly and questions B and C rightly
    When I start a drill
    Then question A is asked before question B and before question C

  Scenario: No question is asked twice in one drill
    When I run a drill of five questions
    Then five different questions are asked

  Scenario: New questions are introduced, but not all at once
    Given I have never seen most of the bank
    When I run a drill
    Then the number of questions I have never seen is at most the daily limit in "game.config.json"

  Scenario: A drill can be shorter than the drill size
    Given only three questions are ready for me
    When I open Study
    Then it shows "You have 3 questions ready. We will ask those."
    And the drill asks three questions
    And no question is repeated to pad the drill

  Scenario: Two drills in a row do not repeat the same questions
    Given I have just finished a drill
    When I tap "Study again"
    Then no question from the previous drill is asked again, unless fewer questions are ready than the drill size

  Scenario: The player is never told how the choice was made
    Then no string on "study-screen" or "study-summary" contains "spaced repetition", "FSRS", "algorithm", "interval" or "due"
```

## TN-STUDY-03 — Nothing to review yet (failure path)

```gherkin
Feature: An empty Study screen
  Scenario: A brand-new player opens Study
    Given I have never answered a question
    When I open Study
    Then the element "study-empty" is visible
    And it shows "Nothing to review yet"
    And it shows "Play a level and answer a few questions first."
    And a button "Practise new questions" is offered
    And no empty question card is shown

  Scenario: Practising anyway
    When I tap "Practise new questions"
    Then a drill starts using questions from this level's subject
    And the event "study/started" is emitted

  Scenario: The question bank cannot be loaded
    Given the question bank fails to load
    When I open Study
    Then a message explains that the questions could not be loaded
    And a "Try again" button is offered
    And the message is announced in "#tn-live-region"
    And no blank drill is started

  Scenario: An answer cannot be saved during a drill
    Given writing to local storage fails
    When I answer a question in a drill
    Then the drill continues
    And the warning "storage-warning" is visible
    And the event "progress/save-failed" is emitted
```

## TN-STUDY-04 — The summary

```gherkin
Feature: The end of a drill
  Background:
    Given I have finished a drill of five questions

  Scenario: The summary says how it went, plainly
    Then "study-summary" shows "Finished"
    And it shows "You got 4 out of 5 right." when four were right
    And no percentage, grade, streak or star rating is shown

  Scenario: The summary names what is coming back
    Then it shows "We will ask these again:" followed by the questions I got wrong
    And each is shown by its question wording, not by an id

  Scenario: A clean sweep is said out loud
    Given every answer was right
    Then it shows "You got them all right."
    And the "We will ask these again:" list is not shown

  Scenario: Going again, or going back
    Then buttons "Study again" and "Back to the game" are offered
    When I tap "Study again"
    Then a new drill starts
    When I tap "Back to the game"
    Then the element "study-summary" is gone
    And the element "playable" accepts input again
    And "data-paused" is "false"

  Scenario: The result is not a score that follows the player
    When I return to the game
    Then no score from the drill is shown in the HUD
    And no stamp, level or quest changed because of the drill
```

## TN-STUDY-05 — Leaving part-way (failure path)

```gherkin
Feature: Leaving a drill
  Background:
    Given I am on question 3 of a drill of five

  Scenario: Leaving keeps the answers already given
    When I tap "Leave"
    Then a message says "Your answers so far are saved."
    And the event "study/finished" is emitted with the questions answered so far
    And the element "playable" accepts input again

  Scenario: The answers really were kept
    Given I answered question A wrongly before leaving
    When I start a new drill
    Then question A is offered
    And it is not treated as never seen

  Scenario: An unanswered question is not counted
    Given question C was on screen when I left
    Then question C is not recorded as right or wrong
    And question C may be asked again in the next drill

  Scenario: Closing the tab part-way is the same as leaving
    When I close the tab during question 3
    And I open the game again
    Then no drill is in progress
    And the two answers I gave are still recorded
```

## TN-STUDY-06 — A drill from the keyboard

```gherkin
Feature: Keyboard-only Study
  Background:
    Given I am using a keyboard only

  Scenario: Reaching Study
    When I press "Tab" until focus is on "menu-button" and press "Enter"
    Then focus moves into the menu
    When I press "Tab" until focus is on "Study" and press "Enter"
    Then the element "study-screen" is visible
    And focus is inside it

  Scenario: Running the whole drill
    When I press "Enter" on "study-start"
    And I answer every question with "Tab" and "Enter"
    Then the element "study-summary" is visible
    And focus moves to the summary

  Scenario: Escape leaves the drill, not the game
    When I press "Escape" during a question
    Then the leaving message is shown
    And focus returns to the control that opened Study

  Scenario: Focus never falls to the body
    When I move through Study, a question and the summary
    Then focus is inside a named region at every step
```

## TN-STUDY-07 — A drill with one switch

```gherkin
Feature: Single-switch Study
  Background:
    Given single-switch mode is on

  Scenario: Reaching and starting a drill
    When I use only short and long presses
    Then I can open the menu, choose "Study" and start the drill

  Scenario: Answering and finishing
    When I use only short and long presses
    Then I can answer every question and reach "study-summary"
    And I can choose "Study again" or "Back to the game"

  Scenario: Nothing advances by itself
    When I do nothing for two minutes during a question
    Then the question is unchanged
    And no answer has been submitted
```

## TN-STUDY-08 — The drill and the summary are spoken

```gherkin
Feature: Study with a screen reader
  Scenario: The Study screen is named
    When "study-screen" opens
    Then it has an accessible name that is not empty
    And the number of questions is text, not only a picture

  Scenario: Starting is announced
    When the drill starts
    Then "#tn-live-region" reads a message naming the drill and the number of questions

  Scenario: Progress is announced between questions
    When I move to the next question
    Then "#tn-live-region" reads "Question 2 of 5"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The summary is read
    When the drill finishes
    Then focus moves to "study-summary"
    And its first line reads "You got 4 out of 5 right."
    And the list of returning questions is a list in the accessibility tree
```

## TN-STUDY-09 — The summary appears without motion

```gherkin
Feature: Reduced motion in Study
  Given reduced motion is on

  Scenario: No animation anywhere in the drill
    When a drill runs from start to summary
    Then no card slides, scales, shakes or flashes
    And no particle or confetti is drawn on the summary

  Scenario: The result is still obvious
    Then the number right is shown as text
    And the returning questions are listed as text
```

## TN-STUDY-10 — The summary at 200 %

```gherkin
Feature: Large text in Study
  Scenario: Everything fits or scrolls
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When "study-summary" is visible after a drill of five
    Then the score line is fully visible
    And the list of returning questions can be read by scrolling down inside the summary
    And "Study again" and "Back to the game" are both reachable and at least 44 CSS px tall
    And the page does not scroll sideways
```

## TN-STUDY-11 — Study in French

```gherkin
Feature: Study in French
  Background:
    Given the language is French

  Scenario: The Study screen is French
    When I open Study
    Then the menu control reads "Réviser"
    And the heading reads "Révision"
    And the body reads "Exercez-vous avec les questions que vous avez déjà vues. Il n'y a aucune limite de temps."
    And the button reads "Commencer"

  Scenario: The empty state is French
    Given I have never answered a question
    When I open Study
    Then it shows "Rien à réviser pour l'instant"
    And it shows "Jouez d'abord à un niveau et répondez à quelques questions."
    And the button reads "S'exercer avec de nouvelles questions"

  Scenario: The summary is French
    When I finish a drill with four right out of five
    Then it shows "Terminé"
    And it shows "Vous avez 4 bonnes réponses sur 5."
    And it shows "Nous reposerons ces questions :"
    And the buttons read "Réviser encore" and "Retour au jeu"

  Scenario: The questions are the French ones
    Then every prompt, option and explanation in the drill is French
    And no English word appears in "study-screen", the card or "study-summary"

  Scenario: Switching language between drills
    Given I finished a drill in English
    When I change the language to French and tap "Réviser encore"
    Then the new drill is French
    And the questions chosen are the same ones the English drill would have chosen
```

---

## Open questions

- **`OQ-STUDY-1` — how big is a drill, and where is that written?** These scenarios read a drill size from
  `game.config.json`, which has no such field today (`scheduler` has `exclusionWindow`, `wrongWeight` and
  `dailyNewLimit`). *Recommendation:* task 1.2 adds `study.drillSize`, default 5. Without it, `TN-STUDY-01`
  has nothing to assert against.
- **`OQ-STUDY-2` — can the player choose a subject to study?** Not in these scenarios; the drill is chosen
  for them. *Recommendation:* leave subject choice to a later slice, when there is more than one subject.
- **`OQ-STUDY-3` — where is Study reached from?** These scenarios use the in-level menu, because that is the
  only shell slice 1 has. *Recommendation:* the same control moves to the world map when the map exists;
  the story is unchanged.
- **`OQ-STUDY-4` — does the summary list every missed question, or only some?** Listing all of them is fine
  at five, and wrong at twenty (Exam mode, later). *Recommendation:* list all missed questions in a drill,
  and revisit for Exam mode in slice F1.
- **`OQ-STUDY-5` — should a drill in progress survive a closed tab?** `TN-STUDY-05` and `TN-SAVE` both say
  no: the answers survive, the drill does not. *Recommendation:* keep it. Resuming a drill means persisting
  transient state for no learning benefit.
