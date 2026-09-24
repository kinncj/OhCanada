# ADR-0072: The dyslexia strip may grow past a third, and the player stays above it

- Status: Accepted (2026-09-24). **Decided by the product owner on 2026-09-24.** This record writes the
  decision down with the measurements it was made on and the ones taken after it was built.
- **Amends ADR-0066 §3** in one respect, for the dyslexia face only. The bullet "Letting the strip grow
  past a third of the viewport at large text is refused" still holds for every player who has not turned
  the dyslexia toggle on. With the toggle on, the strip may grow past a third, up to a ceiling set by where
  the player stands (§2 below). Nothing else in ADR-0066 changes: the offer and the task still take turns,
  the task is still drawn at the size the slider says, and the word "Task" is still drawn.
- **Discharges ADR-0071's obligation due 2026-10-21, owner `architect`**: "the dyslexia strip at 200 % text
  … decide the way out, land it, and set `DYSLEXIA_200_BELOW_THE_STRIP` to zero".
- **Amends `TN-HUD`**: the "upper two thirds" rule in `TN-HUD-01`, `TN-HUD-03` and `TN-HUD-08`, and the
  "not allowed to grow past a third" line in `TN-HUD-08`. These now have a dyslexia-mode clause with the
  measured numbers.
- Slice: F2k (ADR-0066), the dyslexia strip.
- Numbering. `git log --all --name-only -- docs/adr` over every ref this checkout can see, after fetching
  `claude/fervent-dijkstra-vxyz3k`, puts the high-water mark at 0071. No ref names a 0072. **0072 is the
  first number above the mark.**

## Context

OpenDyslexic draws about 1.5× the width of Atkinson Hyperlegible (ADR-0071 §4). At 200 % text on a
390 × 844 phone, a task in that face wraps to six lines. "Settings" and "Menu" (« Réglages » and « Menu »)
no longer fit on one row, so they take two. ADR-0066 §3 caps the strip at a third of the screen, which is
278 px. The offer, the two controls and the task then need more room than that.

ADR-0071 §5 measured it on 2026-09-23 and held the count as a ratchet. Since then, the 13 new read steps on
Prairie Rail, Ottawa, Winnipeg and Alberta have raised the count. Measured on this branch before the change,
by the same sweep (`tests/a11y/readability.spec.ts`, every level's tallest offer and all 94 task steps):

| language | tallest offers with the task's count below the strip | tasks below the strip |
|---|---|---|
| English | 3 of 10 (ADR-0071: 2) | 31 (ADR-0071: 30) |
| French | 4 of 10 (ADR-0071: 3) | 59 (ADR-0071: 45) |

At 100 % every row fits, and still does.

So ADR-0066's original defect, the task below the fold at 200 % text, was back for the players who turned on
the dyslexia toggle. ADR-0071 §5 lists four ways out and leaves the choice to the owner.

## Decision

**With the dyslexia toggle on, the HUD strip may grow past a third of the screen, so that the full task and
offer rows stay readable and nothing is cut.** In normal mode nothing changes.

### 1. Why this way out and not the other three

ADR-0071 §5 lists four candidates:

- **Let the dyslexia strip grow past a third.** Chosen. It is the only candidate that keeps every word of
  the task on screen at the size the player chose, in the face the player chose. The cost is playfield
  height, and only for players who turned the toggle on (§3).
- **A dyslexia-specific strip layout.** Not chosen. Every rearrangement we found still stacks the same
  rows. Settings and Menu on one row saves one row at most, and only if « Réglages » is squeezed or cut,
  which ADR-0066 §3 refuses. A second layout would also be a second strip for every later HUD change to keep
  in step with, and it would still not fit a six-line task into 278 px.
- **A narrower dyslexia face.** Not chosen. ADR-0071 records that no other dyslexia face could be found
  under OFL-1.1 or more permissive, with French accents, at two weights. A plain legibility face would
  bring back the defect ADR-0066 set out to remove: a toggle that changes only the spacing.
- **Taking back the 0.02 em letter-spacing and 0.08 em word-spacing.** Not chosen. It would save about one
  line on the longest tasks, not three, so it does not reach zero. It would also take away spacing that
  players with dyslexia use to read.

ADR-0066 §3 refused growth for everyone because a strip at about 45 % of the screen covers the level,
including the landmark the player is walking to. That argument still holds for everyone else. For this
group the alternative is worse: the sentence is not delayed by a step, it is cut off at the bottom of the
screen until the player scrolls a box they may not know is there. The owner accepts the playfield cost for
the players who asked for the face.

### 2. The new ceiling, and the player stays above it

`TN-HUD-01` says the skater is drawn inside the upper two thirds. Every level spawns the player on world
row 1280 of 1920, so the player's feet stand on the two-thirds line of the canvas. A strip that grows past a
third on a canvas that stays where it is would cover the player's feet. So two things change together,
only with the dyslexia face on and only while a level is running:

1. **The canvas sits at the top of the space it is fitted in, not in the middle.** It stays the same size
   and nothing of it is cut. On a phone taller than 9:16, the band of flat sky that was above the canvas
   (75 px at 390 × 844) moves below it, under the strip. The letterbox gradient follows, because
   `--tn-canvas-top` is redeclared on `:root`, where `index.html` and the scene's sky stops read it.
2. **The strip may reach up from the bottom of the screen to 8 px under the player's feet**, that is to
   two thirds of the canvas, less a small clearance so a sliver of ground stays visible under them. The
   ceiling is never lower than a third of the screen, which is the normal-mode cap.

The ceiling depends only on the size of the viewport, not on what the strip says. So the canvas does not
move when an offer comes or goes. Nothing is animated, so reduced motion is unaffected.

**Measured at 390 × 844, 200 % text, dyslexia face, 2026-09-24:**

| | normal mode | dyslexia mode |
|---|---|---|
| canvas top | 75 px | 0 px |
| player's feet (world row 1280) | 537 px from the top | 462 px from the top |
| strip ceiling | 278 px, 33.0 % | **374 px, 44.3 %** |
| what the offer, controls and task need, worst case | not applicable | 362 px, 42.9 % (a six-line task); 341 px, 40.4 % (a four-line offer with the task's count) |
| strip drawn on Halifax, longest task, nothing in reach | 236 px | 374 px: the task ends 25 px inside it, and only the mode label below it scrolls |
| strip's top edge, at the ceiling | 565 px | 470 px, 8 px under the feet |
| rows below the strip, English | 0 | **0 offers, 0 tasks** (was 3 and 31) |
| rows below the strip, French | 0 | **0 offers, 0 tasks** (was 4 and 59) |

At 100 % text, the dyslexia rows need at most 153 px (18 %), so the strip there is content-sized and much
lower than its ceiling.

Other viewports, measured on Halifax with the longest French task, dyslexia face, 200 %:

| viewport | canvas | strip | task inside the strip? |
|---|---|---|---|
| 430 × 932 | top 0, 764 tall | 313 px, 33.6 % | yes, 59 px spare |
| 1440 × 900 (desktop) | fills the height | 297 px, 33.0 % (ceiling = a third) | yes, 43 px spare: the strip is 506 px wide |
| 390 × 664 (a phone browser with its toolbars showing) | fills the height | 219 px, 33.0 % | **no, 129 px below** |
| 360 × 640 (9:16) | fills the height | 211 px, 33.0 % | **no, 137 px below** |

### 3. What the player loses

**Playfield height, and nothing else.** With the strip at its ceiling on a 390 × 844 phone, 462 px of the
canvas shows above the strip instead of 490 px. That is 66.7 % of the canvas instead of 70.7 %. The screen
the strip takes grows from 33 % to 44 %. What goes under it is the ground in front of the player's feet: the
boardwalk, the ice, the track. The sky and the landmarks stay in view, and the player is always drawn whole
above the strip. The empty band of flat sky above the canvas is gone, and that band showed nothing.

A player in normal mode loses nothing. A player with the dyslexia face at 100 % text gets a strip that is
content-sized and almost always below a third.

### 4. What this does not fix

- **A viewport with no letterbox under the canvas** (9:16 or wider, and phone browsers whose toolbars take
  the height: 390 × 664 above). There is no band to move, so the ceiling is a third, as in normal mode. The
  longest dyslexia tasks at 200 % still end below the strip there. Growing further would cover the player
  unless the canvas were also lifted and its sky cut off at the top. That is a larger trade than the owner
  decided here, so it is left as an obligation below.
- **Ottawa east of x 6000**, where the ice drops to row 1470, stands the player below the two-thirds line.
  This was already true in normal mode (the feet are about 40 px under a 278 px strip there). This record
  does not change it and does not make it worse. The sweep and the new e2e measure at the spawn row.

## Alternatives considered

- **Size the ceiling to the rows in JavaScript and move the canvas to match.** Rejected. The canvas would
  jump each time an offer came or went, which is a motion the player did not ask for and which reduced motion
  cannot turn off. The static ceiling holds the worst case with 12 px to spare at 390 × 844.
- **Lift the canvas past the top of the screen, cutting the sky, on every viewport.** Not taken now. It
  would reach the viewports in §4. But it cuts part of the picture even on devices that do not need it, and
  it is a product decision the owner has not made. The obligation below carries it.
- **Grow the strip with no ceiling, to fit every row including the warning, the notice and the hint.**
  Rejected. With the storage warning up, the strip's content at 200 % is about 1 600 px, nearly twice the
  screen. The rows the player acts on (offer, Settings, Menu and the task) come first and fit under the
  ceiling. The paragraphs after them still scroll inside the strip, as `TN-HUD-08` already allows.

## Budget impact

None. There are no new assets, no new faces and no new scripts. The stylesheet gains three rules, and the
HUD sets one attribute on the canvas host. The engine refits its canvas when its host changes size, as it
already does on a resize, with no new code in `app/adapters`.

## Consequences

- `tests/a11y/readability.spec.ts`: the dyslexia tier's record is zero at both text sizes and in both
  languages, and it is asserted like the other tiers. Every tier also asserts that the strip's top edge
  never rises above the line the player walks on, and it records the ceiling, the drawn height and what the
  rows need.
- `tests/e2e/dyslexia-strip.spec.ts`: on Halifax, at 390 × 844, 200 %, dyslexia face, in English and
  French, with the longest task and then with the guide's offer, the player's feet (read from the scene
  probe and the canvas box) are above the strip. The strip is taller than a third. Every row the player acts
  on ends inside it.
- `TN-HUD-01`, `TN-HUD-03` and `TN-HUD-08` state the dyslexia-mode rule and its numbers.
- A later change to the strip's rows that adds more than 12 px in the dyslexia face at 200 % will fail the
  sweep. It will not quietly push the task back under the fold.

## Obligations

Written in ADR-0009's format.

- **OBLIGATION due=2026-11-20 owner=architect** — the dyslexia strip on a viewport with no letterbox under
  the canvas (§4: 390 × 664, 360 × 640). There, at 200 % text, the longest dyslexia tasks still end
  129–137 px below the strip, because the ceiling cannot pass the player's feet without lifting the canvas
  and cutting its sky. Decide whether the owner accepts that cut for dyslexia mode. Then either land it and
  add those viewports to the readability sweep, or record here why the residual stands.

## References

- ADR-0002: the portrait canvas, FIT at 1080 × 1920, and the horizon two thirds down.
- ADR-0009: the obligation markers above.
- ADR-0039: the strip's chrome holds still as the text grows.
- ADR-0066: the decision this one amends in §3.
- ADR-0071: the dyslexia face, its line budget in §5, and the obligation discharged here.
- `docs/stories/TN-HUD-hud-and-menu.md`: `TN-HUD-01`, `TN-HUD-03`, `TN-HUD-08`.
- `app/ui/screen-styles.ts` and `app/ui/hud.ts`: the rules and the attribute.
