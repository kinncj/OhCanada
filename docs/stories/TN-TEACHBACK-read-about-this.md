# TN-TEACHBACK — "Read about this" after a question

**Intent.** As a newcomer learning for the citizenship test, when I have answered a question — right or
wrong — I want to read the part of the guide that question comes from, so that I learn the fact and not only
the answer. I never get this help while an exam question is live, because the real test gives none.

**Product owner's goal.** The learning content matches the quests and the questions: every question has a
lesson passage with the same proposition, and the player meets it before being asked. This story is the
part a player can use today; the gate in ADR-0070 §5 measures the rest.

Read `README.md` in this directory first. `TN-CARD` owns the question card, `TN-STUDY` the drill,
`TN-RESULT` the exam review, and `TN-READ` the lesson reader this story opens. This file owns **only** the
control that joins them and what it opens. It owns one row of copy and no other words: every sentence the
reader draws is authored in `content/lessons/**` and verified there.

Decision record: ADR-0070.

## Coverage

| Concern | Scenario |
|---|---|
| When the control appears | `TN-TEACHBACK-01`, `TN-TEACHBACK-02` |
| What it opens | `TN-TEACHBACK-03` |
| No passage | `TN-TEACHBACK-02` |
| Exam: live question and review | `TN-TEACHBACK-05` |
| Keyboard | `TN-TEACHBACK-04` |
| Single switch | `TN-TEACHBACK-04` |
| Screen reader | `TN-TEACHBACK-06` |
| 200 % text, 44 pt targets | `TN-TEACHBACK-07` |
| Bilingual | `TN-TEACHBACK-08` |
| Measurement | `TN-TEACHBACK-09` |

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `card.readAbout` | Read about this | Lire à ce sujet |

The reader's title and prose are the lesson's own. Its way out is `common.close`, which `TN-READ` owns.

## TN-TEACHBACK-01 — The control appears after the answer, not before

```gherkin
Feature: Read about this, after answering
  Background:
    Given a question whose proposition a readable lesson passage shares
    And the question card is visible, in a level or in Study

  Scenario: Not before I answer
    Then there is no "question-read-about" control

  Scenario: After I answer, right or wrong
    When I choose any option
    Then "question-read-about" is visible
    And it reads "Read about this"
    And it comes after "question-next" and before "question-close"
    And "question-next" is still the first control after the result
```

## TN-TEACHBACK-02 — No passage, no control

```gherkin
Feature: Nothing to read
  Scenario: A question no passage tells
    Given a question whose proposition no readable lesson passage shares
    When I answer it
    Then there is no visible "question-read-about" control
    And there is no disabled one either

  Scenario: The guide's passages cannot be loaded
    Given the lesson catalogue does not load
    When I answer a question
    Then there is no visible "question-read-about" control
    And the card works exactly as it did before
```

## TN-TEACHBACK-03 — It opens the passage the question comes from

```gherkin
Feature: What Read about this opens
  Scenario: The passage with the same proposition
    Given I answered a question
    When I choose "Read about this"
    Then the element "lesson-reader" is visible
    And its title is the lesson's own title
    And it draws the passages that rest on the same sentence of the guide as the question
    And it draws only passages a verifier has granted
    And it draws them in one language, the one I am playing in

  Scenario: Coming back
    When I close the reader with "Close" or Escape
    Then "lesson-reader" is hidden
    And the question card is still visible, with my answer and the explanation
    And focus is on "question-read-about"
    And one Escape closed only the reader
```

## TN-TEACHBACK-04 — Keyboard and one switch

```gherkin
Feature: Read about this without a pointer
  Scenario: Keyboard only
    Given I answered a question with the keyboard
    When I press Tab to "question-read-about" and press Enter
    Then the reader opens and focus is inside it
    When I press Escape
    Then focus is back on "question-read-about"

  Scenario: One switch
    Given single-switch mode is on
    And I answered a question
    When I press briefly until "question-read-about" is highlighted
    And I hold the switch
    Then the reader opens
    And a brief press moves through each passage and then "Close"
    When I hold the switch on "Close"
    Then the reader closes
    And the highlight is on "question-read-about"
```

## TN-TEACHBACK-05 — The exam stays unaided; the review may teach

```gherkin
Feature: Read about this and the exam
  Scenario: Never during a live exam question
    Given an exam is in progress
    Then no exam question offers "Read about this", before or after I choose an option

  Scenario: In the review after the exam
    Given the exam has finished and I opened "See every question"
    Then an item whose question a readable passage tells offers "Read about this"
    And an item with nothing to read offers no such control
    When I choose it on an item
    Then the reader opens over the review
    And closing it puts focus back on that item's control

  Scenario: The way out of the review comes first (keeps TN-RESULT-09)
    Given single-switch mode is on and the review is open
    When I press the switch briefly once
    Then "exam-review-back" is highlighted
```

## TN-TEACHBACK-06 — Screen reader

```gherkin
Feature: Read about this with a screen reader
  Scenario: The control is a named button
    Then "question-read-about" is a button named "Read about this"

  Scenario: The reader reads itself
    When I open it
    Then the dialog is named by the lesson title and described by the prose
    And nothing is announced separately through "#tn-live-region"
```

## TN-TEACHBACK-07 — Large text and touch

```gherkin
Feature: Read about this at 200 % text
  Scenario Outline: Nothing is clipped and targets are big enough
    Given text size is <scale> and the language is <locale>
    And the viewport is 390 by 844
    When I answer a question and open "Read about this"
    Then no label is clipped and nothing scrolls sideways
    And "question-read-about" and "lesson-reader-close" are at least 44 by 44 CSS pixels

    Examples:
      | scale | locale |
      | 100 % | en     |
      | 200 % | en     |
      | 100 % | fr     |
      | 200 % | fr     |
```

## TN-TEACHBACK-08 — Bilingual

```gherkin
Feature: Read about this in French
  Scenario: The control and the passage follow the language
    Given the language is French
    When I answer a question
    Then the control reads « Lire à ce sujet »
    When I open it
    Then the lesson title and passages are the French ones

  Scenario: Changing language with the reader open
    Given the reader is open in English
    When I change the language to French
    Then the title and every passage are French, never a French title over English prose
```

## TN-TEACHBACK-09 — The distance to the goal is measured on every run

```gherkin
Feature: Teach-back gate
  Scenario: Both counts are printed and held
    When the unit tests run
    Then they print how many verified questions have no passage sharing their proposition
    And how many pooled questions are not met in their level before the step that asks them
    And each count is compared with "tests/unit/contracts/teach-back-baseline.json"
    And a higher count fails the build and lists the questions
    And a lower count fails until the baseline is lowered in the same commit
```

## Open questions

- `OQ-TEACHBACK-1` — Should the control also appear on a question the player closed without answering?
  Not today: nothing was judged, and `TN-CARD-05` says closing is not an answer.
- `OQ-TEACHBACK-2` — When a proposition is told in two lessons, the reader shows the lesson with more
  matching passages. None does today; revisit if the corpus makes it common.
