# District: Rights & Responsibilities

Chapter: Rights and Responsibilities of Citizenship. Content: `content/districts/rights-responsibilities.json`, `content/quests/rights-responsibilities-intro.json`, questions `content/questions/rights-responsibilities.json` (q-rr-001…). Quest giver: Justice Okafor, Citizenship Judge (`npc-rights-responsibilities-1`). Landmark trigger: `rights-responsibilities-landmark` ("Courthouse steps"). Ambience: weather clear, timeOfDay 0.45.

## TN-RR-01 The Oath (intro) — Implemented

```gherkin
Feature: Intro quest "The Oath" / "Le serment"
  Background:
    Given "rights-responsibilities" is unlocked and I arrived by train at spawn [0, 0, 30]

  Scenario: Talk to Justice Okafor, Citizenship Judge
    When I approach [3, 0, 12] and __truenorth.nearby() returns "npc-rights-responsibilities-1"
    And I press E and click "dialogue-accept"
    Then 'quest:started' is emitted for "rights-responsibilities-intro"
    And "dialogue-line" shows "Glad you made it. Head to the courthouse steps and I'll test what you know."
    And "objective" reads "Reach the courthouse steps"

  Scenario: Reach the landmark
    When 'player:entered-trigger' fires for "rights-responsibilities-landmark" at [0, 0, -12] (radius 4)
    Then the quiz opens automatically with "Question 1 of 3"

  Scenario: Pass with 2 of 3
    Given questions q-rr-001, q-rr-002, q-rr-003
    When I answer at least 2 correctly
    Then 'quest:completed' is emitted with stamp "stamp-rights-responsibilities-intro" and district "rights-responsibilities"
    And "stamps" increments by 1 and 'district:unlocked' adds the next district in unlockRules.order
    And Justice Okafor says "Well done. Another stamp for your passport!"
    But with only 1 correct, 'quest:failed' is emitted, no stamp is awarded and Justice Okafor offers "Accept quest" again
```

## TN-RR-02 Charter Freedoms (puzzle) — Proposed (not yet implemented)

Quest type `puzzle`; proposed id `rights-responsibilities-charter-freedoms`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Charter Freedoms
  Scenario: All-or-nothing quiz
    Given I accepted "Charter Freedoms" from Justice Okafor
    And the answer step lists q-rr-004, q-rr-005, q-rr-007 with minCorrect 3
    When I answer all three correctly
    Then 'quest:completed' is emitted with stamp "stamp-rights-responsibilities-charter"
    When I answer any one incorrectly
    Then 'quest:failed' is emitted after the final feedback and I see "Quest failed. Talk to the quest giver to try again."
```

## TN-RR-03 Duties of a Citizen (fetch) — Proposed (not yet implemented)

Quest type `fetch`; proposed id `rights-responsibilities-duties-of-a-citizen`; new content must validate against quest.schema.json and reuse existing question ids only.

```gherkin
Feature: Duties of a Citizen
  Scenario: Collect the three responsibility scrolls
    Given a collect step with items ["scroll-jury", "scroll-vote", "scroll-law"] placed as pickup triggers around the courthouse
    When I enter each pickup trigger
    Then "objective" counts "1 / 3", "2 / 3", "3 / 3"
    And the follow-on answer step asks q-rr-002 and q-rr-008 with minCorrect 2
```
