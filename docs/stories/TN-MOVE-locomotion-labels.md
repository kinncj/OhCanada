# TN-MOVE — What the HUD calls the way you move

**Intent.** Whatever level a player opens, the HUD names how they are moving, in their language, and it is
never blank.

Read `README.md` in this directory first. The HUD strip this file draws into is `TN-HUD-hud-and-menu.md`
(`hud-mode-label`). `TN-LEVELS-2-to-10-spine.md` decides *which* mode each level uses; this file decides what
each mode is **called**, once, for every level that uses it.

## Why this is one shared table and not a row in four level stories

A loading sentence belongs to a level. A mode label does not: it belongs to a **mode**, and a mode is shared.
Today's four built level documents declare four modes between them, and two of the four levels declare the
same one:

| Level document | `locomotion[].mode`, in the order the document declares them |
|---|---|
| `content/levels/halifax.json` | `walk` |
| `content/levels/quebec-city.json` | `toboggan`, `walk` |
| `content/levels/ottawa.json` | `skate`, `walk` |
| `content/levels/toronto.json` | `bike` |

`walk` is used by three of the four. Written in each level's own story it would be written three times, and
`README.md`'s rule is that two tables carrying the same words is how they stop being the same words. So the
labels live here, and each level story names the key and points at this file.

This is also what ADR-0010 already decided and what the port already assumes: a mode label is *engine
vocabulary a level uses*, not *text a level owns* — "Skating is the name of a mode eight levels may offer" —
which is why `LocomotionTuning.labelKey` is a **key** and not inline `localizedText`. ADR-0023 adds the
other half: opening the set of modes to content means "adding a mode still costs a locale key", and this is
the table that key is written in.

**`locomotion.skate.label` moved here from `TN-LEVEL-ottawa.md`.** It was written there when Ottawa was the
only level with a story, and it is the same row this table would have had to repeat. Ottawa's file points
here now. Nothing about the wording changed.

## The rule that decides which rows exist

**A mode gets a label in this table when a level document declares it, and not before.**

- `content/game.config.json#/locomotionModes` lists nine legal modes (ADR-0023). Five of them —
  `canoe`, `train`, `horse`, `skateboard`, `dogsled` — are declared by no level document, so they have no
  row. Writing labels for them would be writing copy for levels nobody has scoped, and two of those five
  (`canoe`, `dogsled`) belong to levels `TN-LEVELS` deliberately leaves unscoped under
  `docs/content-review.md` §1 and `OQ-REVIEW-10`. A blocked level with its HUD copy already written reads as
  schedulable, and a plan that reads as schedulable gets scheduled.
- The row is added in the same change as the level document that needs it, and `TN-MOVE-02` is the gate that
  makes that mandatory rather than remembered.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `locomotion.walk.label` | Walking | Marche |
| `locomotion.toboggan.label` | Sledding | Glissade |
| `locomotion.skate.label` | Skating | Patinage |
| `locomotion.bike.label` | Biking | Vélo |

**Every row is one word, and the shape is the same in both languages: the name of the activity, not an
instruction and not a sentence.** "Skating", « Patinage » set that shape in `TN-LEVEL-ottawa.md` and the
three new rows follow it. The label answers "how am I getting about?" It never says "Press and hold to
move" — that is the control's business (`OQ-INPUT-1`), not the strip's — and it never names the level.

**Why these words and not the near neighbours.**

- **`walk` → "Walking" / « Marche ».** The plainest word in either language, and « Marche » is the noun that
  matches « Patinage ». Not « À pied », which is a phrase where every other row is a noun.
- **`toboggan` → "Sledding" / « Glissade ».** "Tobogganing" is the word that matches the mode's id and it is
  a harder word than the thing it describes; the bar is CLB 4 / grade 6 and "sledding" clears it. In Québec
  French the activity is « la glissade » (« faire de la glissade »), which is why the French is not
  « Toboggan » — that is the object you sit on, and the label names what you are doing. See `OQ-MOVE-1`.
- **`bike` → "Biking" / « Vélo ».** "Cycling" is the sport; "biking" is the word a newcomer already has.
  « Vélo » is the everyday Canadian French word and needs no article in a label. Not « Cyclisme », which is
  a race.
- **No row needs gender agreement in French**, and none may acquire one: every value is a bare noun, so
  `docs/content-review.md` §8.6's bracketed forms cannot appear here (`TN-MOVE-06`).

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-MOVE-03` — the label is text, never a stop on the Tab route |
| Single switch | `TN-MOVE-03` — the label is never in the highlight ring, and nothing is chosen by reading it |
| Screen reader | `TN-MOVE-04` |
| Reduced motion | `TN-MOVE-05` — the word is the signal; nothing about the mode is told by an animation |
| 200 % text | `TN-MOVE-05` |
| Bilingual | `TN-MOVE-06` |
| Failure path | `TN-MOVE-02` — a mode with no row |

---

## TN-MOVE-01 — The HUD says how you are moving, on every level

```gherkin
Feature: The mode strip is filled in
  As a player who has just arrived in a level
  I want the HUD to tell me how I get about here
  So that I know what holding the screen is going to do

  Scenario Outline: Each built level names its own mode
    Given the <level> level is playable
    Then "scene-state" reports "data-mode" equal to "<mode>"
    And the element "hud-mode-label" reads "<label>"
    And it is not empty
    And it does not read the mode's id

    Examples:
      | level       | mode     | label    |
      | Halifax     | walk     | Walking  |
      | Québec City | toboggan | Sledding |
      | Ottawa      | skate    | Skating  |
      | Toronto     | bike     | Biking   |

  Scenario: A level that declares two modes names the one in force
    Given the Ottawa level declares "skate" and then "walk"
    And the Ottawa level is playable
    Then "hud-mode-label" reads the label of the mode "scene-state" reports as "data-mode"
    And when "data-mode" changes, "hud-mode-label" changes with it in the same frame budget
    And at no point is "hud-mode-label" empty while "playable" is present

  Scenario: The label is drawn from the table, not from the level's id
    Given two levels declare the same mode
    Then both draw the same string for it
    And no level document carries its own wording for a mode label
```

## TN-MOVE-02 — A mode with no label is a build failure, never an empty strip (failure path)

This is the defect that produced this file: `hud-mode-label` was an empty paragraph on the level the game
opens on, because one mode had a label and three did not. An empty strip is silent to a screen reader and
invisible to everyone else — the worst possible way for a missing string to present.

```gherkin
Feature: A missing mode label fails the build, not the player
  Scenario: A level declaring a mode with no label row fails the content check
    Given a level document declares a locomotion mode
    And no "locomotion.<mode>.label" row exists in English or in French
    When the content check runs
    Then the build fails, naming the level, the mode and the missing key
    And the message points at this file

  Scenario: A row present in one language only fails the same check
    Given "locomotion.bike.label" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: The strip never draws an empty label
    Given the level is playable
    Then "hud-mode-label" is either absent from the accessibility tree or has non-empty text
    And it is never present with an empty string
    And it never falls back to the mode's id, to "Mode", or to a dash

  Scenario: The check is proven by a failing fixture
    Given a fixture level document declaring a mode with no label row
    Then the check is asserted to fail on it
    And a change that makes that fixture pass fails this suite

  Scenario: The set of labels and the set of declared modes are compared, not assumed
    Then every mode declared by any document under "content/levels" has a row in both languages
    And a row in this table for a mode no level declares is reported, so the table cannot silently grow
```

## TN-MOVE-03 — The label is information, not a control

```gherkin
Feature: The mode strip with a keyboard and with one switch
  Background:
    Given the level is playable

  Scenario: A keyboard player never lands on it
    Given I am using a keyboard only
    When I press "Tab" through every control in the HUD
    Then "hud-mode-label" is never focused
    And every control I do reach is still at least 44 CSS px wide and tall

  Scenario: A switch user is never offered it
    Given single-switch mode is on
    When I press the switch briefly enough times to wrap the whole highlight ring
    Then the highlight never lands on "hud-mode-label"
    And no long press does anything to it

  Scenario: Reading the label is never required to act
    Then no scenario in this directory needs the label to be read before a control can be used
    And the label is not the only place the game says what a control does
```

## TN-MOVE-04 — A screen-reader user is told how they move

```gherkin
Feature: The mode reaches the accessibility tree
  Scenario: The label is text inside the named HUD region
    Given the level is playable
    Then "hud-mode-label" is in the accessibility tree as text
    And it is inside the region named by "hud.label"
    And the canvas is still "aria-hidden"

  Scenario: The mode is not announced as noise
    When the level becomes playable
    Then "#tn-live-region" is not used to repeat the mode label on every change of speed
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Changing language changes what is read
    Given the level is playable and the language is English
    When I change the language to French without leaving the level
    Then "hud-mode-label" reads the French label
    And the element carries "lang" equal to "fr"
```

## TN-MOVE-05 — Reduced motion and 200 % text

```gherkin
Feature: The word is the signal and it has to fit
  Scenario: Nothing about the mode is told only by an animation
    Given reduced motion is on
    And the level is playable
    Then "hud-mode-label" still reads its word
    And nothing on it spins, pulses, slides or flashes
    And no moving icon is the only thing that says which mode is in force

  Scenario: The longest label fits
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    When each built level is playable in turn
    Then the whole of "hud-mode-label" is visible, not cut off
    And it is not truncated with an ellipsis
    And the page does not scroll sideways
    And no HUD control is covered by it
```

## TN-MOVE-06 — The labels in both languages

```gherkin
Feature: Every mode is named in English and in French
  Scenario Outline: The French label is the one this table carries
    Given the language is French
    And the <level> level is playable
    Then "hud-mode-label" reads "<fr>"

    Examples:
      | level       | fr       |
      | Halifax     | Marche   |
      | Québec City | Glissade |
      | Ottawa      | Patinage |
      | Toronto     | Vélo     |

  Scenario: No label needs gender agreement
    Then no value in this table contains "(e)", "·e" or a bracketed ending
    And every value is a single noun, in both languages

  Scenario: Both languages or neither
    Then every key in this table has a value in "en" and in "fr"
    And a key present in one language and absent in the other fails the content check

  Scenario: The label is text, never lettering in the art
    Then no mode label is drawn onto the canvas as part of an image
    And "make verify-art" fails a render source containing a text element
```

---

## Open questions

- **`OQ-MOVE-1` — « Glissade » or « Toboggan » for the French label?** « Glissade » is the activity and is
  what a player in Québec would say they are doing; « Toboggan » is the object and matches the mode's id.
  *Recommendation:* ship « Glissade », and put it in front of the first French reviewer with « cachet »
  (`OQ-PASSPORT-5`) and the other words this project has already had to correct — « timbre » became
  « tampon » because the first choice named the wrong object, and this is the same class of mistake pointed
  the other way. Whichever wins, one word changes in one row and no scenario above changes shape.
- **`OQ-MOVE-2` — does the strip change while a level is being played?** `TN-MOVE-01` requires the label to
  follow `data-mode`, and two built levels declare two modes each — but nothing in slice 1 switches mode
  mid-level, and `app/bootstrap` reads the first declared mode once at load. *Recommendation:* keep the
  scenario, because it fails safely today (one mode, one label) and it is the only thing that stops a second
  mode being added with a strip that keeps naming the first. If mode switching is never built, the level
  documents should declare one mode each and the scenario is deleted on purpose rather than left passing
  vacuously.
- **`OQ-MOVE-3` — where does this table live once `content/locales/*` exists?** ADR-0010 puts mode labels in
  a locale bundle, and `LocomotionTuning.labelKey` already names the key a level uses. *Recommendation:* the
  rows move to the bundle unchanged, keeping the exact key spelling above, and this file stays their story —
  the same move `app/ui/rotate-overlay.ts` and `app/ui/build-status.ts` are already booked for.
