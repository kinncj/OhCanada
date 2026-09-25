# TN-MAP — Level select: every place on the journey, three states

**Intent.** A player sees the whole journey across Canada, knows which level they can open now, knows what
would open the next one, and is never left thinking the game is broken because part of it is not built yet —
or that more is coming when it is not.

Read `README.md` in this directory first. `TN-TITLE-title-screen.md` owns the screen that opens this one;
`TN-FLOW-first-run-and-return.md` owns the route in and out; `TN-LEVELS-2-to-10-spine.md` owns each level's
subject, place name and blockers, and is where the nine place names in the copy table below come from.
`TN-PASSPORT-my-passport.md` owns the passport this screen opens, and reuses this file's state rule.

**Amended 2026-09-08 — « timbre » is now « tampon » in every French string on this screen.** `OQ-MAP-5`
recorded that a « timbre » is a postage stamp and that the mark in a passport is a « tampon », and deferred
the word to `TN-QUEST`. `TN-PASSPORT-my-passport.md` settles it in « tampon »'s favour and lists every
string that moved; three of them are in the table below. The noun is masculine in both words, so nothing
else about the strings changed. This screen also gained one control, "See my passport", beside the stamp
count — `TN-PASSPORT-01` says why it lands here and not on the title screen.

**Amended again 2026-09-13 — the journey is complete, and one sentence on this screen stopped being true
because the work finished.** `content/levels/` holds ten documents and `content/game.config.json` names the
same ten in `levels`, in `unlockRules.order` and in a `journey` with no nulls, so **every card on the shipped
map is "Open" or "Locked" and none is "Not made yet"**. Three consequences, and the second is the one that
needed a rule rather than an amendment:

- **The three states stay**, all of them, because they are about what a *build* contains and not about what
  this plan contains. `TN-MAP-04` now names its own premise instead of borrowing it from the config.
- **`map.moreComing` is drawn only while `ready` is less than `total`.** "More are coming." on a complete map
  tells a player to wait for something nobody is building. The rule is below, with scenarios, and
  `OQ-PASSPORT-7` is where it was found.
- **`OQ-MAP-1` is closed.** The config's ten ids are the ten this directory names.

**Amended 2026-09-25 (K-0.9b) — the number of cards is the journey's length, and it becomes eleven when
Kingston lands.** Kingston takes journey slot 5, between Ottawa and Toronto, and unlocks after Ottawa
(ADR-0068 §9). Toronto to the North become levels 6 to 11. Every count on this screen is the journey's
length: the cards, `map.stamps`' total and `map.levelsReady`' total (`journeyPlaces` in
`app/bootstrap/journey.ts`). No screen or copy string holds the number. So the scenarios below state their
premise, which is that the journey names eleven places, and say "of 11" where they used to say "of 10". Until
the Kingston landing PR merges, the shipped map draws ten cards and "of 10", under the same rules. **Three
scenarios were also corrected in passing.** `TN-MAP-01` and `TN-MAP-11` said a complete map shows "Levels
ready: 10 of 10". Since ADR-0039, and as this file's own copy notes say, that count is drawn only while `ready`
is less than `total`.

## The problem this story is mostly about

For most of this project's life, most of the levels on the journey did not exist; today all of them do, and
a future build may again contain fewer — a partial checkout, a branch mid-migration, or a level pulled after a
cultural-accuracy report, which `docs/content-review.md` §7 requires to happen *before* the discussion. A
screen listing the journey's places where some of them cannot be opened has to say *why* each one cannot be
opened, and there are two different whys:

| State | Means | The player's reading of it |
|---|---|---|
| **Open** | The level exists and the player has earned it | I can play this now |
| **Locked** | The level exists and the player has not earned it yet | I have something to do to open this |
| **Not made yet** | The game does not contain this level | The game is still being built; this is nothing I did |

The two locked states must be told apart by a player at a glance, by a screen reader, and by a test — and
**neither may read as a defect**. A level the player has not earned is a goal. A level nobody has built is a
statement about the project, not about the player, and saying "Locked" over it invites them to look for a
key that does not exist.

**The third state is unreachable on the shipped build and none of its scenarios is deleted.** A guard whose
only input has been deleted is ADR-0024's vacuity wearing a green tick: it reports exactly what a working
guard reports, and nothing can make it fail. `TN-MAP-04` therefore supplies its own unbuilt entry rather than
relying on the shipped config to contain one, and the same is true of `TN-PASSPORT-04`.

### The rule that decides which state a level is in

Written here once, because deciding it per card produces three answers:

1. **If no level document exists for the id, the state is "not made yet".** This wins over everything,
   including the unlock rules. A player who has earned enough stamps to open level 5 and finds no level 5
   there has still not failed at anything, and must never be told to earn a stamp they already have.
2. **Otherwise, if `unlockedLevelIds` includes the id, the state is "open".**
3. **Otherwise the state is "locked", and the card says what would open it.**

`unlockedLevelIds` (`app/domain/entities/level.ts`) reads `unlockRules` from `content/game.config.json` and
the stamps earned. Whether a *document* exists is the level catalogue's answer
(`app/adapters/phaser/level-catalog.ts`, which derives it from `content/levels/*.json` rather than from a
list anybody maintains). Two sources, two different questions, and the bug this rule prevents is the screen
answering one of them with the other. **The two sources agree today** and `OQ-MAP-1` records what it took.

**The passport reuses this rule and differs from it in exactly one place**, which is written down in
`TN-PASSPORT`: an earned stamp is shown as earned even when this build has no document for that level,
because the map says what a player can do now and the passport says what they did.

### `map.moreComing` — the rule, because the string outlived the state it described

> **"More are coming." is drawn only while `ready` is less than `total`. When they are equal, the screen
> says nothing in that slot.**

Every build this project has had until 2026-09-13 had fewer levels than the journey names, so the sentence
was true every time anybody looked at it. It is false on a complete map, and a screen that promises content
nobody is building is `README.md`'s "a screen never describes a state it is not in" arriving from the one
direction nobody watches: **a sentence that stopped being true because the work finished.** Four things this
rule does and does not say:

1. **The string is not deleted.** A build with fewer documents than the journey names still needs it, and
   `TN-MAP-04`'s "a build with one level is a normal state of this game" still asserts it.
2. **Nothing replaces it.** The slot is empty when the journey is complete — no "That's all of them!", no
   "You have the whole map", no tick. This screen reports state; a congratulation is a result, and
   `TN-RESULT` owns the only screen in this game that reports one.
3. **It is one key with two subjects, and that is why it belongs to the key rather than to a screen.** The
   level select and the passport draw it beside `map.levelsReady`, counting **levels with a document**. The
   exam's start screen and its result screen draw the same row beside `exam.subjectsReady`, counting
   **subjects with a bank** (`TN-EXAM-01`, `TN-RESULT-03`). The two counts can disagree inside one build — a
   level can ship before its subject clears a bank, and a subject can have a bank before its level is built —
   so the sentence can be correct on one screen and wrong on another **at the same time**, which is exactly
   the case a per-screen rule would get wrong. **The test is always the count that sits beside it**, and
   `TN-MAP-01`'s complete-journey scenario asserts it across every screen that draws the key, so a screen
   that has no scenario of its own is still covered by the rule rather than by nobody.
4. **Four screens implement it and every one of them tests `ready < total` first.** That was true before this
   rule was written down: `app/ui/exam-start.ts` carries the comment *"Only while it is true, exactly as the
   map draws it (`TN-MAP`)"*, pointing at a rule this file did not yet state, and `app/ui/level-select.ts`,
   `app/ui/passport.ts` and `app/ui/exam-result.ts` each carry the same condition. **A correct implementation
   of an unwritten rule is one refactor away from being an unexplained condition somebody simplifies**, which
   is the whole reason it is here now. `TN-MAP-01`, `TN-MAP-11` and `TN-PASSPORT-01` assert both halves;
   `TN-EXAM-01` and `TN-RESULT-03` assert the partial half against a subject count, which is the half those
   two screens can still reach today.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-MAP-07` |
| Single switch | `TN-MAP-08` |
| Screen reader | `TN-MAP-09` |
| Reduced motion | `TN-MAP-10` |
| 200 % text | `TN-MAP-10` |
| Bilingual | `TN-MAP-11` |
| Failure path | `TN-MAP-05` (the two locked states are told apart, including the edge nobody expects), `TN-MAP-06` (the data is wrong, or a chosen level will not load) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `map.open` | Choose a level | Choisir un niveau |
| `map.title` | Choose a level | Choisir un niveau |
| `map.stamps` | Stamps: {{earned}} of {{total}} | Tampons : {{earned}} sur {{total}} |
| `map.levelsReady` | Levels ready: {{ready}} of {{total}} | Niveaux prêts : {{ready}} sur {{total}} |
| `map.moreComing` | More are coming. | D'autres arrivent. |
| `map.state.open` | Open | Ouvert |
| `map.state.locked` | Locked | Verrouillé |
| `map.state.notBuilt` | Not made yet | Pas encore créé |
| `map.open.help` | You can play this now. | Vous pouvez y jouer maintenant. |
| `map.locked.after` | Finish {{level}} first. | Terminez d'abord {{level}}. |
| `map.locked.stamps.one` | Earn {{n}} more stamp to open this. | Gagnez encore {{n}} tampon pour ouvrir ce niveau. |
| `map.locked.stamps.other` | Earn {{n}} more stamps to open this. | Gagnez encore {{n}} tampons pour ouvrir ce niveau. |
| `map.notBuilt.help` | We are still making this level. | Ce niveau est encore en préparation. |
| `map.number` | Level {{n}} | Niveau {{n}} |

**Proposed row, not yet ratified.** Written by `app/ui` and declared in `COPY_GAPS` (`app/ui/copy.ts`) until
this file's owner moves it into the table above or replaces it:

| Key | EN | FR |
|---|---|---|
| `map.here` | You are here | Vous êtes ici |

It labels the stop the player is at. The map and the route beside the cards mark that stop visually and are
both `aria-hidden`, so the card has to say it in words. It names no place, because the card already does, and
no direction (`OQ-MAP-3`).

**Proposed rows, not yet ratified (ADR-0039, 2026-09-14).** The sentence under a locked card is written out
per level, in `COPY_GAPS` until ratified. `map.locked.after` dropped the map title into a template and drew
"Finish The Prairies first." / « Terminez d'abord Les Prairies. ». It stays only for a card with no id.

| Key | EN | FR |
|---|---|---|
| `level.halifax.finishFirst` | Finish Halifax first. | Terminez d'abord Halifax. |
| `level.peggys-cove.finishFirst` | Finish Peggy's Cove first. | Terminez d'abord Peggy's Cove. |
| `level.quebec-city.finishFirst` | Finish Québec City first. | Terminez d'abord la Ville de Québec. |
| `level.ottawa.finishFirst` | Finish Ottawa first. | Terminez d'abord Ottawa. |
| `level.toronto.finishFirst` | Finish Toronto first. | Terminez d'abord Toronto. |
| `level.winnipeg.finishFirst` | Finish Winnipeg first. | Terminez d'abord Winnipeg. |
| `level.prairie-rail.finishFirst` | Finish the Prairies first. | Terminez d'abord les Prairies. |
| `level.alberta-foothills.finishFirst` | Finish the Alberta foothills first. | Terminez d'abord les contreforts de l'Alberta. |
| `level.vancouver.finishFirst` | Finish Vancouver first. | Terminez d'abord Vancouver. |
| `level.the-north.finishFirst` | Finish the North first. | Terminez d'abord le Nord. |

**Kingston's row is in its own story.** `level.kingston.finishFirst` — "Finish Kingston first." /
« Terminez d'abord Kingston. » — is in `TN-LEVEL-kingston.md`'s copy table, which Ruling 1 of K-0.9 ratified.
When Kingston lands, it is the sentence under Toronto's locked card, because Toronto unlocks after Kingston
and no longer after Ottawa.

**`map.levelsReady` follows `map.moreComing`'s rule since ADR-0039**: it is drawn, and put in the arrival
announcement, only while `ready` is less than `total`, on the map and in the passport alike.
"Levels ready: 11 of 11" is a build report, not something a player can act on. `exam.subjectsReady` and
`exam.subjects.help` follow the same rule on the exam's start and result screens.

The level names and subject lines are owned by `TN-LEVELS-2-to-10-spine.md` (`level.<id>.title` and
`level.<id>.subtitle`, for **every level but Ottawa and Kingston**), by `TN-LEVEL-ottawa.md`
(`level.ottawa.title`, `level.ottawa.subtitle`) and by `TN-LEVEL-kingston.md` (`level.kingston.title`,
`level.kingston.subtitle`). This screen names the keys and does not carry the words: a place name written in
two tables is a place name that will eventually differ between two screens. **Every one of those keys is
spelled with the level's id**; `level.2.subtitle`, `level.10.title` and `level.10.subtitle` were retired when
levels 2 and 10 got ids, and `TN-WAIT-03` refuses a key numbered by journey position. Kingston's insertion
at slot 5 is the case that rule was written for: it renumbers six levels and moves no key. `common.back` is
owned by `TN-FLOW-first-run-and-return.md`; `storage.warning` by `TN-SAVE-save-and-reload.md`;
`passport.open` by `TN-PASSPORT-my-passport.md`.

`map.stamps`, `map.levelsReady`, `map.moreComing`, `map.state.notBuilt` and `map.notBuilt.help` are drawn by
the passport too, by key. Five strings, one home, two screens that cannot drift apart. **`map.moreComing` is
drawn by two more** — the exam's start and result screens — against a count of subjects rather than levels;
the rule above covers all four and the reason it is one key is that it is one sentence about one fact.

**Why `map.stamps` and `map.levelsReady` are labels with a preposition after the number.** `TN-COPY`'s
counting rule 1: a noun before the number and « sur » after it has no plural form to get wrong in either
language, and `TN-COPY`'s worked example is what happens when that rule is skipped in one language only.
`map.locked.stamps` cannot take that shape — the number is the whole message — so it carries `.one` and
`.other` rows in both languages under rule 2, and the form is chosen by `Intl.PluralRules` for the active
locale and never by `n === 1` (rule 3: at zero, French is singular and English is plural).

**Why "Not made yet" and not "Coming soon".** "Soon" is a promise with a date in it, and this project has no
date. "Not made yet" is true, it is grade-6 plain, and paired with "We are still making this level." it reads
as work in progress rather than as breakage. « Pas encore créé » and « Ce niveau est encore en préparation. »
carry the same two halves. Neither string may acquire a date, a version number or a percentage — and
`map.moreComing` may not either, which is half of why it is dropped rather than reworded when the journey is
complete: the honest wording for "everything that is planned exists" is silence.

---

## TN-MAP-01 — Every level on the journey, in order, each with a state

```gherkin
Feature: The level select screen
  As a player deciding what to do next
  I want to see the whole journey and where I am in it
  So that I know what is open, what I can earn, and what does not exist yet

  Background:
    Given I have a saved game with a character
    And the journey names eleven places, as it does once Kingston lands
    And this build contains a level document for each of them
    When I open the level select

  Scenario: The screen is there and says what it is
    Then the element "level-select" is visible
    And the event "map/opened" is emitted
    And it shows the heading "Choose a level"
    And the element "playable" is not present

  Scenario: One card per place, in the order the journey takes
    Then eleven level cards are shown, one for each place the journey names
    And they appear in reading order from level 1 to level 11
    And the focus order is the same as the reading order
    And each card shows "Level {{n}}" with its number
    And each card shows its place name and its subject line

  Scenario: The cards are the places this directory names
    Then the cards are "halifax", "peggys-cove", "quebec-city", "ottawa", "kingston", "toronto",
      "winnipeg", "prairie-rail", "alberta-foothills", "vancouver" and "the-north", in that order
    And each id is the one "content/game.config.json" lists in "journey" and in "unlockRules.order"
    And each id has a document under "content/levels"
    And no card is drawn for an id no story names

  Scenario: The number of cards is the journey's length, not a number on the screen
    Then the number of cards equals the number of places in "journey"
    Given a build whose journey names ten places, as before Kingston landed
    Then ten cards are shown
    And no copy string and no screen holds either number

  Scenario: Every card carries exactly one state, in words
    Then each card shows one of "Open", "Locked" or "Not made yet" as text
    And no card shows two state words
    And no card's state is conveyed by colour, by an icon or by opacity alone
    And each card reports "data-state" equal to "open", "locked" or "not-built"

  Scenario: The screen says how far I have got, and not how much of the game exists
    Then it shows "Stamps: 0 of 11"
    And it does not show "Levels ready: 11 of 11", because every level is made (ADR-0039)

  Scenario: A complete journey promises nothing more
    Given every level in the journey has a document
    Then the screen does not show "More are coming."
    And the slot it would occupy is empty, not filled with another sentence
    And nothing on the screen congratulates me for the game being finished
    And nothing on the screen says a level is coming, planned or in progress

  Scenario: No screen draws the promise once its own count is complete
    Then no screen in this game draws "More are coming." while the count beside it equals its total
    And that is checked on the level select and the passport against levels with a document
    And on the exam's start screen and its result screen against subjects with a bank
    And a screen that draws it unconditionally fails this scenario, whichever count it sits beside

  Scenario: An incomplete journey still says so
    Given exactly one level document exists
    Then the screen shows "Levels ready: 1 of 11"
    And it shows "More are coming."
    And the sentence is drawn whenever the ready count is lower than the total, and never otherwise

  Scenario: The stamp count is a route as well as a number
    Then a control "See my passport" is offered as "passport-open"
    And it is at least 44 CSS px wide and tall
    When I tap it
    Then the element "passport" is visible, as TN-PASSPORT-01 describes
    And coming back shows the level select in the state I left it in

  Scenario: One thumb, portrait, no sideways scroll
    Given the viewport is 390 x 844
    Then the page does not scroll sideways
    And every card and every control is at least 44 CSS px wide and tall
    And reaching the last level on the journey needs only a vertical scroll
    And no card needs a swipe, a drag, a pinch or a double tap to reach or to choose

  Scenario: Leaving the screen
    Then a control "Back" is visible
    When I tap it
    Then the route described in TN-FLOW-03 is taken
    And no level has been loaded
```

## TN-MAP-02 — An open level

```gherkin
Feature: Opening a level from the map
  Background:
    Given the Ottawa level document exists
    And Ottawa is in the unlocked levels
    And the level select is visible

  Scenario: An open level says it is open and how to take it
    Then the card "level-card-ottawa" reports "data-state" equal to "open"
    And it shows "Open"
    And it shows "You can play this now."
    And it shows "Ottawa" and "How Canadians govern themselves"
    And it is not marked "aria-disabled"

  Scenario: Choosing it opens the level
    When I tap "level-card-ottawa"
    Then the event "level/chosen" is emitted for "ottawa"
    And the loading screen described in TN-LEVEL-01 is shown
    And the element "playable" appears
    And "scene-state" reports "data-level" equal to "ottawa"

  Scenario: A level with a stamp already earned is still open
    Given I have earned the Ottawa stamp
    Then "level-card-ottawa" still reports "data-state" equal to "open"
    And it shows that the stamp is earned, by a label and not by colour alone
    And choosing it opens the level again

  Scenario: The map does not decide progression by itself
    Then which levels are open follows only from the unlock rules and the stamps earned
    And no card is opened by having been visited, by a URL, or by the order it is drawn in
```

## TN-MAP-03 — A level that is locked and can be earned

```gherkin
Feature: A locked level says what would open it
  Background:
    Given the level document for level 5 exists
    And level 5 is not in the unlocked levels
    And the level select is visible

  Scenario: It says it is locked, and what to do
    Then that card reports "data-state" equal to "locked"
    And it shows "Locked"
    And it shows a sentence naming what would open it
    And that sentence is either "Finish Ottawa first." or an "Earn ... to open this." sentence
    And it never says the level does not exist

  Scenario: The number in the sentence is the number of stamps still needed
    Given the unlock rules ask for 2 stamps and I have earned 1
    Then the card shows "Earn 1 more stamp to open this."
    Given I have earned 0 stamps
    Then the card shows "Earn 2 more stamps to open this."
    And the singular and plural forms follow TN-COPY-01 and TN-COPY-02

  Scenario: Choosing it explains rather than doing nothing
    When I activate that card
    Then no level is loaded
    And no "level/chosen" event is emitted
    And the reason it is locked is announced in "#tn-live-region"
    And the card is still focused

  Scenario: Earning the stamp opens it, with no reload
    Given I finish the Ottawa quest and earn its stamp
    When I open the level select
    Then the next level in the unlock order reports "data-state" equal to "open"
    And it is announced as open when I reach it

  Scenario: A locked level still says what it teaches
    Then the card shows its place name and its subject line
    And nothing about the level's subject is hidden behind the lock
```

## TN-MAP-04 — A level that is not built yet

**No card is in this state on the shipped build**, because every place the journey names has a document.
These scenarios supply their own unbuilt entry rather than borrowing one from the config, for the reason
ADR-0024 gives: a guard whose only input has been deleted passes exactly as a working guard passes, and
nothing can make it fail. `tests/unit/ui/level-select.test.ts` does the same thing on purpose — the shipped
places are asserted by name, and the no-placeholder guard is handed a synthetic entry.

```gherkin
Feature: A level the game does not contain
  Background:
    Given this build contains no level document for level 7
    And the level select is visible

  Scenario: It says the game is still being made, not that the player is missing something
    Then that card reports "data-state" equal to "not-built"
    And it shows "Not made yet"
    And it shows "We are still making this level."
    And it does not show "Locked"
    And it does not name a stamp, a level to finish, or anything for me to do

  Scenario: It is not drawn as an error
    Then nothing on the card says "error", "failed", "missing", "unavailable" or "not found"
    And no error icon, warning triangle or red state is drawn on it
    And no message anywhere on the screen suggests something went wrong

  Scenario: Choosing it does not pretend
    When I activate that card
    Then no level is loaded
    And no "level/chosen" and no "level/failed" event is emitted
    And "#tn-live-region" reads that the level is not made yet
    And the card is still focused

  Scenario: It still says what it will teach
    Then the card shows its subject line
    And where a level has no title row in the active language, no place name is shown
      and no placeholder text is drawn
    And nothing reads as "TBD", "coming soon", "???" or an empty box
    And levels 2 and 10 were this scenario's worked example until they shipped with ids and titles

  Scenario: The guard is fed an entry on purpose, not by the shipped config
    Given every level in the shipped journey has a document
    Then this scenario's unbuilt entry is supplied by the test, not read from "content/game.config.json"
    And a change that deletes the entry rather than the state fails this suite
    And a state no input can reach is not evidence that the state is handled

  Scenario: A build with one level is a normal state of this game
    Given the journey names eleven places
    And exactly one level document exists
    Then ten cards report "data-state" equal to "not-built"
    And the screen shows "Levels ready: 1 of 11"
    And the screen shows "More are coming."
```

## TN-MAP-05 — The two locked states are told apart (failure path)

```gherkin
Feature: A level nobody built is never described as a level the player has not earned
  Scenario: The two states differ in the word, not only in the styling
    Given one card is locked and another is not built
    Then their state words are different
    And their help sentences are different
    And a player who cannot see colour or opacity can still tell them apart
    And a screen reader reads a different state for each

  Scenario: Not built beats locked, whatever the unlock rules say
    Given level 6 is not in the unlocked levels
    And no level document exists for level 6
    Then its card reports "data-state" equal to "not-built"
    And it does not show "Locked"

  Scenario: Not built beats open too
    Given I have earned enough stamps that level 6 is in the unlocked levels
    And no level document exists for level 6
    Then its card reports "data-state" equal to "not-built"
    And it does not show "Open"
    And it offers no way to start it
    And no "level/chosen" event can be emitted for it

  Scenario: An earned stamp is never asked for twice
    Given I have earned every stamp the unlock rules ask for a level
    And that level is not built
    Then no sentence on its card asks me to earn a stamp
    And no sentence on its card asks me to finish another level

  Scenario: The distinction is derived, not authored per card
    Then no level document, locale string or config field declares a card as "not made yet"
    And the state follows only from whether a document exists and from the unlock rules
    And adding the missing level document changes the card's state with no other edit
```

## TN-MAP-06 — The data is wrong, or the level will not load (failure path)

```gherkin
Feature: A map built on data that does not agree with itself
  Scenario: A map where nothing can ever be opened fails the build
    Given the unlock rules leave no level open and no stamp can be earned
    When the content check runs
    Then the build fails, naming the unlock rules
    And the message says which level was expected to be open at the start

  Scenario: An unlock order that names a level nobody will build is not silently dropped
    Given the unlock order names an id with no level document
    When the content check runs
    Then the check reports it as a level that is not built yet
    And the build does not fail, because that is the normal state of this game
    And the report names every such id, not only the first

  Scenario: A level document that no map entry names is a defect
    Given a level document exists whose id appears in no map entry and in no unlock order
    When the content check runs
    Then the build fails, naming the id
    And the message says the level would be unreachable from the map

  Scenario: The two lists agree today, and the check is what keeps them agreeing
    Then every id in "unlockRules.order" has a document under "content/levels"
    And every document under "content/levels" is named in "unlockRules.order"
    And every one of them is named by a story in this directory
    And a change that adds an id to one list and not the other is reported

  Scenario: A level chosen from the map that fails to load
    Given the Ottawa assets cannot be fetched
    When I choose "level-card-ottawa"
    Then the failure described in TN-LEVEL-02 is shown
    And its "Go back" control returns me to the level select, not to a blank page
    And the level select is in the same state I left it in

  Scenario: A level document that is corrupt is a level failure, not a map failure
    Given the Ottawa document does not validate
    When I choose "level-card-ottawa"
    Then the element "level-error" is visible
    And the level select can still be reached from it
    And no other card's state changes

  Scenario: The map is reachable when the game has no levels at all
    Given the journey names eleven places
    And no level document exists
    When I open the level select
    Then eleven cards are shown, all reporting "data-state" equal to "not-built"
    And the screen shows "Levels ready: 0 of 11"
    And the screen shows "More are coming."
    And no error screen is shown
```

## TN-MAP-07 — The map from the keyboard

```gherkin
Feature: Keyboard-only level select
  Background:
    Given I am using a keyboard only
    And the level select is visible

  Scenario: Every card is reachable, whatever its state
    When I press "Tab" through the screen
    Then focus reaches every card on the journey, in level order
    And a locked card and a card that is not built both receive focus
    And each focused card has a focus indicator that is not colour alone

  Scenario: A card that cannot be opened is disabled in name, not removed from the order
    Then each card that cannot be opened carries "aria-disabled" set to true
    And none of them is removed from the tab order
    And pressing "Enter" on one announces its reason instead of doing nothing

  Scenario: Opening a level with the keyboard
    When focus is on "level-card-ottawa" and I press "Enter"
    Then the Ottawa level loads
    And focus moves into the game, not to the document body

  Scenario: Leaving with the keyboard
    When I press "Tab" until focus is on "Back" and press "Enter"
    Then the level select closes
    And focus lands on the control that opened it
```

## TN-MAP-08 — The map with one switch

```gherkin
Feature: Single-switch level select
  Background:
    Given single-switch mode is on
    And the journey names eleven places
    And the level select is visible

  Scenario: Nothing scans and nothing expires
    When I do nothing for two minutes
    Then the highlight has not moved
    And no card has been chosen
    And nothing on screen counts down

  Scenario: Short press moves through every card and wraps
    When I press the switch briefly eleven times, once for each place on the journey
    Then the highlight has visited all eleven cards in order
    And each card's name and state are announced as the highlight arrives
    When I press the switch briefly again
    Then the highlight moves on to "See my passport", then "Back", and then wraps to the first card

  Scenario: Long press chooses, and a card that cannot be opened says why
    Given the highlight is on an open card
    When I hold the switch past the hold-to-choose threshold
    Then that level loads
    Given the highlight is on a card that is not built
    When I hold the switch past the threshold
    Then "#tn-live-region" reads that the level is not made yet
    And the highlight has not moved

  Scenario: The whole screen is usable with the switch alone
    When I use only short and long presses
    Then I can reach every card, open the one that is open, open the passport and leave the screen
```

## TN-MAP-09 — The map with a screen reader

```gherkin
Feature: Announcing the map
  Background:
    Given the journey names eleven places
    And the level select is visible

  Scenario: The screen is a named region or dialog inside a landmark
    Then "level-select" has an accessible name that is not empty
    And every piece of visible text on the page is inside a landmark
    And exactly one element on the page has an "aria-live" attribute
    And any canvas on the page is "aria-hidden"

  Scenario: The cards are a list, and their order is the journey
    Then the cards are exposed as a list of eleven items, one for each place on the journey
    And their order in the accessibility tree is level 1 to level 11

  Scenario: A card's accessible name carries its number, its place and its state
    Then the accessible name of "level-card-ottawa" contains "Level 4", "Ottawa" and "Open"
    And the accessible name of a card that is not built contains "Not made yet"
    And no card's state has to be inferred from styling

  Scenario: A place name with an apostrophe or an accent is read as a place
    Then the second card's name contains "Peggy's Cove" and is not spelled out
    And the third card's name contains "Québec City", or "Ville de Québec" in French
    And the fifth card's name contains "Kingston", in both languages
    And the last card's name contains "The North", or "Le Nord" in French

  Scenario: The reason is a description, not a tooltip
    Then each card's help sentence is its accessible description
    And it is read after the name, not instead of it

  Scenario: Arriving and choosing are announced once
    When the level select opens
    Then "#tn-live-region" reads the screen's name and how many levels are ready, once
    And it does not announce a promise of more when every level is ready
    When I choose a level
    Then the arrival is announced by the level, as TN-LEVEL-08 describes

  Scenario: axe-core is clean on this screen
    When axe-core runs against the whole page
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
```

## TN-MAP-10 — Reduced motion and 200 % text

```gherkin
Feature: The map honours the accessibility settings
  Scenario: Reduced motion
    Given reduced motion is on
    When the level select opens
    Then it appears with no slide, fade or scale
    And no card animates, pulses or shimmers
    And a newly opened level is marked by its state word, not by an animation
    And no map route, dotted line or vehicle animates across the screen

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the page does not scroll sideways
    And every card's number, place name, subject line, state word and help sentence are fully visible
    And no label is truncated with an ellipsis
    And every card is still at least 44 CSS px wide and tall
    And every card on the journey is reachable by scrolling down

  Scenario: High contrast
    Given "High contrast" is on
    Then each card's state is distinguishable without colour
    And every state word meets the contrast requirement against its background

  Scenario: The longest strings on a card still fit
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Ce niveau est encore en préparation." is visible on its card
    And the whole of "Gagnez encore 2 tampons pour ouvrir ce niveau." is visible on its card
    And the whole of "Les contreforts de l'Alberta" is visible as a place name
```

## TN-MAP-11 — The map in French

```gherkin
Feature: The level select in French
  Background:
    Given the language is French
    And the journey names eleven places, as it does once Kingston lands
    And this build contains a level document for each of them
    And the level select is visible

  Scenario: The screen is French
    Then the heading reads "Choisir un niveau"
    And the back control reads "Retour"
    And the stamp count reads "Tampons : 0 sur 11"
    And it does not show "Niveaux prêts : 11 sur 11", because every level is made (ADR-0039)
    And there is a space before each colon
    And no English word appears in "level-select"

  Scenario: The French promise is dropped on the same condition as the English one
    Then the screen does not show "D'autres arrivent."
    And no other French sentence is drawn in its place
    Given exactly one level document exists
    Then the screen reads "Niveaux prêts : 1 sur 11"
    And it shows "D'autres arrivent."
    And the condition is the same in both languages, because it is one row and one rule

  Scenario: Every state word is French
    Then the state words used are only "Ouvert", "Verrouillé" and "Pas encore créé"
    And no card shows "Open", "Locked" or "Not made yet"

  Scenario: The help sentences are French
    Then an open card shows "Vous pouvez y jouer maintenant."
    And a card that is not built shows "Ce niveau est encore en préparation."
    And a locked card shows "Terminez d'abord Ottawa." or a "Gagnez encore ..." sentence

  Scenario: The stamp sentence agrees with its number in French
    Given the unlock rules ask for 2 stamps and I have earned 1
    Then the card shows "Gagnez encore 1 tampon pour ouvrir ce niveau."
    And it does not show "1 tampons"
    Given I have earned 0 stamps
    Then the card shows "Gagnez encore 2 tampons pour ouvrir ce niveau."

  Scenario: The word for a stamp is the passport's word
    Then no string in "level-select" contains "timbre"
    And the passport uses the same word, as TN-PASSPORT-11 requires

  Scenario: The passport control is French
    Then "passport-open" reads "Voir mon passeport"

  Scenario: Place names are what each language calls the place
    Then level 4 reads "Ottawa" in both languages
    And level 5 reads "Kingston" in both languages
    And level 3 reads "Québec City" in English and "Ville de Québec" in French
    And level 2 reads "Peggy's Cove" in both, with the same apostrophe
    And level 11, the last, reads "The North" in English and "Le Nord" in French, each with its own capitals
    And every place name has a value in both "en" and "fr"

  Scenario: No French string on this screen needs gender agreement
    Then no string in "level-select" contains "(e)", "·e" or a bracketed ending

  Scenario: Changing the language redraws the map without losing the screen
    Given the language is English
    When I open Settings from the title screen, change the language to French and come back
    Then the level select is French
    And every card is in the same state it was in
    And the scroll position is not lost
```

---

## Open questions

- ~~**`OQ-MAP-1` — the map has no data source today, and the one it should have is empty.**~~
  **Answered 2026-09-13, in both halves.** When this was written, `content/game.config.json` carried
  `"levels": []` and `unlockRules` with `initialLevels: []` and `order: []` while `content/levels/ottawa.json`
  existed, so **every level was locked, including the only one that was built**, and the map would have been a
  wall; `TN-MAP-06`'s first scenario is written to fail on exactly that and stays as the guard. The config
  then carried ten ids, four of which (`mikmaki`, `alberta`, `rockies`, `the-north`) did not match
  `TN-LEVELS`, and that was the remaining gap this question named. **It names the ten this directory names:**
  `halifax`, `peggys-cove`, `quebec-city`, `ottawa`, `toronto`, `winnipeg`, `prairie-rail`,
  `alberta-foothills`, `vancouver`, `the-north` — in `levels`, in `unlockRules.order` and in a `journey` with
  no nulls, with `initialLevels: ["halifax"]` and a document for each. `TN-MAP-06`'s fourth scenario is the
  check that keeps the two lists agreeing, because agreement reached once is not agreement maintained.
  `OQ-PASSPORT-2` is closed by the same fact; `OQ-EXAM-5` and `OQ-RESULT-2` are **not**, because they count
  *subjects* and nothing in `content/` declares those (`OQ-SUBJECTS-1`). **Kingston makes it eleven**, after
  `ottawa` in all three lists (ADR-0068 §9), and `TN-MAP-01` now names it.
- **`OQ-MAP-2` — is the map a map, or a list?** These scenarios require an ordered, vertically scrollable
  set of cards, because the journey's places east to west across a 1080×1920 portrait screen is a horizontal
  shape in a vertical window, and a horizontally panned map fails "the page does not scroll sideways" and
  needs a drag. *Recommendation:* a vertical list of cards on a painted backdrop that suggests the journey,
  with the DOM order and focus order being the journey's order. If a drawn map is wanted later, it is a
  decoration behind the same list, never the only way to choose.
- **`OQ-MAP-3` — where does the North sit on an east-to-west journey?** Levels 1 to 9 run Halifax to
  Vancouver; level 10 is The North, which is not west of Vancouver. *Recommendation:* keep it last in the
  order — it is last in the plan and last in the unlock chain — and do not print a sentence claiming the
  journey runs east to west, because level 10 makes that sentence false. No copy in this file makes that
  claim, deliberately. **Level 10 has now shipped and the card draws "The North" / « Le Nord »**, so the
  question is live rather than hypothetical and the answer is unchanged: the order is the journey's, and no
  sentence describes its direction. **When Kingston lands, the North is level 11 and the answer does not
  change.** Kingston sits between Ottawa and Toronto by longitude, so levels 1 to 10 still run roughly east to
  west and the last level is still the one that is north.
- **`OQ-MAP-4` — is `stampsToUnlockNext` one stamp or several, and does the map say which?** The copy table
  carries both shapes: `map.locked.after` names the level to finish (right when the answer is one), and
  `map.locked.stamps.*` counts stamps (right when it is more than one). *Recommendation:* keep
  `stampsToUnlockNext` at 1 and use `map.locked.after`, so the player is given a place rather than a number;
  keep the counting strings, because the config can change and a screen that has to invent a sentence when
  it does is the defect `TN-COPY-06` exists for.
- ~~**`OQ-MAP-5` — « timbre » or « tampon » for a stamp in a passport?**~~ **Answered 2026-09-08 —
  « tampon ».** Settled in `TN-PASSPORT-my-passport.md`, which is the screen the word is about, and applied
  in the same pass to `map.stamps`, `map.locked.stamps.one`, `map.locked.stamps.other` and
  `stamp.ottawa.earned` — which is what this question required. « Cachet » was the other candidate and is
  recorded as `OQ-PASSPORT-5` for the first French reviewer.
- **`OQ-MAP-6` — does the map show a level's questions or best score?** `progress.schema.json` carries
  `bestScore` per level. *Recommendation:* still no. A score on a locked or unbuilt card is noise, and a
  score on an open card invites a leaderboard, which this game does not have. Exam mode has now landed and
  put its result where it belongs — on the passport, most-recent only, no best and no average
  (`TN-PASSPORT-06`, `OQ-RESULT-4`) — which is the answer this question was waiting for.
- **`OQ-MAP-7` — can a player replay a finished level?** `TN-MAP-02` says yes, because nothing in the domain
  prevents it and a learning tool that locks its own content behind having seen it once is working against
  itself. *Recommendation:* keep it; if replay ever needs to differ from a first visit, that is a level
  story's problem, not the map's.
- **`OQ-MAP-8` — `map.levelsReady` counts documents, and one of the ten should arguably not be counted.**
  "Levels ready: 10 of 10" is true of what a player can open, and level 8 ships with eighteen verified
  `economy` questions against `CLAUDE.md`'s floor of thirty (`OQ-ALBERTA-2`), so one of those ten is *built*
  and not *shippable*. The map has no word for that and should not invent one: a card reading "Nearly ready"
  would be a fourth state, a fourth string, and a statement about the project in a place the player reads for
  a statement about themselves. *Recommendation:* leave the count as documents, and fix the fact rather than
  the sentence — twelve more verified questions, or the level comes out of `unlockRules.order`, which is
  `OQ-SPINE-8`'s second option and would make this count correct by construction. Recorded here because "ten
  of ten" is the most confident sentence on this screen and it is one bank short of being wholly true.
