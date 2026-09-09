# Toronto level art — layers, offsets, budgets and the decisions behind them

Level 5 — **Federal Elections**, locomotion **bike**. Sources are `assets/src/svg/toronto/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. This file is the level-specific sheet: what each texture is, where
it goes, what happens to it at each visual tier, and which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**. Late summer, hazy, afternoon.

Read `assets/style/halifax-level.md` §7 first if you are wiring this level up: three findings recorded there
apply to every level and one of them is the reason this level has nothing below its ground line.

---

## 0. The landmark, which was this agent's call

The PO's spine names Toronto and left the landmark open. It is the **CN Tower**, and the reasoning is worth
the two paragraphs because the alternatives were real.

**Queen's Park was rejected on content, not on drawing.** A level teaching *federal* elections should not put
a provincial legislature on the screen as the thing a learner remembers: the building is a good drawing and a
bad teacher, and the confusion it would seed is exactly the one the subject exists to clear up.

**Old City Hall's clock tower was rejected because this game already has two clock towers.** Ottawa's Peace
Tower and Halifax's Town Clock are kept apart by a deliberate colour pair — a white dial on buff Gothic
sandstone against a blue-and-gold dial on white-painted wood under green copper — and a third would make that
separation a full-time job.

**The CN Tower carries the identification on its own silhouette, at any size, in any weather.** It is also
the one landmark in this game whose *shape* does all the work: no colour cue, no ornament, no lettering.
Freedom of panorama for architecture (Copyright Act s.32.2(1)(b)) covers depicting it; the name is copy, not
art, and the render draws none.

The **domed stadium at its foot** is drawn with it. That is context, not a second subject, and it is the same
role Centre Block's wings play for the Peace Tower: it is really there, it is in front of the tower from the
water in every wide reference here, and it is what separates this render from a generic concrete
communications tower. `references.json` records it as a `mustBeRight` with that reason stated, so a verifier
is not left guessing whether the dome is required or forbidden.

---

## 1. What was produced

Five SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/toronto/` gets the key `toronto-<filename>`:

| key | source | authored px | shapes | what it is |
|---|---|---|---|---|
| `toronto-layer-10-sky` | `layer-10-sky.svg` | 1080 × 960 | 23 | a bleached hazy sky with five soft cloud banks |
| `toronto-layer-20-skyline` | `layer-20-skyline.svg` | 1800 × 420 | 166 | sixteen generic towers standing out of an opaque haze band |
| `toronto-layer-30-podium` | `layer-30-podium.svg` | 2016 × 270 | 81 | the street wall: brick warehouses, glass podiums, awnings |
| `toronto-layer-40-boulevard` | `layer-40-boulevard.svg` | 1440 × 400 | 142 | the trail itself, its verge, trees, lamps, bench, bike rack, wayfinding post, two riders and one walker |
| `toronto-landmark-cn-tower` | `landmark-cn-tower@1x.svg` | 700 × 1020 | 49 | **the POI hero**, and the only thing in this level that names a city |

Shape counts are **reported, not budgeted** (ADR-0025). The landmark is 49 shapes and it is the most
identifiable thing in the game — which is the ADR's point rather than a coincidence: it identifies by one
silhouette, and a silhouette is cheap.

**No character source, no POI-marker source, no particle source.** See `halifax-level.md` §1 and §7.3 for why
the last two are absent here and present on two earlier levels.

---

## 2. The parallax stack — four layers, composed for the coverage rule

`selectLayers` in `app/adapters/phaser/level-effects.ts` keeps **the layers that cover the most screen**,
clipped at the highest point of the ground polyline. Ties go to the nearer band.

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | `toronto-layer-10-sky` | 1080 × 960 | 0 … 960 | 0.04 / 0.02 | true | 1 036 800 | yes | **yes** |
| 20 | `toronto-layer-20-skyline` | 1800 × 420 | 560 … 980 | 0.18 / 0.08 | true | 453 600 | yes | **yes** |
| 30 | `toronto-layer-30-podium` | 2016 × 270 | 940 … 1210 | 0.48 / 0.24 | true | 291 600 | yes | no |
| 40 | `toronto-layer-40-boulevard` | 1440 × 400 | 900 … 1300 | 1.00 / 1.00 | true | 410 400 | yes | no |

`offset.y` is the world y in the fourth column; `offset.x` is 0 for every layer.

**At `low` the player sees the sky and the skyline** — and the CN Tower, which is a POI hero and not a layer.
A tall needle over a dense downtown is the level, and it survives to the weakest device. That is the
composition decision the coverage rule made available and the old highest-depth rule did not: under the old
rule `low` would have kept the podium and the boulevard, and the screen would have been a street wall with a
bike lane in front of it and no city behind.

The **skyline was deliberately made taller than the boulevard** to win that place: 420 rows against 400, for
453 600 of coverage against 410 400. It is the one number in this level that was set to change a tier
outcome rather than to frame a picture, and it is written down here because a later trim of 30 rows off the
skyline would silently swap what a weak phone shows.

### Nothing on a repeating tile may name the city, and the skyline is the tile most at risk

All four layers repeat. The skyline is the one that carries the most screen area at every tier, so it is
also the one where a recognisable roofline would do the most damage: it would appear three times across the
level. **Every tower on it is a plain mass** — flat tops, crowns, setbacks and plant enclosures, in pale
concrete, dark glass and blue-green glass. No CN Tower, no coloured crown, no chevron, no faceted top.

Québec City taught this the hard way one level earlier, and the lesson was not about a building: a striped
bandstand kiosk was drawn into a repeating tile *as street furniture*, and a blind verifier named the place
off it. Furniture that is really architecture is architecture. The bench, the bike rack, the lamps and the
wayfinding post on this level's boulevard are drawn as types for that reason, and the bicycles in the rack
carry **no operator livery** — they are in palette colours precisely so they do not become a mark.

### The sky bands, and where their steps hide

The sky is flat `sky-light` for 890 rows and then steps to `cloud-base` and `cloud-light`. Both steps sit
**behind the opaque haze band at the foot of the skyline tile**, which starts at world 880 and is the one
layer guaranteed beside the sky at `low`. No hard step can ever show against open sky, which is the defect
Québec City found in its first composite.

Every tile from the skyline down also carries an opaque haze band at its foot beginning exactly where the
tile above it ends — the podium's at world 980 — so a column between two blocks cannot drop through to the
theme gradient.

---

## 3. Placement the level document should use

`content/levels/toronto.json` is not this agent's file. These are the numbers the art was built for.

- **Ground polyline y = 1280, level, the whole way.** The boulevard tile's local y 380 *is* that line.
  **Do not slope it**: every band above is at a fixed world y, and a rising ground line would cut them. A
  bike level is tempting to give hills; the art cannot take them without a redraw of every tile.
- **`size.x` ≥ 7680.** Every layer tiles, so width is free. 7680 is five and a third boulevard tiles.
- **`spawn`** `(400, 1280)`, on clear trail.
- **`poi.cn-tower.position.x` ≈ 3600**, `radiusPx` 240. A POI has no `offset`: `level-scene.ts` draws
  `poi.artKey` with origin `(0.5, 1)` at `(position.x, groundYAt(x))`, so **the file's bottom edge is the
  ground line and its horizontal centre is `position.x`.** The 700 × 1020 file therefore occupies world x
  3250 … 3950 and world y 260 … 1280, with the mast tip at world y **280** — clear of the 120 px system band
  — and the observation pod's centre at world y **720**. The tower's own axis is the file's centre, so
  `position.x` is the tower, not the composition: the domed stadium sits to its left, from world x 3270 to
  3630.
- **The whole trail surface is clear.** Everything the boulevard tile carries stands on the verge *behind*
  the path, so there is nowhere on the ground line that a prop can block a rider or a dialogue prompt. Per
  1440 px tile, measured from the tile origin, what stands on the verge is: a wayfinding post at 196, street
  trees at 130 / 486 / 852 / 1252, lamp standards at 312 / 704 / 1096, benches at 600 and 1330, a bike rack
  at 980, two riders at 700 and 1220 and one walker at 400. The painted marks on the surface are bicycle
  marks at 310 and 1030 and arrows at 432 and 1152.
- **Per 2016 px podium tile**, the street wall runs: brick warehouse **[0, 296]**, rendered block with an
  awning **[312, 544]**, glass podium **[566, 866]**, brick warehouse **[890, 1158]**, rendered block
  **[1180, 1394]**, glass podium **[1418, 1692]**, brick warehouse **[1716, 2016]**.
- **`theme`**: `sky` `#a5d6ee` (`sky-light`), `ground` `#605a55` (`path-shade`, asphalt), `horizon`
  `#dce9f3` (`cloud-base`). The asphalt of the trail band and the theme `ground` are the same colour on
  purpose, so the ground polygon and the tile meet with no step. The four levels' theme triples are
  tabulated in `halifax-level.md` §4; no two are the same. `ink` and `inkMuted` are `ui-a11y`'s and must
  pass WCAG AA against both ends of this gradient; they are not proposed here.
- **`locomotion`** is bike, which `game.config.json` already lists. The art assumes a **level** ride: no
  jumps are framed, no gaps are drawn, and the trail is continuous across every tile seam.
- **`territory` is not proposed here and must not be copied from anywhere.** `docs/content-review.md` §10
  governs it and none of it is an art decision. What the art asserts is nothing: **no Indigenous content of
  any kind is drawn in this level** — no regalia, no pattern, no cultural item on any of the three background
  figures. See `OQ-TORONTO-2`.

---

## 4. Every effect has a plain path (ADR-0011)

**There is not a single `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or
`url(#…)` reference in any of the five sources**, checked mechanically.

| effect | plain form — what everyone sees | filtered form, if a tier ever offers one |
|---|---|---|
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every ground contact and a flat 0.18 rect where the pod meets the shaft. Baked at author time. | none wanted. |
| the trail's own marks | flat `grass-base` and `water-base` bars running the full width, a `white-base` dashed centre line, and white bicycle marks and arrows drawn as shapes. Static. | none. A painted road marking is a painted road marking. |
| city haze | an opaque `cloud-base` band at the foot of the skyline tile and paler tones on the further towers. Aerial perspective by tone, not by alpha. | a distance fade would be a bonus and must never be what makes the towers read as far away. |
| glass | flat `ice` and `water` tones with `slate` window bands. | a specular sweep would be a bonus. |
| falling weather | **none. This level is late summer** — no particles, no `particle-*` source. | — |

**One thing deliberately not drawn: overhead wires.** They are characteristic of Toronto streets and they
were designed as a fifth layer, at world 900 … 1010, scroll 0.85. Composited, they were visible in 40 rows
and cost 1.05 MiB. §2's rule applied before drawing rather than after, which is the improvement Québec City's
deleted sixth layer asked for.

---

## 5. Budgets, measured

`node scripts/assets.mjs --root scratch/root2`, 2026-09-08, against a scratch root carrying minimal
`halifax` and `toronto` level documents, because the real ones do not exist yet and `assets/**` is the only
tree this agent owns.

```
level-payload:  OK - toronto 0.27 MiB of 8.00 MiB over 9 file(s) [1x 0.18 / 2x 0.27]
texture-memory: OK - toronto 23.74 MiB of 32.00 MiB (74%) over 9 file(s)
                     [1x device 16.83 MiB / 2x device 23.74 MiB]
                     heaviest atlas/shared@2x 1268x2048 9.91 MiB = 31% of budget
```

**Transfer payload: 0.27 MiB against 8 MiB — 3 %.**

**Decoded texture memory at a 2× device:**

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1268 × 2048 | **9.91 MiB** |
| `toronto-layer-10-sky` | 1× | 1080 × 960 | 3.96 MiB |
| `toronto-layer-20-skyline` | 1× | 1800 × 420 | 2.88 MiB |
| `toronto-landmark-cn-tower` | **1×, source-pinned** | 700 × 1020 | 2.72 MiB |
| `toronto-layer-40-boulevard` | 1× | 1440 × 400 | 2.20 MiB |
| `toronto-layer-30-podium` | 1× | 2016 × 270 | 2.08 MiB |
| **total at a 2× device** | | | **24 895 488 B = 23.74 MiB** |

**Recommended `textureBudgetBytes` = 35 651 584 (34 MiB)**, the same figure as Halifax and derived the same
way — `halifax-level.md` §5 has the derivation, and the short version is that Québec City's 45.67 MiB cap
double-counted the characters and the honest cap on the sprite path is **56 MiB**. The measured 23.74 sits at
**70 %** of 34, which is Ottawa's ratio at half the absolute number.

**Baseline model** (ADR-0013's amendment: the shared atlas is resident once and charged to no level, and the
gate stays conservative until `unload` is real):

| | MiB |
|---|---|
| Toronto's own files | 13.83 |
| Shared character atlas, resident once | 9.91 |
| Render targets, uncounted residue | ~8.00 |
| **Toronto's honest worst case, baseline model** | **31.74 of 64 — 50 %** |

### What that constraint did to the drawing

1. **Every tile is cropped to the world band it covers.** The four layers cost **11.12 MiB**; authored 1920
   tall at the same widths they would cost **46.41 MiB**, which is 35.29 MiB more.
2. **The landmark is 1020 rows, not 1920, and pinned to 1×**: 2.72 MiB instead of 10.89. It is also only 700
   wide, because a 553 m tower is 97 px across at its widest and the rest of the file would have been
   transparent — the dome and the glazed block at its foot are what set the width, not the tower.
3. **A fifth layer was designed and not drawn.** §4.
4. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature is the 6 px tip of the
   antenna mast, which is the one exaggerated element on the whole level (§6).

---

## 6. The CN Tower: measured against the pod, because the base is hidden

Measured on `refs/toronto/cn-tower-skyline-elevation.jpg` (1600 × 1012, CC0, converted to sRGB first) by
thresholding the tower against the sky row by row. It is a long-distance view from the islands, so it is
near-orthographic and the whole tower is in frame.

**Every figure is in MAIN POD WIDTHS, and that is the finding.** The tower's own base is hidden behind the
waterfront in this view and in every other reference here, so a ratio against the total height would have an
*unmeasured denominator* — which is ADR-0014's mistake in a different disguise, and the same trap the Halifax
Town Clock fell into one file earlier. The pod is the widest unambiguous thing in the picture, so the pod is
the unit.

| ratio | measured (pod widths) | drawn (97 px pod) |
|---|---|---|
| main pod maximum width | 1.00 (45 px at row 402) | 1.00 (97 px) |
| shaft immediately below the pod | 0.311 (14 px) | 0.30 (29 px) |
| upper pod width | 0.356 (16 px at row 310) | 0.35 (34 px) |
| upper pod above the main pod's centre | 2.04 (92 px) | 2.04 (198 px) |
| mast tip above the main pod's centre | 4.33 (195 px, tip at row 207) | 4.33 (420 px) |
| base flare begins, below the pod's centre | 5.3 (238 px) | 5.3 (513 px) |
| shaft at the flare | 0.46 (extrapolated) | 0.46 (45 px) |

**One feature is exaggerated, and it is the one the reference cannot resolve.** In the best available
photograph the antenna mast is **two to three pixels wide** — at the resolution limit of the file, which is
why the tip's row could only be bracketed at 207 rather than measured cleanly. Scaled to the shipping size
that is a 5 px spike: gone at the 25 % probe, gone on a phone, and it is half of what makes this silhouette
the one it is. It is drawn at **0.155 of the pod's width at its base and 0.06 at the tip**, against a
measured 0.148 and about 0.05. Exaggerating an identifying feature is simplification (`art-bible.md` §5,
rule 2); adding one is invention. **Nothing else on this subject is exaggerated**, and the pod deliberately
is not: at 0.097 of the tower's height it is small in life and it survives both probes at that size.

**The pod's band order is drawn from `refs/toronto/cn-tower-pod.jpg`**, top to bottom: a pale metal deck
ring, a dark glass band, a pale ring, a second dark glass band, then the **white radome, which is the widest
element of the whole tower**, then a dark under-deck. Getting that order wrong leaves a plain disc on a
stick, which is what the first build was.

**Simplified away, per `references.json`:** the external elevator tracks, the pod's coloured architectural
lighting **and any red band** — it is programmable and changes nightly, so drawing one state asserts a state
— the glass floor, the third shaft rib (two shaded strips read as ribbed, three read as noise), the mast
aerials, and the stadium's roof panel joints and hotel windows.

**Never added, and none of it is present:** no lattice steelwork and no guy wires — it is a free-standing
reinforced concrete tower and drawing it as a guyed lattice mast is the single most likely wrong
simplification; no second pod at the same level; no crown, spire or dome on the tower; no restaurant sign,
wordmark or lettering anywhere in the level; no flag; **and no clock face**, because this game already has two
clock towers and a third would be a self-inflicted wound.

### The two-size test, and the 1× pin

Run at the shipping size of 700 × 1020:

- **25 %** (175 px) — the pod with its white radome, the upper pod, the tapering mast, the splayed base and
  the domed stadium all survive.
- **120 px black silhouette** — a very tall needle with one bulge at three fifths, a small collar above it,
  and a low dome at its foot. It is not confusable with anything else in this game.

Both pass, which is what ADR-0013 as amended requires before a landmark departs from the 2× default.

### The placement floor, and where this subject's floor is different

**Do not draw this landmark below 300 px wide anywhere the player is meant to recognise it** — the
verifier's floor from Ottawa, adopted rather than re-derived. But note what the floor is *about* here: the
file is 700 px wide and the tower is 97 px of it. Scaling the file to 300 px puts the shaft at 12 px and the
mast at 6, so **the upper pod goes first and the mast second**. A level that shrinks this landmark loses the
two features that separate it from a chimney, and no redrawing buys them back.

A `maskRegion` over the main pod is declared in `references.json` as a **diagnostic**: the Château's masked
probe dropped identification 0.80 → 0.35 and the Peace Tower's only 0.92 → 0.80, and the difference told us
one identifies by ensemble and the other by hard tokens. This subject looks like a two-token one — the pod
and the dome — and the mask is how that gets checked instead of assumed.

---

## 7. Open questions this level did not answer

- **`OQ-TORONTO-1`** — the trail's green and blue longitudinal lines are drawn from
  `refs/toronto/waterfront-trail.jpg`, where they are the waterfront path's own wayfinding marks. They are a
  road marking and carry no wordmark, so nothing here needs a licence. Whether the level's copy names the
  trail is the PO's call. Recorded because a reader who does not know why two coloured stripes are on the
  asphalt will helpfully remove them.
- **`OQ-TORONTO-2`** — the territory statement for this level. Not an art decision and deliberately not
  proposed: `docs/content-review.md` §10 requires a citable fact and nation names from that nation's own
  material, and no agent grants cultural sign-off. The art asserts nothing.
- **`OQ-ART-11`** — there is no palette lint. See `halifax-level.md` §8. Both levels were checked by hand.
- **One open blocker** — `content/levels/toronto.json` must land in the same commit as this art, or
  `make assets` is red for every level and not just this one (ADR-0020). `scripts/lib/art-handoff.mjs`
  `RECIPES` also needs two entries: `cn-tower` is `singleSource()`, and `toronto-trail` is
  `twoParallaxTiles({ farMatch: 'skyline', nearMatch: 'boulevard', nearTop: 340 })`.

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
