# TrueNorth art bible

Everything a second artist needs to produce work that matches. Read with `palette.json` open beside you.

Design resolution is **1080 × 1920**, portrait, always (ADR-0002). Every pixel measurement here is at that
resolution unless it says otherwise.

The house style in one sentence: **casual cartoon — bold rounded silhouettes, a saturated palette, three-tone
cel shading, a thick outline on characters only, and soft ambient occlusion baked in.**

The rule that overrides taste: **landmarks and characters are simplified, never invented.** A render passes
`make verify-art` only when an agent, shown the image alone with no filename and no label, names the subject
correctly and every required feature is present. "Recognisable once you know what it is" is a failure.

---

## 1. Shape language

**Bold and rounded.** Every silhouette is built from a small number of large shapes. If a shape is smaller
than 12 px on its longest side at design resolution, it does not exist — merge it into its neighbour or drop
it.

- **Corner radius.** Nothing is perfectly sharp except where the real subject is sharp and the sharpness is
  identifying. Default corner radius is 8 px on props and characters. A Gothic arch head stays pointed,
  because that point is what makes it Gothic; a bench arm gets an 8 px round.
- **Curves over straights.** Prefer one continuous curve to three straight segments. Limbs are capsules.
  Torsos are rounded rectangles. Snow banks are single swept arcs.
- ~~**Shape count budget.**~~ **RETIRED AS A GATE, 2026-09-08, by ADR-0025.** The figure was "a landmark is
  under 60 shapes at the hero layer", and **no landmark this project has ever shipped met it**: Parliament
  Hill is 166, the Château Frontenac 259, the Halifax Town Clock 113, Pier 21 137, the CN Tower 49. The
  Peace Tower identified cold at 0.92 and the Château at 0.80. Shape count has **no runtime cost** — every
  SVG is rasterised to atlas frames, so the GPU never sees a path — and it costs only source bytes and
  rasterise time, neither of which is a budget in `CLAUDE.md`. **Report the count in the level sheet. The
  binding tests are blind identification and the two-size test in §5.**

  What the number was *reaching for* is still true and is now said directly: **do not draw detail that
  vanishes at 25 %.** The 12 px minimum below and the two-size test enforce that, and they enforce it by
  measuring the thing that matters instead of counting a proxy for it. The CN Tower is the ADR's own
  example: 49 shapes, and it is the most recognisable render in the game.
- **No texture, no noise, no gradients.** Surface variety comes from the three tones and from silhouette,
  not from fill patterns. The one sanctioned exception is the skate scoring on canal ice, which is a sparse
  repeating stroke overlay, authored as shapes.
- **Overlap, do not intersect.** Parts sit in front of one another with clean overlaps so they can be
  separated into Rive slots later. Never merge two parts into one path that a rig would need to cut.

**Silhouette test.** Fill the whole asset with flat black at 25 % scale. If you cannot tell what it is, the
shapes are wrong. Fixing this with colour or detail is not fixing it.

---

## 2. The three tones

`palette.json` is the allow-list. **Any fill or stroke not in `colours` is a defect.** Add a colour there,
with a ramp, before you use it. This sentence used to say "fails the palette lint", and **there is no palette
lint** — see `OQ-ART-11` in §11. Every level so far has been checked by hand; until the gate exists, check
yours and say so in the level sheet.

Three flat fills per material — `light`, `base`, `shade`. No fourth tone, no gradient, no dithering, no
soft-light overlays.

**How the three tones are chosen.** Author the **base** from the reference photograph, correcting for the
photograph's own light (the Red Serge sample reads `#be3828` because it was shot under warm indoor light;
the base is set slightly cooler and more saturated than the sample). Then *derive* the other two. Do not
eyeball them:

| tone | lightness | hue | saturation |
|---|---|---|---|
| **light** | +15 L (clamped at 96) | rotate 8° toward 45° (warm sun) | ×1.00 if base S < 12; ×0.92 if S ≤ 45; ×0.97 otherwise |
| **shade** | −16 L (clamped at 8) | rotate 12° toward 225° (cool sky) | unchanged if base S < 12; else S + (92 − S) × 0.10 |

One key light for the entire game: **warm sun, upper left, 35° above horizontal.** Ambient is cool sky and
snow bounce. That is why light rotates warm and shade rotates cool. Get this backwards on one asset and it
will read as pasted in from another game.

Two exceptions, both in `palette.json` as `familyOverrides`:

- **Skin and hair** rotate their shade toward **350°**, not 225°, and *lose* saturation
  (light ×0.80, shade ×0.78 for skin). Flesh shadow is red-violet, never blue. Without this override, pale
  skin shadows go orange and deep skin highlights go ochre — both were caught and corrected while this
  palette was being built.
- **Atmosphere ramps** — `sky`, `cloud`, `dusk`, `snow` — are authored by hand and exempt. They are vertical
  band sets rather than a lit material, and snow clamps at white.

**Acceptance band.** The formula yields about 15 L between adjacent tones. The floor is **8**, not 15,
because ramps whose base sits near the ends of the range clamp: `skin-6` and `hair-black` cannot span 15
twice without bottoming out at black. A clamped ramp is correct. A ramp that was eyeballed flat is not.

**Shadow is never grey and never black.** It keeps the material's hue and gains a little saturation. The
only near-neutral ramp is `path`, and neutrals are explicitly exempted from the saturation gain so they stay
neutral.

---

## 3. Outline

**Characters only.** Landmarks, buildings, props, background layers and particles have **no outline**.

| stroke | width | where |
|---|---|---|
| silhouette | 6 px | the outer edge of a character |
| major internal | 4 px | limb over torso, belt over coat, hood over head |
| minor internal | 3 px | pocket flap, button, cuff |

Round caps, round joins, **constant width**. No tapering: tapered strokes alias badly at atlas mip levels and
cannot be expressed as a Rive shape stroke.

**Ink colour is never `#000000`.** Pick the ink whose hue family matches the character's largest colour area:
`ink-warm` for warm-dominant, `ink-cool` for cool-dominant, `ink-neutral` only as a last resort.

**One ink for the whole character rig, and it is `ink-warm`.** The rule above is written per character, and
task 1.11 made that unusable: the head, the face and all twenty hair parts are **shared by every character
in the game**, so a per-character ink would mean drawing the same face twice in two inks. The rig therefore
fixes one ink for every character part. `ink-warm` is the right one because the shared parts *are* skin and
hair, both warm, and because a warm-brown outline sits correctly on the scarlet serge and on a green parka
alike. A costume whose largest area is cool does not get its own ink. See `rig-contract.md`.

**Backgrounds separate by tone, not by line.** If a background shape does not read without a line, its tone
is wrong. Change the tone. The moment you outline a building, the character stops being the thing the eye
goes to, and one-thumb play depends on the player finding the character instantly.

---

## 4. Ambient occlusion

Soft, baked, subtle. `ao-shadow` multiplied at **0.18** where parts overlap and **0.28** where a form meets
the ground. Maximum blur radius 24 px.

Baked as soft shapes in the SVG — **never as a runtime filter.** The Canvas visual tier has no Filters
(slice-1 task 1.19), so anything built on a filter silently vanishes on the devices that need help most.

AO goes at ground contact and at overlaps. Nowhere else. It is not a shading pass.

---

## 5. Simplifying a landmark without making it generic

This is the part that decides whether `verify-art` passes.

A landmark has an **identity budget**: a short list of features a person actually uses to recognise it.
Those survive at every size. Everything else is negotiable. `assets/refs/references.json` holds the list per
subject — `mustBeRight`, `simplifyAway`, `neverAdd` — and that file, not this one, is the contract.

The five rules:

1. **Proportions are load-bearing.** Match the reference's key ratios within **±10 %**. The Peace Tower's
   shaft-width to total-height is about 1:8; draw it at 1:5 and it is a generic town-hall clock tower no
   matter how good the clock is.
2. **Keep the named features whole.** The clock, the copper spire, the flag. These get *more* graphic
   emphasis than the photograph gives them, not less — a clock face that is 4 % of the tower's area in life
   may need to be 7 % to survive at phone size. Exaggerating an identifying feature is simplification.
   Adding one is invention.
3. **Repeated detail becomes rhythm, not count.** A Gothic window arcade becomes an evenly spaced run of
   arch shapes. The *number* of arches may differ from the reference. The spacing-to-width ratio and the
   shape of the arch head may not.
4. **Drop, never substitute.** Carving, tracery, mullions, gargoyles, coursing, dormers under 8 px: gone.
   Do not replace them with an invented simpler ornament. An empty stone face is accurate. A made-up
   quatrefoil is not.
5. **Never add.** No extra spire, no dome, no rose window, no crenellation the building does not have. The
   `neverAdd` list per subject exists because these are the specific inventions a cartoon style tempts you
   into.

`assets/style/ottawa-level.md` §6 is the worked example: the measured ratios for the Peace Tower, the two
numbers in `references.json` that measurement found wrong, and the one feature that is exaggerated on purpose
and labelled as such. Read it before simplifying the next landmark.

**The two-size test.** Before a landmark ships:

- at **25 %** of design size, every `mustBeRight` feature is still legible;
- as a **pure black silhouette 120 px tall**, the subject is still identifiable.

If it fails the second test, the problem is proportion, not detail.

---

## 6. Portrait composition (ADR-0002)

The canvas is 1080 × 1920 and is never stretched. Desktop and iPad centre the same portrait canvas and
extend the level's sky and ground colours into side panels.

```
y=0     ┌─────────────────────────┐
        │  120 px system band     │  notch, status bar. Nothing identifying here.
y=120   ├─────────────────────────┤
        │                         │
        │      PLAYFIELD          │  sky, parallax, landmarks
        │      upper two-thirds   │
        │                         │
y=1280  ├─────────────────────────┤  ground line sits at or just below here
        │  HUD, dialogue, cards   │  lower third, within thumb reach
y=1920  └─────────────────────────┘
```

- **Landmarks are hero-framed inside the playfield.** The single most identifying feature of a landmark —
  the Peace Tower's clock — sits **above y = 520** and is never occluded by a foreground parallax layer.
- **Safe margins.** Keep identifying features ≥ 64 px from the left and right edges and out of the top
  120 px. `viewport-fit=cover` and safe-area insets can eat the rest.
- **Ground line at y ≈ 1280.** Characters stand on the ground polyline defined in the level JSON. Authoring
  to a different ground height makes the level unreadable when the card panel opens.
- **Parallax layers extend horizontally only.** Each layer must tile at the seam. Vertical extension is
  never needed and never authored.
- **Crop each layer to the world band it actually covers.** "Author it 1920 tall" was this section's
  advice until task 1.9 measured what it costs: a full-screen layer is 8.3 MB of decoded texture at 1×
  and 33 MB at 2×, and Ottawa's six layers authored full height would have been 17 MiB over budget
  before a single landmark was placed. Transfer size is not the constraint — Ottawa's whole payload is
  0.32 MiB against 8 — **decoded texture memory is**, and it is what killed this project's 3D
  predecessor. Give each layer a `y` offset and only as many rows as its content needs.
- **2048 px is the widest a source gets.** `scripts/assets.mjs` rasterises at 1× and 2×, packs pages up
  to 2048 px and allows a standalone texture up to 4096 px. Anything wider than 2048 authored fails the
  build at 2×. A wide layer tiles, so it never needs to be one texture.
- **Full-screen parallax layers ship at 1×.** 2× is for characters, props and anything the player looks
  at closely. Practically: draw nothing on a background layer that only survives at 2×. The 12 px
  minimum-shape rule in §1 already enforces this — it is why Ottawa's layers survived being told, after
  they were drawn, which scale they ship at.
- **Side-panel seam.** The extreme left and right columns of the sky layer and of the ground layer must be
  the flat palette colour named in the level's theme, or the desktop side panel will show a visible join.
  `palette.json` `levelTheme` proposes those ids.
- **Layer budget.** Six parallax layers at the `high` preset, four at `medium`, two at `low`
  (`content/game.config.json`). **Which ones are dropped changed in slice 2 and it changes how you
  compose.** `app/adapters/phaser/level-effects.ts` `selectLayers` keeps **the layers that cover the most
  screen**, measured as visible width × visible height with the bottom clipped at the *highest* point of the
  ground polyline; ties go to the nearer band. The old rule was "keep the highest depths", which is
  nearest-first, and on Ottawa it dropped the sky and Parliament's silhouette and kept a canal wall that is
  nine tenths behind the ground.

  Three consequences for authoring, all of them measurable before you draw:
  1. **Work out the coverage of every band and write it in the level sheet.** Ottawa at `low` keeps sky and
     escarpment; Halifax keeps sky and quayside; Toronto keeps sky and skyline. Compose so that pair is a
     picture.
  2. **A band that sits mostly below the ground line ranks last and will be dropped first.** If your
     foreground matters, give it rows above the ground line.
  3. **Author as many layers as earn their texture, and no more.** "Author six" was this section's advice
     until Québec City deleted a sixth that was visible in a 40 px sliver, and Halifax and Toronto shipped
     four each for the same reason. A layer earns its texture only if its world band is not covered by a
     nearer opaque layer. Never put an identifying feature on any repeating layer at all — see §5.

- **Nothing you draw below the ground line will ever be seen.** `level-scene.ts` paints the ground polygon
  opaque at depth 400, over every parallax layer at depth 100+, filling from the polyline down to the bottom
  of the world. `selectLayers` models this correctly and the painter enforces it. Two shipped levels do not
  respect it — Ottawa's ice band shows 30 of its 230 rows and Québec City's toboggan run shows none of its
  560 — and both are one `offset.y` in a level document, not art. Draw the ground plane *behind* the player
  as rows **above** y = 1280, and let `theme.ground` be the surface at the player's feet.

---

## 7. Character proportions — identical for every character

`CLAUDE.md` requires cartoon proportions to be the same for everyone. This is not a style preference: it is
how the project avoids drawing some people as more heroic, more detailed or more important than others.

**The canon is 6 heads tall.** No exceptions, for any character, in any level.

| measurement | in heads | at design res (H = 420 px, head = 70 px) |
|---|---|---|
| total height | 6.00 | 420 px |
| head height | 1.00 | 70 px |
| head width | 0.85 | 60 px |
| shoulder width | 2.20 | 154 px |
| hip width | 1.80 | 126 px |
| hip to sole | 2.80 | 196 px |
| hand width | 0.55 | 38 px |
| foot length | 0.70 | 49 px |
| eye line | 0.50 of head height from the crown | 35 px down from the crown |
| eye spacing | one eye-width apart | — |

- Head is a rounded shape wider at the cranium than the jaw, never a circle.
- Hands are mitten-simplified: one mass plus a thumb. No separated fingers at any size.
- Feet are single rounded wedges. Skates add a blade and a boot cuff, nothing else.
- **Costume distinguishes characters. Stature never does.** An official, an elder, a child in a story role
  and the player all stand 6 heads tall in the same pose canon. Age and role read through clothing,
  silhouette and hair, not through being drawn bigger or smaller.
- Faces are minimal: eyes, brows, a simple mouth. No noses under 6 px. No caricatured features of any
  ethnicity, ever. `docs/content-review.md` §8.2 governs this and now exists; its slot-independence rule is
  the mechanical version of the same instruction.

---

## 8. Skin and hair

Six skin ramps, `skin-1` to `skin-6`, all produced by the same derivation rule so **no tone is the
default**. The character creator exposes all six. The numbering is lightest to deepest and carries no
meaning beyond ordering. Five hair ramps.

Skin and hair are **skin slots** on the character rig, not separate artboards. Changing skin tone must never
change a proportion, a silhouette, a stroke width or an animation.

Every option needs a **text name**, not just a swatch: `content/schemas/character.schema.json` requires it,
and CLAUDE.md requires that colour is never the only signal. Naming skin tones is not an art decision.
`docs/content-review.md` §8.1 governs it, forbids colour words, food words and any ethnicity or nationality
in a tone name, and its recommended ordinal naming is still an open recommendation (`OQ-REVIEW-6`), not a
settled answer. **The eleven ramps ship unnamed until that question is settled**, and the names arrive as
localiser keys, not as art. No agent grants cultural sign-off on them or on anything else
(`docs/content-review.md`, the standing rule at the top of the document).

**"No tone is the default" stands, and the schema agrees.** `OQ-REVIEW-7` recorded this section as a direct
conflict with `CharacterSlot.default`. The architect settled it in the schema by renaming the field to
`fallback`, documented as an id for NPC documents and save recovery and explicitly **not** a pre-selection,
with the creator randomising uniformly over every option on open (`docs/content-review.md` §8.3). Art did
not resolve that conflict and does not need to: the schema decided, and this section follows it unchanged.

---

## 9. Files and hand-off

- Author in SVG under `assets/src/svg/`. One file per logical asset. `viewBox` in design-resolution units.
- Every fill and stroke references a colour that exists in `palette.json` `colours`.
- **Character parts are one SVG per part, not `<g>` elements in one file.** Task 1.11 settled this: the
  asset pipeline makes one atlas frame per source file, so a part that is a `<g>` inside a shared file
  cannot be a frame. Each part is authored in the **shared 240 × 470 character space** and its `viewBox` is
  its window in that space, so the window origin is the part's offset and no placement number is written
  twice. `assets/style/rig-contract.md` is the contract — parts, draw order, pivots, slots, state-machine
  inputs, expressions and events — and `rig-contract.json` is the same thing as data. Sprite-sheet fallbacks
  use the identical slot names so content JSON never changes.
- `make assets` rasterises and packs, at 1× and 2×, and runs the per-level payload gate; a failure there
  fails the build. Per-level payload ≤ 8 MB, atlas page ≤ 2048 px, standalone texture ≤ 4096 px, decoded
  texture memory ≤ 64 MB per level and whatever the level document's own `textureBudgetBytes` declares,
  which is usually tighter. The level a source belongs to is read from its path:
  `assets/src/svg/<levelId>/<name>.svg` becomes the key `<levelId>-<name>`.
- **Do not ship a source the level cannot place.** `level.schema.json` has parallax layers, POIs and
  characters, and no concept of a loose prop. Six standalone prop files were authored for Ottawa and
  then deleted: their geometry was already inside a parallax tile, nothing could reference them, and the
  pipeline was packing and charging them to the level's texture budget anyway.
  **The same is true of `poi-marker-*` and `particle-*`, and two shipped levels still carry them.** There is
  no POI-marker sprite in the schema or the scene — `PlayableMarker` is a DOM element — and falling snow is
  drawn procedurally with `Graphics`, from no texture at all. Ottawa and Québec City each ship three such
  sources; they are packed and charged and nothing can reference them. Halifax and Toronto author none.
- **A POI has no `offset`.** `level-scene.ts` draws `poi.artKey` with origin `(0.5, 1)` at
  `(position.x, groundYAt(position.x))`, above every layer. So **the landmark file's bottom edge IS the
  ground line and its horizontal centre IS `position.x`** — author the ground contact into the bottom rows
  of the file, and crop the top to the alpha bounds.
- Per-level sheets sit beside this one — `halifax-level.md` (1), `quebec-city-level.md` (3),
  `ottawa-level.md` (4) and `toronto-level.md` (5) — and carry the layer table, world offsets, coverage
  figures and tier drop order, the plain/filtered table, the measured ratios and the measured budgets.
  `halifax-level.md` §7 additionally records three engine findings that apply to every level.
- Reference photographs stay in `assets/refs/` and are never shipped.

---

## 10. Depicting a real uniform

The slice-1 officer NPC wears the recognisable red-serge silhouette of a Canadian mounted police constable:
scarlet tunic, dark breeches with a yellow-gold leg stripe, wide-brimmed felt hat, brown Sam Browne belt and
boots. A newcomer studying for the citizenship test should look at the character and immediately think
*Mountie*. That recognition is the point, and a timid design would lose it.

**None of that silhouette is a protected mark. The insignia are.** So the officer carries no crest, no
badge, no bison-head device, no wordmark or lettering in any language anywhere in the level, no collar dogs,
no shoulder flashes, no rank chevrons and no service numbers. They are **simplified away, not approximated**
— an approximated insignia is worse than none, because it reads as an attempt at the real thing.

This is written here, and again in `assets/style/officer.md` and `assets/refs/references.json`, as a
**constraint with its reason** rather than a style note. An artist who finds the tunic under-decorated and
does not know why will helpfully add a badge. Decided by the repository owner on 2026-09-08 after the
licensing risk was raised.

**Naming.** The character is never "RCMP Officer" and never a member of a named force. Generic — "Constable",
or a personal name. The copy is the PO's; this is the constraint the copy has to satisfy.

**The same reasoning generalises.** Every later level has at least one costume drawn from a real institution
or culture. The rule is the same each time: *draw the silhouette that carries the recognition, omit the marks
that identify the institution, and write down why the omission happened.*

**And it does not extend to culture.** A protected mark is a legal question with a legal answer. Depicting a
living culture is not, and is governed by `docs/content-review.md`, which now exists and is substantial:
name the nation depicted, no invented patterns, no sacred items as props, no caricature, and **no agent may
grant cultural sign-off, ever**. Read it before drawing any of it. See §12.

---

## 11. Open questions

Recorded rather than resolved. Inventing a detail is worse than leaving a question open.

| id | question | owner | blocks |
|---|---|---|---|
| **OQ-ART-01** | ~~`content/schemas/palette.schema.json` does not exist~~ **HALF CLOSED 2026-09-08: the schema exists and the palette is validated against it in place** — `make validate-content` reports `palette 97 colour(s) in 31 ramp(s), every tone and ink resolved`. What is still open is only the **move**: the palette is authored at `assets/style/palette.json` and `CLAUDE.md` names `content/style/palette.json`. Two live paths for one allow-list is the kind of drift this table exists to catch, so it stays open until one of them is the only one. `content/**` is not art's to move. | architect | the canonical palette path named in `CLAUDE.md` |
| ~~**OQ-ART-02**~~ | ~~The credit gate reads `assets/dist/` only, so an asset committed anywhere else under `assets/` is credited by nobody and the check stays green. All 14 references here are credited by hand.~~ **CLOSED 2026-09-08 by infra.** The gate walks `assets/`, asserts set equality in both directions, and reports 14. It is a denylist, so an unrecognised file type defaults to "must be credited" — the first `.riv`, `.woff2` or `.ogg` cannot land uncredited. `credits.json` `path` is now relative to `assets/`, and every entry carries `kind`. Kept struck through because the next artist should know the hand-checking described in `assets/refs/README.md` rule 3 stopped for a reason, not by being forgotten. | infra | ADR-0006 obligation `due=2026-09-15 owner=art` |
| ~~**OQ-ART-03**~~ | ~~May this project depict the red-serge uniform, the wide-brimmed hat and the Sam Browne belt?~~ **ANSWERED 2026-09-08 by the repository owner: yes — the recognisable silhouette, without the protected marks.** Kept struck through rather than deleted, because the next artist needs to know the omissions in §9 were decided, not overlooked. See `assets/style/officer.md`. | user | — |
| **OQ-ART-04** | Which red is the National Flag of Canada? The Federal Identity Program specifies Pantone 032; renderings in the wild vary from `#FF0000` to `#D52B1E`. `flag-red-base` is currently `#d8262c`, chosen to read well in a saturated cartoon palette, not from a specification. | content-verifier | flag colour accuracy |
| **OQ-ART-05** | Centre Block has been under rehabilitation since 2019: cranes, hoarding, and wing roofs stripped to dark metal. Do we draw the settled building — green copper roofs, no scaffolding — or what a visitor sees today? Recommendation: the settled building, because that is what *Discover Canada* and every learner's mental image show, and the scaffolding will outlive neither the rehabilitation nor this game. Needs confirming, not assuming. **Task 1.9 has now drawn it settled**, on that recommendation — so this is no longer a question with no cost attached: answering it the other way is a redraw of `landmark-parliament-hill.svg`. | PO | the Peace Tower and skyline assets |
| **OQ-ART-06** | ~~`credits.schema.json`'s `licence` enum has no value for public domain, CC BY 2.0 or CC BY 3.0, and it *does* accept `CC-BY-SA-4.0`, which ADR-0004 forbids.~~ **The licence-value half is CLOSED, 2026-09-08 by the architect**, who reconciled the enum with ADR-0004 in both directions: `public-domain` and `CC-BY-1.0/2.0/2.5/3.0` added, `CC-BY-SA-4.0` removed. Three of the six parked references were fetched, credited and are in use, including the public-domain photograph that frames an officer and the Peace Tower in one portrait frame. The other three are ShareAlike and are now **out by decision**, not by accident — the schema and the ADR agree. **Still open:** the enum has no field for a licence-check date, so `assets/refs/README.md` and `references.json` carry it in prose. | architect | nothing; a licence-check date has no home |
| ~~**OQ-ART-07**~~ | ~~`docs/content-review.md` does not exist, though `CLAUDE.md`, `CONTRIBUTING.md`, `docs/architecture.md` and the art-verifier's own brief all cite it.~~ **CLOSED 2026-09-08: the document exists and is substantial.** It governs the skin-tone set (§8.1), slot independence (§8.2), the randomiser (§8.3) and every depiction of Indigenous people, art or land, and it forbids any agent from granting cultural sign-off. Two things it carries into tasks 1.9–1.11: the eleven ramps stay **unnamed** until `OQ-REVIEW-6` settles naming, and `OQ-REVIEW-7` (§8, "no tone is the default") was settled by the architect renaming `CharacterSlot.default` to `fallback` — art follows the schema and did not decide it. | routed by the coordinator | the character creator; slice 4 (Mi'kma'ki) |
| **OQ-ART-08** | Is the officer's gender presentation fixed, or a player choice? Not an art decision. The art is built so it can be either: gender presentation is a **skin slot** on one artboard with one proportion canon, so either answer is a data change. | PO (`OQ-LEVEL-3`) | the officer rig contract, task 1.11 |
| **OQ-ART-09** | Is scarlet review order plausible outdoors on canal ice in an Ottawa winter? It is a ceremonial uniform; the working winter answer is a parka. The level may be summer on the Hill and winter on the canal, or the officer may be posted ceremonially. A story and setting call, not an art one. | PO | the officer's placement in the level |
| **OQ-ART-10** | Does the officer carry a visible sidearm? The reference shows a holstered one; `officer.md` currently drops it under "simplify away", which is an art convenience and not a decision. | PO | the officer artboard |
| **OQ-ART-11** | **There is no palette lint.** §2 above and `CLAUDE.md` both say "the palette lint fails on anything else", and no such gate exists anywhere in the repository: `scripts/validate-content.mjs` checks the palette's *internal* integrity — every ramp tone and ink resolves to a colour in `colours` — and never opens an SVG, and `scripts/assets.mjs` never reads `palette.json` at all. Every level so far has been checked by hand, which is exactly what `OQ-ART-02` was closed for being. The check is about twenty lines over `assets/src/svg/**`, it should also refuse `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` and any `url(#…)` that is not a `clipPath` (ADR-0011), and it belongs inside `make assets`. Run by hand on 2026-09-08 over all 80 sources, 3 648 shapes: 0 off-palette fills or strokes, 0 forbidden constructs. | infra | the claim in §2 and in `CLAUDE.md` |

---

## 12. What is deliberately not here

- **Indigenous content.** Ottawa sits on **unceded Algonquin Anishinaabe territory**. Nothing in this bible
  designs a depiction of Indigenous people, art, regalia or land acknowledgement, and no such asset should be
  authored for slice 1. That holds unchanged for Halifax and Toronto: **no Indigenous content of any kind is
  drawn in either level** — no regalia, no pattern, no cultural item on any background figure — and neither
  level's sheet proposes a `territory` statement. `docs/content-review.md` governs that work, now exists, and is read before any of it
  is drawn — not after. Slice 4 is the Mi'kma'ki level and needs that review process actually running before
  it starts.
- **UI, text and focus-ring colours.** `ui-a11y` owns those and they must pass WCAG AA. They are absent from
  `palette.json` on purpose.
- **Insignia of any kind on the officer.** Not an omission and not a simplification: a constraint with a
  legal reason, recorded in §9 and in `assets/style/officer.md`.
