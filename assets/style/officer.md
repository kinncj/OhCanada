# The officer — slice-1 NPC character sheet

The NPC a player meets on Parliament Hill and the Rideau Canal Skateway in Level 4.

**What is depicted:** a fictional Canadian police constable in ceremonial scarlet review order — the
red-serge silhouette a newcomer studying for the citizenship test will recognise instantly. That recognition
is the point of the character.

**What is not depicted:** any real, identifiable person, any insignia, and any named force. See
§4 — those omissions are a legal constraint with a reason, not a style choice.

Decided by the repository owner on 2026-09-08 after the licensing risk was raised. `docs/plan/slice-1.md`
carries the same decision.

References: `assets/refs/officer/`. Required-features list: `assets/refs/references.json`, subject `officer`.

---

## 1. Proportions — identical to every other character

Nothing on this page changes the canon in `art-bible.md` §7. **6 heads tall, 420 px at design resolution,
head 70 px.** The same shoulder width, hand size, foot length, eye line and face vocabulary as the player and
as every future NPC.

**Amended when the player was redrawn.** The player's shoulders were reported as out of proportion from the
live site and they were: the canon's own shoulder row was 54 % over a measured photograph
(`art-bible.md` §7.2). Identical proportions is an inclusion rule, not a style note, so **the officer moved
with the player** rather than staying where it was and letting the two diverge. The tunic is now **104 px at
its widest** against the parka's 108 and the guide's 112, all inside one declared 116 px cap. Every
identifying feature in §2 is untouched, and the officer was re-rendered walking, at four sizes down to 0.25×,
before this was written: red mass, dark hat brim, dark legs, yellow stripe, all still there.

**And it turned.** Every character is now drawn three-quarter, facing its direction of travel, with the
**head turned further than the body** — about 25° off strict profile against the torso's 40°, which is what
a walking head does (`art-bible.md` §7.1). Splitting the two angles is what lets this character have both: a
head that plainly reads as travelling at phone size, and a chest plane wide enough to carry the diagonal.
It is worth saying why the alternative was refused: **a strict profile would have destroyed the Sam Browne.** Its shoulder-to-hip
diagonal is half of this character's identity and needs a chest to run across. Three-quarter keeps the whole
chest plane — the button row, both pocket flaps, the lanyard and the diagonal — on the leading edge, and the
diagonal still runs upper-left to lower-right exactly as it does in
`assets/refs/officer/red-serge-full-figure.jpg`, because the wearer's right shoulder is the near one.

The officer is **not** drawn larger, not drawn with more detail, not given a more heroic stance and not given
a rendering pass nobody else gets. `CLAUDE.md` requires identical cartoon proportions for all characters, and
this is the character most likely to tempt an artist into breaking that. Costume distinguishes them. Stature
never does.

Detail budget: the same as any other character. If the officer ends up with more shapes than the player, cut
until they match.

---

## 2. What must be right

These are the features the blind identification in `make verify-art` will hang on. An agent shown this
render with no label must say *Mountie* or *Canadian police officer*.

| # | Feature | Detail | Palette |
|---|---|---|---|
| 1 | **Scarlet tunic** | Single-breasted, high standing collar, fitted to the waist then flaring into a short skirt below the belt. Two breast pockets with **pointed (scalloped) flaps**. Two lower pockets, mostly hidden by the belt. | `serge` |
| 2 | **Dark collar and shoulder straps** | Midnight blue, distinctly darker than the tunic. The colour break at the collar and at the shoulders is what stops the tunic reading as a plain red coat. | `navy` |
| 3 | **Brass buttons** | A single row down the centre front, plus one on each pocket flap. Read them as a rhythm of round brass dots, not as modelled buttons. | `brass` |
| 4 | **Wide-brimmed hat** | Tan felt. Flat, wide, level brim, seen obliquely so it carries **more brim in front of the face than behind** and the crown sits back over the occiput — the asymmetry is doing turn work as well as hat work. Crown pinched to a point, with a fore-and-aft crease. Brown leather band with a small buckle. The brim silhouette is the single strongest read at small size — draw it **wider than feels right**, about 1.4 head-widths. It must clear the brows: the brim was drawn once at a height that cut the eyes, which is the same defect as the player's toque covering the brows. | `felt`, `leather` |
| 5 | **Brown leather belt with a cross-strap** | Wide waist belt, brass buckle. One diagonal strap from the **wearer's right shoulder** down to the left hip. This is a Sam Browne and the diagonal is half its identity — a plain waist belt loses it. | `leather`, `brass` |
| 6 | **Dark breeches with a yellow-gold leg stripe** | Midnight blue, cut full at the thigh and close below the knee. One broad stripe down the outer seam, running the full leg. | `navy`, `brass` |
| 7 | **Brown riding boots** | High, to just below the knee, brown leather, with a strap and buckle at the ankle. Breeches tuck into the boots. | `leather` |
| 8 | **Brown gloves** | Plain leather gauntlets. | `leather` |
| 9 | **White lanyard** | A thin white cord from the left shoulder to the left breast pocket. Small, but it is the one bright accent on a red field and it reads. | `white` |

**Colour separation check.** Scarlet tunic against pale ice and snow is a strong read. Against the warm
sandstone of Parliament Hill it is weaker — put the officer in front of a `stone-shade` or `navy` value, or
against sky, never against `stone-light`.

**Small-size read.** At 120 px tall the officer must still be: red mass, dark hat brim, dark legs, yellow
stripe. If the yellow stripe disappears first, thicken it — it is doing more identification work than its
area suggests.

---

## 3. Simplify away

Present in the references, deliberately dropped:

- twist and drape in the wool; the tunic is three flat tones
- the holster and its contents (see §5)
- pocket stitching, seam lines, buttonhole detail
- the belt's tooled decoration and its D-rings
- boot lacing above the ankle strap
- hat-band tooling
- any hair detail beyond the silhouette under the hat brim

---

## 4. Never draw — a constraint, with its reason

The red-serge silhouette is not a protected mark and is what makes the character recognisable. The
**insignia are protected**, and the repository is public under open licences. These omissions are legal, not
aesthetic. **If you are reading this because the officer looks under-decorated: that is deliberate. Do not
helpfully add a badge.**

- **No crest or badge of any kind**, including the bison-head device.
- **No wordmark or lettering anywhere** — not "RCMP", "GRC", "Royal Canadian Mounted Police" or
  "Gendarmerie royale du Canada" — on the hat band, the collar, the shoulder, a shoulder flash, a vehicle, a
  sign, a poster, a flag or a banner anywhere in the level.
- **No collar dogs, shoulder flashes, rank chevrons or service numbers.** Simplify these away rather than
  approximating them: an approximated insignia is worse than none, because it reads as an attempt at the
  real thing. The collar and shoulder straps stay plain `navy`.
- **No real, identifiable person.** `assets/refs/officer/red-serge-full-figure.jpg` shows a serving member.
  It is a reference for the uniform, the posture and the proportions. It is not a portrait to reproduce, and
  the character's face must not resemble hers.

**Naming.** Never "RCMP Officer" and never a member of a named force. Generic — "Constable", or a personal
name. The copy is the PO's; this is the constraint the copy has to satisfy.

---

## 5. Open questions — not settled here

| id | question | owner |
|---|---|---|
| **OQ-ART-08** | Is the officer's gender presentation fixed, or a player choice? The art is built so either answer is a data change: gender presentation is a **skin slot** on one artboard with one proportion canon, never a second artboard. (PO's `OQ-LEVEL-3`.) | PO |
| **OQ-ART-09** | Is scarlet review order plausible outdoors on canal ice in an Ottawa winter? It is a ceremonial uniform; the working winter answer is a parka. The level may be summer on the Hill and winter on the canal, or the officer may simply be posted ceremonially. This is a story and setting call. | PO |
| **OQ-ART-10** | Does the officer carry a visible sidearm? The reference shows a holstered one. A teaching game for newcomers may prefer to omit it; the current sheet omits it under "simplify away", which is an art convenience and not a decision. | PO |
| ~~**OQ-ART-07**~~ | ~~`docs/content-review.md` does not exist.~~ **CLOSED 2026-09-08: it exists.** It governs the character creator's skin-tone set and any depiction of Indigenous people, and the officer's skin tone comes from that set, so it binds this character. Two consequences here: the officer's tone is a **slot option like any other** with no pre-selected value (§8.2 slot independence, and `fallback` in `character.schema.json` is save recovery, not a pre-selection), and the ramps stay **unnamed** until `OQ-REVIEW-6` settles naming. | routed by the coordinator |

---

## 6. Rig notes for task 1.11 — SUPERSEDED by `assets/style/rig-contract.md`

**Task 1.11 has landed and the contract is `assets/style/rig-contract.md` plus `rig-contract.json`.** The
part list below was this sheet's guess and the shipped rig differs from it in three ways worth knowing:

- **Twenty parts, not twenty-one.** There is no separate `hat-band`, `pouch`, `collar`, `cross-strap` or
  `lanyard` part: the standing collar, the shoulder straps, the Sam Browne and its diagonal, the buttons,
  the pocket flaps and the lanyard are all drawn **into `torso-serge`**, because none of them articulates
  independently of the tunic and each one as its own atlas frame would be decoded texture spent on nothing.
- **Left and right arms and legs are one frame, mirrored.** Only the feet are sided, and since the figure
  turned that is the pair that *buys* the turn: both boots point the way the officer walks. The far-side
  limb art drawn a ramp step darker cost ≈ 1.5 MiB of decoded texture per level and Ottawa could not carry
  it; depth reads through overlap and the 6 px outline instead.
- **The costume is a slot, not a character.** `costume: serge` is what makes this character the officer;
  everything else — skin, hair shape, hair colour, expression, head covering, feature — is the same rig the
  player uses, with the same proportions, which is exactly what §1 of this sheet asks for.

The original note is kept below because its **skin-slot instinct was right** and it is why the art was
authored separable from the start.



Not the rig contract — that was expected to be `content/characters/rig.json`, which **still does not exist**; see the block above for where the contract actually landed — but the parts this design implies, so the SVG
is authored separable from the start:

`hat`, `hat-band`, `head`, `hair`, `face`, `collar`, `torso`, `arm-upper-l/r`, `arm-lower-l/r`, `glove-l/r`,
`belt`, `cross-strap`, `pouch`, `tunic-skirt`, `leg-upper-l/r`, `leg-lower-l/r`, `boot-l/r`, `lanyard`.

Skin slots: `skin` (six ramps), `hair` (five ramps), `presentation` (see OQ-ART-08). The sprite-sheet
fallback uses the identical slot names so content JSON never changes.

`content/schemas/character.schema.json` landed while this sheet was being written and uses the same
vocabulary — `slots`, options, `playerSelectable`. The officer's costume slots are **not** player-selectable;
only `skin`, `hair` and whatever OQ-ART-08 settles are. The schema also requires every option to carry a
text name, because colour is never the only signal — so the six skin ramps and five hair ramps each need a
localiser key. Those strings are the PO's and ui-a11y's, not the art's.
