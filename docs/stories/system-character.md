# System: character creator

Options come from `content/characters/catalog.json`: 4 bodies, 3 faces, 6 skin tones, 6 hair styles, 6 hair colours, 5 outfits, 5 accessories. The character is part of the save document and is also exportable on its own.

## TN-CHAR-01 Create an explorer — Implemented

```gherkin
Feature: Character creator
  Background:
    Given I clicked "menu-new" and see "Create your explorer"

  Scenario: Every option group is presented
    Then I see groups "Body", "Face", "Skin tone", "Hair", "Hair colour", "Outfit" and "Accessory"
    And each option has a data-testid of the form opt-<group>-<id> (e.g. "opt-outfit-hockey")
    And the option labels use the current locale ("Hockey jersey" / "Chandail de hockey")

  Scenario: Name validation
    When I leave "creator-name" empty and click "creator-confirm"
    Then I see "Enter a name between 1 and 24 characters."
    When I type a 25-character name
    Then the same error is shown and the input is trimmed to 24

  Scenario: Confirm enters the hub
    When I fill "creator-name" with "Sam", pick "opt-outfit-hockey" and "opt-accessory-toque" and click "creator-confirm"
    Then 'character:created' is emitted with name "Sam", outfit "hockey" and accessory "toque"
    And 'district:load-requested' is emitted for "hub"
    And [data-screen="hud"] appears with "stamps" reading "0"
```

## TN-CHAR-02 Randomize and preview — Implemented

```gherkin
Feature: Randomize and 3D preview
  Scenario: Randomize
    When I click "Randomize"
    Then one option in each group is selected
    And every selected id exists in catalog.json
    And the name field is unchanged

  Scenario: Live preview
    When I select "opt-skinTone-tone-5"
    Then the 3D preview mesh uses colour #7a4a2b within one frame
    When I select "opt-hair-none"
    Then no hair mesh is attached to the preview
```

## TN-CHAR-03 Persistence and portability — Implemented

```gherkin
Feature: Character persistence
  Scenario: Saved to localStorage
    Given I confirmed "Sam"
    When I reload and click "menu-continue"
    Then __truenorth.state().character.name is "Sam"
    And the in-world model has outfit "hockey" and accessory "toque"

  Scenario: Export character as JSON
    When I click "Export" in the creator
    Then a JSON file is downloaded with "name" and "appearance" keys only
    And "appearance" has exactly body, face, skinTone, hair, hairColor, outfit, accessory

  Scenario: Import character JSON
    When I import a character file with outfit "raincoat"
    Then the preview and selections update to match
    And an unknown option id (e.g. hair "mohawk") is rejected with "That save file is not valid:"
```


## NPC role appearance (TN-CHAR-09) — Implemented

```gherkin
Feature: NPCs look like the role they play
  Scenario: A district author describes an NPC by role
    Given a district JSON NPC with appearance.body "male", outfitStyle "uniform", hat "police"
    When the district loads
    Then the NPC is rendered with the male rig, a navy tunic, dark trousers and a peaked police cap
    And an NPC with outfitStyle "robe" wears a single dark garment head to toe
    And an NPC with age "elder" has grey hair regardless of hairColor

  Scenario: Player customization drives the same rig
    Given the player picked body "Feminine", hair "Buns", outfit "Yellow raincoat" and accessory "Glasses"
    When the character is shown
    Then the female rig plays the idle clip, wears the "Hair_Buns" mesh, a glossy yellow top, and glasses on the Head bone
```
