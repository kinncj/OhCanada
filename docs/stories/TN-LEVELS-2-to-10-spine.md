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

**Amended a third time, 2026-09-09: levels 8 and 9 shipped too, and one of them is built without being
shippable.** `content/levels/alberta-foothills.json` and `content/levels/vancouver.json` are built, listed in
`levels`, `journey` and `unlockRules.order`, drawn (`assets/style/alberta-foothills-level.md`,
`assets/style/vancouver-level.md`) and covered by `TN-LEVEL-alberta-foothills.md` and
`TN-LEVEL-vancouver.md`. Four things follow, and the last is the one that matters most:

- **`horse` and `skateboard` are the second and third modes added since ADR-0023**, and each cost exactly one
  row in `TN-MOVE`. Three levels in a row paying one row each is the ADR's claim tested rather than asserted.
- **Four of the eight built levels now have no NPC and no quest**, which is half the built game reachable
  only by walking to the end (`TN-DONE`, `OQ-DONE-1`).
- **Level 9's trap held.** `assets/style/vancouver-level.md` §0 records that totem poles and the inuksuk are
  in `neverAdd` on both of the level's subjects, so the warning written below became a checked contract
  clause rather than a paragraph somebody read. That is the outcome this section was written for.
- **Level 8's question bank is twelve verified questions short of `CLAUDE.md`'s floor and the level is in
  `unlockRules.order` anyway.** `content/questions/economy/` holds nineteen authored, eighteen verified,
  against thirty. **This is the first time "built" and "may ship" have come apart in this table**, and the
  status column below says so rather than letting the word "Built" carry a meaning it has not earned. See
  `OQ-ALBERTA-2`.

**Amended a fourth time, 2026-09-13: the last two levels landed, the map is complete, and the two rows this
file refused to scope were scoped by the rule this file wrote rather than in spite of it.**
`content/levels/peggys-cove.json` and `content/levels/the-north.json` are built, drawn
(`assets/style/peggys-cove-level.md`, `assets/style/the-north-level.md`), listed in `levels`, in `journey`
and in `unlockRules.order`, and covered by `TN-LEVEL-peggys-cove.md` and `TN-LEVEL-the-north.md`. **The
journey has no `null` slots left: ten built, ten documents, ten sets of copy.** Five things follow:

- **What unblocked them is a distinction between a level's *subject* and a level's *place*, and it is now
  written into the blockers section below** rather than living in two art sheets. It is the first item in
  that section, because it is the thing a reader of this table most needs and the thing nothing recorded.
- **Neither level declares the locomotion mode this table gave it.** Both declare `walk`. `canoe` and
  `dogsled` are still declared by no document and still have no label, so `OQ-REVIEW-10` is **unanswered and
  unengaged** rather than answered, and `TN-MOVE-02`'s last scenario passes on the day the map filled up.
- **Neither level adds a row to `TN-MOVE`**, and neither places an NPC. **Both gained a quest on the same
  day, offered by the landmark rather than by anybody** — see the fifth amendment below.
- **`regions` has a bank, and this file said it had none.** `content/questions/regions/` holds **fifty-eight
  authored questions, all fifty-eight reported verified** — behind `history`'s ninety-six and ahead of the
  other eight subjects. The correction is recorded in `OQ-SPINE-3` rather than quietly applied.
- **Level 8 is still the only built level that may not ship**, and it is now one of ten rather than one of
  eight. Nothing about that improved; the denominator moved.

**Amended a fifth time, 2026-09-13: a quest is offered by an engageable, so two levels that could not hold
one now do.** ADR-0029 widened `quest.giver` from a character to **a thing the level places** — a character
or a point of interest. `content/quests/peggys-cove-point-light.json` is given by the lighthouse and
`content/quests/the-north-sternwheeler.json` by the vessel; `characters` stays `[]` on both. Four things
follow, and the first is the one this table most needed:

- **The figure prohibition is untouched, and that is the point rather than a side effect.** The ADR's
  alternatives section refuses weakening it — *"the cheapest way to be sure no figure is read as a depiction
  of anybody is for there to be no figure"* — and identifies the real culprit as a schema clause that had
  been turning a depiction rule into a scope cut. `CLAUDE.md` says slices are engineering practice and never
  a scope cut; two of ten levels were a walk to the end because `giver` was typed as a character.
- **Six of the ten built levels now have a quest, and four do not** — Winnipeg, the Prairies, the Alberta
  foothills and Vancouver. `OQ-DONE-1`'s instance count drops with it, and the ADR says plainly that this
  *removes two instances' cause* rather than fixing the defect.
- **Each of the two quests has two steps, not three**: a `talk` on the giver, then an `answer` of three.
  There is no `visit` step, because the giver **is** the landmark and a visit would target the same thing
  twice.
- **A landmark that speaks does not become somebody.** ADR-0029 §4 forbids `expression` on a line whose
  speaker is a point of interest; §5 fixes the voice as second person and impersonal, held by review rather
  than by a regex, *because on these two levels it is the figure prohibition arriving through the copy
  instead of the picture*. `TN-PEGGYS-06` and `TN-NORTH-06` assert it, and both level stories add a
  prohibition of their own: **no quest line states or paraphrases the territorial statement.**

Read `README.md` in this directory first. `TN-MAP-level-select.md` draws the ten entries below;
`TN-LEVEL-ottawa.md` is the worked example of what each of these rows becomes;
`TN-MOVE-locomotion-labels.md` owns what the HUD calls each locomotion mode in the table below,
`TN-WAIT-a-level-opens-or-it-does-not.md` owns the two strings every built level needs,
`TN-DIALOGUE-what-a-quest-giver-says.md` owns what a giver says at the moments a step cannot cover, and
`TN-GUIDE-the-guide.md` owns the one NPC name that is written down today.

## What blocks work in this table, stated before the table

Nothing here is a schedule. Two of these rows could not be started for a year of sessions; both can be
started now, and the reason they can is worth more than the rows themselves.

1. **The block is on a level's *subject* and on *depiction*. It was never on a *place*, and that is what
   unblocked levels 2 and 10.** `docs/content-review.md` §1's shipping rule, item 5, blocks *"any level whose
   **subject** is a nation's territory or history"* until a Tier 3 reviewer exists, and §1 also blocks any
   depiction of a named nation. `OQ-REVIEW-2` — who that reviewer is and whether there is money for one — is
   still unanswered and still carries an obligation dated **2026-12-08**. **None of that blocks a level whose
   subject is a *Discover Canada* chapter and whose place is a village or a river bank**, because §1's own
   may-ship list, item 5, permits **a territorial fact line** with a citation, and `TN-LEVELS-02`'s second
   scenario says the same thing from the gate's side: *a citation is not a depiction*. The test a level has
   to pass is four questions, and both new levels answer them the same way:

   | §1 asks | `peggys-cove` | `the-north` |
   |---|---|---|
   | Is the level's **subject** a nation's territory or history? | No — *Who We Are*, bank key `who-we-are` | No — *Canada's Regions*, bank key `regions` |
   | What is its **place**? | A fishing village in Nova Scotia, named as a village | A river bank in the Yukon, at Whitehorse |
   | Does anything in it **depict** a nation? | No — **no figure of any kind is drawn**, at any scale | No — the same, and `neverAdd` says so on both art subjects |
   | Does it declare a mode `OQ-REVIEW-10` blocks? | No — `walk` | No — `walk` |

   **This is the same shape `halifax` has shipped in since slice 1**, on the same coast and in the same
   territory: a place, a chapter, a sourced statement in "About this place", and no depiction. What is
   different is only that these two levels' statements are sourced **better** — level 2's `fact.source` and
   `nationSource` are one Mi'kmaw body speaking for itself, which is what `OQ-WINNIPEG-3` and `OQ-VANCOUVER-4`
   asked for and neither could get.

   **What the distinction does not do is make the block smaller.** A level *in Mi'kma'ki*, with Mi'kma'ki as
   its place name, is still §1 item 5 exactly and was refused
   (`assets/style/peggys-cove-level.md` §0). A level set in **Inuit Nunangat** — Iqaluit, Tuktoyaktuk,
   Pangnirtung — is still blocked, because the identifying built things there *are* Inuit, and
   `assets/style/the-north-level.md` §0 records that choosing the Yukon instead is **a scope decision rather
   than a solution**. **ADR-0029 did not make it smaller either**: it widened what may *offer a quest*, and
   its alternatives section refuses, by name, weakening the figure prohibition for a single small NPC or a
   distant silhouette. Both levels carry a **Tier 3 obligation** naming what a reviewer from the Mi'kmaq and
   from Kwanlin Dün First Nation still owes, both are dated 2026-12-08 to match `OQ-REVIEW-2`, and **no copy
   in this directory may imply that review has happened** (`TN-PEGGYS-06`, `TN-NORTH-06`).
2. **`OQ-REVIEW-10` is unanswered, and no level document engages it.** The canoe, the kayak, the dogsled and
   the qamutiik are Indigenous technology used as generic Canadian symbols; `docs/content-review.md` §5.4
   says so and adds the sentence that settles it — *"A canoe as a vehicle the player rides is exactly the prop
   case in §5.1's second test."* This table gave level 2 a canoe and level 10 a dogsled, **and both levels
   shipped declaring `walk`**, each for two reasons either of which would have been enough: the review
   question is open, and there is no rig art (`assets/style/peggys-cove-level.md` §9,
   `assets/style/the-north-level.md` §9 — a dogsled needs a team of animals, which is a second rig this game
   does not have). `content/game.config.json` still lists both modes as legal, no document declares either,
   `TN-MOVE` writes no label for either, and `TN-LEVELS-02` makes a document that declares one a build
   failure with no override. **The locomotion column below keeps the mode each level was designed around and
   the Status column says what shipped**, because a table that quietly replaced them would erase the
   question.
3. ~~**Level 3's locomotion mode does not exist**~~ — **answered, and by the route this file asked for.**
   `docs/plan/slices.md` gives level 3 a toboggan, and `toboggan` was not among the eight modes
   `content/schemas/level.schema.json` and `app/application/ports/locomotion.ts` enumerated. ADR-0023 moved
   the legal set of modes into `content/game.config.json#/locomotionModes`, which now lists nine including
   `toboggan`, and `content/levels/quebec-city.json` declares it. Slice 2's claim survives: adding a mode is
   a content edit and a locale key, not a schema and a port change — and `prairie-rail`'s `train`,
   `alberta-foothills`'s `horse` and `vancouver`'s `skateboard` are the three modes added *after* the ADR,
   which paid exactly that price and no more. The ADR records one obligation that is not this file's —
   `app/adapters/phaser/level-document.ts` still holds a hard-coded copy of the eight names, so the claim is
   not fully true until that reads the config. See `OQ-SPINE-1`.

## The ten levels

Order is the map order and the unlock order (`TN-MAP-01`). Levels 1 to 9 run roughly east to west; level 10
is north, which is why no copy in `TN-MAP` claims the journey is east to west (`OQ-MAP-3`).

| # | Level id | Subject (bank key) | Place | Locomotion | Landmark that must survive blind identification | NPC | Status |
|---|---|---|---|---|---|---|---|
| 1 | `halifax` | `rights` | Halifax, Nova Scotia | `walk` | Pier 21's waterfront frontage and Immigration Hall, with the harbour behind — see the note below on how weak this is | the guide | **Built, and the game opens here** — copy in `TN-LEVEL-halifax.md`; quest authored; bank 37 verified; full story pending |
| 2 | `peggys-cove` | `who-we-are` | Peggy's Cove, Nova Scotia — **a village, not a territory** | `walk` (**not** the `canoe` this table designed for; §2 above) | Peggy's Point Lighthouse, by its proportions — squat, and a third of it red — see below | **none, and none proposed** — the landmark gives the quest (ADR-0029) | **Built** — copy in `TN-LEVEL-peggys-cove.md`; quest authored, given by the landmark; bank 46 verified |
| 3 | `quebec-city` | `history` | Québec City (Old Québec) | `toboggan` | Château Frontenac seen from Dufferin Terrace, with the ramparts | the guide | **Built** — copy in `TN-LEVEL-quebec-city.md`; quest authored; bank 96 verified; full story pending |
| 4 | `ottawa` | `government` | Ottawa | `skate` | Centre Block and the Peace Tower from the canal | the officer | **Shipped** — `TN-LEVEL-ottawa.md`; bank 38 verified |
| 5 | `toronto` | `elections` | Toronto | `bike` | Toronto City Hall's two curved towers across Nathan Phillips Square — **but the shipped document draws the CN Tower**, `OQ-TORONTO-2` | the guide | **Built** — copy in `TN-LEVEL-toronto.md`; quest authored; bank 36 verified; full story pending |
| 6 | `winnipeg` | `justice` | Winnipeg (The Forks) | `walk` | The Canadian Museum for Human Rights, by its tower silhouette | the judge — **not placed yet** | **Built** — copy in `TN-LEVEL-winnipeg.md`; no NPC, no quest; bank 31 verified |
| 7 | `prairie-rail` | `modern-canada` | The Prairies (southern Saskatchewan) | `train` | A wooden prairie grain elevator beside the track — a standard plan, drawn from a cited building, shipping **blank**, see below | the journalist — **not placed yet** | **Built** — copy in `TN-LEVEL-prairie-rail.md`; no NPC, no quest; bank 39 verified |
| 8 | `alberta-foothills` | `economy` | The Alberta foothills | `horse` | A working ranch's barn and corral against the foothills, drawn from the Bar U and named as a **type**, see below | the rancher — **not placed yet** | **Built, and NOT shippable** — copy in `TN-LEVEL-alberta-foothills.md`; no NPC, no quest; **bank 18 verified of a floor of 30** (`OQ-ALBERTA-2`) |
| 9 | `vancouver` | `symbols` | Vancouver | `skateboard` | Canada Place's five white sails on the waterfront | the artist — **not placed yet** | **Built** — copy in `TN-LEVEL-vancouver.md`; no NPC, no quest; bank 42 verified |
| 10 | `the-north` | `regions` | The North — drawn as **Whitehorse on the Yukon River**, and only that, see below | `walk` (**not** the `dogsled` this table designed for; §2 above) | A Yukon River sternwheeler, by its stern wheel and its hog posts — asked for a **type**, never for a place | **none, and none proposed** — the landmark gives the quest (ADR-0029) | **Built** — copy in `TN-LEVEL-the-north.md`; quest authored, given by the landmark; bank 58 verified |

**"Built" is not "shipped", and level 8 is where that stopped being a caption.** A built level has a
document, a place on the map, a waiting sentence, an error title, a stamp sentence, a play label and a mode
label, and can be opened. It does not yet have its own locomotion tuning proved by scenarios, its NPC or its
quest. Nine of the ten clear their bank floor; level 8 does not, and it is in `unlockRules.order` regardless,
so a player can reach it, finish it and earn its stamp today. `TN-LEVELS-03`'s last row is the one it fails,
and nothing else in this directory fails closed on it — which is exactly why it is written in the status
column rather than left to a test nobody has run.

**Three of the six authored quests are given by the guide, two are given by a landmark, and one by the
officer.** `content/quests/halifax-clock-and-pier.json`, `quebec-city-chateau-frontenac.json` and
`toronto-cn-tower.json` all declare `"giver": "guide"`, and the three level documents place
`characterId: "guide"` beside the quest. The NPC column above says "the guide" for those three levels because
that is what shipped. `peggys-cove-point-light.json` and `the-north-sternwheeler.json` name a point of
interest instead, which is ADR-0029's whole content. The guide's name is `npc.guide.name` and it is written
in `TN-GUIDE-the-guide.md`; **a landmark giver needs no such row**, because ADR-0029 §6 takes its name from
the level document's `pois[…].name`, in both languages, required — *"better founded than the character
case"*, in the ADR's own words.

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

### Level 2 — Peggy's Cove, `who-we-are`, walk

**This row was blank for four sessions and the blank was correct at the time.** What filled it is the
distinction in §1 above, not a decision to proceed anyway: the level's **subject** is *Discover Canada*'s
*Who We Are* chapter, its **place** is a fishing village on the Atlantic coast of Nova Scotia named as a
village, and **nothing in it depicts anybody** — `assets/style/peggys-cove-level.md` §0 records that
`neverAdd` on both art subjects carries *"a figure of any kind, at any scale, including a silhouette and a
crowd"*, which is stricter than `docs/content-review.md` §3.3 outcome 2 requires and is a decision rather
than an omission.

The landmark is **Peggy's Point Lighthouse**, and this file's usual worry is inverted here: it is not that
the subject is unidentifiable, it is that it is a *type* with several hundred instances in Nova Scotia. The
claim the level makes is that the **proportions** identify it — 2.39 base widths tall where a cartoon
lighthouse is four to six, and nearly a third of it red — and `assets/style/peggys-cove-level.md` §7 writes
the failure mode into the contract rather than hoping it away: **if a real blind pass returns only a type,
the finding is that this level has no place anchor**, and the fix is a second cited point of interest, not a
longer answer list. **The level's place rests on that one render**, which is the third level in a row to land
there (`OQ-SPINE-6`).

**That same landmark now gives the level's quest.** `content/quests/peggys-cove-point-light.json` declares
`giver: "peggys-point-light"` and `characters` stays `[]` — ADR-0029's first worked example. Two steps: stop
at the light and read two facts about the country, then answer three `who-we-are` questions. **The lighthouse
is the giver and the target of the talk step**, which is why there is no `visit` step. It speaks in the
second person and the impersonal, carries no `expression`, and its name reaches exactly two screens: the
point-of-interest card's body and the dialog's accessible name (`TN-PEGGYS-01`).

The territorial statement is quoted from **Kwilmu'kw Maw-klusuaqn, the Mi'kmaq Rights Initiative of the
Assembly of Nova Scotia Mi'kmaw Chiefs** — the first level whose `fact.source` and whose `nationSource` are
**one body speaking for itself about its own lands**. It lives in "About this place" and nowhere else, **and
the quest did not move it**: `TN-LEVEL-peggys-cove.md` decides that question explicitly, because a plaque is
exactly the object that would carry such a statement at a real site and moving it there would feel like an
improvement. Two of the level's silences this table should also record: **the word "unceded" is not used**,
because the cited page says *"never surrendered, ceded, or sold"* and the statement says that; and **the word
"Mi'kma'ki" is not used on this level**, because no source this level cites carries it.

**The canoe is not declared and no copy names one.** §2 above; `assets/style/peggys-cove-level.md` §9.

### Level 3 — Québec City, `history`, toboggan

The Château Frontenac is one of the most identifiable buildings in Canada and blind identification should be
straightforward. The level runs along Dufferin Terrace and the Old Québec ramparts. The locomotion mode was
the problem and is not any more: ADR-0023 opened the set of modes to content and the shipped document
declares `toboggan` first and `walk` second. The building may be named on its point-of-interest card, and —
since `TN-DIALOGUE-what-a-quest-giver-says.md` — in this level's own quest, where the guide sends the player
to it. It may appear nowhere else (`TN-NAMES`), which is why the level's waiting sentence names the slope.

**Its bank is the largest in the game**, at ninety-six verified `history` questions — more than three times
the floor, and the number every other subject in this file is measured against.

### Level 5 — Toronto, `elections`, bike

Toronto City Hall is civic, unmistakable in silhouette, and about the thing the level teaches. The CN Tower
can stand on the skyline as a second recognisability anchor; it must not carry a wordmark or a logo, under
the same rule that keeps the RCMP's marks off the officer. **The shipped document has this the other way
round** — one point of interest, and it is the tower, and the quest is named after it — which is
`OQ-TORONTO-2` and has to be settled before the level's full story is written.

**This level's bank is no longer inside level 4's.** `content/questions/elections/` holds 36 verified
questions, including the ballot, advance-poll and electoral-district questions that were filed under
`government` when this file first flagged the overlap; `government` keeps 38. The split this file asked for
happened, and `TN-LEVELS-03`'s last row is what keeps them apart. **It is also the bank that took a word off
level 8**: one of these questions teaches that an electoral district is called a *riding*, which is why
`TN-MOVE` labels the horse "Horse" and not "Riding" (`OQ-MOVE-4`).

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

**It is one of the four levels with no quest**, and after ADR-0029 that is no longer a constraint anybody is
under: it places a museum it could give one to. That is a content decision for its slice, not a blocked one.

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
is keyed on the id and every sentence names the place, and level 8 is the same shape
(`OQ-PRAIRIE-4`).

### Level 8 — The Alberta foothills, `economy`, horse

The honest note first, and it was written before the level shipped: **this is the weakest
blind-identification row in the table.** A ranch gate against foothills reads as "somewhere in western North
America" and is unlikely to return "Alberta". The candidates that would identify the place —
Head-Smashed-In Buffalo Jump is the obvious one — are on Blackfoot (Niitsitapi) territory and are a §1
depiction question, not an art question, so they are not here. Two options were offered: a specific, cited,
named ranch, or the anchor moving to the Rockies and accepting "the Canadian Rockies" as the blind answer.

**Both were taken and one was withdrawn on measurement, and the outcome is level 7's outcome again.**
`assets/style/alberta-foothills-level.md` §0 records it: the hero is the **Bar U Ranch National Historic
Site** at Longview, drawn from eight CC BY 2.0 photographs, and its blind contract asks for a **ranch** and
is never asked for Alberta. The Rocky Mountain front *is* drawn, on a repeating layer, and is deliberately
**not** a graded subject, because a saw-tooth range that runs from New Mexico to the Yukon identifies a
landform and not a province. So **the Alberta foothills as a place rest on nothing in this level's art**,
which is stated rather than left to be discovered — and it is the second region in a row to land there
(`OQ-SPINE-6`).

**The level document names the landmark "Working ranch", a type**, so `TN-NAMES`'s "a named ranch" row is not
exercised here either and "Bar U" appears in no player-facing string (`OQ-NAMES-6`).

The territorial fact is quoted from the Crown's own transcription of **Treaty No. 7** and names seven First
Nations, and this is **the first level whose single `nationSource` covers every nation the statement names** —
the Treaty 7 First Nations Chiefs' Association's own About page — which is what `OQ-WINNIPEG-3` asked for and
could not get. Two things about it stay open and neither is a copy problem: the `fact.source` is the Crown's
text rather than a nation's own account, and **the statement is silent about the Métis Nation of Alberta, in
whose Region 3 the Bar U sits**, because a level carries one `fact.source` and one `nationSource` and neither
cited body speaks for them. `content/sources/cirnac-treaty-7.json`'s `knownStaleness` records both.
`TN-LEVEL-alberta-foothills.md` states the rule that follows for copy: **no row resolves that silence**, in
either direction.

**And the bank is the blocker.** `content/questions/economy/` holds nineteen authored questions and eighteen
verified against a floor of thirty. Levels 6 and 7 no longer had this as an excuse; level 8 has it as a fact,
and the level is in `unlockRules.order` anyway (`OQ-ALBERTA-2`).

### Level 9 — Vancouver, `symbols`, skateboard: the trap, and what happened to it

A level called **Canadian Symbols**, set in **Vancouver**, is the single most likely place in this game for
`docs/content-review.md` §5.2 and §5.4 to be broken by accident. Both of the things a designer would reach
for are on the presumed-restricted or ambiguous lists:

- **totem poles** — the Stanley Park poles are the postcard image of Vancouver and are §5.2 and
  `OQ-REVIEW-10`. Not drawn, in any form, including background, silhouette, icon and loading art;
- **the inuksuk** — a real Inuit structure, and the Vancouver 2010 emblem, which is exactly why it will be
  suggested. `OQ-REVIEW-10`. Not drawn.

Written here so that the answer was already on the page when the art ticket was opened — **and it was, and
this is the one warning in this file that can be marked as having worked.**
`assets/style/vancouver-level.md` §0 records that both are written into `neverAdd` on **both** of the level's
subjects, "so the prohibition is a checked contract clause and not a paragraph in a sheet", and that the
Lions Gate Bridge is in `neverAdd` too so the recorded fallback cannot drift into the seawall tile. Nothing
in the level draws Indigenous content of any kind and the seawall's four background figures carry no cultural
marker. `TN-LEVEL-vancouver.md` carries the copy-side half: no string in the level names any of the three in
either language. **Level 10 now carries the same arrangement for a longer list**, which makes it the pattern
rather than one level's precaution.

Canada Place is the anchor and it is a strong one — five white sails on a long low pier is a stack nothing
else this game will draw — and it is a building drawn from a cited reference under `TN-NAMES`, which it now
exercises: it is named in the level document's point of interest, in both languages, with a source, and
nowhere else.

The level's territorial statement names **three** nations, and one problem in it is real and is recorded in
`assets/style/vancouver-level.md` §8 and in `OQ-VANCOUVER-4`: the quoted sentence is the **Tsleil-Waututh**
speaking for the Tsleil-Waututh, the other two names rest on **MST Development Corporation's "The
Partners"**, and `level.schema.json` gives a level exactly one `nationSource`. **Narrowing the statement to
one nation was refused** — downtown Vancouver is within all three territories and naming one would be a
smaller claim than the truth — and the word **"unceded" is deliberately absent** because the cited page does
not use it. Neither is a copy decision to revisit.

The level's symbols content — the flag, the maple leaf, the beaver, the anthem — comes from *Discover
Canada* under ADR-0003 like any other question, and the `symbols` bank now holds **42 verified questions**.
**The beaver is also this game's companion character**, and `TN-GUIDE-the-guide.md` is why that costs nothing
here: the guide is named by role, never "the beaver", so a level that teaches the symbol is not competing
with a label the player has been reading since level 1.

### Level 10 — The North, `regions`, walk: one region drawn and named for three

**The second row this file left blank, and it is filled the same way level 2's is** — by §1's own distinction
— **with one difference that has to be stated rather than buried**: the spine's sentence about this level was
right about the level it was describing. *"A level whose subject is Canada's regions, set in the North,
either depicts the peoples of Inuit Nunangat or removes them from a level about where they live."* A level in
Iqaluit, Tuktoyaktuk or Pangnirtung still cannot be drawn, because the identifying built things there **are**
Inuit — the inuksuk, the qamutiik, the sod house, the igloo-form church at Inuvik, the Legislative Assembly
of Nunavut and its mace — and `docs/content-review.md` §5.2 and `OQ-REVIEW-10` cover most of them by name.

**What shipped is the Yukon: a gravel bar on the Yukon River at Whitehorse, with a steel-and-timber freight
vessel on it.** `assets/style/the-north-level.md` §11 states the terms plainly and this table repeats them so
nobody has to find the sheet: **Nunavut and the Northwest Territories are not in this picture**, the level is
titled *The North*, it teaches a chapter that covers all three territories, and every pixel of it is one of
them. That is a **scope decision, not a solution**, and a future slice giving the other two their own levels
does not have to undo anything here. `TN-NORTH-06` makes it a copy rule too: no string claims the level shows
more than it shows — **and it draws the line the quest made necessary**, that teaching a sourced fact about
three territories is not a claim about what is drawn.

The landmark is a **sternwheeler**, and it is level 7's and level 8's outcome a third time: the vessel
carries its own name in large letters across the bow and the pilot house in every reference, `make verify-art`
refuses a `<text>` element, and `art-bible.md` forbids substituting an invented mark, so **it ships nameless
and its blind contract asks for a type and is never asked for a place**. The North as a place therefore rests
on nothing in this level's art, and the level's answer to *where* is its title, its territorial statement and
its bank — none of which is a picture (`OQ-SPINE-6`).

**That same vessel now gives the level's quest.** `content/quests/the-north-sternwheeler.json` declares
`giver: "yukon-river-sternwheeler"` and `characters` stays `[]`. Two steps: stop at the vessel and read two
facts about this part of the country, then answer three `regions` questions. Because the landmark is named
as a **type**, what the dialog announces as its source is a kind of vessel rather than a named boat — which
is the cheapest version of ADR-0029 §6 this game has (`TN-NORTH-01`).

The territorial statement is quoted from **Kwanlin Dün First Nation's** own About page, and two things about
it bind copy. **Endonyms are identical in both languages** — `Kwanlin Dün First Nation`, `Tagish Kwan` and
`Chu Níikwän`, diacritics included (`docs/content-review.md` §9.3). And **the Ta'an Kwäch'än Council is not
named, deliberately**: its government is in Whitehorse, and neither the cited page nor the Council's own
history page says Whitehorse is inside its traditional territory, so naming it would be the invention the
register exists to prevent. `content/sources/kdfn-about-us.json` records the silence and what would close it,
and **no copy on this level resolves it in either direction — the quest's lines included**, which is the one
new way it could have been broken.

**The dogsled is not declared and no copy names one.** §2 above; `assets/style/the-north-level.md` §9.

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
| 2, 10 | *none proposed* | — | **The question does not arise**, because no role is written and none is needed — see below |

`docs/content-review.md` §8.6 forbids « l'agent(e) » and « l'agent·e », and forbids any French copy about the
*player* needing agreement. This table is about characters, not the player, so the rule that binds is
`TN-LEVEL-11`'s: every French string naming a character uses the same form, and no bracketed ending appears
anywhere. Choosing epicene roles means most of the levels never have to answer the question at all.

**The archivist and the volunteer are gone from this table**, and that is what shipping did rather than a
decision taken here: levels 1, 3 and 5 all place the guide, so the roles this file once proposed for them
(the archivist, the volunteer) are not in any level document. `OQ-SPINE-4`'s worry about « archiviste » not
being a grade-6 word is answered by the same fact. **Levels 6, 7, 8 and 9 place no character at all yet**, so
"the judge", "the journalist", "the rancher" and "the artist" are proposals, and no name is written as copy
for any of them — a speaker's label with no dialogue behind it is copy for behaviour nothing performs.

**Levels 2 and 10 are given no role at all, and after ADR-0029 that costs them nothing.** Their art sheets
record that **no figure of any kind is drawn on either level**, at any scale, including a silhouette.
Proposing a role here would be proposing the first figure either level has ever had, in a table, without the
reading `docs/content-review.md` §1 requires — **and it is no longer the price of having a quest**, which is
what ADR-0029 changed. The two levels have a giver, a dialogue and four moment lines without anybody being
drawn. `OQ-PEGGYS-1` and `OQ-NORTH-1` keep the question open at the level's own story, with one instruction
each if it is ever reopened: choose an **epicene** French role noun.

## Player-facing copy

This file owns the place name and the subject line for the nine levels that are not Ottawa, because
`TN-MAP` draws all ten and a place name written in two tables will eventually differ between two screens.
Ottawa's pair stays in `TN-LEVEL-ottawa.md`.

Two other kinds of level string are **not** here, and the split is deliberate: the waiting sentence and the
error title belong to the level and are written in the level's own story file (`TN-WAIT`), and the mode label
belongs to the *mode* and is written once in `TN-MOVE-locomotion-labels.md` — `walk` is now declared by nine
of the ten levels and is one string.

| Key | EN | FR |
|---|---|---|
| `level.halifax.title` | Halifax | Halifax |
| `level.halifax.subtitle` | Rights and responsibilities | Droits et responsabilités |
| `level.peggys-cove.title` | Peggy's Cove | Peggy's Cove |
| `level.peggys-cove.subtitle` | Who we are | Qui nous sommes |
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
| `level.the-north.title` | The North | Le Nord |
| `level.the-north.subtitle` | Canada's regions | Les régions du Canada |

**Two rows were keyed on a level's *number* until 2026-09-13, and they are keyed on its id now.** While
levels 2 and 10 had no id, this table carried `level.2.subtitle`, `level.10.title` and `level.10.subtitle` —
positional keys, which were the honest shape for a level with no id and are the wrong shape the moment one
exists. `content/levels/peggys-cove.json` and `content/levels/the-north.json` shipped, so the keys are
`level.peggys-cove.*` and `level.the-north.*`, spelled as the documents spell the ids. **Nothing else in this
game may use a positional level key**: `TN-WAIT-03` and `TN-DONE-05` already refuse an unqualified key, and
a key numbered by map position is the same defect wearing a digit — it silently re-points at a different
level the day somebody re-orders `journey`. `TN-PASSPORT`'s "keys this screen draws and does not own" table
carried `level.10.title` and is corrected in the same change.

**Three of these titles carry a capital article, and the sentences that use them may not.** "The Prairies",
"The Alberta foothills" and "The North" are how the map names those levels; mid-sentence they are "the
Prairies", "the Alberta foothills" and "the North". « Les contreforts de l'Alberta » is « les contreforts de
l'Alberta » — article *and* noun in lower case, because « contreforts » is a common noun — and **« Le Nord »
is « le Nord », with the capital N kept**, because « le nord » in lower case is a compass direction and not a
region. That is not this table's problem to solve: it is why `TN-WAIT` and `TN-DONE` write their rows out per
level instead of templating them, and why level 10 breaks the template in both languages **in two different
ways in one row**.

**Level 2 has a place name now, and the rule that kept it blank is unchanged.** While the level was blocked,
`TN-MAP-04` required a card with no place name to draw no placeholder — no "TBD", no "???", no empty box —
and that scenario stays, because it is about any unbuilt level and not about level 2. What changed is not the
rule but the level: its place is a village, its subject is a chapter, and naming it states nothing this
project has not earned the right to state. **It is still not called "Mi'kma'ki"**, and it never will be under
§1 item 5 (`assets/style/peggys-cove-level.md` §0).

**All ten ids are decisions now, and none is a proposal.** `content/levels/` holds ten documents and
`content/game.config.json` lists the same ten in `levels`, in `unlockRules.order` and in a `journey` with **no
`null` slots left**. Subject lines are paraphrases of *Discover Canada*'s chapter names and go through the
same verification as any other claim — `OQ-SPINE-2`.

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

  Scenario: Three modes in a row have cost exactly one row each
    Given "train", "horse" and "skateboard" were each added by one level document
    Then TN-MOVE's table gained exactly one row for each
    And no schema, port or adapter changed for any of them

  Scenario: The last two levels cost no row at all
    Given "peggys-cove" and "the-north" each declare only "walk"
    Then TN-MOVE's table gained no row for either
    And the labels for "canoe" and "dogsled" still do not exist
    And ten built levels declare seven of the nine modes the config lists

  Scenario: A quest is added by a document too, and its giver is a thing the level places
    Given a quest document is added naming a giver
    Then exactly one placement on that level has that id, counting characters and points of interest
    And that placement declares the quest id
    And no scene or adapter is changed to add it
    And a giver matching zero placements fails the check, naming the level
    And a giver matching two placements fails it too, naming both

  Scenario: A new level costs its own words, and the build says so
    Given a valid level document is added with no waiting sentence, error title, stamp sentence,
      play label or mode label
    When the content check runs
    Then the build fails, naming the level and each missing string
    And no level draws another level's words while that check is red

  Scenario: A level's keys are spelled with its id, never with its position
    Given a level document declares an id
    Then every key that varies by level is "<prefix>.<id>.<suffix>", spelled as the document spells the id
    And a key containing the level's number in place of its id fails the content check
    And "level.2.subtitle", "level.10.title" and "level.10.subtitle" are the three rows this rule retired

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

  Scenario: A subject is not a place
    Given a level document's subject is a Discover Canada chapter
    And its place is a settlement or a landform rather than a nation's territory
    And nothing in it depicts any nation
    Then §1 item 5 is not engaged by the level's setting
    And "peggys-cove" and "the-north" are the two worked examples
    And a level document whose place name is a nation's territory fails this scenario

  Scenario: A thing that speaks is not a person
    Given a quest's giver resolves to a point of interest
    Then no line it speaks carries an "expression"
    And no portrait, face or figure is drawn for it
    And the level may still declare no characters at all
    And a figure added to satisfy a schema would fail this scenario, as ADR-0029 refused

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

  Scenario: No copy may imply a review that has not happened
    Given no community review with status "granted" exists for a level
    Then no string that level draws, in either language, contains "reviewed", "approved" or "endorsed"
    And none contains "in partnership with", "with the support of", "en partenariat" or "avec le soutien"
    And no screen renders a "communityReview" status
    And that is true of a quest's lines as well as of a copy table's rows
    And TN-PEGGYS-06 and TN-NORTH-06 are the two levels where this is asserted by name

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
    And no document declares either mode today, on any of the ten built levels

  Scenario: The prohibition survives the art contract, in both directions
    Given a level's art contract lists an item in "neverAdd"
    Then no copy string in that level names it in either language
    And no line of that level's quest names it either
    And no level document field names it
    And level 9's totem poles, inuksuk and suspension bridge are the worked example
    And level 10's inuksuk, qamutiik, dogsled, kayak and canoe are the second

  Scenario: The gate is proven by a failing case, not by a green run
    Then a fixture exists for each of the scenarios above
    And each fixture is asserted to fail the check
    And a change that makes any of those fixtures pass fails this suite
```

## TN-LEVELS-03 — What every level's own story has to carry

Not the level's behaviour — that is the level's story — but the floor below which a level story is not
finished. Written as acceptance so a level story can be checked against it before its slice starts.

**One row of this list is failing today**, and it is the last one: level 8 ships with eighteen verified
`economy` questions against a floor of thirty and is in `unlockRules.order` (`OQ-ALBERTA-2`). It is recorded
here as well as in the table above, because a floor nobody notices being crossed is a floor nobody has.
Nine of the ten built levels clear it, and level 8 is the one that does not.

```gherkin
Feature: The floor every level story stands on
  Scenario Outline: Every shipped level satisfies the shared contract
    Given a level that ships
    Then <requirement>

    Examples:
      | requirement |
      | its title and subject line have a value in "en" and in "fr" |
      | every key it owns is spelled with its id and never with its position in the journey |
      | its own waiting sentence names what it is preparing, with no percentage, fraction, step count or ellipsis |
      | its own waiting sentence contains no other level's title, in either language |
      | its own error title names it, in both languages, written out rather than templated |
      | its own stamp sentence and play label are written out per level, in both languages |
      | the mode it declares has a label in both languages, and the HUD is never empty |
      | its NPC, if it places one, has a name that is a role, never an organisation, and never "Speaker", "NPC" or empty |
      | a quest it declares can be offered, which means its giver is placed on it and can be named |
      | a quest given by a point of interest carries no expression on any line, and no figure is drawn for it |
      | its landmark is reference-accurate and simplified, with references and credits recorded |
      | its landmark returns the intended subject under blind identification, and the contract asks for nothing the art is forbidden to draw |
      | its "About this place" panel is reachable from pause and from credits, is never modal, and states a sourced territorial fact |
      | no screen but that panel states or paraphrases a territorial fact, and no quest line does either |
      | no string it draws implies a cultural review that has not happened |
      | every factual sentence it puts on screen is verified like a question, wherever on screen it appears |
      | it is completable with a keyboard alone, by every route it offers |
      | it is completable with one switch, using short and long presses only, by every route it offers |
      | nothing in it counts down |
      | its whole flow works at 200 % text on a 390 x 844 viewport with no sideways scroll |
      | reduced motion removes parallax easing and particles and changes no tuning value |
      | every sound it plays has a visual equivalent |
      | its question bank has at least thirty verified questions for its subject, and shares none of them with another level's subject |

  Scenario: A level in the unlock order that fails the last row is reported
    Given a level document is listed in "unlockRules.order"
    And its subject has fewer than thirty verified questions
    When the content check runs
    Then the build reports the level, the subject and the count
    And "alberta-foothills" is that level today
    And it is the only one of the ten
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
  `validate-content` and fails at load — a worse failure than the one that was fixed. **Three shipped levels
  depend on it** — `prairie-rail`'s `train`, `alberta-foothills`'s `horse` and `vancouver`'s `skateboard` —
  and the two levels shipped on 2026-09-13 depend on it not at all, because both declare `walk`. **ADR-0029
  made the same trade in the same direction and said so**: `giver` lost its brand to gain a kind, and the
  gate that replaces the brand checks something a brand never could — that the id resolves to a thing on the
  level. Two ADRs widening a type and paying for it with a gate is a pattern worth noticing rather than
  rediscovering.
- **`OQ-SPINE-2` — are the subject lines the official chapter names, and who verifies them?** The ten
  subjects are *Discover Canada*'s chapters, and IRCC publishes both languages. The French written above is a
  translation of meaning; the official French chapter titles exist and are citable. *Recommendation:* the
  `content-verifier` checks each pair against canada.ca and records the source, exactly as for a question —
  a subject line is on screen and states what a chapter is called. Where the official title differs from the
  table above, the official title wins and this file is amended. **All ten pairs now exist**, so this is one
  pass rather than a standing task, and « Qui nous sommes » and « Les régions du Canada » are the two rows
  added on 2026-09-13. **ADR-0028 is the reason the second of those is not simply the chapter's name**: a
  subject is a *remit*, the industry material in *Canada's Regions* belongs to `economy`, and `regions` keeps
  the rest. The subject line still says what the level teaches; the verifier should read that ADR before
  deciding what it is being checked against.
- ~~**`OQ-SPINE-3` — level 4's and level 5's question banks overlap.**~~ **Answered 2026-09-09, by the split
  this question asked for, and corrected twice since.** `content/questions/` now holds ten subject
  directories: `rights` 37 verified, `who-we-are` 46, `history` 96, `government` 38, `elections` 36,
  `justice` 31, `modern-canada` 39, **`economy` 18**, `symbols` 42 and **`regions` 58**. **The correction
  this question has now made twice is the same correction**: it said `economy` and `symbols` had "no bank at
  all" and both had one, and it then said there was "no bank at all for `regions`" — which was true when it
  was written and is not true now. `regions` is the **second largest bank in the game**, behind `history`'s
  ninety-six, and clears the floor by twenty-eight. The overlap this question was about is gone; what remains
  is a shortfall on exactly one subject, which is `OQ-ALBERTA-2`. Closed, with both corrections recorded
  rather than the numbers quietly updated — a question that has been wrong about a count twice should say so,
  because the next reader is entitled to know how this file's numbers age.
- **`OQ-SPINE-4` — one NPC role still needs the French agreement decision, and two levels retired the
  question rather than answering it.** Level 8's « éleveur / éleveuse » has the same shape as `OQ-LEVEL-8`'s
  « agent / agente », and level 8 has shipped without placing a character, so nothing is blocked and nothing
  has been written either way. **Levels 2 and 10 shipped placing no character and proposing no role**, which
  is the cheapest possible state and is a decision rather than an oversight: neither level draws a figure of
  any kind, so a proposed role would have been the first one. **ADR-0029 is what makes that state permanent
  rather than provisional**: those two levels have a quest, a giver and four moment lines without a character,
  so nothing is waiting on this question there and nothing will be. *Recommendation:* answer `OQ-LEVEL-8`
  once for all ten levels rather than eight times, and prefer an epicene role for every level that still has
  to place one — level 9's « l'artiste » shows what that buys. Do not reach for a bracketed ending in any
  case.
- **`OQ-SPINE-5` — do modern buildings and named venues raise the same question the RCMP uniform did?**
  Levels 5, 6 and 9 name buildings completed well within living memory, and one of them (the CN Tower) has a
  trademarked name. `OQ-LEVEL-1` established that this project asks before drawing something protected rather
  than after. **Answered in part by `TN-NAMES-naming-real-places.md`** for the *copy* half — the name is text,
  in a point-of-interest card's body or in the words a quest's giver says about going there, once, with no
  mark and no claim of association — and the art half is unchanged: draw the form, carry no wordmark, no logo
  and no signage, cite the reference, credit the photograph. **Level 2 adds a case the list did not have**:
  Peggy's Point Lighthouse is a named structure that is nobody's brand and carries no mark at all, named in
  its point-of-interest card in both languages and nowhere else — **and, since ADR-0029, as the accessible
  name of the dialog it speaks through**, which is a second surface and is asserted rather than assumed
  (`TN-PEGGYS-01`). A level whose landmark **is** on `TN-NAMES`'s list and which gave that landmark a quest
  would put a trade name in a dialog's accessible name, and that case has not arisen and should be decided
  before it does (`OQ-NAMES-1`).
- **`OQ-SPINE-6` — is a level's *place* allowed to be a region rather than a city?** Levels 7, 8 and 10 are
  regions, and `TN-MAP` draws a place name for each. **All three have now shipped and all three landed the
  same way**, which makes it a pattern three times over: each landmark is a *type* — "Prairie grain
  elevator", "Working ranch", "Yukon River sternwheeler" — drawn from a specific cited structure whose name
  cannot reach the player, twice because the name is painted on the building and `make verify-art` refuses a
  `<text>` element. **And level 2 shows the same failure mode on a level that is not a region**: a lighthouse
  is a type with several hundred instances in one province, so its place-anchor rests on measured proportions
  and on a contract that says what to do if a blind pass returns only the type. *Recommendation, unchanged
  and now better evidenced:* accept regions, require each to name one **specific, cited, existing** structure
  as its reference, and stop requiring the *name* to reach the player. A region with no specific reference is
  still where an invented landmark comes from, and that half of the rule stands. `OQ-NAMES-6` records the
  same finding from `TN-NAMES`'s side.
- **`OQ-SPINE-7` — what happens to this file when each level gets its own story?** **Answered in practice.**
  All ten levels now have a story file — Ottawa a full one, the other nine partial — and this table keeps
  their subject, place, locomotion, landmark, NPC and blockers. Each level story owns its own copy, its own
  art notes and its own scenarios; this file keeps the table, the blockers and the two contracts, so there is
  still one page that answers "what are the ten levels and which of them may be built". A spine that is
  deleted after the first level is written is a spine that has to be rediscovered for the second.
  **The prediction held exactly**: the detail moved and the rows stayed. What this file now owns that no
  level story can is the **subject-versus-place distinction** in the blockers section, because it is the rule
  two levels were unblocked by and neither of them is the right place to keep a rule about all ten.
- **`OQ-SPINE-8` — "Built" means two different things in the status column, and one line of prose is holding
  them apart.** Nine built levels clear their bank floor; level 8 does not, and every one of them reads as
  "Built" at a glance. *Recommendation:* the status column gains an explicit state — `built`, `shippable`,
  `shipped` — or `game.config.json` stops listing a level in `unlockRules.order` until its bank clears, which
  would make the config the single source of that fact and delete the ambiguity rather than document it. The
  second is better and is not this directory's to make. **The map filling up makes this worse rather than
  better**: with ten of ten built, "how much of this game is finished" is a question the status column is now
  the only answer to, and it answers it in prose — **and two of the ten now carry a quest that validates and
  cannot be opened** (ADR-0029's engine obligation), which is a third meaning the word "Built" is being asked
  to carry. Routed to the plan owner with `OQ-ALBERTA-2`.
- **`OQ-SPINE-9` — two Tier 3 obligations exist for these ten levels and nothing was reading either of
  them.** `assets/style/peggys-cove-level.md` §0 and `assets/style/the-north-level.md` §0 each carry an
  ADR-0009 marker dated 2026-12-08, naming what a reviewer from the Mi'kmaq and from Kwanlin Dün First
  Nation still owes — and `scripts/check-obligations.mjs` scans `*.md` under `docs/` only, so both were
  decoration. The art agent reported that plainly rather than assuming the markers counted, which is why it
  cost one commit. Both are copied into `docs/content-review.md` §13 in this change.
  *Recommendation:* **also widen the scanner to `assets/style/`**, and treat the copies as the stop-gap they
  are — two owners can write an obligation and only one directory is read, so the next art sheet's marker
  will be decoration again. Routed to the engine agent. `OQ-PEGGYS-4` and `OQ-NORTH-5` are the same question
  from the two level stories.
- **`OQ-SPINE-10` — `TN-DIALOGUE` is written throughout as *what a character says*, and two givers are not
  characters.** ADR-0029 records this as an obligation on this directory (due 2026-11-13, owner content), with
  two acceptable discharges: add the landmark case to that file, or record that its existing scenarios are
  read as applying to both. **Its own words are the reason it cannot simply be left**: *"A story that names
  only one kind of giver is the sentence this ADR removed from the schema, surviving in the document that
  specifies the screen."* *Recommendation:* take the first route. The second is cheaper and understates what
  changed — four moment lines, a speaker label, a dialog's accessible name and a portrait that must not be
  drawn are not all the same for a plaque as for a person, and `TN-PEGGYS-06` and `TN-NORTH-06` have already
  had to write the difference down twice. Two level stories carrying a rule that belongs to the screen is the
  shape this directory keeps correcting.
  **Resolved 2026-09-23, by the first route.** `TN-DIALOGUE` now has *Two kinds of giver* (every scenario
  applies to both, with a table of the five differences) and `TN-DIALOGUE-07` (the landmark case). Its
  `TN-DIALOGUE-03` name scenario reads the giver's own document, not `npc.<giver>.name`. `TN-PEGGYS-06` and
  `TN-NORTH-06` are unchanged and still hold each level's own rules.
