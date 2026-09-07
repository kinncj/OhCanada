# District: Canada's Regions

Chapter: Canada's Regions. Content: `content/districts/regions.json`, `content/quests/regions-intro.json`, questions `content/questions/regions.json` (q-re-001…). Quest giver: Ranger Aputik (`npc-regions-1`). Landmark trigger: `regions-landmark` ("Lookout"). Ambience: weather clear, timeOfDay 0.5.

## TN-REG-01 Coast to Coast to Coast (intro) — Implemented

```gherkin
Feature: Intro quest "Coast to Coast to Coast" / "D'un océan à l'autre et à l'autre"
  Background:
    Given "regions" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Ranger Aputik
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-regions-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "regions-intro"
    And "dialogue-line" shows "Glad you made it. Head to the lookout and I'll test what you know."
    And "objective" reads "Reach the lookout"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "regions-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-re-001, q-re-002, q-re-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-regions-intro" and district "regions"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Ranger Aputik says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Ranger Aputik offers "Accept quest" again
```

## TN-REG-02 Five Regions Tour (timed) — Proposed (not yet implemented)

Quest type `timed`; proposed id `regions-five-regions-tour`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Five Regions Tour
  Scenario: Visit all five sub-zones
    Given proposed zone triggers "regions-atlantic", "regions-central", "regions-prairie", "regions-west-coast", "regions-north" placed in the district's five sub-zones
    And five reach steps in that order, each with timeLimitSeconds 120
    When I enter each trigger before its timer expires
    Then "objective" names the next sub-zone after each arrival ("Reach the Prairie fields")
    And a subtitle names the zone I entered ("Atlantic shore", "Central lakes", "Prairie fields", "West Coast rainforest", "Arctic North")

  Scenario: Final quiz
    Given all five sub-zones were reached
    Then the answer step asks q-re-004, q-re-005, q-re-006, q-re-007, q-re-008 with minCorrect 4
    And passing awards "stamp-regions-tour"

  Scenario: Timeout on any leg
    When any leg's timer reaches 00:00
    Then 'quest:failed' is emitted and Ranger Aputik restarts the tour from the first leg
```
