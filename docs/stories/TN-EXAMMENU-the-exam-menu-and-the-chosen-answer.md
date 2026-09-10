# TN-EXAMMENU — The exam's own menu, and the word for an answer you have chosen

**Intent.** A player inside a practice exam can reach Settings, stop the clock and leave, from a menu that
belongs to the exam rather than to a level — and the option they have chosen is marked with a word that says
it was recorded, not a word that says it was right.

This file exists for the reason `TN-NAMES` and `TN-DIALOGUE` exist: **two strings were being drawn by a
screen and owned by nobody, and three files each pointed at a fourth that did not exist.** `OQ-TIMER-4`
invents the exam's menu and writes no row for it; `OQ-HUD-9` asks the same question from the HUD's side;
`TN-ATTEMPT-01` and `TN-TIMER-04` both say "the exam's menu" and both require an item to be in it. The exam
screen was therefore drawing `hud.menu` and `hud.menu.title`, which `TN-HUD` describes as **the HUD's** — and
`TN-HUD-02` says in as many words that its menu belongs to a level and that Exam mode does not use it. A
screen drawing another screen's keys is how the two stop being able to differ, and these two must be able to
differ: one of them opens over a skater and offers "Leave the level".

Read `README.md` in this directory first. This file owns two rows and rules on two that belong to somebody
else:

| What | Key | Status |
|---|---|---|
| The exam's menu control | `exam.menu` | **Owned here** |
| The name of the dialog it opens | `exam.menu.title` | **Owned here** |
| The word beside a chosen option, during an exam | `card.yourAnswer` | **Ruled on here, owned by `TN-CARD-question-card.md`** |
| The kicker above the verdict on the result | `exam.result.title` | **Ruled on here, owned by `TN-RESULT-exam-results.md`** |

The items *inside* this menu are owned elsewhere and are referenced, never copied:

| Key | Defined in | Drawn by this menu as |
|---|---|---|
| `common.settings` — "Settings" / « Réglages » | `TN-SET-settings.md` | The Settings item |
| `exam.timer.stop` — "Turn the timer off" / « Arrêter le chronomètre » | `TN-TIMER-the-exam-clock.md` | Only while a timed exam is running |
| `exam.leave` — "Leave the exam" / « Quitter l'examen » | `TN-ATTEMPT-leaving-and-resuming-an-exam.md` | The way out |
| `common.close` — "Close" / « Fermer » | `TN-SET-settings.md` | The close control |

## Ruling 1 — the exam's menu is the exam's, and it gets two rows of its own

`OQ-TIMER-4`'s recommendation is taken: **a small menu owned by the exam screen, not the level's menu with
different items.** `OQ-HUD-9` recommended the same thing from the other end and added the constraint this
file keeps — *two menus, one behaviour: modal, named, focus-trapping, escape closes, nothing counts down.*
Both open questions are closed by this file and both should point at it.

Three reasons, and only the first is about the items:

1. **The level's menu offers a way out of a level.** `TN-HUD-02` carries Settings, Study, the passport and
   "Leave the level", and its "Leaving is not offered where there is nothing to leave" scenario already
   forbids that item during an exam. A menu whose fourth item must be suppressed on the screen that draws it
   half the time is two menus wearing one name.
2. **The two menus have different rules about what is safe.** Nothing in a level is losable when the menu
   opens, which is why `OQ-HUD-8` refuses a confirmation. **In an exam something is losable** — an attempt
   that cannot be written to storage — and `TN-ATTEMPT-05` asks once in exactly that case. One component may
   still draw both; the *items and their consequences* are the screen's.
3. **Two keys carrying the same word today is the pattern this directory already uses.** `exam.next` and
   `card.next` are both "Next" and are two keys, because "either may be reworded without the other" —
   `TN-EXAM`'s own copy table says so. `exam.menu` and `hud.menu` are the same case, and the reword that will
   eventually separate them is easy to picture: the level's menu is a pause menu, and the exam's is not,
   because an exam cannot be un-paused into anything.

### Player-facing copy

| Key | EN | FR |
|---|---|---|
| `exam.menu` | Menu | Menu |
| `exam.menu.title` | Exam menu | Menu de l'examen |

**The control says "Menu" and the dialog is named "Exam menu", and that asymmetry is deliberate.** The button
matches `hud.menu` word for word, because a player should learn one word for one thing across the whole game
and because "Menu" is the plainest label either screen will ever have. The **dialog's name** is where the two
have to differ, and it costs a sighted player nothing: it is what a screen reader announces on entry, and
"Menu, dialog" tells somebody who cannot see the screen behind it nothing about where they are, while "Exam
menu, dialog" confirms in two words that the exam is still there and has not been left. `TN-HUD`'s own rule
for `hud.label` is the same one — name what the thing is *for*, not what it is made of.

**It is "Exam menu" and not "Practice exam menu".** `TN-EXAM`'s first decision is that the feature is called
a *practice* exam on screen, so nobody mistakes it for the real test. That decision binds the screens that
**announce** the feature — `title-exam`, the start screen's heading, the result — and a player reading this
dialog's name has already passed all three and pressed "Start the exam". Four words in a dialog name buys
nothing there and costs a screen-reader user two seconds on every open. Recorded as `OQ-EXAMMENU-1` in case a
reviewer disagrees; the change is one row.

**`exam.menu` is the same word in English and in French and is written twice, not shared** — the rule
`TN-NAMES-03` and `TN-MOVE-06` already fix for `locomotion.train.label`.

## Ruling 2 — the chosen option keeps `card.yourAnswer`, and the *shape* beside it is what has to change

`TN-EXAM-03` requires a chosen option to be "marked as chosen, by a word and a shape and not by colour
alone". The Exam work reached for `card.yourAnswer` — "Your answer" / « Votre réponse » — and `TN-EXAM`'s
"keys this screen draws and does not own" table does not list it.

**The key is right and the table is wrong.** `TN-CARD-question-card.md` already settled the ownership in
prose, one line under its copy table: *"`card.progress`, `card.answerIs`, `card.why`, `card.againSoon`,
`card.yourAnswer` and `card.correctAnswer` are drawn by the exam too — by the card during an exam and by the
review afterwards. They stay here."* `TN-RESULT`'s not-owned table lists all five. `TN-EXAM`'s lists two.
This is a missing directory row, not a missing string, and it is the third time this directory has found one
(`README.md`: *a gap reported under `TN-COPY-06` is a debt, not a home*).

**A separate `exam.chosen` row was considered and refused.** The words would have been "Your choice" /
« Votre choix », and the cost is the thing this project is least willing to pay: a player would meet two
different words for one thing inside one feature, minutes apart — "Your choice" while answering, "Your
answer" in the review that follows on the next screen. At CLB 4 that is not a nuance, it is a second word to
learn for no gain. Sharing is right here by `README.md`'s own test: the two screens state **the same fact
about the same thing** — *this is the option you picked* — and they must never disagree, which is the
`passport.state.earned` / `map.stamps` case rather than the `level.complete.score` / `study.summary.score`
one.

**What genuinely differs is the shape, and that is where the real defect is.** In `TN-CARD-04` "Your answer"
is drawn beside a **cross**, because the player has just been marked. In `TN-RESULT`'s review it is drawn
beside a tick or a cross for the same reason. **In a running exam there is no mark yet**, and the game has
just promised in printed copy that there will not be one — `exam.noFeedback`: "You will see how you did at
the end." A tick beside a chosen option during an exam is feedback the exam said it would not give, and a
cross is worse. So:

> **During a running exam, the shape beside `card.yourAnswer` is a neutral chosen-state mark — a filled
> indicator — and never a tick and never a cross.** It says *recorded*, not *right*.

That is a rule about the exam's card, so it is written here with the ruling that produced it, and
`TN-EXAM-03`'s scenario should point at it. The complement is already written and already owned:
`exam.notAnsweredYet` — "Not answered yet" / « Pas encore répondu » — is `TN-EXAM`'s, and the pair a player
meets inside an exam is "Your answer" / "Not answered yet", which is one register and one vocabulary.

**Rows `TN-EXAM`'s not-owned table needs**, and this file is the record of it until that table is amended:

| Key | Owned by |
|---|---|
| `card.yourAnswer` | `TN-CARD-question-card.md` |
| `exam.menu`, `exam.menu.title` | this file |

## Ruling 3 — `exam.result.title` is the result screen's *name*, not a line above the verdict

Flagged rather than changed, and the ruling is: **no, a kicker above the verdict is wrong, and the row is not
wrong.**

`TN-RESULT-01`'s first scenario says *"the first line reads 'You passed'"*, and its user story says the
result should be *"the first thing I read, not something I have to work out"*. A visible "Your exam" above it
makes the first line a player reads a label they already knew — they pressed "Finish the exam" four seconds
ago — and pushes the one sentence the whole screen exists for into second place. `TN-RESULT-02` is the case
that decides it: a player who did not pass reads "Your exam", then "Not this time". The kicker is a pause
before bad news, which is the one place a screen should be quickest.

**But the row is needed, and `TN-RESULT` already requires it without naming it.** `TN-RESULT-10`'s first
scenario says *"`exam-result` has an accessible name that is not empty"* and names no key for it —
`exam.result.title` is that string, and it is the only row in `TN-RESULT`'s copy table that no scenario in
that file draws. Used as the screen's accessible name it does three jobs at once: it satisfies
`TN-RESULT-10`, it is what a screen-reader user hears on arrival *before* the live region reads the verdict
and the score, and it never occupies a visible line.

So:

- `exam.result.title` — "Your exam" / « Votre examen » — is the **accessible name of `exam-result`**, carried
  as `aria-label` or as a visually hidden heading the region points at. The mechanism is not fixed; the
  accessible name is.
- The **first visible line** of `exam-result` is `exam.result.passed.title` or `exam.result.notYet.title`.
- **A screen-reader user hearing the name and then the verdict is not a repetition to remove.** "Your exam"
  and "You passed" are two different sentences and the second is not derivable from the first, which is the
  argument `OQ-DONE-3` already accepted for the play button and its description.

If a designer wants a visible title, the two honest options are recorded rather than argued again: the
verdict itself becomes the screen's heading and this row is deleted, or "Your exam" moves **below** the score
line as a label for the review. What must not happen is a label sitting above a verdict.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-EXAMMENU-03` |
| Single switch | `TN-EXAMMENU-03` |
| Screen reader | `TN-EXAMMENU-04`, and `TN-EXAMMENU-06` for the chosen state |
| Reduced motion | `TN-EXAMMENU-04` |
| 200 % text | `TN-EXAMMENU-04` |
| Bilingual | `TN-EXAMMENU-05` |
| Failure path | `TN-EXAMMENU-02` — the wrong menu, a missing row, an item that should not be there |

## DOM markers this file adds

| `data-testid` | What it marks |
|---|---|
| `exam-menu-button` | The control inside `exam-screen` that opens the exam's menu. Named by `exam.menu`. |
| `exam-menu` | The dialog it opens. Named by `exam.menu.title`. Never present outside a running exam. |

They are deliberately **not** `menu-button` and `menu`: those are `TN-HUD`'s, and a test that cannot tell the
two menus apart is a test that would have passed while the exam drew the level's.

---

## TN-EXAMMENU-01 — The exam has a menu, and it is the exam's

```gherkin
Feature: A menu inside a running exam
  As a player halfway through a practice exam
  I want to reach Settings, the clock and the way out
  So that I am not trapped in the one screen in this game that can be lost

  Background:
    Given an exam of 20 questions is running

  Scenario: The control is there and says one word
    Then the element "exam-menu-button" is visible and reads "Menu"
    And it is at least 44 CSS px wide and tall
    And it has a visible text label, not an icon alone

  Scenario: Opening it opens the exam's menu, not the level's
    When I tap "exam-menu-button"
    Then the element "exam-menu" is visible
    And the element "menu" is not present
    And the accessible name of "exam-menu" is "Exam menu"

  Scenario: What is in it
    Given "exam-menu" is visible
    Then an item reading "Settings" is offered
    And an item reading "Leave the exam" is offered
    And a control reading "Close" is offered
    And each is at least 44 CSS px wide and tall

  Scenario: The timer item is there only when there is a timer
    Given the exam is timed
    And "exam-menu" is visible
    Then an item reading "Turn the timer off" is offered, as TN-TIMER-04 requires
    Given the exam is not timed
    And "exam-menu" is visible
    Then no item about a timer is offered
    And nothing on the menu offers to turn one on

  Scenario: What is not in it
    Given "exam-menu" is visible
    Then no item reads "Leave the level"
    And no item opens the passport, as OQ-PASSPORT-6 decided
    And no item opens Study
    And no item finishes the exam

  Scenario: Opening it pauses the clock and answers nothing
    Given the exam is timed with 20 minutes left
    When I open "exam-menu"
    Then "exam-clock" shows "Timer paused", as TN-TIMER-03 requires
    And no answer has been recorded
    And the question behind it is unchanged

  Scenario: Closing it puts me back where I was
    Given "exam-menu" is visible
    When I choose "Close"
    Then the element "exam-menu" is gone
    And the same question is shown
    And the clock is running again if it was running before
    And focus returns to "exam-menu-button"

  Scenario: Nothing in it counts down
    Given "exam-menu" is visible
    When I do nothing for two minutes
    Then the menu is unchanged
    And nothing on it counts down
    And no item has been chosen for me
    And the exam has not finished
```

## TN-EXAMMENU-02 — The wrong menu, and a row that is not there (failure path)

```gherkin
Feature: The two menus cannot be confused, and neither can go missing
  Scenario: The level's menu can never open over an exam
    Given an exam is running
    Then the element "menu-button" is not present
    And the element "menu" is not present
    And no string drawn during an exam reads "Leave the level"
    And this is TN-HUD-02's rule seen from the other side

  Scenario: The exam's menu can never open over a level
    Given a level is playable
    Then the element "exam-menu-button" is not present
    And the element "exam-menu" is not present
    And no string drawn in a level reads "Leave the exam"

  Scenario: The exam screen may not draw the HUD's keys
    Then no string drawn inside "exam-screen" is read from "hud.menu" or "hud.menu.title"
    And a build in which it is fails the content check, naming both keys and this file

  Scenario: A missing row fails the build, never draws another screen's
    Given no "exam.menu" row exists in English and in French
    When the content check runs
    Then the build fails, naming the key and pointing at this file
    And the same check fails for a missing "exam.menu.title"
    And the exam screen does not fall back to "hud.menu"

  Scenario: A row present in one language only fails the same check
    Given "exam.menu.title" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: The menu never becomes a second way to finish
    Given "exam-menu" is visible
    Then no item on it emits "exam/finished"
    And leaving emits "exam/left", as TN-ATTEMPT-01 describes
    And the two are never the same control

  Scenario: The gates are proven by failing fixtures
    Then a fixture exists for each check above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite
```

## TN-EXAMMENU-03 — The menu from the keyboard and with one switch

```gherkin
Feature: Everybody can reach the way out of an exam
  Background:
    Given an exam of 20 questions is running

  Scenario: Reaching and opening it with a keyboard
    Given I am using a keyboard only
    Then "exam-menu-button" is reachable with "Tab" and activates with "Enter"
    When I open it
    Then focus is inside "exam-menu"
    And "Tab" cannot leave it while it is open
    And each focus indicator is visible and is not colour alone

  Scenario: Escape closes the menu and nothing else
    Given "exam-menu" is visible
    And I am using a keyboard only
    When I press "Escape"
    Then the menu closes
    And the exam is not finished and not left
    And no answer was changed
    And focus returns to "exam-menu-button"

  Scenario: The menu is completable with one switch
    Given single-switch mode is on
    When I press the switch briefly through the whole menu
    Then the highlight visits every item and the close control, and wraps
    And each item's name is announced as the highlight arrives
    When I hold the switch past the hold-to-choose threshold on "Leave the exam"
    Then the exam is left, as TN-ATTEMPT-01 describes

  Scenario: Nothing scans and nothing expires, including the clock
    Given single-switch mode is on
    And the exam is timed
    And "exam-menu" is visible
    When I do nothing for two minutes
    Then the highlight has not moved
    And no item has been chosen for me
    And the clock has not moved, because it is paused

  Scenario: The menu is where a switch user stops the clock
    Given single-switch mode is on
    And a timed exam is running
    Then "Turn the timer off" is reachable with short presses and chosen with a long press
    And nothing about reaching it is timed
```

## TN-EXAMMENU-04 — The menu with a screen reader, with motion off, and at 200 %

```gherkin
Feature: The menu announces what it is and fits
  Scenario: It is a named dialog and it says which menu it is
    When "exam-menu" opens
    Then it has role "dialog" with "aria-modal" true
    And its accessible name is "Exam menu"
    And it is not "Menu"
    And the rest of the page is inert while it is open

  Scenario: Opening and closing are announced once each
    When "exam-menu" opens
    Then "#tn-live-region" says so once
    And it is not repeated while the menu stays open
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Reduced motion
    Given reduced motion is on
    When "exam-menu" opens
    Then it appears with no slide, fade, scale or bounce
    And nothing on it pulses or flashes
    And nothing about it depends on having seen it arrive

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every item is fully visible, by scrolling inside the menu if needed
    And no label is truncated with an ellipsis
    And every item is still at least 44 CSS px wide and tall
    And the page does not scroll sideways

  Scenario: The longest French item fits
    Given text scaling is 200 %
    And the language is French
    Then the dialog's accessible name is the whole of "Menu de l'examen"
    And the whole of "Quitter l'examen" is visible on its item
    And the whole of "Arrêter le chronomètre" is visible on its item when a timer is running

  Scenario: axe-core is clean with the menu open
    When axe-core runs against the whole page with "exam-menu" open
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
```

## TN-EXAMMENU-05 — The menu in French, and the two rulings in French

```gherkin
Feature: The exam's own words in French
  Background:
    Given the language is French
    And an exam of 20 questions is running

  Scenario: The control and the dialog are French
    Then "exam-menu-button" reads "Menu"
    When I open it
    Then the accessible name of "exam-menu" is "Menu de l'examen"
    And the items read "Réglages", "Quitter l'examen" and "Fermer"
    And a timed exam also shows "Arrêter le chronomètre"
    And no English word appears in "exam-menu"

  Scenario: A row whose two languages are the same word is written twice
    Then "exam.menu" has a value declared in "en" and a value declared in "fr"
    And neither language falls back to the other's value
    And a missing French value fails the check even though the screen would read correctly

  Scenario: The chosen option is marked in French, with no verdict in it
    When I choose "option-2"
    Then it is marked "Votre réponse"
    And it is not marked "Votre choix"
    And it does not read "Bonne réponse" or "Pas tout à fait."
    And the mark beside it is neutral, not a tick and not a cross

  Scenario: The unanswered complement is the same register
    Given I skipped question 1
    When I come back to it
    Then it shows "Pas encore répondu"
    And the two states a player meets inside an exam are "Votre réponse" and "Pas encore répondu"

  Scenario: The result screen is named, and the verdict is still the first line
    Given I finish the exam having answered 17 rightly
    Then the accessible name of "exam-result" is "Votre examen"
    And the first visible line reads "Vous avez réussi"
    And "Votre examen" is not drawn above it

  Scenario: No French string in this file needs gender agreement
    Then no string it owns contains "(e)", "·e" or a bracketed ending
```

## TN-EXAMMENU-06 — The chosen option says recorded, never right

```gherkin
Feature: A word and a shape that promise nothing
  Background:
    Given an exam of 20 questions is running

  Scenario: The word is the one the review will use
    When I tap "option-2"
    Then "option-2" is marked with the words "Your answer"
    And the same words mark the same option in the review afterwards
    And no second word for the same idea appears anywhere in the exam

  Scenario: The shape says recorded, not right
    Then the mark beside "Your answer" is a neutral chosen-state indicator
    And it is not a tick
    And it is not a cross
    And nothing about it differs between an option that is right and one that is not
    And the marking does not rely on colour alone

  Scenario: The promise printed on the start screen is kept
    Given the start screen said "You will see how you did at the end."
    Then nothing on any question during the exam says whether an answer was right
    And "question-feedback" and "question-explanation" are absent, as TN-EXAM-03 requires
    And a build that draws a tick beside a chosen option fails this scenario

  Scenario: Exactly one option carries it
    Given I chose "option-2" and then chose "option-0"
    Then "option-0" is marked "Your answer" and "option-2" is not
    And exactly one option on the question is marked

  Scenario: An unanswered question says so in the complementary words
    Given I skipped question 1
    When I come back to it
    Then it shows "Not answered yet"
    And no option is marked "Your answer"

  Scenario: The word reaches the accessibility tree as state, not only as text
    Then the chosen option reports its chosen state to the accessibility tree,
      as TN-EXAM-08 requires
    And "Your answer" is text as well, because a state a screen reader announces
      is not a state a sighted player can see
```

---

## Open questions

- **`OQ-EXAMMENU-1` — "Exam menu" or "Practice exam menu"?** `TN-EXAM`'s first decision is that the feature
  is a *practice* exam wherever it is announced, and this dialog's name is the one place the shorter form is
  used. *Recommendation:* keep "Exam menu" / « Menu de l'examen ». The player has already read "Practice
  exam" on the title screen, on the start screen's heading and on the button they pressed, and a fourth
  restatement inside a menu is length a screen-reader user pays for on every open. If a reviewer disagrees,
  one row changes and no scenario above changes shape.
- **`OQ-EXAMMENU-2` — should the two menus share a component?** `OQ-HUD-9` recommends two menus with one
  behaviour, and this file takes that. Nothing here forbids one implementation with two sets of items — the
  scenarios assert testids, names and items, never a module. *Recommendation:* share the component if it
  helps, and keep the two `data-testid` values distinct whatever happens, because `TN-EXAMMENU-02`'s first
  two scenarios are the only thing standing between this defect and its return. Routed to the UI agent;
  `app/` is not this directory's to edit.
- **`OQ-EXAMMENU-3` — where does the menu control sit on the exam screen, and does it compete with "Finish
  the exam"?** `TN-EXAM-03` puts `exam-previous`, `exam-next` and `exam-finish` on the screen and
  `TN-EXAM-07` puts them in the switch ring in that order; this file adds a fifth control and does not say
  where it goes in the ring. *Recommendation:* the menu is **last** in the ring and visually separate from
  the three that move through the exam, so that a switch user cycling towards the next question never lands
  on the way out first. Written as a recommendation rather than a scenario because `TN-EXAM-07` owns the ring
  and should be the file that states its order. **Routed to `TN-EXAM`'s owner with the two table rows this
  file records above** — the ring, the not-owned rows and `TN-EXAM-03`'s pointer at `TN-EXAMMENU-06` are one
  small amendment, not three.
- **`OQ-EXAMMENU-4` — `TN-RESULT` has not been amended to say that `exam.result.title` is an accessible
  name.** Ruling 3 is written here because the drawing decision was made by the Exam build and questioned
  from outside `TN-RESULT`; the row itself stays `TN-RESULT`'s and its copy table is unchanged.
  *Recommendation:* `TN-RESULT-01` gains "and no line is drawn above it", `TN-RESULT-10`'s first scenario
  names the key it has always been requiring, and both point here — three lines in one file, and this open
  question closes. Recorded rather than done, because a file's owner should not discover a ruling about its
  own row by reading a diff.
- **`OQ-EXAMMENU-5` — the neutral shape is specified as a behaviour and drawn by nobody.** Ruling 2 says the
  mark beside "Your answer" during an exam is neither a tick nor a cross, and `TN-CARD` and `TN-RESULT` both
  specify a tick and a cross for the screens they own. Nothing yet says what the neutral one *is*.
  *Recommendation:* a filled indicator of the same shape as the unchosen option's empty one — the radio
  pattern every player already knows — so that "chosen" and "not chosen" differ by fill and not by symbol,
  and no symbol in the exam carries a verdict. That is a visual decision and belongs to the UI agent and to
  `assets/style/art-bible.md`'s owner; `TN-EXAMMENU-06` is written so that a tick fails it whatever is
  chosen.
- **`OQ-EXAMMENU-6` — nothing yet says whether Settings opened from this menu can change the language
  mid-exam, and `TN-EXAM-10` says it can.** `TN-EXAM-10`'s last scenario changes the language during an exam
  and requires the same question, the same progress and the same four answers — which means Settings is
  reachable from inside the exam, which means from this menu, which means this menu is on the route of a
  scenario in another file. *Recommendation:* keep it; the alternative is a player who picked the wrong
  language on question one having to abandon an attempt. Recorded because closing Settings must return to the
  **question**, not to this menu — the rule `TN-HUD-02` already states for the level's menu — and no scenario
  in either file says so about this one yet.
