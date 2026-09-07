# System: core loop

Boot, main menu, save management, locale, settings, accessibility, pause and journal. Settings and progress are one save document (`content/schemas/save.schema.json`) kept in `localStorage`; exports are the same JSON.

## TN-CORE-01 Boot to main menu — Implemented

```gherkin
Feature: Boot
  Scenario: First visit lands on the menu
    Given the browser supports WebGL2 or WebGPU
    When I open the game URL
    Then the title "TrueNorth" is visible
    And 'session:ready' is emitted
    And "menu-new" is visible and "menu-continue" is absent

  Scenario: Unsupported browser
    Given the browser supports neither WebGPU nor WebGL2
    When I open the game URL
    Then I see "Your browser does not support WebGPU or WebGL2. Try a current version of Chrome, Edge, Firefox or Safari."
    And no 3D canvas is created
```

## TN-CORE-02 Continue and new game — Implemented

```gherkin
Feature: Continue or start a new journey
  Scenario: Continue restores the saved world
    Given a save with character "Sam", 1 stamp and currentDistrict "hub"
    When I click "menu-continue"
    Then the loading screen [data-screen="loading"] appears then disappears
    And [data-screen="hud"] is shown with "stamps" reading "1"
    And 'progress:loaded' is emitted

  Scenario: New journey over an existing save asks first
    Given a save exists
    When I click "menu-new"
    Then I am asked "This erases all progress. Continue?"
    And cancelling keeps the save and stays on the menu
    And confirming opens the character creator
```

## TN-CORE-03 Save, export and import — Implemented

```gherkin
Feature: Save file management
  Scenario: Manual save from the pause menu
    Given I am in the HUD
    When I press Esc and click "Save"
    Then I see "Progress saved"
    And 'progress:saved' is emitted with an ISO "at" timestamp

  Scenario: Export save
    Given a save exists
    When I click "Export save" on the menu
    Then a JSON file is downloaded that validates against save.schema.json
    And it contains "version", "character", "stamps" and "settings"

  Scenario: Import a valid save
    Given no save exists
    When I choose a valid exported file in "#import-save"
    Then 'progress:imported' is emitted
    And "menu-continue" becomes visible

  Scenario: Import rejects a tampered file
    When I choose a file containing {"version":1,"__proto__":{"x":1},"stamps":"not-an-array"} in "#import-save"
    Then I see "That save file is not valid:" followed by the validation message
    And 'progress:error' is emitted
    And "menu-new" is still visible and "menu-continue" has count 0
    And localStorage contains no save
```

## TN-CORE-04 Autosave — Implemented

```gherkin
Feature: Autosave
  Scenario Outline: Progress-changing events autosave
    Given I am in the HUD
    When <event> occurs
    Then 'progress:saved' is emitted within 1 second
    And reloading the page and clicking "menu-continue" reflects the change

    Examples:
      | event                                   |
      | 'quest:completed'                       |
      | 'district:loaded' after a portal travel |
      | 'exam:finished'                         |
      | 'settings:changed'                      |
```

## TN-CORE-05 Locale switching — Implemented

```gherkin
Feature: English and French
  Scenario: Switch to French on the menu
    Given the menu is in English
    When I click "lang-fr"
    Then "menu-new" reads "Nouveau parcours"
    And settings.locale is saved as "fr"

  Scenario: Locale persists and applies to content
    Given settings.locale is "fr"
    When I continue into the hub and talk to guide-amelie
    Then the dialogue text is the "fr" string from hub-welcome.json
    And the objective reads "Marchez jusqu'au mât du drapeau à l'est de la Flamme"

  Scenario: Switch in-game
    When I change Language in Settings
    Then all visible HUD text updates without a reload and 'settings:changed' has key "locale"
```

## TN-CORE-06 Settings — Planned

```gherkin
Feature: Settings
  Scenario: Graphics preset Auto runs the benchmark
    When I select "Auto (benchmark)"
    Then a 2000 ms benchmark runs
    And the preset resolves to low, medium (>= 30 fps), high (>= 50 fps) or ultra (>= 100 fps)
    And the resolved preset is shown next to "Graphics preset"

  Scenario: Manual preset overrides Auto
    When I select "High"
    Then renderer settings match graphicsPresets.high (shadowMapSize 2048, ssao true, antialias "taa")
    And 'settings:changed' is emitted with key "graphicsPreset" and value "high"

  Scenario: Reduced motion
    When I enable "Reduced motion (disables camera bob and bloom)"
    Then camera bob amplitude is 0 while moving
    And the bloom pass is disabled regardless of preset

  Scenario: Subtitles
    When I toggle "Subtitles" on
    Then NPC idle lines appear as text at the bottom of the HUD; off hides them

  Scenario: Colour-blind safe HUD
    When I enable "Colour-blind safe HUD"
    Then question feedback uses an icon and text ("Correct!" / "Not quite.") in addition to colour
    And locked and unlocked portal prompts differ by icon, not only colour

  Scenario: Remap a key
    When I click the "Interact" binding and press F
    Then the binding shows "F"
    And the HUD prompt reads "Press F to interact"
    And keyBindings.interact is saved as "F"

  Scenario: Conflicting binding is refused
    Given "Jump" is Space
    When I try to bind "Interact" to Space
    Then the binding is unchanged and a conflict message names "Jump"
```

## TN-CORE-07 Accessibility — Planned

```gherkin
Feature: Keyboard-only play
  Scenario: Complete the tutorial without a mouse
    Given I never use a pointing device
    When I Tab and Enter through menu, creator, dialogue and questions
    Then every interactive control receives visible focus
    And I can earn the first stamp

  Scenario: Focus trap in modal screens
    Given the Settings dialog is open
    When I press Tab repeatedly
    Then focus cycles only within the dialog
    And Esc closes it and returns focus to the control that opened it
```

## TN-CORE-08 Pause menu — Implemented

```gherkin
Feature: Pause
  Scenario: Pause and resume
    Given I am in the HUD
    When I press Esc
    Then I see "Paused" with "Resume", "Save" and "Main menu"
    And the world simulation stops (no 'player:moved' emitted)
    When I click "Resume"
    Then the HUD returns and movement works

  Scenario: Main menu saves first
    When I click "Main menu"
    Then 'progress:saved' is emitted and the menu shows "menu-continue"
```

## TN-CORE-09 Journal — Implemented

```gherkin
Feature: Journal
  Scenario: Open the journal
    When I press J
    Then a heading "Journal" is visible
    And sections "Active quests", "Completed" and "Districts" are listed

  Scenario: Empty journal
    Given no quest has been started
    Then the journal reads "No quests yet. Talk to someone!"

  Scenario: District status and exam gate
    Given 1 stamp
    Then "Districts" shows hub and rights-responsibilities as "Unlocked" and the others as "Locked"
    And the "Citizenship Ceremony" section reads "Earn 10 stamps to unlock the ceremony (1 so far)."
    And "journal-practice" is available
```
