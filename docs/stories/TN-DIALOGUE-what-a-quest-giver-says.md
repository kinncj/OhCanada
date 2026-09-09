# TN-DIALOGUE — What a quest giver says, at the three moments nothing can say anything

**Intent.** A player who says no, who comes back halfway through, or who talks to the giver after the stamp
is earned gets an answer that belongs to *that* quest — and until the quest document can carry one, they get
silence rather than another quest's words.

This file is a **ruling and a record of today's behaviour**, not a copy table. It writes no line for any of
the three moments below, because there is nowhere to put one: `content/schemas/quest.schema.json` puts
`dialogue` on a **step**, so a quest can say what its giver says when a step begins and has no field at all
for what the giver says when the offer is declined, when the player returns mid-quest, or after the stamp is
earned. The UI agent found this, drew none of the three rather than key strings on nothing, and recommended
a schema change. **They are right, and this file is the decision.**

Read `README.md` in this directory first. `TN-QUEST-parliament-hill.md` owns the Ottawa quest and the shape
of a dialogue; `TN-GUIDE-the-guide.md` owns the companion's name; `TN-REACH-what-is-in-reach.md` owns the
prompt that opens a dialogue; `TN-NAMES-naming-real-places.md` owns which real names may appear where, and
this file amends one of its rules — see *The one naming rule this file changes*.

## The four moments, and what happens at each today

| Moment | What the game does today | Where the words would come from |
|---|---|---|
| A step begins | The giver's authored lines are shown | `steps[].dialogue[]` — **exists** |
| The player declines the offer | The dialogue closes. Nothing is said. | nowhere |
| The player talks to the giver mid-quest | The **current step's prompt** is shown | `steps[].prompt`, borrowed |
| The player talks to the giver after the stamp | The quest's **summary** is read back | `summary`, borrowed |

The last two are the interesting ones, because they are not silence — they are a string doing a job it was
not written for. `summary` is written as an instruction in the present tense ("Walk with your guide from the
Town Clock down to Pier 21. Along the way, answer questions…"), and reading it back to somebody who has
already done it is a screen describing a state it is not in, which is the defect `README.md` has now
recorded five times. A step prompt shown as speech is milder and is still a label being spoken.

**None of that is a bug in the UI.** It is the honest behaviour of a screen with no string, and drawing
nothing was the right call (`TN-COPY-06`: a string with no home is reported, never invented).

## The ruling: these are quest content, and they belong on the quest document

**Four fields on the quest document, each a dialogue line, each optional in the schema and gated in the
content check:**

| Field | Said when |
|---|---|
| `declinedLine` | The player chose "Not now" |
| `reminderLine` | The player talks to the giver while the quest is accepted and unfinished |
| `afterLine` | The player talks to the giver after the quest is complete |
| `doneLine` | Drawn on the completion card as what this quest was, in the past tense |

The first three are the UI agent's names and are kept, because a name that is already in one agent's report
is worth more than a better name nobody has read. `doneLine` is the fourth, and it is the same decision
applied to `quest.<id>.done.body` — see below.

### Why content and not copy rows

**The principle, stated once so it settles the next case too: a character's *name* is a copy row; what a
character *says in a quest* is quest content.** A name is one string shared by every quest that character
gives, and it belongs in a table (`npc.officer.name`, `npc.guide.name`). A line is one quest's, it names
things only that quest knows, and it belongs with the quest.

Four reasons it cannot be a copy table, in the order they decide it:

1. **One giver now gives three quests, so a per-character key is already broken.** `TN-QUEST`'s table
   carries `officer.declined`, `officer.reminder` and `officer.afterStamp` — keyed on the **character**,
   written when the officer had one quest and was the only giver in the game. The guide gives Halifax's,
   Québec City's and Toronto's. `guide.reminder` would be one string for three different journeys, and
   `officer.reminder` — "Parliament Hill is that way. Keep going." — shows exactly what such a string
   contains: a destination that is true of one quest.
2. **Keying it per quest makes it content in a global table.** The only key shape that works is
   `quest.<id>.reminder`, and a copy table with one row per quest, each naming that quest's landmark and
   route, is a copy table that has become the quest documents with extra steps. This is `TN-WAIT`'s argument
   about `level.loading` in its second form: **a string that varies per thing belongs to the thing.**
3. **A giver's line can state a fact about Canada, and a copy row has nowhere to put a source.**
   `content/schemas/quest.schema.json`'s `dialogueLine` requires a `fact` claim on every line, for the reason
   written in its own description: a wrong claim in an NPC's mouth is exactly as wrong as one on a question
   card (ADR-0003). "Well done. Enjoy the canal." carries no claim; a reminder that explains why the
   destination matters would. A copy table row cannot carry `factual`, a source or a verification status, so
   putting these lines there would put the one class of on-screen sentence that must be verifiable outside
   the machinery that verifies it.
4. **The lines travel with the giver.** A quest is authored, verified and shipped as one document. Splitting
   its speech across a document and a global table means two files, two owners and two review passes for one
   character's voice — and it is how the wording of a decline drifts from the wording of the offer it
   declines.

### `quest.<id>.done.body` is the same ruling

`TN-QUEST` carries `quest.done.body` — "You skated to Parliament Hill and answered three questions." — as an
**unqualified** key drawn on the completion card. It names a landmark, a locomotion mode and a count, all of
which belong to one quest, and there is exactly one quest with a story. A global `quest.done.body` drawn by
four quests is `level.loading` again, and a `quest.<id>.done.body` table is reason 2 again.

So it becomes `doneLine` on the quest document, in the past tense, and the card draws it on the quest path.
**It is not the same string as `summary`**: `summary` says what you are about to do and is announced when
the quest is accepted; `doneLine` says what you did. Today the card reads `summary` back, which is the
present tense used about the past.

### What the schema change has to be, stated as a target

Routed to the architect; `content/` is not this directory's to edit. What this file needs from it:

- Four optional properties on the quest document — `declinedLine`, `reminderLine`, `afterLine`, `doneLine` —
  each `$ref`-ing the existing `#/$defs/dialogueLine`, so each carries `speaker`, `text`, `fact` and
  optionally `expression`, and so nothing new has to be invented or kept in sync (ADR-0007: no inline object
  schemas).
- `additionalProperties: false` stays; the fields are declared or they do not exist.
- The content check requires **both languages or neither** on any line that is present (`TN-COPY-06`), and
  requires a present line's `fact` to be verified like any other claim when `factual` is true.
- A line whose `speaker` is not a character the level places is a build failure, so a quest cannot put words
  in a mouth that is not on screen.

**`reminderLine` is one line for the whole quest, not one per step.** A per-step reminder is the obvious
extension and it is not taken: the step prompt already exists, the tracker already draws it, and a second
per-step string would be a second place for the same instruction to be written differently. `OQ-DIALOGUE-2`
records what would change if a quest ever needs one.

**No line is written until the field exists.** That is this file's own rule and it is `TN-COPY-06`'s: a key
with no home is reported, not invented. `TN-QUEST`'s three officer rows stay exactly where they are and
unchanged until the migration lands, because deleting a string a shipped screen draws would trade one gap
for one regression.

## The one naming rule this file changes

`TN-NAMES-01` said a name on its list appears in a point-of-interest card's body **and nowhere else**, and
`TN-NAMES-04` fails the build for such a name in a copy string drawn by the passport, the level select, the
HUD or a menu. Three shipped quests break the spirit of that sentence and none of them breaks its gate,
because they are **content**, not copy strings:

- `content/quests/quebec-city-chateau-frontenac.json` says "Slide down to the Château Frontenac and I will
  meet you there.", and its step prompt — drawn in `hud-quest-tracker`, inside the HUD — is "Slide down to
  the Château Frontenac".
- `content/quests/toronto-cn-tower.json` does the same with the CN Tower, in the summary, in a line and in a
  step prompt.

**The decision is to allow it, narrowly, and to write the boundary down rather than leave three shipped
quests in an unruled state.** A name on that list may appear in **a quest document's own `summary`,
`dialogue[].text` and `steps[].prompt`**, where it is the destination the player is being sent to or the
thing in front of them. It may not appear anywhere else, and in particular not in a copy table row, not on a
stamp, not on the map, not on the passport, not in a loading message, not on an error card, not in a menu
item and not in `interact-prompt`, which stays generic by `TN-REACH`'s own rule.

Why this is not a hole in `TN-NAMES`:

1. **The purpose of the rule is preserved.** The name is text, it carries no mark, it is inside a sentence
   that says what to do about the building, nothing implies association, and nothing invites the player to
   visit or book. All seven of `TN-NAMES`'s rules still hold; only rule 2's list of places grows by one
   closed set.
2. **A guide who may not say where you are going is a worse guide.** "Slide down to the big hotel above the
   river" is the evasion `OQ-NAMES-1` already identified as the cost of the strict line, and here it is paid
   twice — once in the speech and once in the tracker a player checks when they have forgotten.
3. **It is better for accessibility, not worse.** A screen-reader user navigating a level by the tracker
   needs the destination named; a sighted player can see the tower on the skyline. The generic prompt is
   `TN-REACH`'s answer for the HUD's *chrome*; a task the player accepted is not chrome.
4. **The boundary is mechanically checkable.** The exception is a set of three JSON paths in one document
   type. Everything else stays exactly as `TN-NAMES-04` already fails on.

**What it costs:** the name now appears on two surfaces instead of one, and the HUD is one of them, so the
"no name in the HUD" sentence in `TN-NAMES-04` needs the exception written beside it or the gate will be
read as broader than it is. `TN-NAMES-01` is amended in the same change as this file, and `OQ-NAMES-1`'s
stricter option is still one copy-and-content pass away if the project owner wants it.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-DIALOGUE-04` — declining, returning and closing all give focus back |
| Single switch | `TN-DIALOGUE-04` |
| Screen reader | `TN-DIALOGUE-04` — the dialog is named by the giver at all four moments |
| Reduced motion | `TN-DIALOGUE-04` |
| 200 % text | `TN-DIALOGUE-04` |
| Bilingual | `TN-DIALOGUE-05` |
| Failure path | `TN-DIALOGUE-02` (a moment with no line), `TN-DIALOGUE-03` (the gate, once the field exists) |

---

## TN-DIALOGUE-01 — What each moment does today

These scenarios describe the build as it is. They are here so the three moments have acceptance criteria
before they have copy, and so the change that adds the fields changes a scenario on purpose rather than
quietly.

```gherkin
Feature: Saying no, coming back, and coming back after
  Background:
    Given the Halifax level is playable
    And this level's quest is offered by the guide

  Scenario: Declining closes the dialogue and says nothing
    Given the guide's offer is open
    When I tap "Not now"
    Then the event "quest/declined" is emitted for that quest
    And the event "dialogue/closed" is emitted
    And the element "dialogue" is gone
    And no line from another quest is shown
    And the element "hud-quest-tracker" is not shown
    And I can move again

  Scenario: The quest can still be accepted afterwards
    Given I declined the quest
    When I engage the guide again
    Then the event "quest/offered" is emitted again
    And the offer is shown from its first line
    And I can accept it

  Scenario: Coming back mid-quest shows the step I am on
    Given I have accepted the quest
    And I have not finished it
    When I engage the guide
    Then the dialogue shows this quest's current step prompt
    And no second "quest/offered" event is emitted
    And the step does not change
    And nothing from another quest is shown

  Scenario: Coming back after the stamp shows what this quest was
    Given I have finished this quest and earned this level's stamp
    When I engage the guide
    Then the dialogue shows this quest's own words about it
    And no second "stamp/earned" event is emitted
    And no second "quest/offered" event is emitted
    And the quest cannot be completed twice

  Scenario: Leaving the dialogue is not a decline
    Given the guide's offer is open
    When I press "Escape" or tap the close control
    Then the event "dialogue/closed" is emitted
    And no "quest/accepted" and no "quest/declined" event is emitted
```

## TN-DIALOGUE-02 — A moment with no line is silent, never wrong (failure path)

```gherkin
Feature: Nothing is borrowed and nothing is invented
  Scenario: A quest with no line for a moment shows no line
    Given a quest document carries no words for the moment being reached
    Then no dialogue opens with an empty body
    And nothing reads as "TBD", "???", an empty box or a placeholder
    And no other quest's words are shown
    And no character's words from another level are shown

  Scenario: A borrowed string is not a written one
    Given the game shows a quest's summary or a step prompt at a moment it was not written for
    Then that is recorded as a gap, with the quest and the moment named
    And the gap is closed by a line on the quest document, never by a global copy row

  Scenario: No global key carries a quest's words
    Given a copy table declares "quest.done.body", "quest.declined", "quest.reminder" or "quest.afterStamp"
      with no quest in the key
    When the content check runs
    Then the build fails, naming the key and pointing at this file
    And the message says the words belong on the quest document

  Scenario: The completion card is honest about a quest it has no words for
    Given a quest completes and its document carries no line about being finished
    Then the card shows its heading, its stamp sentence and its ways on
    And the line describing what was done is absent rather than borrowed
    And no sentence on the card describes a route the player did not take
```

## TN-DIALOGUE-03 — The gate, once the fields exist (pending the schema change)

**This scenario cannot run today**, because the fields it describes do not exist. It is written as the
acceptance for the schema change and is **not counted as coverage** until `quest.schema.json` carries the
four fields. Nothing above depends on it.

```gherkin
Feature: A line that exists is complete, sourced and in both languages
  Scenario: Both languages or neither
    Given a quest document carries a "declinedLine", "reminderLine", "afterLine" or "doneLine"
    And its text is present in one language and absent in the other
    When the content check runs
    Then the build fails, naming the quest, the field and the missing language

  Scenario: A claim in a giver's mouth is verified like a question
    Given one of those lines declares "factual" true
    And its verification status is not "verified" for the current source hash
    When the content check runs
    Then the build fails, naming the quest and the field
    And the rule is ADR-0003's, unchanged

  Scenario: A line cannot be spoken by somebody who is not there
    Given one of those lines names a speaker the level does not place
    When the content check runs
    Then the build fails, naming the quest, the field and the speaker

  Scenario: The speaker's name still comes from the copy table
    Given one of those lines is shown
    Then the dialog's accessible name is the value of "npc.<giver>.name"
    And it is not the line's own text
    And it is not "Speaker", "NPC" or empty

  Scenario: The gates are proven by failing fixtures
    Then a fixture exists for each scenario above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite
```

## TN-DIALOGUE-04 — These moments with a keyboard, one switch, a screen reader, no motion and big text

```gherkin
Feature: Declining and returning are reachable by everybody
  Scenario: Declining from the keyboard returns focus to the level
    Given I am using a keyboard only
    And the giver's offer is open
    When I press "Tab" until focus is on "dialogue-decline" and press "Enter"
    Then the dialogue closes
    And focus returns to "interact-prompt", never to the document body

  Scenario: Declining with one switch
    Given single-switch mode is on
    And the giver's offer is open
    When I press the switch briefly until the highlight is on "Not now"
    And I hold the switch past the hold-to-choose threshold
    Then the quest is declined
    And nothing expires while I decide
    And nothing was chosen for me by the highlight arriving

  Scenario: Coming back mid-quest is announced once
    Given I have accepted the quest
    When I engage the giver
    Then "dialogue" has role "dialog" with "aria-modal" true
    And its accessible name is the giver's name
    And "#tn-live-region" reads the dialogue once
    And it is not repeated while the dialogue stays open
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Nothing about these moments is told by movement
    Given reduced motion is on
    When I decline, and later when I come back mid-quest
    Then each dialogue appears with no slide, fade, bounce or scale
    And nothing on it spins or pulses
    And "scene-state" reports "data-particles" equal to "0"

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every line shown at these moments is fully visible, by scrolling inside the dialogue if needed
    And "dialogue-speaker" is fully visible above them
    And every control is at least 44 CSS px wide and tall
    And the page does not scroll sideways

  Scenario: Nothing at these moments counts down
    When any of these dialogues is open
    And I do nothing for two minutes
    Then it is unchanged
    And nothing on it counts down
    And no control has been taken for me
```

## TN-DIALOGUE-05 — These moments in French

```gherkin
Feature: The same four moments in French
  Background:
    Given the language is French

  Scenario: Declining is French, or silent, but never English
    Given the guide's offer is open
    When I tap "Pas maintenant"
    Then the dialogue closes
    And no English word is shown at that moment
    And where a line exists, it is the French value of that quest's own field

  Scenario: Coming back mid-quest is French
    Given I have accepted the quest
    When I engage the guide
    Then the dialogue is French
    And "dialogue-speaker" reads "Le guide"
    And the announcing element carries "lang" equal to "fr"

  Scenario: No line at any of these moments needs gender agreement
    Then no line shown at these moments contains "(e)", "·e" or a bracketed ending
    And the vouvoiement is used, as this directory's French style requires

  Scenario: Changing language mid-quest keeps the progress and changes the words
    Given I have accepted the quest in English
    When I change the language to French
    Then the tracker and the next dialogue are French
    And the quest is still accepted and still on the same step
```

## TN-DIALOGUE-06 — A real name inside a quest's own words

```gherkin
Feature: The narrow exception, and its edges
  Scenario: The giver may name where you are going
    Given the Québec City level is playable
    When the guide gives this level's quest
    Then the dialogue may contain "Château Frontenac"
    And "hud-quest-tracker" may contain it as part of that quest's step prompt
    And the name is text, in the game's own body type, with no logo, wordmark or stylised lettering

  Scenario: Nothing else may carry it
    Then no copy table row in either language contains a name from TN-NAMES-naming-real-places.md's list
    And no such name appears on "title-screen", "level-select", "passport", a menu item, a heading,
      a loading message, an error card or a stamp sentence
    And "interact-prompt" reads the generic row, as TN-REACH-02 requires

  Scenario: The exception is a set of paths, not a habit
    Then the only content fields allowed to carry such a name are a quest document's "summary",
      its "dialogue[].text" and its "steps[].prompt"
    And a name in any other field of any other document fails the content check
    And the check is proven by a failing fixture

  Scenario: The name still claims nothing
    Then no line says or implies that the place made, sponsors, approves or is connected to this game
    And no line offers a booking, an address, an opening time or a price
    And no line invites the player to visit, book or buy
```

---

## Open questions

- **`OQ-DIALOGUE-1` — the three Ottawa rows have to move, and moving them is a behaviour change.**
  `officer.declined`, `officer.reminder` and `officer.afterStamp` are drawn by the shipped game and are
  written in `TN-QUEST`'s copy table. Under this ruling their words become
  `ottawa-parliament-hill.json`'s `declinedLine`, `reminderLine` and `afterLine` — the same sentences, in a
  different file, with a `fact` claim each (all three are flavour, so `factual` is false). *Recommendation:*
  move them in the same change that adds the fields, delete the three copy rows in that change and not
  before, and have `TN-QUEST-03`'s and `TN-QUEST-04`'s scenarios keep asserting the same sentences — they
  are about what the player reads, and they do not care which file it came from. What must not happen is the
  rows being deleted first, which would take a working screen down to close a gap.
- **`OQ-DIALOGUE-2` — one reminder per quest, or one per step?** This file rules quest-level, because the
  step prompt already says what to do now. A long quest whose giver should say something different at step 4
  than at step 1 would want a per-step `reminderLine`, and the schema could carry an optional one on
  `questStep` that overrides the quest's. *Recommendation:* do not add it until a quest needs it. Five steps
  in Halifax's quest and three in Ottawa's are all served by one line; a field added ahead of a need is a
  field authored inconsistently across four documents.
- **`OQ-DIALOGUE-3` — does the completion card draw `doneLine` or `summary` in the meantime?** Until the
  field exists the card reads the summary back, which is present-tense words about a finished thing.
  *Recommendation:* leave it, and fix it with the field rather than by rewording every quest's summary —
  the summary is right where it is used (the quest log, and the announcement when the quest is accepted),
  and rewording it to read well in both places would make it read well in neither.
- **`OQ-DIALOGUE-4` — should a declined offer say anything at all?** Ottawa's row says "No problem. Come back
  when you are ready." and the other three quests say nothing. Silence is defensible: the player chose to
  leave and a reply is a beat they did not ask for. *Recommendation:* a line, because "come back when you
  are ready" is the one piece of information a declining player does not have — that the offer is still
  there — and `TN-QUEST-03` already promises the quest can be accepted later. But it is one short line, it
  never argues, and no quest may make declining feel like a mistake: this is a learning tool and
  `README.md`'s "a game that teaches never marks the player down" binds a decline as much as a wrong answer.
- **`OQ-DIALOGUE-5` — `TN-NAMES-01`'s amendment is written above and its file carries it.** Both files point
  at the decision, as `README.md` requires, and `TN-NAMES-04`'s "no such name in a string drawn by the HUD"
  now carries the quest-tracker exception beside it, so the gate is not read as wider than it is. Recorded
  here because the two must not drift: if a reviewer takes `OQ-NAMES-1`'s stricter line, this exception goes
  with it and three shipped quest documents get a copy pass.
