# TN-LEVEL — Level 4, Ottawa: skating the Rideau Canal

**Intent.** A player loads Level 4, skates the frozen Rideau Canal with one thumb in portrait, sees
Parliament Hill and the Peace Tower, and can reach and engage the officer and the landmark — with the ice
feeling like ice, not like pavement.

Read `README.md` in this directory first: it fixes the shared markers, the scene probe, the event names and
the single-switch contract these scenarios use. The HUD this level draws into is `TN-HUD-hud-and-menu.md`.
The waiting rule `level.loading` obeys is in `TN-COPY-strings-and-counts.md`.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-LEVEL-06` — *Skating and engaging with a keyboard*; `TN-LEVEL-02` for the stalled load |
| Single switch | `TN-LEVEL-07` — *The level is completable with one switch*; `TN-LEVEL-02` for the stalled load |
| Screen reader | `TN-LEVEL-08` — *The canvas is silent, the live region is not* |
| Reduced motion | `TN-LEVEL-09` — *No parallax easing, no particles, same physics* |
| 200 % text | `TN-LEVEL-10` — *The HUD at 200 %* |
| Bilingual | `TN-LEVEL-11` — *Ottawa in French* |
| Failure path | `TN-LEVEL-02` — *The level does not load* |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.ottawa.title` | Ottawa | Ottawa |
| `level.ottawa.subtitle` | How Canadians govern themselves | Comment les Canadiens se gouvernent |
| `level.loading` | Getting the canal ready. | Préparation du canal. |
| `locomotion.skate.label` | Skating | Patinage |
| `npc.officer.name` | The officer | L'agent |
| `hud.interact.officer` | Talk to the officer | Parler à l'agent |
| `hud.interact.poi.parliamentHill` | Look at Parliament Hill | Regarder la Colline du Parlement |
| `hud.turnAround` | Turn around | Faire demi-tour |
| `poi.parliamentHill.title` | Parliament Hill | La Colline du Parlement |
| `poi.parliamentHill.body` | The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower. | Les édifices du Parlement sont à Ottawa. La haute tour de l'horloge s'appelle la tour de la Paix. |
| `common.close` | Close | Fermer |
| `level.error.title` | We could not load Ottawa. | Nous n'avons pas pu charger Ottawa. |
| `level.error.body` | Check your connection and try again. | Vérifiez votre connexion et réessayez. |
| `level.error.retry` | Try again | Réessayer |
| `level.error.back` | Go back | Retour |
| `announce.arrived.ottawa` | You are on the Rideau Canal in Ottawa. Skating. | Vous êtes sur le canal Rideau à Ottawa. Patinage. |

`poi.parliamentHill.body` is a factual claim and goes through the same verification as a question — see
`OQ-LEVEL-4`.

**`level.loading` is the text `TN-LEVEL-01` requires when it says the loading screen shows "text, not only a
spinner".** It was reported as a gap under `TN-COPY-06` — the screen took it from the caller as a required
option, so no screen could be mounted without somebody inventing a sentence — and it is written here now.

It says what is being prepared and **nothing about how far along the load is**, because the game does not
know: assets arrive over a connection with no honest percentage, and the load's steps are not comparable in
size. So the string carries no percentage, no fraction, no "step 2 of 4", no progress bar with a value, and
no ellipsis. A bar that stops moving reads as a crash — this project has already shipped a screen that read
as a stalled progress bar — and three dots are a sentence nobody wrote. The honest answer to a long wait is
the escape route in `TN-LEVEL-02`, not a bigger number. `TN-COPY-07` binds every other waiting screen to the
same rule; this file owns the words.

The French is a noun phrase where the English is a sentence, and both end in a full stop: « Préparation du
canal. » is what a French speaker says about work in progress, and « Nous préparons le canal. » would promise
a « nous » that no other string in this level uses.

**`npc.officer.name` is the speaker's label**, and it is the string `TN-QUEST-08` needs when it requires the
dialogue to have "an accessible name naming the speaker". It is drawn as the dialogue's heading and is that
dialog's accessible name — one string doing both jobs, so a sighted player and a screen-reader user are told
the same thing. Under ADR-0010 a character's display name is inline content, carried by the NPC's own
document as `localizedText`; the wording is fixed here so no agent has to invent it, and the level file
transcribes it. **No dialogue in this game opens with a generic label**: "Speaker", "NPC", "Character" and
an empty heading are all defects, and `TN-QUEST-08` fails on them.

The officer is called "the officer" / « l'agent » in every string, never by an organisation's name — see
*What is depicted*. `OQ-LEVEL-8` covers the one French question the label raises.

## What is depicted, for the art agent

**The officer (`npc.officer`).** A police officer of the Royal Canadian Mounted Police in the ceremonial red
serge worn at public events: scarlet tunic, dark navy breeches with a yellow-gold stripe down the outside of
each leg, a brown leather Sam Browne belt with the strap over the right shoulder, brown riding boots, and the
flat-brimmed felt Stetson. Simplified cartoon shapes, three-tone cel shading, outline on characters only,
and the same cartoon proportions as every other character in the game.

**Not depicted, and this is a rule, not a preference:** no RCMP crest, cap badge, shoulder flash, collar
insignia, regimental or badge number; no "RCMP" or "GRC" wording anywhere; no firearm, no handcuffs. The
character is called "the officer" / « l'agent » in every string. The organisation is never named on screen.

**What I do not know, and am not going to invent** — see `OQ-LEVEL-1` … `OQ-LEVEL-3`: whether we may depict
this uniform at all, whether ceremonial red serge or a winter uniform is the right depiction on canal ice,
and the officer's gender presentation.

**The landmark.** Centre Block on Parliament Hill, seen from the canal below, with the Peace Tower
recognisable by its clock face and its proportions. Reference-accurate and simplified, never invented
(CLAUDE.md, Art). References go in `assets/refs/` with credit (task 1.9).

---

## TN-LEVEL-01 — Load Ottawa and stand on the ice

```gherkin
Feature: Loading Level 4
  As a player who just made a character
  I want the Ottawa level to open and be ready to play
  So that I can start skating

  Scenario: The level becomes playable
    Given I have a character
    When the Ottawa level loads
    Then the event "level/ready" is emitted for level "ottawa"
    And the element "playable" is present
    And "scene-state" reports "data-level" equal to "ottawa"
    And "scene-state" reports "data-mode" equal to "skate"
    And "scene-state" reports "data-paused" equal to "false"
    And the HUD shows "Skating"

  Scenario: The player starts at the level's spawn point, facing along the canal
    When the element "playable" appears
    Then "scene-state" reports "data-player-x" equal to the spawn x in the level file
    And "scene-state" reports "data-facing" equal to "right"
    And "scene-state" reports "data-speed" equal to "0"

  Scenario: Loading says what is happening, in words
    Given the level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the canal ready."
    And it is text, not only a spinner
    And the element "playable" is not present yet

  Scenario: The loading text claims no progress the game cannot measure
    Given the element "level-loading" is visible
    Then its text contains no percentage
    And it contains no fraction and no step count such as "2 of 4"
    And it contains no "…" and no "..."
    And no progress bar carrying a value is drawn
    And nothing on it counts down

  Scenario: The loading text does not change while the load runs
    Given the element "level-loading" is visible
    When the load continues past the time-to-play budget in "game.config.json"
    Then "level-loading" still reads "Getting the canal ready."
    And the escape route described in TN-LEVEL-02 appears beside it, not instead of it

  Scenario: The loading screen goes when the level is playable
    When the event "level/ready" is emitted
    Then the element "level-loading" is not present in the accessibility tree
    And it is not merely hidden behind a style rule

  Scenario: The level is built from data alone
    Given the level file "levels/ottawa.json" declares the parallax layers, the ground polyline, the points of interest and the skate tuning
    When the level loads
    Then no value used to build the scene comes from anywhere but that file and the assets it names
```

## TN-LEVEL-02 — The level does not load (failure path)

```gherkin
Feature: A failed or stalled level load
  Scenario: The level assets cannot be fetched
    Given requests for the Ottawa assets fail
    When I open the Ottawa level
    Then the event "level/failed" is emitted for level "ottawa"
    And the element "level-error" is visible
    And it says "We could not load Ottawa." and "Check your connection and try again."
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the failure is announced in "#tn-live-region"
    And the element "playable" is never present
    And the element "level-loading" is gone

  Scenario: Trying again after the network comes back
    Given the element "level-error" is visible
    And requests for the Ottawa assets now succeed
    When I tap "Try again"
    Then the element "playable" appears
    And the element "level-error" is gone

  Scenario: A stalled load can always be left
    Given the Ottawa level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And tapping it leaves the level without reloading the page
    And the waiting message is unchanged

  Scenario: The escape route is reachable without a mouse
    Given the "Go back" button on a stalled load is visible
    And I am using a keyboard only
    Then it is reachable with "Tab" and activates with "Enter"
    Given single-switch mode is on
    Then it is reachable with a short press and chosen with a long press
    And it is at least 44 CSS px wide and tall

  Scenario: A level that cannot fit the texture budget is refused, not crashed into
    Given the level file declares decoded texture bytes above the per-level ceiling
    When the level is requested
    Then the load is refused before any asset is fetched
    And the element "level-error" is visible
    And the same condition fails the build in CI
```

## TN-LEVEL-03 — Skating feels like ice

The numbers below live in `levels/ottawa.json` under the `skate` tuning. Scenarios assert *relationships*
and read the values from that file, so tuning the level does not rewrite the tests.

```gherkin
Feature: Skate locomotion
  As a player holding one thumb on the screen
  I want the skater to build up speed and glide
  So that the canal feels like ice and not like a pavement

  Background:
    Given the Ottawa level is playable
    And the player is standing still on flat ice

  Scenario: Speed builds up instead of starting at full pace
    When I hold "move-right"
    Then "data-speed" is greater than 0 within 100 milliseconds
    And "data-speed" is less than half of "maxSpeed" after 200 milliseconds
    And "data-speed" is at least 70 percent of "maxSpeed" after 1 second
    And the event "player/moved" is emitted while the hold lasts

  Scenario: Releasing does not stop the skater
    Given I have held "move-right" until "data-speed" reaches "maxSpeed"
    When I release
    Then "data-speed" is still at least half of "maxSpeed" one second later
    And the player keeps moving in the same direction for at least two seconds
    And "data-speed" never increases while I am not holding anything
    And the event "player/stopped" is emitted only when "data-speed" reaches 0

  Scenario: Glide is what makes skate different from walk
    Given a walk tuning whose "glide" is 0.1
    And the Ottawa skate tuning whose "glide" is at least 0.9
    When each is accelerated to its own cruise speed and then released
    Then the skater travels at least five times as far as the walker before stopping

  Scenario: Turning around costs time
    Given I have held "move-right" until "data-speed" reaches "maxSpeed"
    When I hold "move-left" instead
    Then "data-speed" passes through 0 before the player moves left
    And "data-facing" changes to "left" only once the player is actually moving left
    And reaching cruise speed to the left takes longer than reaching cruise speed from standing still

  Scenario: Holding the other way is the brake, and there is no instant stop
    Given I am gliding to the right at cruise speed
    When I hold "move-left"
    Then the event "player/braked" is emitted
    And the player stops in a shorter distance than a free glide from the same speed
    And "data-speed" never falls from above half of "maxSpeed" to 0 inside a single frame

  Scenario: A slope adds speed, up to a stated limit
    Given a downhill segment of the canal bank
    When the player skates down it while holding the same direction
    Then "data-speed" may rise above "maxSpeed"
    And "data-speed" never rises above "maxSpeed" multiplied by "maxSpeedMultiplierDownhill"

  Scenario: Tapping the ice is a hop that keeps the momentum
    Given I am gliding to the right at cruise speed
    When I tap the play area away from the officer and away from a point of interest
    Then the event "player/jumped" is emitted
    And "data-grounded" becomes "false"
    And on landing the horizontal speed is at least 90 percent of the take-off speed

  Scenario: There is no second jump and no trick
    Given the player is in the air
    When I tap again
    Then no second "player/jumped" event is emitted
    And no rotation, flip or score appears

  Scenario: The player cannot leave the level
    When I hold "move-left" from the spawn point for ten seconds
    Then "data-player-x" never goes below the level's left bound
    And the player does not fall through the ice
```

## TN-LEVEL-04 — The camera, in portrait

```gherkin
Feature: Portrait camera and framing
  Background:
    Given the viewport is 390 x 844
    And the Ottawa level is playable

  Scenario: The canvas is portrait and centred
    Then the canvas keeps the 1080 by 1920 aspect ratio
    And the canvas is not stretched to the window width
    And on a window wider than the canvas, the panels beside it use the level's sky and ground colours

  Scenario: The playfield is above and the HUD is below
    Then the skater is drawn inside the upper two thirds of the canvas
    And every HUD control is inside the lower third
    And no HUD control covers the skater

  Scenario: The camera keeps the skater in view while gliding
    When I hold "move-right" for three seconds and release
    Then the skater's position on screen stays between 25 and 70 percent of the canvas width for the whole time
    And "data-camera-x" never decreases while the skater is moving right

  Scenario: The camera looks ahead in the direction of travel
    Given the skater is at cruise speed to the right
    Then more of the canal ahead is visible than behind
    When the skater turns and cruises to the left
    Then more of the canal ahead of the new direction is visible than behind

  Scenario: The camera stops at the ends of the level
    When the skater reaches the left end of the level
    Then "data-camera-x" stops at the level's left bound
    And no empty space is shown past the end of the painted level

  Scenario: A landmark is framed, not cut in half
    When the skater reaches the Parliament Hill point of interest
    Then the Peace Tower is fully inside the canvas
```

## TN-LEVEL-05 — The officer and the landmark

```gherkin
Feature: Engaging an NPC and a point of interest
  Background:
    Given the Ottawa level is playable

  Scenario: Coming into reach offers an engagement, in words
    When the skater comes within the skate tuning's "reachPx" of the officer
    Then the event "poi/entered" is emitted for "npc.officer"
    And the element "interact-prompt" is visible and reads "Talk to the officer"
    And "interact-prompt" is at least 44 CSS px wide and tall
    And the offer is announced in "#tn-live-region"

  Scenario: Leaving reach withdraws the offer
    When the skater glides past the officer and out of reach
    Then the event "poi/left" is emitted for "npc.officer"
    And the element "interact-prompt" is not visible

  Scenario: Tapping the officer starts the conversation
    Given the officer is in reach
    When I tap the officer
    Then the event "npc/engaged" is emitted for "npc.officer"
    And the event "dialogue/opened" is emitted
    And the element "dialogue" is visible
    And the skater comes to a stop rather than sliding away under the card

  Scenario: The dialogue says who is speaking
    Given the element "dialogue" is visible
    Then the element "dialogue-speaker" reads "The officer"
    And it is the accessible name of "dialogue"
    And it is not "Speaker", "NPC", "Character" or empty

  Scenario: Tapping the prompt does the same thing as tapping the officer
    Given the officer is in reach
    When I tap "interact-prompt"
    Then the event "npc/engaged" is emitted for "npc.officer"

  Scenario: A landmark tells the player something true and short
    Given the Parliament Hill point of interest is in reach
    When I tap it
    Then the event "poi/engaged" is emitted for "poi.parliament-hill"
    And the element "poi-card" is visible
    And it shows the heading "Parliament Hill"
    And it shows "The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower."
    And a "Close" button is offered

  Scenario: Closing a card returns the player to the ice
    Given the element "poi-card" is visible
    When I tap "poi-card-close"
    Then the element "poi-card" is gone
    And the element "playable" accepts input again
    And focus returns to "interact-prompt"

  Scenario: The game does not move while a card is open
    Given the element "poi-card" is visible
    When I hold "move-right" for two seconds
    Then "data-player-x" does not change
    And "data-paused" is "true"
```

## TN-LEVEL-06 — Skating and engaging with a keyboard

```gherkin
Feature: Keyboard-only traversal
  Background:
    Given I am using a keyboard only
    And the Ottawa level is playable

  Scenario: Holding a key moves, releasing it glides
    When I hold the key bound to "move-right"
    Then "data-speed" rises exactly as it does for a held touch
    When I release the key
    Then the skater glides exactly as it does after a released touch

  Scenario: Jump and interact have keys
    When I press the key bound to "jump"
    Then the event "player/jumped" is emitted
    When the officer is in reach and I press the key bound to "interact"
    Then the event "npc/engaged" is emitted for "npc.officer"

  Scenario: Bindings are by key position, not by letter
    Given the keyboard layout is AZERTY
    Then the key in the same physical position still performs the same action

  Scenario: The keyboard never gets stuck in the canvas
    Given the element "dialogue" is visible
    When I press the key bound to "move-right"
    Then the skater does not move
    And focus stays inside "dialogue"
    When I close the dialogue
    Then the key bound to "move-right" moves the skater again

  Scenario: A keyboard player can reach the whole level
    When I use only the keyboard
    Then I can reach the officer, engage them, reach Parliament Hill and engage it
```

## TN-LEVEL-07 — The level is completable with one switch

```gherkin
Feature: Single-switch traversal
  Background:
    Given single-switch mode is on
    And the Ottawa level is playable

  Scenario: Movement does not need a held direction
    Then the skater moves along the canal without any input
    And "data-mode" is still "skate"
    And nothing on screen counts down

  Scenario: Short press picks the next thing to do
    When I press the switch briefly
    Then the highlight moves to the next available action, one of: turn around, jump, or the nearest thing to engage
    And the highlighted action is named in text and announced in "#tn-live-region"

  Scenario: Long press does the highlighted thing
    Given the highlighted action is "Talk to the officer"
    When I hold the switch past the hold-to-choose threshold set by "Hold time"
    Then the event "npc/engaged" is emitted for "npc.officer"

  Scenario: The whole level can be finished with the switch alone
    When I use only short and long presses
    Then I can talk to the officer, reach Parliament Hill, engage it, and answer a question
    And I never need to hold a direction
```

## TN-LEVEL-08 — The canvas is silent, the live region is not

```gherkin
Feature: Playing Ottawa with a screen reader
  Background:
    Given the Ottawa level is playable

  Scenario: Nothing on the canvas is read, and nothing on it is the only signal
    Then the canvas element is "aria-hidden"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Waiting is announced once
    When the level starts loading
    Then "#tn-live-region" reads "Getting the canal ready."
    And it is not repeated while the load continues
    And "level-loading" has no "aria-live" attribute of its own

  Scenario: Arriving is announced
    When the event "level/ready" is emitted
    Then "#tn-live-region" reads "You are on the Rideau Canal in Ottawa. Skating."

  Scenario: Reaching something is announced
    When the officer comes into reach
    Then "#tn-live-region" reads a message naming the officer and what to do
    When Parliament Hill comes into reach
    Then "#tn-live-region" reads a message naming Parliament Hill and what to do

  Scenario: The speaker is named before the words are read
    When the dialogue opens
    Then the accessible name of "dialogue" is "The officer"
    And it is read before the first line of dialogue

  Scenario: Every sound has a visual twin
    When any sound is played in the level
    Then a caption or an on-screen sign carries the same information
    And with sound switched off no scenario in this file becomes impossible

  Scenario: The announcements do not flood
    When the skater passes three things in reach in quick succession
    Then no announcement is cut off before it is read
    And announcements are delivered in order
```

## TN-LEVEL-09 — Reduced motion changes the picture, not the physics

```gherkin
Feature: Reduced motion in the level
  Background:
    Given reduced motion is on, from the browser or from "setting-reduced-motion"

  Scenario: The loading screen is text, and it is still
    Given the level assets are still downloading
    Then "level-loading" reads "Getting the canal ready."
    And nothing on it spins, pulses, slides or flashes
    And the message is what tells me the game is working, not an animation

  Scenario: Parallax stops easing and the snow stops falling
    Given the Ottawa level is playable
    Then "scene-state" reports "data-parallax-easing" equal to "off"
    And "scene-state" reports "data-particles" equal to "0"
    And the skater is drawn without squash and stretch

  Scenario: The camera follows without overshoot
    Given the Ottawa level is playable
    When I hold "move-right" for three seconds and release
    Then "data-camera-x" never moves past the skater and back

  Scenario: The game is not made easier or harder
    Given the Ottawa level is playable
    Then the skate tuning values are unchanged
    And the glide distance after a release is the same as with motion on
    And every point of interest is still reachable

  Scenario: The HUD keeps its meaning
    Given the Ottawa level is playable
    Then every state shown by an animation is also shown by a word or a shape
```

## TN-LEVEL-10 — The HUD at 200 % text

```gherkin
Feature: Large text over the level
  Scenario: The HUD grows without covering the playfield
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the Ottawa level is playable
    Then the page does not scroll sideways
    And every HUD label is fully visible, not cut off
    And every HUD control is still at least 44 CSS px wide and tall
    And the skater is still drawn inside the upper two thirds of the canvas

  Scenario: The interact prompt still fits its longest string
    Given text scaling is 200 %
    And the language is French
    When the officer comes into reach
    Then "interact-prompt" shows the whole of "Parler à l'agent"

  Scenario: The loading and error screens fit too
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When "level-loading" is visible
    Then the whole of its message is visible, not cut off
    When "level-error" is visible
    Then both of its sentences are readable, by scrolling if needed
    And "Try again" and "Go back" are fully visible and at least 44 CSS px tall
```

## TN-LEVEL-11 — Ottawa in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation du canal."
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: Everything the player reads is French
    Given the Ottawa level is playable
    Then the HUD reads "Patinage"
    And the level title reads "Ottawa" with the subtitle "Comment les Canadiens se gouvernent"
    When the officer comes into reach
    Then "interact-prompt" reads "Parler à l'agent"
    When Parliament Hill comes into reach
    Then "interact-prompt" reads "Regarder la Colline du Parlement"

  Scenario: The speaker's label is French
    Given the Ottawa level is playable
    When I engage the officer
    Then "dialogue-speaker" reads "L'agent"
    And it is the accessible name of "dialogue"

  Scenario: The officer is named the same way in every string
    Then every French string that names the officer uses the same form of the word
    And no French string about the officer contains "(e)", "·e" or a bracketed ending
    And no string in either language names a police force

  Scenario: The landmark card is French
    Given the Ottawa level is playable
    When I engage Parliament Hill
    Then "poi-card" shows "La Colline du Parlement"
    And it shows "Les édifices du Parlement sont à Ottawa. La haute tour de l'horloge s'appelle la tour de la Paix."
    And the close button reads "Fermer"

  Scenario: Announcements are French, and marked as French
    When the event "level/ready" is emitted
    Then "#tn-live-region" reads "Vous êtes sur le canal Rideau à Ottawa. Patinage."
    And the announcing element carries "lang" equal to "fr"

  Scenario: The failure message is French
    Given requests for the Ottawa assets fail
    Then "level-error" says "Nous n'avons pas pu charger Ottawa." and "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The two languages describe the same level
    Then every string key used by the Ottawa level has a value in both "en" and "fr"
    And no string is drawn onto the canvas as part of an image
```

## TN-LEVEL-12 — Turning the phone, and stepping away

```gherkin
Feature: Pausing
  Background:
    Given the Ottawa level is playable

  Scenario: Landscape pauses the game where it stands
    Given the skater is gliding
    When I turn the phone to landscape
    Then the rotate overlay is visible
    And "data-paused" becomes "true"
    And "data-player-x" stops changing
    And no "player/moved" event is emitted while the overlay is up

  Scenario: Coming back to portrait resumes in the same place
    Given the rotate overlay is visible and "data-player-x" is recorded
    When I turn the phone back to portrait
    Then the overlay is hidden
    And "data-player-x" is the value recorded before
    And "data-paused" is "false"

  Scenario: The menu pauses too, and does not eat the input
    When I tap "menu-button"
    Then "data-paused" is "true"
    And holding "move-right" does not move the skater
    When I close the menu
    Then "data-paused" is "false"
    And focus returns to "menu-button"

  Scenario: Nothing is lost when the tab is hidden
    When the tab is hidden for thirty seconds
    Then "data-paused" is "true"
    And on returning, the skater is where it was
    And no question, dialogue or quest step advanced while the tab was hidden
```

---

## Open questions

- **`OQ-LEVEL-1` — may we depict the RCMP uniform at all?** The red serge, the Stetson and the RCMP's marks
  are protected, and this project is publicly released under open licences (ADR-0004). Removing the crest and
  the wordmark is what `docs/plan/slice-1.md` asks for, and it may not be enough. *Recommendation:* get a
  written answer before task 1.9 draws the character; the fallback that needs no answer is a generic municipal
  or park officer in a plain winter uniform, which costs the slice nothing except recognisability.
- **`OQ-LEVEL-2` — red serge on the ice, or a winter uniform?** Ceremonial red serge is what people picture,
  and it is what an officer wears at public events; it is not what anyone wears outdoors on the canal in
  February. *Recommendation:* red serge, because recognisability is the point of Level 4 and the officer is
  standing at a public event on the skateway — but say so in the level's art notes rather than leaving it as
  an accident.
- **`OQ-LEVEL-3` — the officer's gender presentation is not specified**, and neither is the character's
  skin tone. *Recommendation:* decide it in `docs/content-review.md` (`OQ-REVIEW-6` and the depiction rules
  in §6 and §8.6) rather than in an art ticket, and keep the same cartoon proportions as every other
  character either way.
- **`OQ-LEVEL-4` — does dialogue and landmark copy go through content verification?** ADR-0003 governs
  questions. `poi.parliamentHill.body` and the officer's greeting both state facts. *Recommendation:* any
  sentence that states a fact about Canada is verified exactly like a question, whatever screen it appears
  on; instructions and greetings are not.
- **`OQ-LEVEL-5` — how many points of interest does Ottawa have?** These scenarios need one landmark and one
  NPC. *Recommendation:* ship exactly those two in slice 1 and let slice 2 prove that a third is data.
- **`OQ-LEVEL-6` — `turnAcceleration` is documented backwards.** `app/application/ports/locomotion.ts` says
  "px/s² when input reverses. High for skate/canoe: turning around costs time" — a *high* acceleration makes
  turning around faster, not slower. The scenario in `TN-LEVEL-03` states the behaviour we want; the comment
  and the Ottawa tuning have to agree with it. *Recommendation:* the implementer of task 1.14 fixes the
  comment, and the level tunes `turnAcceleration` below `acceleration`.
- **`OQ-LEVEL-7` — can the skater jump at all?** These scenarios say yes: one hop, no double jump, no trick,
  so that a tap always means something. If the design says skate cannot jump, `jump` is `null` in the level
  file and `TN-LEVEL-03`'s two hop scenarios are deleted rather than quietly failing.
- **`OQ-LEVEL-8` — « l'agent » or « l'agente »?** Three French strings name the officer —
  `npc.officer.name`, `hud.interact.officer` and `quest.step.talk` in `TN-QUEST` — and all three use the
  masculine generic today. If `OQ-LEVEL-3` answers that the officer is drawn as a woman, all three change
  together to « l'agente ». *Recommendation:* one decision, three strings, and the scenario "the officer is
  named the same way in every string" in `TN-LEVEL-11` is what stops two of them changing and the third not.
  Do **not** reach for « l'agent(e) » or « l'agent·e »: `docs/content-review.md` §8.6 forbids the bracketed
  form, and it is unreadable to a screen reader in either language.
- **`OQ-LEVEL-9` — one loading string, or one per level?** `level.loading` names the canal, which is true of
  Ottawa and of nothing else; level 2 cannot use this sentence. *Recommendation:* keep the key `level.loading`
  and let the level own the wording — under ADR-0010 the level file already carries inline `localizedText`
  for its own content — so each level says what *it* is getting ready and no screen has to fall back to
  "Loading". If instead a single shared sentence is wanted, it names no place ("Getting the level ready." /
  « Préparation du niveau. ») and this file's scenarios change with it. What must not happen is one level's
  sentence being shown while another level loads.
- **`OQ-LEVEL-10` — is anything else in the game allowed a determinate progress figure?** `TN-COPY-07` allows
  one where the completed and total parts are both really known, and nothing in slice 1 knows both.
  *Recommendation:* leave it unused until something honestly measurable exists — a file import with a byte
  count is the first plausible candidate — and treat any percentage that appears before then as a defect.
