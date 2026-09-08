# TN-SET — Settings: language and the accessibility switches

**Intent.** A player can change the language and every accessibility setting from one screen, the change
takes effect at once, and it is still there next time.

This story exists because every other file in this directory opens a scenario with "Given single-switch mode
is on" or "Given text scaling is 200 %". A precondition nobody can set is not testable, so the controls that
set them are specified here. It is deliberately the smallest file in the directory.

Read `README.md` in this directory first. Export, import and delete live in `TN-SAVE-save-and-reload.md`,
reached from this same screen. The plural rule and the state-word rule this file uses are fixed by
`TN-COPY-strings-and-counts.md`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-SET-04`, and `TN-SET-09` for the hold-time control |
| Single switch | `TN-SET-05`, and `TN-SET-09` for the hold-time control |
| Screen reader | `TN-SET-06` |
| Reduced motion | `TN-SET-07` |
| 200 % text | `TN-SET-07` |
| Bilingual | `TN-SET-08`, and `TN-SET-09` for the hold-time control |
| Failure path | `TN-SET-03`, and `TN-SET-09` for a hold time that cannot be undone |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `settings.title` | Settings | Réglages |
| `common.settings` | Settings | Réglages |
| `settings.language` | Language | Langue |
| `settings.language.en` | English | English |
| `settings.language.fr` | Français | Français |
| `settings.autoMove` | Move by itself | Déplacement automatique |
| `settings.autoMove.help` | You do not need to hold the screen. | Vous n'avez pas besoin de garder le doigt sur l'écran. |
| `settings.singleSwitch` | One-button mode | Mode à un bouton |
| `settings.singleSwitch.help` | Tap to move the highlight. Hold to choose. | Touchez pour déplacer la sélection. Maintenez pour choisir. |
| `settings.holdTime` | Hold time | Durée du maintien |
| `settings.holdTime.help` | How long you hold the button to choose something. | Le temps que vous devez maintenir le bouton pour choisir. |
| `settings.holdTime.short` | Short | Courte |
| `settings.holdTime.medium` | Medium | Moyenne |
| `settings.holdTime.long` | Long | Longue |
| `settings.holdTime.veryLong` | Very long | Très longue |
| `settings.holdTime.seconds.one` | {{seconds}} second | {{seconds}} seconde |
| `settings.holdTime.seconds.other` | {{seconds}} seconds | {{seconds}} secondes |
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

`settings.state.on` and `settings.state.off` — "On" / « Activé » and "Off" / « Désactivé » — are confirmed
in `TN-COPY-strings-and-counts.md`, which also says why the French does not agree with its label. They are
not repeated here.

`common.settings` and `settings.title` are the same two words and two different keys on purpose.
`settings.title` names this screen; `common.settings` names the *control that opens it*, from the HUD menu
(`TN-HUD-02`) and from the character creator (`TN-CREATOR-11`). One key for a heading and a button label
would make a change to either a change to both.

The language names are written in their own language and are never translated.

Hold-time values: **Short 0.3 s, Medium 0.6 s, Long 1.2 s, Very long 2.0 s.** Medium is the default. Named
choices rather than a slider or a plus-and-minus pair, because a switch user reaches four named items in at
most four short presses and would need fourteen to walk a 100 ms step from 0.6 s to 2.0 s — and this is the
one control whose whole purpose is to be usable by that player. The model's 200–3000 ms clamp still applies
to a hand-edited or imported save; every named value sits inside it.

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
      "High contrast", "Easier-to-read font", "Text size" and "Subtitles"
    And each has a visible label, not an icon alone
    And each is at least 44 CSS px wide and tall

  Scenario: The hold-time control is present whenever one-button mode can be turned on
    Then a control "Hold time" is shown, as described in TN-SET-09
    And it is present whether one-button mode is on or off

  Scenario: Sound controls are shown only when there is a sound to control
    Given the game ships at least one sound
    Then a control "Sound" is shown, with "Overall", "Music", "Sound effects" and "Voices"
    And each is at least 44 CSS px wide and tall

  Scenario: Sound controls are absent, not disabled, when nothing makes a sound
    Given the game ships no sound
    Then no control named "Sound" is present in the accessibility tree
    And no volume control is drawn greyed out, or drawn and ignored
    And nothing on the screen mentions sound

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

  Scenario: An out-of-range hold time is refused, not applied
    Given a saved document declares a hold time of 30 seconds
    When the game loads it
    Then the hold time is clamped to the longest value the screen offers
    And a long press still chooses
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
    And "Hold time" changes with the arrow keys
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
    And I can change "Hold time"
    And I can turn single-switch mode off again

  Scenario: The mode cannot trap the player
    Then no setting can put the game into a state that the switch alone cannot leave
    And that includes every value "Hold time" offers
```

## TN-SET-06 — Settings with a screen reader

```gherkin
Feature: Announcing settings
  Scenario: The screen and its controls are named
    Then "settings-screen" has role "dialog" with an accessible name
    And each switch is a checkbox or a switch with an accessible name and state
    And "Text size" is a slider or a group with an accessible name and a value in percent
    And "Hold time" is a group with an accessible name, whose options are radios with names that are words

  Scenario: A change is announced once
    When I turn on "Less movement"
    Then "#tn-live-region" reads the setting name and its new state
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Help text is attached, not floating
    Then each switch with help text has it as its accessible description
    And "Hold time" is described by "How long you hold the button to choose something."
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
    And the labels read "Langue", "Déplacement automatique", "Mode à un bouton", "Durée du maintien",
      "Moins de mouvement", "Contraste élevé", "Police plus lisible", "Taille du texte" and "Sous-titres"
    And the close button reads "Fermer"

  Scenario: The sound labels are French when the sound section is shown
    Given the game ships at least one sound
    Then the section reads "Son"
    And its controls read "Général", "Musique", "Effets sonores" and "Voix"

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
    And "Durée du maintien" is described by "Le temps que vous devez maintenir le bouton pour choisir."
```

## TN-SET-09 — Hold time: the setting a switch user cannot change any other way

```gherkin
Feature: Choosing how long a long press is
  As a player who uses one switch
  I want to set how long I have to hold it
  So that the game matches my hands and not the other way round

  Background:
    Given the element "settings-screen" is visible

  Scenario: The control is there and says what it is
    Then the element "setting-hold-time" is visible
    And it is labelled "Hold time"
    And it offers "Short", "Medium", "Long" and "Very long"
    And each option is at least 44 CSS px wide and tall

  Scenario: Each option says how long it is, in words and numbers
    Then "Short" also shows "0.3 seconds"
    And "Medium" also shows "0.6 seconds"
    And "Long" also shows "1.2 seconds"
    And "Very long" also shows "2 seconds"
    And the singular and plural forms follow TN-COPY-01

  Scenario: Medium is the default
    Given I have never opened Settings
    Then "Medium" is the chosen option
    And a hold of 0.6 seconds chooses the highlighted item

  Scenario: Changing it changes what a long press means, at once
    Given single-switch mode is on
    When I choose "Long"
    Then the event "settings/changed" is emitted
    And the event "progress/saved" is emitted
    And a hold of 0.6 seconds no longer chooses the highlighted item
    And a hold of 1.2 seconds does

  Scenario: A short press is still a short press
    Given I have chosen "Very long"
    When I press the switch briefly
    Then the highlight moves to the next item
    And nothing has been chosen

  Scenario: The control that sets the threshold can never be locked by it
    Given single-switch mode is on
    And I have chosen "Very long"
    When the highlight is on "Short" inside "setting-hold-time"
    And I hold the switch for 0.6 seconds
    Then "Short" is chosen
    And the hold-time options accept a hold of the default length or of the current threshold,
      whichever is shorter

  Scenario: Nothing counts down while the player decides
    When the hold-time control is highlighted and I do nothing for two minutes
    Then the chosen option has not changed
    And nothing on screen counts down
    And no timer, clock or filling bar is drawn while I hold

  Scenario: It survives a reload
    Given I chose "Long"
    When I close the tab and open the game again
    Then "Long" is still chosen
    And a hold of 1.2 seconds chooses from the first screen, without opening Settings

  Scenario: From the keyboard
    Given I am using a keyboard only
    When I press "Tab" until focus is inside "setting-hold-time"
    And I press "ArrowRight"
    Then the next option is chosen
    And the change is announced in "#tn-live-region"

  Scenario: In French
    Given the language is French
    Then the label reads "Durée du maintien"
    And the options read "Courte", "Moyenne", "Longue" and "Très longue"
    And "Courte" also shows "0,3 seconde"
    And "Très longue" also shows "2 secondes"
```

---

## Open questions

- **`OQ-STYLE-1` — « tu » or « vous »?** Every French string in these stories uses « vous », to match IRCC's
  own French and because the audience is adults as well as children. *Recommendation:* keep « vous »
  everywhere, and say so in the content guide so two agents do not write two registers.
- ~~**`OQ-SET-1` — is there a settings entry before the first level?**~~ **Answered 2026-09-08 — yes.** A
  settings control on the character creator, opening this same screen, labelled `common.settings`. Without
  it, `TN-CREATOR-05` and `TN-CREATOR-08` describe a state a first-run player cannot reach. It is specified
  as `TN-CREATOR-11` and was built in task 1.15.
- **`OQ-SET-2` — does the game follow the browser's language on a first run?** *Recommendation:* yes —
  start in French when the browser asks for French, otherwise English, and let the player override. The
  override wins from then on.
- ~~**`OQ-SET-3` — is there any audio in slice 1?**~~ **Answered 2026-09-08 — build it, ship it behind the
  presence of a sound.** `TN-SET-01` used to require a Sound control unconditionally and this question used
  to say ship it "only if a sound ships", which is two answers in one file; `TN-SET-01` now carries both
  halves as two scenarios, and one of them asserts the section is *absent from the accessibility tree*
  rather than present-and-disabled. The section exists in code behind a flag, transcribed and translated,
  so enabling it when `AudioPort` lands is one line and not a copy round. A volume control that moves
  nothing is worse than no volume control: it teaches the player the setting does not work.
- ~~**`OQ-SET-4` — the hold-to-choose threshold.**~~ **Answered 2026-09-08 — `TN-SET-09`.** Four named
  values rather than a slider, because the player who needs this setting is the player who reaches four
  named items in four presses and a hundred-millisecond step in fourteen. The escape clause — the hold-time
  options accept the shorter of the default and the current threshold — is what makes `TN-SET-05`'s
  "no setting can trap the player" true by construction rather than by argument.
- **`OQ-SET-5` — should "Hold time" be hidden when one-button mode is off?** `TN-SET-01` says no: it is
  always shown. A control that appears and disappears is harder to find than one that is always there, and
  the switch user turning the mode on for the first time will want the threshold in the same screen, not
  after a reload. *Recommendation:* keep it visible always. If the screen gets crowded, group it under
  "One-button mode" visually without making it conditional.
