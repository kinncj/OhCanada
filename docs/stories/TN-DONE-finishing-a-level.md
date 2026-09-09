# TN-DONE — Finishing a level: the card, the stamp, and the level that just opened

**Intent.** A player who reaches the end of a level is told what they earned, what they answered — including
when the honest answer is *nothing* — and is offered the level that just opened, in their language, without
any screen claiming something that did not happen.

This story exists because the card is built and its words are not. `app/ui/level-complete.ts` draws
`quest-complete-card` on two paths — a quest completing, and the player reaching the end of the world
(`level/exitReached`) — and slice 1 task 1.23 shipped it with three strings reported as gaps rather than
invented: the per-level stamp sentence for every level but Ottawa, a sentence for the player who answered
nothing, and a label for the control that opens the next level. **The game starts on Halifax**, so the first
completion card any player ever sees is the one with the most missing rows.

**Amended 2026-09-09 — six levels are built, so the two per-level tables have six rows each.**
`content/levels/winnipeg.json` and `content/levels/prairie-rail.json` shipped and are listed in
`content/game.config.json`'s `unlockRules.order`, which means finishing Toronto now offers Winnipeg and
finishing Winnipeg now offers the Prairies. Their rows are written in `TN-LEVEL-winnipeg.md` and
`TN-LEVEL-prairie-rail.md`, and the Prairies is the level that adds a **fourth** French form after
« tampon » and a **second** English shape to the play label.

Read `README.md` in this directory first. This file owns the **completion card**: when it appears, what it
may say, and the two rows that are the same on every level. It owns none of the following and points at all
of them:

| What | Owned by |
|---|---|
| The Ottawa quest, its steps and its completion card on the quest path | `TN-QUEST-parliament-hill.md` |
| What a quest's giver says once it is finished | `TN-DIALOGUE-what-a-quest-giver-says.md` |
| The stamp once it is in the passport, and the three stamp states | `TN-PASSPORT-my-passport.md` |
| The map, the three level states and the sentence describing a card | `TN-MAP-level-select.md` |
| The route out of a level, and what "back" means | `TN-FLOW-first-run-and-return.md` |
| Which level may be named where | `TN-NAMES-naming-real-places.md` |
| Plurals, counted nouns and the shape a count takes | `TN-COPY-strings-and-counts.md` |

## When the card appears, and what each showing knows

Two things finish a level, and the card is drawn for both:

| Path | Event | What the card knows |
|---|---|---|
| The player finishes the level's task | `quest/completed`, then `stamp/earned` | A task finished; the stamp; what they answered; what opened |
| The player reaches the end of the level | `level/exitReached`, then `level/completed` and `stamp/earned` | The stamp; what they answered — **possibly nothing**; what opened |

The second path is the one this file was written for. **A player can walk from the spawn to the exit without
stopping at a single landmark**, and the stamp is still earned, because reaching the end is what earns it.
Everything the card says has to be true of that player as well as of the one who did everything. **Two of
the six built levels declare no quest at all** — Winnipeg and the Prairies place no character and carry an
empty `quests` array — so on those levels the second path is the *only* path, and the card's heading has to
be right on it.

## The heading has to be true on both paths

The card draws `quest.done.title` — "Task done!" / « Mission accomplie! » — on **every** showing. On the
walk-to-the-end path no task was offered, accepted or done, so the first thing that player reads is a claim
about something they never did. That is this project's most repeated defect (`README.md`: *a screen never
describes a state it is not in*), and it is on the first card the shipped game draws.

So the heading follows what actually finished:

1. **A quest completed** → `quest.done.title`, which `TN-QUEST` owns and this file does not touch.
2. **Otherwise** → `level.complete.title`, below.

This was not asked for and is not a change to `TN-QUEST`'s string; it is a second row for a state that has
no true string today. See `OQ-DONE-1`.

## The sentence for a player who answered nothing

`level.complete.none` is the row this card has been drawing an absence in place of. Today, when there were
no answers, the card simply draws no score line — and that silence is doing honest work, because a line
reading "0 out of 0" would look like a defect and any other line would be the game telling a learner they
learned something. **Silence is still not the same as saying so**, and a player who walked past every
landmark should be told plainly that they did, while there is still a way back.

Three things the wording has to be at once, and they pull against each other:

- **Plain about what happened.** It says no questions were answered *here*. It does not soften that into
  nothing, because a card that says nothing lets a player believe the level had nothing in it.
- **Not a mark.** No count, no zero, no "you missed 4", no red, no word like *failed*, *skipped*, *incomplete*
  or *only*. These are newcomers studying for a citizenship test; a line that reads as marking them down is
  the wrong instrument in a learning tool, and the game has already decided that a wrong answer costs nothing
  (`TN-QUEST-04`: "no message tells me I failed").
- **An open door.** The second sentence says what is in the level rather than what the player should have
  done. It is a statement, not an instruction: **no imperative, no "you should", no "go back and…"**, because
  the way back is already on the card as `common.keepPlaying`, focusable and one press away.

It carries **no level name and no number**, which is why it is one row rather than six. It names no place,
so it cannot leak a name `TN-NAMES` keeps in a point-of-interest card body; it counts nothing, so
`TN-COPY`'s plural rules have nothing to bind.

## `level.complete.score` — the card owns its own row, and here is why

The card reuses `study.summary.score` today — "You got {{correct}} out of {{total}} right." /
« Bonnes réponses : {{correct}} sur {{total}} ». Reuse is defensible: it is one string, already reviewed,
already correct at one in both languages. **The decision is to split it, and the reasoning is the one this
directory already uses to decide between sharing and owning.**

Sharing is right when two screens state **the same fact about the same thing** and must never disagree —
`passport.state.earned` and `map.stamps` are shared for exactly that reason, and `TN-PASSPORT` says so in as
many words. Splitting is right when two screens are **answering different questions**, which is the rule
`TN-PASSPORT-05` states from the other side: *"the two screens are answering two different questions and
neither is wrong."* Four reasons this is the second case:

1. **The two lines on this card are a pair.** One is drawn when there were answers and one when there were
   none, and they are read in the same second by the same player. `level.complete.none` is written here, in
   a deliberately unmarked register; a score line inherited from a drill screen puts two registers on one
   card. A pair authored in two files by two owners is a pair that drifts.
2. **The sets are not the same set.** Study counts a drill the player asked for, of a length the drill chose.
   This counts however many questions a level happened to offer somebody walking through it at their own
   pace. The arithmetic is identical and the claim is not, and "out of {{total}}" means a different total in
   each place.
3. **Coupling costs a reword.** `OQ-COPY-4` is open on the French of `study.summary.score` — a reviewer may
   turn the label back into a sentence. If the two screens share the key, that review silently rewords a
   screen nobody put in front of them. `TN-STUDY` must be free to reword its own summary.
4. **Owning it lets both languages take the same shape.** The row below is a label in English and in French,
   which is `TN-COPY`'s counting rule 1 in its recommended form and identical to `map.stamps`. The
   English-sentence / French-label asymmetry that `OQ-COPY-4` is still open about does not arrive on this
   screen at all.

**What it costs:** one more row per language to keep at grade 6, and one more line for a French reviewer.
**What reverting costs:** one line, because the card would go back to naming a key it does not own. Recorded
as `OQ-DONE-2` so the alternative is written down rather than argued again.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.complete.title` | Level finished! | Niveau terminé! |
| `level.complete.none` | You did not answer any questions here. Every place in this level has something to teach you. | Vous n'avez répondu à aucune question ici. Chaque lieu de ce niveau a quelque chose à vous apprendre. |
| `level.complete.score` | Right answers in this level: {{correct}} out of {{total}} | Bonnes réponses dans ce niveau : {{correct}} sur {{total}} |

**One slot, two rows.** `quest-complete-progress` carries `level.complete.score` when at least one question
was answered in this level, and `level.complete.none` when none was. It is never empty and never both, and
it never reads "0 out of 0" — a total of zero is what `level.complete.none` *is*, not a value the score row
renders.

**`level.complete.score` needs no plural rows in either language.** The noun is a label in front of the
number and each number is followed by a preposition — "out of", « sur » — which is `TN-COPY`'s counting rule
1, the shape `map.stamps` and `exam.rules.pass` already take. It reads correctly at one right answer, at
zero right answers and at a total of one, and no word in it changes between those readings. The French keeps
the space before the colon; neither row ends in a full stop, because a label is not a sentence.

**`level.complete.none` is two sentences and both end in a full stop**, because both are sentences. The
French is a translation of meaning: « Vous n'avez répondu à aucune question ici. » is what a French speaker
says about not having answered anything, and the second sentence keeps the same promise the English makes
about the places in the level rather than about the questions — a level whose question bank is empty
(`TN-QUEST-05`) still has landmarks with sourced blurbs to read, so the sentence is true in a state the card
cannot see.

Neither row contains `(e)`, `·e` or a bracketed ending, and neither needs one.

Keys this card draws and does not own:

| Key | Owned by |
|---|---|
| `quest.done.title`, `quest.done.body`, `common.keepPlaying` | `TN-QUEST-parliament-hill.md`; `quest.done.body` is ruled to become quest content by `TN-DIALOGUE` |
| `stamp.<id>.earned` | that level's own story file — see the table below |
| `level.<id>.play` | that level's own story file — see the table below |
| `map.open`, `map.state.open`, `map.open.help`, `level.<id>.title` | `TN-MAP-level-select.md` and the level story that owns the name |
| `passport.open` | `TN-PASSPORT-my-passport.md` |
| `storage.warning`, `storage.warning.help` | `TN-SAVE-save-and-reload.md` |

## The two rows every built level owns, and where each one lives

Both are **written out per level and never assembled from a template**, for the reason `TN-WAIT` gives about
`level.<id>.error.title` and `README.md` gives about `title.lastPlayed`: **French does not use one
preposition, or one article, for all ten places — and since the Prairies shipped, the English does not
either.** A template is correct in English for five levels and quietly wrong in French for two of them,
which `TN-COPY`'s worked example records as this project's most repeated copy defect. These two tables are a
directory; **the level's story file is where an implementer transcribes from.**

| Level | `stamp.<id>.earned` EN | `stamp.<id>.earned` FR | Story file |
|---|---|---|---|
| `halifax` | You earned the Halifax stamp. | Vous avez obtenu le tampon d'Halifax. | `TN-LEVEL-halifax.md` |
| `quebec-city` | You earned the Québec City stamp. | Vous avez obtenu le tampon de la Ville de Québec. | `TN-LEVEL-quebec-city.md` |
| `ottawa` | You earned the Ottawa stamp. | Vous avez obtenu le tampon d'Ottawa. | `TN-QUEST-parliament-hill.md` |
| `toronto` | You earned the Toronto stamp. | Vous avez obtenu le tampon de Toronto. | `TN-LEVEL-toronto.md` |
| `winnipeg` | You earned the Winnipeg stamp. | Vous avez obtenu le tampon de Winnipeg. | `TN-LEVEL-winnipeg.md` |
| `prairie-rail` | You earned the Prairies stamp. | Vous avez obtenu le tampon des Prairies. | `TN-LEVEL-prairie-rail.md` |

Six levels, and the French takes **four different forms after « tampon »** — « d'Halifax », « de la Ville
de Québec », « de Toronto », « des Prairies ». "You earned the {{level}} stamp." would have produced « le
tampon Ville de Québec », which is not French, and the English would have produced "the The Prairies stamp".
Ottawa's row stays in `TN-QUEST` because the quest is what earns it there; the wording is unchanged and
« tampon » is `TN-PASSPORT`'s settled word.

| Level | `level.<id>.play` EN | `level.<id>.play` FR | Story file |
|---|---|---|---|
| `halifax` | Play Halifax | Jouer à Halifax | `TN-LEVEL-halifax.md` |
| `quebec-city` | Play Québec City | Jouer dans la Ville de Québec | `TN-LEVEL-quebec-city.md` |
| `ottawa` | Play Ottawa | Jouer à Ottawa | `TN-LEVEL-ottawa.md` |
| `toronto` | Play Toronto | Jouer à Toronto | `TN-LEVEL-toronto.md` |
| `winnipeg` | Play Winnipeg | Jouer à Winnipeg | `TN-LEVEL-winnipeg.md` |
| `prairie-rail` | Play the Prairies | Jouer dans les Prairies | `TN-LEVEL-prairie-rail.md` |

Same fact from the other end: four of the six take « à » and no article, one takes « dans la » and one takes
« dans les ». The levels still to come are the same shape — « Jouer dans le Nord », « Jouer dans les
contreforts de l'Alberta ». **This is an improvement, not a fix**: the button draws the level's title alone
today, which is terse but not misleading, so nothing on screen is currently wrong. A label that says what
pressing does is better than one that says where you would end up, and it is the same argument
`TN-REACH-what-is-in-reach.md` makes about the interact prompt.

**A row per built level, and the build says so when one is missing.** `TN-DONE-05` carries the gate, in the
shape `TN-WAIT-03` already uses: a level with a document and no `stamp.<id>.earned` or no `level.<id>.play`
fails the content check, naming the level and the key. A level with no row draws the card **without that
line or without that control** — never another level's row, never a placeholder, never a name dropped into a
sentence.

## What may not appear on this card

1. **No landmark, hotel or business name.** `TN-NAMES-01` puts a name from its list in a point-of-interest
   card's body — and, since `TN-DIALOGUE`, in a quest giver's own words about going there — and nowhere
   else. A completion card is neither. A stamp is named after a **place** (`TN-PASSPORT-02`), and so is the
   play button.
2. **No territorial statement and no paraphrase of one.** Halifax is in Mi'kma'ki, Toronto is on Treaty 13
   land, Winnipeg's level is at The Forks on Treaty No. 1 territory and in the homeland of the Red River
   Métis, and the Prairies level is on Treaty No. 4 land; every one of those level documents carries a
   sourced statement and `docs/content-review.md` §10.2 fixes where a player reads them — the "About this
   place" panel. A stamp line is a congratulation the player taps past, which is the shape §10.2 rules out,
   and a compressed paraphrase of a cited statement is an unsourced claim about a nation.
3. **No score, grade, star, percentage or streak**, and nothing that counts down. The card is the end of a
   level, not a result screen; `TN-RESULT` owns the one screen in this game that reports a result.
4. **No claim that anything was saved.** When storage is blocked the stamp is still earned and
   `storage-warning` is what tells the truth about the rest (`TN-HUD-03`).

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-DONE-06` |
| Single switch | `TN-DONE-06` |
| Screen reader | `TN-DONE-07` |
| Reduced motion | `TN-DONE-07` |
| 200 % text | `TN-DONE-07` |
| Bilingual | `TN-DONE-08`, and `TN-DONE-03` and `TN-DONE-04` carry both languages in their examples |
| Failure path | `TN-DONE-05` (no row, no next level, storage blocked, finishing twice) |

---

## TN-DONE-01 — Reaching the end of a level finishes it

```gherkin
Feature: The completion card
  As a player who has just reached the end of a level
  I want to be told what I earned and what opened
  So that finishing a level is something the game says, not something I have to go and check

  Background:
    Given the Halifax level is playable
    And I have not finished it before

  Scenario: Walking to the end finishes the level
    When I reach the end of the level
    Then the event "level/exitReached" is emitted for "halifax"
    And the event "stamp/earned" is emitted for "halifax"
    And the event "progress/saved" is emitted
    And the element "quest-complete-card" is visible
    And the level does not move behind it

  Scenario: The heading says what finished
    Given I finished this level by reaching the end and no task was accepted
    Then "quest-complete-card" shows "Level finished!"
    And it does not show "Task done!"
    Given I finished this level by completing its task
    Then it shows "Task done!", as TN-QUEST-04 requires

  Scenario: A level with no task always uses the level's heading
    Given the level I finished declares no quest
    Then "quest-complete-card" shows "Level finished!"
    And it never shows "Task done!" on that level, whatever route I took

  Scenario: The stamp line is this level's own sentence
    Then the element "quest-complete-stamp" reads "You earned the Halifax stamp."
    And it does not name Ottawa, Québec City, Toronto, Winnipeg or the Prairies
    And it names no landmark, hotel or business
    And it states no territorial fact and paraphrases none

  Scenario: What I answered here is drawn when I answered something
    Given I answered four questions in this level and three were right
    Then the element "quest-complete-progress" reads "Right answers in this level: 3 out of 4"
    And it shows no percentage, grade, star or streak

  Scenario: The level that just opened is offered
    Given finishing this level opened the next one
    Then a control "quest-complete-next" is offered, reading "Play Québec City"
    And "quest-complete-next-level" carries the map's own sentence about that card
    And a control "quest-complete-map" reading "Choose a level" is offered
    And a control "quest-complete-keep-playing" reading "Keep playing" is offered
    And each is at least 44 CSS px wide and tall

  Scenario: Nothing is chosen for the player
    When I do nothing for two minutes
    Then the card is unchanged
    And nothing on it counts down
    And no control has been taken for me

  Scenario: Keep playing goes back into the level I just finished
    When I tap "Keep playing"
    Then the element "quest-complete-card" is gone
    And the element "playable" accepts input again
    And every landmark in the level can still be engaged
```

## TN-DONE-02 — Reaching the end having answered nothing

```gherkin
Feature: The card does not claim a learning that did not happen
  As a player who walked to the end without stopping
  I want the game to tell me plainly that I did not answer anything
  So that I know there is something here I have not seen yet

  Background:
    Given the Halifax level is playable
    And I have engaged no landmark and answered no question in this level

  Scenario: The card says so, in a sentence
    When I reach the end of the level
    Then the element "quest-complete-progress" reads
      "You did not answer any questions here. Every place in this level has something to teach you."
    And it does not read "Right answers in this level: 0 out of 0"
    And it does not read "0 out of 0"
    And "quest-complete-progress" is not empty and is not absent

  Scenario: It is not a mark and does not read as one
    Then the line contains no number
    And it contains no percentage, grade, star or streak
    And it contains none of "failed", "missed", "skipped", "incomplete" or "only"
    And nothing on the card is drawn as an error, a warning or a red state
    And no sentence on the card tells me I should have done something

  Scenario: It is an open door, and the way back is on the card
    Then "quest-complete-keep-playing" is offered and reads "Keep playing"
    When I take it
    Then the element "playable" accepts input again
    And every landmark in the level can still be engaged
    And the stamp is not taken away

  Scenario: The stamp is still earned, because reaching the end is what earns it
    Then the event "stamp/earned" was emitted for "halifax"
    And "quest-complete-stamp" reads "You earned the Halifax stamp."
    And no sentence on the card says I learned anything

  Scenario: One answer is enough to draw the other line instead
    Given I answered exactly one question in this level and got it wrong
    When I reach the end of the level
    Then "quest-complete-progress" reads "Right answers in this level: 0 out of 1"
    And it does not read the sentence about answering nothing
    And no message tells me I failed
```

## TN-DONE-03 — Every built level has its own stamp sentence

```gherkin
Feature: The stamp line names the level that was finished
  Scenario Outline: Each built level's own row, in English
    Given I finish the <level> level
    Then "quest-complete-stamp" reads "<sentence>"
    And it names no other level

    Examples:
      | level        | sentence                          |
      | Halifax      | You earned the Halifax stamp.     |
      | Québec City  | You earned the Québec City stamp. |
      | Ottawa       | You earned the Ottawa stamp.      |
      | Toronto      | You earned the Toronto stamp.     |
      | Winnipeg     | You earned the Winnipeg stamp.    |
      | The Prairies | You earned the Prairies stamp.    |

  Scenario Outline: Each built level's own row, in French
    Given the language is French
    And I finish the <level> level
    Then "quest-complete-stamp" reads "<sentence>"
    And it does not contain "timbre"

    Examples:
      | level        | sentence                                          |
      | Halifax      | Vous avez obtenu le tampon d'Halifax.             |
      | Québec City  | Vous avez obtenu le tampon de la Ville de Québec. |
      | Ottawa       | Vous avez obtenu le tampon d'Ottawa.              |
      | Toronto      | Vous avez obtenu le tampon de Toronto.            |
      | Winnipeg     | Vous avez obtenu le tampon de Winnipeg.           |
      | The Prairies | Vous avez obtenu le tampon des Prairies.          |

  Scenario: The French is not a template with the place dropped in
    Then no French stamp sentence is assembled from "le tampon" and a level title
    And the four forms "d'Halifax", "de la Ville de Québec", "de Toronto" and "des Prairies"
      are each a written row
    And a build that produces "le tampon Ville de Québec" fails this scenario
    And a build that produces "le tampon de les Prairies" fails it too

  Scenario: The English is not a template either
    Then no English stamp sentence drops a level's title into "You earned the {{level}} stamp."
    And a build that produces "You earned the The Prairies stamp." fails this scenario

  Scenario: The stamp is named after a place, never after a building
    Then no stamp sentence in either language contains a name from TN-NAMES-naming-real-places.md's list
    And the rule is the one in TN-NAMES-01 and TN-PASSPORT-02

  Scenario: The same sentence is what the passport announced
    When the stamp is earned
    Then "#tn-live-region" reads the heading and this level's stamp sentence, once
    And the passport shows that level's slot as "Earned", as TN-PASSPORT-02 describes
```

## TN-DONE-04 — The button that opens the next level

```gherkin
Feature: Going straight into the level that just opened
  Scenario Outline: The label says what pressing will do, per level
    Given finishing a level opened the <level> level
    Then "quest-complete-next" reads "<label>"
    And in French it reads "<french>"
    And it is not the level's title alone

    Examples:
      | level        | label             | french                        |
      | Halifax      | Play Halifax      | Jouer à Halifax               |
      | Québec City  | Play Québec City  | Jouer dans la Ville de Québec |
      | Ottawa       | Play Ottawa       | Jouer à Ottawa                |
      | Toronto      | Play Toronto      | Jouer à Toronto               |
      | Winnipeg     | Play Winnipeg     | Jouer à Winnipeg              |
      | The Prairies | Play the Prairies | Jouer dans les Prairies       |

  Scenario: The French is written per level and never templated
    Then no French label is assembled from "Jouer" and a level title
    And four of the six take "à" with no article, one takes "dans la" and one takes "dans les"
    And a build that draws "Jouer à Ville de Québec" fails this scenario
    And a build that draws "Jouer à les Prairies" fails it too

  Scenario: Taking it opens that level and leaves this one
    Given "quest-complete-next" reads "Play Québec City"
    When I take it
    Then the event "level/chosen" is emitted for "quebec-city"
    And that level's own waiting sentence is shown, as TN-WAIT-01 requires
    And the level I just finished is unloaded before the new one is decoded
    And the element "quest-complete-card" is gone

  Scenario: The map is the other way on, and is never a second primary
    Then exactly one control on the card is marked as the primary action
    And it is "quest-complete-next" while there is a level to offer
    When there is no level to offer
    Then "quest-complete-map" is the primary action instead

  Scenario: The button names a place, not a landmark
    Then no label in either language contains a name from TN-NAMES-naming-real-places.md's list
```

## TN-DONE-05 — Rows that are missing, levels that are not there, and finishing twice (failure path)

```gherkin
Feature: The card is honest about what this build actually has
  Scenario: A built level with no stamp sentence fails the content check
    Given a document exists at "content/levels/<id>.json"
    And no "stamp.<id>.earned" row exists in English and in French
    When the content check runs
    Then the build fails, naming the level and the missing key
    And the same check fails for a missing "level.<id>.play"

  Scenario: The check counts levels, not rows
    Given the number of documents under "content/levels" is six
    Then six "stamp.<id>.earned" rows and six "level.<id>.play" rows exist in each language
    And a seventh level document with no rows fails the check on the day it is added

  Scenario: An unqualified key is refused
    Given a copy table declares "stamp.earned" or "level.play" with no level in the key
    When the content check runs
    Then the build fails, naming the key and pointing at this file

  Scenario: A level with no row draws the card without that line
    Given this build has no "stamp.<id>.earned" row for the level I just finished
    Then the element "quest-complete-stamp" is not present
    And no other level's stamp sentence is drawn
    And nothing reads as "TBD", "???", an empty box or a placeholder
    And the card still shows its heading and its ways on

  Scenario: Nothing opened, because there is nothing left to open
    Given finishing this level opened no other level
    Then no "quest-complete-next" control is present
    And "quest-complete-next-level" is not present
    And no sentence on the card names a level that does not exist
    And "quest-complete-map" and "quest-complete-keep-playing" are both still offered

  Scenario: The level that opened is not built in this build
    Given the unlock rules open a level with no document
    Then no "quest-complete-next" control is present
    And the map draws that level as "Not made yet", as TN-MAP-04 requires
    And nothing on this card says a level is coming, locked or unavailable

  Scenario: Storage cannot be written when the level is finished
    Given local storage cannot be read or written
    When I reach the end of the level
    Then the card is still shown with its stamp sentence
    And the element "storage-warning" is visible, as TN-HUD-03 describes
    And no sentence on the card says the stamp was saved
    And no sentence on the card claims progress was lost

  Scenario: Finishing the same level twice earns nothing twice
    Given I have already finished this level
    When I reach the end of it again
    Then no second "stamp/earned" event is emitted
    And the passport still contains exactly one stamp for it
    And any line the card draws about my answers is the current count, not the old one

  Scenario: The gates are proven by failing fixtures
    Then a fixture exists for each check above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite
```

## TN-DONE-06 — The card from the keyboard and with one switch

```gherkin
Feature: Everybody can finish a level and take the way on
  Scenario: Focus lands on the card, not on the body
    Given I am using a keyboard only
    When the card appears after I reach the end of the level
    Then focus is inside "quest-complete-card"
    And it is not on the document body
    And "Tab" cannot leave the card while it is open

  Scenario: Every control is reachable and operable with a keyboard
    Given I am using a keyboard only
    Then "quest-complete-next", "quest-complete-map" and "quest-complete-keep-playing"
      are each reachable with "Tab" and activate with "Enter"
    And each focus indicator is visible and is not colour alone

  Scenario: Escape keeps playing, and never takes a route I did not ask for
    Given I am using a keyboard only
    When I press "Escape"
    Then the card closes and the level accepts input again
    And no level was opened and no screen was left

  Scenario: The card is completable with one switch
    Given single-switch mode is on
    When I press the switch briefly through the whole card
    Then the highlight visits every control and wraps
    And each control's name is announced as the highlight arrives
    When I hold the switch past the hold-to-choose threshold on "Play Québec City"
    Then that level is opened

  Scenario: Nothing scans and nothing expires
    Given single-switch mode is on
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing on the card counts down
    And no control has been chosen for me

  Scenario: The card is reachable when the world opened it
    Given the level was finished by walking to the end
    Then the card was opened by something the canvas published, not by a control I pressed
    And focus is still placed inside the card
    And closing it puts focus somewhere in the level, never on the body
```

## TN-DONE-07 — The card with a screen reader, with motion off, and at 200 %

```gherkin
Feature: The card announces once and fits
  Scenario: It is a named dialog
    When the card appears
    Then "quest-complete-card" has role "dialog" with "aria-modal" true
    And its accessible name is the heading it drew
    And the rest of the page is inert while it is open
    And any canvas on the page is "aria-hidden"

  Scenario: Arriving is announced once
    When the card appears
    Then "#tn-live-region" reads the heading and the stamp sentence, once
    And it is not repeated while the card stays open
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The line about my answers is read, whichever line it is
    Then "quest-complete-progress" is in the accessibility tree as text
    And it is read as one phrase, with the numbers not separated from the words around them
    And when it is the sentence about answering nothing, both of its sentences are read

  Scenario: The button is named by the place and described by its state
    Then the accessible name of "quest-complete-next" is "Play Québec City"
    And its accessible description is the map's own sentence about that card
    And the description is read after the name, never as part of it

  Scenario: Reduced motion
    Given reduced motion is on
    When the card appears
    Then it appears with no slide, fade, bounce or scale
    And no confetti or particle is drawn
    And "scene-state" reports "data-particles" equal to "0"
    And nothing on the card depends on having seen it arrive

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every line on the card is fully visible, by scrolling inside the card if needed
    And no label is truncated with an ellipsis
    And every control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways

  Scenario: The longest French strings on this card still fit
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Vous n'avez répondu à aucune question ici. Chaque lieu de ce niveau a quelque chose à vous apprendre." is visible
    And the whole of "Vous avez obtenu le tampon de la Ville de Québec." is visible
    And the whole of "Jouer dans la Ville de Québec" is visible on its control
    And the whole of "Jouer dans les Prairies" is visible on its control

  Scenario: axe-core is clean on this screen
    When axe-core runs against the whole page with the card open
    Then the rules "region" and "landmark-one-main" are enabled
    And no axe rule is disabled for this scan
    And the scan passes with no violations
```

## TN-DONE-08 — The card in French

```gherkin
Feature: Finishing a level in French
  Background:
    Given the language is French

  Scenario: The card is French
    When I finish the Halifax level having answered nothing
    Then the heading reads "Niveau terminé!"
    And it does not read "Mission accomplie!"
    And "quest-complete-stamp" reads "Vous avez obtenu le tampon d'Halifax."
    And "quest-complete-progress" reads
      "Vous n'avez répondu à aucune question ici. Chaque lieu de ce niveau a quelque chose à vous apprendre."
    And the buttons read "Jouer dans la Ville de Québec", "Choisir un niveau" and "Continuer à jouer"
    And no English word appears in "quest-complete-card"

  Scenario: The score line is French and is right at one
    Given I answered five questions in this level and one was right
    Then "quest-complete-progress" reads "Bonnes réponses dans ce niveau : 1 sur 5"
    And there is a space before the colon
    And it does not read "1 bonnes réponses"
    And no word in the line differs from the reading at four right out of five
    And the English reading of the same numbers is "Right answers in this level: 1 out of 5"

  Scenario: There is no space before the exclamation mark
    Then the heading reads "Niveau terminé!" and not "Niveau terminé !"

  Scenario: No French string on this card needs gender agreement
    Then no string on the card contains "(e)", "·e" or a bracketed ending

  Scenario: Changing the language while the card is open redraws every line
    Given the card is open in English after finishing Halifax
    When I change the language to French
    Then every line and every control on the card is French
    And the stamp sentence is the French row for the level I finished, not a translation made on the spot
    And the card is still open and no control has been taken

  Scenario: Both languages or neither
    Then every key this card draws has a value in "en" and in "fr"
    And a key present in one language and absent in the other fails the content check
```

---

## Open questions

- **`OQ-DONE-1` — the heading was not asked for, and it is wrong on the path this file exists for.** The card
  draws `quest.done.title` — "Task done!" — for a player who reached the end of a level having accepted no
  task. `level.complete.title` is written above as the second row for a state that has no true string today,
  and `TN-QUEST`'s row is untouched. **Two of the six built levels declare no quest at all**, so on Winnipeg
  and the Prairies the wrong heading is the *only* heading a player can reach. *Recommendation:* ship both
  and pick by what finished. If the project owner would rather have one heading for both paths, the honest
  one is the level's — a quest completing also finishes the level — and `TN-QUEST-04` would be the file
  amended, not this one. What must not happen is the walk-through path keeping a heading about a task,
  because "a screen never describes a state it is not in" is the rule this directory has restated four times.
- **`OQ-DONE-2` — `level.complete.score` could still be `study.summary.score`.** The four reasons for
  splitting are above, and the alternative is one line: the card names Study's key and this row is deleted.
  *Recommendation:* keep the split and put both in front of the first French reviewer, together with
  `OQ-COPY-4` — they are the same question asked about two screens, and answering them in one sitting is how
  the two stay in a deliberate relationship rather than an accidental one.
- **`OQ-DONE-3` — the play button names the place and its description names it again.** A screen-reader user
  hears "Play Québec City" and then "Québec City. Open. You can play this now." — the map's own sentence,
  three reviewed rows joined, which is why the card uses it rather than inventing a fourth.
  *Recommendation:* accept the repetition. The description's job is the **state**, and the state is the half
  a player cannot infer from the button. If a reviewer wants it trimmed, `describeEntry` belongs to
  `app/ui/level-select.ts` under `TN-MAP`, and the change is to expose the state half on its own — not to
  write a new sentence here.
- **`OQ-DONE-4` — « Jouer dans la Ville de Québec » is the longest label on the card.** « Jouer à Québec »
  is shorter and is what a French speaker would say, and it is ambiguous in exactly the way `TN-LEVELS`
  rejected for the title: on its own, « Québec » is the province as often as the city. *Recommendation:*
  keep the long form, because the button may be the only thing on screen naming that level and a player who
  reads « Québec » may think they are being offered a province. If a French reviewer prefers the short form,
  it changes in `TN-LEVEL-quebec-city.md` alone and the error title's article stays as it is.
- **`OQ-DONE-5` — should the card offer the passport?** `TN-QUEST-04` offers "See my passport" on the quest
  path and this card does not draw it on the walk-through path. A stamp was just earned either way.
  *Recommendation:* offer the same three ways on for both paths and leave the passport to the menu and the
  map, because a fourth control on a card a player meets ten times is three taps of clutter against one
  screen they can reach from two places. Recorded because `TN-QUEST-04`'s scenario asserts the passport
  button, so the two paths do not agree today and one of the two files has to change when this is answered.
- **`OQ-DONE-6` — nothing here says what "answered in this level" counts across a reload.** A player who
  answers two questions, closes the tab, comes back and walks to the end reads a total that either includes
  those two or does not, and `TN-SAVE`'s survives table records answers but not which level they were given
  in. *Recommendation:* count the answers given **in this level**, whenever they were given, because that is
  what the sentence says; and if the save cannot answer that, the card counts the sitting and the sentence
  stays true either way. Routed with `OQ-SAVE-1`; `content/schemas/progress.schema.json` is not this
  directory's to edit, and no scenario above fails closed on the answer.
