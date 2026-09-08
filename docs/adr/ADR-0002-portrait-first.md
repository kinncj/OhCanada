# ADR-0002: Portrait-first presentation

- Status: Accepted (2026-09-08)

## Context
The audience is newcomers to Canada using the phone they already have, often one-handed, often in short
sessions. Supporting both orientations doubles the layout and art surface for no learning benefit.

## Decision
- The game is **portrait only**, designed at 1080×1920 and scaled with Phaser's `Scale.FIT`, honouring
  `viewport-fit=cover` and the safe-area insets.
- Landscape on a phone shows a "rotate to portrait" overlay and pauses; it never renders a landscape layout.
- Desktop and iPad render the *same* portrait canvas centred, with the level's sky and ground colours
  extended into side panels. The canvas is never stretched to fill a wide window.
- Composition: playfield in the upper two-thirds, HUD and cards in the lower third, within thumb reach.
- Input is one-thumb: hold to move, tap to jump or interact, tap an NPC or POI to engage. An auto-move
  option covers players who prefer point-to-travel. No trick system.

## Alternatives considered
- **Responsive both orientations** — rejected: two layouts, two art crops, twice the a11y testing.
- **Landscape with a portrait letterbox** — rejected: wastes the phone's natural grip and reading posture.

## Consequences
- Art is authored to a single aspect ratio; parallax layers only need horizontal extension.
- Desktop players see side panels rather than a wider playfield, which keeps one camera tuning for all targets.
- `touch-action: none`, no double-tap zoom and no pull-to-refresh are required for the canvas to behave.
