# TN-STUDY — Study mode

**Intent.** A player who wants to practise can open Study from the menu, answer a short set of questions
chosen for them, see how they did, and go again — with no timer, no score kept and no penalty.

Study reuses the question card exactly as specified in `TN-CARD-question-card.md`. This file covers getting
into a drill, what the drill contains, and the summary at the end.

Read `README.md` in this directory first. Every count on this screen follows the plural rule in
`TN-COPY-strings-and-counts.md`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-STUDY-06` — *A drill from the keyboard*; `TN-STUDY-03` for the load-failure message |
| Single switch | `TN-STUDY-07` — *A drill with one switch*; `TN-STUDY-03` for the load-failure message |
| Screen reader | `TN-STUDY-08` — *The drill and the summary are spoken* |
| Reduced motion | `TN-STUDY-09` — *The summary appears without motion* |
| 200 % text | `TN-STUDY-10` — *The summary at 200 %* |
| Bilingual | `TN-STUDY-11` — *Study in French* |
| Failure path | `TN-STUDY-03` (nothing to review, and the questions will not load), `TN-STUDY-05` (leaving part-way) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `study.open` | Study | Réviser |
| `study.title` | Study | Révision |
| `study.intro` | Practise the questions you have seen. There is no time limit. | Exercez-vous avec les questions que vous avez déjà vues. Il n'y a aucune limite de temps. |
| `study.count.one` | {{n}} question | {{n}} question |
| `study.count.other` | {{n}} questions | {{n}} questions |
| `study.start` | Start | Commencer |
| `study.empty.title` | Nothing to review yet | Rien à réviser pour l'instant |
| `study.empty.body` | Play a level and answer a few questions first. | Jouez d'abord à un niveau et répondez à quelques questions. |
| `study.empty.practise` | Practise new questions | S'exercer avec de nouvelles questions |
| `study.short.one` | You have {{n}} question ready. We will ask it. | Vous avez {{n}} question prête. Nous poserons celle-là. |
| `study.short.other` | You have {{n}} questions ready. We will ask those. | Vous avez {{n}} questions prêtes. Nous poserons celles-là. |
| `study.error` | We could not load the questions. Check your connection and try again. | Nous n'avons pas pu charger les questions. Vérifiez votre connexion et réessayez. |
| `study.error.retry` | Try again | Réessayer |
| `study.summary.title` | Finished | Terminé |
| `study.summary.score` | You got {{correct}} out of {{total}} right. | Vous avez {{correct}} bonnes réponses sur {{total}}. |
| `study.summary.comeBack` | We will ask these again: | Nous reposerons ces questions : |
| `study.summary.allRight` | You got them all right. | Vous avez tout bon. |
| `study.again` | Study again | Réviser encore |
| `study.exit` | Back to the game | Retour au jeu |
| `study.leave` | Leave | Quitter |
| `study.leaveKept` | Your answers so far are saved. | Vos réponses sont enregistrées. |

`study.count` and `study.short` are two rows each because one row draws "1 questions" — see
`TN-COPY-strings-and-counts.md` for the rule and for why English and French need the same mechanism and not
the same condition. `study.error` deliberately mirrors `level.error.title` and `level.error.body` in
`TN-LEVEL-ottawa.md`: the same failure said the same way, so the player learns one sentence, not two.
`study.error.retry` is the same two words as `level.error.retry` and a separate key, so the two screens can
be reworded independently.

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
    And the element "study-count" shows the number of questions in the drill
    And a button "Start" is offered

  Scenario: The count reads correctly at one and at many
    Given exactly one question is ready for me
    Then "study-count" reads "1 question"
    Given five questions are ready for me
    Then "study-count" reads "5 questions"

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

  Scenario: A drill of exactly one reads as one
    Given only one question is ready for me
    When I open Study
    Then it shows "You have 1 question ready. We will ask it."
    And the drill asks one question

  Scenario: Two drills in a row do not repeat the same questions
    Given I have just finished a drill
    When I tap "Study again"
    Then no question from the previous drill is asked again, unless fewer questions are ready than the drill size

  Scenario: The player is never told how the choice was made
    Then no string on "study-screen" or "study-summary" contains "spaced repetition", "FSRS", "algorithm", "interval" or "due"
```

## TN-STUDY-03 — Nothing to review yet, and questions that will not load (failure path)

```gherkin
Feature: An empty or broken Study screen
  Scenario: A brand-new player opens Study
    Given I have never answered a question
    When I open Study
    Then the element "study-empty" is visible
    And it shows "Nothing to review yet"
    And it shows "Play a level and answer a few questions first."
    And a button "Practise new questions" is offered
    And no empty question card is shown
    And no count is drawn, so "0 questions" is never on screen

  Scenario: Practising anyway
    When I tap "Practise new questions"
    Then a drill starts using questions from this level's subject
    And the event "study/started" is emitted

  Scenario: The question bank cannot be loaded
    Given the question bank fails to load
    When I open Study
    Then the element "study-error" is visible
    And it says "We could not load the questions. Check your connection and try again."
    And a button "Try again" is offered as "study-retry"
    And the message is announced in "#tn-live-region"
    And no blank drill is started
    And "study-start" is not offered

  Scenario: Trying again after the questions come back
    Given the element "study-error" is visible
    And the question bank now loads
    When I tap "Try again"
    Then the element "study-error" is gone
    And the element "study-screen" shows the drill and "Start"

  Scenario: Trying again while it is still broken says the same thing once
    Given the element "study-error" is visible
    When I tap "Try again" and the question bank fails again
    Then the same message is shown
    And it is announced again in "#tn-live-region"
    And no second error is stacked on the first

  Scenario: The player can always leave the failure
    Given the element "study-error" is visible
    Then a control returns me to the game
    And "data-paused" becomes "false" when I take it
    And nothing on the screen counts down

  Scenario: The failure is operable from the keyboard
    Given I am using a keyboard only
    And the element "study-error" is visible
    Then focus is inside "study-screen" when the message appears
    And "Try again" is reachable with "Tab" and activates with "Enter"
    And "Escape" returns me to the game

  Scenario: The failure is operable with one switch
    Given single-switch mode is on
    And the element "study-error" is visible
    When I use only short and long presses
    Then I can reach and choose "Try again"
    And I can leave Study

  Scenario: The failure does not animate
    Given reduced motion is on
    When the message appears
    Then it appears with no slide, fade or shake

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
    And the number is read in the same singular or plural form that is drawn

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

  Scenario: The failure message fits too
    Given text scaling is 200 %
    And the element "study-error" is visible
    Then the whole message is readable, by scrolling inside "study-screen" if needed
    And "Try again" is fully visible and at least 44 CSS px tall
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

  Scenario: The count is French and reads correctly at one
    Given exactly one question is ready for me
    Then "study-count" reads "1 question"
    Given five questions are ready for me
    Then "study-count" reads "5 questions"

  Scenario: The empty state is French
    Given I have never answered a question
    When I open Study
    Then it shows "Rien à réviser pour l'instant"
    And it shows "Jouez d'abord à un niveau et répondez à quelques questions."
    And the button reads "S'exercer avec de nouvelles questions"

  Scenario: The load failure is French
    Given the question bank fails to load
    When I open Study
    Then "study-error" says "Nous n'avons pas pu charger les questions. Vérifiez votre connexion et réessayez."
    And the button reads "Réessayer"
    And the message is announced in "#tn-live-region" with "lang" equal to "fr"

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
  only shell slice 1 has, and that menu is now owned by `TN-HUD-hud-and-menu.md`. *Recommendation:* the same
  control moves to the world map when the map exists; the story is unchanged.
- **`OQ-STUDY-4` — does the summary list every missed question, or only some?** Listing all of them is fine
  at five, and wrong at twenty (Exam mode, later). *Recommendation:* list all missed questions in a drill,
  and revisit for Exam mode in slice F1.
- **`OQ-STUDY-5` — should a drill in progress survive a closed tab?** `TN-STUDY-05` and `TN-SAVE` both say
  no: the answers survive, the drill does not. *Recommendation:* keep it. Resuming a drill means persisting
  transient state for no learning benefit.
- **`OQ-STUDY-6` — does a failed load distinguish "offline" from "the file is broken"?** `study.error` says
  one thing for both, because the player's action is the same either way and a player cannot fix a corrupt
  bundle. *Recommendation:* keep one message; if telemetry ever existed it would tell us the difference, and
  this game has none by decision (CLAUDE.md, Storage).
