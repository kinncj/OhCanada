# ADR-0042: The band below the ground is dressed by a strip drawn over the fill

- Status: Accepted (2026-09-14)
- Slice: A1 (level art polish, live-site audit of 2026-09-14).
- Builds on: ADR-0002 (portrait composition), ADR-0020 (a level names its art, the manifest prices it), ADR-0031
  (a ride's track is drawn over the ground), ADR-0011 (the visual tier).

## Context

A live-site audit photographed every level at its spawn at 390 × 844. On all ten, **the lower quarter of the
screen was one flat colour** below the walking line, and the action sat in the upper middle. At that size the
canvas is 693 CSS px tall with 75 px of letterbox above and below it. The HUD covers the canvas below about world
row 1813 when no prompt shows, 1439 with a prompt and a hint, and 1357 at 200 % text. So between the player's
feet at 1280 and the HUD there were up to 533 design rows of nothing, and always at least 77.

The art agent traced three causes and recorded them in `docs/plan/slices.md` (A1). Each one rules out a fix
that stays inside art or camera tuning:

1. **Nothing a level declared could draw there.** `level-scene.ts` paints the ground polygon opaque at depth 400,
   from the polyline to the bottom of the world, over every parallax layer at depth 100+. The art bible said so:
   "Nothing you draw below the ground line will ever be seen." Two shipped layers were drawn for that band anyway,
   Ottawa's ice and Québec City's run, and show 30 and 0 of their rows.
2. **`camera.offset.y` does nothing.** Every level's `size.y` equals the design height, so the vertical scroll
   clamps to 0.
3. **Zoom only moves the problem.** Zooming in shrinks the band by pushing the player below two thirds of the
   canvas, against ADR-0002's composition, and crops the landmark heroes.

One more fact decided the shape of the answer. **The ground is a polyline, and one level's ground falls away.**
Ottawa's is flat at about 1240 to x 6000 and then drops to 1470. Anything fixed to one world row either hangs
in the air over the low stretch or leaves a gap under the high one.

## Decision

### 1. A level declares a `groundDressing`, required

`level.schema.json#/$defs/groundDressing`, mirrored by `GroundDressing` in
`app/application/ports/content-repository.ts` and bound by `ports-match-schemas.test.ts` through its title:

| field | what it says |
|---|---|
| `key` | Texture key of a 1x-pinned source under `assets/src/svg/<levelId>/`. The texture's width is the tile. |
| `topY` | The world row of the strip's first row. |

It is **required, with no default**, for the reason `weather` and `playerCostume` are. The default is the flat
band, and every level has that band, because the art bible puts every ground line near 1280.

### 2. The strip starts at or below the ground's lowest point

A strip is fixed to one row and the ground is a polyline, so the one placement that is under the ground
everywhere is **at or below the polyline's lowest point**, its largest y. Nine levels are flat at 1280 and start
their strip there. Ottawa starts at 1470. JSON Schema cannot compare a number with an array, so
`groundDressingProblems` in `app/adapters/phaser/ground-dressing.ts` states the rule once. The parser refuses a
level that breaks it, and `level-art-is-placed-where-it-is-drawn.test.ts` refuses it in CI against every level
on disk.

### 3. It is drawn over the ground, under every actor, at every tier, with the world

- **Depth.** Over the fill (400) and its sheen (401) at `DEPTH_GROUND_DRESSING` 402. The ride track moves to 403,
  so a train's rails and the horse's trail run across the strip. Every landmark and character draws above it.
  `depth-plan.test.ts` holds the order.
- **Over the sheen**, because the sheen is a tier-gated wash, and the strip's colours are the art sheet's at
  every tier.
- **Not a parallax layer and not given to the tier**, like the ride track (ADR-0031). The tier drops layers, and
  a dropped strip puts the defect back.
- **No parallax rate.** It is one screen wide and moves by its tile offset at exactly the camera's x, as a
  repeating band and the ride track do. On nine levels its first row is the surface under the player's feet, and
  a surface moving faster than the feet on it reads as sliding. It has no independent movement, so reduced motion
  has nothing to pin.

### 4. The strip is opaque, runs to the bottom of the world, and replaces the fill it covers

A strip that drew over the whole fill would add up to a third of a screen of overdraw on every level, and the
Ottawa perf lane measures the high tier against 4×. The fill under an opaque strip is painted and covered in
the same frame, so the scene stops painting it there:

- **Opaque.** `scripts/assets.mjs` reads every dressing back from the WebP that ships, and refuses the build if
  any pixel of its art is not fully opaque.
- **To the bottom of the world.** `topY` plus the art's height equals `size.y`, asserted by the contract test.
- **The fill stops at `topY`.** `groundFillFloor` returns `topY` only when the strip's texture loaded and reaches
  the bottom. Otherwise it returns the world's height, so a strip whose art did not load leaves the band as it
  always was, never a hole. The sheen is clipped to the same floor.

On a flat level the strip's quad is the 640 rows of fill it replaces, and the 34-row sheen it covered is gone,
so overdraw is unchanged or lower. On Ottawa at the spawn the fill was 680 rows. It is now 230 rows of fill and
450 of strip.

### 5. The first rows carry the detail

The HUD owns the bottom of the canvas. A strip keeps its most legible detail in its first ~160 rows, which stay
visible above a prompt. It uses larger, calmer shapes below, where only a player with no prompt and 100 % text
sees them.

### 6. It is observable

`data-ground-dressing-drawn` on the scene probe is `false` when the strip's art did not load, and the scene prints
a sentence. There is no count to pair it with, because every level has exactly one.

### 7. The art

Ten strips, `assets/src/svg/<level>/ground-<name>@1x.svg`, each 1080 wide: one tile per screen, so nothing repeats
inside one view. They are palette colours only, with no outline and no lettering, and generic by construction.
Each continues its level's nearest layer toward the viewer, and each level's art sheet records what it draws.
Every one takes the layers' four transparent foot rows (`scripts/assets.mjs`), because its top edge sits on the
walking line, where a TileSprite would otherwise wrap a hairline in the colour of its last row.

## Alternatives considered

- **Anchor the canvas lower on phones taller than 9:16.** It moves the 75 px letterbox from under the canvas to
  above it, and does nothing about the 640 rows inside the design. It also puts the canvas's bottom under the HUD
  on exactly the phones where the HUD is proportionally shortest. Rejected as a fix; it is a separate question
  about the letterbox, and the HUD covers that band at every text size today.
- **Zoom, or a camera offset.** See Context 2 and 3.
- **Let parallax layers show below the ground: drop the fill, or draw layers over it.** The fill is what makes the
  ground a surface at every tier. `selectLayers` ranks layers by the screen they cover above the ground, and the
  tier drops layers. A band that the low tier removes is the defect on the phones most players have.
- **Hang the strip from the polyline** (vertical slices, a Rope or a mesh following the ground). It is correct on
  slopes and costs one object per slice on the one level with a slope. The perf lane's census decodes quads and
  TileSprites and fails a draw it cannot decode. The lowest-point rule costs Ottawa 230 rows of ice fill on its
  high stretch, and nothing on nine levels.
- **A faster-than-world rate for a foreground feel.** See 3. It can be added as a field on the day a level has a
  strip whose first row does not meet its walking line.
- **A nullable field, `null` for plain fill.** No level has a reason to choose it, and a field no level uses is a
  code path nobody runs.
- **Procedural detail in `Graphics`.** It would be the same pattern on ten levels, and invented rather than drawn
  from each place (CLAUDE.md, Art).

## Consequences

- **A level is still addable by JSON and assets alone.** A new level names its strip and draws it. The parser, the
  contract test, `make assets` and the payload gate each say what is wrong with it.
- **Decoded texture per level rose by the strip:** 2.65 MiB at 1080 × 644 on nine levels, and 1.87 MiB at
  1080 × 454 on Ottawa. `alberta-foothills` went from 31.18 to 33.83 MiB and would have been at 94 % of 36.
  `halifax` went to 30.11 and `toronto` to 30.02, both 88–89 % of 34. As ADR-0031 did for the Prairies, their
  declared budgets rise to **40, 36 and 36 MiB** (85 %, 84 %, 83 %) rather than let a margin halve in one change
  that nobody measured. No level is near the 64 MiB ceiling.
- **Overdraw is about unchanged**; see 4. The medium Ottawa reading was 2.66×.
- **Ottawa's high stretch keeps 230 rows of ice fill** between the walking line and its bank, from the
  lowest-point rule. The lane reads as ice between two banks, which is what the Skateway is.
- **Two layers are still drawn under the fill**: Ottawa's `layer-60-ice` and Québec City's `layer-60-slope`, the
  art that was made for this band before anything could show it. They show what they showed before, and cost
  3.08 MiB each. Deleting them is a level-art change for their owners, recorded in the plan rather than made here.
- **The strip is not tinted by the time of day**, exactly as the layers above it are not (A1). It now matches the
  layers at the walking line where the fill did not.
- **The art bible's §6 rule is amended**: layers still cannot draw below the ground line; the ground dressing is
  the one thing that does.
