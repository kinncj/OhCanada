# Vancouver level art — layers, offsets, budgets and the decisions behind them

Level 9 — **Canadian Symbols**, locomotion **skateboard**. Sources are `assets/src/svg/vancouver/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. Design resolution 1080 × 1920, portrait, ground polyline at
**y = 1280**. A clear Pacific afternoon.

---

## 0. The trap, and what was drawn instead

`docs/stories/TN-LEVELS-2-to-10-spine.md` names this level "the single most likely place in this game for
`docs/content-review.md` §5.2 and §5.4 to be broken by accident", and lists the two things a designer would
reach for:

- **totem poles.** Not drawn, in any form, including background, silhouette, icon and loading art.
- **the inuksuk.** Not drawn, for the same reason and under the same open question (`OQ-REVIEW-10`).

Both are written into `neverAdd` on **both** of this level's subjects, so the prohibition is a checked
contract clause and not a paragraph in a sheet. Nothing in this level draws any Indigenous content of any
kind, and the seawall's four background figures carry no cultural marker (§3.3, outcome 2).

**Canada Place is the anchor and it is a strong one**: five white fabric sails on a long low pier is a stack
nothing else this game will draw. The Lions Gate Bridge stays as the recorded fallback and is written into
`neverAdd` so it cannot drift into the seawall tile.

**Licence first, and it cost the best files for the fifth level running.** Every one of Dietmar Rabich's
6720 px views of the building on Wikimedia Commons is **CC BY-SA 4.0**, which ADR-0004 excludes. The
measurement is made on a 2048 px CC BY 3.0 view and a 4032 px CC BY 2.0 one.

---

## 1. What was produced

| key | source | authored px | what it is |
|---|---|---|---|
| `vancouver-layer-10-sky` | `layer-10-sky.svg` | 1080 × 900 | one flat `sky-base` field and eleven cirrus streaks |
| `vancouver-layer-20-north-shore` | `layer-20-north-shore.svg` | 1800 × 260 | the North Shore: a snow-notched back range, a nearer ridge, forested slopes |
| `vancouver-layer-30-inlet` | `layer-30-inlet.svg` | 1800 × 300 | the far shore, two gantry cranes, open water, a ferry and a bulk carrier |
| `vancouver-layer-40-seawall` | `layer-40-seawall.svg` | 1920 × 430 | balustrade, lawn, paving, benches, lamps, two cedars, gulls, four people |
| `vancouver-landmark-canada-place@1x` | `landmark-canada-place@1x.svg` | 1000 × 800 | **POI hero, and the level's only place-anchor** |
| `vancouver-prop-marina-boats` | `prop-marina-boats@1x.svg` | 760 × 620 | **POI hero, added 2026-09-13**: three moored sailing boats with bare masts, over open water |
| `vancouver-prop-bulk-carrier` | `prop-bulk-carrier@1x.svg` | 820 × 420 | **POI hero, added 2026-09-13**: a bulk carrier with hatch covers, four deck cranes and an aft superstructure |

## 2. The parallax stack

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | sky | 1080 × 900 | 0 … 900 | 0.05 / 0.02 | true | 972 000 | yes | **yes** |
| 20 | north-shore | 1800 × 260 | 660 … 920 | 0.12 / 0.05 | true | 280 800 | yes | no |
| 30 | inlet | 1800 × 300 | 860 … 1160 | 0.32 / 0.14 | true | 324 000 | yes | no |
| 40 | seawall | 1920 × 430 | 900 … 1330 | 1.00 / 1.00 | true | 410 400 | yes | **yes** |

At **`low` the player sees the sky and the seawall** — balustrade, lawn, paving, benches, lamps, cedars,
gulls and people — plus the POI hero. That is a waterfront path in a city park, not a broken scene.

### The opaque feet

The north-shore tile is opaque from **world 830**; the inlet tile is opaque **from its own top edge at world
860**, which is inside that band; the seawall is opaque from **world 1150**. No band shows the theme
gradient at any tier, and the inlet-to-seawall seam closes to the pixel (§6.3).

### The sky is one flat field, and its clouds are the only ones of their kind

Same reason as Winnipeg's and the Prairies': at `low` this level keeps the sky and the seawall, and the
seawall is transparent everywhere above its own coping. **CIRRUS, not cumulus** — high, thin, fanning
streaks, which is what `refs/vancouver/seawall-path-and-harbour.jpg` shows and what makes this sky
distinguishable from the other seven at a glance.

### Nothing identifying is on a repeating layer

All four repeat. The far shore is plain masses and conifers; the two gantry cranes, the ferry and the bulk
carrier are types with no livery, name or funnel mark; the balustrade, benches, lamps and cedars are
furniture. **No suspension bridge appears anywhere.**

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way.**
- **`size.x` 7680**, four seawall tiles: about 15 seconds at the skateboard's 520 px/s.
- **`spawn`** `(420, 1280)`.
- **`poi.canada-place.position.x` 3840**, `radiusPx` 320. The file is 1000 × 800, so it occupies world
  x 3340 … 4340 and world y 480 … 1280 — of which **the bottom 280 rows are empty**. See §6.2.
- **`camera`** `followLerp` 0.13, `offset.x` 160.
- **`theme`**: `sky` `#3d8ccb` (`sky-base`), `ground` `#605a55` (`path-shade`), `horizon` `#a5d6ee`
  (`sky-light`). **The ground is Toronto's**, and that is allowed rather than overlooked: the rule this
  palette keeps is that no two triples are equal and no triple differs from another in only ONE of its
  three, and `(sky-base, sky-light)` differs from Toronto's `(sky-light, cloud-base)` in both of the other
  two. Both levels are city waterfront paving and both grounds are that paving in shadow. Derivations in
  `palette.json` `levelTheme.vancouver-pacific-afternoon`.
- **`locomotion`** declares `skateboard` first and `walk` second. `glide` 0.62 is the highest in the game
  after the train's 0.85, which is what a board on smooth paving is; `turnAcceleration` 1200 sits strictly
  between `deceleration` 900 and `acceleration` 1600.

## 4. Every effect has a plain path (ADR-0011)

No `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or `url(#…)` anywhere.
Water is three flat `water` tones with straight ripple bars. Distance is a flat tone per range. AO is flat
`ao-shadow` at 0.28 at ground contacts and 0.18 at overlaps. **No falling weather.**

## 5. Budgets, measured

```
level-payload:  OK - vancouver 0.34 MiB of 8.00 MiB over 9 file(s) [1x 0.22 / 2x 0.34]
texture-memory: OK - vancouver 23.23 MiB of 36.00 MiB (65%) over 9 file(s)
                     [1x device 17.87 MiB / 2x device 23.23 MiB]
                     heaviest atlas/shared@2x 1214x2046 9.48 MiB = 26% of budget
```

The level's own files are **13.75 MiB**; its honest worst case on ADR-0013's baseline is
13.75 + 9.48 + ~8 = **31.2 of 64, 49 %**.

### What that constraint did to the drawing

1. **Every tile is cropped to its world band.** The four layers cost **11.42 MiB**; authored 1920 tall at
   the same widths they would cost **48.7 MiB**.
2. **The hero is pinned to 1×**: 3.05 MiB instead of 12.21.
3. **1.07 MiB of the hero is deliberately empty**, and the sheet says so rather than letting a reader
   discover it in the numbers. See §6.2.

## 6. The landmark

### 6.1 What was measured

Measured on `refs/vancouver/canada-place-from-the-west.jpg` (1600 × 1063), in **one column at the near
(left) end of the pier**, which is the least foreshortened part of the only view that shows the whole
building. The denominator is **H = the sail peak to the waterline = 750 − 380 = 370 px**.

| ratio | measured | drawn (H = 479) |
|---|---|---|
| sails, peak to spring line ÷ H | 142/370 = **0.384** | 184/479 = 0.384 |
| deck-edge zone ÷ H | 26/370 = **0.070** | 34/479 = 0.071 |
| the two-level block ÷ H | 152/370 = **0.411** | 197/479 = 0.411 |
| piles and shadow ÷ H | 50/370 = **0.135** | 65/479 = 0.136 |
| mast spacing ÷ H | 142/370 = **0.384** | 184/479 = 0.384 |

The last row is the useful one: **a sail is as wide as it is tall.**

**The valley between two masts is the second measurement and it is what the first build got wrong.** On
`refs/vancouver/five-sails-close.jpg` the fabric between mast 1 and mast 2 bottoms out at y 700 against
peaks at y 300 and a deck at y 1100 — **42 per cent of the drop, not the whole of it.**

**Five sails, and the count does not move.** `art-bible.md` §5 rule 3 lets a repeated detail's number differ
from the reference; from most angles this roof shows eight to ten apparent peaks because there are rows
behind rows. Five is what the building is named for and is the identification, so it is the one repeated
detail in this project whose count is a `mustBeRight`.

### 6.2 The hero is 800 tall and 280 of those rows are empty

`level-scene.ts` places a POI hero with origin `(0.5, 1)` on the ground line and draws it **over** the
parallax. A hero drawn tight to its own base therefore stands on the promenade — and composited against the
real layers, Canada Place stood on the seawall and hid the balustrade, the lawn, the benches and the heads of
the background figures. **It is a pier.** The empty band puts its waterline at world 1000, inside the inlet
tile's water, and lets the seawall pass in front of it, which is the view from the seawall and is what the
building actually is. It costs **1.07 MiB** and it is the only deliberate empty texture in the project.

### 6.3 Two things were drawn twice

1. **The sails.** Build one drew five symmetric cones whose valleys ran all the way to the deck. Rendered,
   they read as five tents. They are now **asymmetric** — a steep concave rise on the left to a sharp peak,
   then a long shallow sweep down to the right — on **one continuous fabric mass** whose valleys stop at
   0.42 of the drop. Nothing in the markup showed that; the render did.
2. **The promenade rail.** Build one drew it as separate white pickets with transparent gaps. In the hero
   alone that looked fine. Composited, the level's own background showed *through* the gaps — red and green
   dashes from the seawall tile's people, forty rows above their heads. It is now a solid `white-shade` band
   with posts on it. **This is the third defect on this level that was invisible in the SVG and obvious in
   one composite**, which is `art-bible.md`'s own instruction restated.

Colour was measured and **no ramp was added**: the North Shore reads hsl(210,48 %,65 %) and hsl(210,45 %,63 %)
against `ice-shade`'s hsl(212,60 %,62 %) — two degrees of hue and two points of lightness — so `ice` is used
and its material note now says so. The inlet reads hsl(204,29 %,22 %) against `water-shade`'s
hsl(210,65 %,29 %).

### 6.4 The two-size test, and the 1× pin

At 25 % (250 × 200) the five peaks, the stay cables, the deck line, the colonnade and the flag are all still
separable. As a 120 px black silhouette it is a row of five sharp peaks over a long low slab: not confusable
with anything else in this game. Both probes pass.

### 6.5 One flag, and the reason is the contract

The building's promenade carries several flagpoles; the render draws **one** National Flag, 46 px wide (the
art bible's floor is 40). The count is a **contract** decision as much as a drawing one: `mustBeRight`'s
`maskRegion` probe takes a single rectangle, and two flags 370 px apart could not be removed by one without
taking sail fabric with them. One flag makes *"does this still identify with the flag gone"* a measurable
question on a level whose subject is Canadian symbols. The rectangle is `x 410, y 86, w 66, h 42`, measured
against the shipped render.

## 7. The answer that cannot be written down

**`five-sails` is allowed to demand a place name and it cannot be given the building's own name.** The
hand-off's leak scanner takes every word of four letters or more out of `id` and `expectedBlindAnswer` and
refuses any handed-over text containing one; the briefing it writes asks the identifier to name *a real,
named place or thing*. The building's name contains that noun. Listing it would turn `make verify-art` red
on a hand-off that leaks nothing, and the subject id is `five-sails` rather than the building's name for the
same reason.

The answer is scored on **`Vancouver`** and on **`five sails`**, both of which the same sentence almost
always carries. The residual risk is stated in `references.json` rather than hidden: a verifier who writes
the building's name and nothing else is scored a miss while being exactly right. **The fix is one line and
is routed:** reword the briefing to ask for *a real, named building or landmark*.

## 8. What this level does NOT assert

**No Indigenous content of any kind is drawn**, and no depiction of any of the three nations the territory
statement names. `content/levels/vancouver.json` states a territorial FACT quoted from the Tsleil-Waututh
Nation's own account of its own territory; that is a citation, not a depiction.

**One thing about that statement is a real problem and is flagged here as well as in the source register.**
A level carries one `fact.source` and one `nationSource`. The quoted sentence is the **Tsleil-Waututh**
speaking for the Tsleil-Waututh, and the statement names three nations; the other two names come from **MST
Development Corporation's "The Partners"**, the development corporation the three nations own jointly, which
names all three and speaks in all three voices and is the level's `nationSource`. So the two halves of one
sentence rest on two documents and only one of them can be registered. It is recorded in
`content/sources/twnation-our-story.json` rather than quietly left, and narrowing the statement to one nation
is refused: downtown Vancouver is within all three territories and naming one would be a smaller claim than
the truth.

**The word `unceded` is deliberately absent.** No treaty covers Vancouver and it is the word nearly every
Canadian institution uses; the cited page does not use it, so the statement does not either.

---

## 9. The skateboard is rig art

`locomotion` is `skateboard`, and the board is one frame of `{mode}` equipment in the shared rig
(`mount-deck-skateboard.svg`). No source is added here. `rig-contract.md` §11 is the contract.

- **The wheels are drawn 22 px across against a scale 7**, because two pale discs under a dark deck is the
  entire read at 390 px and a scale wheel is under 2 px on a phone.
- **One boot over each truck.** Rendered at phone size over this seawall, the first stance read wrong, and
  measurably: both boots sat 31 px apart in the middle of a 60 cm deck, the far foot BEHIND the near one,
  so the legs crossed into a knock-kneed diamond with the knees folded 40°. Two licence-clean photographs
  (`assets/refs/vancouver/skateboard-rider-in-winter-coat.jpg`, CC0, and
  `skateboard-rider-knees-bent.jpg`, CC BY 2.0) put a rider's front foot over the front truck and the
  back foot over the rear one. The deck is now 80 cm at the rig's scale with trucks 92 px apart, the front
  (far) boot is over the front truck and the back (near) boot over the rear, the legs do not cross, the
  knees bend forward 25–33° at rest and the leading arm reaches out. The figure is lifted 30 px onto a deck
  top 36 px off the ground. The references turn the feet across the board; a flat rig cannot foreshorten a
  foot, so the boots point the way the character travels.
- **`glide` 0.62 is the highest in the game and the pose has to survive it.** `skateboard/idle` is a rolling
  stance with the arms brought in rather than a stand, because `moving` is intent and this seawall coasts.


---

## 12. Three points of interest, and the level where every addition had to pass §0 first

**Added 2026-09-13.** The level shipped with one POI at 3 840 on a 7 680 px ride. It now has three.
`size`, the ground line, the four layers, the theme, both locomotion modes, the spawn and the officer are
unchanged, and Canada Place keeps its `questId`.

| world x | POI | art | what it teaches | source |
|---|---|---|---|---|
| 1 900 | `marina` | `vancouver-prop-marina-boats`, 760 × 620 | British Columbia is known for its mountains and as Canada's Pacific gateway | *Discover Canada* p. 102 |
| 3 840 | `canada-place` | `vancouver-landmark-canada-place`, 1000 × 800 | the flag flew first in 1965; the red-white-red pattern comes from the Royal Military College | *Discover Canada* p. 79 |
| 6 000 | `bulk-carrier` | `vancouver-prop-bulk-carrier`, 820 × 420 | the Port of Vancouver is Canada's largest and busiest | *Discover Canada* p. 102 |

**Gaps of 1 940 and 2 160 px**, inside the 1 500–2 500 band, with the officer at 1 150 before the first.

**§0 is the reason this level got two POIs and not four, and it was applied before anything was drawn.**
Both new subjects carry the totem-pole and inuksuk prohibition verbatim in their own `neverAdd`, so every
subject on this level now carries it. Nothing new depicts any Indigenous content of any kind, and neither
hero draws a figure.

**Both new facts come from the same paragraph of p. 102 and they are different propositions**, which is the
line CLAUDE.md draws: *"two subjects may share a chapter but never a proposition, identified by
`source.quote`"*. The mountains-and-gateway sentence and the Port of Vancouver sentence are two sentences and
two quotes. Checked mechanically across all ten level documents: **30 POI propositions, no two the same.**

**Why a bulk carrier and not a container ship**, which is what the Port of Vancouver is most famous for:
`prairie-rail` already draws a double-stack container car for the trading-nation fact, and a container ship
here would be the same object twice in one game. The hatch covers and the deck cranes are the half of the
port that is not drawn anywhere else, and they are also what stop the hero reading as a cruise ship — which
is the near miss `expectedBlindAnswer` marks as a failure.

**The marina's composition was wrong once and the fix was to remove something.** A first build put a floating
dock across the front of the three boats; the nearest hull's bottom edge landed on it and the boat read as
*sitting on the dock* rather than floating. The dock is gone, two mooring buoys took its place, and
`simplifyAway` now names it.

**One thing was re-toned after it was composited, and it is worth recording because it is invisible in the
SVG.** Both heroes carry their own water band, and both were drawn in the `water` ramp — while
`layer-30-inlet.svg` draws this level's harbour mostly in `water-light` and `ice-shade`. In the composite
each hero sat in a visible rectangle of darker blue. The two files now use the tile's own two tones, and the
seam is gone. **Judged by rendering the level frame at 390 px, not by reading the file.**

**Budgets, re-measured 2026-09-13:** `vancouver 28.81 MiB of 36.00 MiB (80 %, 7 540 356 B spare)` over 11
files, payload 0.42 MiB of 8. The two new heroes cost **3.11 MiB between them** and both are `@1x`-pinned.

**Scenery: none added.** `layer-40-seawall.svg` already carries a balustrade, lawn, paving, benches, lamps,
two cedars, gulls and four people, and `layer-30-inlet.svg` a ferry, a bulk carrier and two gantry cranes.

### The builder patch `scripts/lib/art-handoff.mjs` needs

```js
  'marina-boats': singleSource(),
  'bulk-carrier': singleSource(),
```
