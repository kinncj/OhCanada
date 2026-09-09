# TN-WAIT — Every level says what it is opening, and names itself when it cannot

**Intent.** Whichever level a player opens, the waiting screen names *that* level's work and the error card
names *that* level, in their language — so no player is ever told about a place they are not going to.

Read `README.md` in this directory first. `TN-COPY-strings-and-counts.md` §Waiting copy owns the **rule**
every waiting message obeys — name the work, claim no progress the game cannot measure, no ellipsis, offer a
way out rather than a bigger number — and this file does not restate it. `TN-LEVEL-02` owns the behaviour of
the failure and stall screens on a level. What this file owns is **which string each level draws**, and the
three words on the error card that are the same on every level.

**Amended 2026-09-09 — two more levels shipped, so two more pairs exist.** `content/levels/winnipeg.json`
and `content/levels/prairie-rail.json` are built levels, listed in `content/game.config.json`, and each owns
its own waiting sentence and error title in its own story file — `TN-LEVEL-winnipeg.md` and
`TN-LEVEL-prairie-rail.md`. The Prairies is the row that proves the **English** cannot be templated either;
see the note under the directory below.

## The defect this file exists to make impossible

A player opening the game today lands on Halifax and reads *"Getting the canal ready."* and, if the load
fails, *"We could not load Ottawa."* Neither sentence is about the level they are in. There was one
`level.loading` row and one `level.error.title` row in the whole game, both written for the only level that
had a story, and the second level to ship inherited them silently.

`OQ-LEVEL-9` asked the question and recommended the answer: **keep the wording with the level that waits.**
This file is that answer applied to every built level, and it fixes the key shape so the same thing cannot
happen a third time.

## The key shape, and why the strings are authored rather than composed

**One row per level, keyed on the level's id:**

| Key | Owned by | Drawn by |
|---|---|---|
| `level.<id>.loading` | that level's story file | `level-loading` |
| `level.<id>.error.title` | that level's story file | `level-error`, as its heading and its accessible name |

`level.loading` and `level.error.title` — the unqualified keys — **do not exist**. A key with no level in it
is a key two levels will eventually disagree about, which is exactly what happened. Ottawa's two rows are
`level.ottawa.loading` and `level.ottawa.error.title` and are written in `TN-LEVEL-ottawa.md`; the wording is
unchanged.

**The error title is written out per level and never assembled from a template.** "We could not load
{{level}}." looks like it would save five rows. It does not survive French: the place name takes no article
in « Nous n'avons pas pu charger Halifax. » and takes one in « Nous n'avons pas pu charger la Ville de
Québec. » and a plural one in « Nous n'avons pas pu charger les Prairies. » This is the same reason
`title.lastPlayed` is a label rather than a sentence (`TN-TITLE-title-screen.md`): **French does not use one
preposition, or one article, for all ten places.**

**And since the Prairies shipped, the English does not either.** That level's title is "The Prairies", with
a capital T, because that is how the map names it; dropped into the template it produces "We could not load
The Prairies.", which is not English mid-sentence. Until 2026-09-09 this rule was defended entirely with
French examples, and a reader could have concluded it was a French problem. It is not: it is a template
problem, and English happened to be safe for the first five levels (`TN-PRAIRIE-02`).

The same argument settles the loading sentence, from the other end: it is not a place name at all. It names
**the work**, in common nouns — the canal, the harbour, the slope, the streets, the riverbank, the track —
so it says what the player is waiting for rather than repeating a title they can already see.

## What a loading sentence may not contain

Three rules on top of `TN-COPY-07`, because a loading screen is where they are most likely to be broken:

1. **No name from `TN-NAMES-naming-real-places.md`'s list.** Pier 21, the CN Tower, the Château Frontenac and
   the Canadian Museum for Human Rights are named in a point-of-interest card's body — and, since
   `TN-DIALOGUE-what-a-quest-giver-says.md`, in the words a quest's giver says about going there — and
   **nowhere else**. `TN-NAMES-01` names a loading message among the screens they may not appear on. A
   waiting screen is not a card body and it is not a character speaking: it is read by somebody who has not
   arrived yet, it carries no source, and a trade name there is an advertisement with a spinner behind it.
2. **No real place the level does not draw.** The sentence describes the ground under the player's feet in
   the level being loaded, and nothing else.
3. **No territorial statement, and no paraphrase of one.** Halifax is in Mi'kma'ki, Toronto is on Treaty 13
   land, Winnipeg's level is set at The Forks on Treaty No. 1 territory and in the homeland of the Red River
   Métis, and the Prairies level is on Treaty No. 4 land; every one of those level documents carries a
   sourced statement, and `docs/content-review.md` §10.2 fixes where a player reads them — the **"About this
   place"** panel, always available, never blocking, sourced, never "a splash card". A loading screen is a
   splash card the player taps past to reach gameplay, which §10.2 names as the one shape this must not take,
   and a 40-character paraphrase of a cited statement is an unsourced claim about a nation. The two are kept
   apart on purpose: the panel states the fact, the loading screen says what is being prepared, and neither
   borrows the other's words.

## Player-facing copy

The three rows every level's error card shares. They name no place, state no fact and never change between
levels, so they are written once here and each level story names the key.

| Key | EN | FR |
|---|---|---|
| `level.error.body` | Check your connection and try again. | Vérifiez votre connexion et réessayez. |
| `level.error.retry` | Try again | Réessayer |
| `level.error.back` | Go back | Retour |

These are the words `TN-LEVEL-02` already requires and `app/ui/level-screens.ts` already draws; they moved
here from `TN-LEVEL-ottawa.md` unchanged, because they were never Ottawa's. `level-loading` draws
`level.error.back` too, for the escape route `TN-LEVEL-02` offers on a stalled load — one string, one
meaning, both screens.

## The six built levels and their two rows each

Written in the level's own story file, listed here so one page answers "what does each level say":

| Level | `level.<id>.loading` EN | `level.<id>.error.title` EN | Story file |
|---|---|---|---|
| `halifax` | Getting the harbour ready. | We could not load Halifax. | `TN-LEVEL-halifax.md` |
| `quebec-city` | Getting the snowy slope ready. | We could not load Québec City. | `TN-LEVEL-quebec-city.md` |
| `ottawa` | Getting the canal ready. | We could not load Ottawa. | `TN-LEVEL-ottawa.md` |
| `toronto` | Getting the city streets ready. | We could not load Toronto. | `TN-LEVEL-toronto.md` |
| `winnipeg` | Getting the riverbank ready. | We could not load Winnipeg. | `TN-LEVEL-winnipeg.md` |
| `prairie-rail` | Getting the railway track ready. | We could not load the Prairies. | `TN-LEVEL-prairie-rail.md` |

French is in each file beside its English, and this table is a directory rather than a second copy of the
strings: **the level story is where an implementer transcribes from.**

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-WAIT-04` — both screens are dialogs, and the escape route is reachable with Tab and Enter |
| Single switch | `TN-WAIT-04` — short press highlights, long press chooses, nothing expires |
| Screen reader | `TN-WAIT-05` — the waiting sentence once, the failure once, the level named in the dialog's accessible name |
| Reduced motion | `TN-WAIT-05` — the sentence is the signal, not a spinner |
| 200 % text | `TN-WAIT-04` |
| Bilingual | `TN-WAIT-06` |
| Failure path | `TN-WAIT-02` (the level does not load), `TN-WAIT-03` (a level with no rows) |

---

## TN-WAIT-01 — A level waits in its own words

```gherkin
Feature: The waiting screen belongs to the level being loaded
  As a player opening a level
  I want to be told what this level is getting ready
  So that the game is describing the state it is actually in

  Scenario Outline: Each built level shows its own sentence
    Given the <level> level's assets are still downloading
    Then the element "level-loading" is visible
    And it reads "<sentence>"
    And it is text, not only a spinner
    And the element "playable" is not present yet

    Examples:
      | level        | sentence                         |
      | Halifax      | Getting the harbour ready.       |
      | Québec City  | Getting the snowy slope ready.   |
      | Ottawa       | Getting the canal ready.         |
      | Toronto      | Getting the city streets ready.  |
      | Winnipeg     | Getting the riverbank ready.     |
      | The Prairies | Getting the railway track ready. |

  Scenario: One level's sentence is never shown while another loads
    Given I leave one level and open another
    Then "level-loading" reads the sentence belonging to the level named by "level/chosen"
    And no sentence naming a place absent from the level being loaded is drawn

  Scenario: The sentence does not change while the load runs
    Given "level-loading" is visible
    When the load continues past the time-to-play budget in "game.config.json"
    Then it still reads the same sentence
    And the escape route appears beside it, not instead of it

  Scenario: The waiting screen goes when the level is playable
    When the event "level/ready" is emitted
    Then the element "level-loading" is not present in the accessibility tree
    And it is not merely hidden behind a style rule

  Scenario: No sentence claims progress the game cannot measure
    Given "level-loading" is visible for any built level
    Then its text contains no percentage
    And it contains no fraction and no step count such as "2 of 4"
    And it contains no "…" and no "..."
    And no progress bar carrying a value is drawn
    And nothing on it counts down
```

## TN-WAIT-02 — A level fails in its own name (failure path)

```gherkin
Feature: The error card names the level that failed
  Scenario Outline: Each built level names itself
    Given requests for the <level> assets fail
    When I open the <level> level
    Then the event "level/failed" is emitted for "<id>"
    And the element "level-error" is visible
    And it says "<title>" and "Check your connection and try again."
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present
    And the element "level-loading" is gone

    Examples:
      | level        | id           | title                            |
      | Halifax      | halifax      | We could not load Halifax.       |
      | Québec City  | quebec-city  | We could not load Québec City.   |
      | Ottawa       | ottawa       | We could not load Ottawa.        |
      | Toronto      | toronto      | We could not load Toronto.       |
      | Winnipeg     | winnipeg     | We could not load Winnipeg.      |
      | The Prairies | prairie-rail | We could not load the Prairies.  |

  Scenario: The title is the dialog's accessible name
    Given "level-error" is visible
    Then its accessible name is the title above for the level that failed
    And it is not "Error", "Something went wrong" or empty

  Scenario: A failure never names another level
    Given the Halifax level fails
    Then no string on "level-error" names Ottawa, Québec City, Toronto, Winnipeg or the Prairies

  Scenario: No title is the level's id
    Given any built level fails
    Then the title names the level the way the map names it
    And it never contains "prairie-rail" or any other id

  Scenario: Trying again keeps the same words
    Given "level-error" is visible for a level
    When I tap "Try again" and the load fails again
    Then the card shows the same title for the same level
```

## TN-WAIT-03 — A level with no rows of its own is a build failure (failure path)

```gherkin
Feature: A shipped level cannot inherit another level's words
  Scenario: A level document with no waiting sentence fails the content check
    Given a document exists at "content/levels/<id>.json"
    And no "level.<id>.loading" row exists in English and in French
    When the content check runs
    Then the build fails, naming the level and the missing key

  Scenario: A level document with no error title fails the same check
    Given no "level.<id>.error.title" row exists for a shipped level
    When the content check runs
    Then the build fails, naming the level and the missing key

  Scenario: An unqualified key is refused
    Given a copy table declares "level.loading" or "level.error.title" with no level in the key
    When the content check runs
    Then the build fails, naming the key and pointing at this file

  Scenario: No screen may be mounted without the sentence
    Given a caller mounts the waiting screen
    Then the sentence is a required value, not a defaulted one
    And a waiting screen with no sentence cannot be constructed

  Scenario: The check counts levels, not rows
    Given the number of documents under "content/levels" is six
    Then six "level.<id>.loading" rows and six "level.<id>.error.title" rows exist in each language
    And a seventh level document with no rows fails the check on the day it is added

  Scenario: The check is proven by failing fixtures
    Then a fixture exists for each scenario above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite
```

## TN-WAIT-04 — Waiting and failing with a keyboard, one switch, and big text

```gherkin
Feature: Both screens are reachable by everybody
  Scenario: The stalled load can be left with a keyboard
    Given a level has not become playable
    And the load has not finished after the time-to-play budget has passed twice
    And I am using a keyboard only
    Then a "Go back" button is visible and focusable
    And it is reachable with "Tab" and activates with "Enter"
    And the waiting sentence is unchanged

  Scenario: The stalled load can be left with one switch
    Given single-switch mode is on
    And the escape route is visible
    Then it is reached with a short press and chosen with a long press
    And nothing expires while I decide
    And it is at least 44 CSS px wide and tall

  Scenario: The error card's two ways on are reachable both ways
    Given "level-error" is visible
    And I am using a keyboard only
    Then "Try again" and "Go back" are both reachable with "Tab" and activate with "Enter"
    And focus is inside the card when it opens and cannot leave it while it is open
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press

  Scenario: Both screens fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    When "level-loading" is visible
    Then the whole of its sentence is visible, not cut off
    And the page does not scroll sideways
    When "level-error" is visible
    Then both of its sentences are readable, by scrolling if needed
    And "Try again" and "Go back" are fully visible and at least 44 CSS px tall
```

## TN-WAIT-05 — Waiting and failing with a screen reader, and with motion off

```gherkin
Feature: The wait and the failure are spoken, once
  Scenario: The waiting sentence is announced once
    When a level starts loading
    Then "#tn-live-region" reads that level's waiting sentence
    And it is not repeated while the load continues
    And "level-loading" has no "aria-live" attribute of its own
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The failure is announced once and names the level
    When the event "level/failed" is emitted
    Then "#tn-live-region" reads a message naming the level that failed
    And it is not repeated when "Try again" is pressed and fails again

  Scenario: The sentence is the signal, not the animation
    Given reduced motion is on
    And a level's assets are still downloading
    Then "level-loading" reads that level's sentence
    And nothing on it spins, pulses, slides or flashes
    And the message is what tells me the game is working
```

## TN-WAIT-06 — Both languages wait and fail the same way

```gherkin
Feature: Every level's two strings exist in English and in French
  Scenario Outline: The French sentence is the one the level's story carries
    Given the language is French
    And the <level> level's assets are still downloading
    Then "level-loading" reads "<sentence>"
    And it contains no percentage, no step count and no ellipsis
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

    Examples:
      | level        | sentence                          |
      | Halifax      | Préparation du port.              |
      | Québec City  | Préparation de la pente enneigée. |
      | Ottawa       | Préparation du canal.             |
      | Toronto      | Préparation des rues de la ville. |
      | Winnipeg     | Préparation de la rive.           |
      | The Prairies | Préparation de la voie ferrée.    |

  Scenario Outline: The French failure names the level the French way
    Given the language is French
    And requests for the <level> assets fail
    Then "level-error" says "<title>" and "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

    Examples:
      | level        | title                                           |
      | Halifax      | Nous n'avons pas pu charger Halifax.            |
      | Québec City  | Nous n'avons pas pu charger la Ville de Québec. |
      | Ottawa       | Nous n'avons pas pu charger Ottawa.             |
      | Toronto      | Nous n'avons pas pu charger Toronto.            |
      | Winnipeg     | Nous n'avons pas pu charger Winnipeg.           |
      | The Prairies | Nous n'avons pas pu charger les Prairies.       |

  Scenario: Four articles, six levels, and no template
    Then the French error titles use no article, "la" and "les" across the six built levels
    And no French title is assembled from a template with the level's name dropped into it
    And the English title of the Prairies is written out too, with a lower-case article

  Scenario: The two languages describe the same level
    Then every "level.<id>.loading" and "level.<id>.error.title" key has a value in "en" and in "fr"
    And no sentence in either language contains "(e)", "·e" or a bracketed ending

  Scenario: No waiting sentence names a place the level does not draw
    Then no waiting sentence in either language contains a name from TN-NAMES-naming-real-places.md's list
    And no waiting sentence states a territorial fact or paraphrases one
    And the territorial statement is drawn only by "about-this-place"
```

---

## Open questions

- **`OQ-WAIT-1` — the waiting screen has no caller.** `createLevelLoading` is constructed by the a11y
  harness and the unit suite and by nothing under `app/bootstrap`, so no player has yet seen *any* waiting
  sentence: a level opens straight into a canvas or into the error card. That makes the wrong sentence
  invisible today and makes `TN-LEVEL-01`'s "the loading screen shows text, not only a spinner" unmet on the
  shipped page. *Recommendation:* wire it in the same change that transcribes these rows, so the first level
  that draws a sentence draws its own. Routed to the engine and UI agents; `app/` is not this directory's to
  edit. Until it is wired, `TN-WAIT-01` fails, which is the correct state for a scenario describing something
  the game does not do.
- **`OQ-WAIT-2` — where do these rows live once `content/levels/*.json` can carry them?** ADR-0010 says a
  level's own text is inline `localizedText` on the level document, and `level.schema.json` has no field for
  a waiting sentence or an error title today. *Recommendation:* add two optional-in-schema, required-in-gate
  fields when a schema change is next opened, keep the key spelling `level.<id>.loading` and
  `level.<id>.error.title` for whatever draws them, and let `TN-WAIT-03` keep failing the build for a level
  that carries neither. Routed to the architect; `content/` is not this directory's to edit. **Two schema
  changes are now queued for the same file family** — this one and
  `TN-DIALOGUE-what-a-quest-giver-says.md`'s four quest fields — and they are cheaper opened together.
- **`OQ-WAIT-3` — is "the harbour" too close to naming Halifax Harbour?** The sentence uses a common noun
  with a definite article, exactly as Ottawa's "the canal" does for the Rideau Canal, and neither is on
  `TN-NAMES`'s list. *Recommendation:* accept both, and treat the pattern as the rule for the levels still to
  come — describe the ground, do not name it. Winnipeg's "the riverbank" and the Prairies' "the railway
  track" are the third and fourth applications of it (`OQ-WINNIPEG-4`). If a reviewer wants the stricter
  line, every sentence loses the article ("Getting the level ready.") and every level says the same
  uninformative thing, which is what `OQ-LEVEL-9` already rejected.
