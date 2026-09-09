# TN-SAVE — Closing the tab and coming back

**Intent.** A player closes the tab in the middle of Ottawa, opens the game again — maybe days later, maybe
in the other language — and finds the same game, without ever having made an account.

This is the story most easily written so that nothing can fail. So it says exactly what survives, exactly
what does not, and exactly when a save happens.

Read `README.md` in this directory first.

## What survives a closed tab

Every item below is asserted by a scenario in `TN-SAVE-01`. Nothing else is promised.

| # | Survives | Player sees |
|---|---|---|
| 1 | The character: the chosen option in every slot | The same skater |
| 2 | The language | The game opens in the language last used |
| 3 | Every accessibility setting: auto-move, single switch, reduced motion, high contrast, dyslexia font, text scale, subtitles, volumes | The switches are where they were left |
| 4 | Which levels are unlocked | Ottawa is playable |
| 5 | The quest state: not offered / declined / accepted with the current step / completed | The tracker shows the same step, with the same count in it |
| 6 | The Ottawa stamp, once earned | The stamp is in the passport |
| 7 | For every question ever answered: that it was seen, whether the last answer was right, and when it should come back | Questions I got wrong come back first — including on the way back in (`TN-RESUME-01`) |
| 8 | Which subjects have been started | Study offers the same drill |
| 9 | The level last played | "Continue" on the title screen opens that level (`TN-FLOW-02`) |
| 10 | An exam in progress: the twenty questions drawn in their order, every answer given, and the time left if the timer was on | "Finish your exam" opens the same exam where it was left (`TN-ATTEMPT-02`) |
| 11 | Every finished exam attempt: its answers, whether it was timed, and whether it passed | The passport shows the most recent result (`TN-PASSPORT-06`) |

**Row 9 was added 2026-09-08**, when `TN-FLOW-first-run-and-return.md` specified what a cold load lands on.
"Continue" cannot name a level the save does not remember, and the alternative — reopening whichever level
sorts first — would silently take a player somewhere they had not been. `TN-FLOW` owns what Continue does
and this row is what makes it possible; `OQ-SAVE-7` is the schema gap underneath it. It stores an id and
nothing else: **where the skater was standing is still not saved**, deliberately, and the second table below
is unchanged on that point.

**Rows 10 and 11 were added 2026-09-08** with Exam mode. Row 10 is the one that reverses a previous
recommendation: `OQ-RESUME-3` proposed that an exam in progress should not be resumable at all, and
`TN-ATTEMPT-leaving-and-resuming-an-exam.md` takes the other answer, with the reasoning and the cost written
out in that file. In one line: **a drill loses nothing when the tab dies and an exam loses the whole
result**, and the per-question state a result needs anyway is most of what resuming costs. `OQ-SAVE-8` is
the schema gap underneath both rows.

## What does not survive, on purpose

| Not saved | What happens instead |
|---|---|
| Where the skater was standing, and how fast they were going | The player starts at the level's spawn point, at rest |
| The camera position | Follows from the spawn point |
| An open dialogue, landmark card or question card | Closed; an unanswered question is asked again |
| A drill in progress | No drill is running; the answers already given are kept |
| Which question of an exam was on screen | The exam opens at its first unanswered question (`TN-ATTEMPT-02`) |
| Which questions this sitting has already put on screen | A question that is ready to come back may be asked again after a reload, even if it was asked before the tab closed. Row 7 above is why; `TN-RESUME-02` proves it |
| The single-switch highlight position | Starts at the first item |
| A load error | The game tries again |
| Which screen the player was on | A cold load lands on the title screen, whatever screen the tab closed on (`TN-FLOW-04`) |

**A drill and an exam are on opposite sides of this table on purpose.** The difference is not the number of
questions, it is what is lost: a drill's answers are saved as they are given and a new drill is one tap, while
an exam's answers are worth nothing until the twentieth is reached. `TN-ATTEMPT` carries the table that
compares them.

**Amended 2026-09-08.** The fifth row of that second table is new, and the fourth scenario of `TN-SAVE-01`
was rewritten to match it. As written before, that scenario said the questions already answered are never
asked again after a reload — which contradicted `TN-CARD-04`, the line "You will see this question again
soon." that the game prints on every wrong answer, and `TN-CARD-02`, which puts missed questions ahead of
everything else. It also contradicted row 7 of this file's own survives table and the first scenario of this
file's own `TN-SAVE-01`. `TN-CARD` won and this story was amended, because the promise the player can read
outranks the promise only a test can read. **The whole argument, including the two alternatives that were
rejected and what this decision costs, is in `TN-RESUME-questions-after-a-reload.md` — read it before
changing either side of this seam.** What this story protects at that moment is that *progress is not lost*:
the count does not reset, no answer is forgotten, and one more answer finishes the step.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `save.error.title` | We could not read your saved game. | Nous n'avons pas pu lire votre partie sauvegardée. |
| `save.error.body` | You can download a copy of the old file before you start again. | Vous pouvez télécharger une copie de l'ancien fichier avant de recommencer. |
| `save.error.download` | Download the old file | Télécharger l'ancien fichier |
| `save.error.startOver` | Start again | Recommencer |
| `save.newer.title` | This saved game is from a newer version. | Cette partie sauvegardée provient d'une version plus récente. |
| `save.newer.body` | Update the game, or start again. Your file is not changed. | Mettez le jeu à jour, ou recommencez. Votre fichier n'est pas modifié. |
| `storage.warning` | This browser is not saving your progress. | Ce navigateur n'enregistre pas votre progression. |
| `storage.warning.help` | You can keep playing, but everything will be gone when you close the tab. | Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet. |
| `save.export` | Save to a file | Enregistrer dans un fichier |
| `save.import` | Open a file | Ouvrir un fichier |
| `save.import.error` | We could not read that file. | Nous n'avons pas pu lire ce fichier. |
| `save.import.tooBig` | That file is too big. | Ce fichier est trop volumineux. |
| `save.import.done` | Your game is back. | Votre partie est restaurée. |
| `save.clear` | Delete my progress | Supprimer ma progression |
| `save.clear.confirm` | This cannot be undone. Delete everything? | Cette action est définitive. Tout supprimer? |

---

## TN-SAVE-01 — The same game comes back

```gherkin
Feature: Progress survives a closed tab
  As a player who plays in short sessions
  I want the game to remember where I was
  So that I never have to redo what I already did

  Background:
    Given I made a character with the second option in every slot
    And I set the language to French
    And I turned on reduced motion and set text scaling to 150 %
    And I accepted the Ottawa quest and engaged Parliament Hill
    And I answered one question wrongly and one rightly
    And the event "progress/saved" was emitted after each of those steps

  Scenario: Reopening restores every promised item
    When I close the tab and open the game again
    Then the event "progress/loaded" is emitted
    And the skater uses the second option in every slot
    And the language is French
    And reduced motion is on and text scaling is 150 %
    And Ottawa is playable
    And "hud-quest-tracker" shows "Répondez à 3 questions (2 sur 3)"
    And engaging Parliament Hill offers the question I answered wrongly before the one I answered rightly
    And the creator is not shown

  Scenario: The level I was in is the one Continue offers
    When I close the tab and open the game again
    Then the title screen names Ottawa as the level I last played
    And "title-continue" opens Ottawa
    And it opens at the level's spawn point, as TN-SAVE-02 requires

  Scenario: The stamp survives
    Given I finished the quest and earned the Ottawa stamp
    When I close the tab and open the game again
    Then the element "passport" contains "stamp-ottawa"
    And engaging the officer does not offer the quest again

  Scenario: A declined quest is remembered as declined, not as never offered
    Given I declined the quest
    When I close the tab and open the game again
    Then "hud-quest-tracker" is not shown
    And engaging the officer offers the quest again

  Scenario: Answers survive even when the quest did not finish
    Given I answered two of the three questions
    When I close the tab and open the game again
    And I engage Parliament Hill
    Then "hud-quest-tracker" shows "Répondez à 3 questions (2 sur 3)"
    And one more answer completes the step and the quest
    And both answers I already gave are still recorded, each with whether it was right
    And neither of them is offered as "Nouvelle"

  Scenario: A repeat is not lost progress
    Given I answered question A wrongly, and A is ready to come back
    When I close the tab, open the game again and engage Parliament Hill
    Then A may be the question I am asked, as TN-RESUME-01 requires
    And the count in "hud-quest-tracker" is not reduced by it
    And no answer I already gave is asked for a second time to be counted again

  Scenario: An exam in progress survives, with its answers and its time
    Given I started an exam with the timer on and answered 12 of the 20 questions
    When I close the tab and open the game again
    Then the same twenty questions are in the exam, in the same order
    And my twelve answers are still recorded
    And the time left is what it was, as TN-ATTEMPT-02 requires
    And no exam is running until I choose to carry on

  Scenario: A finished exam survives as a result
    Given I finished an exam with 17 right out of 20
    When I close the tab and open the game again and open the passport
    Then "passport-exam" shows that result, as TN-PASSPORT-06 describes

  Scenario: The save is one document that validates
    Then local storage holds one key for this game
    And its value is JSON that validates against "content/schemas/progress.schema.json"
    And it carries a version number
```

## TN-SAVE-02 — What is deliberately forgotten

```gherkin
Feature: Transient state is not saved
  Scenario: The player restarts at the spawn point
    Given I skated far up the canal and the tab was closed
    When I open the game again and continue
    Then "scene-state" reports "data-player-x" equal to the level's spawn x
    And "data-speed" is "0"

  Scenario: An open card does not come back
    Given a question card was open when the tab closed
    When I open the game again
    Then no question card is shown
    And no answer was recorded for that question
    And that question is asked again when I engage the landmark

  Scenario: A drill in progress does not come back
    Given I was on question 3 of a drill of five when the tab closed
    When I open the game again
    Then no drill is running
    And the two answers I had given are still recorded

  Scenario: An exam in progress does come back, and that is the difference
    Given I was on question 13 of an exam of twenty when the tab closed
    When I open the game again
    Then no exam is running
    And the exam is still there to be finished, as TN-ATTEMPT-03 describes
    And which question was on screen is not what comes back — the first unanswered one is

  Scenario: An open dialogue does not come back
    Given the officer's offer was open when the tab closed
    When I open the game again
    Then no dialogue is shown
    And the quest is in the state it was in before the dialogue opened

  Scenario: The screen I was on does not come back
    Given the tab closed while the level select, Study, the passport, an exam or Settings was open
    When I open the game again
    Then the title screen is shown, as TN-FLOW-04 requires
    And no screen is restored over it

  Scenario: The list of questions already put on screen does not come back
    Given three questions were asked and answered in the last sitting
    When I open the game again
    Then the saved document holds no list of questions asked in a sitting
    And which question is offered next follows only from row 7 of the survives table
    And the exam's own list of drawn questions is not that list: it belongs to one attempt and is named in row 10
```

## TN-SAVE-03 — When a save happens

```gherkin
Feature: Saving at the right moments
  Scenario Outline: Each of these emits a save
    When <thing happens>
    Then the event "progress/saved" is emitted within one second
    And reopening the game after that point shows the change

    Examples:
      | thing happens |
      | I finish the character creator |
      | a level becomes ready |
      | I accept the quest |
      | I decline the quest |
      | a quest step completes |
      | I answer a question, right or wrong |
      | the quest completes and the stamp is earned |
      | I change any setting |
      | I change the language |
      | a study drill finishes or is left |
      | an exam starts and its questions are drawn |
      | I answer or change an answer in an exam |
      | I leave an exam |
      | an exam finishes, by finishing it or by running out of time |
      | I discard an unfinished exam to start a new one |

  Scenario: Skating does not write to storage
    When I skate for thirty seconds without engaging anything
    Then no "progress/saved" event is emitted

  Scenario: A clock ticking does not write to storage
    Given a timed exam is running
    When a minute passes and the clock changes
    Then no "progress/saved" event is emitted for the clock alone
    And the time left is written with the next answer, and when I leave the exam

  Scenario: A save never blocks the game
    When a save is in progress
    Then the skater keeps moving
    And no screen is shown that the player must dismiss

  Scenario: Nothing is written that was not promised
    When I inspect the saved document
    Then it contains no player position, no camera, no open screen and no drill in progress
    And it contains no list of which questions a quest step has already asked
    And it contains no free text typed by the player
    And it contains nothing that identifies the device or the player
    And the only level it names as "last played" is one the player opened themselves
    And the only per-question list in it belongs to an exam attempt
```

## TN-SAVE-04 — A save that cannot be read (failure path)

```gherkin
Feature: A broken, foreign or newer save
  Scenario: The stored value is not valid JSON
    Given the saved value is "{not json"
    When I open the game
    Then the element "save-error" is visible
    And it says "We could not read your saved game."
    And it says "You can download a copy of the old file before you start again."
    And buttons "Download the old file" and "Start again" are offered
    And the broken value is still in storage until I choose

  Scenario: The stored value is JSON but not a save
    Given the saved value is a JSON object that does not validate against the save schema
    Then the same error is shown
    And the game does not start with a half-loaded state

  Scenario: Starting again wipes only after the player says so
    Given the element "save-error" is visible
    When I tap "Start again"
    Then the stored value is replaced with a new game
    And the title screen is shown as it is for a first-time player, as TN-TITLE-04 requires

  Scenario: Keeping the old file
    Given the element "save-error" is visible
    When I tap "Download the old file"
    Then the old value is offered as a file download
    And the error screen is still shown

  Scenario: A save from a newer version is not destroyed
    Given the saved document declares a version higher than this build supports
    When I open the game
    Then it says "This saved game is from a newer version."
    And it says "Update the game, or start again. Your file is not changed."
    And the stored value is unchanged until I choose "Start again"

  Scenario: A save from an older supported version is migrated
    Given the saved document declares an older supported version
    When I open the game
    Then the game opens with that progress
    And the stored value is rewritten at the current version

  Scenario: A save that names a level this build does not have
    Given the saved document names a last-played level with no document in this build
    When I open the game
    Then no error is shown
    And the title screen offers "Choose a level" instead of "Continue", as TN-TITLE-04 requires
    And every other item of progress is intact

  Scenario: A save whose exam names questions this build does not have
    Given the saved document holds an unfinished exam naming a question with no document
    When I open the game
    Then no error is shown
    And the message described in TN-ATTEMPT-05 is what I meet when I open the exam
    And every other item of progress is intact
```

## TN-SAVE-05 — Storage is not available (failure path)

```gherkin
Feature: Playing where nothing can be stored
  Scenario: Private browsing or blocked storage
    Given local storage cannot be read or written
    When I open the game
    Then the game still reaches the title screen and the character creator
    And the element "storage-warning" says "This browser is not saving your progress."
    And it says "You can keep playing, but everything will be gone when you close the tab."
    And the warning is announced in "#tn-live-region"
    And the warning stays visible in the HUD while I play

  Scenario: Storage is full
    Given local storage refuses a write because it is full
    When a save is attempted
    Then the event "progress/save-failed" is emitted
    And the warning is shown with a "Save to a file" button
    And the game keeps running

  Scenario: An exam run where nothing can be stored says so
    Given local storage cannot be written
    When an exam is running
    Then the sentence described in TN-ATTEMPT-05 replaces the promise that the exam is kept
    And leaving the exam asks for a confirmation, because there is something to lose

  Scenario: No save yet is not an error
    Given I have never played
    When I open the game
    Then no error is shown
    And no storage warning is shown
    And the title screen opens with "Play"
```

## TN-SAVE-06 — Taking the save with me

```gherkin
Feature: Export and import
  Scenario: Saving to a file
    Given I have progress in Ottawa
    When I open Settings and tap "Save to a file"
    Then a JSON file is downloaded
    And its contents validate against "content/schemas/progress.schema.json"

  Scenario: Opening a file on another device
    Given a fresh browser with no save
    When I open Settings and tap "Open a file" and choose the exported file
    Then a message says "Your game is back."
    And the character, the settings, the quest step and the stamp are all as they were
    And the event "progress/loaded" is emitted

  Scenario: A file that is not a save is refused
    When I import a file that does not validate against the save schema
    Then a message says "We could not read that file."
    And my existing progress is unchanged

  Scenario: An oversized file is refused before it is parsed
    When I import a file larger than the import size cap
    Then a message says "That file is too big."
    And the file is not parsed
    And my existing progress is unchanged

  Scenario: Importing replaces, and says so first
    Given I already have progress
    When I import a valid save
    Then I am asked to confirm before my current progress is replaced
    And choosing no leaves my progress unchanged

  Scenario: Deleting progress asks first
    When I tap "Delete my progress"
    Then I am asked "This cannot be undone. Delete everything?"
    And choosing no changes nothing
    And choosing yes clears storage and opens the title screen as it is for a first-time player
```

## TN-SAVE-07 — Save and reload from the keyboard

```gherkin
Feature: Keyboard-only persistence
  Scenario: Every persistence control is reachable
    Given I am using a keyboard only
    When I open Settings
    Then "Save to a file", "Open a file" and "Delete my progress" are all reachable with "Tab"
    And each can be activated with "Enter"

  Scenario: The error screen is operable
    Given the element "save-error" is visible
    Then focus is inside it when it opens
    And "Tab" cannot leave it
    And both buttons can be activated with "Enter"

  Scenario: The confirmation is operable
    When I activate "Delete my progress"
    Then focus moves into the confirmation
    And "Escape" cancels it
    And cancelling returns focus to "Delete my progress"
```

## TN-SAVE-08 — Save and reload with one switch

```gherkin
Feature: Single-switch persistence
  Scenario: The error screen can be answered with the switch
    Given single-switch mode is on
    And the element "save-error" is visible
    When I press the switch briefly
    Then the highlight moves between "Download the old file" and "Start again"
    When I hold the switch past the hold-to-choose threshold
    Then the highlighted choice is taken

  Scenario: Single-switch mode itself survives a reload
    Given single-switch mode is on
    When I close the tab and open the game again
    Then single-switch mode is still on
    And the game is operable with the switch from the title screen, without opening Settings

  Scenario: Nothing is confirmed for the player
    Given a confirmation is open
    When I do nothing for two minutes
    Then nothing has been confirmed or cancelled
```

## TN-SAVE-09 — Persistence with a screen reader

```gherkin
Feature: Announcing what happened to the save
  Scenario: Returning is announced
    Given I have progress
    When I open the game
    Then "#tn-live-region" reads a message saying the game carried on where I left it

  Scenario: A failure is announced, not only drawn
    Given the saved value is broken
    When I open the game
    Then "save-error" has role "alertdialog" with an accessible name and description
    And focus moves to it
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The storage warning is perceivable and not a second announcer
    Given local storage is blocked
    Then "storage-warning" is read as static text
    And it has no "aria-live" attribute of its own
    And it is announced once through "#tn-live-region"

  Scenario: Import and delete results are announced
    When an import succeeds, fails, or progress is deleted
    Then the result is announced in "#tn-live-region"
```

## TN-SAVE-10 — Reduced motion and 200 % text

```gherkin
Feature: The persistence screens under accessibility settings
  Scenario: Reduced motion is honoured by the error and confirmation screens
    Given reduced motion is on
    When "save-error" or a confirmation opens
    Then it appears with no slide, fade or scale
    And the setting itself survives the reload that follows

  Scenario: The error screen at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When "save-error" is visible
    Then the whole message is readable, by scrolling inside the dialog if needed
    And both buttons are fully visible and at least 44 CSS px tall
    And the page does not scroll sideways

  Scenario: Text scale survives itself
    Given text scaling is 200 %
    When I close the tab and open the game again
    Then the first screen is already at 200 %
    And it is not briefly drawn at 100 % first
```

## TN-SAVE-11 — Persistence in French

```gherkin
Feature: Saving and reloading in French
  Background:
    Given the language is French

  Scenario: The language is what comes back
    When I close the tab and open the game again
    Then the game opens in French
    And no English screen is shown at any point during the load

  Scenario: The error screen is French
    Given the saved value is broken
    Then it says "Nous n'avons pas pu lire votre partie sauvegardée."
    And it says "Vous pouvez télécharger une copie de l'ancien fichier avant de recommencer."
    And the buttons read "Télécharger l'ancien fichier" and "Recommencer"

  Scenario: The storage warning is French
    Given local storage is blocked
    Then it says "Ce navigateur n'enregistre pas votre progression."
    And it says "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet."

  Scenario: Import and delete messages are French
    Then the controls read "Enregistrer dans un fichier", "Ouvrir un fichier" and "Supprimer ma progression"
    And a failed import says "Nous n'avons pas pu lire ce fichier."
    And an oversized file says "Ce fichier est trop volumineux."
    And the confirmation asks "Cette action est définitive. Tout supprimer?"

  Scenario: A save made in one language opens in the other
    Given I saved in French
    When I open the game and change the language to English
    Then every item in the survives list is unchanged
    And closing and reopening the tab now opens in English
```

---

## Open questions

- **`OQ-SAVE-1` — `ProgressSnapshot` cannot hold what this story promises.** It has no character and no
  stamps (`app/application/ports/progress-repository.ts`). Items 1 and 6 of the survives table have nowhere
  to live. *Recommendation:* task 1.2 adds both to `progress.schema.json` and reconciles the port
  (ADR-0007 order: schema first). This blocks `TN-SAVE-01`.
- **`OQ-SAVE-2` — where is the quest *step* stored?** `LevelProgressDocument` records `completedQuests`
  only, so an accepted-but-unfinished quest cannot be represented, and neither can "declined". Item 5 of the
  survives table depends on this. *Recommendation:* an `activeQuests` entry carrying the quest id, the
  current step index and the per-step counter. **The counter is a count of answers given, and nothing more:
  no list of question ids belongs in it** — see `TN-RESUME` for why that list is deliberately absent, and
  `TN-SAVE-03` for the scenario that fails if one appears.
- **`OQ-SAVE-3` — how big may an imported file be?** SECURITY.md requires a cap; no number is written down.
  *Recommendation:* 1 MB, which is far above any real save and far below anything that can hurt the parser.
  The number belongs in `game.config.json` so the message and the check cannot drift apart.
- **`OQ-SAVE-4` — is a save written on every change, or debounced?** These scenarios say "within one
  second", which allows a debounce and forbids a save on every frame. *Recommendation:* debounce to the end
  of the current interaction, and always flush before the tab is hidden. That last clause matters more now
  that an exam is saved: a timed exam's remaining time is written when the tab is hidden, not when it changes.
- **`OQ-SAVE-5` — what is the storage key?** `TN-SAVE-01` only requires exactly one key for this game.
  *Recommendation:* one key, versioned in its *value* and not in its name, so a migration does not orphan
  the previous key.
- ~~**`OQ-SAVE-6` — after a reload, may a question I already answered be asked again?**~~ **Answered
  2026-09-08 — yes, if it is ready to come back.** The old fourth scenario of `TN-SAVE-01` said no and
  contradicted `TN-CARD-02`, `TN-CARD-04` and this file's own row 7. It was rewritten to assert what it was
  actually protecting. The decision, the two rejected alternatives and the cost are in
  `TN-RESUME-questions-after-a-reload.md`.
- **`OQ-SAVE-7` — the save has nowhere to record row 9.** `content/schemas/progress.schema.json` carries
  `levels[]`, `character`, `settings`, `reviews`, `subjectsStarted` and `exams`, and no field for the level
  last played. *Recommendation:* a nullable `lastPlayedLevelId`, written when a level emits `level/ready` —
  the same shape and the same owner as `OQ-SAVE-1`. It is `OQ-FLOW-4` in
  `TN-FLOW-first-run-and-return.md`, recorded here too because this file's table is what promises it. Until
  it exists, `title-continue` is absent and the route still works through "Choose a level", so nothing in
  this file fails closed on it.
- **`OQ-SAVE-8` — the save cannot record rows 10 and 11 either.** `examAttempt` carries `askedQuestionIds`,
  `correctCount`, `passed` and `timed`, which is enough for neither: **results by subject need a per-question
  outcome**, and **resuming needs the answers so far and the time left**. *Recommendation:* `OQ-EXAM-3`'s —
  an `answers` array in draw order, each item naming the question, its subject, the chosen option or null and
  whether it was correct, replacing `askedQuestionIds` and `correctCount`; plus a nullable
  `remainingSeconds`. `finishedAt: null` already distinguishes an unfinished attempt, and `TN-ATTEMPT-04`
  requires at most one of those at a time — which is a schema constraint worth writing down rather than a
  convention. Routed to the architect; `content/` is not this directory's to edit.
