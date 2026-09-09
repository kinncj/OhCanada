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

**And for a character, look at the composite, not the part.** Every character part is unidentifiable alone —
a sleeve is a blue capsule — so the only honest review is a rasterised composite built from
`rig-contract.json` at the size the character ships at. Three separate defects in the player costume were
invisible in the SVG and obvious in the render at 160 px: a scarf that read as a Sam Browne sash, a hood ruff
that read as shoulder pads, and a toque band that covered the brows and cost the expression system a third of
its vocabulary. `references.json` carries a `renderRecipe` for each character subject for this reason.

**The toque band came back, and the way it came back is the lesson.** Its own `<title>` said "the band stops
ABOVE the brows" for a month while the band was cutting the eyes in half in every render, because the claim
was written and never measured. It is measured now, in the file and in §7.3: the highest brow ink in the four
expressions is **y 53.2** (`face-surprised`), and the band's lowest ink over the face — x 118 to 156 — is
**y 47**. A prose claim about occlusion in a part's title is worth nothing; the number and the render are the
claim. **`hat-serge` still fails this**: its brim's lower arc dips to y ≈ 64 across the face and hides the
officer's brows in all four expressions, so that character plays three cues where everyone else plays five.
Fixing it needs the brim reshaped rather than raised — the crown's ink is already at y 2 and nothing in this
rig may sit above y = 0 — which is a measured job against a 0.92 identification and is not done here.

---

## 2. The three tones

`palette.json` is the allow-list. **Any fill or stroke not in `colours` is a defect.** Add a colour there,
with a ramp, before you use it.

**The palette lint exists now and runs inside `make assets`** (`OQ-ART-11`, closed). It refuses any fill or
stroke that is not in `colours`, and it refuses `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`,
`<image>`, `<style>` and any `url(…)` paint that is not a `clipPath` (ADR-0011). It reports what it checked:
as of 2026-09-08, `4263 fill/stroke declaration(s) in 90 source(s) against 105 distinct palette colour(s)`.
Hand-checking a level and writing "checked by hand" in its sheet is over.

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

### 7.1 Every character is drawn in THREE-QUARTER VIEW, facing the way it travels

The game is a portrait 2D side-scroller. Every character in it walks, skates, toboggans or bikes ALONG the
screen, so a character drawn front-on, looking out at the player, is wrong by construction: it reads as a
menu portrait somebody slid sideways. **The canonical facing is RIGHT, with the body turned about 40° off
strict profile toward the viewer**, and `setFacing('left')` mirrors the whole composite.

**The head turns FURTHER than the body: about 25° off strict profile against the torso's 40°.** That is not
a compromise, it is what people do when they walk — the head leads. It also protects the officer's Sam
Browne, which needs the chest plane the torso keeps.

The first pass got this wrong and it is worth recording how, because the mistake was invisible in every SVG
and obvious in one render. The body turned and the head was left at the torso's shallower angle. Rendered at
390 px beside the beaver guide, whose muzzle projects 25 px past its cranium, the animal read as travelling
and both humans read as standing still looking out at the player — which is the original defect, surviving
in the one part of the figure a viewer actually looks at.

**What carries a turned head at phone size is the SILHOUETTE, not cues drawn on it.** Every cue in the first
pass was defensible in the markup and sub-pixel on a phone: a 6 px nose bump is 2 px at 390 px, a far eye
12 px from the cheek edge is not crowded, and an ear inside the head outline is an ink line on skin. The head
is now built the way the beaver's always was — an ASYMMETRIC OUTLINE, big smooth cranium behind, brow, nose,
lip and chin in front — with the drawn cues supporting it rather than carrying it.

**Where the line falls, said out loud because the next redraw will want to cross it: the far eye must keep a
visible white sclera and a whole ink pupil.** Four expressions differ in the shape of two brows and two
pupils, so a head turned far enough to occlude the far eye behind the nose deletes half the expression
vocabulary, and no gain in silhouette buys that back. At 25° the far eye is 4.2 px wide with a 2.8 px pupil,
6 px clear of the cheek edge. That is the stop.

Three-quarter rather than strict profile, and the reason is not taste:

- **The expression system needs two eyes.** Four expressions differ in the shape of brow, pupil and mouth
  (§6 of `rig-contract.md`). A strict profile shows one eye and one brow and loses half of that vocabulary.
- **The officer's Sam Browne needs a chest.** Its shoulder-to-hip diagonal is half of that character's
  identity and it is the reason it identified at 0.92 in a blind run. A chest seen edge-on has no diagonal
  on it.
- **The character creator needs a face.** Six skin ramps, four hair shapes, glasses: a profile hides the
  far side of all of them.

What carries the turn, and what a redraw must not quietly drop:

| cue | where | carries it at 390 px? |
|---|---|---|
| an ASYMMETRIC head outline: cranium behind, brow, nose, lip and chin in front, the nose projecting 16 px | `head-skin-*`, `head-shell-beaver` | **only if nothing else reaches further forward — see §7.4, which is the trap this line fell into** |
| the hair mass at the BACK, its fringe stopping at a tip INSIDE the forehead so the face profile is the leading edge | every `hair-*` | yes: at this size hair is a large flat colour block, and a fringe that overhangs the brow deletes the profile behind it |
| chest plane and its fastening on the LEADING edge, back on the trailing edge | every torso | yes |
| both feet pointing the way the character travels, far foot shorter | `foot-r-*`, `foot-l-*` | yes |
| the hat brim swung forward, the toque band following the brow line downhill to the back | `hat-serge`, `head-covering-toque` | yes |
| eyes crowded into the front third, 15 px apart, far eye foreshortened 6 px off the cheek edge | `face-*` | at 1× and 0.5× |
| ONE ear, set well back on the near side | `head-skin-*`, `head-shell-beaver` | no, and that is fine — it is a supporting cue, not a load-bearing one |
| a NECK: a lit column between the jaw and a darker collar, its base closed over by the coat | `neck-{skin}`, and the neckline cut into every `torso-*` | yes, and it is what stops the whole head-and-shoulder mass reading as one lump |

**The near side is the wearer's RIGHT.** A person facing east, seen from the south, shows you their right
side; their right shoulder lands *west* of their spine on your screen. So `-r` parts draw IN FRONT (z 9–11
and 20–22) and `-l` parts behind, and the near shoulder sits at x = 103 while the far one — the leading,
chest-side shoulder — sits at x = 137.

### 7.2 The measurements, and where the widths come from

| measurement | in heads | at design res (H = 420 px, head = 70 px) |
|---|---|---|
| total height | 6.00 | 420 px |
| head height | 1.00 | 70 px |
| head width | 0.85 | 60 px |
| **shoulder joint span**, near pivot to far pivot, as projected in this view | 0.49 | **34 px** (x = 103 and 137) |
| **shoulder width**, across the bare figure at the shoulder line | 1.37 | **96 px** |
| **maximum dressed silhouette AT REST**, wherever it falls on the figure | ≤ 1.66 | **≤ 116 px** |
| **visible neck**, jaw ink to collar ink | 0.149 of head height | **12–13 px** |
| **neck width**, skin between the ink edges | 0.26 of shoulder width | **22 px** (ink outer 34 px) |
| hip width | 1.30 | 91 px |
| hip to sole | 2.80 | 196 px |
| hand width | 0.55 | 38 px |
| foot length | 0.70 | 49 px |
| eye line | 0.50 of head height from the crown | 35 px down from the crown |
| eye spacing | one eye-width apart, foreshortened to ~0.65 of that in this view | — |

**The shoulder rows are measured, and the old ones were not.** This table used to say *shoulder width 2.20
heads = 154 px* with no statement of whether that meant the body or the coat, and it produced a figure the
repository owner described as having shoulders that "are not proportional". It did. Against a photograph:

> `assets/refs/ottawa/rideau-canal-skateway-ice.jpg`, the adult in a winter parka walking toward the camera
> at the centre of the frame. Crown to sole **235 px**; across the shoulders with the arms hanging in
> **56 px**; the coat body alone, at the chest, **49 px**. That is **0.238** and **0.209** of the figure's
> own height. A child in a puffy jacket, three figures to the right, measures **0.257** with the arms held
> out.

The old canon was **0.367** of height — 54 % over the photograph on the anchor that decides how a silhouette
reads, and 22 % over even in head units. What ships now is 96 px bare (**0.229**) and at most 116 px dressed
(**0.276**), which is the photograph plus a deliberate cartoon broadening of about a tenth.

**A garment may add bulk; a body may not.** A parka genuinely broadens the shoulders and a fitted tunic
barely does, so the costumes are allowed to differ *within one budget*: the widest point of the dressed
figure at rest is **108 px on the parka, 104 px on the serge and 113 px at the beaver's waist**. Two things
are measured beside that rather than inside it, because neither is the body: the officer's **hat brim at
106 px**, which is headgear above the crown exactly as the toque is, and the guide's **paddle tail at
132 px**, which is a limb held out to one side. Everything is inside the 116 px cap. What
is identical is the *figure* — the crown, the sole, the eye line, the shoulder, hip, knee and ankle heights,
the hand and foot frames, the stroke weights. Anyone tightening this rule should measure those, not the
outline of the coat, and `assets/refs/references.json` now says so in the words a verifier is given.

**The cap is on the figure, not on the animation.** The rest pose is what the art hand-off composites and
what a proportion is judged from; a stride, a reach or a fall legitimately carries a hand or a foot outside
it. The measured maximum across all eight states and every costume is **206 px**, at `jump-fall` t = 1,
where both arms are out. That is a pose. Anything at rest over 116 px is a proportion, and is a defect.

- Head is a rounded shape wider at the cranium than the jaw, never a circle, and it is turned: cranium
  behind the face plane, one ear, a nose on the leading edge.
- Hands are mitten-simplified: one mass plus a thumb. No separated fingers at any size.
- Feet are single rounded wedges and BOTH point the way the character travels. Skates add a blade and a
  boot cuff, nothing else.
- **Costume distinguishes characters. Stature never does.** An official, an elder, a child in a story role
  and the player all stand 6 heads tall in the same pose canon. Age and role read through clothing,
  silhouette and hair, not through being drawn bigger or smaller.
- Faces are minimal: eyes, brows, a simple mouth. No noses under 6 px. No caricatured features of any
  ethnicity, ever. `docs/content-review.md` §8.2 governs this and now exists; its slot-independence rule is
  the mechanical version of the same instruction.

**The canon covers the animal companion too.** The beaver guide is on the same rig at the same 6 heads, with
the same crown, sole, eye line, hand and foot sizes and stroke weights as every person in the game
(`assets/style/guide.md`). A second rig would have been a second canon, and `docs/content-review.md` §6.2 is
explicit that comparison only works if everyone is compared. The one row of the table above that cannot
apply to it — every skin fill is a `skin-1`…`skin-6` entry — is named as an exemption in its own sheet, for
one non-human artboard, and for no human character ever.

### 7.3 The neck, and where its length comes from

The figure had no neck. The repository owner said so from the live site — *"the head is on the torso"* — and
the render agreed: the head's ink bottom and the coat's collar ink overlapped by about 6 px, and the thing
called a neck was a 9 px stub of **skin-shade** drawn INSIDE `head-{skin}`, on top of the collar, in a tone
two steps from the outline ink. At 390 px it was three dark pixels between two dark pixels. It read as a
notch, and with no break in it the shoulder line ran straight into the jaw, which is most of why the
shoulders still looked wrong after their width was corrected.

**Measured, on `assets/refs/officer/red-serge-full-figure.jpg`**, which is the only reference in the set
that shows a whole figure with a neck in it. The skateway photograph that the shoulder rows came from cannot
answer this question — every adult in it is hooded — so the scale of this photograph was checked against it
rather than assumed. By colour segmentation of the skin region, at full resolution:

> Eye line **y 211**, chin **y 316**, so head height **208 px** (the eye line is half a head from the crown,
> which is the row above and is how the crown gets measured under a hat). Face width at the cheekbones
> **145 px**, head width including the cranium **≈ 175 px**. Neck width at the throat, row y 318:
> **85 px**. Collar top at the throat: **y 347**. Shoulder line, top of the trapezius at the strap:
> **y 375**. Shoulder-to-shoulder across the tunic **≈ 330 px**.
>
> **visible neck 31 px = 0.149 head heights. neck 85 px = 0.258 of shoulder width. chin to shoulder line
> 59 px = 0.284 head heights.**

Two of those three convert cleanly and one does not, and the one that does not is recorded rather than
smoothed over:

- **Visible length.** 0.149 of a head. The rig's head UNIT is 70 px, which gives 10.4 px; the head as DRAWN
  is 85.5 px of ink, which gives 12.7 px. The drawn head is what an eye normalises against, so the shipped
  figure carries **12–13 px** — the head ink bottom sits at y ≈ 121 and the collar ink top at y ≈ 134 on
  every costume. **3.6 px of the neck's own light skin at 390 px**, which is exactly what the reference
  photograph shows when it is scaled to the same 152 px figure height, and it reads there. No legibility
  exaggeration was applied and none was needed.
- **Width.** Normalised by SHOULDER width, not by head height. 0.258 × 96 px of bare shoulder = 24.8 px, and
  the shipped column shows **22 px of skin inside a 34 px ink outer**. Normalising by head height instead
  would have given 35 px, and it is wrong for the obvious reason: this head is a cartoon head, 93 px wide
  over a 96 px shoulder, so anything measured off it inherits the exaggeration. A neck belongs to the body.
- **Chin to shoulder line.** The photograph says 0.284 of a head; the rig has **14.5 px against the 19.9 px
  that implies**, because the drawn head is 22 % taller than the head unit and its jaw cannot be trimmed —
  `face-surprised`'s mouth already ends 5 px above the chin, and cutting the jaw would put the mouth through
  it. **This row is not met and is not going to be met without re-proportioning the head**, which is a
  different job with a different risk. It is written down here so that the next person measures it rather
  than rediscovering it.

**What actually makes a 3.6 px neck read is not its length: it is the tonal sandwich.** In the reference
scaled to ship size the neck is about three pixels and it is perfectly legible, because there is a DARK
collar directly under a LIT column. The old stub had it inverted — a shade-toned neck over a white fur ruff
— and vanished. So every costume now closes a darker collar over the base of the neck, and the neck itself
is base skin with the ramp's light on the trailing edge and its shade on the leading one:

| costume | what closes over the neck | measured at 390 px |
|---|---|---|
| `parka` | fur ruff, its top edge cut into a neck opening at y 137, and the coat's own opening cut lower still so a band of white fur shows between them | reads |
| `serge` | the standing collar, dropped to the base of the neck with its top edge scooped; navy under skin is the strongest contrast of the three | reads |
| `beaver` | nothing — a beaver has no collar. See below. |  reads |

**The guide is NOT an exception.** A beaver is very nearly neckless in life, and
`assets/refs/beaver/beaver-upright-winter-gnawing.jpg` shows exactly that: the head runs into the shoulder
mass with only a tonal break where the pale cheek fur meets the darker pelt. The guide still gets the same
`neck` part, at the same pivot, with the same keyframes and the same 12–13 px of visible column, because
`docs/content-review.md` §6.2 only lets you compare characters if everyone is compared and a second neck
canon is a second canon. What is exempt is the SURFACE, on the one non-human artboard and on no human one
ever: the guide's column is pelt, not skin — `head-shell-beaver` covers the shared `neck-{skin}` exactly as
it already covers the shared head and the shared short crop — and it is `leather-shade` where the body is
`leather-base`, so it reads as the animal's heavy neck ruff rather than as a person's column. That is the
same exemption `guide.md` already holds for the skin ramp, extended one part, and it is the only one.

**Judge it at 390 px on the three-figure comparison.** Everything in this section was invisible in the SVG
and obvious in a render, which is now the fifth time: the scarf reading as the Sam Browne, the ruff as
shoulder pads, the toque band over the brows, head cues that were all sub-pixel, and a neck that was in the
markup the whole time.

**Per-costume design sheets.** `assets/style/officer.md` (serge), `assets/style/player.md` (parka) and
`assets/style/guide.md` (beaver). Read the one for the costume you are touching: each records the decisions
that look like mistakes from the markup, and the player sheet in particular records why the coat is blue and
why the scarf hangs straight down.

---

### 7.4 A cue is only a cue if it is the OUTERMOST thing

The turn was put in the outline, the outline was checked, and the character still shipped reading as
front-facing. The reason is worth more than the fix:

> Measured on the shipped default — long hair, bare head — the HAIR was the leading edge from y = 40 to
> y = 68, a **28-row vertical wall at x = 152–158**, and the nose exceeded it by **11 px over 24 rows**. On
> a phone that is a 4 × 9 px bump on a straight edge. **A vertical leading edge is the silhouette of a
> front-facing head**, whatever is drawn inside it.

The old test — "the nose breaks the outline" — was **true of the part and false of the picture**, which is
exactly why it passed while the art was wrong. Measuring a feature in isolation says nothing; a feature
behind a neighbour that projects further is not on the silhouette at all.

**The rule.** From the crown down to the nose, the outermost pixel must move **forward, monotonically**, with
no vertical run longer than about 8 rows. That is one convex sweep — forehead, brow, nose, lip, chin — and it
is what a turned head looks like from outside. It is measured, not eyeballed: the art scratch harness walks
the head parts row by row and reports which part owns the leading edge at each one. **THIS MEASUREMENT NO LONGER DESCRIBES THE TREE. 2026-09-09.** It was taken against a redraw of the twenty
`hair-*` parts that was reverted; the shipped hair is the pre-redraw art and the vertical leading-edge wall
the paragraph above measures **is still there**. The rule stands and the fix does not: whoever picks this up
re-draws the hair and re-measures. The `head-covering` fallback is now `toque`, which covers the default
case but not `headCovering: none`, and `none` is the case this section is about.

The corollary binds every part, not just hair: **a fringe, a collar, a hood ruff or a hat brim that reaches
further forward than the face deletes the face's profile.** Give volume to a hairstyle upward and backward,
never forward past the brow.

### 7.5 A hidden part must END near the pivot it shares

The rig is flat (`rig-contract.md` §5): the shin rotates by hip + knee and the boot by hip + knee + **ankle**,
so the two differ by the ankle angle — up to 24° across the eight states. Anything of the shin far from the
ankle pivot swings out from under the boot.

The shin used to run to y = 456, four pixels off the sole line and as wide at the ankle as at the knee. On a
phone that read as a **peg leg**: a bare slate cylinder with a rounded cap hanging below the boot, in 11 of
23 animation frames. A point 6 px from the pivot moves 2.5 px at 24° and stays inside the boot; a point 20 px
away moved 8 px and did not.

> **A part that must stay hidden inside the part drawn after it has to end near their shared pivot, and
> taper into it.** Length past the pivot is what leaks.

**Applied 2026-09-09**, after the first attempt at it was reverted with the rest of that pass: all three
`leg-lower-*` now end at y 443 — **7 px past the ankle pivot, not 20** — and taper 35 px at the knee to
26 px at the ankle. Measured by difference over 24 phases of all eight states, all three costumes: **no
shin pixel is visible anywhere below the ankle pivot in any frame**, against 10.75 px below it before.

It is gated the same way — by difference, over every frame of every state and every costume, so it catches a
part leaking sideways as well as downward, and cannot be "fixed" in the one frame somebody noticed.

### 7.6 How to judge it, and every way that has been got wrong

**Render the DEFAULT appearance, mid-walk, at the camera's own scale, over a real level.** Every clause is
there because leaving it out has already shipped a defect:

| clause | what leaving it out cost |
|---|---|
| the **default** appearance | judged a chosen variant. The shipped default is long dark hair and a bare head, which is the worst case for the head silhouette, and it is the one a player meets |
| **mid-walk**, every frame | judged the rest pose. The peg leg is invisible at rest and present in 11 frames of 23 |
| the **device's** pixel ratio | judged at 1 device pixel per CSS pixel. A phone is at 3. **This is not the camera.** Screenshotted from the running build, same commit, same level, same frame, only `deviceScaleFactor` changed: the level art is pixel-identical and the CHARACTER grows from **113 × 59 CSS px to 166 × 72** — the parallax does not move, so no camera zoom can explain it. At `devicePixelRatio >= 2` the game loads the `@2x` shared atlas and `sprite-character-renderer.ts` sizes each part from the texture it got while positioning it in character space, so parts are drawn ~2× and placed at 1× and the figure comes apart: giant head, mitt off the sleeve, shin below the boot. **Nothing under `assets/` can fix that**; it is one `setDisplaySize(window.w, window.h)` in the renderer. Judge at DPR 1 *and* 3 until it is fixed |
| over a **real level** | judged a white strip. The game puts the figure against a parallax city with snow over it |

Three of this character's defects — a scarf reading as the officer's sash, a hood ruff reading as shoulder
pads, a toque covering the brows — were invisible in the SVG and obvious in a render. The fourth, a
front-facing head on a turned body, was invisible in a 1× render and obvious at phone width. The fifth and
sixth, the peg leg and the hair swallowing the profile, were invisible in **every** render made here and
obvious in a photograph of a phone. Each time the answer was to make the test more like the game.

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
| ~~**OQ-ART-11**~~ | ~~**There is no palette lint.** §2 above and `CLAUDE.md` both say "the palette lint fails on anything else", and no such gate exists anywhere in the repository: `scripts/validate-content.mjs` checks the palette's *internal* integrity — every ramp tone and ink resolves to a colour in `colours` — and never opens an SVG, and `scripts/assets.mjs` never reads `palette.json` at all. Every level so far has been checked by hand, which is exactly what `OQ-ART-02` was closed for being. The check is about twenty lines over `assets/src/svg/**`, it should also refuse `<filter>`, `<linearGradient>`, `<radialGradient>`, `<text>`, `<image>`, `<style>` and any `url(#…)` that is not a `clipPath` (ADR-0011), and it belongs inside `make assets`. Run by hand on 2026-09-08 over all 80 sources, 3 648 shapes: 0 off-palette fills or strokes, 0 forbidden constructs.~~ **CLOSED 2026-09-08 by infra.** It exists, it is inside `make assets`, it refuses every construct listed above, and it reports its own counts rather than a bare OK. §2 now says what the file does instead of apologising for what it did not. Kept struck through because the hand-checking it replaced should be remembered as having stopped for a reason. | infra | ~~the claim in §2 and in `CLAUDE.md`~~ |

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
