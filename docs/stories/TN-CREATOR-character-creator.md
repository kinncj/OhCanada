# TN-CREATOR — Character creator

**Intent.** Before the first level, a player makes a character they recognise as theirs in under a minute,
with one thumb, and the game never blocks them on a choice.

Read `README.md` in this directory first: it fixes the shared markers, the event names and the
single-switch contract these scenarios use.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-CREATOR-04` — *A keyboard player makes and confirms a character* |
| Single switch | `TN-CREATOR-05` — *Short press moves, long press chooses* |
| Screen reader | `TN-CREATOR-06` — *Every choice is announced, and the preview is not the only feedback* |
| Reduced motion | `TN-CREATOR-07` — *The preview does not animate* |
| 200 % text | `TN-CREATOR-08` — *Nothing clips or overlaps at 200 %* |
| Bilingual | `TN-CREATOR-09` (FR copy) and `TN-CREATOR-10` (switching language mid-flow) |
| Failure path | `TN-CREATOR-03` — *The character cannot be saved* |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `creator.title` | Make your character | Créez votre personnage |
| `creator.intro` | Pick how you look. You can change this later in Settings. | Choisissez votre apparence. Vous pourrez la changer plus tard dans les Réglages. |
| `creator.slot.skin` | Skin tone | Teint de peau |
| `creator.slot.hair` | Hair | Cheveux |
| `creator.slot.coat` | Coat | Manteau |
| `creator.randomise` | Surprise me | Au hasard |
| `creator.start` | Start playing | Commencer à jouer |
| `creator.saveFailed` | We could not save your character. You can keep playing, but your choices may be lost. | Nous n'avons pas pu enregistrer votre personnage. Vous pouvez continuer à jouer, mais vos choix pourraient être perdus. |
| `creator.retry` | Try again | Réessayer |
| `creator.continue` | Keep playing | Continuer quand même |

Option names are content (`content/locales/*`), one key per slot option, e.g. `creator.hair.curly` →
"Curly" / « Bouclés ». Every option has a name; no option is identified by colour alone.

---

## TN-CREATOR-01 — Make a character and start playing

```gherkin
Feature: Choosing how the player looks
  As a new player
  I want to pick how my character looks
  So that the person on the ice feels like mine

  Background:
    Given I have no saved game
    And I open the game

  Scenario: The creator is the first screen a new player sees
    Then the element "character-creator" is visible
    And it shows the heading "Make your character"
    And it shows "character-preview"
    And the groups "slot-skin", "slot-hair" and "slot-coat" are each visible
    And each group already has one option chosen
    And the button "start-playing" is enabled

  Scenario: Choosing an option updates the preview and nothing else
    When I tap the third option in "slot-hair"
    Then that option is marked as chosen
    And no other group's chosen option changes
    And "character-preview" reports "data-hair" equal to that option's id

  Scenario: Surprise me picks a whole character at once
    When I tap "randomise-character"
    Then every group has exactly one option chosen
    And at least one group's chosen option is different from before
    And the button "start-playing" is still enabled

  Scenario: Starting play carries the character into the level
    When I tap "start-playing"
    Then the event "character/created" is emitted with one option per slot
    And the event "progress/saved" is emitted
    And the Ottawa level loads
    And the element "playable" appears
    And "scene-state" reports "data-mode" equal to "skate"

  Scenario: A returning player does not see the creator again
    Given I have a saved game with a character
    When I open the game
    Then the element "character-creator" is not shown
    And I reach "playable" without choosing anything
```

## TN-CREATOR-02 — Every choice is reachable with one thumb, in portrait

```gherkin
Feature: One-thumb portrait creator
  Scenario: Every control sits in the reachable part of the screen
    Given the viewport is 390 x 844
    And the element "character-creator" is visible
    Then every option button and every group is at least 44 CSS px wide and tall
    And "start-playing" and "randomise-character" are inside the lower third of the viewport
    And the page does not scroll sideways

  Scenario: No forbidden gesture is needed
    Then no control in "character-creator" requires a swipe, a drag, a pinch or a double tap
    And every option can be chosen with a single tap
```

## TN-CREATOR-03 — The character cannot be saved (failure path)

```gherkin
Feature: Storage refuses the character
  Scenario: Saving fails and the player is told, in words, and is not stuck
    Given writing to local storage fails
    And the element "character-creator" is visible
    When I tap "start-playing"
    Then the event "progress/save-failed" is emitted
    And a message says "We could not save your character. You can keep playing, but your choices may be lost."
    And a button "Try again" is offered
    And a button "Keep playing" is offered
    And the message is announced in "#tn-live-region"

  Scenario: Trying again after storage recovers
    Given the save failed and the message is shown
    And writing to local storage now succeeds
    When I tap "Try again"
    Then the event "progress/saved" is emitted
    And the message is dismissed
    And the Ottawa level loads

  Scenario: Choosing to keep playing does not lose the session
    Given the save failed and the message is shown
    When I tap "Keep playing"
    Then the Ottawa level loads
    And the character in the level uses the options I chose
    And the warning "storage-warning" stays visible in the HUD

  Scenario: The preview art fails to load
    Given the character art fails to load
    When the element "character-creator" is visible
    Then each option is still shown with its name as text
    And "start-playing" is still enabled
    And the screen does not show an empty box with no explanation
```

## TN-CREATOR-04 — A keyboard player makes and confirms a character

```gherkin
Feature: Keyboard-only character creation
  Background:
    Given I am using a keyboard only
    And the element "character-creator" is visible

  Scenario: Focus starts inside the screen and never leaves it
    Then focus is on the heading or the first group of "character-creator"
    When I press "Tab" six times
    Then focus is still inside "character-creator"

  Scenario: Arrow keys move within a group, Tab moves between groups
    When I press "Tab" until focus is inside "slot-hair"
    And I press "ArrowRight"
    Then the next option in "slot-hair" is chosen
    And focus is on that option
    When I press "Tab"
    Then focus leaves "slot-hair" and lands on the next group or control

  Scenario: The whole flow finishes from the keyboard
    When I choose one option in each group with the arrow keys
    And I press "Tab" until focus is on "start-playing"
    And I press "Enter"
    Then the event "character/created" is emitted
    And the Ottawa level loads
    And focus moves to the HUD, not to the body element

  Scenario: Every focused control is visibly focused
    When I press "Tab" through every control in "character-creator"
    Then each focused control has a focus indicator that is not colour alone
```

## TN-CREATOR-05 — Short press moves, long press chooses (single switch)

```gherkin
Feature: Single-switch character creation
  Background:
    Given single-switch mode is on
    And the element "character-creator" is visible

  Scenario: Nothing moves on its own
    When I do nothing for ten seconds
    Then the highlighted item has not changed
    And no option has been chosen
    And nothing on screen counts down

  Scenario: Short press advances the highlight and wraps
    When I press the switch briefly
    Then the highlight moves to the next item
    When I press the switch briefly until the highlight returns to the first item
    Then the highlight is on the first item again

  Scenario: Long press chooses the highlighted item
    Given the highlight is on the second option of "slot-coat"
    When I hold the switch past the hold-to-choose threshold
    Then that option is chosen
    And the choice is announced in "#tn-live-region"

  Scenario: The flow can be finished with the switch alone
    When I use only short and long presses
    Then I can reach and activate "start-playing"
    And the Ottawa level loads
```

## TN-CREATOR-06 — Every choice is announced (screen reader)

```gherkin
Feature: The creator without sight of the preview
  Background:
    Given the element "character-creator" is visible

  Scenario: The screen has a name and a structure
    Then "character-creator" has an accessible name that is not empty
    And each of "slot-skin", "slot-hair" and "slot-coat" is a group with an accessible name
    And every option is a radio with an accessible name that is a word, not a colour swatch

  Scenario: Choosing is announced in words
    When I choose the option named "Curly" in "slot-hair"
    Then "#tn-live-region" reads "Hair: Curly"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The preview is described, not just drawn
    Then "character-preview" has a text description listing the chosen option of every slot
    And that description updates when a choice changes

  Scenario: The canvas is not read
    When the Ottawa level loads
    Then the canvas element is "aria-hidden"
    And the arrival is announced in "#tn-live-region"
```

## TN-CREATOR-07 — The preview does not animate (reduced motion)

```gherkin
Feature: Reduced motion in the creator
  Scenario: The idle animation stops
    Given the browser reports "prefers-reduced-motion: reduce"
    When the element "character-creator" is visible
    Then "character-preview" reports "data-animated" equal to "false"
    And changing an option swaps the preview with no transition
    And no confetti, sparkle or particle is drawn on the screen

  Scenario: The in-game setting has the same effect as the browser setting
    Given "setting-reduced-motion" is on
    And the browser reports no motion preference
    When the element "character-creator" is visible
    Then "character-preview" reports "data-animated" equal to "false"

  Scenario: Reduced motion does not remove information
    Given reduced motion is on
    Then every option still shows its name
    And the chosen option is still marked with a shape or a tick, not colour alone
```

## TN-CREATOR-08 — Nothing clips or overlaps at 200 % text

```gherkin
Feature: Large text in the creator
  Scenario: The screen still works at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When the element "character-creator" is visible
    Then the page does not scroll sideways
    And the full text of the heading and of every option name is visible, not cut off
    And every control is still at least 44 CSS px wide and tall
    And "start-playing" is reachable, by scrolling down if needed

  Scenario: The dyslexia-friendly font does not break the layout
    Given "setting-dyslexia-font" is on
    And text scaling is 200 %
    Then no text overlaps another element
```

## TN-CREATOR-09 — The creator in French

```gherkin
Feature: Character creation in French
  Background:
    Given the language is French

  Scenario: Every visible string is French
    When the element "character-creator" is visible
    Then the heading reads "Créez votre personnage"
    And the groups read "Teint de peau", "Cheveux" and "Manteau"
    And the buttons read "Au hasard" and "Commencer à jouer"
    And no English word appears in "character-creator"
    And the screen carries "lang" equal to "fr"

  Scenario: Choices are announced in French
    When I choose the hair option named "Bouclés"
    Then "#tn-live-region" reads "Cheveux : Bouclés"

  Scenario: The save failure message is French
    Given writing to local storage fails
    When I tap "Commencer à jouer"
    Then a message says "Nous n'avons pas pu enregistrer votre personnage. Vous pouvez continuer à jouer, mais vos choix pourraient être perdus."
    And the buttons read "Réessayer" and "Continuer quand même"

  Scenario: A missing French string is visible as a bug, not silently English
    Given the French bundle has no value for "creator.slot.coat"
    When the content check runs
    Then the build fails, naming the missing French string
```

## TN-CREATOR-10 — Switching language does not lose the character

```gherkin
Feature: Language switching mid-flow
  Scenario: Choices survive a language change
    Given the language is English
    And I have chosen the second option in every group
    When I change the language to French
    Then the same option is still chosen in every group
    And the event "locale/changed" is emitted
    And every visible string is French
    And focus is on the language control, not lost to the body element

  Scenario: The language chosen here is the language the level speaks
    Given the language is French
    When I tap "Commencer à jouer"
    Then the HUD, the dialogue and the question card are in French
    And "#tn-live-region" announces in French
```

---

## Open questions

- **`OQ-CREATOR-1` — how many slots and how many options each?** The stories assume three slots (`skin`,
  `hair`, `coat`) because the character seam names slots as shared vocabulary and the art budget for slice 1
  is small. *Recommendation:* three slots, four to six options each, decided with the art agent in task 1.9
  and fixed by `character.schema.json` in 1.2. If the art lands with different slot names, this file is
  updated, not the schema.
- **`OQ-CREATOR-2` — does the player type a name?** Not in these scenarios. A free-text name brings
  profanity filtering, personal data in a save file and interpolation into two languages with different
  gender agreement. *Recommendation:* no name field in slice 1; the officer greets the player without one.
- **`OQ-CREATOR-3` — where does the character live in the save?** `ProgressSnapshot` in
  `app/application/ports/progress-repository.ts` has no field for it, so as written today the character
  cannot survive a reload and `TN-SAVE-01` cannot pass. *Recommendation:* task 1.2 adds a `character` block
  to `progress.schema.json` and to `ProgressSnapshot`.
- **`OQ-CREATOR-4` — can the character be changed later?** `creator.intro` promises "you can change this
  later in Settings". *Recommendation:* keep the promise in slice 1 by re-opening this same screen from
  Settings, or delete that sentence. Do not ship the sentence without the button.
- **`OQ-CREATOR-5` — skin tone option names.** Naming skin tones in two languages is a content-review
  matter, not a UI one. *Recommendation:* neutral, non-food names decided under `docs/content-review.md`
  (`OQ-REVIEW-1`), never a colour word alone.
