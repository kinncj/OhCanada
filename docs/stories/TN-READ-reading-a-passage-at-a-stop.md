# TN-READ — Reading a passage of the guide, at a stop, in a level

**Intent.** A player walking a level can stop at a plaque or a person and **read a paragraph of the study
guide in the game's own bilingual words** — on a screen a keyboard reaches, one switch operates and a screen
reader reads — and then carry on. Nothing requires them to read it. Nothing counts how much they read.

This file is ADR-0063's ui-a11y obligation, discharged: *"decide how a single-switch player and a
screen-reader player move through a `read` step, and record it in the story that carries the reader."* It is
also the story ADR-0063 §3 meant when it wrote that the reader *"inherits the accessibility contract the
question card and the POI card already meet"* but **does not inherit the single-switch route**, because
*"tap anywhere advances" is a rule written for cards* and a passage is not a card.

Read `README.md` in this directory first. `TN-LEVEL-ottawa.md` and `TN-REACH-what-is-in-reach.md` own
walking up to something; `TN-QUEST-parliament-hill.md` owns what a quest step is; `TN-GUIDE-the-guide.md`
owns the guide character. This file owns **only the surface**, and it owns no words: every sentence a player
reads here is authored in `content/lessons/**`, verified there, and named by a `read` step.

## What is built, and what is not

`app/ui/lesson-reader.ts` is the surface. **No quest ships a `read` step yet** — authoring the first one is
content's obligation, dated 2027-02-20, `toronto` recommended — so on today's build the reader is reachable
from nothing. **Passages reachable by playing is still 0.** Anyone quoting this file as having changed that
number is quoting a surface, not a measurement, which is the same warning ADR-0063's consequences carry.

## The words are content, and they arrive already chosen

The reader draws a `LessonReaderView`: a lesson title and a list of `{ id, text }`, **already resolved,
already filtered, already in one language**. Four things happen before the screen, and none of them may
happen in it.

1. **`app/bootstrap/quests.ts` reads the step.** It hands back `passages[]` — `{ lesson, passage }` pairs.
   References, never words (ADR-0063 §2).
2. **The pair is resolved across documents**, to **exactly one passage or a named failure** — `dangling` on
   zero matches, `ambiguous` on two, never `undefined` (`scripts/lib/lesson-passages.mjs`, ADR-0063 §4).
3. **The shippable-passage filter runs**, in the application layer and never in a screen, so the level
   reader and the Learn reader cannot disagree about what is readable (ADR-0063 §6). A quarantined passage
   leaves the level the way it leaves Learn: by not being in the list.
4. **A language is chosen**, once, by the caller — from the passage's own `text.en` / `text.fr`.

**Why the screen is given prose and nothing else.** `app/ui` may not read content and may not import an
adapter (ADR-0005), and a screen that resolved its own references would have to glob 48 lesson documents to
do it — the whole corpus in the initial payload, against ADR-0063 §6's per-chapter lazy catalogue and the
≤ 8 MB budget. So `LessonReaderView` has **no field a reference, a `fact` block or a `LocalizedText` fits
into**: the omission is a type, not a habit, and `tests/unit/contracts/a-read-step-reaches-a-reader.test.ts`
walks the whole route and then reads the screen's source to prove it stayed that way. This is exactly the
discipline `app/ui/about-this-place.ts` follows, for the same failure: a screen written against a raw
document is a screen that can draw something a verifier declined with every gate still green.

**Changing language re-renders, it does not reload.** `setLocale` takes the view back, and the parameter is
**required**: a screen that kept the prose it was handed would put a French heading over English paragraphs
the first time a player switched mid-read, and an optional parameter is how that ships.

## One switch, and this is the question ADR-0063 asked

**Each passage is a stop in the ring. One short press moves the highlight to the next passage, scrolls it
into view, and reads it aloud. Reading the document is the same gesture as moving through it.**

The ring is the passages in order, then `Close`, and it wraps:

```
passage 1 → passage 2 → … → passage n → Close → (wraps to passage 1)
```

Why it could not be the default. A ring built only from controls would hold `Close` and nothing else, so a
switch player would meet a heading, one button, and prose they had no way to hear — and **a switch player
cannot scroll**, so any paragraph below the fold would be one they could never reach at all. Marking the
prose a stop solves the scroll and the speech with one mechanism.

Four rules follow, and none of them is new:

- **There is one scanning implementation**, `createSwitchRing` in `app/ui/single-switch.ts`, given to this
  surface by `app/ui/screen.ts` on `show()`. This story does not introduce a second scanning concept and no
  future one may.
- **A stop is not a control.** It carries no role, stays out of the Tab order (`tabindex="-1"`), and a long
  press on it **reads it again and does nothing else**. A stop that could act would be no stop. This is
  `app/ui/confirm.ts`'s device, asked of prose instead of a question — and it is the one thing a switch
  player could not do before: ask for a paragraph again.
- **Only the last item in the ring closes anything.**
- **Nothing scans by itself and nothing expires.** No `setTimeout`, no countdown, no timer outside Exam mode.

**The highlight opens on the first passage, in silence.** The dialog has just read every passage as its own
description (below); announcing the first one again would be saying it twice. The scan comes round to it on
the lap, so **every passage is spoken within one turn of the ring** — verified in
`tests/unit/ui/lesson-reader.test.ts`, which asserts the whole lap in order.

## A screen reader, and the same design from the other end

**A passage is prose the player is meant to read, so the prose is the dialog's own description — not
something behind a control, and never text drawn on the canvas.**

1. **On open.** `role="dialog"`, `aria-modal="true"`, named by the lesson's title (`aria-labelledby`) and
   described by the whole body (`aria-describedby`), so a reader that reads a dialog on arrival reads the
   title and then every passage, in the order the step named them. **Nothing is announced separately.** A
   live-region message as well would say it all twice — `about-this-place.ts`'s rule and `level-events.ts`'s.
2. **Again, in the reader's own time.** The passages are real paragraphs in reading order inside the dialog,
   so a reading cursor walks them, re-reads one, or spells a word out. That is the ordinary way a
   screen-reader player reads prose and it needed no invention; what it needed was for the prose to *be
   there*, which before ADR-0063 it was not.
3. **Again, passage by passage, on one switch**, through the one live region, with `lang` attached so French
   prose is not read with English phonemes (`TN-LEVEL-11`).

Route 3 speaks through the live region **and** moves focus to the paragraph, which some readers speak on
focus. That is deliberate belt and braces: which of the two a given reader does is not knowable from the
code, and `confirm.ts` settled the trade in the same words — heard twice at worst, and never nothing.

**What is deliberately not here: a second Tab stop over the prose.** It was written and taken out. A
focusable box round the paragraphs is a stop a keyboard player meets on the way to the only control there
is, and it would have to claim a semantic — `group`, or a `region` landmark inside a dialog — to justify
itself. The screen root already scrolls and already holds focus at open, so the keys that scroll a long page
scroll this one.

## How much a stop may hold — the judgement ADR-0063 delegates

ADR-0063 lists *"how many passages a stop should hold before it is a wall of text"* among the rules no gate
can express, and routes it to *"the story and the a11y owner"*. Measured on this surface, at 390 × 844,
which is the phone this game is designed for:

| | Measured |
|---|---|
| Passages shipped | **302**, over 48 lessons and 10 chapters |
| Mean passage | **109** characters (EN) |
| Longest passage | **270** characters (EN), **314** (FR) |
| A 314-character French passage at 200 % text | about **1 290 px** tall, against an **844 px** viewport |

**The judgement: a `read` step holds three or four passages, and never more than four.** Three at the mean
is about 330 characters, which is a sheet a player reads without scrolling at 100 % and scrolls once at
200 %. It is also the shape ADR-0063 recommends for the first authored step, so this agrees with it rather
than second-guessing it.

**And a known, measured rough edge, recorded rather than hidden.** A passage taller than the viewport cannot
be shown whole. The shared reveal (`app/ui/focus-scroll.ts`) scrolls **as little as possible**, which going
*down* the ring shows such a paragraph's **start** — correct — and coming back *up* to it, on the wrap,
shows its **end**. So at 200 % text, with a longest-case French passage, a sighted switch player sees the
head of every passage on the first lap and the tail of the first passage on every lap after. The **spoken**
route is unaffected: the whole paragraph is read aloud either way. A screen-specific override was written
and removed, because the shared reveal runs after it and undoes it; fixing it properly means changing
`focusAndReveal` for every screen in the game, which is a change this story does not get to make on its own.
**The cheap fix is editorial and is already the rule above:** a passage that is taller than the phone is a
passage that should not have been put on a stop. `OQ-READ-2`.

## Found while building this, and fixed here: an invisible shape on a neighbouring screen

Each passage carries a rule down its leading edge, so "this is study material" is a shape and not only a
colour. Measured in Chromium with high contrast on, that rule was **white on white**: `--tn-accent` is
`#ffffff` under `[data-tn-contrast="high"]` and so is the sheet, so the shape that exists *because* colour
can go away went away with it. `app/ui/about-this-place.ts`'s statement rule is drawn the same way and had
the same defect. Both are now painted in the ink, which is the one colour high contrast guarantees against
the paper, and `TN-READ-07` asserts the rule is a different colour from the sheet rather than merely present.

It was found by reading the *rendered* border in a browser, not by reading the palette — which is the only
way a vanished shape is ever found, and the reason `tests/a11y` exists beside the unit suite.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-READ-04` |
| Single switch | `TN-READ-05` |
| Screen reader | `TN-READ-06` |
| Reduced motion | `TN-READ-07` |
| 200 % text | `TN-READ-07` |
| High contrast, easier-to-read font | `TN-READ-07` |
| Bilingual | `TN-READ-03` |
| Failure path | `TN-READ-08` (a reference that names nothing; a reader with nothing in it) |

## Player-facing copy

**One row, and it is borrowed.** Everything else on this screen is content.

| Key | EN | FR | Owned by |
|---|---|---|---|
| `common.close` | Close | Fermer | shared, already shipped |

**No new row is written for this surface, and that is a rule rather than an accident.** There is no counter
("2 of 4"), no "Next", no "Done reading", no "You have read this". ADR-0063 records that **whether reading
happened is not checkable and must not be gated** — *"a reader can be dismissed… nothing here requires
reading, and nothing should"* — so a control that claims to know is a control that lies, and a counter is
chrome on a screen whose whole job is to get out of the way of three sentences.

## Markers

| `data-testid` | What it is |
|---|---|
| `lesson-reader` | The dialog. `role="dialog"`, `aria-modal="true"`, `lang` in force |
| `lesson-reader-title` | The lesson's own title; the dialog's accessible name |
| `lesson-reader-body` | The prose; the dialog's accessible description. No role, no `tabindex` |
| `lesson-reader-passage` | One passage. A switch stop, out of the Tab order, `data-tn-passage` naming it |
| `lesson-reader-close` | The way out. Escape does the same thing |

## TN-READ-01 — Reading a passage at a stop

```gherkin
Feature: A passage of the guide, in the level
  Background:
    Given a quest step of kind "read" naming three passages
    And I have engaged the thing that offers it

  Scenario: The passage is on screen, in the game's own words
    Then the element "lesson-reader" is visible
    And it draws the lesson's title
    And it draws all three passages, in the order the step named them
    And the words are the words in "content/lessons", letter for letter

  Scenario: Nothing was copied to put them there
    Then the quest document contains no passage text
    And the level document contains no passage text

  Scenario: Nothing counts and nothing is required
    Then no counter is drawn
    And nothing on screen says I must read anything
    When I do nothing for two minutes
    Then nothing has changed
```

## TN-READ-02 — Leaving it

```gherkin
Feature: Closing the reader
  Background:
    Given the element "lesson-reader" is visible

  Scenario: Close closes it
    When I choose "Close"
    Then the reader is gone
    And the level is where I left it

  Scenario: Escape is the same thing
    When I press Escape
    Then the reader is gone

  Scenario: Focus goes back to what opened it
    When the reader closes
    Then focus is on the control that opened it
    And focus is not on the document body
```

## TN-READ-03 — The reader in French

```gherkin
Feature: The reader in French
  Background:
    Given the language is French

  Scenario: The passage is the French one
    Then every passage is the passage's own "text.fr"
    And the element "lesson-reader" carries lang="fr"
    And "Close" reads "Fermer"

  Scenario: Changing language changes the prose with the heading
    Given the reader is open in English
    When I change the language to French
    Then the heading and every passage are French
    And no English sentence is left on the screen
```

## TN-READ-04 — The reader from the keyboard

```gherkin
Feature: Keyboard-only reading
  Background:
    Given the element "lesson-reader" is visible

  Scenario: Focus opens inside it and cannot leave
    Then focus is inside "lesson-reader"
    When I press Tab repeatedly
    Then focus never leaves the reader

  Scenario: A paragraph is not a Tab stop
    When I press Tab once
    Then focus is on "lesson-reader-close"
    And I did not have to tab past any paragraph to get there

  Scenario: The keys that scroll a page scroll this one
    Given the prose is taller than the screen
    When I scroll with the keyboard
    Then every paragraph and the way out can be brought into view
```

## TN-READ-05 — The reader with one switch

```gherkin
Feature: Single-switch reading
  Background:
    Given single-switch mode is on
    And the element "lesson-reader" is visible

  Scenario: Nothing scans and nothing expires
    When I do nothing for two minutes
    Then the highlight has not moved
    And nothing on screen counts down

  Scenario: The highlight opens on the first passage, in silence
    Then the first passage carries the highlight
    And nothing has been announced

  Scenario: A short press moves to the next passage and reads it
    When I press the switch briefly
    Then the highlight is on the next passage
    And that passage is scrolled into view
    And that passage is read aloud in the language in force

  Scenario: One lap reaches everything and speaks every passage
    When I press the switch briefly once per item
    Then the highlight has visited every passage and then "Close"
    And every passage has been read aloud
    And the highlight has wrapped to the first passage

  Scenario: A long press on a passage reads it again and nothing else
    Given the highlight is on a passage
    When I hold the switch past the hold-to-choose threshold
    Then that passage is read aloud again
    And the reader is still open
    And the highlight has not moved

  Scenario: A long press on "Close" is the way out
    Given the highlight is on "Close"
    When I hold the switch past the hold-to-choose threshold
    Then the reader is gone
```

## TN-READ-06 — The reader with a screen reader

```gherkin
Feature: Announcing the reader
  Background:
    Given the element "lesson-reader" is visible

  Scenario: It is a named, described dialog
    Then "lesson-reader" has role "dialog" and aria-modal "true"
    And its accessible name is the lesson's title and is not empty
    And its accessible description is the prose
    And any canvas on the page is "aria-hidden"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The prose is read on arrival, in order
    Then the title is read, then every passage, in the order the step named them

  Scenario: Opening it announces nothing
    Then nothing has been written to the live region
    Because the dialog already reads itself, and a message as well says it twice

  Scenario: Nothing stands between the reading cursor and the words
    Then the prose carries no widget role
    And no element around the prose is in the Tab order
```

## TN-READ-07 — 200 % text, less movement, high contrast, the easier font

```gherkin
Feature: The reader at the limits
  Scenario: At 200 % text, in French, with the longest passages
    Given the text size is 200 %
    And the language is French
    Then the page does not scroll sideways
    And no passage overflows its own box
    And "Close" is at least 44 pt tall and can be brought into view

  Scenario: Less movement
    Given less movement is on
    Then nothing on the reader animates or transitions
    And every passage and the way out are still there

  Scenario: High contrast and the easier-to-read font
    Given high contrast is on and the easier-to-read font is on
    Then the font reaches the paragraphs, not only the chrome
    And every passage meets WCAG AA against its background

  Scenario: Colour is never the only signal
    Then each passage is marked by a rule down its leading edge as well as by colour
    And that rule is a different colour from the sheet it is drawn on, in high contrast too
    And the switch highlight changes border style and outline, not colour alone
    And the highlight changes no pixel of layout when it arrives
```

## TN-READ-08 — When there is nothing to read (failure path)

```gherkin
Feature: The reader refuses rather than draws a blank
  Scenario: A reference that names nothing
    Given a "read" step naming a passage that does not exist
    Then resolution fails as "dangling", naming the collection it searched
    And no reader opens

  Scenario: A reference that names two
    Given a "read" step naming a pair that two passages answer to
    Then resolution fails as "ambiguous", with the count
    And no reader opens

  Scenario: A passage that may no longer be read
    Given a named passage whose grant is quarantined, or made for a source hash it no longer cites
    Then it is not in the list the reader is given
    And it leaves the level the way it leaves Learn

  Scenario: A reader with nothing in it
    Given a view carrying no passages
    Then the reader does not open
    And nothing is announced
```

## Open questions

- **`OQ-READ-1` — should a `read` step be openable a second time?** Today the reader is a card: it opens,
  it is read, it closes, and whether the quest step advances is `TN-QUEST`'s business, not this screen's.
  A player who wants to read it again has to walk back to the stop. *Recommendation:* leave it. The passage
  also lives in Learn (ADR-0061), which is the surface for reading something again on purpose, and a
  "read it again" control on a level is a second route to the same paragraph with a second thing to
  translate. Revisit when Learn exists and the two can be compared.
- **`OQ-READ-2` — a passage taller than the phone shows its tail on the wrap.** Measured above. The fix is
  either editorial (a passage that tall does not go on a stop) or a change to `app/ui/focus-scroll.ts`'s
  `block: 'nearest'` for every screen in the game. *Recommendation:* editorial, held by the three-or-four
  rule above. If it is ever fixed in code, it must be fixed for every screen at once and measured on the
  question card first, which is the screen with the most to lose from a bigger scroll.
- **`OQ-READ-3` — does a read passage belong in the passport, or anywhere a player can count?**
  *Recommendation:* no, and firmly. ADR-0063 says whether reading happened is not checkable, and a count of
  passages read is a score for a thing the game promised not to score. This is recorded as a question only
  because "how many have I read" is the first feature anybody will ask for.
- **`OQ-READ-4` — who names the stop?** `targetId` is required on a `read` step and on a level with no
  figure that something is a plaque (ADR-0029). What the HUD says when a plaque carrying a `read` step is
  in reach is `TN-REACH`'s row to write, not this file's, and no row exists yet. *Recommendation:* route to
  `TN-REACH` with the first authored step, so the words are written against a real plaque rather than an
  imagined one.
