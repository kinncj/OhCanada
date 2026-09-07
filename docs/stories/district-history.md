# District: Canada's History

Chapter: Canada's History. Content: `content/districts/history.json`, `content/quests/history-intro.json`, questions `content/questions/history.json` (q-hi-001…). Quest giver: Marie, Fur-Trade Historian (`npc-history-1`). Landmark trigger: `history-landmark` ("The old fort gate"). Ambience: weather fog, timeOfDay 0.3.

## TN-HIS-01 Confederation Bell (intro) — Implemented

```gherkin
Feature: Intro quest "Confederation Bell" / "La cloche de la Confédération"
  Background:
    Given "history" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Marie, Fur-Trade Historian
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-history-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "history-intro"
    And "dialogue-line" shows "Glad you made it. Head to the the old fort gate and I'll test what you know."
    And "objective" reads "Reach the the old fort gate"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "history-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-hi-001, q-hi-002, q-hi-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-history-intro" and district "history"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Marie says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Marie offers "Accept quest" again
```

## TN-HIS-02 In Order of Events (puzzle) — Proposed (not yet implemented)

Quest type `puzzle`; proposed id `history-in-order-of-events`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: In Order of Events
  Scenario: Every date must be right
    Given the answer step lists q-hi-001, q-hi-002, q-hi-004, q-hi-005 with minCorrect 4
    When I answer all four correctly
    Then 'quest:completed' is emitted with stamp "stamp-history-timeline"
    And one wrong answer fails the quest after the fourth feedback
```

## TN-HIS-03 The Fur-Trade Ledger (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `history-the-fur-trade-ledger`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: The Fur-Trade Ledger
  Scenario: Gather the ledger pages
    Given a collect step with items ["ledger-page-1", "ledger-page-2", "ledger-page-3"] near the fort, the flag and the station
    When all three are collected
    Then a reach step returns me to "history-landmark"
    And Marie's completionDialogue plays and a stamp is awarded
```
