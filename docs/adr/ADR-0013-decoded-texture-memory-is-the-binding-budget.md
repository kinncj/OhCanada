# ADR-0013: Decoded texture memory is the binding budget, and full-screen layers ship at 1× only

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: §5 said the 64 MiB figure is a floor on VRAM and named Rive's canvas surfaces as one
  of the things it cannot see. The art agent has since derived what that costs, and the number is large
  enough to change how the remaining headroom is spent. See "What the uncounted surfaces actually cost".
- Amended 2026-09-08 (second): the per-character surface figure in that section was **1.54 MiB, derived, and
  wrong by one term**. Engine measured **1.72 MiB**; the surface is the artboard (`characterSpace.height`),
  not the crown-to-sole span (`heightPx`). Six characters is 10.33 MiB rather than 9.23. Corrected in place,
  with the reason for the gap kept — the number alone would not stop the substitution recurring.
- Amended 2026-09-08 (third): §4's landmark paragraph was replaced. Scale is a per-asset authoring decision
  recorded in the source filename, not a rule about a category. See that section.

## Context

CLAUDE.md lists seven budgets. Six of them are about bytes moving — payload, level size, total size,
time-to-play. One is about bytes *resident*: "decoded texture memory ≤ 64 MB per level on iPhone". Until
slice 1 they were treated as the same kind of constraint, checked by the same kind of gate, and the payload
numbers were the ones anybody looked at.

The first level with real art settled which one binds, and it is not close:

| Quantity | Ottawa, measured | Budget | Headroom |
|---|---|---|---|
| Level payload | 0.19 MiB | 8 MiB | 42× |
| Decoded texture memory, 1× device | 23.41 MiB | 48 MiB declared / 64 MiB global | 2× |
| Decoded texture memory, 2× device | 38.23 MiB | 48 MiB declared / 64 MiB global | 1.26× |
| Decoded texture memory, 2× device, **had full-screen layers shipped a 2× variant** | **93.61 MiB** | 64 MiB global | **46 % over — unshippable** |

Payload is irrelevant here and saying so is the point: a level can be 0.19 MiB on the wire and 93.61 MiB in
VRAM, because what a GPU holds is `width × height × 4` and WebP's compression ends at decode. A factor of
roughly five hundred, on the same files, in the same build. `layer-10-sky@2x` alone was 2160×3840 =
31.6 MiB — the whole declared budget spent on one sky the player moves past, and about 33 kB transferred, so
no download gate would ever have flinched.

This is the constraint that killed this project's 3D predecessor: roughly 190 textures, WebGL context lost
around 538 MB, on an iPhone that had reported every capability as available, found by a user rather than by
us. ADR-0011 records the same failure shape on the renderer axis — a device advertising what it cannot
deliver. This is the memory axis of it, and unlike the renderer axis it is fully decidable in CI, from files
on disk, before anything ships.

`textureBudgetBytes` has been *required* by `level.schema.json` since slice 0 and
`app/adapters/phaser/level-document.ts` has refused a level that exceeds it since slice 1. Both were
measuring a number the level document declares about **itself**: `ottawa.json`'s `assets[]` is `[]`, so the
runtime's sum is 0 and its refusal could not fire. The only place the real figure existed was
`assets/dist/manifest.json`, where the asset pipeline records `decodedBytes` per file and, until slice 1,
deliberately did not enforce it.

## Decision

### 1. Full-screen parallax layers ship at 1× only

2× is for characters, props and things the player looks at closely — the things a player's eye stops on. A
background the camera slides past does not repay four times the VRAM, and the table above is the argument:
the same art at 2× layers is 46 % over the global ceiling on its own.

### 2. "Full-screen" is defined mechanically, not by pixel area

**A texture is a full-screen layer when its key appears in some level document's `layers[]`.** That is
exactly the set the parallax system draws across the whole viewport, it is a fact already written down in
`content/levels/*.json`, and evaluating it takes no judgement.

A size threshold — "anything over N megapixels is full-screen" — was the obvious alternative and is wrong in
both directions on the only level that exists. Ottawa's sky layer is 1080×1160 and its skyline layer is
1800×300; neither fills a 1080×1920 viewport, and both are drawn across the entire screen every frame. A
threshold would have exempted the exact two textures the rule is for.

The asset pipeline records the answer as `role` on every manifest entry, and the gate **re-derives it from
the level documents and fails if the two disagree**. A `role` nobody cross-checks is a label, not a fact.

### 3. The gate re-derives `decodedBytes` from each file's own header

`scripts/lib/texture-memory.mjs` carries its own WebP and PNG header reader and asserts
`decodedBytes === width × height × 4` for every texture. It does **not** ask sharp, because sharp wrote the
files and computed the numbers being checked; asking it would prove only that a library agrees with itself.
A recorded `decodedBytes` that nobody re-derives is a number a level goes under budget by editing. sharp and
the hand-rolled reader are compared in exactly one place — a test that generates files at known sizes — which
is the only place that comparison means anything.

The same reasoning covers the totals: the gate recomputes each level's footprint from disk and fails if the
manifest's own `levels[].decodedTextureBytes` disagrees. It never trusts a sum it did not add up itself.

### 4. The 64 MiB number is stated in four files, and a contract test makes them agree

`67108864` appears in `CLAUDE.md` (as "64 MB"), `content/schemas/level.schema.json` (as `maximum`),
`app/adapters/phaser/level-document.ts` (as `MAX_DECODED_TEXTURE_BYTES`) and `scripts/lib/texture-memory.mjs`
(as `MAX_DECODED_TEXTURE_BYTES`). Infra kept them identical and made each name the other three, which is the
most that can be done from inside a build script — a JSON Schema cannot import, and a build script may not
import from `app/`.

**The duplication stays, and `tests/unit/contracts/texture-ceiling-is-one-number.test.ts` makes it
unfalsifiable.** The test reads all four *as the things they are*: `JSON.parse` for the schema, a real
`import` for the adapter constant, and a spawned `node --input-type=module` for the `.mjs`, which is how
`tests/unit/infra/` already interrogates that module. Only CLAUDE.md is read as text, because it is prose and
there is nothing else to read it as.

A rule nobody can violate silently beats a rule written down four times, and cross-references are a rule
written down four times.

Two things the test also pins, because they are the parts a careful reader would otherwise have to take on
trust:

- **CLAUDE.md says "64 MB" and every implementation means 64 MiB.** The test asserts that reading explicitly
  — `64 × 1024 × 1024` — rather than leaving a 6.9 % discrepancy to be discovered by whoever next reaches for
  `64_000_000`.
- **The schema's `maximum` is what makes "a level may be stricter, never looser" true.** A level document may
  declare `textureBudgetBytes` below the ceiling; the schema refuses one above it, and the gate enforces
  `min(declared, ceiling)` regardless.

### 5. The number is a floor on VRAM, not a ceiling

4 bytes per pixel is RGBA8888, which is what Phaser uploads; the pipeline emits no compressed-texture format.
**Not counted**: mipmaps (+33 %, because the pipeline does not generate them), render targets, and Rive's
canvas surfaces — the last two because their size is a property of the display, not of a file, and the gate
only measures files.

So a level that passes at 63 MiB may hold more than 64 MiB on a device. That is stated here rather than left
implicit because it is the reason the budget is 64 MiB and not the device's limit: **the headroom between our
number and the hardware's is what the uncounted things live in.** Raising the ceiling toward the hardware
limit would spend that headroom on the one class of allocation this gate cannot see.

## What the uncounted surfaces actually cost (amendment, 2026-09-08)

§5 asked for this derivation by naming the gap. Here it is, from the art agent:

| | Decoded | Counted by the gate? |
|---|---|---|
| One Rive character surface at 2× | **1.72 MiB** (measured) | **no** |
| Six on screen at 2× | **10.33 MiB** (measured) | **no** |
| Ottawa with Rive, landmark at 2× | 46.15 + 10.33 = **56.48 MiB of 64 MiB — 88 %** | partly |
| Ottawa with Rive, landmark at 1× *(shipped)* | 33.30 + 10.33 = **43.63 MiB of 64 MiB — 68 %** | partly |

Both rows are recomputed on the measured surface below; the file totals are the manifest's
(`decodedTextureBytes: 34 918 576` = 33.30 MiB for the shipped build, 46.15 MiB before the landmark was
pinned to 1×).

At 88 % there would be **under 8 MiB left for Phaser's render targets and the browser's own allocations**, on
the class of device this budget exists to protect. That is not a comfortable margin; it is the margin §5 said
the uncounted things live in, largely spent. **The shipped configuration is the 68 % row**, and it is 68 %
rather than 66 % because the surface figure was corrected upward — see immediately below.

**The per-character figure is derivable, and the derivation had a one-term error that a measurement
caught.** It is worth keeping both numbers and the reason for the gap, because correcting only the number
would leave the mistake available to whoever derives it next.

|  | Term | Result |
|---|---|---|
| My estimate | `characterSpace.width × characterSpace.heightPx` = 240 × 420 | 1 612 800 B = **1.5381 MiB** |
| Engine, measured | `characterSpace.width × characterSpace.height` = 240 × 470 | 1 804 800 B = **1.7212 MiB** |

Both times 4 for the 2× scale's pixel count and 4 bytes for RGBA8888. **The surface is the artboard, not the
crown-to-sole span.** `heightPx` is the character's drawn height — what the 6-head proportion is measured
against — and it is the wrong term here: a Rive surface is sized to the artboard, which carries margin. The
two differ by 12 %, and the substitution is easy to make precisely because `heightPx` is the number the rig
talks about most.

**The correction is worse than the estimate, which for a floor is the direction that matters.** A floor that
was too low was under-reporting the thing this section exists to expose. Six characters is **10.33 MiB**, not
9.23 — 1.10 MiB more uncounted than this ADR claimed a day ago.

Recomputed against the shipped manifest (`assets/dist/manifest.json`, `decodedTextureBytes: 34 918 576` =
33.30 MiB at 2×, with the landmark at 1×): Ottawa with six Rive characters is **43.63 MiB of 64 MiB, 68.2 %**
— against 42.53 MiB / 66.5 % on the old figure. Engine reports 1.72 MiB as a **floor** on an *empty*
artboard, and asserts it in one direction only: the test can fail against Rive, never for it. Real artboards
will not be cheaper.

Every term remains data the repository holds — ADR-0017 put `characterSpace` in
`content/schemas/rig.schema.json` and `level.schema.json` already declares `characters[]` — so §4's formula
below stands with `height` substituted for `heightPx`. That substitution is the entire correction, and it is
the reason a measurement was worth taking rather than trusting the arithmetic.

### The decision that follows

**A Rive character surface stops being uncounted.** It was excluded because "their size is a property of the
display, not of a file, and this gate only measures files" — true when it was written, and no longer the
whole truth. The size is a property of *the rig* and *the device scale*, and both are now declared:

```
surfaceBytes(level, scale) = level.characters.length
                           × rig.characterSpace.width
                           × rig.characterSpace.height
                           × scale²
                           × 4
```

- **OBLIGATION due=2026-11-08 owner=infra** — charge that figure against each level's budget in
  `scripts/lib/texture-memory.mjs`, per device scale, **reported as a separate line** from the file total.
  Separate because they are differently trustworthy: the file total is re-derived from bytes on disk, and
  this one is derived from a declaration, so folding them into one number would launder an estimate into a
  measurement. The gate must also fail when a level declares characters and no rig document can be resolved,
  rather than charging zero — a level whose characters cost nothing is the vacuum this project keeps closing.

### Scale is a per-asset authoring decision, not a rule about a category

**This paragraph replaces one that was wrong, and the way it was wrong is worth keeping.** It read
*"landmarks are not moved to 1× by this amendment"*, reasoning that a landmark is a point of interest a
player walks up to and engages, therefore it belongs to the category 2× exists for. That is a rule drawn
around a **category** when the property belongs to the **individual asset**, and it was written without
knowing that the question had already been answered empirically for the only landmark that exists.

Parliament Hill ships at 1×, as `assets/src/svg/ottawa/landmark-parliament-hill@1x.svg`, and it got there by
measurement rather than by budget pressure. Art ran the art-bible §5 two-size test at the shipping size of
1080 × 1040:

- **1:1** — clock face with hands, copper spire, flag with its maple leaf, corner pinnacles, all clean.
- **25 %** — every `mustBeRight` feature survives, including the Library's polygonal roof.
- **120 px black silhouette** — tower, flag and flanking wings still read as a parliament.

In art's words: *"Nothing on this landmark was drawn to need 2×… I would have said so if it failed; the
megabytes are not worth a landmark that fails blind identification."* The 12 px minimum-shape rule is why —
the same reason the parallax layers survived being told their scale after they were drawn. The result is
**46.15 → 33.30 MiB, 96 % → 69 % of Ottawa's declared budget**, and ≈ 42.5 MiB rather than ≈ 55.4 once six
Rive surfaces are folded in.

So the decision is:

- **The default for a landmark, a character and a prop is 2×.** Unchanged, and it is what §1's rule means by
  "things the player looks at closely".
- **An asset may ship at 1× when its artist has run the two-size test and it passes.** The departure is
  recorded where art already records it: **in the source filename**, `…@1x.svg`, in the tree art owns. Scale
  is authored, not inferred.
- **No blanket rule and no threshold decides this.** Infra refused both, correctly and for the reasons this
  ADR would have given: an every-POI-is-1× rule would assert *in a build script* that no POI is ever held
  close to the camera, and a megapixel threshold would demote the character atlas — which is precisely what
  2× exists for, and precisely the mistake §2 already rejected for full-screen layers.

**The objection the old paragraph was protecting survives intact, and it is the part to keep**: a quality cut
applied across every landmark in the game to pay for character count is the wrong trade, and if the measured
total does not fit once the surfaces are counted, the answer is **fewer simultaneous Rive characters** — a
level-authoring decision with a visible cost. What was wrong was treating "is this asset legible at 1×" as a
question answerable from the asset's *category*. It is answerable only by looking at the drawing, which is
the artist's judgement, and it had already been exercised.

This is the third time in this repository a rule has been drawn around a container when the property belonged
to its contents. See **ADR-0019**, which was written because of this one.

### Every number in this ADR is a budget for art the running game has never loaded

Recorded here, prominently, because it changes how much any figure above should be trusted and because it
was found by a person instrumenting the live site rather than by any gate.

The deployed build issues **zero requests for `.webp` or for `manifest.json`.** Every parallax layer renders
the engine's fallback band. The assets are deployed and the keys match; nothing fetches them. Thirty-six e2e
tests pass, because not one of them distinguishes *"drew its art"* from *"drew a coloured band"* — an
anti-vacuum failure (ADR-0014) one layer over from where this ADR was looking.

Two consequences for this ADR specifically, both uncomfortable and neither invalidating:

- **The gate itself is still sound.** It measures files on disk against a declared budget, and that is a true
  bound on what a correct loader would hold. It is a *ceiling on a load path*, and the load path not
  executing does not make the ceiling wrong.
- **The claim in "Alternatives considered" that CI and the runtime "check different populations of level
  document" is currently half-true at best.** `content/levels/ottawa.json` declares `"assets": []`, so
  `refuseOverBudget` sums zero and cannot fire — a level document that declares six `layers[]` and no assets
  to preload. That is a defect in *this* layer, not the engine's, and it is now gated: see
  `tests/unit/contracts/level-declares-the-art-it-draws.test.ts`.

The general lesson is the one this project keeps relearning and is worth stating in the ADR that most depends
on it: **a budget checked against files is not evidence that the files are used.** Both halves need a gate,
and until this session only one had one.

### What is still uncounted, and stays that way

Mipmaps (+33 %, not generated) and Phaser's render targets. Render targets remain genuinely display-sized and
genuinely outside any file or declaration, so the floor-not-ceiling clause survives this amendment — it is
just a good deal tighter. **The budget stays at 64 MiB and not the device's limit** for precisely that
residue.

## How a shared texture is charged (amendment, 2026-09-08)

Québec City landed — five parallax layers, the Château Frontenac, its own theme — so the question this ADR
parked is answerable. The number: **the `shared@2x` character atlas is 9.91 MiB and is charged in full to
both levels — 21 % of Ottawa's budget and 25 % of Québec City's.**

### The finding is in the justification, not the number

`scripts/assets.mjs` states why, and the sentence is the answer:

> A `shared/` file is charged to every level, **because every level downloads it.**

That is a **payload** argument. It is defensible for the payload gate — a player may enter any level first, so
each level should carry the cost of fetching what it needs. It was then inherited by the **decoded-texture**
gate, where it means something else entirely: a texture is *downloaded* per level but *resident* once. One
allocation is being counted twice.

This is not a defect and infra recorded the choice at the time. It is a rule that was correct for the budget
it was written for and wrong for the budget it was reused in.

### The decision: the charge follows the lifetime, not the download

- **A texture that survives `unload` is BASELINE**: counted once, subtracted from the ceiling, charged to no
  level.
- **A texture dropped by `unload` is PER-LEVEL**: charged to every level that loads it.

`shared/` is named for the fact that it outlives a level, so it is baseline. This is also what
`docs/architecture.md` §3 already models — "manifest sum of `decodedBytes` + shared baseline ≤ 64 MB" — so the
decision closes a gap between the diagram and the gate rather than opening one.

What that is worth, on the sprite path that ships (ADR-0022):

| | MiB |
|---|---|
| Shared character atlas, resident once | 9.91 |
| Ottawa's own files (33.30 − 9.91) | 23.39 |
| Québec City's own files (28.20 − 9.91) | 18.29 |
| Render targets, uncounted residue | ~8.00 |
| **Peak, baseline model** | **41.30 of 64 — 65 %** |

**9.91 MiB of headroom was hidden by the double charge**, which is a fifth of a level's budget. Over-counting
is the safe direction and it is not free: it makes art cut real quality to pay for memory nobody holds. This
ADR already refused that trade once, for landmark scale.

### And the character cost is currently counted twice, in two different models

Art's derivation subtracts **10.33 MiB of Rive surfaces** from the ceiling *and* leaves the 9.91 MiB sprite
atlas inside each level's file total. Those are the same characters, priced two ways:

- **Sprite path** — the atlas is resident, surfaces are zero. ADR-0022 decided sprite ships.
- **Rive path** — surfaces are resident, and the atlas need not be uploaded even if it was fetched.

They are alternatives, not addends. So `64 − 10.33 − 8.00 = 45.67` is roughly 10 MiB tighter than the sprite
path requires, and Québec City's recommended 40 MiB is correspondingly conservative. **Peak is
`max(atlas, surfaces)`, never the sum**, because a character is drawn by one backend at a time.

### What ships today, and why the gate does not change yet

**The conservative double charge stays in the gate for now, and the baseline figure is reported beside it.**

The baseline model is only true if two things hold, and neither is currently implemented: `unload` must not
drop the shared atlas, and a transition must never hold two levels at once. `docs/architecture.md` §3
specifies both — unload, then *measure back to baseline*, then check the budget, then load — but the loader
fetches nothing at all today, so that sequence is a design and not a measured fact. Flipping the gate on the
strength of an unimplemented sequence would under-count at exactly the moment that matters.

Reporting both is the same discipline this ADR already applies to device scale and to Rive surfaces: print the
number that ships and the number that would ship, so the difference is visible rather than argued.

- **OBLIGATION due=2026-11-08 owner=engine** — make `docs/architecture.md` §3's sequence real and measured:
  `unload` completes before the next fetch, the shared baseline survives it, and the "back to baseline" check
  fires. A test must show the peak during a transition, not only the steady state — the swap is the moment the
  double charge exists to protect, and it is the one moment no gate observes.
- **OBLIGATION due=2026-11-08 owner=infra** — in `scripts/lib/texture-memory.mjs`, report the baseline-model
  figure per level alongside the charged one, and label which is which. Do not change what the gate refuses
  until the obligation above lands.

## Alternatives considered

- **A single source with a generation step** — one constant, and the schema plus the two constants generated
  from it. Rejected on cost and on trust. It puts a build step between a reader and the number, so a
  checkout's `level.schema.json` becomes an artefact that may or may not be current, and `make
  validate-content` starts depending on codegen having run. It also does not remove CLAUDE.md, which is prose
  and cannot be generated — so the generation step would cover three of four sites and the remaining
  hand-written one is the one a human actually reads. Four hand-written numbers with a test is a smaller
  machine than three generated ones plus a test for the fourth.
- **Accept the duplication with cross-references as the mitigation** — an ADR line and nothing else.
  Rejected: this project's recurring failure is a written claim that stops being true and nothing noticing
  (ADR-0009's whole Context). A cross-reference is a claim. Three of the four sites are machine-readable and
  the fourth is one regex; declining to check them would be choosing prose where a gate was available.
- **Delete the adapter's copy and let CI be the only enforcement.** Rejected: the runtime refusal is what
  turns a too-heavy level into TN-LEVEL-02's error card instead of a lost context, and it must hold for a
  level document that never went through our CI — an imported or hand-edited one. CI and the runtime check
  different populations of level document, which is why both exist.
- **Author full-screen layers at 2× and downscale at load.** Rejected: the decode is what costs, and a 2×
  file is decoded at 2× before anything can resample it. It also spends the payload budget we have plenty of
  to fail the memory budget we do not.
- **Raise the ceiling to what the device actually has.** Rejected: see §5. The gate measures files, and files
  are not all of VRAM. The gap is the safety margin, not slack.
- **Judge "full-screen" by pixel area.** Rejected on measurement, not taste — see §2. It gets both of
  Ottawa's layers wrong.
- **Enforce it in the asset pipeline instead of a separate gate.** Rejected for the reason the pipeline
  cannot check itself: it is the thing that computed `decodedBytes` and assigned `role`. A gate that shares a
  process and a library with the thing it checks measures agreement, not correctness. It runs *inside*
  `make assets` under the same exit code, so it cannot be skipped, but it re-derives everything.

## Consequences

- **Background art is authored once, at 1×, and reviewed at 1×.** That is a real quality cost on retina
  phones and it is the intended trade. The art bible's guidance to author layers larger than the viewport
  stands; the guidance to ship a 2× variant of them does not.
- **`make check-textures` can fail on a tree where nothing but art changed**, and the failure will look
  surprising because the payload gate will be nowhere near troubled. `docs/runbook.md` §"When the deploy
  fails on decoded texture memory" is the response, and it lists three real fixes — author smaller, tile,
  drop the layer. Lowering `textureBudgetBytes` is not one of them, and raising the ceiling means amending
  this ADR and four files.
- **Ottawa has 1.26× headroom at 2×, not 2×.** The next level's art budget should be planned against 38 MiB
  as the realistic figure for a level of this density, not against 64.
- **A new level's `textureBudgetBytes` is now a number somebody must choose deliberately.** The schema will
  take anything from 1 byte to the ceiling, and declaring 64 MiB "to be safe" gives up the per-level signal
  entirely. Ottawa declares 48 MiB against a measured 38.23 and that ratio is a reasonable pattern.
- **The gate reports every device scale, not one number.** A footprint that is fine at 1× and over at 2× is
  the normal failure, and a single reported figure would hide which.
- **This ADR does not cover shared/baseline textures**, which `docs/architecture.md` §3 counts against the
  same ceiling ("manifest sum of `decodedBytes` + shared baseline ≤ 64 MB"). The gate measures per-level
  files; a shared atlas loaded once and charged to every level is not yet distinguished from a level's own.
  Naming it here is how it stays visible.

  - ~~**OBLIGATION due=2026-11-08 owner=architect** — decide how shared textures are charged: to the first
    level that loads them, to every level, or to a separate baseline subtracted from each level's ceiling.
    Ottawa is the only level and has no shared textures, so the question is currently unanswerable from
    evidence; it becomes answerable when a second level exists. Until then `docs/architecture.md` §3's
    "+ shared baseline" is a design intent that no gate implements.~~
    **DISCHARGED 2026-09-08** — Québec City landed, the `shared@2x` character atlas is 9.91 MiB charged in
    full to both levels, and the answer is **baseline**. See "How a shared texture is charged" below.
