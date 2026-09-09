# TN-QUEBEC — Level 3, Québec City: the words this level says for itself

**Intent.** Québec City tells the player what it is getting ready, names the way they move, and names itself
when it fails — in both languages, with no place named that the level does not draw.

**This is not the whole Québec City level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the
full story — the toboggan, the terrace, the archivist, the Château Frontenac card, the quest — is written in
the slice that builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws
**today**, because `content/levels/quebec-city.json` shipped and the game can open it.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.quebec-city.title`, `level.quebec-city.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode labels the HUD draws | `locomotion.toboggan.label` — "Sledding" / « Glissade »; `locomotion.walk.label` | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/quebec-city.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/quebec-city.json`, drawn by `about-this-place` |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.quebec-city.loading` | Getting the snowy slope ready. | Préparation de la pente enneigée. |
| `level.quebec-city.error.title` | We could not load Québec City. | Nous n'avons pas pu charger la Ville de Québec. |

**`level.quebec-city.loading` names the slope because the slope is what this level is.** The level document
declares `toboggan` as its first locomotion mode and carries a parallax layer named for the slope, above a
terrace and the river. Snow is not a guess: a toboggan is a thing you ride on snow, and a level that declares
that mode and draws no snow has a different problem than a wrong sentence.

**It does not name the Château Frontenac**, and it may not: the building is on `TN-NAMES`'s list, and
`TN-NAMES-01` puts a name from that list in a point-of-interest card's body and nowhere else — naming a
loading message as one of the places it may not appear. The hotel's name on a waiting screen, with no source
and no sentence around it, is the advertisement that file was written to prevent.

**It does not name Dufferin Terrace or Old Québec either**, for a smaller reason: the sentence describes the
ground under the player, in common nouns, and the level's place name is already on the screen the player came
from. "The snowy slope" is what they are about to be standing on.

**`level.quebec-city.error.title` is the row that proves the template would have been wrong.** English drops
the place name straight in — "We could not load Québec City." — and French needs an article the title row
does not carry: the level's title is « Ville de Québec », and the sentence is « … charger **la** Ville de
Québec. » A template built on the title would draw « charger Ville de Québec », which is not French. This is
the same defect `TN-COPY`'s worked example records — safe in English, wrong in French, and reading the
English tells you nothing. `TN-WAIT` states the rule; this row is the evidence for it.

**« Ville de Québec » and not « Québec ».** On its own, « Québec » is the province as often as the city.
`TN-LEVELS` already chose the disambiguating form for the title, and the error sentence uses the same words,
so a player reads one name for one place.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-QUEBEC-03`; the escape route and the error buttons are `TN-WAIT-04` |
| Single switch | `TN-QUEBEC-03`; `TN-WAIT-04` |
| Screen reader | `TN-QUEBEC-03` |
| Reduced motion | `TN-QUEBEC-03` |
| 200 % text | `TN-QUEBEC-03` — the longest of the four French sentences is this one |
| Bilingual | `TN-QUEBEC-04` |
| Failure path | `TN-QUEBEC-02`; the missing-row gate is `TN-WAIT-03` |

---

## TN-QUEBEC-01 — Opening Québec City

```gherkin
Feature: Québec City says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Québec City level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the snowy slope ready."
    And it does not read "Getting the canal ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Québec City level is playable
    Then "scene-state" reports "data-level" equal to "quebec-city"
    And "scene-state" reports "data-mode" equal to "toboggan"
    And the element "hud-mode-label" reads "Sledding"
    And it is not empty

  Scenario: The waiting sentence claims no progress and names no building
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Château Frontenac"
    And it does not contain "Dufferin"

  Scenario: The building is named where a name teaches something
    Given the Québec City level is playable
    When I engage the landmark
    Then "poi-card" shows "Château Frontenac" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
```

## TN-QUEBEC-02 — Québec City fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Québec City assets fail
    When I open the Québec City level
    Then the event "level/failed" is emitted for "quebec-city"
    And the element "level-error" is visible
    And it says "We could not load Québec City." and "Check your connection and try again."
    And it does not name Ottawa, Halifax or Toronto
    And a button "Try again" is offered
    And a button "Go back" is offered

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Québec City."
    And the accent on "Québec" is present, in both languages

  Scenario: A stalled load can be left
    Given the Québec City level has not become playable
    When the load has not finished after the time-to-play budget has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the snowy slope ready."
```

## TN-QUEBEC-03 — Everybody gets these three strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Québec City level starts loading
    Then "#tn-live-region" reads "Getting the snowy slope ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Sledding"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Québec City
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And the highlight never lands on "hud-mode-label"

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the snowy slope ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: The longest French sentence in the set still fits at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    Then the whole of "Préparation de la pente enneigée." is visible while loading
    And the whole of "Nous n'avons pas pu charger la Ville de Québec." is readable on "level-error"
    And neither is truncated with an ellipsis
    And the page does not scroll sideways
```

## TN-QUEBEC-04 — Québec City in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la pente enneigée."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Québec City level is playable
    Then "hud-mode-label" reads "Glissade"
    And the level title reads "Ville de Québec" with the subtitle "L'histoire du Canada"

  Scenario: The failure is French, with its article
    Given requests for the Québec City assets fail
    Then "level-error" says "Nous n'avons pas pu charger la Ville de Québec."
    And it does not say "Nous n'avons pas pu charger Ville de Québec."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The French title is not assembled from the level's name
    Then the French error title is a written string, not a template with the title dropped into it
    And the same is true of every other level

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

---

## Open questions

- **`OQ-QUEBEC-2` — the arrival announcement and the interact prompts are not written here.** Same reason as
  `OQ-HALIFAX-1`: they belong with the archivist, the terrace and the quest, in the full level story, and
  writing them now would be copy for behaviour nothing performs. `OQ-SPINE-4` still has to settle whether
  « l'archiviste » is plain enough to be this level's NPC before that story is written.
- **`OQ-QUEBEC-3` — "Sledding" is the HUD's word and "snowy slope" is the loading screen's, and neither is
  "toboggan".** The mode's id is `toboggan` and the two strings a player reads avoid the word, because the
  bar is CLB 4 / grade 6 (`OQ-MOVE-1`). If a reviewer decides a newcomer should meet the Canadian word,
  `locomotion.toboggan.label` changes in `TN-MOVE` and this file's loading sentence does not — the two are
  answering different questions.
- **`OQ-QUEBEC-4` — nothing in this file depends on `OQ-SPINE-1` any more.** The toboggan is a locomotion
  mode now: ADR-0023 moved the legal set into `content/game.config.json#/locomotionModes`, which lists it,
  and `content/levels/quebec-city.json` declares it. `TN-LEVELS`'s "Blocked on `OQ-SPINE-1`" row is stale and
  is corrected there. Recorded here because a reader who arrives from the spine will otherwise think this
  level cannot be opened.
