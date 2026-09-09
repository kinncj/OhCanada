# The guide: a beaver

The design sheet for `costume: beaver` — the artboard `guide`. Read with `art-bible.md`, `rig-contract.md`,
`docs/content-review.md` and `palette.json` open.

## 1. What it is and what it is not

The guide is the **companion who appears at points of interest and leads the learning moments.** It is a
North American beaver, *Castor canadensis*, drawn from the photographs in `assets/refs/beaver/`.

It is **not** the player. The player is a person with a character creator behind them — six skin ramps, four
hair shapes, five hair colours, two head coverings, two features, 480 appearances — and that creator is an
inclusion feature the project is not trading for a mascot. The beaver is where "truly Canadian" gets to be
literal without costing it.

It is also **not a stand-in for a person.** `docs/content-review.md` governs every depiction in this game
and it governs this one: the guide is an animal companion, it carries no clothing, no regalia, no pattern
and no cultural item of any kind, and it never speaks for or as anybody.

## 2. It is on the one rig, at the one proportion canon

`CLAUDE.md` requires identical cartoon proportions for every character, and `docs/content-review.md` §6.2
gives the reason: comparison only works if everyone is compared. A second rig would be a second canon and
nothing would compare them again.

So the guide is 6 heads of 70 px, 420 px crown to sole, the same crown line, the same sole line, the same
eye line, the same hand and foot sizes, the same three stroke weights and the same pivots as the player and
the officer. It plays the same eight states and the same four expressions, on the same nine inputs.

Two things make it work without a proportion break:

- **`head-shell-beaver` is the same head box.** Cranium inside the human cranium's outline, ears small and
  set low and well back at the side of the skull — which is where the references put them, and which is the
  difference between a beaver and a bear. High round ears were drawn first and read as a bear; they were
  redrawn after looking at the render, not at the markup.
- **The muzzle and the incisors are in that same frame, under `face`.** The shared eyes, brows and mouth
  draw on top of the snout pad, so the guide's expressions are the game's expressions rather than a second
  set nobody would keep in sync.

The rows of the `art-bible.md` §7 table that cannot apply to a non-human are named here rather than fudged:
**skin colour.** `docs/content-review.md` §6.2 lists "every fill is a `skin-1`…`skin-6` ramp entry" as a
verifier check, and the guide's fills are `leather`, `felt`, `hide` and `white`. That is a deliberate
exemption for one non-human artboard and it is recorded so a verifier scores it as *not applicable* rather
than as a failure — and so that no human character is ever scored the same way. **No pelt tone was added to
the `skin` slot**, which was the alternative and would have put a fur colour in the list of skin tones the
character creator offers a player. That is the reason `head-shell` consumes `{costume}` and not `{skin}`.

## 3. The two load-bearing features

The blind identification run measured that the small size tier destroys a **pose**, not a silhouette: both
pose-based subjects lost every small probe while landmarks survived. A character is a pose. So the two
features that make a beaver a beaver get the weight the officer's leg stripe gets under its own rule.

**The tail.** A broad flat scaly paddle, carried out to the wearer's right on a stub that leaves the body at
the hip and tucks behind the leg. It is *not* behind the figure: this is a front-facing game and anything
drawn behind a front-facing torso is not drawn at all. Three cross bands carry the scale as a rhythm, never
as a texture fill (`art-bible.md` §1). An inner ring was tried and removed — it made the paddle read as a
shell. The lit face was then enlarged to cover most of the upper half, because at phone size the tail and
the hind feet were both `hide-base` and merged into one dark mass; the hind feet now sit a tone lighter,
which is also correct, since a sole plane faces the sky and a hanging tail does not.

**The incisors.** Two of them, deliberately larger than life, white, hanging below the shared mouth line.
Exaggerating an identifying feature is simplification; adding one would be invention (`art-bible.md` §5).

**One labelled departure from the reference.** Beaver incisors are orange — iron-rich enamel, plainly orange
in `beaver-ontario-full-body.jpg`. They are drawn white here. At ship size each tooth is about 4 px wide,
below the 12 px minimum shape, and an orange tooth on a `felt` snout pad is two warm tans touching and
disappears. This is a legibility exaggeration of a real feature, not an invented one, and it is written down
so it reads as a decision.

## 4. Palette

| area | ramp | measured from |
|---|---|---|
| pelt | `leather` | Fur medians #654c3d (Ontario, winter sun), #54483b (Alberta, overcast) and #5b4d46 (Szmurlo, backlit) — hue 20–31°, L 28–32, and desaturated in every one because the fur is wet or the light is flat. `leather-base` is hsl(19°, 53 %, 32 %): the same hue and lightness, at the saturation the rest of the palette's browns work at. **No new fur ramp was added**, because one would have duplicated `leather` to within a few points and a ramp that duplicates another is a defect. |
| belly, cheeks, snout pad, inner ear | `felt` | The pale ventral fur and cheek. |
| tail, forepaws, hind feet, nose | `hide` | **New ramp — see below.** |
| incisors | `white` | |

### The `hide` ramp and its derivation

Authored 2026-09-08 the way `cobalt` was, from a measured base with the reasoning recorded.

- **Measured.** `beaver-paddle-tail.jpg` is the only reference in which the paddle is lit, in focus and not
  in silhouette: the median of 18 924 paddle pixels is `#293746` = hsl(211°, 26 %, 22 %). The same paddle in
  `beaver-ontario-full-body.jpg` medians `#100f13` = hsl(255°, 12 %, 7 %) and is a colour trap in the other
  direction — that exposure is set for snow and the paddle is backlit.
- **Corrected.** The lit sample is a *wet* paddle in low direct sun with bounce off wet rock, so it is
  lighter and bluer than the material. The base is authored between the two brackets at **hsl(210°, 18 %,
  17 %)** — the lit sample's hue, a saturation midway between the two.
- **Derived.** `light` and `shade` are the published formula with **no family override**: a tail is not skin
  and its sheen is cool sky, not the red-violet the skin and hair families rotate toward.
  `hide-light #44555f`, `hide-base #242b33`, `hide-shade #0f121a`. Adjacent lightness deltas 15 and 9, both
  inside the acceptance band.
- **Why it had to exist.** Nothing in the palette was this. `slate-shade` is hsl(222°, 24 %, 25 %) and reads
  as painted bridge steel beside brown fur; `navy-shade` is duty wool; `hair-black` carries the hair
  family's 350° shade rotation, which would put a red-violet shadow on a wet tail. `leather-shade` was the
  other candidate and is rejected because a tail drawn in the fur ramp's own shade tone stops being a
  separate form — and the tail is one of the two features that carry the identification.
- **It is not single-use.** The player's boot soles are `hide` too. A ramp that only one asset can use is a
  colour, not a ramp.

## 5. Texture cost, stated

The guide adds **ten frames** to the shared atlas. Measured against the previous commit, the whole of this
pass — the redrawn parka, the ten beaver frames and an alpha-trim of every character source — moves the
shared page from **1268 × 2048 (9.91 MiB) to 1410 × 2044 (10.99 MiB)**, and Halifax, the tightest level,
from **25.01 MiB (74 %) to 26.10 MiB (77 %)** of its 34 MiB budget. **+1.09 MiB of decoded texture at 2×,
for a new character.** Nothing is allocated outside the counted atlas: the guide's parts sit inside
`atlas/shared`, exactly like the player's and the officer's, so the sprite backend still adds no VRAM the
gate cannot see.

**It was +5.75 MiB before it was ten frames.** An eleventh, a separate `muzzle-beaver` of 71 × 54, tipped
the shared page across a packing boundary: the page jumped to **2043 × 2044, 15.93 MiB, at 44.5 %
occupancy**, and Halifax to 91 % of budget with 3.1 MiB spare. One 3 834 px frame cost 5 MiB. Folding the
muzzle into `head-shell-beaver` — which draws in the same place, in the same order, under `face` either way
— removed the frame, removed a rig part, and put the page back to 1410 × 2044.

Recorded at length because it is invisible in the source and because **the next frame added to this rig may
hit it again.** The packer fills full-height columns, so what decides is not the area added but whether it
fits the column that is open. Anyone adding a character part should read the `texture-memory` line before
and after, and treat a jump in the *page dimensions* as the signal, not the file size on disk.

## 6. References

`assets/refs/beaver/`, six files, all credited in `assets/credits.json`, all licence-checked against the
Wikimedia Commons API on 2026-09-08 **before** download: three public domain, one CC0, one CC BY 2.0 and one
CC BY 2.5. `beaver-upright-winter-gnawing.jpg` is the pose reference — a beaver sitting up on its hind legs
in snow with a stick in its forepaws, which is the stance this design is a cartoon of.
