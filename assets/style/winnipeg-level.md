# Winnipeg level art — layers, offsets, budgets and the decisions behind them

Level 6 — **The Justice System**, locomotion **walk**. Sources are `assets/src/svg/winnipeg/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. This file is the level-specific sheet: what each texture is, where
it goes, what happens to it at each visual tier, and which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**. Early autumn, clear, mid-morning.

---

## 0. Why the museum and not the Golden Boy

`docs/stories/TN-LEVELS-2-to-10-spine.md` gives level 6 the Canadian Museum for Human Rights and records
the Golden Boy on the Manitoba Legislative Building as a fallback anchor. **The fallback is not taken, and
the reason is not that it would be hard to draw.** A legislature is where law is *made*, provincially; this
level teaches the courts, the police, the presumption of innocence and the rule of law. Putting a provincial
legislature on a justice level teaches the wrong institution as confidently as it teaches the right city —
the same rule under which a federal-elections level was denied one.

The museum is the coherent anchor and it is also the strong one: its stack — a stepped mountain of pale
limestone, a curved blue-green glass shell and a glazed spire with an open steel lattice — is shared by no
other building this game will ever draw, so `human-rights-museum` **is** allowed to demand a place name, on
the same test `town-clock` and `chateau-frontenac` pass and `pier-21` fails.

**The consequence is structural and is stated so nobody has to discover it.** Winnipeg as a *place* rests on
that one render. `winnipeg-riverwalk` is two repeating tiles and may not carry it. If the museum stops
identifying, the level stops being identifiable.

---

## 1. What was produced

Five SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/winnipeg/` gets the key `winnipeg-<filename>`:

| key | source | authored px | what it is |
|---|---|---|---|
| `winnipeg-layer-10-sky` | `layer-10-sky.svg` | 1080 × 900 | one flat `sky-shade` field and six cloud banks |
| `winnipeg-layer-20-skyline` | `layer-20-skyline.svg` | 1800 × 260 | twenty-one generic downtown masses over an opaque haze foot |
| `winnipeg-layer-30-riverbank` | `layer-30-riverbank.svg` | 1800 × 320 | the far bank in autumn, the shore and the open water |
| `winnipeg-layer-40-plaza` | `layer-40-plaza.svg` | 1920 × 520 | the riverside promenade — limestone slabs, parapet, lamps, benches, planters, three trees, six people |
| `winnipeg-landmark-human-rights-museum@1x` | `landmark-human-rights-museum@1x.svg` | 1000 × 1040 | **POI hero, and the level's only place-anchor** |

**There is no character source here.** Characters are `shared/` and already exist; this level places them.
**There are no POI-marker or particle sources**, for the reason Halifax records: `level.schema.json` cannot
reference either, so they would be textures nothing can use, charged to the level anyway.

---

## 2. The parallax stack

`content/game.config.json` keeps **6 layers at `high`, 4 at `medium`, 2 at `low`**, and
`app/adapters/phaser/level-effects.ts` `selectLayers` keeps the layers that cover the most screen.

| depth | key | tile | world y | `scrollFactor` | `repeatX` | coverage | `medium` | `low` |
|---|---|---|---|---|---|---|---|---|
| 10 | `winnipeg-layer-10-sky` | 1080 × 900 | 0 … 900 | 0.04 / 0.02 | true | 972 000 | yes | **yes** |
| 20 | `winnipeg-layer-20-skyline` | 1800 × 260 | 620 … 880 | 0.16 / 0.07 | true | 280 800 | yes | no |
| 30 | `winnipeg-layer-30-riverbank` | 1800 × 320 | 850 … 1170 | 0.36 / 0.16 | true | 345 600 | yes | no |
| 40 | `winnipeg-layer-40-plaza` | 1920 × 520 | 800 … 1320 | 1.00 / 1.00 | true | 432 000 | yes | **yes** |

`offset.y` is the world y in the fourth column; `offset.x` is 0 for every layer. Coverage is
`min(tileWidth, 1080) × visibleHeight` with the bottom clipped at the ground line.

At **`low` the player sees the sky and the promenade** — slabs, parapet, lamps, benches, planters, autumn
trees and six people, under a deep blue sky — plus the POI hero, which is not a layer and is present at
every tier. That is a city river park, not a broken scene.

### Why four, and why the sky is flat

**A fifth layer was designed and not drawn**: a band of riverbank trees between the skyline and the far bank.
Its world band would have been entirely inside layer-30's, which is opaque from its own top edge, so it would
have cost about 1.2 MiB for nothing visible. The rule Québec City and Halifax both record holds here: a layer
earns its texture only if its world band is not covered by a nearer opaque layer.

**The sky is one flat field, and that is a departure from Ottawa and Québec City.** A banded sky needs every
step to sit behind a nearer opaque layer *at every tier*. At `low` this level keeps the sky and the promenade,
and the promenade's opaque paving does not begin until world 1150 — so there was nowhere above it to hide a
step. One flat `sky-shade` field has no step to hide, and it is exactly `content/levels/winnipeg.json`'s
`theme.sky`, so dropping the layer changes nothing above the roofline. The clouds carry the interest.

### The opaque feet, closed on purpose

Each tile from the skyline down carries an opaque band that begins **exactly where the tile above it ends**:
the skyline's at world 830, where the riverbank begins at 850; the riverbank's at its own top edge; the
promenade's at world 1150. Without them a column between two towers drops through every layer to the theme
gradient, which is a hole in the middle of the picture and is only visible once composited.

### Nothing identifying is on a repeating layer

All four layers repeat. So **not one of them carries a named or recognisable building**, and this is checked
rather than intended: every tower on the skyline is a plain mass, the parapet, lamps, benches and planters
are types, the riverbank has no structure at all, and **no bridge with a single inclined pylon appears
anywhere** — the Esplanade Riel is real, recognisable and a hundred metres from this level's setting, and a
repeating tile may not carry it. The six figures carry no cultural marker of any kind
(`docs/content-review.md` §3.3, outcome 2).

---

## 3. Placement the level document uses

- **Ground polyline y = 1280, level, the whole way.** The promenade tile's local y 480 *is* that line.
  **Do not slope it**: every band above is at a fixed world y and a rising ground line would cut them.
- **`size.x` 7680**, four full promenade tiles. Every layer tiles, so width is free.
- **`spawn`** `(400, 1280)`, on clear paving, a screen and a half short of the POI.
- **`poi.human-rights-museum.position.x` 3840**, `radiusPx` 300. The file is 1000 × 1040, so it occupies
  world x 3340 … 4340 and world y 240 … 1280. `level-scene.ts` draws `poi.artKey` with origin `(0.5, 1)` at
  `(poi.position.x, groundYAt(x))`, so **the file's bottom edge is the ground line and its horizontal centre
  is `position.x`.** The spire's lattice cap sits at world y 275 — clear of the 120 px system band.
- **The promenade tile is 80 px taller than its world band needs and the whole drawing is translated down by
  that much.** At 440 the tallest street tree's canopy was clipped by the tile's own top edge. The extra
  80 px costs 0.59 MiB and buys a tree that is 400 px tall instead of 300.
- **`theme`**: `sky` `#1f5fa8` (`sky-shade`), `ground` `#8a6256` (`limestone-shade`), `horizon` `#dce9f3`
  (`cloud-base`). The ground is the promenade's own stone in shadow, which is the arrangement Halifax
  arrived at the hard way: when the fill below the ground line is a different material from the surface
  above it, the surface stops reading as a surface.
- **`locomotion`** is walk and the level needs only that one mode, with Halifax's numbers unchanged.
- **`territory` is not an art decision.** See §6.

### The six theme triples, so nobody has to compare them by eye

| level | `sky` | `horizon` | `ground` |
|---|---|---|---|
| ottawa | `sky-shade` | `sky-light` | `snow-base` |
| quebec-city | `sky-base` | `cloud-base` | `snow-base` |
| halifax | `sky-base` | `cloud-light` | `path-base` |
| toronto | `sky-light` | `cloud-base` | `path-shade` |
| **winnipeg** | `sky-shade` | `cloud-base` | `limestone-shade` |
| prairie-rail | `sky-light` | `cloud-light` | `felt-shade` |

No two triples are equal, and no triple differs from another in only one of its three.

---

## 4. Every effect has a plain path (ADR-0011)

There is not a single `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` or
`url(#…)` reference in any of the five sources.

| effect | plain form — what everyone sees |
|---|---|
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every ground contact and flat 0.18 bands at the structural overlaps and the stone arrises. Baked at author time. |
| autumn foliage | three flat tones per canopy, gold or green, as rounded lobes. Never a leaf texture. |
| river water | three flat `water` tones with straight `water-light` ripple bars. Static shapes. |
| lamp globes | flat `white-light` discs with a `brass-light` wash at 0.35 on dark standards. |
| falling weather | **none. This level is early autumn.** Two of this game's levels are winter already. |

---

## 5. Budgets, measured

`npm run assets`, 2026-09-09, against the real level documents.

```
level-payload:  OK - winnipeg 0.37 MiB of 8.00 MiB over 9 file(s) [1x 0.26 / 2x 0.37]
texture-memory: OK - winnipeg 24.94 MiB of 36.00 MiB (69%) over 9 file(s)
                     [1x device 19.59 MiB / 2x device 24.94 MiB]
                     heaviest atlas/shared@2x 1214x2046 9.48 MiB = 26% of budget
```

**Transfer payload 0.37 MiB against 8 MiB — 5 %.** Not the binding constraint.

**Decoded texture memory at a 2× device:**

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1214 × 2046 | **9.48 MiB** |
| `winnipeg-landmark-human-rights-museum` | **1×, source-pinned** | 1000 × 1040 | 3.97 MiB |
| `winnipeg-layer-40-plaza` | 1× | 1920 × 520 | 3.81 MiB |
| `winnipeg-layer-10-sky` | 1× | 1080 × 900 | 3.71 MiB |
| `winnipeg-layer-30-riverbank` | 1× | 1800 × 320 | 2.20 MiB |
| `winnipeg-layer-20-skyline` | 1× | 1800 × 260 | 1.79 MiB |
| **total at a 2× device** | | | **24.94 MiB** |

### The budget number, derived rather than copied

Halifax's derivation is adopted rather than re-derived: 64 MiB ceiling − 8 MiB for render targets and the
browser's own allocations = 56 MiB is the most a level's *files* may honestly declare on the sprite path.

**`textureBudgetBytes` = 37 748 736 (36 MiB).** The measured 24.94 sits at **69 %** of it, which is the band
Ottawa (68 %), Québec City (69 %), Toronto (69 %) and Halifax (72 %) are already in — tight enough that the
gate fires before the ceiling does, loose enough for the level's NPC and a second POI hero.

**9.48 MiB of the 24.94 is the shared character atlas, resident once and charged to every level.** ADR-0013's
amendment decided that charge is wrong and left the gate conservative until `unload` is real. Winnipeg's own
files are **15.46 MiB**; its honest worst case on the baseline model is 15.46 + 9.48 + ~8 = **32.9 of 64,
51 %**.

### What that constraint did to the drawing

1. **Every tile is cropped to the world band it actually covers.** The four layers cost **11.51 MiB**
   between them; authored 1920 tall at the same widths they would cost **48.7 MiB**, which is 37 MiB more
   and over the ceiling before a landmark or a character is loaded.
2. **The landmark is cropped to its alpha bounds and pinned to 1×**: 3.97 MiB instead of 15.87.
3. **A fifth layer was designed and not drawn.** §2.
4. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature in the level is the 6 px
   diagonal rib on the museum's glass shell; the next smallest is a 7 px lamp standard and an 8 px insulator.

---

## 6. The landmark

### 6.1 What was measured

Measured on `refs/winnipeg/cmhr-elevation-from-the-river.jpg` (1184 × 1600), a near-orthographic river
elevation in clear sun with the whole building in frame — the one internally consistent view of the six.
Every figure is a fraction of **the building's width**, which is the one unambiguous quantity in the
photograph: x 65 … 1140 at the foot, so B = 1075 px.

| ratio | measured | drawn (B = 940) | error |
|---|---|---|---|
| height : width | 0.953 | 0.953 | 0 % |
| spire above the stone peak ÷ B | 0.395 | 0.393 | 0 % |
| spire width at its foot ÷ B | 0.135 | 0.135 | 0 % |
| spire axis from the left ÷ B | 0.402 | 0.402 | 0 % |
| stone peak above the foot ÷ B | 0.567 | 0.567 | 0 % |
| shell width ÷ B | 0.321 | 0.321 | 0 % |
| shell crest above the foot ÷ B | 0.465 | 0.465 | 0 % |
| right-hand stone steps ÷ B | 0.349, 0.140 | 0.366, 0.140 | +5 %, 0 % |

The glazed / lattice split of the spire is **0.253 / 0.140** of B, read off the same file (glass rows
600 … 330, lattice 330 … 175, so 64 % glass), and is the one figure taken as a proportion of the spire rather
than of the building.

**One reference is deliberately not averaged in.** `refs/winnipeg/cmhr-at-the-forks.jpg` is a winter aerial
and its stone reads hsl(38, 12 %, 58 %) through haze against the primary's hsl(26, 16 %, 60 %). ADR-0014
records what averaging two views produces. It is used for the stepped plan and the terrace and for nothing
else.

**The primary reference dates from before the opening and carries construction scaffolding on the stone.**
The form is complete. This is written down rather than left to be spotted.

### 6.2 This landmark was drawn three times

1. **Build one** stacked six rectangles of pale stone with vertical mullions on the shell. The stone read as
   an office block and the shell read as an egg.
2. **Build two** canted the wedges and gave each a sloped top, which fixed the stone, and painted the arris
   of each wedge in `limestone-shade` at full strength — which put what looked like a rusted steel column in
   the middle of a stone wall. It also drew the building's **second** glazed shell, which is really there and
   which at ship size read as a blue blob competing with the first for the eye.
3. **Build three**, which ships, put the arris in baked `ao-shadow` at 0.18, deleted the second shell, and
   replaced the shell's vertical mullions with **six diagonal ribs converging toward the crest and two
   horizontal rings**. The diagonals are the fix: they are what says *curved space frame* instead of *dome*,
   and nothing in the markup shows that.

> The general lesson, which is Halifax's twice over: **a ratio is only a measurement if its denominator was
> measured too**, and a shape is only right if you looked at the render. Every ratio above was correct in
> build one.

**Colour was measured.** Tyndall limestone is its own ramp, `limestone`, base #a99789 = hsl(26, 16 %, 60 %),
the median of 240 × 400 px of sunlit wall at (620, 700) on the primary. It exists because `stone` is Nepean
sandstone at hsl(33, 41 %, 58 %) — the same lightness at two and a half times the saturation — and this game
now has two landmarks faced in pale stone. One ramp for both would make Winnipeg's museum and Ottawa's
Parliament the same material, which is exactly the confusion `brick` was added to prevent between the Château
and the Hill. The derivation and both measurements are recorded in `palette.json`.

The glass did **not** get a ramp. It measures hsl(203, 41 %, 80 %) sunlit against `ice-base`'s
hsl(202, 52 %, 78 %) — one degree of hue apart — so `ice` is used and its material note now says so.

**Simplified away:** the stone's fossil figure and mottling, the shell's several hundred glazing triangles,
the entrance ramps and reflecting pool, the roof plant and davits, the second glazed shell, and **the banner
hung on the stone in two references** — it is really there, it changes with the exhibition, and it is
lettering.

**Never added, and none of it is present:** no lettering, wordmark or banner; no flag or flagpole; no dome,
portico, pediment or colonnade; no punched windows in storey rows; **no finial or emblem on the spire**,
which is the single most likely wrong addition — the moment anything is put on top of it, a glazed lift and
stair shaft becomes a steeple.

### 6.3 The two-size test, and the 1× pin

Run at the shipping size of 1000 × 1040. At 280 px the spire, the shell and the stepped stone are all still
separable; at 250 px the two canted glazing slots are the first thing to go. As a 120 px black silhouette it
is a stepped mass with a needle rising from the left of centre and a rounded lobe at its foot: not
confusable with the Peace Tower's single slender shaft, the CN Tower's pod-on-a-shaft, or the Town Clock's
stepped drum. Both probes pass, which is what ADR-0013 as amended requires before a landmark ships at 1×.
The measured saving is 15.87 MiB → 3.97 MiB.

---

## 7. What this level does NOT assert

**No Indigenous content of any kind is drawn in this level** — no regalia, no pattern, no cultural item on
any of the six background figures, and no depiction of any of the seven nations the level's territory
statement names. `content/levels/winnipeg.json` states a territorial FACT quoted from Parks Canada's own
page for The Forks National Historic Site; that is a citation, not a depiction, and
`docs/content-review.md` §1 is not engaged by it.

**One thing about that statement is an art-adjacent problem and is flagged here as well as in the source
register.** `level.schema.json` gives a level exactly one `nationSource`, and the Parks Canada sentence names
seven nations. The document points at Treaty One Nation, which speaks for the seven First Nations who signed
Treaty No. 1 and does not speak for the other names in the sentence. A content verifier has to either find
each name on that nation's own material or narrow the statement. It is recorded rather than quietly left.
