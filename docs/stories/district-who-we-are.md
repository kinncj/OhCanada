# District: Who We Are

Chapter: Who We Are. Content: `content/districts/who-we-are.json`, `content/quests/who-we-are-intro.json`, questions `content/questions/who-we-are.json` (q-ww-001…). Quest giver: Elder Sarah Cardinal (`npc-who-we-are-1`). Landmark trigger: `who-we-are-landmark` ("Gathering circle"). Ambience: weather clear, timeOfDay 0.7.

## TN-WWA-01 Three Peoples (intro) — Implemented

```gherkin
Feature: Intro quest "Three Peoples" / "Trois peuples"
  Background:
    Given "who-we-are" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Elder Sarah Cardinal
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-who-we-are-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "who-we-are-intro"
    And "dialogue-line" shows "Glad you made it. Head to the gathering circle and I'll test what you know."
    And "objective" reads "Reach the gathering circle"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "who-we-are-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-ww-001, q-ww-002, q-ww-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-who-we-are-intro" and district "who-we-are"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Elder Sarah Cardinal says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Elder Sarah Cardinal offers "Accept quest" again
```

## TN-WWA-02 Voices of the Circle (dialogue) — Proposed (not yet implemented)

Quest type `dialogue`; proposed id `who-we-are-voices-of-the-circle`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Voices of the Circle
  Scenario: Three conversations then a quiz
    Given three talk steps with proposed NPCs npc-who-we-are-2, npc-who-we-are-3, npc-who-we-are-4 seated at the gathering circle
    When I speak to each in any order the quest permits (steps are sequential)
    Then "objective" advances after each talk
    And the answer step asks q-ww-002, q-ww-006, q-ww-008 with minCorrect 2
```

## TN-WWA-03 Around the Circle (timed) — Proposed (not yet implemented)

Quest type `timed`; proposed id `who-we-are-around-the-circle`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Around the Circle
  Scenario: Reach the gathering circle before the drum stops
    Given a reach step for "who-we-are-landmark" with timeLimitSeconds 60
    When I accept at Elder Sarah Cardinal's position [3, 0, 12]
    Then role="timer" starts at "01:00"
    And entering the trigger before 00:00 completes the step; reaching 00:00 emits 'quest:failed'
```
