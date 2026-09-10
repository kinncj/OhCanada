# TN-FIRSTRUN — Choosing a character before playing

**Intent.** A player opening this game for the first time is offered a character, is never made to work for
one, and is never given a way past the screen that quietly picks one for them.

This file owns **one seam**: what "first run" means, what the creator may and may not be skipped with, and
what happens to the title screen when the creator is finally mounted. `TN-FLOW-first-run-and-return.md` owns
the route between screens and is not restated here; `TN-TITLE-title-screen.md` owns the title screen;
`TN-CREATOR-character-creator.md` owns the creator screen; `TN-LOOK` and `TN-SKIN` own what is on it.

Read `README.md` in this directory first.

## Why this file exists

`title.play` is written, translated and shipped in `app/ui/copy.ts`, and **it has never been drawn.** The
shell can only represent a first run when a creator block is passed to it, no creator block has ever been
passed, and so every cold load takes the returning-player branch. `TN-TITLE-01` — "the element `title-play`
is visible and reads 'Play'" — has therefore never been able to pass on the shipped page, and neither has
`TN-TITLE-03`'s "exactly one of `title-play` and `title-continue` is present".

Mounting the creator is what makes that branch reachable, so mounting the creator **is** a title-screen
change. Two questions fall out of it that no story answered, and the implementer would otherwise guess:
what decides which branch a cold load takes, and whether the creator can be skipped. Both are product
decisions. They are ruled on below.

## Ruling 1 — the branch is decided by whether the save has a character, and by nothing else

> **A player is on their first run when the save carries no character. Not when the save is empty, not when
> no level has been played, not when there is no `lastPlayedLevelId`.**

`title-play` is drawn when there is no character. `title-continue` and `title-choose-level` are drawn when
there is one, subject to `TN-TITLE-02`'s own rules about a level to continue. The three controls are decided
by two different facts and it matters which is which:

| The save has | `title-play` | `title-choose-level` | `title-continue` |
|---|---|---|---|
| nothing | yes | no | no |
| a character, no level ever played | no | yes, focused | no |
| a character and a level last played | no | yes | yes, focused |
| a level last played, no character | yes | no | no |

The last row is the one that needs writing down. A save can carry level progress and no character — an
import of somebody else's export, a save written before the creator was mounted, a repair that dropped a
malformed character block — and in that state the game cannot draw a player at all. It sends them to the
creator, keeps every stamp and every answer, and says nothing about it, because nothing is wrong with their
game. `TN-FIRSTRUN-01` is the acceptance.

## Ruling 2 — the creator cannot be skipped, and no choice in it is required

> **The creator is on the first-run route and has no skip control. Nothing inside it has to be touched:
> it opens with a complete, randomised character and "Start playing" is enabled from the first frame.**

The distinction is the whole ruling. A player must *pass through* the screen; a player never has to *use*
it. One tap, one key press or one long press from arrival reaches a level.

Four reasons, in the order that decides it:

1. **There is nothing to skip to.** `docs/content-review.md` §8.3 already requires the creator to randomise
   uniformly on open, so the screen arrives with all five slots answered and a valid character on it. "Start
   playing" is a one-tap exit already. A "Skip" control would be a second control doing exactly what the
   primary control does, on a screen a first-time player is reading for the first time.
2. **A skip would have to mean *something*, and every candidate is worse.** The only appearance available
   without a draw is each slot's `fallback`, and the rig says in as many words that `fallback` is "for NPC
   documents and save recovery only" and that "the creator never renders it as a pre-selection". A skip
   button that lands on `skin-3`, `crop`, `brown`, `toque`, `none` **reintroduces the default player through
   the back door** — the exact outcome `assets/style/art-bible.md` §8, `docs/content-review.md` §8.1 and
   `OQ-REVIEW-7` spent a decision each preventing, restored by a control added for convenience.
3. **Skipping is not the accessibility win it looks like.** The concern a skip answers is a switch user
   facing nineteen options; `TN-LOOK-07` answers it properly, by requiring "Start playing" to be reachable
   in the ring without choosing anything and by requiring that nothing counts down while they get there. A
   skip control would sit *in the same ring*, so it saves a switch user nothing at all.
4. **"Later" is a promise this game can keep, and keeping it is cheaper than a skip.** `creator.intro`
   already says "You can change this later in Settings." Ruling 3 makes that true. A player who does not
   want to decide now genuinely can decide later, and does not need a control that says so.

**What a first-time player must do to reach a level, counted:** tap "Play", tap "Start playing", choose the
one open level. Three taps, none of them a choice about how they look.

## Ruling 3 — the same screen re-opens from Settings, and its primary control changes name

> **`creator.intro`'s promise ships with the button that keeps it.** Settings offers "Change my character",
> it opens this same screen, and the screen's primary control is then "Done" and returns to Settings.

This closes `OQ-CREATOR-4` in favour of keeping the sentence. The alternative was deleting it, and a game
that tells a newcomer "you can change this later" and then cannot is worse than one that never said so.

The primary control is named for **where it goes**, which is `TN-TITLE`'s rule for `title.play` against
`title.continue` and `README.md`'s rule about a control that says "Go back". On the first run it goes to the
level select and reads "Start playing". Re-opened from Settings it goes back to Settings and reads "Done".
**Exactly one of them is present**, the same shape as `title-play` and `title-continue`, so a player is
never asked to guess which button keeps their changes.

The two are also two different events. `character/created` is emitted the first time — it is what makes the
player exist and what the route waits on — and `character/changed` every time after. A listener that
re-runs the first-run route on `character/created` must never see it fire from Settings.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-FIRSTRUN-06` |
| Single switch | `TN-FIRSTRUN-06` |
| Screen reader | `TN-FIRSTRUN-07` |
| Reduced motion | `TN-FIRSTRUN-08` |
| 200 % text | `TN-FIRSTRUN-08` |
| Bilingual | `TN-FIRSTRUN-09` |
| Failure path | `TN-FIRSTRUN-03` (leaving without finishing), `TN-FIRSTRUN-05` (nothing can be saved) |

## Player-facing copy

This file writes one row and names five it does not own.

| Key | EN | FR |
|---|---|---|
| `creator.done` | Done | Terminé |

| Key | Owned by | Drawn here as |
|---|---|---|
| `title.play` | `TN-TITLE-title-screen.md` | The control a player with no character sees |
| `title.continue`, `title.choose-level` | `TN-TITLE-title-screen.md` | The two a player with a character sees |
| `creator.start` | `TN-CREATOR-character-creator.md` | The primary control on the first run |
| `creator.intro` | `TN-CREATOR-character-creator.md` | The sentence ruling 3 makes true |
| `common.back` | `TN-FLOW-first-run-and-return.md` | The control that leaves the creator for the title |
| `settings.character` | `TN-SET-settings.md` | The Settings item that re-opens the creator |

**`settings.character` does not exist yet.** It is reported as a gap under `TN-COPY-06`, with this task as
the one that found it, and it is written into `TN-SET-settings.md` rather than here — a gap is a debt, not a
home, and a row this file wrote would be a row two files disagree about within a week. Recommended wording,
for that file's owner to accept or reword: "Change my character" / « Modifier votre personnage ». Neither
form requires gender agreement about the player.

---

## TN-FIRSTRUN-01 — Play is drawn, at last, and what decides it

```gherkin
Feature: Which way in a cold load offers
  As somebody opening this game
  I want the front door to offer the way in that is true for me
  So that "Play" is not a control the game contains and never shows

  Scenario: A cold load with no saved game offers Play
    Given I have no saved game
    When I open the game
    Then the element "title-screen" is visible
    And the element "title-play" is visible and reads "Play"
    And it is the first control in reading order and has focus
    And the element "title-continue" is not present in the accessibility tree
    And the element "title-choose-level" is not present in the accessibility tree

  Scenario: Play opens the creator
    Given I have no saved game
    When I open the game and tap "title-play"
    Then the element "character-creator" is visible
    And the element "title-screen" is gone

  Scenario: A save with a character never shows Play again
    Given I have a saved game with a character
    When I open the game
    Then "title-play" is not present in the accessibility tree
    And "title-choose-level" is present
    And exactly one of "title-play" and "title-continue" is present

  Scenario: A save with progress and no character is a first run
    Given my saved game has stamps and answers and no character
    When I open the game
    Then "title-play" is visible and has focus
    And no error screen is shown, because nothing is wrong with my game
    When I tap "title-play" and finish the creator
    Then every stamp and every answer I had is still there

  Scenario: The branch is not decided by the level I last played
    Given my saved game has a character and no level has ever been opened
    Then "title-play" is not present
    And "title-choose-level" is visible and has focus
    And no line saying "Last played" is drawn

  Scenario: The creator is not offered twice in one sitting
    Given I finished the creator in this sitting
    When I go back to the title screen
    Then "title-play" is not present
    And "title-choose-level" is present
    And the element "character-creator" is not shown again
```

## TN-FIRSTRUN-02 — The screen cannot be skipped and never has to be used

```gherkin
Feature: Passing through the creator without using it
  As a player who does not want to decide how I look right now
  I want one tap to a level
  So that the screen that is for me is not a screen I have to get past

  Background:
    Given I have no saved game
    And I opened the game and tapped "title-play"

  Scenario: There is no skip
    Then no control in "character-creator" reads "Skip", "Later", "No thanks" or "Maybe later"
    And no control leaves this screen without a character
    And the only ways out are "start-playing", "creator-back" and "creator-settings"

  Scenario: A complete character is already on the screen
    Then every group has exactly one option chosen
    And "start-playing" is enabled before I have touched anything
    And nothing on the screen says a choice is required
    And nothing is drawn disabled

  Scenario: One tap reaches a level, having chosen nothing
    When I tap "start-playing" without touching any group
    Then the event "character/created" is emitted with one option per slot
    And the event "progress/saved" is emitted
    And the element "level-select" is visible with the one open level focused
    When I choose it
    Then the element "playable" appears
    And the character in the level is the one that was on the screen

  Scenario: What was saved was drawn, not defaulted
    Given the creator has been opened 1000 times with seeded draws
    And "start-playing" was tapped each time without touching any group
    Then every option of every slot was saved at least once
    And no option was saved more than twice its expected share
    And the rig's "fallback" combination was not saved more often than any other

  Scenario: Nothing on the screen counts down
    When I do nothing for two minutes
    Then the chosen options are unchanged
    And nothing has been chosen for me
    And no level has started loading
```

## TN-FIRSTRUN-03 — Leaving the creator without finishing it (failure path)

```gherkin
Feature: Back, from the one screen that has no state behind it yet
  Background:
    Given I have no saved game
    And I opened the game and tapped "title-play"

  Scenario: Back goes one step up the route, as everywhere else
    Then the element "creator-back" is visible and reads "Back"
    When I tap "creator-back"
    Then the element "title-screen" is visible
    And the element "character-creator" is gone

  Scenario: Leaving saves nothing, and says nothing
    Given I chose an option in every group
    When I tap "creator-back"
    Then no "character/created" event is emitted
    And no "progress/saved" event is emitted
    And no confirmation is asked for
    And nothing on the screen says I lost anything

  Scenario: I am still a first-run player
    When I am back on the title screen
    Then "title-play" is visible and has focus
    And "title-continue" is not present
    And "title-choose-level" is not present

  Scenario: Coming back in is a new draw, not the one I walked away from
    When I tap "title-play" again
    Then the element "character-creator" is visible
    And every group has exactly one option chosen
    And the screen does not claim to have restored anything

  Scenario: The title screen is still the top of the route
    Then no control on "title-screen" goes further back
    And no screen in this game is reachable only by the browser's back button
```

## TN-FIRSTRUN-04 — Changing it later, which is what the intro promised

```gherkin
Feature: The creator, re-opened
  Background:
    Given I have a saved game with a character
    And the element "settings-screen" is visible

  Scenario: Settings offers the way back in
    Then the element "setting-character" is visible
    And it reads "Change my character"
    And it is at least 44 CSS px wide and tall
    And it has a visible text label, not an icon alone

  Scenario: It opens the same screen, not a second one
    When I tap "setting-character"
    Then the element "character-creator" is visible
    And it offers the same five groups with the same options as TN-LOOK-01 describes

  Scenario: It opens on the character I have, not on a new draw
    Then every group's chosen option is the one my saved character carries
    And no group was randomised

  Scenario: The primary control is named for where it goes
    Then the element "creator-done" is visible and reads "Done"
    And the element "start-playing" is not present
    And exactly one of "creator-done" and "start-playing" is present in any state of this screen

  Scenario: Done saves and returns to Settings
    Given I chose a different option in "slot-hair-colour"
    When I tap "creator-done"
    Then the event "character/changed" is emitted
    And the event "character/created" is not emitted
    And the event "progress/saved" is emitted
    And the element "settings-screen" is visible
    And focus returns to "setting-character"

  Scenario: Back from here means back to Settings, not out of the game
    When I tap "creator-back"
    Then the element "settings-screen" is visible
    And my saved character is unchanged
    And no "character/changed" event is emitted

  Scenario: A change reaches the level I am already in
    Given the Ottawa level is playable
    When I open Settings from the menu, change my character and tap "Done"
    Then the level is not reloaded
    And "data-player-x" is unchanged
    And the character drawn in the level uses the options I just chose

  Scenario: The promise and the button ship together
    Then "creator.intro" says "You can change this later in Settings."
    And "setting-character" exists on the settings screen
    And a build in which that control is absent fails the check that pairs them
```

## TN-FIRSTRUN-05 — Nothing can be saved (failure path)

```gherkin
Feature: A first run with no storage
  Background:
    Given local storage cannot be read or written

  Scenario: The route still completes
    When I open the game
    Then "title-screen" is visible
    And the element "storage-warning" says "This browser is not saving your progress."
    And "title-play" is present and works
    When I tap "title-play", tap "start-playing" and choose "Keep playing"
    Then the element "level-select" is visible
    And the character in the level I open is the one I saw on the creator

  Scenario: The character lasts the sitting
    Given I reached a level with a character I made this sitting
    When I leave the level and open another
    Then the same character is drawn
    And I am not asked to make one again

  Scenario: Every load is a first run, and that is the truth rather than a fault
    When I close the tab and open the game again
    Then "title-play" is present
    And "storage-warning" is visible
    And nothing on the screen blames me
    And nothing claims a character was saved

  Scenario: Settings still offers the way back in, for this sitting
    Given I made a character this sitting
    When I open Settings
    Then "setting-character" is visible and opens the creator
    And it opens on the character I made, not on a new draw
```

## TN-FIRSTRUN-06 — The first run from the keyboard, and with one switch

```gherkin
Feature: Reaching a level without a pointer, first time
  Scenario: From the keyboard, having chosen nothing
    Given I am using a keyboard only
    And I have no saved game
    When I open the game
    Then focus is on "title-play"
    When I press "Enter"
    Then focus is inside "character-creator" within one interaction
    When I press "Tab" until focus is on "start-playing" and press "Enter"
    Then the element "level-select" is visible with a card focused
    And focus is never left on the document body

  Scenario: Escape from the creator means back, and never means quit
    Given I am using a keyboard only
    And the element "character-creator" is visible
    When I press "Escape"
    Then the element "title-screen" is visible
    And focus is on "title-play"
    And the game has not been left

  Scenario: With one switch, having chosen nothing
    Given single-switch mode is on
    And I have no saved game
    When I use only short and long presses
    Then I can reach and choose "Play"
    And the highlight starts at the creator's first item and does not move until I press
    And I can reach and choose "start-playing" without choosing any option
    And I never need a second input at any step

  Scenario: The switch user is not made to walk the whole ring first
    Given single-switch mode is on
    And the element "character-creator" is visible
    Then "start-playing" is in the ring
    And reaching it requires no more presses than the number of items on the screen
    And nothing counts down while I get there
```

## TN-FIRSTRUN-07 — The first run with a screen reader

```gherkin
Feature: Announcing a first run
  Scenario: Each screen of the first run is announced once, by name
    Given I have no saved game
    When I move from the title screen to the creator and on to the level select
    Then "#tn-live-region" announces each new screen once, by its name
    And no announcement is cut off by the next one
    And exactly one element on the page has an "aria-live" attribute at every step

  Scenario: The creator says what it is for before it asks anything
    When "character-creator" opens
    Then it has an accessible name that is not empty
    And its heading reads "Make your character"
    And the sentence "Pick how you look. You can change this later in Settings." is in the
      accessibility tree as text

  Scenario: Nothing announces a choice the player did not make
    When "character-creator" opens
    Then the arrival is announced once
    And the five randomised options are not announced one by one as if I had chosen them

  Scenario: Exactly one screen is present at a time
    Then at no point are two of "title-screen", "character-creator", "level-select" and "playable"
      present in the accessibility tree together
    And a screen that has been left is removed, not merely hidden behind a style rule

  Scenario: axe-core is clean at every step of the first run
    When axe-core runs against the whole page at the title screen, the creator and the level select
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for any of those scans
    And every scan passes with no violations
    And the scans run against the built output, not only against a harness
```

## TN-FIRSTRUN-08 — Reduced motion and 200 % text on the first run

```gherkin
Feature: The first run honours the settings
  Scenario: No screen on the first run animates
    Given reduced motion is on
    When I move from the title screen to the creator and on to the level select
    Then each new screen appears with no slide, fade, scale or wipe
    And nothing travels between two screens

  Scenario: A setting turned on before Play is still on after Start playing
    Given I set text scaling to 200 % and turned on "Less movement" from the title screen
    When I reach a level through the creator and the level select
    Then every screen on the way was drawn at 200 %
    And no screen was briefly drawn at 100 % first
    And "scene-state" reports "data-parallax-easing" equal to "off"

  Scenario: The whole first run works at 200 % on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every control needed to reach a level is reachable, by scrolling down if needed
    And "start-playing", "creator-back" and "creator-settings" are all reachable
    And the page never scrolls sideways
    And no control is covered by another
```

## TN-FIRSTRUN-09 — The first run in French

```gherkin
Feature: A first run in French
  Background:
    Given the language is French
    And I have no saved game

  Scenario: Every screen is French
    When I open the game
    Then "title-play" reads "Jouer"
    When I tap it
    Then the heading reads "Créez votre personnage"
    And the buttons read "Au hasard" and "Commencer à jouer"
    And "creator-back" reads "Retour"
    And no English word appears on any screen of the route
    And the document's "lang" is "fr" throughout

  Scenario: The primary control in French, on each of its two errands
    Then "start-playing" reads "Commencer à jouer"
    Given I have a saved character and I opened the creator from Settings
    Then "creator-done" reads "Terminé"
    And "start-playing" is not present

  Scenario: No string on this route asks the player's gender
    Then no string on "title-screen" or "character-creator" contains "(e)", "·e" or a bracketed ending
    And "Terminé" is drawn in that form for every player
    And no sentence about the player has to agree with anything

  Scenario: The language chosen before Play is the language the level speaks
    Given I set the language to French from the title screen
    When I finish the creator and open the one open level
    Then the level select, the HUD and the question card are in French
    And "#tn-live-region" announces in French

  Scenario: A missing French string on this route is a build failure
    Given the French bundle has no value for "creator.done"
    When the content check runs
    Then the build fails, naming the missing French string
```

---

## Open questions

- **`OQ-FIRSTRUN-1` — should a player who took "Back" out of the creator be offered it again more gently?**
  Today they see "Play" again and nothing acknowledges that they were there. *Recommendation:* nothing
  acknowledges it, on purpose. A screen that says "you did not finish" is a screen that marks the player
  down for leaving, and `README.md`'s rule is that a game that teaches never does. Revisit only if real
  players are seen bouncing off it.
- **`OQ-FIRSTRUN-2` — does `settings.character` belong in the Settings list or in a "My character" section?**
  Settings today is language, hold time and eight accessibility switches, and an appearance control is not
  an accessibility setting. *Recommendation:* one item at the top of the settings screen, above the switches,
  named for what it opens. A section for one item is a heading nobody needs. Routed to `TN-SET`, which owns
  that screen and that row.
- **`OQ-FIRSTRUN-3` — `character/changed` is a new event name.** `character/created` is in `README.md`'s
  list; this file needs a second one so that a listener which re-runs the first-run route cannot be triggered
  from Settings. *Recommendation:* `character/changed`, added to `README.md`'s list, covered by
  `OQ-EVENT-1` like the rest. If the use cases prefer one event with a flag, this file is updated and the
  scenarios keep their shape — what may not happen is one event with no way to tell the two cases apart.
- **`OQ-FIRSTRUN-4` — is three taps to a level still right once ten levels exist?** The map is carrying the
  "nine of ten are still being made" message today, which is `OQ-FLOW-2`'s reason for the extra screen. When
  that message stops being true, the creator handing straight to the last-played or the only open level
  becomes worth re-costing. *Recommendation:* leave it; re-open with `OQ-FLOW-2`, not separately, because
  they are the same tap.
- **`OQ-FIRSTRUN-5` — what does an imported save with a character from a newer build do?** `TN-SAVE`'s
  import path and `TN-LOOK-05`'s repair rule between them cover an option id this build does not have. What
  neither covers is a save carrying a **slot** this build does not have. *Recommendation:* ignore the unknown
  slot, keep the five it knows, and repair nothing — an unknown slot draws no part, which is the same
  mechanism every "none" option already uses. Routed to whoever owns the save codec; recorded here because
  this is where a player would meet it.
