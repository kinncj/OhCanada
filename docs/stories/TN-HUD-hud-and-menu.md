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

**Amended 2026-09-08 — the menu carries a fourth item, "Leave the level".** `TN-FLOW-first-run-and-return.md`
specifies the route out of a level, and a player who reached a level from the level select had no way back
except the browser's back button, which this game must not depend on. `TN-FLOW` owns the route and the
string; this file lists the item and does not restate either.

**Amended again 2026-09-08 — this menu belongs to a level and Exam mode does not use it.** An exam is not a
level: it has no HUD, no skater and nothing to leave a level from. It has its own small menu with Settings,
the timer control and "Leave the exam", specified in `TN-TIMER` and `TN-ATTEMPT` (`OQ-TIMER-4`). This file's
"Leaving is not offered where there is nothing to leave" scenario is what keeps the two apart.

**Amended a third time, 2026-09-08 — the interact prompt has a story of its own.**
`TN-REACH-what-is-in-reach.md` owns what `interact-prompt` says, and adds one element to this strip,
`interact-hint`. The prompt was drawing the landmark's own **name** from the level document, because
`hud.interact.*` had never been written — which says what is there rather than what pressing does, and which
put "CN Tower" inside `hud`, a surface `TN-NAMES-04` fails the build for. This file still owns the strip, its
region name and its landmarks; it does not own the words in the prompt.

Read `README.md` in this directory first. `TN-COPY-strings-and-counts.md` fixes the plural and state-word
rules this file uses.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-HUD-05` |
| Single switch | `TN-HUD-06` |
| Screen reader | `TN-HUD-07`, and `TN-HUD-10` for the scan that proves it |
| Reduced motion | `TN-HUD-08` |
| 200 % text | `TN-HUD-08` |
| Bilingual | `TN-HUD-09` |
| Failure path | `TN-HUD-03` (the storage warning), `TN-HUD-04` (the menu over a modal), `TN-HUD-10` (a landmark scan that cannot fail) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `hud.label` | Game controls | Commandes du jeu |
| `hud.menu` | Menu | Menu |
| `hud.menu.title` | Menu | Menu |

**`hud.label` is the accessible name of the `hud` region**, and it is the string `TN-HUD-07` needs when it
requires the region to have a name. It was reported as a gap under `TN-COPY-06` — the screen took it from
the caller as a required option, so no screen could be mounted without somebody inventing a word — and it is
written here now, so nobody invents one twice. It names what the region is *for* ("Game controls"), not what
it is made of: "HUD", "Heads-up display", "Region", "Section" and the empty string are all defects, because a
screen-reader user landing on a region called "HUD" has been told the name of a widget rather than what is
inside it.

It may be carried as the region's `aria-label` or as a visible heading the region points at — the scenarios
assert the accessible name, not the mechanism. It is player-facing either way, because a screen reader reads
it out, so it is translated like every other string.

Everything else the HUD and the menu draw is defined elsewhere and is referenced, never copied:

| Key | Defined in | Drawn by the HUD as |
|---|---|---|
| `common.settings` | `TN-SET-settings.md` | The menu's Settings item |
| `study.open` | `TN-STUDY-study-mode.md` | The menu's Study item |
| `passport.open` | `TN-PASSPORT-my-passport.md` | The menu's passport item |
| `flow.leaveLevel` | `TN-FLOW-first-run-and-return.md` | The menu's leave item |
| `common.close` | `TN-SET-settings.md` | The menu's close control |
| `locomotion.<mode>.label` | `TN-MOVE-locomotion-labels.md` | `hud-mode-label` |
| `hud.task`, `quest.step.*` | `TN-QUEST-parliament-hill.md` | `hud-quest-tracker` |
| `hud.interact.poi`, `hud.interact.npc`, `hud.interact.done` | `TN-REACH-what-is-in-reach.md` | `interact-prompt` |
| `hud.interact.<target>` | that level's own story — Ottawa's two are in `TN-LEVEL-ottawa.md` | `interact-prompt` |
| `hud.interact.hint` | `TN-REACH-what-is-in-reach.md` | `interact-hint` |
| `storage.warning`, `storage.warning.help` | `TN-SAVE-save-and-reload.md` | `storage-warning` |

A string is written down in exactly one copy table. If a word is needed in two places, the second place
names the key and the file, as above. Two tables carrying the same words is how they stop being the same
words. **`passport.open` moved from `TN-QUEST` to `TN-PASSPORT` on 2026-09-08**, when the passport got a
story: the screen owns both its heading and the label of the control that opens it, which is the rule
`TN-SET` states for `settings.title` and `common.settings`. The wording did not change.

**The prompt is never a name, and that rule is `TN-REACH`'s rather than this file's** — but it binds this
strip, because the HUD is where it would be broken: `TN-NAMES-04` fails the build for a name on its list
drawn by the HUD, and interpolating a level document's landmark name into `interact-prompt` is how such a
name got there without passing through a copy table at all.

## Landmarks

The page has one `<main>`. It contains the canvas — which is `aria-hidden`, so it contributes nothing — and
the HUD, which is real content and is the reason `<main>` is not an empty wrapper invented for a scanner.
`hud` is a named region inside it, and `hud.label` is its name. Modal screens (`settings-screen`,
`question-card`, `dialogue`, `study-screen`, `save-error`) are dialogs over that page and make the rest of it
inert; they are not landmarks and do not need to be.

This mattered to the a11y gate. While the screens were scanned on their own, a modal sat alone on a page with
no landmark at all, and axe's `region` and `landmark-one-main` rules had nothing true to say — which is why
they were disabled, with the reason written in the spec file. Now that this story has shipped and the screens
are reached through a real page, both rules describe something that exists, and `TN-HUD-07` requires them on
for a whole-page scan that disables nothing at all. A rule disabled because a page was not built yet has to
be re-enabled when the page is built, or the reason has quietly become a habit.

### Why `TN-HUD-10` exists

Re-enabling a rule is not the same as being checked by it, and on this page `landmark-one-main` is not the
check it sounds like. It was found to **pass with `<main>` removed entirely**, for two reasons that both have
nothing to do with the page being correct:

- the `<section>` carrying `hud.label` is itself a landmark, so content outside `<main>` is still inside
  *something*, and
- axe's `passForModal` heuristic reads the full-bleed `#game` element as a modal, and a rule that believes it
  is looking at a modal stops asking for `<main>`.

Getting the rule to fire needed the negative control to unwrap `<main>` **and** strip the region's name.
Taken at face value, then, this rule would have reported success on a page with no `<main>` at all — so two
guards sit on the green tick, and `TN-HUD-10` is where they are written down:

1. the rule ids are asserted to be **present in the axe results**, because a rule that never ran also
   reports no violations, and
2. the negative control removes both the `<main>` wrapper and the region's name, and the scan is asserted to
   fail.

Nobody should simplify either guard away on the grounds that the scan is green. The scan being green is the
thing being checked. `TN-HUD-07` says the page is right; `TN-HUD-10` says the scan is able to tell.

**What the whole-page scan is, and is not.** It runs against the harness's page, not against `dist/`, because
`app/bootstrap` does not yet mount these screens. It is a real page with real landmarks and it is worth more
than a per-component scan, and it is still not the shipped page. `OQ-TEST-2` in `README.md` stays open until
the built output is scanned, and no report may describe this scan as proving the shipped page.

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

  Scenario: The prompt says what pressing will do, not what is there
    When something comes within reach
    Then "interact-prompt" reads a verb phrase, as TN-REACH-01 describes
    And no string drawn inside "hud" is a landmark's name

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
    Then it shows "Settings", "Study", "See my passport" and "Leave the level"
    And a "Close" control is offered
    And each is at least 44 CSS px wide and tall
    And each has a visible label, not an icon alone

  Scenario: Each item opens the screen that owns it
    When I tap "Settings"
    Then the element "settings-screen" is visible
    When I tap "Study"
    Then the element "study-screen" is visible
    When I tap "See my passport"
    Then the element "passport" is visible, as TN-PASSPORT-01 describes

  Scenario: Leaving the level is a way out, not another screen over the level
    When I tap "Leave the level"
    Then the route described in TN-FLOW-03 is taken
    And the element "playable" is not present
    And the element "menu" is gone

  Scenario: Leaving is not offered where there is nothing to leave
    Given no level is playable
    Then no menu anywhere in the game offers "Leave the level"
    And an exam's menu offers "Leave the exam" instead, as TN-ATTEMPT-01 describes

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
    And I can leave the level, and land where TN-FLOW-06 says I land
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
    Then I can reach and choose "Settings", "Study", "See my passport" and "Leave the level"
    And I can close the menu and return to the game

  Scenario: The warning does not interrupt the ring
    Given "storage-warning" is visible
    When I press the switch briefly through the whole ring
    Then the warning is never highlighted as if it were a control
    And every real control is still reachable
    And the same is true of "interact-hint", as TN-REACH-06 requires

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

  Scenario: The region is named for what is in it
    Then the accessible name of "hud" is "Game controls"
    And it is not "HUD", "Heads-up display", "Region", "Section" or empty
    And the name is read when focus first enters the region

  Scenario: The scanner is not asked to ignore what now exists
    When axe-core runs against the whole page
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
    And the guards in TN-HUD-10 pass in the same run

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
    And the whole of "Quitter le niveau" is visible when the language is French
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

  Scenario: The region's name is French
    Then the accessible name of "hud" is "Commandes du jeu"
    And it is not "Game controls"
    And it contains no "(e)", "·e" or bracketed ending

  Scenario: The menu is French
    When I tap "Menu"
    Then the items read "Réglages", "Réviser", "Voir mon passeport" and "Quitter le niveau"
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
    And the accessible name of "hud" is "Commandes du jeu"
    And "data-player-x" is unchanged
    And the level is not reloaded

  Scenario: The whole page is scanned in French too
    When axe-core runs against the whole page in French
    Then the rules "region" and "landmark-one-main" are enabled
    And the scan passes with no violations
    And the document's "lang" is "fr"
```

## TN-HUD-10 — The landmark scan is able to fail (failure path)

```gherkin
Feature: Guarding the green tick on the landmark rules
  Background:
    Given the whole page is scanned with "region" and "landmark-one-main" enabled

  Scenario: Both rules actually ran
    When axe-core runs against the whole page
    Then "region" is named among the rules the results report as run
    And "landmark-one-main" is named among the rules the results report as run
    And a result carrying neither a violation nor a run for one of those rules fails this scenario

  Scenario: The negative control makes the scan fail
    Given the same page is built with the "main" wrapper removed
    And the "hud" region is built with no accessible name
    When axe-core runs against it
    Then a violation of "landmark-one-main" is reported
    And the negative control is asserted to fail, not skipped

  Scenario: Removing the main wrapper alone does not make the rule fire
    Given the same page is built with the "main" wrapper removed
    And "hud" keeps its accessible name "Game controls"
    When axe-core runs against it
    Then no violation of "landmark-one-main" is reported
    And this is why the negative control also strips the region's name

  Scenario: A named region is not what makes the real page pass
    Given the page has its "main" wrapper
    When the region's name is removed and the page is scanned again
    Then "landmark-one-main" still reports no violation, satisfied by "main"
    And "region" reports a violation, because the region is now unnamed

  Scenario: The guards outlive a green run
    Then both guards run in the same suite as the passing scan
    And neither is removed on the grounds that the scan passes
    And a change that makes the negative control pass is a failure of this suite
```

---

## Open questions

- **`OQ-HUD-1` — is the HUD one element or two?** These scenarios treat `hud` as one region holding the mode
  label, the tracker, the menu button, the interact prompt and the storage warning. The movement controls
  (`move-left`, `move-right`, `turn-around`) are in the same lower third but are play controls, not chrome.
  *Recommendation:* one `hud` region for the chrome and a separate control layer for movement, so a modal can
  make the chrome inert without the level having to reason about its own input surface.
- ~~**`OQ-HUD-2` — does the passport belong in the menu in slice 1?**~~ **Answered — yes**, and it now has a
  story: `TN-PASSPORT-my-passport.md`. `TN-SAVE-01` asserts the stamp survives a reload, and without a menu
  route the only way to see it after a reload would be to finish the quest again, which is not possible. The
  passport is also reachable from the level select, beside the stamp count (`TN-MAP-01`).
- **`OQ-HUD-3` — where does the storage warning sit when the HUD is not on screen?** `TN-CREATOR-03` shows it
  during character creation, and `TN-TITLE-04` shows it on the title screen, before any level exists.
  *Recommendation:* the warning belongs to the page, not to the level: one element, drawn inside `hud` when
  there is a HUD and above the screen's card when there is not. One element means one announcement, which is
  what `TN-HUD-03` asserts. Exam mode is the third screen with no HUD that needs it (`TN-ATTEMPT-05`).
- **`OQ-HUD-4` — is there a pause item in the menu?** Opening the menu already pauses, so a pause item would
  do nothing. *Recommendation:* no pause item; `TN-LEVEL-12` already covers pausing by rotation, by menu and
  by hiding the tab.
- **`OQ-HUD-5` — is "Game controls" the right name when the movement controls may not be in the region?**
  `OQ-HUD-1` recommends splitting the chrome from the movement layer, which would leave a region named
  "Game controls" holding the mode, the task, the menu button and a warning — labels and one control.
  *Recommendation:* keep the name. It is what the strip is for from the player's side, and the alternatives
  ("Game status", « État du jeu ») describe the half a switch user cannot press. Revisit if the movement
  controls ever move inside the same region, at which point the name becomes exactly right instead of
  roughly right.
- **`OQ-HUD-6` — should the region's name also be visible on screen?** Today it is announced and not drawn,
  which is why the copy table calls it player-facing anyway. A visible "Game controls" heading would take
  vertical space in the lower third at 200 % text and tell a sighted player nothing they cannot already see.
  *Recommendation:* keep it announced only, and keep `TN-HUD-07` asserting the accessible name rather than a
  mechanism, so a visible heading stays legal if a later design wants one.
- **`OQ-HUD-7` — does `TN-HUD-10`'s third scenario belong in a suite at all?** It asserts what axe does
  today: `landmark-one-main` passing on a page with no `<main>` because of `passForModal`. If a future axe
  fixes that, the scenario fails and the negative control can be simplified. *Recommendation:* keep it and
  let it fail loudly — a scenario that fails when a tool gets better is a scenario that told us the tool
  changed. What must not happen is the simplification being made without the failure.
- **`OQ-HUD-8` — does "Leave the level" need a confirmation?** `TN-FLOW-03` says no, because every item in
  `TN-SAVE`'s survives table is written at the moment it changes and nothing is in flight: the menu cannot be
  opened over a question card (`TN-HUD-04`), so there is no half-answered question to lose.
  *Recommendation:* no confirmation. A dialog that always says "nothing will be lost" teaches the player to
  dismiss dialogs. Revisit only if something ever becomes losable, and then fix the losable thing first.
  **Exam mode is where something does become losable**, and it takes the same shape: leaving asks nothing
  when the exam is kept, and asks once when storage is blocked and it cannot be (`TN-ATTEMPT-05`).
- **`OQ-HUD-9` — should the exam's menu be this menu with different items?** `OQ-TIMER-4` recommends a small
  menu owned by the exam screen instead, because this one belongs to a level and offers a level's way out.
  *Recommendation:* two menus, one behaviour: modal, named, focus-trapping, escape closes, nothing counts
  down. If they end up sharing a component, the items are still the screen's to decide.
- **`OQ-HUD-10` — how many things may the strip hold at once?** At 200 % text on a 390 × 844 viewport the
  lower third can be carrying the mode label, the quest tracker, the storage warning, the interact prompt and
  — the first time — `interact-hint`. `TN-HUD-08` and `TN-REACH-07` both assert that everything fits by
  scrolling inside `hud`, which is a real answer and not an obviously comfortable one.
  *Recommendation:* keep every element and let the strip scroll, because dropping one is dropping the only
  copy of something a player needs; and measure it once the hint exists, in the same pass that measures the
  warning and the tracker together.
