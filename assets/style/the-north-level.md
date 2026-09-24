# The North level art — layers, offsets, budgets and the decisions behind them

Level 10 — **Canada's Regions**, locomotion **walk**. Sources are `assets/src/svg/the-north/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. Design resolution 1080 × 1920, portrait, ground polyline at
**y = 1280**. A clear late-summer morning on the Yukon River at Whitehorse.

This is the **tenth and last** level.

---

## 0. The block, what lifted it, and what is still owed

`docs/stories/TN-LEVELS-2-to-10-spine.md` lists level 10 with **no id, no place, no landmark and no NPC**, and
gives two reasons. Both are real and neither is answered by this level; what this level does is not need
either of them answered.

**The first is `docs/content-review.md` §1, shipping-rule item 5** — a level whose *subject* is a nation's
territory or history does not ship without a Tier 3 reviewer — which the spine applies to level 10 like this:

> a level whose subject is Canada's regions, set in the North, either depicts the peoples of Inuit Nunangat
> or removes them from a level about where they live. Both readings need Tier 3.

| §1 asks | this level |
|---|---|
| Is the level's **subject** a nation's territory or history? | No. Its subject is *Discover Canada*'s **Canada's Regions** chapter and its bank key is `regions`. Its **place** is a river bank in the Yukon. |
| Does anything in it **depict** a nation? | No. **Nothing in this level depicts any person at all** — see below. |
| Does it carry a **territorial fact**? | Yes, quoted from the published words of the one nation it names. That is §1's may-ship item 5. |
| Does it declare a locomotion mode `OQ-REVIEW-10` blocks? | No. It declares `walk`. See §9. |

**The spine's sentence is still right about the level it was describing.** A level set in **Inuit Nunangat**
— Iqaluit, Tuktoyaktuk, Pangnirtung — cannot be drawn without answering it, because the identifying
structures there *are* Inuit: the igloo-form church at Inuvik, the inuksuit, the qamutiik, the amauti, the
sod house. **That level is not this level, and that is a scope decision rather than a solution.** This level
is set in the **Yukon**, on a river bank, and its hero is a steel-and-timber freight vessel. §11 records what
that costs and who it leaves out.

### No figures. Not "no cultural markers" — no figures.

`docs/content-review.md` §3.3 outcome 2 permits an unmarked person, and `vancouver/layer-40-seawall.svg`
draws four. **This level draws none, anywhere, at any scale**, for the reason
`assets/style/peggys-cove-level.md` §0 gives and one more of its own:

- `neverAdd` on **both** of this level's subjects carries *"a figure of any kind, at any scale, including a
  silhouette and a crowd"*, so the prohibition is a checked contract clause;
- more than half the population of the Northwest Territories is Indigenous and about 85 % of Nunavut's is,
  which is a fact this level's own question bank teaches from *Discover Canada*. A figure drawn on a northern
  river bank is read as somebody, and this project has no reviewer who may say whether that reading is
  welcome. Drawing nobody is not neutrality; it is the smaller of two things an agent may do without asking.

### The Tier 3 obligation, written as an obligation

- **OBLIGATION due=2026-12-08 owner=po** — put this level, `content/levels/the-north.json` and the two
  `the-north` subjects in `assets/refs/references.json` in front of a Tier 3 reviewer from **Kwanlin Dün
  First Nation** — `docs/content-review.md` §1, and §12's `OQ-REVIEW-2`, whose date this deliberately shares
  — and record the answer. **What a reviewer still needs to check, and what no gate and no agent in this
  repository can:** (1) whether quoting Kwanlin Dün First Nation's own acknowledgement of the **Tagish Kwan**
  inside a game's About-this-place panel is an honest use of it or an extraction of it; (2) whether
  **Chu Níikwän** and **Kwanlin** — words taken from the nation's own page — may be printed by this project
  at all, and whether their spelling and diacritics are right; (3) whether a level titled *The North* that
  never leaves the Yukon, and whose picture is a settler freight boat on a gravel bar, misrepresents the
  region it is named for; (4) whether naming one nation and being silent about the **Ta'an Kwäch'än
  Council**, whose government is in the same city, is the correct reading of a rule that says name only what
  a source names — `content/sources/kdfn-about-us.json` sets out exactly why the silence is there and what
  would close it; (5) whether a level about **Canada's regions** that depicts nobody in a region where most
  people are Indigenous reads as respect or as erasure, which `docs/content-review.md` §10.3 already calls a
  half-step. **Nothing in this repository may record an answer to any of these.** Per §1 an agent may write
  `communityReview.status = "not-sought"` and nothing else, and none is written here.

- **AND THIS MARKER IS NOT CHECKED BY ANYTHING.** `scripts/check-obligations.mjs` scans `*.md` under
  **`docs/`** and nothing else, so an ADR-0009 marker in `assets/style/` is decoration; `docs/` is not this
  artist's to edit. The one-line fix is routed in §10, and it is the same fix Peggy's Cove needs.

### What was considered and refused

- **Setting the level in Inuit Nunangat.** Refused, above. The consequence is §11 and it is stated rather
  than hidden in a place name.
- **Drawing an inuksuk, a qamutiik, a dogsled, a dog team, a kayak or a canoe.** All are `OQ-REVIEW-10` or
  `docs/content-review.md` §5.2, all are in `neverAdd` on both subjects, and none appears in any form —
  including background, silhouette, icon and loading art. `assets/style/vancouver-level.md` §0 is the
  precedent, and this is the level where the temptation was strongest, because the spine's own copy table
  gave this level a dogsled.
- **The aurora, and a midnight-sun sky.** Refused for a reason that is not a review rule: *Discover Canada*
  names the Land of the Midnight Sun and the phrase is in this level's point-of-interest card, but the
  palette's `dusk` ramp is the game's only low-light set, the art bible fixes **one key light for the entire
  game** at warm sun upper-left 35°, and a night level would need its own key and its own ramps for water,
  rock, spruce and snow. That is a slice. The fact is taught in words instead.
- **The word "unceded".** Not used. Whitehorse is inside the Kwanlin Dün First Nation Final Agreement, which
  is a modern treaty, so the word would be wrong here as well as unsourced.

---

## 1. What was produced

| key | source | authored px | shapes | what it is |
|---|---|---|---|---|
| `the-north-layer-10-sky` | `layer-10-sky.svg` | 1080 × 900 | 49 | one flat `sky-shade` field and six lenticular cloud stacks |
| `the-north-layer-20-range` | `layer-20-range.svg` | 1760 × 250 | 72 | a snow-capped saw-tooth range, a rounded ridge, a spruce foot |
| `the-north-layer-30-far-bank` | `layer-30-far-bank.svg` | 1760 × 150 | 282 | black spruce cropped at the tile's top edge, gold aspen among them, a tan cut bank, the far shoreline |
| `the-north-layer-40-river-and-bar` | `layer-40-river-and-bar.svg` | 1920 × 320 | 759 | the glacier-fed river in three tones, then a cobble bar with driftwood, willow and sedge |
| `the-north-landmark-sternwheeler@1x` | `landmark-sternwheeler@1x.svg` | 2300 × 700 | 228 | **POI hero, and the level's place-anchor.** The authored 920 × 280 geometry under one uniform `scale(2.5)` group since 2026-09-16; §13 |
| `the-north-prop-spruce-stand` | `prop-spruce-stand@1x.svg` | 620 × 760 | 46 | **POI hero, added 2026-09-13**: five spire-topped spruce of uneven height on a boulder bank |
| `the-north-prop-driftwood-pile` | `prop-driftwood-pile@1x.svg` | 700 × 340 | 48 | **POI hero, added 2026-09-13, redrawn on 2026-09-17, 2026-09-22 and 2026-09-24**: seven weathered logs of very different thicknesses lying across one another at seven angles on the cobble bar, every end broken into torn splinters, grain checks and a split on each log, three snapped limb stubs, and a flared butt with four kinked roots. **Attempt five read as bones and an antler; attempt six is unproven — see §8.1** |

Shape counts are reported, not gated (ADR-0025). The sky is **49 shapes**, the same count as the CN Tower and
the lowest of any layer in the game; the river-and-bar tile is **759**, the highest, and every one of them is
a cobble, a blade or a ripple bar.

**The driftwood pile was redrawn a second time on 2026-09-17, and the cause was the END, not the angle.** The
first redraw that day fixed the arrangement — seven angles instead of seven near-parallel tiers — and a blind
pass still called the pile *a stack of cut logs or timber*, naming its reason exactly: *"each with a dark
circular cap at its end that reads as cut end-grain"*. It was right. Every log was a straight, constant-width
lozenge with a **shade-tone ellipse stuck on each end**, and a dark disc on the end of a cylinder is a sawn
face — which is the one reading this subject exists to avoid, because a sawn log is something a person made.
No ellipse survives. Each spar now tapers along its whole length to a blunt nose, and each end is a short
**slanted, uneven wedge** broken at a different angle from the end opposite it. Two other claims routed with
that verdict did not survive being looked at: the root wad is **not** an even radial fan — it is four roots of
four lengths over seventy-six degrees on one side, which is what `neverAdd` asks for — and the cobble bar
**is** drawn under it, full width. They are recorded here as checked rather than fixed.

## 2. The parallax stack

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | sky | 1080 × 900 | 0 … 900 | 0.04 / 0.02 | true | **972 000** | yes | **yes** |
| 20 | range | 1760 × 250 | 620 … 870 | 0.11 / 0.04 | true | 270 000 | yes | no |
| 30 | far-bank | 1760 × 150 | 820 … 970 | 0.28 / 0.12 | true | 162 000 | yes | no |
| 40 | river-and-bar | 1920 × 320 | 960 … 1280 | 1.00 / 1.00 | true | **345 600** | yes | **yes** |

Coverage is `app/adapters/phaser/level-effects.ts` `selectLayers`' own measure — screen width 1080 × the
band's visible height, bottom clipped at the highest point of the ground polyline — not the tile's own width.
At `low` the two that win are the **sky** and the **river-and-bar** tile, and that pair is a picture: a pale
glacial river, a cobble bar and a sternwheeler under a deep northern sky. **The river is in the near tile
rather than in a fifth layer of its own precisely so that it survives that cut**; a level about Canada's
regions whose river disappeared at the tier most phones get would be a gravel pit.

### The opaque feet, measured from the shipped rasters' alpha

| tile | first ink | first fully opaque row | visible band |
|---|---|---|---|
| sky | world 0 (a flat field) | world 0 | 0 … 673 |
| range | world 673 | world 799 | 620 … 820 |
| far-bank | world 820 (its own top edge) | world 820 | 820 … 960 |
| river-and-bar | world 960 (its own top edge) | world 960 | 960 … 1280 |

**Three of the four are opaque from their own top edge**, and each for a different reason that is a property
of what it draws: the sky is a flat field, the far bank's top rows are forest, and the river-and-bar tile's
top rows are water. The range is the exception and it is the only tile on this level with a seam to close:
its own opaque line is world 799 and the far bank covers it from world 820, so the 21 rows between them are
carried by the range's rounded mid-ridge, which IS opaque there. No band shows the theme gradient at any
tier.

**53 of the range tile's 250 rows carry no ink**, which is 21 % and is the sky between its peaks. It is
stated rather than left inside the coverage number: `selectLayers` measures a rectangle, and an author who
lets a band claim rows it does not draw is inflating its rank. The comparable figure on the other three tiles
is zero.

### The sky is one flat field, and its clouds are the only ones of their kind

Same reason as Winnipeg's, the Prairies', the Alberta foothills', Vancouver's and Peggy's Cove's: at `low`
this level keeps the sky and the river-and-bar tile, whose first opaque row is world 960, so a band step
anywhere above it would show against open sky. One flat `sky-shade` field has no step to hide, and the field
**is** the level document's `theme.sky`.

**LENTICULAR STACKS — smooth stacked lens shapes with pointed ends, the mountain-wave cloud a high range
makes.** That is the seventh distinct cloud treatment in the game and the only one with a vertical stack in
it: Halifax has cumulus, the Alberta foothills fair-weather cumulus, the Prairies flat-bottomed cumulus
banks, Winnipeg thin banks, Toronto soft banks, Vancouver cirrus streaks and Peggy's Cove stratocumulus
rolls. **Every sky in this game is now distinguishable from every other at a glance**, which was a design
constraint from Halifax onward and is closed here.

### Nothing identifying is on a repeating layer

All four repeat. The peaks are a landform and **not a graded subject** — the reason
`assets/style/alberta-foothills-level.md` gives for the Rocky Mountain front is the reason here: a saw-tooth
range identifies a landform and not a place. The spruce, the aspen, the cut bank, the driftwood, the willow
and the cobbles are types. **No vessel appears on any repeating layer** and `neverAdd` says so on the tile
subject.

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way**, five points at x 0 / 1920 / 3840 / 5760 / 7680.
- **`size.x` 7680**, four bar tiles: about 18 seconds at the walk's 420 px/s.
- **`spawn`** `(440, 1280)`.
- **Layer offsets** are `y` 0 / 620 / 820 / 960, in depth order.
- **`poi.yukon-river-sternwheeler.position.x` 3840**, the middle of the level, `radiusPx` 340. The hero is
  **2300 × 700** since 2026-09-16 (§13), so it occupies world x 2690 … 4990 and world y 580 … 1280, against
  3380 … 4300 and 1000 … 1280 before. The vessel's keel IS the frame's bottom edge; there is no empty band
  under it, because it stands on a gravel bar rather than on piles. **It still clears both neighbours' art**:
  the spruce stand ends at world x 2110 and the driftwood pile begins at 5650. **It no longer fits inside one
  camera frame**, which is the art-bible §6 departure §13 records and defends.
- **`camera`** `followLerp` 0.12, `deadZone` (60, 120), `offset` (150, −260), `zoom` 1. With the player on
  the ground the camera top sits at world y 60, so the visible band is world 60 … 1980.
- **`theme`**: `sky` `#1f5fa8` (`sky-shade`), `ground` `#8b857c` (`path-base`), `horizon` `#c2d6e8`
  (`snow-shade`). Derivations in `palette.json` `levelTheme.the-north-late-summer`. **`snow-shade` is used as
  a horizon for the first time**, and the triple is kept apart from Winnipeg's and the Alberta foothills' —
  which share its zenith — by the other two.
- **`locomotion`** declares **`walk` and nothing else**, with Halifax's numbers unchanged. §9 is why.
- **`quests` and `characters` are both empty.** This level is finished by reaching its end (`TN-DONE`).
  §10 routes the quest.

## 4. Every effect has a plain path (ADR-0011)

No `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or `url(#…)` anywhere.
Water is three flat `glacier` tones with straight ripple bars and flat white riffles. AO is flat `ao-shadow`
at 0.28 at ground contacts and 0.18 at overlaps — and on this level the 0.18 band under each of the vessel's
deck edges is load-bearing rather than decorative, because without it three white decks on a white hull
merge into one slab. **No falling weather, no smoke, no steam, no aurora.** **Player costume: `jacket`**: the light jacket, T-shirt, jeans and high-tops (`player.md` §7), because this level is not winter and no weather falls on it.

## 5. Budgets, measured

```
level-payload:  OK - the-north 0.52 MiB of 8.00 MiB over 9 file(s) [1x 0.39 / 2x 0.52]
texture-memory: OK - the-north 21.66 MiB of 36.00 MiB (60%) over 9 file(s)
                     [1x device 13.42 MiB / 2x device 21.66 MiB]
                     heaviest atlas/shared@2x 2045x1531 11.94 MiB = 33% of budget
```

The level's own files are **9.72 MiB**: four layers at 8.74 and the hero at 0.98. That is **the lightest of
the ten levels**, and its honest worst case on ADR-0013's baseline is 9.72 + 11.94 + ~8 = **29.7 of 64,
46 %**.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost **8.74 MiB**; authored 1920 tall at the
   same widths they would cost **47.0 MiB**.
2. **The hero is pinned to 1× and WAS the smallest hero in the game at 920 × 280.** A sternwheeler is a wide,
   low subject: 0.98 MiB bought a vessel 85 % of the screen wide, where the same texture budget spent on a
   tower would buy one a third of the screen tall. The two-size test in §6.4 is what allowed the pin.
   **That size is the defect §13 fixes**, because the same 0.98 MiB also bought a vessel shorter than the
   player standing beside it. The hero is now **2300 × 700 and 6.14 MiB**, and is still pinned to 1×.
3. **The far-bank tile is 150 rows.** Only 140 of them are ever seen, and it was authored to that rather
   than to the 210 the first layout gave it, which is 0.46 MiB of forest nobody would have looked at.

## 6. The landmark

### 6.1 What was measured

Measured on `refs/the-north/sternwheeler-broadside.jpg` (1500 × 741), which is the one reference that shows
the whole vessel square on. The denominator is **D = the hull depth, main deck y 495 to keel y 600 = 105 px**.

| ratio | measured | drawn (D = 86) |
|---|---|---|
| paddlewheel diameter ÷ D | 190/105 = **1.81** | 154/86 = 1.79 |
| hog-post height above the deck ÷ D | 203/105 = **1.93** | 166/86 = 1.93 |
| funnel height above the deck ÷ D | 190/105 = **1.81** | 156/86 = 1.81 |
| whole vessel, wheel to bow ÷ D | 1015/105 = **9.67** | 866/86 = 10.07 |

The last row is **4 % long** and is inside the art bible's ±10 %; it is recorded rather than rounded because
the excess is all in the bow, where the reference's own hull runs behind a river bank and the measurement is
the weakest.

### 6.2 The two things that are the identification

**The wheel is 1.8 hull depths across and it is at the STERN.** A small wheel, or a wheel on the side, is a
different vessel. It is drawn as an **open** wheel — a rim, eight spokes, eight bucket boards and a hub — and
never as a solid disc, because from any distance a disc reads as a mill wheel.

**The hog posts are taller than the funnel.** Four black posts standing 1.93 hull depths above the deck, with
straight truss rods running from their heads down to the bow and the stern, are what makes this a
shallow-draught **river** boat and not a coastal steamer. They also fix the one thing a cartoon paddle
steamer always gets wrong, which is drawing two funnels and no posts: that is a Mississippi showboat.

### 6.3 The departure, stated

**The wheel's axle is drawn 9 px below the deck line where the reference has it 53 below** — 0.10 of the hull
depth against a measured 0.50. The real wheel's lowest point is under the keel; this render's bottom edge
**is** the ground the vessel stands on, so the wheel is raised until it rests on that line. The **diameter**
ratio, which is the identification, is kept exactly. This is the same class of decision as Vancouver's empty
band under its pier and it is written here for the same reason: a verifier measuring the axle will find it
wrong, and should find the reason before the number.

### 6.4 The two-size test, and the 1× pin

At 25 % (230 × 70) the wheel's spokes and buckets, the four posts, the truss rods, the funnel, the pilot
house and both rows of hull openings are each still separable. As a **pure black silhouette 120 px tall** it
is a long low box with a spoked wheel off one end and a comb of posts above it: a paddle steamer and nothing
else this game will draw. Both probes pass.

### 6.5 The name, and what shipping it blank costs

**The vessel carries its own name in large black letters across the bow and again across the pilot house in
every one of the five references, and it is the single most identifying thing in those photographs.**
`make verify-art` refuses a `<text>` element in a render source and `art-bible.md` §6 rule 4 forbids
substituting an invented mark for a real one, so the vessel ships **nameless**.

The consequence is stated in full rather than discovered by a blind pass: **`paddlewheel-riverboat` is asked
for a TYPE and is never asked for a place**, and therefore **the North as a place rests on nothing in this
level's art**. That is `prairie-rail`'s outcome and `alberta-foothills`' outcome, a third time, and
`OQ-SPINE-6` already predicted it for exactly these three region levels. The level's answer to *where* is its
title, its territorial statement and its question bank, none of which is a picture.

### 6.6 The colours, and the one ramp this project added today

- **The river.** `glacier`, and it is the **only ramp added for either of the two levels drawn on
  2026-09-13**. MEASURED on `refs/the-north/yukon-river-canyon.jpg`: 500 × 150 of mid-channel at (700,620) has
  median **hsl(176, 30 %, 75 %)** and 400 × 110 of near water at (200,760) has median hsl(169, 23 %, 59 %),
  giving a base of hsl(172, 30 %, 62 %). `water-base` is hsl(199, 62 %, 45 %) — 27 degrees of hue away — and
  `copper-base` is hsl(162, 45 %, 50 %), 10 degrees away and oxidised copper roofing. The separation from
  `copper` is **wider than the separation this palette already accepts between `limestone` and `stone`**, so
  it is not a duplicate by the palette's own standard. A glacier-fed river carries rock flour and is pale,
  desaturated and green-cyan; nothing in this palette was.
- **The wheel and the funnel.** `wood`, unchanged. MEASURED over every pixel of
  `refs/the-north/sternwheeler-paddlewheel.jpg` with saturation above 35 %, hue 10–55 and lightness above
  35 %: median **hsl(26, 63 %, 42 %)** against `wood-base`'s hsl(30, 52 %, 39 %) — four degrees of hue and
  three points of lightness. `oxide` is fifteen degrees to the red and is barn paint.
- **The autumn gold.** `brass`, unchanged. MEASURED at hsl(44, 34 %, 49 %) and hsl(41, 30 %, 49 %) against
  `brass-base`'s hsl(44, 69 %, 50 %): the hue and the lightness match to within three and one, and the
  35-point saturation gap is that photograph's own fog bank, which is in frame.
- **The cut bank.** `stone`, and this is the **widest gap any ramp in this game is asked to carry**:
  measured hsl(43, 23 %, 45 %) against `stone-base`'s hsl(36, 37 %, 58 %) — seven degrees of hue but
  fourteen points less saturated and thirteen darker, because that bank is in haze and in its own shadow.
  Recorded in `palette.json` rather than rounded away.
- **The spruce.** `pine`, unchanged, and **the measurement is recorded with its defect**: two canopy samples
  read hsl(70, 17 %, 25 %) and hsl(68, 25 %, 32 %), eighty degrees to the yellow of `pine-base`, and both
  contain sunlit deciduous understorey and dry grass between the trunks. No conifer ramp was added on the
  strength of a contaminated sample; `pine` is the game's conifer ramp on five levels and a sixth green would
  be the duplicate this palette refuses.

### 6.7 Three things were drawn twice

1. **The mountains.** Build one drew a continuous ridge with a snow band following its whole crest, and it
   read as a row of white scallops — clouds, not peaks. Build two drew discrete triangles but put the snow
   line at 21 % of each peak's height **above the base** instead of below the apex, so the caps covered four
   fifths of every mountain and the range read as a row of paper planes. They are now overlapping angular
   peaks with snow on the top third only, a lit left face and a shaded right.
2. **The willow.** Build one drew each clump as one flat ellipse with a yellow disc on it and they read as
   lily pads. They are now mounds of five to eight overlapping lobes with a ragged top, and the gold is one
   lobe of the mound rather than a dot on it.
3. **The pilot house.** Build one drew three white decks with no shading between them and the vessel read as
   one slab with windows. Each deck edge now carries a flat `ao-shadow` band at 0.18, and the pilot house
   gained a dark roof cap so the top of the stack is a shape rather than an edge.

**All three were invisible in the SVG and obvious in the first render**, which is `art-bible.md`'s own
instruction and is now the eleventh time this project has recorded it.

## 7. The territorial statement

`content/levels/the-north.json` states a territorial **fact** (`docs/content-review.md` §10.1), quoted from
**Kwanlin Dün First Nation's** own About page:

> We acknowledge the Tagish Kwan as the original people who live and occupy the lands that define our
> Traditional Territory, alongside the headwaters of Chu Níikwän (today, the Yukon River). Our people have
> been here for millennia.

Cached as `content/sources/kdfn-about-us.json` with a **recorded, reproducible extraction command** —
`npm run sources` re-derives its digest.

Three things about it, all recorded rather than left:

- **One page, three passages.** The clause about the City of Whitehorse comes from a second passage on the
  same page and the meaning of *Kwanlin* from a third. A `FactSource` carries one quote, so the register
  names the other two. **This is still better than every level before it**: `vancouver`'s statement rests on
  two documents from two different bodies and only one can be registered.
- **The Ta'an Kwäch'än Council is not named, and the silence is deliberate.** Its government is in
  Whitehorse and about half its citizens live there, and **neither this page nor the Council's own history
  page says that Whitehorse is inside its traditional territory** — that page names Tàa'an Män (Lake Laberge)
  as the heart of the territory and gives its bounds by four place names. A level carries one `nationSource`,
  and naming a second nation's territory from a page that does not state it would be the invention the
  register exists to prevent. The same shape as `alberta-foothills`' silence about the Métis Nation of
  Alberta. **No copy on this level resolves that silence in either direction.**
- **Endonyms are not translated.** `Kwanlin Dün First Nation`, `Tagish Kwan` and `Chu Níikwän` are identical
  in the EN and the FR strings, diacritics included (`docs/content-review.md` §9.3). *Southern Tutchone* is
  an English language label rather than an endonym and is not used in the statement at all.

## 8. What this level does NOT assert

**No Indigenous content of any kind is drawn**, and no depiction of the nation the territorial statement
names. Not an inuksuk, not a qamutiik, not a dogsled, not a dog team, not a kayak, not a canoe, not a fish
weir, not a cairn, not a marker — in any form, including background, silhouette, icon and loading art. Both
subjects in `references.json` carry the list.

## 9. The dogsled, and why this level walks

`content/game.config.json` lists **`dogsled`** among its nine locomotion modes. **No level declares it, and
no rig art exists for it.** A level declaring `dogsled` today would animate a walking figure under a HUD
label that says otherwise.

Two separate reasons, **either sufficient alone**:

1. **`OQ-REVIEW-10` is unanswered.** `docs/content-review.md` §5.4 names the dogsled and the qamutiik as
   Indigenous technology used as generic Canadian symbols, and §5.1's second test — *is this item's job in
   the composition to tell the player that this person is Indigenous?* — is exactly what a dogsled on a level
   called The North would be doing. `TN-LEVELS-02` makes a level document declaring `dogsled` a build
   failure with no override.
2. **There is no art, and the list is longer than the canoe's.** A dogsled mode needs, at minimum: a
   `dogsled/idle` and `dogsled/moving` pose with a standing driver on runners; a `mount-sled` equipment
   frame; **a team of animals, which is a whole second rig this game does not have** — every four-legged
   animal in TrueNorth today is the beaver, which is a biped companion; a snow surface the mode owns; and
   `jump` bound to nothing. That is not a frame and not a slice; it is a character system.

**`walk` is not a placeholder.** It is how a person crosses a gravel bar, this level is 7 680 px of gravel
bar, and `TN-MOVE` already has its row.

## 10. What this level needs that is not in `assets/` or `content/levels/`

1. **`scripts/lib/art-handoff.mjs` `RECIPES` needs two builders**, or `make verify-art` refuses this level's
   subjects by name — which is the harness working:
   `'paddlewheel-riverboat': singleSource(),` and
   `'northern-river-bar': twoParallaxTiles({ farMatch: 'bank', nearMatch: 'bar', nearTop: 140, what: 'a spruce bank and a river bar' }),`
   `nearTop` is 140 because the bar tile sits at world 960 and the far-bank tile at world 820.
2. **`content/game.config.json`** needs `the-north` in `levels`, in `unlockRules.order` after `vancouver`,
   and in slot 10 of `journey` — the second of the two `null`s reserved since the config was written. With
   Peggy's Cove in slot 2 the journey has **no nulls left**.
3. **`app/ui/copy.ts`** needs `level.the-north.title` ("The North" / « Le Nord ») and
   `level.the-north.subtitle` ("Canada's regions" / « Les régions du Canada ») — both are written in
   `TN-LEVELS`'s copy table under `level.10.*` and need rekeying now that the level has an id — plus the
   waiting sentence, the error title, the stamp sentence and the play label `TN-WAIT` and `TN-DONE` require.
   **Two of those rows break the mid-sentence capital the way level 7's and level 8's do**: the map says
   "The North" and a sentence says "the North".
4. **`docs/stories/`** — the spine's table still reads *not fixed / not scoped / Blocked* for row 10, and its
   blockers section needs §0's distinction. `TN-LEVEL-the-north.md` is the partial story file this level now
   needs.
5. **`docs/content-review.md` §13** — copy §0's obligation marker there, or teach
   `scripts/check-obligations.mjs` to scan `assets/style/` as well.
6. **`content/quests/`** — no quest and no character. If one is authored the level document gains three
   fields and the art is unaffected.

## 11. What this level leaves undrawn, said plainly

**Nunavut and the Northwest Territories are not in this picture.** The level is titled *The North*, it
teaches a chapter that covers all three territories, and every pixel of it is the Yukon. That is a decision,
and these are its terms:

- The identifying built things of Inuit Nunangat **are** Inuit — the inuksuk, the qamutiik, the sod house,
  the igloo-form church at Inuvik, the Legislative Assembly of Nunavut and its mace — and `OQ-REVIEW-10` and
  `docs/content-review.md` §5.2 cover most of them by name. Not one of them may be drawn before a Tier 3
  reviewer exists.
- The landforms that could stand in — Mount Thor, the Tuktoyaktuk pingos, Náįlįcho — are on named territory
  whose nations have their own published words, and each would need its own cached source and its own
  reviewer. None of that is cheaper than what this level did; it is the same work again, three more times.
- **So one region was drawn and named for all three.** A future slice that gives Nunavut and the Northwest
  Territories their own levels does not have to undo anything here, and this sheet is the record that they
  were left out on purpose rather than forgotten.

`docs/content-review.md` §10.3 is the sentence that belongs at the end of this: naming the territory and
depicting nobody from it *"is a half-step … It is not the thing that would be right."*


---

## 12. Three points of interest on a level with no people in it

**Added 2026-09-13.** The level shipped with one POI at 3 840 on a 7 680 px walk. It now has three.
`size`, the ground line, the four layers, the theme, the locomotion and the spawn are unchanged; there are
still **no characters**, and the sternwheeler keeps the `questId` ADR-0029 gave it.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 1 800 | `spruce-stand` | `the-north-prop-spruce-stand`, 620 × 760 | the three northern territories hold a third of Canada's land and about 100,000 people | *Discover Canada* p. 103 |
| 3 840 | `yukon-river-sternwheeler` | `the-north-landmark-sternwheeler`, 2 300 × 700 since 2026-09-16 (§13) | the Land of the Midnight Sun, the winter dark, and the treeless frozen tundra | *Discover Canada* p. 103 |
| 6 000 | `driftwood` | `the-north-prop-driftwood-pile`, 700 × 340 | thousands of miners came in the Gold Rush of the 1890s and mining is still a big part of the economy | *Discover Canada* p. 103 |

**Gaps of 2 040 and 2 160 px**, inside the 1 500–2 500 band.

**§0's rule held without an amendment and it shaped both drawings.** No people at any scale; no inuksuk,
qamutiik, dogsled, dog team, kayak, canoe, fish weir or cairn in any form; nothing invented. Both new
subjects carry that whole list in their own `neverAdd`, so all four subjects on this level now do.

**The consequence is that neither new POI can DEPICT what it teaches, and that is stated rather than hidden.**
A level that draws no people and nothing built cannot draw mining, and it cannot draw a population. So the
objects are what the river actually put on its own bank — trees and the wood it tore out — and the facts are
attached to the place a player stops. **Nothing in either file asserts the gold rush**: there is no sluice,
no pan, no claim stake and no tool, and `neverAdd` forbids all of them by name.

**The driftwood is one tidy arrangement away from breaking §0, which is why it is the most tightly written
subject on this level.** A pile of logs becomes a shelter, a lean-to, a raft, a fire ring, a weir or a cairn
the moment anything is stood up, leaned or squared, and several of those are forbidden outright by
`docs/content-review.md`. The contract says: **every log lies**, none steeper than about 20° from horizontal,
none vertical, no two at the same angle. `expectedBlindAnswer` makes *a shelter*, *a lean-to*, *a raft*, *a
fish weir*, *a fence*, *a cairn* and *a marker* explicit failures.

**And one of them was caught in the render rather than in the rules.** The first build drew the root wad as
an **even radial fan**, and at 390 px it read as a **sunburst device** — an emblem, on the one level in this
game where a drawn symbol would be worst. It is now four uneven roots on one side of the log, spread over
less than half a turn. Invisible in the SVG; obvious in the frame.

**The spruce are measured, because narrowness is the whole subject.** Crown width runs **0.28–0.36 of tree
height** on the bank forest in `yukon-river-and-spruce.jpg`; the five drawn are 0.33–0.39. A wide conical
tree is a fir from a warmer forest, and this level's forest is what tells a player which latitude they are at.

**Budgets, re-measured 2026-09-13:** `the-north 24.37 MiB of 36.00 MiB (68 %, 12 196 356 B spare)` over 11
files, payload 0.55 MiB of 8. The two new heroes cost **2.71 MiB between them** and both are `@1x`-pinned.
This is still the lightest level in the game.

**Scenery: none added.** `layer-40-river-and-bar.svg` is 759 shapes of river, cobble, driftwood, willow and
sedge, and `layer-30-far-bank.svg` is 282 of spruce, aspen and cut bank. The corridor was not short of things
to look at.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'spruce-stand': singleSource(),
  'driftwood-pile': singleSource(),
```

---

## 13. The vessel was drawn smaller than the player, and is now drawn 2.5 times bigger

**2026-09-16, branch `sternwheeler-scale`, after the second live-site audit's P2 #17 (ADR-0049, slice A7).**
The audit photographed the sternwheeler stop and the boat was **shorter than the person standing at it**.
Measured on the shipped art: the hero was 920 × 280 against a player 420 px from sole to crown, so the whole
vessel — hull, three decks, funnel, hog posts and all — stood **0.67 player heights** tall and 2.19 long, and
its main-deck line sat 86 px above the bar, **below the player's knee**. *Discover Canada*'s North is a place
of big rivers and the vessel is a 64 m freighter; a landmark a player could pick up is the "simplified, never
invented" rule broken in the one direction that reads as a mistake rather than a style.

### 13.1 What the references actually say, and why no drawing can obey them

The vessel is about **64 m long and about 12 m to the top of the wheelhouse**, against a person of about
**1.7 m**. This level's scale is fixed by the rig: the player is 420 px sole to crown, so **1 m ≈ 247 px**. A
true-size vessel beside this player is therefore about **15 800 px long and 2 960 px tall** — twice the whole
world's height, and 2.06 times the level's entire 7 680 px length. **There is no scale at which this subject
is both accurate and drawable**, so the only honest question is how much of the error to buy back, and the
sheet must say which error is left. In hull depths, the reference's own denominator: the real main-deck line
stands about 6.6 m above the keel, which is about 3.9 player heights; it is drawn at 0.51.

### 13.2 What was done

**One uniform `scale(2.5)` group wrapping the whole drawing.** Not a redraw: every authored coordinate is
untouched inside the group, so **every ratio in §6.1 holds exactly** — the paddlewheel at 1.79 hull depths,
the hog posts at 1.93, the funnel at 1.81, the vessel at 10.07 — and §6.3's stated departure on the wheel's
axle is unchanged too. The file is **2300 × 700**; the `<title>` carries the scale and says that every px in
it is an authored px. A redraw was considered and refused for a reason that is measurable rather than
aesthetic: this drawing is flat fills with no strokes (art-bible §3 puts no outline on level art), so a
uniform scale changes no line weight, and every feature keeps its proportion to the hull. Enlarging it makes
the 12 px minimum-shape rule *easier*, not harder.

| | before | after |
|---|---|---|
| authored px | 920 × 280 | **2300 × 700** |
| vessel height ÷ player height | 0.67 | **1.67** |
| vessel length ÷ player height | 2.19 | **5.48** |
| main-deck line above the bar | 86 px, below the knee | **215 px, at the hip** |

### 13.3 A 3.25 scale was drawn, rendered and REFUSED, and this is the number that refused it

The first build of this change was **3.25** (2990 × 910), which puts the main-deck line at the player's upper
chest and the vessel at 2.17 player heights — closer to what the audit asked for. **It was rendered at 390 px
and thrown away.** At a stop the camera holds 1 080 design px with the player standing **464 px right of its
left edge**, and the paddlewheel's centre lies **365 authored px left of the drawing's centre**, so the wheel
is inside a stop's frame only while `460 − 464 ÷ k ≤ 172`, that is **k ≤ 1.61**. Above that no scale keeps
it, and the bigger the drawing the less of it is ever in one frame:

| scale | in the stop's frame | what the stop shows |
|---|---|---|
| 1.0 | 100 % | the whole vessel — and a boat shorter than the player |
| **2.5** | **47 %** | the top edge against the sky, the funnel, four hog posts, three decks, the hull's foot on the bar |
| 3.25 | 36 % | **a wall of white deck and windows**: no wheel, no bow, no pilot house, no top edge |

3.25 also cost **10.38 MiB** of decoded texture and took the level to 34.58 of 36 MiB (96 %), which would have
needed `textureBudgetBytes` raised to 40 MiB. Two reasons, either sufficient. The rejected renders are kept
beside the shipped ones in the session scratchpad as `rejected-scale-3.25-*`.

### 13.4 The departure from art-bible §6, stated rather than discovered

**The hero is 2 300 px wide against a 1 080 px camera, and is the first hero in this game wider than the
canvas.** It is therefore not "hero-framed inside the playfield", and its single most identifying feature —
the stern wheel — is **not in the frame at the point the player stops**. Three things make that the right
trade rather than a hidden breach:

- **The blind contract is untouched.** `make verify-art` builds this subject with `singleSource()`, which
  rasterises the whole file; a verifier still sees the entire vessel, at every ratio, and
  `references.json`'s recipe now says so in terms.
- **The wheel is not lost, it is passed.** It stands at world x 2 735 … 3 120, so a player walking in from
  the spruce stand crosses it before the stop. A 64 m riverboat seen from its own gravel bar does not fit in
  one glance either.
- **The alternative is the defect.** The only way to frame the wheel at the stop is to draw the vessel at
  about its old size, which is what the audit filed.

### 13.5 Budgets, measured by `make assets`

```
before: level-payload  the-north 0.85 MiB of 8.00 MiB over 12 file(s) [1x 0.64 / 2x 0.85]
        texture-memory the-north 25.18 MiB of 36.00 MiB (70%, 11 341 624 B spare) over 12 file(s)
after:  level-payload  the-north 0.87 MiB of 8.00 MiB over 12 file(s) [1x 0.66 / 2x 0.87]
        texture-memory the-north 30.34 MiB of 36.00 MiB (84%, 5 932 024 B spare) over 12 file(s)
```

The hero itself goes from **1 030 400 B (0.98 MiB) to 6 440 000 B (6.14 MiB)**, and the level's heaviest
texture is still `atlas/shared@2x` at 10.02 MiB = 28 % of budget; the vessel is 17 %. **`textureBudgetBytes`
is unchanged at 36 MiB** and 84 % is the band Halifax, Toronto and Québec City already sit in. On ADR-0013's
baseline the honest worst case is 30.34 + ~8 of character surfaces = **about 38 of 64 MiB**. **Overdraw, by
area arithmetic and not by the perf lane** (CI owns that): the hero's on-screen rectangle at that one stop
goes from 920 × 280 = 0.12 of a screen to 1080 × 700 clipped = 0.36, so **at most +0.24 of a screen**, against
CI's measured 2.21× at `low` and 2.66× at `medium` of a 4× budget. No other level's numbers moved.

### 13.6 Placement stayed honest, and the mark was re-measured

`position.x` 3 840, `radiusPx` 340, the ground polyline at 1 280 and the level's `size` are all unchanged, and
the keel is still the frame's bottom edge, so **the hull still sits on the bar it stands on**. The art now
spans world x 2 690 … 4 990 (§3), clear of both neighbours. Measured with the real
`interaction-affordance`, `mark-clearance` and `art-silhouette` modules over the rasterised art, at the three
mark sizes the contract uses (64, 95, 122): the mark now sits at **x 3 840, 12 px above the hog-post cap**
(world y 603 / 588 / 575, against 984 / 961 / 948 before), on its own art, and **clear of the player's head in
both headings at the stop**. Before the rescale the mark had to step sideways to x 3 728 … 3 993 to stay off
the player; the taller vessel means it no longer has to move at all.

**Renders**, 390 × 844 at DPR 3, spawn and the sternwheeler stop, before and after, plus a zoomed crop of the
player beside the hull: `scratchpad/renders/sternwheeler/`.

---

## Ground dressing (ADR-0042)

| key | source | authored px | world y | decoded |
|---|---|---|---|---|
| `the-north-ground-gravel-bar` | `ground-gravel-bar@1x.svg` | 1080 × 640 | 1280 … 1920 | 2.65 MiB |

The gravel bar nearest the viewer: rounded river cobbles in light grey, dark grey and tan that grow larger toward the bottom, patches of silt sand in `stone-light`, two driftwood spars, and low willow tufts. It continues the bar of `layer-40-river-and-bar`.

**The two spars were redrawn on 2026-09-17, and the cause was the played scene, not the file on its own.** Each was a straight constant-width quadrilateral carrying a cool `white-shade` highlight, and on the bar the player walks over, a pale straight rod with a cold highlight reads as a dropped pipe or a metal pole. Neither is straight or parallel-sided now: each is a five-point curve with a swelling belly that narrows toward both ends, each end is a torn splinter broken at its own angle, and each carries one snapped stub of a limb. The cool highlight is gone — one spar takes the warm `limestone` ramp and the other the warm `stone` ramp, off the neutral greys of the cobbles around them. The cobbles themselves were not touched: a live audit called this the best-looking ground in the game, and only the wood was wrong.

### 8.1 The POI card read as milled lumber for five builds, and the CONTRACT was half the cause

**The subject on the card is unfixed and is left exactly as `origin/main` had it.** A live audit read
`prop-driftwood-pile@1x.svg` as "straight, uniform, pale spars with square dark-cut ends — a timber stack",
and rendering the shipped file at play size agrees: it reads as a stack of planks. Four redraws were tried on
2026-09-17 and **all four were rejected by the agent that drew them**, each at play size, each for a different
reason. They are recorded because the next attempt should not repeat them:

1. **Five bent spars, hand-drawn, 8–10:1, kinked edges, two-facet torn ends.** Still planks. Taper and torn
   ends are not what was doing it.
2. **Generated from an axis and a half-thickness profile, lit and shaded lenses at half the body each.** Worse:
   splitting a long shape lengthwise into a pale top and a dark underside squeezes the base tone into a seam
   down the middle, and it read as a stack of **canoes**.
3. **Same, lens fractions cut to 0.30/0.20, ends kept thick.** Read as **leather straps or shoe soles** — the
   shaded lens wrapping the blunt cap makes a sole, and at 10:1 a shaded band is a strap.
4. **Short fat billets, 3–5:1, blunt caps, shade dying before the ends.** Read as **stacked cushions or bread
   rolls**. The plank reading was gone and nothing recognisable replaced it.

**What the four attempts do establish**, and what is worth carrying into a fifth: the cause is not the ends
(attempt 1), not the tone split (2), not the end thickness (3), and not the length-to-width ratio alone (4).
What no attempt supplied is **bark, knots, grain or any surface incident** — every version was a clean
untextured solid, and a clean untextured solid of any proportion reads as something manufactured. The house
style forbids texture and noise, so the next attempt should carry the incident in **silhouette**: a forked
limb still attached, a split running in from one end, a barked section against a bare one, a curved trunk with
a root flare — features a sawmill removes, drawn as shapes rather than as surface.

Routed to the art owner as an open finding rather than absorbed. The **world** half of this defect — the two
spars on the gravel bar the player walks over — was fixed then, and is the section above.

#### The fifth attempt, 2026-09-22 — and the thing none of the first four could have fixed

A full blind pass read the shipped file as *"a stack of freshly milled squared lumber — pale planks and beams
piled criss-cross on a grey deck, with a circular saw blade at the left end… a sawmill or logging yard prop."*
Two findings, and the first is the one that matters.

**`references.json` was ASKING for the defect.** `driftwood-pile.mustBeRight` said, in as many words, *"the
shade tone for the end face"*. **A flat darker cap across the end of a cylinder is end grain, and end grain is
what a saw leaves.** Every one of attempts 1–4 obeyed that clause, so no amount of redrawing the bodies could
have cleared the reading — attempt 1 correctly concluded "taper and torn ends are not what was doing it" and
then kept the faces. An earlier build had already tried to escape by *slanting* the caps, which made them look
more sawn, not less. The clause is gone, and `neverAdd` now forbids a flat end face of any tone at any angle.

**The root fan was read as a circular saw blade, and it was a disc.** The knob at its centre was a
near-circular ellipse with a smaller, lighter, concentric ellipse inside it. `neverAdd` now forbids any disc,
ring or concentric shape anywhere on this subject — a rule worth having in general, because "an even radial
fan reads as a sunburst" had already been learned here once and the replacement quietly re-introduced the
geometry in a different place.

**What attempt 5 draws.** Every spar is a **round-capped stroke along a bent centreline**, so a flat terminus
is not expressible by construction rather than by care. The taper is three concentric round-capped strokes
narrowing toward the tip, so a spar thins like a trunk and never ends in a whittled point — a point is a stake,
and a stake is something a person made. The darker end is a darker **length** of the same cylinder, not a face
across it. The tone split that produced attempt 2's canoes and attempt 3's straps is avoided the same way it
was diagnosed: the base tone takes the lower half and the shade tone is a **thin rim on the bottom edge only**,
never a band down the middle and never a lens wrapping the cap. The root wad is four roots of four lengths and
thicknesses on one side over a small uneven knob, built from overlapping round-capped strokes, with nothing
round-and-concentric in it.

**The silhouette-incident hypothesis above was NOT taken up**, and that is deliberate rather than an oversight:
a forked limb and a split are what §8.1 proposed, and `driftwood-pile.simplifyAway` forbids branches outright
("one root fan on one log is the whole complication"). Two documents disagreed and the contract wins. If
attempt 5 fails a blind pass on the same reading, that disagreement is the next thing to resolve, and it has
to be resolved in `references.json` before it is drawn.

**Cost: none.** The canvas is unchanged at 700 × 400, so the decoded texture is identical and `the-north`
stays at **30.32 MiB of 36.00 (84 %)**; the payload moved 0.88 → **0.89 MiB of 8.00**.

**Unproven.** This is the author's account of what changed, not an identification. A fresh blind run scores it.

#### The sixth attempt, 2026-09-24 — bones and an antler, and the section 8.1 proposal taken up

Blind run `7e6b1463748d4299` passed attempt five on the harness and failed it by the verifier's own protocol: the
unprompted answer led with *"a pile of bones and possibly an antler … perhaps bison bones"*, and driftwood came
second, hedged. The verifier named both causes. **The round-capped ends read as the knobbed ends of long
bones** — attempt five had made a smooth dome the ONLY possible end, to rule out a sawn face, and a smooth dome
on a pale shaft is a femur. **The root fan read as an antler** — smooth curves rising and branching over a knob.

What attempt six draws is the proposal this section made before attempt five and set aside because the
contract forbade it; the contract was amended FIRST this time, as that paragraph asked. Each log is a filled
outline from a bowed centreline and a thickness profile, so its ends can be **broken**: a torn row of
splinters of uneven length, a different profile at each end, never a dome, never a face, never one point.
Each log carries two to four **grain checks** (short dark slivers along its length) and a **split** opening from
a broken end; three carry a **snapped limb stub**; the edges wander. The root log's butt **flares** into four
kinked roots that run low and down into the gravel, torn at the tip, with no fork, no knob and nothing
curving back. The warm `stone` ramp is cut back to one log of seven, because cream-tan on a smooth pale shaft
is bone-coloured and both references put silver-grey first. **The references are distant shore views and show
neither grain nor the shape of an end**; those are drawn from driftwood as a type, the way the gravel-bar
tile's two spars were, and `references.json` says so rather than claiming them as measured.

**Cost: none.** The canvas is unchanged at 700 × 340. **Unproven** until a blind run scores it.

#### The seventh attempt, 2026-09-24 — a beaver dam, and the ends a river actually leaves

Blind run `bde36c08332f59f9` got past the bones and the antler and read attempt six as *"a pile of sticks and
branches, most likely a beaver dam (could be a driftwood/log jam)"*. The cue written before the reveal was
*"stripped, pointed-end sticks"*, and the audit found `neverAdd`'s stake point: attempt six's torn rows of
splinters, on thin pale logs, tapered into one or two long spikes. A spiked end is a beaver's cut or a whittled
stake, and a heap of them is a dam. The subject failed on the `neverAdd`; the hedged identification would have
passed the harness on its own, which is the harness finding carried forward in `docs/art-verification.json`.

**What the three failed ends have in common.** Attempt five drew a smooth symmetric dome (a bone). Attempt six
drew splinters (a spike). Before them, a flat face (a saw). Each one answered the previous reading by drawing a
different thing a river does *not* leave. A river rolls a broken end until the splinters are gone and the break
is rounded over; it does not make a ball of it. So attempt seven draws that: **blunt, full width to the very
end, rounded over into a lopsided bevel with one shallow worn dip**, and a different profile at each end. The
cap is a flattened curve (about 0.8 of the half-width deep, flatter than a semicircle) skewed toward one side,
so it can't be a dome, a point or a face. A bone's end is a knob *wider* than its shaft; these ends narrow a
little into the cap and never swell. `neverAdd` now says that exactly, rather than forbidding all roundness.

**What reads as a dam, and what was changed for each:**

1. **Many thin sticks in a heap.** The logs are fewer-looking and much thicker: the root log is 54 px at the
   butt, and every log tapers from butt to top the way a trunk does. They lie loose and lopsided, crossing but
   not woven — nothing goes over-under-over — with six in the pile and one lying apart on the beach in front,
   because a river's debris is scattered and a tidy heap is made.
2. **Warm tan wood.** The one `stone` log was the brightest thing in attempt six. `stone` is now off the wood
   entirely: six logs in `path`, the palette's only near-neutral and the silver-grey both references put
   first, and one in `limestone`. The wood is lighter than the shingle under it, so it still separates.
3. **Pointed stubs and root tips.** Limb stubs and the four roots now end blunt and worn like the logs. The
   roots flare out of the butt, low and down into the shingle, and are drawn *under* the butt so no seam shows.
4. **The shore.** The old ground was a narrow flat band, which with a heap of sticks on it gives no reason to
   think *shore*. It is now a broad shingle beach with randomly laid cobbles, bigger toward the viewer, and a
   thin dark drift line of fine debris along its crest, running out of both sides of the frame. **No water was
   drawn, on purpose.** Water behind a pile of wood is the dam picture, and a strip of water with ground beyond
   it is a stream. The river is the level's own parallax behind the prop, where it is broad and has no near bank.

The grain checks, one split per log, three limb stubs and the one-sided root fan that attempt six added are
kept, since they are what separate wood from bone. `references.json` was amended **before** the file was
redrawn, as this section has asked since attempt five: the ends, colour, root-tip, stub and shore clauses, two
`neverAdd` entries sharpened (the knob is now "wider than the shaft", the point now covers roots, stubs and
spiked splinters) and two added (no water; no woven lattice or mound spanning the frame).

**Author's reading, not an identification.** Rendered at 1× on the hand-off's grey matte, and at 300 px and
140 px wide, it looks to its author like weathered grey logs on a pebble beach, with the root fan the only
complication. The previous six attempts also looked right to whoever drew them. A fresh blind run is the test.

**Cost: none.** The canvas is unchanged at 700 × 340, so the decoded texture is identical. The SVG source grew
from 43 KB to about 100 KB, because each outline is sampled more finely. What ships is the rasterised WebP, and
`make assets` measures that.

A repeating strip over the ground fill and under every landmark, character and ride, at every visual tier, moving exactly with the world. 1080 px wide (one tile per screen), pinned to 1x, opaque in every row, and ending on the bottom of the world, so the scene paints no ground fill under it. Palette colours only, no outline, no lettering, no figures. Its most legible detail is in its first ~160 rows, which stay visible above the HUD with a prompt showing.
