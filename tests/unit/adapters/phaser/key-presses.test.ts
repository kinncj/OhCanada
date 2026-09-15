/**
 * A key press the level reads once a frame is still a press. ADR-0043.
 *
 * `level-scene.ts` imports Phaser and cannot load under `environment: 'node'`,
 * so the bookkeeping that joins a key-down event to the next frame is here, and
 * this is where it is proved. What the browser adds is that Phaser's `Key` feeds
 * it: `tests/e2e/keyboard-at-a-stop.spec.ts`.
 */

import { describe, expect, it } from 'vitest';

import { createKeyPresses, directionPressed, pressedAny } from '@adapters/phaser/key-presses';

const LEFT = ['LEFT', 'A'] as const;
const RIGHT = ['RIGHT', 'D'] as const;

describe('a key press reaches the next frame, and only that frame', () => {
  it('hands a press to the next take, and not to the one after', () => {
    const presses = createKeyPresses();
    presses.down('ENTER', false);
    expect([...presses.take()]).toEqual(['ENTER']);
    expect([...presses.take()]).toEqual([]);
  });

  it('is a press however short: down and up between two frames still counts', () => {
    /* `isDown` reads false on both frames, which is why `Enter` at a stop opened
       nothing in the audit. The key-up is not recorded at all: it changes no
       press. */
    const presses = createKeyPresses();
    presses.down('ENTER', false);
    expect(pressedAny(presses.take(), ['E', 'ENTER'])).toBe(true);
  });

  it('counts a key let go and pressed again between two frames as a new press', () => {
    /* `isDown` reads true on both frames. The only trace of the lift is the second
       key-down, and it is the one a held stop waits for. */
    const presses = createKeyPresses();
    presses.down('RIGHT', false);
    presses.take();
    presses.down('RIGHT', false);
    expect(directionPressed(presses.take(), LEFT, RIGHT)).toBe(1);
  });

  it('ignores the browser’s auto-repeat, which is the same press still held', () => {
    const presses = createKeyPresses();
    presses.down('RIGHT', true);
    presses.down('ENTER', true);
    expect(presses.take().size).toBe(0);
  });

  it('forgets what the level stopped seeing: a pause, a blur', () => {
    /* `Enter` on a focused prompt reaches the level and the prompt in one event,
       and the card it opens pauses the level before the next frame. */
    const presses = createKeyPresses();
    presses.down('ENTER', false);
    presses.forget();
    expect(presses.take().size).toBe(0);
  });

  it('costs nothing on a frame nobody pressed: the same two sets, swapped', () => {
    const presses = createKeyPresses();
    const first = presses.take();
    const second = presses.take();
    const third = presses.take();
    expect(third).toBe(first);
    expect(second).not.toBe(first);
  });
});

describe('what a frame’s presses mean', () => {
  const frame = (...names: string[]): ReadonlySet<string> => new Set(names);

  it('points the way its keys point, and nowhere when both ways or neither', () => {
    expect(directionPressed(frame('A'), LEFT, RIGHT)).toBe(-1);
    expect(directionPressed(frame('RIGHT'), LEFT, RIGHT)).toBe(1);
    expect(directionPressed(frame('LEFT', 'D'), LEFT, RIGHT)).toBe(0);
    expect(directionPressed(frame('SPACE'), LEFT, RIGHT)).toBe(0);
    expect(directionPressed(frame(), LEFT, RIGHT)).toBe(0);
  });

  it('finds any of an action’s keys', () => {
    expect(pressedAny(frame('E'), ['E', 'ENTER'])).toBe(true);
    expect(pressedAny(frame('SPACE'), ['E', 'ENTER'])).toBe(false);
  });
});
