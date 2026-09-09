# TN-QUEST — "Skate to Parliament Hill"

**Intent.** The officer gives the player one small job, the player always knows what it is and how far
through it they are, and finishing it earns the Ottawa stamp.

The quest is `quest.ottawa.parliament-hill`, with three steps:

| # | Kind | Target | Done when |
|---|---|---|---|
| 1 | talk | `npc.officer` | The player accepts the offer |
| 2 | visit | `poi.parliament-hill` | The player engages the landmark |
| 3 | answer | three scheduled questions | The third question is answered — right or wrong |

Answering wrongly still finishes the step. This is a learning tool, not a test: see `TN-CARD` for what a
wrong answer does instead.

Step 3 can be interrupted by a closed tab and picked up later. What happens then — which question is asked,
and why it may be one the player has already answered — is `TN-RESUME-questions-after-a-reload.md`, which
owns that moment for every story that touches it.

Read `README.md` in this directory first. The question card itself is `TN-CARD-question-card.md`. The strip
the tracker is drawn into is `TN-HUD-hud-and-menu.md`. The screen the stamp lands in is
`TN-PASSPORT-my-passport.md`.

**Amended 2026-09-08 — « le timbre » is now « le tampon », and `passport.open` moved.** A « timbre » is a
postage stamp; the mark an officer puts in a passport is « un tampon ». `OQ-MAP-5` recorded the defect and
deferred to this file; `TN-PASSPORT-my-passport.md` settles it, in that word's favour, and lists every string
in this directory that changed with it. `stamp.ottawa.earned` is one of them. The passport's own label,
`passport.open`, moved to the file that owns the passport screen, for the reason `TN-SET` gives about
`common.settings` and `settings.title`: the screen owns both its heading and the control that opens it.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-QUEST-06` — *Accepting and following the quest with a keyboard* |
| Single switch | `TN-QUEST-07` — *Accepting with one switch* |
| Screen reader | `TN-QUEST-08` — *The quest is audible: offer, step, completion, stamp* |
| Reduced motion | `TN-QUEST-09` — *The stamp lands without animation* |
| 200 % text | `TN-QUEST-10` — *The tracker and the dialogue at 200 %* |
| Bilingual | `TN-QUEST-11` — *The whole quest in French* |
| Failure path | `TN-QUEST-03` (declining), `TN-QUEST-05` (no questions available) |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `officer.greet` | Hello! Welcome to Ottawa. Ottawa is Canada's capital city. | Bonjour! Bienvenue à Ottawa. Ottawa est la capitale du Canada. |
| `officer.offer` | Skate up the canal to Parliament Hill and find the Peace Tower. Then answer three questions. | Patinez sur le canal jusqu'à la Colline du Parlement et trouvez la tour de la Paix. Ensuite, répondez à trois questions. |
| `quest.accept` | Yes, let's go | Oui, allons-y |
| `quest.decline` | Not now | Pas maintenant |
| `officer.declined` | No problem. Come back when you are ready. | Pas de problème. Revenez quand vous serez prêt. |
| `officer.reminder` | Parliament Hill is that way. Keep going. | La Colline du Parlement est par là. Continuez. |
| `officer.afterStamp` | Well done. Enjoy the canal. | Bravo. Profitez bien du canal. |
| `hud.task` | Task | Mission |
| `quest.step.talk` | Talk to the officer | Parlez à l'agent |
| `quest.step.visit` | Find the Peace Tower | Trouvez la tour de la Paix |
| `quest.step.answer` | Answer 3 questions ({{done}} of 3) | Répondez à 3 questions ({{done}} sur 3) |
| `quest.done.title` | Task done! | Mission accomplie! |
| `quest.done.body` | You skated to Parliament Hill and answered three questions. | Vous avez patiné jusqu'à la Colline du Parlement et répondu à trois questions. |
| `stamp.ottawa.earned` | You earned the Ottawa stamp. | Vous avez obtenu le tampon d'Ottawa. |
| `common.keepPlaying` | Keep playing | Continuer à jouer |
| `quest.noQuestions` | The questions are not ready right now. Try again later. | Les questions ne sont pas prêtes pour l'instant. Réessayez plus tard. |

`officer.greet` states a fact about Canada and is verified like a question (`OQ-LEVEL-4`).

**The dialogue's speaker label is `npc.officer.name`** — "The officer" / « L'agent » — defined in
`TN-LEVEL-ottawa.md` with the rest of that character. It is not repeated here, because a name written down
twice is a name that can differ in two places. `TN-QUEST-08` asserts it is what the dialog is called.

**`passport.open`** — "See my passport" / « Voir mon passeport » — is defined in
`TN-PASSPORT-my-passport.md`. The completion card draws it and does not own it.

`quest.step.answer` counts to a number the quest document fixes at three, so the author writes "3 questions"
once and no plural rule applies (`TN-COPY-strings-and-counts.md`, rule 5). The `{{done}}` placeholder is not
followed by a noun, so it cannot produce "1 questions". If a later quest ever makes the total variable, the
string becomes two rows.

**`{{done}}` counts answers given, not different questions,** and the string is worded so that it can say so
honestly. Within one sitting the two are the same thing, because the game never asks the same question twice
in a sitting (`TN-CARD-02`). Across a reload they can differ by one, when the question the player got wrong
is ready to come back and is offered again — `TN-RESUME` says why that is the right trade and what it costs.
The counter never goes down and never counts one answer twice (`TN-RESUME-02`).

---

## TN-QUEST-01 — The officer offers the task

```gherkin
Feature: Being offered the quest
  As a player skating the canal
  I want the officer to tell me plainly what to do
  So that I never have to guess where to go

  Background:
    Given the Ottawa level is playable
    And I have not accepted "quest.ottawa.parliament-hill"

  Scenario: Talking to the officer opens the offer
    When I engage the officer
    Then the event "dialogue/opened" is emitted
    And the event "quest/offered" is emitted for "quest.ottawa.parliament-hill"
    And the element "dialogue-speaker" reads "The officer"
    And the element "dialogue" shows "Hello! Welcome to Ottawa. Ottawa is Canada's capital city."
    And then it shows "Skate up the canal to Parliament Hill and find the Peace Tower. Then answer three questions."
    And the buttons "dialogue-accept" and "dialogue-decline" read "Yes, let's go" and "Not now"

  Scenario: The dialogue reads at a plain-language level
    Then every sentence in the dialogue is at most 20 words
    And the dialogue is written at roughly a grade-6 reading level in both languages

  Scenario: Subtitles are on without being asked for
    Given I have never opened Settings
    When the officer speaks
    Then the words are shown as text
    And "setting-subtitles" is on

  Scenario: The offer waits for the player
    When I leave the dialogue open and do nothing for two minutes
    Then the dialogue is still open
    And nothing has been accepted or declined for me
    And nothing on screen counts down
```

## TN-QUEST-02 — Accepting, and following the task

```gherkin
Feature: Accepting and tracking the quest
  Background:
    Given the Ottawa level is playable
    And the officer's offer is open

  Scenario: Accepting closes the dialogue and starts the tracker
    When I tap "Yes, let's go"
    Then the event "quest/accepted" is emitted for "quest.ottawa.parliament-hill"
    And the event "quest/step-completed" is emitted for step 1
    And the event "progress/saved" is emitted
    And the element "dialogue" is gone
    And the element "hud-quest-tracker" shows "Task" and "Find the Peace Tower"
    And the skater can move again

  Scenario: The tracker says what to do now, not what the quest is called
    Then "hud-quest-tracker" shows the current step, not the whole list
    And it is readable without opening a menu

  Scenario: Reaching the landmark completes the second step
    Given I have accepted the quest
    When I engage "poi.parliament-hill"
    Then the event "quest/step-completed" is emitted for step 2
    And "hud-quest-tracker" shows "Answer 3 questions (0 of 3)"
    And the change is announced in "#tn-live-region"

  Scenario: The tracker counts the questions as they are answered
    Given I am on step 3
    When I answer one question
    Then "hud-quest-tracker" shows "Answer 3 questions (1 of 3)"
    And the count rises whether the answer was right or wrong

  Scenario: Talking to the officer again while the quest is on gives a reminder, not a second offer
    Given I have accepted the quest
    When I engage the officer
    Then the dialogue shows "Parliament Hill is that way. Keep going."
    And no second "quest/offered" event is emitted
    And the quest step does not change
```

## TN-QUEST-03 — Declining, and changing my mind (failure path)

```gherkin
Feature: Saying no
  Scenario: Declining leaves the player free and the quest available
    Given the officer's offer is open
    When I tap "Not now"
    Then the event "quest/declined" is emitted for "quest.ottawa.parliament-hill"
    And the dialogue shows "No problem. Come back when you are ready."
    And the element "hud-quest-tracker" is not shown
    And the skater can move again

  Scenario: The quest can be accepted later
    Given I declined the quest
    When I engage the officer again
    Then the event "quest/offered" is emitted again
    And I can accept it

  Scenario: The landmark still works without the quest
    Given I have not accepted the quest
    When I engage "poi.parliament-hill"
    Then the element "poi-card" is shown
    And no "quest/step-completed" event is emitted
    And no question card appears

  Scenario: Leaving the dialogue without choosing is not a decline
    Given the officer's offer is open
    When I press "Escape" or tap the close control
    Then the event "dialogue/closed" is emitted
    And no "quest/accepted" and no "quest/declined" event is emitted
    And engaging the officer again shows the offer from the start
```

## TN-QUEST-04 — Finishing the task and earning the stamp

```gherkin
Feature: Completing the quest
  Background:
    Given I have accepted the quest
    And I have engaged Parliament Hill
    And I have answered two of the three questions

  Scenario: The third answer finishes the quest
    When I answer the third question
    Then the event "quest/step-completed" is emitted for step 3
    And the event "quest/completed" is emitted for "quest.ottawa.parliament-hill"
    And the event "stamp/earned" is emitted for "ottawa"
    And the event "progress/saved" is emitted
    And the element "quest-complete-card" shows "Task done!"
    And it shows "You skated to Parliament Hill and answered three questions."
    And it shows "You earned the Ottawa stamp."
    And the buttons "See my passport" and "Keep playing" are offered

  Scenario: A wrong answer still finishes the quest
    Given my three answers were all wrong
    When I answer the third question
    Then the event "quest/completed" is emitted
    And the stamp is still earned
    And no message tells me I failed

  Scenario: The third answer finishes it after a reload as well
    Given the tab was closed after my second answer
    When I open the game again, engage Parliament Hill and answer once more
    Then the event "quest/completed" is emitted
    And the stamp is earned exactly once
    And it does not matter whether that last question was one I had answered before

  Scenario: The stamp appears in the passport
    When I tap "See my passport"
    Then the element "passport" is visible, as TN-PASSPORT-01 describes
    And it contains "stamp-ottawa"
    And "stamp-ottawa" has a text label naming Ottawa, not only a picture

  Scenario: Going back to the ice
    When I tap "Keep playing"
    Then the element "quest-complete-card" is gone
    And the element "playable" accepts input again
    And "hud-quest-tracker" is no longer shown

  Scenario: The quest cannot be completed twice
    Given the quest is complete
    When I engage the officer
    Then the dialogue shows "Well done. Enjoy the canal."
    And no second "stamp/earned" event is emitted
    And the passport still contains exactly one Ottawa stamp

  Scenario: Steps cannot be skipped
    Given I have accepted the quest
    When the game tries to complete step 3 before step 2
    Then the step is refused
    And "hud-quest-tracker" still shows "Find the Peace Tower"
```

## TN-QUEST-05 — No questions are available (failure path)

```gherkin
Feature: The answer step cannot start
  Scenario: The question bank is empty or every question is quarantined
    Given no verified question exists for this level's subject
    And I have accepted the quest and engaged Parliament Hill
    Then a message says "The questions are not ready right now. Try again later."
    And the message is announced in "#tn-live-region"
    And "hud-quest-tracker" still shows "Answer 3 questions (0 of 3)"
    And the skater can move away
    And no "quest/completed" and no "stamp/earned" event is emitted

  Scenario: Fewer than three questions exist
    Given only two verified questions exist for this level's subject
    When I reach the answer step
    Then two questions are asked
    And no question is asked twice in that sitting to make up the number
    And the quest does not complete
    And the message explains that more questions are coming

  Scenario: A question cannot be shown because it has no French text
    Given the language is French
    And one question in the bank has no French wording
    Then that question is never shown
    And the build has already failed the content check for it
```

## TN-QUEST-06 — Accepting and following the quest with a keyboard

```gherkin
Feature: Keyboard-only quest
  Background:
    Given I am using a keyboard only
    And the Ottawa level is playable

  Scenario: The dialogue takes and keeps focus
    When I engage the officer with the key bound to "interact"
    Then focus moves into "dialogue"
    And pressing "Tab" repeatedly never leaves "dialogue"
    And the accept and decline buttons are reachable with "Tab"

  Scenario: Accepting from the keyboard
    When I press "Tab" until focus is on "dialogue-accept"
    And I press "Enter"
    Then the event "quest/accepted" is emitted
    And focus returns to the HUD, not to the body element

  Scenario: Escape closes the dialogue and gives focus back
    When I press "Escape"
    Then the dialogue closes
    And focus returns to "interact-prompt"

  Scenario: The whole quest finishes from the keyboard
    When I use only the keyboard
    Then I can accept, reach the landmark, answer three questions and open the passport
```

## TN-QUEST-07 — Accepting with one switch

```gherkin
Feature: Single-switch quest
  Background:
    Given single-switch mode is on
    And the officer's offer is open

  Scenario: The two choices are reachable with short presses
    When I press the switch briefly
    Then the highlight moves between "Yes, let's go" and "Not now" and back
    And the highlighted choice is announced in "#tn-live-region"

  Scenario: A long press accepts
    Given the highlight is on "Yes, let's go"
    When I hold the switch past the hold-to-choose threshold set by "Hold time"
    Then the event "quest/accepted" is emitted

  Scenario: Nothing is chosen for the player
    When I do nothing for one minute
    Then neither choice has been taken
    And nothing on screen counts down

  Scenario: The whole quest finishes with the switch alone
    When I use only short and long presses
    Then I can accept, reach the landmark, answer three questions and earn the stamp
```

## TN-QUEST-08 — The quest is audible

```gherkin
Feature: The quest with a screen reader
  Scenario: The dialogue is a named dialog
    When the officer's offer opens
    Then "dialogue" has role "dialog" with "aria-modal" true
    And its accessible name is "The officer", the value of "npc.officer.name"
    And that same name is drawn as "dialogue-speaker", so it is seen as well as heard
    And the name is not "Speaker", "NPC", "Dialogue" or empty
    And the rest of the page is inert while it is open

  Scenario: Each step change is announced once
    When I accept the quest
    Then "#tn-live-region" reads "Task: Find the Peace Tower"
    When I engage Parliament Hill
    Then "#tn-live-region" reads "Task: Answer 3 questions, 0 of 3"
    And no announcement is repeated for the same step

  Scenario: Completion and the stamp are announced
    When the quest completes
    Then "#tn-live-region" reads "Task done. You earned the Ottawa stamp."
    And focus moves to "quest-complete-card"

  Scenario: The tracker is readable at any time, not only when it changes
    Then "hud-quest-tracker" is in the accessibility tree as text
    And it is reachable without moving the skater
```

## TN-QUEST-09 — The stamp lands without animation

```gherkin
Feature: Reduced motion for the quest
  Background:
    Given reduced motion is on

  Scenario: The completion card appears without movement
    When the quest completes
    Then "quest-complete-card" appears with no slide, bounce or scale
    And no confetti or particle is drawn
    And "scene-state" reports "data-particles" equal to "0"

  Scenario: The stamp is still clearly earned
    Then "stamp-ottawa" is shown in the passport
    And the earning is announced in "#tn-live-region"
    And the stamp is distinguishable from an unearned slot by a shape and a label, not by colour alone

  Scenario: The tracker updates without flashing
    When a step completes
    Then "hud-quest-tracker" changes its text with no flash or shake
```

## TN-QUEST-10 — The tracker and the dialogue at 200 %

```gherkin
Feature: Large text for the quest
  Scenario: The dialogue fits
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When the officer's offer opens
    Then the whole of both dialogue lines is visible, by scrolling inside the dialogue if needed
    And "dialogue-speaker" is fully visible above them
    And "dialogue-accept" and "dialogue-decline" are both fully visible and at least 44 CSS px tall
    And the page does not scroll sideways

  Scenario: The tracker does not cover the playfield
    Given text scaling is 200 %
    And the quest is accepted
    Then "hud-quest-tracker" stays inside the lower third of the canvas
    And its text is not cut off
    And the skater is still visible
```

## TN-QUEST-11 — The whole quest in French

```gherkin
Feature: The quest in French
  Background:
    Given the language is French
    And the Ottawa level is playable

  Scenario: The offer is French
    When I engage the officer
    Then "dialogue-speaker" reads "L'agent"
    And the dialogue shows "Bonjour! Bienvenue à Ottawa. Ottawa est la capitale du Canada."
    And it shows "Patinez sur le canal jusqu'à la Colline du Parlement et trouvez la tour de la Paix. Ensuite, répondez à trois questions."
    And the buttons read "Oui, allons-y" and "Pas maintenant"

  Scenario: The speaker's label and the task agree with each other
    Then "dialogue-speaker" and "quest.step.talk" use the same word for the officer
    And neither contains "(e)", "·e" or a bracketed ending

  Scenario: The tracker is French
    When I accept the quest
    Then "hud-quest-tracker" shows "Mission" and "Trouvez la tour de la Paix"
    When I engage Parliament Hill
    Then it shows "Répondez à 3 questions (0 sur 3)"

  Scenario: Completion is French
    When the quest completes
    Then "quest-complete-card" shows "Mission accomplie!"
    And it shows "Vous avez patiné jusqu'à la Colline du Parlement et répondu à trois questions."
    And it shows "Vous avez obtenu le tampon d'Ottawa."
    And it does not contain "timbre"
    And the buttons read "Voir mon passeport" and "Continuer à jouer"

  Scenario: The declined line is French
    When I tap "Pas maintenant"
    Then the dialogue shows "Pas de problème. Revenez quand vous serez prêt."

  Scenario: Switching language mid-quest keeps the progress
    Given I have accepted the quest in English and engaged Parliament Hill
    When I change the language to French
    Then "hud-quest-tracker" shows "Répondez à 3 questions (0 sur 3)"
    And "dialogue-speaker" reads "L'agent" the next time the officer speaks
    And the quest is still accepted and still on step 3
```

---

## Open questions

- **`OQ-QUEST-1` — how does an `answer` step name its questions?** `QuestStepDocument` declares
  `questionIds`, but the three questions are meant to be *chosen* by the scheduler, so a fixed list and a
  scheduler cannot both be in charge. *Recommendation:* task 1.2 gives the `answer` step a `subject` and a
  `count`, and the scheduler picks; `questionIds` becomes an optional authored pool the scheduler picks
  *from*. Until this is settled, `TN-CARD-02` cannot be implemented as written.
- **`OQ-QUEST-2` — where does a stamp live in the save?** **Answered.**
  `content/schemas/progress.schema.json` records `stampEarnedAt` per level, nullable while the stamp has not
  been earned, with the reason written beside it: `unlockRules.stampsToUnlockNext` counts these, so a stamp
  is recorded rather than derived from a rule that could change under a saved game.
  `TN-PASSPORT-my-passport.md` is the screen that reads it.
- **`OQ-QUEST-3` — can a player abandon an accepted quest?** These scenarios say no: the quest simply waits.
  *Recommendation:* keep it that way in slice 1; there is one quest and nothing to abandon it for. An exam
  can be abandoned, and `TN-ATTEMPT` says why that is a different thing.
- **`OQ-QUEST-4` — is the passport a screen or a panel?** **Answered — a full screen**, specified in
  `TN-PASSPORT-my-passport.md`, reached from the level's menu, from the level select and from the completion
  card. `TN-QUEST-04` still only requires that `stamp-ottawa` becomes visible inside `passport`.
- **`OQ-QUEST-5` — does the player have to skate back to the officer?** These scenarios say no; the quest
  ends at the Hill. It costs the slice a return trip and gains it nothing. If the design wants the return
  trip for the feel of turning around on ice, it is a fourth step and this file changes.
- **`OQ-QUEST-6` — does a dialogue ever have a speaker who is not a character?** Every line in slice 1 comes
  from the officer, so `npc.officer.name` is the only speaker label there is. *Recommendation:* keep the
  speaker name a required input to the dialogue rather than a default — a dialogue that can open without one
  is a dialogue that will one day open with an empty accessible name, which is the defect `TN-QUEST-08`
  exists to catch.
- **`OQ-QUEST-7` — does the answer step keep a per-step record of what it asked?** No, and that is a
  decision rather than an omission: `TN-RESUME` rejected it, and `TN-SAVE-03` has a scenario that fails if
  such a list appears in the saved document. **An exam does need one**, and it has one — in its own
  `examAttempt` document and not in a quest step (`TN-ATTEMPT`, `OQ-EXAM-3`), which is what "a new field with
  its own story" meant.
