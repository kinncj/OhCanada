# District: The Justice System

Chapter: The Justice System. Content: `content/districts/justice.json`, `content/quests/justice-intro.json`, questions `content/questions/justice.json` (q-ju-001…). Quest giver: Constable Tremblay (`npc-justice-1`). Landmark trigger: `justice-landmark` ("Court plaza"). Ambience: weather clear, timeOfDay 0.35.

## TN-JUS-01 Innocent Until Proven Guilty (intro) — Implemented

```gherkin
Feature: Intro quest "Innocent Until Proven Guilty" / "Présumé innocent"
  Background:
    Given "justice" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Constable Tremblay
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-justice-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "justice-intro"
    And "dialogue-line" shows "Glad you made it. Head to the court plaza and I'll test what you know."
    And "objective" reads "Reach the court plaza"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "justice-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-ju-001, q-ju-002, q-ju-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-justice-intro" and district "justice"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Constable Tremblay says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Constable Tremblay offers "Accept quest" again
```

## TN-JUS-02 Due Process (puzzle) — Proposed (not yet implemented)

Quest type `puzzle`; proposed id `justice-due-process`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Due Process
  Scenario: Every principle must be right
    Given the answer step lists q-ju-001, q-ju-002, q-ju-003, q-ju-004 with minCorrect 4
    When I answer all four correctly
    Then stamp "stamp-justice-due-process" is awarded
```

## TN-JUS-03 The Courts (dialogue) — Proposed (not yet implemented)

Quest type `dialogue`; proposed id `justice-the-courts`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: The Courts
  Scenario: Talk, reach, answer
    Given a talk step with Constable Tremblay, a reach step to "justice-landmark" and an answer step
    When the answer step asks q-ju-005, q-ju-006, q-ju-007 with minCorrect 2
    Then passing awards a stamp and completionDialogue plays
```
