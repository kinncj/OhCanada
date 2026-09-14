# ADR-0032: Every drive stops at each thing it can engage, once per visit

- Status: Accepted (2026-09-14)
- Amends: the Traversal row of `CLAUDE.md` in behaviour, not in wording — "hold to move, tap to jump/interact,
  tap NPC or POI to engage" still describes every input; this says where holding to move comes to rest.
- Criteria: `docs/stories/TN-REACH-what-is-in-reach.md`, `TN-REACH-09`; `TN-SET-02` points at it.
- Amended by: ADR-0037 — letting go **inside** reach is caught (§1's "not caught: a glide nobody is pressing" now
  covers a glide let go outside reach), a held subject stays on offer, and a stop aims beside a character rather
  than at its `x`.

## Context

The product owner asked: *"make it so the character stops on each point of interest. that should also work
with the auto walk."*

Half of that existed. `app/adapters/phaser/auto-stop.ts` brought an **automatic** drive — the auto-move option,
or a mode with `drive: "auto"` such as the Prairies train — to rest level with each engageable subject, braking
on the mode's own `turnAcceleration` from a speed-dependent stop line, and let it go when the player engaged or
steered. It was deliberately inert while the drive was held: "a player holding to move already stops by letting
go."

That sentence is true and does not help. Letting go of a held drive is a glide, and the glides the game ships
are long: Ottawa's skate keeps 0.9 of its momentum and needs about 2 100 px to stop on friction; the toboggan
and the bike are similar. "Tap an NPC or POI to engage" asks for a player at the thing, and one-thumb play gives
no precise way to be there. The practical experience was a skater sailing past the officer and turning round.

Four further facts shaped the rule:

1. **Holding cannot simply overrule the stop.** The automatic rule released on any intent at or above
   `MOVE_DEADZONE`. A held control is exactly that intent on every frame, so the same rule applied to a held
   drive would release on the frame it caught — the stop would never happen.
2. **The brake would have been a throttle.** `brakingTuning` is the mode with `drive: 'held'`, and a held drive
   stepped with `move: 1` accelerates. An automatic drive is caught with nothing pressed, so this never showed.
3. **The interact prompt never reached the stop.** `app/bootstrap/main.ts` engages from the prompt without
   passing through the scene (`TN-LEVEL-05`), so `#engageNearest`'s release never ran for it. An auto-move
   player who engaged by the prompt — by touch, by `Tab` and `Enter`, or with one switch — closed the card and
   was still held at the landmark. A player who cannot steer could not leave. That was a live defect before this
   decision and would have become the common case after it.
4. **Finished subjects were never stopped for**, so on a replay the train (`requiresStop: true`) and an
   auto-move player could never come to rest at a landmark whose prompt reads "Done. See this one again"
   (`TN-REACH-03`) — the offer was visible and unreachable.

## Decision

### 1. One rule for every drive

A subject is caught when it lies ahead of the way the player is **travelling**, inside the stop line
(`stopLinePx`: braking distance on the mode's own brake plus one capped frame), and this visit has not already
let the player go from it — on a frame where **something is driving**:

- the drive is automatic (auto-move, or `drive: "auto"`), or
- the player is pressing the way they are travelling, by any input: keyboard and finger are already summed
  into one intent before the stop is asked.

Not caught: a glide nobody is pressing (`TN-LEVEL-06`: "releasing it glides exactly as it does after a released
touch"); a player pressing *against* their travel, who is braking or turning; anything in a mode with no reach.

The stop is stepped with `brakingTuning` **and `brakingIntent`** — the player's intent with the move taken out.
The scene records the intent it sampled, not the one it stepped, so a held stop reads as held in the frame trace
and a hands-off run still reads zero on every frame.

### 2. Three ways out

- **A press that begins while held.** For a held drive that is *let go and press again*: the control that was
  already down when the stop caught it does not release it. For an automatic drive, which is caught with nothing
  pressed, every press begins while held, so this is exactly the nudge auto-move already had. "Begins" is
  measured in frames the watch is fed; a pause, a blur or a sleep hides the hands, so the scene calls
  `forgetInput()` and the first press after it counts as new.
- **Steering the other way.** Always, at once, whether or not the control was lifted — `TN-SET-05`: nothing
  traps the player.
- **Engaging.** Any engagement releases the hold and latches both what was held and what was engaged. The scene
  does this from `#engageNearest` (interact key, tap on the canvas); the composition root does it for the
  prompt through `GameRenderer.markEngaged`, from the one function every engagement route ends in.

No timer, no automatic restart. A timer outside Exam mode is forbidden by `CLAUDE.md`.

### 3. Each thing once per visit — finished or not

The watch latches every subject it let the player go from, and the scene builds one watch per level visit. So a
player is never re-caught on the frame after release, never caught walking back past something they left, and
is caught again on the next visit.

**Finished subjects stop too.** The alternative — never stopping for what the domain reports finished — was the
previous automatic rule and was considered and rejected:

- The product owner's word is *each*.
- The `done` prompt is an offer ("See this one again"), and for the two players who most need the stop — a train
  rider whose mode refuses to engage in motion, and an auto-move player who chose the option because they cannot
  hold — a landmark the drive never stops at is one that offer can never be taken up from.
- The cost of stopping is one press per landmark per visit. The latch is what keeps that from being tedious: a
  level ships four or five engageable subjects, and none of them stops a player twice in one visit.

### 4. Accessibility

- **Announcement.** No new copy and no new event. The stop always lands inside reach, so `poi/entered` has
  already fired by the time the player is at rest: the prompt is on screen, the mark reads `ready`, and the live
  region has said the offer once (`TN-REACH-07`). A second announcement for the halt would repeat it, which is
  the flooding `TN-LEVEL-08` forbids. A sentence telling the player to "let go and press again" would name an
  input, which `hud.interact.hint` deliberately never does.
- **Keyboard only.** Engage with the interact key or `Tab` to the prompt and `Enter`; continue with a new press
  of a direction key.
- **One switch.** The prompt is in the switch ring (`TN-REACH-06`); choosing it engages, and — since this
  decision — engaging by the prompt releases the stop, so an automatic drive carries the player on when the card
  closes. The switch never needs a direction to leave a landmark.
- **Reduced motion.** Unaffected. The stop is physics, not decoration: the same place, the same brake.

### 5. Where it lives

All of it is in `app/adapters/phaser/auto-stop.ts`, pure, and proved in
`tests/unit/adapters/phaser/auto-stop.test.ts` against every shipped level with the real strategy. The scene
feeds a frame, picks the braking pair on `true`, releases on engagement and forgets input on pause.

## Consequences

- **Walking tests walk like players.** Every browser test that held a key past a landmark to reach something
  beyond it now lets go and presses again at each stop, through `tests/e2e/walk.ts`: with the scene probe the
  stop is read off the frame trace; without it the walk is held in legs. Nothing reaches into the scene to turn
  the stop off. `tests/e2e/held-move-stops.spec.ts` proves the held stop, the re-press, the steer back and a held
  finger on the shipped build.
- **Traversals take longer.** A walk to the end of Halifax stops five times. The e2e walks that do so carry
  `test.slow()` or a larger walk budget; none asserts how long it took.
- **`AutoStopFrame.completed` is gone**, and `AutoStopWatch.release` takes the engaged subject.
- **A player who lets go short of a landmark and presses again close to it is stopped there** — a few pixels
  after they start, if they were within one braking distance. They are at the thing, the prompt is up, and a
  second press carries them on; it is the rule working, and it is noted so nobody mistakes it for a stall.
- **What this does not do.** It does not make single-switch mode drive the player (`TN-LEVEL-07`'s "moves along
  the canal without any input" is still unimplemented unless auto-move is on), and it adds no switch action for
  "go on without engaging" — engaging is the way on.
