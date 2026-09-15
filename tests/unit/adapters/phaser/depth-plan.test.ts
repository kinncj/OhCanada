/**
 * Where everything in a level draws, front to back, and the defect that made it
 * a module.
 *
 * On Toronto the player on the bicycle drew scrambled: the torso came off the
 * hips, both mitts sat in front of the coat hem, somebody else's hair showed
 * under the red toque and a green shape lay over the face. The rig was not at
 * fault — rendered offline, `bike/*` is correct — and neither was the pose
 * arithmetic: read back from the live scene, every part carried the angle and
 * the position its keyframe asks for. What was wrong was the **order**.
 *
 * Every non-player character drew its parts at `500 + z` and the player at
 * `501 + z`, so the two ranges were one depth apart and interleaved. Dumped from
 * the deployed build with the player at rest on the guide (ADR-0032 stops a
 * drive level with the thing it engages, so this is where every drive ends):
 * the guide's head-shell at 519 drew over the player's head at 518, the guide's
 * near arm at 524 over the player's toque at 522, the guide's torso at 516 over
 * the player's neck at 516. Two puppets shuffled together. Every level with a
 * character in it did the same the moment the player stopped there.
 *
 * So the depths are a plan, and the plan's one promise is asserted here: **no
 * drawn thing sits between the first and last part of a character it is not
 * part of.** Stated against the real rig and every real level, so a rig that
 * grows a part or a level that places a tenth character is checked on the day
 * it happens.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { RigDocument } from '@application/ports';
import {
  DEPTH_ACTORS,
  DEPTH_GROUND,
  DEPTH_GROUND_DRESSING,
  DEPTH_LAYERS,
  DEPTH_RIDE_TRACK,
  DEPTH_SKY,
  depthPlan,
  interleavedDepths,
  partDepthRange,
  type DepthPlan,
} from '@adapters/phaser/depth-plan';
import rigJson from '@content/characters/rig.json';

const RIG = rigJson as unknown as RigDocument;
const PART_Z = RIG.parts.map((part) => part.z);

const LEVELS_DIR = fileURLToPath(new URL('../../../../content/levels', import.meta.url));

interface LevelDoc {
  readonly id: string;
  readonly layers: readonly unknown[];
  readonly pois: readonly unknown[];
  readonly characters: readonly unknown[];
  readonly locomotion: readonly { readonly mode: string }[];
  readonly rides?: readonly {
    readonly mode: string;
    readonly art: readonly { readonly side: 'behind' | 'front' }[];
    readonly track?: unknown;
  }[];
}

const levels: readonly LevelDoc[] = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${LEVELS_DIR}/${name}`, 'utf8')) as LevelDoc);

/** One drawn thing and the depth the plan gives it, named for the failure message. */
interface Drawn {
  readonly owner: string;
  readonly depth: number;
}

/**
 * Everything a level scene draws, at the depths the plan gives it — the same
 * calls `level-scene.ts` makes, one entry per object.
 */
function everythingDrawn(level: LevelDoc, plan: DepthPlan): readonly Drawn[] {
  const drawn: Drawn[] = [
    { owner: 'sky', depth: plan.sky },
    { owner: 'haze', depth: plan.haze },
    { owner: 'ground', depth: plan.ground },
    { owner: 'sheen', depth: plan.sheen },
    { owner: 'ground dressing', depth: plan.groundDressing },
    { owner: 'ride track', depth: plan.rideTrack },
    { owner: 'snow', depth: plan.snow },
    { owner: 'affordance', depth: plan.affordance },
  ];
  level.layers.forEach((_layer, index) => drawn.push({ owner: `layer ${String(index)}`, depth: plan.layer(index) }));
  level.pois.forEach((_poi, index) => drawn.push({ owner: `poi ${String(index)}`, depth: plan.poi }));
  plan.characters.forEach((band, index) => {
    for (const z of PART_Z) drawn.push({ owner: `character ${String(index)}`, depth: band.baseDepth + z });
  });
  for (const z of PART_Z) drawn.push({ owner: 'player', depth: plan.player.baseDepth + z });
  const ride = (level.rides ?? []).find((candidate) => candidate.mode === level.locomotion[0]?.mode);
  for (const layer of ride?.art ?? []) {
    drawn.push({ owner: `ride ${layer.side}`, depth: layer.side === 'behind' ? plan.rideBehind : plan.rideFront });
  }
  return drawn;
}

describe('depthPlan', () => {
  it('keeps the bands the scene has always had, back to front', () => {
    const plan = depthPlan({ characters: 1, partZ: PART_Z });
    expect(plan.sky).toBe(DEPTH_SKY);
    expect(plan.layer(0)).toBe(DEPTH_LAYERS);
    expect(plan.haze).toBeLessThan(plan.layer(0));
    expect(plan.ground).toBe(DEPTH_GROUND);
    expect(plan.groundDressing).toBe(DEPTH_GROUND_DRESSING);
    expect(plan.rideTrack).toBe(DEPTH_RIDE_TRACK);
    expect(plan.poi).toBeLessThan(DEPTH_ACTORS);
    expect(plan.poi).toBeGreaterThan(plan.rideTrack);
    expect(plan.affordance).toBeGreaterThan(plan.rideFront);
    expect(plan.snow).toBeGreaterThan(plan.affordance);
  });

  it('draws the ground dressing over the fill and its sheen, and under the ride track and every actor (ADR-0042)', () => {
    const plan = depthPlan({ characters: 2, partZ: PART_Z });
    expect(plan.sheen).toBeGreaterThan(plan.ground);
    expect(plan.groundDressing).toBeGreaterThan(plan.sheen);
    expect(plan.rideTrack).toBeGreaterThan(plan.groundDressing);
    expect(plan.poi).toBeGreaterThan(plan.rideTrack);
    const [first] = plan.characters;
    expect(first, 'the plan placed no band for the first character').toBeDefined();
    if (first === undefined) return;
    expect(partDepthRange(first, PART_Z).first).toBeGreaterThan(plan.groundDressing);
  });

  it('gives a character and the player ranges that do not interleave — the Toronto defect', () => {
    /* The old arithmetic, for the record: NPC 500 + z and player 501 + z. With
       the rig's z running 1..27 that is 501..527 against 502..528, which share
       26 depths. */
    const plan = depthPlan({ characters: 1, partZ: PART_Z });
    const [guide] = plan.characters;
    expect(guide, 'the plan placed no band for the one character').toBeDefined();
    if (guide === undefined) return;

    const npc = partDepthRange(guide, PART_Z);
    const player = partDepthRange(plan.player, PART_Z);
    expect(
      npc.last,
      `the character's parts run ${String(npc.first)}..${String(npc.last)} and the player's ` +
        `${String(player.first)}..${String(player.last)}; overlapping ranges draw two puppets shuffled together`,
    ).toBeLessThan(player.first);
  });

  it('stacks any number of characters without one reaching into the next, or into the player', () => {
    const plan = depthPlan({ characters: 12, partZ: PART_Z });
    const ranges = [...plan.characters, plan.player].map((band) => partDepthRange(band, PART_Z));
    for (let index = 1; index < ranges.length; index += 1) {
      expect(ranges[index]?.first ?? 0).toBeGreaterThan(ranges[index - 1]?.last ?? Infinity);
    }
  });

  it("puts the player's ride around the player and above every other character", () => {
    const plan = depthPlan({ characters: 3, partZ: PART_Z });
    const player = partDepthRange(plan.player, PART_Z);
    const lastCharacter = partDepthRange(plan.characters.at(-1) ?? plan.player, PART_Z);
    expect(plan.rideBehind).toBeLessThan(player.first);
    expect(plan.rideBehind).toBeGreaterThan(lastCharacter.last);
    expect(plan.rideFront).toBeGreaterThan(player.last);
  });

  it('answers for a rig whose z does not start at 1, and for none at all', () => {
    const shifted = depthPlan({ characters: 2, partZ: [-3, 0, 7] });
    const ranges = [...shifted.characters, shifted.player].map((band) => partDepthRange(band, [-3, 0, 7]));
    expect(ranges[0]?.first ?? 0).toBeGreaterThan(shifted.poi);
    expect(ranges[1]?.first ?? 0).toBeGreaterThan(ranges[0]?.last ?? Infinity);
    expect(ranges[2]?.first ?? 0).toBeGreaterThan(ranges[1]?.last ?? Infinity);

    const empty = depthPlan({ characters: 0, partZ: [] });
    expect(empty.characters).toEqual([]);
    expect(empty.affordance).toBeGreaterThan(empty.rideFront);
  });
});

describe('interleavedDepths', () => {
  it('counts what sits strictly inside a range it is not part of', () => {
    const groups = [
      { owner: 'a', depths: [501, 510, 527] },
      { owner: 'b', depths: [502, 520, 528] },
    ];
    /* Both of b's first two depths lie inside a's range, and both of a's last
       two inside b's: four intruders, which is the shape of the shipped defect. */
    expect(interleavedDepths(groups, [])).toBe(4);
  });

  it('counts a loose object — a layer, a prop — inside a character', () => {
    expect(interleavedDepths([{ owner: 'a', depths: [10, 20] }], [15, 9, 21])).toBe(1);
  });

  it('is 0 for groups that only touch end to end, and for ties with the ends', () => {
    expect(
      interleavedDepths(
        [
          { owner: 'a', depths: [1, 5] },
          { owner: 'b', depths: [6, 9] },
        ],
        [5, 6],
      ),
    ).toBe(0);
  });

  it('is 0 for a character with no parts left, whatever else is drawn', () => {
    /* A character whose parts were all destroyed has no range to intrude on,
       and must not count every other object as inside one. */
    expect(interleavedDepths([{ owner: 'a', depths: [] }], [1, 2, 3])).toBe(0);
  });
});

describe('no level draws anything between the parts of a character', () => {
  it('has levels with characters to check, so this is not a pass over nothing', () => {
    expect(levels.some((level) => level.characters.length > 0)).toBe(true);
    expect(PART_Z.length).toBeGreaterThan(1);
  });

  for (const level of levels) {
    it(`${level.id}: every character's parts are contiguous in the draw order`, () => {
      const plan = depthPlan({ characters: level.characters.length, partZ: PART_Z });
      const drawn = everythingDrawn(level, plan);
      const owners = [...new Set(drawn.map((entry) => entry.owner))].filter(
        (owner) => owner === 'player' || owner.startsWith('character '),
      );

      for (const owner of owners) {
        const own = drawn.filter((entry) => entry.owner === owner).map((entry) => entry.depth);
        const first = Math.min(...own);
        const last = Math.max(...own);
        const intruders = drawn.filter(
          (entry) => entry.owner !== owner && entry.depth >= first && entry.depth <= last,
        );
        expect(
          intruders.map((entry) => `${entry.owner}@${String(entry.depth)}`),
          `${level.id}: ${owner} draws its parts at ${String(first)}..${String(last)}, and these draw ` +
            'between them, so the character is shuffled with whatever they are',
        ).toEqual([]);
      }
    });
  }
});
