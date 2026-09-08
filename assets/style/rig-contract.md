# The character rig contract

Task 1.11. This is the vocabulary every TrueNorth character exposes, and the reason
`app/application/ports/character-renderer.ts` can swap a Rive renderer for a sprite renderer without the
calling code knowing which one it got.

`assets/style/rig-contract.json` is **the same contract as data** and is the file a contract test loads.
This page says what each field means and why it is shaped that way. Where the two disagree, the JSON is
right and this page is a bug.

> **The rule this whole document exists to hold:** *the slot names, option names, input names, expression
> names and event names are **identical** in the Rive file and in the sprite atlas.* Not equivalent —
> identical strings. `CLAUDE.md` (Characters) requires it, and it is the difference between a real seam and
> two parallel implementations that drift apart in the third month.

---

## 1. What a character is

One **artboard** per character, named for its `CharacterId`. Slice 1 ships two: `player` and `officer`.

There is **one artboard per character, never one per skin tone, hair shape, costume or gender
presentation.** Everything that varies is a *slot* on the one artboard, with the one proportion canon
(`art-bible.md` §7, `docs/content-review.md` §6.1 and §8.6). A second artboard is how a project ends up
drawing one group of people differently from another, so the rig makes it impossible rather than
discouraged.

One **state machine** per artboard, named `motion`. One name, so the adapter never has to choose.

### Character space

Every part is authored in one 240 × 470 coordinate system at design resolution:

| | |
|---|---|
| centre line | x = 120 |
| crown | y = 40 |
| sole | y = 460 |
| height | 420 px = **6 heads of 70 px**, the canon in `art-bible.md` §7 |
| ground line | world y = 1280 (`ottawa-level.md` §3) |

Each part's SVG `viewBox` **is its window in that space**, so a window origin is the part's offset and no
placement number is written down twice. To draw a character standing at world `(x, y)`:

```
part screen position = (x - 120 + frame.x,  y - 460 + frame.y)
```

---

## 2. State-machine inputs

Nine inputs, and every one of them is something the game already knows. The list is short on purpose: an
input that no system sets is an input that will be set wrong.

| input | type | fallback | meaning |
|---|---|---|---|
| `grounded` | bool | `true` | Feet are on the ground polyline. |
| `moving` | bool | `false` | The traversal system wants forward motion — hold-to-move, or auto-move. |
| `talking` | bool | `false` | A dialogue or question card owns this character. |
| `reducedMotion` | bool | `false` | Suppress squash-and-stretch, hold the idle key. |
| `speed` | number 0…1 | `0` | Horizontal speed normalised to this character's top speed. |
| `verticalSpeed` | number −1…1 | `0` | Positive rising, negative falling. Only read while `grounded` is false. |
| `jump` | trigger | — | Fired at take-off. |
| `land` | trigger | — | Fired on ground contact. |
| `interact` | trigger | — | Fired when the player taps an NPC or a POI in range. |

**`reducedMotion` is an input, not a setting the renderer reads.** The port is explicit that the renderer
never reads settings itself, and making reduced motion a passed-in boolean is what makes it *testable*:
a contract test sets it and asserts the `land` state is skipped. A renderer that quietly consulted a
settings store could not be tested that way, and `CLAUDE.md` requires reduced motion to be tested rather
than aspirational.

### The selector, written out

First match wins. This table **is** the state machine, and it is exactly what a sprite adapter evaluates —
same inputs, same order, same answer. A contract test can drive both backends through it and compare the
selected state name.

| # | when | state |
|---|---|---|
| 1 | `interact` fired and its state has not finished | `interact` |
| 2 | `land` fired, its state has not finished, and **not** `reducedMotion` | `land` |
| 3 | not `grounded` and `verticalSpeed > 0` | `jump-rise` |
| 4 | not `grounded` | `jump-fall` |
| 5 | `talking` | `talk` |
| 6 | `moving` and `speed >= 0.55` | `run` |
| 7 | `moving` | `walk` |
| 8 | otherwise | `idle` |

Eight states: `idle`, `walk`, `run`, `jump-rise`, `jump-fall`, `land`, `talk`, `interact`.

---

## 3. Slots

A **slot** is one axis of appearance. An **option** is one value on that axis. Slot and option names are
the identical strings in both backends — Rive runtime-swappable slots on one side, atlas frame templates on
the other.

| slot | options | fallback | player-selectable |
|---|---|---|---|
| `skin` | `skin-1` … `skin-6` | `skin-3` | yes |
| `hairShape` | `crop`, `coil`, `bob`, `long` | `crop` | yes |
| `hairColour` | `black`, `brown`, `blond`, `red`, `grey` | `brown` | yes |
| `headCovering` | `none`, `toque` | `none` | yes |
| `feature` | `none`, `glasses` | `none` | yes |
| `costume` | `parka`, `serge` | `parka` | no |
| `presentation` | — **reserved, no options** | — | — |

Plus one axis that is not a slot: **`expression`** — `neutral`, `happy`, `thinking`, `surprised` — driven
by `setExpression`, because the port gives it its own method.

### `fallback`, and why it is not a default

The schema field is `fallback`, renamed from `default` by the architect after `art-bible.md` §8 and
`docs/content-review.md` §8.1: **no tone is the default.** It exists for NPC documents and save recovery.
The creator randomises uniformly over every option on open and **never renders `fallback` as a
pre-selection**. `skin`'s fallback is the middle of the ordinal ramp because something had to be written
there; that arbitrariness is the point, and it is recorded rather than dressed up as a choice.

### The eleven ramps ship unnamed

Six skin ramps and five hair colours carry **ids, not names**. Naming them is
`docs/content-review.md` §8.1 and `OQ-REVIEW-6`, and it is not an art decision: no colour words, no food
words, no ethnicity or nationality, ever. The display strings arrive as localiser keys owned by `ui-a11y`
and the PO. `CLAUDE.md` requires that colour is never the only signal, so **every option needs a text name
before the creator ships** — the rig is what those names attach to, not where they are decided.

### Slot independence is structural here, not a promise

> Every option in every slot is available with every option in every other slot.
> — `docs/content-review.md` §8.2

The rig cannot express a coupling: a part names its slots in a frame template, and a template that resolves
to a frame which does not exist draws nothing. There is no field in which "this hair only with these tones"
could be written.

**Hair shape and hair colour are two slots, not one.** Twenty combined options in a single `hair` slot
would have been simpler to author and would have made "the coily one is only offered in black" a one-line
change nobody would notice. Two independent slots make the product structural: 4 × 5, always.

The check is arithmetic and a test can run it: **the number of reachable part frames must equal what the
slot product implies, and every declared frame must be reachable.** As shipped: 6 × 4 × 5 × 2 × 2 × 2 × 4 =
**3 840 combinations, 50 frames declared, 50 reachable, 0 unreachable.**

### `presentation` is reserved and empty, out loud

`OQ-ART-08` / `OQ-LEVEL-3` — is the officer's gender presentation fixed or a player choice? — is the PO's
and is not answered. The **slot name is reserved now** so the Rive file and the atlas agree when it is
answered, and it ships with **zero options**. A contract test skips slots whose `status` is `reserved`.

Recording it beats discovering later that Rive called it `presentation` and the atlas called it `gender`.
Whatever the answer, it is a slot on the one artboard with the one proportion canon — never a second
artboard, never a second rig, never a different height.

---

## 4. Parts, draw order and mirroring

Twenty parts, fixed draw order, back to front. Each names a **frame template** whose `{braces}` are slot
names, and a **pivot** — the joint it rotates about, in character space.

| z | part | frame template | pivot | mirrored |
|---|---|---|---|---|
| 1 | `ground-shadow` | `ground-shadow` | 120, 457 | |
| 2 | `arm-upper-r` | `arm-upper-{costume}` | 60, 142 | ✔ |
| 3 | `arm-lower-r` | `arm-lower-{costume}` | 55, 214 | ✔ |
| 4 | `hand-r` | `hand-{costume}` | 52, 282 | ✔ |
| 5 | `leg-upper-r` | `leg-upper-{costume}` | 94, 264 | ✔ |
| 6 | `leg-lower-r` | `leg-lower-{costume}` | 92, 362 | ✔ |
| 7 | `foot-r` | `foot-r-{costume}` | 90, 436 | |
| 8 | `leg-upper-l` | `leg-upper-{costume}` | 146, 264 | |
| 9 | `leg-lower-l` | `leg-lower-{costume}` | 148, 362 | |
| 10 | `foot-l` | `foot-l-{costume}` | 150, 436 | |
| 11 | `torso` | `torso-{costume}` | 120, 264 | |
| 12 | `head` | `head-{skin}` | 120, 112 | |
| 13 | `face` | `face-{expression}` | 120, 112 | |
| 14 | `hair` | `hair-{hairShape}-{hairColour}` | 120, 112 | |
| 15 | `head-covering` | `head-covering-{headCovering}` | 120, 112 | |
| 16 | `hat` | `hat-{costume}` | 120, 112 | |
| 17 | `feature` | `feature-{feature}` | 120, 112 | |
| 18 | `arm-upper-l` | `arm-upper-{costume}` | 180, 142 | |
| 19 | `arm-lower-l` | `arm-lower-{costume}` | 185, 214 | |
| 20 | `hand-l` | `hand-{costume}` | 188, 282 | |

`r` and `l` are the **wearer's** right and left. The canonical facing is **right**, and in that facing the
wearer's left limbs are nearer the camera, which is why they are drawn last. `setFacing('left')` mirrors the
whole character; the Sam Browne's diagonal then runs the other way across the frame, which is correct — you
are looking at the other side of the same person, not at a mistake.

### Empty parts need no special case

`head-covering-none`, `feature-none` and `hat-parka` are frames that do not exist. The rule is: **a resolved
template that is not in `frames` draws nothing.** Both backends implement one rule instead of two, and
adding a head covering later is a new SVG plus one option string.

### Five parts are mirrored rather than drawn twice

`arm-upper`, `arm-lower`, `hand`, `leg-upper` and `leg-lower` are geometrically identical on both sides
about x = 120, so **one frame serves both and the rig mirrors the far one**. Feet are not: a mirrored foot
points backwards, so `foot-r` and `foot-l` are separate art.

This was a budget decision and it should be recorded as one. Drawing the far-side limbs separately, one
ramp step darker so depth read through tone, cost **≈ 1.5 MiB of decoded texture on every level** — Ottawa
could not afford it next to a 17 MiB landmark. Depth now reads through overlap and the 6 px silhouette
outline, which is what the outline is for. If a later level's budget has room, the far-side art is a
re-render of the same geometry with the ramp shifted, and the contract does not change: the part sets
`mirrorX: false` and names its own frame.

---

## 5. The sprite fallback is the same rig, not a lesser one

The fallback is **not** a flipbook of pre-composed frames. A flipbook would multiply
`3 840 combinations × 8 states × frames` and could never ship; more to the point, it would be a *different*
character, and "the fallback nobody wants to look at" is how a seam quietly stops being a seam.

Instead the atlas holds the **same twenty parts**, and the sprite adapter composites them with the **same
per-part transforms** from `states` in the contract JSON. What the two backends actually differ in is
interpolation and where the compositing happens — not in the art, the proportions, the poses or the names.

| | Rive | sprite atlas |
|---|---|---|
| artboard | artboard name | atlas namespace `character-` |
| slot option | runtime-swappable slot | frame key `character-<resolved template>` |
| input | state-machine input | the §2 selector, evaluated from the same values |
| expression | `{expression}` in the face template | `{expression}` in the face template |
| part transform | keyed on the state machine's timeline | `states[state].keys`, lerped on `t` |
| facing | mirror the artboard | mirror the composite |

Each state gives `durationMs`, a loop mode (`loop`, `once`, `hold`) and keys at normalised `t` ∈ [0, 1],
each key carrying `[dx, dy, rotationDegrees]` per part about that part's pivot. Translation is in character
space units, so nothing scales differently between the backends.

---

## 6. Every state survives without Filters (ADR-0011)

The renderer picks a visual tier from measured frame cost, and Canvas has no Filter pipeline. **A character
state distinguished only by a glow does not exist on the plain path**, and colour is never the only signal
(`CLAUDE.md`, Accessibility).

| state | what makes it readable | plain path |
|---|---|---|
| `idle` | breathing rise on torso and head | shape motion |
| `walk` / `run` | limb rotation; `run` is the same cycle at 1.45× amplitude and 0.69× duration | shape motion |
| `jump-rise` / `jump-fall` | opposite arm and knee poses, not just an offset | shape difference |
| `land` | one-shot compression of legs and torso | shape motion |
| `talk` | the near hand opens and the head tilts | shape difference |
| `interact` | the near arm reaches | shape difference |

**No state anywhere in this rig uses a filter, a glow, a blur, a tint or an opacity ramp**, and no state is
distinguished from another by colour alone. There is not a single `<filter>` element in any of the fifty
part sources. Ambient occlusion is baked flat shapes (`art-bible.md` §4) for the same reason.

The four expressions differ in the **shape** of brow, pupil and mouth, so they survive greyscale, high
contrast and a screenshot.

### The face reads on all six skin ramps

The `face` part is shared by every skin tone — it must be, or a tone could get its own facial geometry,
which is exactly the caricature failure `docs/content-review.md` §6.4 names. So it may not use a skin
colour, and ink alone would not do: `ink-warm` `#3a2018` against `skin-6-base` `#553018` is not a read.

Every eye therefore carries a **white sclera with an ink pupil**, and every open mouth a **white interior**.
Those read identically on all six ramps. The glasses lens carries a white glint for the same reason and
places it clear of the pupil.

---

## 7. What a contract test must assert

This is the acceptance for task 1.11: a test loads a `.riv`, loads `rig-contract.json`, and asserts the two
agree. Every check below is mechanical.

**Per artboard in `artboards`** — these run against `rig-contract.riv` today (§8):

1. The `.riv` contains an artboard with exactly that `artboard` name.
2. It contains a state machine named `motion`.
3. For every entry in `stateMachine.inputs`: an input of that **name** exists **and its type matches** —
   `SMIBool`, `SMINumber`, `SMITrigger`. A name that exists with the wrong type is a failure, not a pass:
   `setBool` on a number is the defect this check is for.
4. There is **no input** on the state machine that the contract does not declare. Both directions, like the
   credit gate: an undeclared input is an untested code path.
5. For every slot in `slots` whose `status` is not `reserved`: the artboard exposes a swappable slot of that
   name, offering exactly those option names — set equality, both directions.
6. Slots whose `status` is `reserved` are skipped, and the test asserts they are **absent**, so a reserved
   name cannot be quietly filled in without updating the contract.

**Backend-independent, run against both implementations of `ICharacterRenderer`:**

7. `skinSlots` equals the non-reserved slot names.
8. `skinOptions(slot)` equals that slot's options, for every slot.
9. `setBool`, `setNumber`, `fire`, `setSkin`, `setExpression` return `ok` for every declared name and
   `not-found` for an undeclared one — the port says unknown names never no-op silently.
10. Driving the §2 selector table through both backends selects the same state name for the same inputs.
11. With `reducedMotion = true`, firing `land` does **not** select `land`.

**Against the atlas, so the fallback is provably the same vocabulary:**

12. For every one of the 3 840 slot combinations, each part's resolved template is either a key in `frames`
    or absent from it; nothing resolves to a name that is neither.
13. Every key in `frames` is reachable from some combination — 50 declared, 50 reachable.
14. Every key in `frames` exists as a frame in `assets/dist/manifest.json` under the `shared` atlas.

Check 14 is the one that catches the failure this contract exists to prevent: art renamed on one side only.

---

## 8. The `.riv` side: what exists, what does not, and why

`assets/style/rig-contract.riv` is a **contract fixture**, and it is named for exactly what it is.

**What it contains.** Two artboards, `player` and `officer`, each 240 × 470, each with a state machine named
`motion` carrying all nine inputs from §2 with the right types and fallbacks. It loads in the shipping
runtime (`@rive-app/canvas` 2.42.0) and enumerates to the contract. Checks 1–6 in §7 can run against it
today, which is the point: the Rive and atlas naming can never drift apart unnoticed, even before a Rive
renderer exists.

**What it does not contain: any drawable content.** No shapes, no paths, no fills, no keyframes, no states,
no transitions. It draws nothing.

**It is deliberately not under `assets/src/rive/`.** `scripts/assets.mjs` copies that directory into
`assets/dist/rive/` and lists it in the manifest; a scene adapter can only load what the manifest lists. Put
here, the fixture is mechanically unable to reach a player or be mistaken for the character. That is a
guarantee, not a convention, and it matters because of the next paragraph.

### Why the characters do not ship as `.riv`

A `.riv` carrying the art would need the geometry, the three-tone fills, the clipped shading, the baked
occlusion, eight animations and a state machine with layers, states and transitions — all of it authored in
a binary format that has no public specification and no open-source authoring tool in this repository. The
constants below were recovered by probing the runtime, not read from a document.

Two of them could be shipped anyway. This one could not, and the reason is task 1.12:

> **Rive's budget is ≤ 1.5 ms per character, ≤ 6 on screen, and it is decided by measurement.**

An artboard with no drawable content advances in near-zero time. Measuring it would produce a number that
passes comfortably and means nothing, and the project would adopt Rive on the strength of a measurement of
an empty file. That is the exact failure mode this repository keeps deleting: a gate that looks enforced and
measures nothing. **A `.riv` that renders nothing must not be the thing 1.12 measures**, so it is not
shipped as one.

The sprite path, by contrast, is **complete**: fifty part sources, twenty parts, eight states with per-part
keys, and every name identical to the ones in the fixture. If Rive misses its budget, nothing is missing.

### What the next attempt should do

Write an **SVG → `.riv` compiler in `scripts/`** — build tooling belongs there, next to `assets.mjs`, and a
checked-in binary with no generator is the opaque artefact this repository avoids. It should read the same
fifty sources, so Rive and the atlas cannot diverge by construction. Everything below is the part of that
job that is already done.

### Format constants, recovered against `@rive-app/canvas` 2.42.0

Runtime version **7.3**. All integers are LEB128 varuints unless stated.

```
header  "RIVE" | varuint major=7 | varuint minor=3 | varuint fileId
        | varuint propertyKey ... | 0
        | field-type bitfield
objects  varuint coreTypeKey | ( varuint propertyKey | value ) ... | 0     (repeated to EOF)
```

Two things in that header cost most of the time it took to find them, and both are silent when wrong — the
object stream simply misparses and the runtime reports an unrelated type as unimportable:

- the field-type bitfield is a run of **little-endian uint32**, 2 bits per key, and **four keys per word**.
  The reader takes a fresh word once its bit cursor reaches 8, so the top 24 bits of every word are unused.
  Packing sixteen keys per word looks obviously right and misaligns everything from the fifth key on.
- field type `2` is **float32**, four bytes — not a `double`, despite every name for it.

| field type | encoding |
|---|---|
| 0 | varuint |
| 1 | varuint byte length, then UTF-8 |
| 2 | **float32**, 4 bytes little-endian |
| 3 | uint32, 4 bytes little-endian |

| core type | key | | property | key | field type |
|---|---|---|---|---|---|
| `Backboard` | 23 | | `Component::name` | 4 | 1 string |
| `Artboard` | 1 | | `Artboard::width` | 7 | 2 float |
| `LinearAnimation` | 31 | | `Artboard::height` | 8 | 2 float |
| `StateMachine` | 53 | | `Animation::name` | 55 | 1 string |
| `StateMachineNumber` | 56 | | `StateMachineComponent::name` | 138 | 1 string |
| `StateMachineTrigger` | 58 | | `StateMachineNumber::value` | 140 | 2 float |
| `StateMachineBool` | 59 | | `StateMachineBool::value` | 141 | 0 varuint |

Notes worth keeping, because each one was a dead end first:

- The **first object must be a `Backboard`**; an artboard on its own fails to import.
- A `StateMachine` takes its name from key **55**, not from 138. Its *inputs* take theirs from **138**.
  Using one key for both silently yields a state machine named `""`, which `stateMachineByName` cannot find.
- The runtime **auto-generates** a state machine called `Auto Generated State Machine` when an artboard has
  none, so "`stateMachineCount() > 0`" is not evidence that yours imported. Assert on the name.
- `new StateMachineInstance(stateMachine, artboard)` is what exposes `inputCount()` / `input(i)`, and
  `StateMachineInputType` reuses the core type keys as its enum: 56 Number, 58 Trigger, 59 Boolean.
- The runtime loads in Node with three shims — `document`, `XMLHttpRequest` (emscripten uses XHR, not
  `fetch`, for a `file://` wasm URL) and `fetch` — which is how the fixture is verified with no network.

### The fixture, in full

363 bytes. Reproducible by hand from the table above, and printed here so a binary in this repository is not
an artefact nobody can audit. `sha256 7ae3e3ee7e4315fb4a1b4009f7c93baa47d816afc0fcb92362db380a2b0e4088`.

```
0000  52 49 56 45 07 03 01 04 07 08 37 8a 01 8d 01 8c 01 00 69 00 00 00 21 00   RIVE......7.......i...!.
0024  00 00 17 00 01 04 06 70 6c 61 79 65 72 07 00 00 70 43 08 00 00 eb 43 00   .......player...pC....C.
0048  35 37 06 6d 6f 74 69 6f 6e 00 3b 8a 01 08 67 72 6f 75 6e 64 65 64 8d 01   57.motion.;...grounded..
0072  01 00 3b 8a 01 06 6d 6f 76 69 6e 67 8d 01 00 00 3b 8a 01 07 74 61 6c 6b   ..;...moving....;...talk
0096  69 6e 67 8d 01 00 00 3b 8a 01 0d 72 65 64 75 63 65 64 4d 6f 74 69 6f 6e   ing....;...reducedMotion
0120  8d 01 00 00 38 8a 01 05 73 70 65 65 64 8c 01 00 00 00 00 00 38 8a 01 0d   ....8...speed.......8...
0144  76 65 72 74 69 63 61 6c 53 70 65 65 64 8c 01 00 00 00 00 00 3a 8a 01 04   verticalSpeed.......:...
0168  6a 75 6d 70 00 3a 8a 01 04 6c 61 6e 64 00 3a 8a 01 08 69 6e 74 65 72 61   jump.:...land.:...intera
0192  63 74 00 01 04 07 6f 66 66 69 63 65 72 07 00 00 70 43 08 00 00 eb 43 00   ct....officer...pC....C.
0216  35 37 06 6d 6f 74 69 6f 6e 00 3b 8a 01 08 67 72 6f 75 6e 64 65 64 8d 01   57.motion.;...grounded..
0240  01 00 3b 8a 01 06 6d 6f 76 69 6e 67 8d 01 00 00 3b 8a 01 07 74 61 6c 6b   ..;...moving....;...talk
0264  69 6e 67 8d 01 00 00 3b 8a 01 0d 72 65 64 75 63 65 64 4d 6f 74 69 6f 6e   ing....;...reducedMotion
0288  8d 01 00 00 38 8a 01 05 73 70 65 65 64 8c 01 00 00 00 00 00 38 8a 01 0d   ....8...speed.......8...
0312  76 65 72 74 69 63 61 6c 53 70 65 65 64 8c 01 00 00 00 00 00 3a 8a 01 04   verticalSpeed.......:...
0336  6a 75 6d 70 00 3a 8a 01 04 6c 61 6e 64 00 3a 8a 01 08 69 6e 74 65 72 61   jump.:...land.:...intera
0360  63 74 00                                                                  ct.
```

---

## 9. Where this file should live

`CLAUDE.md` says the contract is `content/characters/rig.json`. **That file does not exist**, and this page
is not claiming otherwise: every mention of it below is a destination, not a citation. It is here because `assets/**` is the art
agent's boundary and `content/**` is not, and because `content/` rejects any file without a `$schema` that
`make validate-content` can resolve.

**Requested from the architect** (`content/schemas/**` is theirs, and this page does not name a schema path
until the file exists — a document that cites a schema nobody wrote is the defect the
`documents-name-real-schemas` gate was written for).

The contract **should** be a validated shape rather than a document, because §7's assertions are only as
good as the file they read: a contract test that loads a malformed rig JSON and finds no inputs to check
would report a pass. What a rig schema needs to constrain, all of it already present in `rig-contract.json`:

| key | shape | the constraint worth having |
|---|---|---|
| `characterSpace` | object | `height / headPx == heightHeads`, so the 6-head canon cannot be edited apart |
| `artboards[]` | `characterId`, `artboard`, `stateMachine`, `skins`, `playerSelectableSlots` | `characterId` matches the id type in `character.schema.json`; `skins` keys are declared slots |
| `stateMachine.inputs[]` | `name`, `type` ∈ `bool \| number \| trigger`, `fallback`, optional `min`/`max` | unique names; a `number` carries `min`/`max`; a `trigger` carries no `fallback` |
| `selector.rules[]` | ordered `when`/`state` | every `state` is a key of `states` |
| `slots` | option list, `fallback`, `playerSelectable`, optional `status: reserved` | `fallback` ∈ `options`, or null when `status` is `reserved`; a reserved slot has **zero** options |
| `expressions` | `names[]`, `fallback` | `fallback` ∈ `names` |
| `parts[]` | `name`, `z`, `frame`, `pivot`, `mirrorX` | `z` is a dense 1…n permutation; every `{brace}` in `frame` names a declared slot or `expression` |
| `frames` | key → `source`, `x`, `y`, `w`, `h` | keys start with `atlas.framePrefix` |
| `states` | `durationMs`, `loop` ∈ `loop \| once \| hold`, `keys[]` | `t` ascending, first 0 and last 1; every part named in a key is a declared part |
| `events[]` | `name`, `when`, `use` | unique names |

Then the file is created at `content/characters/rig.json` (the path `CLAUDE.md` names, which is empty today)
with a `$schema` line. It
is a copy, not a rewrite — no key changes, and this page's citations are updated in the same commit that
creates the schema, never before.

Until then this is the normative copy and the contract test reads it from `assets/style/`.

Two smaller notes for the architect, recorded rather than assumed:

- `ICharacterRenderer` is marked PROVISIONAL and invites the first implementer to change it. Nothing here
  needs a change: every concept in §1–§5 maps onto a method that already exists. The one thing worth
  considering is that `estimatedTextureBytes()` **cannot be honest for the Rive backend** — a Rive artboard
  renders to a canvas surface sized by the display, not by the file, which is the same reason
  `scripts/assets.mjs` records `decodedBytes: 0` for a `.riv`. Either the method returns the surface it
  actually allocated, or it should say it is a sprite-backend quantity.
- `CharacterSlot` in `character.schema.json` will need `hairShape` and `hairColour` as separate slot ids for
  §3's independence rule to be expressible in a character document.

---

## 10. Open questions this contract does not answer

| id | question | owner |
|---|---|---|
| `OQ-ART-08` | Officer gender presentation: fixed, or a player choice? The `presentation` slot is reserved and empty until this is answered. | PO |
| `OQ-ART-09` | Is scarlet review order plausible outdoors on canal ice? If the answer is a winter working uniform, that is a **third `costume` option**, not a change to this contract. | PO |
| `OQ-ART-10` | Visible sidearm on the officer? Currently absent. If it lands it is a part on the `costume` axis. | PO |
| `OQ-REVIEW-6` | The names of the six skin ramps and five hair colours. The rig carries ids only until this is settled. | routed to `ui-a11y` / PO |
| `OQ-REVIEW-8` | Body-mass slot, and whether a wheelchair is a locomotion mode. Neither exists here. A body-mass slot would be a new independent slot; a wheelchair would **not** be a cosmetic slot at all. | PO |
| `OQ-RIG-1` | A character's whole option library is charged to **every** level's decoded-texture budget, because the atlas is one texture. The player wears one combination and pays for 3 840. Fixing it is a pipeline change — per-option standalone images loaded on demand — and it is the single biggest lever on this budget after the landmark. | infra |
