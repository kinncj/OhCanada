/**
 * Why the player was a rectangle, stated as tests.
 *
 * `sprite-character-renderer.ts` had been written, measured and wired — for the
 * level's *placed* characters. The **player** was never in that path at all:
 * `#paintPlayer` drew `fillRoundedRect` unconditionally, and no counter covered
 * it, because `data-actors` is `pois.length + characters.length` and the player
 * is in neither list. So the one character on screen at the spawn was the one
 * nothing composed and nothing measured.
 *
 * Fixing it needs an answer to "which artboard is the player's", and that answer
 * may not be a literal in this directory — `level-is-data-only.test.ts` forbids
 * naming content, and it is right to. The rig already draws the distinction:
 * `RigArtboard.playerSelectableSlots` is documented as "slots the creator offers
 * for this artboard. **Empty is a real answer, and is what an NPC has**". So the
 * player's artboard is the one the character creator can dress, which is a fact
 * about the rig rather than a name the engine remembers.
 *
 * The second half is that a missing part must be **loud**. Every gap below used
 * to be a silent `return null` followed by a rounded rectangle, which is how a
 * placeholder ships twice.
 */

import { describe, expect, it } from 'vitest';

import type { RigArtboard, RigDocument } from '@application/ports';
import type { CharacterId } from '@domain/ids';

import {
  CAST_GAPS,
  artboardFor,
  castGapMessage,
  drivableInputs,
  playerArtboard,
  rigAtlasKey,
  unboundAnimationInputs,
} from '@adapters/phaser/character-cast';

import rigJson from '@content/characters/rig.json';

const shippedRig = rigJson as unknown as RigDocument;

const artboard = (
  id: string,
  playerSelectableSlots: readonly string[],
): RigArtboard => ({
  characterId: id as unknown as CharacterId,
  artboard: `${id}-board`,
  stateMachine: 'machine',
  skins: {},
  playerSelectableSlots,
});

const rigWith = (artboards: readonly RigArtboard[], frames: readonly string[]): RigDocument =>
  ({
    artboards,
    frames: Object.fromEntries(frames.map((name) => [name, { source: name, x: 0, y: 0, w: 1, h: 1 }])),
  }) as unknown as RigDocument;

describe('which artboard the player wears', () => {
  it('is the one the character creator can dress', () => {
    const rig = rigWith([artboard('a', []), artboard('b', ['skin', 'hairShape'])], []);
    expect(playerArtboard(rig)?.artboard).toBe('b-board');
  });

  it('is not an artboard that offers no choices, because that is what an NPC is', () => {
    const rig = rigWith([artboard('a', []), artboard('b', [])], []);
    expect(playerArtboard(rig)).toBeNull();
  });

  it('has no answer when no rig arrived, and says so rather than guessing', () => {
    expect(playerArtboard(null)).toBeNull();
    expect(playerArtboard(undefined)).toBeNull();
  });

  it('is settled by the shipped rig rather than by this test', () => {
    /**
     * The gate on the whole fix. If the rig ever stops declaring an artboard the
     * creator can dress, the player silently goes back to being a rectangle —
     * so the condition is asserted against the real document, here, once.
     */
    expect(
      playerArtboard(shippedRig),
      'content/characters/rig.json declares no artboard with player-selectable slots, so ' +
        'nothing in the rig identifies the player. Until one exists the player cannot be ' +
        'composed and the scene draws a placeholder — which is the defect this file is about.',
    ).not.toBeNull();
  });
});

describe('which artboard a placed character wears', () => {
  it('is matched by the id the level document places', () => {
    const rig = rigWith([artboard('officer-a', []), artboard('guide-b', [])], []);
    expect(artboardFor(rig, 'guide-b')?.artboard).toBe('guide-b-board');
  });

  it('is null for an id the rig has never heard of', () => {
    expect(artboardFor(rigWith([artboard('a', [])], []), 'b')).toBeNull();
    expect(artboardFor(null, 'a')).toBeNull();
  });
});

describe('which atlas the rig was packed into', () => {
  const rig = rigWith([], ['ch/head-a', 'ch/torso-a', 'ch/foot-a']);

  it('is the texture that actually carries the rig"s frames', () => {
    const packed = new Set(['shared:ch/torso-a']);
    const key = rigAtlasKey(rig, ['level-art', 'shared'], (texture, frame) =>
      packed.has(`${texture}:${frame}`),
    );
    expect(key).toBe('shared');
  });

  it('does not give up because the first frame in the document is the missing one', () => {
    /**
     * The version this replaces read `Object.keys(rig.frames)[0]` and asked one
     * question about it. A rig whose first frame is an option nobody packed —
     * a hair colour still in flight — answered "no atlas" for every character in
     * the game, and the game drew rectangles. Every frame is a candidate now.
     */
    const packed = new Set(['shared:ch/foot-a']);
    expect(
      rigAtlasKey(rig, ['shared'], (texture, frame) => packed.has(`${texture}:${frame}`)),
      'one unpacked frame at the top of the document turned off every character',
    ).toBe('shared');
  });

  it('is null when nothing loaded carries any of them', () => {
    expect(rigAtlasKey(rig, ['level-art'], () => false)).toBeNull();
    expect(rigAtlasKey(rig, [], () => true)).toBeNull();
    expect(rigAtlasKey(null, ['shared'], () => true)).toBeNull();
  });
});

describe('a gap is reported, never swallowed', () => {
  it('names the subject and what is missing, for every gap there is', () => {
    for (const gap of CAST_GAPS) {
      const message = castGapMessage('some-character', gap);
      expect(message).toContain('some-character');
      expect(message.length).toBeGreaterThan(40);
    }
  });

  it('produces a different sentence per gap, so a log says which one happened', () => {
    const messages = CAST_GAPS.map((gap) => castGapMessage('x', gap));
    expect(new Set(messages).size).toBe(CAST_GAPS.length);
  });
});

describe('what the scene may drive on a character', () => {
  const rigInputs = (
    inputs: readonly { name: string; type: 'bool' | 'number' | 'trigger' }[],
  ): RigDocument =>
    ({ artboards: [], frames: {}, stateMachine: { name: 'm', inputs } }) as unknown as RigDocument;

  it('offers only the inputs the rig declares, at the type the rig declares them', () => {
    const rig = rigInputs([
      { name: 'grounded', type: 'bool' },
      { name: 'speed', type: 'number' },
      { name: 'talking', type: 'bool' },
      /* Declared as the wrong type: driving it would be a per-frame error. */
      { name: 'moving', type: 'number' },
      /* Not something a scene can compute. */
      { name: 'somethingElse', type: 'bool' },
    ]);
    const driven = drivableInputs(rig);
    expect([...driven.bools].sort()).toEqual(['grounded', 'talking']);
    expect(driven.numbers).toEqual(['speed']);
  });

  it('offers nothing when there is no rig, instead of throwing on a frame', () => {
    expect(drivableInputs(null)).toEqual({ bools: [], numbers: [] });
  });

  it('is not empty for the shipped rig, or the player would stand still', () => {
    const driven = drivableInputs(shippedRig);
    expect(driven.bools.length + driven.numbers.length).toBeGreaterThan(0);
  });
});

describe('a level naming a rig input the rig does not have', () => {
  it('is reported by name rather than failing once per frame in a setter', () => {
    const rig = {
      artboards: [],
      frames: {},
      stateMachine: { name: 'm', inputs: [{ name: 'speed', type: 'number' }] },
    } as unknown as RigDocument;
    expect(unboundAnimationInputs(rig, ['speed', 'airborne', 'brake', 'airborne'])).toEqual([
      'airborne',
      'brake',
    ]);
  });

  it('reports nothing when there is no rig to disagree with', () => {
    expect(unboundAnimationInputs(null, ['anything'])).toEqual([]);
  });
});
