# System: Citizenship Ceremony mock exam

Parameters from `game.config.json`: `exam.questionCount` 20, `exam.passMark` 15, `exam.timeLimitSeconds` 1800; `unlockRules.stampsForExam` 10. Practice mode is available from the journal at any time and uses the same rules but is labelled as practice.

## TN-EXAM-01 Unlock — Implemented

```gherkin
Feature: Ceremony gate
  Scenario: Locked below 10 stamps
    Given 9 stamps
    When I open the journal
    Then the "Citizenship Ceremony" section reads "Earn 10 stamps to unlock the ceremony (9 so far)."
    And only "journal-practice" ("Practice exam (unlocked anytime)") is enabled

  Scenario: Unlocked at 10 stamps
    Given 10 stamps
    Then the section reads "You're ready. Take the mock exam!"
    And a button opens the exam in ceremony mode
```

## TN-EXAM-02 Sitting the exam — Implemented

```gherkin
Feature: Exam flow
  Background:
    Given I opened the exam (practice or ceremony) and see "Citizenship Ceremony — Mock Exam"
    And the intro reads "20 questions. You need 15 correct. You have 30 minutes, just like the real test."

  Scenario: Begin
    When I click "exam-begin"
    Then 'exam:started' is emitted with total 20 and timeLimitSeconds 1800
    And role="timer" shows "30:00" or "29:59"
    And "exam-question" shows question 1 with choices "exam-choice-a".."exam-choice-d"

  Scenario: Questions are spread across subjects
    Then the 20 questions are drawn from all 10 question banks with 2 per subject
    And no question id appears twice

  Scenario: Navigate and change answers
    When I choose a choice and click "exam-next"
    And I click "Previous"
    Then my earlier choice is still selected and can be changed

  Scenario: Submit
    When I have visited all 20 questions and click "exam-submit"
    Then 'exam:finished' is emitted with a grade
    And "exam-score" contains "/20"
    And with 15 or more correct I see "Congratulations! You passed with <correct>/20."
    And with fewer I see "You scored <correct>/20. You need 15. Explore more and try again!"

  Scenario: Submit with unanswered questions
    Given 3 questions are unanswered
    When I click "exam-submit"
    Then I am asked to confirm and unanswered questions count as incorrect
```

## TN-EXAM-03 Timer and auto-submit — Planned

```gherkin
Feature: Exam timer
  Scenario: Timer counts down
    Given the exam started 60 seconds ago
    Then role="timer" shows "29:00"

  Scenario: Auto-submit on timeout
    When the timer reaches 00:00
    Then the exam is submitted automatically with the answers given so far
    And I see "Time is up. Your exam was submitted."
    And 'exam:finished' is emitted

  Scenario: Leaving the exam early
    When I press Esc during the exam
    Then I am warned that leaving submits the exam
```

## TN-EXAM-04 Review and results — Planned

```gherkin
Feature: Results
  Scenario: Review answers
    When I click "Review answers" on the results screen
    Then each of the 20 questions is listed with my choice, the correct answer, the explanation and "Source: …"

  Scenario: Results are saved
    Then examResults gains an entry with at, correct, total 20, passed and durationSeconds
    And 'progress:saved' is emitted
    And the journal lists past attempts with date and score

  Scenario: Exit
    When I click "exam-exit"
    Then I return to the HUD in the district I came from and "stamps" is visible
    And "Return to Parliament Hill" is offered after a passed ceremony exam
```
