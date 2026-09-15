# Title landscape — the country behind the title screen and the Study home

`assets/style/art-bible.md` is the house style. This sheet is the drawing's contract: what it shows, where each
thing in it comes from, and what it must never gain. Drawn 2026-09-14 for ADR-0041.

## 0. What it is, and what it is not

A **1080 × 900** landscape the title screen and the Study home draw as decoration
(`app/ui/screen-art.ts`, `LANDSCAPE_URL`). The title screen stands the player's character in front of it;
the Study home shows it alone. It is `aria-hidden` with an empty `alt` on both screens, and both screens read
identically without it.

- **No lettering.** No `<text>`, no `<title>`, no `<desc>` (`scripts/lib/screen-art.mjs` refuses all three).
- **No person.** The player is drawn on top of it by the level's own puppet, never into it.
- **No emblem.** No flag, no maple leaf, no crest or badge (`palette.json#restrictedMarks`).
- **No invented landmark.** Every landmark in it is a level's own drawing, lifted, not redrawn.
- **Flat fills, palette colours only.** Linted with the rest of `assets/src/svg`.

| file | what | size |
|---|---|---|
| `assets/src/svg/screens/title-landscape.svg` | the art | about 11 KB raw, 3 KB gzip |

## 1. What is in it, and where each thing comes from

| element | source | treatment |
|---|---|---|
| Peggy's Point Lighthouse | `assets/src/svg/peggys-cove/landmark-lighthouse@1x.svg` | every shape copied verbatim, `<title>` removed, scaled 0.34 onto the granite shore |
| CN Tower | `assets/src/svg/toronto/landmark-cn-tower@1x.svg` | the tower's shapes copied verbatim — legs, shaft, pods, mast; the stadium, glazed block, street tree and ground strip at its foot left out — scaled 0.42, on the far shore |
| Mountains, hills, spruce, lake, snow | drawn here | generic landforms, not a place: no range, lake or shore is identified |
| Canoe | drawn here | a generic open canoe, flag-red ramp; not a named craft, not a sacred or ceremonial object |

Both landmarks keep the proportions their level sheets measured (`peggys-cove-level.md`, `toronto-level.md`),
because nothing about them was redrawn. If either level's drawing is corrected, lift it again.

## 2. Composition

Sky `sky-base` under a `sky-shade` band; snowy peaks in `ice-base` with `ice-shade` faces and `snow-light` caps,
so the range stands out against the sky; `pine-base`/`pine-shade` hills; `water-base` lake; the lighthouse on a
`path` ramp granite shore at the left; the tower beyond the lake at the right; a `snow` foreground whose
middle is left clear, because the title screen stands the player there.

**Nothing small sits behind the middle.** The figure covers about x 356 to 725 of the drawing at every box the
title gives it, so a prop there shows only its ends. The canoe was drawn at x 544 to 692 and showed as a red
blade sticking out of the figure's hip (second live-site audit, `fr01-title`, `ax20-frca-title`). It floats at
x 754 to 902 now, on open water between the figure and the right-hand spruce, whole inside the narrowest crop
the title uses; the glint that was there moved under it.

The screens crop it with `object-fit: cover` anchored at 80 % down, so the foreground and the shore survive every
box a phone gives the picture, from 12rem tall at 200 % text to half the screen at 100 %.
