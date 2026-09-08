/**
 * The Rive backend's own rules — what happens at the boundary between the
 * character document and the `.riv` the artist exported.
 *
 * Everything a caller can observe is asserted for both backends in
 * `tests/unit/adapters/character-renderer-swap.test.ts`. What is here is the
 * half the sprite backend has no counterpart for: a runtime that fails to start,
 * a file that does not carry the inputs the document promised, and a rig whose
 * artboard has drifted from the document since the build-time check ran.
 *
 * The runtime is a fake, and deliberately not a mock of `@rive-app/canvas`:
 * `rive-runtime.ts` is the binding to that package and contains no decisions, so
 * mocking the package would be testing Rive rather than testing this adapter.
 * The seam is `RiveRuntime`, which is what the adapter was written against.
 */

import { describe, expect, it, vi } from 'vitest';

import type { CharacterRendererSpec } from '@application/ports';
import {
  createRiveCharacterRendererFactory,
  defaultTextureKeyFor,
  type RiveInstance,
  type RiveInstanceRequest,
} from '@adapters/rive';
import type { RigDocument } from '@application/ports';
import rigJson from '@content/characters/rig.json';
import { characterId } from '../../support/fixtures';

/** The real rig: both backends read their vocabulary out of it (ADR-0022). */
const RIG = rigJson as unknown as RigDocument;
const INPUT_NAMES = RIG.stateMachine.inputs.map((input) => input.name);
const SLOT_NAMES = Object.entries(RIG.slots)
  .filter(([, slot]) => slot.status !== 'reserved')
  .map(([name]) => name);

const spec: CharacterRendererSpec = {
  characterId: characterId('officer'),
  artboard: 'officer',
  stateMachine: RIG.stateMachine.name,
  rig: RIG,
  skins: {},
  widthPx: RIG.characterSpace.width,
  heightPx: RIG.characterSpace.height,
};

interface FakeInstance extends RiveInstance {
  readonly advances: number[];
  readonly skins: [string, string][];
  readonly facings: ('left' | 'right')[];
  destroyed: boolean;
}

function fakeInstance(exposed: readonly string[], refuse: ReadonlySet<string> = new Set()): FakeInstance {
  const known = new Set(exposed);
  const instance: FakeInstance = {
    inputNames: [...known],
    advances: [],
    skins: [],
    facings: [],
    destroyed: false,
    setBool: (name) => known.has(name) && !refuse.has(name),
    setNumber: (name) => known.has(name) && !refuse.has(name),
    fire: (name) => known.has(name) && !refuse.has(name),
    setSkin: (slot, option) => {
      instance.skins.push([slot, option]);
      return !refuse.has(slot);
    },
    setExpression: (expression) => !refuse.has(expression),
    setFacing: (facing) => instance.facings.push(facing),
    advance: (seconds) => instance.advances.push(seconds),
    destroy: () => {
      instance.destroyed = true;
    },
  };
  return instance;
}

function factoryFor(
  instantiate: (request: RiveInstanceRequest) => Promise<RiveInstance>,
  disposeShared = (): void => undefined,
) {
  return createRiveCharacterRendererFactory({ runtime: { instantiate, disposeShared } });
}

describe('the Rive backend and the rig contract', () => {
  it('publishes each character under its own surface key', () => {
    expect(defaultTextureKeyFor(spec)).toBe('rive:officer');
  });

  it('asks the runtime for the artboard, the state machine and the slot vocabulary', async () => {
    let seen: RiveInstanceRequest | null = null;
    const factory = factoryFor((request) => {
      seen = request;
      return Promise.resolve(fakeInstance(INPUT_NAMES));
    });

    const created = await factory.create(spec);
    expect(created.ok).toBe(true);

    const request = seen as RiveInstanceRequest | null;
    expect(request?.artboard).toBe('officer');
    expect(request?.stateMachine).toBe(RIG.stateMachine.name);
    expect(request?.widthPx).toBe(RIG.characterSpace.width);
    /* Order is part of the contract: a rig that encodes an option as an index
       encodes this one, so a reordered document is a different rig. */
    expect(request?.slots.map((slot) => slot.name)).toEqual(SLOT_NAMES);
    expect(request?.slots.find((slot) => slot.name === 'costume')?.options).toEqual(
      RIG.slots.costume.options,
    );
    expect(request?.expressions).toEqual(RIG.expressions.names);
  });

  it('refuses a rig that does not expose an input the document declares', async () => {
    const instance = fakeInstance(INPUT_NAMES.filter((name) => name !== 'jump'));
    const created = await factoryFor(() => Promise.resolve(instance)).create(spec);

    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('character.rig.inputsMissing');
    expect(created.error.details?.['missing']).toEqual(['jump']);
    /* The half-built instance is released rather than leaked: a failed create
       must not leave a canvas and a state machine alive. */
    expect(instance.destroyed).toBe(true);
  });

  it('reports a runtime that will not start as io, which is what makes the fallback possible', async () => {
    const created = await factoryFor(() =>
      Promise.reject(new Error('wasm did not load')),
    ).create(spec);

    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.kind).toBe('io');
    expect(created.error.code).toBe('character.rive.instantiateFailed');
    expect(created.error.cause).toBeInstanceOf(Error);
  });

  it('dresses the character before the first frame, from the rig’s own fallbacks', async () => {
    const instance = fakeInstance(INPUT_NAMES);
    await factoryFor(() => Promise.resolve(instance)).create({
      ...spec,
      skins: { costume: 'parka' },
    });

    /* Every non-reserved slot is set once, the caller's choice wins over the
       artboard's, and the artboard's wins over the slot fallback. */
    expect(instance.skins.map(([slot]) => slot)).toEqual(SLOT_NAMES);
    expect(instance.skins.find(([slot]) => slot === 'costume')?.[1]).toBe('parka');
  });

  it('advances in seconds, not milliseconds', async () => {
    const instance = fakeInstance(INPUT_NAMES);
    const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
    if (!created.ok) throw new Error(created.error.code);

    created.value.update(16.7);
    expect(instance.advances).toEqual([0.0167]);
  });

  it('does not advance a disposed character, and destroys the instance once', async () => {
    const instance = fakeInstance(INPUT_NAMES);
    const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
    if (!created.ok) throw new Error(created.error.code);

    created.value.dispose();
    created.value.dispose();
    created.value.update(16.7);
    created.value.setFacing('left');

    expect(instance.advances).toEqual([]);
    expect(instance.facings).toEqual([]);
    expect(instance.destroyed).toBe(true);
  });

  it('mirrors through the runtime rather than duplicating art', async () => {
    const instance = fakeInstance(INPUT_NAMES);
    const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
    if (!created.ok) throw new Error(created.error.code);

    created.value.setFacing('left');
    expect(instance.facings).toEqual(['left']);
  });

  /**
   * The case a build-time rig check cannot catch: the `.riv` was re-exported
   * after `make verify-art` ran, and the document now describes a rig that no
   * longer exists. The document said the name was fine; the artboard said no.
   * A caller must not have to know which side refused, so the code is the same.
   */
  describe('when the loaded artboard disagrees with the document', () => {
    it('reports an input the runtime refuses as not-found, naming the artboard', async () => {
      const instance = fakeInstance(INPUT_NAMES, new Set(['speed']));
      const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
      if (!created.ok) throw new Error(created.error.code);

      const result = created.value.setNumber('speed', 0.7);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('character.input.unknown');
      expect(result.error.details?.['artboard']).toBe('officer');
    });

    it('reports a slot the runtime refuses as an unknown skin', async () => {
      const instance = fakeInstance(INPUT_NAMES, new Set(['costume']));
      const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
      if (!created.ok) throw new Error(created.error.code);

      const result = created.value.setSkin('costume', 'parka');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('character.skin.unknown');
      expect(result.error.details?.['artboard']).toBe('officer');
    });

    it('reports an expression the runtime refuses as unknown, naming the artboard', async () => {
      const instance = fakeInstance(INPUT_NAMES, new Set(['thinking']));
      const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
      if (!created.ok) throw new Error(created.error.code);

      const result = created.value.setExpression('thinking');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('character.expression.unknown');
      expect(result.error.details?.['artboard']).toBe('officer');
    });

    it('reports a trigger the runtime refuses', async () => {
      const instance = fakeInstance(INPUT_NAMES, new Set(['jump']));
      const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
      if (!created.ok) throw new Error(created.error.code);

      const result = created.value.fire('jump');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('character.input.unknown');
    });

    it('reports a bool the runtime refuses', async () => {
      const instance = fakeInstance(INPUT_NAMES, new Set(['grounded']));
      const created = await factoryFor(() => Promise.resolve(instance)).create(spec);
      if (!created.ok) throw new Error(created.error.code);

      expect(created.value.setBool('grounded', true).ok).toBe(false);
    });
  });

  it('passes disposeShared through to the runtime, so a level unload drops the file bytes', () => {
    const disposeShared = vi.fn();
    factoryFor(() => Promise.resolve(fakeInstance([])), disposeShared).disposeShared();
    expect(disposeShared).toHaveBeenCalledOnce();
  });

  it('charges the offscreen surface against the level budget, because no asset gate can', async () => {
    const created = await factoryFor(() =>
      Promise.resolve(fakeInstance(INPUT_NAMES)),
    ).create(spec);
    if (!created.ok) throw new Error(created.error.code);

    /* Character space in RGBA, held by a character that ships in no file and is
       therefore invisible to `make check-textures` — `scripts/assets.mjs`
       records `decodedBytes: 0` for a `.riv`. This method is the only place a
       level's texture budget can learn about it. */
    expect(created.value.estimatedTextureBytes()).toBe(
      RIG.characterSpace.width * RIG.characterSpace.height * 4,
    );
    expect(created.value.surface.textureKey).toBe('rive:officer');
  });
});
