/**
 * "We don't know what to click."
 *
 * The touch layer has been right for a while — hold to move, tap to jump, tap a
 * target to engage — and none of it was discoverable, because nothing on screen
 * said that a landmark or a person could be tapped at all. A control the player
 * cannot see is not a control.
 *
 * This module is the policy half of the fix: which subjects get a mark, what
 * state each mark is in, how big it is and where it sits. The drawing is
 * `level-scene.ts`'s, and it is three shapes.
 *
 * The rules that matter and are asserted below:
 *
 *   - a subject reads as interactive **before** it is in reach, and differently
 *     once it is — two states, distinguished by shape and not only by colour
 *     (CLAUDE.md: colour is never the only signal; the shape is the scene's);
 *   - the mark is never smaller than the glass that counts as the subject, so
 *     what a player sees is at least what they can hit (>= 44 pt, computed per
 *     device by `touch-controls.ts` and passed in here);
 *   - a mode that cannot engage anything shows no marks at all, because a ring
 *     over something a tap will refuse is a lie;
 *   - reduced motion removes the pulse and nothing else;
 *   - a mark points at its subject's **art**, from just above it, and never
 *     covers the player's head where a stop holds them (ADR-0049).
 */

import { describe, expect, it } from 'vitest';

import { silhouetteBounds, silhouetteFromBoxes, topWithin, type ArtSilhouette } from '@adapters/phaser/art-silhouette';
import {
  MARK_GAP_PX,
  MARK_RING_FRACTION,
  MARK_TIP_FRACTION,
  MIN_MARK_PX,
  PULSE_AMPLITUDE,
  PULSE_PERIOD_MS,
  affordanceMarks,
  markAnchor,
  markExtent,
  markPulse,
  type AffordanceMark,
  type AffordanceSubject,
} from '@adapters/phaser/interaction-affordance';
import type { TargetRect } from '@adapters/phaser/touch-controls';

const npc: AffordanceSubject = {
  id: 'npc-one',
  npc: true,
  position: { x: 2400, y: 1500 },
  rect: { x: 2360, y: 1350, width: 80, height: 150 },
};

const landmark: AffordanceSubject = {
  id: 'landmark-one',
  npc: false,
  position: { x: 5400, y: 1500 },
  rect: { x: 5290, y: 720, width: 220, height: 780 },
};

const options = {
  playerX: 2400,
  reachPx: 240,
  minTouchPx: 122,
};

const only = (marks: readonly AffordanceMark[]): AffordanceMark => {
  const mark = marks[0];
  if (mark === undefined) throw new Error('no mark');
  return mark;
};

const art = (boxes: readonly TargetRect[]): ArtSilhouette => {
  const silhouette = silhouetteFromBoxes(boxes);
  if (silhouette === null) throw new Error('no art');
  return silhouette;
};

const overlaps = (a: TargetRect, b: TargetRect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('every engageable subject is marked', () => {
  it('marks a subject that is out of reach, so it reads as interactive before it is touched', () => {
    const marks = affordanceMarks([npc, landmark], options);
    expect(marks.map((mark) => mark.id)).toEqual(['npc-one', 'landmark-one']);
    expect(marks[1]?.state).toBe('idle');
  });

  it('changes state — not only shade — once a subject is in reach', () => {
    const marks = affordanceMarks([npc, landmark], options);
    expect(marks[0]?.state).toBe('ready');
  });

  it('measures reach from the subject the way the engage rule does', () => {
    /* Same rule, same number: `#engageNearest` filters on |position.x - playerX|
       <= reach. A mark that used a different distance would promise a tap the
       game then refused, which is worse than no mark. */
    const justInside = affordanceMarks([landmark], { ...options, playerX: 5400 - 240 });
    const justOutside = affordanceMarks([landmark], { ...options, playerX: 5400 - 241 });
    expect(justInside[0]?.state).toBe('ready');
    expect(justOutside[0]?.state).toBe('idle');
  });

  it('keeps a held subject ready past the edge of reach, and nothing else (ADR-0037)', () => {
    /* A player who let go in reach is held at the subject, and a brake can carry
       them a little past the edge. The offer the prompt made is not withdrawn by
       that: the mark says the same thing the prompt does. */
    const justOutside = { ...options, playerX: 5400 - 241 };
    expect(affordanceMarks([landmark], { ...justOutside, held: 'landmark-one' })[0]?.state).toBe('ready');
    expect(affordanceMarks([landmark], { ...justOutside, held: 'npc-one' })[0]?.state).toBe('idle');
    expect(affordanceMarks([landmark], { ...justOutside, held: null })[0]?.state).toBe('idle');
  });

  it('says done for a held subject that is finished, because done still wins', () => {
    const marks = affordanceMarks([landmark], {
      ...options,
      playerX: 5400 - 241,
      held: 'landmark-one',
      completed: new Set(['landmark-one']),
    });
    expect(marks[0]?.state).toBe('done');
  });

  it('shows nothing at all when the mode cannot engage anything', () => {
    /* A canoe mid-river has `interaction: null`, which reaches here as a reach
       of 0. Every tap would be refused, so nothing may advertise otherwise. */
    expect(affordanceMarks([npc, landmark], { ...options, reachPx: 0 })).toEqual([]);
  });
});

describe('a finished subject stops asking', () => {
  it('is done rather than ready, even standing on top of it', () => {
    const marks = affordanceMarks([npc], { ...options, completed: new Set(['npc-one']) });
    expect(marks[0]?.state).toBe('done');
  });

  it('is still drawn, because a place you have been is still a place', () => {
    const marks = affordanceMarks([npc, landmark], {
      ...options,
      completed: new Set(['npc-one', 'landmark-one']),
    });
    expect(marks).toHaveLength(2);
    expect(marks.every((mark) => mark.state === 'done')).toBe(true);
  });
});

describe('what is drawn is at least what can be tapped', () => {
  it('is never narrower than the device"s 44 pt target', () => {
    const marks = affordanceMarks([npc], options);
    expect(marks[0]?.size).toBeGreaterThanOrEqual(options.minTouchPx);
  });

  it('has a floor of its own, so a large canvas cannot shrink it to nothing', () => {
    const marks = affordanceMarks([npc], { ...options, minTouchPx: 4 });
    expect(marks[0]?.size).toBe(MIN_MARK_PX);
  });

  it('survives a canvas that has not been measured yet', () => {
    const marks = affordanceMarks([npc], { ...options, minTouchPx: Number.NaN });
    expect(marks[0]?.size).toBe(MIN_MARK_PX);
  });
});

describe('where the mark sits', () => {
  it('is centred over the art that was actually drawn, not over the anchor', () => {
    /* A landmark's placement x is its base; its art is 220 wide around it, and a
       character composed from the rig is `characterSpace` wide. Reading the
       drawn rectangle is what makes the mark land on the picture. */
    const skewed: AffordanceSubject = {
      ...landmark,
      rect: { ...landmark.rect, x: 5290 + 60 },
    };
    const marks = affordanceMarks([skewed], { ...options, playerX: 5400 });
    expect(marks[0]?.x).toBe(5290 + 60 + 110);
  });

  it('clears the top of the art rather than covering the face', () => {
    const mark = only(affordanceMarks([npc], options));
    expect(markAnchor(mark).y).toBeLessThanOrEqual(npc.rect.y - MARK_GAP_PX + 1e-9);
  });

  it('stays on screen when the subject is tall enough to reach the top of the world', () => {
    const tall: AffordanceSubject = { ...landmark, rect: { ...landmark.rect, y: 10 } };
    const mark = only(affordanceMarks([tall], { ...options, playerX: 5400 }));
    expect(mark.y - mark.size / 2).toBeGreaterThanOrEqual(0);
  });

  it('draws its ring, its halo and its point inside the box it is measured by, at the top of its pulse', () => {
    const mark = { x: 0, y: 0, size: 100 };
    const extent = markExtent(mark);
    expect(markAnchor(mark)).toEqual({ x: 0, y: 100 * MARK_TIP_FRACTION });
    expect(extent.width).toBeCloseTo(100 * (1 + PULSE_AMPLITUDE), 9);
    expect(extent.y + extent.height).toBeGreaterThanOrEqual(markAnchor(mark).y * (1 + PULSE_AMPLITUDE));
    /* The ring's radius plus the 10 px halo's outer half. */
    expect(extent.width / 2).toBeGreaterThan(100 * MARK_RING_FRACTION * (1 + PULSE_AMPLITUDE) + 5);
  });
});

describe('a mark points at the art, not at the rectangle around it (ADR-0049)', () => {
  it('rests just above the art under it — a character whose box starts above the crown', () => {
    /* The guide's defect: `characterSpace` starts 40 px above his head, and the
       ring floated in the gap. */
    const mark = only(affordanceMarks([{ ...npc, art: art([{ x: 2380, y: 1390, width: 40, height: 110 }]) }], options));
    expect(mark.x).toBe(2400);
    expect(markAnchor(mark).y).toBeCloseTo(1390 - MARK_GAP_PX, 9);
  });

  it('points at the art under its own width, not at a tall part beside it', () => {
    /* A landmark whose tallest part is off to one side: the grain elevator's
       texture starts 520 px above the roof under its centre. */
    const elevator = art([
      { x: 5290, y: 720, width: 40, height: 780 },
      { x: 5340, y: 1200, width: 170, height: 300 },
    ]);
    const mark = only(affordanceMarks([{ ...landmark, art: elevator }], { ...options, playerX: 5400 }));
    expect(mark.x).toBe(5400);
    expect(markAnchor(mark).y).toBeCloseTo(1200 - MARK_GAP_PX, 9);
  });

  it('moves to the nearest art when the middle of the rectangle is empty, and the higher of two', () => {
    const legs = art([
      { x: 5290, y: 1000, width: 40, height: 500 },
      { x: 5470, y: 1100, width: 40, height: 400 },
    ]);
    const mark = only(affordanceMarks([{ ...landmark, art: legs }], { ...options, playerX: 5400 }));
    expect(mark.x).toBeLessThan(5400);
    expect(topWithin(legs, mark.x - mark.size / 2, mark.x + mark.size / 2)).toBe(1000);
    expect(markAnchor(mark).y).toBeCloseTo(1000 - MARK_GAP_PX, 9);
  });
});

describe('a mark keeps off the player a stop holds at its subject (ADR-0049)', () => {
  const size = options.minTouchPx;

  it('moves along the art, off the head, when the art is lower than the player', () => {
    /* The North's sternwheeler: long, lower than the player, and the player rests
       level with its middle. */
    const hull = { x: 4940, y: 1220, width: 920, height: 280 };
    const head = { x: 5340, y: 1080, width: 120, height: 110 };
    const boat: AffordanceSubject = { ...landmark, rect: hull, art: art([hull]), clear: [head] };
    const covered = only(affordanceMarks([{ ...boat, clear: [] }], { ...options, playerX: 5400 }));
    expect(overlaps(markExtent(covered), head), 'the case does not put the mark on the head').toBe(true);

    const mark = only(affordanceMarks([boat], { ...options, playerX: 5400 }));
    expect(overlaps(markExtent(mark), head)).toBe(false);
    expect(markAnchor(mark).y).toBeCloseTo(1220 - MARK_GAP_PX, 9);
    const bounds = silhouetteBounds(art([hull]));
    expect(mark.x).toBeGreaterThanOrEqual(bounds?.left ?? Number.NaN);
    expect(mark.x).toBeLessThanOrEqual(bounds?.right ?? Number.NaN);
    /* The same distance either way, and the same height: the right-hand place,
       so the answer never depends on the order anything was listed in. */
    expect(mark.x).toBeGreaterThan(5400);
  });

  it('takes the higher of two clear places at the same distance', () => {
    const tiers = art([
      { x: 4940, y: 1000, width: 460, height: 500 },
      { x: 5400, y: 1220, width: 460, height: 280 },
    ]);
    const head = { x: 5340, y: 850, width: 120, height: 340 };
    const mark = only(
      affordanceMarks([{ ...landmark, rect: { x: 4940, y: 1000, width: 920, height: 500 }, art: tiers, clear: [head] }], {
        ...options,
        playerX: 5400,
      }),
    );
    expect(overlaps(markExtent(mark), head)).toBe(false);
    expect(mark.x).toBeLessThan(5400);
    expect(markAnchor(mark).y).toBeCloseTo(1000 - MARK_GAP_PX, 9);
  });

  it('rises above the head only when no place on the art is clear of it', () => {
    const head = { x: 2300, y: 1300, width: 200, height: 100 };
    const mark = only(
      affordanceMarks([{ ...npc, art: art([{ x: 2380, y: 1390, width: 40, height: 110 }]), clear: [head] }], options),
    );
    const extent = markExtent(mark);
    expect(mark.x).toBe(2400);
    expect(overlaps(extent, head)).toBe(false);
    expect(extent.y + extent.height).toBeCloseTo(head.y - MARK_GAP_PX, 9);
    expect(size).toBe(mark.size);
  });
});

describe('the pulse', () => {
  it('is switched off entirely by reduced motion', () => {
    for (const elapsed of [0, 200, 800, 1234, 99_999]) {
      expect(markPulse(elapsed, true)).toBe(1);
    }
  });

  it('stays inside the stated amplitude and repeats', () => {
    for (let step = 0; step <= 64; step += 1) {
      const value = markPulse((step / 64) * PULSE_PERIOD_MS, false);
      expect(value).toBeGreaterThanOrEqual(1 - PULSE_AMPLITUDE - 1e-9);
      expect(value).toBeLessThanOrEqual(1 + PULSE_AMPLITUDE + 1e-9);
    }
    expect(markPulse(0, false)).toBeCloseTo(markPulse(PULSE_PERIOD_MS, false), 9);
  });

  it('answers a clock that has not started with the resting size', () => {
    expect(markPulse(Number.NaN, false)).toBe(1);
    expect(markPulse(-5, false)).toBe(1);
  });
});
