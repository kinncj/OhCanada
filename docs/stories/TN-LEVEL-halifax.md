# TN-HALIFAX — Level 1, Halifax: the words this level says for itself

**Intent.** The level the game opens on speaks about Halifax — while it loads, in the HUD, and when it
fails — and never about somewhere else.

**This is not the whole Halifax level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the
full story — walking, the camera, the guide, the two landmarks, the quest — is written in the slice that
builds those, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**,
because a level document shipped, the game opens on it, and three strings on screen were another level's.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.halifax.title`, `level.halifax.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.walk.label` — "Walking" / « Marche » | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The waiting rule these strings obey | — | `TN-COPY-strings-and-counts.md` §Waiting copy |
| The landmark names and blurbs | inline `localizedText` | `content/levels/halifax.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/halifax.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.halifax.loading` | Getting the harbour ready. | Préparation du port. |
| `level.halifax.error.title` | We could not load Halifax. | Nous n'avons pas pu charger Halifax. |

**`level.halifax.loading` names the harbour because the harbour is what this level draws.** The level
document's parallax layers are the sky, the citadel above the town, the uptown streets and the quayside, and
`TN-LEVELS` describes the setting as Pier 21's frontage "with the harbour behind". The sentence describes the
ground and the water, in common nouns, exactly as Ottawa's names the canal.

**It does not name Pier 21**, and that is a rule rather than a preference: under `TN-NAMES-01` a name on that
file's list appears in a point-of-interest card's body and nowhere else, and a loading message is named there
as one of the places it may not appear. Pier 21 is named on the card the player reaches by walking to it,
with its source, which is where a name teaches something.

**It does not mention Mi'kma'ki, the Mi'kmaq, or the Peace and Friendship Treaties.** The level document
carries a sourced territorial statement and `docs/content-review.md` §10.2 fixes where a player reads it —
the "About this place" panel, always reachable, never blocking, sourced. §10.2 names the shape this must not
take in almost these words: not "a modal on level entry that the player dismisses to get to the game", not "a
splash card". A loading screen is a splash card the player waits past. A short paraphrase of a cited
statement would also be an unsourced claim about a nation, made by an agent, which §1 does not allow at any
tier. **The panel states the fact; the loading screen says what is being prepared; neither borrows the
other's words.**

**`level.halifax.error.title` is written out rather than composed from the level's title.** `TN-WAIT` gives
the general reason — French does not use one article for all ten places — and Halifax is the easy case that
proves nothing on its own: « charger Halifax » takes no article, « charger la Ville de Québec » takes one.
Written out, both are right; templated, one of them is wrong.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-HALIFAX-03`; the escape route and the error buttons are `TN-WAIT-04` |
| Single switch | `TN-HALIFAX-03`; `TN-WAIT-04` |
| Screen reader | `TN-HALIFAX-03` |
| Reduced motion | `TN-HALIFAX-03` |
| 200 % text | `TN-HALIFAX-03` |
| Bilingual | `TN-HALIFAX-04` |
| Failure path | `TN-HALIFAX-02`; the missing-row gate is `TN-WAIT-03` |

---

## TN-HALIFAX-01 — Opening the level the game starts on

```gherkin
Feature: Halifax says what it is getting ready
  As a new player opening the game for the first time
  I want the first thing I read to be about the place I am going
  So that the game is describing the state it is actually in

  Scenario: A cold load lands on Halifax and waits in Halifax's words
    Given I have no saved game
    And the level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the harbour ready."
    And it does not read "Getting the canal ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Halifax level is playable
    Then "scene-state" reports "data-level" equal to "halifax"
    And "scene-state" reports "data-mode" equal to "walk"
    And the element "hud-mode-label" reads "Walking"
    And it is not empty

  Scenario: The waiting sentence claims no progress
    Given "level-loading" is visible
    Then its text contains no percentage
    And it contains no fraction and no step count such as "2 of 4"
    And it contains no "…" and no "..."
    And nothing on it counts down

  Scenario: The waiting sentence names no place this level does not draw
    Given "level-loading" is visible
    Then its text does not contain "Pier 21"
    And it does not contain "Mi'kma'ki", "Mi'kmaq" or the word "treaty"
    And the territorial statement is drawn only by "about-this-place"
```

## TN-HALIFAX-02 — Halifax fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Halifax assets fail
    When I open the Halifax level
    Then the event "level/failed" is emitted for "halifax"
    And the element "level-error" is visible
    And it says "We could not load Halifax." and "Check your connection and try again."
    And it does not say "We could not load Ottawa."
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is what a screen reader is given for the card
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Halifax."
    And it is not "Error", "Something went wrong" or empty

  Scenario: A stalled load can be left
    Given the Halifax level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the harbour ready."
```

## TN-HALIFAX-03 — Everybody gets these three strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Halifax level starts loading
    Then "#tn-live-region" reads "Getting the harbour ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Walking"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player reaches everything these screens offer
    Given I am using a keyboard only
    And "level-error" is visible for Halifax
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    And "hud-mode-label" is never focused, because it is not a control

  Scenario: A switch user reaches them too
    Given single-switch mode is on
    And "level-error" is visible for Halifax
    Then both buttons are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the harbour ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the harbour ready." is visible while loading
    And the whole of "Walking" is visible in the HUD once playable
    And both sentences on "level-error" are readable, by scrolling if needed
    And the page does not scroll sideways
```

## TN-HALIFAX-04 — Halifax in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation du port."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Halifax level is playable
    Then "hud-mode-label" reads "Marche"
    And the level title reads "Halifax" with the subtitle "Droits et responsabilités"

  Scenario: The failure is French
    Given requests for the Halifax assets fail
    Then "level-error" says "Nous n'avons pas pu charger Halifax." and "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: Changing language changes these strings without leaving the level
    Given the Halifax level is playable and the language is English
    When I change the language to French
    Then "hud-mode-label" reads "Marche"
    And the announcing element carries "lang" equal to "fr"

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

---

## Open questions

- **`OQ-HALIFAX-1` — the arrival announcement is not written here, on purpose.** `TN-LEVEL-08` gives Ottawa
  `announce.arrived.ottawa` ("You are on the Rideau Canal in Ottawa. Skating."); Halifax has no such row, and
  `app/bootstrap` announces the level document's own title instead — a real string, in the player's language,
  thinner than the story asks for. *Recommendation:* write it in Halifax's full level story, next to the
  interact prompts and the guide's name, so one sentence is not authored months before the level it
  describes. Writing it today would be copy for behaviour nothing performs (ADR-0008).
- **`OQ-HALIFAX-2` — this level's landmark may move, and the loading sentence does not depend on it.**
  `TN-LEVELS` records that Pier 21 is a weak blind-identification subject and that the anchor may move to the
  Town Clock. Both are on the waterfront, so "Getting the harbour ready." survives either outcome —
  deliberately, because a loading sentence pinned to one landmark would have to be rewritten by an art
  decision. Recorded so the next reader knows it was a choice.
- **`OQ-HALIFAX-3` — is level 1's subject bank ready?** `CLAUDE.md` requires ≥ 30 verified questions for
  `rights` before this level ships, and every shipped question today carries `subject: "government"`. Nothing
  in this file depends on it; it is recorded because the game now *opens* on this level, which makes the gap
  the first one a player would meet. Routed to content, with `OQ-SPINE-3`.
