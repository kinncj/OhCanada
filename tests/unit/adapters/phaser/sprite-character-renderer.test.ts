/**
 * The sprite fallback's own rules — the ones that have no counterpart on the
 * Rive side and so cannot live in `character-renderer-swap.test.ts`.
 *
 * Everything a *caller* can observe is asserted there, against both backends.
 * What is here is the half that is this backend's business: which frame of which
 * clip is on which layer, what happens when the atlas has not been packed yet,
 * and the two structural facts that keep a character legible on a device with no
 * Filter pipeline.
 */

import { describe, expect, it } from 'vitest';

import type { CharacterRendererSpec } from '@application/ports';
import {
  DEFAULT_FPS,
  EXPRESSION_LAYER,
  IDLE_CLIP,
  MAX_CLIP_FRAMES,
  createSpriteCharacterRenderer,
  selectClip,
  spriteFrameName,
  type SpriteLayerObject,
} from '@adapters/phaser/sprite-character-renderer';
import { characterId, makeCharacter } from '../../support/fixtures';

const ATLAS = 'characters';

const rig = makeCharacter({
  id: characterId('officer'),
  artboard: 'officer',
  inputs: [
    { name: 'airborne', kind: 'bool' },
    { name: 'speed', kind: 'number' },
    { name: 'jump', kind: 'trigger' },
  ],
});

interface Painted {
  readonly index: number;
  readonly frames: string[];
  visible: boolean;
  flipped: boolean;
  destroyed: boolean;
}

function harness(
  hasFrame: (frame: string) => boolean,
  overrides: Partial<CharacterRendererSpec> = {},
): { renderer: ReturnType<typeof createSpriteCharacterRenderer>; layers: Painted[] } {
  const layers: Painted[] = [];
  const spec: CharacterRendererSpec = {
    characterId: rig.id,
    artboard: rig.artboard,
    stateMachine: rig.stateMachine,
    inputs: rig.inputs,
    slots: rig.slots,
    expressions: ['neutral', 'thinking'],
    skins: {},
    widthPx: 256,
    heightPx: 512,
    ...overrides,
  };

  const renderer = createSpriteCharacterRenderer(spec, {
    textureKey: ATLAS,
    frames: { hasFrame: (_key, frame) => hasFrame(frame) },
    host: {
      createLayer: (index): SpriteLayerObject => {
        const painted: Painted = {
          index,
          frames: [],
          visible: false,
          flipped: false,
          destroyed: false,
        };
        layers.push(painted);
        return {
          setTexture: (_key, frame) => painted.frames.push(frame),
          setVisible: (value) => (painted.visible = value),
          setFlipX: (value) => (painted.flipped = value),
          destroy: () => (painted.destroyed = true),
        };
      },
    },
  });

  return { renderer, layers };
}

/** Four frames per clip, which is what an atlas of a short cycle looks like. */
const fourFrames = (frame: string): boolean => /\/[0-3]$/u.test(frame);

function unwrap(result: ReturnType<typeof createSpriteCharacterRenderer>): NonNullable<
  Extract<ReturnType<typeof createSpriteCharacterRenderer>, { ok: true }>['value']
> {
  if (!result.ok) throw new Error(`expected a renderer, got ${result.error.code}`);
  return result.value;
}

describe('spriteFrameName', () => {
  it('is the five-part name the atlas is packed under', () => {
    expect(spriteFrameName('officer', 'coat', 'coat-red', 'idle', 0)).toBe(
      'officer/coat/coat-red/idle/0',
    );
    expect(spriteFrameName('officer', EXPRESSION_LAYER, 'thinking', 'speed', 11)).toBe(
      'officer/expression/thinking/speed/11',
    );
  });
});

describe('selectClip', () => {
  const inputs = rig.inputs;

  it('is idle when nothing is active', () => {
    expect(selectClip(inputs, new Map(), null)).toBe(IDLE_CLIP);
  });

  it('takes the first active input in the document order, so priority is content', () => {
    const values = new Map<string, boolean | number>([
      ['airborne', true],
      ['speed', 400],
    ]);
    expect(selectClip(inputs, values, null)).toBe('airborne');

    /* Reversed document, same values, other answer: the rig decided, not this code. */
    const reversed = [...inputs].reverse();
    expect(selectClip(reversed, values, null)).toBe('speed');
  });

  it('lets a fired trigger outrank every state', () => {
    const values = new Map<string, boolean | number>([['speed', 400]]);
    expect(selectClip(inputs, values, 'jump')).toBe('jump');
  });

  it('treats a zero number and a false bool as inactive', () => {
    const values = new Map<string, boolean | number>([
      ['airborne', false],
      ['speed', 0],
    ]);
    expect(selectClip(inputs, values, null)).toBe(IDLE_CLIP);
  });

  it('never selects a trigger by its value: a trigger has none', () => {
    const values = new Map<string, boolean | number>([['jump', true]]);
    expect(selectClip(inputs, values, null)).toBe(IDLE_CLIP);
  });
});

describe('the sprite renderer draws from the atlas', () => {
  it('gives every declared slot a layer, in the document order, plus a face on top', () => {
    const { layers } = harness(fourFrames);
    /* Three slots in the fixture, and the expression layer above them. */
    expect(layers).toHaveLength(rig.slots.length + 1);
    expect(layers.map((layer) => layer.index)).toEqual([0, 1, 2, 3]);
  });

  it('paints the idle clip before the first update, so a placed character is drawn', () => {
    const { layers } = harness(fourFrames);
    expect(layers[0]?.frames[0]).toBe('officer/skin/skin-1/idle/0');
    expect(layers[3]?.frames[0]).toBe('officer/expression/neutral/idle/0');
  });

  it('advances one frame per 1/fps of elapsed time and wraps at the clip length', () => {
    const { renderer, layers } = harness(fourFrames);
    const character = unwrap(renderer);
    const step = 1000 / DEFAULT_FPS;

    for (let frame = 0; frame < 5; frame += 1) character.update(step);

    const drawn = layers[0]?.frames ?? [];
    /* The first entry is the pre-update paint; the five after it are the updates. */
    expect(drawn.slice(1)).toEqual([
      'officer/skin/skin-1/idle/1',
      'officer/skin/skin-1/idle/2',
      'officer/skin/skin-1/idle/3',
      'officer/skin/skin-1/idle/0',
      'officer/skin/skin-1/idle/1',
    ]);
  });

  it('plays the clip the inputs select', () => {
    const { renderer, layers } = harness(fourFrames);
    const character = unwrap(renderer);

    character.setNumber('speed', 420);
    character.update(0);
    expect(layers[0]?.frames.at(-1)).toBe('officer/skin/skin-1/speed/0');
  });

  it('releases a fired trigger after the frame it played on', () => {
    const { renderer, layers } = harness(fourFrames);
    const character = unwrap(renderer);

    character.setNumber('speed', 420);
    character.fire('jump');
    character.update(0);
    expect(layers[0]?.frames.at(-1)).toBe('officer/skin/skin-1/jump/0');

    character.update(0);
    expect(layers[0]?.frames.at(-1)).toBe('officer/skin/skin-1/speed/0');
  });

  it('draws the swapped skin on the slot that owns it and leaves the others alone', () => {
    const { renderer, layers } = harness(fourFrames);
    const character = unwrap(renderer);

    character.setSkin('coat', 'coat-blue');
    expect(layers[1]?.frames.at(-1)).toBe('officer/coat/coat-blue/idle/0');
    expect(layers[0]?.frames.at(-1)).toBe('officer/skin/skin-1/idle/0');
  });

  it('draws the expression on the face layer', () => {
    const { renderer, layers } = harness(fourFrames);
    unwrap(renderer).setExpression('thinking');
    expect(layers[3]?.frames.at(-1)).toBe('officer/expression/thinking/idle/0');
  });

  it('honours a skin the caller chose over the slot fallback', () => {
    const { layers } = harness(fourFrames, { skins: { coat: 'coat-blue' } });
    expect(layers[1]?.frames[0]).toBe('officer/coat/coat-blue/idle/0');
  });

  it('mirrors rather than duplicating art, and only when the facing changes', () => {
    const { renderer, layers } = harness(fourFrames);
    const character = unwrap(renderer);

    character.setFacing('right');
    expect(layers.every((layer) => !layer.flipped)).toBe(true);

    character.setFacing('left');
    expect(layers.every((layer) => layer.flipped)).toBe(true);
  });

  it('destroys every layer on dispose', () => {
    const { renderer, layers } = harness(fourFrames);
    unwrap(renderer).dispose();
    expect(layers.every((layer) => layer.destroyed)).toBe(true);
  });
});

describe('the sprite renderer survives an atlas that is not there yet', () => {
  it('falls back to the idle clip when the selected one has no frames', () => {
    /* Only `idle` was packed — the state art is still being drawn. */
    const packed = (frame: string): boolean => frame.includes('/idle/') && /\/[0-1]$/u.test(frame);
    const { renderer, layers } = harness(packed);
    const character = unwrap(renderer);

    character.setNumber('speed', 420);
    character.update(0);
    expect(layers[0]?.frames.at(-1)).toBe('officer/skin/skin-1/idle/0');
  });

  it('hides a layer the atlas has nothing for, rather than throwing on the first frame', () => {
    const { layers } = harness(() => false);
    expect(layers.every((layer) => !layer.visible)).toBe(true);
    expect(layers.every((layer) => layer.frames.length === 0)).toBe(true);
  });

  it('stops probing a clip at the ceiling, so a pathological atlas is bounded', () => {
    let asked = 0;
    const { renderer } = harness(() => {
      asked += 1;
      return true;
    });
    unwrap(renderer).update(0);
    /* Four layers, and each stops asking at MAX_CLIP_FRAMES. */
    expect(asked).toBeLessThanOrEqual(MAX_CLIP_FRAMES * 4);
    expect(asked).toBeGreaterThan(0);
  });
});

describe('a character state on this path is shape, never colour', () => {
  /**
   * The structural half of ADR-0011's rule that every effect has a plain path,
   * applied to characters. Phaser's Canvas renderer has no Filter pipeline and
   * CLAUDE.md says colour is never the only signal, so a state distinguished by
   * a glow or a tint would simply not exist for a share of players.
   *
   * This is asserted against the *type* the renderer is allowed to touch rather
   * than against behaviour, because behaviour can only prove the tint that was
   * not used today. A `SpriteLayerObject` has no colour channel at all, so the
   * mistake cannot be written down.
   */
  it('can only address a layer through texture, mirror and visibility', () => {
    const seen = new Set<string>();
    const { renderer } = harness(fourFrames);
    const character = unwrap(renderer);

    /* Rebuild the harness through a Proxy that records every property the
       renderer reaches for on a layer. */
    const layers: SpriteLayerObject[] = [];
    const probe = createSpriteCharacterRenderer(
      {
        characterId: rig.id,
        artboard: rig.artboard,
        stateMachine: rig.stateMachine,
        inputs: rig.inputs,
        slots: rig.slots,
        expressions: ['neutral'],
        skins: {},
        widthPx: 256,
        heightPx: 512,
      },
      {
        textureKey: ATLAS,
        frames: { hasFrame: (_key, frame) => fourFrames(frame) },
        host: {
          createLayer: (): SpriteLayerObject => {
            const target: SpriteLayerObject = {
              setTexture: () => undefined,
              setFlipX: () => undefined,
              setVisible: () => undefined,
              destroy: () => undefined,
            };
            const proxied = new Proxy(target, {
              get(object, property, receiver) {
                if (typeof property === 'string') seen.add(property);
                return Reflect.get(object, property, receiver) as unknown;
              },
            });
            layers.push(proxied);
            return proxied;
          },
        },
      },
    );

    const probed = unwrap(probe);
    probed.setFacing('left');
    probed.setNumber('speed', 200);
    probed.update(16.7);
    probed.setSkin('coat', 'coat-blue');
    probed.setExpression('neutral');
    probed.dispose();
    character.dispose();

    expect([...seen].sort()).toEqual(['destroy', 'setFlipX', 'setTexture', 'setVisible']);
  });
});
