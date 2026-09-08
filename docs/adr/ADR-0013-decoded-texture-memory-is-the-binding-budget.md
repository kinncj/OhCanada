# ADR-0013: Decoded texture memory is the binding budget, and full-screen layers ship at 1× only

- Status: Accepted (2026-09-08)

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

  - **OBLIGATION due=2026-11-08 owner=architect** — decide how shared textures are charged: to the first
    level that loads them, to every level, or to a separate baseline subtracted from each level's ceiling.
    Ottawa is the only level and has no shared textures, so the question is currently unanswerable from
    evidence; it becomes answerable when a second level exists. Until then `docs/architecture.md` §3's
    "+ shared baseline" is a design intent that no gate implements.
