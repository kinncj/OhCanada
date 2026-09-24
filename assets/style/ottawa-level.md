# Ottawa level art — layers, offsets, budgets and the decisions behind them

Task 1.9. Sources are `assets/src/svg/ottawa/*.svg`; `assets/style/art-bible.md` is the house style and
`assets/refs/references.json` is the accuracy contract `make verify-art` judges renders against. This file is
the level-specific sheet: what each texture is, where it goes, what happens to it at each visual tier, and
which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**.

---

## 1. What was produced

Ten SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/ottawa/` gets the key `ottawa-<filename>`:

| key | source | authored px | what it is |
|---|---|---|---|
| `ottawa-layer-10-sky` | `layer-10-sky.svg` | 1080 × 1160 | three flat sky bands, eight clouds |
| `ottawa-layer-20-skyline` | `layer-20-skyline.svg` | 1800 × 300 | distant generic winter city and park |
| `ottawa-layer-30-escarpment` | `layer-30-escarpment.svg` | 1440 × 320 | wooded escarpment, snow crest |
| `ottawa-layer-40-treeline` | `layer-40-treeline.svg` | 1440 × 340 | bare trees and spruces on the bank |
| `ottawa-layer-50-canalwall` | `layer-50-canalwall.svg` | 2016 × 640 | retaining wall, railing, lamps, warming hut, lane spruces, skaters, one road bridge |
| `ottawa-layer-60-ice` | `layer-60-ice.svg` | 1440 × 560 | the skateway lane, sheen and skate scoring |
| `ottawa-landmark-parliament-hill` | `landmark-parliament-hill.svg` | 1080 × 1040 | **a POI hero**: Centre Block, the Peace Tower, the Library of Parliament |
| `ottawa-prop-rideau-locks` | `prop-rideau-locks@1x.svg` | 680 × 440 | **POI hero, added 2026-09-13**: a lock chamber, its mitred timber gates and their balance beams |
| `ottawa-prop-library-of-parliament` | `prop-library-of-parliament@1x.svg` | 600 × 820 | **POI hero, added 2026-09-13**: the round library, drawn as the building rather than as the spire tip the hero shows |
| `ottawa-prop-warming-hut` | `prop-warming-hut@1x.svg` | 560 × 360 | **POI hero, added 2026-09-13**: a warming hut standing on the skateway ice |
| `ottawa-poi-marker-idle` | `poi-marker-idle.svg` | 132 × 176 | tappable POI marker, not in reach |
| `ottawa-poi-marker-active` | `poi-marker-active.svg` | 132 × 176 | tappable POI marker, in reach |
| `ottawa-particle-snow` | `particle-snow.svg` | 96 × 32 | three snow-flake sizes |

There is no officer and no `.riv` here. The officer is a character artboard and belongs to task 1.11 with the
rig contract; drawing it now would fix a rig it has not seen.

**Task 1.11 landed and changed two numbers on this page.**

1. **The landmark was cropped from 1080 × 1160 to 1080 × 1040.** Its first painted row was y = 127; the
   120 rows above it were empty and were costing **2.08 MiB of decoded texture at 2×** to hold nothing.
   That is this sheet's own rule — crop each tile to the world band it actually covers — finally applied to
   the one source that had been exempt from it. The `viewBox` now starts at y = 120, so **the placement
   offset changes from `(poiX − 540, 0)` to `(poiX − 540, 120)`** and every world coordinate quoted in §3
   (flag top 140, clock centre 456, terrace 1090) is unchanged. Nothing in `content/levels/ottawa.json`
   changes: a POI carries a `position`, not an offset, and the offset rule lives here.
2. **The characters land in this level's budget.** They are `shared/` sources, so they are charged to every
   level; today Ottawa is the only level, so the whole cost is here. See §5.

**There are no standalone prop files.** An earlier pass shipped `prop-warming-hut`, `prop-lamp-standard`,
`prop-spruce-marker`, `prop-canal-bench`, `prop-bridge-portal` and `prop-skater` as separate sources. Every one
of them is *already inside* `layer-50`, `level.schema.json` has no way to place a loose prop (a level is
parallax layers, POIs and characters), and the pipeline would have packed and charged all six to Ottawa's
texture budget for nothing. They were deleted. If a later level wants a warming hut, lift the shapes out of
`layer-50-canalwall.svg`; that file is the canonical geometry.

---

## 2. The parallax stack

`depth` is render order, low behind high. `content/game.config.json` keeps **6 layers at `high`, 4 at
`medium`, 2 at `low`**, and `level.schema.json` says the preset **keeps the highest depths and drops the
rest**. So the drop order is decided at authoring time by which depth a thing sits at.

| depth | key | tile | world y | `scrollFactor.x` | `repeatX` | survives `medium` | survives `low` |
|---|---|---|---|---|---|---|---|
| 10 | `ottawa-layer-10-sky` | 1080 × 1160 | 0 … 1160 | 0.02 | true | no | no |
| 20 | `ottawa-layer-20-skyline` | 1800 × 300 | 790 … 1090 | 0.20 | true | no | no |
| 30 | `ottawa-layer-30-escarpment` | 1440 × 320 | 780 … 1100 | 0.42 | true | yes | no |
| 40 | `ottawa-layer-40-treeline` | 1440 × 340 | 760 … 1100 | 0.68 | true | yes | no |
| 50 | `ottawa-layer-50-canalwall` | 2016 × 640 | 700 … 1340 | 1.00 | true | yes | **yes** |
| 60 | `ottawa-layer-60-ice` | 1440 × 560 | 1280 … 1840 | 1.00 | true | yes | **yes** |

`offset.y` is the world y in the table's third column; `offset.x` is 0 for every layer.

### Why nothing identifying is on a droppable layer

At `low` the player sees exactly two layers: the canal wall and the ice. Between them they carry the retaining
wall with snow banked against its foot, the railing and lamp rhythm, the warming hut, the lane spruces, four
skaters in glide stance, a road bridge, and the scored ice lane. That still reads as *the Rideau Canal
Skateway in winter* rather than as a broken scene, which is the test the brief set.

**The landmark is not a layer.** `ottawa-landmark-parliament-hill` is the POI's `artKey`, so the Peace Tower
is present at every tier, on every device, with no dependence on the preset. That is the single most important
structural decision in this level and it is why the drop order above is safe.

### What the dropped layers cost

At `medium` and `low` the sky layer is gone. That is not a hole: `palette.json`'s `levelTheme.ottawa-winter`
sets the theme gradient's three stops to **the same three colours as the sky layer's three bands**, in the same
order (`sky-shade` at the zenith, `sky-light` at the horizon rule, `snow-base` at the ground). Dropping the
layer turns a banded sky into a smooth gradient sky. The clouds are lost; nothing else is.

The same trick closes the bottom of the frame: `layer-60-ice` stops at world y 1840 rather than 1920 because
its last band is `ice-light` `#e4f2f6` and the theme's `ground` stop is `snow-base` `#e6eff7`. Two values
apart. Eighty rows of texture were not spent on an invisible join.

### The desktop side panel

ADR-0002 extends the theme gradient into the panels beside the letterboxed canvas. The sky layer's extreme
left and right columns are pure band colour — every cloud is kept inside x 120…960 — so the panel seam has
nothing to disagree with. Same for the ground: the ice layer's bands run full width.

**Until 2026-09-14 `ottawa.json` did not carry the theme §3 asks for.** Its `theme.sky` was `sky-base`
`#3d8ccb`, not `sky-shade` `#1f5fa8`, so the gradient the tiers fall back to did not open on the sky layer's
top band, and on a phone taller than 9:16 the letterbox above the canvas, which the page paints `theme.sky`,
was a strip of a lighter blue over a deep one (a step of 52 in one channel on the live site at 390×844). The
document now takes `sky-shade`, which is `palette.json`'s `levelTheme.ottawa-winter` and, as a side effect,
also clears the two triple-rule collisions `levelTheme.peggys-cove-atlantic-morning` records against Québec
City and Vancouver.

---

## 3. Placement the level document should use

`content/levels/ottawa.json` is the engine agent's file. These are the numbers the art was built for.

- **Ground polyline y = 1280.** `layer-60-ice`'s local y 0 *is* that line, so the ice is placed at
  `offset.y = 1280` and nothing has to be worked out twice.
- **The landmark is drawn at depth 45 — between the treeline and the canal wall.** This is the number this
  sheet was missing, and its absence is why a composite showed Centre Block standing on flat ice: drawn in
  front of everything, the Hill has nothing in front of its foot and reads as a building on the canal.
  At depth 45 the escarpment (30) and treeline (40) sit behind it and **`layer-50-canalwall` (50) is drawn
  in front of the bluff's foot**, which is the correct geometry — the retaining wall and the skateway are
  nearer to the player than the Hill is — and it hides the landmark's hard bottom edge at world y = 1160.
  **Confirm this in a running scene before anything is redrawn**: the depth is a claim about paint order that
  no SVG can prove, and the composite that found the problem noted it was assuming top-left anchoring.
- **The bluff is now drawn, not implied.** `landmark-parliament-hill.svg` carried a flat snow shelf under the
  terrace. Centre Block stands about 50 m above the river and *Parliament Hill* is the fact the level teaches,
  so the shelf is now a stone cliff face in vertical facets with a snow crest at y = 1090 and a spruce line
  at its foot for scale. It fits inside the existing art band and costs **no decoded texture**. The rest of
  the elevation is carried by the depth above, not by more pixels.
- **The landmark's local y is world y, offset by 120.** Place it at `offset` `(poiX − 540, 120)` and the art bible's
  composition rules hold by construction: flag top at y = 140 (clear of the 120 px system band), clock centre
  at y = 456 (above the y = 520 rule), terrace at y = 1090 (the canal wall head), nothing identifying within
  64 px of a side edge.
- **Where the bridges fall.** `layer-50` scrolls at 1.0, locked to the world, so this is exact rather than
  approximate: the bridge deck and its guard rail occupy world x in **[126 + 2016k, 814 + 2016k]** for every
  integer k — so 126…814, 2142…2830, 4158…4846. A camera frame is 1080 wide, so a POI centred anywhere in
  **(1354, 1602)** frames Parliament Hill with no bridge in shot. **Recommended `poi.parliament-hill.position.x`
  = 1480.** This is a composition preference, not a rule: the bridge renders *behind* the POI sprite and can
  never occlude the clock, which sits 260 px above the deck.
- **Spawn** anywhere clear of a bridge span; 1050 puts the player a screen west of the Hill with a bridge
  behind them to skate under on the way back.
- **Level width** ≥ 4200 gives two bridge crossings and the Hill with room either side. Every layer tiles, so
  the width is free.
- `theme`: `sky` `#1f5fa8`, `ground` `#e6eff7`, `horizon` `#a5d6ee` (the `ottawa-winter` ids in
  `palette.json`). `ink` and `inkMuted` are `ui-a11y`'s and must pass WCAG AA against both ends of that
  gradient; they are deliberately not proposed here.

---

## 4. Every effect has a plain path (ADR-0011)

Canvas has no Filter pipeline, so an effect built on one is absent without an error on exactly the devices
that need help most. Nothing in this level has a filtered-only form. There is not a single `<filter>` element
in any of the ten sources.

| effect | plain form — what everyone sees | filtered form, if a tier ever offers one |
|---|---|---|
| ambient occlusion | three nested flat ellipses of `ao-shadow` at 0.10 alpha under every ground contact, and a flat 0.18 rect at the one structural overlap. Baked into the SVG at author time. | none wanted. A runtime blur would move a baked shadow onto the GPU for no visible gain. |
| ice shimmer | flat `ice-light` lozenges with a 12 px corner radius, plus sparse `snow-light` scoring arcs at 0.26–0.30 alpha. Static shapes, authored, no animation required. | an additive sheen sweep would be a bonus and must never be the thing that makes the ice read as ice. |
| skate scoring | the art bible's one sanctioned stroke overlay: 3–4 px `snow-light` arcs, 13 of them per 1440 px tile, authored as shapes. | none. |
| falling snow | `ottawa-particle-snow`, three flat opaque discs with a flat highlight. Phaser particles, ≤ 400 on a phone at every tier and 150 at `low`. | none. A glow on a 13 px disc is invisible on a phone. |
| player costume | `parka`: the winter parka, scarf and mitts (`player.md`), because this level is winter and snow falls on it. | — |
| POI marker "in reach" | the ring **fills and gains a second ring** — a shape change, not a glow and not only a colour change. | a pulse is welcome; the shape difference already carries the state, so reduced motion and Canvas both stay correct. |
| lamp globes | flat `brass-light` disc with a `white-light` highlight disc. | a bloom would be a bonus. |

Snow, ice shimmer and the marker state were the three the brief singled out. All three are shapes.

---

## 5. Budgets, measured

`make assets` output, 2026-09-08:

```
assets: 10 SVG + 0 Rive source(s) -> 18 file(s) in assets/dist
        (2 atlas page(s) <= 2048 px, 14 standalone image(s)), 1x + 2x,
        0.49 MiB on disk across 1 level(s).
level-payload: OK - 1 level(s) against 8.00 MiB each — ottawa 0.32 MiB over 18
        file(s) [1x 0.17 MiB / 2x 0.32 MiB]. 18 file(s) in assets/dist, all claimed.
```

**Transfer payload: 335,222 B = 0.32 MiB against an 8 MiB budget — 4 %.** Not the binding constraint.

**Decoded texture memory is the binding constraint**, and it is what killed this project's 3D predecessor.
The pipeline emits 1× and 2× of everything; the level document picks. The shipping mix is **full-screen
parallax layers and the landmark at 1×, the small-art atlas at 2×**:

| texture | scale | px | decoded |
|---|---|---|---|
| `ottawa-layer-50-canalwall` | 1× | 2016 × 640 | 4.92 MiB |
| `ottawa-landmark-parliament-hill` | 1× | 1080 × 1160 | 4.78 MiB |
| `ottawa-layer-10-sky` | 1× | 1080 × 1160 | 4.78 MiB |
| `ottawa-layer-60-ice` | 1× | 1440 × 560 | 3.08 MiB |
| `ottawa-layer-20-skyline` | 1× | 1800 × 300 | 2.06 MiB |
| `ottawa-layer-40-treeline` | 1× | 1440 × 340 | 1.87 MiB |
| `ottawa-layer-30-escarpment` | 1× | 1440 × 320 | 1.76 MiB |
| atlas (2 markers + snow particle) | 2× | 230 × 738 | 0.65 MiB |
| **total** | | | **25,049,520 B = 23.89 MiB** |

Against `content/levels/ottawa.json`'s declared `textureBudgetBytes` of 32 MiB and CLAUDE.md's 64 MB ceiling.
25 % headroom.

### 5a. What actually shipped, measured again after task 1.11

§5 above is the task-1.9 record, dated and left alone: it is what was measured then and what this sheet
*planned*. The pipeline ships a different mix, and the difference is worth writing down rather than quietly
editing over the old numbers. **§5a is the current truth; §5 is history.**

**The landmark now ships at 1×, and this sheet can finally say so in a form the pipeline reads.**

For one task it did not. `scripts/assets.mjs` emitted 1× only for a source whose key appeared in a level
document's `layers[]`, and the landmark is a POI's `artKey`, not a layer — so it shipped at 2× at
**17.14 MiB, 36 % of the level's budget**, while §5 of this page had said "the landmark at 1×" from the day
it was written. The budget was raised from 32 MiB to 48 MiB to absorb a number nobody had chosen.

**The mechanism: a source pins its own scale in its filename.** `landmark-parliament-hill.svg` became
`landmark-parliament-hill@1x.svg` and nothing else changed. The suffix is stripped before the texture key is
formed, so `ottawa-landmark-parliament-hill` is unchanged, `content/levels/ottawa.json` does not move, and a
pinned source is standalone for the same reason a layer is — one atlas page cannot carry two scale sets.
The pin is **one-directional**: `@2x` is a hard error, because the only thing it could mean is "ignore the
owner's decision that layers ship at 1×", and a filename does not get to overrule that.

Infra declined to widen the `layers[]` rule instead, and the reasoning belongs on this page because it is
about who decides. Making every `pois[].artKey` 1× would assert *in a build script* that no POI is ever held
close to the camera — a judgement about art. A megapixel threshold would demote the character atlas
(1268 × 2048, 9.91 MiB), which is exactly what 2× exists for. So the author says it, in the tree the author
owns. That is the right seam.

**Checked before accepting it, then checked again by someone else.** The two-size test in `art-bible.md` §5 was re-run against what actually
ships now, 1080 × 1040: at 1:1 the clock face reads with its hands, the copper spire, the flag and its maple
leaf, and the corner pinnacles; at 25 % every `mustBeRight` feature survives; as a black silhouette 120 px
tall the tower, the flag and the flanking wings are still the shape of a parliament. **Nothing on this
landmark was drawn to need 2×** — the 12 px minimum-shape rule is why, and it is the same reason the
parallax layers survived being told after they were drawn which scale they ship at.

A blind pass then identified the pinned render cold, before its keymap opened: *"Centre Block, Parliament
Hill, Ottawa — the central tower is the Peace Tower"*, **confidence 0.92**, with every measured ratio inside
the amended contract — spire 0.189 of tower height, apex 26.7°, dial 0.54 centred at 0.725, shaft-to-height
1:7.73 — including the two clock exaggerations `references.json` labels as deliberate. Its verdict on the
trade: *"Yes. I do not need 2× back."*

### The placement floor the size ladder found

Identification held at 0.88 at 300 px and fell to 0.75 at 140 px, where the dial collapses to a pale disc
with a dark rim and the Gothic arcade to texture, leaving the flag and the copper green carrying it almost
alone.

> **Do not draw this landmark below 300 px wide anywhere the player is meant to recognise it.**

That is a **level-design constraint, not a drawing one**, and it belongs on this page rather than in the SVG:
no amount of redrawing buys back a 62 px dial rendered at 8 px. It bounds the POI's on-screen scale and any
future map, menu or passport thumbnail of the Hill. It is recorded in `references.json` under `peace-tower`
as well, so it travels with the subject and not only with this level.

`make assets`, 2026-09-08, after task 1.11:

```
assets: 60 SVG + 0 Rive source(s) -> 16 file(s) in assets/dist
        (4 atlas page(s) <= 2048 px, 8 standalone image(s),
         6 full-screen layer file(s) at 1x only), 1x + 2x,
        0.55 MiB on disk across 1 level(s).
level-payload:  OK - ottawa 0.40 MiB of 8.00 MiB
texture-memory: OK - ottawa 46.15 MiB of 48.00 MiB (96%, 1934672 B spare)
```

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1268 × 2048 | **9.91 MiB** |
| `ottawa-landmark-parliament-hill` | **1×, source-pinned** | 1080 × 1040 | 4.28 MiB |
| `ottawa-layer-50-canalwall` | 1× | 2016 × 640 | 4.92 MiB |
| `ottawa-layer-10-sky` | 1× | 1080 × 1160 | 4.78 MiB |
| `ottawa-layer-60-ice` | 1× | 1440 × 560 | 3.08 MiB |
| `ottawa-layer-20-skyline` | 1× | 1800 × 300 | 2.06 MiB |
| `ottawa-layer-40-treeline` | 1× | 1440 × 340 | 1.87 MiB |
| `ottawa-layer-30-escarpment` | 1× | 1440 × 320 | 1.76 MiB |
| `ottawa` atlas (2 markers + snow particle) | 2× | 230 × 738 | 0.65 MiB |
| **total at a 2× device** | | | **34,918,576 B = 33.30 MiB of 48.00 — 69 %** |

**`OQ-LEVEL-ART-1` is closed.** The pin returned **12.85 MiB** — six times what cropping the landmark's
empty rows saved, and more than the entire character library costs. The level went from 96 % of its budget
to 69 %, with 15,413,072 B spare.

### What the number still does not include

The gate says so itself now, unconditionally:

> EXCLUDES character render surfaces, which are allocated at runtime and are not files: this total is a
> floor, not what the GPU will hold.

A `.riv` is charged `decodedBytes: 0`, correctly — a Rive artboard renders to a canvas surface sized by the
display, not by the file. **That surface is real VRAM and no gate can see it.** A character is 240 × 470 in
character space, so at a 2× device scale the surface is 480 × 840 × 4 = **1,612,800 B ≈ 1.54 MiB each**, and
task 1.12's cap of six on screen is **≈ 9.2 MiB nothing measures**. The sprite backend adds none of it: its
parts are already inside the counted atlas.

So Ottawa's honest worst case is ≈ 42.5 MiB against `CLAUDE.md`'s 64 MiB per-level ceiling, which is a
comfortable level. Before the pin it was ≈ 55.4 MiB, which was not. That figure is recorded here and in the
ADR rather than printed by the gate, deliberately: a number the gate cannot re-derive would look checked.

**The binding constraint is now the character atlas, not the landmark.** `atlas/shared@2x` is at the packer's
2048 px height cap with 6.09 MiB of width left before it spills to a second page, and it holds all 3 840
option combinations so the player can wear one. That is `OQ-RIG-1`, and it is a pipeline change beyond
slice 1.

For comparison, the whole set at 2× is **93.61 MiB** — nearly three times the level's own declared budget, and
`ottawa-layer-10-sky@2x` alone is 19.12 MiB. A full-screen background at 2× spends nineteen megabytes
sharpening something the eye is not resting on and that a skater is moving past.

### What that constraint did to the drawing

Three things, and they are all visible in the sources:

1. **Every tile is cropped to the world band it actually covers.** The art bible's "author each layer 1920
   tall" is a habit, not a requirement, and it costs real memory. `layer-10-sky` is 1160 tall because
   everything below that is behind the canal wall; `layer-20-skyline` is 300 tall because its content is 300
   tall. This is the single biggest saving here — the same six layers authored full height would be 17 MiB
   more.
2. **`layer-50-canalwall` is 2016 px wide, not 2160.** At 2160 it rasterises to 4320 px at 2×, over the
   pipeline's 4096 px standalone-texture cap, and `make assets` failed on it. 2016 keeps 2× at 4032. Splitting
   into two repeating tiles was the alternative and was rejected: it would have halved the bridge-to-bridge
   rhythm to 1008 px, which is less than one screen, so a skater would never be out of sight of a bridge.
3. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature in the whole level is a
   3 px skate-scoring stroke, which is the art bible's sanctioned exception; the next smallest is a 5 px clock
   tick and a 12 px railing baluster. The 12 px minimum-shape rule was already doing this job — it is why the
   art survives being told, after it was drawn, that it ships at 1×.

---

## 6. The Peace Tower: what was measured, and the two places the drawing departs on purpose

`make verify-art` shows the render with no filename and no label and asks what it is. That answer has to be
"the Peace Tower" / "Parliament Hill" before any feature is checked. These are the numbers that decide it.

Measured from `assets/refs/ottawa/peace-tower-elevation.jpg` (774 × 1600) and
`assets/refs/officer/officer-and-peace-tower-portrait.jpg` (980 × 1249), by sampling the copper-green and
white-dial pixel ranges rather than by eye:

| ratio | elevation ref | portrait ref | the building | **drawn** |
|---|---|---|---|---|
| shaft width : tower height | 1 : 6.8 | 1 : 8.5 | 1 : 7.6 (92.2 m on a 12.2 m shaft) | **1 : 7.8** (113 × 880) |
| copper spire height ÷ tower height | 0.21 | 0.18 | — | **0.21** |
| spire apex angle | ≈ 30° | — | — | **25.8°** |
| spire base width ÷ shaft width | 0.75 | — | — | **0.75** |
| clock centre height ÷ tower height | 0.74 | 0.77 | — | **0.72** |
| clock dial diameter ÷ shaft width | 0.42 | — | 0.39 (4.8 m on 12.2 m) | **0.55** |
| wing ridge height ÷ tower height | 0.28 | — | — | **0.27** |

**Two entries in `references.json` were wrong and are corrected there, not worked around here.** The file said
the spire was "about 30 percent" of the tower height and the clock sat at 0.62. Measurement says 0.18–0.21 and
0.74. Building to the 30 % figure puts the spire base straight through the clock face, which is how the error
was found. A contract a render cannot be checked against is worse than no contract, so the numbers in
`references.json` now carry the measurement and the file it came from.

**One feature is exaggerated, on purpose, and it is labelled as an exaggeration:** the clock dial is drawn at
0.55 of the shaft width against a measured 0.40. At 0.40 the dial is 45 px at design resolution and about
16 pt on a phone — a pale disc, not a clock. Art bible §5 rule 2 says an identifying feature may get *more*
graphic emphasis than the photograph gives it; exaggerating one is simplification, adding one is invention.
The spire is deliberately **not** also exaggerated, because two exaggerations on the same tower collide
geometrically and the result stops being the proportion anyone recognises.

**Simplified away, per `references.json`:** stone coursing, window tracery and mullions, gargoyles, carved
heraldry over the arch, dormers under 8 px, the corner turrets' finials — the turrets stay, the finials go.
Two more were added while drawing, both size-driven: the dial's Roman numerals become four cardinal ticks
(numerals would be 5 px), and the National Flag's eleven-point maple leaf becomes a bold five-lobe silhouette
(at a 59 px flag the notches are 3 px, and the art bible deletes anything under 12).

**Never added, and none of it is present:** no second spire, no dome, no rose or round window, no
crenellation on the shaft, no clock on a face you cannot see, no bell in the belfry openings.

The two-size test both pass: at 25 % of design size the spire, clock, flag, arch, copper wing roofs and the
Library's cone are all still legible; as a flat black silhouette 120 px tall the subject is a slender central
clock tower with a pointed spire and a flag, flanked by a symmetrical block with a polygonal cone to its
right, which is Parliament Hill and very little else.

### The Library of Parliament

`references.json` lists the Library's polygonal chapter-house roof under the *skyline* subject, not the tower
subject, and the skyline is a repeating layer that must never carry a landmark. So the Library is drawn into
the hero instead: one asset satisfies both subjects. Sixteen-sided steep cone reduced to four facet ridges —
rhythm, not a count — dark `slate`, slender finial, sitting behind and to the right of the tower as it does
from the south.

---

## 7. The canal in a side view

`references.json` required "a long straight ice lane between two walls … running to the vanishing point".
That is a view *down* the canal. TrueNorth is a portrait side-scroller and looks *across* it, where that view
does not exist. The entry has been amended in `references.json` rather than quietly ignored here. In the side
view the containment reads as:

- one low masonry retaining wall running the full width behind the ice, snow banked against its foot in a
  single swept arc, an iron railing along its head, a lamp rhythm above it;
- a near snow bank framing the bottom of the frame;
- level, parallel, straight edges — a built channel, never a curved shoreline.

The bridge follows from the same rotation: a bridge crossing the canal, seen from the side, is a **portal the
skater passes through**. Deck over, two piers either side landing on their own drawn snow shelf so they never
appear to float, clear span 326 px against a 154 px player. Underside at world y 790, which is 70 px above a
420 px character's head — snug enough to read as ducking under.

**People skating, not walking.** Four background skaters per tile, in glide stance: torso leaning into the
glide, trailing leg extended and lifted behind, arms low and apart, a `slate-shade` blade under each boot,
winter coat, toque, mitts. Six heads tall, the same proportion canon as every other figure in the game —
drawn small because they are further down the canal, never because they matter less.

**No outline on any of them.** The art bible puts the outline on characters only, and it lists background
layers among the things that never get one. The line this level draws: *a figure authored into a parallax tile
is background and carries no outline; a figure authored as a character artboard carries the 6/4/3 px ink.*
That keeps the player the thing the eye finds first, which one-thumb play depends on.

**Never added, and none of it is present:** no hockey rink, boards, nets or line markings; no natural
shoreline with reeds or rocks; no mountains; no Château Laurier drawn as a recognisable landmark.

---

## 8. The POI marker

132 × 176 at design resolution. 44 pt on the narrowest supported viewport (390 pt) is 122 design px, so the
marker's own bounds clear the touch-target floor *before* the POI's `radiusPx` is considered.

A canal-side sign panel on a wooden post — the interpretive panels in
`refs/ottawa/rideau-canal-skateway-portrait.jpg`, not an invented game icon. Dark `slate` panel against snow
and ice, which separates by tone rather than by an outline.

Idle and in-reach differ by **shape as well as colour**: idle is a hollow `snow-light` ring; in reach the ring
fills and gains a second ring outside it. Colour is never the only signal (CLAUDE.md, Accessibility), and the
DOM `interact-prompt` carries the words. No glow, so the state survives a renderer with no Filters, and no
animation is required, so it survives reduced motion.

---

## 9. Open questions this level did not answer

- **`OQ-ART-04`** — which red is the National Flag? `flag-red-base` `#d8262c` was chosen to read in a
  saturated cartoon palette, not from the Federal Identity Program's Pantone 032. The flag is drawn; the
  colour is still a question for the content verifier.
- **`OQ-ART-05`** — settled Centre Block or today's rehabilitation? Drawn **settled**: green copper wing
  roofs, no cranes, no hoarding, per the recommendation in the art bible. Still needs confirming rather than
  assuming.
- **`OQ-LEVEL-2`** — red serge or a winter uniform on the ice? Not this task's to answer, and nothing here
  forecloses it: the level has no officer in it yet.
- **`OQ-ART-06`** — closed for three of the six parked references, open for three. See
  `assets/refs/README.md`.

## 10. A note for whoever wires the layers up

`level.schema.json` says the graphics preset "keeps the highest-depth layers and drops the rest", so the
**sky is the first layer dropped, not the last**. That reads backwards the first time and it is the reason
`palette.json`'s `levelTheme` and the sky layer's bands were made to agree colour for colour. If that rule
ever changes to drop the *nearest* layers instead, this stack inverts: the canal wall and the ice would go
first and Ottawa would become a sky with a tower floating in it. Worth a test rather than a comment.

---

## 11. The player is on skates, and that is rig art rather than level art

`locomotion` is `skate` and until 2026-09-13 the character walked down the canal, which is what a player
reported from the live site. The fix is in the shared rig, not in this level's tiles:
`content/levels/ottawa.json` sets no art key for it, and this sheet lists no new source, because the skates
are `{mode}` equipment in `assets/src/svg/shared/character/` and the glide is a state in
`content/characters/rig.json`. `rig-contract.md` §11 is the contract.

What this level owes the rig, and what the rig owes it:

- **The mode string IS the frame key.** `locomotion[].mode` is `skate`, so `foot-gear-r-{mode}` resolves to
  `character-foot-gear-r-skate`. The level's second mode, `walk`, resolves to a frame that does not exist and
  draws no equipment, which is correct and needs no entry anywhere.
- **The skate rides the ground line.** `skate/idle`, `skate/walk` and `skate/run` lift the whole figure 9–12 px because
  the runner hangs below the boot sole. The shadow does not lift. `layer-60-ice`'s local y 0 is still world
  1280 and nothing here moves.
- **The player now matches the four background skaters in `layer-50-canalwall.svg`.** They have always been
  in glide stance — torso pitched, one leg trailing, a dark blade under the boot — and the player arriving
  in a walk cycle was the visible seam. The player's pitch is 24°, theirs is about 25.
- **The one thing this level should still be given is a brake.** `content/levels/ottawa.json` bound
  `brakeTrigger: "brake"` to an input the rig does not declare, and the dead field left the level schema on
  2026-09-14. A hockey stop throwing
  snow is the most characteristic thing anyone does on that ice. `rig-contract.md` §11.6 costs it out.


---

## 12. Four points of interest, and where they sit

**Added 2026-09-13.** The level shipped with one POI at x 5400 on a 9 000 px skate — the longest corridor in
the game with the fewest things in it. It now has four. `size`, the ground polyline, the six layers, the
theme, both locomotion modes, the spawn and the officer's placement are all unchanged.

| world x | ground y | POI | art | what it teaches | source |
|---|---|---|---|---|---|
| 1 800 | 1244 | `rideau-locks` | `ottawa-prop-rideau-locks`, 680 × 440 | Ottawa is on the Ottawa River and Queen Victoria chose it as the capital in 1857 | *Discover Canada* p. 94 |
| 3 600 | 1246 | `library-of-parliament` | `ottawa-prop-library-of-parliament`, 600 × 820 | the Centre Block burned in 1916 and was rebuilt; the Library is the only original part left | *Discover Canada* p. 80 |
| 5 400 | 1242 | `parliament-hill` | `ottawa-landmark-parliament-hill`, 1080 × 1040 | the Parliament buildings and the Peace Tower | *Discover Canada* p. 80 |
| 7 600 | 1468 | `warming-hut` | `ottawa-prop-warming-hut`, 560 × 360 | the Rideau Canal was a military waterway and is now a tourist attraction and a winter skateway | *Discover Canada* p. 94 |

**Gaps of 1 800, 1 800 and 2 200 px**, inside the 1 500–2 500 band. The officer NPC stays at 2 400, between
the first two points, so the level's first three stops are a lock, a constable and a library. The last point
is past the canal step at x 6 400, **on the ice**, at ground y 1468 — the first POI in this game whose art
stands on a surface the player skates on rather than walks on, which is why its bottom band is `ice` with
skate scoring and not a snow bank.

**The library is drawn twice in this level and it is on purpose.** `landmark-parliament-hill@1x.svg` carries
it as a spire tip behind the right wing — a dark cone and a finial, no drum, no dormers, no windows. The new
hero is the building: a sixteen-sided sandstone drum, six buttresses with pinnacles, five pointed windows,
a ribbed polygonal roof with a ring of gabled dormers and a stone lantern. Far view and near view of one
building, 1 800 px apart, which is the same abstraction that puts the Halifax Town Clock and Pier 21 3 400 px
apart when they are three kilometres apart in life. `references.json` says so on the subject, so a verifier
who sees both does not report it as a duplication.

### The drum was redrawn because it never read as round (2026-09-17)

A blind pass read this hero cold as **"a stone church or basilica tower in snow"**. That is the failure the
subject's own `expectedBlindAnswerNote` names in capitals — *"THE FAILURE TO WATCH FOR IS 'a church', 'a
chapel'…"* — and `a church` is the one reading the note refuses while accepting `a chapter house`. So it was a
genuine fail and not a scoring quibble.

**The diagnosis, confirmed against the render before anything was drawn.** The roof, its ribs, the dormers, the
lantern and the spike finial were all correct and none of them was the problem. **The drum was.** Every cue
that makes a sixteen-sided drum read as round had been drawn flat:

| cue | what the file actually said | why it read as a west front |
|---|---|---|
| facet width | three window bays at a 120 px pitch, equal | equal bay spacing **is** the projection of a flat wall |
| cornice | one `rect x="46" width="508"` | a straight horizontal 508 px cornice is a flat plane, whatever sits above it |
| buttresses | four `rect width="36"`, identical | identical widths cannot march around a curve |
| roof ribs | seven ribs at an even 60 px pitch | the roof disagreed with the drum about being round |
| wall tone | one `stone-base` field with a flat light block left and a dark block right | a slab lit from the left, not a cylinder |
| pinnacles | 72 px over the eave | too short to give the ring a rhythm |

**What replaced it is measured, not adjusted.** A regular sixteen-sided drum of radius R = 245, seen in
elevation with one facet square to the viewer, projects its vertices at R·sin φ for φ = ±11.25°, ±33.75°,
±56.25° and ±78.75°. About x = 300 that is **x = 60, 96, 164, 252, 348, 436, 504, 540**, so the seven visible
bays are **36 : 68 : 88 : 96 : 88 : 68 : 36** wide. That ratio is the whole fix — it is what an eye reads as
"this wall turns away from me" — and every other element was put on the same numbers:

- **the cornice and base rings curve.** Above eye level the near part of a horizontal ring projects highest, so
  the cornice arches **up** 27 px at the centre (`y = 556 − 32·cos φ`); below eye level it inverts, so the base
  ring sags **down** 17 px (`y = 742 + 22·cos φ`). Two curved horizontals are the cheapest cylinder available
  in flat art, and the old file had neither.
- **six buttresses, not four**, at the six vertices that are not on the silhouette, **34 / 30 / 24 px wide** by
  position, each casting an `ao-shadow` 0.18 strip on the bay to its right. Rhythm, not count (art bible §5
  rule 3); the contract's "four visible" was a description of the old drawing.
- **the roof ribs land on the drum's own vertices**, so the cone recedes at exactly the rate the wall does.
- **the wall tone ramps across the facets** — base, light, light, base, base, shade, shade — with the terminator
  right of centre, which is a cylinder lit from the upper left rather than a symmetric object.
- **pinnacles stand 92 px over the cornice at the centre and 78 at the turn**, and they **interlock with the
  dormers**: pinnacles on the vertices at x 96/164/252/348/436/504, dormers on the facet centres at
  x 130/205/300/395/470, each dormer sitting in the gap between two pinnacles. That alternation is itself a
  roundness cue.

**Five windows, and the count is deliberate.** `mustBeRight` says "three tall pointed-arch windows"; the three
front bays carry them at 58 / 52 / 52 px wide, and the two **turning** bays carry a visibly narrower 36 px
window of the same shape. A window compressed at the turn is the strongest single statement that the wall
continues around, it is what `refs/ottawa/parliament-hill-skyline.jpg` actually shows, and art bible §5 rule 3
governs repeated detail by shape and spacing rather than by number. It is an accuracy gain and not an
invention — but it is a departure from the contract's wording, and it is written here rather than left to be
found.

**Nothing on the `neverAdd` list moved.** No cross, no bell stage, no west door, no clock, no flag, no statue,
no lettering, no green copper roof. The roof assembly is **436.6 px over a 496 px base = 0.88**, which is the
figure `references.json` measured off the reference photograph, against 0.75 before.

**It costs nothing.** The canvas is unchanged at 600 × 820, so the decoded texture is identical and Ottawa
stays at **39.20 MiB of 48.00 (82 %)**; the payload moved 0.69 → **0.70 MiB of 8.00**.

**The hut is drawn twice too, and that one is a scale relationship rather than a fiction.**
`layer-50-canalwall.svg` has a small warming hut on the **far** retaining wall, on a tile that repeats every
2 016 px. The hero stands on the **near** ice beside the player at four times the size. Same arrangement as
Peggy's Cove's seven far fish stores and its one near hero.

**Budgets, re-measured 2026-09-13** over the real tree:

```
level-payload:  OK - ottawa 0.53 MiB of 8.00 MiB over 18 file(s)
texture-memory: OK - ottawa 39.13 MiB of 48.00 MiB (82%, 9 305 748 B spare) over 18 file(s)
```

The three new heroes cost **3.79 MiB between them** — locks 1.14, library 1.88, hut 0.77 — and they are the
whole of the move from 35.34. All three are `@1x`-pinned and standalone; at 2× they would have cost
15.16 MiB and put this level 6 MiB over its declared budget, which is the ADR-0013 trade made three times in
one afternoon.

**What was refused.** A cannon on the Hill, the Centennial Flame, and a statue: the first two have no
licence-clean photograph in this repository and the third is forbidden outright by reference rule 4, *do not
depict a real, identifiable person*. `neverAdd` on `canal-lock` and on `library-of-parliament` names the
specific inventions each subject tempts — a boat and a lock-keeper on one, a cross and a clock face on the
other. **The clock is the interesting one**: a steep polygonal Gothic roof with pointed windows under it is
one wrong addition away from a church, and one from a second clock tower in a level that already has the
Peace Tower.

**Scenery: none added.** Six tiles already carry a skyline, an escarpment, a treeline, a canal wall with
lamps, spruces, skaters, a bridge and a hut, and the ice. What the level was short of was stops.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'canal-lock': singleSource(),
  'library-of-parliament': singleSource(),
  'warming-hut': singleSource(),
```

Same shape as `peace-tower`, which is already `singleSource()`. Until they land, `make verify-art` names
three more failures and says why.

---

## Ground dressing (ADR-0042)

| key | source | authored px | world y | decoded |
|---|---|---|---|---|
| `ottawa-ground-canal-bank` | `ground-canal-bank@1x.svg` | 1080 × 450 | 1470 … 1920 | 1.87 MiB |

The near bank of the Skateway: the lit `ice-light` edge of the ice sheet, a rounded snowbank crest with `snow-shade` shadow, red-osier dogwood stems in `oxide-base` standing out of the snow, and drifts crossed by footprints. It starts at world 1470 because that is the lowest point of this level's ground (ADR-0042 §2). On the high stretch the 230 rows between the walking line and the bank are the ice fill, which reads as the lane between two banks.

A repeating strip over the ground fill and under every landmark, character and ride, at every visual tier, moving exactly with the world. 1080 px wide (one tile per screen), pinned to 1x, opaque in every row, and ending on the bottom of the world, so the scene paints no ground fill under it. Palette colours only, no outline, no lettering, no figures. Its most legible detail is in its first ~160 rows, which stay visible above the HUD with a prompt showing.

---

## 13. Dow's Lake, the sixth stop's art — and the one thing this task could not land

**Added 2026-09-22, ADR-0065 §2.** Ottawa's five stops were full: every non-`answer` quest step holds one, and
the first 3 600 px of the canal are boxed in between a hold-release floor at x 1 725 and 1 080 px of mandatory
landmark spacing below the Library at x 2 520. 795 px for three stops is not a level that can host the game's
first lesson-reading step, so ADR-0065 §2 authorises a sixth, and this is its art.

| key | source | authored px | what it is |
|---|---|---|---|
| `ottawa-prop-dows-lake-pavilion` | `prop-dows-lake-pavilion@1x.svg` | 600 × 400 | **POI hero**: the pavilion at Dow's Lake, on piles over the lake ice, in front of it the cleared skating lane — crossing blade tracks, a swept windrow with the lane spruces on it, two plank skate-change benches and a stair from the ice to the deck |

### What is drawn, and why each piece is there

Dow's Lake is where the Rideau Canal opens out into an artificial lake and the skateway reaches its widest
and its southern end. What actually stands there is one building — a long, low, two-storey steel-and-glass
pavilion on piles over the water, with a deck at ice level, a raised open terrace at one end, a single long
external stair, and globe lamps along the deck. Drawn from `refs/ottawa/dows-lake-pavilion-elevation.jpg` and
`dows-lake-pavilion-deck-and-stair.jpg` (both CC0), with the ice and the lane trees from
`dows-lake-skateway-lane.jpg`.

**The identification is carried entirely by positives, and the first version of this page said otherwise.**
It said the read was "half a building and half an absence": the pavilion carrying the object, and the missing
retaining wall carrying the place. The scoring pass found that is not how the reading goes. **A blind reader
sees one frame and has no contrast set.** It cannot know that this game's other canal subjects are walled, so
empty ice tells it nothing about where containment stops. What identified this render was the glazed
two-storey box on piles, the deck at ice level, the diagonal stair, the ridge monitor, the lamps and the
trees — the things that are *there*. Corrected here rather than quietly dropped, because the wrong version
is the kind that reads plausibly and would be copied onto the next subject.

**The missing wall is still a required feature, and its job is a different one.** The ice runs unbroken to
the foot of the deck with **no masonry retaining wall and no stone coping anywhere in the frame**, because
every other Ottawa subject in `references.json` is contained — `rideau-canal-skateway` by its retaining wall,
`canal-lock` by its coursed chamber walls — and three stops on one level must not converge. It is in
`mustBeRight` rather than `neverAdd`, and **not** because a `neverAdd` would go unchecked: `neverAdd` entries
are audited too and surface as `forbiddenPresent`, so a wall listed there would have been caught just as
well. What the placement buys is **attention** — an auditor working down `mustBeRight` has to *positively
assert* the absence, feature by feature, rather than merely fail to notice a thing that is not in the
picture. That is worth having, and it is the whole of the reason.

**The contract does not ask for a place name, and that was decided before the drawing rather than after a
verdict came back short.** The building has no clock, no spire, no dome and no ornament; the only thing on
the real one that says *which* lake is the restaurant tenant's wordmark, and this project never draws
lettering. `expectedBlindAnswer` therefore asks for a building type and a setting — *a pavilion on a frozen
lake* — and keeps *the Dow's Lake pavilion* in the list as accepted rather than required. This is the
`pier-21` answer applied a second time; the level's own identification still rests on
`ottawa-landmark-parliament-hill`, which identified cold at 0.92.

**What the list asks for is water, frozen — and NOT a lake rather than a canal.** Both bars were wrong on the
first pass and both were found by scoring the contract rather than the picture. `"a boathouse"` was an
accepted answer with one content word, so *a boathouse on a summer afternoon* matched it while the note said
an answer with no water in it fails; it is now `"a boathouse on the ice"`, and every accepted answer names the
frozen surface. And the note was headed *"IT IS A LAKE AND NOT THE CANAL"* while `a pavilion on a frozen
canal` sat in the list as a pass — a contract disagreeing with itself, and **the scorer reads the list**. The
list was right. Nothing in one frame fixes a lake rather than a wide reach of a canal, so the heading went and
the lake-versus-canal distinction stays where it can actually be checked: in `mustBeRight`, as a drawing
requirement, in front of an auditor that has the contract open.

**The failure to watch for is "a warming hut".** This level already has a building on the ice 1 100 px away.
That one is a 560 × 360 timber box with a shallow gable, two lit windows and a red panel; this is a 600 × 400
glass pavilion on piles with a stair. Nothing is shared but the surface, and `references.json` says so under
both subjects so a verifier who sees the two does not report a duplication.

**Redrawn 2026-09-24: the ice now says SKATING.** Blind run `7e6b1463748d4299` failed this subject at every size.
The verifier read *a modern building raised on piles at a frozen northern shore* and named the Legislative
Assembly of Nunavut — piles for permafrost — and wrote that nothing in the frame said the ice was a skating
lake or a canal: the ice was a 60 px strip with six straight bars, which read as ripples, and the figure
that would have said *skaters* is forbidden. The building drawing is untouched and now stands at 0.82 of its
first size, raised, so the bottom fifth of the file is the **cleared lane**, and every piece of it is in a
reference: eleven long **crossing blade tracks** (`rideau-canal-skateway-ice.jpg`, which was added to the
subject's `referenceFiles`), the swept **snow windrow** along the lane's far edge with the three spruces
standing on it (`dows-lake-skateway-lane.jpg`), two plain **plank skate-change benches** on the ice
(`rideau-canal-skateway-ice.jpg`), and the short **stair from the ice up to the deck**
(`dows-lake-pavilion-elevation.jpg`). The lake runs in under the deck between the piles in `snow-shade`, so
the building still stands in the lake. No person, no sign, no kilometre post, no rink fitting. The
benches used to be on the subject's `simplifyAway` list and were brought back; `references.json` says so.
Cost: none — the canvas is unchanged. Unproven until a blind run scores it.

**Refused:** the tenant's signage, awnings and string lights (most of what the references show); the flag on
the mast at the far end (`OQ-ART-04` is open); a Winterlude dome, marquee or ice sculpture, which is kit put
up for two weeks; the towers of the Glebe behind the lake, because the skyline tile repeats; and **tulips**,
which are the first thing anybody who knows this lake reaches for and are in Commissioners Park in May.

### Placement — the numbers the level document should use

The warming hut is the current last stop at x 7 600 and the level's `size.x` is 9 000, so a sixth stop has
exactly 320 px of room between the 1 080 px landmark minimum
(`tests/unit/contracts/level-art-is-placed-where-it-is-drawn.test.ts`) and the end of the world. **x = 8 700**
takes 1 100 px of clearance and leaves the 600 px hero spanning 8 400 … 9 000 — flush with the world edge and
entirely inside the camera's last frame (7 920 … 9 000). That pair of constraints is why the canvas is 600 px
and not the 640 the composition wanted: at 640 the art would hang 20 px past a bound the camera never
crosses.

`y` is the ground polyline sampled at x 8 700 — 1 466 + 0.7 × 4 = **1 468.8, written 1 469** — which is the
same rounding the hut took at 1 467.6 → 1 468. It is **on the ice**, past the canal step at x 6 400, so the
file's bottom band is `ice` with skate scoring and a cleared snow windrow, not a snow bank. `radiusPx` 240,
the hut's and the Library's.

```json
    {
      "id": "dows-lake",
      "name": { "en": "Dow's Lake", "fr": "Le lac Dow" },
      "position": { "x": 8700, "y": 1469 },
      "artKey": "ottawa-prop-dows-lake-pavilion",
      "radiusPx": 240
    }
```

### THE ART SHIPPED BEFORE THE STOP DID, AND THAT WAS A FINDING RATHER THAN AN OMISSION

The block above is five keys. `content/schemas/level.schema.json` requires seven — `blurb` and `fact` as
well — and ADR-0003 forbids one commit both authoring a claim and granting it, so art cannot write them.
The expectation going in was that `make validate-content` would go red on the two missing keys and be left
red for the content author to close.

**It is worse than that, and the extra fact is why the POI was taken back out.**
`app/adapters/phaser/level-document.ts` is the *runtime* reading of a level, and its own header calls itself
"the refusal that keeps a level from being loaded at all". `readPois` returns `invalid` on a POI with no
`blurb` (`readLocalizedText`) and again on one with no `fact` (`readFactClaim`, which rejects an absent block
as "an unchecked claim rather than an unclaimed one"), and a single invalid POI fails the whole document. A
partial sixth stop does not leave one landmark undrawn; **it stops Ottawa loading**. A red gate is a message;
a dead level on `main` is a regression.

So the art commit landed the drawing, the contract, the credits and the builder, and left the level document
byte-for-byte as it was. **The content author then wrote the block above with a `blurb` and a `fact`, a
verifier granted it, and the stop appeared in the commits that were always going to have to be theirs.**
Nothing here moved when they did: the key, the size, the x, the y and the radius all went in as measured.
That is the whole of the argument for handing a file back rather than leaving a gate red — a red gate says
"someone must finish this", and a level that will not load says nothing at all until a player finds it.

### Budgets, measured 2026-09-22

The source is charged to this level by its directory, so the cost is already paid and is not waiting on the
level document:

```
level-payload:  OK - ottawa 0.72 MiB of 8.00 MiB over 20 file(s)
texture-memory: OK - ottawa 40.09 MiB of 48.00 MiB (84%, 8 293 520 B spare) over 20 file(s)
```

**The drawing costs 12 342 B of payload and 960 000 B = 0.92 MiB of decoded texture** — 600 × 400 × 4, at
`@1x` because the filename pins it. Ottawa moved 0.71 → 0.72 MiB of payload (9 %) and 39.18 → 40.09 MiB of
texture (82 % → 84 %), leaving 8.29 MiB spare. At `@2x` the same drawing would cost 3.66 MiB and take the
level to 87 %; nothing on it was drawn to need 2×, and the two-size test is why.

### The two-size test, and what is still owed

Run at the shipping size of 600 × 400. At 180 px wide the stair, the terrace railing, the mullion rhythm, the
three lamps, the piles and the three trees all survive. As a flat silhouette 120 px tall the subject is a long
low block under a broad shallow roof with a raised ridge, an open railed terrace on posts at one end, standing
on a deck on piles over a flat surface, with three small conifers beside it — which is a pavilion on a lake and
is not a hut. **Placement floor 300 px**, adopted from this level's floor rather than re-derived.

**That is an author's self-check and it is not an identification.** It cannot be: whoever drew a render has
already seen it, and `verifyArtProtocol` says a verdict from a party that found its own inputs is untrusted.

**A first verdict is now on record and it is marked untrusted, for a reason that is not about the pictures.**
The feature audit was clean — 7/7 `mustBeRight` present, nothing from `neverAdd`, nothing uncheckable — and
an independent reader described the render at 600, 300 and 140 px as a two-storey glazed building on piles
standing in ice, with an external stair, a ridge monitor, three globe lamps and three spruces. **The hand-off
held; the briefing given to the reader did not.** It named *pavilion*, *frozen lake*, *restaurant*, *which
lake*, *Ottawa* and the missing coping — most of `expectedBlindAnswer`, in prose — so the run was not
open-set and the verdict cannot count. That is the same failure `art-handoff.mjs` records twice already: the
images were clean and the terminal was not. **A fresh blind run is owed**, from a reader that has seen
neither the keymap nor this contract, and it will now score against a contract that does not contradict
itself (the two defects that scoring found are fixed above).

### The builder patch `scripts/lib/art-handoff.mjs` needed, and has

```js
  'dows-lake': singleSource(),
```
