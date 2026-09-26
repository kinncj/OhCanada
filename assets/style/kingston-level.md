# Kingston level art — layers, offsets, budgets and the decisions behind them

Level 5 (journey slot 5, between Ottawa and Toronto) — **Building Canada**, locomotion **walk**. Step K-2.1 of
`docs/plan/kingston.md`. Sources are `assets/src/svg/kingston/*.svg`; `assets/style/art-bible.md` is the house
style and `assets/refs/references.json` is the accuracy contract `make verify-art` judges renders against. The
four stops, and everything refused and never drawn, are fixed by `docs/stories/TN-LEVEL-kingston.md`, "Rulings
(K-0.9)", Ruling 2. This file is the level-specific sheet: what each texture is, where it goes, what happens to
it at each visual tier, and which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**. Summer, a clear afternoon on Lake
Ontario, in a city of grey limestone at the mouth of the Cataraqui and the Rideau.

---

## 0. What adding this level's art cost, measured

**The blind hand-off needed no infra edit.** Every one of the five Kingston subjects declares its own builder
in `references.json` (`"handoff": { "builder": "single-source" }` for the four stops, `two-parallax-tiles` for
the band), which is what K-0.8 made possible. `scripts/lib/art-handoff.mjs` has no Kingston line. Québec City's
three stops each needed one (`quebec-city-level.md` §13); Kingston's four needed none.

**One ordering blocker is open, and it is the same one Québec City recorded.** `make assets` cannot build this
art until `content/levels/kingston.json` exists, because the pipeline reads a source's owning level from its
path and refuses a directory that names no level:

```
assets/src/svg/kingston/… sits under "kingston/", which is neither "shared" nor a level id in
content/levels/ (…), nor "screens", … this file is charged to no payload budget.
```

That refusal is correct (ADR-0020), and `docs/plan/kingston.md` K-2.1 already says so: *"Unclaimed until K-2.2,
so red until then."* **So on this branch alone `make assets` is red, by design, until K-2.2 lands the level
document.** Every number in §5 was measured in a scratch root carrying a minimal `kingston` level document, as
Québec City's were. §3 records every number that document needs.

**And one tree difference, recorded so nobody chases it.** This branch forked before K-0.8 merged, so its own
`scripts/lib/art-handoff.mjs` does not yet read `handoff`. The hand-off and `art-handoff-gate` were run against
`origin/main`'s scripts with this branch's `assets/` laid over them, which is the tree the landing PR will
have. On this branch alone the gate names the five Kingston subjects as having no builder, and that goes away
when the branch takes `main`.

---

## 1. What was produced

Nine SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/kingston/` gets the key `kingston-<filename>`:

| key | source | authored px | what it is |
|---|---|---|---|
| `kingston-layer-10-sky` | `layer-10-sky.svg` | 1080 × 960 | flat `sky-base` with four cumulus banks, one band step to `sky-light` at 910, hidden behind the water |
| `kingston-layer-20-farshore` | `layer-20-farshore.svg` | 1800 × 150 | the far side of the lake: a low wooded island shore with a row of wind turbines, over a horizon haze band |
| `kingston-layer-30-harbour` | `layer-30-harbour.svg` | 1800 × 460 | open blue water to the ground line, darkening toward the viewer, with three white sloops |
| `kingston-layer-40-promenade` | `layer-40-promenade.svg` | 1440 × 420 | the lakeshore promenade: a limestone parapet, shade trees, lamps, benches, verge and paving edge |
| `kingston-ground-lakeshore-paving` | `ground-lakeshore-paving@1x.svg` | 1080 × 640 | ground dressing (ADR-0042): limestone paving flags, a kerb, a grass strip |
| `kingston-landmark-fort-henry` | `landmark-fort-henry@1x.svg` | 760 × 290 | **stop 1**: Fort Henry's casemate range on the parade, with the rampart, its railing, chimneys and two guns |
| `kingston-prop-kingston-city-hall` | `prop-kingston-city-hall@1x.svg` | 800 × 560 | **stop 2**: Kingston City Hall's harbour front, portico and dome |
| `kingston-prop-kingston-mills` | `prop-kingston-mills@1x.svg` | 720 × 520 | **stop 3**: a Kingston Mills lock chamber and its timber gates, in summer |
| `kingston-prop-royal-military-college` | `prop-royal-military-college@1x.svg` | 800 × 720 | **stop 4**: the Mackenzie Building of the Royal Military College, on Point Frederick, flying the college's own flag, the official artwork with its full arms, imported from the Commons SVG (720 rows since 2026-09-26, §6) |

**No POI marker and no particle file.** Québec City's sheet records 0.55 MiB of markers and a snow particle that
are packed, charged and referenced by nothing. Kingston is summer with no weather, and the markers are not art a
level document can name, so neither is authored. There is no character source here: the giver is the existing
`guide` (Ruling 3) and the player is shared rig art.

**Fort Henry is the level's one `landmark-`; the other three stops are `prop-`.** The first draft named all four
`prop-` on the reading that the four stops are equals in the ruling and the engine does not care. The engine does
care, in one place: the level's stamp on the completion card is pressed from the one POI whose art key is
`<level>-landmark-<name>` (`isLandmarkArt` and `stampLandmark` in `app/bootstrap/screen-art.ts`), and
`tests/unit/bootstrap/screen-art.test.ts` requires every shipped level to have one. The rename is mechanical: the
drawing, its size, its `@1x` pin and its contract are unchanged, and a landmark needs nothing a prop does not
(every other level's landmark is a pinned `@1x` single source built by `single-source`, as Fort Henry already
was). **Why Fort Henry.** It is stop 1, the one named in the level's territory statement (Ruling 6, p. 30), and the
first thing on the route; its silhouette (a long rampart with guns and chimney stacks) is the only one of the four
that no other level's stamp resembles, where City Hall's dome and the college's clock tower both sit close to
Ottawa's and Québec City's. Changing `content/levels/kingston.json` was the `artKey` value alone.

---

## 2. The parallax stack — four layers, composed for the coverage rule

`selectLayers` in `app/adapters/phaser/level-effects.ts` keeps **the layers that cover the most screen**,
clipped at the highest point of the ground polyline (1280). Ties go to the nearer band.

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | `kingston-layer-10-sky` | 1080 × 960 | 0 … 960 | 0.04 / 0.02 | true | 1 036 800 | yes | **yes** |
| 20 | `kingston-layer-20-farshore` | 1800 × 150 | 780 … 930 | 0.14 / 0.06 | true | 162 000 | yes | no |
| 30 | `kingston-layer-30-harbour` | 1800 × 460 | 820 … 1280 | 0.36 / 0.16 | true | 496 800 | yes | **yes** |
| 40 | `kingston-layer-40-promenade` | 1440 × 420 | 880 … 1300 | 1.00 / 1.00 | true | 432 000 | yes | no |

`offset.y` is the world y in the fourth column; `offset.x` is 0 for every layer. Four layers against a `high`
budget of six is deliberate (art-bible §6.3): nothing else here has an unoccupied band to earn its texture.

**At `low` the player sees the sky and the open water**, with the four stops standing on the paving. The harbour
tile was made **460 rows, running all the way to the ground line**, so it wins that place over the promenade's
420; open water behind a limestone city is the level, and a parapet in front of an empty gradient is not. Like
Toronto's skyline, this is the one number set to decide a tier rather than to frame a picture, and a later trim
of 40 rows off the harbour would silently swap what a weak phone shows.

### Nothing on a repeating tile may name the city

All four layers repeat. **Kingston comes from the four stops and from nowhere else.** The harbour carries water
and three sloops as types (white hulls, a plain navy sheer stripe, no name, number or livery); the promenade
carries a parapet, trees, lamps and benches as types; the far shore carries a low island and turbines. There is
**no building, dome, clock tower, fort, lighthouse or Martello tower on any tile**. Kingston's harbour has a
Martello tower standing in the water (`refs/kingston/fort-henry-ditch-and-branch-tower-2021.jpg` shows another
at the fort's ditch); drawing one on a tile that repeats would put four of them on the level and borrow
Québec City's `martello-tower` subject besides. `kingston-lakeshore.neverAdd` forbids it by name.

**The turbines are real and stay generic.** The island shore across the lake from Kingston carries a wind farm,
and `refs/kingston/lake-ontario-to-wolfe-island-2012.jpg` shows the row of them. They are drawn as types, white,
three-bladed and small, which is what separates this lake from Toronto's, a level later, without naming anything.

### The sky band step, and where it hides

The sky is flat `sky-base` for 910 rows and then `sky-light`. **The step at world 910 sits behind the opaque water
of the harbour tile, which starts at world 900**, and the harbour is the layer kept beside the sky at every tier,
`low` included, so the step never shows against open sky. The first draft put it at 860 and trusted the far
shore's haze band (world 846 … 876) to hide it; that holds at `high` and `medium` and fails at `low`, where the
far shore is dropped and 40 rows of open sky would have shown the step. It was moved rather than argued for.

### The desktop side panel and the top band

The sky layer's row 0 is `sky-base`, which is the theme's `sky`, for the letterbox band above the canvas
(art-bible §6). Every cloud is inside x 123 … 896, so the extreme columns are flat band colour for the side panel.

---

## 3. Placement the level document should use

`content/levels/kingston.json` is not this agent's file (K-2.2 is the content author's). These are the numbers the
art was built for.

- **Ground polyline y = 1280, level, the whole way.** The promenade tile's local y 400 *is* that line and the
  paving strip's local y 0 is too. Every band is at a fixed world y; a sloped ground would cut them.
- **Stops, at the plan's ~1 600 px pitch** (K-2.2): `fort-henry` 1 540, `kingston-city-hall` 3 140,
  `kingston-mills` 4 740, `royal-military-college` 6 340, each at y 1280. A POI has no `offset`: `level-scene.ts`
  draws `poi.artKey` with origin `(0.5, 1)` at `(position.x, groundYAt(x))`, so **each file's bottom edge is the
  ground line and its horizontal centre is `position.x`.** The widest file is 800 px, so neighbouring props are at
  least 800 px apart edge to edge.

| id | x | y | artKey | file | world y of its top |
|---|---|---|---|---|---|
| `fort-henry` | 1 540 | 1280 | `kingston-landmark-fort-henry` | 760 × 290 | 990 |
| `kingston-city-hall` | 3 140 | 1280 | `kingston-prop-kingston-city-hall` | 800 × 560 | 720 |
| `kingston-mills` | 4 740 | 1280 | `kingston-prop-kingston-mills` | 720 × 520 | 760 |
| `royal-military-college` | 6 340 | 1280 | `kingston-prop-royal-military-college` | 800 × 720 | 560 |

  Every top is well clear of the 120 px system band. City Hall's clock is at world ≈ 871 and the college's at
  ≈ 844 (its round face, drawn without hands since the redraw in §6), both above the lower-third HUD at 1280.
  The college's flag, added 2026-09-26, flies at world ≈ 575 … 640 at the top of its staff (the file's rows
  14 … 78); the 180 rows it added are above the building, so no position, radius or ground number changes.
- **`size.x` ≥ 7 680**, which the plan expects, so that every POI's x + radius sits before `size.x − 540`
  (ADR-0074 §4). Every layer and the paving tile, so width is free.
- **Per 1 440 px promenade tile**, from the tile origin: trees at 180 / 700 / 1 180, lamp standards at
  420 / 940 / 1 380, benches at 560 and 1 290. All stand on the verge behind the path, so nothing can block the
  walker or a prompt.
- **`layers[]`** as §2's table, and **`groundDressing`** `{ "key": "kingston-ground-lakeshore-paving", "topY": 1280 }`.
- **`theme`** (`palette.json` `levelTheme.kingston-lakeshore-summer`): `sky` `#3d8ccb` (`sky-base`), `ground`
  `#afaca5` (`path-light`, the paving's stone), `horizon` `#a5d6ee` (`sky-light`). No other level has this
  triple. `ink` and `inkMuted` are `ui-a11y`'s and must pass WCAG AA against both ends; they are not proposed here.
- **`weather`** `none`, **`playerCostume`** `jacket`: summer, no particles.
- **`textureBudgetBytes` = 37 748 736 (36 MiB)**, as Toronto and Vancouver declare; §5 has the measurement.
- **`territory` is not proposed here.** Ruling 6 fixes it (`nations: []`, `source-names-none`, citing p. 30),
  and it is the content author's. What the art asserts is nothing: **no person of any kind is drawn anywhere in
  this level**, Indigenous or otherwise, and no object belonging to any nation.

---

## 4. Every effect has a plain path (ADR-0011)

**There is not a single `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or
`url(…)` in any of the nine sources**; the palette lint inside `make assets` checks it and reported OK over all
212 sources in the scratch run. Two sources use a `<g transform="translate(0 …)">` to crop a drawing grid to the
rows it covers (§5), and since 2026-09-26 the college uses one the other way, to add 180 rows above its tower for
the flagstaff (§6).

| effect | plain form — what everyone sees | filtered form, if a tier ever offers one |
|---|---|---|
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every ground contact and 0.18 bands where the parapet meets the verge and the gate walkway meets the gates. Baked. | none wanted. |
| water | flat `water` bands, darker toward the viewer, with level ripple bars. Static. | a shimmer would be a bonus and must never be what makes it read as water. |
| distance | the far shore in `glacier-shade` and a `sky-light` haze band: aerial perspective by tone, never by alpha. | a fade would be a bonus. |
| falling weather | **none: summer.** No `particle-*` source. | — |
| player costume | `jacket` (`player.md` §7). | — |

---

## 5. Budgets, measured

`node scripts/assets.mjs`, 2026-09-25, run against a scratch root: `origin/main` at `a91b803` with this branch's
`assets/` laid over it and a minimal `content/levels/kingston.json` declaring §2's four layers, the paving strip,
the four stops and 36 MiB. Nothing else in a level document changes these numbers.

```
palette:        OK - 21829 fill/stroke declaration(s) in 212 source(s) against 117 distinct palette colour(s)
level-payload:  OK - kingston 0.54 MiB over 13 file(s) [1x device 0.33 MiB / 2x device 0.54 MiB]
texture-memory: kingston 28.81 MiB of 36.00 MiB FILES, measured from 13 file(s)
                CHARGED 30.53 MiB of 36.00 MiB (85%, 5 735 584 B spare) = files + 1.72 MiB character surface
```

**Re-measured 2026-09-25 on this branch, after the Fort Henry rename and the college redraw (§6):** `make assets` green with the real level document; transfer payload 0.56 MiB against 8 MiB; Kingston's own art **85 280 B** (+518 B, the college's WebP 7 300 B); decoded files 28.96 MiB, charged 30.68 MiB of 36 MiB (85 %, 5 580 596 B spare). **Re-measured 2026-09-26 after the college flag (§6):** `make assets` green; transfer payload still 0.56 MiB against 8 MiB; the college's WebP 8 874 B (+1 574 B on 7 300 B); decoded files **29.51 MiB**, charged **31.23 MiB of 36 MiB (87 %, 5 004 596 B spare)**. The college prop is now 800 × 720 = **2.20 MiB** decoded, exactly 576 000 B (800 × 180 × 4) more than at 540 rows, which is the whole change; the rest of the difference from the 2026-09-25 line is the shared character atlas, which `main` has since grown to 1361 × 1955 (10.15 MiB). **Re-measured 2026-09-26 after the official flag replaced the simplified one (§6):** `make assets` green; palette lint 22 064 declarations in 212 sources against 124 distinct colours; transfer payload still **0.56 MiB against 8 MiB**; the college's source SVG 100 435 B (was 33 612 B) and its WebP **11 992 B** (+3 118 B on 8 874 B); Kingston's own art **89 972 B**; every level's art together, as built, 3 332 197 B against `backgroundCacheBytes` 5 242 880 (1 910 683 B headroom). The prop's pixel size is unchanged, so decoded texture memory is unchanged: files **29.51 MiB**, charged **31.23 MiB of 36 MiB (87 %, 5 004 596 B spare)**. The tables below are the first measurement and are kept as it.

**Transfer payload: 0.54 MiB against 8 MiB — 7 %**, of which the shared character atlas is most.

**Kingston's own art, both scales, each file once — 84 762 B.** That is the number ADR-0075's background cache
charges this level. Against the ten levels already shipped:

| | bytes |
|---|---|
| Kingston's own art | **84 762** |
| lightest of the ten (Halifax) | 125 518 |
| median of the ten | 230 288 |
| heaviest of the ten (the North) | 454 518 |
| **every level's art together, shared files once, with Kingston** | **3 299 487** |
| `budgets.backgroundCacheBytes` (ADR-0075) | 5 242 880 |
| **headroom left** | **1 943 393** |

Kingston is the **lightest level in the game** by own bytes, at 37 % of the median. It takes 84.8 kB of the 2.03
MB of headroom ADR-0075 left, and it does not approach the 450 kB ceiling this step was given. Flat fills and long
straight edges compress to almost nothing in WebP; the paving strip, 1 080 × 640, is 2 420 B.

**Decoded texture memory at a 2× device:**

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1346 × 1948 | **10.00 MiB** |
| `kingston-layer-10-sky` | 1× | 1080 × 960 | 3.96 MiB |
| `kingston-layer-30-harbour` | 1× | 1800 × 464 | 3.19 MiB |
| `kingston-ground-lakeshore-paving` | **1×, pinned** | 1080 × 644 | 2.65 MiB |
| `kingston-layer-40-promenade` | 1× | 1440 × 424 | 2.33 MiB |
| `kingston-prop-kingston-city-hall` | **1×, pinned** | 800 × 560 | 1.71 MiB |
| `kingston-prop-royal-military-college` | **1×, pinned** | 800 × 540 | 1.65 MiB |
| `kingston-prop-kingston-mills` | **1×, pinned** | 720 × 520 | 1.43 MiB |
| `kingston-layer-20-farshore` | 1× | 1800 × 154 | 1.06 MiB |
| `kingston-landmark-fort-henry` | **1×, pinned** | 760 × 290 | 0.84 MiB |
| **files at a 2× device** | | | **28.81 MiB** |
| + one character surface (ADR-0013) | | 240 × 470 × 4 × 4 | 1.72 MiB |
| **charged** | | | **30.53 MiB of 36 — 85 %** |

The four extra rows on each layer below world 0 are the pipeline's transparent tile-top rows (art-bible §6), not
authored. By decoded files Kingston is **the lightest level after Peggy's Cove** (28.81 MiB against 27.11), and its
charged 30.53 MiB is 33.47 MiB under the 64 MiB cap.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost 10.54 MiB; authored 1 920 tall at the same
   widths they would cost 44.82 MiB, which is 34.28 MiB more.
2. **Two props were cropped after drawing.** Fort Henry was drawn on a 400-row grid and ships 290 rows, because
   the top 110 were sky; City Hall's grid is 560 and its finial is at row 16. A `<g transform>` does the crop, so
   the drawing's own coordinates still read as ground-up.
3. **All four props are pinned to 1×.** At 2× they would cost 22.5 MiB between them instead of 5.63.
4. **Nothing is drawn that only survives at 2×.** The smallest deliberate features are the 3.5 px clock hands,
   which are the art bible's thin-stroke exception on a named feature, and the 4 px railing bars.

---

## 6. The four stops: what was measured, and what the two-size test found

Every ratio below was measured on the named reference after converting it to sRGB, and each is written into the
subject's `mustBeRight` in `references.json` with the drawn value beside it. **Every stop's contract carries
`"handoff"`, so the blind run builds all four with no script edit.**

**The one material decision, taken for all four at once: the stone is `path`, not `limestone`.** Kingston's
limestone measures grey: sunlit on City Hall it samples hsl(55, 7 %, 68 %), which is `path-light` #afaca5 to
within a few points, and `limestone` (hsl 26, 13 %, 60 % at its base) drew the first promenade as pink brick.
`limestone` stays Québec City's warmer stone. One city, one stone, one ramp.

### Fort Henry (`fort-henry`)

- **The view is the parade, not the walls from the water, and licence decided it.** Every photograph of the
  fort's outer walls from the lake on Commons is CC BY-SA and was refused. The parade face of the casemate range
  is what `fort-henry-casemates-2010.jpg` (CC BY 3.0) and the 1908-12 Archives of Ontario photograph both show,
  square on, and it is the fort's own face: tall round-headed arches on square piers, a casemate front in each,
  an upper gallery behind an iron railing, and the rampart above with its railing, chimney stacks and guns.
- **Measured**: the wall is 1.37 bay pitches tall and each arch opening is 0.81 of the pitch; drawn 1.26 and 0.81.
- **The guns are drawn, and why.** The 2010 photograph shows two guns on the rampart above the range. Without
  them the drawing reads as an arcade, a viaduct or a market hall; with them, a fort. They are in profile, never
  firing. A cannon is not a figure, and the ruling forbids figures, not the fort's own guns.
- **Two-size test**: at 25 % (190 px) every `mustBeRight` feature survives. **As a 120 px black silhouette it
  keeps the guns and chimney stacks on a long rampart, but not the arches**, which are interior shapes. Recorded,
  not claimed as a pass: the silhouette says "rampart with guns", and the arches carry the rest in colour.

### Kingston City Hall (`kingston-city-hall`)

- **Measured** on `city-hall-harbour-front-2017.jpg`, in façade heights H and portico spans S: columns to 0.81 H,
  pediment apex 1.15 H, drum 1.36 … 1.72 H and 0.44 S wide, dome to 2.0 H and 0.39 S wide, lantern top 2.36 H and
  0.14 S wide. **The first draft had the columns at 0.62 H and the drum at 0.69 S**, which made a one-storey
  porch under an oversized drum; it was rebuilt on the numbers. The photograph is low and close, so the near
  portico is slightly enlarged against the dome; the drawing keeps the measured numbers rather than guess a
  perspective correction.
- **The dome is dark**, sampled hsl(12, 5 %, 28 %), drawn in `path` shade and base: it is the only dome in the
  game, and it is not green.
- **The weathervane is not drawn.** Its compass arms read as a cross at play size, and "a church" is exactly the
  wrong answer for a civic hall. Art-bible rule 4: drop, never substitute. The finial stays.
- **No statue and no figure.** The 2017 photographs show none on the building or its harbour front. The statue
  that stood in City Park was removed in 2021 and is not drawn anywhere in this level (Ruling 2). The park's arch
  and fountain, which stand in front of the building in both 2017 photographs, belong to the park and are not
  drawn either.
- **Two-size test**: passes both. At 120 px the silhouette is a long block with a pedimented centre, a tall dome
  on a drum and a small cupola on each wing.

### Kingston Mills (`kingston-mills`)

- **One present-day photograph was usable, and it is the primary reference**: `kingston-mills-upper-gate-2010.jpg`,
  CC0, a drained chamber in January. Every other present-day photograph of the site on Commons is CC BY-SA (§8).
- **Measured**: the gate opening is 0.57 as high as it is wide; drawn 0.60 (the first draft was 0.75 and read as
  a doorway). The gates are weathered grey timber, sampled hsl(34, 4 %, 39 %), drawn in `path` shade and base,
  darker than the stone.
- **Summer, so water.** The level is summer; the reference is winter and settles geometry only.
- **It must not be the Ottawa lock.** `canal-lock` is winter, ice, snow and white balance beams. This one has
  water, a railed walkway over the gate heads, stone steps up the right wall, a bollard, and the white clapboard
  lockstation house with green trim on the bank, all from the 2010 photograph.
- **Not drawn: the railway bridge and the blockhouse.** Both stand at Kingston Mills. Neither has a present-day
  photograph under an accepted licence, and a thing whose present state cannot be confirmed is not drawn.
- **Two-size test**: at 25 % (180 px) every `mustBeRight` feature survives. **As a 120 px silhouette it does not
  identify a lock**: two blocks and a house, because a lock is mostly negative space. `canal-lock` records the
  same finding for Ottawa. Recorded, not claimed.

### Royal Military College of Canada (`royal-military-college`)

- **The contract picks the view**, as Ruling 2 asks: the Mackenzie Building, square on. It is the college's
  oldest building and the one every view of Point Frederick shows.
- **Measured** on the 2007 elevation, a near-orthographic long-lens night exposure: tower shaft 0.125 of the
  building's width and its cap 0.655 of it tall; pavilions 0.123 wide; façade cornice 0.257 of the width above
  ground; five bays each side of the tower. Drawn 0.125, 0.654, 0.123, 0.261 and five.
- **Colour traps, both references.** The elevation is floodlit (the stone reads yellow, the mansards olive) and
  the daylight photograph carries a strong magenta cast. Neither was sampled for hue; the daylight one settles
  which roofs are dark (the tower's, `slate`) and which are green (the pavilions and wings, `glacier`, a muted
  grey-green, never Parliament Hill's bright `copper`).
- **The building and the college's own flag.** No cadet, no crest over the door or on the tower (the carving is
  left as plain stone), no memorial arch. Until 2026-09-26 the flag was not drawn either and the card taught the
  red-white-red pattern in words only; the amendment to Ruling 2 put it on the tower (below, "The college flag").
- **Two-size test**: at 300 and 140 px the tower's stages, its roof, the pavilion roofs and the dormer row
  survive; at 140 px it is a long low block with a tall slender central tower under a steep flat-topped roof and
  a steep flat-capped roof at each end.

#### The blind run read it as a city hall, and what the redraw did about it

Blind run `2c31c41bb3e4f0ea` (`docs/art-verification.json`, `findingsForArt[0]`) read the first drawing at every
size as *"Second Empire civic building (city hall) with a central clock tower ...; my best guess is Halifax City
Hall"*, the same sentence it gave `hotel-du-parlement`. The contract names "a city hall" a FAIL, because
`kingston-city-hall` is in this level. It is a FAIL here too.

**Redrawn from the elevation, 2026-09-25. Every change is something the photograph shows and the first drawing
did not:**

1. **Two storeys over a basement row, not three over a rusticated storey.** Between the ground and the wing
   cornice the elevation shows two tall storeys and a row of small low basement windows. The first drawing
   followed a contract line that said "three storeys", and fitting four rows of full windows into a wall 0.25 of
   the building's width tall made the wings an office block. The contract line was wrong about the photograph
   and has been reworded (`references.json`, `mustBeRight[3]`, with the reason).
2. **Five bays each side, not four.** The elevation has five. The longer, plainer run of identical bays is the
   building's institutional rhythm, and it is also simply the count.
3. **The pavilions' attic storey and paired windows**, above and below the wing cornice, as photographed.
4. **The tower's own staging**: a small arched door straight onto the ground with no steps and no portico, a
   stage of paired square windows under a plain segmental hood (its carving left as plain stone), paired arched
   windows, and a louvred belfry stage under the dentilled cornice. The first drawing had the tower as a plain
   shaft with windows, which is what every Second Empire city hall's tower is too.
5. **The clock is de-emphasised, not removed.** The round face stays, true to its measured size and place in the
   roof, but it is drawn without hands. The hands are thin strokes under the 12 px floor at play size, so
   dropping them is art-bible rule 4 (drop, never substitute), and without them the face is the same round form
   as the two pavilion oculi, which is how the night elevation shows all three. The contract's first feature
   used to call the clock "the one thing on it recognisable at play size", which made the contract ask for the
   cue the failing reading keys on; that line has been reworded, with the reason written into it
   (`mustBeRight[0]`). Nothing on `expectedBlindAnswer` was tightened or loosened.

**What was not drawn, and why.** The candidates were the college's site on Point Frederick, with the water, the
Stone Frigate or the parade square in front. Neither Mackenzie Building photograph shows any of them: the
elevation shows a strip of pavement and lawn in front, and the daylight photograph shows sky.
`kingston-harbour-from-fort-henry-2011.jpg` shows Navy Bay and stone buildings on a point across it. Neither the
photograph nor its record says which building is which, so drawing any of them as the college's setting would
be a guess. A present-day, licence-clean photograph that shows the Mackenzie Building from the water or across
the square would open that option.

**What this redraw cannot do** (written 2026-09-25; the flag half of it was overtaken the next day, see "The
college flag" below). The verifier's own finding says it: the markers that would say "college" rather
than "civic building" are cadets, the crest, the flag and the gate arch, and Ruling 2 forbids all four. The
redraw makes the building truer to its photograph, and it drops the one cue the contract itself was pushing.
Whether that is enough can only be judged blind. If the next blind run still reads a city hall, the question
goes to the contract owner, as the verifier asked: what this subject can be asked for, not how to draw it.

#### The college flag (amendment to Ruling 2, 2026-09-26)

Blind run `e71e2696` (`docs/art-verification.json`, `findingsForArt[0]`) read the redrawn building at every size
as *"Parliament Building of Quebec (Hôtel du Parlement)"*, a named FAIL, and asked the contract owner what this
subject could be asked for, since every marker that says "college" was refused. The project owner amended Ruling 2
(`docs/stories/TN-LEVEL-kingston.md`, committed in `672efdb`): the guide ties the college to exactly one thing,
*"The red-white-red pattern comes from the flag of the Royal Military College, Kingston, founded in 1876"*
(p. 79), so that flag is drawn. Cadets, uniforms and every other insignia stay refused.

**Source.** `refs/kingston/rmc-college-flag-2020.jpg`, a 1600 px rasterisation of the Commons file
[`Flag_of_the_Royal_Military_College_of_Canada.svg`](https://commons.wikimedia.org/wiki/File:Flag_of_the_Royal_Military_College_of_Canada.svg):
the flag adopted 31 July 1920, by the Artist of the College of Arms, London, rendered in SVG by Christopher
Boucher (2020). Public domain in Canada (Crown copyright, published more than 50 years ago). **Commons also tags
it trademarked and as insignia**: it is a Prohibited Mark under Trademarks Act s. 9(1)(n)(i). That is recorded,
not resolved, in `credits.json` and `references.json` `licenceAudit`. The game first showed a **simplified
depiction**; since the owner rejected it, it ships **the official artwork itself** (below, "The flag is the
official artwork"), so the mark is reproduced exactly and shipping it is the owner's decision.

**Where it flies, and why there.** Both reference photographs place **one flagstaff, rising from the centre of
the tower's flat top**: the 2007 elevation square on, and the 2008 daylight view from below. So the staff is
there, at x 400, and nowhere else; no second staff and no staff on a pavilion. Measured on the elevation, the
staff stands **0.234 of the building's width** above the tower cap; drawn 187 px on 800 (0.234). The flag flies
to the right, as both photographs show it. **Present state, said plainly:** the 2008 photograph shows the
National Flag of Canada on that staff, and the 2007 one an unidentifiable red-and-white flag at night. Neither
shows the college flag on it. The staff's place is photographed; the college flag on it is the amendment's
choice, because it is the flag the guide names. The file grew **180 rows at the top** (540 → 720) to hold the
staff; the building is unchanged under a `translate(0 180)`, and its bottom edge is still the ground line.

**The flag is the official artwork, not a simplification (replaces the first flag, same day).** The first
flag drawn here was a simplification: three 32 px bands and the arms reduced to one plain grey ellipse, by
art-bible §5 rule 4. **The project owner rejected it as looking bad** and accepted the college flag **only at high
fidelity**: the real Royal Military College of Canada flag, with its actual coat of arms, faithful to the official
artwork. So the flag is no longer drawn at all. It is **imported**.

- **Source:** the Commons SVG itself,
  [`Flag_of_the_Royal_Military_College_of_Canada.svg`](https://upload.wikimedia.org/wikipedia/commons/9/91/Flag_of_the_Royal_Military_College_of_Canada.svg),
  sha1 `c1f78afd…`, the same file `refs/kingston/rmc-college-flag-2020.jpg` was rasterised from. Artist of the
  College of Arms, London; SVG by Christopher Boucher, 2020; public domain in Canada. Credited in `credits.json`
  on the prop's own entry, which now says the flag is not original work and not under the prop's CC BY 4.0.
- **Imported path for path, never redrawn.** The import (a scratch script, not shipped): the Illustrator
  stylesheet's seven classes became `fill` attributes, because the palette lint refuses `<style>`; the 88
  unclassed shapes got the SVG default black they already rendered in; two ellipse transforms and every rect,
  polygon and ellipse were flattened into path data; the field's three overlapping rects became a red ground and
  the white pale; one degenerate one-point polygon was dropped; **consecutive** shapes of the same fill were
  merged into one path, so paint order never changes (148 shapes → 21 paths); coordinates were rounded to
  0.1 flag unit, 0.04 px at 1×. The paths stay in the artwork's own 539.4 × 359 units under one
  `translate(402.5 −168) scale(0.389321)`.
- **Proved lossless before the wave.** Rendered flat at 4× (2158 × 1436) against the Commons file: no pixel
  differs anywhere except a 0.6-unit strip under the white band, where the Commons file's white rect stops short
  of the bottom edge and shows the background; the import closes it. Merging moved no pixel by more than
  antialiasing (max 17 of 255, mean 0.001).
- **Exact colours.** `#ed1c24` (the red pales), `#ee312f` (the crown's cap, the wreath, the scroll ends),
  `#ffc82f`, `#e3e1dd`, `#2a4e91`, `#43b049`, `#000000` and `#ffffff`. Only the white is a house colour (`white-light`); `flag-red`
  is `#d8262c`, and recolouring the arms to it would be an approximated insignia, which `restrictedMarks` calls
  worse than none. `palette.json` gained **three `insignia-rmc` ramps** (seven colours; the white is the existing
  `white-light`), listed in `shading.exemptions` beside the atmosphere ramps, with the reason in
  `exemptionReason` and `ramps.insignia-rmc-flag.note`: they are the colours of one official artwork, not a
  lit material, their tone slots are ordered by lightness only, nothing may cel-shade with them, and nothing but
  this flag may use them.
- **No cel shading on the flag.** A light and a shade band on the two folds were tried in the red pales, clear
  of the arms. At play size they read as a five-band flag, which is the failure the first flag's vertical fold
  already hit, and they would have changed the official colours. Removed.
- **The wave.** A gentle vertical sine warp of every point and every control point: zero at the hoist, which is
  lashed to the staff, growing toward the fly to at most 0.045 of the drop (about 6 px at 1×), with the fly drawn
  in 1.5 % and 1 % of the length taken up. Long straight edges were subdivided first so they bend with the cloth.
  Across the arms it tilts them by at most about 3.5 px over their 52 px width and moves no detail against its
  neighbour by more than a fraction of a pixel, so the arms keep their drawing. Checked at 2× and at 1×: the crown,
  leaves, gauntlet and wreath are undistorted, so the wave stays.
- **Size.** Drawn **210 × 140** at 1× (3:2), top 4 px below the staff head, hoist at the staff, flying right. The
  arms are about **52 × 88 px**: at play size the crown, the three green leaves, the grey armoured arm and the
  red-and-white wreath and scroll are each recognisable. The motto's letters are not legible at 1× and are not
  meant to be. The staff is unchanged (0.234 of the building's width, measured).
- **Bytes.** The Commons file is 127 376 B; the imported flag is 68 223 B of path data; the prop source went
  from 33 612 B to 100 435 B. Its 1× WebP went from 8 874 B to **11 992 B**.

**Superseded, kept as the record of the first flag:** the paragraph on the arms as one plain shape below
describes the flag the owner rejected; nothing in it is drawn now.

**The arms: one plain shape.** Crown, armoured arm, three maple leaves, red-and-white wreath and the bilingual
motto scroll are all detail under the 12 px floor at play size and heraldic besides. By art-bible §5 rule 4 they
are dropped, not substituted: **one plain grey ellipse (`path-base`), 18 × 34 px**, at the arms' place and
roughly their proportion, with nothing drawn inside it. Grey was chosen because the armoured arm is the arms'
largest area; red was refused because a red shape in a white band between red bands is the maple leaf flag, and
green because it would read as a device.

**It must not read as the maple leaf flag, and what separates it.** Equal thirds, not the National Flag's 1:2:1;
3:2, not 2:1; and the white band carries the college's full arms (crown, armoured arm, three GREEN leaves, wreath,
scroll), never one red leaf. The contract names the maple leaf flag in `neverAdd`, and the only leaves it allows on
this prop are the three the armoured arm holds.

**The size is exaggerated, and labelled.** The photographed flag's drop is about 0.03 of the building's width;
drawn **0.175**, about **six times**, so the arms read at play size (art-bible §5 rule 2: exaggerating an
identifying feature is simplification of the scene, not of the flag). The first flag was 2.3 times and 96 × 64;
at that size the arms would have been 24 × 40 px, which is why they were reduced to a shape. At 25 % (200 px wide)
the flag is 52 px wide, its bands about 17 px each, and the arms survive only as a small coloured device in the
white band (red and gold at the top, green in the middle, grey and white below).

**A new risk the flag brings, named in the contract.** A vertical red-white-red tricolour in equal bands is also
**Peru's** flag, and Peru's state flag carries arms in the white band. "A Peruvian government building" is written
into `expectedBlindAnswerNote` as a FAIL, beside "a city hall" and "a parliament", which stay FAILs.

**Contract changes** (`references.json`, `royal-military-college`): the flag is `mustBeRight[5]` with its source,
measurements and exaggeration; `simplifyAway` loses "the flagstaff on the tower and the flag on it" and gains the
staff's guy wires and halyard; `neverAdd` loses its flag entry and gains any change to the official artwork and any
maple leaf other than the arms' own, or a second flag (the first version's arms-to-one-shape rule and its ban on
heraldic detail were removed when the official artwork replaced it; the lettering ban now exempts the motto only), while cadets, figures, uniforms, the building's own carved
arms and the memorial arch stay refused. **Accepted answers:** "a military college" stays; **"a military academy"
is added**, because academy is the ordinary English type-word for the same institution and the method doc puts
a synonym for a depicted thing in the contract, decided by its owner, not in the scorer. Its two content words
both have to appear, and no named FAIL reading carries "academy" or "college"; "a military building", "a
barracks" and "a military base" were considered and refused, because Fort Henry in this level is all three. The
college stays **accepted, not required**: a blind viewer who does not know the college's flag cannot get
"college" from it, and requiring it would tighten the contract to force a result. The reasoning is written into
`expectedBlindAnswerNote`.

**Two-size test, again (official flag).** At 200 px (25 %) the three bands read, the arms are a small coloured
device in the white band, and the tower, pavilion roofs and dormer row survive as before. As a 120 px black
silhouette the staff and a rectangle on it are added above the tower; a silhouette cannot carry the bands or the
arms, so the flag is a colour feature, as the Fort Henry arches are.

**The trademark note stands.** Commons marks the artwork `{{trademark}}` and `{{insignia}}`: a **prohibited mark**
under Trademarks Act s. 9(1)(n)(i), which its public-domain copyright status does not change. The first flag
avoided reproducing the mark by simplifying it; this one reproduces it exactly, at the owner's request. That is
recorded in `credits.json`, `references.json` (`mustBeRight[5]`, `notes`, `licenceAudit`) and here, and it is not
resolved by art: **the owner decides whether it ships.**

**The motto is lettering.** TRUTH · DUTY · VALOUR / VÉRITÉ · DEVOIR · VAILLANCE is part of the arms and was
imported with them, as paths (never `<text>`, which the palette lint and the hand-off refuse). It names no
subject and is illegible at 1×. It is the one exception to "no lettering" on this prop, and `neverAdd` says so.

**Owed:** the owner's approval, on the previews made for it, and a blind run. Whether a viewer reads "college"
from this flag, or "Peru", can only be judged blind.

**For the harness owner, not changed here: the matcher would have passed the city-hall reading.**
`contractDefectsForTheOwner[0]` in the same record: the comparison accepts an answer when every content word of
an accepted phrase appears in it, so *"Second Empire civic building (city hall) with a central clock tower"*
matched *"a Second Empire clock tower building"*, although the answer's identification is a reading this
subject's note names a FAIL. The verifier failed it by hand, recording the reading in `forbiddenPresent`, a field
meant for drawn `neverAdd` items. The gap is the harness's, and it applies to any subject whose accepted list
holds a descriptive phrase and whose note names a fail reading: `hotel-du-parlement` and `kingston-city-hall`
are the nearest. The options the verifier gave (a machine-readable list of fail readings per subject, refused the
way a negation is, or an audit field for a forbidden reading scored as a fail) are both harness changes. The
accepted phrases on this subject were left as they are: removing them would be tightening the contract to
force a result, which this redraw was told not to do.

**Shape counts**, reported per art-bible §1 and not a gate (ADR-0025): Fort Henry 337 drawing elements, City Hall 214,
Kingston Mills 232, the college 460 (449 with the simplified flag, 437 before any flag, 280 before the redraw: five bays a side, the pavilion attic storeys and the tower's staging; the official flag is 21 merged paths imported from 148 shapes, and its staff 2).

---

## 7. What is not drawn, and why — Ruling 2 and content review

The story's list is a rule, and every item of it is in a `neverAdd`:

- **No figure anywhere in the level**: not at the four stops (no guard or re-enactor at Fort Henry, no cadet at
  the college, no lock staff or boater at Kingston Mills, no statue or figure at City Hall), and not on the
  repeating tiles either. Other levels put background figures on their bands; this one has none, so the rule is
  true everywhere by construction rather than by review.
- **No Indigenous person in any form and no object belonging to any nation** (content-review §1, items 2 and 6;
  §4.4). No Métis sash, nothing from §5.2's list.
- **No Macdonald statue, anywhere.** It was removed in 2021.
- **No crest, badge or coat of arms** on the college or City Hall, and none at the fort. The college's arms
  appear only on its flag, as the official artwork (§6).
- **One flag in the level, and only one: the college's own, on its tower** (amendment to Ruling 2,
  2026-09-26; §6). No flag on the fort's rampart, City Hall or the lock, and no National Flag anywhere
  (OQ-ART-04 is open).
- **No lettering, sign, plaque, lock number or livery**, and no blank or faux-text board standing in for one.
  The one exception is the college flag's own motto scroll, part of the official arms and illegible at 1× (§6).

---

## 8. References, and what could not be sourced under an allowed licence

Fifteen files in `assets/refs/kingston/`, all licence-checked before download (fourteen on **2026-09-25**, the
college flag on **2026-09-26**) and re-read after, all credited in `assets/credits.json` with `kind: "reference"`:
one CC0, four public domain (Marsden Kemp, Archives of Ontario, and the college flag), four CC BY 2.0 and six
CC BY 3.0. `references.json` `licenceAudit.note` carries the record.

| file | author | licence | date |
|---|---|---|---|
| `fort-henry-casemates-2010.jpg` | A J Butler | CC BY 3.0 | 2010-08-21 |
| `fort-henry-rampart-and-parapet-2010.jpg` | A J Butler | CC BY 3.0 | 2010-08-21 |
| `fort-henry-ditch-and-branch-tower-2021.jpg` | Thomas Quine | CC BY 2.0 | 2021-08-27 |
| `fort-henry-parade-and-casemates-1908.jpg` | Marsden Kemp (Archives of Ontario) | public domain | 1908-12 |
| `city-hall-harbour-front-2017.jpg` | Mark | CC BY 2.0 | 2017-09-15 |
| `city-hall-ontario-street-side-2017.jpg` | Mark | CC BY 2.0 | 2017-09-15 |
| `city-hall-dome-and-clocks-2011.jpg` | Daniel Hu | CC BY 3.0 | 2011-08-01 |
| `kingston-harbour-from-fort-henry-2011.jpg` | Daniel Hu | CC BY 3.0 | 2011-08-01 |
| `kingston-mills-upper-gate-2010.jpg` | John Marino (runJMrun) | CC0 1.0 | 2010-01-17 |
| `kingston-mills-railway-bridge-and-locks-1900s.jpg` | Marsden Kemp (Archives of Ontario) | public domain | 1898-1920 |
| `kingston-mills-lock-and-basin-1900s.jpg` | Marsden Kemp (Archives of Ontario) | public domain | 1898-1920 |
| `rmc-mackenzie-building-elevation-2007.jpg` | Martin St-Amant | CC BY 3.0 | 2007-05-03 |
| `rmc-mackenzie-building-daylight-2008.jpg` | k_hargrav | CC BY 2.0 | 2008-08 |
| `rmc-college-flag-2020.jpg` | Artist of the College of Arms, London; SVG by Christopher Boucher | public domain (Canada); Commons also marks it trademarked and insignia | flag 1920-07-31, SVG 2020 |
| `lake-ontario-to-wolfe-island-2012.jpg` | kezee | CC BY 2.0 | 2012-08-21 |

**Could not be sourced under CC0 or CC BY, and so not drawn or drawn another way:**

- **Kingston Mills' railway bridge and blockhouse, present day.** Every present-day photograph on Commons is
  CC BY-SA (2.0, 3.0 or 4.0), and an Openverse search across Flickr found none under an accepted licence. Only
  1898-1920 photographs are clean, and they cannot confirm present state. **Neither is drawn.**
- **Kingston Mills' locks, present day, beyond one frame.** The one CC0 frame is the same photograph Commons holds
  under CC BY-SA 2.0 from an earlier Flickr licence. Its author's own page marks it CC0 1.0 today; a licence
  cannot be withdrawn, so both grants stand, and the CC0 one is used with the author's page as the source.
  A reviewer who prefers not to rely on a relicensed frame can fall back to the two public-domain photographs,
  which carry the chamber and the gates but not the walkway, the steps or the houses.
- **Fort Henry's outer walls from the water.** Every such photograph is CC BY-SA; the fort is drawn from its
  parade instead (§6).
- **The Mackenzie Building in neutral daylight.** None found under an accepted licence; the geometry is from a
  night elevation and the roof colours from a colour-cast daylight photograph (§6).

---

## 9. Open questions this level did not answer

- **OQ-ART-04** — which red is the National Flag? Still dodged: this level draws no National Flag. The college's
  flag uses its own official red, `insignia-rmc-red` `#ed1c24`, not `flag-red`, and decides nothing about OQ-ART-04.
- **The official college flag needs the owner's approval, and its blind run is owed** (§6). It reproduces a
  prohibited mark exactly. "A Peruvian government building" is the new reading to watch.
- **The blind run is owed.** `make art-handoff` builds all five Kingston subjects into the hand-off with
  anonymisation held; none has a verdict. K-2.4 is the art-verifier's, by an agent that saw none of this work.
- **The Kingston Mills silhouette.** If a blind run fails `kingston-mills` on reading, the first thing to try is
  not a redraw of the lock but a feature this sheet could not source: the blockhouse, once a present-day
  photograph under an accepted licence exists.
- **`make assets` is red on this branch until K-2.2** (§0). That is the ordering, not a defect.

---

## Ground dressing (ADR-0042)

| key | source | authored px | world y | decoded |
|---|---|---|---|---|
| `kingston-ground-lakeshore-paving` | `ground-lakeshore-paving@1x.svg` | 1080 × 640 | 1280 … 1920 | 2.65 MiB |

The near side of the lakeshore path: pale limestone paving flags in running courses, smaller and busier in the
first 160 rows, which stay visible above the HUD with a prompt showing, and larger and calmer below; a kerb of
dressed stone and a mown grass strip at the foot. A repeating strip over the ground fill and under every
landmark, character and ride, at every visual tier, moving with the world. 1080 px wide, pinned to 1×, opaque in
every row, ending on the bottom of the world. Palette colours only, no outline, no lettering, no figures. Its
flags are `path-light` on a `path-base` bed, with an occasional `white-shade` flag, so the theme's `ground`
(`path-light`) meets it with no step.
