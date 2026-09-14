# ADR-0035: A ride steps with the ground, not the clock

- Status: Accepted (2026-09-14)
- Amends: ADR-0031 — "Its own gait animation is still not expressible: a ride's layers are still images." A ride
  layer may now declare a `cycle` of frames.
- Closes: `OQ-RIG-2` in `assets/style/rig-contract.md`.

## Context

Since ADR-0031 the Alberta foothills player rides a saddled bay ranch horse, and its legs do not move. The ride's art
was one still image, drawn in a walking stride from Muybridge's plate 574, so the horse slid along the trail in one
pose while the ground went by under it. `assets/style/alberta-foothills-level.md` §14.4 recorded why the art pass
stopped there: a real walk needs a frame cycle on rides — a schema field, the port, the parser, `ride.ts`,
`level-scene.ts` — and that is a decision, not a drawing.

Three facts set the shape of that decision:

1. **The ride already counts distance.** `#rideDistancePx` in `level-scene.ts` sums `|velocityX| · dt` for the rock
   (`rideBobPx`), because a rhythm that follows the ground stays with the ground at every speed and is still at rest.
   A gait has the same needs, and a planted hoof is the most exact of them: it must stay where it was put while the
   body goes over it.
2. **Every layer of a ride shares one size and one registration.** One `riderAnchor` seats the rider in every frame
   only if no frame moves the seat.
3. **CLAUDE.md: "Reduced motion disables parallax easing, particles and squash-and-stretch."** A ride's rock is
   already zero under reduced motion by the engine's rule (ADR-0031 §2). Legs flicking through a cycle are the same
   kind of movement.

## Decision

### 1. A ride layer may declare a `cycle`

`level.schema.json#/$defs/rideCycle`, mirrored by `RideCycle` in `app/application/ports/content-repository.ts`,
optional on `rideArt`:

| field | what it says |
|---|---|
| `rest` | The texture drawn while the ride is not moving. May be the layer's `key`. |
| `frames` | The gait, in the order travel plays it; at least two. May include the layer's `key`. |
| `framePx` | Design pixels travelled per frame. The whole cycle is `framePx × frames.length`. |

The layer's `key` keeps its meaning — the layer's picture — and gains one: it is the **still**, the one frame drawn
under reduced motion. Every texture a layer names shares the layer's size; `rideArtProblems` reports a frame that did
not load or is another size, `data-rides-drawn` reads 0 for either, and the contract test refuses both before a build
ships.

### 2. Frames are picked by distance travelled

`rideFrameKey` in `app/adapters/phaser/ride.ts`, pure, imports no Phaser:

- **moving**: `frames[⌊(distance mod cycle) / framePx⌋]`, from the same `#rideDistancePx` the rock reads, so the gait
  and the rock stay in step and a level can lock one to the other;
- **at rest** (speed exactly 0, or not a number): `rest`, whatever frame the ride stopped on;
- **under reduced motion**: `key`, at every speed and distance, and nothing else;
- a layer with no `cycle`: `key`, which is every ride before this.

The scene sets a layer's texture only when the answer changes, and only to a key the texture manager has, so a frame
that did not load leaves the last good picture rather than Phaser's missing-texture square.

### 3. Reduced motion holds one frame, and it is not the rest frame

"Holds one frame" is the whole rule. A still that switched from standing to striding as the player set off would be a
frame change, which is the motion asked away. So the still is chosen by the level for the picture it makes when it
slides: for the horse a stride, because four square legs sliding along read as a statue on wheels (§14.4). No field
can make a cycle play under reduced motion, for the reason no field can make the rock move: it is the engine's rule.

### 4. The seat is declared in the art, and held by a test

A frame that redraws the saddle a few pixels up lifts the rider out of it mid-stride, and nothing at run time can see
that. So every file a cycled layer can draw carries its seat as one SVG group, `<g id="seat" data-rider-anchor="x y">`,
drawn after every leg, and `tests/unit/contracts/level-art-is-placed-where-it-is-drawn.test.ts` holds, for every cycled
layer on every level:

- each file has exactly one seat group, it draws something, and its anchor is the level document's `riderAnchor`;
- the group is byte-identical across the still, the rest frame and every frame of the gait;
- the gait's frames are different drawings, since a cycle of one picture moves nothing;
- a negative control: moving one coordinate in one file's seat, moving an anchor, or renaming the group each fails.

### 5. The Alberta horse

`alberta-foothills.json` declares `rest` `…-ride-ranch-horse-stand`, `frames` `…-ride-ranch-horse`, `…-walk-2`, `…-walk-3`,
`…-walk-4`, and `framePx` 55.

- **The walk is plate 574's**: a lateral four-beat walk — near hind, near fore, far hind, far fore, a quarter stride
  apart, each hoof down for about five eighths of the stride — sampled a quarter stride apart and an eighth off the
  touchdowns, so every frame has three hooves on the ground and one in the air, lifted in turn. A swinging fore folds
  its cannon back under the knee; a swinging hind flexes the hock; a hoof breaks over its toe before it lifts.
- **55 px is a planted hoof's step between frames**, so a hoof on the ground holds its place on the trail instead of
  skating, and four of them make a 220 px stride, which is the ride's existing `bob.periodPx`: one rock per stride.
- **The still is walk frame 1**, whose lifted far fore is mostly hidden behind the near fore. **The rest frame** stands
  square. Only the legs differ between files; the body, head, bridle and the `seat` group are the same, so
  `riderAnchor` (258, 270) and `footprint` (x 186, width 156) hold in every frame.
- **No run gait.** The cycle is counted in distance, so at cruise the walk already plays as fast as the ground goes;
  a trot would be four more frames and 4.08 MiB.

### 6. The Prairies train is not animated

Its Park car's wheels are drawn, as the reference's Budd trucks carry them, as plain dark discs with a centred hub, so
turning them changes no pixel, and inventing spokes would draw a wheel the car does not have. Any other frame change
is a second 1 420 × 590 texture at 3.20 MiB, taking the level from 30.85 to 34.05 of 40 MiB, for a detail at the bottom
edge of the screen. The track going by and the car's rock already say the train is moving. `prairie-rail.json` does
not change.

## Alternatives rejected

- **Frames on a timer** (a Phaser animation at a frame rate scaled by speed). Close at cruise and wrong everywhere
  else: it keeps stepping for as long as the rate lags a stop, it cannot hold a planted hoof to the ground, and it is a
  second clock drifting against the rock, which ADR-0031 already refused for the rider's own poses.
- **The legs as their own `front` layer.** Every layer of a ride shares one size, so a legs layer is another
  600 × 446 per frame, and the barrel between the rider's legs and the far legs is exactly where a second layer
  cannot go (§14.3).
- **A per-frame anchor.** It would let a frame move the saddle and the rider with it, which is the defect §4 exists to
  prevent, and would make the rider's seat a function of time that `a-rider-stays-on-the-ride.test.ts` cannot read.
- **The rest frame as the reduced-motion still.** A standing horse sliding along the trail is the statue on wheels.
- **A probe attribute for the frame shown.** Not added: every counter the probe carries is asserted by a browser
  suite, and this change adds none. The frame is a pure function of numbers the probe already publishes, and the
  unit tests hold that function.

## Consequences

- **The horse walks, stands when it stops, and holds one stride under reduced motion.** `OQ-RIG-2` is closed.
- **The cost is the level's.** `make assets`: `alberta-foothills` 30.16 MiB of 36.00 MiB (84 %, 6 124 936 B spare) over
  18 files, from 26.08 MiB (72 %) over 14; payload 0.67 of 8 MiB, from 0.57. Four new 600 × 446 textures at 1.02 MiB
  each. `textureBudgetBytes` is unchanged: every frame is decoded when the level loads, so a swap allocates nothing,
  and 84 % is the band the Prairies sits in. No other level's number moved.
- **Tests.** `tests/unit/adapters/phaser/ride.test.ts` holds `rideFrameKey` (by distance and in order, wrapping, the
  same frame at any speed for the same ground, the rest frame at rest, the still under reduced motion at every speed
  and distance) and `rideArtProblems` over frames. `level-document.test.ts` keeps a cycle whole and refuses a cycle of
  one frame, no rest, no distance, and a frame that is not a key. `level-art-is-placed-where-it-is-drawn.test.ts`
  resolves every frame to a 1x-pinned source of the layer's size and holds §4. `ports-match-schemas.test.ts` binds
  `rideCycle` to `RideCycle`.
- **What is not observed in a browser.** The e2e ride spec still checks that the ride drew (`data-rides-drawn` 1, which
  now counts every frame's texture), not which frame is on screen. Phone-size renders of the walk are recorded in
  §14.6 of the art sheet.
- **A level must still be addable by JSON and assets alone**, and after this a walking animal is: a `cycle` and its
  frames.
