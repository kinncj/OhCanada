# District: Modern Canada

Chapter: Modern Canada. Content: `content/districts/modern-canada.json`, `content/quests/modern-canada-intro.json`, questions `content/questions/modern-canada.json` (q-mc-001…). Quest giver: Dev Patel, City Planner (`npc-modern-canada-1`). Landmark trigger: `modern-canada-landmark` ("Arena plaza"). Ambience: weather rain, timeOfDay 0.55.

## TN-MC-01 Inventors' Walk (intro) — Implemented

```gherkin
Feature: Intro quest "Inventors' Walk" / "La promenade des inventeurs"
  Background:
    Given "modern-canada" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Dev Patel, City Planner
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-modern-canada-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "modern-canada-intro"
    And "dialogue-line" shows "Glad you made it. Head to the arena plaza and I'll test what you know."
    And "objective" reads "Reach the arena plaza"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "modern-canada-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-mc-001, q-mc-002, q-mc-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-modern-canada-intro" and district "modern-canada"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Dev Patel says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Dev Patel offers "Accept quest" again
```

## TN-MC-02 Blueprints for the Arena (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `modern-canada-blueprints-for-the-arena`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Blueprints for the Arena
  Scenario: Collect blueprint pieces
    Given a collect step with items ["blueprint-a", "blueprint-b", "blueprint-c"]
    When I collect all three
    Then the answer step asks q-mc-002, q-mc-003, q-mc-004 with minCorrect 2
```

## TN-MC-03 Rain Delay (timed) — Proposed (not yet implemented)

Quest type `timed`; proposed id `modern-canada-rain-delay`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Rain Delay
  Scenario: Beat the clock in the rain
    Given weather "rain" is active in this district
    And a reach step for "modern-canada-landmark" with timeLimitSeconds 45
    When I reach the arena plaza in time
    Then 'quest:completed' is emitted; otherwise 'quest:failed' and Dev Patel offers a retry
```
