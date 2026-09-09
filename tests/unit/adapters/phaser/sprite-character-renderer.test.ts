/**
 * The puppet's own rules — the half that has no counterpart on the Rive side,
 * where an artboard does this work.
 *
 * Everything a *caller* can observe is asserted for both backends in
 * `tests/unit/adapters/character-renderer-swap.test.ts`. What is here is how
 * twenty cut-out parts become a character: which frame each part resolves to,
 * where it is placed, what it rotates about, how a state is chosen and how a
 * keyframe is interpolated.
 *
 * Driven by the **real** `content/characters/rig.json` throughout. A fixture rig
 * would prove this file self-consistent; the rig is the contract, it is tracked
 * content validated by `make validate-content`, and both backends read their
 * whole vocabulary out of it (ADR-0022).
 */

import { describe, expect, it } from 'vitest';

import type { CharacterRendererSpec, RigDocument, RigPart } from '@application/ports';
import {
  IDLE_STATE,
  RUN_THRESHOLD,
  createSpriteCharacterRenderer,
  partTransformAt,
  phaseOf,
  resolveFrameTemplate,
  selectState,
  type SpritePartObject,
} from '@adapters/phaser/sprite-character-renderer';
import rigJson from '@content/characters/rig.json';
import { characterId } from '../../support/fixtures';

const RIG = rigJson as unknown as RigDocument;
const ATLAS = 'characters';
const FRAMES = new Set(Object.keys(RIG.frames));

interface Painted {
  readonly part: RigPart;
  frame: string | null;
  origin: [number, number] | null;
  position: [number, number] | null;
  angle: number | null;
  flipped: boolean;
  depth: number | null;
  destroyed: boolean;
}

function harness(
  overrides: Partial<CharacterRendererSpec> = {},
  packed: (frame: string) => boolean = (frame) => FRAMES.has(frame),
): {
  renderer: ReturnType<typeof createSpriteCharacterRenderer>;
  parts: Painted[];
} {
  const parts: Painted[] = [];
  const spec: CharacterRendererSpec = {
    characterId: characterId('officer'),
    artboard: 'officer',
    stateMachine: RIG.stateMachine.name,
    rig: RIG,
    skins: {},
    widthPx: RIG.characterSpace.width,
    heightPx: RIG.characterSpace.height,
    ...overrides,
  };

  const renderer = createSpriteCharacterRenderer(spec, {
    textureKey: ATLAS,
    frames: { hasFrame: (_key, frame) => packed(frame) },
    host: {
      createPart: (part): SpritePartObject => {
        const painted: Painted = {
          part,
          frame: null,
          origin: null,
          position: null,
          angle: null,
          flipped: false,
          depth: null,
          destroyed: false,
        };
        parts.push(painted);
        return {
          setTexture: (_key, frame) => (painted.frame = frame),
          setOrigin: (x, y) => (painted.origin = [x, y]),
          setPosition: (x, y) => (painted.position = [x, y]),
          setAngle: (degrees) => (painted.angle = degrees),
          setFlipX: (flip) => (painted.flipped = flip),
          setDepth: (depth) => (painted.depth = depth),
          setVisible: () => undefined,
          destroy: () => (painted.destroyed = true),
        };
      },
    },
  });

  return { renderer, parts };
}

function unwrap(
  result: ReturnType<typeof createSpriteCharacterRenderer>,
): Extract<typeof result, { ok: true }>['value'] {
  if (!result.ok) throw new Error(`expected a renderer, got ${result.error.code}`);
  return result.value;
}

/** The parts still alive after the last `dress()`, in draw order. */
const live = (parts: Painted[]): Painted[] => parts.filter((part) => !part.destroyed);

describe('resolveFrameTemplate', () => {
  it('fills every brace from the character’s choices', () => {
    const chosen = new Map([
      ['hairShape', 'curly'],
      ['hairColour', 'black'],
    ]);
    expect(resolveFrameTemplate('hair-{hairShape}-{hairColour}', chosen)).toBe('hair-curly-black');
  });

  it('passes a template with no braces straight through', () => {
    expect(resolveFrameTemplate('ground-shadow', new Map())).toBe('ground-shadow');
  });

  it('resolves to nothing when a brace names something unchosen', () => {
    /* Which is how every "none" option works — `head-covering-none` is a frame
       that does not exist, and the part draws nothing with no special case in
       either backend. */
    expect(resolveFrameTemplate('hat-{costume}', new Map())).toBeNull();
  });
});

describe('selectState', () => {
  const context = (
    values: Record<string, boolean | number>,
    pending: string | null = null,
  ): Parameters<typeof selectState>[1] => ({
    value: (name) => values[name],
    pending,
  });

  it('is idle when nothing is happening', () => {
    expect(selectState(RIG.selector.rules, context({ grounded: true }))).toBe(IDLE_STATE);
  });

  it('walks below the run threshold and runs at or above it', () => {
    const walking = { grounded: true, moving: true, speed: RUN_THRESHOLD - 0.01 };
    const running = { grounded: true, moving: true, speed: RUN_THRESHOLD };
    expect(selectState(RIG.selector.rules, context(walking))).toBe('walk');
    expect(selectState(RIG.selector.rules, context(running))).toBe('run');
  });

  it('splits rising from falling while airborne, and outranks moving', () => {
    const airborne = { grounded: false, moving: true, speed: 1 };
    expect(selectState(RIG.selector.rules, context({ ...airborne, verticalSpeed: 0.5 }))).toBe(
      'jump-rise',
    );
    expect(selectState(RIG.selector.rules, context({ ...airborne, verticalSpeed: -0.5 }))).toBe(
      'jump-fall',
    );
  });

  it('lets a fired trigger outrank every state, in the rig’s order', () => {
    const busy = { grounded: false, moving: true, speed: 1, talking: true };
    expect(selectState(RIG.selector.rules, context(busy, 'interact'))).toBe('interact');
    expect(selectState(RIG.selector.rules, context({ grounded: true }, 'land'))).toBe('land');
  });

  it('suppresses the landing flourish under reduced motion, as the rig asks', () => {
    /* `reducedMotion` is an input, not a setting the renderer reads — the port
       is explicit that the renderer never reads settings itself. */
    expect(
      selectState(RIG.selector.rules, context({ grounded: true, reducedMotion: true }, 'land')),
    ).toBe(IDLE_STATE);
  });

  it('is first-match-wins in the document’s order, so priority is content', () => {
    const reversed = [...RIG.selector.rules].reverse();
    /* The same values, the rules the other way up, a different answer: the rig
       decided, not this code. */
    expect(selectState(reversed, context({ grounded: true, talking: true }))).toBe(IDLE_STATE);
    expect(selectState(RIG.selector.rules, context({ grounded: true, talking: true }))).toBe('talk');
  });
});

describe('partTransformAt', () => {
  const walk = RIG.states['walk'];

  it('reads a keyframe exactly at its own t', () => {
    const at = partTransformAt(walk?.keys ?? [], 'arm-upper-r', 0.25);
    /* The third slot is rotation: `arm-upper-r` swings -26 degrees at a quarter
       of the walk cycle. See `partTransformAt`'s comment for how the tuple order
       was settled — the two documents disagree and the data decides. */
    expect(at.rotation).toBeCloseTo(-26, 5);
    expect(at.dx).toBe(0);
  });

  it('interpolates between the surrounding keys', () => {
    const at = partTransformAt(walk?.keys ?? [], 'arm-upper-r', 0.125);
    expect(at.rotation).toBeCloseTo(-13, 5);
  });

  it('leaves a part the state never mentions at rest', () => {
    expect(partTransformAt(walk?.keys ?? [], 'ground-shadow', 0.5)).toEqual({
      dx: 0,
      dy: 0,
      rotation: 0,
    });
  });

  it('clamps a t outside 0..1 rather than extrapolating a limb off its body', () => {
    const keys = walk?.keys ?? [];
    expect(partTransformAt(keys, 'arm-upper-r', -1)).toEqual(partTransformAt(keys, 'arm-upper-r', 0));
    expect(partTransformAt(keys, 'arm-upper-r', 9)).toEqual(partTransformAt(keys, 'arm-upper-r', 1));
  });

  it('is at rest with no keys at all', () => {
    expect(partTransformAt([], 'torso', 0.5)).toEqual({ dx: 0, dy: 0, rotation: 0 });
  });
});

describe('phaseOf', () => {
  it('wraps a looping state', () => {
    expect(phaseOf('loop', 450, 900)).toBeCloseTo(0.5, 5);
    expect(phaseOf('loop', 1350, 900)).toBeCloseTo(0.5, 5);
  });

  it('stops on the last key for once and hold', () => {
    expect(phaseOf('once', 1800, 900)).toBe(1);
    expect(phaseOf('hold', 1800, 900)).toBe(1);
  });

  it('is 0 for a state with no duration, rather than dividing by it', () => {
    expect(phaseOf('loop', 100, 0)).toBe(0);
  });
});

describe('the puppet composes a character from the rig', () => {
  it('draws one part per resolvable template, in the rig’s z order', () => {
    const { parts } = harness();
    const drawn = live(parts);

    expect(drawn.length).toBeGreaterThan(10);
    const depths = drawn.map((part) => part.depth ?? 0);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
    expect(drawn.map((part) => part.part.z)).toEqual(drawn.map((part) => part.part.z).sort((a, b) => a - b));
  });

  it('dresses an NPC from the artboard the rig ships, without being told', () => {
    const { parts } = harness();
    /* The officer's artboard entry says `costume: serge`. Nobody passed it. */
    const torso = live(parts).find((part) => part.part.name === 'torso');
    expect(torso?.frame).toBe('character-torso-serge');
  });

  it('takes the caller’s choice over the artboard’s', () => {
    const { parts } = harness({ skins: { costume: 'parka' } });
    expect(live(parts).find((part) => part.part.name === 'torso')?.frame).toBe(
      'character-torso-parka',
    );
  });

  it('omits a part whose resolved frame the atlas does not carry', () => {
    /* "A part whose resolved template is not in `frames` draws nothing." That is
       every "none" option, and it is also what keeps a half-packed atlas from
       throwing on the first frame. */
    const { parts } = harness({}, (frame) => FRAMES.has(frame) && !frame.includes('hair'));
    expect(live(parts).some((part) => part.part.name === 'hair')).toBe(false);
    expect(live(parts).some((part) => part.part.name === 'torso')).toBe(true);
  });

  it('puts the rotation origin on the pivot, measured against the window as placed', () => {
    const { renderer, parts } = harness();
    unwrap(renderer).setPosition(500, 1200);
    const space = RIG.characterSpace;

    /* An unmirrored part: the pivot's fraction of its own frame window. */
    const torso = live(parts).find((part) => part.part.name === 'torso');
    const torsoWindow = RIG.frames[torso?.frame ?? ''];
    expect(torso?.origin?.[0]).toBeCloseTo(
      ((torso?.part.pivot[0] ?? 0) - (torsoWindow?.x ?? 0)) / (torsoWindow?.w ?? 1),
      5,
    );

    /*
     * A mirrored part, which is the case that shipped a detached arm.
     *
     * `arm-upper-r` and `arm-upper-l` share one frame — arms are symmetric about
     * `centreX`, so the rig mirrors the far one — and that frame's window is
     * stated for the arm it was drawn for. Measuring the right arm's pivot
     * against the *unreflected* window gives `(60 - 166) / 41`, which is -2.6,
     * and drew the limb two and a half of its own widths off the body.
     */
    const arm = live(parts).find((part) => part.part.name === 'arm-upper-r');
    const armWindow = RIG.frames[arm?.frame ?? ''];
    expect(arm?.part.mirrorX, 'the fixture stopped exercising the mirrored case').toBe(true);
    const reflectedLeft = 2 * space.centreX - ((armWindow?.x ?? 0) + (armWindow?.w ?? 0));
    expect(arm?.origin?.[0]).toBeCloseTo(
      ((arm?.part.pivot[0] ?? 0) - reflectedLeft) / (armWindow?.w ?? 1),
      5,
    );
    expect(arm?.origin?.[0] ?? -1).toBeGreaterThanOrEqual(0);
    expect(arm?.origin?.[0] ?? 2).toBeLessThanOrEqual(1);
  });

  it('anchors the character on the ground between its feet', () => {
    const { renderer, parts } = harness();
    unwrap(renderer).setPosition(500, 1200);

    const shadow = live(parts).find((part) => part.part.name === 'ground-shadow');
    const space = RIG.characterSpace;
    expect(shadow?.position?.[0]).toBeCloseTo(500 + (space.centreX - space.centreX), 5);
    expect(shadow?.position?.[1]).toBeCloseTo(1200 + ((shadow?.part.pivot[1] ?? 0) - space.soleY), 5);
  });

  it('mirrors the composite about the character’s centre when it faces left', () => {
    const { renderer, parts } = harness();
    const character = unwrap(renderer);
    character.setPosition(500, 1200);

    const head = (): Painted | undefined => live(parts).find((part) => part.part.name === 'arm-upper-r');
    const rightFacing = head()?.position?.[0] ?? 0;
    character.setFacing('left');
    const leftFacing = head()?.position?.[0] ?? 0;

    /* Reflected about the anchor, and the part's own `mirrorX` composes with the
       composite flip rather than fighting it — one frame serves both arms. */
    expect(leftFacing - 500).toBeCloseTo(-(rightFacing - 500), 5);
    expect(head()?.flipped).toBe(head()?.part.mirrorX !== true);
  });

  it('animates: the same part is somewhere else a quarter of a walk later', () => {
    const { renderer, parts } = harness();
    const character = unwrap(renderer);
    character.setPosition(500, 1200);
    character.setBool('grounded', true);
    character.setBool('moving', true);
    character.setNumber('speed', 0.3);

    const arm = (): Painted | undefined => live(parts).find((part) => part.part.name === 'arm-upper-r');
    character.update(0);
    const atRest = arm()?.angle ?? 0;
    character.update((RIG.states['walk']?.durationMs ?? 900) / 4);
    const quarter = arm()?.angle ?? 0;

    expect(quarter).not.toBeCloseTo(atRest, 3);
    expect(quarter).toBeCloseTo(-26, 3);
  });

  it('re-dresses on a skin change without leaking the parts it replaced', () => {
    const { renderer, parts } = harness();
    const before = parts.length;
    expect(unwrap(renderer).setSkin('costume', 'parka').ok).toBe(true);

    expect(parts.length).toBeGreaterThan(before);
    expect(parts.slice(0, before).every((part) => part.destroyed)).toBe(true);
    expect(live(parts).find((part) => part.part.name === 'torso')?.frame).toBe(
      'character-torso-parka',
    );
  });

  it('changes the face without touching the body', () => {
    const { renderer, parts } = harness();
    expect(unwrap(renderer).setExpression('thinking').ok).toBe(true);
    expect(live(parts).find((part) => part.part.name === 'face')?.frame).toBe(
      'character-face-thinking',
    );
  });

  it('destroys every part on dispose', () => {
    const { renderer, parts } = harness();
    unwrap(renderer).dispose();
    expect(parts.every((part) => part.destroyed)).toBe(true);
  });
});

describe('a character state is shape, never colour', () => {
  /**
   * The structural half of ADR-0011's "every effect has a plain path", applied
   * to characters. Canvas has no Filter pipeline and CLAUDE.md says colour is
   * never the only signal, so a state distinguished by a glow or a tint would
   * simply not exist for a share of players.
   *
   * Asserted against the *type* the renderer may touch rather than against
   * behaviour, because behaviour can only ever prove the tint that was not used
   * today. A `SpritePartObject` has no colour channel at all, so the mistake
   * cannot be written down.
   */
  it('can only address a part through texture, transform, mirror and visibility', () => {
    const seen = new Set<string>();
    const parts: SpritePartObject[] = [];

    const built = createSpriteCharacterRenderer(
      {
        characterId: characterId('officer'),
        artboard: 'officer',
        stateMachine: RIG.stateMachine.name,
        rig: RIG,
        skins: {},
        widthPx: RIG.characterSpace.width,
        heightPx: RIG.characterSpace.height,
      },
      {
        textureKey: ATLAS,
        frames: { hasFrame: (_key, frame) => FRAMES.has(frame) },
        host: {
          createPart: (): SpritePartObject => {
            const target: SpritePartObject = {
              setTexture: () => undefined,
              setOrigin: () => undefined,
              setPosition: () => undefined,
              setAngle: () => undefined,
              setFlipX: () => undefined,
              setDepth: () => undefined,
              setVisible: () => undefined,
              destroy: () => undefined,
            };
            const proxied = new Proxy(target, {
              get(object, property, receiver) {
                if (typeof property === 'string') seen.add(property);
                return Reflect.get(object, property, receiver) as unknown;
              },
            });
            parts.push(proxied);
            return proxied;
          },
        },
      },
    );

    const character = unwrap(built);
    character.setPosition(400, 1200);
    character.setFacing('left');
    character.setBool('moving', true);
    character.setNumber('speed', 0.9);
    character.update(16.7);
    character.setSkin('costume', 'parka');
    character.setExpression('happy');
    character.dispose();

    expect([...seen].sort()).toEqual([
      'destroy',
      'setAngle',
      'setDepth',
      'setFlipX',
      'setOrigin',
      'setPosition',
      'setTexture',
      'setVisible',
    ]);
  });

  it('gives every expression a distinct frame, so the four differ as shape', () => {
    const frames = RIG.expressions.names.map((name) =>
      resolveFrameTemplate('face-{expression}', new Map([['expression', name]])),
    );
    expect(new Set(frames).size).toBe(RIG.expressions.names.length);
    for (const frame of frames) {
      expect(FRAMES.has(`${RIG.atlas.framePrefix}${String(frame)}`)).toBe(true);
    }
  });
});

/**
 * An empty puppet is a failure, not a character.
 *
 * `dress()` skips a part whose resolved frame is not in the atlas, and that is
 * right — it is how every "none" option works with no special case. Skipping
 * *every* part is a different fact: the atlas was not packed, or was packed for
 * a different rig, and what the scene got back was a renderer that reported
 * itself built, updated happily sixty times a second and drew nothing at all.
 *
 * That is the exact shape of the defect this whole line of work exists to
 * remove — a fallback nothing can observe — so it is refused at construction and
 * the caller draws a placeholder it can count.
 */
describe('a character with no parts is refused rather than returned empty', () => {
  it('reports which atlas held nothing, instead of composing a ghost', () => {
    const { renderer, parts } = harness({}, () => false);
    expect(renderer.ok).toBe(false);
    if (renderer.ok) return;
    expect(renderer.error.code).toBe('character.atlas.noParts');
    expect(renderer.error.message).toContain(ATLAS);
    expect(parts, 'a refused character must not leave part objects behind').toEqual([]);
  });

  it('still builds when only some of the rig is packed, because that is a real skin', () => {
    /* One part is enough to be a character being dressed; zero is an empty
       atlas. The line between them is the whole point. */
    const dressed = harness();
    const one = live(dressed.parts)[0]?.frame;
    expect(one, 'the fully packed harness dressed nothing, so this proves nothing').toBeTruthy();
    const { renderer } = harness({}, (frame) => frame === one);
    expect(renderer.ok).toBe(true);
  });
});

describe('repainting is skipped when nothing moved', () => {
  it('does not re-place twenty parts for a position it is already at', () => {
    const { renderer, parts } = harness();
    const character = unwrap(renderer);
    character.setPosition(500, 900);
    const placed = live(parts).map((part) => part.position);
    for (const part of live(parts)) part.position = null;

    character.setPosition(500, 900);
    expect(
      live(parts).map((part) => part.position),
      'a standing NPC repainted every part every time the scene mentioned its position',
    ).toEqual(live(parts).map(() => null));

    character.setPosition(501, 900);
    expect(live(parts).map((part) => part.position)).not.toEqual(placed.map(() => null));
  });
});
