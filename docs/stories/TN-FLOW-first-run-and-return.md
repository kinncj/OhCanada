# TN-FLOW — The route through the game: first run, return, and back out

**Intent.** A player can get from opening the page to playing a level, and back out again, without a URL
parameter, without losing anything, and without a dead end — the first time and every time after.

This story owns the **seams between screens**: which screen a cold load lands on, what the character creator
hands to, what "back" means from each screen, and what a player finds when they close the tab in the middle
of a level and come back a week later. Each of those moments was previously owned by two stories that
answered it differently, or by none at all.

Read `README.md` in this directory first. `TN-TITLE-title-screen.md` and `TN-MAP-level-select.md` own the two
screens this route passes through; `TN-CREATOR-character-creator.md` owns the creator; `TN-LEVEL-ottawa.md`
owns the level; `TN-SAVE-save-and-reload.md` owns what survives, and `TN-RESUME-questions-after-a-reload.md`
owns which question is asked when an answer step is resumed. This file owns none of those and points at all
of them.

## The route

```
cold load ─► title ─┬─ first run ──► creator ──► level select ──► level
                    ├─ returning ──► Continue ─────────────────► level
                    ├─ returning ──► Choose a level ──────────► level select ──► level
                    ├─ Study
                    └─ Settings

back:  level ──► level select ──► title
```

One rule holds the whole diagram together: **back always goes one step up the route, and never further.**
A player who reached a level through the map goes back to the map; the map goes back to the title. Nothing
goes back to a screen the player did not come through, and no back control ever lands on a blank page.

## Two seams this file decides, and what they cost

**1. A cold load lands on the title screen, even for a returning player with a level to continue.**
`TN-CREATOR-01`'s last scenario said a returning player "reaches `playable` without choosing anything" — the
game opening straight into the last level. That is one fewer tap and it is wrong here, for three reasons:
the level load is the longest wait in the game and it would be spent before the player has said they want it;
a player who came back to change a setting, run a Study drill or pick a different level would have to sit
through a level load to reach the menu; and a game with no front door is the defect this whole set of stories
was written for. **The cost is one tap on every return**, and it is paid by `Continue` being the first
control and already focused (`TN-TITLE-02`). `TN-CREATOR-01` is amended and points here.

**2. The creator hands to the level select, not straight to a level.** It is one more screen on the longest
path in the game, for a player who has just been asked to make choices. It is here because the map is where
the player learns that this is a journey with ten places and that nine are still being made — learning that
*after* being dropped into Ottawa makes the map a surprise later. The cost is mitigated, not denied: the map
opens with the one open level focused (`TN-FLOW-01`), so the extra screen costs one tap for a player who
does not want to look. See `OQ-FLOW-2`.

## What "the level I last played" means

`Continue` opens the level whose id the game recorded when that level last became ready. It does **not**
restore where the skater was standing: `TN-SAVE-02` deliberately does not save position, so continuing puts
the player at that level's spawn point with every promised item of progress intact. This adds one row to
`TN-SAVE`'s survives table, and that file has been amended to carry it (`OQ-FLOW-4` is the schema gap).

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-FLOW-06` |
| Single switch | `TN-FLOW-07` |
| Screen reader | `TN-FLOW-08` |
| Reduced motion | `TN-FLOW-09` |
| 200 % text | `TN-FLOW-09` |
| Bilingual | `TN-FLOW-10` |
| Failure path | `TN-FLOW-05` (a step of the route fails), and `TN-FLOW-04`'s last two scenarios |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `common.back` | Back | Retour |
| `flow.leaveLevel` | Leave the level | Quitter le niveau |

Everything else on this route is owned by the screen it belongs to: `title.*` in `TN-TITLE`, `map.*` in
`TN-MAP`, `creator.*` in `TN-CREATOR`, `level.*` in `TN-LEVEL`, `study.*` in `TN-STUDY`, `settings.*` and
`common.settings` in `TN-SET`, `storage.*` and `save.*` in `TN-SAVE`.

**`flow.leaveLevel` is a new item in the HUD menu**, which `TN-HUD-02` describes; that story has been amended
to list it and points here for the route it takes. Without it a player who reached a level from the map has
no way back except the browser's back button, which this game must not depend on.

---

## TN-FLOW-01 — A first run, end to end

```gherkin
Feature: From a cold page to a playable level, first time
  As somebody opening this game for the first time
  I want a route from the front page to a level
  So that starting does not need a URL I would have to be told about

  Background:
    Given I have no saved game
    When I open the game

  Scenario: The route, step by step
    Then the element "title-screen" is visible
    When I tap "title-play"
    Then the element "character-creator" is visible
    And the element "title-screen" is gone
    When I finish the creator and tap "start-playing"
    Then the event "character/created" is emitted
    And the event "progress/saved" is emitted
    And the element "level-select" is visible
    When I choose the one open level
    Then the event "level/chosen" is emitted
    And the element "playable" appears

  Scenario: The map does not make the player hunt for the way in
    Given I have just finished the creator
    When the element "level-select" appears
    Then the one card whose state is "Open" has focus
    And choosing it is the next thing a single tap, key press or long press does

  Scenario: Nothing on the route needs a URL
    Then no step of this route required a query string
    And the address in the browser is the same at the end as at the start,
      or differs only in a way the player never has to type

  Scenario: Each step can be left without losing the one before it
    When I go back from the level select
    Then the element "title-screen" is visible
    And my character is still saved
    And "title-continue" is not offered, because I have not played a level yet
    And "title-choose-level" is offered

  Scenario: The creator is not shown twice
    Given I finished the creator in this sitting
    When I go back to the title screen and choose "Choose a level"
    Then the element "character-creator" is not shown again
```

## TN-FLOW-02 — Coming back

```gherkin
Feature: The route for a player who has played before
  Background:
    Given I have a saved game with a character
    And the level I last played is Ottawa
    When I open the game

  Scenario: Continue is one tap to the level
    Then the element "title-screen" is visible with "title-continue" focused
    When I tap "title-continue"
    Then the Ottawa level loads
    And the element "character-creator" is never shown
    And the element "level-select" is never shown

  Scenario: Continuing restores progress, not position
    When the element "playable" appears
    Then "scene-state" reports "data-player-x" equal to the level's spawn x
    And "data-speed" is "0"
    And every item in TN-SAVE's survives table is as it was
    And "hud-quest-tracker" shows the step and count I left it on

  Scenario: The other way in still exists
    When I go back to the title screen and tap "title-choose-level"
    Then the element "level-select" is visible
    And the card for the level I last played is not treated differently from any other open card

  Scenario: Playing a different level changes what Continue means
    Given a second level document exists and is open
    When I open it from the level select and it becomes playable
    And I close the tab and open the game again
    Then "title-continue" opens that second level
    And the first level is still open on the map with its progress intact
```

## TN-FLOW-03 — Going back, and what it costs

```gherkin
Feature: Leaving a level and leaving the map
  Background:
    Given the Ottawa level is playable
    And I reached it from the level select

  Scenario: Leaving a level goes back to the map
    When I tap "menu-button" and choose "Leave the level"
    Then the event "level/left" is emitted for "ottawa"
    And the element "level-select" is visible
    And the element "playable" is not present
    And focus is on the card for the level I just left

  Scenario: Leaving asks nothing, because nothing is lost
    When I choose "Leave the level"
    Then no confirmation is shown
    And no progress is lost, because every item in TN-SAVE's survives table was already saved
    And no "progress/save-failed" event is emitted

  Scenario: Leaving mid-quest keeps the quest
    Given I accepted the quest and answered one of the three questions
    When I leave the level and open it again
    Then "hud-quest-tracker" shows the same step with the same count
    And the answer I gave is still recorded

  Scenario: The map goes back to the title
    Given the element "level-select" is visible
    When I tap "Back"
    Then the element "title-screen" is visible
    And "title-continue" is offered, naming the level I last played

  Scenario: The title screen is the top of the route
    Given the element "title-screen" is visible
    Then no control on it goes further back
    And no screen in this game is reachable only by the browser's back button

  Scenario: The previous level's memory is released
    When I leave a level
    Then the level's textures are unloaded before another level is loaded
    And the decoded texture budget is measured against one level at a time
```

## TN-FLOW-04 — Closing the tab mid-level, and coming back

```gherkin
Feature: The tab closes in the middle of a level
  As a player who plays in short sessions on a phone
  I want to close the tab whenever I like
  So that stopping never costs me anything

  Background:
    Given the Ottawa level is playable
    And I accepted the quest and answered one question rightly
    And the event "progress/saved" was emitted after that answer

  Scenario: Coming back lands on the title, with a way straight back in
    When I close the tab and open the game again
    Then the element "title-screen" is visible
    And it shows "Last played: Ottawa"
    And "title-continue" has focus
    And no level has started loading

  Scenario: Continuing puts me back in the same game
    When I tap "title-continue"
    Then the Ottawa level loads
    And "hud-quest-tracker" shows the same step with the same count
    And the question I answered is still recorded, with whether it was right
    And I start at the spawn point, as TN-SAVE-02 requires

  Scenario: A question card that was open does not come back
    Given a question card was open when the tab closed
    When I continue
    Then no question card is shown
    And which question I am asked next follows TN-RESUME-01

  Scenario: The tab was hidden rather than closed
    When the tab is hidden for thirty seconds and shown again
    Then the game is paused and resumes where it stood, as TN-LEVEL-12 describes
    And the title screen is not shown
    And nothing was saved or reloaded because of it

  Scenario: The tab closed before anything was saved (failure path)
    Given I opened the level and closed the tab within one second
    When I open the game again
    Then the title screen is shown
    And either "title-continue" opens that level, or it is absent
    And no error is shown, and nothing on the screen reads as a fault

  Scenario: The saved level no longer exists in this build (failure path)
    Given the level I last played is not in this build
    When I open the game again
    Then "title-continue" is not offered, as TN-TITLE-04 requires
    And "title-choose-level" is offered and focused
    And every other item of my progress is intact
```

## TN-FLOW-05 — A step of the route fails (failure path)

```gherkin
Feature: The route has no dead ends
  Scenario: A level chosen from the map will not load
    Given requests for the level's assets fail
    When I choose it from the level select
    Then the element "level-error" is visible, as TN-LEVEL-02 describes
    And "Go back" returns me to the level select
    And "Try again" retries the same level
    And the element "level-select" is in the state I left it in

  Scenario: A stalled load can be left, and lands somewhere real
    Given the level has not become playable after the time-to-play budget has passed twice
    Then a "Go back" control is visible and focusable
    When I take it
    Then the element "level-select" is visible
    And the page has not reloaded

  Scenario: The game is never paused with no screen on it
    Given any screen on this route closes
    Then some screen of this route is visible
    And no state exists where the canvas is showing and nothing accepts input

  Scenario: The creator fails to save and the route still completes
    Given writing to local storage fails
    When I finish the creator and choose "Keep playing"
    Then the element "level-select" is visible
    And "storage-warning" is visible, as TN-HUD-03 describes
    And the route to a level still works

  Scenario: A deep link to a level still works and is not a dead end
    Given I open the game with a level named in the address
    When that level becomes playable
    Then the level's menu still offers "Leave the level"
    And taking it shows the level select
    And going back from there shows the title screen

  Scenario: A deep link to a level that does not exist
    Given I open the game with a level id no document declares
    Then no "Try again" is offered for something that cannot succeed
    And the player is taken to, or offered, the level select
    And nothing on the screen blames the player
```

## TN-FLOW-06 — The whole route from the keyboard

```gherkin
Feature: Keyboard-only, front page to level and back
  Background:
    Given I am using a keyboard only

  Scenario: A first run finishes with the keyboard alone
    Given I have no saved game
    When I open the game and use only the keyboard
    Then I can reach and activate "title-play"
    And complete the creator as TN-CREATOR-04 describes
    And choose a level from the level select
    And reach "playable"

  Scenario: Focus is placed on every screen change, and never on the body
    When each screen of the route opens
    Then focus is inside the new screen within one interaction
    And focus is never left on the document body
    And "Tab" from the last control does not escape into the canvas

  Scenario: Coming back out with the keyboard
    Given the level is playable
    When I press the key that opens the menu and choose "Leave the level"
    Then the level select is visible and focus is on the card I left
    When I activate "Back"
    Then the title screen is visible and focus is on "title-continue"

  Scenario: Escape means back, consistently, and never means quit
    Given a dialog on this route is open
    When I press "Escape"
    Then that dialog closes and focus returns to the control that opened it
    And "Escape" on a screen that is not a dialog does not leave the game
```

## TN-FLOW-07 — The whole route with one switch

```gherkin
Feature: Single-switch, front page to level and back
  Background:
    Given single-switch mode is on

  Scenario: A first run finishes with short and long presses alone
    Given I have no saved game
    When I use only short and long presses
    Then I can reach a playable level through the title screen, the creator and the level select
    And I never need a second input at any step

  Scenario: The mode can be turned on before the first choice is made
    Given single-switch mode is off and I have no saved game
    When I open the game
    Then "title-settings" is reachable with the pointer, the keyboard or the switch
    And turning the mode on there makes every screen on this route usable with the switch

  Scenario: Coming back out with the switch
    Given the level is playable
    When I use only short and long presses
    Then I can open the menu, choose "Leave the level", reach the level select and reach the title screen

  Scenario: No screen change moves the highlight for me
    When a screen on this route opens
    Then the highlight starts at that screen's first item
    And it does not move until I press the switch
    And nothing on the screen counts down
```

## TN-FLOW-08 — The route with a screen reader

```gherkin
Feature: Announcing where the player now is
  Scenario: Each screen change is announced once, by name
    When I move from the title screen to the creator, to the level select, and to a level
    Then "#tn-live-region" announces each new screen once, by its name
    And no announcement is cut off by the next one
    And exactly one element on the page has an "aria-live" attribute at every step

  Scenario: Exactly one screen is present at a time
    Then at no point are two of "title-screen", "character-creator", "level-select" and "playable"
      present in the accessibility tree together
    And a screen that has been left is removed, not merely hidden behind a style rule

  Scenario: Going back is announced as going back
    When I leave a level
    Then "#tn-live-region" names the screen I have arrived at
    And it does not announce the screen I left

  Scenario: The waiting step says what it is doing
    When a level begins loading from the map
    Then the waiting message described in TN-LEVEL-01 is announced once
    And it claims no progress the game cannot measure

  Scenario: axe-core is clean at every step of the route
    When axe-core runs against the whole page at each screen of this route
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for any of those scans
    And every scan passes with no violations
    And the scans run against the built output, not only against a harness
```

## TN-FLOW-09 — Reduced motion and 200 % text along the route

```gherkin
Feature: The route honours the settings
  Scenario: No screen transition animates
    Given reduced motion is on
    When I move between any two screens on this route
    Then the new screen appears with no slide, fade, scale or wipe
    And nothing spins, pulses or travels between the two screens

  Scenario: A setting changed at the start is still true at the end
    Given I set text scaling to 200 % and turned on "Less movement" from the title screen
    When I reach a playable level through the creator and the level select
    Then every screen on the way was drawn at 200 %
    And "scene-state" reports "data-parallax-easing" equal to "off"
    And "data-particles" equal to "0"
    And no screen was briefly drawn at 100 % first

  Scenario: The route works at 200 % on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every control needed to complete TN-FLOW-01 is reachable, by scrolling down if needed
    And the page never scrolls sideways
    And no control is covered by another
```

## TN-FLOW-10 — The route in French, and changing language part-way

```gherkin
Feature: The whole route in French
  Background:
    Given the language is French

  Scenario: Every screen on the route is French
    When I complete TN-FLOW-01
    Then the title screen, the creator, the level select, the loading screen and the HUD are all French
    And no English screen is shown at any point
    And the document's "lang" is "fr" throughout

  Scenario: The menu item that leaves the level is French
    Given the level is playable
    When I open the menu
    Then it shows "Quitter le niveau"
    And the level select's back control reads "Retour"

  Scenario: Changing the language in the middle of the route keeps my place
    Given I am on the level select in English
    When I open Settings, change the language to French, and close Settings
    Then the event "locale/changed" is emitted
    And the element "level-select" is still visible, in French
    And every card is in the same state
    And focus is on the control I opened Settings from

  Scenario: Changing the language inside a level does not restart the route
    Given the level is playable
    When I change the language from the menu
    Then the level is not reloaded
    And "data-player-x" is unchanged
    And leaving the level still shows the level select, in the new language

  Scenario: The language the player chose is the one they come back to
    Given I set the language to French and played a level
    When I close the tab and open the game again
    Then the title screen is French
    And "title-continue" reads "Continuer"
```

---

## Open questions

- **`OQ-FLOW-1` — should a returning player be able to skip the title screen?** Some players will open this
  game every day for a week and want the level immediately. *Recommendation:* not as a hidden behaviour, and
  not as a default. If it is wanted, it is a named setting ("Open my last level straight away" — a string
  this file has deliberately not written, because the setting is not decided), off by default, and the title
  screen stays the honest default for a cold load.
- **`OQ-FLOW-2` — creator → level select, or creator → the only open level?** This file takes the first, and
  says what it costs in *Two seams this file decides*. *Recommendation:* keep it while the map carries the
  "nine of ten are still being made" message, which is the only place a player learns that. Revisit when
  more than two or three levels exist and the map has stopped being an explanation.
- **`OQ-FLOW-3` — is `?level=` a shipped feature or a test hook?** `tests/e2e` opens levels with it today and
  `TN-FLOW-05` requires it to lead somewhere real rather than to a dead end. It is also an unauthenticated
  way to open a level the unlock rules have not opened. *Recommendation:* keep it, treat it as a debug and
  test route rather than a documented one, and never let it write to the save — a level opened this way may
  be played, and must not change which levels are unlocked. Whether it should be gated behind `?e2e=1` like
  the scene probe is the architect's call, and either answer keeps these scenarios.
- **`OQ-FLOW-4` — the save has nowhere to record the level last played.**
  `content/schemas/progress.schema.json` carries `levels[]`, `character`, `settings`, `reviews`,
  `subjectsStarted` and `exams`, and no field for which level the player was in. `TN-TITLE-02`, `TN-FLOW-02`
  and `TN-FLOW-04` all depend on one, and `TN-SAVE`'s survives table now names it. *Recommendation:* a
  nullable `lastPlayedLevelId` on the progress document, written when a level emits `level/ready` — the same
  shape and the same reasoning as `OQ-SAVE-1` and `OQ-CREATOR-3`, and the same owner. Until it exists,
  `title-continue` is absent and the route still works through "Choose a level", which is why no scenario in
  this file fails closed on it.
- **`OQ-FLOW-5` — do these four event names match what the use cases emit?** `title/opened`, `map/opened`,
  `level/chosen` and `level/left` are this file's proposal, in the shape `README.md` already uses. They are
  covered by `OQ-EVENT-1`: if the use cases pick other names, these stories are updated, not the tests
  quietly.
- **`OQ-FLOW-6` — where does Exam mode join this route?** F1 adds an exam that is not a level and has the
  game's only timer. *Recommendation:* it joins the title screen as a fifth item when it ships, with its own
  story; it does not belong on the map, because it is not a place. Recorded now so that the title screen is
  not designed as a four-item screen that cannot grow.
