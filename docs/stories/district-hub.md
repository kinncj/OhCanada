# District: Parliament Hill (hub)

Chapter: Introduction. Content: `content/districts/hub.json`, `content/quests/hub-welcome.json`. NPCs: Amélie, Parliamentary Guide (`guide-amelie`, quest giver) and Jo, Canal Skater (`skater-jo`, flavour). The hub is unlocked from the start and hosts the train station with portals to all ten subject districts.

## TN-HUB-01 Welcome to the Hill — Implemented

```gherkin
Feature: Tutorial quest "Welcome to the Hill"
  Background:
    Given a new explorer stands at the hub spawn with "stamps" reading "0"

  Scenario: Meet Amélie
    When I approach [4, 0, 14] and press E
    Then "dialogue-line" shows Amélie's idle line "Welcome to Parliament Hill! When you're ready, I can show you around."
    And "dialogue-accept" is offered
    When I accept
    Then 'quest:started' is emitted for "hub-welcome"
    And the meet-guide dialogue plays (3 lines, the last spoken by "You": "On my way.")
    And "objective" contains "flagpole"

  Scenario: Reach the flagpole
    When I enter trigger "flagpole" at [16, 0, 12] (radius 3.5)
    Then the step "reach-flagpole" completes
    And the warm-up quiz opens automatically with "Question 1 of 3"

  Scenario: Warm-up quiz passes with 2 of 3
    Given questions q-rr-001, q-rr-002, q-rr-003
    When I answer correct, incorrect, correct
    Then 'question:answered' is emitted 3 times with correct [true, false, true]
    And 'quest:completed' is emitted with stamp "stamp-hub-welcome"
    And "stamps" reads "1"
    And Amélie says "That's your first Passport Stamp! The train at the station now runs to the Rights & Responsibilities district. Bon voyage!"

  Scenario: Warm-up quiz fails with 1 of 3
    When I answer incorrect, incorrect, correct
    Then 'quest:failed' is emitted and "stamps" stays "0"
    And talking to Amélie again restarts the quest

  Scenario: First stamp unlocks Rights & Responsibilities
    Given "stamps" reads "1"
    Then 'district:unlocked' includes "rights-responsibilities"
    And "portal-rights" at the station prompts "Press E to board the train to Rights & Responsibilities"
    And "portal-who-we-are" still prompts "This train doesn't run yet. Earn a stamp in Rights & Responsibilities first."
```

## TN-HUB-02 Jo and the canal — Implemented

```gherkin
Feature: Flavour NPC
  Scenario: Jo has no quest
    When I interact with "skater-jo" near the canal locks
    Then "dialogue-line" shows "In winter the Rideau Canal becomes the world's largest skating rink. Bring a BeaverTail!"
    And "dialogue-accept" is not shown
```

## TN-HUB-03 Hub station map — Planned

```gherkin
Feature: Station overview
  Scenario: Portal labels in both locales
    Given locale "fr"
    When I approach "portal-history"
    Then the prompt names "L'histoire du Canada"

  Scenario: Portals line up in unlock order
    Then the eleven portal triggers from "portal-rights" to "portal-regions" appear along the platform in unlockRules.order
    And locked portals show a lock icon when "Colour-blind safe HUD" is on
```
