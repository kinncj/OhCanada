# TN-KINGSTON: Kingston, building Canada from 1812 to 1945

**Intent.** A player walks Kingston's waterfront in portrait with one thumb. They stand at Fort Henry, at
Kingston City Hall, at the Kingston Mills locks and at the Royal Military College, and at each one they hear one
true sentence from *Discover Canada*. Then they are asked about the building of the country, from the War of
1812 to the end of the Second World War. The level teaches before it asks, and it asks only its own subject.

**Status: Proposed. Kingston does not ship before ADR-0068 §7's condition holds.** ADR-0065 §1's room test
must be met at Québec City, by its tier 2 stops landing or by their refusal being recorded. This story
fixes what Kingston is, so the work can be planned and every gate knows what to expect. It authors no
question, no line and no blurb. The content steps (re-filing 65 questions under `building-canada`, and the
verifier's re-grant) are obligations in ADR-0068, and the map steps are obligations in ADR-0069.

Read `README.md` in this directory first. It fixes the shared markers, the scene probe, the event names and
the single-switch contract these scenarios use. `TN-LEVEL-ottawa.md` is the full level story whose shape this
one follows.

| What | Decided by |
|---|---|
| The subject, `building-canada`, and its 65 questions | ADR-0068 §1–§2 |
| That Québec City keeps `history` (32) and asks nothing else | ADR-0068 §3 |
| Journey slot 5, between Ottawa and Toronto, and unlocking after Ottawa | ADR-0068 §9 |
| The map pin, in the corridor inset with Ottawa and Toronto | ADR-0069 §5 |
| What a landmark may say | ADR-0056 §3 (the strike-the-name test) |
| What the level may ask | ADR-0057 (taught first), ADR-0048 (a stop asks its own question or nothing) |
| What it may depict of people | `docs/content-review.md` §1, §4.4, §9.4; ADR-0068 §10 |

## The subject

**`building-canada`**: the War of 1812 and the defences built after it, the rebellions and responsible
government, the Province of Canada, Confederation and the Dominion, when each province and territory joined,
the Red River and the North-West, the railway, the South African War and the First World War, the vote for
women, the years between the wars, and the Second World War. It holds 65 verified questions once ADR-0068's
re-grant lands, which is 35 above the floor.

## What is depicted, for the art agent

Each landmark needs an `assets/refs/references.json` contract (`expectedBlindAnswer`, photographs in
`referenceFiles`, `mustBeRight`, `neverAdd`) and a blind identification run (`make verify-art`) before it
ships. Simplified, reference-accurate cartoon shapes, never invented (CLAUDE.md, Art).

| Stop (`id`, proposed) | What is drawn | What its blurb tells (the guide's words, paraphrased) | Page, and whose question grades it |
|---|---|---|---|
| `fort-henry` | Fort Henry on Point Henry: the fort's limestone walls, as photographed. The contract lists the features that must be right. **No figures.** | Britain paid for costly defences in Canada, and one of them was Fort Henry at Kingston. Today these are popular historic sites. | p. 30, `hist-97` (`building-canada`). The guide names this landmark (ADR-0056 §6, "best"). |
| `kingston-city-hall` | Kingston City Hall, the domed limestone building on the waterfront, as photographed. The contract lists the features that must be right. | Sir John A. Macdonald was a lawyer in Kingston, Ontario. He was a skilled politician and a colourful person. | p. 35, carried by the lesson passage in `history-05-opening-the-west`. No question grades it. |
| `kingston-mills` | The Kingston Mills locks on the Rideau Canal: the stone lock chambers and the wooden gates, as photographed | The Duke of Wellington chose Bytown (Ottawa) as the end point of the Rideau Canal. | p. 30, `hist-39` (`building-canada`). See `OQ-KINGSTON-2`. |
| `royal-military-college` | The Royal Military College of Canada on Point Frederick, drawn from photographs. The contract picks the view. **Buildings only. No cadets, crest or badge.** | Canada's red-white-red flag pattern comes from the flag of the Royal Military College in Kingston, founded in 1876. | p. 79, `sym-05` (`symbols`). Told here and graded at Vancouver (ADR-0030 §2). |

**The quest giver** is a present-day character with no cultural markers. It is not a portrayal of any named
person: not Macdonald, Brock, Laura Secord, Tecumseh, Joseph Brant or Louis Riel. `OQ-KINGSTON-1` asks
whether that is the existing `guide` or a new character.

**Not depicted, and this is a rule, not a preference:**

- **No Indigenous person, in any scene, in any form**, including silhouettes and crowds (content-review §1,
  item 6). Tier 3 review does not exist. The level still teaches Tecumseh and the Métis of Red River, in words,
  faithfully (§9.4).
- **No Métis sash, and no object belonging to a specific nation** (content-review §1, item 2; §4.4).
- **No Macdonald statue.** The statue that stood in City Park was taken down in 2021. The art contract
  confirms the present state of every site from dated photographs. A thing that is not there is not drawn.
- **Bellevue House is not a stop.** Its blurb would have to say, or strongly imply, that Macdonald lived
  there, and the guide does not say so. ADR-0056 §3's test fails on the implication.
- **No soldier re-enactors at Fort Henry, and no cadets at the college.** A uniform on a figure is a claim
  about an organisation that this level has no source for.

## The quest shape

One quest, given at the start, of nine steps. Stops sit in x order along the level. The quest's steps follow
them, and `a-quests-answer-steps-fill-in-one-sitting.test.ts` walks them that way. There are five stops (the
giver and four landmarks) and **four `answer` steps**, which is one below the stop ceiling, like nine of the
ten shipped levels.

| # | Kind | Target | What it does |
|---|---|---|---|
| 0 | `talk` | giver | Offers the task. One line teaches that the United States invaded in June 1812 (p. 29). |
| 1 | `visit` | `fort-henry` | Lines teach the defence of Canada in the War of 1812 and what it ensured (pp. 29–31). |
| 2 | `answer` | `fort-henry` | Asks about the War of 1812 and Canada's defence. |
| 3 | `visit`, then `read` | `kingston-city-hall` | Lines teach the Province of Canada, responsible government, Confederation and the first Prime Minister (pp. 31–35). A `read` step names at most four passages and at most 120 words at this stop (ADR-0065 §3.3). |
| 4 | `answer` | `kingston-city-hall` | Asks about how Canada became a country. |
| 5 | `visit` | `kingston-mills` | Lines teach how the Dominion grew: the provinces joining, the Red River and Manitoba, the railway (pp. 34–37). |
| 6 | `answer` | `kingston-mills` | Asks about the Dominion growing from sea to sea. |
| 7 | `visit` | `royal-military-college` | Lines teach Canada in the two world wars and what Remembrance Day is for (pp. 38–44). |
| 8 | `answer` | `royal-military-college` | Asks about Canadians at war and at home, 1899–1945. |

Each `answer` step names a `questionPool` of `building-canada` ids. The pools share no ids, and each holds at
least its `count` of 4 or 5. Every pooled id rests on a sentence a step **before** it has told (ADR-0057 §1).
The closing line claims the route ("every question along the way"), not the place. The ids in each pool, and
every line's words, are the content author's to write and the verifier's to grant.

**Locomotion: `walk`.** No new mode or rig. The season and the weather are the art sheet's.

## Player-facing copy (proposed; the product owner ratifies)

| Key | EN | FR |
|---|---|---|
| `level.kingston.title` | Kingston | Kingston |
| `level.kingston.subtitle` | Building Canada | Bâtir le Canada |
| `level.kingston.loading` | Getting the waterfront ready. | Préparation du bord de l'eau. |
| `level.kingston.error.title` | We could not load Kingston. | Nous n'avons pas pu charger Kingston. |
| `stamp.kingston.earned` | You earned the Kingston stamp. | Vous avez obtenu le tampon de Kingston. |
| `level.kingston.play` | Play Kingston | Jouer à Kingston |
| `level.quebec-city.subtitle` (**changes**) | Early Canada | Les débuts du Canada |

**`level.kingston.subtitle` is also the exam's name for the subject**, because `app/bootstrap/subjects.ts`
labels a result row with the subtitle of the level that carries the subject. So is Québec City's, which is why
Québec City's narrows. The loading line names no landmark (`TN-NAMES-01`). A landmark's name appears only on
its card and in the quest's own words about going there.

## Accessibility and bilingual coverage map

| Need | Where it is held |
|---|---|
| Keyboard-only and single-switch completion | TN-KINGSTON-08 |
| Canvas `aria-hidden`; events in the live region | TN-KINGSTON-08 |
| Step prompts in three wrapped lines at 390×844 and 200% text | TN-KINGSTON-05 |
| Colour is never the only signal (map pin, stamp) | TN-KINGSTON-07 |
| EN and FR for every string, blurb and line | TN-KINGSTON-09 |

---

## TN-KINGSTON-01: Kingston asks its own subject, and it is a whole one

```gherkin
Feature: Kingston's subject is building-canada, split from history under ADR-0068
  Scenario: The level names its subject and the bank clears the floor
    Given the level document "content/levels/kingston.json"
    Then its "subject" is "building-canada"
    And "content/questions/building-canada/" holds at least 30 questions whose verification status is "verified" for the current sourceHash
    And no other level document names "building-canada"

  Scenario: The split left both halves whole
    Given the question banks "history" and "building-canada"
    Then "history" holds at least 30 verified questions
    And no question in "building-canada" rests on a source.quote that shares a proposition with a question in "history"
    And every id that was in "history" before the split is in exactly one of the two banks, under its old id

  Scenario: Kingston asks nothing from another subject
    Given any answer step of Kingston's quest
    Then every id in its questionPool is in "building-canada"
    And no landmark on the level asks a question from "symbols" or "history" when no task is running
```

## TN-KINGSTON-02: Kingston opens after Ottawa, and no player loses a level

```gherkin
Feature: Where Kingston sits in the journey
  Scenario: Kingston is fifth on the map and opens with Ottawa's stamp
    Given "journey" in "content/game.config.json"
    Then "kingston" is at position 5, after "ottawa" and before "toronto"
    And "kingston" follows "ottawa" in "unlockRules.order"
    When a player earns the Ottawa stamp
    Then the Kingston card on the level select is open

  Scenario: A save made before Kingston existed keeps every level it had
    Given a save with stamps for "halifax", "peggys-cove", "quebec-city", "ottawa" and "toronto"
    When the game with Kingston loads that save
    Then "toronto" and every level that save could open before are still open
    And "kingston" is open
    And the player's review history for every question id is unchanged
```

## TN-KINGSTON-03: Fort Henry tells the guide's own sentence about it

```gherkin
Feature: The landmarks tell what the guide says, and name only themselves
  Background:
    Given the Kingston level is playable

  Scenario: Fort Henry's card
    When I engage "fort-henry"
    Then the card's heading reads "Fort Henry"
    And the blurb says that Britain paid for costly defences in Canada, including Fort Henry at Kingston, and that these are popular historic sites today
    And the blurb states no date, height, first or role that p. 30 of the guide does not state

  Scenario: Striking the landmark's name from any blurb leaves the guide's claim unchanged
    Given any point of interest on the Kingston level
    When its own name is struck from its blurb
    Then what is left is entailed by the passage its fact cites

  Scenario: City Hall tells Macdonald as the guide states him
    When I engage "kingston-city-hall"
    Then the blurb says that Sir John A. Macdonald was a lawyer in Kingston
    And the blurb does not say that Macdonald worked in, built, used or visited City Hall
    And no statue of Macdonald is drawn anywhere in the level

  Scenario: The college tells the flag sentence and asks nothing of its own
    Given no answer step is running
    When I engage "royal-military-college"
    Then the blurb says that the flag's red-white-red pattern comes from the Royal Military College's flag, and that the college was founded in 1876
    And no question card opens
```

## TN-KINGSTON-04: Kingston Mills does not make its own distractor true

```gherkin
Feature: A question is fair where it is asked
  Scenario: The canal question is granted for Kingston before Kingston asks it
    Given "hist-39-wellington-and-bytown" is in any Kingston questionPool
    Then its current verification was granted after it was re-filed into "building-canada"
    And that grant records the verifier's ruling on the option "Kingston." as asked at Kingston

  Scenario: If the ruling refuses the distractor, the question waits
    Given the verifier refused "hist-39-wellington-and-bytown" at re-grant
    Then no Kingston questionPool names it
    And it returns to the content author, not to Québec City
```

## TN-KINGSTON-05: The quest teaches, then asks

```gherkin
Feature: Kingston's quest
  Background:
    Given the Kingston level is playable

  Scenario: The quest can be finished in one walk
    When I walk the level from spawn to end, engaging each stop once in order
    Then all four answer steps complete
    And the quest is done
    And the Kingston stamp is earned

  Scenario: Every question was taught on this level before it was asked
    Given any id in any Kingston answer step's questionPool
    Then its source.quote shares a proposition with a fact claim that a point of interest or an earlier step on this level tells

  Scenario: The pools are topics, not periods
    Given the four answer steps
    Then no two pools share an id
    And each pool holds at least its step's count
    And each step's prompt names what its questions are about

  Scenario: Each step prompt fits the task strip
    Given the text size is 200% and the viewport is 390 by 844
    Then every Kingston step prompt wraps to at most three lines in English and in French

  Scenario: The stop's reading stays short
    Given the read step at "kingston-city-hall"
    Then the read steps at that stop name at most four passages and at most 120 words in either language
```

## TN-KINGSTON-06: Kingston depicts no nation and teaches what the guide says about them

```gherkin
Feature: Content review on the Kingston level
  Scenario: No Indigenous person is drawn
    Given every art key the Kingston level names
    Then none depicts a person, figure, silhouette or crowd identified as Indigenous
    And none depicts a Métis sash or an object of a specific nation

  Scenario: A teaching line about Tecumseh or the Métis is the guide's, faithfully
    Given a Kingston quest line resting on p. 29 (Tecumseh) or pp. 35–36 (the Métis of Red River, Louis Riel)
    Then it paraphrases its cited sentence and adds no context, judgement or correction
    And its speaker is the quest giver, who is not drawn as Indigenous

  Scenario: The territory statement names only what its source prints
    When I open "About this place" in Kingston
    Then the statement's first line is the territorial fact
    And every nation it names appears in the source that its fact cites
    Or it names none and says why
    And the link reads the name of the source's publisher, in the language I am reading
```

## TN-KINGSTON-07: The map shows Kingston without covering its neighbours

```gherkin
Feature: Kingston on the level select
  Scenario: Kingston is pinned in the corridor inset
    Given the level select map
    Then the pins for "ottawa", "kingston" and "toronto" are drawn in the same inset and not on the main map
    And any two pins drawn in one frame are at least one pin's width apart
    And the route runs from Québec City on the main map into the inset at Ottawa, then Kingston, then Toronto, and out to Winnipeg

  Scenario: The map is still decoration
    Then the map is aria-hidden and holds nothing focusable
    And Kingston's card in the list shows the numeral 5 and its state in words, not by colour alone
```

## TN-KINGSTON-08: Kingston can be played with a keyboard or one switch

```gherkin
Feature: Kingston is playable without a touch screen
  Scenario: Keyboard only
    Given no pointer is used
    When I complete the level with the keyboard
    Then every stop could be engaged, every card answered and closed, and the stamp earned

  Scenario: Single switch
    Given single-switch mode is on and auto-move is on
    When I press the switch at each card
    Then the level can be finished

  Scenario: The live region says what the canvas shows
    When the walker comes within reach of "fort-henry"
    Then the offer is announced in "#tn-live-region"
    And the Phaser canvas is aria-hidden
```

## TN-KINGSTON-09: Kingston in French, and in the exam

```gherkin
Feature: Kingston in both languages, and in Exam mode
  Scenario: Every Kingston string, blurb and line has both languages
    Given the locale is "fr"
    Then every copy row above, every blurb and every quest line draws French text
    And "Kingston" is not translated

  Scenario: The exam names Kingston's subject by its level
    Given an exam that drew a question from "building-canada"
    When the result screen draws its rows by subject
    Then that row is labelled with "level.kingston.subtitle"
    And the start screen says "Subjects ready" out of 11
```

## Open questions

| Id | Question | Owner | Blocks |
|---|---|---|---|
| OQ-KINGSTON-1 | Is the quest giver the existing `guide` (no new rig), or a new generic character? A new one needs its own story and art contract. | PO | the quest document |
| OQ-KINGSTON-2 | If the verifier refuses `hist-39`'s "Kingston." distractor as asked at Kingston, does `kingston-mills` keep the Rideau blurb and ask nothing, or tell a different p. 30 sentence? | PO | the Kingston Mills stop |
| OQ-KINGSTON-3 | ADR-0068 §10 reads content-review §1, item 5 as not applying to Kingston. A person, not an agent, rules on that reading. | PO | nothing, until ruled otherwise |
| OQ-KINGSTON-4 | Should an "About this place" panel carry context about Macdonald beyond the guide's framing, written by somebody who may write it (content-review §9.4, §10, `OQ-REVIEW-9`)? No agent writes it. | PO | nothing; the level ships faithful to the guide without it |
