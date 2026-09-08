# TN-COPY — Counts, states and the rules every copy table obeys

**Intent.** Every player-facing string reads correctly in English and in French at every value it can take,
and no agent ever has to invent one.

This file exists because a bug found on one screen is a bug on every screen. `study.count` drew
**"1 questions"** and « 1 questions », and the same defect is waiting in every string that carries a number.
Deciding it per screen produces ten answers; deciding it here produces one. The same is true of the word a
switch shows for its state, and of what an agent does when a story forgets a string.

The rules here bind every other file in this directory. Where a rule and a copy table disagree, this file is
the specification until the table is fixed on purpose.

Read `README.md` in this directory first.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-COPY-05` — the same string is what a keyboard player reads and what focus announces |
| Single switch | `TN-COPY-05` — the state word is the only signal a switch user gets |
| Screen reader | `TN-COPY-05` |
| Reduced motion | `TN-COPY-05` — the state word is what replaces the animation `TN-SET-07` removes |
| 200 % text | `TN-COPY-04` — a plural form is longer than a singular one and must still fit |
| Bilingual | Every scenario in this file is written in both languages; `TN-COPY-02` is the French-only rule |
| Failure path | `TN-COPY-03` (a form is missing), `TN-COPY-06` (a string is missing) |

## Player-facing copy

This file owns two strings and one rule about a third.

| Key | EN | FR |
|---|---|---|
| `settings.state.on` | On | Activé |
| `settings.state.off` | Off | Désactivé |

These confirm what task 1.15 wrote. They are the words `TN-SET-07` requires when it says a switch shows
"its state as a word", and they are the only two state words in the game: no switch invents its own pair.

**Why « Activé » and not an agreeing form.** French adjectives agree, and the switch labels do not all share
a gender — « Moins de mouvement » is masculine, « Police plus lisible » is feminine. An agreeing state word
would need six variants and would be wrong the first time a seventh switch was added. The state word is
therefore **a value, not a modifier**: it is drawn as the control's own state, or after a colon in the
label-and-value form `TN-COPY-05` fixes (« Police plus lisible : Activé »), where the invariable masculine
is correct. It is never concatenated into a sentence about the label.

## The counting rule

Written once, obeyed by every table.

1. **Prefer wording with no counted noun.** "Question 1 of 3" / « Question 1 sur 3 » and
   "You got 4 out of 5 right." / « Vous avez 4 bonnes réponses sur 5. » have no plural problem, because
   the noun does not follow the number that changes. Reach for this first. A string that needs no rule
   cannot break under one.
2. **Where a counted noun is unavoidable, the table carries a row per plural category**, suffixed `.one`
   and `.other`, in both languages. `study.count.one` and `study.count.other` are two rows, not one row
   with a trailing "s".
3. **The category is chosen by `Intl.PluralRules` for the active locale — never by `n === 1`.** This is the
   whole point. English and French disagree at zero, and a rule written for English is wrong in French:

   | n | English category | French category | English reads | French reads |
   |---|---|---|---|---|
   | 0 | `other` | `one` | 0 questions | 0 question |
   | 1 | `one` | `one` | 1 question | 1 question |
   | 2 | `other` | `other` | 2 questions | 2 questions |
   | 0.3 | `other` | `one` | 0.3 seconds | 0,3 seconde |

   `Intl` is in the platform. It is not a dependency, it is not a translation table, and it already knows
   that French treats a fractional value below two as singular. Hand-written rules do not.
4. **A number is formatted for its locale**, not concatenated: « 0,3 » with a comma, « 150 % » with a
   non-breaking space. The same `Intl` that chooses the category formats the number.
5. **Authored content is exempt, and says so.** A quest step whose prompt is written by a content author
   ("Answer 3 questions") carries a fixed number the author can see; they write the right form once. The
   rule binds *templates* — strings with a `{{placeholder}}` next to a noun — not authored sentences.
6. **A count string that can be zero needs a zero row or a screen that owns zero.** Study has an empty
   state, so `study.count` is never drawn at 0. Where no screen owns zero, the table adds a `.zero` row
   with wording that is a sentence, not a number: "No questions yet" reads better than "0 questions" in
   both languages.

### Strings this rule changes today

| Was | Becomes |
|---|---|
| `study.count` | `study.count.one`, `study.count.other` — `TN-STUDY` |
| `study.short` | `study.short.one`, `study.short.other` — `TN-STUDY` |
| `settings.holdTime.seconds` | `settings.holdTime.seconds.one`, `.other` — `TN-SET` |

Nothing else in this directory carries a counted noun after a placeholder today. `TN-COPY-04` is the
scenario that keeps that true as tables grow.

---

## TN-COPY-01 — A count reads correctly in English

```gherkin
Feature: Counting in English
  Background:
    Given the language is English

  Scenario: One is singular
    Given exactly one question is ready for me
    When I open Study
    Then the element "study-count" reads "1 question"
    And it does not read "1 questions"

  Scenario: More than one is plural
    Given five questions are ready for me
    When I open Study
    Then the element "study-count" reads "5 questions"

  Scenario: The short-drill sentence agrees with itself
    Given exactly one question is ready for me
    When I open Study
    Then it shows "You have 1 question ready. We will ask it."
    Given three questions are ready for me
    When I open Study
    Then it shows "You have 3 questions ready. We will ask those."

  Scenario: A fraction is plural in English
    Given "Hold time" is set to "Short"
    When "settings-screen" is visible
    Then "setting-hold-time" shows "0.3 seconds"

  Scenario: The rule holds at values no screen offers today
    When the string "settings.holdTime.seconds" is rendered with 1
    Then it reads "1 second"
    When it is rendered with 2
    Then it reads "2 seconds"
```

## TN-COPY-02 — A count reads correctly in French, including where French differs

```gherkin
Feature: Counting in French
  Background:
    Given the language is French

  Scenario: One is singular
    Given exactly one question is ready for me
    When I open Study
    Then the element "study-count" reads "1 question"
    And it does not read "1 questions"

  Scenario: Zero is singular in French and plural in English
    When the string "study.count" is rendered with n equal to 0
    Then the French reading is "0 question"
    And the English reading of the same string with the same n is "0 questions"

  Scenario: More than one is plural
    Given five questions are ready for me
    When I open Study
    Then the element "study-count" reads "5 questions"

  Scenario: A fraction below two is singular in French
    Given "Hold time" is set to "Short"
    When "settings-screen" is visible
    Then "setting-hold-time" shows "0,3 seconde"
    And it does not show "0,3 secondes"
    And the decimal separator is a comma, not a point

  Scenario: The short-drill sentence agrees with itself
    Given exactly one question is ready for me
    When I open Study
    Then it shows "Vous avez 1 question prête. Nous poserons celle-là."
    Given three questions are ready for me
    Then it shows "Vous avez 3 questions prêtes. Nous poserons celles-là."

  Scenario: A percentage is written the French way
    Given text scaling is 150 %
    Then "setting-text-size-value" shows "150 %" with a space before the sign
    And the English reading of the same value is "150%" with no space
```

## TN-COPY-03 — A missing or wrong plural form is a build failure, not a screen (failure path)

```gherkin
Feature: Plural forms cannot go missing quietly
  Scenario: A count key without both forms fails the check
    Given a copy table declares "study.count.other" and not "study.count.one"
    When the content check runs
    Then the build fails, naming the missing form and its language

  Scenario: A form missing in one language only fails the check
    Given "study.count.one" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: A counted noun with no plural forms is refused
    Given a copy table declares a single row whose value places a noun immediately after "{{n}}"
    When the content check runs
    Then the build fails, naming the key and pointing at this file
    And the check reports every such key, not only the first

  Scenario: A category the table does not carry falls back visibly, not silently
    Given the active locale asks for a plural category no row declares
    Then the "other" row is drawn
    And the build has already failed the check for the missing row

  Scenario: Hand-written pluralisation is refused
    Given a string is chosen by comparing a count to 1 rather than by its plural category
    When the unit suite runs
    Then it fails, naming the string
```

## TN-COPY-04 — Plural and state strings still fit at 200 %

```gherkin
Feature: The longer form is the one that has to fit
  Background:
    Given text scaling is 200 %
    And the viewport is 390 x 844

  Scenario: The longest plural form is the one measured
    Given the drill has the largest number of questions it can offer
    When "study-screen" is visible
    Then the whole of "study-count" is visible, not cut off
    And the page does not scroll sideways

  Scenario: The French state word is longer than the English one and still fits
    Given the language is French
    When "settings-screen" is visible
    Then every switch shows "Activé" or "Désactivé" in full
    And no state word is truncated with an ellipsis
    And no state word overlaps its label
    And every control is still at least 44 CSS px wide and tall
```

## TN-COPY-05 — The state word is the signal, not the animation

```gherkin
Feature: A switch says what it is
  Scenario: Every switch shows its state as a word
    When "settings-screen" is visible
    Then each switch shows "On" or "Off" as text
    And no switch conveys its state by position or colour alone

  Scenario: The same two words are used by every switch
    Then no switch shows a state word other than "On" or "Off"
    And in French no switch shows a state word other than "Activé" or "Désactivé"

  Scenario: The word survives reduced motion
    Given reduced motion is on
    When I toggle a switch
    Then the state word changes with no animation
    And the new word is the only thing that had to change for me to know the state

  Scenario: A screen reader hears the label and the state together
    When I turn on "Less movement"
    Then "#tn-live-region" reads "Less movement: On"
    And in French it reads "Moins de mouvement : Activé"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: A switch user hears the state of the highlighted control
    Given single-switch mode is on
    When the highlight lands on a switch
    Then the announcement names the switch and its current state
    And nothing has been toggled by the highlight arriving
```

## TN-COPY-06 — A string with no home is reported, never invented (failure path)

```gherkin
Feature: Nobody authors copy except this directory
  Scenario: A screen needs a string no story table carries
    Given a screen needs a player-facing string
    And no copy table in "docs/stories" carries it
    Then the string is taken from the caller as data, or the key is listed as a gap
    And the gap list is reported with the task that found it
    And a test asserts the gap list matches the keys marked in the source

  Scenario: The gap list is empty when the tables are complete
    Given every string a screen draws is written in a story copy table
    Then the gap list is empty
    And no key in the source is marked as needing copy

  Scenario: A string invented outside this directory is visible
    Given a screen draws a player-facing string that no copy table and no caller supplied
    When the unit suite runs
    Then it fails, naming the key

  Scenario: Both languages or neither
    Given a copy table carries an English string
    Then it carries the French string with the same key
    And a key present in one language and absent in the other fails the check
```

---

## Open questions

- **`OQ-COPY-1` — where does the plural rule live once the locale bundles exist?** Today the tables are in
  one module and the rule can be a function beside them. When `content/locales/*` lands (ADR-0010), a count
  key becomes two keys on disk. *Recommendation:* keep the `.one` / `.other` suffix convention in the bundle
  files rather than nesting an object per key — flat dotted keys are ADR-0010's decision, and a suffix keeps
  that true. The parity check then covers plural forms for free, because they are just more keys.
- **`OQ-COPY-2` — does any string in this game need French's `many` category?** `Intl.PluralRules` for
  French returns `many` for large values such as 1 000 000. Nothing in this game counts that high; the
  largest count is a question bank. *Recommendation:* declare `one` and `other`, fall back to `other`, and
  let `TN-COPY-03` fail the build if a category with no row is ever reached. Do not pre-write a form for a
  number the game cannot produce.
- **`OQ-COPY-3` — should the state words be nouns instead?** « Marche » / « Arrêt » would sidestep the
  agreement argument entirely and is what an appliance says. *Recommendation:* keep « Activé » /
  « Désactivé »: it is what software says in Canadian French, it is what a screen reader user expects from
  every other application, and the label-and-value form already makes the agreement question moot.
