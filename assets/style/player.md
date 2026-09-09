# The player: winter kit

The design sheet for `costume: parka` — the artboard `player`. Read with `art-bible.md`, `rig-contract.md`
and `palette.json` open.

## 1. The two defects this redraw fixed

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

### 1.2 The shoulders

`art-bible.md` §7.2 has the measurement and the photograph. The short version: the canon said *shoulder
width 154 px* on a 420 px figure, which is 0.367 of height, and an adult in a winter parka photographed on
the Rideau Canal measures **0.238**. The coat now spans **108 px at its widest**, and the hood ruff — which
this sheet already recorded once as "reading as shoulder pads", and which had already been redrawn once for
it — has been pulled in to a collar that wraps the neck rather than a bar lying across the shoulder line.

The proportion rule is an inclusion rule, so **the officer and the guide moved with it**: 104 px and 112 px
at their widest, all three inside one declared 116 px cap, with identical crown, sole, eye line, pivots,
hand and foot frames and stroke weights. A garment may add bulk. A body may not.

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

Rendered walking, at the direction it walks, at 1×, 0.5×, 0.36× and 0.25×. At 0.25× the parka survives as:
blue mass, red mark at the neck, two red marks at hip height, white band at the hem, white band at each
ankle. The hood ruff is the first thing to go, which is expected — it is 10 px of white on a 108 px figure —
and it is why the other five marks are not allowed to be quiet. Every one of the 480 creator appearances
was rendered against every expression before this shipped; the toque clears the brows and every hair shape
reads under it and without it.
