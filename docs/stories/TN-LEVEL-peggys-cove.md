# TN-PEGGYS — Level 2, Peggy's Cove: the words this level says for itself

**Intent.** Peggy's Cove tells the player what it is getting ready, names the way they move, and names itself
when it fails and when it is finished — in both languages, with no lighthouse and no nation named on a screen
that may not name one, and with a territorial statement quoted from a Mi'kmaw body's own words left exactly
where it is, whole and in one place.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the walk across the barrens, the lighthouse's card, an NPC if one is ever placed, a quest if one is ever
authored — is written in the slice that builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is
the copy the level draws **today**, because `content/levels/peggys-cove.json` shipped,
`content/game.config.json` lists it in `levels`, in `journey` and in `unlockRules.order`, and three copy
gates are failing by name for want of these four rows.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.peggys-cove.title` — "Peggy's Cove" / « Peggy's Cove » — and `level.peggys-cove.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.walk.label` — "Walking" / « Marche »; this level adds **no row** | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/peggys-cove.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/peggys-cove.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## What this level is, and what it is not

This section is first because it is the reason this file exists at all, and because a sentence written without
it would undo the decision the level document and `assets/style/peggys-cove-level.md` §0 were built on.

**This level's place is a fishing village in Nova Scotia. Its subject is a chapter of *Discover Canada*.**
`docs/content-review.md` §1's shipping rule, item 5, blocks *"any level whose **subject** is a nation's
territory or history"*. That is not this level: the subject is **Who We Are**, the bank key is `who-we-are`,
and the place is Peggy's Cove, named as a village. §1's may-ship list, item 5, permits **a territorial fact
line** with a citation, and `TN-LEVELS-02`'s second scenario states the same thing from the gate's side —
*"A citation is not a depiction."*

Three consequences bind every row in this file, and each is asserted rather than trusted:

1. **No copy on this level makes its subject a territory.** Not the title, not the subject line, not the
   waiting sentence, not the error title, not the stamp sentence, not the play label. A title is what the map
   reads out ten times; a subject line is what the card says the level teaches. Neither may say that what this
   level teaches is whose land this is (`TN-PEGGYS-06`).
2. **The territorial statement lives in "About this place" and nowhere else.** `docs/content-review.md` §10.2
   fixes it there: always reachable, never modal, never dismissed to reach gameplay, sourced. A loading screen
   is the splash card §10.2 rules out and a stamp line is a congratulation the player taps past, and a
   forty-character paraphrase of a cited sentence is an unsourced claim about a nation.
3. **Nothing in this level depicts anybody.** `assets/style/peggys-cove-level.md` §0 records that
   `neverAdd` on **both** of this level's art subjects carries *"a figure of any kind, at any scale,
   including a silhouette and a crowd"*, so the prohibition is a checked contract clause. The copy-side half
   is this file's: no string on this level describes, addresses or names a person, a people or a nation.

### Two silences, kept

Both are recorded in `assets/style/peggys-cove-level.md` §0 and in
`content/sources/kmk-about-consultation.json`, and **copy may not fill either**:

- **The word "Mi'kma'ki" is not used on this level, in either language.** Halifax's document names it on the
  strength of a Crown page; this level cites a Mi'kmaw body, **and that body's own page does not use the word
  in its own text**. Importing it from a third document would put two sources behind one sentence, which is
  `OQ-VANCOUVER-4` repeated on purpose. This is a rule about **this level's strings**, not a claim that the
  word is wrong and not an amendment to `TN-LEVEL-halifax.md`.
- **The word "unceded" is not used**, although it is what nearly every Canadian institution would reach for.
  The cited page says *"never surrendered, ceded, or sold"*, and the level document's statement says that.
  `content/levels/quebec-city.json` and `content/levels/vancouver.json` leave the word out for the same
  reason, and no row in this file restores it.

### The Tier 3 obligation, and what copy may not imply about it

`assets/style/peggys-cove-level.md` §0 carries an ADR-0009 obligation dated **2026-12-08**: put this level,
its document and its two art subjects in front of a Tier 3 reviewer from the **Mi'kmaq**, and record the
answer. Five things it names are things no gate and no agent in this repository can check — among them
whether quoting the Assembly of Nova Scotia Mi'kmaw Chiefs in a *game* is wanted at all, and whether a level
set here that depicts **nobody** reads as respect or as erasure, which `docs/content-review.md` §10.3 already
calls a half-step.

**That review has not happened, and no string in this game may suggest it has.** No copy row, no panel line
and no credit may say "reviewed", "approved", "endorsed", "in partnership with" or "with the support of", in
either language, and `communityReview.status` is never rendered on any screen. `TN-PEGGYS-06` asserts each
of those absences by name, because a warm word in a credits line is the cheapest possible way to claim a
consent nobody gave.

**The marker itself is currently checked by nothing** — `scripts/check-obligations.mjs` scans `*.md` under
`docs/` only, and the art agent said so rather than assuming it counted. It is copied into
`docs/content-review.md` §13 in the same change as this file, which puts a clock on it. See `OQ-PEGGYS-4`.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.peggys-cove.loading` | Getting the bare rock ready. | Préparation de la roche nue. |
| `level.peggys-cove.error.title` | We could not load Peggy's Cove. | Nous n'avons pas pu charger Peggy's Cove. |
| `stamp.peggys-cove.earned` | You earned the Peggy's Cove stamp. | Vous avez obtenu le tampon de Peggy's Cove. |
| `level.peggys-cove.play` | Play Peggy's Cove | Jouer à Peggy's Cove |

**`level.peggys-cove.loading` names the bare rock because bare rock is the ground the player walks on.**
`assets/style/peggys-cove-level.md` §1 and §2 describe four parallax layers — the sky, the open Atlantic, the
far side of the cove, and `peggys-cove-layer-40-granite-barrens`, which is jointed rock, grass in the joints,
four erratics and two tide pools, and is the band the walk line sits in. §6.3 puts it plainly: *"Bare rock is
the subject; grass is what grows in the cracks in it."* The sentence describes that ground in common nouns,
exactly as Ottawa's names the canal and Winnipeg's names the riverbank, and it survives an art decision that
moves an erratic or a tide pool.

**It does not say "shore", and that is a fact about the picture rather than a preference.** The water, the
wharf and the fish stores are on the **cove** layer, *behind* and *below* the player; the barrens the player
crosses stand above them, and the cove shows between the rock crests (§2, "the opaque feet"). A sentence
naming the shore would name ground this level does not put under the player's feet — `TN-WAIT`'s rule 2. The
word is left free, and level 10 takes it.

**The French names the same rock and takes no risk with « Rocheuse ».** « Préparation de la côte rocheuse. »
was the first draft and was dropped: « rocheuse » is one letter from « les Rocheuses », and
`assets/style/alberta-foothills-level.md` §0 deliberately refuses to let this game claim the Rockies from
either art or copy (`TN-ALBERTA-01` asserts the absence of the word). « La roche nue » is plain, is
grade-6 in both halves, is exactly what the tile draws, and collides with nothing. Its adjective agrees with
« roche », a noun — never with the player — which is the same shape `TN-LOOK`'s hair values take and is what
keeps `docs/content-review.md` §8.6 satisfied.

**No noun in it is used by any other level, in either language.** Nine built levels now wait in nine
different nouns: « le port », « la pente enneigée », « le canal », « les rues de la ville », « la rive »,
« la voie ferrée », « le pâturage », « le front de mer », « la roche nue », and level 10's « la plage de
galets ». `TN-WAIT-01` checks it rather than trusting it.

**It names no landmark.** Peggy's Point Lighthouse is the level's only place-anchor and the only render
allowed to demand a place name (`assets/style/peggys-cove-level.md` §7). It is named in the
point-of-interest card's body, in both languages, and **nowhere else** — not in the waiting sentence, not on
the stamp, not in the HUD prompt (`TN-NAMES-01`, `TN-REACH`). A stamp is named after a place, never after a
building (`TN-PASSPORT-02`).

### The four rows, and the French that is easier than it looks

- **`level.peggys-cove.error.title`.** The title carries no article in either language, so this is one of the
  easy rows — the shape Halifax, Toronto, Winnipeg and Vancouver already have. **It is written out all the
  same**, for the reason `TN-WAIT` gives: you cannot tell which levels a template will break until you write
  them out, and the level immediately after this one in `unlockRules.order`, and the level at the end of it,
  both break it.
- **The place name is not translated, and the apostrophe is load-bearing.**
  `content/levels/peggys-cove.json` declares the title as "Peggy's Cove" in `en` **and** in `fr`, which
  `TN-NAMES-03` covers: a string identical in both languages is written twice on purpose, never one value
  reused for both by accident. `assets/style/peggys-cove-level.md` §11 records why the apostrophe is there at
  all — the Canadian Geographical Names Database drops it and writes *Peggys Cove*, and this game keeps it
  because ***Discover Canada* keeps it**, on the page 94 caption this game teaches from. Every string in this
  file uses the same apostrophe character the level document uses, and "Peggys Cove" appears in no
  player-facing string in either language (`TN-PEGGYS-02`).
- **`stamp.peggys-cove.earned`** takes « de », the form Toronto, Winnipeg and Vancouver already take.
  **No fifth French form after « tampon » arrives with this level** — level 10 is where the fifth one arrives
  (« du Nord »). The English is the one worth a second look: *"the Peggy's Cove stamp"* puts a definite
  article in front of a possessive, which is correct English and reads oddly enough that somebody will try to
  "fix" it to "Peggy's Cove stamp" or "the Peggy's stamp". Both are refused by name in `TN-PEGGYS-05`.
- **`level.peggys-cove.play`** takes « à » with no article — the form five other levels take — because the
  place is a settlement and not a region. It is **not** « Jouer dans Peggy's Cove » and **not** « Jouer à la
  Peggy's Cove ».

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled that word.

### `locomotion.walk.label`, and the mode this level does not declare

`content/levels/peggys-cove.json` declares **`walk` and nothing else**, with Halifax's tuning unchanged and
`"labelKey": "locomotion.walk.label"`. `walk` already has a row, so **this level adds nothing at all to
`TN-MOVE`'s table**, which is that table working as designed.

**The spine gave level 2 a canoe, and the level does not declare one.** Both reasons are in
`assets/style/peggys-cove-level.md` §9 and **either is sufficient alone**: `OQ-REVIEW-10` is unanswered and
`docs/content-review.md` §5.4 names the canoe as Indigenous technology used as a generic Canadian symbol —
*"A canoe as a vehicle the player rides is exactly the prop case in §5.1's second test"* — and there is no
canoe rig art, so a level declaring it would animate a walking figure under a HUD label that says otherwise.
`TN-LEVELS-02` makes a document declaring `canoe` a build failure with no override, and `TN-MOVE`'s rule
keeps `canoe` out of the label table while no document declares it. **Nothing in this file writes a label,
a prompt or a sentence about a canoe**, and `TN-PEGGYS-06` asserts the word appears in no string on this
level in either language.

## What this level does not have yet

`content/levels/peggys-cove.json` declares `"characters": []` and `"quests": []`. There is no NPC, no
dialogue and no task on this level today, so **the only way to finish it is to reach the end of it**, which
earns the stamp and draws the completion card (`TN-DONE`). Everything on that card has to be true of a player
who walked from the spawn to the exit, and `TN-DONE-02` is the sentence for the one who answered nothing on
the way. **This is the fifth built level with no quest**, so the heading defect `OQ-DONE-1` records reaches
one more level.

**The subject bank clears the floor comfortably.** `content/questions/who-we-are/` holds **forty-six authored
questions, all forty-six reported verified**, against `CLAUDE.md`'s thirty. The spine said for two sessions
that this bank existed and did not unblock the level, which was true then and is the right reading now too:
what unblocked this level is that its subject is a chapter and its place is a village, not that its bank is
full.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-PEGGYS-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06` |
| Single switch | `TN-PEGGYS-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-PEGGYS-03`; `TN-DONE-07` |
| Reduced motion | `TN-PEGGYS-03`; `TN-DONE-07` |
| 200 % text | `TN-PEGGYS-03` |
| Bilingual | `TN-PEGGYS-04`, and `TN-PEGGYS-05` for the two completion rows |
| Failure path | `TN-PEGGYS-02`; the missing-row gate is `TN-WAIT-03` for two of these rows and `TN-DONE-05` for the other two |
| Depiction | `TN-PEGGYS-06`, which is on the same footing as the five above |

---

## TN-PEGGYS-01 — Opening Peggy's Cove

```gherkin
Feature: Peggy's Cove says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Peggy's Cove level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the bare rock ready."
    And it does not read "Getting the harbour ready."
    And it does not read "Getting the gravel shore ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Peggy's Cove level is playable
    Then "scene-state" reports "data-level" equal to "peggys-cove"
    And "scene-state" reports "data-mode" equal to "walk"
    And the element "hud-mode-label" reads "Walking"
    And it is not empty
    And it does not read "walk"
    And it does not read "Canoeing" or name any mode the document does not declare

  Scenario: The waiting sentence claims no progress and names no landmark
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "lighthouse" or "phare"
    And it does not contain "Peggy's Cove", "Peggys Cove" or "Peggy's Point"
    And it does not contain "Nova Scotia" or "Nouvelle-Écosse"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "territory" or "territoire"
    And it does not contain "traditional" or "traditionnel"
    And it does not contain "unceded" or "non cédé"
    And it does not contain "Mi'kmaq", "Mi'kmaw" or "Mi'kma'ki"
    And it does not contain "title" or "titre"
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The panel states the fact, with its source, and is the only place that does
    Given the Peggy's Cove level is playable
    When I open "about-this-place"
    Then it shows the statement the level document carries
    And it shows "Mi'kmaq"
    And it names the body the statement is quoted from
    And no other screen in this level shows that name in either language
    And the panel is not modal and was not dismissed to reach the level

  Scenario: The landmark is named where a name teaches something
    Given the Peggy's Cove level is playable
    When I engage the landmark
    Then "poi-card" shows "Peggy's Point Lighthouse" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no lettering, wordmark or signage is drawn on the building

  Scenario: The HUD does not name it either
    Given the Peggy's Cove level is playable
    When I come within reach of the landmark
    Then "interact-prompt" reads "Look at this place", as TN-REACH-02 requires
    And no string drawn inside "hud" contains "Peggy's Point Lighthouse" in either language
```

## TN-PEGGYS-02 — Peggy's Cove fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Peggy's Cove assets fail
    When I open the Peggy's Cove level
    Then the event "level/failed" is emitted for "peggys-cove"
    And the element "level-error" is visible
    And it says "We could not load Peggy's Cove." and "Check your connection and try again."
    And it does not name Halifax, Québec City, Ottawa, Toronto, Winnipeg, the Prairies,
      the Alberta foothills, Vancouver or the North
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Peggy's Cove."
    And it is not "Error", "Something went wrong" or empty

  Scenario: The apostrophe is the one the level document carries
    Then "We could not load Peggy's Cove." contains the same apostrophe character as
      the "en" title in "content/levels/peggys-cove.json"
    And the French row contains that same character
    And no player-facing string in this game in either language reads "Peggys Cove"
    And a build in which a formatter replaces that character in one language only fails this scenario

  Scenario: The easy case is a written row all the same
    Then "level.peggys-cove.error.title" is a written row in both languages
    And it is not produced by dropping this level's title into a sentence
    And the last level in "unlockRules.order" would break that same template in both languages

  Scenario: A stalled load can be left
    Given the Peggy's Cove level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the bare rock ready."
    And nothing on the screen counts down
```

## TN-PEGGYS-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Peggy's Cove level starts loading
    Then "#tn-live-region" reads "Getting the bare rock ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Walking"
    And the canvas is "aria-hidden"

  Scenario: A screen-reader user can reach the territorial statement without leaving the level
    Given the Peggy's Cove level is playable
    Then "about-this-place-open" is reachable from the pause menu and from the credits
    And opening it does not pause, block or end the level
    And its content is text in the accessibility tree, not an image
    And nothing about it is announced unasked while I am playing

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Peggy's Cove
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand
    Given the Peggy's Cove level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap
    And nothing on screen counts down
    And no scenario in this level passes or fails on how fast I act

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the bare rock ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the bare rock ready." is visible while loading
    And in French the whole of "Préparation de la roche nue." is visible
    And both sentences on "level-error" are readable, by scrolling if needed
    And the whole of "Vous avez obtenu le tampon de Peggy's Cove." is visible on the completion card
    And every control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways
```

## TN-PEGGYS-04 — Peggy's Cove in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la roche nue."
    And it does not read "Préparation de la côte rocheuse."
    And it does not contain "Rocheuses"
    And it contains no percentage, no step count and no ellipsis
    And it contains no nation's name and no territorial claim
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD and the card headings are French
    Given the Peggy's Cove level is playable
    Then "hud-mode-label" reads "Marche"
    And the level title reads "Peggy's Cove" with the subtitle "Qui nous sommes"

  Scenario: The failure is French, and the place name is not translated and takes no article
    Given requests for the Peggy's Cove assets fail
    Then "level-error" says "Nous n'avons pas pu charger Peggy's Cove."
    And it does not say "Nous n'avons pas pu charger le Peggy's Cove."
    And it does not say "Nous n'avons pas pu charger l'anse de Peggy."
    And it does not say "Nous n'avons pas pu charger Peggys Cove."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The title is the same string in both languages and is declared twice
    Then "level.peggys-cove.title" has a value in "en" and a value in "fr"
    And neither language falls back to the other's value
    And a missing French value fails the content check even though the screen would read correctly

  Scenario: The landmark's French name translates the common noun and keeps the place name
    Given the Peggy's Cove level is playable
    When I engage the landmark
    Then "poi-card" shows "Le phare de Peggy's Point"
    And the English card shows "Peggy's Point Lighthouse"
    And "Peggy's Point" is identical in both
    And no waiting, error, stamp or prompt string in either language contains either name

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-PEGGYS-05 — Finishing Peggy's Cove, and opening it from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Peggy's Cove level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "peggys-cove"
    And the element "quest-complete-stamp" reads "You earned the Peggy's Cove stamp."
    And it does not read "You earned the Peggy's stamp."
    And it does not read "You earned Peggy's Cove stamp."
    And it does not name any other level
    And it does not contain "lighthouse" or "Peggy's Point"
    And it does not contain "territory", "unceded" or the name of a nation

  Scenario: The heading is true of a level with no task
    Given this level document declares no quest
    When I reach the end of it
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!", as TN-DONE-01 requires

  Scenario: The French stamp sentence takes "de", with no elision and no article
    Given the language is French
    When I finish the Peggy's Cove level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon de Peggy's Cove."
    And it does not read "Vous avez obtenu le tampon d'Peggy's Cove."
    And it does not read "Vous avez obtenu le tampon du Peggy's Cove."
    And it does not contain "timbre"

  Scenario: The control that opens this level takes "à"
    Given finishing Halifax opened Peggy's Cove
    Then "quest-complete-next" reads "Play Peggy's Cove"
    And in French it reads "Jouer à Peggy's Cove"
    And it does not read "Jouer dans Peggy's Cove"
    And it is not "Peggy's Cove" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.peggys-cove.earned" and "level.peggys-cove.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
    And this level adds no fifth French form after "tampon"

  Scenario: A player who walked past everything is not told they learned something
    Given I reached the end of Peggy's Cove having answered no question
    Then "quest-complete-stamp" still reads "You earned the Peggy's Cove stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the lighthouse
```

## TN-PEGGYS-06 — What this level never says (depiction path)

```gherkin
Feature: The place is a place, the subject is a chapter, and no string says otherwise
  Scenario: No copy row makes this level's subject a territory
    Then "level.peggys-cove.title" reads "Peggy's Cove" in both languages
    And "level.peggys-cove.subtitle" reads "Who we are" and "Qui nous sommes"
    And neither contains "Mi'kma'ki", "Mi'kmaq", "territory" or "territoire"
    And no waiting sentence, error title, stamp sentence or play label in either language contains them
    And the level document's "subject" is "who-we-are"

  Scenario: The word this level does not use
    Then no string drawn by this level in either language contains "Mi'kma'ki"
    And this is a rule about this level's strings and not about TN-LEVEL-halifax.md's
    And no string in this level contains "unceded" or "non cédé"
    And the statement in "about-this-place" is the level document's own text, quoted, not paraphrased

  Scenario: No string claims a review that has not happened
    Then no string in this level in either language contains "reviewed", "approved" or "endorsed"
    And none contains "in partnership with", "with the support of", "approuvé", "en partenariat"
      or "avec le soutien"
    And no screen renders a "communityReview" status
    And a credit line naming a nation as a collaborator fails this scenario

  Scenario: Copy names nothing the art contract forbids
    Then no string in this level in either language contains "canoe", "canot" or "kayak"
    And none names a person, a people or a figure drawn in this level, because none is drawn
    And the "neverAdd" list on both of this level's art subjects is the other half of this scenario

  Scenario: The panel is the only territorial surface, and it degrades honestly
    Given the level document's territorial statement is quarantined because its source changed
    Then "about-this-place" says plainly that the source is being checked
    And it keeps its citation
    And it is not replaced by a paraphrase written by anything
    And no other screen in this level changes, because none of them carried the statement
```

---

## Open questions

- **`OQ-PEGGYS-1` — an NPC, an arrival announcement and a per-target prompt are not written here, on
  purpose.** `TN-LEVELS` gave level 2 no NPC while it was blocked, and the shipped document places no
  character and declares no quest, so a speaker's label or an arrival sentence written today would be copy for
  behaviour nothing performs (ADR-0008). The landmark draws `TN-REACH`'s generic "Look at this place" /
  « Regarder ce lieu ». *Recommendation:* when this level's full story is written, choose an **epicene**
  French role noun so `OQ-LEVEL-8`'s agreement question never arises here — and read
  `assets/style/peggys-cove-level.md` §0 before writing a word of any character, because a level whose
  territorial statement quotes a nation is the place where a well-meant line invents a person.
- **`OQ-PEGGYS-2` — the level's facts are unverified, and the four rows in this file are not.**
  `content/levels/peggys-cove.json` carries `verification.status: "unverified"` on the point of interest's
  fact, on the territorial statement **and** on the `nationSource`, and `TN-LEVELS-03` requires every factual
  sentence a level puts on screen to be verified like a question. Nothing in this file's four rows states a
  fact, so none of them is blocked; the card and the panel are. **The good half is worth recording**:
  `assets/style/peggys-cove-level.md` §8 shows this is the first level whose `fact.source` and `nationSource`
  are **one body speaking for itself about its own lands**, which is what `OQ-WINNIPEG-3` and `OQ-VANCOUVER-4`
  both asked for and neither could get. Routed to the content verifier.
- **`OQ-PEGGYS-3` — the statement is `volatile` for half a sentence, and the panel can lose it without
  warning.** `content/sources/kmk-about-consultation.json` records why: *never surrendered, ceded or sold* is
  about the absence of a historical cession and does not expire, while *a Title claim to all lands in Nova
  Scotia* describes a position inside a running negotiation. `CLAUDE.md` re-verifies volatile items every run
  and quarantines them. *Recommendation:* the panel behaves as `OQ-VANCOUVER-3` recommends — it says plainly
  that the source is being checked and keeps its citation — and **nothing in this file changes either way**,
  which is the point of keeping the statement out of these four rows. `TN-PEGGYS-06`'s last scenario is that
  behaviour written as acceptance. Routed to `docs/content-review.md`'s owner and to the verifier.
- **`OQ-PEGGYS-4` — the Tier 3 obligation was decoration until this change, and the fix should be the wider
  one.** `assets/style/peggys-cove-level.md` §0 and `assets/style/the-north-level.md` §0 both carry ADR-0009
  markers dated 2026-12-08 that `scripts/check-obligations.mjs` never reads, because it scans `*.md` under
  `docs/` only. Both are copied into `docs/content-review.md` §13 in this change, which puts a clock on them
  today. *Recommendation:* **also widen the scanner** to `assets/style/`, and treat the copies in §13 as the
  stop-gap they are. Two owners can write an obligation and only one directory is read, so the next marker an
  art agent writes will be decoration again — and it will be written by somebody who has just been told, by
  this very pattern, that writing it is enough. Routed to the engine agent; `scripts/` is not this directory's
  to edit. See `OQ-NORTH-5`, which is the same question from the other level.
- **`OQ-PEGGYS-5` — "the bare rock" describes ground the player crosses for seventeen seconds and nothing
  else.** The level is 7040 px at the walk's 420 px/s, the polyline is flat the whole way, and the roll of the
  barrens is drawn in the tile above the walk line rather than in the ground (`assets/style/peggys-cove-level.md`
  §3). So the sentence is true of the picture and slightly literal as a sentence.
  *Recommendation:* accept it, on the same licence `OQ-WAIT-3` took for "the harbour" and `OQ-ALBERTA-5` for
  "the pasture": describe the ground, do not name it. If a French reviewer prefers a noun over a noun with an
  adjective, « Préparation du granit. » is the fallback and it costs a grade-6 word this file would rather not
  spend.
