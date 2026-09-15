# ADR-0049: A mark points at its subject's art and keeps off the player, and a stop keeps a ride off a character's feet

- Status: Accepted (2026-09-15)
- Slice: A7 (markers and overlaps, second live-site audit of 2026-09-15, P2 #17).
- Amends: ADR-0037 §4, "which side". A side is taken only where the ride's art, read from the textures it
  shows at rest, does not cross a character's feet. The footprint (§5) is unchanged.
- Builds on: ADR-0031 (a ride is level art), ADR-0032 (a drive stops at each subject), ADR-0035 (ride frames).

## Context

A second live-site audit at 390 × 844 and DPR 3 found four defects around the tappable marks and the things
they stand over. Each was reproduced on a local build of `audit2-fixes` before anything changed
(`scratchpad/renders/markers/before/`). Each was measured with the real modules and the art rasterised at 1x,
as `make assets` rasterises it.

**1. Hollow rings float in empty sky** (Québec City and Toronto at the spawn). A mark's centre sat
`26 + size / 2` above the top of its subject's **rectangle**: the texture's bounds for a landmark,
`characterSpace` for a character. Neither is the art. `characterSpace` starts 40 px above the guide's crown and
26 px above the officer's hat, and a texture's top row is only its tallest part. At the phone's 122 px mark, the
point of the mark was:

- 55 px above the guide's head;
- 35 px above the Château Frontenac's spire;
- 133 px above Nathan Phillips Square under its centre;
- 449 px above the grain elevator's roof.

The idle ring has no chevron, so it read as a ring in the sky rather than a mark on anything.

**2. At the North's sternwheeler the pin covers the player's face.** A drive rests level with a landmark
(ADR-0032). The landmark was lower than the player, so a mark a fixed height above its art was drawn where the
player's head is. It was not only the sternwheeler:

- in the mode each level opens in, 7 marks on 5 levels overlapped the player's head at a stop: the canal locks,
  the warming hut, the granite shore, the sternwheeler, the driftwood, the streetcar and the cargo ship;
- over every mode the levels declare, 12 did.

**3. The sternwheeler is drawn shorter than the player.** The hero is 920 × 280, with its hog posts 262 px above
the gravel; the player is 420 px tall. It was sized to the camera frame at the stop, about x − 456 to x + 624. At
the reference's length of 9.7 hull depths, a vessel that fits that frame can be at most about 280 px tall.

On `refs/the-north/sternwheeler-broadside.jpg` the gangway railing is 27 px against the art sheet's hull depth
of 105 px, so a person there is about 0.42 hull depths tall. At 920 × 280 the drawing compressed the vessel about
eleven times against its figure. Every other hero the player stands in front of reads as taller than the player.

**4. The Alberta guide stands on the horse's head.** ADR-0037 gave the horse a saddle-only footprint, x 186 to
342, and rested the rider short of the guide at 1 014. Across that stop's landing, 4 119 to 6 558 of the guide's
7 104 foot-window pixels lay under horse art. On the drawing, the horse's art reaches the walking line (art row
90) over columns 310 to 544: the neck, the head and the ears. The footprint was honest, because nobody was in
the saddle, and the picture was still wrong: a contour that crosses a figure's feet reads as the thing the
figure stands on.

## Decision

### 1. A mark points at the art under it

`app/adapters/phaser/art-silhouette.ts` holds the top of the drawn art in every band of 4 columns:

- **a landmark's** comes from its texture's alpha, read once when the level is built, through a 2D canvas that
  is dropped at once. No GL texture is made, so nothing lands on the decoded-texture budget, and there is no GPU
  readback;
- **a character's** comes from the rig's frame windows (`figure-extent.ts`), placed as the renderer places them;
- **a placeholder** keeps its rectangle.

`interaction-affordance.ts` puts the mark's point, the ready chevron's tip, `MARK_GAP_PX` (12) above the highest
art under the mark's own width. Where the rectangle's middle holds no art, the mark moves to the nearest art.

### 2. A mark keeps off the player's head wherever a stop holds them

`mark-clearance.ts` gives each subject the boxes the player's head fills at every place a stop can leave them:
travelling right and travelling left, from the aim to one landing slack short of it. The head is the rig's own:

- the head parts, over every option the creator offers;
- both as authored and through every keyframe of the mode's idle pose;
- moved by a ride's seat.

A mark that would overlap one of these boxes moves along the art in quarter-mark steps. It takes the nearest
place first, and at equal distance the higher place, then the right-hand one. Only when nowhere on the art is
clear does it rise above the head.

On the shipped levels, with the art as it is today, two marks move sideways and one rises:

- the sternwheeler's mark moves 153 px along the hull;
- Québec City's guide's mark moves 31 px, for the toboggan rider;
- Ottawa's officer's mark rises 20 to 24 px, because a skater's forward-leaning head comes within 3 px of it.

### 3. A mark shows only while the column it points at is on screen

Half a ring at the edge of the glass, pointing at something off it, is a mark for nothing. `data-affordances`
still counts every mark, as it always did.

### 4. A stop never rests a ride across somebody's feet

The scene reads the ride's silhouette, one band per column, in each texture it shows at rest: the rest frame,
and the still that reduced motion holds. `stand-off.ts` takes a side, short of the character or past them, only
if, over its whole landing, the character's feet are either:

- **wholly clear** of that art; or
- **wholly hidden** behind art that reaches the walking line across the whole width of their body. That is a
  flank, and it is how the Prairies guide stands beyond the Park car (ADR-0031 §3).

When no side in reach passes, the first side in reach is taken, as before.

With the level document unchanged, the horse now rests past the guide, with him behind its rump:

- from the spawn it comes to rest at 1 386, 186 px from him in a 280 px reach, 18 px clear of his body;
- the rump's top edge is 15 px below his soles;
- heading left it rests at 1 027 to 1 051;
- none of his foot pixels are under horse art at any of those places.

The Prairies are unchanged: his feet are behind the car's flank at every place its stop can land.

`a-stop-rests-beside-a-character.test.ts` holds this for every ride and every character, pixel by pixel on the
rasterised art, at every place the stop can land. It also holds a clearance margin: the arithmetic keeps
`STAND_OFF_GAP_PX`, and a real drive keeps at least half of it.

### 5. The sternwheeler's scale is owed to its art, and is not changed here

A point of interest has no placement scale in `content/schemas/level.schema.json`, and the engine draws a
landmark's texture at the size its source was authored. So the fix is an asset change, which belongs to the
art owner, and this slice does not edit `assets/`.

It was measured before being handed over. Scaling the drawing 2.5 times inside one group keeps every ratio in
§6 of `assets/style/the-north-level.md` exact. The file becomes 2 300 × 700, with the hull 215 px deep (about
half the figure) and the posts 655 px above the gravel. `make assets` then reads the-north at 30.34 of
36.00 MiB decoded (84 %, from 25.18), with a payload of 0.87 MiB (from 0.85). At the stop the vessel is cropped
by the frame, as Parliament Hill and the Château Frontenac are; the paddlewheel is on screen on the approach and
on the landmark's card.

Marks follow the art whichever size it is drawn at. At 2 300 × 700 the sternwheeler's mark sits centred, 12 px
above the vessel and clear of the player.

## Alternatives rejected

- **Draw the guide over the ride.** The horse runs on a nearer line. A farther figure drawn over a nearer animal
  floats in front of its neck, and the depth plan's promise that nothing sits between a character's parts would
  need an exception.
- **Move the guide, or turn him.** Placements are the art sheets' and were composed around the landmarks.
  ADR-0037 §5 kept every placement, and so does this.
- **Widen the horse's `footprint` in the level document to the ears.** Measured, it gives the same rests. It is
  a number typed into every animal's document that its author must remember, while the art already says where
  the head is. ADR-0037 measures bodies rather than typing them, and this measures the ride the same way.
- **Always draw a mark above the player's head.** Over a landmark lower than the player the mark would float
  again, which is the first defect.
- **Silhouettes computed at build time into the manifest.** Exact, but it adds a manifest field, a loader path
  and bootstrap wiring. The read at level build is one pass over each texture's own pixels.
- **A placement scale on a point of interest.** A schema field and an engine change, to fix one picture whose
  source is vector.
- **Tune `reachPx` so the horse can stop short of the guide.** The head reaches 286 px ahead of the rider, so
  stopping short would need about 390 px of reach, which would offer every landmark from off screen.

## Consequences

- **Budgets.** No texture, file or draw call is added. The per-frame work is unchanged: marks are placed on a
  change of reach, and each frame pays a pulse and a visibility test.
- **Cost at level build.** One alpha read per landmark with art, at most 1 080 × 1 040 RGBA (4.5 MB, freed at
  once), and one per ride texture shown at rest, at most 1 420 × 590.
- **Tests.** New:
  - `art-silhouette.test.ts`, `figure-extent.test.ts` and `mark-clearance.test.ts`;
  - `tests/unit/contracts/a-mark-sits-on-its-subject.test.ts`, which holds every mark on every level, at three
    mark sizes, on its art and off the player's head, and shows the old placement failing both.

  Changed:
  - `interaction-affordance.test.ts` gains the placement rules;
  - `stand-off.test.ts` gains the allowed-side rule and `rideCrossesFeet`;
  - `a-stop-rests-beside-a-character.test.ts` adds the feet contract, two negative controls and the clearance
    margin.
- **Owed.**
  - The sternwheeler's scale, by its art owner, as measured in §5.
  - A blind `make verify-art` run for `paddlewheel-riverboat` and `ranch-horse`. Neither has a verdict, so
    nothing here goes stale.
