# TN-ALBERTA — Level 8, the Alberta foothills: the words this level says for itself

**Intent.** The foothills level tells the player what it is getting ready, names the way they move, and names
itself when it fails and when it is finished — in both languages, with no building and no nation named on a
screen that may not name one, and with the treaty statement, and its recorded silence, left where they
belong.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the ride, the corral, the rancher, the barn's card, the quest — is written in the slice that builds them,
in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**, because
`content/levels/alberta-foothills.json` shipped, `content/game.config.json` lists it in `levels`, in
`journey` and in `unlockRules.order`, and three copy gates are failing by name for want of these four rows
and one mode label.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.alberta-foothills.title` — "The Alberta foothills" / « Les contreforts de l'Alberta » — and `level.alberta-foothills.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode labels the HUD draws | `locomotion.horse.label` — "Horse" / « Cheval »; `locomotion.walk.label` | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.*` | `TN-REACH-what-is-in-reach.md` |
| The landmark name and blurb | inline `localizedText` | `content/levels/alberta-foothills.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/alberta-foothills.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.alberta-foothills.loading` | Getting the pasture ready. | Préparation du pâturage. |
| `level.alberta-foothills.error.title` | We could not load the Alberta foothills. | Nous n'avons pas pu charger les contreforts de l'Alberta. |
| `stamp.alberta-foothills.earned` | You earned the Alberta foothills stamp. | Vous avez obtenu le tampon des contreforts de l'Alberta. |
| `level.alberta-foothills.play` | Play the Alberta foothills | Jouer dans les contreforts de l'Alberta |

**`level.alberta-foothills.loading` names the pasture because the pasture is the ground the horse walks on.**
The level document's four parallax layers are the sky, the Rocky Mountain front, the rolling foothills, and
the foreground the player stands on — `alberta-foothills-layer-40-rangeland`, which
`assets/style/alberta-foothills-level.md` §1 describes as a pasture plane with a wire fence, three cattle and
a two-track road, and §2 records as one of the two layers the `low` preset keeps. The sentence describes that
ground in common nouns, exactly as Ottawa's names the canal and Winnipeg's names the riverbank, and it
survives an art decision that moves the fence, the cattle or the track.

**The French could not use the obvious word, and that is the interesting half of this row.** « La prairie »
is the plainest French noun for open grassland and it is **the title of level 7** — « Les Prairies ». A
waiting screen reading « Préparation de la prairie. » would put the previous level's name on this level's
loading screen, which is the exact defect `TN-WAIT` exists to make impossible, arriving through a common noun
rather than through a template. « Le pâturage » is the plain, true, unambiguous alternative and it is what
the picture shows: fenced grazing land with cattle on it. **English has no such collision** — "the Prairies"
and "the pasture" are not the same word — which is why the two languages were checked separately and not
translated from each other.

**Two other wordings were considered and dropped.** "The rangeland" is the art sheet's own layer name and is
not a word a newcomer meets; « les terres de pâturage » is three words where every other row is one or two.
"The ranch land" points at the landmark rather than at the ground, which `TN-WAIT`'s rule 2 forbids, and it
would make the waiting screen an advertisement for the building the player has not reached yet.

**It does not name the Rockies, the foothills, Alberta or any town.** "Foothills" and "Alberta" are both in
the level's own **title**, which the player can already see above the sentence; repeating them is what
`TN-PRAIRIE` rejected for "Getting the prairie railway ready." The mountain front is drawn on a repeating
layer and `assets/style/alberta-foothills-level.md` §0 deliberately refuses to make it a graded subject,
"because a saw-tooth range that runs from New Mexico to the Yukon identifies a landform, not a province" — so
a loading sentence claiming the Rockies would be claiming from copy what the art was told not to claim.

**It does not name the Bar U Ranch, and neither does anything else in this game.**
`assets/style/alberta-foothills-level.md` §0 records that the point-of-interest hero was drawn from the **Bar
U Ranch National Historic Site** at Longview, from eight CC BY 2.0 photographs, and §6.1 records that its
blind contract asks for a *ranch* and is never asked for Alberta. The level document names the landmark
**"Working ranch"** / « Ranch en activité » — a **type**, not a trade name and not a site's name. So
`TN-NAMES`'s "a named ranch" row is **not exercised by this level either**, which is the second level running
(`OQ-ALBERTA-3`).

**It states no territorial fact and paraphrases none, and it does not resolve the silence in the one that
exists.** `content/levels/alberta-foothills.json` carries a statement quoted from the Crown's own
transcription of **Treaty No. 7**, naming seven First Nations and the treaty's boundaries, and
`docs/content-review.md` §10.2 fixes where a player reads it: the **"About this place"** panel, always
reachable, never modal, never dismissed to reach gameplay, sourced. A loading screen is the splash card
§10.2 rules out and a stamp line is a congratulation the player taps past.

**And the statement's silence is the part a copy row is most likely to break.**
`assets/style/alberta-foothills-level.md` §7 records that the statement says nothing about the **Métis Nation
of Alberta**, in whose Region 3 the Bar U sits, because a level carries one `fact.source` and one
`nationSource` and neither cited body speaks for them; `content/sources/cirnac-treaty-7.json`'s
`knownStaleness` carries it. **No row in this file resolves that**, in either direction: none of them names a
nation, none of them names a treaty, and none of them says whose land this is. A forty-character line that
tried to would be an unsourced claim about a people who have not been asked, which §1 does not allow at any
tier. The panel states what is sourced; the register states what is not; the loading screen says what is
being prepared; the stamp says what was earned.

### This level's four rows, and what each one is for

`TN-PRAIRIE` proved that a region breaks the English template as well as the French. **This level is the
second proof, and it is the first where a single sentence needs two different French prepositional forms.**

- **`level.alberta-foothills.error.title`.** The title is "The Alberta foothills", with a capital T, because
  that is how the map names it. Dropped into "We could not load {{level}}." it produces *"We could not load
  The Alberta foothills."* The row is written out with a lower-case article. **The French title has the same
  defect, and this is the first level where both languages do**: « Les contreforts de l'Alberta » dropped
  into « Nous n'avons pas pu charger {{level}}. » gives « charger Les contreforts », so the French row is
  written out with a lower-case « les » too. Until now the capitalisation problem was English-only.
- **`stamp.alberta-foothills.earned`.** French contracts twice in one sentence: « le tampon **des**
  contreforts **de l'**Alberta ». « des » is *de + les* and is **not a fifth shape** — the Prairies already
  took it — but « de l'Alberta » is the **first elision on a province name** in this game and it sits inside
  the same string. **One row, two prepositional forms**, which is a stronger argument against templating than
  any previous row: a template that got the first form right would still have to carry the second. The
  English uses the bare plural attributively — "the Alberta foothills stamp" — and a template would have
  produced "the The Alberta foothills stamp".
- **`level.alberta-foothills.play`.** « Jouer **dans les** contreforts de l'Alberta », the third level to take
  « dans » after the Ville de Québec's « dans la » and the Prairies' « dans les ». `TN-DONE` predicted this
  exact string when it listed what the levels still to come would cost; it is written here now rather than
  argued again. **It is the longest label the completion card has ever had to draw** — thirty-nine characters
  against « Jouer dans la Ville de Québec »'s twenty-nine — which is a measurement, not a remark, and
  `TN-ALBERTA-03` is where it is measured.
- **`level.alberta-foothills.loading`** is the row that is *not* about the place, which is why it is the one
  row of the four a region does not complicate — and it is the one row whose French had a collision of its
  own instead.

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled that word and lists the strings that
changed with it.

### `locomotion.horse.label`, and the check that it was earned

`content/levels/alberta-foothills.json` **does declare `horse`**, as the first of its two locomotion modes,
with `walk` second and `"labelKey": "locomotion.horse.label"` on it. So `horse` gets a label under
`TN-MOVE`'s rule that a mode is named when a level document declares it, and not before. The row is written
in `TN-MOVE-locomotion-labels.md`, with the other six, because a label belongs to a mode and a mode is
shared. The second declared mode is `walk`, whose label already exists, so this level adds exactly one row to
that table and no more.

**The label is "Horse" / « Cheval » and not "Riding", and the reason is in this game's own question bank.**
`TN-MOVE`'s `OQ-MOVE-4` reserved "Riding" for this level. It cannot have it: in Canadian English a **riding**
is an electoral district, `content/questions/elections/elec-03-another-name-for-a-riding.json` teaches
exactly that, and level 5's whole subject is federal elections. A HUD label that means one thing in the strip
and another in the question card is a word this game has taught the player to misread. `TN-MOVE` carries the
row, the reversal and the evidence.

## What this level does not have yet

`content/levels/alberta-foothills.json` declares `"characters": []` and `"quests": []`. There is no rancher,
no dialogue and no task on this level today, so **the only way to finish it is to reach the end of it**,
which earns the stamp and draws the completion card (`TN-DONE`). Everything on that card has to be true of a
player who rode from the spawn to the exit, and `TN-DONE-02` is the sentence for the one who answered nothing
on the way.

**The subject bank is the blocker here, and it is a real one.** `content/questions/economy/` holds **nineteen
authored questions, of which eighteen are reported verified** — well under `CLAUDE.md`'s floor of thirty
verified questions per subject before that level ships. This is the first built level whose bank does not
clear the floor, and the level is nonetheless in `unlockRules.order`, so a player can reach it. Nothing in
this file's four rows depends on a question; the level's *shipping* does. See `OQ-ALBERTA-2`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-ALBERTA-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06` |
| Single switch | `TN-ALBERTA-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-ALBERTA-03`; `TN-DONE-07` |
| Reduced motion | `TN-ALBERTA-03`; `TN-DONE-07` |
| 200 % text | `TN-ALBERTA-03`, which carries **the longest French string on the completion card in the game** |
| Bilingual | `TN-ALBERTA-04`, and `TN-ALBERTA-05` for the two completion rows |
| Failure path | `TN-ALBERTA-02`; the missing-row gate is `TN-WAIT-03` for two of these rows, `TN-DONE-05` for the other two and `TN-MOVE-02` for the mode label |

---

## TN-ALBERTA-01 — Opening the Alberta foothills

```gherkin
Feature: The foothills level says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Alberta foothills level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the pasture ready."
    And it does not read "Getting the canal ready."
    And it does not read "Getting the railway track ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Alberta foothills level is playable
    Then "scene-state" reports "data-level" equal to "alberta-foothills"
    And "scene-state" reports "data-mode" equal to "horse"
    And the element "hud-mode-label" reads "Horse"
    And it is not empty
    And it does not read "walk", because the document declares "horse" first
    And it does not read "Riding"

  Scenario: The waiting sentence claims no progress and names no place
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "Alberta", "foothills" or "contreforts"
    And it does not contain "Rockies", "Rocheuses" or the name of any town
    And it does not contain "ranch" or "Bar U"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "Treaty", "Traité" or "1877"
    And it does not contain "Métis"
    And it names none of the seven nations the level document names
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The landmark is named where a name teaches something
    Given the Alberta foothills level is playable
    When I engage the landmark
    Then "poi-card" shows "Working ranch" as text, inside a sentence that says what it is
    And that is the only screen in this level that names it
    And no lettering, brand, company name or town name is drawn on the buildings

  Scenario: The building the art was drawn from is named nowhere at all
    Then no string in this game in either language contains "Bar U"
    And the point-of-interest card names a type, not a site
    And the reference and its credit stay in "assets/refs/references.json"
```

## TN-ALBERTA-02 — The foothills fail in their own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Alberta foothills assets fail
    When I open the Alberta foothills level
    Then the event "level/failed" is emitted for "alberta-foothills"
    And the element "level-error" is visible
    And it says "We could not load the Alberta foothills." and "Check your connection and try again."
    And it does not say "We could not load The Alberta foothills."
    And it does not say "We could not load alberta-foothills."
    And it does not name Halifax, Québec City, Ottawa, Toronto, Winnipeg, the Prairies or Vancouver
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load the Alberta foothills."
    And it is not "Error", "Something went wrong" or empty

  Scenario: Both languages carry a written row, not the title dropped into a sentence
    Then the English sentence carries a lower-case article where the level's title carries a capital one
    And the French sentence carries a lower-case "les" where the French title carries "Les"
    And a build that draws either title's own capitalisation mid-sentence fails this scenario

  Scenario: A stalled load can be left
    Given the Alberta foothills level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the pasture ready."
    And nothing on the screen counts down
```

## TN-ALBERTA-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Alberta foothills level starts loading
    Then "#tn-live-region" reads "Getting the pasture ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Horse"
    And the canvas is "aria-hidden"

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for the Alberta foothills
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand
    Given the Alberta foothills level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap

  Scenario: A mode that is held, not driven, still counts down nothing
    Given the Alberta foothills level is playable
    And this level's first mode declares "drive" as "held"
    Then nothing on screen counts down
    And no scenario in this level passes or fails on how fast I act
    And reaching the landmark late costs me nothing
    And the level can also be completed at the walking speed the document declares second

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the pasture ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: The longest French string in the game fits
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    Then the whole of "Préparation du pâturage." is visible while loading
    And the whole of "Nous n'avons pas pu charger les contreforts de l'Alberta." is readable on "level-error"
    And the whole of "Jouer dans les contreforts de l'Alberta" is visible on its control
    And the whole of "Vous avez obtenu le tampon des contreforts de l'Alberta." is visible on the card
    And nothing is truncated with an ellipsis
    And the page does not scroll sideways
    And every control on the card is still at least 44 CSS px wide and tall
```

## TN-ALBERTA-04 — The foothills in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and does not borrow the previous level's name
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation du pâturage."
    And it does not read "Préparation de la prairie."
    And it does not contain "Prairies"
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD is French
    Given the Alberta foothills level is playable
    Then "hud-mode-label" reads "Cheval"
    And the level title reads "Les contreforts de l'Alberta" with the subtitle "L'économie du Canada"

  Scenario: The failure is French, with the plural article in lower case
    Given requests for the Alberta foothills assets fail
    Then "level-error" says "Nous n'avons pas pu charger les contreforts de l'Alberta."
    And it does not say "Nous n'avons pas pu charger Les contreforts de l'Alberta."
    And it does not say "Nous n'avons pas pu charger contreforts de l'Alberta."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The landmark's French name is the one the level document carries
    Given the Alberta foothills level is playable
    When I engage the landmark
    Then "poi-card" shows "Ranch en activité"
    And no waiting, error, stamp or prompt string in either language contains it

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-ALBERTA-05 — Finishing the foothills, and opening them from somewhere else

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Alberta foothills level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "alberta-foothills"
    And the element "quest-complete-stamp" reads "You earned the Alberta foothills stamp."
    And it does not read "You earned the The Alberta foothills stamp."
    And it does not name any other level
    And it does not contain "ranch", "Bar U" or the name of a town
    And it does not contain "Treaty", "Traité", "Métis" or the name of a nation

  Scenario: The heading is true of a level with no task
    Given this level document declares no quest
    When I reach the end of it
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!", as TN-DONE-01 requires

  Scenario: The French stamp sentence carries two prepositional forms in one line
    Given the language is French
    When I finish the Alberta foothills level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon des contreforts de l'Alberta."
    And it does not read "Vous avez obtenu le tampon de les contreforts de l'Alberta."
    And it does not read "Vous avez obtenu le tampon des contreforts de Alberta."
    And it does not read "Vous avez obtenu le tampon de la Alberta."
    And it does not contain "timbre"

  Scenario: The control that opens this level takes "dans les"
    Given finishing the Prairies opened the Alberta foothills
    Then "quest-complete-next" reads "Play the Alberta foothills"
    And in French it reads "Jouer dans les contreforts de l'Alberta"
    And it does not read "Jouer à les contreforts de l'Alberta"
    And it is not "Les contreforts de l'Alberta" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.alberta-foothills.earned" and "level.alberta-foothills.play"
      each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it

  Scenario: A player who rode past everything is not told they learned something
    Given I reached the end of the Alberta foothills having answered no question
    Then "quest-complete-stamp" still reads "You earned the Alberta foothills stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the ranch
```

---

## Open questions

- **`OQ-ALBERTA-1` — the rancher, the arrival announcement and the per-target prompt are not written here, on
  purpose.** `TN-LEVELS` gives this level the rancher; the level document places no character and declares no
  quest, so a speaker's label or an arrival sentence written today would be copy for behaviour nothing
  performs (ADR-0008). The landmark draws `TN-REACH`'s generic "Look at this place" / « Regarder ce lieu »
  until this level's full story writes something better — and it *may*, because "Working ranch" is a type and
  not a trade name. **`OQ-SPINE-4` is attached to this level and is still open**: « l'éleveur / l'éleveuse »
  is one of the two NPC roles whose French agrees, so whoever writes the rancher writes three French strings
  at once or picks an epicene role instead. *Recommendation:* answer `OQ-LEVEL-8` first, once, for both.
- **`OQ-ALBERTA-2` — this is the first built level whose question bank does not clear the floor, and it is
  reachable.** `content/questions/economy/` holds nineteen authored questions and eighteen reported verified,
  against `CLAUDE.md`'s thirty verified per subject "before that level ships". `content/game.config.json`
  lists `alberta-foothills` in `levels`, in `journey` and in `unlockRules.order` with
  `stampsToUnlockNext: 1`, so finishing the Prairies opens it. **None of this file's four rows is blocked** —
  a waiting sentence needs no question — but `TN-LEVELS-03`'s last row is not met and the level is on the
  map. *Recommendation:* twelve more verified `economy` questions, or the level comes out of
  `unlockRules.order` until they exist. Routed to the content author and the verifier and to the plan owner;
  `content/` is not this directory's to edit. **`OQ-SPINE-3` is stale on this point** — it says `economy` has
  "no bank at all", and it has most of one.
- **`OQ-ALBERTA-3` — `TN-NAMES`'s "a named ranch" row is not exercised, and that is now twice in a row.**
  `OQ-PRAIRIE-3` kept the row on the list on the grounds that it was "still right for level 8's named ranch".
  Level 8 has shipped and its landmark is called **"Working ranch"**, a type; the Bar U's name appears in the
  art sheet and in the reference credits and **in no player-facing string anywhere**. So the row on
  `TN-NAMES`'s list describes nothing this game draws. *Recommendation:* keep the row — it costs nothing and
  it is still the right rule if a named site is ever drawn — and record in `TN-NAMES` that neither of the two
  levels it was written for exercises it, so nobody reads the list as a claim that this game names a
  business. Written up in `TN-NAMES` in the same change.
- **`OQ-ALBERTA-4` — the level's facts are unverified, and one of them has a recorded silence a verifier has
  to leave alone.** `content/levels/alberta-foothills.json` carries `verification.status: "unverified"` on
  the point of interest's fact, on the territorial statement **and on the `nationSource`**, and
  `TN-LEVELS-03` requires every factual sentence a level puts on screen to be verified like a question.
  Nothing in this file's four rows states a fact, so none of them is blocked; the card and the panel are.
  **The good news is recorded too**: `assets/style/alberta-foothills-level.md` §7 shows this is the first
  level whose single `nationSource` — the Treaty 7 First Nations Chiefs' Association's own About page — names
  **all seven** of the nations the statement names, which is what `OQ-WINNIPEG-3` asked for and could not
  get. What is still open is the other half: the `fact.source` is the Crown's treaty text rather than a
  nation's own account, and the statement is silent about the Métis Nation of Alberta. **A verifier may
  neither resolve that silence nor add to the statement**, because no cited body in this document speaks for
  them; the honest outputs are a second source or a narrower statement. Routed to the content verifier and to
  `docs/content-review.md`'s owner.
- **`OQ-ALBERTA-5` — "the pasture" describes ground the player mostly gallops over.** The horse's `maxSpeed`
  is 620 px/s across a level 8640 px wide — about fourteen seconds end to end — so the pasture is scenery at
  speed rather than ground underfoot in the way Ottawa's canal is. It is the same licence `OQ-WAIT-3` took
  for "the harbour" and `OQ-WINNIPEG-4` took for "the riverbank": describe the ground, do not name it.
  *Recommendation:* accept it. If a reviewer wants the movement named instead, the English becomes "Getting
  the open range ready." and the French « Préparation du pâturage. » does not change at all, which is a fair
  sign that the French row is already the right one.
- **`OQ-ALBERTA-6` — the horse is a living animal and this game has depiction rules about those.**
  `assets/style/alberta-foothills-level.md` §6.3 records a horse drawn at 118 px at the withers, and §7
  records that **no Indigenous content of any kind is drawn in this level**. Nothing in this file's rows
  describes the animal, so nothing here is blocked — but the level's full story will have to say what the
  player is riding and how it is drawn, and `docs/content-review.md` §1 is engaged the moment tack, a
  blanket or a pattern appears on it. *Recommendation:* state it in the level's full story before the ride is
  tuned, in the shape `TN-GUIDE` uses for the beaver, so that "a plain working saddle and nothing else" is a
  written decision rather than an omission.
