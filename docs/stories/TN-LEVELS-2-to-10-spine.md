# TN-LEVELS — Levels 1 to 10: the spine

**Intent.** Every level after Ottawa has its subject, its place, how the player moves through it, the one
landmark that has to be recognisable, and its NPC written down in one place — so art and content can work in
parallel, and so the map can name ten levels without anybody inventing a word.

**This file is a spine, not nine stories.** Each level gets its own story file, with full Gherkin and its own
accessibility and bilingual scenarios, in the slice that builds it — the same shape as
`TN-LEVEL-ottawa.md`. What is here is what has to be decided *before* those slices start, plus the two
contracts that bind all nine: a level is added by data and assets alone, and a level whose depiction is
blocked is not authored at all.

Read `README.md` in this directory first. `TN-MAP-level-select.md` draws the ten entries below;
`TN-LEVEL-ottawa.md` is the worked example of what each of these rows becomes.

## Three things that block work in this table, stated before the table

Nothing here is a schedule. Three of these rows cannot be started, and one cannot be started in the shape
`docs/plan/slices.md` currently describes.

1. **`docs/content-review.md` §1 blocks any level whose subject is a nation's territory or history**, and
   blocks any depiction of a named nation, until a Tier 3 reviewer exists. `OQ-REVIEW-2` — who that reviewer
   is and whether there is money for one — is unanswered, and it carries an obligation dated **2026-12-08**.
   That blocks **level 2 (Mi'kma'ki)** outright, which `OQ-REVIEW-3` already says, and it blocks **level 10
   (The North)** for the same reason: a level whose subject is Canada's regions, set in the North, either
   depicts the peoples of Inuit Nunangat or removes them from a level about where they live. Both readings
   need Tier 3. Level 2 and level 10 are therefore **not scoped below** — no landmark, no NPC, no id. Filling
   those cells in would make a blocked level look schedulable, and a plan that reads as schedulable gets
   scheduled.
2. **`OQ-REVIEW-10` is unanswered and three locomotion modes depend on it.** The canoe (level 2), the kayak
   (named in that question and not assigned to a level) and the dogsled and qamutiik (level 10) are Indigenous
   technology used as generic Canadian symbols. `docs/content-review.md` §5.4 says so, and adds the sentence
   that matters here: *"A canoe as a vehicle the player rides is exactly the prop case in §5.1's second test,
   and slice 4 depends on it."* A locomotion mode is the most prop-like thing in this game — the player is
   sitting in it for the whole level. Flagged against levels 2 and 10 below and repeated here so it is not
   discovered mid-build.
3. **Level 3's locomotion mode does not exist, and slice 2's whole claim is that no engine change is needed.**
   `docs/plan/slices.md` gives level 3 a toboggan. `content/schemas/level.schema.json`'s `locomotionMode` and
   `app/application/ports/locomotion.ts` both enumerate exactly eight modes — `walk`, `canoe`, `skate`,
   `bike`, `train`, `horse`, `skateboard`, `dogsled` — and **`toboggan` is not among them**. So slice 2 as
   written cannot be added by JSON and assets alone: it needs a new enum value in a schema and in a port
   before the first line of level data is written. See `OQ-SPINE-1`; it is the plan owner's to resolve, and
   it wants resolving before slice 2 starts rather than during it.

## The ten levels

Order is the map order and the unlock order (`TN-MAP-01`). Levels 1 to 9 run roughly east to west; level 10
is north, which is why no copy in `TN-MAP` claims the journey is east to west (`OQ-MAP-3`).

| # | Level id | Subject (bank key) | Place | Locomotion | Landmark that must survive blind identification | NPC | Status |
|---|---|---|---|---|---|---|---|
| 1 | `halifax` | `rights` | Halifax, Nova Scotia | `walk` | Pier 21's waterfront frontage and Immigration Hall, with the harbour behind — see the note below on how weak this is | the guide | Ready to scope |
| 2 | *not fixed* | `who-we-are` | *not scoped* | `canoe` | *not scoped* | *not scoped* | **Blocked — §1 and `OQ-REVIEW-10`** |
| 3 | `quebec-city` | `history` | Québec City (Old Québec) | `toboggan` — **does not exist**, `OQ-SPINE-1` | Château Frontenac seen from Dufferin Terrace, with the ramparts | the archivist | Blocked on `OQ-SPINE-1` |
| 4 | `ottawa` | `government` | Ottawa | `skate` | Centre Block and the Peace Tower from the canal | the officer | **Shipped** — `TN-LEVEL-ottawa.md` |
| 5 | `toronto` | `elections` | Toronto | `bike` | Toronto City Hall's two curved towers across Nathan Phillips Square | the volunteer | Ready to scope, `OQ-SPINE-3` |
| 6 | `winnipeg` | `justice` | Winnipeg | `walk` | The Canadian Museum for Human Rights, by its tower silhouette | the judge | Ready to scope |
| 7 | `prairie-rail` | `modern-canada` | The Prairies | `train` | A wooden prairie grain elevator beside the track — a *named, cited* one, see below | the journalist | Ready to scope |
| 8 | `alberta-foothills` | `economy` | The Alberta foothills | `horse` | A working ranch's gate and barn against the foothills, with the Rockies on the horizon | the rancher | Ready to scope, weak blind ID |
| 9 | `vancouver` | `symbols` | Vancouver | `skateboard` | Canada Place's white sails on the waterfront | the artist | Ready to scope — **read the trap below** |
| 10 | *not fixed* | `regions` | The North | `dogsled` | *not scoped* | *not scoped* | **Blocked — §1 and `OQ-REVIEW-10`** |

### Level 1 — Halifax, `rights`, walk

Pier 21 is the right subject anchor: it is where roughly a million people arrived in Canada, which is what a
level about rights and responsibilities should be standing on. It is a **weak blind-identification subject**,
and that has to be said now rather than discovered by `verify-art`: it is a long brick building, and slice 1
already produced the failure where a contract asked for "Ottawa" from art that was forbidden to draw the one
thing that says Ottawa. If the reference-accurate Pier 21 frontage does not return Pier 21 or Halifax under
blind identification, the level's recognisability anchor moves to the **Halifax Town Clock on Citadel Hill**,
and Pier 21 stays as the level's setting and quest location. Decide it from a real blind pass, not from
argument.

Halifax (Kjipuktuk) is in Mi'kma'ki. The "About this place" panel carries the sourced territorial fact
(`docs/content-review.md` §10.2, and §1's may-ship list item 5). **That is a fact with a citation, not a
depiction**, and it does not make this level a §1 blocked level — but the panel's wording is authored and
verified like any other claim, and nothing in the level depicts a nation.

### Level 2 — `who-we-are`, canoe: not scoped, on purpose

Blocked by `docs/content-review.md` §1, shipping-rule item 5, and by `OQ-REVIEW-10` for its locomotion. The
place, the landmark and the NPC are deliberately blank. `OQ-REVIEW-3` recommends that
`docs/plan/slices.md` re-orders so this slice is not started and then abandoned mid-flight; that
re-ordering is the plan owner's.

### Level 3 — Québec City, `history`, toboggan

The Château Frontenac is one of the most identifiable buildings in Canada and blind identification should be
straightforward. The level runs along Dufferin Terrace and the Old Québec ramparts. The locomotion mode is
the problem, not the level: see `OQ-SPINE-1`.

### Level 5 — Toronto, `elections`, bike

Toronto City Hall is civic, unmistakable in silhouette, and about the thing the level teaches. The CN Tower
can stand on the skyline as a second recognisability anchor; it must not carry a wordmark or a logo, under
the same rule that keeps the RCMP's marks off the officer.

**The question bank for this level may already be inside level 4's.** All 57 shipped questions are filed
under `government`, and a dozen of them are about ballots, electoral districts, advance polls and who may
vote — which is level 5's subject. Two levels cannot share one bank and both claim thirty verified questions
from it. `OQ-SPINE-3`.

### Level 6 — Winnipeg, `justice`, walk

The Canadian Museum for Human Rights has a silhouette nothing else in Canada has, and a level about the
justice system standing beside it is coherent. The Golden Boy on the Manitoba Legislative Building is the
fallback anchor. The Forks is a confluence and a historic meeting place; if the level goes there, the
territorial fact belongs in "About this place" and no depiction follows from it.

### Level 7 — The Prairies, `modern-canada`, train

The grain elevator is the one prairie silhouette a person recognises without being told, and it is a *type*
rather than a named landmark — which is a problem for this project's rules, not a licence. **The reference
must be one specific surviving elevator**, recorded in `assets/refs/references.json` with its own credit, so
the art is drawn from a thing that exists rather than assembled from memory. `assets/style/art-bible.md`'s
"drop, never substitute" applies: an elevator with an invented company name painted on it is an invented
surface.

### Level 8 — The Alberta foothills, `economy`, horse

The honest note first: **this is the weakest blind-identification row in the table.** A ranch gate against
foothills reads as "somewhere in western North America" and is unlikely to return "Alberta". The candidates
that would identify the place — Head-Smashed-In Buffalo Jump is the obvious one — are on Blackfoot
(Niitsitapi) territory and are a §1 depiction question, not an art question, so they are not here. Options
that stay inside the rules: a specific, cited, named ranch (the Bar U Ranch National Historic Site is one),
or the level's anchor moving to the Rockies on the horizon and accepting "the Canadian Rockies" as the blind
answer. Decide it with the art agent before the blind contract is written, because slice 1's recorded
failure was exactly a contract asking for more than the art was allowed to show.

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
Canada* under ADR-0003 like any other question.

### Level 10 — The North, `regions`, dogsled: not scoped, on purpose

Blocked twice over: §1's shipping rule (a level about Canada's regions, set in the North, cannot avoid the
question of who lives there) and `OQ-REVIEW-10` (the dogsled and the qamutiik). The place name "The North"
is written in the copy table below because the map has to name ten levels; **nothing else about this level is
scoped**, and the map draws it as "Not made yet" like the rest (`TN-MAP-04`).

## The NPCs, and one French decision that is cheaper made once

Every NPC is named by role, never by an organisation, exactly as `TN-LEVEL-ottawa.md` names "the officer" /
« l'agent » and never names a police force.

`OQ-LEVEL-8` asks whether Ottawa's officer is « l'agent » or « l'agente », and notes that three French
strings move together with the answer. That question repeats for every level, and it can be made much
cheaper: **French has role nouns that do not change form**, only their article does. Six of the eight NPCs
above were chosen on that basis:

| Level | NPC, EN | NPC, FR | Same form for any gender? |
|---|---|---|---|
| 1 | the guide | le guide / la guide | Yes |
| 3 | the archivist | l'archiviste | Yes |
| 4 | the officer | l'agent / l'agente | **No** — `OQ-LEVEL-8` |
| 5 | the volunteer | le bénévole / la bénévole | Yes |
| 6 | the judge | le juge / la juge | Yes |
| 7 | the journalist | le journaliste / la journaliste | Yes |
| 8 | the rancher | l'éleveur / l'éleveuse | **No** — `OQ-SPINE-4` |
| 9 | the artist | l'artiste | Yes |

`docs/content-review.md` §8.6 forbids « l'agent(e) » and « l'agent·e », and forbids any French copy about the
*player* needing agreement. This table is about characters, not the player, so the rule that binds is
`TN-LEVEL-11`'s: every French string naming a character uses the same form, and no bracketed ending appears
anywhere. Choosing epicene roles means seven of the eight levels never have to answer the question at all.
"The archivist" is the one row where plain language and this rule pull against each other — see `OQ-SPINE-4`.

## Player-facing copy

This file owns the place name and the subject line for the nine levels that are not Ottawa, because
`TN-MAP` draws all ten and a place name written in two tables will eventually differ between two screens.
Ottawa's pair stays in `TN-LEVEL-ottawa.md`.

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

**These are keyed on ids that are proposals**, not decisions: `content/levels/<id>.json` is the id, so the
first file written fixes it (`app/adapters/phaser/level-catalog.ts`). Levels 2 and 10 have no id here on
purpose. Subject lines are paraphrases of *Discover Canada*'s chapter names and go through the same
verification as any other claim — `OQ-SPINE-2`.

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
    Given a level document declares a locomotion mode the schema does not enumerate
    When the content check runs
    Then the build fails, naming the mode and the enum that would have to change
    And the failure says that a new mode is a schema and port change, not level data

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
      | its NPC has a name that is a role, never an organisation, and never "Speaker", "NPC" or empty |
      | its landmark is reference-accurate and simplified, with references and credits recorded |
      | its landmark returns the intended subject under blind identification, and the contract asks for nothing the art is forbidden to draw |
      | its "About this place" panel is reachable from pause and from credits, is never modal, and states a sourced territorial fact |
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

- **`OQ-SPINE-1` — level 3's toboggan is not a locomotion mode, and slice 2 claims no engine changes.**
  `locomotionMode` enumerates eight modes in `content/schemas/level.schema.json` and in
  `app/application/ports/locomotion.ts`, and `toboggan` is not one of them, so the slice whose entire purpose
  is proving a level is data would begin by editing a schema and a port. *Recommendation:* open the enum
  before slice 2 starts, and state slice 2's claim as what the port's own header already claims — "adding a
  mode is one strategy plus level data, never an edit to a scene, a camera or an input handler" — so the
  proof is about scenes and not about enums. The alternative, giving level 3 `walk` in Old Québec, costs the
  slice its most interesting tuning and should be a decision rather than a workaround. Routed to the plan
  owner and the architect; `docs/plan/` and `content/` are not this file's to edit.
- **`OQ-SPINE-2` — are the subject lines the official chapter names, and who verifies them?** The ten
  subjects are *Discover Canada*'s chapters, and IRCC publishes both languages. The French written above is a
  translation of meaning; the official French chapter titles exist and are citable. *Recommendation:* the
  `content-verifier` checks each pair against canada.ca and records the source, exactly as for a question —
  a subject line is on screen and states what a chapter is called. Where the official title differs from the
  table above, the official title wins and this file is amended.
- **`OQ-SPINE-3` — level 4's and level 5's question banks overlap today.** All 57 shipped questions carry
  `subject: "government"`, and roughly a dozen of them are about ballots, advance polls, electoral districts
  and who may vote — which is level 5's subject, Federal Elections. `CLAUDE.md` requires ≥ 30 verified
  questions *per subject* before a level ships, and two levels drawing from one bank would meet that bar
  twice with one set of questions. *Recommendation:* the content lead splits the bank before level 5 is
  authored, and `TN-LEVELS-03`'s last row is the check that keeps it split. Routed to content; this file
  only records that the overlap exists.
- **`OQ-SPINE-4` — two NPC roles need the French agreement decision, and one of them is not plain language.**
  Level 8's « éleveur / éleveuse » has the same shape as `OQ-LEVEL-8`'s « agent / agente ». Level 3's
  « archiviste » is epicene and is *not* a grade-6 word in either language, which is the bar `CLAUDE.md`
  sets for dialogue. *Recommendation:* answer `OQ-LEVEL-8` once for all ten levels rather than eight times,
  and if the answer is a form that agrees, prefer an epicene role for every remaining level. For level 3,
  put a plainer epicene role in front of the content author — « le guide » is taken by level 1, and
  « le/la libraire » or a simple "the neighbour" may serve the same scene. Do not reach for a bracketed
  ending in either case.
- **`OQ-SPINE-5` — do modern buildings and named venues raise the same question the RCMP uniform did?**
  Levels 5, 6 and 9 name buildings completed well within living memory, and one of them (the CN Tower) has a
  trademarked name. `OQ-LEVEL-1` established that this project asks before drawing something protected rather
  than after. *Recommendation:* the same rule the officer got — draw the form, carry no wordmark, no logo and
  no signage, cite the reference, credit the photograph — and one written answer from the project owner
  covering the class rather than three tickets covering three buildings.
- **`OQ-SPINE-6` — is a level's *place* allowed to be a region rather than a city?** Levels 7, 8 and 10 are
  regions, and `TN-MAP` draws a place name for each. A region is harder to identify blind than a city and
  harder to reference accurately. *Recommendation:* accept regions for those three, and require each to name
  one specific, cited, existing structure as its recognisability anchor — which is what the level 7 and
  level 8 notes above already do. A region with no specific reference is where an invented landmark comes
  from.
- **`OQ-SPINE-7` — what happens to this file when each level gets its own story?** *Recommendation:* the row
  stays and the detail moves. Each level story owns its own copy, its own art notes and its own scenarios;
  this file keeps the table, the blockers and the two contracts, so there is still one page that answers
  "what are the ten levels and which of them may be built". A spine that is deleted after the first level is
  written is a spine that has to be rediscovered for the second.
