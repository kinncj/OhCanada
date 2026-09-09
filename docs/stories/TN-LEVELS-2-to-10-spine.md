# TN-LEVELS — Levels 1 to 10: the spine

**Intent.** Every level after Ottawa has its subject, its place, how the player moves through it, the one
landmark that has to be recognisable, and its NPC written down in one place — so art and content can work in
parallel, and so the map can name ten levels without anybody inventing a word.

**This file is a spine, not nine stories.** Each level gets its own story file, with full Gherkin and its own
accessibility and bilingual scenarios, in the slice that builds it — the same shape as
`TN-LEVEL-ottawa.md`. What is here is what has to be decided *before* those slices start, plus the two
contracts that bind all nine: a level is added by data and assets alone, and a level whose depiction is
blocked is not authored at all.

**Amended 2026-09-08: three more levels have documents, so three more have copy.** `content/levels/` held
`halifax`, `quebec-city`, `ottawa` and `toronto`, and the game opens on Halifax. Levels 1, 3 and 5
therefore have *partial* story files — `TN-LEVEL-halifax.md`, `TN-LEVEL-quebec-city.md` and
`TN-LEVEL-toronto.md` — which own the copy each of those levels draws today and nothing else. The full
stories still belong to the slices that build the locomotion, the NPC and the quest. A level a player can
already open cannot wait for its slice to be told what to say.

**Amended again 2026-09-09: levels 6 and 7 shipped documents and art, so they have partial story files
too.** `content/levels/winnipeg.json` and `content/levels/prairie-rail.json` are built, listed in
`content/game.config.json`, drawn (`assets/style/winnipeg-level.md`, `assets/style/prairie-rail-level.md`)
and each carries a question bank of its own. `TN-LEVEL-winnipeg.md` and `TN-LEVEL-prairie-rail.md` own their
copy. Three things follow that are worth naming here rather than in a level file: **`train` is the first
locomotion mode a level document has added since ADR-0023 opened the set**, and it cost exactly one row in
`TN-MOVE`; **these are the first two levels with no NPC and no quest at all**, so the only way to finish
either is to reach its end (`TN-DONE`); and **the question banks are no longer one bank** — seven subjects
now have their own directory under `content/questions/`, which closes `OQ-SPINE-3`.

Read `README.md` in this directory first. `TN-MAP-level-select.md` draws the ten entries below;
`TN-LEVEL-ottawa.md` is the worked example of what each of these rows becomes;
`TN-MOVE-locomotion-labels.md` owns what the HUD calls each locomotion mode in the table below,
`TN-WAIT-a-level-opens-or-it-does-not.md` owns the two strings every built level needs, and
`TN-GUIDE-the-guide.md` owns the one NPC name that is written down today.

## Three things that block work in this table, stated before the table

Nothing here is a schedule. Two of these rows cannot be started, and the third blocker has since been
answered.

1. **`docs/content-review.md` §1 blocks any level whose subject is a nation's territory or history**, and
   blocks any depiction of a named nation, until a Tier 3 reviewer exists. `OQ-REVIEW-2` — who that reviewer
   is and whether there is money for one — is unanswered, and it carries an obligation dated **2026-12-08**.
   That blocks **level 2 (Mi'kma'ki)** outright, which `OQ-REVIEW-3` already says, and it blocks **level 10
   (The North)** for the same reason: a level whose subject is Canada's regions, set in the North, either
   depicts the peoples of Inuit Nunangat or removes them from a level about where they live. Both readings
   need Tier 3. Level 2 and level 10 are therefore **not scoped below** — no landmark, no NPC, no id. Filling
   those cells in would make a blocked level look schedulable, and a plan that reads as schedulable gets
   scheduled. `TN-MOVE` applies the same rule to their locomotion labels and writes neither. **Level 2's
   question bank exists** — 46 verified questions under `who-we-are` — and that changes nothing: a bank is
   not a licence to depict, and the block is about depiction.
2. **`OQ-REVIEW-10` is unanswered and three locomotion modes depend on it.** The canoe (level 2), the kayak
   (named in that question and not assigned to a level) and the dogsled and qamutiik (level 10) are Indigenous
   technology used as generic Canadian symbols. `docs/content-review.md` §5.4 says so, and adds the sentence
   that matters here: *"A canoe as a vehicle the player rides is exactly the prop case in §5.1's second test,
   and slice 4 depends on it."* A locomotion mode is the most prop-like thing in this game — the player is
   sitting in it for the whole level. Flagged against levels 2 and 10 below and repeated here so it is not
   discovered mid-build.
3. ~~**Level 3's locomotion mode does not exist**~~ — **answered, and by the route this file asked for.**
   `docs/plan/slices.md` gives level 3 a toboggan, and `toboggan` was not among the eight modes
   `content/schemas/level.schema.json` and `app/application/ports/locomotion.ts` enumerated. ADR-0023 moved
   the legal set of modes into `content/game.config.json#/locomotionModes`, which now lists nine including
   `toboggan`, and `content/levels/quebec-city.json` declares it. Slice 2's claim survives: adding a mode is
   a content edit and a locale key, not a schema and a port change — and `prairie-rail`'s `train` is the
   first mode added *after* the ADR, which paid exactly that price and no more. The ADR records one
   obligation that is not this file's — `app/adapters/phaser/level-document.ts` still holds a hard-coded
   copy of the eight names, so the claim is not fully true until that reads the config. See `OQ-SPINE-1`.

## The ten levels

Order is the map order and the unlock order (`TN-MAP-01`). Levels 1 to 9 run roughly east to west; level 10
is north, which is why no copy in `TN-MAP` claims the journey is east to west (`OQ-MAP-3`).

| # | Level id | Subject (bank key) | Place | Locomotion | Landmark that must survive blind identification | NPC | Status |
|---|---|---|---|---|---|---|---|
| 1 | `halifax` | `rights` | Halifax, Nova Scotia | `walk` | Pier 21's waterfront frontage and Immigration Hall, with the harbour behind — see the note below on how weak this is | the guide | **Built, and the game opens here** — copy in `TN-LEVEL-halifax.md`; quest authored; bank 37 verified; full story pending |
| 2 | *not fixed* | `who-we-are` | *not scoped* | `canoe` | *not scoped* | *not scoped* | **Blocked — §1 and `OQ-REVIEW-10`**; bank 46 verified and unusable until the block lifts |
| 3 | `quebec-city` | `history` | Québec City (Old Québec) | `toboggan` | Château Frontenac seen from Dufferin Terrace, with the ramparts | the guide | **Built** — copy in `TN-LEVEL-quebec-city.md`; quest authored; bank 96 verified; full story pending |
| 4 | `ottawa` | `government` | Ottawa | `skate` | Centre Block and the Peace Tower from the canal | the officer | **Shipped** — `TN-LEVEL-ottawa.md`; bank 38 verified |
| 5 | `toronto` | `elections` | Toronto | `bike` | Toronto City Hall's two curved towers across Nathan Phillips Square — **but the shipped document draws the CN Tower**, `OQ-TORONTO-2` | the guide | **Built** — copy in `TN-LEVEL-toronto.md`; quest authored; bank 36 verified; full story pending |
| 6 | `winnipeg` | `justice` | Winnipeg (The Forks) | `walk` | The Canadian Museum for Human Rights, by its tower silhouette | the judge — **not placed yet** | **Built** — copy in `TN-LEVEL-winnipeg.md`; no NPC, no quest; bank 31 verified |
| 7 | `prairie-rail` | `modern-canada` | The Prairies (southern Saskatchewan) | `train` | A wooden prairie grain elevator beside the track — a standard plan, drawn from a cited building, shipping **blank**, see below | the journalist — **not placed yet** | **Built** — copy in `TN-LEVEL-prairie-rail.md`; no NPC, no quest; bank 39 verified |
| 8 | `alberta-foothills` | `economy` | The Alberta foothills | `horse` | A working ranch's gate and barn against the foothills, with the Rockies on the horizon | the rancher | Ready to scope, weak blind ID; **no bank yet** |
| 9 | `vancouver` | `symbols` | Vancouver | `skateboard` | Canada Place's white sails on the waterfront | the artist | Ready to scope — **read the trap below**; **no bank yet** |
| 10 | *not fixed* | `regions` | The North | `dogsled` | *not scoped* | *not scoped* | **Blocked — §1 and `OQ-REVIEW-10`**; no bank |

**"Built" is not "shipped".** A built level has a document, a place on the map, a waiting sentence, an error
title, a stamp sentence, a play label and a mode label, and can be opened. It does not yet have its own
locomotion tuning proved by scenarios, its NPC or its quest. **What it no longer lacks is questions**: the
six built levels each have a bank of their own above `CLAUDE.md`'s floor of thirty verified.
`TN-LEVELS-03` is the rest of the floor each of them still has to clear.

**Three of the four authored quests are given by the guide.** `content/quests/halifax-clock-and-pier.json`,
`quebec-city-chateau-frontenac.json` and `toronto-cn-tower.json` all declare `"giver": "guide"`, and the
three level documents place `characterId: "guide"` beside the quest. The NPC column above says "the guide"
for those three levels because that is what shipped, not because the table was rewritten: level 1 was always
the guide's, and levels 3 and 5 are now too. Its name is `npc.guide.name` and it is written in
`TN-GUIDE-the-guide.md`.

### Level 1 — Halifax, `rights`, walk

Pier 21 is the right subject anchor: it is where roughly a million people arrived in Canada, which is what a
level about rights and responsibilities should be standing on. It is a **weak blind-identification subject**,
and that has to be said now rather than discovered by `verify-art`: it is a long brick building, and slice 1
already produced the failure where a contract asked for "Ottawa" from art that was forbidden to draw the one
thing that says Ottawa. If the reference-accurate Pier 21 frontage does not return Pier 21 or Halifax under
blind identification, the level's recognisability anchor moves to the **Halifax Town Clock on Citadel Hill**,
and Pier 21 stays as the level's setting and quest location. Decide it from a real blind pass, not from
argument. The shipped document carries both as points of interest, and this level's waiting sentence names
neither, so the decision costs no copy (`OQ-HALIFAX-2`).

Halifax (Kjipuktuk) is in Mi'kma'ki. The "About this place" panel carries the sourced territorial fact
(`docs/content-review.md` §10.2, and §1's may-ship list item 5). **That is a fact with a citation, not a
depiction**, and it does not make this level a §1 blocked level — but the panel's wording is authored and
verified like any other claim, and nothing in the level depicts a nation. **The panel is also the only place
that statement appears**: `TN-LEVEL-halifax.md` keeps it out of the loading screen, because a screen the
player waits past is the shape §10.2 rules out and a compressed paraphrase is an unsourced claim.

### Level 2 — `who-we-are`, canoe: not scoped, on purpose

Blocked by `docs/content-review.md` §1, shipping-rule item 5, and by `OQ-REVIEW-10` for its locomotion. The
place, the landmark and the NPC are deliberately blank. **A bank of 46 verified questions exists for this
subject and does not unblock it**: the block is on depicting a nation and on setting a level in its
territory, not on asking a question sourced from *Discover Canada*. `OQ-REVIEW-3` recommends that
`docs/plan/slices.md` re-orders so this slice is not started and then abandoned mid-flight; that
re-ordering is the plan owner's.

### Level 3 — Québec City, `history`, toboggan

The Château Frontenac is one of the most identifiable buildings in Canada and blind identification should be
straightforward. The level runs along Dufferin Terrace and the Old Québec ramparts. The locomotion mode was
the problem and is not any more: ADR-0023 opened the set of modes to content and the shipped document
declares `toboggan` first and `walk` second. The building may be named on its point-of-interest card, and —
since `TN-DIALOGUE-what-a-quest-giver-says.md` — in this level's own quest, where the guide sends the player
to it. It may appear nowhere else (`TN-NAMES`), which is why the level's waiting sentence names the slope.

### Level 5 — Toronto, `elections`, bike

Toronto City Hall is civic, unmistakable in silhouette, and about the thing the level teaches. The CN Tower
can stand on the skyline as a second recognisability anchor; it must not carry a wordmark or a logo, under
the same rule that keeps the RCMP's marks off the officer. **The shipped document has this the other way
round** — one point of interest, and it is the tower, and the quest is named after it — which is
`OQ-TORONTO-2` and has to be settled before the level's full story is written.

**This level's bank is no longer inside level 4's.** `content/questions/elections/` holds 36 verified
questions, including the ballot, advance-poll and electoral-district questions that were filed under
`government` when this file first flagged the overlap; `government` keeps 38. The split this file asked for
happened, and `TN-LEVELS-03`'s last row is what keeps them apart.

### Level 6 — Winnipeg, `justice`, walk

The Canadian Museum for Human Rights has a silhouette nothing else in Canada has, and a level about the
justice system standing beside it is coherent. **The shipped level takes it and does not take the fallback**,
and `assets/style/winnipeg-level.md` §0 gives the reason this file should carry too: the Golden Boy stands on
a *provincial legislature*, which is where law is made, and this level teaches the courts, the police and the
rule of law. A legislature on a justice level teaches the wrong institution as confidently as it teaches the
right city. The consequence is structural and is stated rather than discovered: **Winnipeg as a place rests
on that one render**, because the four parallax layers repeat and none of them may carry anything
identifying.

The level is set at The Forks, a confluence and a historic meeting place. The territorial fact — Treaty
No. 1, and the homeland of the Red River Métis — is quoted from Parks Canada's own page and lives in "About
this place", and no depiction follows from it. `TN-LEVEL-winnipeg.md` keeps it off the loading screen and
off the stamp, and `OQ-WINNIPEG-3` records the one real problem with it: the level document has one
`nationSource` and the quoted sentence names seven nations.

### Level 7 — The Prairies, `modern-canada`, train

The grain elevator is the one prairie silhouette a person recognises without being told, and it is a *type*
rather than a named landmark — which is a problem for this project's rules, not a licence. This file asked
for **one specific surviving elevator**, recorded with its own credit, and that is what was drawn.
**It did not solve the identification problem, and the reason is worth carrying here**: every wooden prairie
elevator has its company's and its town's name painted across the crib, and `make verify-art` refuses a
`<text>` element in a render source, so the building ships **blank** and its blind contract is deliberately
never asked for a place (`assets/style/prairie-rail-level.md` §0). `assets/style/art-bible.md`'s "drop, never
substitute" is why no invented company name went on in place of the real one. `OQ-PRAIRIE-3` records what
that does to `TN-NAMES`'s list.

This is also the first level whose **id is not its place**: `prairie-rail` against "The Prairies". Every key
is keyed on the id and every sentence names the place, and levels 8 and 10 will be the same shape
(`OQ-PRAIRIE-4`).

### Level 8 — The Alberta foothills, `economy`, horse

The honest note first: **this is the weakest blind-identification row in the table.** A ranch gate against
foothills reads as "somewhere in western North America" and is unlikely to return "Alberta". The candidates
that would identify the place — Head-Smashed-In Buffalo Jump is the obvious one — are on Blackfoot
(Niitsitapi) territory and are a §1 depiction question, not an art question, so they are not here. Options
that stay inside the rules: a specific, cited, named ranch (the Bar U Ranch National Historic Site is one),
or the level's anchor moving to the Rockies on the horizon and accepting "the Canadian Rockies" as the blind
answer. Decide it with the art agent before the blind contract is written, because slice 1's recorded
failure was exactly a contract asking for more than the art was allowed to show. **Level 7 has just been
through the same argument and lost it**, which is the strongest available evidence that this row needs
deciding early. This level also has **no question bank yet**, which levels 6 and 7 no longer have as an
excuse.

### Level 9 — Vancouver, `symbols`, skateboard: the trap

A level called **Canadian Symbols**, set in **Vancouver**, is the single most likely place in this game for
`docs/content-review.md` §5.2 and §5.4 to be broken by accident. Both of the things a designer would reach
for are on the presumed-restricted or ambiguous lists:

- **totem poles** — the Stanley Park poles are the postcard image of Vancouver and are §5.2 and
  `OQ-REVIEW-10`. Not drawn, in any form, including background, silhouette, icon and loading art;
- **the inuksuk** — a real Inuit structure, and the Vancouver 2010 emblem, which is exactly why it will be
  suggested. `OQ-REVIEW-10`. Not drawn.

Written here so that the answer is already on the page when the art ticket is opened. Canada Place is a
building, drawn from a cited reference, and it carries none of this; the Lions Gate Bridge is the fallback.
The level's symbols content — the flag, the maple leaf, the beaver, the anthem — comes from *Discover
Canada* under ADR-0003 like any other question, and **no `symbols` bank exists yet**. **The beaver is also
this game's companion character**, and `TN-GUIDE-the-guide.md` is why that costs nothing here: the guide is
named by role, never "the beaver", so a level that teaches the symbol is not competing with a label the
player has been reading since level 1.

### Level 10 — The North, `regions`, dogsled: not scoped, on purpose

Blocked twice over: §1's shipping rule (a level about Canada's regions, set in the North, cannot avoid the
question of who lives there) and `OQ-REVIEW-10` (the dogsled and the qamutiik). The place name "The North"
is written in the copy table below because the map has to name ten levels; **nothing else about this level is
scoped**, and the map draws it as "Not made yet" like the rest (`TN-MAP-04`).

## The NPCs, and one French decision that is cheaper made once

Every NPC is named by role, never by an organisation, exactly as `TN-LEVEL-ottawa.md` names "the officer" /
« l'agent » and never names a police force, and as `TN-GUIDE-the-guide.md` names "the guide" / « le guide »
and never gives the beaver a proper name.

`OQ-LEVEL-8` asks whether Ottawa's officer is « l'agent » or « l'agente », and notes that three French
strings move together with the answer. That question repeats for every level, and it can be made much
cheaper: **French has role nouns that do not change form**, only their article does. Most of the NPCs above
were chosen on that basis:

| Level | NPC, EN | NPC, FR | Same form for any gender? |
|---|---|---|---|
| 1, 3, 5 | the guide | le guide | Yes — and the referent is an animal, so the question does not arise at all (`TN-GUIDE`) |
| 4 | the officer | l'agent / l'agente | **No** — `OQ-LEVEL-8` |
| 6 | the judge | le juge / la juge | Yes |
| 7 | the journalist | le journaliste / la journaliste | Yes |
| 8 | the rancher | l'éleveur / l'éleveuse | **No** — `OQ-SPINE-4` |
| 9 | the artist | l'artiste | Yes |

`docs/content-review.md` §8.6 forbids « l'agent(e) » and « l'agent·e », and forbids any French copy about the
*player* needing agreement. This table is about characters, not the player, so the rule that binds is
`TN-LEVEL-11`'s: every French string naming a character uses the same form, and no bracketed ending appears
anywhere. Choosing epicene roles means most of the levels never have to answer the question at all.

**The archivist and the volunteer are gone from this table**, and that is what shipping did rather than a
decision taken here: levels 1, 3 and 5 all place the guide, so the roles this file once proposed for them
(the archivist, the volunteer) are not in any level document. `OQ-SPINE-4`'s worry about « archiviste » not
being a grade-6 word is answered by the same fact. **Levels 6 and 7 place no character at all yet**, so "the
judge" and "the journalist" are proposals, and no name is written as copy for either — a speaker's label
with no dialogue behind it is copy for behaviour nothing performs.

## Player-facing copy

This file owns the place name and the subject line for the nine levels that are not Ottawa, because
`TN-MAP` draws all ten and a place name written in two tables will eventually differ between two screens.
Ottawa's pair stays in `TN-LEVEL-ottawa.md`.

Two other kinds of level string are **not** here, and the split is deliberate: the waiting sentence and the
error title belong to the level and are written in the level's own story file (`TN-WAIT`), and the mode label
belongs to the *mode* and is written once in `TN-MOVE-locomotion-labels.md` — `walk` appears four times in
the table above and is one string.

| Key | EN | FR |
|---|---|---|
| `level.halifax.title` | Halifax | Halifax |
| `level.halifax.subtitle` | Rights and responsibilities | Droits et responsabilités |
| `level.2.subtitle` | Who we are | Qui nous sommes |
| `level.quebec-city.title` | Québec City | Ville de Québec |
| `level.quebec-city.subtitle` | Canada's history | L'histoire du Canada |
| `level.toronto.title` | Toronto | Toronto |
| `level.toronto.subtitle` | Federal elections | Les élections fédérales |
| `level.winnipeg.title` | Winnipeg | Winnipeg |
| `level.winnipeg.subtitle` | The justice system | Le système de justice |
| `level.prairie-rail.title` | The Prairies | Les Prairies |
| `level.prairie-rail.subtitle` | Modern Canada | Le Canada moderne |
| `level.alberta-foothills.title` | The Alberta foothills | Les contreforts de l'Alberta |
| `level.alberta-foothills.subtitle` | Canada's economy | L'économie du Canada |
| `level.vancouver.title` | Vancouver | Vancouver |
| `level.vancouver.subtitle` | Canadian symbols | Les symboles canadiens |
| `level.10.title` | The North | Le Nord |
| `level.10.subtitle` | Canada's regions | Les régions du Canada |

**Level 2 has a subject line and no place name**, and that is the correct output of the rules above rather
than an omission: naming a nation's territory as the setting of a level nobody may build yet states a plan
this project has not earned the right to state. `TN-MAP-04` requires a card with no place name to draw no
placeholder — no "TBD", no "???", no empty box. Level 10 keeps "The North" because it is a region, not a
nation's name for itself.

**Six of these ids are decisions now, not proposals.** `content/levels/halifax.json`,
`quebec-city.json`, `ottawa.json`, `toronto.json`, `winnipeg.json` and `prairie-rail.json` exist, and
`content/game.config.json` lists the same six in `levels` and in `unlockRules.order` and holds a ten-slot
`journey` whose two nulls are levels 2 and 10. The remaining ids are still proposals: the first file written
fixes each one (`app/adapters/phaser/level-catalog.ts`). Levels 2 and 10 have no id here on purpose. Subject
lines are paraphrases of *Discover Canada*'s chapter names and go through the same verification as any other
claim — `OQ-SPINE-2`.

---

## TN-LEVELS-01 — A level is added by data and assets alone

This is slice 2's proof, written as acceptance so that "no engine changes" is a test rather than a intention.

```gherkin
Feature: Adding a level without touching the engine
  As the person adding the tenth level
  I want a level to be a JSON document and some pictures
  So that ten levels cost ten documents and not ten engine branches

  Scenario: A new level document is enough to make a level appear
    Given a valid document is added at "content/levels/<id>.json" with its assets
    And no file under "app/" is changed
    When the game is built
    Then that level is in the level catalogue
    And it appears on the level select as described in TN-MAP-01
    And opening it reaches "playable"
    And "scene-state" reports "data-level" equal to that id

  Scenario: Every difference between two levels is a value in a document
    Given two level documents with different locomotion, parallax layers, ground and points of interest
    Then no scene, camera, input handler or renderer reads the level's id to decide behaviour
    And a test that greps "app/" for any level id other than in a test fixture fails the build

  Scenario: A level that needs an engine change fails the claim, loudly
    Given a level document declares a locomotion mode the config does not list
    When the content check runs
    Then the build fails, naming the mode and the registry that would have to change
    And the failure names "content/game.config.json", not a schema and not a port

  Scenario: A new mode costs a locale key and nothing else
    Given a level document declares a mode the config lists and no other level uses
    Then the only change outside "content/" is one row in TN-MOVE's table
    And no schema, port or adapter enumerates the mode by name

  Scenario: A new level costs its own words, and the build says so
    Given a valid level document is added with no waiting sentence, error title, stamp sentence,
      play label or mode label
    When the content check runs
    Then the build fails, naming the level and each missing string
    And no level draws another level's words while that check is red

  Scenario: The previous level is released before the next one loads
    When I leave one level and open another
    Then the first level's textures are unloaded before the second level's are decoded
    And decoded texture memory is measured against one level at a time
    And the per-level payload budget in "game.config.json" is enforced for the new level

  Scenario: A level document with no title in both languages is refused
    Given a level document whose title or subtitle is missing in "en" or in "fr"
    When the content check runs
    Then the build fails, naming the level and the missing language
```

## TN-LEVELS-02 — A blocked level cannot be authored into existence (failure path)

```gherkin
Feature: The content-review shipping rule is a gate, not a paragraph
  Scenario: A level document that declares a nation cannot ship without Tier 3
    Given a level or point-of-interest document declares a nation
    And no community review with status "granted" names a person or organisation and a date
    When the content check runs
    Then the build fails, naming the document and pointing at "docs/content-review.md" §1

  Scenario: A citation is not a depiction
    Given a level document carries a territorial statement quoted from a named source
    And nothing in the level depicts any nation it names
    Then the check passes on that ground alone
    And the statement is drawn only by "about-this-place"

  Scenario: A bank is not a licence
    Given a subject has a full bank of verified questions
    And the level that would teach it is blocked under §1
    Then no level document for it may be authored
    And the check fails for one that is

  Scenario: An agent cannot grant the review it needs
    Given a document sets a community review status other than "not-sought"
    And the change was made by an agent
    Then the check fails
    And the message says that no agent may grant cultural sign-off, for any reason

  Scenario: A vague nation value is refused
    Given a document declares a nation value that is a category rather than a nation
    When the content check runs
    Then the build fails, naming the value and the deny-list in §3.1

  Scenario: A presumed-restricted item cannot become a level's prop
    Given any asset or level document references an item on the §5.2 list
    Then the check fails, naming the item
    And it fails whether the item is a landmark, scenery, an icon, a collectible or a locomotion vehicle

  Scenario: A locomotion mode that is an unanswered review question is refused
    Given a level document declares "canoe" or "dogsled"
    And "OQ-REVIEW-10" is recorded as unanswered
    When the content check runs
    Then the build fails, naming the mode and the open question
    And the message does not offer a way to override it in the document
    And no copy table carries a label for either mode

  Scenario: The gate is proven by a failing case, not by a green run
    Then a fixture exists for each of the scenarios above
    And each fixture is asserted to fail the check
    And a change that makes any of those fixtures pass fails this suite
```

## TN-LEVELS-03 — What every level's own story has to carry

Not the level's behaviour — that is the level's story — but the floor below which a level story is not
finished. Written as acceptance so a level story can be checked against it before its slice starts.

```gherkin
Feature: The floor every level story stands on
  Scenario Outline: Every shipped level satisfies the shared contract
    Given a level that ships
    Then <requirement>

    Examples:
      | requirement |
      | its title and subject line have a value in "en" and in "fr" |
      | its own waiting sentence names what it is preparing, with no percentage, fraction, step count or ellipsis |
      | its own error title names it, in both languages, written out rather than templated |
      | its own stamp sentence and play label are written out per level, in both languages |
      | the mode it declares has a label in both languages, and the HUD is never empty |
      | its NPC, if it places one, has a name that is a role, never an organisation, and never "Speaker", "NPC" or empty |
      | a quest it declares can be offered, which means its giver has a name before it has lines |
      | its landmark is reference-accurate and simplified, with references and credits recorded |
      | its landmark returns the intended subject under blind identification, and the contract asks for nothing the art is forbidden to draw |
      | its "About this place" panel is reachable from pause and from credits, is never modal, and states a sourced territorial fact |
      | no screen but that panel states or paraphrases a territorial fact |
      | every factual sentence it puts on screen is verified like a question |
      | it is completable with a keyboard alone |
      | it is completable with one switch, using short and long presses only |
      | nothing in it counts down |
      | its whole flow works at 200 % text on a 390 x 844 viewport with no sideways scroll |
      | reduced motion removes parallax easing and particles and changes no tuning value |
      | every sound it plays has a visual equivalent |
      | its question bank has at least thirty verified questions for its subject, and shares none of them with another level's subject |
```

---

## Open questions

- ~~**`OQ-SPINE-1` — level 3's toboggan is not a locomotion mode, and slice 2 claims no engine changes.**~~
  **Answered 2026-09-08 by ADR-0023**, and by the route recommended here: the legal set of modes moved out of
  `content/schemas/level.schema.json` and `app/application/ports/locomotion.ts` into
  `content/game.config.json#/locomotionModes`, which lists nine names including `toboggan`;
  `LocomotionMode` became a checked `string`, as `LevelId` already was. A typo is still a failing build,
  because the set moved rather than vanished. **One obligation is outstanding and the claim is not fully true
  until it lands** (ADR-0023, due 2026-10-08, owner engine): `app/adapters/phaser/level-document.ts` still
  holds a hard-coded `LOCOMOTION_MODES` literal, so a level declaring a mode the adapter does not know passes
  `validate-content` and fails at load — a worse failure than the one that was fixed. **`prairie-rail` makes
  this live rather than hypothetical**: it declares `train`, which is in the config's nine, and whether the
  adapter's literal contains it decides whether the level opens at all. Not this directory's to close;
  recorded so nobody reads "answered" as "done".
- **`OQ-SPINE-2` — are the subject lines the official chapter names, and who verifies them?** The ten
  subjects are *Discover Canada*'s chapters, and IRCC publishes both languages. The French written above is a
  translation of meaning; the official French chapter titles exist and are citable. *Recommendation:* the
  `content-verifier` checks each pair against canada.ca and records the source, exactly as for a question —
  a subject line is on screen and states what a chapter is called. Where the official title differs from the
  table above, the official title wins and this file is amended.
- ~~**`OQ-SPINE-3` — level 4's and level 5's question banks overlap.**~~ **Answered 2026-09-09, by the split
  this question asked for.** When it was written, all 57 shipped questions carried `subject: "government"`
  and a dozen of them were about ballots, advance polls, electoral districts and who may vote — level 5's
  subject. `content/questions/` now holds seven subject directories, and the elections questions are in
  theirs: `rights` 37 verified, `who-we-are` 46, `history` 96, `government` 38, `elections` 36, `justice` 31,
  `modern-canada` 39. Every built level's bank clears `CLAUDE.md`'s thirty and no two levels draw from one.
  **What is left is the other end of the list**: `economy`, `symbols` and `regions` have no bank at all, so
  levels 8, 9 and 10 cannot ship, and `TN-LEVELS-03`'s last row is what keeps the seven that exist apart.
  Routed to content as a smaller question than it was.
- **`OQ-SPINE-4` — one NPC role still needs the French agreement decision, and one worry answered itself.**
  Level 8's « éleveur / éleveuse » has the same shape as `OQ-LEVEL-8`'s « agent / agente ».
  **« Archiviste » is no longer a problem**: level 3 places the guide, not an archivist, so the one epicene
  role that was not grade-6 is not in any document. *Recommendation:* answer `OQ-LEVEL-8` once for all ten
  levels rather than eight times, and if the answer is a form that agrees, prefer an epicene role for every
  remaining level. Do not reach for a bracketed ending in any case.
- **`OQ-SPINE-5` — do modern buildings and named venues raise the same question the RCMP uniform did?**
  Levels 5, 6 and 9 name buildings completed well within living memory, and one of them (the CN Tower) has a
  trademarked name. `OQ-LEVEL-1` established that this project asks before drawing something protected rather
  than after. **Answered in part by `TN-NAMES-naming-real-places.md`** for the *copy* half — the name is text,
  in a point-of-interest card's body or in the words a quest's giver says about going there, once, with no
  mark and no claim of association — and the art half is unchanged: draw the form, carry no wordmark, no logo
  and no signage, cite the reference, credit the photograph. What is still the project owner's is whether
  trade names may appear at all (`OQ-NAMES-1`), and that question is now larger than it was, because three
  shipped quest documents name their destination (`OQ-DIALOGUE-5`).
- **`OQ-SPINE-6` — is a level's *place* allowed to be a region rather than a city?** Levels 7, 8 and 10 are
  regions, and `TN-MAP` draws a place name for each. A region is harder to identify blind than a city and
  harder to reference accurately. **Level 7 has now answered the copy half of it and confirmed the worry on
  the art half**: its four rows work (`TN-PRAIRIE`), and its landmark is a type that is deliberately never
  asked to name a place. *Recommendation:* accept regions for those three, and require each to name one
  specific, cited, existing structure as its recognisability anchor — and accept, as level 7 did, that a
  region's anchor may identify the *type* and not the place. A region with no specific reference is where an
  invented landmark comes from.
- **`OQ-SPINE-7` — what happens to this file when each level gets its own story?** **Being answered in
  practice, and the recommendation held:** the row stays and the detail moves. Levels 1, 3, 5, 6 and 7 now
  have files carrying their own copy, and this table keeps their subject, place, locomotion, landmark, NPC
  and blockers. Each level story owns its own copy, its own art notes and its own scenarios; this file keeps
  the table, the blockers and the two contracts, so there is still one page that answers "what are the ten
  levels and which of them may be built". A spine that is deleted after the first level is written is a spine
  that has to be rediscovered for the second.
