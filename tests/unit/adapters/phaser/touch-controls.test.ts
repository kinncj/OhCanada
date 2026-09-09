/**
 * The gesture rules, without a browser.
 *
 * This file measures the *decisions* — is this press a tap or a hold, which way
 * is the finger from the player, does a cancelled pointer leave a direction
 * latched — because those are arithmetic and a browser adds nothing to them.
 *
 * It is deliberately NOT the proof that touch works. A test that drives the
 * abstraction this file exports and then asserts the abstraction did what it was
 * told proves that the module is self-consistent and nothing else. The proof is
 * `tests/e2e/touch-controls.spec.ts`, which sends real `touchstart` /
 * `touchmove` / `touchend` / `touchcancel` through Chromium into real Phaser and
 * reads what the level's frame trace was actually given. What is here is the
 * fast feedback loop and the branch coverage that a five-scenario browser suite
 * cannot afford.
 */

import { describe, expect, it } from 'vitest';

import {
  FALLBACK_CANVAS_CSS_WIDTH,
  MIN_TOUCH_TARGET_PT,
  TAP_MAX_MS,
  TAP_MAX_TRAVEL_PX,
  WALK_DEADZONE_PX,
  createTouchControls,
  grownRect,
  hitTest,
  minTouchTargetPx,
} from '@adapters/phaser/touch-controls';

/** The player's x on screen, in design pixels. The screen is 1080 wide. */
const CENTRE = 540;

describe('a press only becomes a walk once it is no longer a candidate tap', () => {
  it('produces no direction inside the tap window, however far from the player it is', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS - 1)).toBe(0);
  });

  it('walks once the press outlives the tap window', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
  });

  it('walks immediately once the finger travels past the tap radius', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.drag(1, { x: 1000 + TAP_MAX_TRAVEL_PX + 1, y: 900 }, 10);
    expect(controls.axis(CENTRE, 10)).toBe(1);
  });

  it('does not walk on travel that is still inside the tap radius', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.drag(1, { x: 1000 + TAP_MAX_TRAVEL_PX - 1, y: 900 }, 10);
    expect(controls.axis(CENTRE, 10)).toBe(0);
  });
});

describe('direction is measured from the player, never from the screen', () => {
  it('walks right when the touch is right of the player', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 800, y: 900 }, 0);
    expect(controls.axis(400, TAP_MAX_MS)).toBe(1);
  });

  it('walks left when the touch is left of a player who is on the right of the screen', () => {
    /* The discriminating case. The touch at 700 is in the RIGHT half of a
       1080-wide screen, so a screen-zone implementation walks right. The player
       is at 900, so the finger is left of them and the rule written in
       CLAUDE.md's traversal row walks left. */
    const controls = createTouchControls();
    controls.press(1, { x: 700, y: 900 }, 0);
    expect(controls.axis(900, TAP_MAX_MS)).toBe(-1);
  });

  it('walks right when the touch is right of a player who is on the left of the screen', () => {
    /* The mirror: the touch at 380 is in the LEFT half, and is still a walk to
       the right because the player is at 200. */
    const controls = createTouchControls();
    controls.press(1, { x: 380, y: 900 }, 0);
    expect(controls.axis(200, TAP_MAX_MS)).toBe(1);
  });

  it('holds its direction as the player walks under the finger', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 800, y: 900 }, 0);
    expect(controls.axis(400, TAP_MAX_MS)).toBe(1);
    /* The player has caught up with and passed the finger. Re-deciding from
       scratch would flip to -1 and the walk would judder on the spot. */
    expect(controls.axis(800, TAP_MAX_MS + 100)).toBe(1);
    expect(controls.axis(800 + WALK_DEADZONE_PX, TAP_MAX_MS + 200)).toBe(1);
  });

  it('turns around only once the finger is clearly on the other side', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 800, y: 900 }, 0);
    expect(controls.axis(400, TAP_MAX_MS)).toBe(1);
    expect(controls.axis(800 + WALK_DEADZONE_PX + 1, TAP_MAX_MS + 100)).toBe(-1);
  });

  it('turns around the other way too, and holds the new direction', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 200, y: 900 }, 0);
    expect(controls.axis(700, TAP_MAX_MS)).toBe(-1);
    /* Still left while the player is anywhere but clearly right of the finger. */
    expect(controls.axis(200 - WALK_DEADZONE_PX, TAP_MAX_MS + 50)).toBe(-1);
    expect(controls.axis(200 - WALK_DEADZONE_PX - 1, TAP_MAX_MS + 100)).toBe(1);
  });

  it('keeps the direction it had when the player position cannot be read', () => {
    /* A frame taken before the camera has a scroll, or after a level is torn
       down, can hand this a NaN. Freezing beats guessing: a spurious 0 would
       stutter the walk and a spurious sign would turn the player around. */
    const controls = createTouchControls();
    controls.press(1, { x: 800, y: 900 }, 0);
    expect(controls.axis(400, TAP_MAX_MS)).toBe(1);
    expect(controls.axis(Number.NaN, TAP_MAX_MS + 50)).toBe(1);
  });

  it('replaces a press whose pointer id is already down rather than shadowing it', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 800, y: 900 }, 0);
    controls.press(1, { x: 200, y: 900 }, 0);
    expect(controls.active).toBe(1);
    expect(controls.axis(500, TAP_MAX_MS)).toBe(-1);
  });

  it('picks no direction while the press is inside the dead zone', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 540 + WALK_DEADZONE_PX - 1, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(0);
  });
});

describe('a release that did nothing is still a tap', () => {
  it('reports a tap when the press was short and still', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.release(1, TAP_MAX_MS - 1)).toEqual({ x: 1000, y: 900 });
  });

  it('reports no tap when the press walked', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    expect(controls.release(1, TAP_MAX_MS + 500)).toBeNull();
  });

  it('reports a tap for a slow, slightly dragged press that never moved anybody', () => {
    /* The failure this rule exists for: a press on the player, held a beat too
       long and nudged a few pixels, is outside the tap window and inside the
       dead zone — so under a duration-only rule it is a "walk" that produces no
       movement and eats the tap. The player pressed and nothing happened. */
    const controls = createTouchControls();
    controls.press(1, { x: CENTRE + 10, y: 900 }, 0);
    controls.drag(1, { x: CENTRE + 18, y: 902 }, 300);
    expect(controls.axis(CENTRE, 300)).toBe(0);
    expect(controls.release(1, 400)).toEqual({ x: CENTRE + 18, y: 902 });
  });

  it('does not report a tap for a press that walked and then came to rest in the dead zone', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(400, TAP_MAX_MS)).toBe(1);
    /* The player has walked to the finger; the direction is latched, and the
       press has plainly done its job. */
    expect(controls.axis(1000, TAP_MAX_MS + 400)).toBe(1);
    expect(controls.release(1, TAP_MAX_MS + 500)).toBeNull();
  });

  it('reports no tap for an unknown pointer', () => {
    const controls = createTouchControls();
    expect(controls.release(9, 10)).toBeNull();
  });

  it('ignores a drag for an unknown pointer', () => {
    const controls = createTouchControls();
    controls.drag(9, { x: 10, y: 10 }, 10);
    expect(controls.active).toBe(0);
  });
});

describe('a release, and a browser taking the pointer away, both stop the walk', () => {
  it('stops on release', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    controls.release(1, TAP_MAX_MS + 500);
    expect(controls.axis(CENTRE, TAP_MAX_MS + 501)).toBe(0);
  });

  it('stops on cancel, and the cancelled press is not a tap', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.cancel(1);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(0);
    expect(controls.release(1, TAP_MAX_MS + 1)).toBeNull();
  });

  it('stops on cancelAll, which is what a blurred window has to do', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.press(2, { x: 80, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    controls.cancelAll();
    expect(controls.active).toBe(0);
    expect(controls.axis(CENTRE, TAP_MAX_MS + 1)).toBe(0);
  });
});

describe('two fingers never ask for two directions', () => {
  it('gives the axis to the oldest press and ignores the newer one', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    controls.press(2, { x: 40, y: 900 }, TAP_MAX_MS);
    expect(controls.axis(CENTRE, TAP_MAX_MS * 3)).toBe(1);
  });

  it('hands the axis over when the older press ends', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.press(2, { x: 40, y: 900 }, 10);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    controls.release(1, TAP_MAX_MS + 10);
    expect(controls.axis(CENTRE, TAP_MAX_MS + 20)).toBe(-1);
  });

  it('lets a second finger tap while the first one walks', () => {
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    controls.press(2, { x: 300, y: 700 }, 1000);
    expect(controls.release(2, 1000 + TAP_MAX_MS - 1)).toEqual({ x: 300, y: 700 });
    expect(controls.axis(CENTRE, 1200)).toBe(1);
  });

  it('does not extend the stalled-press exemption to a finger that never owned the axis', () => {
    /* The exemption exists because the axis owner did nothing. A second finger
       held for a second and a half is a hold, not a tap, and turning it into a
       jump would fire one every time somebody rests a thumb on the glass. */
    const controls = createTouchControls();
    controls.press(1, { x: 1000, y: 900 }, 0);
    controls.press(2, { x: CENTRE, y: 700 }, 0);
    expect(controls.axis(CENTRE, TAP_MAX_MS)).toBe(1);
    expect(controls.release(2, 1500)).toBeNull();
  });
});

describe('a target is at least 44 pt across however small its art is', () => {
  it('converts 44 pt into design pixels using the canvas the player is touching', () => {
    /* 1080 design pixels across a 390 CSS-pixel phone canvas is 2.77 design
       pixels per CSS pixel, so 44 pt is a hair under 122 design pixels. */
    expect(minTouchTargetPx(1080, 390)).toBeCloseTo((MIN_TOUCH_TARGET_PT * 1080) / 390, 6);
    /* A desktop centres a much smaller portrait canvas, so the same 44 pt is
       fewer design pixels. The rule is the physical size, not the number. */
    expect(minTouchTargetPx(1080, 540)).toBeLessThan(minTouchTargetPx(1080, 390));
  });

  it('falls back to the narrowest phone when the canvas cannot be measured', () => {
    const fallback = (MIN_TOUCH_TARGET_PT * 1080) / FALLBACK_CANVAS_CSS_WIDTH;
    expect(minTouchTargetPx(1080, 0)).toBeCloseTo(fallback, 6);
    expect(minTouchTargetPx(1080, Number.NaN)).toBeCloseTo(fallback, 6);
    expect(minTouchTargetPx(0, 390)).toBeCloseTo(0, 6);
  });

  it('grows a small rect about its centre and leaves a large one alone', () => {
    expect(grownRect({ x: 100, y: 100, width: 20, height: 20 }, 100)).toEqual({
      x: 60,
      y: 60,
      width: 100,
      height: 100,
    });
    const big = { x: 0, y: 0, width: 400, height: 700 };
    expect(grownRect(big, 100)).toEqual(big);
  });

  it('leaves the rect alone rather than inverting it when the minimum is nonsense', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    expect(grownRect(rect, Number.NaN)).toEqual(rect);
    expect(grownRect(rect, -50)).toEqual(rect);
  });
});

describe('hit testing decides what a tap meant before the jump does', () => {
  const officer = { id: 'npc.officer', npc: true, rect: { x: 2380, y: 1100, width: 40, height: 140 } };
  const tower = { id: 'poi.tower', npc: false, rect: { x: 5310, y: 500, width: 180, height: 740 } };

  it('finds a target whose art is smaller than a finger', () => {
    expect(hitTest([officer, tower], { x: 2340, y: 1150 }, 122)?.id).toBe('npc.officer');
  });

  it('finds nothing on empty ground', () => {
    expect(hitTest([officer, tower], { x: 3000, y: 1150 }, 122)).toBeNull();
  });

  it('misses on every edge, not only the near ones', () => {
    /* Four separate arms, and a hit area that only checks two of them is a hit
       area that reaches to the bottom of the world on one side. */
    expect(hitTest([officer], { x: 2600, y: 1150 }, 122)).toBeNull();
    expect(hitTest([officer], { x: 2100, y: 1150 }, 122)).toBeNull();
    expect(hitTest([officer], { x: 2400, y: 1500 }, 122)).toBeNull();
    expect(hitTest([officer], { x: 2400, y: 800 }, 122)).toBeNull();
  });

  it('finds nothing when the target list is empty', () => {
    expect(hitTest([], { x: 2400, y: 1150 }, 122)).toBeNull();
  });

  it('prefers the target whose centre the tap is nearest when two overlap', () => {
    const near = { id: 'a', npc: false, rect: { x: 990, y: 990, width: 20, height: 20 } };
    const far = { id: 'b', npc: false, rect: { x: 900, y: 900, width: 300, height: 300 } };
    expect(hitTest([far, near], { x: 1000, y: 1000 }, 40)?.id).toBe('a');
    /* Both orders, because "nearest wins" and "first wins" agree in one of them. */
    expect(hitTest([near, far], { x: 1000, y: 1000 }, 40)?.id).toBe('a');
  });
});
