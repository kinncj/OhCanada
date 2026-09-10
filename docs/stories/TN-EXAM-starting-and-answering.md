# TN-EXAM — The practice exam: starting it, and answering twenty questions

**Intent.** A player who wants to know whether they are ready can take a twenty-question exam in the shape of
the real one, answer it with one thumb, change their mind before they finish, and never be beaten by
something they were not shown.

`CLAUDE.md` fixes the shape and this file does not change it: **twenty questions, fifteen to pass, thirty
minutes, timer optional.** The numbers come from `exam` in `content/game.config.json`
(`questionCount`, `passMark`, `timeLimitSeconds`, `timerOptional`) and are never written into the UI.

Read `README.md` in this directory first. The clock is `TN-TIMER-the-exam-clock.md`; the result is
`TN-RESULT-exam-results.md`; leaving an exam and coming back to it is
`TN-ATTEMPT-leaving-and-resuming-an-exam.md`. The question card itself is `TN-CARD-question-card.md`, and
this file says precisely how the exam's use of it differs.

## What an exam is, and what it is not

| | A Study drill (`TN-STUDY`) | An exam (this file) |
|---|---|---|
| Which questions | The ones the player is weakest on — the scheduler decides | **A representative draw across the subjects that are ready.** Review state is not consulted |
| How many | `study.drillSize` (5) | `exam.questionCount` (20) |
| Feedback | After every answer | **At the end, never during** |
| Can an answer be changed | No (`TN-CARD-04`) | **Yes, until the exam is finished** |
| A clock | Never | Only if the player asked for one (`TN-TIMER`) |
| Closing the tab | The drill is gone, the answers are kept | **The exam is kept and can be finished later** (`TN-ATTEMPT`) |
| Result | A summary, not kept | A pass or not, kept, shown in the passport (`TN-PASSPORT`) |

**The exam is not a drill, and the domain must not implement it as one.** `TN-EXAM-02` is written so that an
exam drawn from the scheduler fails it.

### Three decisions this file makes, and what they cost

**1. It is called a *practice* exam, on screen, in both languages.** The game is not from IRCC
(`title.notOfficial`, `TN-TITLE`), and a screen that says "Exam" to somebody preparing for a real test they
are anxious about is one word away from being read as the real thing. The cost is a longer label on the
title screen. `exam.title` is « Examen pratique », not « Examen ».

**2. An answer can be changed until the exam is finished.** `TN-CARD-04` says the opposite for a level's
question card, and its reason is written down: there is no timer, so the only cost of a mis-tap is seeing the
question again. **In an exam that reason is gone** — a mis-tap costs a mark, and the player who mis-taps is
disproportionately the player using a switch, a large pointer target at 200 % text, or a screen reader. So
the exam takes the other answer, and `TN-CARD` carries a note pointing here rather than the two files
quietly disagreeing. The cost is a *Previous* control, a changeable state on the card, and a finish step that
has to ask about unanswered questions.

**3. Answering does not advance the exam by itself; it moves the focus and the highlight to *Next*.**
Auto-advance would save twenty taps and would take away the one moment a player can check that the game
heard them — and for a switch user it would remove the chance entirely. Moving the focus is the compromise:
one press moves on, nothing moves without a press, and `TN-EXAM-07` proves it against the single-switch
contract.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-EXAM-06` |
| Single switch | `TN-EXAM-07` |
| Screen reader | `TN-EXAM-08` |
| Reduced motion | `TN-EXAM-09` |
| 200 % text | `TN-EXAM-09` |
| Bilingual | `TN-EXAM-10` |
| Failure path | `TN-EXAM-05` (not enough questions; the bank will not load), `TN-EXAM-04` (finishing with questions unanswered) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `exam.open` | Practice exam | Examen pratique |
| `exam.title` | Practice exam | Examen pratique |
| `exam.intro` | This is a practice exam in the same shape as the real test. | Cet examen pratique a la même forme que le vrai examen. |
| `exam.rules.length.one` | The exam has {{count}} question. | L'examen compte {{count}} question. |
| `exam.rules.length.other` | The exam has {{count}} questions. | L'examen compte {{count}} questions. |
| `exam.rules.pass` | You need {{pass}} out of {{count}} to pass. | Il faut {{pass}} sur {{count}} pour réussir. |
| `exam.noFeedback` | You will see how you did at the end. | Vous verrez votre résultat à la fin. |
| `exam.changeAnswers` | You can go back and change an answer before you finish. | Vous pouvez revenir en arrière et changer une réponse avant de terminer. |
| `exam.subjectsReady` | Subjects ready: {{ready}} of {{total}} | Sujets prêts : {{ready}} sur {{total}} |
| `exam.subjects.help` | This exam only asks about the subjects that are ready. | Cet examen ne porte que sur les sujets qui sont prêts. |
| `exam.start` | Start the exam | Commencer l'examen |
| `exam.previous` | Previous | Précédent |
| `exam.next` | Next | Suivant |
| `exam.finish` | Finish the exam | Terminer l'examen |
| `exam.answered` | Answers given: {{done}} of {{total}} | Réponses données : {{done}} sur {{total}} |
| `exam.notAnsweredYet` | Not answered yet | Pas encore répondu |
| `exam.unanswered.one` | You have not answered {{n}} question. | Il reste {{n}} question sans réponse. |
| `exam.unanswered.other` | You have not answered {{n}} questions. | Il reste {{n}} questions sans réponse. |
| `exam.goToUnanswered` | Go to the first one you skipped | Aller à la première question sans réponse |
| `exam.finishAnyway` | Finish anyway | Terminer quand même |
| `exam.notReady.title` | The exam is not ready yet | L'examen n'est pas encore prêt |
| `exam.notReady.body` | We are still writing the questions. You can practise in Study instead. | Nous écrivons encore les questions. Vous pouvez vous exercer dans la révision. |

Keys this screen draws and does not own:

| Key | Owned by |
|---|---|
| `card.progress`, `card.close`, `card.yourAnswer` | `TN-CARD-question-card.md` |
| `exam.menu`, `exam.menu.title` | `TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md` |
| `common.back`, `common.close` | `TN-FLOW-first-run-and-return.md`, `TN-SET-settings.md` |
| `map.moreComing` | `TN-MAP-level-select.md` |
| `study.open` | `TN-STUDY-study-mode.md` |
| `exam.timer.*` | `TN-TIMER-the-exam-clock.md` |
| `exam.result.*`, `exam.again` | `TN-RESULT-exam-results.md` |
| `exam.leave*`, `exam.resume*`, `exam.new*` | `TN-ATTEMPT-leaving-and-resuming-an-exam.md` |
| `storage.warning`, `storage.warning.help` | `TN-SAVE-save-and-reload.md` |
| `level.<id>.subtitle` | `TN-LEVELS-2-to-10-spine.md`, `TN-LEVEL-ottawa.md` — the subject names on the result |

**Why `exam.rules` is two keys and not one.** "The exam has 20 questions. You need 15 out of 20 to pass."
carries **two** counted nouns behind **two** different numbers, and a plural category is chosen once per
string — so at a pass mark of one the French would draw « il faut 1 bonnes réponses » no matter which
placeholder the form came from. `TN-COPY`'s rule 9 is written from this string: one counted noun per
template, and a string that needs two is two strings. `exam.rules.length` carries the noun and its `.one` /
`.other` rows in both languages; `exam.rules.pass` follows both its numbers with a preposition and needs no
rows at all (rule 1).

**Why `exam.next` exists when `card.next` says the same word.** They are the same two words and two
different keys, for the reason `study.error.retry` and `level.error.retry` are: `card.next` moves past
feedback the player has just read, `exam.next` moves between questions nobody has been marked on yet, and
either may be reworded without the other. Nothing draws both at once.

---

## TN-EXAM-01 — Reaching the exam, and what the start screen says

```gherkin
Feature: Starting a practice exam
  As a player who wants to know whether I am ready
  I want an exam in the shape of the real test
  So that I can find out without being surprised by the rules

  Background:
    Given at least twenty verified questions exist
    And the element "title-screen" is visible

  Scenario: The exam is reachable from the title screen
    Then the element "title-exam" is visible and reads "Practice exam"
    And it is at least 44 CSS px wide and tall
    And it has a visible text label, not an icon alone
    When I tap "title-exam"
    Then the element "exam-start" is visible
    And the element "playable" is not present

  Scenario: The start screen says what the exam is before it starts
    Then it shows the heading "Practice exam"
    And it shows "This is a practice exam in the same shape as the real test."
    And it shows "The exam has 20 questions."
    And it shows "You need 15 out of 20 to pass."
    And it shows "You will see how you did at the end."
    And it shows "You can go back and change an answer before you finish."
    And a control "Start the exam" is offered as "exam-begin"

  Scenario: The numbers come from the configuration, not from the words
    Given "exam.questionCount" is 20 and "exam.passMark" is 15
    Then the screen shows those two numbers
    Given a build whose "exam.questionCount" is 10 and whose "exam.passMark" is 8
    Then the screen shows "The exam has 10 questions." and "You need 8 out of 10 to pass."
    And no number on this screen is written into a copy string

  Scenario: The start screen says how much of the game exists
    Given verified questions exist for one subject only
    Then it shows "Subjects ready: 1 of 10"
    And it shows "More are coming."
    And it shows "This exam only asks about the subjects that are ready."
    And nothing on the screen reads as an error

  Scenario: The timer is a choice made here, and only here
    Then the control described in TN-TIMER-01 is on this screen
    And no other screen in the game offers it

  Scenario: Starting the exam
    When I tap "exam-begin"
    Then the event "exam/started" is emitted
    And the element "exam-screen" is visible
    And the element "question-card" is visible
    And "question-progress" reads "Question 1 of 20"
    And the event "progress/saved" is emitted

  Scenario: Nothing on the start screen counts down
    When I do nothing for two minutes
    Then "exam-start" is unchanged
    And no exam has begun
    And nothing on screen counts down

  Scenario: One thumb, portrait
    Given the viewport is 390 x 844
    Then the page does not scroll sideways
    And every control on "exam-start" and "exam-screen" is at least 44 CSS px wide and tall
    And no control needs a swipe, a drag, a pinch or a double tap

  Scenario: An exam is not a level
    When the exam is running
    Then the element "playable" is not present
    And the element "scene-state" is not present
    And "hud-quest-tracker" is not shown
    And no "level/chosen" event is emitted
```

## TN-EXAM-02 — What the exam draws, and what it refuses to look at

```gherkin
Feature: A representative draw, not a drill
  As a player taking a practice test
  I want the questions to cover the exam's subjects
  So that the result tells me about the test and not about my worst day

  Scenario: The exam asks the number of questions the configuration names
    When I run an exam to the end
    Then exactly 20 questions were asked
    And no question was asked twice

  Scenario: The draw spreads across the subjects that are ready
    Given verified questions exist for four subjects
    When I start an exam of 20 questions
    Then each of those four subjects contributes 5 questions

  Scenario: A remainder is spread by chance, not by subject order
    Given verified questions exist for three subjects
    When I start an exam of 20 questions
    Then two subjects contribute 7 questions and one contributes 6
    And across exams started from different seeds, each of the three subjects can be the one that contributes 6

  Scenario: A subject with too few questions does not shrink the exam
    Given one subject has only 2 verified questions and the others have plenty
    When I start an exam of 20 questions
    Then that subject contributes its 2 questions
    And the remaining 18 are spread across the other subjects that are ready
    And the exam still asks 20 questions

  Scenario: Only one subject is ready, which is this game today
    Given verified questions exist for one subject only
    When I start an exam of 20 questions
    Then all 20 come from that subject
    And the start screen already said "Subjects ready: 1 of 10"
    And nothing about the exam reads as broken

  Scenario: The draw does not read the player's review state
    Given two saved games with the same seed
    And in the first I answered every question rightly
    And in the second I answered every question wrongly
    When an exam is drawn for each
    Then the two exams contain the same twenty questions
    And they are asked in the same order

  Scenario: A question the player has never seen can be drawn
    Given I have never answered a question
    When I start an exam
    Then twenty questions are asked
    And the daily limit on new questions does not reduce that number

  Scenario: A question answered a minute ago can be drawn
    Given I answered question A in a Study drill a minute ago
    When I start an exam
    Then A may be drawn
    And the exclusion window used by the drill is not applied to the exam

  Scenario: Only verified questions are drawn
    Then every question asked carries verification status "verified"
    And no quarantined question is asked
    And every question asked has wording in the language I am playing in

  Scenario: The player is never told how the questions were chosen
    Then no string on "exam-start", "exam-screen" or the result contains
      "spaced repetition", "FSRS", "algorithm", "interval" or "due"
```

## TN-EXAM-03 — Answering, going back, and changing my mind

```gherkin
Feature: Answering the exam
  Background:
    Given an exam of 20 questions is running

  Scenario: A question looks like a question and nothing more
    Then the element "question-card" is visible
    And "question-progress" reads "Question 1 of 20"
    And "question-prompt" shows the question wording
    And exactly four options are shown, as "option-0" to "option-3"
    And each option is at least 44 CSS px tall

  Scenario: The exam card shows none of the level card's teaching
    Then the element "question-kind" is not present
    And the element "question-feedback" is not present
    And the element "question-explanation" is not present
    And nothing on the card says whether my answer was right

  Scenario: Choosing an option records it and moves the focus on
    When I tap "option-2"
    Then the event "exam/answered" is emitted for question 1
    And "option-2" is marked as chosen, by a word and a shape and not by colour alone
    And the word is "Your answer" and the shape is neutral, as TN-EXAMMENU-06 requires
    And it is not a tick and it is not a cross
    And no feedback about being right or wrong is shown
    And focus moves to "exam-next"
    And the exam has not moved to question 2 by itself

  Scenario: An answer can be changed
    Given I chose "option-2" on question 1
    When I tap "option-0"
    Then "option-0" is marked as chosen and "option-2" is not
    And exactly one option is marked as chosen
    And the event "exam/answered" is emitted again for question 1
    And the exam records one answer for question 1, not two

  Scenario: Moving between questions
    When I tap "exam-next"
    Then "question-progress" reads "Question 2 of 20"
    When I tap "exam-previous"
    Then "question-progress" reads "Question 1 of 20"
    And the option I chose on question 1 is still marked as chosen

  Scenario: The ends of the exam are ends
    Given I am on question 1
    Then "exam-previous" is not offered, or is present and marked "aria-disabled"
    Given I am on question 20
    Then "exam-next" is not offered, or is present and marked "aria-disabled"
    And "exam-finish" is offered

  Scenario: A question may be skipped
    When I tap "exam-next" without choosing an option
    Then "question-progress" reads "Question 2 of 20"
    And question 1 shows "Not answered yet" when I come back to it
    And no answer was recorded for it

  Scenario: How far through the exam I am, without a clock
    Then the element "exam-progress" shows "Answers given: 0 of 20"
    When I answer three questions
    Then it shows "Answers given: 3 of 20"
    And it counts questions answered, not questions seen

  Scenario: Nothing advances by itself
    When I do nothing for two minutes
    Then the same question is shown
    And no answer has been submitted for me
    And the only thing on screen that may have changed is the clock described in TN-TIMER-02

  Scenario: An answer is saved as soon as it is given
    When I answer a question
    Then the event "progress/saved" is emitted within one second
    And the exam described in TN-ATTEMPT-02 would survive the tab closing at that moment
```

## TN-EXAM-04 — Finishing, and finishing with questions unanswered (failure path)

```gherkin
Feature: Ending the exam on purpose
  Background:
    Given an exam of 20 questions is running

  Scenario: Finishing when everything is answered
    Given I have answered all 20 questions
    When I tap "exam-finish"
    Then the event "exam/finished" is emitted
    And the element "exam-result" is visible, as TN-RESULT-01 describes
    And no confirmation was shown

  Scenario: Finishing with questions unanswered asks first
    Given I have answered 17 of the 20 questions
    When I tap "exam-finish"
    Then a confirmation is shown
    And it says "You have not answered 3 questions."
    And it offers "Go to the first one you skipped" and "Finish anyway"
    And the exam has not finished

  Scenario: The unanswered count reads correctly at one
    Given I have answered 19 of the 20 questions
    When I tap "exam-finish"
    Then the confirmation says "You have not answered 1 question."
    And it does not say "1 questions"
    And the form is chosen by the plural rules of the active locale, never by comparing the count to 1

  Scenario: Going back to the ones I skipped
    Given the confirmation is shown
    When I tap "Go to the first one you skipped"
    Then the confirmation closes
    And the first unanswered question is shown
    And "question-progress" names its number

  Scenario: Finishing anyway
    Given the confirmation is shown
    When I tap "Finish anyway"
    Then the event "exam/finished" is emitted
    And the unanswered questions are recorded as unanswered, not as wrong
    And they count towards the 20 and not towards the number right
    And the result names them, as TN-RESULT-04 describes

  Scenario: An exam with no answers at all can still be finished
    Given I have answered none of the 20 questions
    When I finish anyway
    Then the result shows "Right answers: 0 out of 20"
    And nothing on the result blames me
    And no message says I failed

  Scenario: Finishing cannot be undone
    Given the exam has finished
    Then no control returns me to the questions to change an answer
    And starting again means a new exam, as TN-RESULT-06 describes
```

## TN-EXAM-05 — The exam cannot run (failure path)

```gherkin
Feature: Not enough questions, or none that will load
  Scenario: Fewer verified questions exist than the exam needs
    Given only 12 verified questions exist in the whole game
    When I open "exam-start"
    Then the element "exam-not-ready" is visible
    And it shows "The exam is not ready yet"
    And it shows "We are still writing the questions. You can practise in Study instead."
    And "exam-begin" is not offered
    And a control opens Study
    And nothing on the screen says "error", "failed" or "missing"
    And no number of questions is shown to the player

  Scenario: The question bank will not load
    Given the question bank fails to load
    When I open "exam-start"
    Then the message described in TN-STUDY-03 for a failed bank is shown
    And a "Try again" control is offered
    And no exam is started with fewer than 20 questions

  Scenario: Trying again after the bank comes back
    Given the load failed and the bank now loads
    When I tap "Try again"
    Then the failure message is gone
    And "exam-begin" is offered

  Scenario: The bank shrinks between drawing and answering
    Given an exam is running
    And a question in it can no longer be loaded
    Then the exam does not end
    And that question is shown as unanswered and is not counted as wrong
    And the failure is not shown as an error card over the exam
    And the result says the question could not be shown

  Scenario: A question with no French wording never reaches a French exam
    Given the language is French
    And one question in the bank has no French wording
    Then it is not drawn
    And the content check has already failed the build for it

  Scenario: Storage cannot be written while the exam runs
    Given writing to local storage fails
    When I answer a question
    Then the exam carries on
    And the element "storage-warning" is visible
    And the event "progress/save-failed" is emitted
    And the sentence described in TN-ATTEMPT-05 replaces the promise that the exam is saved

  Scenario: The failure screens can all be left
    Given any failure screen in this file is visible
    Then a control returns me to the title screen
    And nothing on the screen counts down
    And the game is never left with no screen on it
```

## TN-EXAM-06 — The exam from the keyboard

```gherkin
Feature: Keyboard-only exam
  Background:
    Given I am using a keyboard only

  Scenario: Reaching and starting the exam
    When I press "Tab" until focus is on "title-exam" and press "Enter"
    Then the element "exam-start" is visible
    And focus is inside it
    When I press "Enter" on "exam-begin"
    Then the exam starts and focus is inside "question-card"

  Scenario: Answering
    When I press "Tab" until focus is on "option-2" and press "Enter"
    Then that option is recorded as my answer
    And focus moves to "exam-next"
    When I press "Space" on another option
    Then that option is recorded instead

  Scenario: Moving through the exam
    Then "exam-previous", "exam-next" and "exam-finish" are all reachable with "Tab"
    And each activates with "Enter"
    And focus is never left on the document body

  Scenario: Escape does not throw the exam away
    When I press "Escape"
    Then the exam is not finished
    And no answer is lost
    And either nothing happens, or the leaving control described in TN-ATTEMPT-01 is reached

  Scenario: The whole exam is completable from the keyboard
    When I use only the keyboard
    Then I can answer all twenty questions, change one, finish, and read the result
```

## TN-EXAM-07 — The exam with one switch

```gherkin
Feature: Single-switch exam
  Background:
    Given single-switch mode is on
    And an exam of 20 questions is running

  Scenario: Nothing scans and nothing expires
    When I do nothing for two minutes
    Then the highlight has not moved
    And no answer has been submitted
    And no question has changed

  Scenario: The highlight ring holds the options and the controls
    When I press the switch briefly through the whole ring
    Then the highlight visits "option-0" to "option-3", then "exam-previous", "exam-next" and "exam-finish"
    And then "exam-menu-button", which is last
    And it wraps to "option-0"
    And each item is announced in "#tn-live-region" as the highlight arrives

  Scenario: The way out is the last thing the ring reaches
    Given the highlight is on "exam-finish"
    When I press the switch briefly once
    Then the highlight is on "exam-menu-button", the fifth and last item
    And a switch user cycling towards the next question never lands on the way out first
    And "exam-menu-button" is visually separate from the three controls that move through the exam
    And this is OQ-EXAMMENU-3's recommendation, taken: TN-EXAMMENU adds the control and this file owns the ring

  Scenario: A long press answers
    Given the highlight is on "option-1"
    When I hold the switch past the hold-to-choose threshold
    Then "option-1" is recorded as my answer
    And the highlight moves to "exam-next"
    And nothing has moved to the next question

  Scenario: Changing an answer with the switch costs one pass of the ring
    Given I answered question 1
    When I use only short and long presses
    Then I can reach another option and choose it
    And exactly one option is marked as chosen

  Scenario: The whole exam is completable with the switch alone
    When I use only short and long presses
    Then I can start the exam, answer twenty questions, go back to one, finish and read the result
    And I never need a second input

  Scenario: The exam adds no scanning and no expiry
    Then nothing in the exam moves the highlight without a press
    And the only thing in the game that ends on its own is the clock in TN-TIMER,
      which is off unless I turned it on
```

## TN-EXAM-08 — The exam with a screen reader

```gherkin
Feature: Announcing the exam
  Scenario: The start screen is a named screen inside a landmark
    When "exam-start" is visible
    Then it has an accessible name that is not empty
    And the page has exactly one element with role "main"
    And every piece of visible text on the page is inside a landmark
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The card names the question and its number
    When the exam starts
    Then "question-card" has role "dialog" with "aria-modal" true, or is a named region inside the exam screen
    And its accessible name includes "Question 1 of 20"
    And its accessible description includes the question wording

  Scenario: Options are buttons with their whole wording
    Then each of "option-0" to "option-3" is a button
    And each accessible name is the whole option wording
    And the chosen one reports its chosen state to the accessibility tree

  Scenario: Answering is announced without saying whether it was right
    When I answer a question
    Then "#tn-live-region" reads that the answer was recorded
    And it does not say "right", "wrong" or "correct"
    And it does not read the correct answer

  Scenario: Moving between questions is announced once
    When I tap "exam-next"
    Then "#tn-live-region" reads "Question 2 of 20"
    And it also reads whether that question has been answered yet
    And no announcement is repeated while I stay on the question

  Scenario: The unanswered warning is a dialog
    When I finish with questions unanswered
    Then the confirmation has role "alertdialog" with an accessible name and description
    And focus moves into it
    And "Escape" returns me to the questions

  Scenario: axe-core is clean on every exam screen
    When axe-core runs against the whole page at "exam-start", at a question and at the confirmation
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for any of those scans
    And every scan passes with no violations
```

## TN-EXAM-09 — Reduced motion and 200 % text

```gherkin
Feature: The exam honours the accessibility settings
  Scenario: Reduced motion
    Given reduced motion is on
    When I move between questions
    Then the next question replaces the current one with no slide, fade or scale
    And nothing pulses, shakes or flashes when I choose an option
    And the chosen option is marked by a word and a shape

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole prompt is readable, by scrolling inside the card if needed
    And all four options are reachable and each is at least 44 CSS px tall
    And "exam-previous", "exam-next" and "exam-finish" are all reachable and fully visible
    And no label is truncated with an ellipsis
    And the page does not scroll sideways

  Scenario: The start screen at 200 % in French
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Cet examen ne porte que sur les sujets qui sont prêts." is visible
    And the whole of "Vous pouvez revenir en arrière et changer une réponse avant de terminer." is visible

  Scenario: High contrast
    Given "High contrast" is on
    Then the chosen option is distinguishable without colour
    And every control meets the contrast requirement against its background

  Scenario: The dyslexia-friendly font does not clip the options
    Given "setting-dyslexia-font" is on
    And text scaling is 200 %
    Then no option text overlaps another option
```

## TN-EXAM-10 — The exam in French

```gherkin
Feature: The exam in French
  Background:
    Given the language is French

  Scenario: The way in is French
    Then "title-exam" reads "Examen pratique"
    When I tap it
    Then the heading reads "Examen pratique"

  Scenario: The start screen is French
    Then it shows "Cet examen pratique a la même forme que le vrai examen."
    And it shows "L'examen compte 20 questions."
    And it shows "Il faut 15 sur 20 pour réussir."
    And it shows "Vous verrez votre résultat à la fin."
    And it shows "Sujets prêts : 1 sur 10"
    And there is a space before each colon
    And the button reads "Commencer l'examen"
    And no English word appears in "exam-start"

  Scenario: The exam length reads correctly at one
    When the string "exam.rules.length" is rendered with a count of 1
    Then the French reading is "L'examen compte 1 question."
    And the English reading is "The exam has 1 question."
    And neither reads "1 questions"

  Scenario: The questions and the controls are French
    When the exam is running
    Then the prompt and all four options are the French wording of that question
    And "question-progress" reads "Question 1 sur 20"
    And the controls read "Précédent", "Suivant" and "Terminer l'examen"
    And "exam-progress" reads "Réponses données : 0 sur 20"

  Scenario: The unanswered warning is French and agrees with its number
    Given I have answered 19 of the 20 questions
    When I tap "Terminer l'examen"
    Then it says "Il reste 1 question sans réponse."
    And it does not say "1 questions"
    Given I have answered 17 of the 20 questions
    Then it says "Il reste 3 questions sans réponse."
    And the buttons read "Aller à la première question sans réponse" and "Terminer quand même"

  Scenario: The not-ready message is French
    Given only 12 verified questions exist
    Then it shows "L'examen n'est pas encore prêt"
    And it shows "Nous écrivons encore les questions. Vous pouvez vous exercer dans la révision."

  Scenario: No French string in the exam needs gender agreement
    Then no string in "exam-start" or "exam-screen" contains "(e)", "·e" or a bracketed ending

  Scenario: Changing the language during an exam keeps the exam
    Given I am on question 5 and have answered four questions
    When I change the language to English
    Then the same question is shown, in English
    And "question-progress" reads "Question 5 of 20"
    And my four answers are still recorded
    And the exam has not been redrawn
```

---

## Open questions

- **`OQ-EXAM-1` — is the timer off by default the right default?** `TN-TIMER-01` makes the timer a per-attempt
  choice that starts **off**, so no player can be beaten by a clock they did not ask for, and the start screen
  says in plain words that the real test has a limit. The other reading of `CLAUDE.md` — that the exam mirrors
  IRCC and should therefore start timed — is defensible, and the argument against it is that a default which
  can fail somebody is a default that has to be found and turned off by exactly the players least able to
  afford the time. *Recommendation:* keep it off by default, keep the sentence that explains the real test has
  a limit, and put the default in front of the project owner before the first public build. Whichever way it
  goes, the *choice* and the label stay.
- **`OQ-EXAM-2` — is the timer choice remembered between attempts?** It is not, today: every attempt starts
  from the same default. A player who always wants the clock has to turn it on every time. *Recommendation:*
  remember it, as a settings field rather than as an exam field, once somebody has taken two exams and said so.
  Recorded rather than built, because a remembered default reintroduces `OQ-EXAM-1`'s risk through the back
  door — a clock the player turned on last week is still a clock they did not ask for today.
- **`OQ-EXAM-3` — `examAttempt` cannot hold what this file and `TN-RESULT` promise.**
  `content/schemas/progress.schema.json` records `askedQuestionIds`, `correctCount`, `passed` and `timed`, so
  **results by subject cannot be computed** (there is no per-question outcome), **an exam in progress cannot be
  resumed** (`TN-ATTEMPT-02`), and a finished attempt whose questions have left the build cannot be read at
  all. *Recommendation:* replace `askedQuestionIds` and `correctCount` with an `answers` array in draw order,
  each item carrying `questionId`, `subjectId`, the chosen option or null, and whether it was correct;
  keep `passed` and `timed`; add a nullable `remainingSeconds` for a timed attempt in progress. Storing
  `subjectId` on the answer rather than looking it up makes an old result readable after the bank changes.
  `finishedAt: null` already means "in progress" and needs no new field. Routed to the architect;
  `content/` is not this directory's to edit.
- **`OQ-EXAM-4` — do exam answers count against the daily limit on new questions?** These scenarios say no:
  `dailyNewLimit` governs how many unseen questions a *drill* introduces, and an exam that refuses to draw
  unseen questions cannot be representative. They do still update the review state, so a question missed in
  the exam comes back in Study — which is the whole point of taking one. *Recommendation:* keep both halves,
  and say so in the scheduler's own tests, because the measured defect that produced `firstReviewedAt` is
  exactly the kind that comes back when a second caller starts creating reviews.
- **`OQ-EXAM-5` — how are subjects counted when a subject has no level?** `exam.subjectsReady` says "1 of 10"
  and the ten come from *Discover Canada*'s ten chapters, which are also the ten levels. Nothing in
  `content/` enumerates the ten subject ids; `unlockRules.order` enumerates ten **level** ids, and two of them
  (`mikmaki`, `the-north`) are ids `TN-LEVELS` deliberately does not name. *Recommendation:* the ten subjects
  are declared once, in `game.config.json`, beside the levels; until they are, "of 10" is a number this screen
  cannot derive and `TN-EXAM-01`'s fourth scenario fails closed on it. See `OQ-PASSPORT-2`, which is the same
  gap seen from the passport.
- **`OQ-EXAM-6` — should a player be able to choose a subject to be examined on?** Not here: an exam whose
  subjects the player picks is a drill with a score. *Recommendation:* leave it out; if the wish appears, it
  belongs to `TN-STUDY` as a chosen-subject drill (`OQ-STUDY-2`), not to the exam.
- **`OQ-EXAM-7` — does the exam belong on the title screen, and where in the order?** `OQ-FLOW-6` recommended
  the title screen and this file takes it, which makes the title screen a five-item screen and changes
  `TN-TITLE-01`'s list of ways in. *Recommendation:* after Study and before Settings for a returning player,
  and **not shown at all before the first level has been played** — an exam is the wrong first click for
  somebody who has answered no questions, and `TN-TITLE`'s own rule is that a control is offered only when it
  is true for the player. Routed to `TN-TITLE`'s owner; `TN-EXAM-01` asserts the control exists and not where
  it sits.
