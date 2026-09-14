# ADR-0033: An atlas page is packed for its area, and ringed by its own pixels

- Status: Accepted (2026-09-14)

## Context

ADR-0013 makes decoded texture memory the binding budget, and ADR-0020 has the manifest price every file a
level loads. The shared character atlas is one texture, and every level pays for it. Two defects in how
`make assets` built that texture were found on 2026-09-14. Neither was in the art.

### 1. Faint rectangles round every character part

An art agent saw thin rectangle edges round the cut-out parts in phone-size screenshots of the built game,
both before and after the character redraw. The cause was in the atlas file on disk. It was not in the
renderer's filtering.

`free-tex-packer-core` 0.3.9 has an `extrude` option. For each frame it shrinks a copy of the **whole**
source image to 1×1, which gives roughly the image's average colour. It then blits the source's column 0 or
row 0 over that pixel and stretches the result round the frame. On a trimmed sprite, column 0 and row 0 are
transparent, which is why they were trimmed. Its blit skips transparent source pixels, so the average colour
stays. This was measured on the shipped `shared@2x` page:

| | before | after |
|---|---|---|
| frames with a non-transparent 1 px ring | 80 of 80 | 80 of 80, all repeating their own edge |
| ring pixels non-transparent | 49 312 of 49 312 | 9 130 of 49 312 |
| ring pixels that differ from the edge pixel beside them | **48 905** | **0** |
| strongest ring pixel | alpha 255, e.g. `rgba(76,63,62,81)` round the skateboard deck | the art's own edge |

Linear filtering samples half a texel past a quad's edge, so every part drew that ring faintly. A rotated
limb drew all four sides of its rectangle. Phaser's texture path was checked and is correct.
`WebGLTextureWrapper` uploads with `premultiplyAlpha: true` by default, and `render.mipmapFilter` defaults
to `''`, so no mipmaps are generated. Nothing in `app/` had to change.

### 2. A page whose size was chaotic (`OQ-RIG-1`, art-bible §7)

That packer places frames greedily inside a fixed 2048×2048 bin and crops the page to whatever it touched.
Nothing in it tries to keep the page small. Art recorded the same 80 frames repacking anywhere from 1312 to
2048 px tall under a 3 % size change. Halifax and Toronto reached 98 % of their texture budgets on one pass.
Art had to search over trims under random drift to find a page that would ship.

This was reproduced exactly. A predictor that drives the library's own `MaxRectsBin` gives 2045×1316 for the
shipped frames, which is the page the build wrote. It then ran 40 trials in which every frame drifted by up to
±2 px:

| | min | median | max | spread |
|---|---|---|---|---|
| old page, MiB | 10.03 | 12.51 | 16.00 | **5.97** |
| new page, MiB | 8.73 | 8.81 | 8.87 | **0.13** |

## Decision

### 1. The packer lives in this repository

`scripts/lib/atlas-pack.mjs` replaces `free-tex-packer-core`, which is removed from `package.json`. It takes
pixels and returns pixels, with no Phaser, no sharp and no file system, so the unit tests drive it with
buffers they write.

### 2. The page is chosen for its area

The planner tries every combination of:

- three insertion orders: height, area and long side;
- two MaxRects placement rules: best short side fit and bottom-left;
- a fixed ladder of page widths: the widest frame, every multiple of 16 px, and the cap.

The smallest page area wins. Any one greedy layout is still chaotic, but the minimum over a few hundred of
them is not. Area is the only quantity the budget reads, because decoded bytes are width × height × 4.

- **Deterministic.** Every order ends on the key, compared by code unit rather than `localeCompare`. Every tie
  in placement goes to the top-left-most position. The same frames give the same page byte for byte on any
  machine, and the existing "rebuilds byte-for-byte" case covers it.
- **No rotation.** The character renderer rotates parts about authored pivots. A frame that is secretly
  rotated would be a second coordinate system to get wrong for a few percent of area.
- **Spilling.** When a set cannot fit one 2048 px page, one page is filled and then shrunk to its own
  smallest area, and the rest go to the next page. No owner spills today.

### 3. A frame's ring is its own edge

A page is laid out like this:

`| pad | ext | frame | ext | pad | ext | frame | ext | pad |`

The layout constants stay at `padding: 2` and `extrude: 1`:

- `extrude` pixels of the frame's own edge row or column are repeated outward, corners included.
- `padding` transparent pixels sit at every page edge and between two extruded frames.

The old packer padded twice between two frames, so the gap between two frames' art is now 4 px rather than
6 px. The JSON `frame` rectangle is the art only.

### 4. The build proves it on the file it ships

After encoding, `scripts/assets.mjs` decodes each lossless WebP page again and runs `checkPage` on the
decoded pixels. It does not trust the buffer the packer meant to write. The build fails if either of these
holds:

- a ring pixel is not the edge pixel beside it;
- any non-transparent pixel lies outside every frame's ring.

Two alpha-0 pixels count as equal whatever their colour channels say. Lossless WebP may rewrite those
channels, and a premultiplied upload zeroes them anyway.

### Unchanged

The following stay as they were:

- the 2048 px page cap;
- one atlas per owner per scale;
- the `<owner>@<scale>x[-<n>]` page names;
- Phaser's multi-texture JSON shape, apart from `meta.app` naming the new packer;
- lossless WebP;
- the variant groups;
- both budget gates.

## Consequences

Measured by `make assets` on this branch, against the same sources on `origin/main`:

| page | before | after |
|---|---|---|
| `shared@2x` | 2045×1316, 10.27 MiB | **1278×1805, 8.80 MiB** |
| `shared@1x` | 857×1612, 5.27 MiB | **466×1299, 2.31 MiB** |
| `ottawa@2x` / `quebec-city@2x` | 230×738 / 206×694 | 230×734 / 206×690 |

Every level is **1.47 MiB lighter on a 2× device** and **2.96 MiB lighter on a 1× device**. The two levels that
were tightest:

- Halifax went from 27.82 to 26.36 MiB of 34, which is 81.8 % → 77.5 %.
- Toronto went from 27.74 to 26.27 MiB of 34, which is 81.6 % → 77.3 %.

**The download grew.** `shared@2x` is 374 610 B where it was 290 064 B, and `shared@1x` is 188 202 B where it
was 147 288 B. The largest level payload is now 0.646 MiB of 8 MiB. This was measured rather than assumed.
Clearing the extrusion ring saves only 4 304 B, and libwebp's `exact` flag and zeroing alpha-0 colour
change nothing. The rest comes from density: the page is 93.4 % full rather than 81.9 %, so more of the
encoder's prediction blocks straddle two frames. 84 kB on a budget of 8 MiB is the price of 1.47 MiB of VRAM
on a budget of 34, and that trade is the one ADR-0013 says to make.

**The page's shape is not stable, and nothing reads it.** Across a 0–3 % scale sweep the page was 1278×1805,
then 1535×1503, then 1917×1225, while its area tracked the art's area. Only width × height is priced.

**Packing costs about 80 ms** for the shared set, against about 3 ms before, which is small next to rasterising
166 SVG sources.

**A spilled owner would not load today.** `atlasKeyOf` in `app/adapters/phaser/level-assets.ts` gives every
page of an owner the same texture key, and the selector loads one of them. No owner spills. A 2048 px cap on a
page that uses 1278×1805 of it leaves the shared set a long way from spilling. The day one does, that loader
has to learn about pages before the art lands. This decision does not change it.

**`OQ-RIG-1` is half closed.** Its packing half is closed. Its loading half stays open: every level still pays
for the whole option library, and per-option images loaded on demand remain the lever.

## Alternatives considered

- **Keep `free-tex-packer-core` with `extrude: 0` and pad by hand.** This fixes the ring and leaves the chaos,
  because the page size is the library's greedy pass.
- **Fixed 2048×2048 pages.** These are stable and cost 16 MiB each, more than half a 34 MiB level for one page.
- **Power-of-two pages.** No device this project targets needs them, and the next power of two above 1805 is
  2048. That is the fixed-page cost again.
- **A binary search on height for each width.** Its cost scales with the number of search steps, and the
  width ladder already fills 93.4 % of the page. It was not needed.
