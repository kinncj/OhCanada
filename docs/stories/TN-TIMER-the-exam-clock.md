# TN-TIMER — The exam clock: the one timer this game is allowed

**Intent.** A player who wants to practise under the real test's time limit can turn a clock on, see how much
time is left without being nagged by it, stop it at any moment, and never lose time to anything except
answering questions.

`CLAUDE.md` says two things about this clock and they pull against each other on purpose:

> Timer only in Exam mode, and optional.

> No timers outside Exam mode. […] Accessibility is a requirement, not a feature.

This file resolves them. **The clock is the single exception to the no-timers rule, it exists only inside a
practice exam, it exists only when the player turned it on for that attempt, and it may be turned off at any
moment including mid-exam.** Everything else in the game — the single-switch highlight, dialogue, question
cards, menus, load screens — still counts down never, and `TN-TIMER-07` is the check that keeps that true by
what the code cannot contain rather than by waiting and hoping.

Read `README.md` in this directory first. `TN-EXAM-starting-and-answering.md` owns the exam this clock sits
in; `TN-RESULT-exam-results.md` owns what the result says about it;
`TN-ATTEMPT-leaving-and-resuming-an-exam.md` owns what happens to the remaining time when the tab closes.

## The decision, in one paragraph

**Turning the timer off means the exam is untimed. There is no hidden clock.** The other reading — a real
exam whose clock is merely not drawn — was rejected outright: a player who is failed by a mechanism they
were never shown has been tricked, and this game's whole accessibility position is that no signal is hidden.
The two products are otherwise **identical**: the same twenty questions, the same draw, the same pass mark,
the same result screen. The only difference is whether a clock is running, and the result says which
(`exam.result.withTimer` / `exam.result.noTimer`, and `timed` in the saved attempt, whose schema description
already says why: *"so a result is never read as something it was not"*).

## The five rules the clock obeys

1. **It never chooses anything.** It does not advance a question, submit an answer, move the highlight, close
   a dialog or dismiss a message. The only thing it may do is end the exam when it reaches zero.
2. **It never ticks.** It is drawn in whole minutes, and it changes at most once a minute. Below one minute
   it says so in words rather than counting seconds. A per-second display is motion nobody asked for, it is a
   screen-reader problem, and it is the difference between a limit and a pressure.
3. **It pauses whenever the player is not answering.** A menu, a settings screen, a confirmation, a hidden
   tab — the clock stops and says it has stopped. Nobody pays exam time for raising their text size.
4. **It can be turned off mid-exam, and never turned back on.** The result then records an untimed exam. This
   is the escape hatch that makes "no setting can trap the player" (`TN-SET-05`) true of the one timer in the
   game.
5. **It is text, never a bar.** No draining ring, no filling bar, no colour-only warning. Under reduced
   motion nothing changes, because there was never anything moving.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-TIMER-08` |
| Single switch | `TN-TIMER-08`, and `TN-TIMER-07` for the structural guard |
| Screen reader | `TN-TIMER-09` |
| Reduced motion | `TN-TIMER-10` |
| 200 % text | `TN-TIMER-10` |
| Bilingual | `TN-TIMER-11` |
| Failure path | `TN-TIMER-05` (time runs out), `TN-TIMER-03` (time that must not be lost), `TN-TIMER-07` (a second timer appearing anywhere) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `exam.timer.use` | Use the timer | Utiliser le chronomètre |
| `exam.timer.help` | The real test has a time limit. With the timer off, you can take as long as you like. | Le vrai examen a une limite de temps. Sans chronomètre, vous pouvez prendre tout le temps qu'il vous faut. |
| `exam.timer.limit.one` | {{n}} minute | {{n}} minute |
| `exam.timer.limit.other` | {{n}} minutes | {{n}} minutes |
| `exam.timer.left.one` | {{n}} minute left | Il reste {{n}} minute |
| `exam.timer.left.other` | {{n}} minutes left | Il reste {{n}} minutes |
| `exam.timer.lessThanMinute` | Less than 1 minute left | Il reste moins d'une minute |
| `exam.timer.paused` | Timer paused | Chronomètre en pause |
| `exam.timer.off` | No timer. Take as long as you like. | Aucun chronomètre. Prenez tout le temps qu'il vous faut. |
| `exam.timer.stop` | Turn the timer off | Arrêter le chronomètre |
| `exam.timer.stopped` | The timer is off. You can take as long as you like. | Le chronomètre est arrêté. Vous pouvez prendre tout le temps qu'il vous faut. |
| `exam.timer.timeUp.title` | Time is up | Le temps est écoulé |
| `exam.timer.timeUp.body` | We marked the questions you answered. | Nous avons corrigé les questions auxquelles vous avez répondu. |

`settings.state.on` and `settings.state.off` — "On" / « Activé », "Off" / « Désactivé » — are owned by
`TN-COPY-strings-and-counts.md` and are the words the switch shows. This file invents no third pair.

**Why the limit is a separate string from the label.** "Use the 30-minute timer" writes a configuration
number into a sentence, and `timeLimitSeconds` is configuration. `exam.timer.use` carries no number and
`exam.timer.limit` carries the number with its `.one` and `.other` rows in both languages, drawn beside the
switch as its value. That is `TN-COPY`'s rule 9 — one counted noun per template — and rule 3: the form is
chosen by `Intl.PluralRules` for the active locale, so that a build with a one-minute limit reads
« 1 minute » and not « 1 minutes ».

**Why the remaining time is a counted noun at all.** Rule 1 prefers a preposition after the number, and
there is no honest way to write "26 minutes left" with one. So `exam.timer.left` takes rule 2 and carries
both forms in both languages, and `TN-TIMER-11` asserts the readings at 1 and at 2 in French, where
« Il reste 1 minutes » is the defect this rule exists to prevent.

---

## TN-TIMER-01 — The timer is a choice the player makes before the exam starts

```gherkin
Feature: Choosing whether to be timed
  As a player who may or may not want a clock
  I want to decide before the exam starts
  So that nothing about the exam surprises me

  Background:
    Given the element "exam-start" is visible

  Scenario: The choice is on the start screen, as a switch with a word
    Then the element "exam-timer-toggle" is visible and is labelled "Use the timer"
    And it shows its state as "On" or "Off" as text
    And its state is not conveyed by position or colour alone
    And it is at least 44 CSS px wide and tall

  Scenario: The switch says what the choice means
    Then it is described by "The real test has a time limit. With the timer off, you can take as long as you like."
    And the limit is shown beside it as "30 minutes"
    And that number comes from "exam.timeLimitSeconds" in "game.config.json"

  Scenario: The timer starts off
    Given I have never started an exam
    Then "exam-timer-toggle" reads "Off"
    And "exam-start" shows "No timer. Take as long as you like."

  Scenario: Turning it on
    When I turn on "Use the timer"
    Then the switch reads "On"
    And the change is announced once in "#tn-live-region" as the label and its state
    And no clock is drawn yet, because no exam is running

  Scenario: The choice belongs to the attempt, not to the game
    Given I turned the timer on and finished an exam
    When I open "exam-start" again
    Then "exam-timer-toggle" reads "Off"
    And nothing has been remembered that I did not ask to be remembered

  Scenario: The choice cannot be made anywhere else
    Then no control named "Use the timer" is present on "settings-screen"
    And no control anywhere outside "exam-start" turns a timer on
```

## TN-TIMER-02 — The clock while the exam runs

```gherkin
Feature: A clock that does not tick
  Background:
    Given I turned the timer on
    And an exam of 20 questions is running

  Scenario: The clock is there and is text
    Then the element "exam-clock" is visible
    And it reads "30 minutes left"
    And it is text in the accessibility tree, not a picture and not a bar

  Scenario: It is drawn in whole minutes and changes at most once a minute
    Given four and a half minutes of answering have passed
    Then "exam-clock" reads "26 minutes left"
    And it has changed at most five times since the exam started
    And it has never shown a number of seconds

  Scenario: The last minute is words, not seconds
    Given fifty seconds of the limit remain
    Then "exam-clock" reads "Less than 1 minute left"
    And no seconds are counted down on screen

  Scenario: One minute reads as one
    Given one minute of the limit remains
    Then "exam-clock" reads "1 minute left"
    And it does not read "1 minutes left"

  Scenario: Nothing else about the exam changes because a clock is running
    Then the questions asked are the same ones an untimed exam would have drawn from the same seed
    And the pass mark is the same
    And the controls on the card are the same

  Scenario: The clock never acts
    When the clock changes
    Then no question changes
    And no answer is submitted
    And the highlight does not move
    And no dialog opens or closes

  Scenario: A clock is drawn only inside a timed exam
    Given I turned the timer off and started an exam
    Then the element "exam-clock" is not present in the accessibility tree
    And "exam-screen" shows "No timer. Take as long as you like."
```

## TN-TIMER-03 — Time is never lost to anything except answering (failure path)

```gherkin
Feature: The clock pauses whenever the player is not answering
  Background:
    Given I turned the timer on
    And an exam is running with 20 minutes left

  Scenario: Opening any screen over the exam pauses the clock
    When I open the exam's menu
    Then "exam-clock" shows "Timer paused"
    And after two minutes with that screen open it still reads "20 minutes left" underneath
    When I close it
    Then the clock carries on from 20 minutes

  Scenario: Changing an accessibility setting costs no exam time
    When I open Settings, set text scaling to 200 % and close Settings
    Then the clock reads "20 minutes left"
    And the exam is drawn at 200 %
    And no time has been taken from me for making the game readable

  Scenario: A hidden tab pauses the clock
    When the tab is hidden for five minutes and shown again
    Then the clock reads "20 minutes left"
    And "exam-clock" showed "Timer paused" on return until I carried on

  Scenario: The paused state is a word, not a style
    Given the clock is paused
    Then "Timer paused" is shown as text
    And the pause is not conveyed by colour, opacity or an icon alone

  Scenario: Nothing is lost between sittings either
    When I leave the exam and come back to it later
    Then the remaining time is what TN-ATTEMPT-02 promises
    And no wall-clock time has been taken while the game was closed
```

## TN-TIMER-04 — Turning the timer off in the middle of an exam

```gherkin
Feature: The escape hatch
  As a player who turned the clock on and is finding it too much
  I want to stop it without losing my exam
  So that a timer can never trap me

  Background:
    Given I turned the timer on
    And an exam is running with 12 minutes left
    And I have answered 9 questions

  Scenario: The control is reachable from inside the exam
    When I open the exam's menu
    Then a control "Turn the timer off" is offered
    And it is at least 44 CSS px wide and tall

  Scenario: Stopping the clock keeps everything else
    When I choose "Turn the timer off"
    Then the element "exam-clock" is no longer present
    And a message says "The timer is off. You can take as long as you like."
    And the message is announced once in "#tn-live-region"
    And my nine answers are still recorded
    And the same question is still on screen
    And the exam has not been redrawn

  Scenario: The result says what the exam really was
    When I finish the exam
    Then the result shows "You took this exam without the timer."
    And the saved attempt records that it was untimed

  Scenario: The clock cannot be started again mid-exam
    Given I turned the timer off during this exam
    Then no control offers to turn it back on
    And no clock appears again before this exam ends

  Scenario: Stopping the clock is not finishing the exam
    Then no "exam/finished" event is emitted
    And no result is shown
```

## TN-TIMER-05 — Running out of time (failure path)

```gherkin
Feature: The clock reaches zero
  Background:
    Given I turned the timer on
    And an exam is running
    And I have answered 16 of the 20 questions, 15 of them rightly

  Scenario: The exam ends and says so plainly
    When the time runs out
    Then the event "exam/time-up" is emitted
    And the event "exam/finished" is emitted
    And the element "exam-result" is visible
    And it shows "Time is up"
    And it shows "We marked the questions you answered."

  Scenario: Running out of time is not a failure by itself
    Then the result shows "Right answers: 15 out of 20"
    And it shows "You passed"
    And nothing says I failed for running out of time

  Scenario: Unanswered questions are unanswered, not wrong
    Then the four questions I did not reach are shown as not answered, as TN-RESULT-04 describes
    And no message calls them mistakes

  Scenario: The answer being given at the moment time runs out is kept
    Given I chose an option and the clock reached zero before I tapped "Next"
    Then that answer is recorded
    And no answer is thrown away because of when it was given

  Scenario: Nothing is submitted for the player before zero
    When the clock reaches one minute left
    Then no answer has been submitted for me
    And no question has been skipped for me
    And the only thing that has happened is the clock changing

  Scenario: Time cannot run out while the clock is paused
    Given the clock is paused with one minute left
    When five minutes pass with a screen open over the exam
    Then no "exam/time-up" event is emitted
    And the exam is still running when I close that screen

  Scenario: Time running out is announced
    When the time runs out
    Then "#tn-live-region" reads "Time is up"
    And focus moves to "exam-result"
```

## TN-TIMER-06 — An exam with no timer

```gherkin
Feature: The untimed exam is the same exam
  Background:
    Given the timer is off
    And an exam of 20 questions is running

  Scenario: Nothing anywhere counts down
    Then the element "exam-clock" is not present in the accessibility tree
    And no element on the page shows a time, a countdown or a bar with a value
    And nothing on the page changes because time passed

  Scenario: An hour with the exam open changes nothing
    When two hours pass with the exam open
    Then the same question is shown
    And no answer has been submitted
    And no message has appeared
    And the exam has not ended

  Scenario: The exam is otherwise identical
    Then twenty questions are asked
    And the pass mark is 15
    And the result screen is the same one a timed exam shows,
      except for the line naming which it was

  Scenario: The result says which it was
    When I finish
    Then the result shows "You took this exam without the timer."
    And it does not say the exam was easier, shorter or worth less
```

## TN-TIMER-07 — This clock does not become a second timer (failure path)

```gherkin
Feature: The one exception stays one exception
  Scenario: The single-switch code still contains no scheduling primitive
    When the unit suite runs
    Then "app/ui/single-switch.ts" contains no "setTimeout", "setInterval",
      "requestAnimationFrame" or "requestIdleCallback"
    And the test that asserts it is not skipped
    And adding one fails the build

  Scenario: The exam clock is the only countdown in the source
    Then exactly one module drives a countdown the player can lose to
    And no screen outside the exam imports it
    And a test names that module, and fails when a second one appears

  Scenario: No screen outside the exam counts down
    Given any screen of this game that is not a running timed exam
    When I do nothing for two minutes
    Then nothing on it has changed
    And nothing has been chosen, submitted, dismissed or advanced for me

  Scenario: The clock cannot reach a screen that is not the exam
    Given a timed exam is running and I open any screen over it
    Then the clock is paused, as TN-TIMER-03 requires
    And no countdown is drawn on that screen

  Scenario: A load budget is not a player timer
    Given a level or the question bank is loading
    Then nothing counts down
    And the escape route described in TN-COPY-07 is what a long wait offers

  Scenario: The guard is proven by a failing case
    Then a fixture exists in which a second countdown is introduced outside the exam
    And the suite is asserted to fail on it
    And a change that makes that fixture pass fails this suite
```

## TN-TIMER-08 — The clock from the keyboard and with one switch

```gherkin
Feature: Operating the exam's clock without a pointer
  Scenario: Turning the timer on from the keyboard
    Given I am using a keyboard only
    And the element "exam-start" is visible
    When I press "Tab" until focus is on "exam-timer-toggle"
    And I press "Space"
    Then the switch reads "On"
    And the change is announced in "#tn-live-region"

  Scenario: Turning it off mid-exam from the keyboard
    Given a timed exam is running
    When I open the exam's menu with the keyboard and activate "Turn the timer off"
    Then the clock is gone
    And focus returns to the question I was on

  Scenario: The clock is reachable but is not a control
    Then "exam-clock" is readable in the accessibility tree
    And it never receives focus
    And it is not in the tab order

  Scenario: The switch user can choose and unchoose the clock
    Given single-switch mode is on
    When I use only short and long presses
    Then I can reach "Use the timer" on "exam-start" and turn it on
    And I can reach "Turn the timer off" during the exam and take it

  Scenario: The clock never moves the highlight
    Given single-switch mode is on and a timed exam is running
    When the clock changes
    Then the highlight is where I left it
    And nothing has been chosen

  Scenario: The clock is not in the highlight ring
    Given single-switch mode is on and a timed exam is running
    When I press the switch briefly through the whole ring
    Then "exam-clock" is never highlighted as if it were a control
```

## TN-TIMER-09 — The clock with a screen reader

```gherkin
Feature: Announcing time without nagging
  Background:
    Given a timed exam is running

  Scenario: The clock is static text, not a second announcer
    Then "exam-clock" has no "aria-live" attribute of its own
    And exactly one element on the page has an "aria-live" attribute
    And its text can be read at any time without waiting for it to change

  Scenario: Time is announced at two points and at the end, and never in between
    When 5 minutes remain
    Then "#tn-live-region" reads "5 minutes left", once
    When 1 minute remains
    Then it reads "1 minute left", once
    When the time runs out
    Then it reads "Time is up", once
    And no other announcement about time is made during the exam

  Scenario: An announcement never interrupts a question being read
    Then a time announcement is polite, not assertive
    And it does not move focus

  Scenario: Pausing and stopping are announced
    When the clock pauses
    Then "#tn-live-region" reads "Timer paused", once
    When I turn the timer off
    Then it reads "The timer is off. You can take as long as you like."
```

## TN-TIMER-10 — Reduced motion, 200 % text and high contrast

```gherkin
Feature: The clock honours the settings
  Scenario: Reduced motion removes nothing, because nothing moved
    Given reduced motion is on
    And a timed exam is running
    Then "exam-clock" is still shown with the time left
    And it does not pulse, flash, spin or slide when it changes
    And no bar drains and no ring empties

  Scenario: The clock is never the only signal
    Then the time left is words and a number
    And no colour change is the only indication that time is short
    And "High contrast" leaves it readable against its background

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Less than 1 minute left" is visible
    And the clock does not cover the question, an option or any control
    And the page does not scroll sideways

  Scenario: The French clock is longer and still fits
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Il reste moins d'une minute" is visible
    And the whole of "Chronomètre en pause" is visible
    And neither is truncated with an ellipsis
```

## TN-TIMER-11 — The clock in French

```gherkin
Feature: The exam clock in French
  Background:
    Given the language is French

  Scenario: The choice is French
    Given the element "exam-start" is visible
    Then "exam-timer-toggle" is labelled "Utiliser le chronomètre"
    And its state reads "Activé" or "Désactivé"
    And it is described by "Le vrai examen a une limite de temps. Sans chronomètre, vous pouvez prendre tout le temps qu'il vous faut."
    And the limit beside it reads "30 minutes"
    And "exam-start" shows "Aucun chronomètre. Prenez tout le temps qu'il vous faut." while the switch is off

  Scenario: The clock is French and agrees with its number
    Given a timed exam is running
    Then "exam-clock" reads "Il reste 30 minutes"
    Given one minute of the limit remains
    Then it reads "Il reste 1 minute"
    And it does not read "Il reste 1 minutes"
    Given fifty seconds remain
    Then it reads "Il reste moins d'une minute"

  Scenario: The limit reads correctly at one in both languages
    When the string "exam.timer.limit" is rendered with 1
    Then the French reading is "1 minute" and the English reading is "1 minute"
    When it is rendered with 30
    Then the French reading is "30 minutes" and the English reading is "30 minutes"
    And the form is chosen by the plural rules of the active locale, never by comparing the number to 1

  Scenario: Pausing and stopping are French
    When the clock pauses
    Then "exam-clock" shows "Chronomètre en pause"
    When I turn the timer off
    Then the message reads "Le chronomètre est arrêté. Vous pouvez prendre tout le temps qu'il vous faut."
    And the control that did it reads "Arrêter le chronomètre"

  Scenario: Time running out is French
    When the time runs out
    Then the result shows "Le temps est écoulé"
    And it shows "Nous avons corrigé les questions auxquelles vous avez répondu."
    And it is announced in "#tn-live-region" with "lang" equal to "fr"

  Scenario: No French string about the clock needs gender agreement
    Then no timer string contains "(e)", "·e" or a bracketed ending
```

---

## Open questions

- **`OQ-TIMER-1` — is a whole-minute clock enough for somebody practising the real thing?** The real test
  shows a running clock, and a player rehearsing that experience may want the seconds. *Recommendation:* keep
  whole minutes. The thing being practised is answering twenty questions inside thirty minutes, not watching a
  second hand; a per-second display is the version of this feature that makes the game worse for the people
  the accessibility bar is about, and it is the one shape that cannot be undone once players expect it. If it
  is wanted, it is a switch on the start screen — never the default — and it is a new scenario here, not a
  change to `exam.timer.left`.
- **`OQ-TIMER-2` — does the clock pause when the tab is hidden, or should it keep running?** These scenarios
  pause it. A player could in principle stretch a thirty-minute exam over a week. There is nobody to cheat:
  no accounts, no server, no leaderboard, no analytics (`CLAUDE.md`, Storage), and the only person a padded
  practice result misleads is the player, who chose it. *Recommendation:* keep the pause, because the
  alternative punishes the phone call, the bus stop and the low-memory browser that discarded the tab —
  none of which is the player's doing.
- **`OQ-TIMER-3` — where does the clock read the time from?** `TN-TIMER-03`'s scenarios and every "five
  minutes pass" step need the time the exam reads to be a port with a fake, exactly as `OQ-RESUME-1` needed
  for the scheduler. *Recommendation:* the same clock port, injected the same way, and these scenarios keep
  saying "five minutes pass" rather than naming the fake. `app/application/ports/clock.ts` exists; whether it
  is the same one the exam reads is the architect's call, and a second source of time is how a paused clock
  quietly stops being paused.
- **`OQ-TIMER-4` — should the exam's menu be the HUD menu?** `TN-HUD-02`'s menu belongs to a level and offers
  "Leave the level"; an exam is not a level. These scenarios say "the exam's menu" and require only that
  Settings, "Turn the timer off" and "Leave the exam" are reachable from inside the exam.
  *Recommendation:* a small menu owned by the exam screen, with those three items and a close control, rather
  than reusing the level's. `TN-HUD-02`'s "Leaving is not offered where there is nothing to leave" already
  says the level's menu cannot appear here.
- **`OQ-TIMER-5` — is thirty minutes right when the game's questions are not IRCC's questions?** The limit
  mirrors the real test and comes from configuration. A player answering at 200 % text with a switch will not
  finish twenty questions in thirty minutes, which is exactly why the timer is optional and why
  `TN-TIMER-04` exists. *Recommendation:* leave the number alone, and never add a longer limit as an
  accessibility accommodation — "extra time" is a category this game should not be sorting players into when
  it can simply let anybody turn the clock off.
