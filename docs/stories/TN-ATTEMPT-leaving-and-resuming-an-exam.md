# TN-ATTEMPT — Leaving an exam, closing the tab, and finishing it later

**Intent.** A player who is halfway through twenty questions can stop — on purpose, or because a phone rang,
or because the browser threw the tab away — and come back to the same exam, with the same questions, the same
answers and the same time left.

Read `README.md` in this directory first. `TN-EXAM-starting-and-answering.md` owns the exam,
`TN-TIMER-the-exam-clock.md` owns the clock, `TN-RESULT-exam-results.md` owns the result, and
`TN-SAVE-save-and-reload.md` owns the survives table this file adds a row to.

## The decision — an exam survives a closed tab, and a drill does not

`TN-SAVE`'s second table says a drill in progress does not survive, and `OQ-STUDY-5` explains why: resuming a
drill means persisting transient state for no learning benefit, because everything a drill teaches — the
answers — is already saved. `OQ-RESUME-3` then recommended, in one line and without a story to argue it in,
that **an exam in progress is not resumable at all**. This file takes the other answer, and says why, because
inheriting a recommendation by silence is exactly what that question asked not to happen.

| | A drill | An exam |
|---|---|---|
| What the player came for | Practice. Every answer is its own reward and is saved as it is given | **The result.** It does not exist until all twenty questions have been reached |
| What is lost if the tab dies | Nothing. The answers are saved; a new drill is one tap | **Up to nineteen answers and half an hour**, none of which can be redone, because a new exam is a new draw |
| Who it happens to | Anybody, rarely | Disproportionately the player who takes longest: 200 % text, one switch, a screen reader, a phone whose browser discards background tabs |
| Cost of keeping it | Transient state for no benefit | The draw, the answers and the time left — **state a result already needs anyway** |

The last cell is what settles it. **Results by subject cannot be computed from `correctCount`**
(`OQ-RESULT-1`), so the saved attempt has to carry per-question answers whatever this file decides. Once it
does, resuming costs one nullable field for the remaining time. The expensive half was already required, and
the cheap half is what stops a discarded tab destroying a player's afternoon.

**What it costs, stated plainly.** A player can stretch a thirty-minute exam over a week by closing the tab
(`OQ-TIMER-2` records that, and there is nobody to cheat: no accounts, no server, no leaderboard). And there
is one more saved thing to migrate, one more failure path when the questions in a saved attempt leave the
build (`TN-ATTEMPT-05`), and one destructive confirmation in the game where there were none.

## What survives, and what does not

| Survives | Player sees |
|---|---|
| The twenty questions drawn, in the order they were drawn | The same exam, the same questions, in the same order |
| Every answer given, and which questions were skipped | The options they chose are still chosen |
| Whether the timer was on, and how much time was left | The clock carries on from where it stopped, paused |

| Does not survive | What happens instead |
|---|---|
| Which question was on screen | The exam opens at the first question with no answer; if every question has an answer, at the last one |
| The single-switch highlight position | Starts at the first item (`TN-SAVE`) |
| Whether the clock was paused by a menu | The clock is always paused on return, until the player carries on |

**At most one exam is unfinished at a time.** Starting a new one while an unfinished exam exists is the only
destructive confirmation in this game, and `TN-ATTEMPT-04` is where it lives.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-ATTEMPT-06` |
| Single switch | `TN-ATTEMPT-07` |
| Screen reader | `TN-ATTEMPT-08` |
| Reduced motion | `TN-ATTEMPT-09` |
| 200 % text | `TN-ATTEMPT-09` |
| Bilingual | `TN-ATTEMPT-10` |
| Failure path | `TN-ATTEMPT-05` (the exam cannot be kept, or cannot be read back), `TN-ATTEMPT-04` (starting a new one over it) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `exam.leave` | Leave the exam | Quitter l'examen |
| `exam.leave.kept` | Your exam is saved. You can finish it later. | Votre examen est enregistré. Vous pourrez le terminer plus tard. |
| `exam.leave.notKept` | This browser is not saving your progress, so leaving will end this exam. | Ce navigateur n'enregistre pas votre progression : quitter mettra fin à cet examen. |
| `exam.leave.confirm` | Leave and lose this exam? | Quitter et perdre cet examen? |
| `exam.leave.stay` | Keep going | Continuer l'examen |
| `exam.resume` | Finish your exam | Terminer votre examen |
| `exam.resume.title` | You have an exam to finish | Vous avez un examen à terminer |
| `exam.resume.continue` | Carry on | Reprendre |
| `exam.new` | Start a new exam | Commencer un nouvel examen |
| `exam.new.confirm` | Your unfinished exam will be gone. Start a new one? | Votre examen non terminé sera supprimé. En commencer un nouveau? |
| `exam.new.keep` | Keep the one I have | Garder celui que j'ai |
| `exam.gone.title` | We could not open your exam | Nous n'avons pas pu ouvrir votre examen |
| `exam.gone.body` | Some of its questions are not in this version. You can start a new exam. | Certaines de ses questions ne sont pas dans cette version. Vous pouvez commencer un nouvel examen. |

Keys this file draws and does not own: `exam.answered`, `exam.open`, `exam.title`, `exam.start` and
`exam.rules.*` (`TN-EXAM`), `exam.timer.*` (`TN-TIMER`), `storage.warning` and `storage.warning.help`
(`TN-SAVE`), `common.back` and `common.close`.

**`exam.resume.continue` is « Reprendre » and not « Continuer »**, even though `title.continue` is
« Continuer » and means something similar. Two controls that both read « Continuer » on two screens a player
reaches in the same minute is how a player learns to stop reading them. `TN-TITLE` keeps its word; this
screen takes the one that means "pick this up again".

---

## TN-ATTEMPT-01 — Leaving an exam on purpose

```gherkin
Feature: Stopping an exam without losing it
  As a player who has to stop
  I want to leave without throwing away what I have answered
  So that stopping costs me nothing

  Background:
    Given an exam of 20 questions is running
    And I have answered 12 of them

  Scenario: Leaving is reachable from inside the exam
    When I open the exam's menu
    Then a control "Leave the exam" is offered
    And it is at least 44 CSS px wide and tall

  Scenario: Leaving keeps the exam and says so
    When I choose "Leave the exam"
    Then the event "exam/left" is emitted
    And the event "progress/saved" is emitted
    And a message says "Your exam is saved. You can finish it later."
    And the element "title-screen" is visible
    And the element "exam-screen" is not present

  Scenario: Leaving asks nothing, because nothing is lost
    When I choose "Leave the exam"
    Then no confirmation is shown
    And every answer I gave is still recorded

  Scenario: Leaving does not finish the exam
    Then no "exam/finished" event is emitted
    And no result is shown
    And no attempt is recorded as passed or not passed

  Scenario: The clock stops when I leave
    Given the timer was on with 14 minutes left
    When I leave the exam
    Then no time passes while I am away
    And the exam still has 14 minutes left when I come back

  Scenario: Leaving with nothing answered still keeps the exam
    Given I have answered none of the 20 questions
    When I leave the exam
    Then the exam is kept, with its twenty questions in their order
    And coming back opens it at question 1
```

## TN-ATTEMPT-02 — Closing the tab in the middle of an exam

```gherkin
Feature: The tab closes and the exam does not
  Background:
    Given an exam of 20 questions is running
    And I have answered questions 1 to 12
    And I skipped question 5

  Scenario: The whole attempt comes back
    When I close the tab and open the game again
    Then the event "progress/loaded" is emitted
    And the same twenty questions are in the exam, in the same order
    And the eleven answers I gave are still recorded, each with the option I chose
    And question 5 is still unanswered

  Scenario: It opens where I would want it to
    When I carry on with the exam
    Then question 5 is shown, because it is the first question with no answer
    And "question-progress" reads "Question 5 of 20"

  Scenario: When everything is answered it opens at the end
    Given I had answered all 20 questions before the tab closed
    When I carry on
    Then question 20 is shown
    And "exam-finish" is offered

  Scenario: A timed exam comes back with its time, and paused
    Given the timer was on with 14 minutes left when the tab closed
    And two days have passed
    When I carry on
    Then the clock reads "14 minutes left"
    And it was paused until I carried on
    And no time was taken while the game was closed

  Scenario: The exam is not redrawn
    Then no question in the exam is different from before
    And the draw is not repeated, even if the question bank has grown

  Scenario: An answer given a moment before the tab closed is kept
    Given I answered question 12 and the tab closed within one second
    Then that answer is recorded
    And "exam-progress" shows "Answers given: 12 of 20"

  Scenario: The exam does not open by itself
    When I open the game again
    Then the element "title-screen" is visible
    And no exam is running
    And nothing has been answered or finished for me
```

## TN-ATTEMPT-03 — Coming back to an unfinished exam

```gherkin
Feature: Picking the exam back up
  Background:
    Given I have an unfinished exam with 12 of 20 answered
    And the element "title-screen" is visible

  Scenario: The way in says there is something to finish
    Then "title-exam" reads "Finish your exam"
    And it does not read "Practice exam"
    And it is a control, not a message

  Scenario: The start screen shows the exam I have, not a new one
    When I tap "title-exam"
    Then the element "exam-resume" is visible
    And it shows "You have an exam to finish"
    And it shows "Answers given: 12 of 20"
    And controls "Carry on" and "Start a new exam" are offered
    And "Start the exam" is not offered

  Scenario: A timed exam says how much time is left before I carry on
    Given the timer was on with 14 minutes left
    Then it shows "14 minutes left"
    And the clock is not running while I read the screen

  Scenario: Carrying on
    When I tap "Carry on"
    Then the event "exam/resumed" is emitted
    And the exam opens at the first question with no answer
    And my twelve answers are still there
    And the clock, if any, starts again from where it stopped

  Scenario: An unfinished exam does not nag
    Then no message appears anywhere else in the game about the unfinished exam
    And no level, the level select or Study is changed by having one
    And nothing counts down towards losing it
```

## TN-ATTEMPT-04 — Starting a new exam over an unfinished one

```gherkin
Feature: The one destructive choice in this game
  Background:
    Given I have an unfinished exam with 12 of 20 answered
    And the element "exam-resume" is visible

  Scenario: Starting a new one asks first
    When I tap "Start a new exam"
    Then a confirmation is shown
    And it asks "Your unfinished exam will be gone. Start a new one?"
    And it offers "Start a new exam" and "Keep the one I have"
    And no exam has been started or discarded yet

  Scenario: Saying no changes nothing
    When I choose "Keep the one I have"
    Then the confirmation closes
    And "exam-resume" is visible with "Answers given: 12 of 20"
    And my twelve answers are still recorded

  Scenario: Saying yes discards the old exam and starts a new one
    When I choose "Start a new exam"
    Then the event "exam/discarded" is emitted
    And the element "exam-start" is visible, with the timer choice offered again
    And the unfinished attempt is no longer in the saved document
    And starting the new exam draws twenty questions again

  Scenario: The answers I gave are not thrown away as learning
    Given I answered question A wrongly in the discarded exam
    When I run a Study drill afterwards
    Then A is in the drill
    And discarding the exam discarded the attempt, not what it taught the game about me

  Scenario: Only one exam is ever unfinished
    Then the saved document holds at most one attempt with no finish time
    And a document holding two fails the save schema check
```

## TN-ATTEMPT-05 — The exam cannot be kept, or cannot be read back (failure path)

```gherkin
Feature: When the attempt cannot survive
  Scenario: Storage is blocked, so the promise changes
    Given local storage cannot be written
    And an exam is running
    Then "storage-warning" is visible
    And the exam's menu shows "This browser is not saving your progress, so leaving will end this exam."
    And it does not show "Your exam is saved. You can finish it later."

  Scenario: Leaving when it cannot be kept asks first
    Given local storage cannot be written
    When I choose "Leave the exam"
    Then a confirmation asks "Leave and lose this exam?"
    And it offers "Leave the exam" and "Keep going"
    And choosing "Keep going" returns me to the question I was on

  Scenario: A confirmation appears only when there is something to lose
    Given local storage works
    When I choose "Leave the exam"
    Then no confirmation is shown
    And this is the only difference between the two cases

  Scenario: A saved exam names questions this build does not have
    Given my unfinished exam names a question with no document in this build
    When I open "title-exam"
    Then it shows "We could not open your exam"
    And it shows "Some of its questions are not in this version. You can start a new exam."
    And a control starts a new exam
    And no error screen, warning triangle or red state is drawn
    And nothing on the screen blames me

  Scenario: An unreadable attempt does not cost me anything else
    Then every other item of my progress is intact
    And my finished attempts are still in the passport
    And the unfinished attempt is dropped from the saved document only when I start a new exam

  Scenario: A saved attempt that is not valid is not half-loaded
    Given the saved document holds an attempt that does not validate
    When I open the game
    Then the failure described in TN-SAVE-04 is shown
    And no exam is started from a partly-read attempt
```

## TN-ATTEMPT-06 — Leaving and resuming from the keyboard

```gherkin
Feature: Keyboard-only
  Background:
    Given I am using a keyboard only

  Scenario: Leaving with the keyboard
    Given an exam is running
    When I open the exam's menu and activate "Leave the exam"
    Then the title screen is visible
    And focus is on "title-exam"

  Scenario: Coming back with the keyboard
    Given I have an unfinished exam
    When I press "Tab" until focus is on "title-exam" and press "Enter"
    Then "exam-resume" is visible and focus is inside it
    And "Carry on" is the first control in reading order

  Scenario: The destructive confirmation is operable and cancellable
    When I activate "Start a new exam"
    Then focus moves into the confirmation
    And "Escape" cancels it
    And cancelling returns focus to "Start a new exam"
    And nothing was discarded
```

## TN-ATTEMPT-07 — Leaving and resuming with one switch

```gherkin
Feature: Single-switch
  Background:
    Given single-switch mode is on

  Scenario: The whole round trip works with two gestures
    Given an exam is running
    When I use only short and long presses
    Then I can leave the exam, reach the title screen, come back and carry on

  Scenario: Nothing is discarded for the player
    Given the confirmation in TN-ATTEMPT-04 is open
    When I do nothing for two minutes
    Then nothing has been confirmed or cancelled
    And the highlight has not moved

  Scenario: The highlight starts at the first item on return
    When I carry on with an exam
    Then the highlight is on the first option of the question shown
    And nothing has been chosen for me
```

## TN-ATTEMPT-08 — Leaving and resuming with a screen reader

```gherkin
Feature: Announcing what happened to the exam
  Scenario: Leaving is announced with what it means
    When I leave the exam
    Then "#tn-live-region" reads "Your exam is saved. You can finish it later."
    And it is read once

  Scenario: Coming back is announced
    Given I have an unfinished exam
    When I open the game and reach "exam-resume"
    Then "#tn-live-region" reads the screen's name and how many answers I have given
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The destructive confirmation says what it destroys
    When the confirmation opens
    Then it has role "alertdialog" with an accessible name and description
    And its description says the unfinished exam will be gone
    And focus moves into it

  Scenario: Resuming says where I have landed
    When I carry on
    Then "#tn-live-region" reads the question number I have landed on
    And it does not read the whole exam back to me
```

## TN-ATTEMPT-09 — Reduced motion and 200 % text

```gherkin
Feature: The resume screens honour the settings
  Scenario: Reduced motion
    Given reduced motion is on
    When "exam-resume" or a confirmation opens
    Then it appears with no slide, fade or scale
    And nothing about the kept exam animates

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "You have an exam to finish" is visible
    And "Answers given: 12 of 20" is fully visible
    And "Carry on" and "Start a new exam" are both fully visible and at least 44 CSS px tall
    And the page does not scroll sideways

  Scenario: The French confirmation fits
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Votre examen non terminé sera supprimé. En commencer un nouveau?" is readable,
      by scrolling inside the dialog if needed
    And both buttons are fully visible
```

## TN-ATTEMPT-10 — Leaving and resuming in French

```gherkin
Feature: In French
  Background:
    Given the language is French

  Scenario: Leaving is French
    Given an exam is running
    When I open the exam's menu
    Then it shows "Quitter l'examen"
    When I choose it
    Then the message reads "Votre examen est enregistré. Vous pourrez le terminer plus tard."

  Scenario: The way back is French
    Given I have an unfinished exam with 12 of 20 answered
    Then "title-exam" reads "Terminer votre examen"
    When I tap it
    Then it shows "Vous avez un examen à terminer"
    And it shows "Réponses données : 12 sur 20"
    And the controls read "Reprendre" and "Commencer un nouvel examen"
    And there is a space before the colon

  Scenario: The destructive confirmation is French, with no space before the question mark
    When I tap "Commencer un nouvel examen"
    Then it asks "Votre examen non terminé sera supprimé. En commencer un nouveau?"
    And there is no space before the question mark
    And the buttons read "Commencer un nouvel examen" and "Garder celui que j'ai"

  Scenario: The blocked-storage sentences are French
    Given local storage cannot be written
    Then the exam's menu shows "Ce navigateur n'enregistre pas votre progression : quitter mettra fin à cet examen."
    And leaving asks "Quitter et perdre cet examen?"
    And the buttons read "Quitter l'examen" and "Continuer l'examen"

  Scenario: The unreadable-exam message is French
    Given my unfinished exam names a question this build does not have
    Then it shows "Nous n'avons pas pu ouvrir votre examen"
    And it shows "Certaines de ses questions ne sont pas dans cette version. Vous pouvez commencer un nouvel examen."

  Scenario: An exam started in one language finishes in the other
    Given I answered 12 questions with the game in English
    When I open the game again in French and carry on
    Then the same twenty questions are in the exam
    And each is shown in its French wording
    And my twelve answers are still recorded
    And "exam-progress" reads "Réponses données : 12 sur 20"

  Scenario: No French string here needs gender agreement
    Then no string in "exam-resume" or its confirmations contains "(e)", "·e" or a bracketed ending
```

---

## Open questions

- **`OQ-ATTEMPT-1` — this decision overrides `OQ-RESUME-3`, which recommended the opposite.**
  `TN-RESUME-questions-after-a-reload.md` said "an exam in progress is not resumable at all, so the seam does
  not exist there", and asked that Exam mode say so explicitly rather than inherit by silence. It says the
  opposite explicitly, and the reasoning and its cost are at the top of this file. `TN-RESUME` has been
  amended to point here. If the project owner prefers the simpler rule, what changes is this file and the
  `remainingSeconds` field — the per-question `answers` array stays, because `TN-RESULT` needs it either way.
- **`OQ-ATTEMPT-2` — does an unfinished exam expire?** Nothing in this file expires it: an exam left in
  October can be finished in March. An expiry would be a timer the player can lose to, running while the game
  is closed, which is the one thing `TN-TIMER` is written to prevent. *Recommendation:* no expiry. If the
  question bank changes so much that the attempt cannot be read, `TN-ATTEMPT-05` already handles it, and that
  is a real reason rather than an arbitrary one.
- **`OQ-ATTEMPT-3` — should "Leave the exam" appear anywhere except the exam's own menu?** A player who wants
  out and cannot find the menu has no other route, and the exam is not a level so the browser's back button
  is the only alternative, which this game must not depend on (`TN-FLOW-03`). *Recommendation:* the exam's
  menu is enough, provided the menu control is visible on the exam screen at all times and is not itself
  behind a gesture — which `TN-EXAM-01`'s one-thumb scenario already requires.
- **`OQ-ATTEMPT-4` — where does the unfinished exam live on the title screen?** These scenarios reuse
  `title-exam` and change its label, so the screen never grows a sixth item and a player never sees two exam
  controls. *Recommendation:* keep one control. `OQ-EXAM-7` is the related question — whether the exam item
  is shown at all before the first level has been played — and an unfinished exam must make the control
  appear whatever that answer is, because a player cannot be left holding an exam they cannot reach.
- **`OQ-ATTEMPT-5` — is one unfinished exam the right limit?** Yes, and `TN-ATTEMPT-04` asserts it. More than
  one means a list, a chooser and a way to end up with six abandoned exams and no idea which is which.
  *Recommendation:* keep the limit, and keep the confirmation that enforces it as the only destructive dialog
  in the game.
