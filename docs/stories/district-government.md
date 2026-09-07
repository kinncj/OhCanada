# District: How Canadians Govern Themselves

Chapter: How Canadians Govern Themselves. Content: `content/districts/government.json`, `content/quests/government-intro.json`, questions `content/questions/government.json` (q-gv-001…). Quest giver: Speaker Nguyen (`npc-government-1`). Landmark trigger: `government-landmark` ("Legislature steps"). Ambience: weather clear, timeOfDay 0.4.

## TN-GOV-01 Three Branches (intro) — Implemented

```gherkin
Feature: Intro quest "Three Branches" / "Trois pouvoirs"
  Background:
    Given "government" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Speaker Nguyen
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-government-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "government-intro"
    And "dialogue-line" shows "Glad you made it. Head to the legislature steps and I'll test what you know."
    And "objective" reads "Reach the legislature steps"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "government-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-gv-001, q-gv-002, q-gv-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-government-intro" and district "government"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Speaker Nguyen says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Speaker Nguyen offers "Accept quest" again
```

## TN-GOV-02 Order in the House (puzzle) — Proposed (not yet implemented)

Quest type `puzzle`; proposed id `government-order-in-the-house`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Order in the House
  Scenario: No mistakes on the structure of government
    Given the answer step lists q-gv-001, q-gv-002, q-gv-003, q-gv-004 with minCorrect 4
    When I answer all four correctly
    Then stamp "stamp-government-order" is awarded
```

## TN-GOV-03 Who Holds Office (dialogue) — Proposed (not yet implemented)

Quest type `dialogue`; proposed id `government-who-holds-office`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Who Holds Office
  Scenario: Volatile facts are flagged
    Given the answer step asks q-gv-005, q-gv-006, q-gv-007, q-gv-008 with minCorrect 3
    Then each of these questions has "volatile": true in content
    And the feedback shows "Source: Discover Canada: …" and the content review date
    And a content-review task is raised if asOf is older than volatileMaxAgeDays (180)
```
