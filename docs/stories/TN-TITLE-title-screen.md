# TN-TITLE — The title screen: the first thing a cold load shows

**Intent.** A player who opens the game — for the first time or for the twentieth — lands on one screen that
says what this is, and offers exactly the ways in that are true for them.

This story exists because the game has no front door. `app/bootstrap` mounts four things and the only way
into a level is a `?level=` URL parameter, so a player opening the deployed page is told "there is no level
to play yet" — a caption behaving correctly on a game with no entrance. Roughly 4,000 lines of built,
tested UI have no consumer. The title screen is the consumer.

Read `README.md` in this directory first: it fixes the shared markers, the event names, the single-switch
contract and the waiting rules these scenarios use. `TN-MAP-level-select.md` owns the screen the Play
control opens; `TN-FLOW-first-run-and-return.md` owns the route between them and what "returning" means.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-TITLE-05` |
| Single switch | `TN-TITLE-06` |
| Screen reader | `TN-TITLE-07` |
| Reduced motion | `TN-TITLE-08` |
| 200 % text | `TN-TITLE-08` |
| Bilingual | `TN-TITLE-09` |
| Failure path | `TN-TITLE-03` (a control that could lose a game), `TN-TITLE-04` (the save cannot be read; storage is blocked) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `title.game` | TrueNorth | TrueNorth |
| `title.tagline` | Get ready for the Canadian citizenship test. | Préparez-vous à l'examen de citoyenneté canadienne. |
| `title.notOfficial` | This game is not made by the Government of Canada. | Ce jeu n'est pas fait par le gouvernement du Canada. |
| `title.play` | Play | Jouer |
| `title.continue` | Continue | Continuer |
| `title.lastPlayed` | Last played: {{level}} | Dernier niveau : {{level}} |

Four strings this screen draws are defined elsewhere and are referenced, never copied:

| Key | Defined in | Drawn by the title screen as |
|---|---|---|
| `map.open` | `TN-MAP-level-select.md` | The "Choose a level" item a returning player sees |
| `study.open` | `TN-STUDY-study-mode.md` | The Study item |
| `common.settings` | `TN-SET-settings.md` | The Settings item |
| `storage.warning`, `storage.warning.help` | `TN-SAVE-save-and-reload.md` | `storage-warning`, per `OQ-HUD-3` |

**`title.game` is the same in both languages and is never translated**, like the language names in
`TN-SET`. It is the product's name, not a description of it.

**`title.lastPlayed` is a label, not a sentence, and that is deliberate.** The obvious English — "You were
in Ottawa" — needs a preposition in front of a place name, and French does not use one preposition for all
ten places (« à Ottawa », but « dans le Nord », « dans les Prairies »). A template whose correctness depends
on which place name lands in it is `TN-COPY`'s worked example in another costume. Putting the noun in front
of the placeholder and following the placeholder with nothing removes the problem in both languages, which
is `TN-COPY`'s counting rule 1 applied to a preposition instead of to a plural.

**`title.notOfficial` is on the screen, not in a credits page nobody opens.** This game teaches an official
exam, ships publicly, and is not from IRCC. One plain sentence, in the language the player is reading, is
the honest version of that; a logo-shaped wordmark and a patriotic splash without it is not. See
`OQ-TITLE-4` for what is *not* settled: whether legal wants particular wording.

---

## TN-TITLE-01 — A first-time player opens the game

```gherkin
Feature: The title screen on a cold load, with no saved game
  As somebody opening this game for the first time
  I want one screen that tells me what it is and how to start
  So that the first thing I see is not a level that does not exist

  Background:
    Given I have no saved game
    When I open the game

  Scenario: The title screen is what a cold load shows
    Then the element "title-screen" is visible
    And the event "title/opened" is emitted
    And it shows "TrueNorth"
    And it shows "Get ready for the Canadian citizenship test."
    And the element "playable" is not present
    And no level has started loading

  Scenario: The ways in are the ones that are true for me
    Then the element "title-play" is visible and reads "Play"
    And the element "title-study" is visible and reads "Study"
    And the element "title-settings" is visible and reads "Settings"
    And the element "title-continue" is not present in the accessibility tree
    And the element "title-choose-level" is not present in the accessibility tree

  Scenario: Continue is absent, not greyed out
    Then no control on "title-screen" is drawn disabled
    And no control is drawn and then ignored when it is activated
    And nothing on the screen mentions continuing a game I do not have

  Scenario: Play is where the eye and the focus start
    Then "title-play" is the first control in reading order
    And it is the control that has focus when the screen opens
    And every control on "title-screen" is at least 44 CSS px wide and tall
    And each has a visible text label, not an icon alone

  Scenario: Play begins the first run
    When I tap "title-play"
    Then the flow described in TN-FLOW-01 begins
    And the element "character-creator" becomes visible

  Scenario: Study is reachable before there is anything to study
    When I tap "title-study"
    Then the element "study-screen" is visible
    And it shows the empty state described in TN-STUDY-03
    And I can return to "title-screen" from it

  Scenario: The game does not claim to be official
    Then the screen shows "This game is not made by the Government of Canada."
    And no wordmark, coat of arms, flag-as-logo or departmental name is drawn on the screen
    And no text on the screen says the game is approved, official or endorsed

  Scenario: Nothing on this screen counts down
    When I do nothing for two minutes
    Then "title-screen" is unchanged
    And nothing has been chosen for me
    And no level has started loading
```

## TN-TITLE-02 — A returning player opens the game

```gherkin
Feature: The title screen with a saved game
  As somebody coming back to a game I started
  I want to carry on in one tap
  So that coming back costs me less than starting did

  Background:
    Given I have a saved game with a character
    And the level I last played is Ottawa
    When I open the game

  Scenario: Continue is first, and says where it goes
    Then the element "title-continue" is visible and reads "Continue"
    And it is the first control in reading order
    And it has focus when the screen opens
    And the screen shows "Last played: Ottawa"

  Scenario: Continue opens the level I was in
    When I tap "title-continue"
    Then the route described in TN-FLOW-02 is taken
    And the Ottawa level loads
    And the element "character-creator" is never shown

  Scenario: The other way in is named for where it goes
    Then the element "title-choose-level" is visible and reads "Choose a level"
    And the element "title-play" is not present in the accessibility tree
    When I tap "title-choose-level"
    Then the element "level-select" is visible

  Scenario: Study and Settings are in the same places they were
    Then "title-study" reads "Study" and "title-settings" reads "Settings"
    And they are in the same order as they are for a first-time player

  Scenario: A returning player is not asked to make a character again
    Then the element "character-creator" is not shown
    And nothing on the screen offers to start a new game

  Scenario: Coming back with no level ever played
    Given my saved game has a character and no level has ever been opened
    Then "title-continue" is not present in the accessibility tree
    And "title-choose-level" is visible and has focus
    And no line saying "Last played" is drawn
```

## TN-TITLE-03 — No control on this screen can lose a game (failure path)

```gherkin
Feature: The title screen never destroys progress
  Scenario: Play and Continue are never offered side by side
    Given I have a saved game
    Then exactly one of "title-play" and "title-continue" is present
    And a player is never asked to guess whether "Play" replaces the game they have

  Scenario: Nothing here deletes anything
    When I activate every control on "title-screen" in turn and return each time
    Then no saved value is written except the settings I changed myself
    And the character, the quest state, the stamps and the answers are unchanged
    And deleting progress is only possible where TN-SAVE-06 puts it, inside Settings

  Scenario: The title screen does not start a level by itself
    Then no level is fetched until I choose one
    And "scene-state" is not present
    And no waiting message is shown, because nothing is being waited for

  Scenario: Returning to the title does not restart the game
    Given I opened Ottawa and came back to "title-screen" as TN-FLOW-03 describes
    Then "title-continue" is present and reads "Continue"
    And the quest state, the answers and the stamps are unchanged
```

## TN-TITLE-04 — The saved game cannot be read, or nothing can be saved (failure path)

```gherkin
Feature: The title screen when persistence is broken
  Scenario: A save that cannot be read is handled before the title, not by hiding it
    Given the saved value is broken
    When I open the game
    Then the element "save-error" is visible, as TN-SAVE-04 describes
    And "title-continue" is not offered while that screen is up
    When I choose "Start again"
    Then "title-screen" is shown as it is for a first-time player

  Scenario: Storage is blocked
    Given local storage cannot be read or written
    When I open the game
    Then "title-screen" is visible
    And the element "storage-warning" says "This browser is not saving your progress."
    And it says "You can keep playing, but everything will be gone when you close the tab."
    And it is announced once through "#tn-live-region"
    And "title-continue" is not present, because there is nothing to continue
    And "title-play" is present and works

  Scenario: The warning does not block the way in
    Given "storage-warning" is visible on "title-screen"
    Then it is not something I have to dismiss to reach "title-play"
    And it does not cover any control
    And it has no "aria-live" attribute of its own

  Scenario: A save that names a level that does not exist
    Given my saved game says the level I last played is "quebec-city"
    And no level document with that id exists in this build
    When I open the game
    Then "title-continue" is not present
    And "title-choose-level" is visible and has focus
    And no error screen is shown, because nothing is wrong with my game
    And nothing on the screen reads as a fault

  Scenario: The title screen is reached even when the level catalogue is empty
    Given no level document exists in this build
    When I open the game
    Then "title-screen" is visible with "TrueNorth" and its tagline
    And "title-play" is still present
    And choosing it reaches the state TN-MAP-04 describes, not an error
```

## TN-TITLE-05 — The title screen from the keyboard

```gherkin
Feature: Keyboard-only title screen
  Background:
    Given I am using a keyboard only
    And the element "title-screen" is visible

  Scenario: Every control is reachable in the order it is read
    When I press "Tab" through "title-screen"
    Then every control receives focus once, in reading order
    And each focused control has a focus indicator that is not colour alone
    And focus never lands on a control that does nothing

  Scenario: Focus starts on the primary control, not on the body
    Then focus is on "title-continue" when one is offered
    And on "title-play" when one is not
    And it is not on the document body

  Scenario: Enter chooses
    When focus is on the primary control and I press "Enter"
    Then the route that control names is taken

  Scenario: Nothing traps the keyboard
    Then "title-screen" is not a dialog and does not trap "Tab"
    When I open Settings from it and press "Escape"
    Then focus returns to "title-settings"
```

## TN-TITLE-06 — The title screen with one switch

```gherkin
Feature: Single-switch title screen
  Background:
    Given single-switch mode is on
    And the element "title-screen" is visible

  Scenario: Nothing moves on its own
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing has been chosen
    And nothing on screen counts down

  Scenario: Short press moves, long press chooses
    When I press the switch briefly
    Then the highlight moves to the next control and is announced in "#tn-live-region"
    When I press the switch briefly until the highlight returns to the first control
    Then the highlight is on the first control again
    When I hold the switch past the hold-to-choose threshold set by "Hold time"
    Then that control's route is taken

  Scenario: Settings is reachable with the switch from the very first screen
    When I use only short and long presses
    Then I can reach and choose "Settings"
    And I can change "Hold time" there, as TN-SET-09 describes
    And I never need a second input to get there

  Scenario: The whole screen is completable with the switch alone
    When I use only short and long presses
    Then I can reach every control on "title-screen"
    And I can start a game
```

## TN-TITLE-07 — The title screen with a screen reader

```gherkin
Feature: Announcing the title screen
  Scenario: The page has a landmark and a name
    When "title-screen" is visible
    Then the page has exactly one element with role "main"
    And every piece of visible text on the page is inside a landmark
    And "title-screen" has an accessible name that is not empty
    And the heading of the screen names the game

  Scenario: The canvas is not read here either
    Then any canvas on the page is "aria-hidden"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Each control says what it does, not what it is
    Then each control is a button with an accessible name that is a word or a phrase
    And no control's accessible name is "Button", "Link", "Item" or empty
    And "title-continue" is announced with the level it would open

  Scenario: The state of the game is readable, not inferred from what is missing
    Given I have a saved game
    Then "Last played: Ottawa" is in the accessibility tree as text
    And it is not the only way to know that Continue exists

  Scenario: Arriving is announced once
    When "title-screen" opens
    Then "#tn-live-region" reads a message naming the game and the screen, once
    And it is not repeated while I stay on the screen

  Scenario: axe-core is clean on this screen
    When axe-core runs against the whole page
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
```

## TN-TITLE-08 — Reduced motion and 200 % text

```gherkin
Feature: The title screen honours the settings it can open
  Scenario: Reduced motion
    Given reduced motion is on
    When "title-screen" opens
    Then nothing on it slides, fades, scales, pulses or parallaxes
    And no particle, snowflake or confetti is drawn
    And any art behind the controls is still, and is not the only signal of anything

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When "title-screen" is visible
    Then the page does not scroll sideways
    And the whole of every control's label is visible, not cut off
    And every control is still at least 44 CSS px wide and tall
    And "title-settings" is reachable, by scrolling down if needed

  Scenario: The longest string still fits
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Ce jeu n'est pas fait par le gouvernement du Canada." is readable
    And it does not overlap any control

  Scenario: The dyslexia-friendly font does not break the layout
    Given "setting-dyslexia-font" is on
    And text scaling is 200 %
    Then no text overlaps another element

  Scenario: Landscape is handled the way the level handles it
    When I turn the phone to landscape
    Then the rotate overlay is visible, as TN-LEVEL-12 describes
    And returning to portrait shows "title-screen" unchanged
```

## TN-TITLE-09 — The title screen in French

```gherkin
Feature: The title screen in French
  Background:
    Given the language is French

  Scenario: Every visible string is French
    When "title-screen" is visible
    Then it shows "Préparez-vous à l'examen de citoyenneté canadienne."
    And "title-play" reads "Jouer"
    And "title-study" reads "Réviser"
    And "title-settings" reads "Réglages"
    And no English word appears on the screen except "TrueNorth"
    And the document's "lang" is "fr"

  Scenario: The game's name is not translated
    Then the heading reads "TrueNorth"
    And it is the same string in both languages

  Scenario: A returning player's controls are French
    Given I have a saved game and the level I last played is Ottawa
    Then "title-continue" reads "Continuer"
    And the screen shows "Dernier niveau : Ottawa"
    And there is a space before the colon and none before any question mark
    And "title-choose-level" reads "Choisir un niveau"

  Scenario: The disclaimer is French
    Then it reads "Ce jeu n'est pas fait par le gouvernement du Canada."

  Scenario: No French string on this screen needs gender agreement
    Then no string on "title-screen" contains "(e)", "·e" or a bracketed ending
    And no string addresses the player with a form that has to agree

  Scenario: The first run follows the browser, and the player wins after that
    Given the browser asks for French and I have no saved game
    When I open the game
    Then "title-screen" is French
    Given I then set the language to English in Settings
    When I close the tab and open the game again
    Then "title-screen" is English
    And no French screen is shown at any point during the load

  Scenario: The whole page is scanned in French too
    When axe-core runs against the whole page in French
    Then no axe rule is disabled for this scan
    And the scan passes with no violations
```

---

## Open questions

- **`OQ-TITLE-1` — is "Play" the right word for a study tool?** The audience includes adults preparing for
  an exam, and some of them will not describe what they are doing as playing. *Recommendation:* keep "Play"
  / « Jouer ». It is one syllable, it is what the control does, and the alternative ("Start" / « Commencer »)
  is what `creator.start` already says two screens later. Revisit with the first real newcomer feedback, not
  by argument.
- **`OQ-TITLE-2` — does the title screen show any progress at all?** A returning player might want to see
  their stamps without opening the map. *Recommendation:* no. `TN-MAP-01` puts the stamp count on the map,
  where the stamps are; a second copy on the title is a second place for it to be wrong, and this directory's
  rule is one string, one home. The line the title *does* carry — "Last played: Ottawa" — is a route, not a
  score.
- **`OQ-TITLE-3` — is there a credits route from here?** `docs/content-review.md` §10.2 requires the "About
  this place" panel to be reachable *from the credits screen*, and no story owns a credits screen. ADR-0004
  requires attribution for every third-party asset, which has to be reachable from somewhere.
  *Recommendation:* a credits item on this screen, specified in its own small story before F5, rather than
  bolted into this one. Recorded here because the title screen is where it will land and because
  §10.2 already assumes it exists.
- **`OQ-TITLE-4` — is `title.notOfficial` the right wording, and is one sentence enough?** The claim is
  simple and true; whether a public release teaching an IRCC exam needs more than that is not an agent's call.
  *Recommendation:* ship this sentence — it is strictly better than nothing, and it is on the first screen —
  and put the wording to the project owner before the first public announcement. What must not happen is the
  sentence being dropped because nobody decided on a longer one.
- **`OQ-TITLE-5` — what art is behind the title?** Nothing in this file requires any, and every scenario
  passes on a plain screen. *Recommendation:* if art lands, it is a still illustration under
  `assets/refs/` with a credit, it depicts no person and no nation (`docs/content-review.md` §1), and it is
  never the only signal of anything. A parallaxing title scene is a reduced-motion problem and a payload
  problem on the one screen that must load fastest.
- **`OQ-TITLE-6` — does the title screen count against `budgets.timeToPlayMs`?** Time-to-play is 6 s on
  25 Mbps, and this screen is now the first thing on that path. *Recommendation:* measure time-to-play to
  `title-screen` being interactive *and* to `playable`, and hold the first to a much tighter number, because
  a title screen that takes three seconds has spent half the budget before the player has chosen anything.
  Routed to whoever owns the budget gate; this file only requires that nothing here loads a level.
