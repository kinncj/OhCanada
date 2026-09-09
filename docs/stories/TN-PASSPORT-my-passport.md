# TN-PASSPORT — My passport: ten stamps, and how much is left

**Intent.** A player can see everything they have earned in one place, understand at a glance how much of the
journey is left, and never be told that a level nobody has built yet is something they failed to unlock.

`TN-HUD-02`'s menu has offered "See my passport" since slice 1 and no story stood behind it. `TN-QUEST-04`
requires the Ottawa stamp to appear in `passport`, `TN-SAVE-01` requires it to still be there after a reload,
and `progress.schema.json` records `stampEarnedAt` per level. This file is the screen those three describe.

Read `README.md` in this directory first. `TN-MAP-level-select.md` owns the rule that decides what state a
level is in and this file reuses it rather than inventing a second vocabulary;
`TN-QUEST-parliament-hill.md` owns earning a stamp; `TN-RESULT-exam-results.md` owns the exam result this
screen keeps; `TN-NAMES-naming-real-places.md` owns what a stamp may be named after.

## The three states, reused and not reinvented

`TN-MAP`'s rule, in its own words: **if no level document exists for the id, the state is "not made yet", and
that wins over everything, including the unlock rules.** The passport uses the same first clause, the same
words and the same key (`map.state.notBuilt`, `map.notBuilt.help`), because a player who has read "Not made
yet" on the map must not meet a second phrase for the same fact one screen later.

| State | `data-state` | Means |
|---|---|---|
| **Earned** | `earned` | The player finished this level's task |
| **Not earned yet** | `not-earned` | The level exists and its stamp has not been earned |
| **Not made yet** | `not-built` | The game does not contain this level |

The rule, in order:

1. **If the stamp has been earned, the state is "earned".** This is the one place the passport differs from
   the map, and it differs on purpose: the map says what a player can do now, the passport says what they
   did. A stamp is never taken away because a build no longer contains the level it came from.
2. **Otherwise, if no level document exists for the id, the state is "not made yet".**
3. **Otherwise the state is "not earned yet".**

**There is no "locked" state on the passport.** A level that exists and is locked shows "Not earned yet",
which is true, and the map is where locks are explained. A fourth word here would be a fourth thing to
translate and a fourth thing to get wrong.

## The word for a stamp in French — settled

`OQ-MAP-5` has been open since the map shipped: `TN-QUEST` wrote « le timbre d'Ottawa », `TN-MAP` followed it
rather than introduce a second word, and both flagged that **« timbre » is a postage stamp**. The mark a
border officer puts in a passport is **« un tampon »**.

**Settled here, in favour of « tampon », because this is the screen the word is about.** Every French string
in this directory that means a passport stamp now reads « tampon », and the three files that carried the old
word have been changed in the same pass:

| Key | Was | Is | Owned by |
|---|---|---|---|
| `stamp.ottawa.earned` | Vous avez obtenu le timbre d'Ottawa. | Vous avez obtenu le tampon d'Ottawa. | `TN-QUEST` |
| `map.stamps` | Timbres : {{earned}} sur {{total}} | Tampons : {{earned}} sur {{total}} | `TN-MAP` |
| `map.locked.stamps.one` | Gagnez encore {{n}} timbre pour ouvrir ce niveau. | Gagnez encore {{n}} tampon pour ouvrir ce niveau. | `TN-MAP` |
| `map.locked.stamps.other` | Gagnez encore {{n}} timbres pour ouvrir ce niveau. | Gagnez encore {{n}} tampons pour ouvrir ce niveau. | `TN-MAP` |

« Tampon » is masculine, as « timbre » was, so no article, adjective or plural row changes shape — only the
noun. « Cachet » was the other candidate and is what an official seal is called; it is a register above
grade 6 and it is not the word a newcomer will have met at a border. `OQ-PASSPORT-5` records that a French
reviewer may still prefer it.

**This is a change to shipped copy.** `app/ui/copy.ts` carries the French strings above and is not this
directory's to edit; the change is reported to the UI agent rather than made here.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-PASSPORT-07` |
| Single switch | `TN-PASSPORT-08` |
| Screen reader | `TN-PASSPORT-09` |
| Reduced motion | `TN-PASSPORT-10` |
| 200 % text | `TN-PASSPORT-10` |
| Bilingual | `TN-PASSPORT-11` |
| Failure path | `TN-PASSPORT-04` (a level nobody built), `TN-PASSPORT-05` (a stamp whose level is gone, and a passport with no data) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `passport.open` | See my passport | Voir mon passeport |
| `passport.title` | My passport | Mon passeport |
| `passport.intro` | You earn a stamp when you finish a level's task. | Vous obtenez un tampon lorsque vous terminez la mission d'un niveau. |
| `passport.state.earned` | Earned | Obtenu |
| `passport.state.notEarned` | Not earned yet | Pas encore obtenu |
| `passport.empty.title` | No stamps yet | Aucun tampon pour l'instant |
| `passport.empty.body` | Finish a level to earn your first stamp. | Terminez un niveau pour obtenir votre premier tampon. |
| `passport.exam.title` | Practice exam | Examen pratique |
| `passport.exam.none` | You have not taken the practice exam yet. | Vous n'avez pas encore fait l'examen pratique. |
| `passport.exam.last` | Your last practice exam | Votre dernier examen pratique |

**`passport.open` moved here from `TN-QUEST-parliament-hill.md` on 2026-09-08.** The wording is unchanged —
"See my passport" / « Voir mon passeport » — and the key now lives in the file that owns the screen. `TN-HUD`
and `TN-QUEST` name the key and point here, as they already do for nine other keys.

Keys this screen draws and does not own:

| Key | Owned by |
|---|---|
| `map.stamps`, `map.levelsReady`, `map.moreComing`, `map.state.notBuilt`, `map.notBuilt.help`, `map.number` | `TN-MAP-level-select.md` |
| `level.ottawa.title` | `TN-LEVEL-ottawa.md` |
| `level.<id>.title`, `level.10.title` | `TN-LEVELS-2-to-10-spine.md` |
| `exam.result.passed.title`, `exam.result.notYet.title`, `exam.result.score`, `exam.result.noTimer`, `exam.result.withTimer` | `TN-RESULT-exam-results.md` |
| `exam.open` | `TN-EXAM-starting-and-answering.md` |
| `common.back`, `common.close` | `TN-FLOW-first-run-and-return.md`, `TN-SET-settings.md` |

**`map.stamps` is the count on this screen too**, and that is deliberate: "Stamps: 3 of 10" is the same fact
on the map and in the passport, and a second key would let the two disagree. Its shape — noun, number,
preposition — is `TN-COPY`'s counting rule 1, so it needs no plural rows and cannot draw "1 stamps" in either
language.

---

## TN-PASSPORT-01 — Opening the passport

```gherkin
Feature: The passport screen
  As a player who wants to see how far I have got
  I want one page with everything I have earned
  So that my progress is somewhere I can look, not something I have to remember

  Background:
    Given I have a saved game

  Scenario: It is reachable from the level's menu
    Given the Ottawa level is playable
    When I tap "menu-button" and then "See my passport"
    Then the element "passport" is visible
    And the event "passport/opened" is emitted
    And "data-paused" is "true"

  Scenario: It is reachable from the level select, where the stamp count already is
    Given the element "level-select" is visible
    Then a control "See my passport" is offered as "passport-open"
    When I tap it
    Then the element "passport" is visible

  Scenario: It is reachable when a quest has just been finished
    Given the element "quest-complete-card" is visible
    When I tap "See my passport"
    Then the element "passport" is visible
    And it contains "stamp-ottawa"

  Scenario: The screen says what it is and how it works
    Then it shows the heading "My passport"
    And it shows "You earn a stamp when you finish a level's task."
    And it shows "Stamps: 0 of 10"
    And it shows "Levels ready: 1 of 10"
    And it shows "More are coming."

  Scenario: Ten slots, in the order the journey takes
    Then ten stamp slots are shown
    And they appear in reading order from level 1 to level 10
    And the focus order is the same as the reading order
    And each slot shows "Level {{n}}" with its number
    And each slot reports "data-state" equal to "earned", "not-earned" or "not-built"

  Scenario: One thumb, portrait, no sideways scroll
    Given the viewport is 390 x 844
    Then the page does not scroll sideways
    And every slot and control is at least 44 CSS px wide and tall
    And reaching the tenth slot needs only a vertical scroll
    And nothing needs a swipe, a drag, a pinch or a double tap

  Scenario: Leaving goes back where I came from
    Given I opened the passport from the level's menu
    When I tap "Back"
    Then the element "passport" is gone
    And "data-paused" is "false"
    And focus returns to "menu-button"
    Given I opened it from the level select
    When I tap "Back"
    Then the element "level-select" is visible in the state I left it in

  Scenario: Nothing on this screen counts down
    When I do nothing for two minutes
    Then the passport is unchanged
    And nothing has been chosen for me
```

## TN-PASSPORT-02 — A stamp I have earned

```gherkin
Feature: An earned stamp
  Background:
    Given I have earned the Ottawa stamp
    And the element "passport" is visible

  Scenario: It says it is earned, in words
    Then the element "stamp-ottawa" is visible
    And its slot reports "data-state" equal to "earned"
    And it shows "Earned" as text
    And it shows "Ottawa"
    And the stamp is distinguishable from an unearned slot by a shape and a label, not by colour alone

  Scenario: A stamp is a picture and a name, never a picture alone
    Then "stamp-ottawa" has a text label naming Ottawa
    And the picture is not the only way to know which level it is for

  Scenario: The count agrees with the slots
    Then the screen shows "Stamps: 1 of 10"
    And exactly one slot reports "data-state" equal to "earned"

  Scenario: A stamp is named after a place, not a building
    Then no stamp's label is the name of a landmark, a hotel or a business
    And the rule is the one in TN-NAMES-01

  Scenario: The stamp survives a reload
    When I close the tab and open the game again and open the passport
    Then "stamp-ottawa" is still there and still reads "Earned"
    And the count still reads "Stamps: 1 of 10"

  Scenario: A stamp cannot be earned twice
    Given I engage the officer again after finishing the quest
    Then the passport still contains exactly one Ottawa stamp
    And the count is unchanged
```

## TN-PASSPORT-03 — A stamp I have not earned yet

```gherkin
Feature: A level that exists and has not been finished
  Background:
    Given the Ottawa level document exists
    And I have not earned its stamp
    And the element "passport" is visible

  Scenario: It says what is missing, without saying I did something wrong
    Then that slot reports "data-state" equal to "not-earned"
    And it shows "Not earned yet"
    And it shows the level's place name
    And it does not show "Locked"
    And it does not show an error, a warning or a red state

  Scenario: An empty slot is still a slot
    Then the slot is drawn in the same position and at the same size as an earned one
    And it is not left blank
    And nothing reads as "TBD", "???" or an empty box

  Scenario: A locked level is not a fourth state here
    Given a level exists and is not in the unlocked levels
    Then its slot reports "data-state" equal to "not-earned"
    And the passport does not explain the lock
    And the level select is where that is explained, as TN-MAP-03 describes

  Scenario: A brand-new player sees an honest, empty passport
    Given I have earned no stamps
    Then the element "passport-empty" shows "No stamps yet"
    And it shows "Finish a level to earn your first stamp."
    And the screen shows "Stamps: 0 of 10"
    And no slot is missing from the ten
```

## TN-PASSPORT-04 — A level that is not made yet

```gherkin
Feature: The same precedence the map uses
  Background:
    Given no level document exists for level 7
    And the element "passport" is visible

  Scenario: It says the game is still being made, in the map's words
    Then that slot reports "data-state" equal to "not-built"
    And it shows "Not made yet"
    And it shows "We are still making this level."
    And those are the same two strings the level select draws

  Scenario: It does not say I failed to earn anything
    Then it does not show "Not earned yet"
    And it does not show "Locked"
    And it names no stamp, no level to finish and nothing for me to do

  Scenario: It is not drawn as an error
    Then nothing on the slot says "error", "failed", "missing", "unavailable" or "not found"
    And no error icon, warning triangle or red state is drawn on it
    And no message anywhere on the screen suggests something went wrong

  Scenario: A build with one level is a normal state of this game
    Given exactly one level document exists
    Then nine slots report "data-state" equal to "not-built"
    And the screen shows "Levels ready: 1 of 10"
    And the screen shows "More are coming."
    And the stamp count still counts out of 10

  Scenario: A slot with no place name draws no placeholder
    Given a level has no place name yet, as TN-LEVELS leaves levels 2 and 10
    Then no place name is shown on that slot
    And no placeholder text is drawn in its place
    And the slot still shows its level number

  Scenario: The distinction is derived, not authored
    Then no level document, locale string or config field declares a slot as "not made yet"
    And the state follows only from whether a document exists and whether the stamp was earned
    And adding the missing level document changes the slot with no other edit
```

## TN-PASSPORT-05 — A stamp is never taken away (failure path)

```gherkin
Feature: The one place the map's precedence does not apply
  Scenario: An earned stamp for a level this build no longer has
    Given I earned a stamp for a level
    And this build has no document for that level
    When I open the passport
    Then that slot reports "data-state" equal to "earned"
    And it shows "Earned"
    And it does not show "Not made yet"
    And the count includes it

  Scenario: The same level on the map is still "not made yet"
    Then the level select shows that level as "Not made yet", as TN-MAP-04 requires
    And the two screens are answering two different questions and neither is wrong

  Scenario: A stamp with no place name in this build
    Given the level's title string is not in this build
    Then the slot shows the stamp and its level number
    And no place name is shown, and no placeholder is drawn
    And nothing reads as an error

  Scenario: A save with more stamps than there are levels
    Given the saved document records a stamp for an id the map does not name
    When I open the passport
    Then ten slots are still shown
    And the extra stamp is not drawn as an eleventh slot
    And the count never exceeds the total
    And the content check has already reported the id, as TN-MAP-06 describes

  Scenario: The passport opens when there is nothing to show
    Given the save has no levels recorded at all
    When I open the passport
    Then ten slots are shown, none of them earned
    And the empty state is shown
    And no error screen is shown

  Scenario: Storage cannot be read
    Given local storage cannot be read or written
    When I open the passport
    Then ten slots are shown, none earned
    And "storage-warning" is visible
    And no message claims progress was lost
```

## TN-PASSPORT-06 — The exam on the passport

```gherkin
Feature: The one place an exam result is kept
  Scenario: Before any exam has been taken
    Given I have never finished an exam
    When I open the passport
    Then the element "passport-exam" shows "Practice exam"
    And it shows "You have not taken the practice exam yet."
    And a control opens the exam, as TN-EXAM-01 describes

  Scenario: After an exam
    Given my most recent finished exam had 17 right out of 20 with the timer on
    Then "passport-exam" shows "Your last practice exam"
    And it shows "You passed"
    And it shows "Right answers: 17 out of 20"
    And it shows "You took this exam with the timer."

  Scenario: The most recent result is the one shown, not the best
    Given I passed an exam and then did not pass a later one
    Then "passport-exam" shows "Not this time"
    And it shows the later exam's numbers
    And no best score, average, streak or attempt count is shown

  Scenario: An unfinished exam is not a result
    Given I have an unfinished exam
    Then "passport-exam" shows no score for it
    And it offers the route described in TN-ATTEMPT-03
    And nothing on the passport counts down towards losing it

  Scenario: An exam earns no stamp
    Given I passed an exam and have earned no level stamps
    Then the stamp count still reads "Stamps: 0 of 10"
    And no slot reports "data-state" equal to "earned"

  Scenario: The exam line is not shown where the exam cannot run
    Given fewer verified questions exist than the exam needs
    Then "passport-exam" shows the not-ready message from TN-EXAM-05
    And it does not offer to start an exam that cannot start
```

## TN-PASSPORT-07 — The passport from the keyboard

```gherkin
Feature: Keyboard-only passport
  Background:
    Given I am using a keyboard only
    And the element "passport" is visible

  Scenario: Every slot is reachable, whatever its state
    When I press "Tab" through the screen
    Then focus reaches all ten slots, in level order
    And a slot that is not earned and a slot that is not built both receive focus
    And each focused slot has a focus indicator that is not colour alone

  Scenario: A slot is readable, not activatable
    Then activating a slot does nothing and announces nothing false
    And no slot claims to open a level
    And any slot that is not a control is not in the tab order twice

  Scenario: The controls are reachable and operable
    Then the exam control and "Back" are reachable with "Tab"
    And each activates with "Enter"

  Scenario: Escape closes it and gives focus back
    When I press "Escape"
    Then the passport closes
    And focus returns to the control that opened it
```

## TN-PASSPORT-08 — The passport with one switch

```gherkin
Feature: Single-switch passport
  Background:
    Given single-switch mode is on
    And the element "passport" is visible

  Scenario: Nothing scans and nothing expires
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing on screen counts down

  Scenario: Short press moves through the screen and wraps
    When I press the switch briefly until the highlight has been everywhere
    Then it has visited the exam control and "Back"
    And each item's name and state are announced as the highlight arrives
    And it wraps to the first item

  Scenario: A long press takes the highlighted control
    Given the highlight is on "Back"
    When I hold the switch past the hold-to-choose threshold
    Then the passport closes

  Scenario: The whole screen is usable with the switch alone
    When I use only short and long presses
    Then I can read every slot's state, reach the exam and leave the screen
```

## TN-PASSPORT-09 — The passport with a screen reader

```gherkin
Feature: Announcing the passport
  Background:
    Given the element "passport" is visible

  Scenario: The screen is named, inside a landmark
    Then "passport" has an accessible name that is not empty
    And every piece of visible text on the page is inside a landmark
    And any canvas on the page is "aria-hidden"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The ten slots are a list, in journey order
    Then the slots are exposed as a list of ten items
    And their order in the accessibility tree is level 1 to level 10

  Scenario: A slot's name carries its number, its place and its state
    Then the accessible name of the Ottawa slot contains "Level 4", "Ottawa" and "Earned"
    And a slot that is not built contains "Not made yet"
    And a slot that is not earned contains "Not earned yet"
    And no slot's state has to be inferred from styling

  Scenario: A stamp picture is not read as a picture
    Then each stamp image is either "aria-hidden" with a text label beside it,
      or has alternative text that is the level's place name
    And no stamp is announced as "image", "graphic" or an empty string

  Scenario: Arriving is announced once
    When the passport opens
    Then "#tn-live-region" reads the screen's name and the stamp count, once
    And it is not repeated while I stay on the screen

  Scenario: axe-core is clean on this screen
    When axe-core runs against the whole page
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
```

## TN-PASSPORT-10 — Reduced motion, 200 % text and high contrast

```gherkin
Feature: The passport honours the accessibility settings
  Scenario: Reduced motion
    Given reduced motion is on
    When the passport opens
    Then it appears with no slide, fade or scale
    And no stamp thumps, spins, drops or fades in
    And a newly earned stamp is marked by its state word, not by an animation

  Scenario: A newly earned stamp is obvious without motion
    Given I have just earned the Ottawa stamp
    When I open the passport
    Then "stamp-ottawa" shows "Earned"
    And the earning was announced in "#tn-live-region", as TN-QUEST-08 requires
    And nothing on the screen depends on having seen it arrive

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the page does not scroll sideways
    And every slot's number, place name and state word are fully visible
    And no label is truncated with an ellipsis
    And all ten slots are reachable by scrolling down
    And every control is still at least 44 CSS px wide and tall

  Scenario: The longest French sentence still fits
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Vous obtenez un tampon lorsque vous terminez la mission d'un niveau." is visible
    And the whole of "Ce niveau est encore en préparation." is visible on its slot

  Scenario: High contrast
    Given "High contrast" is on
    Then an earned slot is distinguishable from an unearned one without colour
    And every state word meets the contrast requirement against its background
```

## TN-PASSPORT-11 — The passport in French

```gherkin
Feature: The passport in French
  Background:
    Given the language is French
    And the element "passport" is visible

  Scenario: The screen is French
    Then the heading reads "Mon passeport"
    And it shows "Vous obtenez un tampon lorsque vous terminez la mission d'un niveau."
    And it shows "Tampons : 0 sur 10"
    And it shows "Niveaux prêts : 1 sur 10"
    And it shows "D'autres arrivent."
    And there is a space before each colon
    And no English word appears in "passport"

  Scenario: The word for a stamp is "tampon" everywhere
    Then no string on this screen contains "timbre"
    And the count reads "Tampons : {{earned}} sur {{total}}"
    And the empty state reads "Aucun tampon pour l'instant"
    And it shows "Terminez un niveau pour obtenir votre premier tampon."

  Scenario: The same word is used by the other two screens
    Then the level select's stamp count reads "Tampons : 0 sur 10"
    And the level select's locked sentence reads "Gagnez encore 1 tampon pour ouvrir ce niveau."
    And the quest completion card reads "Vous avez obtenu le tampon d'Ottawa."
    And no screen in the game uses "timbre" for a passport stamp

  Scenario: Every state word is French
    Then the state words used are only "Obtenu", "Pas encore obtenu" and "Pas encore créé"
    And no slot shows "Earned", "Not earned yet" or "Not made yet"

  Scenario: The not-made-yet slot uses the map's French, word for word
    Then it shows "Pas encore créé"
    And it shows "Ce niveau est encore en préparation."

  Scenario: Place names are what each language calls the place
    Then level 4 reads "Ottawa" in both languages
    And level 3 reads "Ville de Québec" in French
    And every place name shown has a value in both "en" and "fr"

  Scenario: The exam line is French
    Given my most recent finished exam had 17 right out of 20 without the timer
    Then "passport-exam" shows "Votre dernier examen pratique"
    And it shows "Vous avez réussi"
    And it shows "Bonnes réponses : 17 sur 20"
    And it shows "Vous avez fait cet examen sans chronomètre."
    Given I have never finished an exam
    Then it shows "Vous n'avez pas encore fait l'examen pratique."

  Scenario: No French string here needs gender agreement
    Then no string in "passport" contains "(e)", "·e" or a bracketed ending

  Scenario: Changing the language redraws the passport without losing the screen
    Given the language is English
    When I change the language to French from Settings and come back
    Then the passport is French
    And every slot is in the same state it was in
    And the scroll position is not lost
```

---

## Open questions

- **`OQ-PASSPORT-1` — should a stamp show the date it was earned?** `progress.schema.json` records
  `stampEarnedAt`, a real passport stamp is a date, and nothing here draws one. *Recommendation:* not in this
  slice. A date is another `Intl` surface, another string to fit at 200 %, and the only question it answers
  is one nobody asked. Revisit if the passport ever becomes something a player wants to look back through
  rather than a progress screen — and if it does, the date is formatted by `Intl.DateTimeFormat` for the
  active locale and never assembled from parts.
- **`OQ-PASSPORT-2` — the passport counts to ten and the data does not agree on which ten.**
  `content/game.config.json` names ten ids in `unlockRules.order`, including `mikmaki`, `alberta`, `rockies`
  and `the-north`; `TN-LEVELS-2-to-10-spine.md` names `alberta-foothills` and `vancouver`, and deliberately
  gives **no id at all** to levels 2 and 10, because naming a nation's territory as the setting of a level
  nobody may build yet states a plan this project has not earned the right to state. So four of the ten slots
  cannot be matched to a story, and two of them carry ids the story owner declined to write.
  *Recommendation:* reconcile the ids in `game.config.json` with `TN-LEVELS` before the passport is built, and
  keep levels 2 and 10 as positions in the order rather than as named places. Routed to the architect and the
  plan owner; `content/` is not this directory's to edit. Same gap as `OQ-EXAM-5` and `OQ-RESULT-2`.
- **`OQ-PASSPORT-3` — is the passport reachable from the title screen?** It is not, today: the routes are the
  level's menu, the level select and the quest completion card, so a returning player has to open the map to
  see their stamps. `OQ-TITLE-2` says the title screen shows no progress, and this file agrees with it.
  *Recommendation:* keep the level select as the passport's home, since it already carries the stamp count.
  Revisit only if the map ever stops being a screen every player passes through.
- **`OQ-PASSPORT-4` — what does a stamp look like when its level is not built?** Nothing here draws an empty
  stamp shape for a level that does not exist, because a dotted outline reads as a slot the player could fill.
  *Recommendation:* the same treatment `TN-MAP-04` gives an unbuilt card — the state word, the sentence, and
  no picture at all. If the art wants a visual placeholder, it must be distinguishable from an unearned stamp
  by shape and not by opacity.
- **`OQ-PASSPORT-5` — « tampon » or « cachet »?** Settled above as « tampon », and « cachet » is the
  considered alternative: it is what an official seal is called, it is a register above grade 6, and it is not
  the word a newcomer meets at a border. *Recommendation:* keep « tampon » and put both in front of the first
  French reviewer. What must not come back is « timbre », which is a postage stamp in every register.
- **`OQ-PASSPORT-6` — does the passport belong in the exam's menu too?** A player in the middle of an exam
  cannot reach it. *Recommendation:* no. The exam's menu carries Settings, the timer control and "Leave the
  exam" (`OQ-TIMER-4`), and a progress screen in the middle of a measurement is a distraction with no purpose.
