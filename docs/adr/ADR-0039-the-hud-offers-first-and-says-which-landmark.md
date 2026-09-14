# ADR-0039: The HUD offers first, says which landmark it offers, and a finished game says nothing about readiness

- Status: Accepted (2026-09-14)
- Amends: `docs/stories/TN-REACH-what-is-in-reach.md` (the order of the hint and the prompt, what "done" means,
  the hint's wording, and per-target rows for landmarks); `TN-HUD-hud-and-menu.md` (`TN-HUD-08`, the strip's
  order at 200 %); `TN-MAP-level-select.md` (`map.levelsReady`, and the finish-first sentence);
  `TN-PASSPORT-my-passport.md` (`map.levelsReady` on the passport); `TN-EXAM-starting-and-answering.md` and
  `TN-RESULT-exam-results.md` (`exam.subjectsReady`, `exam.subjects.help`).
- Does not amend: `TN-NAMES-naming-real-places.md`. No name on its list reaches the HUD.
- Slice: F2 (accessibility pass), from the live-site audit of 2026-09-14.

## Context

A live-site audit on a 390 × 844 phone found five things wrong with what the game says and where it says it.
Every one of them passed the suites that existed.

1. **At 200 % text the HUD pushed its own action off screen.** The strip is capped at a third of the viewport
   (278 px) and scrolls inside itself. Its order was mode, task, warning, notice, hint, then the prompt and the
   two controls. Halifax in French at 200 %: the hint filled the strip, its words were cut off at the strip's
   edge, « Parler au guide » was below the fold, and at spawn Menu was already cut off. `TN-HUD-08` says every
   label is visible "by scrolling inside hud if needed", and that sentence was true while the one thing the
   player came to press was the thing they had to scroll to.
2. **"Look at this place" named nothing, on almost every landmark.** `OQ-REACH-4` recorded the cost — a player
   who cannot see the mark is never told which landmark is in reach — and recommended per-target rows for every
   landmark whose name is not on `TN-NAMES`'s list. Only Parliament Hill had one.
3. **"Done. See this one again" was drawn about a guide who had just given the player a task.** The prompt's
   "done" was "engaged in this sitting", so accepting a quest marked its giver done in the same move, and the
   button read as the task being complete.
4. **The hint said "something to see" when the first thing in reach was somebody.** On Halifax, the level the
   game opens on, that is the guide.
5. **Two templates and two build reports reached players.** `map.locked.after` drew "Finish The Prairies
   first." and « Terminez d'abord Les Prairies. »; the map, the passport and the exam screens drew
   "Levels ready: 10 of 10", "Subjects ready: 10 of 10" and "This exam only asks about the subjects that are
   ready" on a build where everything is ready.

## Decision

### 1. The strip draws what the player can do first

The HUD's children are, in order: the prompt, Settings and Menu, the storage warning, the notice, the mode and
the task, and the hint. The DOM order is the visual order, so reading order and focus order match what a
sighted player sees. A new prompt scrolls the strip back to its top.

It stays **one** scroll box. Two alternatives were refused:

- *A text-only scroll area above pinned controls.* A scrollable region with nothing focusable in it fails axe's
  `scrollable-region-focusable`, and making the paragraphs focusable to pass it would put the hint in the Tab
  order, which `TN-REACH-04` forbids.
- *A sticky footer over scrolling text.* Text passing under an opaque footer is text axe cannot compute the
  contrast of, which `tests/a11y` reads as a failure.

**The space around the text holds still at large text.** The HUD's padding, gaps, borders and its controls'
minimum size are `calc(Nrem / var(--tn-text-scale, 1))`: the same CSS px at every scale. The words still grow to
200 %, and a control still grows with its label. Settings and Menu share one row. The unit suite holds such a
minimum to the same 2.75rem (44 px) floor as a plain rem one. The same technique gives map cards and every
sheet their line width back at 200 %. The journey rail is deliberately left growing with the text, because
`tests/a11y/shell.spec.ts` asserts it does.

### 2. A landmark that opens a card is named in its prompt, unless its name may not be

Every landmark gets a per-target row, `hud.interact.<id>`, under `TN-REACH`'s existing rule 2. The only
exceptions are a name on `TN-NAMES`'s list and a landmark that gives a quest. Examples: "Look at the Halifax
Town Clock" / « Regarder la Tour de l'horloge d'Halifax », "Look at the market stall" / « Regarder l'étal de
marché ». There are twenty-seven rows, **written out and never interpolated** from `pois[].name`: the names carry
capital articles, indefinite articles and none at all. A template would draw "Look at The canal locks" and
« Regarder Tramway ».

The generic row stays for:

- the five names on `TN-NAMES`'s list: Pier 21, the Château Frontenac, the CN Tower, Canada Place and the
  Canadian Museum for Human Rights;
- Peggy's Point Lighthouse and the Yukon River sternwheeler, whose prompt is `hud.interact.poi.offer` and whose
  stories keep their names out of the HUD.

`tests/unit/ui/copy.test.ts` reads the level and quest documents and fails a landmark with no row, a listed or
giving landmark with one, and a row for a target no level places.

### 3. Engaged is not finished

A target is drawn as done when it was engaged in this sitting **and** nothing is left to do there. Two things
still count as work:

- a giver whose quest is not completed (on offer, declined or running) — `QuestController.hasUnfinishedQuest`;
- a landmark a running quest's step is waiting for — `awaits`.

Such a target keeps its own prompt. A giver's prompt becomes "Done. See this one again" when its quest is
completed. The wording of `hud.interact.done` is unchanged.

A giver whose quest has no saved state at all counts as unfinished too. Such a giver is still on offer, so its
own prompt is the true one. A giver that cannot be offered — no opening line this build may say — gets no
prompt at all, because `canEngage` is false, so it is never drawn as "Done" by mistake either.

### 4. The hint is true of someone as well as something

"A mark shows someone or something you can choose. Get close, then choose." / « Un repère montre quelqu'un ou
quelque chose à choisir. Approchez-vous, puis choisissez. » It still names no input and no kind, and still uses
the single-switch contract's word.

### 5. A level-keyed sentence is written out, and a complete game reports no readiness

- `level.<id>.finishFirst` is written per level in both languages. `map.locked.after` remains only for a card
  with no id.
- `map.levelsReady` is drawn only while some level is not made, on the map, in its arrival announcement and in
  the passport. That is the rule `map.moreComing` already followed.
- `exam.subjectsReady` and `exam.subjects.help` are drawn only while some subject has no questions.

### Copy status

The reworded hint, the twenty-seven landmark prompts and the ten finish-first sentences were written by
`app/ui`. They are declared in `COPY_GAPS` as proposed rows in `TN-REACH` and `TN-MAP` until those stories'
owners ratify or replace them, so the gap list is pinned at 52.

## Consequences

- `tests/a11y/level-screens.spec.ts` asserts the prompt, Settings and Menu are inside the strip's visible box
  at 200 % in French with the dyslexia font, the hint, the task, the notice and the storage warning all on it.
- `tests/e2e/study-and-settings.spec.ts` looks for the start level's landmark prompts rather than for "Look at
  this place". `tests/e2e/level-quest.spec.ts` walks past a giver whose quest is running, as it already walked
  past one that was done.
- Every new landmark needs a row, or the unit suite fails. That is the intended cost: a landmark the prompt
  cannot name is a landmark a blind player is not told about.
- The strip's order changed for every player, not only at 200 %. At 100 % the offer and the controls now sit
  above "Walking" and the task. That is the same information in an order that survives the case where not
  everything fits.
