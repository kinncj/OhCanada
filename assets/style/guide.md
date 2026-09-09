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

**It moved when the player's shoulders were corrected**, because that is what the rule means. The player was
reported as out of proportion from the live site, the canon's shoulder row turned out to be 54 % over a
measured photograph (`art-bible.md` §7.2), and the barrel came in with it: **112 px at the waist** against
the parka's 108 and the tunic's 104, all inside one declared 116 px cap. The waist is still the widest point
and still wider than the shoulder, because that taper is what makes this silhouette an animal.

**And it grew a neck with them**, which is the interesting one, because a beaver has not got one.
`assets/refs/beaver/beaver-upright-winter-gnawing.jpg` shows the head running straight into the shoulder
mass with only a tonal break where the pale cheek fur meets the darker pelt — so "the animal is nearly
neckless, and that is correct for it" is a true statement about beavers and a **bad** reason to exempt this
artboard. The rule is an inclusion rule. **The guide is not an exception:** it carries the same `neck` part,
at the same pivot, with the same keyframes and the same 12–13 px of visible column as the player and the
officer (`art-bible.md` §7.3).

What is exempt is the SURFACE, and it is the exemption this sheet already holds for the skin ramp, extended
by one part. The shared `neck-{skin}` column IS drawn on this artboard and is then covered entirely by
`head-shell-beaver`, exactly as the shared head and the shared short crop already are — which is why no pelt
tone was added to the `skin` slot and why none was added now. The pelt column is `leather-shade` against a
`leather-base` body, so what reads at 390 px is the animal's heavy neck ruff rather than a person's column:
same geometry, animal surface. That is the whole difference, and it is the only one.

**And it turned with them.** Every character is drawn three-quarter facing its direction of travel now
(`art-bible.md` §7.1), and of the three this is the one the turn helped most: a beaver seen from the front is
a brown blob with teeth, and a beaver seen three-quarter has a **projecting muzzle** on the leading edge with
the incisors hanging under it in profile. The two load-bearing features in §3 both got stronger for free.

**This head then became the reference for the other two.** When the first pass shipped, the guide read as
travelling at 390 px and both humans read as standing still looking at the player — same render, same scale,
so the comparison cost nothing and settled the argument. What the beaver had and they did not was an
asymmetric OUTLINE: a muzzle projecting 25 px past the cranium, against a symmetric egg with a 6 px nose
drawn on it. The human heads were rebuilt the way this one already was. A design sheet is not usually the
place to record that another character copied you, but the mechanism is worth keeping: **the three figures
share a rig and a canvas, so any one of them that is right is a free control for the other two.**

Two things make it work without a proportion break:

- **`head-shell-beaver` is the same head MASS.** It is not the human cranium's outline: it is the shared
  head *and the shared short crop*, taken as one mass, with the pelt outline 3–4 px outside it — crown at
  y 17 against the crop's 20, left flank at x 71.3 against 75.5. It has to be, because the pelt is the only
  thing above `hair` in the z order, and a pelt drawn to the bare skull leaves the crop's crown showing as a
  **tan crescent across the top of the beaver's head**. That has now happened twice, both times when a part
  under the pelt moved and the pelt did not: `make verify-art` states the containment as a rule about part
  windows, and it is a rule about pixels. The mass is still a human head-and-hair mass in pelt — 3 px taller
  than one, which is the outline — so the 6-head canon is untouched: what makes this a beaver is the muzzle
  and the teeth, not a bigger skull. And **one ear only** — small, dark, set high and well BACK on the skull
  and mostly inside the head silhouette, which is
  where `beaver-head-and-forepaws.jpg` and `beaver-alberta-profile.jpg` put it. A second ear is the loudest
  front-view signal there is, and a turned head does not have one. Big ears standing clear of the skull read
  as a bear; that has now been drawn wrong twice — high and round the first time, large and paired the
  second — and corrected both times by looking at the render rather than at the markup. The pale cheek and
  throat that came in with the turn is doing part of that work too: a bear has no such patch.
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
the hip. It is *not* behind the figure: anything drawn behind a torso is not drawn at all. Since the guide
turned, the wearer's right is the **trailing** side, so the paddle now streams out behind a moving animal
instead of merely standing beside a stationary one — the same shape, doing more. Three cross bands carry the scale as a rhythm, never
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

**The three-quarter redraw ran that cliff backwards, and then gave half of it back.** Turning every
character to face its direction of travel (`art-bible.md` §7.1) changed no frame count — 60 before, 60
after. The body turn alone made every figure narrower and freed a whole column: **1410 × 2044 (10.99 MiB) →
1168 × 2044 (9.11 MiB)**, Halifax **77 % → 71 %**. Correcting the head then took some of it back, because
the head grew a 16 px nose and the hair grew a swept-back mass: source area **+3.2 %**, and the page landed
at **1271 × 2048 (9.93 MiB)**, Halifax **74 %**. Net against the commit before this work: **−1.06 MiB of
decoded texture at 2× on every level**, and a character that reads as travelling.

**The last few pixels of three frames were chosen against the packer, not by eye, and that should be said
rather than hidden.** In the neighbourhood this art lands in, a 2 px change in ONE frame moves the page by
several hundred pixels and 3–4 MiB, in both directions: shaving `torso-beaver` by 6 px made the page *worse*
by 5 MiB. Total area predicts almost nothing — occupancy swung between 52 % and 70 % across variants whose
areas differed by 2 %. So `hair-long` (95 × 138), `hair-bob` (96 wide) and `hair-coil` (93 wide) are at
dimensions found by packing candidates and measuring, and the numbers are recorded here because they look
arbitrary and are. **They are not load-bearing on the drawing** — each was already within a few pixels of
where the art wanted it — and anyone who needs one of them larger should take it and re-measure rather than
treat this paragraph as a constraint.

Whoever reads this next: **the fast way to do that search is not `make assets`.** The shared atlas is
exactly the 60 character frames, so a throwaway script that rasterises them at 2× and calls `packAsync` with
the options in `scripts/assets.mjs` reproduces the page size in seconds instead of a minute, and lets a
candidate be tested by cropping the PNGs before any SVG is edited.

## 6. References

`assets/refs/beaver/`, six files, all credited in `assets/credits.json`, all licence-checked against the
Wikimedia Commons API on 2026-09-08 **before** download: three public domain, one CC0, one CC BY 2.0 and one
CC BY 2.5. `beaver-upright-winter-gnawing.jpg` is the pose reference — a beaver sitting up on its hind legs
in snow with a stick in its forepaws, which is the stance this design is a cartoon of.
