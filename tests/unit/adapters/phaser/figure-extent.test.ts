/**
 * Where a figure's parts are drawn, as boxes, from the rig. ADR-0037, ADR-0049.
 *
 * The stop's stand-off, the mark over a character and the mark's clearance off the
 * player's head all read the same windows `sprite-character-renderer.ts` draws
 * with. This file holds the placement arithmetic on a rig small enough to read:
 * a mirrored twin, a template resolved over a player's choices, mode equipment,
 * and a pose that moves and turns a part about its pivot.
 */

import { describe, expect, it } from 'vitest';

import { silhouetteBounds, topWithin } from '@adapters/phaser/art-silhouette';
import {
  figureBoxes,
  figureSilhouette,
  mirrorBox,
  unionBox,
  type FigureBox,
} from '@adapters/phaser/figure-extent';

import type { RigArtboard, RigDocument, RigFrame } from '@application/ports';

import rigJson from '@content/characters/rig.json';

const RIG = rigJson as unknown as RigDocument;
const PREFIX = RIG.atlas.framePrefix;

const frame = (x: number, y: number, w: number, h: number): RigFrame => ({
  source: 'src/svg/shared/character/test.svg',
  x,
  y,
  w,
  h,
});

const artboard = (name: string, over: Partial<Omit<RigArtboard, 'artboard'>> = {}): RigArtboard => ({
  characterId: name as RigArtboard['characterId'],
  artboard: name,
  stateMachine: 'motion',
  skins: {},
  playerSelectableSlots: [],
  ...over,
});

/**
 * Four parts in the real rig's character space (centre 120, sole 460), each
 * written about the figure's feet in the comment:
 *
 *  - a body at 100..140, 150..460          → x -20..20,   y -310..0
 *  - an arm at 140..160 drawn mirrored     → x -40..-20,  y -280..-180
 *  - equipment for one mode only           → x -120..120, y -60..0
 *  - a head whose options differ in size   → crop x -30..30, y -420..-340
 */
const TINY: RigDocument = {
  ...RIG,
  parts: [
    { name: 'body', z: 1, frame: 'body-{costume}', pivot: [120, 300], mirrorX: false },
    { name: 'arm', z: 2, frame: 'arm-{costume}', pivot: [150, 200], mirrorX: true },
    { name: 'gear', z: 3, frame: 'gear-{mode}', pivot: [120, 440], mirrorX: false },
    { name: 'head', z: 4, frame: 'head-{hairShape}', pivot: [120, 112], mirrorX: false },
  ],
  frames: {
    [`${PREFIX}body-wool`]: frame(100, 150, 40, 310),
    [`${PREFIX}arm-wool`]: frame(140, 180, 20, 100),
    [`${PREFIX}gear-wheels`]: frame(0, 400, 240, 60),
    [`${PREFIX}head-crop`]: frame(90, 40, 60, 80),
    [`${PREFIX}head-long`]: frame(80, 30, 80, 150),
  },
  artboards: [
    artboard('stranger', { skins: { costume: 'wool', hairShape: 'crop' } }),
    artboard('hero', { skins: { costume: 'wool' }, playerSelectableSlots: ['hairShape'] }),
  ],
  states: {
    idle: {
      loop: 'loop',
      durationMs: 1000,
      keys: [
        { t: 0, parts: {} },
        { t: 1, parts: { head: [10, -5, 0] } },
      ],
    },
    'wheels/idle': {
      loop: 'loop',
      durationMs: 1000,
      keys: [{ t: 0, parts: { head: [0, 100, 90] } }],
    },
  },
};

const BODY: FigureBox = { x: -20, y: -310, width: 40, height: 310 };
const ARM: FigureBox = { x: -40, y: -280, width: 20, height: 100 };
const GEAR: FigureBox = { x: -120, y: -60, width: 240, height: 60 };
const CROP: FigureBox = { x: -30, y: -420, width: 60, height: 80 };
const LONG: FigureBox = { x: -40, y: -430, width: 80, height: 150 };

function expectBox(actual: FigureBox | undefined, expected: FigureBox): void {
  expect(actual).toBeDefined();
  expect(actual?.x ?? Number.NaN).toBeCloseTo(expected.x, 9);
  expect(actual?.y ?? Number.NaN).toBeCloseTo(expected.y, 9);
  expect(actual?.width ?? Number.NaN).toBeCloseTo(expected.width, 9);
  expect(actual?.height ?? Number.NaN).toBeCloseTo(expected.height, 9);
}

describe('the boxes a figure draws, as authored', () => {
  it('measures every part about the feet, and reflects a mirrored twin about the centre', () => {
    expect(figureBoxes(TINY, 'stranger', null)).toEqual([BODY, ARM, CROP]);
  });

  it('adds the equipment of the mode it moves in, and only that mode', () => {
    expect(figureBoxes(TINY, 'stranger', 'wheels')).toEqual([BODY, ARM, GEAR, CROP]);
    expect(figureBoxes(TINY, 'stranger', 'paddles')).toEqual([BODY, ARM, CROP]);
  });

  it('covers every option a player could choose', () => {
    expect(figureBoxes(TINY, 'hero', null, { parts: ['head'] })).toEqual([CROP, LONG]);
  });

  it('answers null for an artboard the rig does not have', () => {
    expect(figureBoxes(TINY, 'nobody', null)).toBeNull();
  });
});

describe('the boxes a figure draws, in a pose', () => {
  it('moves a part by every keyframe of the state, one box per keyframe', () => {
    const boxes = figureBoxes(TINY, 'stranger', null, { parts: ['head'], pose: 'idle' });
    expect(boxes).toHaveLength(2);
    expectBox(boxes?.[0], CROP);
    expectBox(boxes?.[1], { ...CROP, x: CROP.x + 10, y: CROP.y - 5 });
  });

  it("plays the mode's own state when the rig has one, turning the part about its pivot", () => {
    /* A quarter turn about the jaw (120, 112), then 100 px down. The crop window
       runs -30..30 across and -72..8 down about the pivot; turned clockwise it
       runs -8..72 across and -30..30 down, and the pivot sits at 0, -248. */
    const boxes = figureBoxes(TINY, 'stranger', 'wheels', { parts: ['head'], pose: 'idle' });
    expect(boxes).toHaveLength(1);
    expectBox(boxes?.[0], { x: -8, y: -278, width: 80, height: 60 });
  });

  it('keeps the authored layout for a state the rig does not declare', () => {
    expect(figureBoxes(TINY, 'stranger', null, { parts: ['head'], pose: 'nothing' })).toEqual([CROP]);
  });
});

describe('boxes, turned and joined', () => {
  it('faces a box the other way', () => {
    expect(mirrorBox(ARM)).toEqual({ ...ARM, x: 20 });
  });

  it('joins boxes into the smallest one holding them all, and none into nothing', () => {
    expect(unionBox([BODY, CROP])).toEqual({ x: -30, y: -420, width: 60, height: 420 });
    expect(unionBox([])).toBeNull();
  });
});

describe('a character where it stands', () => {
  it('stands its silhouette on the ground at its x', () => {
    const silhouette = figureSilhouette(TINY, 'stranger', { x: 1000, groundY: 1280, facing: 'right' });
    expect(silhouette).not.toBeNull();
    if (silhouette === null) return;
    expect(silhouetteBounds(silhouette)).toEqual({ left: 960, right: 1032, top: 860, bottom: 1280 });
    expect(topWithin(silhouette, 998, 1002)).toBe(860);
    /* The mirrored arm, on the trailing side of a figure facing right. */
    expect(topWithin(silhouette, 960, 968)).toBe(1000);
  });

  it('turns with its facing', () => {
    const silhouette = figureSilhouette(TINY, 'stranger', { x: 1000, groundY: 1280, facing: 'left' });
    expect(silhouette).not.toBeNull();
    if (silhouette === null) return;
    expect(topWithin(silhouette, 1030, 1040)).toBe(1000);
  });

  it('answers null for an artboard the rig does not have', () => {
    expect(figureSilhouette(TINY, 'nobody', { x: 0, groundY: 0, facing: 'right' })).toBeNull();
  });
});

describe('on the shipped rig', () => {
  it("every placed character's crown is below the top of the character space — the gap the mark floated in", () => {
    const placed = RIG.artboards.filter((candidate) => candidate.playerSelectableSlots.length === 0);
    expect(placed.length, 'the rig places no character besides the player').toBeGreaterThan(0);
    for (const board of placed) {
      const figure = unionBox(figureBoxes(RIG, board.artboard, null) ?? []);
      expect(figure, board.artboard).not.toBeNull();
      expect(figure?.y ?? Number.NEGATIVE_INFINITY, board.artboard).toBeGreaterThan(-RIG.characterSpace.soleY);
    }
  });
});
