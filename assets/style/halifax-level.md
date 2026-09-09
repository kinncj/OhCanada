# Halifax level art — layers, offsets, budgets and the decisions behind them

Level 1 — **Rights and Responsibilities of Citizenship**, locomotion **walk**. Sources are
`assets/src/svg/halifax/*.svg`; `assets/style/art-bible.md` is the house style and
`assets/refs/references.json` is the accuracy contract `make verify-art` judges renders against. This file
is the level-specific sheet: what each texture is, where it goes, what happens to it at each visual tier, and
which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**. Summer, clear, mid-morning.

---

## 0. The Pier 21 problem, and the answer taken

The PO refused to write an `expectedBlindAnswer` for Pier 21 and recorded the **Halifax Town Clock** as a
fallback anchor. The refusal was right, and here is the evidence for why.

**Pier 21 is a brick shed whose one unmistakable feature is the name painted on it.** `refs/halifax/pier-21-and-the-seaport.jpg`
shows it from a distance: a long low pale shed, a red brick block, and `PIER 21` in three-foot letters across
the parapet. `refs/halifax/pier-21-entrance.jpg` shows the same letters close up, with a round emblem beside
them. **This project draws no lettering anywhere** — `make verify-art` refuses any render source containing a
`<text>` element, because a name drawn into the picture defeats every byte-level leak check in the hand-off —
so the shed ships without the one thing that names it. What is left is a three-storey brick block with a
streamlined entrance, which is a building *type*.

**Both of the honest options were available and the answer taken is both halves of the first one:**

- **Pier 21 is drawn, accurately, and asked only for what a shed can carry.** Its
  `expectedBlindAnswer` is generic — "an ocean terminal", "a dockside terminal", "a pier shed and an ocean
  liner". "Pier 21" and "Halifax" are in the list because a verifier who names them is not wrong, and an
  `expectedBlindAnswerNote` states plainly that they are **not required and the gate must not reward them**.
- **The level gets a second, non-repeating anchor that can carry the place**, and it is the Town Clock. Its
  `expectedBlindAnswer` *is* allowed to demand "Halifax", on the same test `chateau-frontenac` passes: one
  specific building, drawn once, whose stack — white clapboard box, round colonnade, blue-and-gold dial,
  arched belfry, green copper ogee dome, gold ball — nothing else in this game will ever share.

What is deliberately **not** done is the thing Ottawa did: demand a place name from art that cannot show one
and let it pass on the verifier's inference. That subject had to be amended afterwards. This one is written
correctly before it runs.

**The consequence is structural and is stated so nobody has to discover it.** Halifax as a *place* rests on
`town-clock` alone. `pier-21` is not asked for it and `halifax-quayside` is two repeating tiles that may not
carry it. If the Town Clock stops identifying, the level stops being identifiable, and no amount of work on
the other two subjects buys it back.

---

## 1. What was produced

Six SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/halifax/` gets the key `halifax-<filename>`:

| key | source | authored px | shapes | what it is |
|---|---|---|---|---|
| `halifax-layer-10-sky` | `layer-10-sky.svg` | 1080 × 880 | 29 | one flat sky field and seven cumulus |
| `halifax-layer-20-citadel` | `layer-20-citadel.svg` | 1800 × 160 | 51 | the grassy hill above the town, with spruce and maple on the lower slope |
| `halifax-layer-30-uptown` | `layer-30-uptown.svg` | 1800 × 260 | 137 | the town on the slope: gabled houses, mid-rise blocks, one plain steeple, and a lower row of roofs |
| `halifax-layer-40-quayside` | `layer-40-quayside.svg` | 2016 × 440 | 287 | the boardwalk, its lamps, benches, bollards, planters, panel, gulls and six people; two waterfront buildings, a cargo shed and two open slips |
| `halifax-landmark-town-clock` | `landmark-town-clock@1x.svg` | 800 × 1010 | 113 | **POI hero, and the level's only place-anchor** |
| `halifax-landmark-pier-21` | `landmark-pier-21@1x.svg` | 900 × 620 | 137 | **POI hero**: the terminal, the liner and the immigrant train |

Shape counts are **reported, not budgeted**: ADR-0025 retired the sixty-shape figure as a gate, because every
SVG is rasterised to atlas frames and the GPU never sees a path. The binding tests are blind identification
and the two-size test, and both landmarks passed the second (§6).

**There is no character source here.** Characters are `shared/` and already exist; this level places them.

**There are no POI-marker or particle sources, and that is a departure from Ottawa and Québec City.**
`level.schema.json` has parallax layers, POIs and characters, and nothing that can reference a marker or a
particle; `app/adapters/phaser/level-scene.ts` draws POIs from `poi.artKey` and draws falling snow with
`Graphics`, procedurally. So `ottawa-poi-marker-idle`, `ottawa-poi-marker-active`, `ottawa-particle-snow` and
their Québec City twins are textures that nothing can reference and that the atlas charges to their levels
anyway — the same category as the six standalone Ottawa props that were authored and then deleted
(`art-bible.md` §9). Six sources here, all placeable. See §7.

---

## 2. The parallax stack — **four layers, and the tier rule that shaped them**

`content/game.config.json` keeps **6 layers at `high`, 4 at `medium`, 2 at `low`**.

**The rule that decides which are dropped changed, and it changes how a level is composed.**
`app/adapters/phaser/level-effects.ts` `selectLayers` now keeps **the layers that cover the most screen**,
measured as `visibleWidth × visibleHeight` with the bottom clipped at `horizonY` — the *highest* point of the
ground polyline. Coverage is computed for every layer and the top `n` survive; ties go to the nearer band.

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | `halifax-layer-10-sky` | 1080 × 880 | 0 … 880 | 0.04 / 0.02 | true | 950 400 | yes | **yes** |
| 20 | `halifax-layer-20-citadel` | 1800 × 160 | 620 … 780 | 0.16 / 0.06 | true | 172 800 | yes | no |
| 30 | `halifax-layer-30-uptown` | 1800 × 260 | 700 … 960 | 0.32 / 0.14 | true | 280 800 | yes | no |
| 40 | `halifax-layer-40-quayside` | 2016 × 440 | 860 … 1300 | 1.00 / 1.00 | true | 453 600 | yes | **yes** |

`offset.y` is the world y in the fourth column; `offset.x` is 0 for every layer.

At **`low` the player sees the sky and the quayside**, which is a boardwalk with lamps, benches, bollards,
gulls, people, two gabled waterfront buildings, a cargo shed and two slips of harbour water, under a summer
sky — plus the POI hero, which is not a layer and is present at every tier. That is a harbour town, not a
broken scene. At `medium` all four survive, because there are only four.

### Why four

Two layers were designed and not drawn, and the reason is the same one Québec City recorded for its sixth:
**a layer earns its texture only if its world band is not covered by a nearer opaque layer.** A treeline
between the town and the wharves would have had 40 visible rows; a second mid-ground band of older
waterfront warehouses would have had 40. Both would have cost about 1.2 MiB for a sliver. Six is advice in
`art-bible.md` §6 and this is the second level where following it would have been wrong.

### Nothing identifying is on a droppable layer, and nothing built is on a repeating one

All four layers repeat. So **not one of them carries a named or recognisable building**, and this is checked
rather than intended: the hill has no earthwork profile and no flagstaff, the town's steeple has no cross,
clock or tracery, the waterfront buildings are types, and the six figures carry no cultural marker of any
kind (`docs/content-review.md` §3.3, outcome 2).

That rule now has teeth it did not have before. On Québec City a **striped bandstand kiosk** was drawn into
the terrace tile as street furniture, and a genuinely blind verifier named *Terrasse Dufferin, Québec City*
off it — from a tile whose own `neverAdd` already forbade exactly that. **Furniture that is really
architecture is architecture.** The Halifax interpretive panel, lamps, benches, bollards and planters are
drawn as types for that reason.

### The sky is flat, and that is a departure

Ottawa and Québec City band their skies in three flat colours so the layer can be dropped for the theme
gradient. A banded sky needs **every step to sit behind a nearer opaque layer at every tier**, and the only
layer guaranteed beside the sky at `low` here is the quayside, whose top edge is world 860 and which is
transparent along it. There was nowhere to hide a step. One flat `sky-base` field has no step to hide, it is
exactly `palette.json` `levelTheme.halifax-summer.sky`, and dropping the layer changes nothing above the
roofline. The clouds carry the interest.

### The gaps between buildings, closed on purpose

Each tile from the town down carries an opaque haze band at its foot that begins **exactly where the tile
above it ends** — the town's at world 780, where the hill tile stops; the quayside's at world 960, where the
town tile stops. Without them a column between two buildings drops through every layer to the theme
gradient, which is a hole in the middle of the picture and is only visible once composited.

---

## 3. Placement the level document should use

`content/levels/halifax.json` is not this agent's file. These are the numbers the art was built for.

- **Ground polyline y = 1280, level, the whole way.** The quayside tile's local y 420 *is* that line.
  **Do not slope it**: every band above is at a fixed world y, and a ground line that rises would cut them.
- **`size.x` ≥ 7200.** Every layer tiles, so width is free. 7200 gives two full quayside tiles and both POIs
  with a screen of clear boardwalk either side.
- **`spawn`** `(400, 1280)`, on clear deck, a screen short of the first POI.
- **Both landmarks are POIs, and a POI has no `offset`.** `level-scene.ts` draws `poi.artKey` with origin
  `(0.5, 1)` at `(poi.position.x, groundYAt(x))` and depth `DEPTH_ACTORS − 1`, so **the file's bottom edge is
  the ground line and its horizontal centre is `position.x`.** Nothing else places it. Both files are
  authored to that: the Town Clock's grass mound and Pier 21's rail apron are the bottom rows.
- **`poi.town-clock.position.x` ≈ 2400**, `radiusPx` 260. The file is 800 × 1010, so it occupies world x
  2000 … 2800 and world y 270 … 1280. The gold ball sits at world y 290 — clear of the 120 px system band —
  and the dial's centre at world y **718**. Nothing can occlude it: a POI hero is drawn at
  `DEPTH_ACTORS - 1`, above every parallax layer, and the tallest thing on any layer is the town's steeple
  at world 718 anyway.
- **`poi.pier-21.position.x` ≈ 5600**, `radiusPx` 240. The file is 900 × 620, so it occupies world x
  5150 … 6050 and world y 660 … 1280. Keep the two POIs at least 1800 px apart: at 800 and 900 px wide they
  cannot share a 1080 px camera frame without one of them being cropped.
- **Where the quayside's own features fall.** `layer-40` scrolls at 1.0, locked to the world, so this is
  exact rather than approximate. Per 2016 px tile, measured from the tile origin: the two gabled waterfront
  buildings occupy **[238, 594]** and **[1548, 1928]**, the cargo shed **[918, 1266]**, and the two open
  slips **[608, 908]** and **[1272, 1540]**. The stretch **[1930, 2254]** (wrapping into the next tile) is
  clear deck, 324 px of it, which is where a POI marker or a dialogue prompt has room. Nothing on this tile
  can occlude a POI hero — the hero is drawn at `DEPTH_ACTORS − 1`, above every layer.
- **`theme`**: `sky` `#3d8ccb` (`sky-base`), `ground` `#8b857c` (`path-base`, weathered deck timber),
  `horizon` `#fbfdfe` (`cloud-light`). Deliberately not any other level's set — see the table in §4.
  `ink` and `inkMuted` are `ui-a11y`'s and must pass WCAG AA against both ends of this gradient; they are
  not proposed here.
- **`locomotion`** is walk, and the level needs only that one mode. `game.config.json` already lists `walk`.
- **`territory` is not proposed here and must not be copied from anywhere.** `docs/content-review.md` §10
  governs it, it requires a citable fact and nation names taken from that nation's own material, and none of
  that is an art decision. What the art asserts is nothing: **no Indigenous content of any kind is drawn in
  this level** — no regalia, no pattern, no cultural item on any of the six background figures. See
  `OQ-HALIFAX-2`.

---

## 4. Every effect has a plain path (ADR-0011)

Canvas has no Filter pipeline, so an effect built on one is absent without an error on exactly the devices
that need help most. **There is not a single `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`,
`<image>`, `<style>` or `url(#…)` reference in any of the six sources**, checked mechanically over all 80
sources in the repository (§7, `OQ-ART-11`).

| effect | plain form — what everyone sees | filtered form, if a tier ever offers one |
|---|---|---|
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every ground contact and flat 0.18 rects at the structural overlaps. Baked into the SVG at author time. | none wanted. |
| sunlight on the deck | the ground polygon's own crest, drawn by `level-scene.ts` in `theme.horizon` — which is why `horizon` is `cloud-light` here: a white plank edge on grey timber. | none. |
| lamp globes | flat `white-light` discs on dark standards. | a bloom would be a bonus and must never be what makes them read as lamps. |
| harbour water | three flat `water` tones with straight `water-light` ripple bars. Static shapes. | none. |
| falling weather | **none. This level is summer** — no particles, no `particle-*` source. Two of this game's levels are already winter and a third would make the country look like one season. | — |

### The four levels' theme triples, so nobody has to compare them by eye

| level | `sky` | `horizon` | `ground` |
|---|---|---|---|
| ottawa | `sky-shade` `#1f5fa8` | `sky-light` `#a5d6ee` | `snow-base` `#e6eff7` |
| quebec-city | `sky-base` `#3d8ccb` | `cloud-base` `#dce9f3` | `snow-base` `#e6eff7` |
| **halifax** | `sky-base` `#3d8ccb` | `cloud-light` `#fbfdfe` | `path-base` `#8b857c` |
| toronto | `sky-light` `#a5d6ee` | `cloud-base` `#dce9f3` | `path-shade` `#605a55` |

No two triples are the same. Two levels share a `sky` and two share a `horizon`, and each of those pairs is
separated by its ground: winter snow against summer timber, and a pale hazy city against a bright maritime
one.

---

## 5. Budgets, measured

`node scripts/assets.mjs --root scratch/root2`, 2026-09-08, run against a scratch root carrying minimal
`halifax` and `toronto` level documents — **because the real ones do not exist yet and `assets/**` is the
only tree this agent owns.** The scratch documents declared the four `layers[]` keys and
`textureBudgetBytes`; nothing else affects these numbers, and the run is reproducible by anyone who writes
the real documents.

```
assets: 80 SVG + 0 Rive source(s) -> 36 file(s) in assets/dist
        (6 atlas page(s) <= 2048 px, 24 standalone image(s),
         19 full-screen layer file(s) at 1x only, 5 source-pinned file(s)), 1x + 2x,
        0.80 MiB on disk across 4 level(s).
level-payload:  OK - halifax 0.29 MiB of 8.00 MiB over 10 file(s) [1x 0.20 / 2x 0.29]
texture-memory: OK - halifax 25.01 MiB of 32.00 MiB (78%) over 10 file(s)
                     [1x device 18.09 MiB / 2x device 25.01 MiB]
                     heaviest atlas/shared@2x 1268x2048 9.91 MiB = 31% of budget
```

**Transfer payload: 0.29 MiB against 8 MiB — 4 %.** Not the binding constraint, and it never has been.

**Decoded texture memory at a 2× device:**

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1268 × 2048 | **9.91 MiB** |
| `halifax-layer-10-sky` | 1× | 1080 × 880 | 3.63 MiB |
| `halifax-layer-40-quayside` | 1× | 2016 × 440 | 3.38 MiB |
| `halifax-landmark-town-clock` | **1×, source-pinned** | 800 × 1010 | 3.08 MiB |
| `halifax-landmark-pier-21` | **1×, source-pinned** | 900 × 620 | 2.13 MiB |
| `halifax-layer-30-uptown` | 1× | 1800 × 260 | 1.79 MiB |
| `halifax-layer-20-citadel` | 1× | 1800 × 160 | 1.10 MiB |
| **total at a 2× device** | | | **26 224 128 B = 25.01 MiB** |

### The budget number, derived rather than copied — and the derivation is different from Québec City's

Québec City derived `64 − 10.33 (Rive surfaces) − 8.00 (render targets) = 45.67` and recommended 40 MiB.
**ADR-0013's amendment says that derivation double-counts the characters**: the sprite atlas and the Rive
surfaces are *alternatives*, not addends — "peak is `max(atlas, surfaces)`, never the sum" — and ADR-0022
decided the sprite path ships. The atlas is already inside the gate's per-level total. So:

```
  64.00 MiB   CLAUDE.md's per-level ceiling, and level.schema.json's maximum
-  8.00 MiB   Phaser render targets and the browser's own allocations. ADR-0013 calls
              "under 8 MiB left" for these uncomfortable, so 8 is the floor to leave
= 56.00 MiB   the most a level's FILES may honestly declare on the sprite path,
              with the shared atlas still charged inside them, which is what the
              gate does today and will keep doing until the engine obligation lands
```

**Recommended `textureBudgetBytes` = 35 651 584 (34 MiB).** The measured 25.01 sits at **74 %** of it, which
is Ottawa's ratio (69 %) and Québec City's (71 %) at a smaller absolute number — tight enough that the gate
fires before the ceiling does, loose enough for a second costume set or a third POI hero.

### What the number still does not include, and what it double-counts

The gate says so itself, unconditionally: *"EXCLUDES character render surfaces, which are allocated at
runtime and are not files: this total is a floor, not what the GPU will hold."* On the sprite path that
exclusion is harmless — the atlas *is* the characters.

And **9.91 MiB of this level's 25.01 is the shared character atlas, which is resident once and is charged to
every level**. ADR-0013's amendment decided that charge is wrong — the charge follows the lifetime, not the
download — but deliberately left the gate conservative until `unload` is real and measured. So:

| | MiB |
|---|---|
| Halifax's own files | 15.10 |
| Shared character atlas, resident once | 9.91 |
| Render targets, uncounted residue | ~8.00 |
| **Halifax's honest worst case, baseline model** | **33.01 of 64 — 52 %** |

Recorded here rather than printed by the gate, deliberately: a number the gate cannot re-derive would look
checked.

### What that constraint did to the drawing

1. **Every tile is cropped to the world band it actually covers.** The four layers cost **9.90 MiB** between
   them; authored 1920 tall at the same widths they would cost **49.04 MiB**, which is 39.14 MiB more and
   over the ceiling before a landmark or a character is loaded. This remains the single biggest saving
   available to any level in this game, and it is the third level running where it is the whole story.
2. **Both landmarks are cropped to their alpha bounds and pinned to 1×.** Together they are 5.21 MiB instead
   of 20.83.
3. **Two layers were designed and not drawn.** §2.
4. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature in the level is a 5 px
   glazing bar on the Town Clock's windows; the next smallest is an 8 px gold dial mark and a 9 px gull beak.

---

## 6. The two landmarks

### 6.1 The Town Clock: what was measured, and the mistake measuring caught

Measured on `refs/halifax/town-clock-elevation.jpg` (1280 × 1600, **converted from its embedded profile to
sRGB before anything was sampled**), which is a long street view in full sun, near-orthographic, with the
whole building in frame — the one internally consistent view of the three.

Every figure is expressed as a fraction of **the base building's width**, and that choice is the finding.

| ratio | measured | drawn (738 px base) | error |
|---|---|---|---|
| base width : total height | 1 : 1.23 | 1 : 1.29 | +5 % |
| everything above the base roof ÷ base width | 0.874 | 0.894 | +2 % |
| colonnade roof width ÷ base width | 0.524 | 0.526 | 0 % |
| clock drum width ÷ base width | 0.298 | 0.314 | +5 % |
| dome width ÷ base width | 0.298 | 0.314 | +5 % |
| belfry width ÷ base width | 0.242 | 0.255 | +5 % |
| dial diameter ÷ clock drum width | 0.497 | 0.496 | 0 % |
| dome height ÷ dome width | 0.54 | 0.54 | 0 % |

**This landmark was drawn three times and the first two were wrong**, and the sequence is the finding:

1. **Build one** took the stage heights and widths from a quick read and scaled every stage by one factor.
   The colonnade came out **29 % too narrow** and the dial **16 % too small**. Nothing looked wrong.
2. **Build two** re-expressed every figure as a fraction of one measured quantity — the base building's
   width — and moved the colonnade and the dial to match. Both **overshot**: the colonnade to 15 % too wide
   and the dial to 19 % too big. The denominator had been taken from an automated colour segmentation whose
   window was clipping, so the *unit* was wrong and every ratio built on it moved the wrong way.
3. **Build three**, which ships, took every width off a **labelled grid crop of the same file** — the crop,
   its offsets and its scale are in `scratch/gen/`, and anyone can regenerate it. Slower, and the only method
   here whose errors are visible while you are making them.

> ADR-0014 records that averaging three individually-correct brackets produced a building no photograph
> shows. This is the same lesson twice more: **a ratio is only a measurement if its denominator was measured
> too, and a segmentation is only a measurement if you looked at what it selected.** Automated segmentation
> worked for exactly one figure on this subject — the copper dome, whose hue is unique in the frame — and
> failed on every other, because the sky is a pale low-saturation blue that a white mask catches, the
> hillside behind is bright, and the drum's flanking sash windows and the gold hands both cut a blue mask.
> Pick the one quantity in the picture that is unambiguous, **look at it**, and express everything against
> it: here the base building's width, for the Château the tower's width in the one orthographic view, for the
> CN Tower the pod's width because its base is hidden.

**Colour was measured too.** The dial is the hue-filtered median of 11 500 sunlit dial pixels, `#113a7b` =
hsl(217, 76 %, 27 %). `cobalt` was added to `palette.json` for it at hsl(218, 73 %, 30 %), a little lighter
so the brass reads at phone size. It exists because `navy` is midnight-blue duty wool at the same lightness
and half the saturation, and a dial painted in it reads dark grey — which loses the one feature this
landmark is named for. `sky-shade` was the other candidate and was rejected on principle: an atmosphere ramp
is a hand-authored band set exempt from the derivation formula, and painting a building with one is how a
level starts looking like its own sky.

**One feature is exaggerated: none.** Nothing on this subject is small enough to need it. The smallest
`mustBeRight` element is the pair of bells at 30 px.

**Simplified away, per `references.json`:** clapboard boarding, glazing bars beyond one cross, the Roman
numerals (→ four cardinal marks, the substitution Ottawa made on the Peace Tower for the same reason), the
cupola's individual balusters, the cornice mouldings, the plinth's stone coursing, and **the Citadel's signal
mast and whatever flag is flying from it** — it is really there in the reference, and at cartoon scale a bare
mast is a line while a drawn flag asserts something this project has not verified (`OQ-ART-04`).

**Never added, and none of it is present:** no pointed spire, Gothic arch or tracery (this is a Palladian
tower of 1803 — the Gothic arch is required of the Peace Tower and forbidden here); **no cross, weathervane
or religious emblem**, which is the single most likely wrong addition to a white tower with a bell in it; no
battlements; no flag, arms, wordmark or lettering; no brick or stone above the plinth; no second dial on the
same visible face.

**And the pair that keeps two clock towers apart.** This game now has two, and they must not collapse into
one: the Peace Tower is a **white dial on a buff Gothic sandstone shaft**; the Town Clock is a **blue-and-gold
dial on white-painted wood under a green copper dome**. That is written into both subjects' `mustBeRight`
with the reason, exactly as `brick`-versus-`stone` keeps the Château and Parliament Hill apart.

### 6.2 The two-size test, and the 1× pins

Run at the shipping sizes:

- **Town Clock, 800 × 1010.** At 25 % (200 px) every `mustBeRight` feature survives — the blue dial with its
  gold hands, the green dome, the gold ball, the belfry arches and both bells, the colonnade, the white box,
  the plinth arch, the grass. As a 120 px black silhouette it is a stepped tower with a domed top and a ball
  finial on a wide low box: not confusable with the Peace Tower's single slender shaft or with the Château's
  wide mass and cones.
- **Pier 21, 900 × 620.** At 25 % (225 px) the brick block, the stone banding, the white entrance, the
  funnels and the green coach all survive. The 120 px silhouette is a stepped block with two funnels and a
  mast behind it — which reads as "waterfront buildings and a ship" and *not* as a place, which is the
  honest outcome §0 describes rather than a failure.

Both pass, which is what ADR-0013 as amended requires before a landmark departs from the 2× default. **They
ship at 1×**, as `landmark-town-clock@1x.svg` and `landmark-pier-21@1x.svg` — 3.08 and 2.13 MiB instead of
12.32 and 8.51.

### 6.3 The placement floor

**Do not draw either landmark below 300 px wide anywhere the player is meant to recognise it.** That is the
verifier's floor from Ottawa, **adopted rather than re-derived**, because no blind pass has been run on
either subject and the artist does not get to set an identification threshold for their own work. The
recommended `position.x` values in §3 place both at full size.

---

## 7. Three findings that are not this agent's to fix

Recorded because each one is invisible from the tree an artist owns, and each one changes what art should
do.

**7.1 — The ground polygon is opaque and is drawn ABOVE every parallax layer, so a band authored below the
ground line is never seen in game.** `level-scene.ts` paints layers at `DEPTH_LAYERS = 100 + index` and the
ground at `DEPTH_GROUND = 400`, filling from the polyline down to `size.y` in `theme.ground` darkened 6 %.
`selectLayers`'s `layerCoverage` already models this correctly — it clips at `horizonY` — so the *tier* logic
and the *painter* agree. Two shipped levels do not:

- `ottawa-layer-60-ice` sits at `offset.y` 1210 under a ground line at 1240: **30 of its 230 rows are
  visible.**
- `quebec-city-layer-60-slope` sits at `offset.y` **1280** under a ground line at **1280**: **none of it is
  visible.** The toboggan run — the thing that level's locomotion is named after — is painted over in its
  entirety.

Both are `offset.y` in a level document, not art. The fix is to raise the near band above the ground line or
to lower the ground polyline under it; either is one number. **Halifax and Toronto avoid the problem by
construction: no layer in either level has content below y = 1280.** It is also worth saying that the
`verify-art` hand-off composites tiles directly rather than through the engine, so a subject can be judged on
art the game never shows — which is exactly what happened to the toboggan run.

**7.2 — A POI has no `offset`, and one level sheet says it does.** `level-scene.ts` `#paintPois` places
`poi.artKey` with origin `(0.5, 1)` at `(position.x, groundYAt(position.x))`. `assets/style/quebec-city-level.md`
§3 says "Place it at `offset` `(poiX − 540, 300)`" and derives the Château's world y from that offset; there
is no such field on a POI in `level.schema.json`. The Château's bottom edge will land on the ground line, not
at world 1200, so every world-y figure in that bullet is 80 px out. Reported rather than edited: that sheet
belongs to the same tree as this one, but the number that is wrong is a claim about the engine and the engine
should confirm it before the sheet is rewritten.

**7.3 — `poi-marker-*` and `particle-snow` are textures nothing can reference.** Neither the schema nor the
scene has any concept of a POI marker sprite (`PlayableMarker` is a DOM element) or a particle texture (snow
is `Graphics`, procedural). Ottawa and Québec City ship three such sources each; they are packed into an
atlas and charged to their levels. Small — Québec City's atlas is 0.55 MiB — but it is the rule
`art-bible.md` §9 already states, applied to two levels that predate it being stated. Halifax and Toronto
author none.

---

## 8. Open questions this level did not answer

- **`OQ-HALIFAX-1`** — the level's copy must never name the museum or the operating institution at Pier 21 in
  the picture, and the art draws no lettering. Whether the POI *blurb* names it is the PO's call and is not an
  art decision. Recorded because the constraint the art satisfies is one half of a pair.
- **`OQ-HALIFAX-2`** — the territory statement for this level. Not an art decision and deliberately not
  proposed here: `docs/content-review.md` §10 requires a citable fact and nation names taken from that
  nation's own material, and no agent grants cultural sign-off. The art asserts nothing. This matters more
  here than on any level so far, because level 2 is Mi'kma'ki and level 1 is set on the same coast.
- **`OQ-ART-11` (new)** — **there is no palette lint.** `art-bible.md` §2 and `CLAUDE.md` both say "the
  palette lint fails on anything else", and no such gate exists: `validate-content.mjs` checks the palette's
  *internal* integrity and never opens an SVG, and `assets.mjs` never reads `palette.json` at all. The check
  was run by hand for this task — `scratch/gen/palette-check.mjs`, 80 sources, 3 648 shapes, 0 off-palette
  fills or strokes and 0 forbidden constructs — and a hand-run check is what `OQ-ART-02` was closed for being.
  Owner: infra. It is about twenty lines and it belongs inside `make assets`.
- **`OQ-ART-04`** — which red is the National Flag? Still open, and this level dodges it entirely: it draws
  no flag, and the one flag in its references is on a mast that is deliberately simplified away.
- **One open blocker** — `content/levels/halifax.json` must land in the same commit as this art, or
  `make assets` is red for every level and not just this one (ADR-0020). `scripts/lib/art-handoff.mjs`
  `RECIPES` also needs three entries: `town-clock` and `pier-21` are `singleSource()`, and
  `halifax-quayside` is `twoParallaxTiles({ farMatch: 'uptown', nearMatch: 'quayside', nearTop: 160 })`.
  Listed in `references.json` with real `renders` rather than declared unrendered, for the reason Québec
  City's sheet gives: a loud red gate naming its own fix is worth more than a green one built on a
  declaration that was not true.

### The exact patch `RECIPES` needs, so it is five lines and not a design task

Both shapes already exist as factories in `scripts/lib/art-handoff.mjs`; this adds no new builder shape.

```js
  'town-clock': singleSource(),
  'pier-21': singleSource(),
  'cn-tower': singleSource(),
  'halifax-quayside': twoParallaxTiles({
    farMatch: 'uptown', nearMatch: 'quayside', nearTop: 160,
    what: 'a town tile and a quayside tile',
  }),
  'toronto-trail': twoParallaxTiles({
    farMatch: 'skyline', nearMatch: 'boulevard', nearTop: 340,
    what: 'a skyline tile and a boulevard tile',
  }),
```

**Until they land, `make verify-art` is red with five named failures and `make test` is red with sixteen** —
every one of them in `tests/unit/infra/art-handoff-gate.test.ts`, and every one of them carrying the same
sentence, "has renders and this harness has no builder for it". That test drives the real CLI over the real
repository, so any subject added to `references.json` without a builder fails it. **The alternative available
inside `assets/**` was to declare `renders: []`**, which the harness accepts as "unrendered on purpose" and
which would turn the two landmarks these levels exist to show into subjects nobody checks. It was not taken,
for the reason Québec City's sheet gives: a loud red gate naming its own fix is worth more than a green one
built on a declaration that was not true.

Both composites were built by hand with the parameters above and looked at before they were declared:
`scratch/gen/twotile.mjs` produces the same 2016 × 600 and 1800 × 740 images the harness will.

## 9. A note for whoever wires the layers up

`content/schemas/level.schema.json` still describes the **old** tier rule in `ParallaxLayer.depth` — "keeps
the highest-depth layers and drops the rest" — and so does the mirroring comment in
`app/application/ports/content-repository.ts`. `level-effects.ts` says so itself and calls both stale. This
level is composed for the **coverage** rule, and reading the schema's sentence instead would suggest the sky
is dropped first, when it is in fact the layer most certain to survive. The four coverage figures are in §2
so the drop order can be checked rather than assumed.
