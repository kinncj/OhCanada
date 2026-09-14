# ADR-0031: A ride is level art registered to its rider

- Status: Accepted (2026-09-14)

## Context

A player on the Prairies reported: *"the prairies seems to be missing a train? cuz the character walks by
itself on a track."* The report was accurate. `content/levels/prairie-rail.json` declares `train` as its
first mode, the HUD says Train, the tuning drives like a train, and the only thing on the rails was a person
walking, while the scene printed `data-mode-gaps: 1` and a console line saying so.

`assets/style/rig-contract.md` §11.5 had already worked out why the rig could not close this on its own, and
the numbers are what made the decision rather than a preference:

1. **A car a passenger visibly rides is wider than the screen.** The camera holds the rider at screen x 340
   of 1080 and lets them lead by up to 207 px at cruise, so a car attached to the rider needs roughly 1 370 px
   or one of its cut ends shows.
2. **As rig equipment that is unaffordable.** Rig frames live on the shared atlas and are charged to all ten
   levels; a car-sized frame is about 8.4 MiB at 2x, and Halifax had 5.36 MiB spare.
3. **As prairie-rail art it is affordable, and nothing could place it.** `level.schema.json` had no entity that
   travels with the player, and a seated `train/*` pose with no car under it is a figure sitting in mid-air.

A fourth constraint was found only by rendering the level at phone size, and it decided where the car goes:

4. **The landmarks and the guide stand on the walking line.** `container-car` is 420 px tall and its
   containers sit between 128 and 308 px above the line; the guide is a figure of about the same height; the
   grain bins read as bins only because daylight shows under them. A passenger car tall enough to seat a rider
   in its dome is taller than all three. Drawn in front of them on the walking line it hides them — at the
   moment the train stops to engage them — and drawn behind them it is hidden by them, rider included.

## Decision

### 1. A level may declare `rides[]`: art that travels with the player

`level.schema.json#/$defs/ride`, mirrored by `Ride` in `app/application/ports/content-repository.ts`:

| field | what it says |
|---|---|
| `mode` | The locomotion mode the ride carries the player in. One of the level's `locomotion[].mode`; one ride per mode. |
| `art[]` | Layers, each `{ key, side }` with `side` `behind` or `front` of the rider; at least one, one per side. |
| `riderAnchor` | Where the rider's sole line meets their centre line, in the art's own pixels from its top-left. |
| `groundLineY` | The art row that lies on the level's ground polyline under the rider. |
| `turnsWithRider` | Whether the art mirrors about the rider when they turn. |
| `bob` | Optional: a rock shared by ride and rider, `amplitudePx` scaled by speed over `periodPx` of travel. |
| `track` | Optional: a repeating strip the ride runs on, `{ artKey, topY }`, fixed to the world. |

It is **level art registered to the rider**, not a character and not equipment. The rig still owns how the
rider is posed (ADR-0017): a ridden mode declares `<mode>/<state>` states (rig-contract.md §11.1), authored
with the feet on the sole line, and the ride says where that line is in its own drawing. Every layer shares
one size and one registration, which is why one anchor serves them all.

The art is pinned to 1x, because `riderAnchor` and `groundLineY` are art pixels and are design pixels only at
1x. A 2x texture would draw the car twice the size around a rider placed for the 1x one.

### 2. The engine places it every frame, and never moves the physics

`app/adapters/phaser/ride.ts` holds the arithmetic and imports no Phaser. `level-scene.ts` applies it:

- the art's `riderAnchor` lands on the rider's x and its `groundLineY` row on the ground under them; a ride
  that turns is mirrored about the anchor, so the rider never changes seat;
- **the rider is drawn at the anchor and the physics position does not move.** The camera, reach, the
  auto-stop and the level exit see exactly what they saw before rides existed;
- depths are relative to the player: `behind` half a step under the first rig part, `front` one step over
  the last part (read from the rig, not assumed), both under the tappable marks; the track just above the
  ground and under every actor;
- the rock is `|sin|` over distance travelled, scaled by speed, zero at rest, and **zero under reduced
  motion unconditionally.** That is the engine's rule; no field can opt a level out of it.

### 3. `groundLineY` above the art's bottom row is how a ride runs on a nearer line

This is the answer to constraint 4, and it is why the field exists instead of pinning every ride's bottom row
to the ground. Prairie-rail's train sits with its roof 84 px above the walking line and its rails 256 px below
it, across the ground fill. Everything placed on the walking line — the four landmarks and the guide — stands
beyond the train, with only its bottom 84 px behind the car's roof, and the rider in the dome is never hidden
by them or hiding them.

A ride on a nearer line has nothing under it but ground fill, so it may name a `track`. The track is **not a
parallax layer**, for two reasons that each rule one out: layers draw beneath the ground polygon, which
covers everything below the walking line; and the visual tier drops layers, and a train whose rails the low
tier removed is floating. It is **not part of the car's art** either: a strip in the ride's own file moves with
the ride, so its ties would ride along with the train and its ends would show where the art ends.

### 4. What is observable

`data-rides` and `data-rides-drawn` on the scene probe, in the shape of `data-layers` / `data-layers-textured`:
`0/0` for a mode with no ride, `1/1` for a healthy ride, and `1/0` for the failure — art that did not load, two
layers of different sizes, an anchor outside the drawing — each of which also prints a sentence. A ride that
fails to draw is otherwise a seated passenger in mid-air on a level that reached `ready`.

`tests/unit/contracts/level-art-is-placed-where-it-is-drawn.test.ts` holds the claims the schema cannot: the
mode is one the level moves by, one ride per mode and per side, every key resolves to a 1x-pinned source, the
layers share one size with the anchor and rows inside it, and **a mode ridden on one level is ridden
everywhere it is declared**, because its rig poses are seated.

## Consequences

- **The Prairies draws the player riding in the dome of VIA Rail's *Canadian*.** `train/idle`, `/walk`,
  `/run`, `/talk` and `/interact` are seated poses in both rig files, the ride art is
  `assets/src/svg/prairie-rail/ride-park-car@1x.svg` with its track strip, and `data-mode-gaps` reads 0 on the
  level for the first time.
- **The cost is the level's, not the game's.** prairie-rail went from 29.75 to 33.05 MiB of decoded texture and
  from 0.41 to 0.43 MiB of payload. No other level's number moved, which is the point of constraint 2.
- **prairie-rail's declared budget went from 36 to 40 MiB**, Québec City's figure. The build gate would have
  passed at 36 (92 %, 2.95 MiB spare), and the reason for raising it is the other gate: `make test-perf`
  compares the GPU's *peak* texture bytes — including everything no build gate prices — with the same
  `textureBudgetBytes`, and a margin that halved in one change is a margin nobody has measured. 33.05 of 40 is
  83 %, the band every other level sits in.
- **The level now shows two tracks, and the tile's reads as the siding.** The train runs on the main line in
  the foreground; the railbed tile's rails behind it are where the container car stands and the elevator
  spouts, which is what a prairie siding at an elevator is. `references.json`'s `prairie-rail-line` note that
  "the player IS the train" was written for a level with no train and is amended with this decision.
- **A horse is now a data change plus art.** A `behind` body, a `front` near-side leg, `turnsWithRider: true`,
  `groundLineY` at the hooves and a `bob` for the gait — and `horse/*` poses astride with the stirrups on the
  sole line. Its own gait animation is still not expressible: a ride's layers are still images. That is the
  remaining half of `OQ-RIG-2`, stated rather than implied closed.
- **What this does not do.** A mode still cannot change mid-level, so a ride is resolved once; dismounting to
  `walk` would need the scene to re-resolve both the tuning and the ride, which it does for neither today.
