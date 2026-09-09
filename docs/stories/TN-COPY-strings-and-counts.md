# TN-COPY — Counts, states and the rules every copy table obeys

**Intent.** Every player-facing string reads correctly in English and in French at every value it can take,
and no agent ever has to invent one.

This file exists because a bug found on one screen is a bug on every screen. `study.count` drew
**"1 questions"** and « 1 questions », and the same defect is waiting in every string that carries a number.
Deciding it per screen produces ten answers; deciding it here produces one. The same is true of the word a
switch shows for its state, of what a screen says while the player waits, and of what an agent does when a
story forgets a string.

The rules here bind every other file in this directory. Where a rule and a copy table disagree, this file is
the specification until the table is fixed on purpose.

Read `README.md` in this directory first.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-COPY-05` — the same string is what a keyboard player reads and what focus announces |
| Single switch | `TN-COPY-05` — the state word is the only signal a switch user gets |
| Screen reader | `TN-COPY-05`; `TN-COPY-07` for the waiting message |
| Reduced motion | `TN-COPY-05` — the state word is what replaces the animation `TN-SET-07` removes; `TN-COPY-07` — the waiting *text* is what replaces the spinner |
| 200 % text | `TN-COPY-04` — a plural form is longer than a singular one and must still fit |
| Bilingual | Every scenario in this file is written in both languages; `TN-COPY-02` is the French-only rule |
| Failure path | `TN-COPY-03` (a form is missing), `TN-COPY-06` (a string is missing), `TN-COPY-07` (a wait that never ends) |

## Player-facing copy

This file owns two strings and rules about everybody else's.

| Key | EN | FR |
|---|---|---|
| `settings.state.on` | On | Activé |
| `settings.state.off` | Off | Désactivé |

These confirm what task 1.15 wrote. They are the words `TN-SET-07` requires when it says a switch shows
"its state as a word", and they are the only two state words in the game: no switch invents its own pair.
The exam's timer switch (`TN-TIMER-01`) uses these two and no others.

**Why « Activé » and not an agreeing form.** French adjectives agree, and the switch labels do not all share
a gender — « Moins de mouvement » is masculine, « Police plus lisible » is feminine. An agreeing state word
would need six variants and would be wrong the first time a seventh switch was added. The state word is
therefore **a value, not a modifier**: it is drawn as the control's own state, or after a colon in the
label-and-value form `TN-COPY-05` fixes (« Police plus lisible : Activé »), where the invariable masculine
is correct. It is never concatenated into a sentence about the label.

## The counting rule

Written once, obeyed by every table.

1. **Prefer wording where the number is followed by a preposition, not by a noun.** "Question 1 of 3" /
   « Question 1 sur 3 » (`card.progress`, `TN-CARD`) has no plural problem in either language, because the
   word after the number never has to change. Reach for this first: a string that needs no rule cannot break
   under one. Where the counted thing has to be named, name it *before* the number — "Right answers: 1 out
   of 5" / « Bonnes réponses : 1 sur 5 » — so the noun is a label and not an agreement.
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
4. **The category is chosen by the number the noun follows**, not by some other number in the same string.
   In « {{correct}} bonnes réponses sur {{total}} » the noun follows `correct`, so `total` is irrelevant to
   the form; a string that picks its form from the wrong placeholder is wrong at exactly the values nobody
   tests.
5. **A number is formatted for its locale**, not concatenated: « 0,3 » with a comma, « 150 % » with a
   non-breaking space. The same `Intl` that chooses the category formats the number.
6. **Authored content is exempt, and says so.** A quest step whose prompt is written by a content author
   ("Answer 3 questions") carries a fixed number the author can see; they write the right form once. The
   rule binds *templates* — strings with a `{{placeholder}}` next to a noun — not authored sentences.
7. **A count string that can be zero needs a zero row or a screen that owns zero.** Study has an empty
   state, so `study.count` is never drawn at 0. Where no screen owns zero, the table adds a `.zero` row
   with wording that is a sentence, not a number: "No questions yet" reads better than "0 questions" in
   both languages.
8. **The rule is checked per language, not per key.** A template is safe only if it is safe in every
   language it is written in. See the worked example below, and `TN-COPY-03`.
9. **One counted noun per template. A string that needs two is two strings.** A plural category is chosen
   once per string, so a template with two numbers and a noun behind each cannot be right at every pair of
   values in both languages — whichever number the form is chosen from, the other noun is wrong somewhere.
   Split it. See the second worked example below.

### The worked example, because this rule was wrong about its own example

Until 2026-09-08 rule 1 above cited `study.summary.score` — "You got 4 out of 5 right." /
« Vous avez 4 bonnes réponses sur 5. » — as a pair with no plural problem. **The English was safe and the
French was not.** « bonnes réponses » follows `{{correct}}`, so at one right answer the French drew:

> « Vous avez 1 bonnes réponses sur 5 »

while the English drew the perfectly correct "You got 1 out of 5 right." One key, two languages, one defect,
and reading the English told you nothing. That is why this rule is written about **templates and not about
screens**, and why rule 8 exists.

The French is now « Bonnes réponses : {{correct}} sur {{total}} » — the noun moved in front of the number and
the number is followed by « sur », which is rule 1's recommended form. `TN-STUDY-study-mode.md` owns the
string and explains why the French is a label where the English is a sentence.

`card.progress` was checked at the same time and is **not** affected: « Question {{n}} sur {{total}} » already
puts a preposition after the number. A rule that flags everything is not a rule, and this one discriminates.

### The second worked example — where rule 9 came from, 2026-09-08

Exam mode wanted one sentence on its start screen:

> "The exam has {{count}} questions. You need {{pass}} right to pass." /
> « L'examen compte {{count}} questions. Il faut {{pass}} bonnes réponses pour réussir. »

Two numbers, and a counted noun behind each. Rule 4 says the form is chosen by the number the noun follows —
but there are two nouns following two different numbers, and a template gets one category. Chosen from
`count`, a build with a pass mark of one draws « il faut 1 bonnes réponses »; chosen from `pass`, an exam of
one question draws « L'examen compte 1 questions ». Neither is a rendering bug: the string is the bug.

It is now two strings. `exam.rules.length` carries the noun and its `.one` and `.other` rows in both
languages; `exam.rules.pass` — "You need {{pass}} out of {{count}} to pass." / « Il faut {{pass}} sur
{{count}} pour réussir. » — follows both numbers with a preposition and needs no rows at all. `TN-EXAM`
owns both and says why beside them.

### Strings this rule changes today

| Was | Becomes |
|---|---|
| `study.count` | `study.count.one`, `study.count.other` — `TN-STUDY` |
| `study.short` | `study.short.one`, `study.short.other` — `TN-STUDY` |
| `settings.holdTime.seconds` | `settings.holdTime.seconds.one`, `.other` — `TN-SET` |
| `study.summary.score` (FR only) | reworded to « Bonnes réponses : {{correct}} sur {{total}} » — `TN-STUDY`. Reworded rather than split, because rule 1 comes before rule 2 and a string with no counted noun needs no plural rows at all. |
| one `exam.rules` sentence | `exam.rules.length.one`, `.other` and `exam.rules.pass` — `TN-EXAM`, under rule 9 |

**Where a counted noun does follow a placeholder, it carries both rows in both languages, and that is the
rule working rather than the rule being broken.** Five strings are in that position today, all in Exam mode,
because no rewording removes the noun without making the sentence worse: `exam.timer.limit`,
`exam.timer.left`, `exam.unanswered` (`TN-EXAM`), `exam.result.unanswered` (`TN-RESULT`) and
`map.locked.stamps` (`TN-MAP`). Every other count in this directory takes rule 1's shape. `TN-COPY-03` and
`TN-COPY-04` are what keep both halves true as the tables grow.

## Waiting copy

A screen that is waiting says what it is doing. It does not say how far along it is unless the game actually
knows, and this game usually does not: a browser download has no honest percentage, and a level load is a
list of steps whose sizes are not comparable.

1. **A waiting message names the work.** "Getting the canal ready." / « Préparation du canal. » — a
   sentence about what is being prepared, owned by the screen that waits (`level.loading` belongs to
   `TN-LEVEL-ottawa.md`).
2. **No figure the game cannot measure.** No percentage, no fraction, no "step 2 of 4", and no progress bar
   carrying a value. A bar that stops moving reads as a crash, and a percentage that jumps from 12 to 100
   teaches the player not to believe the next one.
3. **No ellipsis.** "Loading…" is three dots standing in for a sentence nobody wrote, it is read aloud
   inconsistently by screen readers, and it is what a stalled screen looks like.
4. **The honest answer to a long wait is a way out**, not a bigger number: after the budget in
   `game.config.json` has passed twice, a control to leave is visible and focusable (`TN-LEVEL-02`).
   Nothing counts down; a load budget is not a player timer (`README.md`).
5. **The text is the signal, not the animation.** Under reduced motion the message is still there and
   nothing spins.

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

  Scenario: The score line has no counted noun to get wrong
    When the string "study.summary.score" is rendered with 1 correct out of 5
    Then it reads "You got 1 out of 5 right."
    When it is rendered with 4 correct out of 5
    Then it reads "You got 4 out of 5 right."
    And the only difference between the two readings is the number

  Scenario: The exam's counts read correctly at one
    When the string "exam.timer.left" is rendered with 1
    Then it reads "1 minute left"
    When the string "exam.unanswered" is rendered with 1
    Then it reads "You have not answered 1 question."
    And neither reads "1 minutes" or "1 questions"
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

  Scenario: A template that is safe in English can still be wrong in French
    When the string "study.summary.score" is rendered with 1 correct out of 5
    Then the French reading is "Bonnes réponses : 1 sur 5"
    And it does not read "1 bonnes réponses"
    And the English reading of the same string with the same numbers is "You got 1 out of 5 right."
    And neither reading changes any word except the number when rendered with 4 correct out of 5

  Scenario: The exam's counted nouns agree in French
    When the string "exam.timer.left" is rendered with 1
    Then the French reading is "Il reste 1 minute"
    And it does not read "Il reste 1 minutes"
    When it is rendered with 30
    Then it reads "Il reste 30 minutes"
    When the string "exam.result.unanswered" is rendered with 1
    Then it reads "Vous n'avez pas répondu à 1 question."
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

  Scenario: The check reads every language of a key, not only the English one
    Given a key whose English value places no noun after its placeholder
    And whose French value places a noun immediately after the same placeholder
    When the content check runs
    Then the build fails, naming the key and the French value
    And the report says which language is at fault

  Scenario: A recorded offender is not an excused one
    Given a key that places a noun immediately after a placeholder
    Then the check reports it, whether or not it has been reported before
    And where a list of already-reported keys exists, it is asserted by equality
    And fixing a key on that list fails the assertion until the list is updated
    And adding a new offender fails it too

  Scenario: A category the table does not carry falls back visibly, not silently
    Given the active locale asks for a plural category no row declares
    Then the "other" row is drawn
    And the build has already failed the check for the missing row

  Scenario: Hand-written pluralisation is refused
    Given a string is chosen by comparing a count to 1 rather than by its plural category
    When the unit suite runs
    Then it fails, naming the string

  Scenario: A form chosen from the wrong number is refused
    Given a string carries two placeholders and a noun after the first
    And its form is chosen from the second placeholder
    When the unit suite runs
    Then it fails, naming the string

  Scenario: A template with two counted nouns is refused, whichever number it chooses from
    Given a template carries two placeholders with a noun after each
    When the content check runs
    Then the build fails, naming the key and pointing at rule 9
    And the message says the string has to be split, not that a form is missing
    And it fails in both languages independently
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
    And that includes the exam's timer switch, wherever it is drawn

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

  Scenario: A reported gap ends in a copy table, not in a caller forever
    Given a key was reported as a gap and a story copy table now carries it
    Then the screen reads the wording from that table
    And no screen can be mounted without a value for it
    And the key is no longer listed as a gap

  Scenario: A string invented outside this directory is visible
    Given a screen draws a player-facing string that no copy table and no caller supplied
    When the unit suite runs
    Then it fails, naming the key

  Scenario: Both languages or neither
    Given a copy table carries an English string
    Then it carries the French string with the same key
    And a key present in one language and absent in the other fails the check
```

## TN-COPY-07 — Waiting says what is happening, not how far along it is

```gherkin
Feature: Honest waiting copy
  Scenario: A waiting message names the work
    Given a screen is waiting for something to load
    Then its message is a sentence naming what is being prepared
    And it is text, not only a spinner

  Scenario: No figure the game cannot measure
    Given a waiting message is visible
    Then it contains no percentage
    And it contains no fraction and no step count such as "2 of 4"
    And no progress bar carrying a value is drawn
    And it contains no "…" and no "..."

  Scenario: A figure may be drawn only where one is really known
    Given a wait whose completed and total parts are both known
    Then a figure may be drawn, and it names what it counts
    And where they are not both known, nothing that looks like a measurement is drawn

  Scenario: The wording does not change while the wait runs
    Given a waiting message is visible
    Then the same sentence is shown for the whole wait
    And any control that appears later is added beside it
    And nothing replaces it with a different claim about progress

  Scenario: A wait that is taking too long offers a way out, not a bigger number
    Given the wait has passed the budget in "game.config.json" twice
    Then a control to leave is visible and focusable
    And nothing on the screen counts down

  Scenario: The message survives reduced motion
    Given reduced motion is on
    When a screen is waiting
    Then the message is still shown as text
    And nothing spins, pulses or slides

  Scenario: The message is announced once
    When the wait begins
    Then "#tn-live-region" reads the waiting message once
    And it is not repeated while the wait continues

  Scenario: Both languages wait the same way
    Given the language is French
    Then the waiting message is French
    And it contains no percentage, no step count and no ellipsis
    And the announcing element carries "lang" equal to "fr"
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
- **`OQ-COPY-4` — is a label acceptable where the English is a sentence?** The fix to `study.summary.score`
  makes the French « Bonnes réponses : 4 sur 5 » where the English stays "You got 4 out of 5 right." The
  meaning is the same and the register is not. *Recommendation:* accept it, and put it in front of a French
  reviewer with the first French pass. If they prefer a sentence, the sentence keeps the number in front of a
  preposition (« Vous avez bien répondu à 4 sur 5. ») or the key splits into `.one` and `.other` under rule
  2. What it may not do is go back to a noun straight after the placeholder.
- **`OQ-COPY-5` — how does the check find a noun?** `TN-COPY-03` refuses "a noun immediately after a
  placeholder", and nothing in this project parses French for parts of speech. *Recommendation:* the check
  is a lint, not a linguist — flag any template where a placeholder is followed by a space and a word, and
  let the table answer by using the recommended form **or by carrying both plural rows**. A blunt check with
  no escape hatch is worth more than a clever one with one, because the escape hatch is where the next
  « 1 bonnes réponses » will live. The exam's five counted nouns are the first keys to answer it the second
  way, and they are listed above so the check's expected set is written down rather than discovered.
- **`OQ-COPY-6` — can rule 9 be checked without understanding the sentence?** A template with two
  placeholders and a word after each is mechanically detectable, and that is what `TN-COPY-03`'s last
  scenario asks for. It will also flag a harmless string one day — « {{a}} sur {{b}} et voilà » has a word
  after the second placeholder and no plural problem. *Recommendation:* accept the false positive and fix it
  by rewording, the same way rule 1 answers `OQ-COPY-5`. A rule that only fires on real defects needs a
  parser, and a parser for two languages is a bigger thing to be wrong than a copy table.
