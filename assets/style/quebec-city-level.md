# Québec City level art — layers, offsets, budgets and the decisions behind them

Slice 2, Level 3 — **Canada's History**, locomotion **toboggan**. Sources are `assets/src/svg/quebec-city/*.svg`;
`assets/style/art-bible.md` is the house style and `assets/refs/references.json` is the accuracy contract
`make verify-art` judges renders against. This file is the level-specific sheet: what each texture is, where it
goes, what happens to it at each visual tier, and which numbers were measured rather than chosen.

Design resolution 1080 × 1920, portrait, ground polyline at **y = 1280**.

Slice 2 exists to prove a level can be added by **JSON and assets alone**. §0 is what that proof cost, measured.

---

## 0. What "JSON and assets alone" actually cost, measured

Slice 2's claim is that a level is addable by JSON and assets alone. Here is what that was worth in practice.

**`app/adapters/phaser` needed nothing.** No engine change of any kind was required by this art, and that is the
large half of the proof.

**One blocker is open, and it is an ordering constraint rather than a defect.** `make assets` cannot build this
art until `content/levels/quebec-city.json` exists, because the pipeline reads a source's owning level from its
path and refuses to guess:

```
assets: FAILED
  - assets/src/svg/quebec-city/landmark-chateau-frontenac@1x.svg sits under "quebec-city/", which is
    neither "shared" nor a level id in content/levels/ (ottawa). Rename the directory or add the level
    document; this file is charged to no payload budget.
  ... the same for all nine sources
assets: 9 error(s).
```

That refusal is correct — ADR-0020, a level names its art and the manifest prices it — and it means **the art
and the level document must land in the same commit.** Neither is committable alone. `assets/**` is this
agent's tree and `content/levels/**` is not, so §3 and §5 record every number the level document needs and stop
there.

**One blocker was open and is now closed, and how it closed is the part worth keeping.** For part of this task
`make verify-art` failed on both new subjects:

```
  - chateau-frontenac: has renders and this harness has no builder for it.
    scripts/lib/art-handoff.mjs RECIPES needs one.
  - dufferin-terrace-toboggan-run: has renders and this harness has no builder for it.
```

`RECIPES` in `scripts/lib/art-handoff.mjs` is a table of one builder per subject id, and the gate fails rather
than skipping an id it does not know, because "skipping an unknown subject would verify four fifths of the set
and print the same OK". `scripts/` is not art's tree. **The alternative available at that moment was to declare
`renders: []`**, which the harness accepts as "unrendered on purpose" and which would have turned the landmark
this level exists to show into a subject nobody checks — the vacuum this repository keeps closing. It was not
taken. The renders were listed, the gate went red, and the red named the exact file and function that was
missing. Infra then wrote both builders to the spec in `renderRecipe` — `chateau-frontenac` is `singleSource()`,
`dufferin-terrace-toboggan-run` is `twoParallaxTiles({ farMatch: 'terrace', nearMatch: 'slope', nearTop: 580 })`
— and the harness now builds 21 renders over 5 subjects with anonymisation holding.

> **A loud red gate naming its own fix is worth more than a green one built on a declaration that was not
> true.** That is the whole of what §0 has to teach.

**So the honest slice-2 finding: a level is JSON and assets alone for the engine; the gates need one JSON
document and, for a subject shape they have not seen before, one table entry.** Neither is an engineering
project, which is the thing slice 2 set out to establish.

---

## 1. What was produced

Nine SVG sources. `scripts/assets.mjs` reads the level from the path, so everything under
`assets/src/svg/quebec-city/` gets the key `quebec-city-<filename>`:

| key | source | authored px | what it is |
|---|---|---|---|
| `quebec-city-layer-10-sky` | `layer-10-sky.svg` | 1080 × 950 | three flat sky bands, eight clouds |
| `quebec-city-layer-20-farbank` | `layer-20-farbank.svg` | 1800 × 150 | the far bank across the river: a generic winter river town |
| `quebec-city-layer-30-river` | `layer-30-river.svg` | 1800 × 160 | the St Lawrence: three water bands and drifting ice pans |
| `quebec-city-layer-50-terrace` | `layer-50-terrace.svg` | 2016 × 640 | Dufferin Terrace: parapet, cast-iron railing, lamps, a **plain open timber shelter** (it was a striped kiosk — see §7), benches, crowd, one timber footbridge, the chute's far wall |
| `quebec-city-layer-60-slope` | `layer-60-slope.svg` | 1440 × 560 | the toboggan run: a **packed-snow** lane (it was `ice` — see §7), modelled divider ridges, runner streaks, two riders on toboggans, near bank |
| `quebec-city-landmark-chateau-frontenac` | `landmark-chateau-frontenac@1x.svg` | 1080 × 900 | **the POI hero**: the Château Frontenac |
| `quebec-city-poi-marker-idle` | `poi-marker-idle.svg` | 132 × 176 | tappable POI marker, not in reach |
| `quebec-city-poi-marker-active` | `poi-marker-active.svg` | 132 × 176 | tappable POI marker, in reach |
| `quebec-city-particle-snow` | `particle-snow.svg` | 96 × 32 | three snow-flake sizes |

There is no character source here. Characters are `shared/` and already exist; this level places them.

**There are no standalone prop files**, for the reason Ottawa's page gives: `level.schema.json` has no way to
place a loose prop, so a prop file is a texture charged to the budget that nothing can reference. The kiosk,
the benches, the lamps and the footbridge are all inside `layer-50-terrace.svg`; that file is their canonical
geometry.

---

## 2. The parallax stack — **five layers, not six, and the sixth was drawn before it was deleted**

`content/game.config.json` keeps **6 layers at `high`, 4 at `medium`, 2 at `low`**, and `level.schema.json`
says the preset **keeps the highest depths and drops the rest**.

| depth | key | tile | world y | `scrollFactor.x` | `repeatX` | survives `medium` | survives `low` |
|---|---|---|---|---|---|---|---|
| 10 | `quebec-city-layer-10-sky` | 1080 × 950 | 0 … 950 | 0.04 | true | no | no |
| 20 | `quebec-city-layer-20-farbank` | 1800 × 150 | 790 … 940 | 0.20 | true | yes | no |
| 30 | `quebec-city-layer-30-river` | 1800 × 160 | 930 … 1090 | 0.34 | true | yes | no |
| 50 | `quebec-city-layer-50-terrace` | 2016 × 640 | 700 … 1340 | 1.00 | true | yes | **yes** |
| 60 | `quebec-city-layer-60-slope` | 1440 × 560 | 1280 … 1840 | 1.00 | true | yes | **yes** |

`offset.y` is the world y in the fourth column; `offset.x` is 0 for every layer.

### Why five

A sixth layer was authored — `layer-40-lowertown`, Old Québec's roofs below the terrace, 1440 × 250 — and
**deleted after it was composited, not before it was drawn.** The camera on this level stands on a cliff-top
promenade, and the promenade's own railing is chest height on a standing figure: its head sits at world
y ≈ 1006 and the parapet runs from 1150 to 1300. Everything between 1006 and the ground line is behind the
terrace tile. The open mid-ground is **world y 790 … 1006, which is 216 px**, and the far bank and the river
already fill it exactly.

Composited, the sixth layer was visible in a 40 px sliver at the frame edges. It would have cost **1.37 MiB of
decoded texture for something the player never sees**, on the level where the sky, the far bank and the river
together cost 6.04. It is recorded here rather than quietly dropped, because "author six layers" is advice in
`art-bible.md` §6 and this is the first level where following it would have been wrong.

**The rule generalises, and the next level should apply it before drawing:** a layer earns its texture only if
its world band is not covered by a nearer opaque layer. Ottawa's canal wall tops out at world 700 and its stack
had 500 px of open mid-ground; a cliff-top promenade has 216.

### Why nothing identifying is on a droppable layer

At `low` the player sees exactly two layers: the terrace and the run. Between them they carry the masonry
parapet with its snow-capped coping, the ornate dark-green cast-iron railing with its scroll panels and urn
finials, the rhythm of globe lamp standards, the striped bandstand kiosk, benches, six people in winter coats,
a timber footbridge, the chute's far timber wall, and the iced lane with its divider ridges and runner streaks.

**The landmark is not a layer.** `quebec-city-landmark-chateau-frontenac` is the POI's `artKey`, so the Château
is present at every tier, on every device, with no dependence on the preset. That is the same structural
decision Ottawa made and it is what makes the drop order above safe: at `low` the frame is the Château above an
ornate railed promenade above a snow chute, which is Québec City in winter and not a broken scene.

### What the dropped layers cost

At `medium` and `low` the sky layer is gone. `palette.json`'s `levelTheme.quebec-city-winter` sets the theme
gradient's three stops to **the same three colours as the sky layer's three bands**, in the same order
(`sky-base` at the zenith, `cloud-base` at the horizon rule, `snow-base` at the ground). Dropping the layer
turns a banded sky into a gradient sky. The clouds are lost; nothing else is.

`layer-30-river`'s **first 16 rows are `cloud-base`**, the theme's horizon colour, for the same reason: with
the sky layer gone, the river band's top edge meets the gradient at a colour the gradient is already passing
through.

### The sky's band steps are at 830 and 900, and that is not arbitrary

The first composite of this level showed a hard horizontal step across open sky at y = 560, where `sky-base`
met `sky-light`. Ottawa's page says both of its sky steps "sit behind a nearer layer at the high tier so the
hard step never shows"; this level's did not, because its next layer down starts 240 px lower. The steps moved
to **830 and 900**, both behind the far-bank ridge, and the sky above 830 is one flat `sky-base` that is
exactly the theme gradient's top stop.

### The desktop side panel

ADR-0002 extends the theme gradient into the panels beside the letterboxed canvas. The sky layer's extreme left
and right columns are pure band colour — every cloud is kept inside x 120…960 — and the river and run layers'
bands run full width, so the panel seam has nothing to disagree with.

---

## 3. Placement the level document should use

`content/levels/quebec-city.json` is not this agent's file. These are the numbers the art was built for.

- **Ground polyline y = 1280.** `layer-60-slope`'s local y 0 *is* that line, so the run is placed at
  `offset.y = 1280` and nothing has to be worked out twice.
- **The landmark is drawn at depth 45 — between the river and the terrace.** The river (30) sits behind it and
  **`layer-50-terrace` (50) is drawn in front of its foot**, which is the correct geometry — the promenade and
  the run are nearer to the player than the Château is — and it hides the landmark's hard bottom edge at world
  y 1200 behind the parapet. **Confirm this in a running scene before anything is redrawn**: the depth is a
  claim about paint order that no SVG can prove.
- **The landmark's local y is world y, offset by 300.** Place it at `offset` `(poiX − 540, 300)`. The
  composition rules then hold by construction: the tower finial at y = 306 (clear of the 120 px system band),
  the tower's roof — the feature that carries the identification — spanning y 380…609, above the y = 520 rule
  and never occluded by a foreground layer, the terrace level at y = 1100 behind the parapet head, and nothing
  identifying within 64 px of a side edge (the outermost feature is the left corner turret's cone at x 74).
- **Where the footbridge falls.** `layer-50` scrolls at 1.0, locked to the world, so this is exact rather than
  approximate: the footbridge deck and its trestles occupy world x in **[156 + 2016k, 644 + 2016k]** for every
  integer k, and the bandstand kiosk occupies **[682 + 2016k, 918 + 2016k]**. The kiosk was moved from x 1500
  to x 800 *for this reason*: clustered against the bridge it leaves one clear stretch of 1254 px, and split
  across the tile it left none wide enough for a 1080 px camera frame. So a POI centred anywhere in
  **(1458, 1632)** frames the Château with neither the bridge nor the kiosk in shot.
  **Recommended `poi.chateau-frontenac.position.x` = 1540.** This is a composition preference, not a rule: both
  render *behind* the POI sprite and can never occlude the tower.
- **Spawn** anywhere clear of the bridge span; 1050 puts the player a screen short of the Château with a bridge
  behind them to toboggan under on the way back.
- **Level width** ≥ 4200 gives two bridge crossings and the Château with room either side. Every layer tiles, so
  the width is free.
- **The lamp standards cross the landmark, and that is correct.** Six globe lamps per 2016 px tile, at
  x = 168 + 336k, with the globes at world y 868…892 — deliberately *below* the Château's wing ridge at 773, so
  they read against brick rather than punching white holes in the green roofs. They were 90 px higher for one
  composite and did exactly that.
- `theme`: `sky` `#3d8ccb`, `ground` `#e6eff7`, `horizon` `#dce9f3` (the `quebec-city-winter` ids in
  `palette.json`). Deliberately **not** Ottawa's set: Ottawa's zenith is the deeper `sky-shade` over a
  `sky-light` horizon. `ink` and `inkMuted` are `ui-a11y`'s and must pass WCAG AA against both ends of this
  gradient; they are not proposed here.
- **`territory` is not proposed here and must not be copied from anywhere.** `docs/content-review.md` §10
  governs it, it requires a citable fact and nation names from that nation's own material, and none of that is
  an art decision. What the art asserts is nothing: **no Indigenous content of any kind is drawn in this
  level** — no regalia, no pattern, no cultural item on any of the six background figures
  (`docs/content-review.md` §3.3, outcome 2). `docs/content-review.md` §4.4 also records that **no Voyageur
  asset is authored for slices 1–3**, and none is here, ceinture fléchée included. See `OQ-QUEBEC-2`.

---

## 4. Every effect has a plain path (ADR-0011)

Canvas has no Filter pipeline, so an effect built on one is absent without an error on exactly the devices that
need help most. **There is not a single `<filter>` element, `<linearGradient>`, `<radialGradient>` or `url(#…)`
reference in any of the nine sources**, checked mechanically.

| effect | plain form — what everyone sees | filtered form, if a tier ever offers one |
|---|---|---|
| ambient occlusion | flat `ao-shadow` ellipses at 0.28 under every ground contact and flat 0.18 rects at the two structural overlaps (tower-into-wings, chute wall onto the run). Baked into the SVG at author time. | none wanted. |
| ~~iced chute sheen~~ | **REMOVED, §7.** The lane is packed snow in the `snow` ramp, not polished ice, because the `ice` ramp made a blind verifier read the whole lower half as a frozen river. | none. |
| runner scoring | 4 px `snow-shade` grooves at 0.42 and `snow-light` bars, 39 per 1440 px tile, **straight and level**. A toboggan runner scores straight lines; the curved arcs on Ottawa's ice are skate marks and would say "rink". | none. |
| falling snow | `quebec-city-particle-snow`, three flat opaque discs with a flat highlight. Phaser particles, ≤ 400 on a phone at every tier and 150 at `low`. | none. |
| POI marker "in reach" | the ring **fills and gains a second ring** — a shape change, not a glow and not only a colour change. | a pulse is welcome; the shape difference already carries the state, so reduced motion and Canvas both stay correct. |
| lamp globes | flat `white-base` disc with a `white-light` highlight disc. | a bloom would be a bonus. |

---

## 5. Budgets, measured

`node scripts/assets.mjs`, 2026-09-08, run against a scratch root carrying a minimal `quebec-city` level
document — **because the real one does not exist yet and `assets/**` is the only tree this agent owns.** The
scratch document declared the five `layers[]` keys and `textureBudgetBytes` 40 MiB; nothing else affects these
numbers, and the run is reproducible by anyone who writes the real document.

```
assets: 69 SVG + 0 Rive source(s) -> 25 file(s) in assets/dist
        (6 atlas page(s) <= 2048 px, 13 standalone image(s),
         11 full-screen layer file(s) at 1x only, 2 source-pinned file(s)), 1x + 2x,
        0.65 MiB on disk across 2 level(s).
level-payload:  OK - quebec-city 0.34 MiB of 8.00 MiB over 14 file(s) [1x 0.25 / 2x 0.34]
texture-memory: OK - quebec-city 28.20 MiB of 40.00 MiB (71%, 12373168 B spare)
                     over 14 file(s) [1x device 20.88 MiB / 2x device 28.20 MiB]
                     heaviest atlas/shared@2x 1268x2048 9.91 MiB = 25% of budget
```

**Transfer payload: 0.34 MiB against 8 MiB — 4 %.** Not the binding constraint, and it never has been.

**Decoded texture memory at a 2× device:**

| texture | scale | px | decoded |
|---|---|---|---|
| `shared` character atlas | 2× | 1268 × 2048 | **9.91 MiB** |
| `quebec-city-layer-50-terrace` | 1× | 2016 × 640 | 4.92 MiB |
| `quebec-city-layer-10-sky` | 1× | 1080 × 950 | 3.91 MiB |
| `quebec-city-landmark-chateau-frontenac` | **1×, source-pinned** | 1080 × 900 | 3.71 MiB |
| `quebec-city-layer-60-slope` | 1× | 1440 × 560 | 3.08 MiB |
| `quebec-city-layer-30-river` | 1× | 1800 × 160 | 1.10 MiB |
| `quebec-city-layer-20-farbank` | 1× | 1800 × 150 | 1.03 MiB |
| `quebec-city` atlas (2 markers + snow particle) | 2× | 206 × 694 | 0.55 MiB |
| **total at a 2× device** | | | **29,566,976 B = 28.20 MiB** |

Ottawa is **33.30 MiB** and unchanged by this work.

### The budget number, derived rather than copied

Ottawa declares 48 MiB. Copying it would give this level 20 MiB of slack nobody chose. The derivation:

```
  64.00 MiB   CLAUDE.md's per-level ceiling, and level.schema.json's maximum
- 10.33 MiB   six Rive character surfaces at 1.72 MiB each (ADR-0013, measured by engine),
              which the texture gate structurally cannot see
-  8.00 MiB   Phaser render targets and the browser's own allocations. ADR-0013 calls
              "under 8 MiB left" for these uncomfortable, so 8 is the floor to leave, not a guess
= 45.67 MiB   the most a level's FILES may honestly declare
```

**Recommended `textureBudgetBytes` = 41 943 040 (40 MiB).** Under that 45.67 cap, and the measured 28.20 sits
at 71 % of it with 12.37 MiB spare — enough for a second POI hero or a second costume set, and tight enough
that the gate fires before the ceiling does. Ottawa's own ratio is 33.30 of 48 = 69 %, so this is the same
discipline at a smaller absolute number.

### What the number still does not include

The gate says so itself, unconditionally: *"EXCLUDES character render surfaces, which are allocated at runtime
and are not files: this total is a floor, not what the GPU will hold."*

A character surface is `characterSpace.width × characterSpace.height × scale² × 4` = 240 × 470 × 4 × 4 =
1 804 800 B ≈ **1.72 MiB each**, engine-measured (ADR-0013, second amendment — the 1.54 MiB figure art derived
first substituted `heightPx` for `height` and was wrong by one term).

So **Québec City's honest worst case is 28.20 + 10.33 = 38.53 MiB against a 64 MiB ceiling — 60 %.** Recorded
here rather than printed by the gate, deliberately: a number the gate cannot re-derive would look checked.

### What that constraint did to the drawing

1. **Every tile is cropped to the world band it actually covers**, and this level goes further than Ottawa did:
   the far bank is 150 rows and the river is 160, because that is all they occupy once the terrace is in front
   of them. The five layers cost **14.04 MiB** between them; authored 1920 tall at the same widths they would
   cost **59.58 MiB**, which is 45.54 MiB more and over the 64 MiB ceiling before a landmark or a character is
   loaded. This remains the single biggest saving available to any level in this game.
2. **The landmark is 900 rows, not 1920 and not the 1050 it started at.** Its first draft ran world y 150…1200
   with 230 empty rows above the finial. Cropping to the band it covers took it to 880 rows — and clipped the
   finial's tip, which the alpha bounding box caught and the eye had not. It settled at world y 300…1200, 900
   rows, with 6 px of margin above the finial. 150 rows saved, 0.62 MiB, and one clipped spire found by
   measuring instead of looking.
3. **The sixth layer was deleted.** §2. 1.37 MiB.
4. **Nothing is drawn that only survives at 2×.** The smallest deliberate feature in the level is a 4 px runner
   streak, which is the art bible's sanctioned stroke-overlay exception; the next smallest is a 7 px railing
   scroll and a 12 px baluster.

For comparison, the whole Québec City set at 2× would be **81.45 MiB** — over CLAUDE.md's 64 MiB ceiling on its
own, before a single character surface — and `layer-10-sky@2x` alone would be 15.64 MiB, more than half this
level's declared budget spent on a sky the player is moving past.

---

## 6. The Château Frontenac: what was measured, and the mistake that measuring caught

`make verify-art` shows the render with no filename and no label and asks what it is. That answer has to be
"the Château Frontenac" / "Québec City" before any feature is checked. These are the numbers that decide it.

Measured by **sky segmentation of the roof silhouette** and by **hue-filtered median sampling of the walls**,
not by eye, from three views of the same building:

| ratio | portrait ref | street elevation ref | dusk ref | **drawn** |
|---|---|---|---|---|
| tower width : total height | 1 : 3.27 | 1 : 2.85 | *1 : 1.40, discarded* | **1 : 3.27** (220 × 720) |
| tower crest height ÷ wing ridge height | 2.20 | 1.84 | 2.30 | **2.20** |
| tower standing above the wing ridge ÷ total height | 0.55 | 0.46 | 0.57 | **0.55** |
| tower above the ridge : tower width | 1 : 1.78 | 1 : 1.30 | — | **1 : 1.79** |
| tower roof height ÷ tower width | 1.04 | 0.58 *(oblique)* | — | **1.04** (229 on 220) |
| tower roof slope from horizontal | 62.7° | 60.2° | 64.4° / 64.5° | **62.3°** |
| green roof ÷ wing total height | 0.25 | 0.31 | — | **0.30** |
| conical turret apex angle | 33–36° | ≈ 50° | — | **40°** |

**The mistake worth recording is not a wrong number. It is averaging three right ones.**

The first build took the middle of each bracket — width:height 1 : 3.00, tower:wing 2.10, roof 0.95 of the
width — and produced a tower that was visibly too wide for what stood above the wings, because those three
ratios are not independent. They are three views of one geometry, and only one view is internally consistent
with itself: `chateau-frontenac-portrait.jpg` is a long-lens, near-orthographic elevation, and its four figures
close (528.3 / 240 = 2.20; 288.3 / 528.3 = 0.55; 288.3 / 161.7 = 1.78; 161.7 / 528.3 = 1 : 3.27). The street
elevation is oblique, so it sees two faces of the tower and inflates its width; the dusk shot is close, from
below, with the tower's base hidden behind the wings, so its width:height is not a measurement of the same
thing at all.

> **A drawing built from the middle of three brackets satisfies none of them.** Record the bracket, name the
> consistent view, and build to *that view's whole set*.

**Nothing on this subject is exaggerated.** Ottawa exaggerated the Peace Tower's clock dial because a truthful
dial was 16 px on a phone. Nothing here is that small: the smallest `mustBeRight` feature is a turret cone at
92 px across, and the roof pitch — the feature most easily lost — is a property of every roof on the building
at once, so drawing it truthfully costs nothing.

**One feature is dropped, and it took three attempts to admit it.** The corbelled corner bartizans on the tower
shaft are really there and are drawn in every reference. At 220 px of tower width a bartizan is a 46 px drum
under a 27 px cone, and three passes at it read as a brown lozenge stuck to the tower and nothing else.
Art-bible rule 4 is **drop, never substitute**; the stone quoin strips at the tower's corners, which are also
really there, stay and carry the corner.

**Simplified away, per `references.json`:** brick coursing, window mullions, the polygonal turret roofs' sixteen
facets (four read as a cone; sixteen read as noise), balcony ironwork, roof plant, the hotel's own signage.

**Never added, and none of it is present:** no clock face — there is no clock on this building and drawing one
would also make this landmark and Ottawa's the same landmark; no crenellation, arrow slits, drawbridge or moat
(it is an 1893 railway hotel in château style, and the roofs are the whole difference); no dome; no second
dominant tower; no flag, coat of arms or fleur-de-lys; and **no snow lying in a sheet on the roofs** — at 62°
these shed, and every winter reference shows them clear.

### The two-size test, and the 1× pin

Run at the shipping size of 1080 × 900:

- **25 %** (270 px) — every `mustBeRight` feature survives: the green copper roofs, the dark steep pyramidal
  tower roof, all four conical turrets, the red-brown brick with its pale banding, the lucarne rhythm, the rock
  and the spruces.
- **120 px black silhouette** — a wide low mass with a dominant central tower under a steep pointed roof,
  flanked by symmetric cones and a stepped roofline. It reads as a château, and it is not confusable with the
  Peace Tower's single slender shaft.

Both pass, which is what ADR-0013 as amended requires before a landmark departs from the 2× default. **It ships
at 1×**, as `landmark-chateau-frontenac@1x.svg` — 3.71 MiB instead of 14.83.

### The placement floor

**Do not draw this landmark below 300 px wide anywhere the player is meant to recognise it.** That is the
verifier's floor from Ottawa, **adopted rather than re-derived**, because no blind pass has been run on this
subject yet and the artist does not get to set an identification threshold for their own work.

What the size ladder shows, as a **drawing observation and explicitly not an identification**: at 300 px every
`mustBeRight` feature is legible including the lucarne rhythm; at 140 px the lucarnes, the stone banding and
the windows have collapsed to speckle and the read rests entirely on the four cone silhouettes, the dark
central pyramid and the green-on-red contrast. Whether that is still enough is the identifier's call.

### A new palette ramp, and why one was needed

`brick` — `#cb8f62` / `#ab5936` / `#6f271f` — is added to `palette.json`, derived by the standard formula from
a base of hsl(18, 52 %, 44 %). The base is **measured**: the hue-filtered median of 106 441 sunlit wall pixels
in `chateau-frontenac-street-elevation.jpg` is `#a27447` = hsl(29, 42 %, 46 %) under low warm autumn sun, and
the same wall under overcast winter light in `chateau-frontenac-portrait.jpg` medians `#735749` =
hsl(20, 21 %, 37 %). The base sits between them and slightly more saturated, per art-bible §2.

It exists because **`stone` is Nepean sandstone buff and belongs to Parliament Hill.** Drawing the Château in
it would make Québec City's landmark the same colour as Ottawa's, and green-copper-on-red-brick against
green-copper-on-buff-sandstone is the single cleanest thing separating the two levels' heroes.

`chateau-frontenac-tower-2024.jpg` was **not** used for colour: it carries no ICC profile and its white balance
is markedly cool — a hue-filtered median over its entire façade returns **zero** brick-hued pixels. It is the
same trap as Ottawa's night clock photograph wearing different clothes, and it is labelled in
`references.json`. All ten references were converted from their embedded profiles to sRGB before sampling, so
the colours measured off them are the colours a browser shows.

---

## 7. A toboggan run in a side view

`references.json` describes the containment of a toboggan chute. Both historical references look **down** the
run, where the chute's two walls converge to a vanishing point. TrueNorth is a portrait side-scroller and looks
**across** it, where that view does not exist. In the side view the containment reads as:

- one low timber wall, snow-capped, running the full width along the **far** side of the lane, drawn at the
  foot of `layer-50-terrace` so it sits at the promenade's depth rather than the run's;
- two straight, level lane-divider ridges running the full width — the 1905 photograph shows three lanes
  separated by snow ridges, and the ridges are what say "chute" rather than "hillside";
- a near snow bank framing the bottom of the frame;
- straight, level, parallel edges throughout — a built chute, never a natural slope.

**Runner streaks, not skate arcs.** A toboggan runner scores straight lines. Ottawa's curved `snow-light` arcs
are skate marks and would say "rink" here, which is a different level and a different sport. This is the one
place the two winter levels' surface treatments must not be shared, and it is a four-pixel decision that
carries the locomotion.

### Two defects a genuinely blind pass found, and what they cost to fix

Recorded here rather than quietly corrected, because both were *predicted by this file's own rules* and got
through anyway, and that is the useful part.

**1. The kiosk was architecture pretending to be street furniture.** Unprimed, with no place name anywhere
in its briefing, the verifier named **Terrasse Dufferin, Québec City** off `layer-50-terrace` — and its
decisive cue was the kiosk: "green-and-white radial roof stripes, white finial, white pavilion with dark
bays. It is the Dufferin Terrace kiosk as photographed in `dufferin-terrace-boardwalk.jpg`." That tile
repeats every 2016 px, and this subject's own `neverAdd` already forbade "any other named or recognisable
building, drawn into either of these two REPEATING tiles". §3 above even records moving the kiosk *inside*
the tile for composition — it was reasoned about as furniture at the moment it should have been recognised as
architecture. **It is now a plain open timber shelter**: a `wood-base` frame on three posts, a `slate-base`
hipped roof, a bench, and no stripes, no finial and no white pavilion. `references.json` carries the rule in
its new form — *furniture that is really architecture is architecture*.

**2. The lane read as water, and the cause was in this contract rather than in the drawing.** The verifier
read the whole lower half as a "frozen ice-covered river" with "wind-blown ice streaks" and recorded the
built-chute feature **absent**. That is not a wording near-miss: none of the eight accepted answers is about
water, so the subject was never read as a toboggan run at all. The diagnosis is exact and it is this file's
fault, not the artist's eye — **feature 6 was fighting feature 1**. Feature 6 said "use the `ice` ramp for
the polished lane", so the lane was the same blue-white ramp as the Rideau Canal Skateway, **in the same
hand-off**, and the strongest colour signal in the picture said water. Correctly drawn straight runner marks
cannot outvote a ramp. Three corrections, all in `layer-60-slope.svg`:

- **The lane is now the `snow` ramp.** `ice` is forbidden on it in `references.json`, scoped to this subject
  so it does not contradict the canal's requirement.
- **The two lane dividers are modelled** — a shaded far flank, a lit crest, a shaded near flank — instead of
  being a boundary between two flat colour bands, which reads as a change of surface rather than as a ridge.
- **Two riders on flat wooden toboggans are drawn on the lane**, seated, knees up, leaning back, the posture
  in `toboggan-slide-riders.jpg`. There was no toboggan and no rider anywhere in 1440 px, and a verifier was
  being asked to name a sport from an empty surface.

**The far rider was decapitated by the tile seam, and the order the fix had to be done in is the point.**
Found 2026-09-08 by the blind hand-off's source scan: the far rider was authored partly ABOVE the viewBox —
head circle at local y 1.52, toque hull from −21.9 to +2.3 — so `layer-60-slope` clipped it at its own top
edge and, in the composite at `nearTop` 580, about 50 px of toque survived on render rows 580–581, landing on
the terrace's timber wall rather than on the lane. **Its toque was `ice-base` `#a9d0e5`.** `references.json`
forbids the `ice` ramp anywhere on this lane — scoped to this subject, because the Rideau Canal requires it —
so *moving the rider down first would have carried an ice-coloured shape onto the lane and created the breach
that the correction exists to prevent.* The obvious fix makes the thing worse. So: **recolour, then move.**
The toque and its brim are now `cobalt-light` `#2275c6`, a garment blue that no ice or snow ramp contains, and
`#a9d0e5` no longer appears anywhere in the file. Only then was the rider moved: scaled 0.82 about its own
ground contact at (1080, 96) and shifted 4 px down, so the whole figure — including every path CONTROL point,
which is what a bounding-box scan measures — sits at local y ≥ 3.34. The toboggan stays in the far lane band
between the top of the tile and the first divider ridge, so the far rider is still smaller and further up the
run than the near one, which is the depth cue that made two riders worth drawing. Nothing else in the file
moved and no other shape changed colour.

Note what the two runs of this subject are worth against each other: **the previous, primed reading recorded
the built-chute feature PRESENT and this unprimed one recorded it absent.** That difference is the whole
value of the anonymised hand-off.

### And one placement finding that is not art's to fix

`layer-60-slope` is placed at `offset.y` **1280** and this level's ground polyline is **1280** the whole way.
`app/adapters/phaser/level-scene.ts` paints the ground polygon **opaque, at depth 400, over every parallax
layer**, filling from the polyline to the bottom of the world. **So none of the toboggan run is visible in
game** — the entire 1440 × 560 tile is painted over, including both corrections above. The `verify-art`
hand-off composites the two tiles directly rather than through the engine, which is why the subject can be
judged on art the player never sees.

The fix is one number in `content/levels/quebec-city.json` — raise the run above the ground line, or lower
the ground polyline under it — and it is content's, not art's. Ottawa has a milder form of the same problem
(`layer-60-ice` at 1210 under a ground line at 1240 shows 30 of its 230 rows). `assets/style/halifax-level.md`
§7.1 records it in full; Halifax and Toronto avoid it by construction, with no layer content below y = 1280.

**The hoops became a footbridge.** Both historical photographs show a run of timber hoop arches over the chute.
A run of them is overhead in *every* frame, including the one framing the landmark. One timber footbridge per
2016 px tile does the same job — a portal the tobogganer passes through — and Ottawa already validated that
solution for a bridge over a canal. Deck over, two braced trestles either side landing on their own drawn snow
shelves so they never appear to float, clear span 420 px against a 154 px player, underside at world y 792,
which is 68 px above a 420 px character's head.

**People walking, not skating.** Six background figures per tile, standing and walking on the promenade: six
heads tall, the same proportion canon as every other figure in the game, drawn small because they are further
away and never because they matter less. Winter coats, toques, mitts, boots. **No outline on any of them** — a
figure authored into a parallax tile is background; a figure authored as a character artboard carries the
6/4/3 px ink. **No cultural marker of any kind on any of them**, which is `docs/content-review.md` §3.3
outcome 2 applied deliberately rather than by omission.

**Never added, and none of it is present:** no hockey boards, nets or line markings; no ski lift, chairlift or
tow rope; no mountains on the horizon; no lettering or signage in either language.

---

## 8. The POI marker

132 × 176 at design resolution. 44 pt on the narrowest supported viewport (390 pt) is 122 design px, so the
marker's own bounds clear the touch-target floor *before* the POI's `radiusPx` is considered.

A terrace interpretive panel on a dark-green cast-iron post, matching the Dufferin Terrace's own ironwork in
`refs/quebec-city/dufferin-terrace-boardwalk.jpg` — not an invented game icon. Its text lines are drawn as a
rhythm of `slate-light` bars and **never as lettering**: `make verify-art` refuses any render source containing
a `<text>` element, because a name drawn into the picture defeats every byte-level leak check ever written.

Idle and in-reach differ by **shape as well as colour**: idle is a hollow `snow-light` ring; in reach the ring
fills, gains a `pine-base` disc and a `snow-light` core, and gains a second ring outside it. Colour is never
the only signal, no glow so the state survives a renderer with no Filters, and no animation so it survives
reduced motion.

---

## 9. Open questions this level did not answer

- **`OQ-QUEBEC-1`** — the Château Frontenac is an operating hotel under a live trade name. The art draws the
  building and **no wordmark, sign, awning, flag or emblem of any kind**, on the same reasoning
  `art-bible.md` §10 applies to the officer: draw the silhouette that carries the recognition, omit the marks
  that identify the institution, write down why. Canada has freedom of panorama for architecture
  (Copyright Act s.32.2(1)(b)), so the *building* is safe to depict; the *name* is the PO's call and the copy
  must satisfy that constraint. Recorded, not resolved.
- **`OQ-QUEBEC-2`** — the territory statement for this level. Not an art decision and deliberately not proposed
  here: `docs/content-review.md` §10 requires a citable fact and nation names taken from that nation's own
  material, and no agent grants cultural sign-off. The art asserts nothing.
- ~~**`OQ-QUEBEC-3`**~~ — ~~the art bible says "a landmark is under 60 shapes at the hero layer".~~
  **CLOSED 2026-09-08 by ADR-0025: the shape budget is retired as a gate.** Shape count has no runtime cost,
  because every SVG is rasterised to atlas frames. Report the count; the binding tests are blind
  identification and the two-size test. The art bible §1 now says so. The Château stays at 259.
- **`OQ-ART-04`** — which red is the National Flag? Still open, and this level dodges it entirely: it draws no
  flag.
- **One open blocker** — see §0. `content/levels/quebec-city.json` must land in the same commit as this art,
  or `make assets` is red for every level and not just this one. The `scripts/lib/art-handoff.mjs` half is
  closed: infra wrote both `RECIPES` builders in-flight.

## 10. A note for whoever wires the layers up

Same warning as Ottawa's page, and it bites harder here: `level.schema.json` says the graphics preset "keeps
the highest-depth layers and drops the rest", so the **sky is the first layer dropped, not the last**. This
level has *five* layers against a `high` budget of six, which is a deliberate choice recorded in §2 and not a
missing file — a reader who counts six slots and finds five should read that section before drawing a sixth.
