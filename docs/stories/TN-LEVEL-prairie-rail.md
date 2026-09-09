# TN-PRAIRIE — Level 7, The Prairies: the words this level says for itself

**Intent.** The prairie rail level tells the player what it is getting ready, names the way they move, and
names itself when it fails and when it is finished — in both languages, and in the four places where a
region's name behaves differently from a city's.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the train, the crossing, the journalist, the elevator's card, the quest — is written in the slice that
builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**,
because `content/levels/prairie-rail.json` shipped, `content/game.config.json` lists it in `levels` and in
`unlockRules.order`, and three copy gates are failing by name for want of these four rows and one mode label.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.prairie-rail.title` — "The Prairies" / « Les Prairies » — and `level.prairie-rail.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode labels the HUD draws | `locomotion.train.label` — "Train" / « Train »; `locomotion.walk.label` | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/prairie-rail.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/prairie-rail.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.prairie-rail.loading` | Getting the railway track ready. | Préparation de la voie ferrée. |
| `level.prairie-rail.error.title` | We could not load the Prairies. | Nous n'avons pas pu charger les Prairies. |
| `stamp.prairie-rail.earned` | You earned the Prairies stamp. | Vous avez obtenu le tampon des Prairies. |
| `level.prairie-rail.play` | Play the Prairies | Jouer dans les Prairies |

**`level.prairie-rail.loading` names the track because the track is what the player travels on.** The level
document declares `train` as its first locomotion mode, and `assets/style/prairie-rail-level.md` describes
the foreground layer as the right of way: ballast, forty ties, two rails, a fence, telegraph poles and a
grade crossing. The sentence describes that ground in common nouns, exactly as Ottawa's names the canal.

**It does not repeat the place name, in either language.** "Getting the prairie railway ready." was the
first draft and it says on the waiting screen what the title above it already says; `TN-WAIT` puts it
plainly — the sentence names *the work*, so the player is told what they are waiting for rather than read a
title twice. Dropping it also keeps the two languages the same shape, which the three-word French
« la voie ferrée » makes easy and « le chemin de fer des Prairies » would not.

**It does not name the grain elevator, Saskatchewan, Fort Qu'Appelle or any town.** The elevator is this
level's only anchor and it is deliberately never asked for a place — `assets/style/prairie-rail-level.md` §0
keeps `Saskatchewan` and `the Prairies` out of its blind-identification contract on purpose — so a loading
sentence that named one would be claiming from copy what the art was told not to claim.

**It states no territorial fact and paraphrases none.** `content/levels/prairie-rail.json` carries a sourced
statement about Treaty No. 4, the Cree and the Saulteaux, and `docs/content-review.md` §10.2 fixes where a
player reads it: the **"About this place"** panel, always reachable, never modal, never dismissed to reach
gameplay. A loading screen is the splash card §10.2 rules out, a stamp line is a congratulation the player
taps past, and a compressed paraphrase of a cited statement is an unsourced claim about two nations. The
panel states the fact; the loading screen says what is being prepared; the stamp says what was earned.

### This level's four rows are where a region stops behaving like a city

`TN-WAIT` and `TN-DONE` both say the same thing about French: it does not use one preposition, or one
article, for all ten places. **This level adds the sharper half of the argument — the English cannot be
templated either.**

- **`level.prairie-rail.error.title`.** The level's title is "The Prairies", with a capital T, because that
  is how the map names it. Dropped into "We could not load {{level}}." it produces *"We could not load The
  Prairies."*, which is not English mid-sentence. The row is written out with a lower-case article. The
  French takes the plural article — « charger **les** Prairies » — where Halifax and Toronto take none and
  the Ville de Québec takes « la ».
- **`stamp.prairie-rail.earned`.** French contracts: « le tampon **des** Prairies », which is *de + les*.
  That is a **fourth** French shape after « d'Halifax », « de la Ville de Québec » and « de Toronto », and no
  template produces all four. The English uses the bare plural attributively — "the Prairies stamp" — where
  every other level uses a singular place name.
- **`level.prairie-rail.play`.** « Jouer **dans les** Prairies », the second level to take « dans » after
  the Ville de Québec's « dans la ». `TN-DONE` predicted this exact string when it listed what the levels
  still to come would cost; it is written here now rather than argued again.
- **`level.prairie-rail.loading`** is the row that is *not* about the place at all, which is why it is the
  one row of the four a region does not complicate.

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled that word and lists the strings that
changed with it.

### `locomotion.train.label`, and the check that it was earned

`content/levels/prairie-rail.json` **does declare `train`**, as the first of its two locomotion modes, with
`walk` second — the same arrangement Québec City uses. So `train` gets a label under `TN-MOVE`'s rule that a
mode is named when a level document declares it, and not before. The row is written in
`TN-MOVE-locomotion-labels.md`, with the other four, because a label belongs to a mode and a mode is shared.

The second declared mode is `walk`, whose label already exists, so this level adds exactly one row to that
table and no more.

## What this level does not have yet

`content/levels/prairie-rail.json` declares `"characters": []` and `"quests": []`. There is no journalist, no
dialogue and no task, so **the only way to finish this level is to reach the end of it**, which earns the
stamp and draws the completion card (`TN-DONE`). `content/questions/modern-canada/` holds forty authored
questions for this level's subject, of which thirty-nine are reported verified — above `CLAUDE.md`'s floor of
thirty. See `OQ-PRAIRIE-2`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-PRAIRIE-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06` |
| Single switch | `TN-PRAIRIE-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-PRAIRIE-03`; `TN-DONE-07` |
| Reduced motion | `TN-PRAIRIE-03`; `TN-DONE-07` |
| 200 % text | `TN-PRAIRIE-03`, which carries the longest French label on the completion card after Québec City's |
| Bilingual | `TN-PRAIRIE-04`, and `TN-PRAIRIE-05` for the two completion rows |
| Failure path | `TN-PRAIRIE-02`; the missing-row gate is `TN-WAIT-03` for two of these rows, `TN-DONE-05` for the other two and `TN-MOVE-02` for the mode label |

---

## TN-PRAIRIE-01 — Opening the Prairies

```gherkin
Feature: The Prairies level says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Prairies level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the railway track ready."
    And it does not read "Getting the canal ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Prairies level is playable
    Then "scene-state" reports "data-level" equal to "prairie-rail"
    And "scene-state" reports "data-mode" equal to "train"
    And the element "hud-mode-label" reads "Train"
    And it is not empty
    And it does not read "walk", because the document declares "train" first

  Scenario: The waiting sentence claims no progress and names no place
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Prairies", "Saskatchewan" or any town's name
    And it does not contain "grain elevator" or "élévateur"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "Treaty", "Traité" or "Fort Qu'Appelle"
    And it names neither of the nations the level document names
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The landmark is named where a name teaches something
    Given the Prairies level is playable
    When I engage the landmark
    Then "poi-card" shows "Prairie grain elevator" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no lettering, company name or town name is drawn on the building
```

## TN-PRAIRIE-02 — The Prairies fail in their own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Prairies assets fail
    When I open the Prairies level
    Then the event "level/failed" is emitted for "prairie-rail"
    And the element "level-error" is visible
    And it says "We could not load the Prairies." and "Check your connection and try again."
    And it does not say "We could not load The Prairies."
    And it does not say "We could not load prairie-rail."
    And it does not name Halifax, Québec City, Ottawa, Toronto or Winnipeg
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load the Prairies."
    And it is not "Error", "Something went wrong" or empty

  Scenario: The English is a written row, not the title dropped into a sentence
    Then the sentence carries a lower-case article where the level's title carries a capital one
    And a build that draws the title's own capitalisation mid-sentence fails this scenario

  Scenario: A stalled load can be left
    Given the Prairies level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the railway track ready."
    And nothing on the screen counts down
```

## TN-PRAIRIE-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Prairies level starts loading
    Then "#tn-live-region" reads "Getting the railway track ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Train"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for the Prairies
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand
    Given the Prairies level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap

  Scenario: A mode that moves on its own still counts down nothing
    Given the Prairies level is playable
    Then nothing on screen counts down
    And no scenario in this level passes or fails on how fast I act
    And reaching a landmark late costs me nothing

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the railway track ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    Then the whole of "Préparation de la voie ferrée." is visible while loading
    And the whole of "Nous n'avons pas pu charger les Prairies." is readable on "level-error"
    And the whole of "Jouer dans les Prairies" is visible on its control
    And nothing is truncated with an ellipsis
    And the page does not scroll sideways
```

## TN-PRAIRIE-04 — The Prairies in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la voie ferrée."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Prairies level is playable
    Then "hud-mode-label" reads "Train"
    And the level title reads "Les Prairies" with the subtitle "Le Canada moderne"

  Scenario: The failure is French, with the plural article
    Given requests for the Prairies assets fail
    Then "level-error" says "Nous n'avons pas pu charger les Prairies."
    And it does not say "Nous n'avons pas pu charger Prairies."
    And it does not say "Nous n'avons pas pu charger la Prairie."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The landmark's French name is the one the level document carries
    Given the Prairies level is playable
    When I engage the landmark
    Then "poi-card" shows "Élévateur à grain des Prairies"
    And no waiting, error, stamp or prompt string in either language contains it

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-PRAIRIE-05 — Finishing the Prairies, and opening them from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Prairies level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "prairie-rail"
    And the element "quest-complete-stamp" reads "You earned the Prairies stamp."
    And it does not name any other level
    And it does not contain "grain elevator", "Saskatchewan" or a town's name
    And it does not contain "Treaty", "Traité" or the name of a nation

  Scenario: The heading is true of a level with no task
    Given this level document declares no quest
    When I reach the end of it
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!", as TN-DONE-01 requires

  Scenario: The French stamp sentence contracts where three other levels do not
    Given the language is French
    When I finish the Prairies level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon des Prairies."
    And it does not read "Vous avez obtenu le tampon de les Prairies."
    And it does not read "Vous avez obtenu le tampon de la Prairie."
    And it does not contain "timbre"

  Scenario: The control that opens this level takes "dans les"
    Given finishing Winnipeg opened the Prairies
    Then "quest-complete-next" reads "Play the Prairies"
    And in French it reads "Jouer dans les Prairies"
    And it does not read "Jouer à les Prairies"
    And it is not "Les Prairies" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.prairie-rail.earned" and "level.prairie-rail.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
    And the four French forms "d'Halifax", "de la Ville de Québec", "de Toronto" and "des Prairies"
      are each a written row

  Scenario: A player who rode past everything is not told they learned something
    Given I reached the end of the Prairies having answered no question
    Then "quest-complete-stamp" still reads "You earned the Prairies stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the elevator
```

---

## Open questions

- **`OQ-PRAIRIE-1` — the journalist, the arrival announcement and the per-target prompt are not written
  here, on purpose.** `TN-LEVELS` gives this level the journalist; the level document places no character and
  declares no quest, so a speaker's label or an arrival sentence written today would be copy for behaviour
  nothing performs (ADR-0008). The landmark draws `TN-REACH`'s generic "Look at this place" / « Regarder ce
  lieu » until this level's full story writes something better — and it *may* write something better, because
  "Prairie grain elevator" is a type and not a trade name (see `OQ-PRAIRIE-3`).
- **`OQ-PRAIRIE-2` — the bank clears the floor and the level's own facts are unverified.** Forty
  `modern-canada` questions are authored and thirty-nine are reported verified, which clears `CLAUDE.md`'s
  thirty. But `content/levels/prairie-rail.json` carries `verification.status: "unverified"` on the point of
  interest's fact and on the territorial statement, and `TN-LEVELS-03` requires every factual sentence a
  level puts on screen to be verified like a question. None of this file's four rows states a fact, so none
  of them is blocked; the card and the panel are. `assets/style/prairie-rail-level.md` §8 also records that
  the treaty source is a university encyclopedia rather than a Treaty Four institution's own account, and
  asks for it to be replaced when one becomes reachable. Routed to the content verifier.
- **`OQ-PRAIRIE-3` — `TN-NAMES`'s list has "a named grain elevator" for this level, and the shipped level
  has none.** That row was written when the spine required a *specific, cited* structure; the art was then
  drawn from one and ships **blank**, because every real elevator carries its company's and its town's name
  painted across the crib and `make verify-art` refuses lettering. So the level's landmark is a standard-plan
  type, named "Prairie grain elevator" in the level document, and **nothing on `TN-NAMES`'s list is drawn in
  this level today**. *Recommendation:* leave the row on that list — it is still right for level 8's named
  ranch and for any future named elevator — and record here that level 7 does not exercise it, so nobody
  reads the list as a claim that this level names a business. Nothing in this file's rows depends on it.
- **`OQ-PRAIRIE-4` — the level's id is not its place, and this is the first time that is true.** The id is
  `prairie-rail`; the place is "The Prairies". Every key in this file is keyed on the **id** —
  `stamp.prairie-rail.earned` — while every sentence names the **place**. That is correct (the key is a
  level's identity, the sentence is what a player reads) and it is worth writing down, because a reader who
  greps for "prairies" finds the sentences and a reader who greps for "prairie-rail" finds the keys, and
  levels 8 and 10 will be the same shape. `TN-MAP` and `TN-PASSPORT` already draw the title rather than the
  id, so no screen shows the id.
- **`OQ-PRAIRIE-5` — a locomotion mode that drives itself is new, and its accessibility consequences are not
  written yet.** `train` is `drive: "auto"` with `jump: null` and `interaction.requiresStop: true`, so this
  is the first level where the player is carried rather than moved, and where engaging a landmark means
  stopping first. That is behaviour, not copy, and it belongs in this level's full story — but three things
  in `README.md`'s rules land on it and should not be discovered mid-build: nothing may count down, no
  landmark may be missable in a way that costs the player anything, and the "Auto-move" setting and this
  mode have to be told apart. *Recommendation:* write the locomotion scenarios in the slice that tunes the
  train, and check them against `TN-SET`'s auto-move switch in the same pass.
