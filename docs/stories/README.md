# Stories — slice 1 (vertical proof), the front door, the four built levels, the spine, and Exam mode

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

- **`TN-MOVE-locomotion-labels.md`** owns every mode label, because a label belongs to a *mode* and three of
  the four built levels declare `walk`. `locomotion.skate.label` moved there from `TN-LEVEL`, unchanged.
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

| File | Area | Covers |
|---|---|---|
| `TN-TITLE-title-screen.md` | `TN-TITLE` | The first screen on a cold load: Play, Continue, Study, Settings |
| `TN-MAP-level-select.md` | `TN-MAP` | The ten levels, their order and their three states |
| `TN-FLOW-first-run-and-return.md` | `TN-FLOW` | The route between screens, first run, return, and back out |
| `TN-CREATOR-character-creator.md` | `TN-CREATOR` | Making a character before the first level |
| `TN-LEVEL-ottawa.md` | `TN-LEVEL` | Loading Level 4, skate locomotion, camera, POIs, pause |
| `TN-LEVEL-halifax.md` | `TN-HALIFAX` | Level 1's own copy: what it says while it opens, in the HUD, when it fails and when it is finished |
| `TN-LEVEL-quebec-city.md` | `TN-QUEBEC` | Level 3's own copy, and the rows that prove a French sentence cannot be templated |
| `TN-LEVEL-toronto.md` | `TN-TORONTO` | Level 5's own copy, and the tower it may not name on a loading screen, a stamp or a prompt |
| `TN-MOVE-locomotion-labels.md` | `TN-MOVE` | What the HUD calls each way of moving, once per mode |
| `TN-WAIT-a-level-opens-or-it-does-not.md` | `TN-WAIT` | Which waiting sentence and which error title each level draws, and the shared chrome |
| `TN-REACH-what-is-in-reach.md` | `TN-REACH` | What the prompt says when a place, a person or a finished target is in reach, and the one-time hint |
| `TN-DONE-finishing-a-level.md` | `TN-DONE` | Finishing a level: the card, the stamp sentence, what was answered, and the level that just opened |
| `TN-LEVELS-2-to-10-spine.md` | `TN-LEVELS` | The nine levels after Ottawa: subject, place, locomotion, landmark, NPC, blockers |
| `TN-HUD-hud-and-menu.md` | `TN-HUD` | The lower-third HUD, the menu, the storage warning, the page's landmarks |
| `TN-QUEST-parliament-hill.md` | `TN-QUEST` | Offer, accept, decline, track, complete, stamp |
| `TN-CARD-question-card.md` | `TN-CARD` | The question card: arrival, right, wrong, leaving |
| `TN-STUDY-study-mode.md` | `TN-STUDY` | The Study drill and its summary |
| `TN-EXAM-starting-and-answering.md` | `TN-EXAM` | Starting an exam, what it draws, answering twenty questions, finishing |
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
numbers its scenarios `TN-LEVEL-01`… because it was written when Ottawa was the only level; its three new
neighbours use `TN-HALIFAX-nn`, `TN-QUEBEC-nn` and `TN-TORONTO-nn` so that no id means two things. When the
remaining levels get stories, they take their own area rather than extending `TN-LEVEL`.

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

Two words were settled in the same pass, in the files that own them rather than in the files that noticed
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
  level names, `TN-TITLE` for four and `TN-PASSPORT` for eleven). Two tables carrying the same words is how
  they stop being the same words. **And the table's home follows what the string belongs to**, not which
  screen draws it: a waiting sentence belongs to a level, a mode label belongs to a mode, a stamp sentence
  belongs to the level it names, an interact prompt belongs to what is in reach, and a button that says "Go
  back" belongs to none of them (`TN-WAIT`, `TN-MOVE`, `TN-DONE`, `TN-REACH`).
- **Sharing a key and owning one are both decisions, and each needs its reason.** `map.stamps` is shared by
  the map and the passport because it is the same fact about the same thing and they must never disagree;
  `level.complete.score` is *not* `study.summary.score` because the two screens are answering different
  questions and neither may reword the other's (`TN-DONE`, `TN-PASSPORT-05`).
- **A rule is written down once, too.** Where two stories describe the same moment, one of them owns it and
  the other links. `TN-RESUME` owns what happens to the questions when a step is resumed; `TN-FLOW` owns
  where a cold load lands and what "back" means; `TN-MAP` owns the three level states and `TN-PASSPORT`
  reuses them rather than inventing a second vocabulary; `TN-COPY-07` owns the waiting rule and `TN-WAIT`
  owns which level draws which sentence; `TN-DONE` owns what a finished level may claim; `TN-SAVE`,
  `TN-CARD`, `TN-CREATOR` and `TN-HUD` name them and do not restate them.
- **Counts and state words follow `TN-COPY-strings-and-counts.md`**, not each screen's judgement. It has one
  rule for plurals in both languages, and it exists because "1 questions" is not a Study bug, it is a bug in
  every string with a number in it. Its rule 9 — one counted noun per template — came out of Exam mode, where
  one sentence tried to carry two.
- **A screen that is waiting says what it is doing, not how far along it is** (`TN-COPY-07`). No percentage,
  no step count, no ellipsis, no bar with a value, unless the game really knows both halves of the fraction —
  and in slice 1 it never does. The honest answer to a long wait is the escape route in `TN-LEVEL-02`.
- **A screen never describes a state it is not in.** This project has shipped that defect five times: a boot
  screen that read as a stalled progress bar, a caption saying there was no level to play over a running
  level, a game whose only entrance was a URL parameter, a Halifax load that said it was getting the Rideau
  Canal ready, and a completion card that says "Task done!" to a player who accepted no task. `TN-MAP-04` is
  the current form of the rule — a level nobody has built yet is described as unbuilt, not as locked and not
  as an error — `TN-PASSPORT-04` applies it to a stamp for a level that does not exist, `TN-WAIT-01` applies
  it to the words a level waits in, and `TN-DONE-01` applies it to the heading of a finished level.
- **Plain language**, roughly CLB 4 / grade 6. Short sentences. No jargon the player did not bring with them:
  the words *spaced repetition*, *FSRS*, *scheduler*, *due*, *card state* never appear on screen.
- **A game that teaches never marks the player down.** A wrong answer costs nothing (`TN-CARD`), a quest
  completes on a wrong answer (`TN-QUEST-04`), and a player who reaches the end of a level having answered
  nothing is told so plainly and invited back rather than scored (`TN-DONE-02`). No screen outside
  `TN-RESULT` reports a result, and none of them uses a grade, a star, a streak or a percentage.
- **One thumb, portrait.** Hold to move, tap to jump, tap an NPC or POI to engage. No scenario may need two
  hands, a pinch, a swipe, a drag or a double tap. This binds the map too: ten places east to west is a
  horizontal shape in a vertical window, and `TN-MAP` resolves it as a vertical list rather than a panned map
  (`OQ-MAP-2`). It binds the exam as well: twenty questions are reached with Previous and Next, never with a
  swipe. **And it binds the words**: no player-facing string names an input, because a sentence that says
  "tap" is wrong for a keyboard and for a switch (`TN-REACH`).
- **One timer, and it is optional.** Nothing on screen counts down, and no scenario may pass or fail on how
  fast the player acts — **except the exam clock**, which exists only inside a practice exam, only when the
  player turned it on for that attempt, pauses whenever they are not answering, and can be turned off
  mid-exam. `CLAUDE.md` allows exactly that one and `TN-TIMER` is where it is bounded; `TN-TIMER-07` is the
  check that stops it becoming a second one. Load timeouts are not player timers and are allowed to appear as
  an escape route from a stall.
- **A scenario must be able to fail.** If a step could be written today against an empty page and still pass,
  it is wrong. Waiting for a marker before asserting anything is the pattern (`tests/a11y/screens.spec.ts`
  already does this).
- **A check that passes is not the same as a check that ran.** A lint rule that never executed, a scan rule
  that self-passed and a test that was skipped all report exactly what a clean run reports. Where a story
  leans on a tool's green tick, it also says how that tick can be made to go red — `TN-HUD-10` is the worked
  example, and it exists because `landmark-one-main` passed on a page with no `<main>` at all.

## Depiction is acceptance too

`docs/content-review.md` governs how this game depicts people and places, and it changes what a story has to
contain. A story that puts a person or a place on screen carries these as scenarios, in the same file, on
the same footing as its accessibility and bilingual ones:

- **A "what is depicted" section, before the scenarios**, naming what the art agent is being asked to draw
  and — explicitly — what is *not* depicted. `TN-LEVEL-ottawa.md` already does this for the officer.
- **No option is coupled to another.** Where the player picks how somebody looks, a scenario asserts that
  choosing any option in one group leaves every other group's option count unchanged
  (`docs/content-review.md` §8.2). This is the mechanically checkable half of "no caricature".
- **The randomiser is uniform.** Where a "surprise me" exists, a scenario asserts every option can come up
  (§8.3). A weighted default player is a statement made in code.
- **No French copy about the player requires gender agreement** (§8.6). FR scenarios assert the wording, and
  the wording never contains `(e)`, `·e` or a bracketed ending. This binds copy about *characters* too where
  a story fixes their name: see `OQ-LEVEL-8`, and `TN-LEVELS`'s NPC table, which chooses epicene French role
  nouns so that seven of eight levels never have to answer the question.
- **A nation's own name is identical in EN and FR** (§9.3). Where a story writes one, both columns match.
- **Territory is stated, not performed.** Any level story includes the "About this place" panel: reachable
  from pause and from credits, never modal, never dismissed to reach gameplay, EN and FR, keyboard and
  single switch (§10.2). **And it is the only place a territorial statement is drawn** — `TN-WAIT`, the three
  new level files and `TN-DONE` keep it out of loading copy and off the completion card, because a screen the
  player waits past or taps through is the shape §10.2 names as the wrong one, and a compressed paraphrase of
  a cited statement is an unsourced claim.
- **A blocked level is not scoped.** `TN-LEVELS` leaves level 2 and level 10 without a place, a landmark, an
  NPC or an id, because §1's shipping rule blocks both and `OQ-REVIEW-2` is unanswered. Filling those cells
  in would make a blocked level look schedulable, and a plan that reads as schedulable gets scheduled. The
  same rule keeps `canoe` and `dogsled` out of `TN-MOVE`'s table.
- **A real building may be named; a business may not be advertised.** `TN-NAMES` is the rule and it is
  checkable: the name is text and never lettering in the art, it appears in the point-of-interest card's body
  and nowhere else, it carries no mark, and no sentence implies the place has anything to do with this game.
  `TN-NAMES-01` names a loading message among the screens a name may not appear on, which is why no level's
  waiting sentence names Pier 21, the CN Tower or the Château Frontenac — and `TN-REACH` is why the HUD's
  prompt does not either, which was the one surface where a name was reaching the player through content
  rather than through a copy table.

What a story must **not** do: assert that a depiction is approved. No scenario may encode a cultural
sign-off, because no agent may grant one (`docs/content-review.md` §1). A story states what is on screen;
whether it may be on screen at all is that document's shipping rule, not a test.

## French style

- Vouvoiement (« vous »), to match IRCC's own French. See `OQ-STYLE-1` in `TN-SET-settings.md`.
- Canadian French typography: **no** space before `?` and `!`; a space before `:`. Guillemets « » with a
  space inside.
- FR copy is a translation of meaning, never of word order. It is held to the same grade-6 bar as EN, and it
  may take a different shape from the English where the English shape is what breaks it: `study.summary.score`
  is a sentence in English and a label in French, and `TN-STUDY` says why. `title.lastPlayed` is a label in
  both, because a sentence would need a preposition in front of a place name and French does not use one
  preposition for all ten places — and `TN-WAIT` applies the same fact to the error title, which is written
  out per level rather than templated because « charger Halifax » takes no article and « charger la Ville de
  Québec » takes one. **`TN-DONE` applies it twice more**: « le tampon d'Halifax », « le tampon de la Ville
  de Québec », « le tampon de Toronto », and « Jouer à Halifax » against « Jouer dans la Ville de Québec ».
  Three rows, three French shapes, one English shape, and a template would have been right in English every
  time.
- Numbers are formatted for the locale, never concatenated: « 0,6 », « 150 % » with a space.
  `TN-COPY-strings-and-counts.md` says why this is a rule and not a preference.
- A passport stamp is **« un tampon »**, never « un timbre ». `TN-PASSPORT` settles it and lists the four
  strings that changed.

## Shared test vocabulary

These are contracts. A story references a `data-testid` or an event name; the agent that builds the thing
provides it.

### Words these stories use precisely

| Word | Means |
|---|---|
| **a sitting** | One run of the page: from opening the game to closing the tab. What the game remembers only for a sitting is listed in `TN-SAVE`'s "does not survive" table. `TN-RESUME` defines the term and owns what depends on it. |
| **ready to come back** | The scheduler would offer this question now. Never said on screen — the player sees only "New" or "Seen before". |
| **open / locked / not made yet** | The three states a level can be in on the map. `TN-MAP` owns the rule that decides which, and the rule that "not made yet" wins over both other states. |
| **earned / not earned yet / not made yet** | The three states a stamp can be in on the passport. `TN-PASSPORT` owns them, reuses `TN-MAP`'s third word and its key, and states the one place the precedence differs: an earned stamp stays earned even when the level is gone. |
| **a built level** | A level with a document under `content/levels/`. Four today — `halifax`, `quebec-city`, `ottawa`, `toronto` — and each one owns a waiting sentence, an error title, a stamp sentence and a play label (`TN-WAIT`, `TN-DONE`). |
| **finishing a level** | Either completing its task or reaching the end of it. Both earn the stamp and both draw the completion card, and every sentence on that card has to be true of the second (`TN-DONE`). |
| **an attempt** | One run at the exam: the twenty questions it drew, the answers given, whether it was timed, and — once it has finished — whether it passed. At most one attempt is unfinished at a time (`TN-ATTEMPT-04`). |

### DOM markers

| `data-testid` | What it marks |
|---|---|
| `playable` | The level is loaded and accepts input. Already used by `tests/perf` and `tests/a11y`. |
| `level-loading`, `level-error` | Load in progress; load failed. `level-loading` carries the level's own `level.<id>.loading` (`TN-WAIT-01`). |
| `scene-state` | The E2E scene probe — see below. |
| `title-screen`, `title-play`, `title-continue`, `title-choose-level`, `title-study`, `title-exam`, `title-settings` | The title screen (`TN-TITLE`). `title-play` and `title-continue` are never both present. `title-exam` is the exam's way in and changes its label when an exam is unfinished (`TN-ATTEMPT-03`). |
| `level-select`, `level-card-<id>` | The level select (`TN-MAP`). Each card reports `data-state` as `open`, `locked` or `not-built`. |
| `hud`, `hud-quest-tracker`, `hud-mode-label`, `menu-button` | The lower-third HUD (`TN-HUD`). `hud` is a region named by `hud.label`; `hud-mode-label` carries the mode label `TN-MOVE` owns and is never empty. |
| `menu` | The menu opened from `menu-button` (`TN-HUD-02`). It carries Settings, Study, the passport and "Leave the level". |
| `move-left`, `move-right`, `turn-around` | The hold-to-move controls (see `OQ-INPUT-1`). |
| `interact-prompt`, `interact-hint` | What is in reach and what pressing it will do (`TN-REACH`). The prompt is a verb phrase and never a landmark's name; `interact-hint` is the one-time explanation of the marks, is never in the tab order or the switch ring, and blocks nothing. |
| `character-creator`, `character-preview`, `slot-skin`, `slot-hair`, `slot-coat`, `randomise-character`, `start-playing`, `creator-settings`, `creator-save-error`, `creator-retry`, `creator-continue` | Character creator. |
| `dialogue`, `dialogue-speaker`, `dialogue-text`, `dialogue-accept`, `dialogue-decline`, `dialogue-next` | NPC dialogue. `dialogue-speaker` carries the speaker's name and is the dialog's accessible name (`TN-QUEST-08`). |
| `poi-card`, `poi-card-close` | Landmark information card. The one screen where a name on `TN-NAMES`'s list may appear. |
| `about-this-place`, `about-this-place-open`, `about-this-place-close` | The territorial statement panel (`docs/content-review.md` §10.2). |
| `question-card`, `question-kind`, `question-progress`, `question-prompt`, `option-0`…`option-3`, `question-feedback`, `question-explanation`, `question-next`, `question-close`, `question-closed-notice` | The question card. In an exam, `question-kind`, `question-feedback` and `question-explanation` are absent (`TN-EXAM-03`). |
| `quest-complete-card`, `quest-complete-stamp`, `quest-complete-progress`, `quest-complete-next`, `quest-complete-next-level`, `quest-complete-map`, `quest-complete-keep-playing` | Finishing a level (`TN-QUEST-04`, `TN-DONE`). `quest-complete-progress` carries whichever of `level.complete.score` and `level.complete.none` applies and is never both; `quest-complete-next` exists only while there is a level to open. |
| `passport`, `passport-open`, `passport-empty`, `passport-exam`, `stamp-<levelId>` | The passport (`TN-PASSPORT`). Each slot reports `data-state` as `earned`, `not-earned` or `not-built`. `stamp-ottawa` is the slice-1 instance. |
| `study-screen`, `study-count`, `study-start`, `study-empty`, `study-empty-title`, `study-practise-new`, `study-error`, `study-retry`, `study-left-notice`, `study-summary`, `study-summary-score`, `study-summary-returning`, `study-again`, `study-exit` | Study mode. |
| `exam-start`, `exam-begin`, `exam-timer-toggle`, `exam-not-ready` | The exam's start screen (`TN-EXAM-01`, `TN-TIMER-01`). |
| `exam-screen`, `exam-progress`, `exam-previous`, `exam-next`, `exam-finish`, `exam-clock`, `exam-unanswered` | A running exam (`TN-EXAM-03`, `TN-TIMER-02`). |
| `exam-result`, `exam-result-score`, `exam-result-by-subject`, `subject-row-<id>`, `exam-review`, `exam-again` | The result and its review (`TN-RESULT`). |
| `exam-resume` | The screen an unfinished exam is picked up from (`TN-ATTEMPT-03`). |
| `settings-screen`, `settings-close`, `setting-language`, `setting-auto-move`, `setting-single-switch`, `setting-hold-time`, `setting-reduced-motion`, `setting-high-contrast`, `setting-dyslexia-font`, `setting-text-size`, `setting-text-size-value`, `setting-subtitles`, `setting-sound` | Settings. `setting-sound` is present only when a sound ships (`TN-SET-01`). |
| `storage-warning`, `save-error`, `save-export`, `save-import`, `save-import-error` | Persistence. `storage-warning` is owned by `TN-HUD-03` and appears on the title screen too (`OQ-HUD-3`). |

### The scene probe

The Phaser canvas is `aria-hidden` and Playwright cannot read it. So that camera and locomotion scenarios
can fail, the game exposes one element, `data-testid="scene-state"`, refreshed at most ten times a second
and present **only** when the page is opened with `?e2e=1`:

`data-level`, `data-mode`, `data-paused`, `data-player-x`, `data-player-y`, `data-speed`, `data-facing`,
`data-grounded`, `data-camera-x`, `data-parallax-easing` (`on`/`off`), `data-particles` (a count).

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
`study/started` · `study/finished` · `character/created` · `settings/changed` · `locale/changed` ·
`progress/saved` · `progress/save-failed` · `progress/loaded` · `passport/opened` · `exam/started` ·
`exam/answered` · `exam/left` · `exam/resumed` · `exam/discarded` · `exam/time-up` · `exam/finished`.

Four of them were new with `TN-FLOW` and eight with Exam mode and the passport; all are covered by
`OQ-EVENT-1` like the rest. **`level/exitReached` and `level/completed` are not proposals** — the scene
already publishes both, and they are two different things on purpose: reaching the end is a *position* the
world reports, and completing the level is what the domain decides that position is worth (`TN-DONE`).
**An exam does not emit `question/asked` or `question/answered`**, so nothing that counts a quest step can be
advanced by an exam (`TN-RESULT-05`).

### The single-switch contract

CLAUDE.md says single-switch mode is "tap anywhere advances". With one contact and no countdown allowed,
these stories use:

- a **short press anywhere** moves the highlight to the next item and wraps at the end;
- a **long press** (contact held past the threshold the player sets in "Hold time", `TN-SET-09`) chooses the
  highlighted item;
- nothing scans on its own, nothing expires, and the player may take as long as they like.

Every story proves that its whole flow is completable with those two gestures alone, and `TN-FLOW-07` proves
the *route between* them is too — which is the case a per-screen proof cannot reach. See `OQ-SWITCH-1`.

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
(`TN-TIMER-08`).

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
(`TN-EXAM-08`, `TN-RESULT-10`), the passport one (`TN-PASSPORT-09`) and the completion card one
(`TN-DONE-07`); none of them is covered by anything that exists today.

**The waiting screen is the sharpest case of a component nothing mounts.** `createLevelLoading` is
constructed by the harness and by the unit suite and by nothing under `app/bootstrap`, so it passes every
scan and no player has ever seen it (`OQ-WAIT-1`). A screen that is accessible and unreachable is not a
screen.

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
  the level with its HUD, a modal open over it, and every screen of Exam mode and the passport are still
  scanned only through the harness. `TN-FLOW-08` states the whole route as acceptance, and it is not
  discharged until each of those is scanned against `dist/` too. Reports may now say the a11y suite proves
  the shipped **front door**; they may not yet say it proves the shipped game.
- **`OQ-TEST-3` — can a test move the clock?** Several scenarios in `TN-RESUME` say "an hour has passed",
  because what the scheduler offers depends on time and nothing else can express that, and every scenario in
  `TN-TIMER-03` and `TN-TIMER-05` says "five minutes pass" for the same reason. If the time those two read is
  not a port with a fake, those scenarios can only be written as sleeps, which is how a suite becomes flaky
  and then becomes ignored. *Recommendation:* one clock port, injected like every other adapter, read by both
  the scheduler and the exam; the stories keep saying "an hour has passed" and never name the fake. See
  `OQ-RESUME-1` and `OQ-TIMER-3`. **Two sources of time is how a paused clock quietly stops being paused.**
- **`OQ-SWITCH-1` — short press / long press, or something else?** *Recommendation:* as described above; it
  needs no timer the player can lose to, which auto-scanning does. Task 1.15 implemented it with no
  scheduling primitive at all, which is the strongest form of that argument, and `TN-TIMER-07` keeps that
  true now that the game contains a clock.
- **`OQ-EVENT-1` — do these event names match what task 1.5 emits?** They are the PO's proposal. If the use
  cases pick other names, the stories are updated, not the tests quietly.
- **`OQ-SUBJECTS-1` — nothing declares the ten subjects, and three screens need them.**
  `exam.subjectsReady` counts "1 of 10" (`TN-EXAM-01`), the result names a subject with the level's own
  subject line (`TN-RESULT-03`), and the passport counts ten stamps (`TN-PASSPORT-01`) — and the only list of
  ten in `content/` is `unlockRules.order`, which is a list of **level** ids. **Partly answered
  2026-09-08:** `content/game.config.json` now carries a ten-slot `journey` whose nulls are levels 2 and 10,
  four ids in `levels` and four in `unlockRules.order`, which matches `TN-LEVELS`. What is still missing is
  the list of *subjects* — the four built level documents declare `rights`, `history`, `government` and
  `elections`, and no document declares the other six or binds a subject to a level.
  *Recommendation:* declare the ten subjects once in `game.config.json`, each with its id and the level it
  belongs to. Routed to the architect and the plan owner; `content/` is not this directory's to edit.
  Recorded per screen as `OQ-EXAM-5`, `OQ-RESULT-2` and `OQ-PASSPORT-2`, because three screens finding the
  same gap is usually one gap.
- ~~**`OQ-SUBJECT-1` — Level 4's subject is not written down anywhere.**~~ **Answered.**
  `docs/plan/slice-1.md` records it — "How Canadians Govern Themselves" / « Comment les Canadiens se
  gouvernent » — and all 57 shipped questions carry `subject: "government"`. The remaining subject question
  is the *opposite* one and it is new: level 5's subject is Federal Elections and roughly a dozen of those 57
  questions are about ballots and voting, so two levels currently draw from one bank. `OQ-SPINE-3` in
  `TN-LEVELS-2-to-10-spine.md`. **Exam mode makes this urgent rather than tidy**: a representative draw
  spreads across subjects, and two subjects sharing one bank is a draw that is not representative of either.
  It is more urgent again now that levels 1, 3 and 5 are openable and none of them has a bank — and now that
  a level with no bank can be finished, which draws `level.complete.none` at a player who did everything the
  level offered (`OQ-HALIFAX-3`).
- ~~**`OQ-REVIEW-1` — `docs/content-review.md` does not exist.**~~ **Answered 2026-09-08** — it exists now,
  and the questions it could not answer moved into it as `OQ-REVIEW-2` … `OQ-REVIEW-11`. Three of those now
  reach back into these stories: `OQ-REVIEW-6` recommends the skin-tone option names that `OQ-CREATOR-5`
  asked for; `OQ-REVIEW-2` — who may grant cultural sign-off — is unanswered and blocks nothing in slice 1
  only because slice 1 depicts no nation, while it blocks **levels 2 and 10 outright** (`TN-LEVELS`); and
  `OQ-REVIEW-10` — the canoe, the kayak, the dogsled and the qamutiik — is unanswered and is attached to
  those same two levels' locomotion modes, which is why `TN-MOVE` writes no label for either. `OQ-LEVEL-3`
  (the officer's gender presentation and skin tone) is answered in part: whatever is chosen, §6 of that
  document fixes the proportions and §8.6 fixes how the option is labelled — and `OQ-LEVEL-8` now names the
  three French strings that move together with it.
- ~~**`OQ-REVIEW-7` — `CharacterSlot.default` versus "no tone is the default".**~~ **Answered 2026-09-08 —
  in the art bible's favour, and the whole conflict was the name.** The architect renamed the field to
  `fallback`, which is what `content/schemas/character.schema.json` now requires; nothing about the
  behaviour changed, and `TN-CREATOR-01` ("each group already has one option chosen") is unaffected. One
  stale reference remains outside this directory: `docs/content-review.md` still calls the field `default`
  in its open-questions section. That file is not this agent's to edit — flagged for its owner.
- ~~**`OQ-ENTRY-1` — the game's data says there is no game.**~~ **Answered 2026-09-08.**
  `content/game.config.json` carried `"levels": []` and empty unlock rules, so every level was locked
  including the only one that existed. It now carries four built levels, a ten-slot journey and
  `initialLevels: ["halifax"]`, so the map has a data source, `TN-MAP-06`'s first scenario can pass, and the
  game opens on level 1 rather than on level 4. `TN-MAP-06`'s first scenario stays as the guard that fails if
  the config ever goes back to opening nothing. **The entrance moving is what exposed the copy defect
  `TN-WAIT` was written for**: three strings had been Ottawa's and were drawn by every level, and nothing
  noticed while Ottawa was the only door. **It exposed a fourth the same way**: the stamp sentence was
  Ottawa's too, and the level the game now opens on had none (`TN-DONE`).
