# TN-MAP — Level select: ten places, three states

**Intent.** A player sees the whole journey across Canada, knows which level they can open now, knows what
would open the next one, and is never left thinking the game is broken because most of it is not built yet.

Read `README.md` in this directory first. `TN-TITLE-title-screen.md` owns the screen that opens this one;
`TN-FLOW-first-run-and-return.md` owns the route in and out; `TN-LEVELS-2-to-10-spine.md` owns each level's
subject, place name and blockers, and is where the nine place names in the copy table below come from.

## The problem this story is mostly about

Nine of the ten levels do not exist. The tenth does. A screen listing ten things where nine of them cannot be
opened has to say *why* each one cannot be opened, and there are two different whys:

| State | Means | The player's reading of it |
|---|---|---|
| **Open** | The level exists and the player has earned it | I can play this now |
| **Locked** | The level exists and the player has not earned it yet | I have something to do to open this |
| **Not made yet** | The game does not contain this level | The game is still being built; this is nothing I did |

The two locked states must be told apart by a player at a glance, by a screen reader, and by a test — and
**neither may read as a defect**. A level the player has not earned is a goal. A level nobody has built is a
statement about the project, not about the player, and saying "Locked" over it invites them to look for a
key that does not exist.

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
answering one of them with the other. See `OQ-MAP-1`: the two sources do not agree today and one of them is
empty.

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
| `map.stamps` | Stamps: {{earned}} of {{total}} | Timbres : {{earned}} sur {{total}} |
| `map.levelsReady` | Levels ready: {{ready}} of {{total}} | Niveaux prêts : {{ready}} sur {{total}} |
| `map.moreComing` | More are coming. | D'autres arrivent. |
| `map.state.open` | Open | Ouvert |
| `map.state.locked` | Locked | Verrouillé |
| `map.state.notBuilt` | Not made yet | Pas encore créé |
| `map.open.help` | You can play this now. | Vous pouvez y jouer maintenant. |
| `map.locked.after` | Finish {{level}} first. | Terminez d'abord {{level}}. |
| `map.locked.stamps.one` | Earn {{n}} more stamp to open this. | Gagnez encore {{n}} timbre pour ouvrir ce niveau. |
| `map.locked.stamps.other` | Earn {{n}} more stamps to open this. | Gagnez encore {{n}} timbres pour ouvrir ce niveau. |
| `map.notBuilt.help` | We are still making this level. | Ce niveau est encore en préparation. |
| `map.number` | Level {{n}} | Niveau {{n}} |

The level names and subject lines are owned by `TN-LEVELS-2-to-10-spine.md` (`level.<id>.title` and
`level.<id>.subtitle` for levels 1, 2 and 5 to 10) and by `TN-LEVEL-ottawa.md` (`level.ottawa.title`,
`level.ottawa.subtitle`). This screen names the keys and does not carry the words: a place name written in
two tables is a place name that will eventually differ between two screens. `common.back` is owned by
`TN-FLOW-first-run-and-return.md`; `storage.warning` by `TN-SAVE-save-and-reload.md`.

**Why `map.stamps` and `map.levelsReady` are labels with a preposition after the number.** `TN-COPY`'s
counting rule 1: a noun before the number and « sur » after it has no plural form to get wrong in either
language, and `TN-COPY`'s worked example is what happens when that rule is skipped in one language only.
`map.locked.stamps` cannot take that shape — the number is the whole message — so it carries `.one` and
`.other` rows in both languages under rule 2, and the form is chosen by `Intl.PluralRules` for the active
locale and never by `n === 1` (rule 3: at zero, French is singular and English is plural).

**Why "Not made yet" and not "Coming soon".** "Soon" is a promise with a date in it, and this project has no
date. "Not made yet" is true, it is grade-6 plain, and paired with "We are still making this level." it reads
as work in progress rather than as breakage. « Pas encore créé » and « Ce niveau est encore en préparation. »
carry the same two halves. Neither string may acquire a date, a version number or a percentage.

---

## TN-MAP-01 — The ten levels, in order, each with a state

```gherkin
Feature: The level select screen
  As a player deciding what to do next
  I want to see the whole journey and where I am in it
  So that I know what is open, what I can earn, and what does not exist yet

  Background:
    Given I have a saved game with a character
    When I open the level select

  Scenario: The screen is there and says what it is
    Then the element "level-select" is visible
    And the event "map/opened" is emitted
    And it shows the heading "Choose a level"
    And the element "playable" is not present

  Scenario: Ten levels, in the order the journey takes
    Then ten level cards are shown
    And they appear in reading order from level 1 to level 10
    And the focus order is the same as the reading order
    And each card shows "Level {{n}}" with its number
    And each card shows its place name and its subject line

  Scenario: Every card carries exactly one state, in words
    Then each card shows one of "Open", "Locked" or "Not made yet" as text
    And no card shows two state words
    And no card's state is conveyed by colour, by an icon or by opacity alone
    And each card reports "data-state" equal to "open", "locked" or "not-built"

  Scenario: The screen says how much of the game exists
    Then it shows "Levels ready: 1 of 10"
    And it shows "More are coming."
    And it shows "Stamps: 0 of 10"

  Scenario: One thumb, portrait, no sideways scroll
    Given the viewport is 390 x 844
    Then the page does not scroll sideways
    And every card and every control is at least 44 CSS px wide and tall
    And reaching level 10 needs only a vertical scroll
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

```gherkin
Feature: A level the game does not contain
  Background:
    Given no level document exists for level 7
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
    And where the place is not decided yet, no place name is shown and no placeholder text is drawn
    And nothing reads as "TBD", "coming soon", "???" or an empty box

  Scenario: A build with one level is a normal state of this game
    Given exactly one level document exists
    Then nine cards report "data-state" equal to "not-built"
    And the screen shows "Levels ready: 1 of 10"
    And the screen shows "More are coming."
    And no scenario in this file requires a level document that does not exist
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
    Given no level document exists
    When I open the level select
    Then ten cards are shown, all reporting "data-state" equal to "not-built"
    And the screen shows "Levels ready: 0 of 10"
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
    Then focus reaches all ten cards, in level order
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
    And the level select is visible

  Scenario: Nothing scans and nothing expires
    When I do nothing for two minutes
    Then the highlight has not moved
    And no card has been chosen
    And nothing on screen counts down

  Scenario: Short press moves through every card and wraps
    When I press the switch briefly ten times
    Then the highlight has visited all ten cards in order
    And each card's name and state are announced as the highlight arrives
    When I press the switch briefly again
    Then the highlight moves on to "Back" and then wraps to the first card

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
    Then I can reach every card, open the one that is open, and leave the screen
```

## TN-MAP-09 — The map with a screen reader

```gherkin
Feature: Announcing the map
  Background:
    Given the level select is visible

  Scenario: The screen is a named region or dialog inside a landmark
    Then "level-select" has an accessible name that is not empty
    And every piece of visible text on the page is inside a landmark
    And exactly one element on the page has an "aria-live" attribute
    And any canvas on the page is "aria-hidden"

  Scenario: The ten cards are a list, and their order is the journey
    Then the cards are exposed as a list of ten items
    And their order in the accessibility tree is level 1 to level 10

  Scenario: A card's accessible name carries its number, its place and its state
    Then the accessible name of "level-card-ottawa" contains "Level 4", "Ottawa" and "Open"
    And the accessible name of a card that is not built contains "Not made yet"
    And no card's state has to be inferred from styling

  Scenario: The reason is a description, not a tooltip
    Then each card's help sentence is its accessible description
    And it is read after the name, not instead of it

  Scenario: Arriving and choosing are announced once
    When the level select opens
    Then "#tn-live-region" reads the screen's name and how many levels are ready, once
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
    And all ten cards are reachable by scrolling down

  Scenario: High contrast
    Given "High contrast" is on
    Then each card's state is distinguishable without colour
    And every state word meets the contrast requirement against its background

  Scenario: The longest state sentence still fits
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Ce niveau est encore en préparation." is visible on its card
    And the whole of "Gagnez encore 2 timbres pour ouvrir ce niveau." is visible on its card
```

## TN-MAP-11 — The map in French

```gherkin
Feature: The level select in French
  Background:
    Given the language is French
    And the level select is visible

  Scenario: The screen is French
    Then the heading reads "Choisir un niveau"
    And the back control reads "Retour"
    And the counts read "Niveaux prêts : 1 sur 10" and "Timbres : 0 sur 10"
    And it shows "D'autres arrivent."
    And there is a space before each colon
    And no English word appears in "level-select"

  Scenario: Every state word is French
    Then the state words used are only "Ouvert", "Verrouillé" and "Pas encore créé"
    And no card shows "Open", "Locked" or "Not made yet"

  Scenario: The help sentences are French
    Then an open card shows "Vous pouvez y jouer maintenant."
    And a card that is not built shows "Ce niveau est encore en préparation."
    And a locked card shows "Terminez d'abord Ottawa." or a "Gagnez encore ..." sentence

  Scenario: The stamp sentence agrees with its number in French
    Given the unlock rules ask for 2 stamps and I have earned 1
    Then the card shows "Gagnez encore 1 timbre pour ouvrir ce niveau."
    And it does not show "1 timbres"
    Given I have earned 0 stamps
    Then the card shows "Gagnez encore 2 timbres pour ouvrir ce niveau."

  Scenario: Place names are what each language calls the place
    Then level 4 reads "Ottawa" in both languages
    And level 3 reads "Québec City" in English and "Ville de Québec" in French
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

- **`OQ-MAP-1` — the map has no data source today, and the one it should have is empty.**
  `content/game.config.json` carries `"levels": []` and `unlockRules` with `initialLevels: []` and
  `order: []`, while `content/levels/ottawa.json` exists. `unlockedLevelIds` on that config returns nothing,
  so as the repository stands **every level is locked, including the only one that is built**, and the map
  would be a wall. `TN-MAP-06`'s first scenario is written to fail on exactly that.
  *Recommendation:* `game.config.json` carries all ten map entries in `levels` and all ten ids in
  `unlockRules.order`, with `initialLevels: ["ottawa"]` until level 1 ships; the catalogue keeps answering
  "is it built". Ten entries in a config for one level that exists is the point — the map is the plan, the
  catalogue is the state. Routed to the architect and the plan owner; `content/` and `docs/plan/` are not
  this file's to edit.
- **`OQ-MAP-2` — is the map a map, or a list?** These scenarios require an ordered, vertically scrollable
  set of cards, because ten places east to west across a 1080×1920 portrait screen is a horizontal shape in a
  vertical window, and a horizontally panned map fails "the page does not scroll sideways" and needs a drag.
  *Recommendation:* a vertical list of cards on a painted backdrop that suggests the journey, with the DOM
  order and focus order being the journey's order. If a drawn map is wanted later, it is a decoration behind
  the same list, never the only way to choose.
- **`OQ-MAP-3` — where does the North sit on an east-to-west journey?** Levels 1 to 9 run Halifax to
  Vancouver; level 10 is The North, which is not west of Vancouver. *Recommendation:* keep it last in the
  order — it is last in the plan and last in the unlock chain — and do not print a sentence claiming the
  journey runs east to west, because level 10 makes that sentence false. No copy in this file makes that
  claim, deliberately.
- **`OQ-MAP-4` — is `stampsToUnlockNext` one stamp or several, and does the map say which?** The copy table
  carries both shapes: `map.locked.after` names the level to finish (right when the answer is one), and
  `map.locked.stamps.*` counts stamps (right when it is more than one). *Recommendation:* keep
  `stampsToUnlockNext` at 1 and use `map.locked.after`, so the player is given a place rather than a number;
  keep the counting strings, because the config can change and a screen that has to invent a sentence when
  it does is the defect `TN-COPY-06` exists for.
- **`OQ-MAP-5` — « timbre » or « tampon » for a stamp in a passport?** `TN-QUEST` fixed « le timbre
  d'Ottawa », and this file follows it rather than introducing a second word. A « timbre » is a postage
  stamp; the mark an officer puts in a passport is a « tampon ». *Recommendation:* `TN-QUEST` owns the word
  and decides; if it changes, `map.stamps` and `map.locked.stamps.*` change with it in the same commit. Two
  files with two words for one thing is the failure this note exists to prevent.
- **`OQ-MAP-6` — does the map show a level's questions or best score?** `progress.schema.json` carries
  `bestScore` per level. *Recommendation:* not in this slice. A score on a locked or unbuilt card is noise,
  and a score on an open card invites a leaderboard, which this game does not have. Revisit with Exam mode
  (F1), which is where a score means something.
- **`OQ-MAP-7` — can a player replay a finished level?** `TN-MAP-02` says yes, because nothing in the domain
  prevents it and a learning tool that locks its own content behind having seen it once is working against
  itself. *Recommendation:* keep it; if replay ever needs to differ from a first visit, that is a level
  story's problem, not the map's.
