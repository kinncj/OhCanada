# TN-SET — Settings: language and the accessibility switches

**Intent.** A player can change the language and every accessibility setting from one screen, the change
takes effect at once, and it is still there next time.

This story exists because every other file in this directory opens a scenario with "Given single-switch mode
is on" or "Given text scaling is 200 %". A precondition nobody can set is not testable, so the controls that
set them are specified here. It is deliberately the smallest file in the directory.

Read `README.md` in this directory first. Export, import and delete live in `TN-SAVE-save-and-reload.md`,
reached from this same screen.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-SET-04` |
| Single switch | `TN-SET-05` |
| Screen reader | `TN-SET-06` |
| Reduced motion | `TN-SET-07` |
| 200 % text | `TN-SET-07` |
| Bilingual | `TN-SET-08` |
| Failure path | `TN-SET-03` |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `settings.title` | Settings | Réglages |
| `settings.language` | Language | Langue |
| `settings.language.en` | English | English |
| `settings.language.fr` | Français | Français |
| `settings.autoMove` | Move by itself | Déplacement automatique |
| `settings.autoMove.help` | You do not need to hold the screen. | Vous n'avez pas besoin de garder le doigt sur l'écran. |
| `settings.singleSwitch` | One-button mode | Mode à un bouton |
| `settings.singleSwitch.help` | Tap to move the highlight. Hold to choose. | Touchez pour déplacer la sélection. Maintenez pour choisir. |
| `settings.reducedMotion` | Less movement | Moins de mouvement |
| `settings.highContrast` | High contrast | Contraste élevé |
| `settings.dyslexiaFont` | Easier-to-read font | Police plus lisible |
| `settings.textSize` | Text size | Taille du texte |
| `settings.subtitles` | Subtitles | Sous-titres |
| `settings.sound` | Sound | Son |
| `settings.sound.master` | Overall | Général |
| `settings.sound.music` | Music | Musique |
| `settings.sound.sfx` | Sound effects | Effets sonores |
| `settings.sound.voice` | Voices | Voix |
| `common.close` | Close | Fermer |

The language names are written in their own language and are never translated.

---

## TN-SET-01 — Changing a setting

```gherkin
Feature: The settings screen
  Background:
    Given the Ottawa level is playable

  Scenario: Opening Settings pauses the game
    When I tap "menu-button" and then "Settings"
    Then the element "settings-screen" is visible
    And "data-paused" is "true"
    And holding "move-right" does not move the skater

  Scenario: Every setting is present and labelled
    Then controls are shown for language, "Move by itself", "One-button mode", "Less movement",
      "High contrast", "Easier-to-read font", "Text size", "Subtitles" and "Sound"
    And each has a visible label, not an icon alone
    And each is at least 44 CSS px wide and tall

  Scenario: A change takes effect at once and is kept
    When I turn on "Less movement"
    Then the event "settings/changed" is emitted
    And the event "progress/saved" is emitted
    And "scene-state" reports "data-particles" equal to "0" as soon as I close Settings

  Scenario: Text size changes the whole game, not one screen
    When I set "Text size" to 200 %
    Then the settings screen itself is drawn at 200 %
    And the HUD, the dialogue and the question card are all at 200 %

  Scenario: Subtitles are on until the player turns them off
    Given I have never opened Settings
    Then "Subtitles" is on

  Scenario: Closing returns to the game
    When I tap "Close"
    Then "data-paused" is "false"
    And focus returns to "menu-button"
```

## TN-SET-02 — Auto-move, for players who do not want to hold

```gherkin
Feature: Move by itself
  Background:
    Given the Ottawa level is playable

  Scenario: The skater moves without a held control
    When I turn on "Move by itself"
    Then the skater moves along the canal with no input
    And the "move-left" and "move-right" controls are replaced by "turn-around"
    And "scene-state" reports "data-speed" greater than 0

  Scenario: The player still chooses the direction
    When I tap "turn-around"
    Then "data-facing" changes
    And the skater turns around as described in TN-LEVEL-03, passing through 0 speed

  Scenario: Engaging still works
    When the officer comes into reach
    Then "interact-prompt" appears
    And tapping it engages the officer
    And the skater stops rather than gliding away under the dialogue

  Scenario: Auto-move is not a difficulty change
    Then the same points of interest are reachable
    And the skate tuning values are unchanged
```

## TN-SET-03 — A setting cannot be saved (failure path)

```gherkin
Feature: Settings when storage fails
  Scenario: The change still applies
    Given writing to local storage fails
    When I turn on "High contrast"
    Then the game is drawn in high contrast at once
    And the event "progress/save-failed" is emitted
    And the element "storage-warning" is visible

  Scenario: The player is not told it was saved when it was not
    Then no message says the setting was saved
    And the warning explains that settings will be lost when the tab closes

  Scenario: An out-of-range value is refused, not applied
    Given a saved document declares a text scale of 500 %
    When the game loads it
    Then the text scale is clamped to 200 %
    And the game does not fail to start
```

## TN-SET-04 — Settings from the keyboard

```gherkin
Feature: Keyboard-only settings
  Background:
    Given I am using a keyboard only
    And the element "settings-screen" is visible

  Scenario: Every control is reachable and operable
    When I press "Tab" through "settings-screen"
    Then every control receives focus in the order it is read
    And switches toggle with "Space"
    And the language control changes with the arrow keys
    And "Text size" changes with the arrow keys and reports its value as text

  Scenario: The screen is a modal that gives focus back
    Then "Tab" cannot leave "settings-screen"
    When I press "Escape"
    Then Settings closes and focus returns to "menu-button"
```

## TN-SET-05 — Settings with one switch

```gherkin
Feature: Single-switch settings
  Scenario: Reaching every control, and turning the mode off again
    Given single-switch mode is on
    When I use only short and long presses
    Then I can reach every control in "settings-screen"
    And I can change the language
    And I can turn single-switch mode off again

  Scenario: The mode cannot trap the player
    Then no setting can put the game into a state that the switch alone cannot leave
```

## TN-SET-06 — Settings with a screen reader

```gherkin
Feature: Announcing settings
  Scenario: The screen and its controls are named
    Then "settings-screen" has role "dialog" with an accessible name
    And each switch is a checkbox or a switch with an accessible name and state
    And "Text size" is a slider or a group with an accessible name and a value in percent

  Scenario: A change is announced once
    When I turn on "Less movement"
    Then "#tn-live-region" reads the setting name and its new state
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Help text is attached, not floating
    Then each switch with help text has it as its accessible description
```

## TN-SET-07 — Settings under reduced motion and at 200 %

```gherkin
Feature: The settings screen honours its own settings
  Scenario: Reduced motion
    Given reduced motion is on
    When "settings-screen" opens
    Then it appears with no slide or fade
    And no switch animates as it toggles, while still showing its state as a word

  Scenario: 200 % text
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then every label is fully visible, by scrolling down if needed
    And no label overlaps its control
    And the page does not scroll sideways
    And every control is still at least 44 CSS px wide and tall

  Scenario: High contrast
    Given "High contrast" is on
    Then every control's state is distinguishable without colour
    And text meets the contrast requirement against its background
```

## TN-SET-08 — Settings in French

```gherkin
Feature: Settings in French
  Background:
    Given the language is French

  Scenario: Every label is French
    When "settings-screen" is visible
    Then the heading reads "Réglages"
    And the labels read "Langue", "Déplacement automatique", "Mode à un bouton", "Moins de mouvement",
      "Contraste élevé", "Police plus lisible", "Taille du texte", "Sous-titres" and "Son"
    And the close button reads "Fermer"

  Scenario: The language names are not translated
    Then the language choices read "English" and "Français" in both languages

  Scenario: Switching language does not restart the level
    Given the Ottawa level is playable and the quest is accepted
    When I change the language to English
    Then the level is not reloaded
    And "data-player-x" is unchanged
    And every visible string is English
    And the change is announced in "#tn-live-region" in the new language

  Scenario: The help text is French
    Then "Mode à un bouton" is described by "Touchez pour déplacer la sélection. Maintenez pour choisir."
```

---

## Open questions

- **`OQ-STYLE-1` — « tu » or « vous »?** Every French string in these stories uses « vous », to match IRCC's
  own French and because the audience is adults as well as children. *Recommendation:* keep « vous »
  everywhere, and say so in the content guide so two agents do not write two registers.
- **`OQ-SET-1` — is there a settings entry before the first level?** The creator is the first screen, and a
  player who needs single-switch mode or 200 % text needs it *there*. *Recommendation:* a small settings
  control on the character creator itself, opening the same screen. Without it, `TN-CREATOR-05` and
  `TN-CREATOR-08` describe a state the player cannot reach on a first run.
- **`OQ-SET-2` — does the game follow the browser's language on a first run?** *Recommendation:* yes —
  start in French when the browser asks for French, otherwise English, and let the player override. The
  override wins from then on.
- **`OQ-SET-3` — is there any audio in slice 1?** `AudioPort` is provisional with no task, so the four
  volume controls may have nothing to control. *Recommendation:* ship the sound section only if a sound
  ships; a control that does nothing is worse than a missing one.
- **`OQ-SET-4` — the hold-to-choose threshold.** This screen exposes single-switch mode but not the length
  of a long press, which switch users vary widely on. *Recommendation:* a "Hold time" control in this
  screen, default 600 ms, in the same release as single-switch mode.
