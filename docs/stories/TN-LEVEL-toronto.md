# TN-TORONTO — Level 5, Toronto: the words this level says for itself

**Intent.** Toronto tells the player what it is getting ready, names the way they move, and names itself when
it fails — in both languages, with no building named on a screen that may not name one.

**This is not the whole Toronto level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the
full story — the bike, the square, the volunteer, the landmark card, the quest — is written in the slice that
builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**,
because `content/levels/toronto.json` shipped and the game can open it.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.toronto.title`, `level.toronto.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.bike.label` — "Biking" / « Vélo » | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/toronto.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/toronto.json`, drawn by `about-this-place` |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.toronto.loading` | Getting the city streets ready. | Préparation des rues de la ville. |
| `level.toronto.error.title` | We could not load Toronto. | Nous n'avons pas pu charger Toronto. |

**`level.toronto.loading` names the streets because the streets are what the player rides on.** The level
document's parallax layers are the sky, the skyline, a podium and a boulevard, and the level's locomotion
mode is the bike. The sentence describes the ground, in common nouns, exactly as Ottawa's names the canal —
and it is the same shape in both languages, so nothing is added or dropped in translation.

**It does not name the CN Tower.** The tower is on `TN-NAMES`'s list — a trademarked name, and the reason
`OQ-SPINE-5` asked for one written answer covering the class — and `TN-NAMES-01` puts such a name in a
point-of-interest card's body and nowhere else, naming a loading message as one of the places it may not
appear. The tower is named on the card the player rides up to, inside a sentence that says what it is, with
its source.

**It does not mention Treaty 13, the Toronto Purchase, or the Mississaugas of the Credit.** The level
document carries a sourced territorial statement and `docs/content-review.md` §10.2 fixes where a player
reads it: the "About this place" panel, always reachable, never blocking, sourced — explicitly *not* a splash
card the player waits past on the way into the game. A loading screen is that splash card. Compressing a
cited treaty statement into a waiting sentence would also be an agent restating a claim about a nation
without its source, which §1 does not allow at any tier. **The panel states the fact; the loading screen says
what is being prepared.**

**`level.toronto.error.title` is written out rather than composed.** Toronto, like Halifax and Ottawa, takes
no article in French — and `TN-LEVEL-quebec-city.md` is the row in the same set that does. One template
cannot be right for both, so all four are written (`TN-WAIT`).

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-TORONTO-03`; the escape route and the error buttons are `TN-WAIT-04` |
| Single switch | `TN-TORONTO-03`; `TN-WAIT-04` |
| Screen reader | `TN-TORONTO-03` |
| Reduced motion | `TN-TORONTO-03` |
| 200 % text | `TN-TORONTO-03` |
| Bilingual | `TN-TORONTO-04` |
| Failure path | `TN-TORONTO-02`; the missing-row gate is `TN-WAIT-03` |

---

## TN-TORONTO-01 — Opening Toronto

```gherkin
Feature: Toronto says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Toronto level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the city streets ready."
    And it does not read "Getting the canal ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Toronto level is playable
    Then "scene-state" reports "data-level" equal to "toronto"
    And "scene-state" reports "data-mode" equal to "bike"
    And the element "hud-mode-label" reads "Biking"
    And it is not empty

  Scenario: The waiting sentence claims no progress and names no building
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "CN Tower"
    And it does not contain "Treaty 13", "Toronto Purchase" or the name of a nation

  Scenario: The tower is named where a name teaches something
    Given the Toronto level is playable
    When I engage the landmark
    Then "poi-card" shows "CN Tower" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no logo, wordmark or stylised lettering is drawn with it
```

## TN-TORONTO-02 — Toronto fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Toronto assets fail
    When I open the Toronto level
    Then the event "level/failed" is emitted for "toronto"
    And the element "level-error" is visible
    And it says "We could not load Toronto." and "Check your connection and try again."
    And it does not name Ottawa, Halifax or Québec City
    And a button "Try again" is offered
    And a button "Go back" is offered

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Toronto."
    And it is not "Error", "Something went wrong" or empty

  Scenario: A stalled load can be left
    Given the Toronto level has not become playable
    When the load has not finished after the time-to-play budget has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the city streets ready."
```

## TN-TORONTO-03 — Everybody gets these three strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Toronto level starts loading
    Then "#tn-live-region" reads "Getting the city streets ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Biking"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Toronto
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And the highlight never lands on "hud-mode-label"

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the city streets ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the city streets ready." is visible while loading
    And in French the whole of "Préparation des rues de la ville." is visible
    And the whole of the mode label is visible in the HUD once playable
    And the page does not scroll sideways
```

## TN-TORONTO-04 — Toronto in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation des rues de la ville."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Toronto level is playable
    Then "hud-mode-label" reads "Vélo"
    And the level title reads "Toronto" with the subtitle "Les élections fédérales"

  Scenario: The failure is French
    Given requests for the Toronto assets fail
    Then "level-error" says "Nous n'avons pas pu charger Toronto." and "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The landmark's French name is the one the level document carries
    Given the Toronto level is playable
    When I engage the landmark
    Then "poi-card" shows "Tour CN"
    And no waiting or error string in either language contains it

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

---

## Open questions

- **`OQ-TORONTO-1` — the arrival announcement and the interact prompts are not written here.** Same reason as
  `OQ-HALIFAX-1`: they belong with the volunteer, the square and the quest, in the full level story.
- **`OQ-TORONTO-2` — `TN-LEVELS` gives this level Toronto City Hall as its landmark and the shipped document
  gives it the CN Tower.** The spine names City Hall's two curved towers as the blind-identification anchor,
  "civic, unmistakable in silhouette, and about the thing the level teaches", with the CN Tower as a *second*
  anchor on the skyline; `content/levels/toronto.json` ships one point of interest and it is the tower.
  Nothing in this file turns on it — no string here names either building — but the level's full story cannot
  be written until the two agree. Routed to the plan owner and the art agent, with `OQ-SPINE-5`.
- **`OQ-TORONTO-3` — level 5 and level 4 still draw from one question bank.** `OQ-SPINE-3`: every shipped
  question carries `subject: "government"` and roughly a dozen are about elections, which is this level's
  subject. Recorded here because this level is now openable, so the overlap is reachable rather than
  theoretical.
