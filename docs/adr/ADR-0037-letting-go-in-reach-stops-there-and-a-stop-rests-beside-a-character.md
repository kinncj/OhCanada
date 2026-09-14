# ADR-0037: Letting go in reach stops there, and a stop rests beside a character

- Status: Accepted (2026-09-14)
- Amends: ADR-0032 §1 — "Not caught: a glide nobody is pressing" — for the one glide that begins inside reach,
  and ADR-0032's aim, which was the subject's `x`. `TN-LEVEL-06` keeps its words ("releasing it glides exactly as it
  does after a released touch"): the rule below is the same for a key and a finger. ADR-0031: a ride now declares
  its `footprint`.
- Criteria: `docs/stories/TN-REACH-what-is-in-reach.md` — `TN-REACH-09` amended, `TN-REACH-10` and `TN-REACH-11`
  added; `TN-LEVEL-ottawa.md` `TN-LEVEL-06` notes it.

## Context

A live-site audit (390×844, DPR 3, touch) reported two defects.

**P1 — the ride glides past the thing the player is trying to tap.** One-thumb play has exactly one way to take a
prompt: lift the thumb off the glass and put it on the prompt. After letting go the audit measured the bike gliding
about 1 020 px, the toboggan about 1 020, the skate about 850 and the skateboard about 450, on a screen 1 080 wide,
and the prompt was gone about 0.75 s after the release. On Toronto the tap that was meant for "Talk to the guide"
opened the streetcar; on Québec City the slide overshot the Château Frontenac; on Ottawa "Look at Parliament Hill"
vanished before the tap.

The audit ran against a build from before ADR-0032. Re-measured on `main` with the same script
(`renders/reach/before/`), ADR-0032's held stop already catches the bike and the toboggan at cruise **before** their
prompt appears, because their stop lines are longer than their reach, so on those two levels the audit's own walk
now works. The defect that remains is the one ADR-0032 wrote down as a rule:

| mode (level)          | stop line at cruise | `reachPx` |
|-----------------------|--------------------:|----------:|
| skate (Ottawa)        |              204 px |    220 px |
| skateboard (Vancouver)|              130 px |    240 px |
| horse (Alberta)       |              175 px |    280 px |
| walk                  |               56 px |    200 px |

A player who lets go when the prompt appears, outside the stop line and inside reach, is gliding, and "a glide
nobody is pressing is not caught". On `main` a skater let go 219 px short of the locks at 622 px/s, glided through
the locks' prompt and then the officer's, and was still moving at 395 px/s 1 280 px later. The same happens on every
gliding mode at any speed whose stop line is shorter than its reach — which is every mode leaving a stop, since the
stop line grows with the square of speed.

**P2 — characters overlap.** ADR-0032 aimed every stop at the subject's `x`. That is right for a landmark and wrong
for a body: on `main` the player came to rest at 887 against the Halifax guide at 900, at 897 against the Toronto
guide at 900, at 1 244 against the Québec City guide at 1 250 and at 1 132 against the Vancouver officer at 1 150 —
two figures on one spot. On the Prairies the train stopped at 1 174 with the guide at 1 200, so the car's glass dome
stood exactly where he does and he was drawn inside it with his head through the roof.

## Decision

### 1. Letting go inside reach is a choice, and the drive stops there

The frame a held press **ends** is read as well as the frames it lasts. On that frame, if the player is moving and a
subject this visit has not let them go from is within `reachPx`, the stop holds the player at the nearest such
subject, whichever side of them it is on:

- it **glides on to the stop line and brakes there**, on the mode's own brake, so the player comes to rest at the
  thing rather than short of it; or brakes at once when the aim is already inside the line, or behind them;
- **once the brake is on it stays on** — the slack in the stop line shrinks with speed, and a brake that let go half
  way would hand the glide back;
- the three ways out are ADR-0032's: a press that begins, steering the other way, engaging. No timer.

Not caught: a glide that began **outside** reach, which still passes everything it glides through — that is what
keeps a skater's coast down the canal a coast (`TN-LEVEL-03`: "releasing does not stop the skater"; on Ottawa, held
for 1.5 s and let go at 1 416, the coast reaches 2 607 in 2.2 s and is never held). An automatic drive, whose stop
line is its rule. A player at rest. A pause hides a lift exactly as it hides a press (`forgetInput`).

### 2. What a stop holds stays on offer

A subject the stop is holding, once it has come into reach, **stays in reach**: the prompt is not withdrawn, the mark
stays `ready`, the interact key and a tap on it still engage it, even if the brake carries the player past the edge
of reach. The offer ends when the hold does. "Once it has come into reach" is what keeps a drive caught at its stop
line, hundreds of pixels out, from offering early. One predicate in `level-scene.ts` (`#onOffer`) now answers reach
for `poi/entered`/`poi/left`, the tap hit test, `#engageNearest` and the marks (`interaction-affordance.ts`'s
`held`), so the four cannot disagree.

### 3. The level documents' glide and deceleration are not tuned

A glide short enough to end inside reach from where the prompt appears is at most two reaches long — about 500 px,
which is a walk, not a bike (3 789 px from cruise) or a skate (2 136 px). Tuning that far would make skating dead
everywhere to fix one moment, and `TN-LEVEL-03`'s coast would fail. Rules 1 and 2 fix the moment and leave the glide.

### 4. A stop rests beside a character, not inside them

`app/adapters/phaser/stand-off.ts` gives each character two **rest points** — for a drive arriving travelling right,
and travelling left — and `auto-stop.ts` aims its stop line at them. Landmarks keep resting level with their `x`.

- **Bodies are measured from the rig**, never typed in: the union of the frame windows of every part the figure can
  draw, reflected about `characterSpace.centreX` where the renderer reflects them, at rest. For the player it is the
  envelope over every option the creator offers, so no choice can put them inside somebody, plus the mode's `{mode}`
  equipment, so a bike is as wide as its wheels. Rotations are not applied: a talking arm reaches further, and two
  hands meeting in a conversation are not the defect.
- **A ride adds its footprint** (§5).
- **The approach side** — short of the character, clear by `STAND_OFF_GAP_PX` (16 px) — when that point plus one
  capped frame of landing slack at the fastest the mode goes (`maxSpeed × maxSpeedMultiplierDownhill / 30`) is inside
  reach. Otherwise **the far side**, with the slack added to the clearance, when that fits. Otherwise level with `x`,
  the old stop, which the contract test refuses for every shipped level.

From the spawn, with the real strategy and the real stop, every character now rests clear:

| level / mode          | character | rests at | distance / reach | clear air |
|-----------------------|-----------|---------:|-----------------:|----------:|
| Alberta / horse       | guide     |    1 045 |        155 / 280 |     36 px |
| Halifax / walk        | guide     |      748 |        152 / 200 |     33 px |
| Ottawa / skate        | officer   |    2 228 |        172 / 220 |     35 px |
| Prairies / train      | guide     |    1 474 |        274 / 320 |     14 px |
| Québec City / toboggan| guide     |    1 054 |        196 / 240 |     17 px |
| Toronto / bike        | guide     |      699 |        201 / 260 |     19 px |
| Vancouver / skateboard| officer   |      942 |        208 / 240 |     36 px |
| Winnipeg / walk       | officer   |      748 |        152 / 200 |     27 px |

The Prairies is the far side: the dome reaches 240 px ahead of its rider, so stopping short of the guide inside a
320 px reach is impossible, and the train stops with him standing behind the car's observation end, clear of the
glass.

### 5. A ride declares its footprint

`level.schema.json#/$defs/rideFootprint`, required on every ride: `{ x, width }` in the art's own pixels — the span
inside which a figure standing beyond the ride reads as being **in** it, seen through its glass or sitting where the
rider sits. A car names its glazing and not its flank, because a person behind a solid side reads as standing beyond
the train; an animal would name its whole body. Required rather than defaulted to the whole art, because the whole
of a 1 420 px car is wider than any reach and no stop could keep a character clear of it. `prairie-rail.json`
declares `{ "x": 220, "width": 400 }`, the dome and its frame in `ride-park-car@1x.svg`.

No NPC or landmark moved. The overlap was where the stop aimed, not where the level placed anyone, and every
placement stays reference-accurate. Depth is unchanged: the guide is already drawn behind the car's `front` layer
(ADR-0031), which reads as standing on the far side of the train once he is not behind its glass.

### 6. Accessibility

- **No new copy, no new event.** The offer is announced once when it comes into reach (`TN-REACH-07`), exactly as
  before; rule 2 only stops it being withdrawn while the player is held at it.
- **Keyboard only.** Letting go of a direction key is a lift like any other; `Tab` to the prompt and `Enter`, or the
  interact key, engage what is held.
- **One switch.** Unchanged: an automatic drive stops on its stop line (ADR-0032) and rule 1 does not apply to it.
- **Reduced motion.** Unaffected: the same place, the same brake.
- **`TN-SET-05`.** Nothing traps the player: a press, the other direction, or engaging lets go, as before.

## Alternatives rejected

- **Catch every glide at each subject's stop line.** Simplest, and dead: a skater could never coast past anything,
  and `level-ottawa.spec.ts`'s coast — held 1.5 s, then 2.2 s with nothing pressed and the speed above half cruise —
  passes the locks and the officer and would stop at both.
- **Catch a glide the moment it enters reach.** The same failure one reach later.
- **Keep the offer after any glide leaves reach, until something else comes into reach.** With no lift to say "this
  one", a skater gliding 2 000 px on would carry a prompt for somebody off the screen.
- **Tune the glides** (§3). **Move the characters** (§5).

## Consequences

- `auto-stop.ts` reads the frame a press ends, aims at `AutoStopSubject.rest` when a subject has one, and latches its
  brake. `stand-off.ts` is new and pure. `level-scene.ts` builds its stop subjects with `stopSubjectsFor` and answers
  reach with `#onOffer`. `Ride.footprint` and `RideFootprint` are in the port, the schema and the parser.
- **Tests.** `tests/unit/adapters/phaser/auto-stop.test.ts` drives with the scene's own stop subjects, and proves
  rule 1 on every shipped held mode — including that at least one of them lets go in reach before its own stop line,
  so the rule is needed — and that a glide let go outside reach is never held and passes through.
  `stand-off.test.ts` holds the arithmetic on a small rig. `tests/unit/contracts/a-stop-rests-beside-a-character.test.ts`
  holds every level, mode and character: rest held, inside reach, clear of the body and of a ride's footprint, from
  either side anywhere inside the landing slack, nobody inside a ride or the player at the spawn, the footprint inside
  its art — and shows the gate failing on the old level stop. `tests/e2e/release-in-reach.spec.ts` lets go when the
  prompt appears on the bike, toboggan and skating levels, taps the prompt and checks what opened.
- **A glide that began outside reach still passes a subject**, and its prompt lasts only while it is in reach. That
  is the glide being the player's, stated so nobody mistakes it for this defect returning.
- **A player already inside a character's stand-off who presses toward them is not stopped by them** — the rest point
  is behind — and passes through; one who lets go there is braked at once and can come to rest overlapping. Neither is
  reachable from a drive that approaches, which is what every level does.
- **The Prairies train stops past the guide**, 274 px on, not at him.
- **What this does not do.** It does not make single-switch mode drive the player (`TN-LEVEL-07`), and it does not
  measure posed limbs.
