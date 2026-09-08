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
| `ottawa-landmark-parliament-hill` | `landmark-parliament-hill.svg` | 1080 × 1040 | **the POI hero**: Centre Block, the Peace Tower, the Library of Parliament |
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
