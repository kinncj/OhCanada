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

One **artboard** per character, named for its `CharacterId`. Three ship: `player`, `officer` and `guide`.

`guide` is the **beaver companion** who appears at points of interest and leads the learning moments. It is
on this rig, not beside it: same state machine, same nine inputs, same four expressions, same 6-head canon,
same pivots. Two parts and one costume option carry the whole difference — `tail`, `head-shell` and
`costume: beaver` — and everything else it does, the engine already knew how to do. Its design sheet is
`assets/style/guide.md`.

**Why it is not its own rig.** Because a second rig is a second proportion canon, and the moment there are
two, nothing compares them. `docs/content-review.md` §6.2 is explicit that comparison only works if everyone
is compared. So the companion measures on the same table as every person in the game and is drawn to it: the
same crown, the same sole, the same eye line, the same hand and foot sizes, the same three stroke weights.

There is **one artboard per character, never one per skin tone, hair shape, costume or gender
presentation.** Everything that varies is a *slot* on the one artboard, with the one proportion canon
(`art-bible.md` §7, `docs/content-review.md` §6.1 and §8.6). A second artboard is how a project ends up
drawing one group of people differently from another, so the rig makes it impossible rather than
discouraged.

One **state machine** per artboard, named `motion`. One name, so the adapter never has to choose.

### Character space, and the direction everybody faces

Every part is authored in one 240 × 470 coordinate system at design resolution:

| | |
|---|---|
| centre line | x = 120 |
| crown | y = 40 |
| sole | y = 460 |
| height | 420 px = **6 heads of 70 px**, the canon in `art-bible.md` §7 |
| ground line | world y = 1280 (`ottawa-level.md` §3) |
| view | **three-quarter, canonical facing RIGHT** — body ≈ 40° off strict profile, **head ≈ 25°** |

**The view is part of the rig, not a drawing preference.** This is a side-scroller: every character traverses
along the screen, so the figure is turned toward its direction of travel and `setFacing('left')` mirrors the
whole composite. **The head is turned further than the body**, which is what a walking head does and what
lets the officer keep the chest plane its cross-strap needs; it is also the half of the turn that decides
whether the character reads as travelling, and it was the half the first pass missed. `art-bible.md` §7.1 carries the reasoning and the list of cues that carry the turn; what
this document has to say about it is structural, because in a turned figure **screen x is the fore-aft
axis**. That is why the walk cycle reads: a limb swinging fore and aft swings horizontally on screen, at
full amplitude, instead of foreshortening to nothing as it did front-on.

Two consequences the rest of this page depends on:

- **The near side is the wearer's RIGHT.** A person facing east, seen from the south, shows their right side
  to the camera; their right shoulder projects *west* of their spine. So `-r` parts are the near ones and
  they draw LAST, and the near shoulder sits at x = 103 while the far, chest-side shoulder sits at x = 137.
  This is the reverse of the front-on rig that shipped before, and the z-order was swapped for it.
- **A mirrored pair cannot hold a stride.** The five mirrored frames are reflected about x = 120, so
  anything the authored copy does going right, its twin does going left, and a leaning limb crosses its own
  reflection. The rest pose therefore hangs straight and the stride lives entirely in `states` — which is
  also where it belongs, and it is why the comparison canvas the art hand-off builds shows a neutral stand.

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
| `headCovering` | `none`, `toque` | **`toque`** | yes |
| `feature` | `none`, `glasses` | `none` | yes |
| `costume` | `parka`, `serge`, `beaver` | `parka` | no |
| `presentation` | — **reserved, no options** | — | — |

Plus one axis that is not a slot: **`expression`** — `neutral`, `happy`, `thinking`, `surprised` — driven
by `setExpression`, because the port gives it its own method.

### `fallback`, and why it is not a default

The schema field is `fallback`, renamed from `default` by the architect after `art-bible.md` §8 and
`docs/content-review.md` §8.1: **no tone is the default.** It exists for NPC documents and save recovery.
The creator randomises uniformly over every option on open and **never renders `fallback` as a
pre-selection**. `skin`'s fallback is the middle of the ordinal ramp because something had to be written
there; that arbitrariness is the point, and it is recorded rather than dressed up as a choice.

**`headCovering` is the one fallback that IS a decision, and it is a different decision.** It is `toque`,
not `none`, because a fallback is also what every figure the game spawns wears until the creator is wired:
`level-scene.ts` resolves an unchosen slot to the artboard's `skins` and then to the slot's `fallback`, so
`none` was shipping a bare head into a winter level. `toque` is not a pre-selection in the creator — the
creator still randomises, `none` is still an option, and the officer and the guide pin `headCovering: none`
in their artboard `skins` so the change reaches the player and nobody else. This is a costume decision about
what a Canadian winter looks like, not a claim that some head is the default head, which is what §8.1
forbids and what the `skin` sentence above is about.

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
**5 760 combinations, 66 frames declared, 66 reachable, 0 unreachable** — 24 costume frames (8 templates ×
3 costumes), 36 head-and-neck frames (6 skin + **6 neck**, both on `{skin}`, + 4 expression + 4 × 5 hair),
5 optional singletons (`toque`, `glasses`, `hat-serge`, `head-shell-beaver`, `tail-beaver`) and the ground
shadow.

The part of that product a **player** turns is 6 × 4 × 5 × 2 × 2 = **480 appearances**, and `costume` is not
in it: `costume` says which character an artboard is, not how somebody customised one. Adding the guide
therefore added nothing to the creator and took nothing away from it, which was the constraint the beaver
had to satisfy before it was allowed to exist.

### `presentation` is reserved and empty, out loud

`OQ-ART-08` / `OQ-LEVEL-3` — is the officer's gender presentation fixed or a player choice? — is the PO's
and is not answered. The **slot name is reserved now** so the Rive file and the atlas agree when it is
answered, and it ships with **zero options**. A contract test skips slots whose `status` is `reserved`.

Recording it beats discovering later that Rive called it `presentation` and the atlas called it `gender`.
Whatever the answer, it is a slot on the one artboard with the one proportion canon — never a second
artboard, never a second rig, never a different height.

---

## 4. Parts, draw order and mirroring

Twenty-three parts, fixed draw order, back to front. Each names a **frame template** whose `{braces}` are slot
names, and a **pivot** — the joint it rotates about, in character space.

| z | part | frame template | pivot | mirrored |
|---|---|---|---|---|
| 1 | `ground-shadow` | `ground-shadow` | 120, 457 | |
| 2 | `tail` | `tail-{costume}` | 100, 296 | |
| 3 | `arm-upper-l` | `arm-upper-{costume}` | 137, 146 | |
| 4 | `arm-lower-l` | `arm-lower-{costume}` | 137, 214 | |
| 5 | `hand-l` | `hand-{costume}` | 137, 282 | |
| 6 | `leg-upper-l` | `leg-upper-{costume}` | 132, 264 | |
| 7 | `leg-lower-l` | `leg-lower-{costume}` | 132, 362 | |
| 8 | `foot-l` | `foot-l-{costume}` | 132, 436 | |
| 9 | `leg-upper-r` | `leg-upper-{costume}` | 108, 264 | ✔ |
| 10 | `leg-lower-r` | `leg-lower-{costume}` | 108, 362 | ✔ |
| 11 | `foot-r` | `foot-r-{costume}` | 108, 436 | |
| 12 | `neck` | `neck-{skin}` | 120, 148 | |
| 13 | `torso` | `torso-{costume}` | 120, 264 | |
| 14 | `head` | `head-{skin}` | 120, 112 | |
| 15 | `hair` | `hair-{hairShape}-{hairColour}` | 120, 112 | |
| 16 | `head-shell` | `head-shell-{costume}` | 120, 112 | |
| 17 | `face` | `face-{expression}` | 120, 112 | |
| 18 | `head-covering` | `head-covering-{headCovering}` | 120, 112 | |
| 19 | `hat` | `hat-{costume}` | 120, 112 | |
| 20 | `feature` | `feature-{feature}` | 120, 112 | |
| 21 | `arm-upper-r` | `arm-upper-{costume}` | 103, 146 | ✔ |
| 22 | `arm-lower-r` | `arm-lower-{costume}` | 103, 214 | ✔ |
| 23 | `hand-r` | `hand-{costume}` | 103, 282 | ✔ |

**`neck` is a part, and the z it sits at is the whole reason it is one.** It has to be occluded from BOTH
ends — the coat collar closes over its base, the jaw closes over its top — and only a part between the torso
and the head can be. A stub grown off the torso cannot be covered by the jaw; a stub grown off the head
cannot be covered by the collar, and the head sat on the shoulders for exactly that reason: the neck WAS
drawn, inside `head-{skin}`, above the collar, and it read as a dark notch. Its pivot is the neck ROOT
rather than the shared head pivot, and its keyframe transform is the CHEST's and the HEAD's averaged, per
component, in every key of every state — so the head keeps turning further than the body and the neck is
what makes that turn legible. Its 34 x 35 window at (103, 104) is covered everywhere outside y 121–134: **11 px under the jaw, 4.5 px under
the collar**, against a worst-case relative motion of 0.8 px up and 1.5 px down. The window's lower bound is the
collar and its UPPER bound is `head-shell-beaver`, which has to CONTAIN it or `make verify-art` refuses the
guide's not-applicable claim for `skin` — that gate caught this, and it was right to.

**The same UPPER bound holds over `hair`, and it is a rule about pixels, not about rectangles.**
`head-shell-beaver`'s window is 115 x 124 at (71, 16), and it contains both the neck's 34 x 35 at (103, 104)
and `hair-crop-*`'s 70 x 67 at (75, 20) — which is what `make verify-art` checks. What it cannot check is
that the pelt actually PAINTS that window, and twice now a part under the pelt has moved while the pelt has
not: the crop's crown ended up 5 px above the pelt's and a tan crescent of human hair showed through the top
of the beaver's skull in the render, with every rectangle still nested. So the shell is drawn 1.5–2 px
outside the crop's silhouette all the way round, not merely windowed outside it, and the check to run after
moving any of `head-{skin}`, `hair-crop-*`, `neck-{skin}` or `head-shell-beaver` is a composite of the four
at their frame offsets with a hunt for pelt-uncovered pixels — not a look at the numbers in `frames`.

**`neck-parka`, `neck-serge` and `neck-beaver` do not exist.** A neck is skin, so it resolves on `{skin}`
exactly as the head does, and the guide's pelt covers it exactly as `head-shell-beaver` covers the shared
head and the shared short crop. Templating it on `{costume}` would have given a `skin-6` player a `skin-3`
neck, which is a slot coupling and `docs/content-review.md` §8.2 forbids it.

**The `-r` and `-l` groups swapped places at z when the figure turned**, and this is the one change in this
table that is not a number. In a right-facing three-quarter view the wearer's RIGHT side is the near one, so
the near arm draws over the torso and the near leg over the far leg. The old order put the wearer's left in
front, which was arbitrary on a front-on figure and is simply wrong on a turned one.

**The pivots moved with it.** The arms hang 17 px either side of the centre line rather than 60, and the
legs 12 px rather than 26, because a lateral offset in a turned body projects to `offset × sin(turn)`. Two
sleeves 34 px apart overlap heavily at rest — which is what a three-quarter figure looks like — and the walk
cycle separates them by swinging them fore and aft, which in this view is horizontally.

****The head parts share one pivot at (120, 112) and do NOT share an angle with the torso.** Nothing in the
rig expresses "the head is turned 25° and the body 40°" — that difference is baked into the drawings, in
`head-{skin}`, `hair-*`, `face-*`, `hat-serge`, `head-covering-toque`, `feature-glasses` and
`head-shell-beaver`, and the keyframe `rotation` on those parts is a small nod on top of it. So a redraw of
any ONE of those parts has to hold the same head angle as the other seven or the head comes apart, and that
is not something a gate can check. It is written here because it is the least obvious coupling in the rig.

`hair` sits under `face` and that is deliberate.** It used to be over it. `head-shell` has to be above
`hair` (it covers the head completely) and below `face` (so the shared expressions play on the guide rather
than being redrawn for it), and both cannot be true with hair on top. Every hair shape was re-rendered
against every expression after the move; the fringes read the same, because a hair shape has a face opening
and the face draws inside it.

**`tail` and `head-shell` resolve to nothing on a human.** `tail-parka`, `tail-serge`, `head-shell-parka`
and `head-shell-serge` are not in `frames`, so those parts draw nothing on the player and the officer —
the same rule that makes `headCovering: none` work, with no branch in either backend. The two parts cost
every human artboard exactly one map lookup that misses.

`r` and `l` are the **wearer's** right and left. The canonical facing is **right**, and in that facing the
wearer's **right** limbs are nearer the camera, which is why they are drawn last. `setFacing('left')` mirrors
the whole character; the Sam Browne's diagonal then runs the other way across the frame, which is correct —
you are looking at the other side of the same person, not at a mistake.

### Empty parts need no special case

`head-covering-none`, `feature-none` and `hat-parka` are frames that do not exist. The rule is: **a resolved
template that is not in `frames` draws nothing.** Both backends implement one rule instead of two, and
adding a head covering later is a new SVG plus one option string.

### Five parts are mirrored rather than drawn twice

`arm-upper`, `arm-lower`, `hand`, `leg-upper` and `leg-lower` are drawn straight and symmetric about their
own axis, so **one frame serves both and the rig mirrors the NEAR one**. The art is authored at the FAR
position, right of x = 120, and reflected to make the near limb.

**That symmetry is a constraint the turn imposes, not a saving.** A three-quarter limb that leaned would
have its reflection leaning the other way, and the pair would cross over each other at rest. So the rest
pose hangs straight and the stride is keyframed. It also means the mirrored copy is not, strictly, what a
turned limb looks like from that side — a sleeve is a tube and reads either way, and depth comes from
overlap and the 6 px outline, which is what the outline is for.

Feet are NOT mirrored, and in this view that is the pair that buys the turn rather than a cost: a mirrored
foot would point backwards, and instead `foot-r` and `foot-l` are separate art with **both toes pointing the
way the character travels**, the far one drawn 6 px shorter so the pair reads as depth.

This was a budget decision and it should be recorded as one. Drawing the far-side limbs separately, one
ramp step darker so depth read through tone, cost **≈ 1.5 MiB of decoded texture on every level** — Ottawa
could not afford it next to a 17 MiB landmark. Depth now reads through overlap and the 6 px silhouette
outline, which is what the outline is for. If a later level's budget has room, the far-side art is a
re-render of the same geometry with the ramp shifted, and the contract does not change: the part sets
`mirrorX: false` and names its own frame.

---

## 5. The sprite fallback is the same rig, not a lesser one

The fallback is **not** a flipbook of pre-composed frames. A flipbook would multiply
`5 760 combinations × 8 states × frames` and could never ship; more to the point, it would be a *different*
character, and "the fallback nobody wants to look at" is how a seam quietly stops being a seam.

Instead the atlas holds the **same twenty-two parts**, and the sprite adapter composites them with the **same
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

**Every `[dx, dy]` in `states` is a solved chain, and it has to be, because the rig is FLAT.** Neither
backend parents one part to another: `sprite-character-renderer.ts` places each part from its own pivot and
rotates it on its own, so a rotated thigh does not carry the shin with it. The keyframes therefore ship the
forward kinematics already done — the shin's `dx, dy` is where the knee ended up and its rotation is the
thigh's plus its own, and the foot's is the same one link further out. A limb chain authored as if it were
parented would come apart at the joint, which is what a detached shin in a walk cycle actually is.

---

## 6. Every state survives without Filters (ADR-0011)

The renderer picks a visual tier from measured frame cost, and Canvas has no Filter pipeline. **A character
state distinguished only by a glow does not exist on the plain path**, and colour is never the only signal
(`CLAUDE.md`, Accessibility).

| state | what makes it readable | plain path |
|---|---|---|
| `idle` | breathing rise on torso and head | shape motion |
| `walk` / `run` | limb rotation, swinging FORE AND AFT, which in a turned figure is horizontally across the screen at full amplitude; `run` is the same cycle at 1.45× amplitude and 0.69× duration | shape motion |
| `jump-rise` / `jump-fall` | opposite arm and knee poses, not just an offset | shape difference |
| `land` | one-shot compression of legs and torso | shape motion |
| `talk` | the near hand opens and the head tilts | shape difference |
| `interact` | the near arm reaches | shape difference |

**No state anywhere in this rig uses a filter, a glow, a blur, a tint or an opacity ramp**, and no state is
distinguished from another by colour alone. There is not a single `<filter>` element in any of the sixty
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

12. For every one of the 5 760 slot combinations, each part's resolved template is either a key in `frames`
    or absent from it; nothing resolves to a name that is neither.
13. Every key in `frames` is reachable from some combination — 60 declared, 60 reachable.
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

The sprite path, by contrast, is **complete**: sixty part sources, twenty-two parts, eight states with per-part
keys, and every name identical to the ones in the fixture. If Rive misses its budget, nothing is missing.

### What the next attempt should do

Write an **SVG → `.riv` compiler in `scripts/`** — build tooling belongs there, next to `assets.mjs`, and a
checked-in binary with no generator is the opaque artefact this repository avoids. It should read the same
sixty sources, so Rive and the atlas cannot diverge by construction. Everything below is the part of that
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

## 9. Where this file lives, in two places

`CLAUDE.md` says the contract is `content/characters/rig.json`. **It exists**, and it is a byte-for-byte
mirror of `assets/style/rig-contract.json` except for its `$schema`, which is relative to `content/`. The
copy under `assets/` is the one the contract test loads and the one an art change edits; the copy under
`content/` is the one `make validate-content` walks. **They are edited together, in the same commit** — two
live copies of one document with no gate comparing them is exactly the drift this page's own open-question
table exists to catch, and the reason both exist is that `assets/**` is the art agent's boundary and
`content/**` is not.

**Answered.** `content/schemas/rig.schema.json` exists (ADR-0017) and `rig-contract.json` now carries a
`$schema` line pointing at it. `tests/unit/contracts/rig-is-coherent.test.ts` reads the contract **from
`assets/style/`** and passes 15 checks, so the shape is validated where it is authored and the move below is
a `git mv` plus a one-line relative path.

That mattered more than it looked: §7's assertions are only as good as the file they read, and a contract
test that loaded a malformed rig JSON, found no inputs, and checked none of them would report a pass. This
page asked for the schema **without naming its path**, because a document that cites a schema nobody wrote
is the defect the `documents-name-real-schemas` gate was written for. The path is named here now because the
file is there now.

What the schema constrains, all of it already present in `rig-contract.json`:

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

**What is still open** is the *duplication*, not the move. `content/characters/rig.json` exists and carries
`"$schema": "../schemas/rig.schema.json"`; this copy carries `"../../content/schemas/rig.schema.json"`. That
is the only difference and it is the only difference allowed. Nothing mechanically compares the two yet, so
until something does, the rule is procedural: **an edit to one is an edit to both, in one commit.**

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
