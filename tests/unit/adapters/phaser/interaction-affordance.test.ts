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
 *   - reduced motion removes the pulse and nothing else.
 */

import { describe, expect, it } from 'vitest';

import {
  MARK_GAP_PX,
  MIN_MARK_PX,
  PULSE_AMPLITUDE,
  PULSE_PERIOD_MS,
  affordanceMarks,
  markPulse,
  type AffordanceSubject,
} from '@adapters/phaser/interaction-affordance';

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
    const marks = affordanceMarks([npc], options);
    const mark = marks[0];
    if (mark === undefined) throw new Error('no mark');
    expect(mark.y + mark.size / 2).toBeLessThanOrEqual(npc.rect.y - MARK_GAP_PX + 1e-9);
  });

  it('stays on screen when the subject is tall enough to reach the top of the world', () => {
    const tall: AffordanceSubject = { ...landmark, rect: { ...landmark.rect, y: 10 } };
    const marks = affordanceMarks([tall], { ...options, playerX: 5400 });
    const mark = marks[0];
    if (mark === undefined) throw new Error('no mark');
    expect(mark.y - mark.size / 2).toBeGreaterThanOrEqual(0);
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
