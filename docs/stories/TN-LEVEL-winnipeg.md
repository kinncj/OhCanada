# TN-WINNIPEG — Level 6, Winnipeg: the words this level says for itself

**Intent.** Winnipeg tells the player what it is getting ready, names the way they move, and names itself
when it fails and when it is finished — in both languages, with no building named on a screen that may not
name one, and with the territorial statement left where it belongs.

**This is not the whole Winnipeg level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the
full story — the walk, the promenade, the judge, the museum's card, the quest — is written in the slice that
builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**,
because `content/levels/winnipeg.json` shipped, `content/game.config.json` lists it in `levels` and in
`unlockRules.order`, and three copy gates are failing by name for want of these four rows.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.winnipeg.title`, `level.winnipeg.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.walk.label` — "Walking" / « Marche » | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/winnipeg.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/winnipeg.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.winnipeg.loading` | Getting the riverbank ready. | Préparation de la rive. |
| `level.winnipeg.error.title` | We could not load Winnipeg. | Nous n'avons pas pu charger Winnipeg. |
| `stamp.winnipeg.earned` | You earned the Winnipeg stamp. | Vous avez obtenu le tampon de Winnipeg. |
| `level.winnipeg.play` | Play Winnipeg | Jouer à Winnipeg |

**`level.winnipeg.loading` names the riverbank because the riverbank is the ground the player walks on.**
The level document's four parallax layers are the sky, a downtown skyline, the far bank with the open water,
and the foreground the player stands on — `winnipeg-layer-40-plaza`, which `assets/style/winnipeg-level.md`
describes as the riverside promenade: limestone slabs, a parapet, lamps, benches, planters and autumn trees.
The sentence describes that ground in common nouns, exactly as Ottawa's names the canal and Halifax's names
the harbour, and it survives an art decision that moves the paving, the benches or the trees.

**Two other wordings were considered and dropped.** "The promenade" is the Halifax quest's own word — that
quest is titled "The Harbour Walk" / « La promenade du port » — and two levels' copy sounding the same is how
a player stops hearing either. "The river park" is not a compound a newcomer meets, and « le parc riverain »
is above the grade-6 bar this project sets. « La rive » is the plainest true noun in French and "the
riverbank" is the plainest in English, and both are one word longer than nothing.

**It does not name the Canadian Museum for Human Rights.** The museum is on
`TN-NAMES-naming-real-places.md`'s list, and `TN-NAMES-01` puts a name from that list in a point-of-interest
card's body and **nowhere else**, naming a loading message among the places it may not appear. The museum is
named on the card the player walks up to, inside a sentence that says what it is, with its source. **The
stamp sentence does not name it either**: a stamp is named after a place, never after a building
(`TN-PASSPORT-02`).

**It does not name The Forks, and it does not mention Treaty No. 1, the Red River Métis, or any of the seven
nations the level document names.** `content/levels/winnipeg.json` carries a sourced territorial statement
quoted from Parks Canada's own page for The Forks National Historic Site, and `docs/content-review.md` §10.2
fixes where a player reads it: the **"About this place"** panel, always reachable, never modal, never
dismissed to reach gameplay, sourced. §10.2 names the shape this must not take in almost these words — not a
modal on level entry that the player dismisses to get to the game, not a splash card. **A loading screen is a
splash card the player waits past, and a stamp line is a congratulation they tap past.** A forty-character
paraphrase of a cited statement about seven nations would also be an unsourced claim made by an agent, which
§1 does not allow at any tier. The panel states the fact; the loading screen says what is being prepared; the
stamp says what was earned; none of them borrows another's words.

**`level.winnipeg.error.title`, `stamp.winnipeg.earned` and `level.winnipeg.play` are written out rather
than composed.** Winnipeg is the easy French case — no article, no elision, « charger Winnipeg », « le tampon
de Winnipeg », « Jouer à Winnipeg » — and an easy case proves nothing on its own, which is exactly why it is
written down beside the hard ones. « de Winnipeg » takes no elision, where Halifax's row takes « d'Halifax »;
a template that elides on a vowel would be wrong here, and one that never elides would be wrong there.
`TN-WAIT` and `TN-DONE` carry the general rule.

**« Tampon », never « timbre »** — a « timbre » is a postage stamp and the mark in a passport is a
« tampon ». `TN-PASSPORT-my-passport.md` settled it.

## What this level does not have yet

`content/levels/winnipeg.json` declares `"characters": []` and `"quests": []`. There is no judge, no
dialogue and no task on this level today, so **the only way to finish it is to reach the end of it**, which
earns the stamp and draws the completion card (`TN-DONE`). Everything on that card has to be true of a
player who walked from the spawn to the exit, and `TN-DONE-02` is the sentence for the one who answered
nothing on the way. The subject bank is not the blocker it is on levels 1, 3 and 5: `content/questions/justice/`
holds thirty-two authored questions for this level's subject, of which thirty-one are reported verified,
which clears `CLAUDE.md`'s floor of thirty. See `OQ-WINNIPEG-2`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-WINNIPEG-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06` |
| Single switch | `TN-WINNIPEG-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-WINNIPEG-03`; `TN-DONE-07` |
| Reduced motion | `TN-WINNIPEG-03`; `TN-DONE-07` |
| 200 % text | `TN-WINNIPEG-03`; `TN-DONE-07` |
| Bilingual | `TN-WINNIPEG-04`, and `TN-WINNIPEG-05` for the two completion rows |
| Failure path | `TN-WINNIPEG-02`; the missing-row gate is `TN-WAIT-03` for two of these rows and `TN-DONE-05` for the other two |

---

## TN-WINNIPEG-01 — Opening Winnipeg

```gherkin
Feature: Winnipeg says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Winnipeg level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the riverbank ready."
    And it does not read "Getting the canal ready."
    And it does not read "Getting the harbour ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Winnipeg level is playable
    Then "scene-state" reports "data-level" equal to "winnipeg"
    And "scene-state" reports "data-mode" equal to "walk"
    And the element "hud-mode-label" reads "Walking"
    And it is not empty

  Scenario: The waiting sentence claims no progress and names no building
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Canadian Museum for Human Rights" or "Musée canadien pour les droits de la personne"
    And it does not contain "The Forks" or "La Fourche"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "Treaty", "Traité" or "Treaty No. 1"
    And it does not contain "Métis"
    And it names none of the nations the level document names
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The museum is named where a name teaches something
    Given the Winnipeg level is playable
    When I engage the landmark
    Then "poi-card" shows "Canadian Museum for Human Rights" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no logo, wordmark or stylised lettering is drawn with it

  Scenario: The HUD does not name it either
    Given the Winnipeg level is playable
    When I come within reach of the landmark
    Then "interact-prompt" reads "Look at this place", as TN-REACH-02 requires
    And no string drawn inside "hud" contains the museum's name in either language
```

## TN-WINNIPEG-02 — Winnipeg fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Winnipeg assets fail
    When I open the Winnipeg level
    Then the event "level/failed" is emitted for "winnipeg"
    And the element "level-error" is visible
    And it says "We could not load Winnipeg." and "Check your connection and try again."
    And it does not name Halifax, Québec City, Ottawa, Toronto or the Prairies
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Winnipeg."
    And it is not "Error", "Something went wrong" or empty

  Scenario: A stalled load can be left
    Given the Winnipeg level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the riverbank ready."
    And nothing on the screen counts down
```

## TN-WINNIPEG-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Winnipeg level starts loading
    Then "#tn-live-region" reads "Getting the riverbank ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Walking"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Winnipeg
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand
    Given the Winnipeg level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the riverbank ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the riverbank ready." is visible while loading
    And in French the whole of "Préparation de la rive." is visible
    And both sentences on "level-error" are readable, by scrolling if needed
    And the page does not scroll sideways
```

## TN-WINNIPEG-04 — Winnipeg in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la rive."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Winnipeg level is playable
    Then "hud-mode-label" reads "Marche"
    And the level title reads "Winnipeg" with the subtitle "Le système de justice"

  Scenario: The failure is French, and takes no article
    Given requests for the Winnipeg assets fail
    Then "level-error" says "Nous n'avons pas pu charger Winnipeg."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The landmark's French name is the one the level document carries
    Given the Winnipeg level is playable
    When I engage the landmark
    Then "poi-card" shows "Musée canadien pour les droits de la personne"
    And no waiting, error, stamp or prompt string in either language contains it

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-WINNIPEG-05 — Finishing Winnipeg, and opening it from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Winnipeg level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "winnipeg"
    And the element "quest-complete-stamp" reads "You earned the Winnipeg stamp."
    And it does not name any other level
    And it does not contain the museum's name in either language
    And it does not contain "Treaty", "Traité", "Métis" or the name of a nation

  Scenario: The heading is true of a level with no task
    Given this level document declares no quest
    When I reach the end of it
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!", as TN-DONE-01 requires

  Scenario: The same sentence in French, with no elision
    Given the language is French
    When I finish the Winnipeg level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon de Winnipeg."
    And it does not read "Vous avez obtenu le tampon d'Winnipeg."
    And it does not contain "timbre"

  Scenario: The control that opens this level says what it will do
    Given finishing Toronto opened Winnipeg
    Then "quest-complete-next" reads "Play Winnipeg"
    And in French it reads "Jouer à Winnipeg"
    And it is not "Winnipeg" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.winnipeg.earned" and "level.winnipeg.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it

  Scenario: A player who walked past everything is not told they learned something
    Given I reached the end of Winnipeg having answered no question
    Then "quest-complete-stamp" still reads "You earned the Winnipeg stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the museum
```

---

## Open questions

- **`OQ-WINNIPEG-1` — the arrival announcement, the NPC and the per-target prompts are not written here, on
  purpose.** `TN-LEVELS` gives this level the judge; the level document places no character and declares no
  quest, so a speaker's label or an arrival sentence written today would be copy for behaviour nothing
  performs (ADR-0008). **The landmark's prompt is already settled and is not waiting on that**: the museum is
  on `TN-NAMES`'s list, so this level may not write a per-target row naming it and draws `TN-REACH`'s generic
  "Look at this place" / « Regarder ce lieu ». *Recommendation:* write the judge's name, the arrival
  announcement and the quest's copy together in this level's full story.
- **`OQ-WINNIPEG-2` — the bank clears the floor and the verification of the level's own facts does not.**
  Thirty-two `justice` questions are authored and thirty-one are reported verified, which is the first level
  after Ottawa whose bank meets `CLAUDE.md`'s thirty. But `content/levels/winnipeg.json` carries
  `verification.status: "unverified"` on the point of interest's fact **and on the territorial statement**,
  and `TN-LEVELS-03` requires every factual sentence a level puts on screen to be verified like a question.
  Nothing in this file's four rows states a fact, so none of them is blocked; the card and the panel are.
  Routed to the content verifier.
- **`OQ-WINNIPEG-3` — one `nationSource` and seven nations.** `assets/style/winnipeg-level.md` §7 flags it
  and it is repeated here because it is a copy-adjacent problem, not only an art one: the level document
  points at Treaty One Nation, which speaks for the seven First Nations who signed Treaty No. 1 and does not
  speak for every name in the quoted sentence. The statement is a citation rather than a depiction, so §1 is
  not engaged — but a verifier has to source each name to that nation's own material or narrow the
  statement. **No copy in this file changes whichever way it lands**, because none of it names a nation, and
  that is by design (`TN-WAIT`'s rule 3). Routed to the content verifier and to `docs/content-review.md`'s
  owner.
- **`OQ-WINNIPEG-4` — "the riverbank" describes paving.** The ground the player walks on is a limestone
  promenade at the water's edge, and the sentence calls it the riverbank, which is the place rather than the
  surface. It is the same licence `TN-WAIT`'s `OQ-WAIT-3` already took for "the harbour" and "the canal" —
  describe the ground, do not name it. *Recommendation:* accept it. If a reviewer wants the surface named,
  the English becomes "Getting the riverside walk ready." and the French « Préparation de la promenade au
  bord de l'eau. », which is the longest loading sentence in the game and would have to be re-measured at
  200 %.
