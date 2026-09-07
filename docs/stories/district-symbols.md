# District: Canadian Symbols

Chapter: Canadian Symbols. Content: `content/districts/symbols.json`, `content/quests/symbols-intro.json`, questions `content/questions/symbols.json` (q-sy-001…). Quest giver: Coach Bouchard (`npc-symbols-1`). Landmark trigger: `symbols-landmark` ("Rink"). Ambience: weather snow, timeOfDay 0.6.

## TN-SYM-01 Raise the Flag (intro) — Implemented

```gherkin
Feature: Intro quest "Raise the Flag" / "Hissez le drapeau"
  Background:
    Given "symbols" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Coach Bouchard
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-symbols-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "symbols-intro"
    And "dialogue-line" shows "Glad you made it. Head to the rink and I'll test what you know."
    And "objective" reads "Reach the rink"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "symbols-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-sy-001, q-sy-002, q-sy-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-symbols-intro" and district "symbols"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Coach Bouchard says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Coach Bouchard offers "Accept quest" again
```

## TN-SYM-02 Colours of Canada (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `symbols-colours-of-canada`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Colours of Canada
  Scenario: Collect the symbols
    Given a collect step with items ["token-flag", "token-beaver", "token-fleur-de-lys"] hidden around the rink
    When all three are collected
    Then the answer step asks q-sy-001, q-sy-004, q-sy-005 with minCorrect 2
```

## TN-SYM-03 Shootout (timed) — Proposed (not yet implemented)

Quest type `timed`; proposed id `symbols-shootout`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Shootout
  Scenario: Cross the snow to the rink
    Given weather "snow" and terrain.snow true in this district
    And a reach step for "symbols-landmark" with timeLimitSeconds 30
    Then arriving in time completes the quest; timing out emits 'quest:failed'
```
