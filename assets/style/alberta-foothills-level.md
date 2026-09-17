# The Alberta foothills level art — layers, offsets, budgets and the decisions behind them

Level 8 — **Canada's Economy**, locomotion **horse**. Sources are `assets/src/svg/alberta-foothills/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. Design resolution 1080 × 1920, portrait, ground polyline at
**y = 1280**. Late summer, clear, early afternoon.

---

## 0. The anchor problem, and the answer taken

`docs/stories/TN-LEVELS-2-to-10-spine.md` calls this "the weakest blind-identification row in the table" and
offers two ways out: a specific, cited, named ranch, or moving the anchor to the Rockies and accepting "the
Canadian Rockies" as the blind answer. **Both were taken, and then one of them was withdrawn on measurement
of what the picture can honestly carry.**

- The POI hero is the **Bar U Ranch National Historic Site** at Longview, Alberta — one specific, cited,
  existing set of buildings, drawn from eight CC BY 2.0 photographs. Its blind contract asks for a **ranch**
  and is never asked for Alberta.
- The **Rocky Mountain front is drawn**, on layer 20, and is **deliberately not a graded subject**. It sits
  on a tile that repeats every 1800 px and that the `low` preset drops, and a saw-tooth range that runs from
  New Mexico to the Yukon identifies a landform, not a province. Putting "the Rockies" in an
  `expectedBlindAnswer` would have rewarded a memory of the level rather than a reading of the picture.

**So the consequence is the Prairies' consequence, and it is stated rather than left to be discovered: the
Alberta foothills as a PLACE rest on nothing in this level's art.** That is the honest output of the rules,
and level 7 has just been through the same argument.

**Head-Smashed-In Buffalo Jump was never a candidate.** It is on Niitsitapi territory and it is a
`docs/content-review.md` §1 depiction question, not an art question.

**Licence first, and it cost the best files.** Every dedicated barn elevation of the Bar U on Wikimedia
Commons — *saddle horse barn east side*, *west side*, *work horse barn* — is **CC BY-SA 4.0**, and the two
site panoramas are CC BY-SA 3.0, both of which ADR-0004 excludes. The whole measurement therefore leans on a
flank view taken in evening light, which is why §6.1's plan width is a **derivation and not a measurement**.

---

## 1. What was produced

| key | source | authored px | what it is |
|---|---|---|---|
| `alberta-foothills-layer-10-sky` | `layer-10-sky.svg` | 1080 × 960 | one flat `sky-shade` field and six cumulus |
| `alberta-foothills-layer-20-front-range` | `layer-20-front-range.svg` | 1800 × 270 | three overlapping ranges, snow in the high notches |
| `alberta-foothills-layer-30-foothills` | `layer-30-foothills.svg` | 1800 × 200 | three rolling grass ridges, aspen and spruce bluffs, coulees |
| `alberta-foothills-layer-40-rangeland` | `layer-40-rangeland.svg` | 1920 × 410 | pasture plane, wire fence, three cattle, a two-track road |
| `alberta-foothills-landmark-ranch-barn@1x` | `landmark-ranch-barn@1x.svg` | 880 × 636 | **POI hero.** The horse was redrawn 2026-09-17: see §6.3 |
| `alberta-foothills-prop-log-rail-gate` | `prop-log-rail-gate@1x.svg` | 680 × 460 | **POI hero, added 2026-09-13**: four log rails on squared posts, stopping at a braced timber gate |
| `alberta-foothills-prop-beef-cattle` | `prop-beef-cattle@1x.svg` | 720 × 420 | **POI hero, added 2026-09-13**: three red-bodied white-faced cattle on dry pasture |

No character source, no POI-marker source, no particle source, for the reasons Halifax records.

## 2. The parallax stack

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | sky | 1080 × 960 | 0 … 960 | 0.04 / 0.02 | true | 1 036 800 | yes | **yes** |
| 20 | front-range | 1800 × 270 | 740 … 1010 | 0.09 / 0.035 | true | 291 600 | yes | no |
| 30 | foothills | 1800 × 200 | 940 … 1140 | 0.24 / 0.10 | true | 216 000 | yes | no |
| 40 | rangeland | 1920 × 410 | 880 … 1290 | 1.00 / 1.00 | true | 432 000 | yes | **yes** |

At **`low` the player sees the sky and the rangeland** — the pasture plane, the two-track, tussocks, cattle
and the fence rhythm — plus the POI hero. That is ranch country under a big sky, which is the level.

### The opaque feet, closed on purpose

The front-range tile is opaque from **world 900**; the foothills tile's rolling ridge line runs between
world 940 and 1010 and it is opaque below **1010**, which is inside the front-range tile's opaque band; the
rangeland is opaque from **world 1130**. No band shows the theme gradient at any tier.

### The sky is one flat field, and here it had to be

At `low` this level keeps the sky and the rangeland, and the rangeland is transparent everywhere above its
own grass horizon at world 1130 — the fence posts and wire stand *up* into it. There is nowhere to hide a
band step. One flat `sky-shade` field has none, and it is exactly `theme.sky`.

### Nothing identifying is on a repeating layer, and that includes the mountains

All four repeat. No building of any kind is drawn on any of them. The cattle, the fence, the two-track and
the tree bluffs are types. The mountain front is a landform and is scoped as one (§0).

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way.** Every band above sits at a fixed world y.
- **`size.x` 8640**, four and a half rangeland tiles: about 14 seconds at the horse's 620 px/s, against
  Halifax's 7200 at 420.
- **`spawn`** `(440, 1280)`.
- **`poi.ranch-barn.position.x` 4320**, `radiusPx` 300. The file is 880 × 636, so it occupies world
  x 3880 … 4760 and world y 644 … 1280.
- **`camera`** `followLerp` 0.11 and `offset.x` 180, between Halifax's 0.12/140 at 420 px/s and the
  prairie train's 0.10/200 at 760.
- **`theme`**: `sky` `#1f5fa8` (`sky-shade`), `ground` `#30451c` (`pasture-shade`), `horizon` `#b9cfe2`
  (`cloud-shade`). Derivations in `palette.json` `levelTheme.alberta-foothills-late-summer`.
- **`locomotion`** declares `horse` first and `walk` second, which is Québec City's arrangement.
  `turnAcceleration` 1250 sits strictly between `deceleration` 1000 and `acceleration` 1400.

## 4. Every effect has a plain path (ADR-0011)

No `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or `url(#…)` anywhere.
Distance is a flat tone per range and never a blur. AO is flat `ao-shadow` at 0.28 under every ground
contact and 0.18 at structural overlaps. **No falling weather: this level is late summer.** **Player costume: `jacket`**: the light jacket, T-shirt, jeans and high-tops (`player.md` §7), because this level is not winter and no weather falls on it.

## 5. Budgets, measured

```
level-payload:  OK - alberta-foothills 0.39 MiB of 8.00 MiB over 9 file(s) [1x 0.27 / 2x 0.39]
texture-memory: OK - alberta-foothills 21.80 MiB of 36.00 MiB (61%) over 9 file(s)
                     [1x device 16.44 MiB / 2x device 21.80 MiB]
                     heaviest atlas/shared@2x 1214x2046 9.48 MiB = 26% of budget
```

**61 % is the loosest band of the eight levels** (Halifax 72, Winnipeg/Toronto/Québec 69, the Prairies 67,
Ottawa 68, Vancouver 65) and it is deliberate: this level has an NPC and a second POI still to come.
The level's own files are **12.32 MiB**; its honest worst case on ADR-0013's baseline is
12.32 + 9.48 + ~8 = **29.8 of 64, 47 %**.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost **9.11 MiB**; authored 1920 tall at the
   same widths they would cost **48.7 MiB**.
2. **The hero is pinned to 1× and was scaled down after a render.** See §6.3.
3. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature is a 12 px louvre bar on
   the cupola.

## 6. The landmark

### 6.1 What was measured, and the one thing that was not

Measured on `refs/alberta-foothills/work-horse-barn-elevation.jpg` at the barn's **left gable end**, where
the eave line is horizontal across 785 px (slope +0.010) — which is what proves the camera sits at eave
height and makes the vertical readings there free of foreshortening. The denominator is **W, the eave height
above the foundation**: ridge 528, eave 692, foundation 915, so W = 223 px.

| ratio | measured | drawn (W = 300) |
|---|---|---|
| gable rise ÷ W | 164/223 = **0.735** | 220/300 = 0.733 |
| window height ÷ W | 52/223 = **0.233** | 70/300 = 0.233 |
| sill above the foot ÷ W | 70/223 = **0.31** | 93/300 = 0.31 |
| window rhythm, width : gap | 47 : 63 = **1 : 1.34** | 58 : 26 |
| **plan width ÷ W** | *not measurable* | **1.47, DERIVED** |

**The plan width is a derivation and is labelled as one.** No reference in the licence-clean set gives a
gable end free of foreshortening — the two that show the end wall show it at 15–25° off, and the two clean
flank views show the end edge-on. 1.47 W is what a **12:12 pitch** gives for the measured rise, and the
number is written here as a derivation rather than left looking like accuracy. This is the same discipline
`references.json` demanded after the Peace Tower's spire and the Château's brackets.

**The flank is drawn at 1.45 W against a measured 3.6 W**, and that is a departure, recorded: at 3.6 the
barn is 2 700 px wide. The gable end — the shape that carries *barn* — keeps every ratio exactly.

### 6.2 Colour was measured, and it did NOT get a ramp

`oxide`, base #91301c, is reused. Six medians across three references give hsl(5, 51 %, 21 %); all three
photographs are evening or overcast, so corrected for the light the material lands near hsl(6, 60 %, 34 %),
which is five degrees of hue and eight points of saturation from `oxide-base` at the same lightness. **Barn
red and elevator red are the same red-oxide paint on the same painted timber**, and a second ramp would have
been this palette's first duplicate. `palette.json`'s `oxide` note now carries the measurement.

The roof did not get one either: hsl(20,5 %,50 %), hsl(26,3 %,44 %) and hsl(0,1 %,50 %) against `path-base`'s
hsl(31,7 %,51 %).

**One ramp WAS added, and it is the level's ground.** `pasture`, base #677b37 = hsl(78, 38 %, 35 %), from
three medians on two references (hsl 75/35/38, 83/18/36, 79/40/29). It exists because **all three fall
outside `grass`'s own hue span of 94–114 degrees**, by 11 to 19 degrees to the yellow side — the same test
that kept prairie straw inside `felt` and the museum's glazing inside `ice`, run in the other direction.
`grass` is the mown lawn on Parliament Hill; this is dry native bunchgrass, and one ramp for both would make
the Alberta foothills the same material as an Ottawa lawn.

### 6.3 What was drawn twice, and once more

1. **Build one** put the flank in `oxide-light` and the gable end in `oxide-base`, which is the key light
   backwards: rendered, the barn was orange on one half and red on the other and read as two buildings.
   Lit face `oxide-base`, shaded flank `oxide-shade`, and `oxide-light` reserved for edges.
2. **Build two** drew the horse at 300 px tall with a long vertical neck. At full size it read as a llama.
   It is now **118 px at the withers**, which is the barn's own scale: the eave is 300 px for about 4.2 m,
   so 1 m is 71 px and a 1.65 m Percheron is 117.
3. **Build three** was a *file* change and it is the one worth carrying. The hero was 1080 × 780 — the full
   design width — and composited against the real layers it **hid the mountains, the foothills, the fence
   and the cattle completely**, and put identifying features on the screen edge, which `art-bible.md` §6
   forbids. It is now **880 × 636**, uniformly scaled, leaving 100 px of level each side. None of that was
   visible in the SVG and all of it was obvious in one composite.

4. **Build four redrew the horse, 2026-09-17, and the barn was never the problem.** A blind pass scored
   **8 of 8 features present** and still failed the subject, because it read *"a red farm barn with a white
   horse"* — farm, not ranch — and said exactly why: the horse *"is built from stiff angular facets, the head
   and muzzle are a hard wedge, the legs are rigid posts, and it appears to stand on or through the fence rail
   rather than behind it."* The corral and the horse are what make this subject a ranch rather than a farm, so
   an unreadable horse costs the whole identification even with every feature ticked. Three changes. It is
   built from **rounded masses** now — an elliptical barrel, a tapering neck, a skull-and-muzzle head with
   ears, a mane and a hanging tail — instead of flat facets. It is **grey**, from the `path` ramp, which is
   what `references.json` asked for; it was drawn from the `white` ramp and read as a white horse. And its
   **ground contact moved from y 712 to y 745**, onto the yard apron, so the three corral rails cross in front
   of it: it was standing in the gap between the middle and bottom rails, which is what "on or through the
   rail" was seeing. Its withers stay at **118 px**, the barn's own scale, per 6.3 item 2.

### 6.4 The two-size test, and the 1× pin

At 25 % (220 × 159) the gable, the cupola, the corral, the horse and the window rhythm are all still
separable. As a 120 px black silhouette it is a gabled box with a smaller box on its ridge and a rail fence
across its foot: not confusable with the elevator's tall crib, the Peace Tower's shaft or the museum's
stepped mass. Both probes pass.

## 7. What this level does NOT assert

**No Indigenous content of any kind is drawn in this level**, and no depiction of any of the seven nations
the territory statement names. `content/levels/alberta-foothills.json` states a territorial FACT quoted from
the Crown's own transcription of Treaty No. 7; that is a citation, not a depiction, and §1 is not engaged.

**And this level closes the gap Winnipeg opened, in one direction and not the other.** `level.schema.json`
gives a level exactly one `nationSource`, and Treaty 1's statement named seven nations against a source that
covered seven of them only partly. Here the single `nationSource` — the **Treaty 7 First Nations Chiefs'
Association**'s own About page — names **all seven** of the nations the statement names, in its own words.
That is the first level whose nation names are fully covered by one source.

**What is still open is the other half.** The `fact.source` is the Crown's treaty text, not a nation's own
account, and its articles name the parties with nineteenth-century exonyms which appear nowhere in this
game. And the statement is silent about the Métis Nation of Alberta, in whose Region 3 the Bar U sits,
because a level carries one `fact.source` and one `nationSource` and neither cited body speaks for them.
Both are recorded in `content/sources/cirnac-treaty-7.json`'s `knownStaleness` rather than papered over.


---

## 12. Three points of interest, and the animal that had to be measured

**Added 2026-09-13.** The level shipped with one POI at 4 320 on an 8 640 px ride. It now has three.
`size`, the ground line, the four layers, the theme, both locomotion modes, the spawn and the guide are
unchanged, and the barn keeps its `questId`.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 2 500 | `ranch-gate` | `alberta-foothills-prop-log-rail-gate`, 680 × 460 | Alberta and Lake Louise are both named after Princess Louise Caroline Alberta, a daughter of Queen Victoria | *Discover Canada* p. 101 |
| 4 320 | `ranch-barn` | `alberta-foothills-landmark-ranch-barn`, 880 × 636 | ranching is part of agriculture, one of Canada's natural-resource industries | *Discover Canada* p. 91 |
| 6 800 | `beef-cattle` | `alberta-foothills-prop-beef-cattle`, 720 × 420 | Alberta's cattle ranches make Canada one of the world's major beef producers | *Discover Canada* p. 101 |

**Gaps of 1 820 and 2 300 px**, inside the 1 500–2 500 band, with the guide at 1 200 before the first. The
last point sits 1 840 px from the end of the level rather than 2 040: on a level this long the run-out after
the last thing to stop at is the part that feels like a corridor, and the two positions were moved 100 and
200 px to shorten it without pushing either gap out of the band.

**The cattle are the first animal this project has drawn since the one that was read as a llama, and the
subject is written as a set of guards rather than a description.** The way a cartoon quadruped goes wrong is
always the same — the neck lengthens, the head rises, the body shallows, the legs lengthen — so
`references.json` carries a measured number against each: **body depth : clear leg is 1.4 : 1**, measured on
the nearest animals in `rangeland-cattle-and-wire-fence.jpg`; the neck is a fifth of the body length and runs
*forward*; the top of the head sits no higher than the withers; the back is level with the hip as its highest
point. `expectedBlindAnswer` makes *"a llama"*, *"an alpaca"*, *"a horse"*, *"a deer"* and *"a goat"* explicit
failures rather than near misses.

**Their colour comes from the tile, not from the photograph, and that is the one deliberate departure from a
reference on this level.** `layer-40-rangeland.svg` already draws three small red-bodied **white-faced**
cattle; the reference photograph shows **solid red** ones. Both patterns are common on this range, and a hero
standing 60 px in front of three white-faced animals in a different pattern would read as a different species
rather than as the near view of the same herd. Written into the subject so a verifier comparing the hero with
the photograph does not report it as an error.

**Two drawings that were wrong first, both fixed by structure rather than by tone.** The gate's first build
ran the fence rails straight across the opening, so there was no gap to read and the leaf looked like
decoration on a continuous fence; the rails now stop at the gate posts. The cattle's first build gave each
animal two nostril dots on the muzzle, and at 390 px they read as a **second pair of eyes**. Both are in
`simplifyAway` now.

**What was refused, and it is the biggest single reference gap in this level — RESOLVED 2026-09-13 when the
references landed; see §13.** **An oil pump jack.**
*Discover Canada* p. 101 says Alberta is the largest producer of oil and gas, and p. 90 illustrates the
economy chapter with *"Oil pump jacks in southern Alberta"* — it is the province's defining economic fact and
the test asks it. **There is no licence-clean photograph of a pump jack anywhere in this repository**, so
drawing one would be invention, and this level is one bad silhouette away from the llama again. One CC0 or
CC BY photograph of a nodding-donkey pump jack in a field unlocks a fourth POI here with the best fact on the
page. Recorded as a reference request rather than as a gap in the level.

**Budgets, re-measured 2026-09-13:** `alberta-foothills 26.61 MiB of 36.00 MiB (74 %, 9 845 636 B spare)` over
11 files, payload 0.44 MiB of 8. The two new heroes cost **2.34 MiB between them** and both are `@1x`-pinned.
This level has the most headroom of any of the ten and would carry the pump jack comfortably.

**Scenery: none added.** `layer-40-rangeland.svg` already carries a wire fence, three cattle, sage and a
two-track road; `layer-30-foothills.svg` carries aspen and spruce bluffs and coulees.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'log-rail-gate': singleSource(),
  'beef-cattle': singleSource(),
```

---

## 13. The fourth point of interest: the pump jack, and the herd that had to move

**Added 2026-09-13**, on the four references committed in `db04cf2`.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 2 500 | `ranch-gate` | unchanged | Alberta and Lake Louise are named after Princess Louise Caroline Alberta | p. 101 |
| 4 320 | `ranch-barn` | unchanged | ranching is agriculture, a natural-resource industry | p. 91 |
| **6 000** | **`pump-jack`** | `alberta-foothills-prop-pump-jack`, 660 × 510 | **Alberta produces more oil and gas than anywhere else in Canada** | p. 101 |
| **7 600** | `beef-cattle` | unchanged, **moved from 6 800** | Alberta's ranches make Canada a major beef producer | p. 101 |

**There was no slot, so the herd moved, and that costs one re-verification.** After the herd, 6 800 + 1 500 =
8 300 is past the last legal x (8 100 − 280 − 100 = 7 720), and neither existing gap (1 820, 2 480) can be
split into two of 1 500. Moving `beef-cattle` to 7 600 and putting the pump jack at 6 000 gives gaps of 1 820,
1 680 and 1 600, and an arrival of 7 600 + 280 + 100 = 7 980 inside 8 100. **`scripts/verify-content.mjs`
binds a point's `position` into its claim unit, so the herd's verified grant is void** although its words did
not change. That was the cheapest of the arrangements: moving the gate or the barn instead voids more. The
quest's order — gate, barn, herd — is unchanged, and the herd is still the far end of the ride. The pump jack
is not a quest stop.

**Duplicate check.** The Prairie quest's 1947 line (p. 45) is the discovery of oil, a different proposition.
`ranch-barn` names energy as a natural-resource industry and says nothing about Alberta. `eco-30` asks this
fact with the same quote, which is the same subject and is how a card prepares a question. The blurb takes
only the first clause of the sentence: the oil sands clause is `eco-45`, and "are being developed" is present
tense in a 2012 guide.

**The one real departure, stated.** `pump-jack-foothills-county.jpg`, the Alberta photograph in true colour, is
a **rear-fulcrum unit** — its Samson post stands at the beam's rear end and its cranks sit under the horsehead.
The other three references are conventional units. The geometry drawn is the conventional one, measured on
the other Alberta photograph (`pump-jack-dusk-in-snow.jpg`, geometry only) against S = the saddle's height:
horsehead 0.62 S, front arm 0.70 S (drawn 0.74), rear arm 0.53 S, pitman 0.49 S (drawn 0.52). The Foothills
County unit supplies the paint: pale grey steel, a red horsehead, red counterweights, a red ladder and a black
reducer. The red is `serge`, the nearest ramp by hue. Averaging the two geometries would draw a machine nobody
built.

**Two drawings wrong first.** The horsehead tapered to two points and read as a leaf at 390 px; it is now a
block with a flat back. The counterweight was a rotated capsule; it is now a sector plate on the crank arm.

**Budgets, re-measured 2026-09-13:** texture memory **27.89 MiB of 36.00 (77 %, 8 499 236 B spare)** over 12
files, against 26.61 MiB (74 %) over 11 before; payload **0.46 MiB** of 8, against 0.43. The pump jack costs
1.28 MiB and is `@1x`-pinned.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'pump-jack': singleSource(),
```

---

## 14. The horse the player rides

**Added 2026-09-14, after a play-through audit found that Alberta had no horse.** The HUD said Horse, the task said
to ride up to the ranch gate, and the player walked the whole level on foot while the console printed that the rig
could not draw the mode. `rig-contract.md` §11.5 had recommended the answer and ADR-0031 had since built it for the
Prairies train: the horse is a **ride**, level art the engine places at the player every frame.

| key | source | px | what it is |
|---|---|---|---|
| `alberta-foothills-ride-ranch-horse` | `ride-ranch-horse@1x.svg` | 600 × 446 | a saddled bay quarter-horse type under a tan western saddle, walking; the ride's one layer, `behind` the rider. Since ADR-0035 walk frame 1 of 4, the far fore in the air, and the one frame drawn under reduced motion |
| `alberta-foothills-ride-ranch-horse-walk-2` | `ride-ranch-horse-walk-2@1x.svg` | 600 × 446 | walk frame 2, the near hind in the air |
| `alberta-foothills-ride-ranch-horse-walk-3` | `ride-ranch-horse-walk-3@1x.svg` | 600 × 446 | walk frame 3, the near fore in the air |
| `alberta-foothills-ride-ranch-horse-walk-4` | `ride-ranch-horse-walk-4@1x.svg` | 600 × 446 | walk frame 4, the far hind in the air |
| `alberta-foothills-ride-ranch-horse-stand` | `ride-ranch-horse-stand@1x.svg` | 600 × 446 | standing square on all four hooves: the frame the ride holds at rest |
| `alberta-foothills-ride-ranch-horse-trail` | `ride-ranch-horse-trail@1x.svg` | 480 × 120 | the trail under it: grass verge with tussocks, a dry dirt rut, rough pasture |

### 14.1 What was measured

On `refs/alberta-foothills/quarter-horse-side-elevation.jpg` (CC0), a broadside view, against **W = the withers
height** above the hooves. The drawing uses W = 315 px, which puts the seat 145 px above the sole of a rider whose
legs are the rig's own 98 + 74 px.

| ratio | measured | drawn (W = 315) |
|---|---|---|
| barrel depth at the girth ÷ W | **0.51** | 171 px |
| clear leg, girth to ground ÷ W | **0.49** | 144 px |
| body length, point of shoulder to point of buttock ÷ W | **1.08** | 355 px |
| poll ahead of / above the withers ÷ W | **0.54 / 0.20** | 171 / 59 px |
| muzzle ahead of / below the withers ÷ W | **0.75 / 0.17** | 250 / 55 px |

**The one cartoon departure is the head, about ten percent larger than measured**, so the eye, the ears and the
nostril survive at 390 px. The llama this level drew once (§6.3) is guarded by the other rows: the legs are no
longer than the barrel is deep, the neck runs forward, and the poll sits a fifth of W above the withers.

The saddle and where a rider's leg lies come from `cow-horse-under-western-saddle.jpg` (CC BY 2.0): the horn over
the withers, the square skirt, the fender under the thigh, the cinch behind the elbow, the stirrup at the belly
line. The stride comes from `horse-walking-muybridge-plate-574.jpg` (public domain), frame 2 of the top row.

**Colour was chosen, not measured, and is recorded as a choice.** The proportion reference is a buckskin and the
saddle reference a dark bay in hard backlight. A bay, coat in `leather` and points in `hair-black`, separates the ride
from the grey Percheron in the barn corral and from the red white-faced cattle. The saddle is `wood`, a tan saddle on
a brown horse; the pad is plain `felt`. **No ramp was added.**

### 14.2 Placement, and why the horse is not on the walking line

`rides[0]` in `content/levels/alberta-foothills.json`: `riderAnchor` (258, 270), the rider's sole line on the stirrup
tread; `groundLineY` 90; `turnsWithRider` true; `bob` 5 px every 220 px; `track.topY` 346. In world terms the hooves
are at y 1 620, **340 px below the walking line**, the withers at 1 305 and the ears at about 1 202.

The reason is the Prairies' constraint 4 again, and it is sharper here. Since ADR-0032 the drive rests the rider
level with each point of interest, so a horse 600 px long on the walking line would stand in front of the gate's
opening, the corral and its horse, the pump jack's wellhead and all three cattle at the moment the player stops to
look. On the nearer line, rendered at 390 px at all five stops, every landmark keeps its identifying features: the
horse's head covers only the bottom 80 px or so to the right of the rider, and the rider's upper body covers a
strip about 115 px wide, as the walking figure always did. **A shallower line was ruled out by the cattle, by
arithmetic rather than a render**: at 150 px below the walking line the horse's back would stand 165 px above it,
across the bodies of the nearest two animals, which span about 130 to 270 px above the line in a hero centred on
the stop.

**Where the stop actually rests the rider, re-measured 2026-09-16 (ADR-0049), because the sentence above had gone
half-stale.** It is still exactly true of every **point of interest**: the drive rests the rider **level** with the
gate, the barn, the pump jack and the herd, at each one's own x, which is why the horse sits on the nearer line at
all four. It is **no longer true of the guide**, and that is the markers slice's fix rather than a drift — a stop
now reads the ride's art at rest and keeps a character's feet clear of it, so the horse rests **past** him:
travelling right the rider comes to rest at **x 1 408**, 208 px beyond the guide at 1 200, and travelling left at
**x 1 027**. Measured with the real `stand-off`, `ride` and `auto-stop` modules against this level document and the
horse's own art; **nothing in `content/levels/alberta-foothills.json` changed to get it**, and the horse's own
placement, anchor and track are untouched.

**The cost, stated.** Until the player first engages something, the HUD carries the hint *"A mark shows something to
see"* and is taller; at the guide and gate stops it covers the horse below the belly. Clearing it would need the
horse above about 150 px below the line, which is what the cattle rule out. The panel is UI and goes after the
first engagement, so it is recorded here and not fixed in the art.

### 14.3 One layer, and the far leg

The ride is **one `behind` layer**. A rider sits inside a horse's silhouette and a ride has no z between the rider's
legs, so the far leg is hidden by the pose, not by the art: `horse/*` puts both of the rider's hips on the near hip
and both ankles on the near stirrup, so the near leg covers the far one exactly. A `front` layer carrying a stirrup
hood was considered and not taken: every layer of a ride shares one size, so it would have been another 600 × 446,
1.02 MiB of mostly transparent texture, for a detail ten CSS px across.

### 14.4 The legs move, by the ground and not by the clock

**Until 2026-09-14 a ride's art was one still image**, and the horse slid along in one stride (`OQ-RIG-2`). ADR-0035
gave a ride layer a `cycle`, and the horse now declares one:

```json
"cycle": { "rest": "…-ride-ranch-horse-stand",
           "frames": ["…-ride-ranch-horse", "…-walk-2", "…-walk-3", "…-walk-4"], "framePx": 55 }
```

- **Four walk frames, measured off plate 574.** The plate is a lateral four-beat walk: near hind, near fore, far hind,
  far fore, each a quarter stride after the last, each hoof on the ground for about five eighths of the stride. The
  frames sample it a quarter stride apart, an eighth off the touchdowns, so every frame has **three hooves down and
  one in the air**, and the four frames lift the far fore, the near hind, the near fore and the far hind in turn. A
  planted hoof steps back 54 px from one frame to the next and the planted stance runs ±68 px about each leg's
  standing place.
- **The swinging legs fold as the plate's do.** A fore lifts with the knee forward and the cannon folded back under
  it, the sole turned to the rear; a hind lifts with the hock flexed back and the cannon angled forward and down. At
  the end of stance a hoof breaks over its toe, heel up, before it leaves the ground.
- **`framePx` 55 is the planted hoof's step**, so a hoof on the ground stays on the same tussock of the trail while
  the body goes over it, instead of skating. Four frames of 55 px is a 220 px stride, which is the ride's `bob`
  period: one rock per stride, counted from the same distance, so the two never drift apart.
- **The seat does not move.** Only the legs are redrawn. The pad, saddle, cinch, fender, horn, stirrup leather and
  stirrup are the SVG group `<g id="seat" data-rider-anchor="258 270">`, byte-identical in all five files, and
  `level-art-is-placed-where-it-is-drawn.test.ts` fails the build if it differs in any of them or names another
  anchor. The body, head, mane and bridle are also unchanged, so the ride's `footprint` (x 186–342) holds in every
  frame.
- **At rest, `ride-ranch-horse-stand`**, square on all four hooves. A stride that stops dead mid-step reads as a
  statue; a horse that has stopped stands.
- **Under reduced motion, `ride-ranch-horse@1x.svg` and nothing else.** It is walk frame 1, chosen as the still
  because its raised far fore is mostly hidden behind the near fore, so the frozen picture is the wide stride the level
  drew before the legs moved rather than a leg frozen in the air. It does not switch to the standing frame at rest
  either: holding one frame is the whole rule.
- **No run gait.** The cycle is counted in distance, so at cruise the same four frames play faster exactly as the
  ground goes faster; a trot or lope would be another four frames and 4.08 MiB for a speed this level's tuning
  reaches only in its last second of acceleration.

What else carries the walk, and each piece was chosen against a render:

- **A stride, not a stand, while moving.** Both were drawn. Four square legs sliding along read as a statue on
  wheels, which is why the standing frame is drawn only at rest and the reduced-motion still is a stride.
- **The trail goes by under the hooves.** It is fixed to the world, so its tussocks and clods move under a horse that
  stays put on screen, which is most of what the eye reads as travel.
- **The ride's bob**, 5 px at cruise every 220 px, lifts horse and rider together, is still at rest, and is zero under
  reduced motion by the engine's rule.
- **The rider goes with it**: `horse/walk` swings the seat 2 px and rocks the upper body 1.5 degrees; `horse/run`
  leans 8 degrees forward and swings more.

### 14.5 Budgets, measured

`make assets`, 2026-09-14, on main after the atlas packer (ADR-0033) and the layer foot padding:

```
level-payload:  alberta-foothills 0.57 MiB of 8.00 MiB over 14 file(s)
texture-memory: alberta-foothills 26.08 MiB of 36.00 MiB (72%, 10406536 B spare) over 14 file(s)
```

Measured before those two landed, the ride took the level from **26.22 MiB (73 %)** over 12 files to 27.46 MiB (76 %), and the payload from 0.46 to 0.49 MiB. The horse costs 1.02 MiB and the trail
0.22 MiB, both `@1x`-pinned, because `riderAnchor` and `groundLineY` are art pixels. **`textureBudgetBytes` is
unchanged** at 36 MiB: 72 % is inside the band the other levels sit in, and the perf lane opens Ottawa. The shared
atlas did not change, so no other level's number moved.

**The walk cycle, `make assets`, 2026-09-14 (ADR-0035):**

```
level-payload:  alberta-foothills 0.67 MiB of 8.00 MiB over 18 file(s)
texture-memory: alberta-foothills 30.16 MiB of 36.00 MiB (84%, 6124936 B spare) over 18 file(s)
```

Four more 600 × 446 frames at 1.02 MiB each: **+4.08 MiB**, from 26.08 MiB (72 %) to 30.16 MiB (84 %), and the payload
from 0.57 to 0.67 MiB. The walk's first frame is the old file's key, so three walk frames and the standing frame are
new. **`textureBudgetBytes` is still 36 MiB**: 84 % is the band the Prairies sits in after its car (ADR-0031), the
perf lane that counts unpriced GPU bytes opens Ottawa, not this level, and every frame is a texture already decoded
when the level loads, so swapping one allocates nothing. No other level's number moved.

### 14.6 What the renders showed

At 390 px, spawn, cruising, the guide, all four points of interest and facing left, normal and reduced motion: the
scene probe read `data-rides` 1, `data-rides-drawn` 1, `data-mode-gaps` 0 and a `horse/` pose every time, with no
console error. The rider sits in the saddle with the boot at the stirrup and the rein in both fists, and the horse
turns with the rider.

**The first renders showed rig parts in the wrong order, and it was the renderer, not the pose.** At the gate stop
the jeans drew over the coat and while cruising the hair drew detached behind the face, while the spawn render of
the same `horse/idle` key and a composite built with the renderer's own placement arithmetic were both correct.
The cause was the guide's parts interleaving with the player's at a shared depth. Re-rendered after the fix that
gives each character its own depth slot, the gate stop and cruising both draw the coat over the legs and the hair
on the head.

**The walk, rendered 2026-09-14 (ADR-0035)**, from a production build in headless Chromium at 390 × 844, DPR 3,
holding right from the spawn to about x 1 900, then letting go and turning back:

- **Normal motion.** At the spawn the horse stands square (`horse/idle`, speed 0). Moving at 620 px/s, crops taken
  about 62 px apart show the four walk frames in order, three hooves on the trail and one lifted each time, with the
  planted hooves stepping back between crops rather than jumping about; the rider's boot stays on the stirrup and the
  seat line does not move in any of them. Facing left the horse mirrors and walks the same way. Stopped, it stands
  again.
- **Reduced motion.** Every crop — at rest, accelerating, at cruise, stopped and facing left — is the same stride,
  walk frame 1, with no rock.
- **Both.** `data-rides` 1, `data-rides-drawn` 1, `data-mode-gaps` 0, a `horse/` pose every time, and no console error.
- **What the frames cannot fix.** Near the guide the first-visit hint panel still covers the legs (§14.2), and at
  cruise the hooves sit at the panel's top edge on a 390 × 844 phone.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'ranch-horse': singleSource(),
```

Applied with this change, as the park car's was.

---

## Ground dressing (ADR-0042)

| key | source | authored px | world y | decoded |
|---|---|---|---|---|
| `alberta-foothills-ground-rangeland` | `ground-rangeland@1x.svg` | 1080 × 640 | 1280 … 1920 | 2.65 MiB |

The rangeland nearest the viewer in late summer: rough fescue in tufts with dry `felt-light` seed heads, `brass-light` gumweed and small fieldstones; the grass under the horse trail, which draws over it at world 1536; and taller, darker `pasture-shade` grass below.

A repeating strip over the ground fill and under every landmark, character and ride, at every visual tier, moving exactly with the world. 1080 px wide (one tile per screen), pinned to 1x, opaque in every row, and ending on the bottom of the world, so the scene paints no ground fill under it. Palette colours only, no outline, no lettering, no figures. Its most legible detail is in its first ~160 rows, which stay visible above the HUD with a prompt showing.
