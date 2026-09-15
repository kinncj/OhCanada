# ADR-0044: The band above the canvas is the canvas's first row, and it dims with the level

- Status: Accepted (2026-09-15)
- Slice: A6 (sky letterbox, second live-site audit).
- Builds on: ADR-0002 (portrait, `Scale.FIT`, side panels), ADR-0041 (a card dims the level with a filter on
  `#game`). Leaves ADR-0042 unchanged.

## Context

The second live-site audit found the same defect on every level. At 390 × 844, the top 75 CSS px of the screen
was a flat band in a different colour from the sky under it, with a hard edge. When a dialogue or a landmark card
opened, the level dimmed and the band did not.

The band is not canvas. `Scale.FIT` makes the 1080 × 1920 canvas as wide as a phone taller than 9:16 and centres
it, so the page shows above and below it: 75 CSS px each at 390 × 844, 80 at 360 × 800, and 84 at 430 × 932. Slice
A1 already made the band flat. It found a remaining 5–7 per-channel step, and it named the cause without fixing
it. The page painted the band with `--tn-sky`. That is the level's theme sky after `time-of-day.ts`, while the
canvas's first row is never tinted.

Three causes, each measured:

1. **The band was the wrong colour.** Every level's backmost layer is an opaque sky image that starts at world
   row 0. Its first row is a single colour on all ten levels (spread 0 across 1080 columns, read back from the
   WebP), and that colour is the level's untinted `theme.sky`. `GameRenderer.cssVariables()` handed the page the
   *tinted* sky, which is pulled toward `#101a33` at night and toward `#ffb066` near sunrise and sunset. The step
   is 0 only at local noon, which is when A1 measured.
2. **The band was outside what dims.** ADR-0041 dims the level with `filter: brightness(0.55)` on `#game`. The
   band was the `body` background, and a filter on `#game` cannot reach it.
3. **Nothing told the page when the colour moved.** The page variables were applied at boot and when a level
   became playable. They were not applied again when the tier switched a layer off or the tint repainted.

Measured in headless Chromium at device scale 3, with the clock pinned to 19:00 local, on all 10 levels at
360 × 800, 390 × 844 and 430 × 932, at the spawn and with the first dialogue or landmark card open. The step is
the largest per-channel difference between the per-channel medians of three rows 3–12 device px above the canvas
edge and three rows 3–12 px below it. Medians, not means, because snow crosses those rows on Ottawa and Québec
City. The rows touching the edge give the same numbers.

| | step at spawn | step with a sheet open |
|---|---|---|
| before (`origin/main`), 30 runs | 36–59 | 40–48 |
| after, 30 runs | 0 | 0 |

## Decision

### 1. The page is told the colour of the canvas's first row, and paints the band with it

`app/adapters/phaser/sky-top.ts` is a pure function of what the scene draws. The backdrop is the sky gradient's
first band, the tinted `palette.sky`. Every visible layer covering screen row 0 is laid over it in depth order,
with its own alpha. The layer row on screen row 0 follows the layer's vertical parallax,
`cameraY × scrollFactor.y − offset.y`, exactly as Phaser places it. A textured layer's row is read once from
the loaded image through a one-row 2D canvas and reduced to one colour, weighted by alpha. A placeholder band
is its own flat colour.

`LevelScene` reports the answer through `onSkyTop` at `create`. It reports again only when the answer changes:
from `applyProfile` (the tier), from the sky clock's repaint (the tint), and on a frame where the camera's
vertical scroll moved. That last case never happens on a shipped level, because the world is one viewport tall.
`GameRenderer` keeps the last answer, publishes it as `--tn-sky-top`, and calls `onPageThemeChange`. The
composition root re-applies the variables, so the adapter still never styles the page.

`--tn-sky` keeps its meaning: the tinted theme sky. It is still what the ramp ends on, the browser chrome's
colour, and what `level-player-and-affordance.spec.ts` and `level-ottawa.spec.ts` read. The ramp *starts* on
`--tn-sky-top`, so on a wide window the side panels also start on the canvas's own first row.

**Why this is exact at every tier.** The render tier, the render scale and reduced motion change how the first
row is drawn, never what colour it is. A tier either keeps the sky layer or switches it off, and the function is
told which. A uniform row is the same colour at any scale and at any parallax offset, so render scale and a still
parallax do not change it. High contrast restyles the DOM and not the canvas, so the canvas's first row, and
therefore the band, is unchanged in that mode.

### 2. The letterbox is painted inside `#game`

The two gradients move from `body` to `#game::before`. The pseudo-element is `#game` pushed out by the four
safe-area insets, which is the whole viewport, so every stop lands where it did on `body`. It reaches under a notch
and a home indicator. It sits at `z-index: -1` inside `#game`'s stacking context, under the canvas, and takes no
pointer events. ADR-0041's filter on `#game` now dims the band, the band below the canvas and the desktop side
panels together with the level, and `app/ui` did not change. `body` keeps a flat `--tn-page` colour only.

## Alternatives considered

- **Grow the canvas to the viewport's height, so the camera sees more sky.** Rejected. It needs `Scale.EXPAND` or
  a variable design height, and ADR-0002 fixes `Scale.FIT` at 1080 × 1920. Every screen-locked draw in the scene
  is a 1080 × 1920 rectangle from (0, 0): the sky, the bands, the haze and the snow. The vertical scroll clamps to
  0 because every level is one viewport tall. And ADR-0042 records that moving the framing vertically crops
  landmark heroes or breaks the two-thirds rule. It would also add a strip of fill to every frame on the overdraw
  lane, to show one flat colour that CSS already paints for nothing.
- **Read the rendered canvas's first row back from the GPU.** Rejected. `readPixels` stalls the pipeline for a
  frame, snow crossing the top row would pollute the answer, and it would have to be repeated to follow parallax.
  Reading the texture once covers every scroll offset in a single read, costs no GPU time, and is unit-testable.
- **Tint the band as well, or stop tinting the sky.** The band is already tinted, and that is the defect. Tinting
  layer textures is an art-direction change with a frame cost. It is not a letterbox fix.

## Consequences

- Measured after, with the same method and clock (see `docs/plan/slices.md`, A6).
- The band below the canvas still ends on the tinted `--tn-ground`, while the canvas's bottom rows are ground
  dressing. The HUD covers that band on a phone, so it was not changed here. It now dims with the level.
- A layer whose first row is not one colour, or that does not span the width, gets one flat colour: the one whose
  composite equals the mean composite. No shipped level has such a layer.
- A texture that cannot be read into a 2D canvas, such as a cross-origin image without CORS, is skipped. The band
  then shows what is under it, which is the tinted sky, as before.
- Cost: one 1080 × 1 2D canvas read per layer row, once per level. No texture, no draw call and no per-frame
  work beyond one number compare.
