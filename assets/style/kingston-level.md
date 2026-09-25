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
| `kingston-prop-fort-henry` | `prop-fort-henry@1x.svg` | 760 × 290 | **stop 1**: Fort Henry's casemate range on the parade, with the rampart, its railing, chimneys and two guns |
| `kingston-prop-kingston-city-hall` | `prop-kingston-city-hall@1x.svg` | 800 × 560 | **stop 2**: Kingston City Hall's harbour front, portico and dome |
| `kingston-prop-kingston-mills` | `prop-kingston-mills@1x.svg` | 720 × 520 | **stop 3**: a Kingston Mills lock chamber and its timber gates, in summer |
| `kingston-prop-royal-military-college` | `prop-royal-military-college@1x.svg` | 800 × 540 | **stop 4**: the Mackenzie Building of the Royal Military College, on Point Frederick |

**No POI marker and no particle file.** Québec City's sheet records 0.55 MiB of markers and a snow particle that
are packed, charged and referenced by nothing. Kingston is summer with no weather, and the markers are not art a
level document can name, so neither is authored. There is no character source here: the giver is the existing
`guide` (Ruling 3) and the player is shared rig art.

**The props are all named `prop-`**, and none is `landmark-`. The four stops are equals in the ruling, and the
engine does not care.

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
| `fort-henry` | 1 540 | 1280 | `kingston-prop-fort-henry` | 760 × 290 | 990 |
| `kingston-city-hall` | 3 140 | 1280 | `kingston-prop-kingston-city-hall` | 800 × 560 | 720 |
| `kingston-mills` | 4 740 | 1280 | `kingston-prop-kingston-mills` | 720 × 520 | 760 |
| `royal-military-college` | 6 340 | 1280 | `kingston-prop-royal-military-college` | 800 × 540 | 740 |

  Every top is well clear of the 120 px system band. City Hall's clock is at world ≈ 871 and the college's at
  ≈ 876, both above the lower-third HUD at 1280.
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
rows it covers (§5).

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
| `kingston-prop-fort-henry` | **1×, pinned** | 760 × 290 | 0.84 MiB |
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
- **Measured** on the 2007 elevation, a near-orthographic long-lens night exposure: tower 0.139 of the building's
  width and 0.645 of it tall; pavilions 0.118 wide; façade cornice 0.257 of the width above ground. Drawn 0.137,
  0.655, 0.118 and 0.253.
- **Colour traps, both references.** The elevation is floodlit (the stone reads yellow, the mansards olive) and
  the daylight photograph carries a strong magenta cast. Neither was sampled for hue; the daylight one settles
  which roofs are dark (the tower's, `slate`) and which are green (the pavilions and wings, `glacier`, a muted
  grey-green, never Parliament Hill's bright `copper`).
- **Buildings only.** No cadet, no crest over the door or on the tower (the carving is left as plain stone), no
  flag on the tower, no memorial arch. The stop's card teaches the red-white-red flag pattern **in words**; the
  flag is not drawn.
- **Two-size test**: passes both. At 120 px it is a long block with a tall flat-topped central tower and a steep
  roof at each end.

**Shape counts**, reported per art-bible §1 and not a gate (ADR-0025): Fort Henry 337 drawing elements, City Hall 214,
Kingston Mills 232, the college 280.

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
- **No crest, badge or coat of arms** on the college or City Hall, and none at the fort.
- **No flag anywhere** (OQ-ART-04 is open): not on the fort's rampart, City Hall, the college's tower or the lock.
- **No lettering, sign, plaque, lock number or livery**, and no blank or faux-text board standing in for one.

---

## 8. References, and what could not be sourced under an allowed licence

Fourteen files in `assets/refs/kingston/`, all licence-checked on **2026-09-25** before download and re-read
after, all credited in `assets/credits.json` with `kind: "reference"`: one CC0, three public domain (Marsden Kemp,
Archives of Ontario), four CC BY 2.0 and six CC BY 3.0. `references.json` `licenceAudit.note` carries the record.

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

- **OQ-ART-04** — which red is the National Flag? Dodged again: this level draws no flag.
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
