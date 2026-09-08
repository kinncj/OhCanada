/**
 * The swap, proven (slice 1 task 1.12: "swap proven by test").
 *
 * CLAUDE.md puts Rive behind `ICharacterRenderer` "with a sprite-sheet fallback
 * with identical slot names", and `docs/plan/slice-1.md` records the risk this
 * exists for: *"If ≤ 1.5 ms per character does not hold on an iPhone, the
 * sprite-sheet fallback ships and Rive waits. The `ICharacterRenderer` seam
 * exists so this is a swap, not a rewrite."*
 *
 * A seam that is only asserted about one implementation is not a seam. So every
 * case below is written **once** and run against **both** factories, out of one
 * `describe.each`, and the assertion is always the same shape: given the same
 * spec and the same calls, the two backends answer the same. Adding a backend
 * means adding a row to `BACKENDS`; nothing else in this file changes, and if
 * the new one disagrees about anything a caller can observe, it fails here
 * rather than on the device that fell back to it.
 *
 * The one thing deliberately *not* asserted as identical is the animation that
 * plays. The sprite backend derives a clip from the input values; the Rive
 * backend hands the values to a state machine an artist authored, which is the
 * whole reason a state machine exists. Requiring the same transitions of both
 * would be re-implementing the artboard in TypeScript — the drift this seam
 * exists to prevent, pointed the other way. What must be identical is the
 * *vocabulary*: slot names, option names, input names, expression names, and
 * every error code a caller can branch on.
 *
 * The adapters do not import each other (ADR-0005) and share no validation
 * module, so the duplicated spec checks in the two files are pinned here.
 */

import { describe, expect, it } from 'vitest';

import type {
  CharacterRendererFactory,
  CharacterRendererSpec,
  ICharacterRenderer,
} from '@application/ports';
import {
  createSpriteCharacterRendererFactory,
  type SpritePartObject,
} from '@adapters/phaser/sprite-character-renderer';
import {
  createRiveCharacterRendererFactory,
  type RiveInstance,
  type RiveInstanceRequest,
} from '@adapters/rive';
import type { RigDocument } from '@application/ports';
import rigJson from '@content/characters/rig.json';
import { characterId } from '../support/fixtures';

/**
 * The real rig, not a fixture.
 *
 * `content/characters/rig.json` is tracked content validated by
 * `make validate-content`, and it is the *only* source of the vocabulary both
 * backends answer from (ADR-0022). A hand-written rig here would prove the two
 * adapters agree with each other and not that either agrees with the game.
 */
const RIG = rigJson as unknown as RigDocument;

const ATLAS = 'characters';

const ATLAS_FRAMES = new Set(Object.keys(RIG.frames));
const SLOT_NAMES = Object.entries(RIG.slots)
  .filter(([, slot]) => slot.status !== 'reserved')
  .map(([name]) => name);

function makeSpec(overrides: Partial<CharacterRendererSpec> = {}): CharacterRendererSpec {
  return {
    characterId: characterId('officer'),
    artboard: 'officer',
    stateMachine: RIG.stateMachine.name,
    rig: RIG,
    skins: {},
    widthPx: RIG.characterSpace.width,
    heightPx: RIG.characterSpace.height,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* the two backends, behind the one factory port                              */
/* -------------------------------------------------------------------------- */

/**
 * A sprite atlas that has every frame anyone asks for.
 *
 * `hasFrame` returning true for the first four indices of any clip gives every
 * layer a four-frame cycle, which is enough for the frame-advance assertions
 * without pinning this test to an atlas nobody has packed yet.
 */
function spriteFactory(): CharacterRendererFactory {
  return createSpriteCharacterRendererFactory({
    textureKey: ATLAS,
    /* Every frame the rig declares is packed. `make assets` builds exactly
       these fifty, and `tests/e2e/level-art.spec.ts` is what checks that. */
    frames: { hasFrame: (_key, frame) => ATLAS_FRAMES.has(frame) },
    host: {
      createPart: (): SpritePartObject => ({
        setTexture: () => undefined,
        setOrigin: () => undefined,
        setPosition: () => undefined,
        setAngle: () => undefined,
        setFlipX: () => undefined,
        setDepth: () => undefined,
        setVisible: () => undefined,
        destroy: () => undefined,
      }),
    },
  });
}

/**
 * A Rive runtime that exposes exactly what the document declares.
 *
 * Not a mock of `@rive-app/canvas` — that package is bound in `rive-runtime.ts`
 * and has no decisions in it. This is the seam the adapter was written against,
 * standing in for a rig that honours its contract.
 */
function riveFactory(): CharacterRendererFactory {
  return createRiveCharacterRendererFactory({
    runtime: {
      instantiate: (request: RiveInstanceRequest): Promise<RiveInstance> => {
        const known = new Set(RIG.stateMachine.inputs.map((input) => input.name));
        return Promise.resolve({
          inputNames: [...known],
          setBool: (name) => known.has(name),
          setNumber: (name) => known.has(name),
          fire: (name) => known.has(name),
          setSkin: (slot, option) =>
            request.slots.some(
              (candidate) => candidate.name === slot && candidate.options.includes(option),
            ),
          setExpression: (expression) => request.expressions.includes(expression),
          setFacing: () => undefined,
          advance: () => undefined,
          destroy: () => undefined,
        });
      },
      disposeShared: () => undefined,
    },
  });
}

const BACKENDS: readonly (readonly [string, () => CharacterRendererFactory])[] = [
  ['sprite', spriteFactory],
  ['rive', riveFactory],
];

async function build(
  factory: CharacterRendererFactory,
  overrides: Partial<CharacterRendererSpec> = {},
): Promise<ICharacterRenderer> {
  const created = await factory.create(makeSpec(overrides));
  if (!created.ok) throw new Error(`expected a renderer, got ${created.error.code}`);
  return created.value;
}

/* -------------------------------------------------------------------------- */

describe.each(BACKENDS)('%s backend honours ICharacterRenderer', (_name, makeFactory) => {
  it('names itself as one of the two backends the port declares', () => {
    expect(['rive', 'sprite']).toContain(makeFactory().backend);
  });

  it('offers exactly the slots and options the rig declares', async () => {
    const renderer = await build(makeFactory());

    expect(renderer.skinSlots).toEqual(SLOT_NAMES);
    for (const name of SLOT_NAMES) {
      expect(renderer.skinOptions(name)).toEqual(
        RIG.slots[name as keyof typeof RIG.slots].options,
      );
    }
    /* A slot nobody declared offers nothing rather than throwing: tooling asks
       this question about names it read somewhere else. */
    expect(renderer.skinOptions('nonexistent')).toEqual([]);
  });

  it('reports the character id and artboard it was built for', async () => {
    const renderer = await build(makeFactory());
    expect(renderer.characterId).toBe(characterId('officer'));
    expect(renderer.artboard).toBe('officer');
    expect(renderer.surface.widthPx).toBe(RIG.characterSpace.width);
    expect(renderer.surface.heightPx).toBe(RIG.characterSpace.height);
    expect(renderer.surface.textureKey.length).toBeGreaterThan(0);
  });

  it('accepts every declared input at its declared kind', async () => {
    const renderer = await build(makeFactory());
    expect(renderer.setBool('grounded', true).ok).toBe(true);
    expect(renderer.setNumber('speed', 0.7).ok).toBe(true);
    expect(renderer.fire('jump').ok).toBe(true);
  });

  it('refuses an input the document does not declare, as not-found', async () => {
    const renderer = await build(makeFactory());
    for (const result of [
      renderer.setBool('sprint', true),
      renderer.setNumber('sprint', 1),
      renderer.fire('sprint'),
    ]) {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('not-found');
      expect(result.error.code).toBe('character.input.unknown');
    }
  });

  it('refuses a declared input addressed at the wrong kind', async () => {
    const renderer = await build(makeFactory());
    const result = renderer.setBool('speed', true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('character.input.wrongKind');
  });

  it('refuses a number that is not a number', async () => {
    const renderer = await build(makeFactory());
    const result = renderer.setNumber('speed', Number.NaN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('character.input.notFinite');
  });

  it('swaps a skin the slot offers and refuses one it does not', async () => {
    const renderer = await build(makeFactory());
    expect(renderer.setSkin('costume', 'parka').ok).toBe(true);

    const unknownOption = renderer.setSkin('costume', 'coat-gold');
    expect(unknownOption.ok).toBe(false);
    if (unknownOption.ok) return;
    expect(unknownOption.error.code).toBe('character.skin.unknown');

    const unknownSlot = renderer.setSkin('hat', 'parka');
    expect(unknownSlot.ok).toBe(false);
    if (unknownSlot.ok) return;
    expect(unknownSlot.error.code).toBe('character.slot.unknown');
  });

  it('sets a declared expression and refuses an undeclared one', async () => {
    const renderer = await build(makeFactory());
    expect(renderer.setExpression('thinking').ok).toBe(true);

    const result = renderer.setExpression('smug');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not-found');
    expect(result.error.code).toBe('character.expression.unknown');
  });

  it('refuses a skin the document does not offer at construction, before drawing anything', async () => {
    const created = await makeFactory().create(makeSpec({ skins: { costume: 'coat-gold' } }));
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('character.skin.unknown');
  });

  it('refuses a rig whose slot falls back to an option it does not have', async () => {
    const broken: RigDocument = {
      ...RIG,
      slots: { ...RIG.slots, costume: { ...RIG.slots.costume, fallback: 'tuxedo' } },
    };
    const created = await makeFactory().create(makeSpec({ rig: broken }));
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('character.rig.fallbackMissing');
  });

  it('refuses a rig with no parts and a surface with no area', async () => {
    const noParts = await makeFactory().create(makeSpec({ rig: { ...RIG, parts: [] } }));
    expect(noParts.ok).toBe(false);
    if (!noParts.ok) expect(noParts.error.code).toBe('character.rig.noParts');

    const noArea = await makeFactory().create(makeSpec({ widthPx: 0 }));
    expect(noArea.ok).toBe(false);
    if (!noArea.ok) expect(noArea.error.code).toBe('character.surface.empty');
  });

  it('survives being updated with a nonsense delta rather than corrupting its clock', async () => {
    const renderer = await build(makeFactory());
    expect(() => {
      renderer.update(Number.NaN);
      renderer.update(-16);
      renderer.update(16);
    }).not.toThrow();
  });

  it('is dead after dispose, and dispose is idempotent', async () => {
    const renderer = await build(makeFactory());
    renderer.dispose();
    renderer.dispose();

    const result = renderer.setBool('grounded', true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('conflict');
    expect(result.error.code).toBe('character.disposed');
  });

  it('states its own decoded-texture cost, whatever that cost is', async () => {
    const renderer = await build(makeFactory());
    const bytes = renderer.estimatedTextureBytes();
    expect(Number.isFinite(bytes)).toBe(true);
    expect(bytes).toBeGreaterThanOrEqual(0);
  });
});

/* -------------------------------------------------------------------------- */
/* the properties that are only visible when the two are compared             */
/* -------------------------------------------------------------------------- */

describe('the two backends are interchangeable', () => {
  it('answers the skin vocabulary identically, name for name', async () => {
    const [sprite, rive] = await Promise.all([build(spriteFactory()), build(riveFactory())]);

    expect(rive.skinSlots).toEqual(sprite.skinSlots);
    for (const slot of sprite.skinSlots) {
      expect(rive.skinOptions(slot)).toEqual(sprite.skinOptions(slot));
    }
  });

  it('reports the same error code for the same mistake', async () => {
    const sprite = await build(spriteFactory());
    const rive = await build(riveFactory());

    const codes = (renderer: ICharacterRenderer): readonly string[] =>
      [
        renderer.setBool('sprint', true),
        renderer.setNumber('speed', Number.POSITIVE_INFINITY),
        renderer.setSkin('hat', 'parka'),
        renderer.setSkin('costume', 'coat-gold'),
        renderer.setExpression('smug'),
      ].map((result) => (result.ok ? 'ok' : result.error.code));

    expect(codes(rive)).toEqual(codes(sprite));
  });

  it('charges texture memory differently, and that difference is the decision', async () => {
    const sprite = await build(spriteFactory());
    const rive = await build(riveFactory());

    /*
     * Not a style preference — this is the number the backend choice turns on.
     * The sprite atlas is a file, so `make check-textures` already weighs it and
     * charging it again per instance would count one page six times. A Rive
     * surface is sized by the *display*, ships in no file, and is therefore
     * invisible to that gate: 256x512x4 is 512 KiB a level's budget only knows
     * about because this method says so. Six characters is 3 MiB the asset
     * pipeline cannot see, on a level (Ottawa) already at 77% of the cap.
     */
    expect(sprite.estimatedTextureBytes()).toBe(0);
    expect(rive.estimatedTextureBytes()).toBe(
      RIG.characterSpace.width * RIG.characterSpace.height * 4,
    );
  });

  it('lets bootstrap choose between them through one variable', async () => {
    /* The whole risk, in four lines: the caller names neither backend and does
       not change when the answer changes. */
    for (const factory of [spriteFactory(), riveFactory()]) {
      const chosen: CharacterRendererFactory = factory;
      const renderer = await build(chosen);
      expect(renderer.setNumber('speed', 0.7).ok).toBe(true);
      renderer.update(16.7);
      renderer.dispose();
      chosen.disposeShared();
    }
  });
});
