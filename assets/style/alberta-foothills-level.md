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
| `alberta-foothills-landmark-ranch-barn@1x` | `landmark-ranch-barn@1x.svg` | 880 × 636 | **POI hero** |

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
contact and 0.18 at structural overlaps. **No falling weather: this level is late summer.**

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
