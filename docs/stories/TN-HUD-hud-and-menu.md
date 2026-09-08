# TN-HUD — The HUD, the menu and the storage warning

**Intent.** While the player is skating, one strip in the lower third tells them what they are doing, what
their task is, and how to reach everything else — and it is the one place the game admits that this browser
is not saving their progress.

This story exists because three other files require things nobody owns. `TN-SET-03` and `TN-CREATOR-03` both
require `storage-warning` to be visible in the HUD; `TN-QUEST-02` requires `hud-quest-tracker` to be readable
without opening a menu; `TN-STUDY-01`, `TN-SET-01`, `TN-QUEST-04` and `TN-SAVE-07` all reach their screens
through `menu-button`. The HUD was shared vocabulary in `README.md` and the acceptance criteria of no file.
It is now this one.

It also settles where the page's landmarks are, which is not a detail: see *Landmarks* below.

Read `README.md` in this directory first. `TN-COPY-strings-and-counts.md` fixes the plural and state-word
rules this file uses.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-HUD-05` |
| Single switch | `TN-HUD-06` |
| Screen reader | `TN-HUD-07` |
| Reduced motion | `TN-HUD-08` |
| 200 % text | `TN-HUD-08` |
| Bilingual | `TN-HUD-09` |
| Failure path | `TN-HUD-03` (the storage warning), `TN-HUD-04` (the menu over a modal) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `hud.menu` | Menu | Menu |
| `hud.menu.title` | Menu | Menu |

Everything else the HUD and the menu draw is defined elsewhere and is referenced, never copied:

| Key | Defined in | Drawn by the HUD as |
|---|---|---|
| `common.settings` | `TN-SET-settings.md` | The menu's Settings item |
| `study.open` | `TN-STUDY-study-mode.md` | The menu's Study item |
| `passport.open` | `TN-QUEST-parliament-hill.md` | The menu's passport item |
| `common.close` | `TN-SET-settings.md` | The menu's close control |
| `locomotion.skate.label` | `TN-LEVEL-ottawa.md` | `hud-mode-label` |
| `hud.task`, `quest.step.*` | `TN-QUEST-parliament-hill.md` | `hud-quest-tracker` |
| `hud.interact.*` | `TN-LEVEL-ottawa.md` | `interact-prompt` |
| `storage.warning`, `storage.warning.help` | `TN-SAVE-save-and-reload.md` | `storage-warning` |

A string is written down in exactly one copy table. If a word is needed in two places, the second place
names the key and the file, as above. Two tables carrying the same words is how they stop being the same
words.

## Landmarks

The page has one `<main>`. It contains the canvas — which is `aria-hidden`, so it contributes nothing — and
the HUD, which is real content and is the reason `<main>` is not an empty wrapper invented for a scanner.
`hud` is a named region inside it. Modal screens (`settings-screen`, `question-card`, `dialogue`,
`study-screen`, `save-error`) are dialogs over that page and make the rest of it inert; they are not
landmarks and do not need to be.

This matters to the a11y gate. While the screens are scanned on their own, a modal sits alone on a page with
no landmark at all, and axe's `region` and `landmark-one-main` rules have nothing true to say — which is why
they are disabled, with the reason written in the spec file. Once this story ships and the screens are
reached through a real page, both rules describe something that exists, and `TN-HUD-07` requires them back
on for the whole-page scan. A rule disabled because a page was not built yet has to be re-enabled when the
page is built, or the reason has quietly become a habit. See `OQ-TEST-2` in `README.md`.

---

## TN-HUD-01 — The HUD is there while the player plays

```gherkin
Feature: The lower-third HUD
  As a player skating with one thumb
  I want one strip that tells me what I am doing and how to reach everything else
  So that nothing about the game is hidden behind a gesture

  Background:
    Given the Ottawa level is playable

  Scenario: The HUD exists and stays out of the way
    Then the element "hud" is visible
    And it is inside the lower third of the canvas
    And no part of it covers the skater
    And the skater is still drawn inside the upper two thirds

  Scenario: The HUD says what the player is doing
    Then the element "hud-mode-label" reads "Skating"
    And it is text, not an icon alone

  Scenario: The menu is one tap away
    Then the element "menu-button" is visible and reads "Menu"
    And it is at least 44 CSS px wide and tall
    And it is not the only way to reach anything the player needs while skating

  Scenario: The tracker appears only when there is a task
    Given I have not accepted a quest
    Then the element "hud-quest-tracker" is not shown
    When I accept the quest
    Then "hud-quest-tracker" is shown, as described in TN-QUEST-02

  Scenario: The HUD does not take the input the level needs
    When I hold "move-right" over a part of the play area that is not a HUD control
    Then the skater moves
    And no HUD control is activated
```

## TN-HUD-02 — The menu

```gherkin
Feature: Reaching the other screens
  Background:
    Given the Ottawa level is playable

  Scenario: Opening the menu pauses the game
    When I tap "menu-button"
    Then the element "menu" is visible
    And "data-paused" is "true"
    And holding "move-right" does not move the skater

  Scenario: What the menu offers in this slice
    Then it shows "Settings", "Study" and "See my passport"
    And a "Close" control is offered
    And each is at least 44 CSS px wide and tall
    And each has a visible label, not an icon alone

  Scenario: Each item opens the screen that owns it
    When I tap "Settings"
    Then the element "settings-screen" is visible
    When I tap "Study"
    Then the element "study-screen" is visible
    When I tap "See my passport"
    Then the element "passport" is visible

  Scenario: Closing the menu returns the player to the ice
    When I tap "Close"
    Then the element "menu" is gone
    And "data-paused" is "false"
    And focus returns to "menu-button"

  Scenario: Closing a screen opened from the menu returns to the game, not to the menu
    Given I opened Settings from the menu
    When I close Settings
    Then "data-paused" is "false"
    And focus returns to "menu-button"
    And the element "menu" is not shown again

  Scenario: Nothing in the menu counts down
    When the menu is open and I do nothing for two minutes
    Then the menu is unchanged
    And nothing has been chosen for me
```

## TN-HUD-03 — The storage warning (failure path)

```gherkin
Feature: Telling the player their progress is not being kept
  Scenario: The warning appears when storage cannot be written
    Given local storage cannot be read or written
    And the Ottawa level is playable
    Then the element "storage-warning" is visible inside "hud"
    And it says "This browser is not saving your progress."
    And it says "You can keep playing, but everything will be gone when you close the tab."

  Scenario: It stays while the player plays
    When I skate, engage the officer, accept the quest and answer a question
    Then "storage-warning" is still visible at every step
    And it is never the thing that has to be dismissed to carry on

  Scenario: It is not a second announcer
    Then "storage-warning" has no "aria-live" attribute of its own
    And it is announced once through "#tn-live-region"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: It appears when a write fails, not only when storage is blocked outright
    Given writing to local storage fails
    When the event "progress/save-failed" is emitted
    Then "storage-warning" is visible

  Scenario: It offers the way out that TN-SAVE promises
    Then a "Save to a file" control is reachable from the warning or from Settings
    And taking it downloads the save described in TN-SAVE-06

  Scenario: It is not shown when nothing is wrong
    Given local storage works
    Then "storage-warning" is not present in the accessibility tree
    And it is not merely hidden behind a style rule that something else can override

  Scenario: It does not eat the playfield
    Then the skater is still drawn inside the upper two thirds of the canvas
    And "hud-quest-tracker" and "menu-button" are both still visible and operable
```

## TN-HUD-04 — The menu and the modals (failure path)

```gherkin
Feature: The menu cannot fight another screen
  Scenario: The menu cannot be opened over an open modal
    Given the element "question-card" is visible
    Then "menu-button" is not reachable with "Tab"
    And tapping where "menu-button" is does not open the menu

  Scenario: One screen at a time
    Given the element "menu" is visible
    When I open Settings from it
    Then the element "menu" is gone
    And exactly one dialog is present on the page

  Scenario: The game does not resume behind an open screen
    Given any screen opened from the menu is visible
    Then "data-paused" is "true"
    And "data-player-x" does not change

  Scenario: A screen that fails to open leaves the player somewhere
    Given Study cannot be opened because its questions failed to load
    When I choose "Study"
    Then the message described in TN-STUDY-03 is shown
    And the player can return to the game from it
    And the game is never left paused with no visible screen
```

## TN-HUD-05 — The HUD from the keyboard

```gherkin
Feature: Keyboard-only HUD
  Background:
    Given I am using a keyboard only
    And the Ottawa level is playable

  Scenario: The menu is reachable and operable
    When I press "Tab" until focus is on "menu-button"
    Then the focus indicator is visible and is not colour alone
    When I press "Enter"
    Then the element "menu" is visible
    And focus is inside it

  Scenario: The menu is a modal that gives focus back
    Then "Tab" cannot leave "menu"
    When I press "Escape"
    Then the menu closes
    And focus returns to "menu-button"

  Scenario: The HUD does not swallow the movement keys
    Given focus is on "menu-button"
    When I press the key bound to "move-right"
    Then the skater does not move
    When I press "Escape" and focus leaves the HUD controls
    Then the key bound to "move-right" moves the skater again

  Scenario: Every screen is reachable from the keyboard alone
    When I use only the keyboard
    Then I can open Settings, Study and the passport, and return to the game from each
```

## TN-HUD-06 — The HUD with one switch

```gherkin
Feature: Single-switch HUD
  Background:
    Given single-switch mode is on
    And the Ottawa level is playable

  Scenario: The menu is in the highlight ring
    When I press the switch briefly until the highlight reaches "Menu"
    Then the highlighted control is announced in "#tn-live-region"
    When I hold the switch past the hold-to-choose threshold
    Then the element "menu" is visible

  Scenario: Every menu item can be chosen with the switch
    When I use only short and long presses
    Then I can reach and choose "Settings", "Study" and "See my passport"
    And I can close the menu and return to the game

  Scenario: The warning does not interrupt the ring
    Given "storage-warning" is visible
    When I press the switch briefly through the whole ring
    Then the warning is never highlighted as if it were a control
    And every real control is still reachable

  Scenario: Nothing opens or closes by itself
    When I do nothing for two minutes
    Then the menu is in the state I left it in
    And the highlight has not moved
```

## TN-HUD-07 — The HUD with a screen reader

```gherkin
Feature: Announcing the HUD
  Background:
    Given the Ottawa level is playable

  Scenario: The page has landmarks now that it has content
    Then the page has exactly one element with role "main"
    And the canvas inside it is "aria-hidden"
    And "hud" is a region with an accessible name
    And every piece of visible text on the page is inside a landmark

  Scenario: The scanner is not asked to ignore what now exists
    When axe-core runs against the whole page
    Then the rules "region" and "landmark-one-main" are enabled
    And the scan passes with no violations

  Scenario: The menu is a named dialog
    When the menu opens
    Then "menu" has role "dialog" with "aria-modal" true
    And its accessible name is "Menu"
    And the rest of the page is inert while it is open

  Scenario: The tracker and the mode are readable at any time
    Then "hud-mode-label" and "hud-quest-tracker" are in the accessibility tree as text
    And neither carries an "aria-live" attribute of its own
    And a change to either is announced once through "#tn-live-region"

  Scenario: The warning is read as text
    Given "storage-warning" is visible
    Then it is read as static text with both of its sentences
    And it is not read again every time the player answers a question
```

## TN-HUD-08 — The HUD under reduced motion and at 200 %

```gherkin
Feature: The HUD honours the settings it opens
  Scenario: Reduced motion
    Given reduced motion is on
    When I open and close the menu
    Then it appears and disappears with no slide, fade or scale
    And "storage-warning" does not pulse, flash or animate
    And "hud-quest-tracker" changes its text with no flash

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the Ottawa level is playable
    Then every HUD label is fully visible, not cut off
    And every HUD control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways
    And the skater is still drawn inside the upper two thirds of the canvas

  Scenario: The warning and the tracker at 200 % together
    Given "storage-warning" is visible
    And the quest is accepted
    And text scaling is 200 %
    Then both are readable, by scrolling inside "hud" if needed
    And neither covers "menu-button"

  Scenario: The menu at 200 %
    Given text scaling is 200 %
    When the menu opens
    Then every item is reachable, by scrolling inside "menu" if needed
    And no item's label is truncated with an ellipsis
```

## TN-HUD-09 — The HUD in French

```gherkin
Feature: The HUD in French
  Background:
    Given the language is French
    And the Ottawa level is playable

  Scenario: The HUD is French
    Then "hud-mode-label" reads "Patinage"
    And "menu-button" reads "Menu"

  Scenario: The menu is French
    When I tap "Menu"
    Then the items read "Réglages", "Réviser" and "Voir mon passeport"
    And the close control reads "Fermer"
    And no English word appears in "menu"

  Scenario: The warning is French
    Given local storage cannot be written
    Then "storage-warning" says "Ce navigateur n'enregistre pas votre progression."
    And it says "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet."

  Scenario: Changing the language from the menu redraws the HUD without reloading the level
    Given the language is English and the quest is accepted
    When I open Settings from the menu and change the language to French
    Then "hud-mode-label" reads "Patinage"
    And "hud-quest-tracker" reads "Répondez à 3 questions (0 sur 3)"
    And "data-player-x" is unchanged
    And the level is not reloaded
```

---

## Open questions

- **`OQ-HUD-1` — is the HUD one element or two?** These scenarios treat `hud` as one region holding the mode
  label, the tracker, the menu button, the interact prompt and the storage warning. The movement controls
  (`move-left`, `move-right`, `turn-around`) are in the same lower third but are play controls, not chrome.
  *Recommendation:* one `hud` region for the chrome and a separate control layer for movement, so a modal can
  make the chrome inert without the level having to reason about its own input surface.
- **`OQ-HUD-2` — does the passport belong in the menu in slice 1?** There is one stamp and it is shown on the
  completion card. *Recommendation:* yes, keep the item — `TN-SAVE-01` asserts the stamp survives a reload,
  and without a menu route the only way to see it after a reload is to finish the quest again, which is not
  possible.
- **`OQ-HUD-3` — where does the storage warning sit when the HUD is not on screen?** `TN-CREATOR-03` shows it
  during character creation, before any level exists. *Recommendation:* the warning belongs to the page, not
  to the level: one element, drawn inside `hud` when there is a HUD and above the creator's card when there
  is not. One element means one announcement, which is what `TN-HUD-03` asserts.
- **`OQ-HUD-4` — is there a pause item in the menu?** Opening the menu already pauses, so a pause item would
  do nothing. *Recommendation:* no pause item; `TN-LEVEL-12` already covers pausing by rotation, by menu and
  by hiding the tab.
