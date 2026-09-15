# ADR-0045: The strip keeps the task, words wrap whole, and a sheet hugs what it says

- Status: Accepted (2026-09-15)
- Slice: F2d (readability pass), from the second live-site audit of 2026-09-15.
- Amends: ADR-0039 §1 (the strip's order); ADR-0041 §3 ("the question card stays a full screen", and the
  menus); `TN-HUD-hud-and-menu.md` (`TN-HUD-08`, the strip's order at 200 %); `TN-CARD-question-card.md` (the
  place line, and where "Next" is after answering); `TN-TIMER-the-exam-clock.md` (`TN-TIMER-01`, where the limit
  is drawn); `TN-PASSPORT-my-passport.md` (an earned slot draws its stamp).
- Does not amend: `TN-NAMES-naming-real-places.md` or `TN-DONE`. The question card names a landmark only right
  after that landmark's own card has named it.

## Context

A second audit of the live site on a 390 × 844 phone found seven things that make the game harder to read for
the people it is for: grade-6 readers, readers learning English or French, and dyslexic readers. Every one
passed the suites that existed.

1. **P1: at 200 % text the task went below the screen.** In French on Halifax with the task accepted, the HUD's
   content was 349 px tall in a 275 px scroll box. The task line ended at y = 907 on an 844 px screen, because
   it came after the storage warning, the notice and the mode label. Measured again in the harness before this
   change: no French task line of the 72 the quests hold fit under any prompt at 200 %.
2. **P2: `hyphens: auto` split words on every screen**: "cov-ering", "citoyen-neté", "govern-ment",
   "responsabili-tés". A reader learning the language reads two fragments.
3. **P2: the question card.**
   - After answering, "Next" was below the fold: its bottom was at 794 px at 100 %, 854 px at 200 % and 905 px
     in French at 200 %.
   - Before answering, about 40 % of the card was blank white.
   - The card did not say which place the question belongs to.
4. **P2: high contrast drew switches backwards.** Every control was a black slab and a chosen one was white, so
   Off read as filled and On as an empty outline.
5. **P2: the level menu and the exam menu** were white pages with their buttons under a large blank column.
6. **P2: an earned passport slot had no stamp**, only an "Earned" pill, while the completion card that awarded
   it pressed a red stamp.
7. **P3:**
   - four stacked full-width buttons under an exam question, with Previous drawn active on question 1;
   - "30 minutes" printed directly above "No timer" on the exam intro;
   - the text-size value on a line of its own, apart from its label, and a small slider thumb;
   - the creator's focus ring drawn brass-light on a brass chosen option, which hid it.

## Decision

### 1. The strip draws the task third, and holds its spacing tighter

The HUD's children are now:

1. the prompt;
2. Settings and Menu;
3. **the task**;
4. the storage warning;
5. the notice;
6. the mode;
7. the hint.

The DOM order is still the visual order. The mode, the notice and the hint are the rows that may scroll.

The space around the words is smaller and still holds still at large text:

- the strip's padding is 6 px and its gap 4 px;
- a control's vertical padding is 2 px, and its minimum is still 48 px at every scale;
- line height is 1.2 in the strip and 1.15 in its buttons;
- the task line is semi-bold, so it reads as the line to act on.

The words still grow to 200 %. The strip is still capped at a third of the viewport, as `TN-HUD-01` and the
"stays in the lower third" test require.

**What this does not fix, and why.** The strip at 200 % is about 275 px. A three-line French prompt ("Regarder
la Bibliothèque du Parlement"), the controls and a four-line task need about 300 to 370 px. No spacing fits
that. Measured over all 72 task lines, with the prompt, Settings, Menu and the task all inside the strip:

| at 200 % text, default font | one-line prompt | two-line prompt | three-line French prompt |
|---|---|---|---|
| English, before | 4 / 72 | 0 / 72 | 0 / 72 |
| English, after | 72 / 72 | 60 / 72 | 60 / 72 |
| French, before | 0 / 72 | 0 / 72 | 0 / 72 |
| French, after | 70 / 72 | 58 / 72 | 26 / 72 |

The audited case (Halifax, "Regarder la Tour de l'horloge d'Halifax", "Mission : Trouvez la tour de
l'horloge") ends 52 px inside the strip in both languages. That margin did not change with a wider face.

Where a pair does not fit, the task starts inside the strip and its last line scrolls. Two further measures were
tried and **not** taken, because each trades away something CLAUDE.md requires. They are the product owner's to
choose:

- **Drawing the task at 175 % when the setting says 200 %**: 72 / 72, 72 / 72 and 36 / 72 in French.
- **Hiding the word "Task" / « Mission » from sight**, while keeping it for a screen reader: 72 / 72,
  72 / 72 and 49 / 72 with the smaller task.

Moving Settings and Menu out of the strip, to a corner of the screen, would fit nearly every pair. It changes
`TN-HUD`'s strip and was not done here.

### 2. No automatic hyphenation

`hyphens: auto` is gone from the stylesheet, and `.tn-screen` and `.tn-hud` declare `hyphens: manual`. Text
uses `overflow-wrap: break-word`, which moves a word to the next line whole and breaks inside a word only when
that one word is wider than its line. The few narrow boxes that must shrink below a word keep
`overflow-wrap: anywhere`, and draw no hyphen: a map card's name and pills, a passport name, and state words.

In French at 200 % no screen scrolls sideways and no control's label is clipped. The harness screens checked:
Settings, the question card, the exam, the exam start, the passport, the map, Study, the landmark card, the
completion card, "About this place", the creator, the dialogue and the exam result.

### 3. The question card hugs its content, brings the way on into view, and names its place

- **Layout.** The card hugs its content at the foot of the screen. Asked by a level, it is a sheet over the
  level (`tn-screen--sheet`, as ADR-0041 §3 describes). In Study it is `tn-screen--hug`, the same card with the
  night kept behind it, because Study's home and the title screen are not levels. The counter and the tag share
  a line. Close sits 12 px under the options.
- **The way on.** When the answer arrives, focus moves to the result, as before. The actions are then scrolled
  into view with it. When the result and the actions are taller than the screen, the result is scrolled to its
  top instead, so "Not quite." is what is seen. The scroll is instant under reduced motion, whether that comes
  from the setting or the device. "Next" now ends at 760 px at 100 %, 725 px at 200 % and 827 px in French at
  200 %. A new question starts at its top.
- **The place.** A small line names where the question is asked: the map's name for the level
  (`level.<id>.title`), then the landmark's own name when its card has just drawn it as a heading. A giver that
  is a landmark (the lighthouse, the sternwheeler) and a landmark whose card was withheld draw no heading, so
  there the line names the level only. The names are joined by a dot that is `aria-hidden`. The line is neither
  the dialog's name nor its description. **No copy was written:** both names already exist, and `COPY_GAPS` is
  unchanged at 59.

### 4. High contrast fills what is on, and a switch has a shape

In high contrast, a switch or radio that is not chosen is paper with an ink edge, and a chosen one is solid ink
with paper words. The same holds for a pressed exam option. A chosen skin swatch keeps a paper edge.

Every switch now draws a **track**: a knob at the start and an outline when off, and at the end on a filled
track when on. It is used in Settings and by the exam timer, which drew a tick before. The track is drawn with
borders, so forced colours keep it. It follows `aria-checked` in the stylesheet, so it cannot disagree with what
a screen reader is told. It is `aria-hidden`, because the word On or Off beside it is what is read.

The focus halo is restored on a focused or highlighted switch, radio or pressed option. The chosen-state rules
came after the focus rule and had removed it.

### 5. Menus hug their items

- The level menu is a sheet over the paused level, with its items directly under its title, and Close is quiet.
- The exam menu hugs its items with the night behind it, because the exam is not a level to dim.

### 6. The passport presses the stamp it earned

An earned slot draws the completion card's stamp (`createStamp`, ADR-0041), inked and smaller, beside the word
"Earned". It is `aria-hidden` and adds nothing to the slot's label or its Tab stop. An unearned slot draws no
stamp and fetches nothing.

`ScreenArt` gains `learnStamps(levelIds)` and `stampOfLevel(levelId)`. They read an earned level's points of
interest through the level catalogue and apply `stampLandmark`, so the passport presses the same landmark the
card did. Halifax and Toronto each have two landmark images, so the manifest alone could not choose. The
passport opens at once and redraws once when a stamp it did not have arrives.

### 7. Polish

- **Exam steps.** Previous and Next share a row while both words fit, and stack at large text. A disabled
  action is a dashed paper outline with no lift.
- **The time limit.** "30 minutes" is drawn inside the timer switch, under "Use the timer", as the switch's
  value. It is no longer a paragraph beside "No timer".
- **Text size.** Its label and its value share a line, with the label wrapping inside its own box. The slider
  has a 2 rem thumb on a drawn track.
- **Switches.** A switch reads label, track, state. At 100 % they share a line. At large text the label takes
  a line of its own, so its longest word fits whole, and the track sits beside its word on the line below. A
  track placed before the label, squeezed beside it, split "mouvement" and "Déplacement" at 200 % in French.

## Budget impact

| cost | size |
|---|---|
| Main chunk | 809.87 → 823.81 kB raw (+13.9), 208.69 → 211.98 kB gzip (+3.3) |
| Precache | 3 611.4 → 3 625.3 kB |
| Passport stamps | one level document chunk per earned level not yet read this session (precached), plus that level's landmark image, already cached when the level was played |

No level's payload or decoded texture total moved.

## Consequences

- **Unit tests:**
  - new: `tests/unit/ui/readability.test.ts`, `tests/unit/ui/question-card-layout.test.ts` and
    `tests/unit/bootstrap/level-stamps-and-place.test.ts`;
  - changed: `tests/unit/ui/hud.test.ts` (the order, and a new test for a task arriving after the paragraphs).
- **A11y:** `tests/a11y/readability.spec.ts` is new. It scans every changed screen in English, French, 200 %
  and high contrast, and under forced colours. It also measures:
  - the audited HUD case;
  - "Next" in view after answering;
  - the menus and the question card hugging their content;
  - the passport stamp;
  - the high-contrast fills and the knob's place;
  - the creator's halo;
  - no automatic hyphenation.
- **Harness** (`tests/a11y/harness.ts`):
  - `?over=card` draws the card as a level asks it: a sheet with a place line, and `?answered=` works there;
  - `?where=1` adds the place line to the standalone card;
  - passports draw a stamp under `?art=fixture` and `?art=real`.
- **E2E:** `study-and-settings.spec.ts` asserts "Next" is in view and focus is on the result.
  `exam.spec.ts` asserts the limit is inside the timer switch.
- **Test ids:** `question-place` and `passport-stamp-art-<levelId>` are new (`docs/stories/README.md`).
- **Owed:** the unit, a11y and e2e suites were not run locally; CI runs them. The residual HUD pairs above need
  the product owner's choice.
