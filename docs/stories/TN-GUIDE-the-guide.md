# TN-GUIDE — The guide: what the beaver is called, on every level it appears on

**Intent.** The companion who offers three of this game's four quests has a name before it opens its mouth,
the same name on every level, in both languages — so no offer is ever refused for want of a word.

## The defect this file exists to fix, and it is blocking play today

`content/quests/halifax-clock-and-pier.json`, `content/quests/quebec-city-chateau-frontenac.json` and
`content/quests/toronto-cn-tower.json` all declare `"giver": "guide"`, and all three level documents place
`characterId: "guide"` in the world with a `questId` beside it. `app/ui/dialogue.ts` requires a speaker's
name, because `TN-QUEST-08` requires the dialog's accessible name to be the speaker and refuses "Speaker",
"NPC" and empty. **There is no `npc.guide.name` row**, so all three offers are refused — including on
**Halifax, the level `content/game.config.json` opens on**. Three quarters of the authored quests in this
game cannot be given, and the one row below is what unblocks them.

`npc.officer.name` exists and Ottawa's quest works. This is the same string for the other character.

Read `README.md` in this directory first.

## Why the name lives here and not in three level stories

The guide is on **Halifax, Québec City and Toronto**, and it is one character, not three. `README.md`'s rule
is that the table's home follows what the string belongs to: a waiting sentence belongs to a level, a mode
label belongs to a mode (`TN-MOVE`), and **a character's name belongs to the character**. Written in three
level files it would be written three times, and a name written down twice is a name that can differ in two
places — which is what `TN-QUEST` says in as many words about `npc.officer.name` staying in
`TN-LEVEL-ottawa.md`.

Ottawa's officer appears on one level, so its name sits in that level's file. The guide appears on three, so
its name sits in its own. If a fourth level places the guide, it adds no row.

## The decision: a role, not a proper name

**The guide is named by what it does — "The guide" / « Le guide » — exactly as Ottawa's character is named
"The officer" / « L'agent ».** It gets no proper name. Five reasons, in the order they decided it:

1. **The rig's binding rule already says so.** Every character in this game is named by role and never by a
   personal name or an organisation (`TN-LEVELS`, *The NPCs*; `TN-LEVEL-ottawa.md`, *What is depicted*).
   Eight roles are written down — the guide, the archivist, the officer, the volunteer, the judge, the
   journalist, the rancher, the artist — and "the guide" is the first row of that table. A proper name for
   one of the eight would make it the exception, and the rule is what keeps a force's name off the officer.
2. **A proper name has to work in both languages, and it appears every time the character speaks.** A name
   that reads as English in a French sentence is a small monolingual signal repeated on every line of every
   quest; two names, one per language, is a character with two identities. A role noun sidesteps both: it is
   translated once, like every other string.
3. **Nothing about this character's personality has been established, so a name would be inventing one.**
   `assets/style/guide.md` describes an animal companion at the shared proportion canon, with a tail and two
   incisors carrying the identification, and it says what the guide is **not**: not the player, not a
   mascot the creator was traded for, and "not a stand-in for a person". No authored line gives it a voice
   beyond "I am your guide". A name is characterisation, and characterisation ahead of content is copy for
   behaviour nothing performs (ADR-0008).
4. **"Truly Canadian" is exactly where an invented name would go wrong.** This is the one place in this
   project where that idea is allowed to be literal — it is a beaver — and it is therefore the place where a
   name borrowed from an Indigenous language, a nation, or a nation's imagery is most likely to be reached
   for. `docs/content-review.md` governs this depiction: the guide carries no regalia, no pattern and no
   cultural item of any kind, `indigenous` is `false` for it and that is the only honest value, and §1 lets
   no agent grant the review that a borrowed name would need. **A role noun cannot borrow anything.**
5. **It is what a first-time player needs.** "The guide" says what the character is for. A proper name says
   what it is called, which the player has to learn before it means anything, and this game's plain-language
   bar (CLB 4 / grade 6) is spent on the citizenship test rather than on a cast list.

**What it costs**, written down so the alternative is not re-argued: a companion with a role name is a
thinner character than one with a name, and a game that later wants warmth has to add it in the dialogue
rather than in the label. **What reversing it costs:** one row here, plus every authored quest line that says
« votre guide », plus a French reviewer, plus an answer to reason 4. Recorded as `OQ-GUIDE-1`.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `npc.guide.name` | The guide | Le guide |
| `hud.interact.guide` | Talk to the guide | Parler au guide |

**`npc.guide.name` is the speaker's label**, drawn as `dialogue-speaker` and used as the dialog's accessible
name — one string doing both jobs, so a sighted player and a screen-reader user are told the same thing
(`TN-QUEST-08`). Under ADR-0010 a character's display name is inline content on the character's own document;
`content/characters/` holds no document for the guide or the officer yet, so both names live in the copy
table for now, and this row moves unchanged when they do — the same booking `TN-LEVEL-ottawa.md` records for
`npc.officer.name`.

**`hud.interact.guide` is a per-target row, and this file writes it because the target is on three levels.**
`TN-REACH` owns the generic rows and the order they are chosen in; the generic row for a character is
**"Talk to this person" / « Parler à cette personne »**, and the guide is not a person. That sentence is what
the HUD draws today whenever the beaver is in reach on Halifax, and it is wrong in the plainest possible way.
The key is `hud.interact.<the id the level document gives the target>`, which is `guide` in all three
documents (`TN-REACH`, *The key shape*).

**Why « Le guide » and not « Votre guide » or an agreeing form.** « Guide » is epicene — only its article
changes — so this label needs no bracketed ending and may never acquire one (`docs/content-review.md` §8.6).
The article is fixed masculine, and for this character that decision costs nothing at all: the guide is a
beaver, « un castor » is masculine, and no statement about a *person's* gender is being made. **This is the
one character in the game for which `OQ-LEVEL-8`'s question cannot arise**, which is worth saying out loud
next to seven roles for which it can. The authored quest dialogue already says « votre guide » and
« Parlez à votre guide », which agrees with « le guide » and does not have to change.

**The label is a role, not a species and not a proper name.** It is never "The beaver" / « Le castor »:
that names what the character *is* where the player needs what it is *for*, and the beaver is also one of
the symbols level 9 teaches, which is a second sentence a HUD label should not be starting.

## What is depicted, for the art agent

**The guide (`npc.guide`).** A North American beaver, drawn as a companion who meets the player at points of
interest and offers the level's task. `assets/style/guide.md` is the design sheet and this file does not
restate it: the same six-head proportion canon, the same rig, the same eight states and four expressions as
the player and the officer, with the tail and the two incisors as the identifying features.

**Not depicted, and this is a rule rather than a preference:** no clothing, no regalia, no pattern, no
sash, no beadwork, no cultural item of any kind, from any nation; no lettering anywhere on it; no flag, no
crest and no emblem. The guide never speaks for or as anybody. `indigenous` is `false` for this character —
required, never inferred (`docs/content-review.md` §3.2) — and `nation` is therefore forbidden on it, which
is the schema stating the same thing.

**What this file does not assert:** that any of the above is approved. No scenario here encodes a cultural
sign-off, because no agent may grant one (`docs/content-review.md` §1).

## Rows this file does not own

| What | Key | Owned by |
|---|---|---|
| The generic prompts, and which row wins | `hud.interact.poi`, `hud.interact.npc`, `hud.interact.done`, `hud.interact.hint` | `TN-REACH-what-is-in-reach.md` |
| The dialogue's shape, and that its name is the speaker | — | `TN-QUEST-parliament-hill.md` (`TN-QUEST-08`) |
| What the guide *says* in a quest | authored `dialogue[].text` | `content/quests/<id>.json`, under `TN-DIALOGUE-what-a-quest-giver-says.md` |
| Each level's waiting sentence, error title, stamp and play label | `level.<id>.*`, `stamp.<id>.earned` | that level's own story file |
| The NPC role table for all ten levels | — | `TN-LEVELS-2-to-10-spine.md` |

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-GUIDE-04` |
| Single switch | `TN-GUIDE-04` |
| Screen reader | `TN-GUIDE-05` — the name is the dialog's accessible name, and the prompt is a verb phrase |
| Reduced motion | `TN-GUIDE-04` — the name is text and arrives with the dialogue, never as a flourish |
| 200 % text | `TN-GUIDE-04` |
| Bilingual | `TN-GUIDE-06` |
| Failure path | `TN-GUIDE-02` (no name, so no offer), `TN-GUIDE-03` (the prompt calls it a person) |

---

## TN-GUIDE-01 — The guide has a name before it speaks

```gherkin
Feature: The companion is named on every level it appears on
  As a player meeting the character who offers this level's task
  I want to be told who is talking
  So that the offer can be made at all, and so I know who to go back to

  Scenario Outline: Engaging the guide opens a named dialogue
    Given the <level> level is playable
    And I have not accepted that level's quest
    When I engage the guide
    Then the event "dialogue/opened" is emitted
    And the event "quest/offered" is emitted for "<quest>"
    And the element "dialogue-speaker" reads "The guide"
    And the dialogue is not refused

    Examples:
      | level       | quest                          |
      | Halifax     | halifax-clock-and-pier         |
      | Québec City | quebec-city-chateau-frontenac  |
      | Toronto     | toronto-cn-tower               |

  Scenario: The first level the game opens on can give its quest
    Given I have no saved game
    And the game opens on the Halifax level
    When I engage the guide
    Then the offer is shown with "dialogue-accept" and "dialogue-decline"
    And no offer is refused for want of a speaker's name

  Scenario: One row, three levels
    Then all three levels draw the same string for the guide's name
    And no level document carries its own wording for it
    And the name is not assembled from the character's id

  Scenario: The name is a role
    Then "dialogue-speaker" is not a personal name
    And it does not name an organisation
    And it does not name a species
    And it names no nation, and contains no word from the deny-list in docs/content-review.md §3.1
```

## TN-GUIDE-02 — A character with no name gives no quest (failure path)

```gherkin
Feature: A missing speaker's name fails the build, not the player
  Scenario: A quest whose giver has no name row fails the content check
    Given a quest document declares a giver
    And no "npc.<giver>.name" row exists in English and in French
    When the content check runs
    Then the build fails, naming the quest, the giver and the missing key
    And the message points at this file

  Scenario: A row present in one language only fails the same check
    Given "npc.guide.name" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: No dialogue opens with a placeholder name
    Given a dialogue is opened
    Then "dialogue-speaker" is not empty
    And it does not read "Speaker", "NPC", "Character" or "Dialogue"
    And it does not read the character's id
    And the dialog's accessible name is the same string, as TN-QUEST-08 requires

  Scenario: The refusal is visible, not silent
    Given a build has no name for a quest's giver
    When I engage that character
    Then no dialogue opens with an unnamed speaker
    And the failure has already been reported by the content check
    And nothing on screen reads as "TBD", "???" or an empty heading

  Scenario: The gate is proven by a failing fixture
    Given a fixture quest document whose giver has no name row
    Then the check is asserted to fail on it
    And a change that makes that fixture pass fails this suite
```

## TN-GUIDE-03 — The HUD does not call the guide a person (failure path)

```gherkin
Feature: The prompt says what pressing does, about the thing that is actually there
  Scenario: The prompt in reach of the guide
    Given the Halifax level is playable
    When I come within reach of the guide
    Then the element "interact-prompt" reads "Talk to the guide"
    And it does not read "Talk to this person"
    And it does not read "The guide" on its own, because a name is not a verb phrase
    And it does not read the character's id

  Scenario: The same row on the other two levels
    Given the Québec City level is playable
    When I come within reach of the guide
    Then "interact-prompt" reads "Talk to the guide"
    Given the Toronto level is playable
    When I come within reach of the guide
    Then "interact-prompt" reads "Talk to the guide"

  Scenario: A finished character still says the state first
    Given I have finished this level's quest
    When I come within reach of the guide
    Then "interact-prompt" reads "Done. See this one again", as TN-REACH-01 requires
    And this file's row is not drawn instead of it

  Scenario: The generic row is still right for a person
    Given a level places a character with no per-target row
    Then "interact-prompt" reads "Talk to this person"
    And that row is unchanged by this file
```

## TN-GUIDE-04 — The name reaches a keyboard, one switch, big text and no motion

```gherkin
Feature: Everybody is told who is speaking
  Scenario: A keyboard player reaches the offer and can answer it
    Given I am using a keyboard only
    And the Halifax level is playable
    When I engage the guide with the key bound to "interact"
    Then focus moves into "dialogue"
    And "dialogue-speaker" is visible above the lines
    And "dialogue-accept" and "dialogue-decline" are reachable with "Tab" and activate with "Enter"
    And "Tab" cannot leave the dialogue while it is open

  Scenario: A switch user reaches it too
    Given single-switch mode is on
    And the guide's offer is open
    Then both choices are reached with short presses and chosen with a long press
    And the speaker's name is announced when the dialogue opens
    And nothing expires while I decide

  Scenario: The name is text, not a flourish
    Given reduced motion is on
    When the guide's offer opens
    Then "dialogue-speaker" reads "The guide" with no slide, fade, scale or typewriter effect
    And nothing about who is speaking is told only by an animation or by the picture

  Scenario: It fits at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is French
    Then the whole of "Le guide" is visible above the dialogue lines
    And the whole of "Parler au guide" is visible on "interact-prompt"
    And neither is truncated with an ellipsis
    And the prompt is still at least 44 CSS px wide and tall
    And the page does not scroll sideways
```

## TN-GUIDE-05 — The guide with a screen reader

```gherkin
Feature: The dialog is named by who is in it
  Scenario: The name is the dialog's accessible name
    When the guide's offer opens
    Then "dialogue" has role "dialog" with "aria-modal" true
    And its accessible name is "The guide", the value of "npc.guide.name"
    And the same string is drawn as "dialogue-speaker", so it is seen as well as heard
    And the rest of the page is inert while it is open
    And any canvas on the page is "aria-hidden"

  Scenario: The prompt is read as an action
    When I come within reach of the guide
    Then "interact-prompt" is in the accessibility tree as text reading "Talk to the guide"
    And it is read as a verb phrase, not as a name
    And "#tn-live-region" is not used to repeat it while I stand still

  Scenario: Arriving is announced once
    When the guide's offer opens
    Then "#tn-live-region" reads the speaker's name and the first line, once
    And it is not repeated while the dialogue stays open
    And exactly one element on the page has an "aria-live" attribute
```

## TN-GUIDE-06 — The guide in French

```gherkin
Feature: The companion in French
  Background:
    Given the language is French

  Scenario: The speaker is French on all three levels
    When I engage the guide on Halifax, on Québec City and on Toronto in turn
    Then "dialogue-speaker" reads "Le guide" each time
    And it does not read "The guide"
    And it does not read "Le castor"

  Scenario: The prompt is French
    When I come within reach of the guide
    Then "interact-prompt" reads "Parler au guide"
    And it does not read "Parler à cette personne"

  Scenario: The label and the authored lines use the same word
    Then "dialogue-speaker" and the quest's own step prompt use the same word for this character
    And a step prompt reading "Parlez à votre guide" agrees with "Le guide"

  Scenario: No form of this name needs gender agreement
    Then no string naming the guide contains "(e)", "·e" or a bracketed ending
    And the article is the same in every string that carries one

  Scenario: Changing language changes the name without leaving the level
    Given the level is playable and the language is English
    When I change the language to French
    Then "interact-prompt" reads "Parler au guide"
    And "dialogue-speaker" reads "Le guide" the next time the guide speaks
    And the element carries "lang" equal to "fr"

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And a key present in one language and absent in the other fails the content check
    And no string in this file is drawn onto the canvas as part of an image
```

---

## Open questions

- **`OQ-GUIDE-1` — a proper name is still available, and this is what taking it would cost.** The decision
  above is a role name, for the five reasons written out. *Recommendation:* keep it, and if the project owner
  wants a named companion, decide it **before** the three quests' dialogue is verified rather than after —
  the name would appear in `npc.guide.name`, in every authored line that says "your guide", and in the step
  prompts, and it would need a French reviewer and an answer to reason 4 (nothing about it may borrow from a
  nation's language or imagery). What must not happen is a name arriving in one quest document and not in the
  other two.
- **`OQ-GUIDE-2` — should the label be "Your guide" / « Votre guide »?** The authored lines already say
  "I am your guide" and "Talk to your guide", so the possessive is in the content and not in the label.
  *Recommendation:* keep "The guide" / « Le guide », to match `npc.officer.name`'s shape — a speaker label is
  read as a heading over the words, and « Votre guide : Bonjour! Je suis votre guide. » says it twice. Note
  that « Votre guide » would also make the article question disappear entirely, which is the one argument for
  it; it is recorded because a French reviewer may prefer it.
- **`OQ-GUIDE-3` — the guide has no character document, so `indigenous: false` is not yet declared anywhere.**
  `content/schemas/character.schema.json` requires it and `content/characters/` holds only `rig.json`;
  today the guide exists as a `characterId` in three level documents and a name in a copy table. Nothing in
  this file depends on the document existing, and the depiction rules bind the art sheet either way.
  *Recommendation:* the character documents for the guide and the officer are written in the same change,
  each declaring `indigenous` explicitly and neither carrying a `nation`. Routed to the architect and to
  content; `content/` is not this directory's to edit.
- **`OQ-GUIDE-4` — three quests share one giver, and nothing says whether it is the same individual.** A
  player who meets the guide in Halifax and again in Toronto is either meeting the same companion who
  travelled with them or a different guide in each city, and no string in this game answers it. Nothing here
  depends on the answer — a role label is true of both readings — but the authored dialogue will have to
  pick one the first time the guide says anything about having been somewhere before.
  *Recommendation:* the same companion, because that is what a companion is and because the passport is
  already a record of one journey; recorded so the content author decides it rather than discovers it.
