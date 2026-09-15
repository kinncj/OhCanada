# The Prairies level art — layers, offsets, budgets and the decisions behind them

Level 7 — **Modern Canada**, locomotion **train**. Sources are `assets/src/svg/prairie-rail/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. This file is the level-specific sheet: what each texture is, where
it goes, what happens to it at each visual tier, and which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**. Late summer, harvest, clear.

---

## 0. The grain-elevator problem, and the answer taken

`docs/stories/TN-LEVELS-2-to-10-spine.md` states it plainly: the grain elevator "is the one prairie
silhouette a person recognises without being told, and it is a *type* rather than a named landmark — which
is a problem for this project's rules, not a licence." Its instruction is that the reference must be **one
specific surviving elevator**, recorded with its own credit, so the art is drawn from a thing that exists.

**That instruction is followed and it does not solve the identification problem, because of lettering.**
Every wooden prairie elevator carries its company's name and its town's name painted across the crib —
`PIONEER` and `CHAMBERLAIN` on the CC0 reference this one is drawn from, `SASKATCHEWAN` and `SINTALUTA` on
the second. `make verify-art` refuses any render source containing a `<text>` element, because a name drawn
into the picture defeats every byte-level leak check in the hand-off. So the elevator ships **blank**, and
what is left is the standard plan that stood in a thousand prairie towns.

**So `grain-elevator` is asked for a grain elevator and is never asked for a place.** `Saskatchewan`, `the
Prairies` and any town name are deliberately absent from its `expectedBlindAnswer`, and the note says the
gate must not reward them. This is `pier-21`'s rule, applied before the run rather than after it.

**And the consequence is different from Halifax's, because this level has no Town Clock to fall back on.**
Level 7 is a REGION, not a town. Nothing in its art is asked to name a place — not the hero and not
`prairie-rail-line`. That is a deliberate choice: a plains level's honest anchor is the type, and inventing a
named landmark for it would be inventing a landmark.

**Two candidates were considered and dropped.** The Inglis Grain Elevators National Historic Site is the
obvious named subject — five standard-plan elevators in a row, the last such row in Canada — and **every
photograph of it on Wikimedia Commons is CC BY-SA**, which ADR-0004 excludes for its ShareAlike condition.
Nanton, Alberta has three preserved elevators under CC0, and was dropped because Nanton sits at the edge of
the foothills and level 8 is *the Alberta foothills*: two levels drawing the same country is the one thing
the spine's table is arranged to avoid.

---

## 1. What was produced

Five SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/prairie-rail/` gets the key `prairie-rail-<filename>`:

| key | source | authored px | what it is |
|---|---|---|---|
| `prairie-rail-layer-10-sky` | `layer-10-sky.svg` | 1080 × 1000 | one flat `sky-light` field and six flat-bottomed cumulus |
| `prairie-rail-layer-20-horizon` | `layer-20-horizon.svg` | 1800 × 200 | a distant shelterbelt, two farmsteads, the first field bands, a haze wash |
| `prairie-rail-layer-30-fields` | `layer-30-fields.svg` | 1800 × 260 | a nearer shelterbelt in broken clumps, bales, four field bands and fourteen swaths |
| `prairie-rail-layer-40-railbed` | `layer-40-railbed.svg` | 1920 × 520 | the right of way — ballast, forty ties, two rails, a fence, four telegraph poles, a grade crossing |
| `prairie-rail-landmark-grain-elevator@1x` | `landmark-grain-elevator@1x.svg` | 900 × 1000 | **POI hero** |
| `prairie-rail-prop-grain-bins` | `prop-grain-bins@1x.svg` | 640 × 560 | **POI hero, added 2026-09-13**: four hopper-bottom bins on legs, on a gravel pad |
| `prairie-rail-prop-combine-harvester` | `prop-combine-harvester@1x.svg` | 800 × 480 | **POI hero, added 2026-09-13**: a combine with its header, reel and cutter bar, in standing grain |
| `prairie-rail-prop-container-car` | `prop-container-car@1x.svg` | 820 × 420 | **POI hero, added 2026-09-13**: a double-stack container car at rest on the rail |

**There is no character source here**, and **no POI-marker or particle source**, for the reasons Halifax
records.

---

## 2. The parallax stack

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | `prairie-rail-layer-10-sky` | 1080 × 1000 | 0 … 1000 | 0.03 / 0.015 | true | 1 080 000 | yes | **yes** |
| 20 | `prairie-rail-layer-20-horizon` | 1800 × 200 | 920 … 1120 | 0.10 / 0.04 | true | 216 000 | yes | no |
| 30 | `prairie-rail-layer-30-fields` | 1800 × 260 | 1010 … 1270 | 0.30 / 0.13 | true | 280 800 | yes | no |
| 40 | `prairie-rail-layer-40-railbed` | 1920 × 520 | 800 … 1320 | 1.00 / 1.00 | true | 518 400 | yes | **yes** |

At **`low` the player sees the sky and the right of way** — ballast, ties, rails, a fence, telegraph poles
and a crossbuck — plus the POI hero. That is a railway on a plain, which is the level.

**The scroll factors are the slowest in the game** — 0.03 for the sky and 0.10 for the horizon against
Halifax's 0.04 and 0.16 — because the prairie's whole visual argument is that the far things do not move.

### The sky is one flat field, and here it had to be

Halifax's reason applies and is harder here. At `low` this level keeps the sky and the railbed, and the
railbed is **transparent everywhere above the rail head**: there is no opaque layer anywhere inside the sky's
band to hide a band step behind. One flat `sky-light` field has no step, and it is exactly
`content/levels/prairie-rail.json`'s `theme.sky`.

**The clouds have flat bases**, which is the one drawing decision that makes this sky a prairie sky rather
than the other five. They are also the largest in the game.

### The opaque feet

The horizon tile is opaque from world 982; the fields tile from world 1120, where the horizon tile ends; the
railbed from world 1228, where the fields tile ends. The horizon tile also carries **one flat
`cloud-shade` wash at 0.30 over its whole foot** — distance rendered as a flat tone, never as a blur, because
Canvas has no filter pipeline (ADR-0011).

### Nothing identifying is on a repeating layer, and that includes elevators

All four layers repeat. **No grain elevator appears on any of them.** The two distant farmsteads on the
horizon tile are a gable barn and three steel bins each — types, and deliberately not elevators, because the
elevator is the level's only non-repeating anchor and an elevator on a repeating tile would move the level's
identity onto the layer the low preset drops. This is Toronto's rule about the CN Tower, applied to a
building type rather than to a building.

---

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way.** The railbed tile's local y 480 — the near rail head —
  *is* that line.
- **`size.x` 9600**, five full railbed tiles. Longer than any other level because the train's cruise speed is
  760 px/s: 9600 px is about 13 seconds of travel, which is Halifax's 7200 at 420 px/s.
- **`spawn`** `(480, 1280)`, on clear track.
- **`poi.grain-elevator.position.x` 4800**, `radiusPx` 300. The file is 900 × 1000, so it occupies world
  x 4350 … 5250 and world y 280 … 1280. The file's bottom edge is the ground line and its horizontal centre
  is `position.x`.
- **The tie and pole periods are exact divisors of the tile**: 40 ties on 48 px and 4 poles on 480 px into
  1920. Neither rhythm breaks at the seam, and that matters more here than on any other level, because the
  pole rhythm is what makes movement legible when the locomotion is `train` and the camera is doing all the
  work.
- **`camera`** is the only one in the game that is not Halifax's: `followLerp` 0.10 rather than 0.12 and
  `offset.x` 200 rather than 140, so the camera leads further ahead at nearly twice the speed.
- **`theme`**: `sky` `#a5d6ee` (`sky-light`), `ground` `#965630` (`felt-shade`), `horizon` `#fbfdfe`
  (`cloud-light`). The ground is dark straw, so the fill below the walking line continues the field.
- **`locomotion`** declares `train` first and `walk` second, which is Québec City's arrangement. `train` is
  `drive: "auto"` with `jump: null` and `interaction.requiresStop: true`; `walk` is Halifax's numbers
  unchanged, so the level stays completable if the train tuning proves too coarse for a POI.
  `turnAcceleration` 820 sits strictly between `deceleration` 700 and `acceleration` 900, which is
  `TN-LEVEL-03`'s band.

---

## 4. Every effect has a plain path (ADR-0011)

No `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or `url(#…)` in any of
the five sources.

| effect | plain form — what everyone sees |
|---|---|
| distance | one flat `cloud-shade` wash at 0.30 over the horizon tile's foot. A flat tone, not a blur. |
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every pole, bale and building, and 0.18 bands under the eaves and along the ballast foot. |
| ballast | scattered flat chips in two tones, never a texture fill. |
| swaths | fourteen flat parallelograms with their own shadow lines. |
| falling weather | **none. This level is late-summer harvest.** |
| player costume | `jacket`: the light jacket, T-shirt, jeans and high-tops (`player.md` §7), because this level is not winter and no weather falls on it. |

---

## 5. Budgets, measured

`npm run assets`, 2026-09-09, against the real level documents.

```
level-payload:  OK - prairie-rail 0.37 MiB of 8.00 MiB over 9 file(s) [1x 0.25 / 2x 0.37]
texture-memory: OK - prairie-rail 24.00 MiB of 36.00 MiB (67%) over 9 file(s)
                     [1x device 18.64 MiB / 2x device 24.00 MiB]
                     heaviest atlas/shared@2x 1214x2046 9.48 MiB = 26% of budget
```

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1214 × 2046 | **9.48 MiB** |
| `prairie-rail-layer-10-sky` | 1× | 1080 × 1000 | 4.12 MiB |
| `prairie-rail-layer-40-railbed` | 1× | 1920 × 520 | 3.81 MiB |
| `prairie-rail-landmark-grain-elevator` | **1×, source-pinned** | 900 × 1000 | 3.43 MiB |
| `prairie-rail-layer-30-fields` | 1× | 1800 × 260 | 1.79 MiB |
| `prairie-rail-layer-20-horizon` | 1× | 1800 × 200 | 1.37 MiB |
| **total at a 2× device** | | | **24.00 MiB** |

**`textureBudgetBytes` = 37 748 736 (36 MiB).** The measured 24.00 sits at **67 %**, the same band as every
other level. The level's own files are **14.52 MiB**; its honest worst case on ADR-0013's baseline model is
14.52 + 9.48 + ~8 = **32.0 of 64, 50 %**.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost **11.09 MiB**; authored 1920 tall at the
   same widths they would cost **48.7 MiB**.
2. **The landmark is cropped to its alpha bounds and pinned to 1×**: 3.43 MiB instead of 13.73.
3. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature is an 8 px glass insulator
   on a telegraph crossarm; the next smallest is a 9 px window head on the elevator's crib.

---

## 6. The landmark

### 6.1 What was measured, twice, and the two agree

| ratio | Chamberlain | Sintaluta | drawn (crib 280 wide) |
|---|---|---|---|
| crib height (to the apex) : crib width | 870 / 380 = **2.29** | 615 / 270 = **2.28** | 638 / 280 = **2.28** |
| gable rise ÷ crib width | 0.25 | 0.35 | **0.30**, the mean |
| cupola width ÷ crib width | — | 0.30 | 0.30 |
| cupola rise above the apex ÷ crib width | — | 0.44 | 0.44 |
| annex length ÷ crib width | 1.68 *(projected)* | — | **1.45** |

Two independent photographs of two different buildings give 2.29 and 2.28 for the ratio that carries the
silhouette. That is the strongest measurement in this project so far, and it is strong precisely because the
subject is a **standard plan**: the buildings are the same building.

**The gable rise is recorded as a MEAN and labelled as one.** 0.25 and 0.35 is a real spread and 0.30 is not
a measurement of anything; saying so is the correction ADR-0014 and `references.json`'s 2026-09-08 amendment
both ask for.

**Chamberlain's annex length is not used.** That photograph is taken close and from below and the annex
recedes hard away from the camera, so its apparent 1.68 crib widths is a projection. 1.45 is chosen inside
the range the other references bracket, and toward the long end, because a short annex makes the building
read as a tower.

**The gable end and the annex flank are both drawn frontal**, which no single camera position gives. It is
what `refs/prairie-rail/grain-elevator-govan-and-track.jpg` reads as from beside the line, and it is how an
elevator looks from a train. Recorded as a departure rather than left looking like accuracy.

### 6.2 Colour was measured, and it got its own ramp

`oxide`, base #91301c = hsl(11, 68 %, 34 %), authored as the **HSL midpoint of the two large measured faces**
on `refs/prairie-rail/grain-elevator-chamberlain.jpg`: the sunlit driveway annex, median of 300 × 120 px at
(120, 1080) = hsl(8, 73 %, 36 %), and the shaded crib gable, median of 320 × 560 px at (740, 620) =
hsl(13, 63 %, 32 %). Light and shade come from `palette.json`'s published formula.

It is **not** `brick`, whose base is hsl(17, 52 %, 44 %): eight degrees more orange, sixteen points less
saturated and ten points lighter. Under this palette's own three-tone rule that turns a painted timber
elevator into a masonry wall, and the sunlit face goes peach.

The ochre trim is `brass`, and it is the elevator's one piece of colour. **It is a livery, not a wordmark**:
drawing the colour a company painted its elevators is the same permission the officer's red serge has, and
drawing the name is not.

Straw did **not** get a ramp: the harvested field measures hsl(38, 63 %, 33 %) on
`refs/prairie-rail/prairie-harvest-and-shelterbelt.jpg`, which sits inside `felt`'s own span, and `felt`'s
material note now says so.

### 6.3 One thing was drawn twice

The first build put the crib at 300 px wide in a 780 px file with an annex 1.15 crib widths long. The
proportions were right and the picture was wrong: the crib filled the frame, the annex read as a porch, and
the apron was hidden behind both. The second build widened the file to 900, narrowed the crib to 280,
lengthened the annex to 1.45, and drew the ballast apron **in front of** everything at the foot so the
building stands in gravel. None of that is visible in the ratios.

**Simplified away:** the board-and-batten boarding, the man-lift, ladders, catwalks and guy wires, the
external cyclone and dust pipe unique to the Chamberlain building, the sash bars, the steel bins and
driveway scale that stand beside most surviving elevators, and **the company name, the town name and the
star device** — the two most identifying things on the real building.

**Never added:** any lettering or number, in either language; **an invented company name or device in place
of the real one** (`art-bible.md`'s *drop, never substitute* — an approximated livery mark is worse than
none); a concrete terminal or a row of steel bins as the main mass; a barn; mountains on the horizon.

### 6.4 The two-size test, and the 1× pin

Run at the shipping size of 900 × 1000. At 250 px the crib, the cupola, the annex and the spout are all still
separable and the trim still reads as trim. As a 120 px black silhouette it is a tall gabled box with a
smaller box on its ridge and a long low shed running off one side: not confusable with anything else in this
game. Both probes pass. The measured saving is 13.73 MiB → 3.43 MiB.

---

## 7. The crossbuck, and why it is there

The railbed tile first carried a **searchlight signal**: a mast, a hood and a green lens. Rendered at 390 px
it read as a traffic light, which put a road in the middle of a railway.

It was replaced by a **grade crossing** — a gravel section road, a red-edged white crossbuck and a two-lens
flashing-light mast — and that is the better object for a reason worth writing down: **a crossbuck is a
shape, and it is the one thing in this level that says RAILWAY without a word on it.** A project that draws
no lettering anywhere needs objects whose meaning is carried by their outline. A real Canadian crossbuck
carries words across both boards; this one carries none, which is a deliberate omission and is recorded here
so it is not read as an oversight.

One crossing per 1920 px tile is about one every two screens, which is what a prairie section-road grid
actually gives a railway.

---

## 8. What this level does NOT assert

**No Indigenous content of any kind is drawn in this level**, and no depiction of either nation the level's
territory statement names. `content/levels/prairie-rail.json` states a territorial FACT about Treaty No. 4,
cited to the Indigenous Saskatchewan Encyclopedia and with the two nations' names sourced to the File Hills
Qu'Appelle Tribal Council's own list of its member First Nations. That is a citation, not a depiction.

**The source is a university encyclopedia and not a nation's own account**, and that is a weakness recorded
in `content/sources/usask-indigenous-sk-treaty-4.json` rather than hidden: the Parks Canada prairie sites
carry no territorial statement, `treaty4.ca` did not resolve on 9 September 2026, and the Crown's own Treaty
No. 4 text is 1874 correspondence whose language may not reach a player. A content verifier should replace it
if a Treaty Four institution's own account becomes reachable.


---

## 12. Four points of interest on the longest level in the game

**Added 2026-09-13.** At 9 600 px this is the longest level TrueNorth has, and it shipped with one POI at
4 800 — the exact centre. It now has four. `size`, the ground line, the four layers, the theme, both
locomotion modes, the spawn and the guide are unchanged, and the elevator keeps its `questId`.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 2 400 | `grain-bins` | `prairie-rail-prop-grain-bins`, 640 × 560 | Saskatchewan has 40 % of Canada's farmland and grows the most grain and oilseed | *Discover Canada* p. 100 |
| 4 800 | `grain-elevator` | `prairie-rail-landmark-grain-elevator`, 900 × 1000 | the post-war economy and one of the world's highest standards of living | *Discover Canada* p. 45 |
| 6 500 | `combine-harvester` | `prairie-rail-prop-combine-harvester`, 800 × 480 | Manitoba, Saskatchewan and Alberta are the Prairie Provinces, with some of the most fertile farmland in the world | *Discover Canada* p. 100 |
| 8 200 | `container-car` | `prairie-rail-prop-container-car`, 820 × 420 | Canada has always been a trading nation and commerce is still the engine of growth | *Discover Canada* p. 90 |

**Gaps of 2 400, 1 700 and 1 700 px**, inside the 1 500–2 500 band, with 1 400 px of run-out past the last
point. The level is set in southern Saskatchewan — its own territory statement says so — which is why the
first POI takes the Saskatchewan fact rather than a general prairie one.

**The three facts are a chain and were chosen as one**: the grain is grown (bins), the grain is cut
(combine), the goods go to market (container car). The elevator in the middle keeps the chapter fact the
level is named for.

**One of the three was re-sourced after it was written, and the reason is a rule worth restating.** The
combine first carried the natural-resources sentence from *Discover Canada* p. 91 — and
`alberta-foothills`'s `ranch-barn` already carries **that exact quote**. CLAUDE.md's content rules say two
subjects may share a chapter but never a **proposition, identified by `source.quote`**, and a POI blurb is
governed by ADR-0003 exactly as a question is. The combine now carries the Prairie Provinces sentence from
p. 100 instead, which is a better fit anyway: it names the three provinces, which is a thing the test asks.
Checked mechanically across all ten level documents afterwards: **26 POI propositions, no two the same.**

**`grain-bins` took four builds and the first three are worth more than the fourth.** Builds one to three
drew the bins sitting on the ground with a cone on top, and every one of them read as *a row of gabled
houses* — first with trapezoid roofs, then with steeper cones, then with a reflected-light rim at each
cylinder's far edge, which is the textbook trick for making a cylinder read. None of it worked, because the
shading was never the problem: **a triangle on a rectangle standing on the ground is a house, and no amount
of tone will argue with the silhouette.** Build four put the bins on legs over hopper funnels, with daylight
underneath, which is what the reference shows and what no building has. The read changed instantly.
`references.json` carries that as the subject's first `mustBeRight` entry and as a named failure mode, because
the same mistake is available on every cylindrical subject this game will ever draw.

**Why a container and not a grain hopper**, which is the obvious prairie choice: the level already teaches
grain at two other points, and Canada's government grain hoppers carry a livery and a maple-leaf device this
project does not draw while `OQ-ART-04` is open. A plain container teaches *trade* and asserts nothing about
whose box it is. It carries **no reporting mark, number, livery or wordmark**, and its two colours are
palette ramps.

**The combine is a type, not a make.** The reference shows red machines; red is drawn, from the `oxide` ramp
this game already uses for Peggy's Cove's fish stores and Ottawa's warming hut, and no badge, stripe, decal
or model number goes on it. `neverAdd` refuses a green body by name, and that is a licence-shaped rule rather
than a stylistic one: green is the other maker's colour and drawing it would assert a brand this render has
no reference for.

**One collision, looked at and left alone.** `layer-40-railbed.svg` carries a grade crossing — a crossbuck
and a flashing-light mast — at tile-local x ≈ 1 158, and at 6 500 that lands about 420 px to the right of the
combine, inside the same frame. The two do not overlap and the crossing is a background object behind a
foreground machine, so it was not worth moving the POI into a 1 400 px gap to avoid it. Recorded because the
arithmetic is not obvious: the tile repeats every 1 920 px, so the crossing is out of frame only for POIs at
tile-local 0–458 or 1 858–1 920.

**Budgets, re-measured 2026-09-13:** `prairie-rail 30.61 MiB of 36.00 MiB (85 %, 5 652 356 B spare)` over 12
files, payload 0.46 MiB of 8. The three new heroes cost **4.15 MiB between them** — bins 1.37, combine 1.46,
car 1.31 — and all three are `@1x`-pinned and standalone; at 2× they would have been 16.6 MiB and this level
would be 10 MiB over its declared budget.

**Scenery: none added.** `layer-40-railbed.svg` already carries forty ties, two rails, a fence, four telegraph
poles and the grade crossing; `layer-30-fields.svg` carries a shelterbelt, bales, four field bands and
fourteen swaths. The corridor was never short of things to look at.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'grain-bins': singleSource(),
  'combine-harvester': singleSource(),
  'container-car': singleSource(),
```

---

## 13. The train the player rides

**Added 2026-09-14, after a player reported that the character "walks by itself on a track".** The level
declared `train`, the HUD said Train, and the only thing on the rails was a person walking. `rig-contract.md`
§11.5 had already shown the car could not be rig equipment; ADR-0031 made it a **ride**: level art the engine
places at the player every frame, registered to the rider.

| key | source | px | what it is |
|---|---|---|---|
| `prairie-rail-ride-park-car` | `ride-park-car@1x.svg` | 1 420 × 590 | the rear of VIA Rail's *Canadian*: a Budd Park car's observation end, dome and flank, and the coupled end of the car ahead |
| `prairie-rail-ride-park-car-track` | `ride-park-car-track@1x.svg` | 480 × 56 | the main line under it: a rail head, ten tie ends on a 48 px period, a ballast shoulder |

### 13.1 Placement, and why the car is not on the walking line

`rides[0]` in `content/levels/prairie-rail.json`: `riderAnchor` (380, 422), `groundLineY` 330,
`turnsWithRider` false, `bob` 2 px every 180 px, `track.topY` 582. In world terms the car's roof is at y 1 196,
its dome glass runs up to about 1 004, and its rails are at 1 536 — **256 px below the walking line**, across the
ground fill.

That was a measurement, not a taste. The first version stood the car on the walking line; rendered at 390 px,
a car tall enough to seat a rider in its dome is taller than the container car (whose containers sit 128 to
308 px above that line) and the guide, and whichever was in front hid the other at the moment the train
stopped to engage it. On the nearer line every landmark and the guide stand beyond the train with only their
bottom 84 px behind its roof: the bins keep their cones and the daylight at the top of their legs, the combine
its header, reel and cab, the container car both boxes. The renders of all four stops were looked at before
this shipped.

**So the level now shows two tracks, and the railbed tile's is the siding.** The train runs on the main line in
the foreground; the tile's rails behind it are where the container car stands and the elevator spouts, which is
what a siding at a prairie elevator is. `references.json`'s `prairie-rail-line` note is amended to match.

### 13.2 Why the rear of the train, and why the dome

The Park car is **the car at the tail of the *Canadian*** and the one the references show, so the rider sits in
the last car and the rounded observation end is on screen whenever the train is at rest or cruising — the
single most recognisable shape the train has. The dome is where a passenger is visible from outside at phone
size: a head and shoulders against the sky, through clear glass, above a car body that says train by itself.
A passenger at a side window reads as a dark square with a dot in it.

The rider is drawn **behind** the car's file, so the car is the ride's `front` layer and its dome glass is a
16 % tint, not a colour. The dome's mullions are placed to miss the seat, so no bar ever crosses the rider's
face.

### 13.3 What was simplified, and what is never drawn

**Simplified away:** the car's full length (a Park car is about six times as long as it is tall; this one is
compressed so the observation end, the dome and the car ahead share one screen), the fluting reduced to five
lines, the dome's curved upper panes merged into one glass band, the vestibule steps, the underframe equipment
and the brake rigging.

**Never drawn:** the *Canada* wordmark, the VIA logo, the car's name, its number, or lettering of any kind;
any flag decal; a second dome or a locomotive, neither of which is on the rear of this train.

### 13.4 Budgets, measured

`make assets`, 2026-09-14:

```
level-payload:  prairie-rail 0.43 MiB of 8.00 MiB over 14 file(s)
texture-memory: prairie-rail 33.05 MiB of 40.00 MiB (83 %) over 14 file(s)
```

Before the ride it was **29.75 MiB of 36 (83 %)** and 0.41 MiB of payload. The car costs 3.20 MiB decoded at
1x and the track 0.10 MiB; both are `@1x`-pinned, and must be, because `riderAnchor` and `groundLineY` are art
pixels that equal design pixels only at 1x. **`textureBudgetBytes` went from 36 MiB to 40 MiB**, Québec City's
figure: the build gate would have passed at 92 %, and ADR-0031 records why a halved margin was not left for the
perf lane to discover.

### The builder patch for the car

```js
  'park-car': singleSource(),
```

---

## Ground dressing (ADR-0042)

| key | source | authored px | world y | decoded |
|---|---|---|---|---|
| `prairie-rail-ground-railway-shoulder` | `ground-railway-shoulder@1x.svg` | 1080 × 640 | 1280 … 1920 | 2.65 MiB |

The right of way nearest the viewer: the siding's ballast shoulder in grey and rust chips, a ditch of prairie grass with dry `felt-light` seed heads, the main line's ballast bed under the ride's track strip (which draws over it at world 1532), a post-and-wire fence, and a harvested field of broken stubble rows.

A repeating strip over the ground fill and under every landmark, character and ride, at every visual tier, moving exactly with the world. 1080 px wide (one tile per screen), pinned to 1x, opaque in every row, and ending on the bottom of the world, so the scene paints no ground fill under it. Palette colours only, no outline, no lettering, no figures. Its most legible detail is in its first ~160 rows, which stay visible above the HUD with a prompt showing.
