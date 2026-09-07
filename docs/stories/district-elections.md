# District: Federal Elections

Chapter: Federal Elections. Content: `content/districts/elections.json`, `content/quests/elections-intro.json`, questions `content/questions/elections.json` (q-el-001…). Quest giver: Fatima, Returning Officer (`npc-elections-1`). Landmark trigger: `elections-landmark` ("Polling station"). Ambience: weather clear, timeOfDay 0.5.

## TN-ELE-01 Cast Your Ballot (intro) — Implemented

```gherkin
Feature: Intro quest "Cast Your Ballot" / "Déposez votre bulletin"
  Background:
    Given "elections" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Fatima, Returning Officer
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-elections-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "elections-intro"
    And "dialogue-line" shows "Glad you made it. Head to the polling station and I'll test what you know."
    And "objective" reads "Reach the polling station"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "elections-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-el-001, q-el-002, q-el-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-elections-intro" and district "elections"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Fatima says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Fatima offers "Accept quest" again
```

## TN-ELE-02 Your Voter Information Card (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `elections-your-voter-information-card`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Your Voter Information Card
  Scenario: Gather what you need to vote
    Given a collect step with items ["voter-card", "photo-id", "riding-map"]
    When all three are collected
    Then the answer step asks q-el-001, q-el-006, q-el-007 with minCorrect 2
```

## TN-ELE-03 Polls Close (timed) — Proposed (not yet implemented)

Quest type `timed`; proposed id `elections-polls-close`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Polls Close
  Scenario: Reach the polling station before it closes
    Given a reach step for "elections-landmark" with timeLimitSeconds 60
    Then role="timer" is visible during the run
    And arriving in time completes the quest; timing out emits 'quest:failed'
```
