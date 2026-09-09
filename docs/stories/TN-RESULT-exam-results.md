# TN-RESULT — The exam result: passing, not passing, and what to do next

**Intent.** When an exam ends, the player learns plainly whether they passed, how they did **subject by
subject**, what every question's right answer was, and what to practise — with no grade, no percentage, no
streak and no word that calls them a failure.

`docs/plan/slices.md` says F1 delivers "Official format, optional timer, **results by subject**". This file
is the by-subject half.

Read `README.md` in this directory first. `TN-EXAM-starting-and-answering.md` owns the exam;
`TN-TIMER-the-exam-clock.md` owns the clock and what the result says about it;
`TN-PASSPORT-my-passport.md` owns where the result is kept afterwards.

## What a result is allowed to be

- **A pass, or not yet.** Fifteen out of twenty, from `exam.passMark` in `content/game.config.json`.
- **A count of right answers**, and never a percentage, a grade, a letter, a star, a streak or a rank.
  `TN-STUDY-04` already forbids those in a drill; an exam is the one screen where a number means something,
  and it means "you got 14 out of 20", not "70 %".
- **A breakdown by subject**, so a player who did not pass knows which chapter to read rather than that they
  are, in general, not ready.
- **Never a word that calls the player a failure.** `TN-CARD-04`'s rule holds here: not "You failed", not
  "Wrong", not "Error". The heading for a result under the pass mark is "Not this time", and the sentence
  under it is arithmetic, not judgement.

## Where a subject's name comes from

The result names a subject with **the same string the map draws as that level's subject line** —
`level.<id>.subtitle`, owned by `TN-LEVELS-2-to-10-spine.md` and `TN-LEVEL-ottawa.md`. A subject is a level's
subject; writing a second set of ten subject names is how two screens end up calling the same chapter two
things. `OQ-RESULT-2` records the one thing that is missing to make this work.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-RESULT-08` |
| Single switch | `TN-RESULT-09` |
| Screen reader | `TN-RESULT-10` |
| Reduced motion | `TN-RESULT-11` |
| 200 % text | `TN-RESULT-11` |
| Bilingual | `TN-RESULT-12` |
| Failure path | `TN-RESULT-02` (not passing), `TN-RESULT-07` (a result that cannot be saved or read) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `exam.result.title` | Your exam | Votre examen |
| `exam.result.passed.title` | You passed | Vous avez réussi |
| `exam.result.notYet.title` | Not this time | Pas cette fois |
| `exam.result.score` | Right answers: {{correct}} out of {{total}} | Bonnes réponses : {{correct}} sur {{total}} |
| `exam.result.passMark` | You need {{pass}} out of {{total}} to pass. | Il faut {{pass}} sur {{total}} pour réussir. |
| `exam.result.withTimer` | You took this exam with the timer. | Vous avez fait cet examen avec le chronomètre. |
| `exam.result.noTimer` | You took this exam without the timer. | Vous avez fait cet examen sans chronomètre. |
| `exam.result.bySubject` | How you did, subject by subject | Vos résultats par sujet |
| `exam.result.subjectRow` | {{subject}}: {{correct}} out of {{total}} | {{subject}} : {{correct}} sur {{total}} |
| `exam.result.unanswered.one` | You did not answer {{n}} question. | Vous n'avez pas répondu à {{n}} question. |
| `exam.result.unanswered.other` | You did not answer {{n}} questions. | Vous n'avez pas répondu à {{n}} questions. |
| `exam.result.review` | See every question | Voir toutes les questions |
| `exam.result.noAnswer` | You did not answer this one. | Vous n'avez pas répondu à celle-ci. |
| `exam.result.unavailable` | This question could not be shown. | Cette question n'a pas pu être affichée. |
| `exam.result.practise` | Practise the questions you missed | Réviser les questions manquées |
| `exam.again` | Try the exam again | Refaire l'examen |

Keys this screen draws and does not own:

| Key | Owned by |
|---|---|
| `card.answerIs`, `card.why`, `card.againSoon`, `card.yourAnswer`, `card.correctAnswer` | `TN-CARD-question-card.md` |
| `exam.timer.timeUp.title`, `exam.timer.timeUp.body` | `TN-TIMER-the-exam-clock.md` |
| `common.close`, `common.back` | `TN-SET-settings.md`, `TN-FLOW-first-run-and-return.md` |
| `passport.open` | `TN-PASSPORT-my-passport.md` |
| `study.open` | `TN-STUDY-study-mode.md` |
| `level.<id>.subtitle` | `TN-LEVELS-2-to-10-spine.md`, `TN-LEVEL-ottawa.md` |
| `map.moreComing` | `TN-MAP-level-select.md` |

**Every count on this screen puts its noun in front of the number and a preposition after it**, which is
`TN-COPY`'s rule 1 and the reason `exam.result.score`, `exam.result.passMark` and `exam.result.subjectRow`
carry no plural rows in either language. The one string that could not take that shape,
`exam.result.unanswered`, carries `.one` and `.other` in both languages under rule 2, and its form is chosen
by `Intl.PluralRules` for the active locale — never by comparing the count to 1, which is wrong in French at
zero and wrong in English at nothing at all.

---

## TN-RESULT-01 — Passing

```gherkin
Feature: A result at or above the pass mark
  As a player who has just finished an exam
  I want to know at once whether I passed
  So that the result is the first thing I read, not something I have to work out

  Background:
    Given I answered 17 of 20 questions rightly
    And the exam has finished

  Scenario: The result says so first
    Then the element "exam-result" is visible
    And the event "exam/finished" was emitted with passed true
    And the first line reads "You passed"
    And it shows "Right answers: 17 out of 20"
    And it shows "You need 15 out of 20 to pass."

  Scenario: Exactly the pass mark is a pass
    Given I answered exactly 15 rightly
    Then it shows "You passed"
    And it shows "Right answers: 15 out of 20"

  Scenario: No score is dressed up
    Then no percentage is shown
    And no grade, letter, star, streak, rank or badge is shown
    And nothing on the screen compares me to anybody else

  Scenario: The result says which exam it was
    Given I took the exam with the timer
    Then it shows "You took this exam with the timer."
    Given I took it without
    Then it shows "You took this exam without the timer."
    And neither sentence says one exam is worth more than the other

  Scenario: What I can do from here
    Then controls are offered for "See every question", "Try the exam again" and "Close"
    And each is at least 44 CSS px wide and tall
    And each has a visible text label

  Scenario: The result is saved
    Then the event "progress/saved" is emitted
    And the attempt is recorded with its answers, whether it was timed, and whether it passed
    And it is what the passport shows, as TN-PASSPORT-06 describes
```

## TN-RESULT-02 — Not passing, without the word "failed" (failure path)

```gherkin
Feature: A result below the pass mark
  Background:
    Given I answered 11 of 20 questions rightly
    And the exam has finished

  Scenario: It says what happened, plainly and kindly
    Then the first line reads "Not this time"
    And it shows "Right answers: 11 out of 20"
    And it shows "You need 15 out of 20 to pass."

  Scenario: No word calls the player a failure
    Then the screen does not contain "failed", "fail", "wrong", "error" or "mistake" about me
    And in French it does not contain "échec", "échoué" or "erreur" about me
    And nothing on the screen is red as the only signal of anything

  Scenario: It offers the next thing to do, not a verdict
    Then a control "Practise the questions you missed" is offered
    When I take it
    Then the element "study-screen" is visible
    And the drill it offers contains questions I got wrong in this exam

  Scenario: The questions I got wrong really do come back
    Given I got question A wrong in the exam
    When I run a Study drill afterwards
    Then A is in the drill
    And the promise printed on the card in TN-CARD-04 is kept for exam answers too

  Scenario: Trying again is offered without being pushed
    Then "Try the exam again" is offered
    And it is not the focused control
    And nothing tells me to try again immediately

  Scenario: Zero right is still a result, not an accident
    Given I answered none of them rightly
    Then it shows "Right answers: 0 out of 20"
    And no word in that line differs from the reading at 11 right
    And no error screen is shown
```

## TN-RESULT-03 — Results by subject

```gherkin
Feature: How I did, subject by subject
  As a player deciding what to read next
  I want to see which subjects I did badly in
  So that I revise a chapter rather than everything

  Scenario: One row per subject the exam asked about
    Given the exam drew questions from four subjects
    And the exam has finished
    Then "exam-result-by-subject" shows the heading "How you did, subject by subject"
    And it shows four rows
    And each row is a "subject-row-<id>" element

  Scenario: A row names the subject and counts within it
    Given the exam asked 5 questions about federal elections and I got 3 right
    Then that row reads "Federal elections: 3 out of 5"
    And the subject's name is the same string the level select draws as that level's subject line

  Scenario: The rows add up to the exam
    Then the totals across the rows add up to 20
    And the right answers across the rows add up to the number on the score line

  Scenario: A subject the exam did not ask about is not a row
    Given the exam drew from one subject only
    Then exactly one row is shown
    And no row is drawn for a subject with no questions in this exam
    And no row shows "0 out of 0"

  Scenario: The screen says how much of the game the exam could cover
    Given verified questions exist for one subject only
    Then it shows "Subjects ready: 1 of 10"
    And it shows "More are coming."
    And nothing on the screen suggests the missing subjects are the player's doing

  Scenario: A row is not a colour
    Then each row's numbers are text
    And no row's standing is shown by colour, by a bar or by an icon alone
    And no row is labelled "weak", "poor", "bad" or "failed"

  Scenario: Unanswered questions are counted in their subject's total
    Given I did not answer 3 questions, all about the justice system
    Then the justice system row's total includes those three
    And they are not counted as right
    And the screen also shows "You did not answer 3 questions."

  Scenario: The unanswered line reads correctly at one
    Given I did not answer exactly one question
    Then it shows "You did not answer 1 question."
    And it does not show "1 questions"
```

## TN-RESULT-04 — Seeing every question afterwards

```gherkin
Feature: The review, which is where the learning is
  Background:
    Given the exam has finished
    And I got 14 right, 4 wrong and did not answer 2

  Scenario: Every question is there, in the order it was asked
    When I tap "See every question"
    Then the element "exam-review" is visible
    And it lists 20 items
    And they are in the order the exam asked them
    And each shows the question's wording, not an id

  Scenario: A question I got right
    Then it shows my answer marked "Your answer" and "Correct answer"
    And the marking does not rely on colour alone

  Scenario: A question I got wrong
    Then it shows my answer marked "Your answer"
    And it shows the right option marked "Correct answer"
    And it shows "Why:" followed by the explanation
    And it shows "You will see this question again soon."

  Scenario: A question I did not answer
    Then it shows "You did not answer this one."
    And it shows the right option marked "Correct answer"
    And it shows the explanation
    And no marking calls it wrong

  Scenario: The review is where the whole list lives, at twenty
    Then every missed question is listed, not a sample
    And the list can be read by scrolling down
    And this is the answer OQ-STUDY-4 asked for: a drill of five lists them inline, an exam of twenty lists them here

  Scenario: Leaving the review
    Then a control returns me to the result
    And the result is in the state I left it in
```

## TN-RESULT-05 — What an exam changes, and what it does not

```gherkin
Feature: An exam is a measurement, and one kind of practice
  Scenario: Exam answers count as real answers
    Given I answered question A wrongly in an exam
    Then A's review state is updated as it would be by any other answer
    And A comes back in Study, as TN-RESULT-02 requires

  Scenario: An exam earns no stamp and opens no level
    When an exam finishes, passed or not
    Then no "stamp/earned" event is emitted
    And no level's state on the level select changes
    And the passport's stamp count is unchanged

  Scenario: An exam is not a quest
    When an exam runs from start to result
    Then no "quest/offered", "quest/accepted" or "quest/step-completed" event is emitted
    And no quest tracker appears at any point

  Scenario: The exam does not disturb the drill's daily limit
    Given the exam introduced 20 questions I had never seen
    When I open Study on the same day
    Then the number of unseen questions the drill introduces is still at most the daily limit

  Scenario: The result is recorded once
    When the exam finishes
    Then exactly one finished attempt is added to the saved document
    And no attempt is recorded twice by leaving and returning to the result screen
```

## TN-RESULT-06 — Trying again

```gherkin
Feature: Another exam
  Background:
    Given I have just finished an exam

  Scenario: A new exam starts from the start screen, not from the result
    When I tap "Try the exam again"
    Then the element "exam-start" is visible
    And the timer choice is offered again, as TN-TIMER-01 describes
    And no exam has started until I choose to start one

  Scenario: A new exam is a new draw
    When I start a second exam
    Then it draws 20 questions again
    And no question from the previous exam is drawn, unless fewer questions are ready than two exams need
    And it is still a representative draw, as TN-EXAM-02 requires

  Scenario: There is no waiting period
    Then nothing prevents me starting another exam straight away
    And nothing on screen counts down to when I may

  Scenario: The previous result is not lost by taking another
    Given I passed the first exam and did not pass the second
    Then the passport shows the most recent result, as TN-PASSPORT-06 describes
    And no attempt overwrites another in the saved document

  Scenario: The result screen is not a scoreboard
    Then no history of attempts, best score, average or streak is drawn on it
```

## TN-RESULT-07 — A result that cannot be saved, or cannot be read (failure path)

```gherkin
Feature: The result survives, or says it did not
  Scenario: Storage fails as the exam finishes
    Given writing to local storage fails
    When the exam finishes
    Then the result is shown in full
    And the event "progress/save-failed" is emitted
    And "storage-warning" is visible
    And no message claims the result was saved

  Scenario: A past attempt names a question this build no longer has
    Given a saved attempt names a question that is not in this build
    When I open its review
    Then that item shows "This question could not be shown."
    And the score and the by-subject rows are still the ones the attempt recorded
    And no score is recomputed from a bank that has changed
    And no error screen is shown

  Scenario: A past attempt names a subject this build does not know
    Then that row is shown with the subject id left out rather than drawn raw
    And no placeholder such as "TBD", "???" or an empty box is drawn
    And the row's numbers are still shown

  Scenario: The result can always be left
    Given the element "exam-result" is visible
    Then a control returns me to the title screen
    And nothing on the screen counts down
    And the game is never left with no screen on it
```

## TN-RESULT-08 — The result from the keyboard

```gherkin
Feature: Keyboard-only result
  Background:
    Given I am using a keyboard only
    And the element "exam-result" is visible

  Scenario: Focus lands on the result, not on the body
    Then focus is on "exam-result" or its first heading
    And the first thing read is whether I passed

  Scenario: Every control is reachable in reading order
    When I press "Tab" through the result
    Then "See every question", "Practise the questions you missed", "Try the exam again" and "Close"
      all receive focus, in reading order
    And each activates with "Enter"

  Scenario: The review is operable
    When I open the review with the keyboard
    Then focus moves into it
    And I can read every item by moving through it
    And "Escape" returns me to the result with focus on the control I opened it from
```

## TN-RESULT-09 — The result with one switch

```gherkin
Feature: Single-switch result
  Background:
    Given single-switch mode is on
    And the element "exam-result" is visible

  Scenario: Nothing is chosen for the player
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing has been chosen
    And nothing on screen counts down

  Scenario: Every control is reachable with short and long presses
    When I use only short and long presses
    Then I can reach and choose each control on the result
    And I can open and leave the review
    And I can start another exam

  Scenario: A long list is not a trap
    Given the review of twenty items is open
    When I press the switch briefly through it
    Then the highlight reaches a control that leaves the review, without visiting every item first
```

## TN-RESULT-10 — The result with a screen reader

```gherkin
Feature: Announcing the result
  Scenario: The result is a named screen and is read from the top
    When the exam finishes
    Then "exam-result" has an accessible name that is not empty
    And focus moves to it
    And "#tn-live-region" reads whether I passed and the score line, once

  Scenario: The by-subject rows are a list, or a table with headers
    Then the rows are exposed as a list of items, or as a table whose columns are named
    And each row reads as one phrase, with the subject and both numbers together
    And no number is read separately from the words around it

  Scenario: The score line is one phrase
    Then "exam-result-score" is a single text node in the accessibility tree
    And in French it reads "Bonnes réponses : 17 sur 20"

  Scenario: The review's items are readable one at a time
    Then each review item is a list item or a group with an accessible name
    And an item I did not answer is announced with "You did not answer this one."

  Scenario: Only one thing announces
    Then exactly one element on the page has an "aria-live" attribute
    And the by-subject rows have none of their own

  Scenario: axe-core is clean on the result and the review
    When axe-core runs against the whole page at the result and at the review
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for those scans
    And both scans pass with no violations
```

## TN-RESULT-11 — Reduced motion and 200 % text

```gherkin
Feature: The result honours the accessibility settings
  Scenario: A pass is not a firework
    Given reduced motion is on
    When the exam finishes and I passed
    Then the result appears with no slide, fade, scale or bounce
    And no confetti, particle or stamp animation is drawn
    And nothing counts up

  Scenario: The result is still obvious without motion
    Then whether I passed is a line of text
    And the score is a line of text
    And no meaning depends on something having moved

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the pass line, the score line and the pass-mark line are all fully visible
    And every by-subject row is readable by scrolling down
    And every control is fully visible and at least 44 CSS px tall
    And the page does not scroll sideways

  Scenario: The French lines fit too
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Vous avez fait cet examen sans chronomètre." is visible
    And the whole of "Vos résultats par sujet" is visible
    And no line is truncated with an ellipsis

  Scenario: High contrast
    Given "High contrast" is on
    Then the marks in the review are visible without colour
    And every line meets the contrast requirement against its background
```

## TN-RESULT-12 — The result in French

```gherkin
Feature: The exam result in French
  Background:
    Given the language is French

  Scenario: A pass is French
    Given I answered 17 of 20 rightly
    Then it shows "Vous avez réussi"
    And it shows "Bonnes réponses : 17 sur 20"
    And it shows "Il faut 15 sur 20 pour réussir."
    And there is a space before each colon
    And no English word appears in "exam-result"

  Scenario: Not passing is French, and does not blame me
    Given I answered 11 of 20 rightly
    Then it shows "Pas cette fois"
    And it shows "Bonnes réponses : 11 sur 20"
    And it does not contain "échec", "échoué", "erreur" or "faute" about me
    And the control reads "Réviser les questions manquées"

  Scenario: The score line reads the same way at every value
    Given I answered exactly 1 rightly
    Then it reads "Bonnes réponses : 1 sur 20"
    And no word differs from the reading at 17 right

  Scenario: The by-subject rows are French
    Then the heading reads "Vos résultats par sujet"
    And a row reads "Les élections fédérales : 3 sur 5"
    And each subject's name is the French subject line the level select draws

  Scenario: The unanswered line agrees with its number in French
    Given I did not answer exactly 1 question
    Then it shows "Vous n'avez pas répondu à 1 question."
    And it does not show "1 questions"
    Given I did not answer 3 questions
    Then it shows "Vous n'avez pas répondu à 3 questions."
    And the form is chosen by the plural rules of the active locale

  Scenario: The review is French
    When I tap "Voir toutes les questions"
    Then every prompt, option and explanation is French
    And a question I did not answer shows "Vous n'avez pas répondu à celle-ci."
    And a question I got wrong shows "Vous reverrez cette question bientôt."
    And the marks read "Votre réponse" and "Bonne réponse"

  Scenario: The timer line is French
    Then it shows "Vous avez fait cet examen avec le chronomètre." or "Vous avez fait cet examen sans chronomètre."

  Scenario: No French string on this screen needs gender agreement
    Then no string in "exam-result" contains "(e)", "·e" or a bracketed ending
    And "Vous avez réussi" is used rather than any form that has to agree with the player

  Scenario: Switching language on the result redraws it
    Given the result is showing "You passed"
    When I change the language to French
    Then it shows "Vous avez réussi"
    And every by-subject row is in French
    And the numbers are unchanged
```

---

## Open questions

- **`OQ-RESULT-1` — the saved attempt cannot produce any of this.** `examAttempt` in
  `content/schemas/progress.schema.json` records `askedQuestionIds` and `correctCount`, which is a total and
  not a breakdown, so **results by subject cannot be computed and the review cannot be drawn**.
  `OQ-EXAM-3` carries the recommendation — an `answers` array whose items name the question, its subject, the
  chosen option or null, and whether it was correct. This file is the reason it needs the subject on the
  answer rather than by lookup: a result read a year later must still be readable when the bank has moved on
  (`TN-RESULT-07`). Routed to the architect; `content/` is not this directory's to edit.
- **`OQ-RESULT-2` — nothing maps a subject id to the level whose subject line names it.** The result draws
  `level.<id>.subtitle` for a `subjectId` such as `government`, and the join between the two lives nowhere:
  level documents carry a subject, but no index goes the other way, and two of the ten levels have no id at
  all (`TN-LEVELS`). *Recommendation:* the ten subjects are declared once in `game.config.json`, each with
  its id and the level it belongs to, and the copy key follows from the level. Same gap as `OQ-EXAM-5` and
  `OQ-PASSPORT-2`, seen from a third screen — which is usually the sign that the missing thing is one thing.
- **`OQ-RESULT-3` — should a subject row say what to do about it?** Today one control practises everything
  missed. A per-row "Practise this subject" would be better advice and needs subject-chosen drills, which
  `OQ-STUDY-2` has not decided. *Recommendation:* one control now, per-row controls when Study can take a
  subject. Do not put a control on a row that opens the same drill as every other row.
- **`OQ-RESULT-4` — does the player ever see how many exams they have taken?** No, deliberately: a count of
  attempts is a shaming number for the player who needed six, and an encouraging one for nobody.
  *Recommendation:* keep the most recent result only (`TN-PASSPORT-06`), and never draw a history, an average
  or a best. If a player wants their history, the exported save has it.
- **`OQ-RESULT-5` — is "Not this time" the right heading?** It is honest, it is grade-6 plain, and it is not
  "You failed". It is also slightly softer than the real test's language, which a player rehearsing the real
  thing might find misleading. *Recommendation:* keep it, and put it in front of a newcomer with the first
  usability pass. What must not happen is the heading becoming "Failed" because it is shorter.
- **`OQ-RESULT-6` — should passing the exam be celebrated at all?** Nothing here celebrates: no confetti (it
  is forbidden under reduced motion anyway), no fanfare, no stamp. A game about earning a citizenship test
  pass could reasonably mark the moment. *Recommendation:* if a celebration is wanted, it is a still
  illustration and a sentence, it is on the passport rather than on the result, it depicts no ceremony, no
  oath and no flag-as-emblem, and it never implies the player has passed anything official.
