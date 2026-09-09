# The player: winter kit

The design sheet for `costume: parka` — the artboard `player`. Read with `art-bible.md`, `rig-contract.md`
and `palette.json` open.

## 1. The defect this redraw fixed

The player shipped as a **rectangle**: a flat slab torso the same width at the shoulder and the hem, two
capsule sleeves bolted to its sides, and no feature anywhere that said which country the game is about.
It was the most visible defect in the product. It is not a rectangle any more, and the specific moves that
did it are listed here so the next person does not undo them by accident.

Five changes, in the order they mattered:

1. **A waist.** Shoulder 148, waist 112, hem 152, and a drawcord with two toggles across the narrow point.
   The taper is the whole silhouette; a coat that is one width from shoulder to hem is a box whatever is
   drawn on it.
2. **A scarf.** Red, wrapped at the neck and hanging down the front. It is the strongest single element at
   phone size and it breaks the coat's flat blue field vertically.
3. **Mitts, not hands.** Red knitted mitts with a white cuff, one mass and a thumb. They read as two red
   marks at hip height from across the room.
4. **A hem band.** Snow-white, following the hem curve, with a shade line under it. It stops the coat and
   the trousers being one column.
5. **Open sleeve outlines.** The upper and lower sleeves are stroked everywhere except a gap across the top
   centre, which always sits inside the torso silhouette. A closed capsule outline over a coat reads as a
   part bolted on; an open one reads as a sleeve.

## 2. Palette

| area | ramp | why |
|---|---|---|
| parka shell | `cobalt` | Saturated, dark on snow, and **not** a red. The officer is scarlet and identified at 0.92 in a blind run; a red-coated player standing next to a red-coated constable converges at 25 % scale and puts that identification at risk. Blue is the cheapest possible way to keep them apart. |
| scarf, mitts, toque crown | `flag-red` | The Canadian read, kept in small high-contrast marks at the neck, the hands and the head rather than in one large field. `flag-red` and `serge` are deliberately different reds (`palette.json`) and are not interchangeable. |
| hood ruff, hem band, cuffs, toque fold, toque pom, boot cuff | `snow` / `white` | Fur and knit trim. |
| snow trousers | `slate` | A neutral cool grey-blue: separates from the cobalt shell above and the leather below, and is not the officer's `navy`. |
| boots | `leather` | Upper, with a rounded `leather-light` toe cap and a `leather-shade` heel. |
| boot soles | `hide` | Moulded rubber. Same ramp as the guide's tail and hind feet — see §4 of `guide.md` for its derivation. |

Ink is `ink-warm` for every part, rig-wide (`art-bible.md` §3).

## 3. Limb shading, and the one compromise in it

Five limb frames are mirrored rather than drawn twice (`rig-contract.md` §4), so **one frame's shading
cannot be correct on both sides.** The key light is warm sun, upper left. The near limbs — the wearer's
left, drawn last, screen right in the canonical facing — get the correct key: light band on the frame's
low-x edge, shade on the high-x edge. Mirrored onto the far side that band lands on the outer edge, where
it reads as a rim light rather than as an error.

This was the other way round before, and it was worse: the near limb, the one the eye actually lands on,
was lit from the wrong side. Recorded because it looks like a mistake either way and it is a choice.

## 4. What is deliberately absent

- **No flag, no maple leaf, no lettering** anywhere on the costume. `art-bible.md` §9 forbids lettering
  outright, and a flag on a coat is a decoration a player did not choose. The Canadian read comes from the
  kit itself: a parka with a fur-trimmed hood, a toque with a pom, mitts, a scarf and snow boots.
- **No diagonal band across the chest, ever.** A shoulder-to-hip diagonal is the Sam Browne, and the Sam
  Browne is half of the officer's identity. The scarf hangs vertically for that reason. An earlier version
  of this costume had the scarf flying across the chest and it read as a sash at small size; it was redrawn.
- **No hood up.** The head covering is a player-selectable slot and a raised hood would fight every option
  in it. The hood lies across the shoulders behind the head, which is where the lobed white trim comes from.
