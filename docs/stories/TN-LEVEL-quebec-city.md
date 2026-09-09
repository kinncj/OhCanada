# TN-QUEBEC — Level 3, Québec City: the words this level says for itself

**Intent.** Québec City tells the player what it is getting ready, names the way they move, names itself when
it fails and when it is finished — in both languages, with no place named that the level does not draw.

**This is not the whole Québec City level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the
full story — the toboggan, the terrace, the guide, the Château Frontenac card, the quest — is written in the
slice that builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws
**today**, because `content/levels/quebec-city.json` shipped and the game can open it.

**Amended 2026-09-08 — two more rows, and this level is again the one that proves the rule.** A level can now
be finished, which draws a stamp sentence and offers the next level
(`TN-DONE-finishing-a-level.md`). Both new rows are written out per level, and both are wrong here under any
template: the French takes « de la Ville de Québec » where three other levels take « de » or « d' », and
« dans la » where four take « à ».

**Amended again 2026-09-09 — this level has a quest, its giver is the guide, and the quest names the
building.** `content/quests/quebec-city-chateau-frontenac.json` ships, the level document places
`characterId: "guide"`, and there was no `npc.guide.name`, so the offer was refused; the name is now written
in `TN-GUIDE-the-guide.md`. The quest also **says "Château Frontenac"** — in its summary, in a line the
guide speaks, and in a step prompt the HUD's tracker draws — which `TN-DIALOGUE-what-a-quest-giver-says.md`
rules is allowed and `TN-NAMES-01` now says so. **One scenario in this file changed because of it**: the
point-of-interest card is no longer the *only* screen in this level that names the hotel, and pretending
otherwise would have made a passing scenario into a false one.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.quebec-city.title`, `level.quebec-city.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode labels the HUD draws | `locomotion.toboggan.label` — "Sledding" / « Glissade »; `locomotion.walk.label` | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws this file's two new rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| The guide's name and its prompt | `npc.guide.name`, `hud.interact.guide` | `TN-GUIDE-the-guide.md` |
| What the guide says in this level's quest | authored `dialogue[].text`, `summary`, `steps[].prompt` | `content/quests/quebec-city-chateau-frontenac.json`, under `TN-DIALOGUE-what-a-quest-giver-says.md` |
| What the HUD says when something else is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/quebec-city.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/quebec-city.json`, drawn by `about-this-place` |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.quebec-city.loading` | Getting the snowy slope ready. | Préparation de la pente enneigée. |
| `level.quebec-city.error.title` | We could not load Québec City. | Nous n'avons pas pu charger la Ville de Québec. |
| `stamp.quebec-city.earned` | You earned the Québec City stamp. | Vous avez obtenu le tampon de la Ville de Québec. |
| `level.quebec-city.play` | Play Québec City | Jouer dans la Ville de Québec |

**`level.quebec-city.loading` names the slope because the slope is what this level is.** The level document
declares `toboggan` as its first locomotion mode and carries a parallax layer named for the slope, above a
terrace and the river. Snow is not a guess: a toboggan is a thing you ride on snow, and a level that declares
that mode and draws no snow has a different problem than a wrong sentence.

**It does not name the Château Frontenac**, and it may not: the building is on `TN-NAMES`'s list, and
`TN-NAMES-01` puts a name from that list in a point-of-interest card's body or in a quest's own words about
going there — and nowhere else, naming a loading message as one of the places it may not appear. The hotel's
name on a waiting screen, with no source and no sentence around it, is the advertisement that file was
written to prevent. **The same holds for the stamp sentence**: a stamp is named after a place, not after a
hotel (`TN-PASSPORT-02`).

**It does not name Dufferin Terrace or Old Québec either**, for a smaller reason: the sentence describes the
ground under the player, in common nouns, and the level's place name is already on the screen the player came
from. "The snowy slope" is what they are about to be standing on.

**`level.quebec-city.error.title` is the row that proves the template would have been wrong.** English drops
the place name straight in — "We could not load Québec City." — and French needs an article the title row
does not carry: the level's title is « Ville de Québec », and the sentence is « … charger **la** Ville de
Québec. » A template built on the title would draw « charger Ville de Québec », which is not French. This is
the same defect `TN-COPY`'s worked example records — safe in English, wrong in French, and reading the
English tells you nothing. `TN-WAIT` states the rule; this row is the evidence for it, and the Prairies is
now the row that shows the English breaking too.

**`stamp.quebec-city.earned` and `level.quebec-city.play` are the second and third pieces of evidence.**
"You earned the {{level}} stamp." would draw « le tampon Ville de Québec » where the other levels draw
« le tampon d'Ottawa », « d'Halifax », « de Toronto », « de Winnipeg » and « des Prairies »; "Play {{level}}"
would draw « Jouer à Ville de Québec » where four take « à » and no article. Six rows, four French shapes,
two English shapes — which is why every level is written out and none is composed.

**« Ville de Québec » and not « Québec ».** On its own, « Québec » is the province as often as the city.
`TN-LEVELS` already chose the disambiguating form for the title, and the error sentence, the stamp sentence
and the play label use the same words, so a player reads one name for one place. `OQ-DONE-4` records that a
French reviewer may prefer the shorter « Jouer à Québec » on a button.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-QUEBEC-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06`; the quest's dialogue is `TN-GUIDE-04` |
| Single switch | `TN-QUEBEC-03`; `TN-WAIT-04`; `TN-DONE-06`; `TN-GUIDE-04` |
| Screen reader | `TN-QUEBEC-03`; `TN-DONE-07`; `TN-GUIDE-05` |
| Reduced motion | `TN-QUEBEC-03`; `TN-DONE-07` |
| 200 % text | `TN-QUEBEC-03` — the longest of this file's French sentences is its error title, and `TN-QUEBEC-05` for the longest label |
| Bilingual | `TN-QUEBEC-04`, and `TN-QUEBEC-05` for the two completion rows |
| Failure path | `TN-QUEBEC-02`; the missing-row gate is `TN-WAIT-03` for two of these rows and `TN-DONE-05` for the other two |

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

  Scenario: This level's quest can be given
    Given the Québec City level is playable
    When I engage the guide
    Then the element "dialogue-speaker" reads "The guide", the row TN-GUIDE owns
    And the event "quest/offered" is emitted for "quebec-city-chateau-frontenac"
    And no offer is refused for want of a speaker's name

  Scenario: The waiting sentence claims no progress and names no building
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Château Frontenac"
    And it does not contain "Dufferin"

  Scenario: The building is named where a name teaches something, and where the guide sends me
    Given the Québec City level is playable
    When I engage the landmark
    Then "poi-card" shows "Château Frontenac" as text, inside a sentence that says what it is
    And the only other place it appears is this level's quest — its summary, the guide's own lines
      and the step prompt the tracker draws — as TN-NAMES-01 and TN-DIALOGUE-06 allow
    And no copy table row in either language contains it
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
    And it does not name Ottawa, Halifax, Toronto, Winnipeg or the Prairies
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

  Scenario: The longest French sentences in this file still fit at 200 %
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

## TN-QUEBEC-05 — Finishing Québec City, and opening it from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Québec City level is playable
    When I finish it, by its task or by reaching the end
    Then the element "quest-complete-stamp" reads "You earned the Québec City stamp."
    And it does not contain "Château Frontenac"
    And it does not name any other level
    And the accent on "Québec" is present

  Scenario: The French stamp sentence carries the article the others do not
    Given the language is French
    When I finish the Québec City level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon de la Ville de Québec."
    And it does not read "Vous avez obtenu le tampon Ville de Québec."
    And it does not read "Vous avez obtenu le tampon de Québec."
    And it does not contain "timbre"

  Scenario: The control that opens this level takes "dans la" where four others take "à"
    Given finishing another level opened Québec City
    Then "quest-complete-next" reads "Play Québec City"
    And in French it reads "Jouer dans la Ville de Québec"
    And it does not read "Jouer à Ville de Québec"
    And it is not "Ville de Québec" on its own

  Scenario: The longest French label on the card still fits at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    Then the whole of "Jouer dans la Ville de Québec" is visible on its control
    And the whole of "Vous avez obtenu le tampon de la Ville de Québec." is visible
    And neither is truncated with an ellipsis
    And the control is still at least 44 CSS px wide and tall

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.quebec-city.earned" and "level.quebec-city.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
```

---

## Open questions

- **`OQ-QUEBEC-2` — the arrival announcement is not written here, and the NPC question answered itself.**
  The announcement belongs with the terrace and the quest, in the full level story, for the reason
  `OQ-HALIFAX-1` gives. **The archivist is gone**: this level places the guide, like levels 1 and 5, so
  `OQ-SPINE-4`'s worry that « archiviste » is not a grade-6 word is moot and `TN-LEVELS`'s NPC table is
  corrected. **The landmark's prompt is settled and unchanged**: the Château Frontenac is on `TN-NAMES`'s
  list, so this level may not write a per-target row naming it and draws `TN-REACH`'s generic « Regarder ce
  lieu » — the quest may name the hotel, the HUD's own chrome may not.
- **`OQ-QUEBEC-3` — "Sledding" is the HUD's word and "snowy slope" is the loading screen's, and neither is
  "toboggan".** The mode's id is `toboggan` and the two strings a player reads avoid the word, because the
  bar is CLB 4 / grade 6 (`OQ-MOVE-1`). If a reviewer decides a newcomer should meet the Canadian word,
  `locomotion.toboggan.label` changes in `TN-MOVE` and this file's loading sentence does not — the two are
  answering different questions.
- **`OQ-QUEBEC-4` — nothing in this file depends on `OQ-SPINE-1` any more.** The toboggan is a locomotion
  mode now: ADR-0023 moved the legal set into `content/game.config.json#/locomotionModes`, which lists it,
  and `content/levels/quebec-city.json` declares it. Recorded here because a reader who arrives from the
  spine will otherwise think this level cannot be opened. The outstanding half of that ADR — the adapter's
  hard-coded list of modes — is the engine's, and `prairie-rail`'s `train` is now the mode that would fail
  first.
- **`OQ-QUEBEC-5` — this level's bank is filled, and its quest can now be finished.**
  `content/questions/history/` holds 96 verified questions, which clears `CLAUDE.md`'s thirty for
  `subject: "history"`, so the answer step in `quebec-city-chateau-frontenac.json` has a bank to draw from.
  Recorded because this file previously carried the opposite worry. What is *not* settled is whether
  ninety-six questions on one subject is a draw a player meets fairly, which is `TN-CARD`'s and the
  scheduler's question rather than this file's.
