# TN-VANCOUVER — Level 9, Vancouver: the words this level says for itself

**Intent.** Vancouver tells the player what it is getting ready, names the way they move, and names itself
when it fails and when it is finished — in both languages, with no building and no nation named on a screen
that may not name one, and with a territorial statement that names three nations left exactly where it is,
whole.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the roll along the seawall, the artist, the pier's card, the quest — is written in the slice that builds
them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**, because
`content/levels/vancouver.json` shipped, `content/game.config.json` lists it in `levels`, in `journey` and in
`unlockRules.order`, and three copy gates are failing by name for want of these four rows and one mode label.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.vancouver.title`, `level.vancouver.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode labels the HUD draws | `locomotion.skateboard.label` — "Skateboarding" / « Planche à roulettes »; `locomotion.walk.label` | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/vancouver.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/vancouver.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.vancouver.loading` | Getting the waterfront ready. | Préparation du front de mer. |
| `level.vancouver.error.title` | We could not load Vancouver. | Nous n'avons pas pu charger Vancouver. |
| `stamp.vancouver.earned` | You earned the Vancouver stamp. | Vous avez obtenu le tampon de Vancouver. |
| `level.vancouver.play` | Play Vancouver | Jouer à Vancouver |

**`level.vancouver.loading` names the waterfront because the waterfront is the ground the board rolls on.**
The level document's four parallax layers are the sky, the North Shore, the inlet, and the foreground the
player stands on — `vancouver-layer-40-seawall`, which `assets/style/vancouver-level.md` §1 describes as a
balustrade, lawn, paving, benches, lamps, two cedars, gulls and four people, and §2 sums up as "a waterfront
path in a city park". The sentence describes that ground in common nouns, exactly as Ottawa's names the canal
and Winnipeg's names the riverbank, and it survives an art decision that moves the benches, the lamps or the
cedars.

**Three of this game's levels are on water and no two of them use the same noun, in either language.**
Halifax is "the harbour" / « le port », Winnipeg is "the riverbank" / « la rive », and this level is "the
waterfront" / « le front de mer ». That is checked rather than trusted (`TN-VANCOUVER-01`), because a
loading screen a player has seen three times before stops being read at all, and because Winnipeg's own file
rejected "the promenade" for exactly this reason — two levels sounding the same is how a player stops hearing
either.

**« Le front de mer » also appears in this level's territorial statement, and that is not the statement
leaking.** The statement's first sentence sets the scene — « Ce niveau se déroule sur le front de mer de
Vancouver, au bord de la baie Burrard » — and its territorial claim is the two sentences after it. A loading
screen that names the same ground with the same common noun has borrowed a **geographic word**, not a claim:
it names no nation, no inlet, no territory and no relationship, and `TN-VANCOUVER-01` asserts each of those
absences by name rather than leaving the distinction to a reader's good faith. The word "seawall" was
considered and dropped for the opposite reason — in Vancouver the Seawall is a named path, and the plain
French for it (« la digue ») means a dike, which is not what the picture shows.

**It does not name Canada Place.** Canada Place is on `TN-NAMES-naming-real-places.md`'s list — "a building
whose name is also a brand" — and `TN-NAMES-01` puts a name from that list in a point-of-interest card's body
and **nowhere else**, naming a loading message among the places it may not appear. It is named on the card
the player rolls up to, inside a sentence that says what it is, with its source. **The stamp sentence does
not name it either**: a stamp is named after a place, never after a building (`TN-PASSPORT-02`). The English
and French names in the level document are identical, which `TN-NAMES-03` covers.

**It names nothing this level was told not to draw.** `assets/style/vancouver-level.md` §0 records that
**totem poles** and **the inuksuk** are written into `neverAdd` on both of this level's subjects — not drawn
in any form, including background, silhouette, icon and loading art — and that the Lions Gate Bridge is a
recorded fallback that is also in `neverAdd` so it cannot drift into the seawall tile. A copy row is the
other door into the same room: a waiting sentence or a stamp line naming any of the three would put on screen
in words what the art contract forbids in pixels. `TN-VANCOUVER-01` and `TN-VANCOUVER-05` check for all three
in both languages.

### The territorial statement names three nations, and no row here narrows it

`content/levels/vancouver.json` carries a statement quoted from the **Tsleil-Waututh Nation's own account of
its own territory**, and `docs/content-review.md` §10.2 fixes where a player reads it: the **"About this
place"** panel, always reachable, never modal, never dismissed to reach gameplay, sourced. Three things about
it change what this file may write, and all three are recorded rather than left to be re-derived:

1. **The statement names three nations and the quote is one nation speaking for itself.** The Musqueam, the
   Squamish and the Tsleil-Waututh are all named; the cited sentence is the Tsleil-Waututh's, and the other
   two names come from the level's `nationSource`, MST Development Corporation's "The Partners", the
   development corporation the three nations own jointly. `assets/style/vancouver-level.md` §8 records that
   the two halves of one sentence therefore rest on two documents and only one can be registered.
2. **Narrowing it to one nation was refused, on purpose.** §8's words: downtown Vancouver is within all three
   territories and naming one would be a smaller claim than the truth. **No row in this file names any of
   them**, so nothing here can narrow it by accident — but the reason is written down so that a later reader
   editing a stamp line "for brevity" knows what brevity would cost.
3. **The word "unceded" is deliberately absent, and this file does not restore it.** §8: no treaty covers
   Vancouver, it is the word nearly every Canadian institution uses, and the cited page does not use it, so
   the statement does not either. A copy row that added it would be an agent making an unsourced legal claim
   in forty characters, which `docs/content-review.md` §1 does not allow at any tier.

**None of that reaches a loading screen or a stamp line.** A loading screen is the splash card §10.2 rules
out, a stamp line is a congratulation the player taps past, and a compressed paraphrase of a cited statement
is an unsourced claim about three nations rather than one. The panel states the fact; the loading screen says
what is being prepared; the stamp says what was earned; none of them borrows another's words.

### This level's four rows are the easy French case, written down beside the hard one

Vancouver takes no article, no elision and no contraction: « charger Vancouver », « le tampon de Vancouver »,
« Jouer à Vancouver ». That is the same shape as Toronto's and Winnipeg's, and **an easy case proves nothing
on its own** — it is written out here rather than templated for the reason `TN-WAIT` and `TN-DONE` both give,
and because level 8 shipped in the same change and is the hardest row either table has: « le tampon des
contreforts de l'Alberta » carries two prepositional forms in one sentence. A template that produced
Vancouver's four rows correctly would produce four wrong ones for the level immediately before it. **The two
levels are each other's evidence**, which is why they landed together.

`stamp.vancouver.earned` adds **no new French shape** after « tampon » — it is « de », the form Toronto and
Winnipeg already take. The four shapes stay four: « d' », « de la », « de », « des ».

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled it.

### `locomotion.skateboard.label`, and the check that it was earned

`content/levels/vancouver.json` **does declare `skateboard`**, as the first of its two locomotion modes, with
`walk` second and `"labelKey": "locomotion.skateboard.label"` on it. So `skateboard` gets a label under
`TN-MOVE`'s rule that a mode is named when a level document declares it, and not before. The row is written
in `TN-MOVE-locomotion-labels.md`, with the other six. The second declared mode is `walk`, whose label
already exists, so this level adds exactly one row to that table and no more.

**"Skateboarding" and not "Skating", because level 4 has "Skating" and it means ice.** Ottawa's `skate` is
"Skating" / « Patinage » on the canal. Two modes whose labels differ by one syllable would be a strip that
tells the player nothing, so the English is the full word and the French is the object — « Planche à
roulettes » — which is the pattern `bike` → "Biking" / « Vélo » already set. It is **the longest label in the
game in both languages**, and `TN-MOVE-05` is where it is measured at 200 %.

## What this level does not have yet

`content/levels/vancouver.json` declares `"characters": []` and `"quests": []`. There is no artist, no
dialogue and no task on this level today, so **the only way to finish it is to reach the end of it**, which
earns the stamp and draws the completion card (`TN-DONE`). Everything on that card has to be true of a player
who rolled from the spawn to the exit, and `TN-DONE-02` is the sentence for the one who answered nothing on
the way.

**The subject bank clears the floor, and it is the only one of the two levels shipped in this change that
does.** `content/questions/symbols/` holds **forty-two authored questions, all forty-two reported verified**,
against `CLAUDE.md`'s thirty. `economy` — the level immediately before this one — holds nineteen and
eighteen, which is `OQ-ALBERTA-2`. See `OQ-VANCOUVER-2`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-VANCOUVER-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06` |
| Single switch | `TN-VANCOUVER-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-VANCOUVER-03`; `TN-DONE-07` |
| Reduced motion | `TN-VANCOUVER-03`; `TN-DONE-07` |
| 200 % text | `TN-VANCOUVER-03`, which carries the longest mode label in the game |
| Bilingual | `TN-VANCOUVER-04`, and `TN-VANCOUVER-05` for the two completion rows |
| Failure path | `TN-VANCOUVER-02`; the missing-row gate is `TN-WAIT-03` for two of these rows, `TN-DONE-05` for the other two and `TN-MOVE-02` for the mode label |

---

## TN-VANCOUVER-01 — Opening Vancouver

```gherkin
Feature: Vancouver says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Vancouver level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the waterfront ready."
    And it does not read "Getting the harbour ready."
    And it does not read "Getting the riverbank ready."
    And it is text, not only a spinner

  Scenario: No two levels wait in the same noun
    Then the waiting sentences of Halifax, Winnipeg and Vancouver share no noun in English
    And "le port", "la rive" and "le front de mer" are three different nouns in French
    And a build in which two levels draw the same waiting sentence fails this scenario

  Scenario: The HUD says how I move here
    Given the Vancouver level is playable
    Then "scene-state" reports "data-level" equal to "vancouver"
    And "scene-state" reports "data-mode" equal to "skateboard"
    And the element "hud-mode-label" reads "Skateboarding"
    And it is not empty
    And it does not read "Skating", which is level 4's mode
    And it does not read "walk", because the document declares "skateboard" first

  Scenario: The waiting sentence claims no progress and names no building
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Canada Place"
    And it does not contain "Vancouver", "Burrard" or "Stanley"

  Scenario: The waiting sentence names nothing this level was told not to draw
    Given "level-loading" is visible
    Then it does not contain "totem" or "inuksuk"
    And it does not contain "Lions Gate"
    And no string in this level in either language contains any of them

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "territory", "territoire", "traditional" or "traditionnels"
    And it does not contain "unceded" or "non cédé"
    And it does not contain "səlilwət"
    And it names none of the three nations the level document names
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The panel says all three, because the statement says all three
    Given the Vancouver level is playable
    When I open "about-this-place"
    Then it shows "Musqueam", "Squamish" and "Tsleil-Waututh"
    And it shows the quoted sentence with its source
    And no other screen in this level shows any of those three names
    And no screen anywhere narrows the statement to one of them

  Scenario: The building is named where a name teaches something
    Given the Vancouver level is playable
    When I engage the landmark
    Then "poi-card" shows "Canada Place" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no logo, wordmark or stylised lettering is drawn with it

  Scenario: The HUD does not name it either
    Given the Vancouver level is playable
    When I come within reach of the landmark
    Then "interact-prompt" reads "Look at this place", as TN-REACH-02 requires
    And no string drawn inside "hud" contains "Canada Place" in either language
```

## TN-VANCOUVER-02 — Vancouver fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Vancouver assets fail
    When I open the Vancouver level
    Then the event "level/failed" is emitted for "vancouver"
    And the element "level-error" is visible
    And it says "We could not load Vancouver." and "Check your connection and try again."
    And it does not name Halifax, Québec City, Ottawa, Toronto, Winnipeg, the Prairies
      or the Alberta foothills
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Vancouver."
    And it is not "Error", "Something went wrong" or empty

  Scenario: The easy case is a written row all the same
    Then "level.vancouver.error.title" is a written row in both languages
    And it is not produced by dropping this level's title into a sentence
    And the level immediately before it in "unlockRules.order" would break that same template

  Scenario: A stalled load can be left
    Given the Vancouver level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the waterfront ready."
    And nothing on the screen counts down
```

## TN-VANCOUVER-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Vancouver level starts loading
    Then "#tn-live-region" reads "Getting the waterfront ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Skateboarding"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Vancouver
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand
    Given the Vancouver level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap

  Scenario: A mode that keeps rolling never costs me a landmark
    Given the Vancouver level is playable
    And this level's first mode declares the highest glide of any held mode
    When I roll past the landmark without stopping
    Then I can turn around and reach it again
    And nothing about it is marked as missed
    And nothing on screen counts down
    And no scenario in this level passes or fails on how fast I act

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the waterfront ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: The longest mode label in the game fits
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Skateboarding" is visible in "hud-mode-label"
    And in French the whole of "Planche à roulettes" is visible in it
    And neither is truncated with an ellipsis
    And neither covers "menu-button" or any other HUD control
    And the page does not scroll sideways

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the waterfront ready." is visible while loading
    And in French the whole of "Préparation du front de mer." is visible
    And both sentences on "level-error" are readable, by scrolling if needed
```

## TN-VANCOUVER-04 — Vancouver in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation du front de mer."
    And it contains no percentage, no step count and no ellipsis
    And it contains no nation's name and no territorial claim
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Vancouver level is playable
    Then "hud-mode-label" reads "Planche à roulettes"
    And it does not read "Patinage"
    And the level title reads "Vancouver" with the subtitle "Les symboles canadiens"

  Scenario: The failure is French, and takes no article
    Given requests for the Vancouver assets fail
    Then "level-error" says "Nous n'avons pas pu charger Vancouver."
    And it does not say "Nous n'avons pas pu charger le Vancouver."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The landmark's name is the same in both languages, and is written twice
    Given the Vancouver level is playable
    When I engage the landmark
    Then "poi-card" shows "Canada Place"
    And the level document declares that name in "en" and in "fr", not one value used for both
    And no waiting, error, stamp or prompt string in either language contains it

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-VANCOUVER-05 — Finishing Vancouver, and opening it from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Vancouver level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "vancouver"
    And the element "quest-complete-stamp" reads "You earned the Vancouver stamp."
    And it does not name any other level
    And it does not contain "Canada Place" in either language
    And it does not contain "totem", "inuksuk" or "Lions Gate"
    And it does not contain "territory", "unceded" or the name of a nation

  Scenario: The heading is true of a level with no task
    Given this level document declares no quest
    When I reach the end of it
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!", as TN-DONE-01 requires

  Scenario: The same sentence in French, with no elision and no article
    Given the language is French
    When I finish the Vancouver level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon de Vancouver."
    And it does not read "Vous avez obtenu le tampon d'Vancouver."
    And it does not read "Vous avez obtenu le tampon du Vancouver."
    And it does not contain "timbre"

  Scenario: The control that opens this level says what it will do
    Given finishing the Alberta foothills opened Vancouver
    Then "quest-complete-next" reads "Play Vancouver"
    And in French it reads "Jouer à Vancouver"
    And it is not "Vancouver" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.vancouver.earned" and "level.vancouver.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
    And the four French forms "d'Halifax", "de la Ville de Québec", "de Toronto" and "des Prairies"
      are each still a written row, and this level adds no fifth

  Scenario: A player who rolled past everything is not told they learned something
    Given I reached the end of Vancouver having answered no question
    Then "quest-complete-stamp" still reads "You earned the Vancouver stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the building

  Scenario: This is the last level a player can be offered today
    Given I finished Vancouver
    And no level after it in "unlockRules.order" has a document
    Then no "quest-complete-next" control is present, as TN-DONE-05 requires
    And nothing on the card says a level is coming, locked or unavailable
```

---

## Open questions

- **`OQ-VANCOUVER-1` — the artist, the arrival announcement and the per-target prompt are not written here,
  on purpose.** `TN-LEVELS` gives this level the artist; the level document places no character and declares
  no quest, so a speaker's label or an arrival sentence written today would be copy for behaviour nothing
  performs (ADR-0008). **The landmark's prompt is already settled and is not waiting on that**: Canada Place
  is on `TN-NAMES`'s list, so this level may not write a per-target row naming it and draws `TN-REACH`'s
  generic "Look at this place" / « Regarder ce lieu ». « L'artiste » is epicene, so this is one of the levels
  where `OQ-SPINE-4`'s agreement question does not arise. *Recommendation:* write the artist's name, the
  arrival announcement and the quest's copy together in this level's full story — and read
  `assets/style/vancouver-level.md` §0 before writing a word of it, because a level about Canadian symbols is
  where a well-meant line reaches for something on `docs/content-review.md` §5.2's list.
- **`OQ-VANCOUVER-2` — the bank clears the floor and the level's own facts do not.** Forty-two `symbols`
  questions are authored and all forty-two are reported verified, which clears `CLAUDE.md`'s thirty. But
  `content/levels/vancouver.json` carries `verification.status: "unverified"` on the point of interest's
  fact, on the territorial statement **and on the `nationSource`**, and `TN-LEVELS-03` requires every factual
  sentence a level puts on screen to be verified like a question. Nothing in this file's four rows states a
  fact, so none of them is blocked; the card and the panel are. Routed to the content verifier.
- **`OQ-VANCOUVER-3` — the territorial statement is `volatile` and the panel can lose it without warning.**
  `content/levels/vancouver.json` marks its `fact.source` `"volatile": true`, correctly: it is quoted from a
  living nation's own website rather than from a fixed publication, so `CLAUDE.md` re-verifies it every run
  and quarantines it when the page changes or `asOf` exceeds 180 days. **What nothing describes is what the
  panel draws when that happens.** A quarantined statement must not silently become an empty panel that reads
  as a level with no territory, and it must not be replaced by an agent's paraphrase. *Recommendation:* the
  panel says plainly that the source is being checked and keeps its citation, in the shape `TN-MAP-04` uses
  for a level that is not made yet — a true sentence about the state it is in. None of this file's four rows
  changes either way, which is the point of keeping the statement out of them. Routed to
  `docs/content-review.md`'s owner and to the verifier.
- **`OQ-VANCOUVER-4` — one `nationSource`, three nations, and two documents behind one sentence.**
  `assets/style/vancouver-level.md` §8 records it and it is repeated here because it is a copy-adjacent
  problem and not only an art one: the quoted sentence is the Tsleil-Waututh speaking for the Tsleil-Waututh,
  the other two names rest on MST Development Corporation's "The Partners", and `level.schema.json` gives a
  level exactly one `nationSource`. The statement is a citation rather than a depiction, so §1 is not
  engaged. **Narrowing it to one nation is refused** and this file does not reopen that. *Recommendation:*
  the schema gains a second `nationSource`, or the panel carries two citations; either way the statement
  stays as it is. **No copy in this file changes whichever way it lands**, because none of it names a nation,
  and that is by design (`TN-WAIT`'s rule 3). This is the same shape as `OQ-WINNIPEG-3` and
  `OQ-ALBERTA-4`, and three levels asking one question is usually one question. Routed to the architect and
  to the content verifier.
- **`OQ-VANCOUVER-5` — « Planche à roulettes » is three words where every other label is one.**
  `TN-MOVE-06` asserted that every value is a single noun, which was written before a level declared a mode
  whose French name is a compound. The scenario is amended in `TN-MOVE` to forbid what it was actually aimed
  at — an instruction, a verb phrase or a preposition — rather than a word count. *Recommendation:* keep
  « Planche à roulettes », which is the term on the signs in a Québec park, and put « Skateboard » and
  « Planche » in front of the first French reviewer with `OQ-MOVE-1` and `OQ-MOVE-4`. If width wins,
  « Planche » is the fallback and it is ambiguous with « planche à neige », which is a cost this level should
  not pay silently.
- **`OQ-VANCOUVER-6` — this level's hero is a pier and the seawall passes in front of it, which the copy
  quietly assumes.** `assets/style/vancouver-level.md` §6.2 records that 280 rows of the landmark texture are
  deliberately empty so that the building's waterline sits inside the inlet and the seawall draws over it.
  Nothing in this file depends on that — but `TN-REACH`'s prompt and this level's future point-of-interest
  copy both assume the player can *reach* a building that is standing in the water at `radiusPx` 320.
  *Recommendation:* prove the reach in the slice that tunes the board, before the point-of-interest sentence
  is written, because a card the player cannot open is a sentence nobody reads.
