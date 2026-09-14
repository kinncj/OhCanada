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
| view | **three-quarter, canonical facing RIGHT** — body ≈ 40° off strict profile, **head at the same three-quarter, face on its leading half** (§7.7 of the art bible; it was ≈ 25° before 2026-09-14) |

**The view is part of the rig, not a drawing preference.** This is a side-scroller: every character traverses
along the screen, so the figure is turned toward its direction of travel and `setFacing('left')` mirrors the
whole composite. **The head sits at the body's three-quarter, with the whole face on its leading half.** Until the
2026-09-14 redesign it was turned further, about 25° off profile, and that crowded both eyes against the
outline and read as a snout at phone size (`art-bible.md` §7.7). The head still decides whether a figure
reads as travelling; it now does it through where the face sits, not through how far the outline is turned. `art-bible.md` §7.1 carries the reasoning and the list of cues that carry the turn; what
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

**This table did not change when the level's locomotion mode reached the rig, and that is the design.** The
selector still picks one of the eight names below, from the same eight rules, in the same order. What a
mode changes is *which timeline that name plays*: `<mode>/<state>` when the rig declares one, the bare state
when it does not. §11 is the mechanism and `app/adapters/phaser/locomotion-pose.ts` is the code; the reason
it is a namespace rather than eight more rules is that a rule is a condition, and eight modes as eight rules
would be eight `if (mode === …)` branches in an adapter.

Eight **selected** states: `idle`, `walk`, `run`, `jump-rise`, `jump-fall`, `land`, `talk`, `interact`.
Thirty-three **declared** ones: those eight, plus the twenty-five `<mode>/<state>` re-poses in §11.

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
| `costume` | `parka`, `serge`, `beaver`, `jacket` | `parka` | no — the player's is chosen by the level (§4, `jacket`) |
| `presentation` | `feminine`, `masculine`, `neutral` | `neutral` | yes — listed last on the player artboard (below) |

Plus **two axes that are not slots**, and both are braces a part template can name:

- **`expression`** — `neutral`, `happy`, `thinking`, `surprised` — driven by `setExpression`, because the
  port gives it its own method.
- **`mode`** — the level's locomotion mode, bound by `app/adapters/phaser/locomotion-pose.ts`. §11.

**Equipment is deliberately NOT a slot, and the reason is `docs/content-review.md` §8.2.** Slot
independence is a rule about what a *player chooses* — the product counts slots, and every slot has to be
free of every other. The mode is not chosen; it is where the player is. Making skates a slot would have put
a level's decision inside the arithmetic that exists to protect a player's, and it would have needed a
`none` option on a slot no creator ever shows. A brace adds no coupling between two slots because it is not
one of them.

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
slot product implies, and every declared frame must be reachable.** As shipped: 6 skin × 4 hair shapes ×
5 hair colours × 2 head coverings × 2 features × 4 costumes × 4 expressions × 3 presentations =
**23 040 combinations, 88 of the 94 frames declared, 88 reachable, 0 unreachable** — 32 costume frames
(8 templates × 4 costumes), 6 bare hands (`jacket` × 6 skin, on `{costume}` and `{skin}` together), 44 head-and-neck frames (6 skin + **6 neck**, both on `{skin}`, + **4 × 3
face**, on `{expression}` and `{presentation}`, + 4 × 5 hair), 5 optional singletons (`toque`, `glasses`,
`hat-serge`, `head-shell-beaver`, `tail-beaver`) and the ground shadow.

**The remaining 6 frames are the `{mode}` equipment (§11) and they are outside this product on purpose.**
They are reached by a level's locomotion mode, not by a slot combination, which is the arithmetic
consequence of the previous paragraph: a level's decision is not in the product a player turns.

The part of that product a **player** turns is 6 × 4 × 5 × 2 × 2 × 3 = **1 440 appearances**, now that
the creator offers `presentation` (480 before it did); neither `costume`
nor the mode is in it: `costume` says which character an artboard is and what a level dresses the player in, the mode says what the level put under
them, and neither says how somebody customised one. Adding the guide therefore added nothing to the creator
and took nothing away from it, which was the constraint the beaver had to satisfy before it was allowed to
exist, and adding skates satisfied the same one.

### `presentation` is open: three options, carried by the face

**Opened 2026-09-14.** `OQ-ART-08` / `OQ-LEVEL-3` asked whether gender presentation is fixed or a player
choice. The product owner answered it by asking for the choice — *"the character has no gender"* — and the
option ids are fixed so the creator can match them: **`feminine`, `masculine`, `neutral`.** The slot kept
the name it was reserved under, which is why it was reserved.

It is still a slot on the one artboard with the one proportion canon. **Presentation lives in face detail
inside the head outline, never in the body:** the `face` part's template is `face-{expression}-{presentation}`,
twelve frames, and they differ only in

| | brows | eyes | mouth | shading inside the outline |
|---|---|---|---|---|
| `feminine` | 2.6 px, arched higher | lashes at the outer corner of each eye | a lower-lip mark | a faint cheek tint |
| `masculine` | 5.2 px, flatter and lower | — | 1.5 px wider | a jaw shadow |
| `neutral` | 3.8 px, medium | — | — | — |

No limb, width, height, head size, outline or pivot differs between them, and `neutral` is a look of its
own rather than the absence of a choice. **Choosing a presentation sets no other slot**: hair, clothing and
everything else stay independent, and the rig carries no coupling, so every presentation
works with every skin, hair shape, hair colour, head covering and feature (§8.2), and the renders of the
riskiest pairings — `feminine` with `crop` under a toque, `masculine` with `long` and glasses — were checked
at phone size before this shipped.

`fallback` is `neutral`, because an NPC document or a repaired save must not acquire a presentation nobody
chose. The guide pins `presentation: neutral` in its artboard `skins`; the officer resolves to the fallback.
**The player artboard lists `presentation` last in `playerSelectableSlots`**, which is the order the creator
draws its groups in; `tests/unit/bootstrap/character-slots.test.ts` asserts the list, and the slot's player
copy is "Style" / « Style ». A save written before the slot opened names no presentation: it takes the
fallback silently and is not reported as a repair, because no choice the player made is gone.

**What the slot system still cannot say.** There is no facial-hair option, no brow slot separate from
presentation, and the costume has one cut: a `parka` presentation detail would be a `{presentation}` brace on
a costume part, which is more frames on every level's shared atlas (`OQ-RIG-1`).

---

## 4. Parts, draw order and mirroring

Twenty-nine parts, fixed draw order, back to front. Each names a **frame template** whose `{braces}` are slot
names, and a **pivot** — the joint it rotates about, in character space. **Four of them are equipment and are
marked ▲; every one of them draws nothing on a level whose mode authors no frame, which is every level
that walks.**

| z | part | frame template | pivot | mirrored |
|---|---|---|---|---|
| 1 | `ground-shadow` | `ground-shadow` | 120, 457 |  |
| 2 | ▲ `mount-deck` | `mount-deck-{mode}` | 120, 440 |  |
| 3 | `tail` | `tail-{costume}` | 100, 296 |  |
| 4 | `arm-upper-l` | `arm-upper-{costume}` | 137, 146 |  |
| 5 | `arm-lower-l` | `arm-lower-{costume}` | 137, 214 |  |
| 6 | `bare-hand-l` | `bare-hand-{costume}-{skin}` | 137, 282 |  |
| 7 | `hand-l` | `hand-{costume}` | 137, 282 |  |
| 8 | `leg-upper-l` | `leg-upper-{costume}` | 132, 264 |  |
| 9 | `leg-lower-l` | `leg-lower-{costume}` | 132, 362 |  |
| 10 | `foot-l` | `foot-l-{costume}` | 132, 436 |  |
| 11 | ▲ `foot-gear-l` | `foot-gear-l-{mode}` | 132, 436 |  |
| 12 | `leg-upper-r` | `leg-upper-{costume}` | 108, 264 | ✔ |
| 13 | `leg-lower-r` | `leg-lower-{costume}` | 108, 362 | ✔ |
| 14 | `foot-r` | `foot-r-{costume}` | 108, 436 |  |
| 15 | ▲ `foot-gear-r` | `foot-gear-r-{mode}` | 108, 436 |  |
| 16 | `neck` | `neck-{skin}` | 120, 148 |  |
| 17 | `torso` | `torso-{costume}` | 120, 264 |  |
| 18 | `head` | `head-{skin}` | 120, 112 |  |
| 19 | `hair` | `hair-{hairShape}-{hairColour}` | 120, 112 |  |
| 20 | `head-shell` | `head-shell-{costume}` | 120, 112 |  |
| 21 | `face` | `face-{expression}-{presentation}` | 120, 112 |  |
| 22 | `head-covering` | `head-covering-{headCovering}` | 120, 112 |  |
| 23 | `hat` | `hat-{costume}` | 120, 112 |  |
| 24 | `feature` | `feature-{feature}` | 120, 112 |  |
| 25 | `arm-upper-r` | `arm-upper-{costume}` | 103, 146 | ✔ |
| 26 | `arm-lower-r` | `arm-lower-{costume}` | 103, 214 | ✔ |
| 27 | `bare-hand-r` | `bare-hand-{costume}-{skin}` | 103, 282 | ✔ |
| 28 | `hand-r` | `hand-{costume}` | 103, 282 | ✔ |
| 29 | ▲ `mount-fore` | `mount-fore-{mode}` | 120, 440 |  |

**The two equipment z's that are not at the ends are the whole reason there are four parts and not one.**
`foot-gear-*` sits immediately after its own boot, because a skate holder closes over a sole and a boot
drawn over a holder is a boot with a grey smudge under it. `mount-deck` is at the back because a rider sits
ON a sled and stands ON a board, and `mount-fore` is at the front because the end of the object that
identifies it — a toboggan's curled prow — is the end the rider's folded shins are on top of. A single
equipment part at either end of the stack cannot be both.

**`neck` is a part, and the z it sits at is the whole reason it is one.** It has to be occluded from BOTH
ends — the coat collar closes over its base, the jaw closes over its top — and only a part between the torso
and the head can be. A stub grown off the torso cannot be covered by the jaw; a stub grown off the head
cannot be covered by the collar, and the head sat on the shoulders for exactly that reason: the neck WAS
drawn, inside `head-{skin}`, above the collar, and it read as a dark notch. Its pivot is the neck ROOT
rather than the shared head pivot, and its keyframe transform is the CHEST's and the HEAD's averaged, per
component, in every key of every state — so the head keeps turning further than the body and the neck is
what makes that turn legible. Since the 2026-09-14 redesign its 36 x 46 window at (102, 100) is covered, on the centre line,
everywhere outside y 126–137 on the parka and 126–139 on the serge: **26 px under the jaw, 7–9 px under the scarf or
collar**, against a worst-case relative motion of 0.8 px up and 1.5 px down. The window's lower bound is the
collar and its UPPER bound is `head-shell-beaver`, which has to CONTAIN it or `make verify-art` refuses the
guide's not-applicable claim for `skin` — that gate caught this, and it was right to.

**The same UPPER bound holds over `hair`, and it is a rule about pixels, not about rectangles.**
`head-shell-beaver`'s window is 116 x 130 at (66, 24), and it contains both the neck's 36 x 46 at (102, 100)
and `hair-crop-*`'s 84 x 73 at (77, 34) — which is what `make verify-art` checks. Since 2026-09-14 the
generator that drew them also composites the four and refuses to write if a single half-pixel sample of head,
crop or neck is left uncovered by the pelt, which is the pixel check this paragraph asks for. What it cannot check is
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
rig expresses "the head is turned this far and the body that far" — that difference is baked into the drawings, in
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

### `jacket`: the costume a level dresses the player in, and the one whose hands are skin

Added 2026-09-14, after a live-site audit found the player in a parka, a scarf and mitts on every summer level.
`jacket` is the player's warm-weather clothes: a light jacket worn open over a plain T-shirt, jeans rolled once
and canvas high-tops. `player.md` §7 is its design sheet. Two things about it are structural.

- **A level chooses it, not the player.** `costume` is still not player-selectable and still outside the 1 440
  appearances a player turns. The player artboard's `skins` keep `parka`, which is what a figure wears when
  nothing else says. A level declares what its player wears, from the season its art sheet states.
- **Its hands are skin, and skin needs `{skin}`.** `hand-{costume}` cannot know a tone, so two parts,
  `bare-hand-l` and `bare-hand-r`, resolve on `bare-hand-{costume}-{skin}`. Only `jacket` has frames there, in all
  six ramps, so the mitts, the gauntlets and the forepaws resolve nothing on it, and no skin tone lacks a hand.
  This is not a coupling in `docs/content-review.md` §8.2's sense: `costume` is nobody's choice, and every skin
  option is drawn. Each bare hand shares its hand's pivot and mirror, draws immediately before it, and carries its
  transform in every key of every state, which `tests/unit/contracts/rig-is-coherent.test.ts` holds. On `jacket`,
  `hand-{costume}` is only the sleeve cuff that closes over the wrist.

**Every `jacket` window sits inside the matching `parka` window**, so `stand-off.ts#figureSpan`, which reads the
artboard's `skins`, gives the same body span in all seven modes whichever costume the level chose, and a stop
computed for the parka stands clear of the jacket. Measured when it landed: −58 to +57 px walking, identical.

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

Instead the atlas holds the **same twenty-nine parts**, and the sprite adapter composites them with the **same
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
| `skate/*` | the body pitches 24°, one skate leaves the ice, the supporting knee folds | shape difference |
| `toboggan/*` | the whole figure is seated and 131 px lower, knees up | shape difference |
| `skateboard/*` | one boot over each truck, 92 px apart, legs not crossed, knees bent forward, leading arm out | shape difference |
| `bike/*` | hands solved to the bar, feet to the pedals, torso folded 22° | shape difference |

**None of the locomotion states is distinguished by its equipment alone**, and that is the rule this row
group exists to record. Equipment is a slot and a slot can be `none`; a pose that only reads because a
skate is drawn under it would go back to reading as a walk the moment a level offered the mode without the
art. Every one of them changes the FIGURE.

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
13. Every key in `frames` is reachable from some combination, or from a declared locomotion mode — 72
    declared, 66 from the slot product and 6 from the four `{mode}` templates.
13a. Every `<mode>/<state>` in `states` names a `<state>` the selector can select. `locomotion-pose.ts`'s
    `strandedPoses` is that check at runtime: a pose named for a state that does not exist is a timeline
    nobody ever sees, and it looks exactly like one that plays.
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
| ~~`OQ-ART-08`~~ | ~~Officer gender presentation: fixed, or a player choice?~~ **Answered 2026-09-14 by the PO: a player choice.** `presentation` has three options (§3). The officer resolves to the fallback. | PO |
| `OQ-ART-09` | Is scarlet review order plausible outdoors on canal ice? If the answer is a winter working uniform, that is a **third `costume` option**, not a change to this contract. | PO |
| `OQ-ART-10` | Visible sidearm on the officer? Currently absent. If it lands it is a part on the `costume` axis. | PO |
| `OQ-REVIEW-6` | The names of the six skin ramps and five hair colours. The rig carries ids only until this is settled. | routed to `ui-a11y` / PO |
| `OQ-REVIEW-8` | Body-mass slot, and whether a wheelchair is a locomotion mode. Neither exists here. A body-mass slot would be a new independent slot; a wheelchair would **not** be a cosmetic slot at all. | PO |
| `OQ-RIG-1` | A character's whole option library is charged to **every** level's decoded-texture budget, because the atlas is one texture. The player wears one combination and pays for 5 760 of them and for four levels' equipment. Fixing it is a pipeline change — per-option standalone images loaded on demand — and it is the single biggest lever on this budget after the landmark. **The `{mode}` equipment made this worse and made it measurable**: Halifax walks and pays 2.47 MiB for a canal skate, a Dufferin toboggan, a seawall board and a waterfront bicycle it will never draw. **Updated 2026-09-14 (infra, ADR-0033): the packing half is closed and the loading half stays open.** The shared page had been chaotic: 1312 to 2048 px tall under a 3 % change, per art-bible §7.7. It is now packed for the smallest area. `shared@2x` went from 2045×1316, 10.27 MiB, to 1278×1805, 8.80 MiB, and ±2 px of frame drift moves it 0.13 MiB rather than 5.97 MiB. Every level still pays for the whole library. Per-option images loaded on demand remain the fix this row asks for. | infra |
| `OQ-RIG-2` | **Closed 2026-09-14 (ADR-0035).** The horse's own gait was not drawn: a ride's art was one still image, so its legs did not move while the ground went by. A ride layer may now declare a `cycle` of frames advanced by distance travelled; the foothills horse walks four frames off Muybridge's plate 574, stands square at rest and holds one stride under reduced motion (§11.5, `alberta-foothills-level.md` §14.4). | engine / art |
| `OQ-RIG-3` | **`train` has no equipment and no pose.** §11.5. A seated passenger needs a bench under them, and a bench is level furniture, not rig equipment. | PO |
| `OQ-RIG-4` | **A brake is not drawn.** The dead `brakeTrigger` and `airborneInput` bindings left the level schema on 2026-09-14 (§11.6); what stays open is whether the rig gets a `brake` trigger and pose. §11.6 says what it would cost. | engine / art |

---

## 11. Locomotion modes — what the level puts under the character, and how it is posed

A player reported the defect this section exists for: *"when it says 'skating', I see no skates, she's
walking… when it says sledding? same thing."* Every level declares a locomotion mode, the HUD names it, the
tuning numbers obey it — and the character played one of eight states that were all authored for a figure on
its feet.

### 11.1 The shape, and why it is not a slot

`app/adapters/phaser/locomotion-pose.ts` is committed and decides this; what follows is the art side of the
same two sentences.

- **A pose is a state named `<mode>/<state>`.** The selector is untouched (§2): it still selects one of the
  eight base names from the same prose rules. What a mode changes is which timeline that name plays —
  `skate/walk` when the rig declares it, bare `walk` when it does not. A mode that is happy with the
  standing `talk` simply does not declare `<mode>/talk` and gets it.
- **Equipment is a `{mode}` brace on a part.** `foot-gear-r-{mode}` resolves to
  `character-foot-gear-r-skate` on the canal and to `character-foot-gear-r-walk` in Halifax, which is not in
  `frames`, so the part draws nothing. That is the rule every `none` option already uses and it needs no
  branch in either backend.

**Neither is a slot, and that is the load-bearing decision.** Slot independence
(`docs/content-review.md` §8.2) is a rule about what a *player chooses*, and the product exists to keep one
player's choice free of another's. The mode is not chosen — it is where they are. A `mount` slot was
authored first and thrown away for exactly this: it put a level's decision inside the arithmetic that
protects a player's, and it needed a `none` option on a slot no creator will ever show. It also could not be
read by `modeArtGaps`, which looks for `{mode}`-templated parts and finds a slot invisible.

**The mode name in the frame key IS the level's mode string**, unaltered. Five of the nine modes in
`game.config.json` therefore resolve to nothing today, and two of those are correct:

| level mode | equipment frames | poses declared | drawn? |
|---|---|---|---|
| `walk` | none, by design | none — it **is** the base cycle | yes |
| `skate` | `foot-gear-l/r-skate` | `skate/idle`, `skate/walk`, `skate/run` | **yes** |
| `toboggan` | `mount-deck-toboggan`, `mount-fore-toboggan` | `toboggan/idle`, `/walk`, `/run` | **yes** |
| `skateboard` | `mount-deck-skateboard` | `skateboard/idle`, `/walk`, `/run` | **yes** |
| `bike` | `mount-deck-bike` | `bike/idle`, `/walk`, `/run` | **yes** |
| `train` | none — the car is a ride (ADR-0031) | `train/idle`, `/walk`, `/run`, `/talk`, `/interact` | **yes, seated in a ride — §11.5** |
| `horse` | none — the horse is a ride (ADR-0031) | `horse/idle`, `/walk`, `/run`, `/jump-rise`, `/jump-fall`, `/land`, `/talk`, `/interact` | **yes, astride a ride — §11.5** |
| `canoe`, `dogsled` | none | none | no, and no level asks yet |

`modeArt().covered` is `base || poses || equipment`, so `walk` is covered by the state that carries its own
name, and `train` and `horse` by their poses. **That is the honest answer and it is why no frame was authored for
them:** a mode declared with no art draws a walking figure and says nothing, which is the whole defect. An
empty declaration would have made `data-mode-gaps` read 0 while the screen was still wrong.

**Every `<mode>/<state>` names a base state**, never a new verb. `skate/glide` would be a timeline the
selector can never select — a `once` state that is never entered looks exactly like one that is, which is
why `locomotion-pose.ts` reports `strandedPoses` at level open. Each mode declares `idle`, `walk` and
`run`; `run` matters because the selector picks it above `speed` 0.55 and a mounted figure that popped to a
standing sprint at speed is the same defect in a new place. For `toboggan` the two cycles are identical
keys under two names, because a sled does not change posture when it goes faster and the alternative is a
seated rider standing up at 0.55.

### 11.2 The four parts

`mount-deck`, `foot-gear-l`, `foot-gear-r`, `mount-fore` — §4 has the z's and the reason each one sits where
it does. Which parts a mode uses is a property of the mode, and most use one or two:

| mode | `mount-deck` | `foot-gear-l` / `-r` | `mount-fore` |
|---|---|---|---|
| `skate` | — | **the skates** | — |
| `toboggan` | the deck | — | the curled prow |
| `skateboard` | the board | — | — |
| `bike` | the whole bicycle | — | — |
| `walk` | — | — | — |

`foot-gear-*` carries **its own boot's transform, component for component, in every key of every state** —
including `talk`, `interact`, `jump-rise` and `land`, which is what stops a skate detaching from a boot
while its wearer is standing at a point of interest. Both share the ankle pivot, so one number moved in a
keyframe moves boot and blade together or the rig is wrong in a way a render will show.

### 11.3 Equipment is drawn oversized, on purpose

**A scale skate blade is 3 px at design resolution and 1.1 px on a 390 px phone.** That is the whole of the
small-tier rule in one number. Every dimension below is a deliberate exaggeration and the render at phone
width is what set it:

| drawn | scale would be | why |
|---|---|---|
| runner 12 px deep | 3 | the 6 px silhouette stroke eats 6 of any depth; an 8 px runner rendered as solid ink and the first phone render showed it |
| runner 92 px long (near), 78 (far) | ~68 | the overhang past toe and heel is the part of a skate that survives being made small, and it makes the foot silhouette GROW when the skates go on |
| skateboard wheels 22 px across | ~7 | two pale discs under a dark deck is the entire read |
| bicycle tubes 10 px, wheels 88 px | 4 / 80 | a 4 px tube is a scratch |
| toboggan deck 18 px thick, 24 px of it behind the rider | ~8, 0 | at 8 the plank vanishes under the coat hem, and with no tail behind the back the sled is a line under a seated person |

The far-side skate is drawn **20 px shorter than the near one**, which is the same convention the two boots
already use: the pair reads as depth rather than as a mistake. Its runner sits at the near skate's height
rather than the far boot's, so both blades ride one ice line.

### 11.4 Poses, and the two numbers that are not style

Every mode pose was authored in joint angles and solved by forward kinematics from the hip and the shoulder,
exactly as `walk` was — the rig is flat, so `dx, dy` is where the joint ended up and the rotation is
absolute (§5). Hands on a handlebar and feet on pedals are solved by two-link inverse kinematics instead,
because a hand 6 px off a bar is invisible in the SVG and obvious in the render. Two constraints are
arithmetic, not taste, and both changed a pose:

- **A leaning torso carries the shoulders and the head with it, and this rig's existing states do not.**
  At `run`'s 7° that is 14 px of shoulder and nobody noticed. At a skater's 24° it is 48 px, and a head left
  where it was is a head detached from its collar — which is exactly what the first skate render showed.
  Every mode pose therefore adds `R(torso) · (joint − waist) − (joint − waist)` to the arm chains and to the
  head-and-neck group. That is why `head` and the six parts that share its pivot carry a `dx` for the first
  time in this rig.
- **The arms are 136 px and the legs 172, and both run out.** The cyclist folds 22° over the bar and not
  further, because at 22° the bar is 132 px from the carried shoulder and at 30° it is 142 — past the end of
  the arm. The tobogganer's knees are up rather than out, because 172 px of leg from a hip 19 px above the
  deck reaches about 70 px forward and no more. Neither number is a drawing decision that could have gone
  another way.

Three more rules that a later editor will otherwise undo:

- **The skate poses lift the whole figure by 9–12 px and leave `ground-shadow` at zero.** The runner hangs
  10 px below the boot sole, so without the lift the blade rides under the ice. The shadow stays on the
  ground line because that is what it is. In the base states a skater falls back to — `talk`, `interact`,
  `land` — there is no lift and the runner sits proud of the line, which reads as a blade biting the ice.
- **`toboggan/*` moves the figure 28 px BACK as well as 131 px down.** A sled reaches further forward than
  its rider does; anchored on the rider, the prow would be off the front of character space.
- **The skate poses cross y = 0 and x = 0, and a composite has to allow for it.** The lift puts the toque's
  crown at about **y −8** in `skate/idle` and `skate/walk`, and the trailing skate's tail reaches about
  **x −8** at full extension. Neither clips at runtime — the sprite backend places each part from its own
  pivot in world space and nothing is drawn into a 240 × 470 buffer — but anything that composites the rig
  into character space, including the art hand-off, must anchor at (−12, −12) or it will crop the pom and
  the blade tip. The rig already did this once: `jump-rise` reaches y −6 and has since it shipped.
- **A seated mode falls back to a standing `talk`.** The selector reaches `talk` before anything a mode can
  re-pose, so a level offering `toboggan` should set `interaction: null` and `jump: null` on that mode and
  dismount the player, which returns the mode to `walk` and the figure to its feet. Declaring
  `toboggan/talk` is the alternative and is one more pose, not a mechanism change.

### 11.5 What is NOT drawn, and why

**A horse is not rig equipment.** It was drawn three times as equipment and thrown away three times, and the reasons are worth
keeping because they are structural rather than "it looked wrong":

1. **A rider sits INSIDE a horse's silhouette, not on top of it.** The far leg belongs behind the barrel and
   the near leg in front of it. The four equipment parts offer the back of the stack and the front of it and
   nothing in between, so a horse needs a fifth z — between `foot-gear-l` and `leg-upper-r` — that no other
   mode has any use for.
2. **It needs its own gait.** A skate follows a boot; a horse's legs cycle on their own skeleton. That is at
   least two more parts and a second animation authored on a non-human figure, which is a different job from
   posing this rig, and a horse whose legs do not move while the ground scrolls reads as a toy.
3. **It is ~300 × 200 px of art charged to every level.** At 2× that is about 0.96 MiB of decoded texture on
   Halifax, which walks, for one level's animal. The five frames that DID land already cost every level
   2.47 MiB (§11.7) and Halifax is at 80 % of its budget.

The recommendation is the one the size argument points at: **a ridden animal is a level entity with a ride
anchor, not equipment on the rider** — the level places and animates it, and the rider plays a `horse/*`
pose over it. That needs `level.schema.json` and the engine, which is why it is `OQ-RIG-2` and not a row in
the table above. Authoring the astride pose on its own was considered and rejected: a figure sitting in
mid-air is a worse defect than a figure walking, and `modeArtGaps` would have reported `horse` as covered.

**`train` gets no equipment and no pose, and that is a judgement rather than an omission.** The player is a
passenger, the camera does the moving, and what a seated passenger needs is a bench and a carriage wall —
level furniture, not rig equipment. `prairie-rail` is drawn as an exterior line with a railbed and has
neither, so until it has an interior the honest answer is a figure standing beside the track and a gap
printed at level open. Reconsider it when the level has something to sit on.

**Re-examined 2026-09-14, after a player reported the figure "walks by itself on a track".** The judgement
above still binds, and it is now numbers rather than a preference:

- **The reference exists and is licence-clean.** The train that crosses the Prairies with passengers is VIA
  Rail's *Canadian*: Budd stainless cars, a dome, a rounded observation end. `assets/refs/prairie-rail/`
  now holds two CC BY 2.0 photographs of it at Jasper in 2013 and a public-domain side elevation from 1981.
  The wordmarks, the logo and the car names in them are never drawn.
- **A car the figure can visibly ride is wider than the screen.** The camera's `offset.x` is 200 in the
  direction of travel, so the rider stands at screen x 340 of 1080; at the line's 760 px/s cruise the
  dead zone and the follow lerp let the rider run 207 px ahead of where the camera wants them. A car
  attached to the rider has to reach at least **740 + 207 px ahead and 340 + 80 px behind: about 1 370 px**,
  or one of its cut ends is on screen — which is a half-drawn car, not a train. At any scale where a person
  shows at a window it is also several hundred px tall.
- **As rig equipment that is unaffordable on every level.** Rig frames live on the shared atlas, charged to
  all ten levels (`OQ-RIG-1`). A 1 370 × 400 frame is 2 740 × 800 at 2×, over the 2 048 px page and
  **8.4 MiB** standalone; Halifax has 5.36 MiB spare and Toronto 5.44 after this pass.
- **As prairie-rail art it is affordable and cannot be placed.** A car pinned at 1× costs about 3.5 MiB on
  a level with 6.25 MiB spare — but `level.schema.json` has no entity that travels with the player and
  the scene has nothing to put a rider inside one. That is the same missing mechanism as the horse above.

So the recommendation for both is the one already written: **a ridden vehicle or animal is a level entity
with a ride anchor.** When it exists, the art is a prairie-rail source drawn from those references and three
poses, `train/idle`, `/walk` and `/run`, of a passenger seated at a window. Neither is authored before then:
a car nothing can place is charged and never drawn (art bible §9), and a seated pose with no car is a figure
sitting in mid-air over the rails.

**Landed 2026-09-14, as ADR-0031.** The mechanism is `level.schema.json#/$defs/ride`: level art registered to
its rider by a `riderAnchor` and a `groundLineY`, placed at the player every frame. The prairie car is
`assets/src/svg/prairie-rail/ride-park-car@1x.svg`, 1 420 × 590 at 1x, the rear of the *Canadian* with its
observation end and dome, on a repeating track strip. Three things this section predicted and one it did not:

- **The poses are five, not three.** `train/idle`, `/walk` and `/run` share one seated key set, and
  `train/talk` and `train/interact` exist because the selector reaches `talk` and `interact` before anything a
  mode re-poses, and a passenger who stood up to gesture would put their head through the dome. The feet rest
  on the sole line, which is the ride's floor; the hips drop 91.34 px; the upper body reclines 3° and carries
  the shoulders and head with it (§11.4); the hands rest on the lap by two-link IK, and in `talk` and
  `interact` the near hand rises past the dome's sill, because a gesture below the sill is not seen.
- **The rider sits in the dome, not at a window.** At 390 px a head and shoulders in the dome glass, against
  the sky, is the one view of a passenger that survives; a head in a side window is a dark square with a dot.
- **The car costs 3.2 MiB on prairie-rail and nothing anywhere else**, which was the point.
- **The car does not stand on the walking line**, which this section did not foresee. A passenger car tall
  enough to seat the rider in its dome is taller than the container car and the guide that stand on that line,
  so it runs on a nearer line across the ground fill and they stand beyond it. ADR-0031 §3 has the reasoning.

`train` no longer reports as a gap. **No level may declare `train` without a ride**, because its poses are a
passenger sitting on a floor; `tests/unit/contracts/level-art-is-placed-where-it-is-drawn.test.ts` holds that
for every mode any level rides.

**The horse landed the same way, 2026-09-14.** The foothills level declares a ride: a saddled bay ranch horse,
`assets/src/svg/alberta-foothills/ride-ranch-horse@1x.svg`, 600 × 446 at 1x, one `behind` layer, turning with the
rider, on a world-fixed trail strip 340 px below the walking line (`alberta-foothills-level.md` §14 has the
placement). What the three points at the top of this section became:

- **Point 1, the fifth z, is answered by the pose, not by a part.** The ride has one layer behind every rig part,
  so nothing can go between the rider's legs. `horse/*` puts both hips on the near hip and both ankles on the
  near stirrup, so the far leg is exactly behind the near one, which is where the barrel would hide it.
- **Point 2, the gait, is drawn by the ride, not the rig (ADR-0035).** Since 2026-09-14 a ride layer may declare a
  `cycle`, and the horse walks four frames off Muybridge's plate 574, one frame per 55 px travelled, stands square
  at rest, and holds one stride under reduced motion. The saddle is the group `seat`, identical in every frame, so
  the rider's anchor never moves. `OQ-RIG-2` is closed.
- **Point 3, the cost, is the level's.** 1.02 MiB for the horse and 0.22 MiB for the trail, on the foothills level
  only; the shared atlas did not change, because no rig frame was added.

**Eight poses, because the mode jumps.** The foothills `horse` tuning has a `jump`, so the selector reaches
`jump-rise`, `jump-fall` and `land` as well as the five the train needed, and a rider who popped to a standing
jump would leave the saddle. The seat is solved from the rig's pivots: the hips drop 29 px, the thigh goes
forward about 40 degrees and the shin back about 23, heel down 8, the sole on the ride's anchor on the stirrup
tread; both fists hold the rein above the horn by two-link IK. `walk` and `run` swing the seat fore and aft and
rock the upper body, and never bob on their own clock: the ride's `bob` moves horse and rider together by distance,
and a second rock by time would drift against it. `ground-shadow` moves 160 px to the hoof row, under the belly,
because at the sole line it would be a stain on the horse's side.

**One pose was fixed on the render, not in the numbers.** `horse/talk` first copied the train's raised arm, upper
arm at -58 degrees, and at phone size the mitt covered the rider's face. It is raised forward to horizontal now,
and its forearm keys are written 192 and 208 rather than on either side of 180: `train/talk`'s 172 and -172
interpolate linearly through zero, which spins that forearm a full turn in 800 ms.

`tests/unit/contracts/a-rider-stays-on-the-ride.test.ts` holds what a ride cannot say for itself: for every mode
any level rides, each ankle is one point across every key of every `<mode>/*` state, and foot-gear rides on its boot.

**`canoe` and `dogsled` are in `game.config.json` and no level uses them.** A canoe is a `mount-deck` and a
`mount-fore` and would work; a dog team is a horse-shaped problem.

### 11.6 `airborne` and `brake` — the two bindings that name nothing

`level.schema.json`'s `locomotionAnimationBinding` let a level name `airborneInput` and `brakeTrigger`, and
every level named `airborne` and `brake`. **The rig declares neither**, so both bindings were dead, and
`character-cast.ts#unboundAnimationInputs` logged them at every level open. **Both fields were removed from
the schema, the port and all ten levels on 2026-09-14**: nothing read either one, and
`tests/unit/contracts/a-level-binds-only-what-the-rig-declares.test.ts` now holds every name a binding still
gives to an input the rig declares, of the type its field drives.

- **`airborne` should not be added.** It is `grounded` inverted, and two bool inputs that are each other's
  negation is a defect waiting for the one frame they disagree. The fix belonged on the other side, and
  renaming the binding to name `grounded` would have been a field with no reader; the scene already drives
  `grounded` by the rig's own name. Adding it here would make the contract wrong in a way no test can see.
- **`brake` should be added, and it is a real pose.** When it is, the level binding comes back with it, as a
  trigger the contract test above can check. A hockey stop on the canal and a foot-drag on the
  seawall are the two most characteristic things either mode does, and both die with the trigger. It costs:
  one `trigger` input on the state machine, one selector rule above `jump-rise` naming a new base state
  `brake`, a `<mode>/brake` pose per mode that has one, and **a rebuilt `rig-contract.riv`** — §8's fixture
  carries exactly the nine inputs of §2 and a tenth declared input would fail check 3 against it. The format
  is documented in §8 and the fixture is 363 bytes; this is an afternoon, not a project. It was left out of
  this pass because the reported defect was the walk cycle, and a half-drawn brake on four modes would have
  been the same mistake in a new place.

### 11.7 What it cost

Six frames, five source files, four parts, twelve poses. No slot, no schema change, no new input.

| | before | after |
|---|---|---|
| `shared@1x` | 750 × 1440, 4.12 MiB decoded | 995 × 976, **3.70 MiB** |
| `shared@2x` | 1214 × 2046, 9.48 MiB decoded | 2045 × 1531, **11.94 MiB** |
| Halifax texture | 24.58 MiB of 34 | **27.05 MiB of 34 (80 %)** |
| Halifax payload | 0.36 MiB of 8 | **0.39 MiB of 8** |
| Ottawa texture | 32.87 MiB of 48 | **35.34 MiB of 48 (74 %)** |

**The 1× page got smaller while the 2× page grew by 2.47 MiB**, and the two numbers are not a contradiction:
the packer re-laid both pages and flipped the 2× page from portrait to landscape. Area predicts nothing
here — one 2 px change to a skate runner moved the page by hundreds of pixels and MiB in both directions.
The only safe procedure is to run `npm run assets` after every frame added or resized and read the two
gates, which is what produced this table. Halifax is the level to watch: it walks, it has the smallest
budget, and it pays for all of this.
