# System: quests, questions, stamps and travel

Quests (`content/schemas/quest.schema.json`) are ordered steps of kind `talk`, `reach`, `collect` or `answer`, each with an optional `timeLimitSeconds`. Completing a quest awards one Passport Stamp; stamps drive district unlocks (`unlockRules` in `game.config.json`: sequential order, 1 stamp unlocks the next district, 10 unlock the exam).

## TN-QST-01 Accept a quest from an NPC — Implemented

```gherkin
Feature: Quest start
  Scenario: Interact prompt near an NPC
    Given I am within interaction range of an NPC with a questRef
    Then "prompt" reads "Press E to interact"
    And __truenorth.nearby() returns the NPC id

  Scenario: Accept
    When I press E and see "dialogue-line"
    And I click "dialogue-accept" ("Accept quest")
    Then 'quest:started' is emitted with the quest id
    And I see "Quest started: <title>"
    And the first step dialogue plays and "objective" shows the step objective

  Scenario: Decline keeps the NPC idle line
    When I click "dialogue-close" instead of "dialogue-accept"
    Then no 'quest:started' is emitted and the quest is not listed under "Active quests"
```

## TN-QST-02 Step kinds — Implemented (talk, reach, answer) / Planned (collect)

```gherkin
Feature: Quest step state machine
  Scenario: reach step completes on trigger entry
    Given the active step is kind "reach" with trigger "flagpole"
    When 'player:entered-trigger' fires for "flagpole"
    Then 'quest:updated' is emitted with stepIndex + 1
    And "objective" updates to the next step

  Scenario: talk step requires the named NPC
    Given the active step is kind "talk" with npc "guide-amelie"
    When I interact with "skater-jo"
    Then only Jo's idleDialogue is shown and the step is unchanged

  Scenario: collect step tracks items
    Given the active step is kind "collect" with items ["item-a", "item-b"]
    When 'player:entered-trigger' fires for a pickup trigger "item-a"
    Then "objective" shows "1 / 2" and state.collected contains "item-a"
    When I collect "item-b"
    Then the step completes

  Scenario: answer step starts automatically
    Given the previous step completed
    When the active step is kind "answer"
    Then the first question opens without pressing a key and 'question:asked' is emitted
```

## TN-QST-03 Time limits, failure and retry — Planned

```gherkin
Feature: Timed steps
  Scenario: Timer is visible
    Given the active step has timeLimitSeconds 90
    Then a role="timer" element counts down from "01:30"

  Scenario: Timeout fails the quest
    When the timer reaches 00:00 before the step completes
    Then 'quest:failed' is emitted
    And I see "Quest failed. Talk to the quest giver to try again."
    And activeQuests has the quest with status "failed" and no stamp is awarded

  Scenario: Failing the answer step
    Given an answer step with 3 questions and minCorrect 2
    When I answer 2 incorrectly
    Then 'quest:failed' is emitted after the third feedback

  Scenario: Retry via the quest giver
    Given the quest is "failed"
    When I talk to the giverNpc and click "dialogue-accept"
    Then the quest restarts at stepIndex 0 with collected [] and answers {}
```

## TN-QST-04 Question presentation — Implemented

```gherkin
Feature: Answering a question
  Scenario: Layout
    When a question opens
    Then "question-text" shows the question in the current locale
    And "Question 1 of 3" is shown
    And exactly 4 choices "choice-a".."choice-d" are shown, the answer plus 3 distractors in shuffled order
    And the shuffle order is stable for the same question within one session

  Scenario: Keyboard selection
    When I press "b"
    Then "choice-b" is selected
    And pressing Enter submits (same as "question-submit")

  Scenario: Correct feedback
    When I submit the correct choice
    Then "feedback" reads "Correct!"
    And the explanation and "Source: Discover Canada: <chapter>" are shown
    And 'question:answered' is emitted with correct true, chosenKey and correctKey

  Scenario: Incorrect feedback
    When I submit a distractor
    Then "feedback" reads "Not quite. The answer was: <answer>"
    And the correct choice is highlighted and the chosen one marked
    And 'question:answered' is emitted with correct false

  Scenario: Continue
    When I click "question-continue"
    Then the next question opens, or the step completes after the last one
```

## TN-QST-05 Passport Stamps — Implemented

```gherkin
Feature: Stamps
  Scenario: Quest completion awards one stamp
    When the final step of "hub-welcome" completes
    Then 'quest:completed' is emitted with stamp "stamp-hub-welcome" and district "hub"
    And 'stamp:earned' is emitted with total 1
    And "stamps" reads "1" and I see "Passport Stamp earned! (1 total)"
    And completionDialogue plays

  Scenario: A stamp is awarded once
    Given "hub-welcome" is completed
    When I talk to guide-amelie again
    Then only idleDialogue plays and "stamps" stays "1"
```

## TN-QST-06 District unlock — Implemented

```gherkin
Feature: Sequential unlock
  Scenario: First stamp unlocks the next district
    Given unlockedDistricts is ["hub"]
    When 'stamp:earned' brings the total to 1
    Then 'district:unlocked' is emitted with ["hub", "rights-responsibilities"]

  Scenario Outline: Each stamp unlocks exactly one more district in order
    Given <have> stamps
    Then unlockedDistricts equals the first <have> + 1 entries of unlockRules.order

    Examples:
      | have |
      | 1    |
      | 5    |
      | 10   |

  Scenario: Locked districts cannot be entered by any route
    When __truenorth.travel("history") is called with 1 stamp
    Then it returns false and 'district:locked-attempt' is emitted with "history"
```

## TN-QST-07 Portals and train travel — Implemented

```gherkin
Feature: Travel
  Scenario: Locked portal message
    Given "rights-responsibilities" is locked
    When I enter trigger "portal-rights"
    Then "prompt" reads "This train doesn't run yet. Earn a stamp in Parliament Hill first."
    And pressing E does nothing

  Scenario: Unlocked portal
    Given "rights-responsibilities" is unlocked
    When I enter "portal-rights"
    Then "prompt" reads "Press E to board the train to Rights & Responsibilities"
    When I press E
    Then I see "Travelling to Rights & Responsibilities…"
    And 'district:loaded' is emitted for "rights-responsibilities"
    And state.currentDistrict is "rights-responsibilities" and I stand at that district's spawn
```
