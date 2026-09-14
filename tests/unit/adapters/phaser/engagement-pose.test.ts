/**
 * The engagement gesture a paused level froze on its first frame.
 *
 * Tapping a landmark fires the rig's `interact` trigger and, in the same frame,
 * the engagement opens a card and the level pauses. The puppet still updates
 * once in that frame, so the pose IS applied - but it enters `interact` at
 * elapsed 0, and every `interact` in the shipped rig starts on its rest key. The
 * paused scene never advances, so the reach (`train/interact`'s arm up to the
 * dome glass) was never on screen while the card was open. These tests pin both
 * halves: what the frozen frame used to show, and the hold that replaces it.
 *
 * Driven by the real `content/characters/rig.json`, as the renderer's own tests
 * are: the rig is the contract.
 */

import { describe, expect, it } from 'vitest';

import type { CharacterRendererSpec, RigDocument, RigState } from '@application/ports';
import { gestureHoldMs } from '@adapters/phaser/engagement-pose';
import { poseFor } from '@adapters/phaser/locomotion-pose';
import {
  createSpriteCharacterRenderer,
  partTransformAt,
  type SpritePartObject,
} from '@adapters/phaser/sprite-character-renderer';
import rigJson from '@content/characters/rig.json';
import { characterId } from '../../support/fixtures';

const RIG = rigJson as unknown as RigDocument;
const INTERACT = 'interact';
/** The part that makes the gesture in every shipped `interact`: the near hand. */
const REACHING_PART = 'hand-r';

/** The modes whose `interact` the rig draws: the base pose, and each mode that re-poses it. */
const interactModes: readonly (string | null)[] = [
  null,
  ...Object.keys(RIG.states)
    .filter((state) => state.endsWith(`/${INTERACT}`))
    .map((state) => state.slice(0, -`/${INTERACT}`.length)),
];

function stateOf(mode: string | null): RigState {
  const state = RIG.states[poseFor(RIG, mode, INTERACT)];
  if (state === undefined) throw new Error(`the rig has no interact pose for ${String(mode)}`);
  return state;
}

/** A sprite puppet over the real rig, recording the angle painted on one part. */
function puppet(mode: string | null): {
  renderer: Extract<ReturnType<typeof createSpriteCharacterRenderer>, { ok: true }>['value'];
  angle: () => number | null;
} {
  let angle: number | null = null;
  const frames = new Set(Object.keys(RIG.frames));
  const spec: CharacterRendererSpec = {
    characterId: characterId('player'),
    artboard: 'player',
    stateMachine: RIG.stateMachine.name,
    rig: RIG,
    skins: {},
    widthPx: RIG.characterSpace.width,
    heightPx: RIG.characterSpace.height,
  };
  const built = createSpriteCharacterRenderer(spec, {
    textureKey: 'characters',
    frames: { hasFrame: (_key, frame) => frames.has(frame) },
    ...(mode === null ? {} : { mode }),
    host: {
      createPart: (part): SpritePartObject => ({
        setTexture: () => undefined,
        setOrigin: () => undefined,
        setPosition: () => undefined,
        setAngle: (degrees) => {
          if (part.name === REACHING_PART) angle = degrees;
        },
        setFlipX: () => undefined,
        setDisplaySize: () => undefined,
        setDepth: () => undefined,
        setVisible: () => undefined,
        destroy: () => undefined,
      }),
    },
  });
  if (!built.ok) throw new Error(`expected a renderer, got ${built.error.code}`);
  return { renderer: built.value, angle: () => angle };
}

describe('the frame a paused engagement froze on', () => {
  it('has an interact pose to look at, for the base rig and for the ride mode', () => {
    expect(interactModes).toContain(null);
    expect(interactModes.length).toBeGreaterThan(1);
  });

  for (const mode of interactModes) {
    it(`${String(mode ?? 'base')}: entering interact draws the rest key, so a scene paused in that frame shows no gesture`, () => {
      const state = stateOf(mode);
      const first = state.keys[0];
      const last = state.keys.at(-1);
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      if (first === undefined || last === undefined) return;
      /* The gesture starts and ends at rest: key 0 and the last key agree. */
      expect(partTransformAt(state.keys, REACHING_PART, 0)).toEqual(
        partTransformAt(state.keys, REACHING_PART, 1),
      );

      const { renderer, angle } = puppet(mode);
      renderer.update(0);
      const resting = angle();
      renderer.fire(INTERACT);
      renderer.update(16);
      expect(renderer.pose).toBe(poseFor(RIG, mode, INTERACT));
      /* The defect, as a number: the first interact frame paints the rest angle. */
      expect(angle()).toBe(partTransformAt(state.keys, REACHING_PART, 0).rotation);
      expect(resting).not.toBeNull();
    });
  }
});

describe('gestureHoldMs', () => {
  for (const mode of interactModes) {
    it(`${String(mode ?? 'base')}: holds the reach, before the once state ends`, () => {
      const state = stateOf(mode);
      const hold = gestureHoldMs(RIG, mode, INTERACT);

      expect(hold).toBeGreaterThan(0);
      /* Strictly inside the state, so the trigger is still held and the selector
         keeps `interact` for whatever remains once the level resumes. */
      expect(hold).toBeLessThan(state.durationMs);
      expect(partTransformAt(state.keys, REACHING_PART, hold / state.durationMs)).not.toEqual(
        partTransformAt(state.keys, REACHING_PART, 0),
      );
    });

    it(`${String(mode ?? 'base')}: a puppet advanced by the hold paints the reach and is still interacting`, () => {
      const state = stateOf(mode);
      const { renderer, angle } = puppet(mode);
      renderer.fire(INTERACT);
      renderer.update(16);
      renderer.update(gestureHoldMs(RIG, mode, INTERACT));

      expect(renderer.pose).toBe(poseFor(RIG, mode, INTERACT));
      expect(angle()).not.toBe(partTransformAt(state.keys, REACHING_PART, 0).rotation);

      /* And the level resuming plays the rest of it out, back to rest. */
      renderer.update(state.durationMs);
      renderer.update(16);
      expect(renderer.pose).not.toBe(poseFor(RIG, mode, INTERACT));
    });
  }

  it('picks the key furthest from rest, not the first one after it', () => {
    const rig = {
      ...RIG,
      states: {
        ...RIG.states,
        [INTERACT]: {
          loop: 'once',
          durationMs: 1000,
          keys: [
            { t: 0, parts: { [REACHING_PART]: [0, 0, 0] } },
            { t: 0.25, parts: { [REACHING_PART]: [0, 0, -10] } },
            { t: 0.5, parts: { [REACHING_PART]: [0, 0, -40] } },
            { t: 1, parts: { [REACHING_PART]: [0, 0, 0] } },
          ],
        },
      },
    } as unknown as RigDocument;
    expect(gestureHoldMs(rig, null, INTERACT)).toBe(500);
  });

  it('is 0 where there is no gesture to hold', () => {
    const still = {
      ...RIG,
      states: {
        ...RIG.states,
        [INTERACT]: {
          loop: 'once',
          durationMs: 400,
          keys: [
            { t: 0, parts: { [REACHING_PART]: [0, 0, 5] } },
            { t: 1, parts: { [REACHING_PART]: [0, 0, 5] } },
          ],
        },
      },
    } as unknown as RigDocument;

    expect(gestureHoldMs(null, null, INTERACT)).toBe(0);
    expect(gestureHoldMs(undefined, 'train', INTERACT)).toBe(0);
    expect(gestureHoldMs(RIG, null, 'no-such-state')).toBe(0);
    /* A looping state has no end to hold before. */
    expect(gestureHoldMs(RIG, null, 'idle')).toBe(0);
    /* A once state whose keys never leave rest. */
    expect(gestureHoldMs(still, null, INTERACT)).toBe(0);
  });
});
