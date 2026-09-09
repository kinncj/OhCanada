# The player: winter kit

The design sheet for `costume: parka` — the artboard `player`. Read with `art-bible.md`, `rig-contract.md`
and `palette.json` open.

## 1. The defects this redraw fixed

The player shipped **front-on and too wide**. Both were reported by the repository owner from the live site,
in one sentence: *"the main character looks extremely odd… it's looking at the user… shoulders are not
proportional."* Both were invisible in the markup and obvious in a render, which is the third time that has
happened on this character.

### 1.1 It faced the camera in a side-scroller

A figure drawn front-on cannot read as travelling, and this one traverses in every level the game has. It is
now **three-quarter, facing the way it walks**; `art-bible.md` §7.1 carries the decision and
`rig-contract.md` §1 and §4 carry what it changed in the rig — the z-order, the pivots and every keyframe.
The renderer already mirrored on direction (`setFacing`, and `sprite-character-renderer.ts` reflects the
whole composite about `centreX`), so the turn needed no engine change at all. A front-on figure could never
have used that mirror for anything.

**This took three passes, and each one was corrected by a picture of the game rather than by a render.** The first turned the body and left the
head at the torso's angle. Rendered at 390 px beside the beaver, the animal read as travelling and the
player read as standing still looking at the player — the original defect, surviving in the only part of the
figure anybody looks at. The head now turns to about 25° off strict profile against the torso's 40°, and the
turn is carried by an **asymmetric head outline** — cranium behind, brow, nose, lip and chin in front, the
nose projecting 16 px — rather than by cues drawn on a symmetric egg. Every cue in the first pass was
defensible in the markup and 2 px on a phone.

The third pass came from a photograph of the shipped game on a phone, and it found the same defect one level
down. The outline had been corrected and then **hidden behind its own hair**: measured row by row on the
shipped default, the fringe was the leading edge for 28 rows in a vertical wall and the nose exceeded it by
11 px. `art-bible.md` §7.4 has the rule that came out of it — *a cue is only a cue if it is the outermost
thing* — and the fringe now stops at a tip inside the forehead, so the leading edge from crown to nose is one
continuous forward sweep. It also gives the face back its size: the old fringe squeezed it into a small pale
oval in the middle of a dark mass, which is what made the head read as an ape.

### 1.2 The shoulders

`art-bible.md` §7.2 has the measurement and the photograph. The short version: the canon said *shoulder
width 154 px* on a 420 px figure, which is 0.367 of height, and an adult in a winter parka photographed on
the Rideau Canal measures **0.238**. The coat now spans **108 px at its widest**, and the hood ruff — which
this sheet already recorded once as "reading as shoulder pads", and which had already been redrawn once for
it — has been pulled in to a collar that wraps the neck rather than a bar lying across the shoulder line.

The proportion rule is an inclusion rule, so **the officer and the guide moved with it**: 104 px and 112 px
at their widest, all three inside one declared 116 px cap, with identical crown, sole, eye line, pivots,
hand and foot frames and stroke weights. A garment may add bulk. A body may not.

### 1.3 There was no neck

Reported the same way and from the same place: *"the head is on the torso."* It was. The head's ink bottom
and the ruff's ink top overlapped by about 6 px, and the only thing called a neck was a stub of skin-SHADE
inside `head-{skin}`, drawn on top of the collar, in a tone two steps from the outline — three dark pixels
between two dark pixels at 390 px. That is also part of why §1.2 did not finish the job: with no break in
the silhouette the shoulder line runs unbroken into the jaw, and the eye reads one mass however wide it is.

`neck` is now a **part** with its own pivot and z, between the torso and the head, so the collar closes over
its base and the jaw over its top. Its length is measured — `art-bible.md` §7.3, on
`assets/refs/officer/red-serge-full-figure.jpg`, 0.149 of a head height — and what it cost this costume is
two cuts and one move:

- **The fur ruff's top edge is a neck opening**, not an apex: it closes round the neck at y 137 (ink 134)
  and rises to the shoulder at both ends. This is what §1.2 already asked for in words — "a collar that
  wraps the neck rather than a bar lying across the shoulder line" — and it is now geometry rather than a
  description. It is a RING at the throat, not a bar across the shoulders, and the outline shows it curving
  up round the column, which is what keeps it out of shoulder-pad territory.
- **The coat's own opening is cut lower than the ruff's**, so a band of white fur shows between the two
  edges. Draw them at the same height and the ruff disappears under the coat and the parka loses its fur.
- **The scarf loop moved down 8 px**, to the base of the throat where the ruff ends. It sat on the collar
  edge and hid the fur; it now reads as a scarf knotted under the collar with the tail hanging down the
  leading edge, and it still never crosses shoulder to hip.

### 1.4 The player ships in a toque, and the band is measured

`headCovering`'s fallback is now `toque`, not `none`. A slot fallback is not only save recovery: it is what
every figure the game spawns wears until the character creator is wired, so `none` was putting a bare head
into a January level. The creator is unchanged — it randomises, `none` is still an option, and the officer
and the guide pin `headCovering: none` in their artboard `skins` so nobody else grew a hat.

**The band that covered the brows was still covering them.** The part's own title claimed it stopped above
them; it was cutting the eyes in half in every render, on every skin ramp, in all four expressions. It is
measured now and the numbers are in `head-covering-toque.svg`: highest brow ink **y 53.2**, band's lowest
ink over the face **y 47**. The band could only be raised that far by running it **steeply downhill to the
back** — level at y 18–34 over the face and dropping to y 48–68 behind it — which is the three-quarter cue
`art-bible.md` §7.1 already asked of it, so the fix and the turn are the same move. Every hair shape and
every skin ramp was re-rendered under it; `crop` and `coil` are almost entirely covered, which is what a
short cut under a hat looks like, and `bob` and `long` show at the sides and back.

### 1.5 The peg leg is not in this art

Reported from a photograph of the live game: a grey cylinder hanging below the boot, boot-width, with a hard
edge. It is **not** a misplaced `foot-*`, a `leg-lower` drawn past the foot, a bad pivot or a part window
overrunning its art — all four were checked, at every keyframe and at 41 interpolated phases of every state,
and `leg-lower-parka`'s ink ends at y 459 inside a boot whose ink ends at 463. It reproduces only at
`devicePixelRatio >= 2`, where the game loads the `@2x` atlas: the parts are then drawn at the texture's size
and positioned in character space, so they scale apart. `art-bible.md` §7.1 has the measurement. Nothing in
this sheet fixes it; it is `app/adapters/phaser/sprite-character-renderer.ts`.

## 2. What keeps the coat from being a rectangle

The player before both of those was a **rectangle**: a flat slab torso the same width at the shoulder and
the hem, two capsule sleeves bolted to its sides, and no feature anywhere that said which country the game
is about. The moves that fixed that survived the turn and are listed here so the next person does not undo
them by accident.

1. **A waist.** Shoulder 102, waist 82, hem 104 including the outline, with a drawcord and two toggles
   across the narrow point. The taper is the whole silhouette; a coat that is one width from shoulder to hem
   is a box whatever is drawn on it.
2. **A scarf.** Red, wrapped at the neck and hanging down the front — which in this view is the leading
   edge, so it also marks which way the character is going. It is narrower than it was: at the old width it
   read as a red bib over the whole chest.
3. **Mitts, not hands.** Red knitted mitts with a white cuff, one mass and a thumb. They read as two red
   marks at hip height from across the room.
4. **A hem band.** Snow-white, following the hem curve, with a shade line under it. It stops the coat and
   the trousers being one column.
5. **Open sleeve outlines.** The upper and lower sleeves are stroked everywhere except a gap across the top
   centre, which always sits inside the torso silhouette. A closed capsule outline over a coat reads as a
   part bolted on; an open one reads as a sleeve.
6. **A hood ruff that is a collar.** Lobed snow-white fur wrapping the neck, higher at the back than at the
   front. Drawn as a straight bar across the shoulder line it reads as shoulder pads; that is what it did,
   twice.
7. **Boots with a shaft.** Not decoration: the shin ends 6 px below the ankle pivot and 24 px inside a
   42 px collar, because a shin drawn to the sole line hung below the boot as a bare cylinder in 11 of 23
   animation frames and was photographed on a phone as a peg leg. `art-bible.md` §7.5 has the rule.

## 3. Palette

| area | ramp | why |
|---|---|---|
| parka shell | `cobalt` | Saturated, dark on snow, and **not** a red. The officer is scarlet and identified at 0.92 in a blind run; a red-coated player standing next to a red-coated constable converges at 25 % scale and puts that identification at risk. Blue is the cheapest possible way to keep them apart. |
| scarf, mitts, toque crown | `flag-red` | The Canadian read, kept in small high-contrast marks at the neck, the hands and the head rather than in one large field. `flag-red` and `serge` are deliberately different reds (`palette.json`) and are not interchangeable. |
| hood ruff, hem band, cuffs, toque fold, toque pom, boot cuff | `snow` / `white` | Fur and knit trim. |
| snow trousers | `slate` | A neutral cool grey-blue: separates from the cobalt shell above and the leather below, and is not the officer's `navy`. |
| boots | `leather` | Upper, with a rounded `leather-light` toe cap and a `leather-shade` heel. |
| boot soles | `hide` | Moulded rubber. Same ramp as the guide's tail and hind feet — see §4 of `guide.md` for its derivation. |

Ink is `ink-warm` for every part, rig-wide (`art-bible.md` §3).

## 4. Limb shading, and the one compromise in it

Five limb frames are mirrored rather than drawn twice (`rig-contract.md` §4), so **one frame's shading
cannot be correct on both sides.** The key light is warm sun, upper left. The art is authored at the FAR
position — the wearer's left, screen right — with the light band on the frame's low-x edge and the shade on
the high-x edge. Reflected onto the near limb, the one drawn last and the one the eye lands on, that band
lands on its outer edge, where it reads as a rim light rather than as an error.

Which side of the pair gets the "correct" key flipped when the figure turned, because the near side is now
the wearer's right. Recorded because it looks like a mistake either way and it is a choice.

## 5. What is deliberately absent

- **No flag, no maple leaf, no lettering** anywhere on the costume. `art-bible.md` §9 forbids lettering
  outright, and a flag on a coat is a decoration a player did not choose. The Canadian read comes from the
  kit itself: a parka with a fur-trimmed hood, a toque with a pom, mitts, a scarf and snow boots.
- **No diagonal band across the chest, ever.** A shoulder-to-hip diagonal is the Sam Browne, and the Sam
  Browne is half of the officer's identity. The scarf hangs vertically for that reason. An earlier version
  of this costume had the scarf flying across the chest and it read as a sash at small size; it was redrawn.
- **No hood up.** The head covering is a player-selectable slot and a raised hood would fight every option
  in it. The hood lies around the neck behind the head, which is where the lobed white trim comes from.

## 6. The two-size test, and what it is for

**Render the DEFAULT appearance, mid-walk, at the camera's own scale, over a real level**, and ask whether a
stranger would say the figure is walking or standing. `art-bible.md` §7.6 has the four clauses and what
leaving each one out has already cost. The short version for this character: the shipped default is long
dark hair and a bare head, which is the worst case for its head silhouette; the peg leg is invisible at rest;
and the camera draws 1.553 device px per design px, so the figure is 1.43× larger than a render that assumes
the design fills the viewport.

Rendered walking, at the direction it walks, at 1×, 0.5×, 0.36× and 0.25×. At 0.25× the parka survives as:
blue mass, red mark at the neck, two red marks at hip height, white band at the hem, white band at each
ankle. The hood ruff is the first thing to go, which is expected — it is 10 px of white on a 108 px figure —
and it is why the other five marks are not allowed to be quiet. Every one of the 480 creator appearances
was rendered against every expression before this shipped; the toque clears the brows and every hair shape
reads under it and without it.
