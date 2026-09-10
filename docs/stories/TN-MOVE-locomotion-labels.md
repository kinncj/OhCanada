# TN-MOVE — What the HUD calls the way you move

**Intent.** Whatever level a player opens, the HUD names how they are moving, in their language, and it is
never blank.

Read `README.md` in this directory first. The HUD strip this file draws into is `TN-HUD-hud-and-menu.md`
(`hud-mode-label`). `TN-LEVELS-2-to-10-spine.md` decides *which* mode each level uses; this file decides what
each mode is **called**, once, for every level that uses it.

**Amended 2026-09-09 — a fifth mode is declared by a level document, so it has a row.**
`content/levels/prairie-rail.json` declares `train` as its first locomotion mode, which is the trigger this
file's own rule names: a mode gets a label when a level document declares it, and not before. `train` is
below. `content/levels/winnipeg.json` declares `walk` and adds no row at all, which is the table working.

**Amended again 2026-09-09 — two more level documents landed and each declared a mode nobody had named, so
the table gains two rows and loses a reservation.** `content/levels/alberta-foothills.json` declares `horse`
and `content/levels/vancouver.json` declares `skateboard`, each as its first mode with `walk` second, each
carrying the matching `labelKey`. Both were checked in the documents before a word was written, which is
what this file's own rule requires. **One earlier decision is reversed in the same change**: `OQ-MOVE-4`
reserved "Riding" for `horse`, and `horse` cannot have it, because in Canadian English a **riding** is an
electoral district and this game teaches that in
`content/questions/elections/elec-03-another-name-for-a-riding.json`. The reversal, its evidence and its cost
are below.

## Why this is one shared table and not a row in eight level stories

A loading sentence belongs to a level. A mode label does not: it belongs to a **mode**, and a mode is shared.
Today's eight built level documents declare seven modes between them, and **seven of the eight declare the
same one** — every level except Toronto lists `walk`, most of them as a second mode:

| Level document | `locomotion[].mode`, in the order the document declares them |
|---|---|
| `content/levels/halifax.json` | `walk` |
| `content/levels/quebec-city.json` | `toboggan`, `walk` |
| `content/levels/ottawa.json` | `skate`, `walk` |
| `content/levels/toronto.json` | `bike` |
| `content/levels/winnipeg.json` | `walk` |
| `content/levels/prairie-rail.json` | `train`, `walk` |
| `content/levels/alberta-foothills.json` | `horse`, `walk` |
| `content/levels/vancouver.json` | `skateboard`, `walk` |

Written in each level's own story, `walk` would be written seven times, and `README.md`'s rule is that two
tables carrying the same words is how they stop being the same words. So the labels live here, and each level
story names the key and points at this file.

This is also what ADR-0010 already decided and what the port already assumes: a mode label is *engine
vocabulary a level uses*, not *text a level owns* — "Skating is the name of a mode eight levels may offer" —
which is why `LocomotionTuning.labelKey` is a **key** and not inline `localizedText`. ADR-0023 adds the
other half: opening the set of modes to content means "adding a mode still costs a locale key", and this is
the table that key is written in. `prairie-rail` was the first level to pay that cost and paid exactly one
row; `alberta-foothills` and `vancouver` are the second and third, and each paid exactly one row too. **Three
levels in a row paying one row each is the ADR's claim holding up under load**, and it is worth writing down
because the claim was made before any level tested it.

## The rule that decides which rows exist

**A mode gets a label in this table when a level document declares it, and not before.**

- `content/game.config.json#/locomotionModes` lists nine legal modes (ADR-0023). Two of them —
  `canoe` and `dogsled` — are declared by no level document, so they have no row. Writing labels for them
  would be writing copy for levels nobody has scoped, and both belong to levels `TN-LEVELS` deliberately
  leaves unscoped under `docs/content-review.md` §1 and `OQ-REVIEW-10`. A blocked level with its HUD copy
  already written reads as schedulable, and a plan that reads as schedulable gets scheduled.
- The row is added in the same change as the level document that needs it, and `TN-MOVE-02` is the gate that
  makes that mandatory rather than remembered.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `locomotion.walk.label` | Walking | Marche |
| `locomotion.toboggan.label` | Sledding | Glissade |
| `locomotion.skate.label` | Skating | Patinage |
| `locomotion.bike.label` | Biking | Vélo |
| `locomotion.train.label` | Train | Train |
| `locomotion.horse.label` | Horse | Cheval |
| `locomotion.skateboard.label` | Skateboarding | Planche à roulettes |

**Every row is the name of the activity or of the thing carrying you — not an instruction, not a verb phrase
and not a sentence.** "Skating", « Patinage » set that shape in `TN-LEVEL-ottawa.md` and the six rows after
it follow it. The label answers "how am I getting about?" It never says "Press and hold to move" — that is
the control's business (`OQ-INPUT-1`), not the strip's — and it never names the level.

**The shape is one word wherever a language has one.** Six of the seven rows are one word in both languages.
The seventh, `skateboard`, is one word in English and a compound noun in French, because « planche à
roulettes » *is* the noun — it is not a phrase built around a preposition, the way « À pied » and « En
train » are, and those are what `TN-MOVE-06` was written to keep out.

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
- **`train` → "Train" / « Train ».** This is the first mode where English has no plain gerund to reach for.
  "Training" means something else entirely; "By train" and « En train » are prepositional phrases where every
  other row is a bare noun, and they read as an answer to a question nobody asked. So the label is the
  vehicle, which is what `bike`'s French row already does — « Vélo » is the bicycle, not the activity — and
  it is the word a newcomer has on day one in both languages. See `OQ-MOVE-4`.
- **`horse` → "Horse" / « Cheval », and *not* "Riding".** This row was promised to "Riding" by the note under
  `train` and it cannot have it. **In Canadian English a "riding" is an electoral district**, and this game
  does not merely risk that reading — it *teaches* it: `content/questions/elections/` holds a question whose
  whole point is that "electoral district, riding and constituency all name the same area of the country",
  and level 5's entire subject is federal elections. A HUD label that means one thing in the strip and
  another in the question card is a word the game has taught the player to misread, and the misreading lands
  on two levels a player meets four apart. "Horseback" is not a noun on its own; "Horse riding" is two words
  and still carries the collision. So the label is the animal carrying you, which is the answer `train`
  already gave for the same class of problem — the plain activity noun is unavailable, so name the thing you
  are on. **The French follows the English here rather than diverging**: « Cheval » matches « Vélo » and
  « Train », it is three syllables shorter than « Équitation » and well inside the grade-6 bar, and it keeps
  the two languages the same shape. « Équitation » was the considered alternative and is recorded in
  `OQ-MOVE-5`.
- **`skateboard` → "Skateboarding" / « Planche à roulettes ».** English cannot use "Skating" here, because
  level 4's `skate` already has it and means ice; two labels differing by one syllable would be a strip that
  tells the player nothing. "Skateboarding" is the plain word and it is unambiguous. The French is the object
  rather than the activity, exactly as `bike`'s is: « faire de la planche à roulettes » is the activity and
  « la planche à roulettes » is what carries you, and it is the term on the signs in a Québec park.
  « Skateboard » is an anglicism this project's Canadian French avoids where a plain French term exists, and
  « Planche » alone collides with « planche à neige ». See `OQ-VANCOUVER-5` and `OQ-MOVE-5`.
- **The English and the French of `train` are the same word, and that is deliberate rather than a missing
  translation.** `TN-MOVE-06` asserts the key carries a value in both languages, and `TN-NAMES-03` already
  fixes the rule for a string identical in both: it is written twice on purpose, never one value reused for
  both by accident.
- **No row needs gender agreement in French**, and none may acquire one: every value is a noun or a noun
  phrase with no participle in it, so `docs/content-review.md` §8.6's bracketed forms cannot appear here
  (`TN-MOVE-06`).

**The longest label in the game is now « Planche à roulettes », in French, on level 9.** It replaces
« Patinage » in that role and it is nineteen characters against eight, so `TN-MOVE-05`'s measurement is a
real one for the first time rather than a formality. `TN-VANCOUVER-03` measures it in the level that draws
it, and this file measures it across all eight.

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
      | level                 | mode       | label         |
      | Halifax               | walk       | Walking       |
      | Québec City           | toboggan   | Sledding      |
      | Ottawa                | skate      | Skating       |
      | Toronto               | bike       | Biking        |
      | Winnipeg              | walk       | Walking       |
      | The Prairies          | train      | Train         |
      | The Alberta foothills | horse      | Horse         |
      | Vancouver             | skateboard | Skateboarding |

  Scenario: The two skating modes are never confusable
    Given the Ottawa level is playable
    Then "hud-mode-label" reads "Skating"
    Given the Vancouver level is playable
    Then "hud-mode-label" reads "Skateboarding"
    And neither French label is a prefix of the other
    And a build in which both draw the same string fails this scenario

  Scenario: No label is a word this game teaches to mean something else
    Then no value in this table appears as an answer or an explanation in "content/questions/elections"
    And "hud-mode-label" never reads "Riding"

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

  Scenario: Seven levels declaring one mode draw one string
    Given every built level except Toronto declares "walk"
    Then each draws "Walking" from the same row
    And no level has a walking label of its own
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

  Scenario: The mode a new level document brings with it is named in the same change
    Given a level document is added declaring a mode no other level declares
    And no row for it is added to this table
    When the content check runs
    Then the build fails, naming the level and the mode
    And "hud-mode-label" is never drawn empty for it

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
    And "canoe" and "dogsled" have no row while no document declares them
    And "horse" and "skateboard" have a row because two documents now do
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

  Scenario: A long label is read as one phrase
    Given the Vancouver level is playable
    Then "hud-mode-label" is read as "Skateboarding" and not letter by letter
    And in French it is read as "Planche à roulettes", as one phrase

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

  Scenario: The longest label of the eight is measured by name
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    And the Vancouver level is playable
    Then the whole of "Planche à roulettes" is visible in "hud-mode-label"
    And it does not cover "menu-button", "interact-prompt" or "hud-quest-tracker"
    And the strip may scroll inside "hud" to show it, as TN-HUD-08 allows
    And nothing is dropped from the strip to make room for it
```

## TN-MOVE-06 — The labels in both languages

```gherkin
Feature: Every mode is named in English and in French
  Scenario Outline: The French label is the one this table carries
    Given the language is French
    And the <level> level is playable
    Then "hud-mode-label" reads "<fr>"

    Examples:
      | level                 | fr                  |
      | Halifax               | Marche              |
      | Québec City           | Glissade            |
      | Ottawa                | Patinage            |
      | Toronto               | Vélo                |
      | Winnipeg              | Marche              |
      | The Prairies          | Train               |
      | The Alberta foothills | Cheval              |
      | Vancouver             | Planche à roulettes |

  Scenario: No label needs gender agreement
    Then no value in this table contains "(e)", "·e" or a bracketed ending
    And no value contains a past participle that would have to agree

  Scenario: Every label is a noun, never an instruction
    Then every value in this table is a noun or a noun phrase, in both languages
    And no value begins with a preposition
    And no value is a verb in the imperative
    And "À pied", "En train" and "À cheval" would each fail this scenario
    And "Planche à roulettes" passes it, because it is the name of the thing and not a phrase about it

  Scenario: Both languages or neither
    Then every key in this table has a value in "en" and in "fr"
    And a key present in one language and absent in the other fails the content check

  Scenario: A label that is the same word in both languages is written twice, not shared
    Given "locomotion.train.label" reads "Train" in English and "Train" in French
    Then the key has a value declared in "en" and a value declared in "fr"
    And neither language falls back to the other's value
    And a missing French value fails the check even though the English reads correctly

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
  follow `data-mode`, and six built levels declare two modes each — but nothing in slice 1 switches mode
  mid-level, and `app/bootstrap` reads the first declared mode once at load. *Recommendation:* keep the
  scenario, because it fails safely today (one mode, one label) and it is the only thing that stops a second
  mode being added with a strip that keeps naming the first. **The Prairies makes this more than
  theoretical**: it declares `train` first and `walk` second, and `assets/style/prairie-rail-level.md` says
  why — the walk tuning is there so the level stays completable if the train proves too coarse for a point of
  interest. Levels 8 and 9 declare a second mode for the same reason. If the player ever leaves the horse or
  the board, the strip has to say so.
- **`OQ-MOVE-3` — where does this table live once `content/locales/*` exists?** ADR-0010 puts mode labels in
  a locale bundle, and `LocomotionTuning.labelKey` already names the key a level uses. *Recommendation:* the
  rows move to the bundle unchanged, keeping the exact key spelling above, and this file stays their story —
  the same move `app/ui/rotate-overlay.ts` and `app/ui/build-status.ts` are already booked for.
- **`OQ-MOVE-4` — "Train" is a noun where four English rows are gerunds, and the two languages are the same
  word.** Both are deliberate and both are the kind of thing a reviewer notices. *Recommendation:* keep it.
  The alternatives are "By train" / « En train », which breaks the noun shape `TN-MOVE-06` asserts, and
  "Riding" / « À bord », which loses the plainness. Note the one real risk in English: "Train" can be read as
  a verb by somebody meeting the strip cold. Nothing in the game offers training, so the misreading dies on
  the second word — but if a reviewer disagrees, the fix is « Le train » / "The train" in both languages.
  **Amended 2026-09-09: this note used to say "'Riding' is the word level 8's `horse` will want", and level 8
  cannot have it.** A riding is an electoral district in Canadian English and level 5's bank teaches exactly
  that, so `horse` is "Horse" and the reservation is withdrawn. The reversal cost nothing, because no row had
  been written on the strength of it — which is the argument for this file's rule that a mode is named when a
  document declares it and not before.
- **`OQ-MOVE-5` — two of the seven rows had a plainer alternative and both are worth one reviewer's minute.**
  `horse` could be « Équitation », the activity noun that matches « Patinage » and « Glissade »; it is
  correct, it is what a French speaker calls the sport, and it is five syllables where « Cheval » is two.
  `skateboard` could be « Skateboard » or « Planche »; the first is the word people say and an anglicism this
  project's Canadian French avoids where a plain term exists, the second is shorter and collides with
  « planche à neige ». *Recommendation:* ship « Cheval » and « Planche à roulettes » and put both in front of
  the first French reviewer with `OQ-MOVE-1` and `OQ-MOVE-4`, as one question about four words rather than
  four questions. Whichever way each goes, one value changes in one row and no scenario above changes shape —
  except `TN-MOVE-05`'s named measurement, which would move to whichever label is then the longest.
