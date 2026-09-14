# Stories — slice 1 (vertical proof), the front door, the ten built levels, the spine, and Exam mode

These files are the acceptance criteria for slice 1 and for slice F1. Every other task in
`docs/plan/slice-1.md` builds against them. If a scenario here and an implementation disagree, the scenario
is the specification until a story is changed on purpose.

Slice 1's definition of done, as a sentence: *a player can create a character, skate the Ottawa level,
talk to the officer, accept and finish one quest, answer three scheduled questions, earn a stamp, run a
Study drill, close the tab and come back to the same state.* One file per clause.

**Amended 2026-09-08 with the three files that make that sentence reachable.** A staff review found that
nothing in slice 1 was reachable: `app/bootstrap` mounted four things, the only way into a level was a
`?level=` URL parameter, and a player opening the deployed page was told "there is no level to play yet" —
the caption behaving correctly on a game with no entrance. The screens existed and had no consumer. The
front door had no stories, so `TN-TITLE`, `TN-MAP` and `TN-FLOW` are those stories, and `TN-LEVELS` is the
spine the other nine levels need before slice 2 starts.

**Amended again 2026-09-08 with Exam mode and the passport.** `docs/plan/slices.md` F1 — "Official format,
optional timer, results by subject" — had no stories, and neither did the passport, which `TN-HUD-02`'s menu
has offered since slice 1. Between them they are the two player-facing features a finished game needs that
nothing in this directory described. Exam mode is four small files rather than one large one, because the
clock, the result and the unfinished attempt are three different arguments; the passport is one.
`TN-NAMES` came out of the same pass: three files were asking the same unanswered question about naming a
real place, and a question asked in three places belongs in a file of its own.

**Amended a third time, 2026-09-08, because the game stopped opening on Ottawa.** Four level documents ship
— `halifax`, `quebec-city`, `ottawa`, `toronto` — and `content/game.config.json` opens on **Halifax**. Three
strings on that first screen were Ottawa's: the HUD's mode label was empty because the only
`locomotion.<mode>.label` row written was `skate`, the waiting screen read "Getting the canal ready." on a
Halifax load, and the error card read "We could not load Ottawa." whichever level had failed. One story file
holding the only level copy in the directory is how that happens. So:

- **`TN-MOVE-locomotion-labels.md`** owns every mode label, because a label belongs to a *mode* and nine of
  the ten built levels declare `walk`. `locomotion.skate.label` moved there from `TN-LEVEL`, unchanged.
- **`TN-WAIT-a-level-opens-or-it-does-not.md`** owns the shared error-card chrome and the key shape: there is
  no `level.loading` and no `level.error.title` any more, only `level.<id>.loading` and
  `level.<id>.error.title`, one pair per built level, and a gate that fails the build for a level with
  neither. An unqualified key is a key two levels will disagree about, and two of them already did.
- **`TN-LEVEL-halifax.md`**, **`TN-LEVEL-quebec-city.md`** and **`TN-LEVEL-toronto.md`** own their own pair.
  They are deliberately *not* full level stories — the locomotion, camera, NPC and quest scenarios are
  written in the slice that builds them — but a level a player can already open needs its own words now.
- `OQ-LEVEL-9` is closed in `TN-LEVEL-ottawa.md` in favour of the answer it recommended a day earlier. It
  was right, and nothing acted on it, which is the case for closing a recommendation rather than leaving it
  as one.

**Amended a fourth time, 2026-09-08, because a level can now be finished.** Reaching the end of a level
earns its stamp and offers the next one (task 1.23), and the card that says so was drawing strings that do
not exist: `stamp.<id>.earned` was written for Ottawa alone, so **the first completion card the shipped game
draws — Halifax's — had no stamp line at all**, and a player who reached the end having answered nothing was
told nothing about it. The same task reported `hud.interact.*` missing for the third time, and the interact
prompt has been drawing a landmark's **name** in the HUD in its place. So:

- **`TN-DONE-finishing-a-level.md`** owns the completion card: when it appears, `level.complete.none` for the
  player who answered nothing, `level.complete.score` for the one who did, and the directory of the two rows
  every built level owns — `stamp.<id>.earned` and `level.<id>.play` — each written in that level's own story
  file, per level, for the reason the error title is. It also records the heading defect nobody had noticed:
  the card says "Task done!" to a player who accepted no task.
- **`TN-REACH-what-is-in-reach.md`** owns what the HUD says when something is in reach — a place, a person,
  something already done, and the one-time hint for the marks themselves. It is a second file rather than
  rows in `TN-HUD` because the prompt belongs to *what is in reach*, not to the strip that draws it, and
  because it settles a rule `TN-HUD` cannot: the prompt is never a name, which is what stops "CN Tower"
  being drawn in the HUD (`TN-NAMES-04`).

**Amended a fifth time, 2026-09-09: two more levels landed, and the character who gives three of the four
quests had no name.** `content/levels/winnipeg.json` and `content/levels/prairie-rail.json` shipped, drawn
and documented, and `content/game.config.json` lists both — so the directory's per-level tables were short by
two rows each and three copy gates were failing by name. Worse, `content/quests/halifax-clock-and-pier.json`,
`quebec-city-chateau-frontenac.json` and `toronto-cn-tower.json` all declare `"giver": "guide"`, and there
was no `npc.guide.name`: `app/ui/dialogue.ts` requires a speaker's name (`TN-QUEST-08`), **so all three
offers were refused, including on the level the game opens on.** Four files answer it:

- **`TN-GUIDE-the-guide.md`** owns the companion's name — "The guide" / « Le guide », a **role and not a
  proper name**, for the five reasons written there — and its interact prompt, because the guide is on three
  levels and a name belongs to the character rather than to any one of them. It is also where the beaver's
  depiction rules are stated for copy: it carries no cultural item of any kind, `indigenous` is `false` and
  that is the only honest value, and a role noun cannot borrow a nation's language the way a "truly
  Canadian" proper name might have.
- **`TN-LEVEL-winnipeg.md`** and **`TN-LEVEL-prairie-rail.md`** own their own four rows each, in the shape
  the three partial level files already use. The Prairies is the level that proves the rule this directory
  had only ever defended in French: **a template breaks the English too** — "We could not load The
  Prairies." and "the The Prairies stamp" — and it adds a fourth French form after « tampon » (« des »).
  `locomotion.train.label` went to `TN-MOVE` and nowhere else, because `prairie-rail.json` really does
  declare `train`.
- **`TN-DIALOGUE-what-a-quest-giver-says.md`** rules on a schema gap the UI agent found and did the right
  thing with: `quest.schema.json` puts dialogue on a **step**, so a quest has no field for what its giver
  says when the player declines, comes back mid-quest, or comes back after the stamp. The ruling is the
  agent's recommendation — `declinedLine`, `reminderLine`, `afterLine` on the quest document, plus
  `doneLine` for the summary `quest.done.body` should never have been global — with the principle stated
  once: **a character's *name* is a copy row; what a character *says in a quest* is quest content.** No line
  is written until the field exists. That file also amends `TN-NAMES-01`, because three shipped quests
  already name their destination in speech and in the tracker.

**Amended a sixth time, 2026-09-09: two more levels again, and two strings the Exam work was borrowing.**
`content/levels/alberta-foothills.json` and `content/levels/vancouver.json` shipped, drawn and documented,
and `content/game.config.json` lists both in `levels`, in `journey` and in `unlockRules.order` — so the
per-level tables were short by two rows each for the second day running, and the copy gates were naming
them. Three files answer it:

- **`TN-LEVEL-alberta-foothills.md`** and **`TN-LEVEL-vancouver.md`** own their own four rows each. Level 8
  is the hardest row either per-level table has and level 9 is the easiest, and **they shipped together,
  which is the whole argument for writing these out**: you cannot tell in advance which levels a template
  will break. Level 8 breaks it in **both languages at once** — "We could not load The Alberta foothills."
  and « charger Les contreforts de l'Alberta » — and its stamp sentence carries **two prepositional forms in
  one line**, « le tampon **des** contreforts **de l'**Alberta ». Level 9 breaks nothing and adds no fifth
  French form. `locomotion.horse.label` and `locomotion.skateboard.label` went to `TN-MOVE` and nowhere else,
  because both documents really do declare those modes.
- **`TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md`** owns the two strings Exam mode was drawing from
  somewhere else. The exam was using `hud.menu` and `hud.menu.title` for **its own** menu, which
  `TN-HUD-02` says belongs to a level and offers "Leave the level"; `OQ-TIMER-4` had invented that menu and
  written no row for it, and `OQ-HUD-9` asked the same question from the other side. Both are closed there.
  It also rules on two rows it does not own: **`card.yourAnswer` is the right key** for a chosen option in an
  exam and the defect was a missing row in `TN-EXAM`'s directory plus a **tick that must never be drawn**
  beside it, and **`exam.result.title` is the result screen's accessible name**, not a kicker above the
  verdict that `TN-RESULT-01` requires to be the first line.

**One decision in that pass reversed an earlier one, and it is recorded rather than quietly applied.**
`OQ-MOVE-4` had reserved the word "Riding" for level 8's `horse`. Level 8 cannot have it: in Canadian English
a **riding** is an electoral district, `content/questions/elections/` teaches exactly that, and level 5's
whole subject is federal elections. The label is "Horse" / « Cheval ». Nothing had been written on the
strength of the reservation, which is what this directory's rule about naming a mode only when a document
declares it was for.

**Amended a seventh time, 2026-09-09: the character creator has never been mounted, and the reason was
copy.** `content/characters/rig.json` declares five player-selectable slots, nineteen options and 480
reachable appearances, all of them drawn and shipped; `app/ui/copy.ts` carried labels for **three** slots
that do not match the rig's five, one of which (`creator.slot.coat`) names a slot that is
`playerSelectable: false`, and **no option names at all**. So a player cannot choose their character, 480
appearances sit in the payload with no route to them, and `docs/plan/slice-1.md` records the creator as
unreachable "for a stated reason, not for want of a line". This directory was that reason. Three files
answer it, and the split is the same rule this directory has applied five times now — **the table's home
follows what the string belongs to**:

- **`TN-LOOK-what-the-player-can-choose.md`** owns the five slot labels and thirteen of the nineteen option
  names, because a slot label belongs to the **slot** and an option name belongs to the **option**: four
  things draw them, and the creator screen is only one. It also holds the key shape (`creator.slot.<rig slot
  name>` and `creator.<rig slot name>.<rig option id>`, spelled as the rig spells them, so a gate can
  generate the expected set instead of trusting a list), the deny-list that keeps a judgement word or a
  people's name out of an option, and five French forms English does not need — plural agreement with
  « cheveux », « Roux » rather than « Rouges », « Tuque » against "Toque", and **the one table where English
  is the language carrying the gendered form**: "Blonde" is refused and "Blond" ships.
- **`TN-SKIN-naming-the-six-skin-tones.md`** owns the other six and is **the ruling on `OQ-REVIEW-6`**. It
  is its own file because it is the slot most likely to be re-decided, and the other four must not be held
  while it is — the creator ships one group short rather than not at all.
- **`TN-FIRSTRUN-choosing-a-character-before-playing.md`** owns the seam mounting the creator opens: what
  "first run" means, whether the screen can be skipped, and what happens to the title screen. **`title.play`
  is written, translated, shipped and has never been drawn**, because the shell can only represent a first
  run when a creator block is passed and none ever has — so `TN-TITLE-01`'s "the element `title-play` is
  visible" has never been able to pass on the shipped page. That file is the eighth instance of a decision
  going in a file with what it costs, rather than into a commit message.

**The skin-tone ruling is the one an implementer must not paraphrase, so it is summarised here and argued
there.** Every tone is named by its ordinal and by a lightness band it shares with exactly one other tone —
"1, light" … "6, dark" / « 1, clair » … « 6, foncé ». It **adopts** `docs/content-review.md` §8.1's
recommended direction and amends its wording twice: the cue goes on **all six** rather than on the two ends,
because four bare numbers between two described ends makes the palest and the deepest the marked cases and
the rest unremarkable; and the deep end is called **"dark"** rather than "deep", because a euphemism at one
end with the plain word at the other says that one end needs softening, and because French offers no
euphemism to match, so the recommendation as written had the two languages doing different things. The band
word is a **measurement** — `TN-SKIN-02` sorts the six `skin-N-base` entries in `palette.json` and fails the
build if the order or the two-two-two banding is wrong — which is this project's standard applied to a copy
row. **Nothing in that file is a sign-off**, `docs/content-review.md` §1 puts creator skin tones on the list
that may ship without a Tier 3 reviewer, and §7's asymmetry is live: a report that these names are wrong
fails them, and nothing passes them.

**Amended an eighth time, 2026-09-13: the last two levels landed, the map is complete at ten, and the two
rows this directory had refused to scope were scoped by the rule that blocked them.**
`content/levels/peggys-cove.json` and `content/levels/the-north.json` shipped, drawn
(`assets/style/peggys-cove-level.md`, `assets/style/the-north-level.md`) and listed in `levels`, in a
`journey` with **no `null` slots left** and in `unlockRules.order` — so the per-level tables were short by
two rows each for the third time, and the copy gates were naming them. Two files answer it, and three things
they settle belong here rather than in either:

- **`TN-LEVEL-peggys-cove.md`** and **`TN-LEVEL-the-north.md`** own their own four rows each. **Level 10 is
  the row this directory has been predicting since level 7 and it is the sharpest yet**: the English needs a
  lower-case article — "the North" — and the French needs a lower-case article **with the noun's capital
  kept**, « le Nord », because « le nord » is a compass direction. It also brings the **fifth** French form
  after « tampon », « du Nord », which is *de + le* contracting and which levels 8 and 9 did not need. Level
  2 adds no form in either language and is written out anyway, which is the rule working rather than the rule
  being tested. **Neither level adds a row to `TN-MOVE`**: both declare `walk`.
- **A level's subject is not a level's place, and that is what unblocked both of them.**
  `docs/content-review.md` §1 blocks a level whose **subject** is a nation's territory or history, and
  permits a sourced territorial fact, because a citation is not a depiction (`TN-LEVELS-02`). A level whose
  subject is a *Discover Canada* chapter and whose place is a village in Nova Scotia or a river bank in the
  Yukon is not the blocked level. `TN-LEVELS` writes that distinction into its blockers section, because it
  is a rule about all ten levels and neither level story is the right home for it. **What did not change is
  the block**: a level *in Mi'kma'ki*, or one set in Inuit Nunangat, is still §1 item 5 exactly, and both new
  levels carry a **Tier 3 obligation** naming what a reviewer from the Mi'kmaq and from Kwanlin Dün First
  Nation still owes.
- **Both levels' obligations were written where no gate could read them, and both are now copied into
  `docs/content-review.md` §13.** `scripts/check-obligations.mjs` scans `*.md` under `docs/` only, so an
  ADR-0009 marker in `assets/style/` has no clock on it. The art agent reported that rather than assuming it
  counted. The copies give the date teeth today; widening the scanner to `assets/style/` is the real fix and
  is routed as `OQ-SPINE-9`, `OQ-PEGGYS-4` and `OQ-NORTH-5`.

**Amended a ninth time, 2026-09-13: a quest is offered by a thing the level places, and two levels that
could not hold one now do.** ADR-0029 widened `quest.giver` from a character to an **engageable**, so
`content/quests/peggys-cove-point-light.json` is given by a lighthouse and
`content/quests/the-north-sternwheeler.json` by a vessel, on two levels that draw **no figure of any kind, at
any scale, including a silhouette**. Four things follow for this directory:

- **The figure prohibition is untouched, and the ADR is explicit that it refused to weaken it.** What it
  found instead was a schema clause performing a scope cut: `giver: characterId` was written when the only
  two things that existed were `guide` and `officer`, and it encoded *a quest is offered by somebody* as a
  type. `CLAUDE.md`'s own traversal rule already said otherwise — *"tap NPC or POI to engage"*.
- **Six of the ten built levels now have a quest and four do not**, so `OQ-DONE-1`'s instance count drops
  from six levels to four. The defect is unchanged; two of its causes are gone.
- **`TN-REACH` gains one generic row**, `hud.interact.poi.offer` — "See what there is to do here" / « Voir ce
  qu'il y a à faire ici » — because "Look at this place" promises a card and opens a conversation, and this
  directory's rule is that the prompt says what pressing will do. **"Talk to this place" was refused**: a
  landmark giver is the named source of words and does not acquire a mouth, and a prompt that personified it
  would do one screen earlier exactly what ADR-0029 §5's voice rule exists to prevent.
- **Both level stories decide, in writing, that "About this place" is unchanged.** A plaque is exactly the
  object that would carry a territorial statement at a real site, so the two files say why it does not carry
  one here: §10.2 rules out anything the player taps past, **a quest can be declined**, and the panel quotes
  a nation's own words while every quest line carries `sourceId: "discover-canada"`. The new prohibition is
  asserted rather than assumed — **no quest line on either level states or paraphrases the territorial
  statement**, and level 10 adds that none may resolve its recorded silence either.

| File | Area | Covers |
|---|---|---|
| `TN-TITLE-title-screen.md` | `TN-TITLE` | The first screen on a cold load: Play, Continue, Study, Settings |
| `TN-MAP-level-select.md` | `TN-MAP` | The ten levels, their order, their three states, and when the game may promise more |
| `TN-FLOW-first-run-and-return.md` | `TN-FLOW` | The route between screens, first run, return, and back out |
| `TN-FIRSTRUN-choosing-a-character-before-playing.md` | `TN-FIRSTRUN` | What "first run" means, why the creator cannot be skipped and never has to be used, and how it re-opens from Settings |
| `TN-CREATOR-character-creator.md` | `TN-CREATOR` | The creator **screen**: its chrome, its focus order, its failure to save |
| `TN-LOOK-what-the-player-can-choose.md` | `TN-LOOK` | The five slots and thirteen of the nineteen option names, the key shape, and the deny-list |
| `TN-SKIN-naming-the-six-skin-tones.md` | `TN-SKIN` | The six skin ramps, the ruling on `OQ-REVIEW-6`, and the measurement that keeps it true |
| `TN-LEVEL-ottawa.md` | `TN-LEVEL` | Loading Level 4, skate locomotion, camera, POIs, pause |
| `TN-LEVEL-halifax.md` | `TN-HALIFAX` | Level 1's own copy: what it says while it opens, in the HUD, when it fails and when it is finished |
| `TN-LEVEL-peggys-cove.md` | `TN-PEGGYS` | Level 2's own copy, a place that is a village and not a territory, a quest given by a lighthouse, and two silences copy may not fill |
| `TN-LEVEL-quebec-city.md` | `TN-QUEBEC` | Level 3's own copy, and the rows that prove a French sentence cannot be templated |
| `TN-LEVEL-toronto.md` | `TN-TORONTO` | Level 5's own copy, and the tower it may not name on a loading screen, a stamp or a prompt |
| `TN-LEVEL-winnipeg.md` | `TN-WINNIPEG` | Level 6's own copy, and the museum and the treaty statement it may not draw into it |
| `TN-LEVEL-alberta-foothills.md` | `TN-ALBERTA` | Level 8's own copy, the row that breaks the template in both languages, and a treaty statement whose silence copy may not resolve |
| `TN-LEVEL-prairie-rail.md` | `TN-PRAIRIE` | Level 7's own copy, and the four places a region stops behaving like a city |
| `TN-LEVEL-vancouver.md` | `TN-VANCOUVER` | Level 9's own copy, three nations named in one statement and none of them in a copy row |
| `TN-LEVEL-the-north.md` | `TN-NORTH` | Level 10's own copy, one region drawn and named for three, a quest given by a vessel, and the fifth French form after « tampon » |
| `TN-GUIDE-the-guide.md` | `TN-GUIDE` | The companion's name, its prompt, and why it is a role rather than a proper name |
| `TN-MOVE-locomotion-labels.md` | `TN-MOVE` | What the HUD calls each way of moving, once per mode |
| `TN-WAIT-a-level-opens-or-it-does-not.md` | `TN-WAIT` | Which waiting sentence and which error title each level draws, and the shared chrome |
| `TN-REACH-what-is-in-reach.md` | `TN-REACH` | What the prompt says when a place, a person, a place with something to offer or a finished target is in reach, and the one-time hint |
| `TN-DONE-finishing-a-level.md` | `TN-DONE` | Finishing a level: the card, the stamp sentence, what was answered, and the level that just opened |
| `TN-LEVELS-2-to-10-spine.md` | `TN-LEVELS` | The nine levels after Ottawa: subject, place, locomotion, landmark, NPC, blockers |
| `TN-HUD-hud-and-menu.md` | `TN-HUD` | The lower-third HUD, the menu, the storage warning, the page's landmarks |
| `TN-QUEST-parliament-hill.md` | `TN-QUEST` | Offer, accept, decline, track, complete, stamp |
| `TN-DIALOGUE-what-a-quest-giver-says.md` | `TN-DIALOGUE` | Declining, coming back mid-quest, coming back after the stamp — and where those words live |
| `TN-CARD-question-card.md` | `TN-CARD` | The question card: arrival, right, wrong, leaving |
| `TN-STUDY-study-mode.md` | `TN-STUDY` | The Study drill and its summary |
| `TN-EXAM-starting-and-answering.md` | `TN-EXAM` | Starting an exam, what it draws, answering twenty questions, finishing |
| `TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md` | `TN-EXAMMENU` | The exam's own menu, the word beside a chosen option, and the result screen's name |
| `TN-TIMER-the-exam-clock.md` | `TN-TIMER` | The optional thirty-minute clock, and why it is the only one |
| `TN-RESULT-exam-results.md` | `TN-RESULT` | Passing, not passing, results by subject, the review, trying again |
| `TN-ATTEMPT-leaving-and-resuming-an-exam.md` | `TN-ATTEMPT` | Leaving an exam, closing the tab, finishing it later |
| `TN-PASSPORT-my-passport.md` | `TN-PASSPORT` | Ten stamps, three states, the exam result, how much is left |
| `TN-SAVE-save-and-reload.md` | `TN-SAVE` | Exactly what survives a closed tab; export and import |
| `TN-RESUME-questions-after-a-reload.md` | `TN-RESUME` | Which question is asked when an answer step is resumed |
| `TN-SET-settings.md` | `TN-SET` | Language, hold time, and the accessibility switches the other stories set |
| `TN-NAMES-naming-real-places.md` | `TN-NAMES` | When a real building may be named in copy, and where it may not appear |
| `TN-COPY-strings-and-counts.md` | `TN-COPY` | The rules every copy table obeys: plurals, state words, waiting copy, missing strings |

**A level story's file name carries its level and its scenario ids carry its area.** `TN-LEVEL-ottawa.md`
numbers its scenarios `TN-LEVEL-01`… because it was written when Ottawa was the only level; its neighbours
use `TN-HALIFAX-nn`, `TN-PEGGYS-nn`, `TN-QUEBEC-nn`, `TN-TORONTO-nn`, `TN-WINNIPEG-nn`, `TN-PRAIRIE-nn`,
`TN-ALBERTA-nn`, `TN-VANCOUVER-nn` and `TN-NORTH-nn` so that no id means two things. **All ten levels now
have a file**, so this convention is closed rather than open: no future level story extends `TN-LEVEL`,
because there are no future levels in this game's scope.

`TN-SET` is not in the task-1.1 list. It is here because every other story states an accessibility
precondition ("Given single-switch mode is on"), and a precondition nobody can set is not testable. It is
deliberately small.

`TN-HUD` and `TN-COPY` were added after task 1.15 built the screens, for the same reason: both were shared
vocabulary in this file and the acceptance criteria of no file. `storage-warning` was required by
`TN-SET-03` and `TN-CREATOR-03` and owned by nobody; `study.count` drew "1 questions" because one copy table
row cannot say two things. A rule with no story is a rule nothing can fail.

Two more strings joined their tables on 2026-09-08, both found the same way — the screens had to take them
from the caller as **required** options, so no screen could be mounted without somebody inventing a word.
`hud.label`, the accessible name of the `hud` region that `TN-HUD-07` requires, is now in `TN-HUD`;
the level's waiting sentence, the text `TN-LEVEL-01` requires instead of a bare spinner, is now written per
level under `TN-WAIT`, with the rule that it may not claim progress the game cannot measure. **A gap
reported under `TN-COPY-06` is a debt, not a home.** A string that lives in a caller forever is a string two
callers will eventually disagree about — and a string written for one level and drawn by four is the same
debt, paid by the player.

**The completion card is the third instance of that debt, and the most expensive so far.** It was shipped
with three keys reported as gaps, and one of them — `stamp.<id>.earned` — existed for exactly one level while
the game opened on a different one. `TN-DONE` writes the rows, and it writes the rule with them: a string
that varies by level needs one row per built level and a gate that fails the build for a level with none,
which is `TN-COPY-06`'s "a table with one row where the game needs one per level is a gap, not a table",
applied for the second time.

**`npc.guide.name` is the fourth instance, and the only one that stopped a feature working.** A missing
level string draws the wrong words; a missing speaker's name means the dialogue cannot open at all, so three
of the four authored quests could not be given and the first one a player meets is on the level the game
starts on. `TN-GUIDE` writes the row and states the rule that would have caught it earlier: **a quest's
giver is a character, and a character has a name before it has lines.** **ADR-0029 widened the first half of
that sentence and kept the second**: a giver is now a character *or a point of interest*, and it still has a
name before it has lines — a landmark's comes from the level document, which the ADR notes is *better
founded* than the character case, because a character's still comes from a copy row.

**`exam.menu` is the fifth, and it is the first where a screen borrowed a *neighbour's* row rather than going
without.** Nothing looked broken: the exam's menu said "Menu", which is the right word, because it was
reading the HUD's key. It would have stayed invisible until somebody reworded the level's pause menu and
changed a screen they had never opened. `TN-EXAMMENU` writes the two rows and states the rule the other four
instances share from a new angle: **a missing string that reads correctly is worse than one that reads
wrong**, because only the second kind gets reported.

**The creator's nineteen option names are the sixth, and they are the first where the missing strings
stopped a whole feature from being mounted at all.** Not a wrong word, not a borrowed row: no rows. Five
slots, nineteen options, 480 shipped appearances, and a UI agent correctly refusing to invent the words
because ADR-0010 forbids it. `TN-LOOK` and `TN-SKIN` write them, and the rule they add is a *shape* rule
rather than an ownership one: **a key derived from a data file by one rule can be generated and compared;
a key somebody types can only be trusted.** `creator.slot.coat` is what happens without it — a row naming a
slot that has never existed, sitting in the shipped bundle, matching nothing and failing nothing.

**`level.2.subtitle` and `level.10.*` are the seventh, and they are the first keys that were *correct* when
they were written and wrong later.** While levels 2 and 10 had no id, `TN-LEVELS` keyed their two copy rows
on their **position in the journey** — which was the honest shape for a level with no identity and became a
trap the moment both shipped with ids. A positional key re-points at a different level the day somebody
re-orders `journey`, silently, and reads correctly the whole time. They are now `level.peggys-cove.*` and
`level.the-north.*`, and `TN-WAIT-03` and `TN-DONE-05` refuse a numbered key by name, beside the unqualified
one they already refused. The rule this adds is the shape rule pointed at time: **a key is spelled with the
thing's identity, and a position is not an identity.**

`TN-RESUME` was added on 2026-09-08 for the sharpest version of that problem: not a rule nobody owned, but a
moment **two stories owned and answered differently**. `TN-SAVE-01` said a question already answered is never
asked again after a reload; `TN-CARD-02` and `TN-CARD-04` promise the player, in printed copy, that a
question they got wrong comes back soon. Building the domain proved the two cannot both hold. `TN-CARD` won,
`TN-SAVE` was amended, and the reasoning lives in `TN-RESUME` rather than in a commit message, because a
reader who finds one story contradicting another trusts neither. **When a seam between two stories has to be
decided, the decision goes in a file, with what it costs, and both sides point at it.**

`TN-FLOW` is the second application of that rule, and it moved two other files. `TN-CREATOR-01` said the
creator was the first screen a new player sees and that a returning player "reaches `playable` without
choosing anything" — both true of a game with no front door, both wrong once one exists. `TN-FLOW` owns
where a cold load lands and what the creator hands to; `TN-CREATOR` is amended and points at it.
`TN-SAVE`'s survives table gained a ninth row, the level last played, because "Continue" cannot name a level
the save does not remember. `TN-HUD-02`'s menu gained a fourth item, "Leave the level", because a player who
reached a level from the map had no way back except the browser's back button.

`TN-ATTEMPT` is the third, and it is the first one to **reverse** a recommendation rather than settle a
contradiction. `OQ-RESUME-3` proposed in one line that an exam in progress should not be resumable, and asked
that Exam mode say so explicitly rather than inherit it by silence. It says the opposite explicitly: an exam
survives a closed tab, a drill does not, and the reason is that a drill loses nothing when a tab dies while
an exam loses the whole result. Both files point at the decision, `TN-SAVE`'s survives table gained rows 10
and 11, and `OQ-ATTEMPT-1` records what would change if the project owner prefers the simpler rule.

`TN-DIALOGUE` is the fourth, and it is the first that decides **where a string lives rather than what it
says**. Three moments in a quest had no words, and the choice was a global copy table keyed per quest or four
fields on the quest document. It rules for the document, because one giver — the guide — now gives three
quests, so a key named after the character is already wrong, and a key named after the quest is content in a
table. It also amends `TN-NAMES-01` in the same pass, with the cost written down, because a rule that says
"nowhere else" while three shipped quests say the name is a rule readers stop trusting. **ADR-0029 leaves it
one obligation** (due 2026-11-13): that file is written throughout as *what a character says*, and two givers
are not characters. `OQ-SPINE-10` recommends adding the landmark case rather than declaring the existing
scenarios to cover it.

`TN-EXAMMENU` is the fifth, and it is the first that rules **against the screen that raised the question** in
one of its three rulings and **for it** in another. The exam asked for a word for a chosen option and was
given the one it was already drawing — `card.yourAnswer` stays `TN-CARD`'s and the exam's directory row was
what was missing — while the tick it would naturally have drawn beside that word is refused, because
`exam.noFeedback` promised no feedback until the end and a tick is feedback. And `exam.result.title` is ruled
to be an accessible name rather than a visible kicker, because `TN-RESULT-01` requires the verdict to be the
first line and a label above it is a pause before bad news.

`TN-FIRSTRUN` is the sixth, and it is the first that decides **a product question the code had been
answering by omission**. Whether a player must choose a character before playing was never written down, so
the shipped behaviour was whatever the shell happened to do — which was to never draw `title.play` at all.
It rules that the creator is on the route and has **no skip control**, and that **nothing in it is
required**: the screen opens with a complete randomised character and the primary control is enabled from
the first frame, so a player passes through the screen and never has to use it. The load-bearing reason is
not the tap count. **A skip would have to land somewhere**, and the only appearance available without a draw
is each slot's `fallback` — which the rig says in as many words is for NPC documents and save recovery and
is "never rendered as a pre-selection". A skip button therefore reintroduces the default player through the
back door, undoing `assets/style/art-bible.md` §8, `docs/content-review.md` §8.1 and `OQ-REVIEW-7` with a
control added for convenience. The same reasoning decides the save-recovery path in `TN-LOOK-05`: an option
id this build no longer has is replaced by a **uniform draw**, never by the fallback.

`TN-LEVELS`'s blockers section is the seventh, and it is the first that decides **what a rule does not
cover**. Two levels sat unscoped for four sessions under `docs/content-review.md` §1, correctly, and what
released them was reading the rule closely rather than deciding to proceed anyway: §1 blocks a level whose
**subject** is a nation's territory or history, and permits a sourced territorial fact. A village and a
river bank are places; a chapter of *Discover Canada* is a subject; a quoted sentence with a citation is
neither a depiction nor an acknowledgement. **The distinction lives in the spine and not in either level
story**, because a rule that governs all ten levels cannot be kept in the file of the level that happened to
need it first — which is the same reason `TN-MOVE` holds the mode labels.

**The eighth is not in this directory at all, and that is the point of recording it here.** ADR-0029 found
that a **schema clause** — `giver: characterId` — was performing a scope cut that two level stories and two
art documents had all correctly described and none of them could fix, because none of them owns
`content/schemas/`. The stories' job was to state the prohibition and its cost precisely enough that somebody
reading them could see what it was really colliding with. `TN-REACH` and both level stories carry the
consequences; the decision belongs to an ADR. **A story that describes a constraint accurately is what makes
the constraint's cause findable**, and that is worth more than a story that works around one.

Two words were settled in an earlier pass, in the files that own them rather than in the files that noticed
them. **« Timbre » became « tampon »** — a « timbre » is a postage stamp and the mark in a passport is a
« tampon » — settled by `TN-PASSPORT` and applied to `TN-QUEST` and `TN-MAP` in the same change
(`OQ-MAP-5`, closed). **A real building may be named in copy**, under seven rules, settled by `TN-NAMES`
(`OQ-QUEBEC-1`, and the class `OQ-SPINE-5` asked about). The first of those changes shipped French strings in
`app/ui/copy.ts`, which is not this directory's to edit and is reported to the UI agent instead.

## Rules these stories are written to

- **Accessibility is acceptance, not a section.** Every file carries its own keyboard-only, single-switch,
  screen-reader, reduced-motion and 200 %-text scenarios, and opens with a coverage map naming the scenario
  that discharges each one. There is no separate accessibility story, on purpose.
- **Bilingual is acceptance.** Every file has EN and FR scenarios. Player-facing wording is written out in
  both languages so the UI agent is not inventing copy. Where a string is not written here, it is an open
  question in that file, not a licence to improvise.
- **A string is written down once.** One key, one copy table, one file. Where a second screen needs the same
  words it names the key and the file that owns it (`TN-HUD` does this for nine keys, `TN-MAP` for the ten
  level names, `TN-TITLE` for four, `TN-PASSPORT` for eleven and `TN-CREATOR` for twenty-two). Two tables
  carrying the same words is how they stop being the same words. **And the table's home follows what the
  string belongs to**, not which screen draws it: a waiting sentence belongs to a level, a mode label belongs
  to a mode, a stamp sentence belongs to the level it names, an interact prompt belongs to what is in reach,
  a character's name belongs to the character, a menu belongs to the screen it is a way out of, **a slot
  label belongs to the slot and an option name belongs to the option**, and a button that says "Go back"
  belongs to none of them (`TN-WAIT`, `TN-MOVE`, `TN-DONE`, `TN-REACH`, `TN-GUIDE`, `TN-EXAMMENU`,
  `TN-LOOK`). **A rule about when a string is drawn belongs with the string**, which is why `TN-MAP` owns the
  condition on `map.moreComing` as well as its words, across four screens and two different counts.
- **A key derived from data beats a key somebody typed, and a key is spelled with an identity and never a
  position.** `creator.slot.<rig slot name>` and `creator.<rig slot name>.<rig option id>` are generated from
  `content/characters/rig.json`, so a slot with no row, an option with no row and a row with no slot are all
  build failures naming the offender (`TN-LOOK-04`). The alternative shipped `creator.slot.coat` for a slot
  that has never existed, matching nothing and failing nothing. The same rule gives `creator.skin.skin-1`,
  which stutters and stays — and it retired `level.2.subtitle`, `level.10.title` and `level.10.subtitle` the
  day those two levels got ids (`TN-WAIT-03`, `TN-DONE-05`).
- **A string that varies per thing belongs to the thing, and sometimes the thing is not a copy table.**
  `TN-DIALOGUE` is where that rule reaches content: a line one quest's giver speaks lives on that quest's
  document, because a per-quest key in a global table is the quest documents with extra steps — and because
  a line that states a fact about Canada needs a source, which a copy row has nowhere to put. **It also
  means a card's rules can bind a string a copy table does not hold**: `quest.done.body` became the quest's
  own `doneLine` and is still drawn on the completion card, so `TN-DONE`'s list of what may not appear there
  binds a sentence living in `content/quests/`.
- **Sharing a key and owning one are both decisions, and each needs its reason.** `map.stamps` is shared by
  the map and the passport because it is the same fact about the same thing and they must never disagree;
  `level.complete.score` is *not* `study.summary.score` because the two screens are answering different
  questions and neither may reword the other's (`TN-DONE`, `TN-PASSPORT-05`). `card.yourAnswer` **is** shared
  by the level's card, the exam and the review, by the first half of that test — and what differs between
  them is the *shape* beside it, not the words (`TN-EXAMMENU`). **Two slots that both declare an option
  called `none` do *not* share a row**, because "None" under a head covering and "No" under glasses are two
  answers to two questions (`TN-LOOK`).
- **A rule is written down once, too.** Where two stories describe the same moment, one of them owns it and
  the other links. `TN-RESUME` owns what happens to the questions when a step is resumed; `TN-FLOW` owns
  where a cold load lands and what "back" means; `TN-FIRSTRUN` owns what decides which way in the title
  screen offers and whether the creator can be skipped; `TN-MAP` owns the three level states, and the
  condition on "More are coming."; `TN-PASSPORT` reuses both rather than inventing a second vocabulary;
  `TN-COPY-07` owns the waiting rule and `TN-WAIT` owns which level draws which sentence; `TN-DONE` owns what
  a finished level may claim; `TN-DIALOGUE` owns what a giver says at the three moments a step cannot cover;
  `TN-REACH` owns what the HUD says about anything in reach, including a place that offers a task;
  `TN-EXAMMENU` owns which menu an exam draws; **`TN-LEVELS` owns what `docs/content-review.md` §1 does and
  does not block**; `TN-SAVE`, `TN-CARD`, `TN-CREATOR`, `TN-TITLE` and `TN-HUD` name them and do not restate
  them.
- **Counts and state words follow `TN-COPY-strings-and-counts.md`**, not each screen's judgement. It has one
  rule for plurals in both languages, and it exists because "1 questions" is not a Study bug, it is a bug in
  every string with a number in it. Its rule 9 — one counted noun per template — came out of Exam mode, where
  one sentence tried to carry two.
- **A screen that is waiting says what it is doing, not how far along it is** (`TN-COPY-07`). No percentage,
  no step count, no ellipsis, no bar with a value, unless the game really knows both halves of the fraction —
  and in slice 1 it never does. The honest answer to a long wait is the escape route in `TN-LEVEL-02`.
- **A screen never describes a state it is not in.** This project has shipped that defect seven times: a boot
  screen that read as a stalled progress bar, a caption saying there was no level to play over a running
  level, a game whose only entrance was a URL parameter, a Halifax load that said it was getting the Rideau
  Canal ready, a completion card that says "Task done!" to a player who accepted no task, a group heading for
  a `coat` slot the rig has never had, and **a sentence promising more levels on a map that has all ten**.
  `TN-MAP-04` is the current form of the rule — a level nobody has built yet is described as unbuilt, not as
  locked and not as an error — `TN-PASSPORT-04` applies it to a stamp for a level that does not exist,
  `TN-WAIT-01` applies it to the words a level waits in, `TN-DONE-01` applies it to the heading of a finished
  level, `TN-LOOK-01` applies it to a group that cannot exist, and `TN-MAP-01` applies it to a promise that
  stopped being true **because the work finished**, which is the one direction nobody watches. **Four of the
  ten built levels declare no quest**, so that heading is still wrong on the only route those four have —
  and on the six with a quest it is still reachable by walking past the giver, which is why `OQ-DONE-1`
  records ADR-0029 as removing two instances' cause rather than fixing the defect.
- **Plain language**, roughly CLB 4 / grade 6. Short sentences. No jargon the player did not bring with them:
  the words *spaced repetition*, *FSRS*, *scheduler*, *due*, *card state* never appear on screen. **And no
  word this game teaches the player to read one way may be used on screen to mean another** — which is why
  level 8's horse is labelled "Horse" and not "Riding" (`TN-MOVE`), and why level 10's French waiting
  sentence is not « la grève », whose other meaning is a labour strike (`TN-NORTH`). It binds the creator
  too: "Tight curls" ships over "Coily" on a grade-6 argument, and `OQ-LOOK-2` records that the plainer word
  may simply be the worse one.
- **A game that teaches never marks the player down.** A wrong answer costs nothing (`TN-CARD`), a quest
  completes on a wrong answer (`TN-QUEST-04`), a player who reaches the end of a level having answered
  nothing is told so plainly and invited back rather than scored (`TN-DONE-02`), declining a quest is
  never made to feel like a mistake (`TN-DIALOGUE`), and a player who walks out of the creator without
  finishing is not told they did (`TN-FIRSTRUN-03`). No screen outside `TN-RESULT` reports a result, and none
  of them uses a grade, a star, a streak or a percentage. **Inside an exam this reaches the marks as well as
  the words**: a chosen option carries a neutral indicator and never a tick, because the exam promised no
  feedback until the end (`TN-EXAMMENU-06`). **And finishing the last level is not a result either**: the
  tenth stamp fills the passport and no screen congratulates the player on finishing the game
  (`TN-NORTH-05`). **Nor is the route a player took**: on the six levels with a quest, a player who reached
  the exit without accepting it is told nothing about it — not that they missed it, not that it is still
  there (`TN-DONE-02`).
- **One thumb, portrait.** Hold to move, tap to jump, tap an NPC or POI to engage. No scenario may need two
  hands, a pinch, a swipe, a drag or a double tap. This binds the map too: ten places east to west is a
  horizontal shape in a vertical window, and `TN-MAP` resolves it as a vertical list rather than a panned map
  (`OQ-MAP-2`). It binds the exam as well: twenty questions are reached with Previous and Next, never with a
  swipe. It binds the creator: five groups and nineteen options are reached by scrolling up and down, never
  by a carousel (`TN-CREATOR-02`). **And it binds the words**: no player-facing string names an input,
  because a sentence that says "tap" is wrong for a keyboard and for a switch (`TN-REACH`). **CLAUDE.md's own
  wording of that rule — "tap NPC or POI to engage" — is what ADR-0029 cited** when it widened who may offer
  a quest: the traversal contract had always named two kinds of engageable, and only one of them could hold
  one.
- **One timer, and it is optional.** Nothing on screen counts down, and no scenario may pass or fail on how
  fast the player acts — **except the exam clock**, which exists only inside a practice exam, only when the
  player turned it on for that attempt, pauses whenever they are not answering, and can be turned off
  mid-exam. `CLAUDE.md` allows exactly that one and `TN-TIMER` is where it is bounded; `TN-TIMER-07` is the
  check that stops it becoming a second one. Load timeouts are not player timers and are allowed to appear as
  an escape route from a stall. **A locomotion mode that drives itself is not a timer either**, and the
  Prairies is the first level with one (`OQ-PRAIRIE-5`). **Nor is a mode that keeps rolling**: Vancouver's
  board has the highest glide of any held mode, and `TN-VANCOUVER-03` requires a landmark rolled past to be
  reachable by turning round, at no cost.
- **A scenario must be able to fail.** If a step could be written today against an empty page and still pass,
  it is wrong. Waiting for a marker before asserting anything is the pattern (`tests/a11y/screens.spec.ts`
  already does this). **A scenario written for a field that does not exist yet is marked as pending and is
  not counted as coverage** — `TN-DIALOGUE-03` is the one instance, and it says so above its own fence.
  **And a scenario whose only input has been deleted is the same defect wearing a green tick**: `TN-MAP-04`
  and `TN-PASSPORT-04` now supply their own unbuilt level rather than relying on the shipped config to
  contain one, because all ten exist (ADR-0024).
- **A check that passes is not the same as a check that ran.** A lint rule that never executed, a scan rule
  that self-passed and a test that was skipped all report exactly what a clean run reports. Where a story
  leans on a tool's green tick, it also says how that tick can be made to go red — `TN-HUD-10` is the worked
  example, and it exists because `landmark-one-main` passed on a page with no `<main>` at all. `TN-LOOK-04`
  and `TN-SKIN-02` each carry their own negative control for the same reason. **The obligation gate is the
  newest instance and it failed the other way**: two ADR-0009 markers were written in `assets/style/`, which
  `scripts/check-obligations.mjs` does not scan, so both were text that looked exactly like a checked
  commitment and had no clock at all (`docs/content-review.md` §13).

## Depiction is acceptance too

`docs/content-review.md` governs how this game depicts people and places, and it changes what a story has to
contain. A story that puts a person or a place on screen carries these as scenarios, in the same file, on
the same footing as its accessibility and bilingual ones:

- **A "what is depicted" section, before the scenarios**, naming what the art agent is being asked to draw
  and — explicitly — what is *not* depicted. `TN-LEVEL-ottawa.md` does this for the officer,
  `TN-GUIDE-the-guide.md` for the beaver and `TN-LOOK` for the player's own character, which is the one case
  where the answer is a rule rather than a decision: the creator offers **nothing nation-specific**, and
  `docs/content-review.md` §3.4 says so as a rule and not as an open question. **`TN-PEGGYS` and `TN-NORTH`
  are the two files where the section is mostly about what is *not* there**: neither level draws a figure of
  any kind, at any scale, including a silhouette, and both say so as a decision rather than an omission.
- **A thing may speak, and speaking does not make it somebody.** ADR-0029 lets a point of interest offer a
  quest, so two levels have a giver, a dialogue and four moment lines with `characters: []`. What the stories
  carry is the boundary: no `expression` on a line whose speaker is a POI, no portrait, **second person and
  impersonal prose**, and the reason stated rather than left as style — a screen-reader user hears the
  dialog's accessible name and then the words, and first-person prose after "Peggy's Point Lighthouse" has
  told that user a person is standing there. On those two levels that is the figure prohibition arriving
  through the copy instead of the picture (`TN-PEGGYS-06`, `TN-NORTH-06`, `TN-LEVELS-02`).
- **No option is coupled to another.** Where the player picks how somebody looks, a scenario asserts that
  choosing any option in one group leaves every other group's option count unchanged
  (`docs/content-review.md` §8.2). This is the mechanically checkable half of "no caricature". `TN-LOOK-02`
  and `TN-SKIN-03` assert it from both directions, and `TN-LOOK-02` adds the arithmetic the rig contract
  already states: the product of the six option counts is 1 440 (480 before `presentation` opened on
  2026-09-14), and no combination is refused.
- **The randomiser is uniform.** Where a "surprise me" exists, a scenario asserts every option can come up
  (§8.3). A weighted default player is a statement made in code. `TN-LOOK-03` asserts it for the button and
  for the draw on open, and `TN-FIRSTRUN-02` asserts it for the character a player saves **without touching
  anything**, which is the draw that actually ships most often.
- **No French copy about the player requires gender agreement** (§8.6). FR scenarios assert the wording, and
  the wording never contains `(e)`, `·e` or a bracketed ending. This binds copy about *characters* too where
  a story fixes their name: see `OQ-LEVEL-8`, and `TN-LEVELS`'s NPC table, which chooses epicene French role
  nouns so that most levels never have to answer the question. **The guide is the one character
  for which the question cannot arise at all** — « guide » is epicene and the referent is an animal — and
  `TN-GUIDE` says so rather than leaving it to be re-derived. Level 8's rancher is the one that still needs
  it answered (`OQ-SPINE-4`); level 9's artist does not, because « l'artiste » is epicene; and **levels 2
  and 10 propose no role at all**, because neither draws a figure — **and since ADR-0029 that costs them
  nothing**, because a landmark gives their quests. **The creator is where the rule is easiest to break and
  hardest to see**: every French hair value agrees with « cheveux » and every French tone value agrees with
  « teint », never with the player, and `TN-LOOK-10` asserts both the agreement and the absence of a
  bracketed ending in one scenario so the two cannot be traded against each other.
- **A companion animal is a depiction like any other.** `TN-GUIDE` states that the beaver carries no
  clothing, regalia, pattern or cultural item of any kind, that `indigenous` is `false` for it and is
  required rather than inferred, and that its name is a role — because "truly Canadian" is exactly the brief
  under which a borrowed name would be reached for. **Level 8 brings a second animal**, the horse, and
  `OQ-ALBERTA-6` records that its tack is a depiction decision that must be written before it is drawn.
- **A nation's own name is identical in EN and FR** (§9.3). Where a story writes one, both columns match.
  Level 10 is the level where this reaches furthest: `Kwanlin Dün First Nation`, `Tagish Kwan` and
  `Chu Níikwän` are identical in both languages, diacritics included, and they appear in the level document
  and in no copy row.
- **Territory is stated, not performed.** Any level story includes the "About this place" panel: reachable
  from pause and from credits, never modal, never dismissed to reach gameplay, EN and FR, keyboard and
  single switch (§10.2). **And it is the only place a territorial statement is drawn** — `TN-WAIT`, the nine
  partial level files and `TN-DONE` keep it out of loading copy and off the completion card, because a
  screen the player waits past or taps through is the shape §10.2 names as the wrong one, and a compressed
  paraphrase of a cited statement is an unsourced claim. **All ten built levels now carry one, and none of
  them reaches a loading screen or a stamp.** **A quest dialogue is the newest shape that is not the panel**,
  and the two levels whose landmarks speak decide it explicitly rather than by omission: a plaque is exactly
  the object that would carry a land acknowledgement at a real site, and §10.2 rules out anything tapped
  past, a quest can be **declined**, and a nation's own words may not share a register with a chapter
  paraphrase. Four of the ten carry something a copy row could break in a new way, and all four are written
  down: level 8's statement is silent about the Métis Nation of Alberta because neither cited body speaks for
  them, and **copy may not resolve that silence**; level 9's names three nations from two documents,
  deliberately refuses to narrow to one, and deliberately omits the word "unceded" because the cited page
  does not use it, and **copy may not restore it**; level 2's omits "unceded" for the same reason and **does
  not use the word "Mi'kma'ki" at all**, because no source that level cites carries it; and level 10's is
  silent about the Ta'an Kwäch'än Council, and **no row and no quest line resolves that in either
  direction**.
- **No copy may imply a cultural review that has not happened.** Tier 3 does not exist
  (`docs/content-review.md` §1), two levels carry dated obligations naming what a reviewer still owes
  (§13), and a warm word in a credit line is the cheapest possible way to claim a consent nobody gave. No
  string in this game, in either language, contains "reviewed", "approved", "endorsed", "in partnership
  with", "with the support of", « en partenariat » or « avec le soutien », and no screen renders a
  `communityReview` status. `TN-PEGGYS-06`, `TN-NORTH-06` and `TN-LEVELS-02` assert it, **including on a
  quest's lines**, because a quest document is a place a warm sentence could land that no copy table covers.
- **A blocked level is not scoped — and the rule survived its own worked examples being released.**
  `TN-LEVELS` left levels 2 and 10 with no place, no landmark, no NPC and no id for four sessions, because
  filling those cells in would have made a blocked level look schedulable, and a plan that reads as
  schedulable gets scheduled. **Both have now shipped, and not by relaxing the rule**: §1 blocks a level
  whose *subject* is a nation's territory or history, and neither of these levels is that. **ADR-0029 did not
  relax it either** — it refused, by name, weakening the figure prohibition for a single small NPC or a
  distant silhouette, and widened what may hold a quest instead. The rule still keeps `canoe` and `dogsled`
  out of `TN-MOVE`'s table — `OQ-REVIEW-10` is unanswered, and with all ten levels built **no document
  declares either mode**, so the table will never be the thing that forces the question (`OQ-MOVE-6`). It
  still keeps a hijab, a dastaar, a patka, a kippah and a tichel out of `TN-LOOK`'s head-covering table:
  §8.7 requires each to cite a documented tying style, none is drawn, and **a copy row for an option nobody
  has drawn is the same defect as a scoped blocked level** (`OQ-LOOK-4`).
- **A real building may be named; a business may not be advertised.** `TN-NAMES` is the rule and it is
  checkable: the name is text and never lettering in the art, it appears in the point-of-interest card's body
  **and in a quest's own words about going there**, it carries no mark, and no sentence implies the place has
  anything to do with this game. `TN-NAMES-01` names a loading message among the screens a name may not
  appear on, which is why no level's waiting sentence names Pier 21, the CN Tower, the Château Frontenac, the
  Canadian Museum for Human Rights, Canada Place or Peggy's Point Lighthouse — and `TN-REACH` is why the
  HUD's *prompt* does not either. **ADR-0029 adds one surface and the two level stories bound it**: a
  landmark that gives a quest has its name read as the dialog's accessible name, because a line with no
  attributable source is a line a live region cannot attribute — two surfaces, not one, and neither of them
  the HUD. **A landmark on `TN-NAMES`'s list that gave a quest would put a trade name in that position**, and
  that case has not arisen (`OQ-SPINE-5`). **Three of the ten landmarks have no name to keep off a screen**:
  a prairie grain elevator, a working ranch and a Yukon River sternwheeler are named as **types**, twice
  because the real building's name is painted on it and `make verify-art` refuses a text element
  (`OQ-NAMES-6`, `OQ-SPINE-6`).

What a story must **not** do: assert that a depiction is approved. No scenario may encode a cultural
sign-off, because no agent may grant one (`docs/content-review.md` §1). A story states what is on screen;
whether it may be on screen at all is that document's shipping rule, not a test. **`TN-SKIN` is the file
most likely to be misread on this point**, so it says it twice: it rules on wording, its scenarios check
presence, absence and a measurement, and nothing in it means the names are right.

## French style

- Vouvoiement (« vous »), to match IRCC's own French. See `OQ-STYLE-1` in `TN-SET-settings.md`.
- Canadian French typography: **no** space before `?` and `!`; a space before `:`. Guillemets « » with a
  space inside.
- FR copy is a translation of meaning, never of word order. It is held to the same grade-6 bar as EN, and it
  may take a different shape from the English where the English shape is what breaks it: `study.summary.score`
  is a sentence in English and a label in French, and `TN-STUDY` says why. `title.lastPlayed` is a label in
  both, because a sentence would need a preposition in front of a place name and French does not use one
  preposition for all ten places — and `TN-WAIT` applies the same fact to the error title, which is written
  out per level rather than templated because « charger Halifax » takes no article, « charger la Ville de
  Québec » takes one, « charger les Prairies » takes a plural one and « charger le Nord » takes a masculine
  singular one. **`TN-DONE` applies it twice more**: « le tampon d'Halifax », « le tampon de Peggy's Cove »,
  « le tampon de la Ville de Québec », « le tampon de Toronto », « le tampon de Winnipeg », « le tampon des
  Prairies », « le tampon des contreforts de l'Alberta », « le tampon de Vancouver », « le tampon du Nord »;
  and « Jouer à Halifax » against « Jouer dans la Ville de Québec », « Jouer dans les Prairies », « Jouer
  dans les contreforts de l'Alberta » and « Jouer dans le Nord ». Ten rows, **five** French shapes after
  « tampon » and **four** after « Jouer » — and, since the Prairies, **two English shapes as well**, which is
  the evidence that this was never a French problem but a template one.
- **Levels 8 and 9 added no fifth French shape and level 10 did, which is the finding rather than the
  disappointment either way.** Vancouver takes « de », which Toronto already had; the foothills take
  « des », which the Prairies already had; Peggy's Cove takes « de » too. **The North takes « du »** — *de +
  le* contracting — which nothing in this game had needed, on the last level, after four levels in a row had
  added nothing. What level 8 added was **two prepositional forms inside one row**, « le tampon **des**
  contreforts **de l'**Alberta », because a form depends on the words after it; what level 10 added is the
  form itself, on the row a template would have reached last.
- **Three titles carry a capital article that must go down mid-sentence, and French does not treat them
  alike.** "The Prairies", "The Alberta foothills" and "The North" are all "the …" inside a sentence.
  « Les contreforts de l'Alberta » becomes « les contreforts de l'Alberta » — article and noun both in lower
  case — and **« Le Nord » becomes « le Nord », with the capital N kept**, because « le nord » in lower case
  is a compass direction. A template taught to lower-case the first word of a title would produce a level
  set in a direction (`TN-NORTH-02`, `TN-NORTH-04`).
- **A French common noun can be another level's name, and a French common noun can have a second meaning.**
  « La prairie » is the plainest French word for open grassland and it is level 7's **title**, so level 8's
  waiting sentence is « Préparation du pâturage. » « La grève » is the exact Quebec French noun for a gravel
  shore and its other meaning is a labour strike, so level 10's is « Préparation de la plage de galets. »
  `TN-WAIT`'s fourth loading rule and `OQ-WAIT-4` come from the first, and the check they ask for is
  mechanical: every waiting sentence compared against every level title, in both languages. **All ten
  sentences and all ten titles now exist**, which is the cheapest moment there will ever be to write that
  comparison (`OQ-NORTH-4`).
- **The creator's tables are the first place a French value must agree with a noun in its own label.**
  `TN-LOOK` writes them out: hair adjectives are masculine **plural** because they agree with « cheveux »
  (« Courts », « Longs », « Noirs », « Bruns », « Blonds »), red hair is « Roux » and never « Rouges »,
  « Gris » already carries its plural, and skin-tone band words are masculine **singular** because they agree
  with « teint » (« clair », « moyen », « foncé »). None of them ever agrees with the player, which is what
  keeps `docs/content-review.md` §8.6 satisfied while the strings inflect at all. Level 2's « la roche nue »
  is the same shape on a level: the adjective agrees with the rock, never with anybody reading it.
- **The creator also produced the first row where the *English* carries a gendered form.** "Blonde" is the
  feminine spelling and would gender a player the game never asks about; the value is "Blond". Recorded
  because every earlier instance of this rule pointed the other way.
- Numbers are formatted for the locale, never concatenated: « 0,6 », « 150 % » with a space.
  `TN-COPY-strings-and-counts.md` says why this is a rule and not a preference.
- A passport stamp is **« un tampon »**, never « un timbre ». `TN-PASSPORT` settles it and lists the four
  strings that changed.
- **A row whose two languages are the same word is written twice, not shared.** `locomotion.train.label` is
  "Train" and « Train »; `exam.menu` is "Menu" and « Menu »; `level.peggys-cove.title` is "Peggy's Cove" and
  « Peggy's Cove », with the same apostrophe character in both, which the Canadian Geographical Names
  Database drops and *Discover Canada* keeps. `TN-MOVE-06`, `TN-EXAMMENU-05` and `TN-PEGGYS-04` assert both
  values exist, so a missing French value fails even though the screen would read correctly. **And a row
  whose two languages differ by one letter is written out for the opposite reason**: "Toque" against
  « Tuque » is not a typo, both spellings are current in Canada in their own language, and `TN-LOOK-10`
  asserts both so that nobody silently corrects one into the other.

## Shared test vocabulary

These are contracts. A story references a `data-testid` or an event name; the agent that builds the thing
provides it.

### Words these stories use precisely

| Word | Means |
|---|---|
| **a sitting** | One run of the page: from opening the game to closing the tab. What the game remembers only for a sitting is listed in `TN-SAVE`'s "does not survive" table. `TN-RESUME` defines the term and owns what depends on it. |
| **ready to come back** | The scheduler would offer this question now. Never said on screen — the player sees only "New" or "Seen before". |
| **open / locked / not made yet** | The three states a level can be in on the map. `TN-MAP` owns the rule that decides which, and the rule that "not made yet" wins over both other states. **No level is in the third state today**, and the rule stays, because it is about what a build contains and not about what this plan contains. |
| **earned / not earned yet / not made yet** | The three states a stamp can be in on the passport. `TN-PASSPORT` owns them, reuses `TN-MAP`'s third word and its key, and states the one place the precedence differs: an earned stamp stays earned even when the level is gone. |
| **a built level** | A level with a document under `content/levels/`. **Ten today** — `halifax`, `peggys-cove`, `quebec-city`, `ottawa`, `toronto`, `winnipeg`, `prairie-rail`, `alberta-foothills`, `vancouver`, `the-north` — and each one owns a waiting sentence, an error title, a stamp sentence and a play label (`TN-WAIT`, `TN-DONE`). **Six of the ten have a quest; four do not.** **Built is not shippable**: level 8's subject bank holds eighteen verified questions against `CLAUDE.md`'s floor of thirty, and it is in `unlockRules.order` anyway (`OQ-ALBERTA-2`). It is the only one of the ten in that state. |
| **an engageable** | A thing the player can tap, which `CLAUDE.md`'s traversal rule names as two kinds: an NPC or a point of interest. Since ADR-0029 it is also what may **offer a quest**, which is why `giver` names a thing the level places rather than a character. `TN-REACH` owns what the HUD says about one; the level document owns which list it is in. |
| **finishing a level** | Either completing its task or reaching the end of it. Both earn the stamp and both draw the completion card, and every sentence on that card has to be true of the second (`TN-DONE`). On the six levels with a quest, both routes are reachable and only the heading differs. |
| **an attempt** | One run at the exam: the twenty questions it drew, the answers given, whether it was timed, and — once it has finished — whether it passed. At most one attempt is unfinished at a time (`TN-ATTEMPT-04`). |
| **a slot** | One runtime-swappable part of a character's appearance, named by `content/characters/rig.json` and identical in the Rive file and the sprite atlas. Five are player-selectable: `skin`, `hairShape`, `hairColour`, `headCovering`, `feature`. `costume` is a slot and is **not** one of them. `TN-LOOK` owns their labels. |
| **a first run** | A sitting in which the save carries **no character**. Not an empty save, not a save with no level played. `TN-FIRSTRUN` owns the term and the table of what each control is drawn for. |

### DOM markers

| `data-testid` | What it marks |
|---|---|
| `playable` | The level is loaded and accepts input. Already used by `tests/perf` and `tests/a11y`. |
| `level-loading`, `level-error` | Load in progress; load failed. `level-loading` carries the level's own `level.<id>.loading` (`TN-WAIT-01`). |
| `scene-state` | The E2E scene probe — see below. |
| `title-screen`, `title-play`, `title-continue`, `title-choose-level`, `title-study`, `title-exam`, `title-settings` | The title screen (`TN-TITLE`). `title-play` and `title-continue` are never both present, and which one is drawn is decided by whether the save has a character (`TN-FIRSTRUN-01`). `title-exam` is the exam's way in and changes its label when an exam is unfinished (`TN-ATTEMPT-03`). |
| `level-select`, `level-card-<id>` | The level select (`TN-MAP`). Each card reports `data-state` as `open`, `locked` or `not-built`. |
| `hud`, `hud-quest-tracker`, `hud-mode-label`, `menu-button` | The lower-third HUD (`TN-HUD`). `hud` is a region named by `hud.label`; `hud-mode-label` carries the mode label `TN-MOVE` owns and is never empty; `hud-quest-tracker` carries the current step's own prompt, which is the one HUD string allowed to name a real place (`TN-NAMES-01`). |
| `menu` | The menu opened from `menu-button` (`TN-HUD-02`). It carries Settings, Study, the passport and "Leave the level". **It is never present during an exam** (`TN-EXAMMENU-02`). |
| `move-left`, `move-right`, `turn-around` | The hold-to-move controls (see `OQ-INPUT-1`). |
| `interact-prompt`, `interact-hint` | What is in reach and what pressing it will do (`TN-REACH`). The prompt is a verb phrase and never a landmark's name; `interact-hint` is the one-time explanation of the marks, is never in the tab order or the switch ring, and blocks nothing. |
| `character-creator`, `character-preview`, `randomise-character`, `start-playing`, `creator-done`, `creator-back`, `creator-settings`, `creator-save-error`, `creator-retry`, `creator-continue`, `creator-option-gone` | The character creator (`TN-CREATOR`, `TN-FIRSTRUN`). `start-playing` and `creator-done` are never both present: the first is drawn on a first run and the second when the screen was opened from Settings. `character-preview` is named by `creator.preview.label` and reports `data-skin`, `data-hair-shape`, `data-hair-colour`, `data-head-covering` and `data-feature`. |
| `slot-skin`, `slot-hair-shape`, `slot-hair-colour`, `slot-head-covering`, `slot-feature`, `slot-presentation` | The creator's six groups, in that order, one per player-selectable slot in `content/characters/rig.json` (`TN-LOOK-01`). Each has role `radiogroup`. **There is no `slot-hair` and no `slot-coat`**: the rig splits hair into two slots on purpose and has no `coat` slot at all. Every option inside a group reports `data-slot`, `data-option` and `data-chosen`, which is what makes the slot-independence check writable without nineteen ids (`TN-LOOK-02`). |
| `dialogue`, `dialogue-speaker`, `dialogue-text`, `dialogue-accept`, `dialogue-decline`, `dialogue-next` | NPC dialogue. `dialogue-speaker` carries the giver's name — a character's, or a point of interest's from the level document (ADR-0029 §6) — and is the dialog's accessible name (`TN-QUEST-08`, `TN-GUIDE-05`). A dialog that cannot be named is refused rather than opened. |
| `poi-card`, `poi-card-close` | Landmark information card. One of the two places a name on `TN-NAMES`'s list may appear. |
| `about-this-place`, `about-this-place-open`, `about-this-place-close` | The territorial statement panel (`docs/content-review.md` §10.2). Ten levels carry one and it is the only screen that draws one — not a quest dialogue, on any level. |
| `question-card`, `question-kind`, `question-progress`, `question-prompt`, `option-0`…`option-3`, `question-feedback`, `question-explanation`, `question-next`, `question-close`, `question-closed-notice` | The question card. In an exam, `question-kind`, `question-feedback` and `question-explanation` are absent (`TN-EXAM-03`). |
| `quest-complete-card`, `quest-complete-stamp`, `quest-complete-progress`, `quest-complete-next`, `quest-complete-next-level`, `quest-complete-map`, `quest-complete-keep-playing` | Finishing a level (`TN-QUEST-04`, `TN-DONE`). `quest-complete-progress` carries whichever of `level.complete.score` and `level.complete.none` applies and is never both; `quest-complete-next` exists only while there is a level to open, which on level 10 means never (`TN-NORTH-05`). |
| `passport`, `passport-open`, `passport-empty`, `passport-exam`, `stamp-<levelId>` | The passport (`TN-PASSPORT`). Each slot reports `data-state` as `earned`, `not-earned` or `not-built`. `stamp-ottawa` is the slice-1 instance. |
| `study-screen`, `study-count`, `study-start`, `study-empty`, `study-empty-title`, `study-practise-new`, `study-error`, `study-retry`, `study-left-notice`, `study-summary`, `study-summary-score`, `study-summary-returning`, `study-again`, `study-exit` | Study mode. |
| `exam-start`, `exam-begin`, `exam-timer-toggle`, `exam-not-ready` | The exam's start screen (`TN-EXAM-01`, `TN-TIMER-01`). |
| `exam-screen`, `exam-progress`, `exam-previous`, `exam-next`, `exam-finish`, `exam-clock`, `exam-unanswered` | A running exam (`TN-EXAM-03`, `TN-TIMER-02`). |
| `exam-menu-button`, `exam-menu` | The exam's own menu (`TN-EXAMMENU`). Deliberately not `menu-button` and `menu`: a test that cannot tell the two menus apart is a test that would have passed while the exam drew the level's. |
| `exam-result`, `exam-result-score`, `exam-result-by-subject`, `subject-row-<id>`, `exam-review`, `exam-again` | The result and its review (`TN-RESULT`). `exam-result` is named by `exam.result.title`, which is not drawn as a visible line (`TN-EXAMMENU`, ruling 3). |
| `exam-resume` | The screen an unfinished exam is picked up from (`TN-ATTEMPT-03`). |
| `settings-screen`, `settings-close`, `setting-character`, `setting-language`, `setting-auto-move`, `setting-single-switch`, `setting-hold-time`, `setting-reduced-motion`, `setting-high-contrast`, `setting-dyslexia-font`, `setting-text-size`, `setting-text-size-value`, `setting-subtitles`, `setting-sound` | Settings. `setting-character` re-opens the creator (`TN-FIRSTRUN-04`) and is absent while the screen behind Settings *is* the creator (`TN-CREATOR-11`). `setting-sound` is present only when a sound ships (`TN-SET-01`). |
| `storage-warning`, `save-error`, `save-export`, `save-import`, `save-import-error` | Persistence. `storage-warning` is owned by `TN-HUD-03` and appears on the title screen too (`OQ-HUD-3`). |

### The scene probe

The Phaser canvas is `aria-hidden` and Playwright cannot read it. So that camera and locomotion scenarios
can fail, the game exposes one element, `data-testid="scene-state"`, refreshed at most ten times a second
and present **only** when the page is opened with `?e2e=1`:

`data-level`, `data-mode`, `data-paused`, `data-player-x`, `data-player-y`, `data-speed`, `data-facing`,
`data-grounded`, `data-camera-x`, `data-parallax-easing` (`on`/`off`), `data-particles` (a count),
`data-character-mode` (the locomotion mode the character is actually rigged for),
`data-pose` (the animation state that mode selects), `data-mode-gaps` (a count, `0` on a healthy
level), and `data-rides` / `data-rides-drawn` (whether the mode the player moves by has a ride, and
whether its art drew: `0`/`0` or `1`/`1` on a healthy level), and `data-parts-interleaved` (a count of
drawn things that sit, by depth, between the first and last part of a character they are not part of: `0`
on a healthy level).

`data-character-mode`, `data-pose` and `data-mode-gaps` exist because the HUD named a mode the
character did not play: every level animated walking whatever the mode was. `data-character-mode` is
what the rig was asked for rather than what the level declared, so the two can be compared, and
`data-mode-gaps` counts the modes whose art has not landed -- a level drawing a walking figure under a
label that says Skating must say so rather than look correct.

`data-rides` and `data-rides-drawn` exist because the same defect had a second half on the Prairies: a
player reported the figure "walks by itself on a track". A train is a ride, not rig equipment
(ADR-0031), and a ride whose art never drew would seat the rider in mid-air while the level still
reached `ready`, so the pair must read equal.

`data-parts-interleaved` exists because a rider on Toronto drew scrambled while every counter read full
marks: nothing was missing. The guide drew its parts at depths `500 + z` and the player at `501 + z`, so
wherever the player stopped on the guide the two puppets were shuffled together. It is read off the
scene's display list when the level is ready, not restated from `depth-plan.ts`, so a depth set anywhere
in the scene is counted.

It carries no player-facing text, so it is invisible to axe and to a screen reader. See `OQ-TEST-1`.
It is absent during an exam, because an exam is not a level (`TN-EXAM-01`).

### Event names

Proposed by these stories, fixed by the use cases that emit them (task 1.5). `level/ready`, `player/moved`,
`quest/step-completed` and `question/answered` are already named in `docs/architecture.md`.

`title/opened` · `map/opened` · `level/chosen` · `level/left` · `level/ready` · `level/failed` ·
`level/exitReached` · `level/completed` · `player/moved` · `player/jumped` · `player/stopped` ·
`player/braked` · `poi/entered` · `poi/left` · `poi/engaged` · `npc/engaged` · `dialogue/opened` ·
`dialogue/closed` · `quest/offered` · `quest/accepted` · `quest/declined` · `quest/step-completed` ·
`quest/completed` · `stamp/earned` · `question/asked` · `question/answered` · `question/dismissed` ·
`study/started` · `study/finished` · `character/created` · `character/changed` · `settings/changed` ·
`locale/changed` · `progress/saved` · `progress/save-failed` · `progress/loaded` · `passport/opened` ·
`exam/started` · `exam/answered` · `exam/left` · `exam/resumed` · `exam/discarded` · `exam/time-up` ·
`exam/finished`.

Four of them were new with `TN-FLOW`, eight with Exam mode and the passport, and one with `TN-FIRSTRUN`; all
are covered by `OQ-EVENT-1` like the rest. **`level/exitReached` and `level/completed` are not proposals** —
the scene already publishes both, and they are two different things on purpose: reaching the end is a
*position* the world reports, and completing the level is what the domain decides that position is worth
(`TN-DONE`). **`poi/engaged` and `npc/engaged` stay two events after ADR-0029**, because what was engaged is
still two different things even when both may now offer a quest — the dialogue that follows is the same
screen, and the event that opened it is not. **`character/created` and `character/changed` are two names for
the same shape of payload**, and that is deliberate too: the first is what makes a player exist and what the
first-run route waits on, the second is what Settings emits, and a listener that re-runs the route must never
see the second (`TN-FIRSTRUN-04`, `OQ-FIRSTRUN-3`). **An exam does not emit `question/asked` or
`question/answered`**, so nothing that counts a quest step can be advanced by an exam (`TN-RESULT-05`).
**Opening the exam's menu emits nothing**, and `TN-EXAMMENU-02` requires that no item on it emits
`exam/finished`.

### The single-switch contract

CLAUDE.md says single-switch mode is "tap anywhere advances". With one contact and no countdown allowed,
these stories use:

- a **short press anywhere** moves the highlight to the next item and wraps at the end;
- a **long press** (contact held past the threshold the player sets in "Hold time", `TN-SET-09`) chooses the
  highlighted item;
- nothing scans on its own, nothing expires, and the player may take as long as they like.

Every story proves that its whole flow is completable with those two gestures alone, and `TN-FLOW-07` proves
the *route between* them is too — which is the case a per-screen proof cannot reach. See `OQ-SWITCH-1`.

**The creator is the screen with the most items in its ring**, and the answer is not a shortcut: `TN-LOOK-07`
requires the ring to reach every one of the nineteen options and to wrap once, and `TN-FIRSTRUN-06` requires
"Start playing" to be reachable **without choosing anything**, in no more presses than there are items. A
skip control would have sat in the same ring and saved nobody anything, which is one of the four reasons
`TN-FIRSTRUN` refuses one.

**The "no countdown" half of that contract is structural, not promised.** Task 1.15 classified a press *on
release*, from two timestamps, and `tests/unit/ui/single-switch.test.ts` greps `app/ui/single-switch.ts` for
`setTimeout`, `setInterval`, `requestAnimationFrame` and `requestIdleCallback` and fails if any appears. An
auto-scanning implementation cannot be written without one of them, so the rule cannot regress quietly into
a timer the player can lose to. That is the standard this directory wants everywhere: prove the property by
what the code cannot contain, not by waiting two minutes and asserting nothing happened.

**Exam mode introduces the one countdown this game has, and it does not weaken that guard.**
`TN-TIMER-07` keeps the grep on `single-switch.ts`, requires exactly one module to drive a countdown, and
requires that no screen outside a running timed exam imports it — with a fixture that introduces a second one
and is asserted to fail. The clock also never moves the highlight and is never in the ring
(`TN-TIMER-08`), and it is **paused whenever the exam's menu is open** (`TN-EXAMMENU-01`).

The threshold itself is a player setting, not a constant. `TN-SET-09` draws it as four named values rather
than a slider, and requires the hold-time control to accept the *shorter* of the default and the current
threshold — so the one control that changes what a long press means can never be locked behind a long press
the player cannot make.

## What the a11y suite proves, and what it does not

`tests/a11y` mounts each DOM screen in a harness and runs axe-core against it, and — since `TN-HUD` shipped —
also assembles them into one page and scans that. A hundred and twenty-two passing checks mean **the
components are accessible in isolation, and the harness's assembled page is accessible with no rule turned
off**. They do not mean the shipped page is accessible, and nobody should read them that way, because the
screens are only partly routed through `app/bootstrap`: the title screen and the map are on the shipped page
and scanned there, and every other screen is still a component in a harness. A component that passes a
harness can still be mounted twice, mounted inside an `aria-hidden` subtree, or never mounted at all.

The claim is honest and it is narrow, so it is written down rather than left to be inferred from a green
tick. Task 1.20 closed the first half of the gap — `app/bootstrap` routes the title screen and the map, and
`tests/a11y/shell.spec.ts` scans `dist/` through them — and left the second half open: the level, the modals
over it, and Exam mode are still only scanned through the harness. See `OQ-TEST-2`. `TN-FLOW-08` is where that closure becomes acceptance: it requires the scan
to run at each screen of the route **against the built output**. Exam mode adds four screens to scan
(`TN-EXAM-08`, `TN-RESULT-10`) and a fifth with `TN-EXAMMENU-04`'s menu, the passport one
(`TN-PASSPORT-09`), the completion card one (`TN-DONE-07`) and the "About this place" panel every one of the
ten levels carries; none of them is covered by anything that exists today. **The creator is the sharpest
case of all of them**: it passes the harness scan and no player has ever seen it, because nothing under
`app/bootstrap` mounts it — `TN-FIRSTRUN-07`'s last scenario is what turns that into acceptance rather than
a note.

**The waiting screen is the second sharpest case of a component nothing mounts.** `createLevelLoading` is
constructed by the harness and by the unit suite and by nothing under `app/bootstrap`, so it passes every
scan and no player has ever seen it (`OQ-WAIT-1`). A screen that is accessible and unreachable is not a
screen. **Ten levels now ship a waiting sentence nobody can read**, which is the same debt at ten times the
size — and it has stopped growing, because there is no eleventh level. **Two quests are now in the same
state for a different reason**: they validate, pass every gate and cannot be opened, because
`app/bootstrap/quest.ts` cannot yet name a landmark giver (ADR-0029's engine obligation, `OQ-PEGGYS-6`,
`OQ-NORTH-6`).

The scans do fail when something is wrong, which is the only reason to keep them. Two real defects were
found by axe in task 1.15's own code before it went green: an empty unnamed button, caused by a CSS rule
overriding `[hidden]`, and `color-contrast` returning *incomplete* on symbol-only nodes. Neither was
visible by reading the code.

### The two axe rules that were disabled, and are not any more

`region` and `landmark-one-main` were disabled in the a11y spec, with the reason written beside them: a
single modal over an `aria-hidden` canvas has no document landmarks, and inventing a `<main>` to satisfy a
scanner is not accessibility. That reason expired the moment `TN-HUD` built the page those rules describe —
one `<main>`, a named `hud` region, real content outside the modals — and `TN-HUD-07` required both rules
back on for the whole-page scan. They are on, and that scan disables nothing at all.

**Being enabled is not the same as being enforced.** `landmark-one-main` self-passed on this page even with
`<main>` removed: the `<section aria-label>` on the HUD kept the content inside a landmark, and axe's
`passForModal` heuristic read the full-bleed `#game` div as a modal. The negative control had to unwrap
`<main>` *and* strip the region's label before the rule would fire. So the green tick carries two guards —
the rule ids are asserted to appear in the results, because a rule that never ran also reports no violations,
and the negative control is asserted to fail — and `TN-HUD-10` is the story that keeps them there. Nobody
simplifies a guard away on the grounds that the scan is green; the scan being green is what is being checked.

Any further rule this project disables carries its reason in the file **and** a line here, naming the
condition under which it goes back on. A suppression with no expiry is a lowered bar with a comment.

## Open questions

Every file ends with its own. They are questions, not decisions — no scenario in these files depends on an
answer nobody has given. Cross-cutting ones live here.

- **`OQ-INPUT-1` — where does the player hold to move?** A virtual pad in the lower third, or the left and
  right halves of the play area? The stories only require the two controls to exist and be addressable as
  `move-left` and `move-right`, with a hit area of at least 44 CSS px. *Recommendation:* left/right halves of
  the lower third, with a visible but unobtrusive hint, so nothing covers the playfield.
- **`OQ-TEST-1` — is the scene probe acceptable?** Camera and momentum cannot otherwise be asserted from
  Playwright. *Recommendation:* yes, gated behind `?e2e=1` and stripped from production builds; the
  alternative is screenshot diffing, which fails for the wrong reasons.
- **`OQ-TEST-2` — when is the *page* scanned, rather than the components?** **Answered 2026-09-08, in
  part.** Task 1.20 routed the screens: `app/bootstrap/main.ts` calls `createShell`, and the last test in
  `tests/a11y/shell.spec.ts` scans `dist/` — the artefact GitHub Pages serves — through the door a visitor
  opens, with `region` and `landmark-one-main` on and nothing disabled. It asserts the premise first, so it
  cannot pass against an empty page. The three scans now answer three different questions and none replaces
  another: per-component, the harness's assembled page in states the shipped config cannot reach, and the
  built output as loaded.
  **What is still open is the rest of the route.** The built-output scan covers the title screen and the map;
  the creator, the level with its HUD, a modal open over it, the "About this place" panel, and every screen
  of Exam mode and the passport are still scanned only through the harness. `TN-FLOW-08` states the whole
  route as acceptance and `TN-FIRSTRUN-07` states the first-run leg of it, and neither is discharged until
  each of those is scanned against `dist/` too. Reports may now say the a11y suite proves the shipped **front
  door**; they may not yet say it proves the shipped game.
- **`OQ-TEST-3` — can a test move the clock?** Several scenarios in `TN-RESUME` say "an hour has passed",
  because what the scheduler offers depends on time and nothing else can express that, and every scenario in
  `TN-TIMER-03` and `TN-TIMER-05` says "five minutes pass" for the same reason. If the time those two read is
  not a port with a fake, those scenarios can only be written as sleeps, which is how a suite becomes flaky
  and then becomes ignored. *Recommendation:* one clock port, injected like every other adapter, read by both
  the scheduler and the exam; the stories keep saying "an hour has passed" and never name the fake. See
  `OQ-RESUME-1` and `OQ-TIMER-3`. **Two sources of time is how a paused clock quietly stops being paused.**
- **`OQ-TEST-4` — where does a seeded draw come from?** `TN-LOOK-03`, `TN-SKIN-01` and `TN-FIRSTRUN-02` all
  say "1000 seeded draws", because uniformity is the only way to check that no appearance is the default and
  `docs/content-review.md` §8.3 asks for exactly that check. If the randomiser reads `Math.random` directly,
  none of those scenarios can be written. *Recommendation:* one randomness port, injected like the clock,
  read by the creator and by the save-recovery path in `TN-LOOK-05`; the stories keep saying "seeded" and
  never name the fake. Same shape and same owner as `OQ-TEST-3`.
- **`OQ-SWITCH-1` — short press / long press, or something else?** *Recommendation:* as described above; it
  needs no timer the player can lose to, which auto-scanning does. Task 1.15 implemented it with no
  scheduling primitive at all, which is the strongest form of that argument, and `TN-TIMER-07` keeps that
  true now that the game contains a clock.
- **`OQ-EVENT-1` — do these event names match what task 1.5 emits?** They are the PO's proposal. If the use
  cases pick other names, the stories are updated, not the tests quietly.
- **`OQ-SCHEMA-1` — three schema changes are queued against `content/`, and they are cheaper opened
  together.** `OQ-WAIT-2` wants a level document to carry its own waiting sentence and error title;
  `TN-DIALOGUE` wants a quest document to carry `declinedLine`, `reminderLine`, `afterLine` and `doneLine`;
  and `OQ-VANCOUVER-4` wants a level document to be able to carry **more than one `nationSource`**, because
  level 9's three-nation statement rests on two documents and only one can be registered. All three move a
  string or a citation into the document it belongs to, all three keep the gate that fails a build for a
  missing one, and all three are blocked on nothing but an owner. *Recommendation:* route them as one change
  to the architect, with `TN-WAIT-03`, `TN-DIALOGUE-03` and `TN-VANCOUVER-01` as their acceptance. Neither
  directory file writes a row until the field exists. **The third has a second instance now**: level 10's
  statement rests on **three passages of one page** and a `FactSource` carries one quote, so two of the three
  are registered in `content/sources/kdfn-about-us.json` rather than quoted (`OQ-NORTH-2`). Two levels asking
  the same question is usually one question. **A fourth landed without waiting for this one**: ADR-0029
  widened `giver` and `speaker` in the same pass, which is the shape this recommendation asks for — one
  change, one gate, one commit.
- **`OQ-CHARDOC-1` — there is no player character document, only a rig contract.**
  `content/characters/rig.json` is the rig, and `content/schemas/character.schema.json` describes a
  *character* with `slots[]`, each slot carrying a `labelKey` and each option carrying a `labelKey` — which
  is exactly the shape `TN-LOOK` and `TN-SKIN` write the values for. No such document exists, so nothing
  today binds a key to a slot. *Recommendation:* `content/characters/player.json`, authored against that
  schema, with the five player-selectable slots, nineteen options and the keys spelled as `TN-LOOK`'s rule
  spells them, `indigenous: false` and no `nation` (`docs/content-review.md` §3.4). Until it exists,
  `TN-LOOK-04`'s gate has to read the rig instead, which works and is one indirection further from the thing
  the creator actually renders. Routed to the architect and the content author; `content/` is not this
  directory's to edit.
- **`OQ-SUBJECTS-1` — nothing declares the ten subjects, and three screens need them.**
  `exam.subjectsReady` counts "1 of 10" (`TN-EXAM-01`), the result names a subject with the level's own
  subject line (`TN-RESULT-03`), and the passport counts ten stamps (`TN-PASSPORT-01`) — and the only list of
  ten in `content/` is `unlockRules.order`, which is a list of **level** ids. **Answered further,
  2026-09-13:** `content/game.config.json` now carries ten ids in `levels`, ten in `unlockRules.order` and a
  ten-slot `journey` with **no nulls**, all matching `TN-LEVELS`, and `content/questions/` holds **ten**
  subject directories — `regions` was the last one missing and now has fifty-eight verified questions. So the
  data agrees about which ten levels and which ten subjects exist. What is **still** missing is a document
  that *declares* the subjects and binds each to a level: they exist only as directory names and as a
  `subject` field on each level document. *Recommendation:* declare the ten subjects once in
  `game.config.json`, each with its id and the level it belongs to. Routed to the architect and the plan
  owner; `content/` is not this directory's to edit. Recorded per screen as `OQ-EXAM-5`, `OQ-RESULT-2` and
  `OQ-PASSPORT-2`, because three screens finding the same gap is usually one gap.
- ~~**`OQ-SUBJECT-1` — Level 4's subject is not written down anywhere, and two levels share one bank.**~~
  **Answered, in both halves, and the counts are current as of 2026-09-13.** `docs/plan/slice-1.md` records
  level 4's subject — "How Canadians Govern Themselves" / « Comment les Canadiens se gouvernent » — and the
  bank that was one directory of 57 `government` questions has been split. `content/questions/` now holds
  **ten** subject directories: `rights` (37 verified), `who-we-are` (46), `history` (96), `government` (38),
  `elections` (36), `justice` (31), `modern-canada` (39), **`economy` (18 of 19 authored)**, `symbols` (42)
  and **`regions` (58)**. **Nine of the ten clear `CLAUDE.md`'s thirty and no two levels draw from one**,
  which is what `OQ-SPINE-3` asked for and what `TN-LEVELS-03`'s last row keeps true. **`economy` is the
  exception and it is not hypothetical**: level 8 ships, is in `unlockRules.order`, and its bank is twelve
  verified questions short (`OQ-ALBERTA-2`). **Level 2's bank was full while the level was blocked and that
  changed nothing** — a bank is not a licence to depict, and what unblocked it was the subject-versus-place
  distinction, not the count.
- ~~**`OQ-REVIEW-1` — `docs/content-review.md` does not exist.**~~ **Answered 2026-09-08** — it exists now,
  and the questions it could not answer moved into it as `OQ-REVIEW-2` … `OQ-REVIEW-11`. Three of those
  reach back into these stories: **`OQ-REVIEW-6` is answered in `TN-SKIN-naming-the-six-skin-tones.md`**,
  which is also the answer `OQ-CREATOR-5` asked for; **`OQ-REVIEW-2` — who may grant cultural sign-off — is
  unanswered and now blocks nothing that is being built**, which is a worse state than it sounds: levels 2
  and 10 shipped as a village and a river bank rather than as a territory and a people, so the question that
  matters most has lost the two levels that were forcing it, and it is carried instead by two dated
  obligations in `docs/content-review.md` §13. **`OQ-REVIEW-10` — the canoe, the kayak, the dogsled and the
  qamutiik — is unanswered and no level document declares any of them**, which is why `TN-MOVE` still writes
  no label for either mode and why `OQ-MOVE-6` asks for the two unused modes to be removed from the config or
  marked as held. `OQ-LEVEL-3` (the officer's gender presentation and skin tone) is answered in part:
  whatever is chosen, §6 of that document fixes the proportions and §8.6 fixes how the option is labelled —
  and `OQ-LEVEL-8` now names the three French strings that move together with it.
  **One consequence of answering `OQ-REVIEW-6` here is that two documents now recommend two wordings.**
  `docs/content-review.md` §8.1 and its §12 still recommend "Skin tone 1 (lightest)"…"(deepest)", and
  `assets/style/art-bible.md` §8 still says the ramps ship unnamed until the question is settled. Neither
  file is this directory's to edit beyond §13; `OQ-SKIN-4` states what their owners have to change, and until
  they do, a reader has no way to tell which wording shipped.
- ~~**`OQ-REVIEW-7` — `CharacterSlot.default` versus "no tone is the default".**~~ **Answered 2026-09-08 —
  in the art bible's favour, and the whole conflict was the name.** The architect renamed the field to
  `fallback`, which is what `content/schemas/character.schema.json` now requires; nothing about the
  behaviour changed, and `TN-CREATOR-01` ("each group already has one option chosen") is unaffected. One
  stale reference remains: `docs/content-review.md` still calls the field `default` in its open-questions
  section. Flagged for its owner; this directory edits §13 of that file and nothing else.
  **`TN-FIRSTRUN` and `TN-LOOK-05` are what stop that answer being undone by a convenience**: a skip control
  and a save-recovery path are the two places where the fallback would silently become the default player,
  and both are ruled out in favour of a uniform draw.
- ~~**`OQ-ENTRY-1` — the game's data says there is no game.**~~ **Answered 2026-09-08, and complete on
  2026-09-13.** `content/game.config.json` carried `"levels": []` and empty unlock rules, so every level was
  locked including the only one that existed. It now carries **ten** built levels, a ten-slot journey with no
  nulls and `initialLevels: ["halifax"]`, so the map has a data source, `TN-MAP-06`'s first scenario can
  pass, and the game opens on level 1 rather than on level 4. `TN-MAP-06`'s first scenario stays as the guard
  that fails if the config ever goes back to opening nothing. **The entrance moving is what exposed the copy
  defect `TN-WAIT` was written for**: three strings had been Ottawa's and were drawn by every level, and
  nothing noticed while Ottawa was the only door. **It exposed a fourth the same way**: the stamp sentence
  was Ottawa's too, and the level the game now opens on had none (`TN-DONE`). **And a fifth, on 2026-09-09**:
  the quest on that same level could not be given at all, because its giver had no name (`TN-GUIDE`).
  **The sixth is the one the entrance never reached**: `title.play` is the control that opens the creator,
  and because the creator has never been mounted the shell has never been able to represent a first run, so
  that control has never been drawn on any door the game has had (`TN-FIRSTRUN`). **The seventh is the one
  time moved rather than the entrance**: two copy rows were keyed on a level's position while that level had
  no id, and both were correct until the day the ids arrived (`TN-WAIT-03`). **The eighth is the same shape
  as the fifth, one widening later**: two quests now validate and cannot be opened, because the name
  resolution reads a copy row that exists only for characters (ADR-0029, `OQ-PEGGYS-6`, `OQ-NORTH-6`).
