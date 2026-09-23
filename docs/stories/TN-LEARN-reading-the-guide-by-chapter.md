# TN-LEARN — Reading the study guide, chapter by chapter

**Intent.** A player who wants to read — at a kitchen table, the night before the test — opens **Learn** from
the title screen, picks one of the guide's own chapters, picks a lesson, and reads it in the game's own
plain-language, bilingual words. Nothing is scored, nothing is timed, nothing unlocks, and nothing has to be
finished.

This file is the story ADR-0061 §1 names ("a third door, not a wider Study") and ADR-0065 §3.1 / §3.4
schedule straight after the level `read` step. Read `README.md` in this directory first.
`TN-READ-reading-a-passage-at-a-stop.md` owns the **reader card** and its single-switch and screen-reader
routes through prose; this file reuses that card unchanged and owns only **the way to it**: the door, the
chapter list, the lesson list, and Back at each step.

## What the player can reach, and the one property that makes this surface exist

**Every lesson passage that passes the shippable filter is reachable from Learn.** That is ADR-0065 §3.1's
defining property, and it is the only surface in the game of which it can ever be true — a level's `read`
step is selective by construction (ADR-0065 §3.2). Today that is **302 passages in 48 lessons across 10
chapters**. `tests/unit/contracts/every-passage-is-reachable-from-learn.test.ts` walks the real screens over
the real catalogue — every chapter button, every lesson button, every reader — and fails if one readable
passage is missing, or if one appears that the content gate would not let a player read. It reports the
count it walked and refuses to pass below the count shipped when it was written.

**The words are content and arrive already chosen** — the same four steps as `TN-READ`, in the same places:

1. **The chapter list is the catalogue's index.** `LessonLibrary.chapters()` reads it off module paths and
   fetches nothing, so opening Learn downloads no lesson.
2. **A chapter is fetched when it is opened, and only then.** One lazy chunk per chapter
   (`vite.config.ts` groups `content/lessons/<chapter>/*.json` into `lessons-<chapter>`), so the initial
   payload does not move (ADR-0061 §7): measured at build, the initial payload is 4 files and no lesson.
   The service worker precaches the ten chapter chunks with every other code chunk (ADR-0034), so once it
   is installed Learn reads offline; before then, a chapter is fetched on first open.
3. **The shippable-passage filter runs in `app/application`**, never in a screen
   (`app/application/content/learn.ts`, built on `lesson-passages.ts`'s `passageVerdict`), with ADR-0003's
   rule injected from `app/bootstrap/verified-passages.ts`. So Learn and a level's reader cannot disagree
   about what is readable (ADR-0063 §6). A quarantined passage leaves its lesson silently; a lesson left with
   no readable passage leaves the list silently (ADR-0024 — a lesson with nothing in it is not offered).
4. **A language is chosen by the composition root**, once, from `text.en` / `text.fr`.

The screens are handed **prose and ids, never verification data** (ADR-0063 §6): a chapter is an address
and a title, a lesson is an id and a title, and the reader is `TN-READ`'s `LessonReaderView`.

**The chapters are in the guide's own order**, read from the source register's page ranges
(`content/sources/discover-canada.json`), not in file-system order — so *Rights and Responsibilities of
Citizenship* comes before *Who We Are*, as it does in the booklet. Only the register's `chapters` array reaches
the bundle — a named import the bundler tree-shakes out of the 47 KB manifest. *The Oath of Citizenship* has no lessons (ADR-0061 §3 excludes the recitation) and is
therefore not listed: a chapter with nothing to read is not offered.

**What Learn is not.** It asks no question, counts nothing, remembers nothing and changes no save, no
schedule and no exam (ADR-0061 §5, §6). There is no "you have read this", no progress bar and no "Next
chapter": whether reading happened is not checkable (ADR-0063), and a control that claims to know is a
control that lies.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `learn.open` | Learn | Apprendre |
| `learn.title` | Learn | Apprendre |
| `learn.intro` | Read the citizenship study guide, one chapter at a time. There is no test here. | Lisez le guide d'étude pour la citoyenneté, un chapitre à la fois. Il n'y a pas de test ici. |
| `learn.lessons.intro` | Choose a lesson to read. | Choisissez une leçon à lire. |
| `learn.loading` | Getting the chapter ready. | Préparation du chapitre. |
| `learn.error` | We could not load this chapter. Check your connection and try again. | Nous n'avons pas pu charger ce chapitre. Vérifiez votre connexion et réessayez. |
| `learn.error.retry` | Try again | Réessayer |
| `learn.chapter.empty` | There is nothing to read in this chapter right now. | Il n'y a rien à lire dans ce chapitre pour le moment. |

**The chapter names**, one row per directory of `content/lessons/`. The English is the chapter's title as the
source register prints it. The French is the title of the same chapter in the French edition, *Découvrir le
Canada* — see `OQ-LEARN-1`.

| Key | EN | FR |
|---|---|---|
| `learn.chapter.rights-and-responsibilities-of-citizenship` | Rights and Responsibilities of Citizenship | Les droits et responsabilités liés à la citoyenneté |
| `learn.chapter.who-we-are` | Who We Are | Qui sommes-nous? |
| `learn.chapter.canadas-history` | Canada's History | L'histoire du Canada |
| `learn.chapter.modern-canada` | Modern Canada | Le Canada moderne |
| `learn.chapter.how-canadians-govern-themselves` | How Canadians Govern Themselves | Comment les Canadiens se gouvernent-ils? |
| `learn.chapter.federal-elections` | Federal Elections | Les élections fédérales |
| `learn.chapter.the-justice-system` | The Justice System | Le système judiciaire |
| `learn.chapter.canadian-symbols` | Canadian Symbols | Les symboles canadiens |
| `learn.chapter.canadas-economy` | Canada's Economy | L'économie canadienne |
| `learn.chapter.canadas-regions` | Canada's Regions | Les régions du Canada |

**Why "Learn" and not "Read the guide".** "The guide" is already a character — the beaver, "The guide" / « Le
guide » (`TN-GUIDE`) — and a title-screen control reading "Read the guide" would name him. "Learn" is one
plain word beside "Study" and "Practice exam", and the intro sentence says *study guide* in full.

**Strings this screen draws that are defined elsewhere:** `common.back` (`TN-SET`) for Back at each step,
and `common.close` for the reader card (`TN-READ`). Lesson titles and every passage are content
(`content/lessons/**`, ADR-0010) and are not rows here.

**A chapter directory with no row** is drawn under the English title its lessons carry rather than dropped —
dropping it would break the reachability property above — and
`tests/unit/contracts/every-passage-is-reachable-from-learn.test.ts` fails the build for it first, in both
languages, and also fails a directory that is not exactly one register chapter's address.

## Test ids

`title-learn`; `learn` (the dialog); `learn-title` (its `<h1>` and accessible name); `learn-intro`;
`learn-chapters` (an ordered list) and `learn-chapter-<directory>` (one button each); `learn-lessons` (an
ordered list) and `learn-lesson-<lesson id>`; `learn-back`; `learn-loading`; `learn-error`, `learn-retry`;
`learn-empty`. The reader is `TN-READ`'s: `lesson-reader`, `lesson-reader-title`, `lesson-reader-passage`,
`lesson-reader-close`.

## Single switch and screen reader — the ADR-0061 question, and what is and is not settled

**The chapter list and the lesson list are ordinary menus**, and they use the pattern every other menu in
the game uses: one scanning ring over the controls (`createSwitchRing`, given to the screen by
`app/ui/screen.ts`). A short press moves the highlight to the next chapter (or lesson, or Back) and says its
name; a long press opens it. Nothing scans by itself and nothing expires.

**The reader is `TN-READ`'s card, reused unchanged**, so the route through prose is the one design ADR-0063
§3 and ADR-0065 §3.4 require: each passage is a stop in the ring, a short press moves, scrolls and speaks,
a long press on a passage repeats it, and only `Close` closes. The dialog is named by the lesson's title and
described by the whole body, so a screen reader reads the title and then every passage on arrival.

**What Learn adds is structure, and it is how the length question is answered for now.** ADR-0061 §8 worried
that a switch player would have to press through "tens of passages". Learn never puts a whole chapter in one
ring: a chapter is split into its authored lessons (**6.3 passages on average, 18 at most, today**), and the
lesson list is the way to skip — Close, press to the next lesson, open it.

**ADR-0061's ui-a11y obligation (dated 2027-01-18) is NOT discharged by this file.** Its open part is
"whether a ring that long needs a way to skip a lesson", and that is a question about scanning cost that
wants measuring with switch users, not a decision to take from a screen. What is recorded here is the
interim answer: the lesson list is the skip, and each lesson is at most eighteen passages. `OQ-LEARN-2` carries
it. ADR-0065's matching ui-a11y obligation (2027-01-21) is likewise left open.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-LEARN-03` |
| Single switch | `TN-LEARN-04` |
| Screen reader | `TN-LEARN-05` |
| Reduced motion | `TN-LEARN-06` |
| 200 % text, dyslexia font, high contrast | `TN-LEARN-06` |
| Bilingual | `TN-LEARN-07` |
| Failure path | `TN-LEARN-08` (a chapter will not download), `TN-LEARN-09` (nothing readable) |
| The defining property | `TN-LEARN-02` |

---

## TN-LEARN-01 — The door, the chapters, a lesson, and back

```gherkin
Feature: Reading the guide by chapter
  As a newcomer studying for the citizenship test
  I want to read the study guide in plain words, a chapter at a time
  So that I meet everything the test can ask before I am asked it

  Scenario: Learn is on the title screen beside Study and the exam
    Given the title screen is showing
    Then the element "title-learn" is visible and reads "Learn"
    And it comes before "title-study", which comes before "title-exam"
    And it is offered to a first-time player and to a returning player alike

  Scenario: Opening Learn shows the guide's chapters, in the guide's order
    When I tap "title-learn"
    Then the element "learn" has role "dialog" and its accessible name is "Learn"
    And "learn-chapters" lists one button per chapter that has something to read
    And the first is "Rights and Responsibilities of Citizenship" and the last is "Canada's Regions"
    And "The Oath of Citizenship" is not listed
    And no lesson document has been downloaded

  Scenario: A chapter lists its lessons
    When I tap "learn-chapter-canadas-history"
    Then "learn-title" reads "Canada's History"
    And "learn-lessons" lists that chapter's lessons in their authored order
    And exactly one chapter's lessons were downloaded to show them

  Scenario: A lesson is read
    Given I opened the chapter "Canada's History"
    When I tap the first lesson
    Then the element "lesson-reader" is visible
    And "lesson-reader-title" reads that lesson's title
    And every readable passage of that lesson is a "lesson-reader-passage", in authored order

  Scenario: Back goes one step up, and never further
    Given a lesson is open in the reader
    When I tap "lesson-reader-close"
    Then the lesson list is showing and focus is on the lesson I just read
    When I tap "learn-back"
    Then the chapter list is showing and focus is on the chapter I just left
    When I tap "learn-back"
    Then Learn is closed and focus is on "title-learn"

  Scenario: Nothing is counted
    When I read every lesson of a chapter
    Then nothing on screen says how much I have read
    And my saved game is unchanged
    And the exam, Study and the levels draw exactly what they drew before
```

## TN-LEARN-02 — Every readable passage is reachable (the defining property)

```gherkin
Feature: Learn is complete by construction
  Scenario: Every shippable passage can be reached
    Given the lesson corpus as it ships
    When every chapter, then every lesson, is opened from Learn
    Then every passage whose verification is "verified" for its current sourceHash is shown
    And no other passage is shown
    And the number of passages shown is at least 302

  Scenario: A quarantined passage leaves Learn the way it leaves a level
    Given a passage whose grant is "quarantined"
    Then it is not shown in its lesson
    And the rest of its lesson is shown in order
    And no placeholder is drawn where it was

  Scenario: The lessons are not in the first download
    When the title screen has loaded
    Then no lesson document has been fetched
    And the initial payload is within its 8 MB budget
```

## TN-LEARN-03 — Keyboard only

```gherkin
Feature: Learn with a keyboard
  Scenario: Every step is reached with Tab and taken with Enter
    Given I am using a keyboard only
    When I focus "title-learn" and press "Enter"
    Then focus is inside "learn"
    And "Tab" reaches every chapter button and "learn-back", and cannot leave the dialog
    When I press "Enter" on a chapter
    Then focus is on that chapter's first lesson
    When I press "Enter" on a lesson
    Then the reader opens and "Tab" reaches "lesson-reader-close"

  Scenario: Escape goes one step up
    Given a lesson is open in the reader
    When I press "Escape"
    Then the lesson list is showing
    When I press "Escape"
    Then the chapter list is showing
    When I press "Escape"
    Then Learn is closed and focus is on "title-learn"
```

## TN-LEARN-04 — One switch

```gherkin
Feature: Learn with one switch
  Background:
    Given single-switch mode is on

  Scenario: The lists are menus
    When Learn opens
    Then the first chapter is highlighted
    And a short press moves the highlight to the next chapter and says its name
    And a long press opens the highlighted chapter
    And the ring goes through every chapter, then "learn-back", then wraps

  Scenario: The reader is TN-READ's
    Given a lesson is open
    Then each passage is a stop in the ring, as TN-READ requires
    And a long press on "lesson-reader-close" returns to the lesson list with a lesson highlighted

  Scenario: Nothing moves by itself
    When I do not press anything
    Then the highlight stays where it is
    And nothing closes, advances or expires
```

## TN-LEARN-05 — Screen reader

```gherkin
Feature: Learn is read aloud as a document
  Scenario: The dialog says where I am
    When Learn opens
    Then "learn" is a dialog named by "learn-title" and described by "learn-intro"
    And the chapters are an ordered list of buttons, so the list's length is announced
    When I open a chapter
    Then the dialog's name becomes the chapter's title
    And "#tn-live-region" says the chapter's title once

  Scenario: The canvas is not in the way
    Then any canvas on the page is "aria-hidden"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: Waiting is said, not only shown
    When a chapter is downloading
    Then "learn-loading" reads "Getting the chapter ready."
    And "learn" carries "aria-busy" true until the lessons are listed
```

## TN-LEARN-06 — Reduced motion, 200 % text, the dyslexia font, high contrast

```gherkin
Feature: Learn for every reader
  Scenario: No motion carries meaning
    Given reduced motion is on
    Then changing from the chapter list to a lesson list uses no slide, fade or scale
    And nothing about where I am is told only by an animation

  Scenario Outline: It fits at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    And the language is <language>
    Then every chapter title and every lesson title is whole, with no ellipsis
    And every control is at least 44 CSS px wide and tall
    And the page does not scroll sideways

    Examples:
      | language |
      | English  |
      | French   |

  Scenario: The dyslexia font and high contrast reach Learn
    Given the dyslexia-friendly font and high contrast are on
    Then Learn is drawn in the dyslexia face
    And axe-core finds no colour-contrast violation
```

## TN-LEARN-07 — Learn in French

```gherkin
Feature: Learn in French
  Background:
    Given the language is French

  Scenario: The door and the chapters are French
    Then "title-learn" reads "Apprendre"
    And "learn-chapter-canadas-history" reads "L'histoire du Canada"

  Scenario: A lesson is read in French
    When I open "L'histoire du Canada" and its first lesson
    Then "lesson-reader-title" is that lesson's French title
    And each "lesson-reader-passage" is that passage's French text
    And the reader carries "lang" equal to "fr"

  Scenario: Changing language re-renders without leaving Learn
    Given a lesson list is showing in English
    When I change the language to French
    Then the chapter title and every lesson title are French
    And nothing is downloaded again
```

## TN-LEARN-08 — A chapter will not download (failure path)

```gherkin
Feature: A chapter that cannot be fetched says so, and can be tried again
  Scenario: The connection drops
    Given the service worker is not installed yet and I am offline
    When I tap "learn-chapter-canadian-symbols"
    Then "learn-error" reads "We could not load this chapter. Check your connection and try again."
    And the message is announced once
    And "learn-retry" and "learn-back" are offered
    When the connection is back and I tap "learn-retry"
    Then the lessons of "Canadian Symbols" are listed

  Scenario: Learn is readable offline once the game is installed
    Given the service worker has installed
    When I am offline and open any chapter
    Then its lessons are listed
```

## TN-LEARN-09 — Nothing readable (failure path)

```gherkin
Feature: An empty chapter is never an empty screen
  Scenario: Every passage of a chapter is quarantined
    When I open that chapter
    Then "learn-empty" reads "There is nothing to read in this chapter right now."
    And no "Try again" is offered, because trying again cannot help
    And "learn-back" is offered

  Scenario: A lesson with no readable passage is not offered
    Given one lesson of a chapter has no readable passage
    When I open that chapter
    Then that lesson is not listed
    And no reader opens with a title and no words
```

---

## Open questions

- **`OQ-LEARN-1` — the French chapter titles are the French edition's, from memory rather than from a
  check.** They are written above as *Découvrir le Canada* titles them, and they are on screen stating what a
  chapter is called, which is the same standing as `OQ-SPINE-2` for the level subtitles.
  *Recommendation:* the `content-verifier` checks the ten pairs against canada.ca in the same pass as
  `OQ-SPINE-2`, and where the official title differs, the official title wins and this table is amended.
  The level subtitles (« Le système de justice », « L'économie du Canada ») are **subject** names under
  ADR-0028 and are deliberately not the same strings.
- **`OQ-LEARN-2` — does a long lesson need a way to skip inside the reader?** The interim answer above is
  structural: a chapter is never one ring, the lesson list is the skip, and a lesson is at most eighteen
  stops today. ADR-0061's ui-a11y obligation (2027-01-18) stays open until that is measured with switch
  users. *Recommendation:* measure presses-to-Close on the longest lesson before adding a control.
- **`OQ-LEARN-3` — should Learn also be in the level's menu?** ADR-0061 §1 says Learn is reached "from the
  same menu that reaches Study and Exam", and that menu is the title screen: the level's menu carries Study
  but not the exam (`TN-EXAMMENU-02`). *Recommendation:* not yet — the HUD menu is being reworked under
  ADR-0066, and a level already reads passages through its own `read` steps.
- **`OQ-LEARN-4` — a link from a chapter's end to a Study drill.** ADR-0061 §1 names this as "the useful
  relation" between the two doors. Study draws from every subject rather than a chapter, and a chapter is
  not a subject (ADR-0028), so a "Practise this chapter" control would promise a scope Study cannot keep.
  *Recommendation:* decide it with `TN-STUDY`'s owner before drawing a control.
- **`OQ-LEARN-5` — six items on the title screen.** `OQ-ATTEMPT-4` kept the title at five items so the exam
  never had two controls. Learn is a sixth item and a different door, so that reasoning is untouched, but the
  first-run screen now carries Play, Learn, Study, Practice exam and Settings. *Recommendation:* keep it —
  ADR-0061 puts Learn beside Study and the exam, and the title is where both are.
