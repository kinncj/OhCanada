/**
 * Where the player's head is while a stop holds them. ADR-0049.
 *
 * At the North's sternwheeler the mark was drawn on the player's face: the drive
 * rests the player level with a landmark, the landmark was lower than the player,
 * and the mark sat a fixed height above the landmark's art. `mark-clearance.ts`
 * says where the head is at every place a stop can leave the player, so a mark can
 * keep off it. This file holds that arithmetic; every shipped level is
 * `tests/unit/contracts/a-mark-sits-on-its-subject.test.ts`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { playerArtboard } from '@adapters/phaser/character-cast';
import { HEAD_PARTS, figureBoxes, unionBox } from '@adapters/phaser/figure-extent';
import { groundYAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { posePath } from '@adapters/phaser/locomotion-pose';
import { RESTING_POSE, playerHeadBoxes, restingHeadBoxes } from '@adapters/phaser/mark-clearance';
import { landingSlackPx } from '@adapters/phaser/stand-off';
import type { TargetRect } from '@adapters/phaser/touch-controls';

import type { LocomotionTuning, Ride, RigDocument } from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const RIG = rigJson as unknown as RigDocument;
const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

/** A shipped mode that can engage, with no ride under it. */
const TUNING: LocomotionTuning = ((): LocomotionTuning => {
  for (const level of LEVELS) {
    for (const tuning of level.locomotion) {
      const ridden = level.rides.some((ride) => ride.mode === tuning.mode);
      if ((tuning.interaction?.reachPx ?? 0) > 0 && !ridden) return tuning;
    }
  }
  throw new Error('no shipped level moves in a mode that can engage without a ride');
})();

const FLAT = [
  { x: 0, y: 1280 },
  { x: 10_000, y: 1280 },
] as const;

const HEAD = ((): NonNullable<ReturnType<typeof playerHeadBoxes>> => {
  const head = playerHeadBoxes(RIG, TUNING.mode);
  if (head === null) throw new Error('the shipped rig cannot measure the player\'s head');
  return head;
})();

function expectBox(actual: TargetRect | undefined, expected: TargetRect): void {
  expect(actual).toBeDefined();
  expect(actual?.x ?? Number.NaN).toBeCloseTo(expected.x, 6);
  expect(actual?.y ?? Number.NaN).toBeCloseTo(expected.y, 6);
  expect(actual?.width ?? Number.NaN).toBeCloseTo(expected.width, 6);
  expect(actual?.height ?? Number.NaN).toBeCloseTo(expected.height, 6);
}

describe("the player's head, from the rig", () => {
  it('is measured in every mode the game declares, and faces the other way mirrored', () => {
    for (const mode of CONFIG.locomotionModes) {
      const head = playerHeadBoxes(RIG, mode);
      expect(head, mode).not.toBeNull();
      if (head === null) continue;
      expect(head.right.width, mode).toBeGreaterThan(0);
      expect(head.right.height, mode).toBeGreaterThan(0);
      expect(head.left, mode).toEqual({ ...head.right, x: -(head.right.x + head.right.width) });
    }
  });

  it("reaches down to wherever the mode's resting pose carries the head, as well as where it is authored", () => {
    const player = playerArtboard(RIG);
    expect(player, 'the rig has no player').not.toBeNull();
    if (player === null) return;

    let deepest = { mode: '', dy: 0 };
    for (const mode of CONFIG.locomotionModes) {
      for (const key of RIG.states[posePath(mode, RESTING_POSE)]?.keys ?? []) {
        const dy = key.parts['head']?.[1] ?? 0;
        if (dy > deepest.dy) deepest = { mode, dy };
      }
    }
    expect(deepest.dy, 'no mode rests with the head lowered, so this proves nothing').toBeGreaterThan(0);

    const authored = unionBox(figureBoxes(RIG, player.artboard, deepest.mode, { parts: HEAD_PARTS }) ?? []);
    const head = playerHeadBoxes(RIG, deepest.mode);
    expect(authored).not.toBeNull();
    expect(head).not.toBeNull();
    if (authored === null || head === null) return;
    expect(head.right.y + head.right.height, deepest.mode).toBeGreaterThan(authored.y + authored.height);
    expect(head.right.y, deepest.mode).toBeLessThanOrEqual(authored.y);
  });

  it('is not measured without a rig, or from a rig with no player in it', () => {
    expect(playerHeadBoxes(null, TUNING.mode)).toBeNull();
    const nobody: RigDocument = {
      ...RIG,
      artboards: RIG.artboards.filter((board) => board.playerSelectableSlots.length === 0),
    };
    expect(playerHeadBoxes(nobody, TUNING.mode)).toBeNull();
  });
});

describe('where the head is while a stop holds the player', () => {
  const slack = landingSlackPx(TUNING);

  it('level with a landmark: over the whole landing, travelling right and travelling left', () => {
    const boxes = restingHeadBoxes({ ground: FLAT, subjects: [{ id: 'hut', x: 2000 }], rig: RIG, tuning: TUNING, ride: null }).get('hut');
    expect(boxes).toHaveLength(2);
    expectBox(boxes?.[0], {
      x: 2000 - slack + HEAD.right.x,
      y: 1280 + HEAD.right.y,
      width: slack + HEAD.right.width,
      height: HEAD.right.height,
    });
    expectBox(boxes?.[1], {
      x: 2000 + HEAD.left.x,
      y: 1280 + HEAD.left.y,
      width: slack + HEAD.left.width,
      height: HEAD.left.height,
    });
  });

  it('beside a character: at the rest point each heading aims for', () => {
    const boxes = restingHeadBoxes({
      ground: FLAT,
      subjects: [{ id: 'guide', x: 2000, rest: { right: 1800, left: 2200 } }],
      rig: RIG,
      tuning: TUNING,
      ride: null,
    }).get('guide');
    expectBox(boxes?.[0], {
      x: 1800 - slack + HEAD.right.x,
      y: 1280 + HEAD.right.y,
      width: slack + HEAD.right.width,
      height: HEAD.right.height,
    });
    expectBox(boxes?.[1], {
      x: 2200 + HEAD.left.x,
      y: 1280 + HEAD.left.y,
      width: slack + HEAD.left.width,
      height: HEAD.left.height,
    });
  });

  it("on a ride: moved by the ride's seat, as the rider is drawn", () => {
    const car: Ride = {
      mode: TUNING.mode,
      art: [{ key: 'car-front', side: 'front' }],
      riderAnchor: { x: 380, y: 422 },
      groundLineY: 330,
      turnsWithRider: false,
      footprint: { x: 220, width: 400 },
    };
    const boxes = restingHeadBoxes({ ground: FLAT, subjects: [{ id: 'hut', x: 2000 }], rig: RIG, tuning: TUNING, ride: car }).get('hut');
    expect(boxes?.[0]?.y ?? Number.NaN).toBeCloseTo(1280 + 92 + HEAD.right.y, 6);
  });

  it('on a slope: from the higher ground under the landing to the lower', () => {
    const slope = [
      { x: 0, y: 1000 },
      { x: 4000, y: 2000 },
    ];
    const boxes = restingHeadBoxes({ ground: slope, subjects: [{ id: 'hut', x: 2000 }], rig: RIG, tuning: TUNING, ride: null }).get('hut');
    const high = groundYAt(slope, 2000 - slack);
    const low = groundYAt(slope, 2000);
    expect(low).toBeGreaterThan(high);
    expectBox(boxes?.[0], {
      x: 2000 - slack + HEAD.right.x,
      y: high + HEAD.right.y,
      width: slack + HEAD.right.width,
      height: low - high + HEAD.right.height,
    });
  });

  it('is nowhere for a mode that engages nothing, or a rig that cannot measure a head', () => {
    const subjects = [{ id: 'hut', x: 2000 }];
    expect(restingHeadBoxes({ ground: FLAT, subjects, rig: RIG, tuning: { ...TUNING, interaction: null }, ride: null }).size).toBe(0);
    expect(restingHeadBoxes({ ground: FLAT, subjects, rig: null, tuning: TUNING, ride: null }).size).toBe(0);
  });
});
