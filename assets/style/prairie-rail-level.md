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
