# Peggy's Cove level art — layers, offsets, budgets and the decisions behind them

Level 2 — **Who We Are**, locomotion **walk**. Sources are `assets/src/svg/peggys-cove/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. Design resolution 1080 × 1920, portrait, ground polyline at
**y = 1280**. A clear Atlantic morning.

---

## 0. The block, what lifted it, and what is still owed

`docs/stories/TN-LEVELS-2-to-10-spine.md` lists level 2 with **no id, no place, no landmark and no NPC**, and
says why: `docs/content-review.md` §1's shipping rule, item 5 — *"any level whose **subject** is a nation's
territory or history"* — does not ship until a Tier 3 reviewer has granted review, and this project has none.
The spine also flags `OQ-REVIEW-10` against the level's proposed **canoe**.

**Neither of those two things has been decided in this level's favour, and this level does not need them
decided.** The distinction the whole level rests on is written in §1's own may-ship list, item 5:

> **A territorial fact line** … because it is a citable fact, verified like any other under ADR-0003. This is
> not the same thing as a land acknowledgement.

and in `TN-LEVELS-02`'s second scenario, *"A citation is not a depiction"*. So:

| §1 asks | this level |
|---|---|
| Is the level's **subject** a nation's territory or history? | No. Its subject is *Discover Canada*'s **Who We Are** chapter and its bank key is `who-we-are`. Its **place** is a fishing village in Nova Scotia, named as a village. |
| Does anything in it **depict** a nation? | No. **Nothing in this level depicts any person at all** — see below. |
| Does it carry a **territorial fact**? | Yes, quoted from a Mi'kmaw body's own published words. That is §1's may-ship item 5. |
| Does it declare a locomotion mode `OQ-REVIEW-10` blocks? | No. It declares `walk`. See §9. |

This is the same shape as `halifax`, which has shipped since slice 1 on the same coast, in the same
territory, with a territorial fact and no depiction. What is different here is only that this level's fact is
sourced **better** (§8).

### No figures. Not "no cultural markers" — no figures.

`docs/content-review.md` §3.3 outcome 2 permits an unmarked person: `vancouver/layer-40-seawall.svg` draws
four, with no cultural marker of any kind, and that is allowed. **This level draws none, anywhere, at any
scale**, and it is a decision rather than an omission:

- `neverAdd` on **both** of this level's subjects in `references.json` carries *"a figure of any kind, at any
  scale, including a silhouette and a crowd"*, so the prohibition is a checked contract clause and not a
  paragraph in a sheet — the arrangement `assets/style/vancouver-level.md` §0 used for the totem poles and
  the inuksuk, and the one warning in `TN-LEVELS` that can be marked as having worked;
- every reference photograph of this place has visitors in it, and every one of them was dropped;
- the reason is not that an unmarked figure would be wrong. It is that this is the first level whose place is
  named as being in a named nation's territory in its own words, and the cheapest way to be sure that no
  figure on it is read as a depiction of anybody is for there to be no figure on it.

### The Tier 3 obligation, written as an obligation

- **OBLIGATION due=2026-12-08 owner=po** — put this level, `content/levels/peggys-cove.json` and the two
  `peggys-cove-*` subjects in `assets/refs/references.json` in front of a Tier 3 reviewer from the **Mi'kmaq**
  — `docs/content-review.md` §1, and §12's `OQ-REVIEW-2`, which this date is deliberately the same as — and
  record the answer. **What a reviewer still needs to check, and what no gate and no agent in this repository
  can:** (1) whether the territorial statement in the level document is an honest use of Kwilmu'kw
  Maw-klusuaqn's words rather than an extraction of them; (2) whether quoting the Assembly of Nova Scotia
  Mi'kmaw Chiefs in a **game** is wanted at all, and whether being quoted in an About-this-place panel is the
  form they would choose; (3) whether naming this place "Peggy's Cove" and not naming the Mi'kmaw name for
  this coast is a silence that should be filled or one that should be left; (4) whether a level set here that
  depicts **nobody** reads as respect or as erasure — `docs/content-review.md` §10.3 says plainly that naming
  the territory and depicting nobody from it *"is a half-step … It is not the thing that would be right"*,
  and this level is exactly that half-step; (5) whether anything in the art — the rock, the stores, the
  water — carries a meaning an outsider cannot see. **Nothing in this repository may record an answer to any
  of these.** Per §1, an agent may write `communityReview.status = "not-sought"` and nothing else, and none
  is written here.

- **AND THIS MARKER IS NOT CHECKED BY ANYTHING, WHICH IS SAID HERE RATHER THAN LEFT TO BE DISCOVERED.**
  `scripts/check-obligations.mjs` scans `*.md` under **`docs/`** and nothing else, so an ADR-0009 marker in
  `assets/style/` is decoration. `docs/` is not this artist's to edit. **The one-line fix is routed in §10**:
  copy this marker into `docs/content-review.md` §13, beside the one that is already there, or point the gate
  at `assets/style/` as well. Until one of those lands, the obligation above is a promise with no clock on
  it — which is the class of defect this project spent a session removing, recorded so the next person can
  close it in one commit.

### What was considered and refused

- **A level "in Mi'kma'ki", with Mi'kma'ki as the place name.** Refused. That is §1 item 5 exactly — the
  level's setting would *be* the nation's territory — and `TN-LEVELS`'s copy table already says that
  level 2 having a subject line and no place name "is the correct output of the rules above rather than an
  omission". A village is a village.
- **The word "unceded".** Not used, although it is true, defensible and the word nearly every Canadian
  institution would reach for. The cited page does not use it. It says *"never surrendered, ceded, or sold"*,
  and the statement says that. Same discipline as `content/levels/quebec-city.json` and
  `content/levels/vancouver.json`, both of which leave the word out for the same reason.
- **The Mi'kmaw name for this place or this district.** Not written, because no source this level cites
  carries one. Halifax's document names **Mi'kma'ki** on the strength of a Crown page; this level cites a
  Mi'kmaw body, and that body's page does not use the word in its own text. Adding it from elsewhere would be
  two documents behind one sentence, which is `OQ-VANCOUVER-4` repeated on purpose. Recorded in
  `content/sources/kmk-about-consultation.json` `knownStaleness`.
- **A canoe, as locomotion or as scenery.** `OQ-REVIEW-10` is unanswered and there is no canoe rig art. §9.

---

## 1. What was produced

| key | source | authored px | shapes | what it is |
|---|---|---|---|---|
| `peggys-cove-layer-10-sky` | `layer-10-sky.svg` | 1080 × 900 | 141 | one flat `sky-base` field and five rows of stratocumulus rolls |
| `peggys-cove-layer-20-open-sea` | `layer-20-open-sea.svg` | 1760 × 260 | 126 | the open Atlantic: haze band, three water tones, a wooded headland, two skerries, two boats |
| `peggys-cove-layer-30-cove` | `layer-30-cove.svg` | 1760 × 270 | 480 | the far side of the cove: spruce, granite shore, seven fish stores on piles, a wharf, three boats, reflections |
| `peggys-cove-layer-40-granite-barrens` | `layer-40-granite-barrens.svg` | 1920 × 280 | 193 | the barrens: jointed rock, grass in the joints, four erratics, two tide pools |
| `peggys-cove-landmark-lighthouse@1x` | `landmark-lighthouse@1x.svg` | 480 × 900 | 63 | **POI hero, and the level's only place-anchor** |
| `peggys-cove-prop-granite-erratic` | `prop-granite-erratic@1x.svg` | 560 × 380 | 22 | **POI hero, added 2026-09-13**: two rounded boulders on jointed pavement with a tide pool |
| `peggys-cove-prop-fish-store` | `prop-fish-store@1x.svg` | 620 × 520 | 40 | **POI hero, added 2026-09-13**: a red store on timber cribbing over the water |
| `peggys-cove-prop-fishermans-house` | `prop-fishermans-house@1x.svg` | 640 × 560 | 62 | **POI hero, added 2026-09-13**: a clapboard house behind a picket fence with wild roses |

Shape counts are reported, not gated (ADR-0025). The hero is **63 shapes**, between the CN Tower's 49 and the
Halifax Town Clock's 113, and it identifies at 120 px (§6.4).

## 2. The parallax stack

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | sky | 1080 × 900 | 0 … 900 | 0.04 / 0.02 | true | **972 000** | yes | **yes** |
| 20 | open-sea | 1760 × 260 | 700 … 960 | 0.13 / 0.05 | true | 280 800 | yes | no |
| 30 | cove | 1760 × 270 | 840 … 1110 | 0.30 / 0.13 | true | 291 600 | yes | no |
| 40 | granite-barrens | 1920 × 280 | 1000 … 1280 | 1.00 / 1.00 | true | **302 400** | yes | **yes** |

Coverage is `app/adapters/phaser/level-effects.ts` `selectLayers`' own measure — screen width 1080 × the
band's visible height, bottom clipped at the highest point of the ground polyline (1280) — not the tile's own
width. **The ranking was designed before the tiles were drawn, and one band was made taller on purpose.** At
`low` the preset keeps two layers, and the two that win are the **sky** and the **barrens**: a white
lighthouse on bare granite under an Atlantic sky is the postcard of this place, so the low tier is the
picture rather than a broken version of it. The cove at 291 600 ranks third and loses to the barrens' 302 400
by 10 800, and that margin is the tightest in the game — **it is also the third arrangement of these four
bands, and the first two are recorded in §6.3 because both were wrong for reasons a render showed and a
number did not.**

### The opaque feet

Every number here is **measured from the shipped raster's alpha channel**, not asserted:

| tile | first ink | first fully opaque row |
|---|---|---|
| open-sea | world 700 (its own top edge) | world 700 |
| cove | world 840 (its own top edge) | world 866 |
| granite-barrens | world 1024 | world 1110 |

The cove tile's **last** row is world 1110 and the barrens tile's first fully opaque row is world 1110, so
**the seam closes to the pixel** and no band shows the theme gradient at any tier. Above that line the
barrens is deliberately **not** opaque: its rock crests stand against transparency from world 1024 down, so
the cove's wharf, stores and water show **between** the crests. That is the view from the barrens and it is
why the two tiles are one `verify-art` subject.

### The sky is one flat field, and its clouds are the only ones of their kind

Same reason as Winnipeg's, the Prairies', the Alberta foothills' and Vancouver's: at `low` this level keeps
the sky and the barrens, and the barrens tile is transparent everywhere above world 1024, so there is no
nearer opaque layer inside the sky's band to hide a band step behind. One flat `sky-base` field has no step
to hide, and the field **is** the level document's `theme.sky`.

**STRATOCUMULUS ROLLS — lumpy-topped, flat-based bars in regular rows, smaller and closer together toward
the horizon.** That is the sixth distinct cloud treatment in the game and the only one of its kind: Halifax
has seven cumulus, the Alberta foothills six fair-weather cumulus, the Prairies six flat-bottomed cumulus
banks, Winnipeg six thin banks, Toronto five soft banks and Vancouver eleven cirrus streaks. A seventh
cumulus would have made this sky indistinguishable from three others at a glance.
`refs/peggys-cove/lighthouse-elevation.jpg` is a rippled stratocumulus deck and is where the form came from;
it is fully overcast, and the drawing is lightened to the weather in
`refs/peggys-cove/granite-barrens-and-sea.jpg`, which is the day this level is set on.

### Nothing identifying is on a repeating layer

All four repeat. The headland is a landform with a conifer fringe; the skerries are rocks; the stores, the
wharf, the piles and all five boats are **types** with no name, number, livery or funnel mark; the rock, the
grass and the tide pools are rock, grass and water. **No lighthouse appears on any repeating layer** — it is
the hero, it is drawn once, and `neverAdd` says so on the tile subject.

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way**, five points at x 0 / 1760 / 3520 / 5280 / 7040. Flat,
  like seven of the other eight levels: the barrens *are* a rolling whaleback, and the roll is drawn in the
  tile **above** the walk line rather than in the polyline, because a sloping polyline under a tile authored
  for a flat band is a tile that no longer meets the ground.
- **`size.x` 7040**, four cove tiles and three and two thirds barrens tiles: about 17 seconds at the walk's
  420 px/s, between Québec City's 6048 and Halifax's 7200.
- **`spawn`** `(420, 1280)`.
- **Layer offsets** are `y` 0 / 700 / 840 / 1000, in depth order.
- **Four points of interest, not one.** §12 is the table, the spacing and what each one teaches.
- **`poi.peggys-point-light.position.x` 3200**, `radiusPx` 300. (It was 3520, the exact middle of the level,
  until the arrival-line measurement on 2026-09-13; §13 is the move and why the middle could not be kept.)
  The hero is
  480 × 900, so it occupies world x 2960 … 3440 and world y 380 … 1280. **No row of it is empty** — unlike
  `five-sails`, which is a pier and needed 280 rows of nothing under it, this building stands on rock and is
  drawn tight to its own base, and the barrens tile passes **behind** it.
- **`camera`** `followLerp` 0.12, `deadZone` (60, 120), `offset` (150, −260), `zoom` 1. With the player on
  the ground the camera top sits at world y 60, so the visible band is world 60 … 1980: the lantern lands at
  screen y 346 … 601 and the lower 640 px of the screen is flat `theme.ground`, free for the question card
  (ADR-0002).
- **`theme`**: `sky` `#3d8ccb` (`sky-base`), `ground` `#afaca5` (`path-light`), `horizon` `#a9d0e5`
  (`ice-base`). Derivations and measurements in `palette.json` `levelTheme.peggys-cove-atlantic-morning`.
  **`path-light` is used as a level ground for the first time**, and the horizon took three attempts: the
  rule is that no two of the nine triples are equal and none differs from another in only **one** of its
  three, and `sky-light` would have collided with Vancouver's, `cloud-light` with Halifax's and `cloud-base`
  with Québec City's. `ice-base` is the only pale band left, and it is right anyway — it is the sea haze.
  **Checking that rule across all ten triples found it already broken twice, by levels that shipped before
  this one:** Ottawa's triple differs from Québec City's in one of its three and from Vancouver's in one.
  Neither of today's two levels violates it against any of the other nine. Recorded in `palette.json` and
  routed, because a rule two shipped levels fail is not this level's to satisfy quietly.
- **`locomotion`** declares **`walk` and nothing else**, with Halifax's numbers unchanged:
  `maxSpeed` 420, `acceleration` 2400, `deceleration` 1900, `turnAcceleration` 2100 (strictly between the
  other two), `glide` 0.10. §9 is why there is no second mode.
- **`quests` and `characters` are both empty**, and that is still true after §12: a POI is not a character,
  and the three added carry no figure of any kind. Like Winnipeg, the Prairies, the Alberta foothills and
  Vancouver as first built, this level is finished by reaching its end (`TN-DONE`). §10 routes the quest.

## 4. Every effect has a plain path (ADR-0011)

No `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or `url(#…)` anywhere;
`make assets`' palette lint checks it and reports every declaration it read. Water is three flat `water`
tones with straight ripple bars. Reflections are flat vertical bars in the reflected object's own tones,
broken by ripple bars — never a blur. AO is flat `ao-shadow` at 0.28 at ground contacts and 0.18 at overlaps.
**No falling weather, no fog, no spray.**

## 5. Budgets, measured

```
level-payload:  OK - peggys-cove 0.52 MiB of 8.00 MiB over 12 file(s) [1x 0.39 / 2x 0.52]
texture-memory: OK - peggys-cove 26.32 MiB of 36.00 MiB (73%) over 12 file(s)
                     [1x device 18.08 MiB / 2x device 26.32 MiB]
                     heaviest atlas/shared@2x 2045x1531 11.94 MiB = 33% of budget
```

**Re-measured 2026-09-13** with §12's three POI heroes in. They cost **3.41 MiB between them** — erratic
0.81, fish store 1.23, house 1.37 — and they are the whole of the move from 22.91. The level's own files are
now 14.38 MiB; its honest worst case on ADR-0013's baseline is 14.38 + 11.94 + ~8 = **34.3 of 64, 54 %**. The
figures below are the 2026-09-08 measurement and stand as the derivation they explain.

The level's own files are **10.97 MiB**: four layers at 9.32 and the hero at 1.65. Its honest worst case on
ADR-0013's baseline is 10.97 + 11.94 + ~8 = **30.9 of 64, 48 %** — within a rounding of what Vancouver
reports, and it is the same arithmetic producing it.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost **9.32 MiB**; authored 1920 tall at the
   same widths they would cost **47.0 MiB** and this level would be over budget before the hero was placed.
2. **The hero is pinned to 1×**: 1.65 MiB instead of 6.59. It is a POI hero the player taps, which is what 2×
   is for, and it was still pinned — a squat building with no small ornament survives it, and §6.4 is the
   check rather than the argument.
3. **The barrens tile is 280 rows and the cove tile 270 because of the `low` preset**, not because of the
   budget: the barrens has to out-cover the cove or the tier most phones get loses the ground the level is
   about. §2 is the reasoning and §6.3 is the two builds it took. **24 of the barrens tile's 280 rows carry
   no ink at all** — 8.6 %, 0.18 MiB — which is the sky between its rock crests, and it is measured and
   stated rather than left in the coverage number unexamined.

## 6. The landmark

### 6.1 What was measured

Measured on `refs/peggys-cove/lighthouse-elevation.jpg` (1600 × 1067), **in the column through the tower's
axis**, which is the least foreshortened part of the only reference that shows the whole building square on.
The denominator is **H = the finial tip at y 150 to the foot at y 690 = 540 px**.

| ratio | measured | drawn (H = 840) |
|---|---|---|
| ball finial and its conical cap ÷ H | 24/540 = **0.044** | 37/840 = 0.044 |
| red conical roof ÷ H | 38/540 = **0.070** | 59/840 = 0.070 |
| glazed lantern ÷ H | 49/540 = **0.091** | 76/840 = 0.090 |
| solid red panel ÷ H | 37/540 = **0.069** | 58/840 = 0.069 |
| gallery deck ÷ H | 16/540 = **0.030** | 25/840 = 0.030 |
| concave corbel ÷ H | 21/540 = **0.039** | 33/840 = 0.039 |
| tapered shaft ÷ H | 355/540 = **0.657** | 552/840 = 0.657 |
| gallery deck width ÷ H | 210/540 = **0.389** | 327/840 = 0.389 |
| shaft width at the top ÷ H | 142/540 = **0.263** | 221/840 = 0.263 |
| shaft width at the foot ÷ H | 226/540 = **0.419** | 354/840 = 0.421 |

The taper and the flare fall out of the last three rows and are the rows to check: the shaft is
**1.59× wider at the foot than at the top**, and the deck is **1.48× wider than the shaft is under it**.

### 6.2 The two numbers that are the identification

**`total height ÷ base width = 540/226 = 2.39`, drawn at 2.37.** A lighthouse drawn four to six base widths
tall is the default, is what almost every cartoon lighthouse is, and is a different building. This one is
squat, and squat is the read.

**`the red assembly ÷ H = 164/540 = 0.304`.** Nearly a third of this lighthouse is its red top. A small red
cap on a tall white tower — the other default — fails both numbers at once.

Neither of these should use the art bible's ±10 %.

### 6.3 Four things were drawn twice, and one of them was the whole stack

1. **The entry porch.** Build one drew it white on a white tower with no shadow. Rendered, it was a smudge:
   the eye read the tower's foot as ragged rather than as having a building against it. It now carries a
   `slate` lintel band, a shaded strip on the shaft to its right at `ao` 0.18 and an AO band under its own
   eave. **This was invisible in the SVG and obvious in the first render**, which is `art-bible.md`'s own
   instruction restated for the ninth time in this project.
2. **The grass in the joints.** Build one scattered tufts over the rock and the barrens read as a mown
   meadow; build two drew them as continuous bands and they read as green hoses lying on the stone. They are
   now **broken runs of low tufts that follow a joint line and taper at both ends**, and they exist nowhere
   else on the tile. Bare rock is the subject; grass is what grows in the cracks in it.
3. **The sky.** Build one's rolls were uniform pill shapes in a lattice and read as capsules. They are now
   lumpy-topped and flat-based, with the row offsets jittered so the rows do not align into a grid.
4. **The four parallax bands, twice, and this is the expensive one.** Build one put the barrens at world
   960 … 1280 over a cove at 880 … 1160, and **132 of the barrens tile's 320 rows carried no ink at all** —
   1.0 MiB of nothing, and a `selectLayers` coverage number 41 % larger than the picture behind it. Raising
   the rock to fill its own band fixed the arithmetic and **walled the harbour off**: the composite showed
   granite in front of the stores' doors and no cove water anywhere. The third arrangement lowers the rock
   (crests to world 1024, opaque from 1110) and lifts the cove 40 px (world 840 … 1110) so its stores stand
   clear of the crest line and its bottom row IS the barrens' first opaque row. **None of this was visible in
   any SVG and all of it was obvious in one composite**, which is `art-bible.md`'s own instruction restated
   for the tenth time in this project — and the second build's defect was found by a number rather than by an
   eye, which is the argument for measuring a tile's alpha instead of trusting its author.

**And the second build shipped a real disagreement for about an hour**, which is worth carrying because it is
how the defect was caught: `references.json` said the offset between the two tiles was 80, the level document
said 120, and `scripts/lib/art-handoff.mjs` refused to choose and wrote both numbers down beside a
measurement of what the tiles actually drew. The offset is **160** now, both files say so, and the
`renderRecipe` records that it said two other things first.

### 6.4 The two-size test, and the 1× pin

At 25 % (120 × 225) the finial, the red roof, the glazing, the red panel, the railing, the deck flare, all
three windows and the porch are each still separable. As a **pure black silhouette 120 px tall** it is a
short flare-topped cone under a wide brim with a small cap on top: a lighthouse and nothing else this game
will draw. Both probes pass, which is what allows the 1× pin.

### 6.5 The colour decisions, and no ramp was added

- **Red.** The reddest decile of the roof cone on `lighthouse-elevation.jpg`, 200 × 36 at (420,176), has
  median **hsl(342, 97 %, 22 %)**, and the lantern's solid panel, 115 × 34 at (419,262), has median
  hsl(350, 98 %, 18 %). Against `flag-red-shade`'s hsl(346, 72 %, 34 %) that is four to eight degrees of hue;
  the 97–98 % saturation is that photograph's own edit and is stated rather than used. `serge`, the palette's
  other red, is hsl(4, 65 %, 47 %) — **twenty-two degrees away** — so `flag-red` is the nearer of the two
  existing reds and a lantern red would have been a duplicate.
- **Granite.** Two clear-day medians on `granite-barrens-and-sea.jpg` read hsl(40, 23 %, 71 %) and
  hsl(33, 17 %, 50 %) — two to six degrees of hue and two to four points of lightness from `path-light` and
  `path-base`, but **eleven to seventeen points more saturated**. Two flat-light medians of the same rock, on
  `lighthouse-elevation.jpg` and `lighthouse-on-the-granite.jpg`, read hsl(0, 5 %, 49 %) and
  hsl(50, 2 %, 46 %) — **one to four points less saturated**. The ramp sits inside the bracket, and a granite
  ramp would have been a second near-neutral in a palette whose whole claim is that it has one.
- **Red-oxide stores.** `oxide` unchanged and unmeasured, for the first time: they are red-oxide paint on
  board-and-batten timber, which is the material that ramp was authored from, on the same construction as the
  prairie grain elevator and the Bar U barn.
- **Sea and sky.** Open sea hsl(205, 30 %, 39 %) against `water-base`'s hsl(199, 62 %, 45 %) — the same
  hue-matches-saturation-does-not gap `vancouver/layer-30-inlet.svg` records. Open sky hsl(204, 47 %, 54 %)
  against `sky-base`'s hsl(207, 58 %, 52 %).

Every material note amended in `palette.json` says which level made it say so.

## 7. Where the place name comes from, and the risk in it

**`peggys-cove-light` is the only render on this level allowed to demand a place name, and this level's place
rests on it alone.** `peggys-cove-barrens` is two repeating tiles and is asked for a rocky fishing harbour
and never for a place.

**And it is a harder ask than `five-sails`, which is written into the contract rather than hoped away.**
Canada Place is one building of its kind in the world. There are several hundred lighthouses in Nova Scotia,
and a verifier who answers *"a lighthouse on the Atlantic coast"* is not wrong, only unhelpful, and is scored
a miss. The claim this level makes is that the **proportions** identify it — §6.2 — and that this is the most
photographed lighthouse in Canada. **If a real blind pass returns only a type and never the place, the
finding is that this level has no place anchor**, and the honest fix is a second cited point of interest, not
a longer answer list. `references.json` says so in the subject's own note.

The word `lighthouse` is deliberately **not** an accepted answer: partly for the reason above, and partly
because every word of four letters or more in `expectedBlindAnswer` becomes a leak token the hand-off refuses
in its own briefing text, and `light` is a word a briefing can plausibly use.

**Three phrases were struck from the tile subject's answer list by that gate rather than by taste.** `make
verify-art` refused `fish sheds over the water`, `a small harbour with fishing boats` and `a rocky shore with
a fishing harbour` because each contributed an ordinary English word — *over*, *small*, *with* — that the
hand-off's own briefing already contains. `pier-21`'s note states the rule and `five-sails` is its most
expensive instance; this is the cheapest, because every dropped phrase has a synonym that survives.

## 8. The territorial statement, and the thing it does better than eight levels

`content/levels/peggys-cove.json` states a territorial **fact** (`docs/content-review.md` §10.1), quoted from
**Kwilmu'kw Maw-klusuaqn, the Mi'kmaq Rights Initiative of the Assembly of Nova Scotia Mi'kmaw Chiefs**:

> Mi'kmaq have never surrendered, ceded, or sold the Aboriginal Title to any of our lands. We have a Title
> claim to all lands in Nova Scotia.

Cached as `content/sources/kmk-about-consultation.json`, with a **recorded, reproducible extraction command**
— `npm run sources` re-derives its digest, which five of the ten registers in this project still cannot do.

**This is the first level whose `fact.source` and whose `nationSource` are the same body, and that body
speaks for the nation the statement names.** It is worth stating beside what the other levels have:

| level | territorial fact from | nations named | nation source |
|---|---|---|---|
| `halifax` | **the Crown** (CIRNAC, Peace and Friendship Treaties) | Mi'kmaq | this organisation's home page |
| `winnipeg` | Parks Canada | **seven** | one page (`OQ-WINNIPEG-3`) |
| `quebec-city` | the Huron-Wendat Nation's own brief | Huron-Wendat | the nation's own |
| `vancouver` | the Tsleil-Waututh, for one of three | **three** | a corporation the three own jointly (`OQ-VANCOUVER-4`) |
| `alberta-foothills` | the Crown's transcription of Treaty 7 | seven | the Chiefs' association |
| **`peggys-cove`** | **the Assembly's own words, first person** | **one** | **the same body, the same page** |

`halifax` is the row to look at: it is the **same nation** and the **same coast**, and its fact comes from a
Crown page about eighteenth-century documents while this one comes from the Assembly saying what it says
about its own lands today. `content/sources/kmk-about-consultation.json` `knownStaleness` routes that: when
Halifax's statement is next revisited, move it onto this register.

Three smaller things, recorded so nobody has to rediscover them:

- **The quote starts mid-sentence.** The paragraph opens with a CSS drop cap, so the extraction renders it as
  `T he Mi'kmaq have never surrendered`. The quote begins at `Mi'kmaq have never…` so that it is a contiguous
  substring of the cached bytes, as ADR-0003 requires. Do not "fix" it by adding `The`.
- **`volatile` is `true`**, and for half the sentence. *Never surrendered, ceded or sold* is a statement about
  the absence of a historical cession and does not expire; *we have a Title claim to all lands in Nova
  Scotia* describes a position inside a running negotiation and can be overtaken without the page being
  rewritten.
- **The organisation's name is not translated**, in either direction. It appears in the French statement in
  English, because `docs/content-review.md` §9.3 requires `Mi'kmaw` to be identical in both languages and a
  French rendering of the name would have to change it. `Mi'kmaq` is `Mi'kmaq` in the French string.

## 9. The canoe, and why this level walks

`content/game.config.json` lists **`canoe`** among its nine locomotion modes. **No level declares it, and no
rig art exists for it.** A level declaring `canoe` today would animate a walking figure under a HUD label
that says otherwise — which is worse than not having the mode.

There are two separate reasons this level does not declare it and **either one alone is sufficient**:

1. **`OQ-REVIEW-10` is unanswered.** `docs/content-review.md` §5.4 names the canoe and the kayak as
   Indigenous technology used as generic Canadian symbols, and adds the sentence that settles it: *"A canoe as
   a vehicle the player rides is exactly the prop case in §5.1's second test."* `TN-LEVELS-02` makes a level
   document declaring `canoe` a build failure with no override. That is not a rule to route around.
2. **There is no art.** The rig now supports mode-specific poses and equipment (`rig-contract.md` §11, which
   `skateboard` exercises), and a canoe would need, at minimum: a `canoe/idle` and `canoe/moving` pose with a
   seated torso and a paddle cycle; a `mount-hull-canoe` equipment frame; a paddle as a held prop; a water
   line and a wake the mode owns; and `jump` and `airborne` bound to nothing, because the mode cannot jump.
   That is a slice, not a frame.

**`walk` is not a placeholder for a blocked mode.** It is the mode a person crosses bare granite in, this
level is 7040 px of bare granite, and `TN-MOVE` already has its row.

## 10. What this level needs that is not in `assets/` or `content/levels/`

Every item is a line somebody else owns. Nothing here is blocking the art.

1. **`scripts/lib/art-handoff.mjs` `RECIPES` needs two builders**, or `make verify-art` refuses this level's
   subjects by name — which is the harness working, not failing:
   `'peggys-cove-light': singleSource(),` and
   `'peggys-cove-barrens': twoParallaxTiles({ farMatch: 'cove', nearMatch: 'barrens', nearTop: 80, what: 'a fishing cove and a granite foreshore' }),`
   `nearTop` is 80 because the barrens tile sits at world 960 and the cove tile at world 880.
2. **`content/game.config.json`** needs `peggys-cove` in `levels`, in `unlockRules.order` after `halifax`,
   and in slot 2 of `journey` — which is one of the two `null`s that have been reserved for this level since
   the config was written.
3. **`app/ui/copy.ts`** needs this level's strings: `level.peggys-cove.title` ("Peggy's Cove" / « Peggy's
   Cove ») and `level.peggys-cove.subtitle` ("Who we are" / « Qui nous sommes ") — the second is already
   written in `TN-LEVELS`'s copy table under the key `level.2.subtitle` and needs rekeying now that the level
   has an id — plus the waiting sentence, the error title, the stamp sentence and the play label that
   `TN-WAIT` and `TN-DONE` require of every built level.
4. **`docs/stories/`** — `TN-LEVELS-2-to-10-spine.md`'s table still reads *not fixed / not scoped / Blocked*
   for row 2, and its §"Three things that block work in this table" item 1 needs the distinction in §0 above
   written into it: the block is on the **subject** and on **depiction**, and a level whose subject is
   *Who We Are* and whose place is a village is not that level. `TN-LEVEL-peggys-cove.md` is the partial
   story file this level now needs, on the pattern of `TN-LEVEL-vancouver.md`.
5. **`docs/content-review.md` §13** — copy §0's obligation marker there, or teach
   `scripts/check-obligations.mjs` to scan `assets/style/` as well. See §0.
6. **`content/quests/`** — this level has no quest and no character. If one is authored, the level document
   gains a `quests` entry, a `characters` entry and a `questId` on the point of interest, and nothing else
   changes. The art is unaffected either way.

## 11. One toponymic note, because it will be queried

The Canadian Geographical Names Database drops the possessive apostrophe: **Peggys Cove**, **Peggys Point**.
Every player-facing string on this level uses **Peggy's Cove** and **Peggy's Point Lighthouse**, with the
apostrophe, because *Discover Canada* itself does — its page 94 picture caption reads *"Peggy's Cove harbour,
Nova Scotia"* — and this game teaches that document. `expectedBlindAnswer` accepts **both** spellings, which
costs nothing and removes the question from the blind pass.


---

## 12. Four points of interest, and where they sit

**Added 2026-09-13.** The level shipped with one POI in the middle of a 7 040 px walk. It now has four. The
size, the ground line, the four layers, the theme, the locomotion and the territorial statement are all
unchanged, and **§0 holds without an amendment**: the three new heroes depict nobody, and each one carries
`a figure of any kind, at any scale, including a silhouette and a crowd` in its own `neverAdd`, exactly as
the original two subjects do.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 1 500 | `granite-shore` | `peggys-cove-prop-granite-erratic`, 560 × 380 | three oceans line Canada: Pacific west, Atlantic east, Arctic north — and this is the Atlantic edge | *Discover Canada* p. 93 |
| 3 200 | `peggys-point-light` | `peggys-cove-landmark-lighthouse`, 480 × 900 | the Acadians, the deportation, and Acadian culture today | *Discover Canada* p. 19 |
| 4 700 | `fish-store` | `peggys-cove-prop-fish-store`, 620 × 520 | Atlantic Canada's coasts and its natural resources — fishing, farming, forestry, mining | *Discover Canada* p. 96 |
| 6 200 | `village-house` | `peggys-cove-prop-fishermans-house`, 640 × 560 | most Canadians live in cities, and Canadians also live in small towns and rural areas | *Discover Canada* p. 94 |

**Gaps of 1 700, 1 500 and 1 500 px**, inside the 1 500–2 500 band. The house at 6 200 is 640 wide, so its
right edge is world 6 520 against a level 7 040 wide.

**Three of those four numbers changed later the same day, and §13 is why.** They were 3 520, 5 200 and 6 700
for the hours between the respacing and the arrival-line measurement, with gaps of 2 020, 1 680 and 1 500 and
the hero in the exact middle of the level, where §3 put it and where the composition wanted it. The house at
6 700 stood **200 px past the x at which this level tells the player it is over**, and the three numbers are
one chain: the floor between points is what carried the correction back up the walk to the hero.

**The walk now has a shape.** Bare rock at the Atlantic edge, then the light, then the working waterfront,
then the village. That order is the level's own geography read left to right, and it is why the house is last
rather than first.

**What was refused, and it matters more on this level than on any other.** Two objects were wanted for these
positions and neither was drawn: **a stack of lobster traps** and **a hauled-up dory**. There is no
licence-clean photograph of either in this repository, so both would have been drawn from memory — and a
wrong lobster trap on this coast is the kind of error a person who lives there sees immediately. `neverAdd`
on `fish-store` now forbids exactly those two objects on that subject, so the temptation to dress the store
with them is a contract clause rather than a note. The erratic took the position instead, and it takes the
better fact.

**Scenery, and why none was added.** These four tiles already carry seven fish stores, a wharf, five boats,
four erratics, two tide pools, spruce, grass in the joints and two skerries; `layer-30-cove.svg` alone is 480
shapes. The corridor was not short of things to look at — it was short of things to stop at. Every byte spent
here went into the four things a player can now tap.

**`references.json` gained three subjects**: `granite-erratic`, `fish-store` and `fishermans-house`, each
with real `renders`, its own `expectedBlindAnswer` and its own `neverAdd`. None of them is asked to name a
place — `peggys-cove-light` remains the level's only place-anchor, exactly as §2 requires. `granite-erratic`
carries the strongest `neverAdd` clause in this file: **a cairn, an inuksuk, a stone marker or any stacked or
balanced stone arrangement, and any object a viewer could read as one**, with a note saying that an
identifier who names one has found a defect and not a feature. The two boulders stand side by side on one
plane with rock visible between them, and the 120 px silhouette was looked at for exactly this.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'granite-erratic': singleSource(),
  'fish-store': singleSource(),
  'fishermans-house': singleSource(),
```

Same shape as `peggys-cove-light`, which is already `singleSource()`. Until they land, `make verify-art`
names three more failures and says why. The alternative inside `assets/**` was `renders: []`, which the
harness accepts as "unrendered on purpose" and which would have turned three quarters of this level's points
of interest into subjects nobody checks.

---

## 13. The arrival line, and the three points that moved for it

**Added 2026-09-13, after §12 and superseding three of its numbers.**

`app/adapters/phaser/level-exit.ts` ends a level at **`bounds.right − view/2`** — half a camera view short of
the wall, so the player is still walking freely and the camera has already stopped when the completion card
opens. Here that is `7 040 − 540` = **world x 6 500**. It is derived from the level document, not typed into
it: change `size.x`, the ground polyline or `camera.zoom` and it moves.

**The house was at 6 700, which is 200 px past it.** §12 checked the house against the *wall* — right edge
7 020 against a level 7 040 wide, 20 px of margin — and that was the wrong wall. The quest was rebuilt this
week to visit every point this level has, so the player was told to walk to a house that stands past the x
at which the level announces it is finished, and the completion card draws once per sitting, so finishing
the task afterwards drew nothing at all.

### The rule the new numbers satisfy

**A point must be engageable only from before the line.** Engagement is `interaction.reachPx` — 200 px for
this level's walk, measured from `position.x`, both ways — so the whole reach ring sits before the line:

```
position.x + reachPx + 100 ≤ exitLineX          6 200 + 200 + 100 = 6 500
```

The 100 px is margin, not physics: the level pauses while a card is open, so the standing x during two lines
of dialogue and two questions is wherever the player engaged, and the ring is what bounds that. **This level
sits exactly on the bound**, and with four points, a 1 500 px floor and the first at 1 500 there is no
arrangement that has more: 1 500 + 3 × 1 500 = 6 000 is the earliest a fourth point can fall, and 6 200 is
what is left after the reach ring and the margin come off 6 500.

### Why the hero moved, which is the part worth reading

It moved because the floor between points carried the correction up the walk. The house had to come back
500 px; the fish store cannot be closer than 1 500 px to it, so it came back 500 too; and the light cannot be
closer than 1 500 px to the fish store, so it came back **320 px — the least the floor allows**, which is why
it is at 3 200 and not at some rounder or more even number. Three points, one chain, and the alternative was
a 1 280 px gap in the middle of the walk, which is the spacing the four-point respacing existed to remove.

**What was lost is a sentence, not a composition.** §3 called 3 520 "the middle of the level"; 3 200 is 45 %
of it. The hero is still alone in the middle third with a clear screen either side, still the only
place-anchor, and still drawn once on a level whose every layer repeats. Nothing about the *art* changed:
**these are numbers, not new art.** No source was touched, no palette entry was added, and the atlases are
byte-identical.

### What the barrens say about the three new numbers

`layer-40-granite-barrens` scrolls at 1.0, so it is locked to the world and repeats every 1 920 px; measured
off the raster, its two tide pools have open water at tile-local **[477, 742]** and **[1425, 1575]** and its
four erratics sit at **[206, 352]**, **[958, 1066]**, **[1290, 1370]** and **[1676, 1832]**. Every prop here
is opaque across its whole width for the bottom 60 rows, so what matters is not what a prop stands on — it
hides it — but what is left showing beside it:

- **`village-house` 6 200** is tile-local 440 and covers [120, 760], which contains the first pool whole.
  The house stands on bare pavement with nothing wet at its fence. At 6 700 it covered [620, 1260] and left
  143 px of open pool sticking out past the left of the picket fence: a house in a puddle, which is what the
  old number actually drew.
- **`fish-store` 4 700** is tile-local 860 and leaves 73 px of that same pool showing at its left. Kept, and
  wanted: this building stands on spruce piles over water in its own art, and water at its foot is the point
  of it.
- **`peggys-point-light` 3 200** is tile-local 1 280 and leaves 55 px of the second pool showing to the right
  of its base. Also kept: `refs/peggys-cove/granite-barrens-and-sea.jpg` is a photograph of a tide pool on
  the rock beside this light, and at 3 520 the tower hid the pool entirely.

Renders at 390 px over the real background were made at all three positions before they were chosen.

---

## 14. The tail this level no longer has, and what would give it back

Not a request, a measurement. The eight levels that were **not** defective put their last point 708 to
1 300 px before their arrival line — Québec City 708, Ottawa 860, the Prairies 860, Winnipeg 1 040, Vancouver
1 140, the North 1 140, the Alberta foothills 1 300. This level now has **300**, and Halifax the same.

The cause is arithmetic, and it is the same on both: **the two levels that went to four points on 2026-09-13
are 7 040 and 7 200 px long, and the other two four-point levels are 9 000 and 9 600.** This level got its
fourth point without getting any more world.

**The fix that needs no art and unbinds no verification grant is `size.x`.** Every layer here tiles, so width
is free: 7 040 → 7 560 moves the arrival line to 7 020 and would have let all four points stay exactly where
§12 put them — hero in the middle included — at a cost of 0 bytes and 0 textures. It was **not** taken,
because moving points in is what was asked for and a world's length is a level-design call rather than an art
one. It is recorded so that choosing it later is a decision and not a discovery.
