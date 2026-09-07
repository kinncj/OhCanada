# District: Canada's Economy

Chapter: Canada's Economy. Content: `content/districts/economy.json`, `content/quests/economy-intro.json`, questions `content/questions/economy.json` (q-ec-001…). Quest giver: Captain Singh, Harbourmaster (`npc-economy-1`). Landmark trigger: `economy-landmark` ("Harbour office"). Ambience: weather clear, timeOfDay 0.48.

## TN-ECO-01 Trade Routes (intro) — Implemented

```gherkin
Feature: Intro quest "Trade Routes" / "Routes commerciales"
  Background:
    Given "economy" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Captain Singh, Harbourmaster
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-economy-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "economy-intro"
    And "dialogue-line" shows "Glad you made it. Head to the harbour office and I'll test what you know."
    And "objective" reads "Reach the harbour office"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "economy-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-ec-001, q-ec-002, q-ec-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-economy-intro" and district "economy"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Captain Singh says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Captain Singh offers "Accept quest" again
```

## TN-ECO-02 Cargo Manifest (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `economy-cargo-manifest`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Cargo Manifest
  Scenario: Collect the crates
    Given a collect step with items ["crate-1", "crate-2", "crate-3"] on the docks
    When all three are collected
    Then the answer step asks q-ec-003, q-ec-004, q-ec-005 with minCorrect 2
```

## TN-ECO-03 Industries (puzzle) — Proposed (not yet implemented)

Quest type `puzzle`; proposed id `economy-industries`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Industries
  Scenario: All correct on the shape of the economy
    Given the answer step lists q-ec-006, q-ec-007, q-ec-008 with minCorrect 3
    When I answer all three correctly
    Then stamp "stamp-economy-industries" is awarded
```
