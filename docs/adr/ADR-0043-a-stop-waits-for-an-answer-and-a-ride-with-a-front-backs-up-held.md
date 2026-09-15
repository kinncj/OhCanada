# ADR-0043: A stop waits for an answer, a key is a press however short, and a ride with a front backs up held

- Status: Accepted (2026-09-15)
- Amends: ADR-0032 §2 ("a press that begins while held") — once the brake is on, only a press that begins at rest
  releases a stop — and ADR-0032 §4 / ADR-0037 §6 ("no new copy, no new event"): a stop now draws and announces one
  sentence. ADR-0031: a ride that does not turn with its rider declares `backingMaxSpeed`.
- Criteria: `docs/stories/TN-REACH-what-is-in-reach.md`, `TN-REACH-12` (new).
- Slice: F2 (accessibility pass), after the second live-site audit.

## Context

A second live-site audit at 390×844 (touch and keyboard, SwiftShader) found three traversal P1s.

**1. Holding forward on the Prairies carries the train past the guide, so the task never starts.** The train is
`drive: "auto"`. Left alone it drives from the spawn and rests at x 1 471.6, 274 px past the guide at 1 200 and clear
of its dome (ADR-0037), with "Talk to the guide" on offer. The audit's walk pressed right at x 1 339.9, 473 px/s into
the brake. `auto-stop.ts` released a hold on any press that *began* while held — for an automatic drive that is the
nudge auto-move has always had — so the guide was let go, latched for the visit, and passed. Every stop after it asked
questions with no task running, and the level ended with "You have not started this level's task yet." Nothing about
the spawn, the stop line or the stand-off was wrong: the press was an answer to a stop the player had not reached.

**2. Steering back runs the train to x 0 at 739 px/s with the rider half off the screen.** Steering back releases a
stop (ADR-0032, `TN-SET-05`) and latches what it held. The train's velocity then turned negative, the step set
`facing: 'left'`, and `locomotion.ts#requestedDirection` — "with no input, keep going the way you face", which *is*
`drive: "auto"` — drove it backwards at cruise to the start of the world. There `applyBounds` braked by 820·dt a frame
and the drive re-accelerated by 900·dt, so it sat at the edge reading 739 px/s. The camera cannot scroll past the
world's edge, so the rider, 0 px from it, was drawn half off the glass. It passed the guide it was steering back to,
because steering back had latched him.

**3. A keyboard-only player is stuck at a stop they did not engage.** On Halifax, at the Town Clock, the audit let go
of the arrow and pressed it again fourteen times and never moved; a held finger went on at once; `Enter` at a stop
opened nothing. Reproduced against the live site with the scene probe's frame trace: `#sampleIntent` read every key as
a **level** — `Key.isDown`, once a frame — and derived "a press began" by comparing it with the previous frame's.
The audit's script put the key back down within milliseconds of letting go, and on SwiftShader a frame is longer than
that, so the level read the arrow as down on every frame: the lift and the new press never happened. `keyboard.press`
put `Enter` down and up inside one frame, so it read up on both. With a real gap between up and down, the same script
walked on (x 1 488 → 2 098). A finger never hits this: `touch-controls.ts` holds a new press as a tap for its first
160 ms, so the level always sees a frame of nothing between two holds. A frame is 33 ms at the 30 fps Android target
and longer on a slow one; a quick tap fits inside it.

## Decision

### 1. Once the brake is on, a stop is answered at rest

A press the way the drive was going that **begins while held** still releases the stop, but once the brake is on it
has to begin with the player **at rest** (`velocityX === 0`). A press that lands while the drive is still being brought
to rest is held on, like a control that was already down: let go and press again at rest. Unchanged: steering the
other way releases at once, engaging releases, and a hold that is still gliding on to its stop line (ADR-0037 §1) is
released by any press that begins, because the player lifted to choose it and a press then is a change of mind.

The rule is the same for a held and an automatic drive. For auto-move it means a nudge during the brake does nothing
until the player is stopped; the brake is 0.2 s on a walk and under a second on every shipped mode.

### 2. A key press is a press however short

`app/adapters/phaser/key-presses.ts` records every real key-down — Phaser's `Key` emits `down` once on the way down and
never for auto-repeat, and `event.repeat` is refused as well — and the scene takes the set once a frame. Levels still
decide what is *held*; the set answers what was *pressed* since the last frame:

- **interact** (`E`, `Enter`) and **jump** (`Space`, `Up`, `W`) fire on a key-down the frame after it, however short;
- a **direction** key-down is handed to the stop as `AutoStopFrame.pressBegan`, so a key let go and pressed again
  between two frames is a new press.

The set is forgotten on pause, sleep and blur, with the pointers (`#releaseEveryPointer`): `Enter` on a focused prompt
reaches the level and the prompt in one event, and the prompt's card pauses the level before the next frame.

The bindings are unchanged. `Enter` and `E` were already the interact keys (`READ_KEYS`, `TN-REACH-06`: "the key bound
to interact does the same thing without moving focus"); they now work for a press of any length. `Space` stays jump:
CLAUDE.md's "tap to jump/interact" is a finger's hit test, and a key has no position to test.

### 3. A stop says why, once

While the player is at rest with something on offer they have not engaged in this sitting, the HUD's hint slot draws
`hud.stop.hint` — "Stopped here. Choose it, or move again to go on." / « Arrêt ici. Faites votre choix, ou avancez de
nouveau pour continuer. » — and the live region says it **once per thing per sitting**. Moving takes it away and gives
back the one-time hint (`TN-REACH-04`) if that is still owed; engaging takes it away with every hint. It is wired in
`app/bootstrap/main.ts` from `player/stopped`, `player/moved` and the announcer's `inReach`: no new scene event.

ADR-0032 §4 declined a halt announcement because the offer is already announced, and because a sentence naming an input
is wrong for three of four players. The second holds and the row names none (`copy.test.ts` checks it with the hint's
banned words). The first did not survive the audit: the offer says what is here, and nothing said the world had stopped
on purpose or how to leave without choosing. Once per thing keeps a player walking back and forth from hearing a loop
(`TN-LEVEL-08`). The row is a `COPY_GAPS` entry, proposed for `TN-REACH-12`.

### 4. A ride with a front backs up held, slowly, and waits

`app/adapters/phaser/backing.ts`, for a ride whose `turnsWithRider` is false (the Prairies' Park car):

- **It has a front**: right, the way the player spawns facing and every level grows (`level-exit.ts`).
- **Backing is never automatic.** Travelling backwards is stepped with `backingTuning`: `drive: 'held'`, no glide, the
  mode's own brake as its deceleration, capped at the ride's `backingMaxSpeed` with no slope allowance. It moves only
  while the player presses back and stops in a few pixels when they let go.
- **After backing, an automatic drive waits** at rest, stepped on the brake, until a press forward or an engagement —
  never on its own and never on a timer. A player backs up to reach something; a ride that left as it came to rest
  would take the offer away from a mode that may only engage at rest (`requiresStop`).
- **At rest it faces forward** before the automatic drive is asked which way to go, so a passenger turned round in the
  seat is never read as the way on.
- **Its tail stays in the world.** The left movement bound moves in by `riderAnchor.x`, the art behind the rider, so the
  car's tail stops at the world's edge and the camera, which stops scrolling there, keeps the rider on the glass. The
  right bound, where the level ends, never moves.

**`backingMaxSpeed` is content**, not an engine constant: `level.schema.json#/$defs/ride`, optional, `exclusiveMinimum`
0, refused by the parser on a ride that turns. `prairie-rail.json` declares **240 px/s**, under a third of its 760 px/s
cruise: going back to the guide from the train's stop is about a second and a half, and letting go stops it in 35 px on
the 820 px/s² brake. `backing.test.ts` requires every shipped ride that does not turn to declare one below half its
mode's cruise, and to spawn inside its backing bound.

No tuning, placement or art changed. A ride that turns (Alberta's horse), or no ride, takes exactly the path it took
before: `createBacking` answers `forward`, `facingForward` and `backingBounds` return what they were given.

## Alternatives rejected

- **Never release a held automatic drive on a forward press.** Auto-move's nudge is how a player who can press
  something goes on without engaging (`TN-SET-05`).
- **Start the level with the train at rest, or spawn it past the guide.** Moves the problem to the next stop, and moves
  the level.
- **Ignore key presses shorter than a frame.** That is what shipped; a real hand does it on a slow device.
- **Read `JustDown`/`JustUp`.** Phaser clears `_justDown` on the way up, so a tap inside one frame is lost again.
- **Focus the prompt at every stop.** Moves focus under a keyboard player who is steering, and fights the switch ring.
- **A backing speed as a fraction of cruise in the engine.** A number this directory would have invented; a level
  tunes it.
- **Forbid backing up.** A task giver skipped by a press would then be unreachable for the rest of the visit.
- **Move the left bound for every level.** A walker at x 0 is the same framing on every level and was not reported;
  only a ride with a front drives its art into the edge with its passenger facing away.

## Consequences

- `auto-stop.ts` reads `pressBegan` and the at-rest rule; `key-presses.ts` and `backing.ts` are new and pure;
  `level-scene.ts` feeds both, selects `braking` / `backing` / `forward` per frame, and releases both watches on every
  engagement. `Ride.backingMaxSpeed` is in the port, the schema, the parser and `prairie-rail.json`.
- **Tests.** `auto-stop.test.ts`: the brake-press rule held and automatic, `pressBegan`, and a shipped automatic mode
  pressed forward a quarter of a second into its brake for the guide resting past him. Two existing small-print tests
  now press at rest. `key-presses.test.ts` and `backing.test.ts` are new; `backing.test.ts` runs the shipped Prairies with
  the scene's strategy selection. `level-document.test.ts` reads and refuses `backingMaxSpeed`; `copy.test.ts` pins the
  new gap and holds the row to the hint's banned words. `tests/e2e/train-stops-at-the-guide.spec.ts` and
  `tests/e2e/keyboard-at-a-stop.spec.ts` are new; `walk.ts`'s header says what a leg ending mid-brake costs.
- **`walkInLegs` walks can take one more leg** when a leg ends while a stop is still braking. None asserts a duration.
- **Measured** (headless, 390×844, before on the live site, after on `vite preview` of this branch): see the slice row
  in `docs/plan/slices.md` and the renders listed there.
- **What this does not do.** It does not make single-switch mode drive the player (`TN-LEVEL-07`), move any walker's
  bound, or change the camera.
