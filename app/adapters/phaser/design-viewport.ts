/**
 * One design resolution, any number of canvas pixels.
 *
 * `content/game.config.json` fixes the design resolution at 1080x1920 and
 * every scene in this adapter draws in those coordinates (ADR-0002). Since the
 * visual tier began degrading the *pixel count* — `renderScale` and
 * `maxPixelRatio`, which were declared in every preset and applied by nothing —
 * the drawing buffer is no longer that size, and the two have to be reconciled
 * somewhere.
 *
 * They are reconciled here, in two lines a scene calls, rather than in a base
 * class: CLAUDE.md says composition over inheritance, and a scene needs this at
 * `create` and again whenever the tier changes its mind, which a constructor
 * cannot express.
 *
 * ## The origin is the part that matters
 *
 * Phaser anchors camera zoom on the camera's origin, and that origin defaults to
 * the **centre**. A scene that draws a screen-locked rectangle from (0, 0) to
 * (1080, 1920) — which is every sky, every parallax band and every overlay in
 * this adapter — would therefore be inset by 12.5% of the canvas down one edge
 * and overflow it by the same amount on the other, at a render scale of 0.75.
 * At origin (0, 0) the same rectangle lands exactly on a canvas of
 * `1080z x 1920z` for any `z`, so a scene's drawing code never learns that the
 * buffer changed size.
 *
 * This was latent before and cost nothing only because every level so far
 * authors `camera.zoom: 1`.
 */

/** Canvas pixels per design pixel. `1` when there is nothing to measure. */
export function backingScaleOf(gameSizeWidth: number, designWidth: number): number {
  if (!Number.isFinite(gameSizeWidth) || !Number.isFinite(designWidth)) return 1;
  return gameSizeWidth > 0 && designWidth > 0 ? gameSizeWidth / designWidth : 1;
}

/** The slice of a Phaser camera this needs. Structural, so it is testable. */
export interface DesignCamera {
  setOrigin(x: number, y: number): unknown;
  setZoom(value: number): unknown;
}

/**
 * Point a camera at the design resolution, whatever size the buffer is.
 *
 * `worldZoom` is the level's own authored zoom (`camera.zoom`), which composes
 * with the backing scale rather than being replaced by it — a level that wants
 * to see half as much world still does, at whatever resolution the tier chose.
 * Returns the scale it applied, so a caller can use it for its own arithmetic.
 */
export function fitCameraToDesign(
  camera: DesignCamera,
  gameSizeWidth: number,
  designWidth: number,
  worldZoom = 1,
): number {
  const scale = backingScaleOf(gameSizeWidth, designWidth);
  const zoom = Number.isFinite(worldZoom) && worldZoom > 0 ? worldZoom : 1;
  camera.setOrigin(0, 0);
  camera.setZoom(zoom * scale);
  return scale;
}
