/**
 * One texture per WebGL batch, on every device.
 *
 * The player drew with holes on five levels: the background through the face
 * and legs, the torso in strips. Phaser 4.2.1 picks a batch's sampler with an
 * exact float comparison on an interpolated varying, and a fragment that
 * matches no index draws transparent. Unit 0 is the only index that compares
 * exactly, and one texture per batch puts every quad there. See
 * `app/adapters/phaser/texture-batching.ts` for the trace.
 */

import { describe, expect, it } from 'vitest';

import {
  TEXTURE_UNITS_PER_BATCH,
  pinTextureUnitsPerBatch,
  type ParallelTextureUnits,
} from '@adapters/phaser/texture-batching';

/** Phaser's `RenderNodeManager`, as far as this module can see it. */
function fakeNodes(start: number, clampTo?: number): ParallelTextureUnits & { readonly calls: number[] } {
  const calls: number[] = [];
  let value = start;
  return {
    calls,
    get maxParallelTextureUnits(): number {
      return value;
    },
    setMaxParallelTextureUnits(next: number): void {
      calls.push(next);
      value = clampTo ?? next;
    },
  };
}

describe('TEXTURE_UNITS_PER_BATCH', () => {
  it('is one, the only unit the batch shader compares exactly', () => {
    expect(TEXTURE_UNITS_PER_BATCH).toBe(1);
  });
});

describe('pinTextureUnitsPerBatch', () => {
  it('pins a desktop WebGL renderer, which Phaser gives sixteen, to one', () => {
    const renderNodes = fakeNodes(16);
    expect(pinTextureUnitsPerBatch({ renderNodes })).toBe(1);
    expect(renderNodes.calls).toEqual([1]);
  });

  it('leaves a renderer that already batches one texture alone, as a phone does', () => {
    const renderNodes = fakeNodes(1);
    expect(pinTextureUnitsPerBatch({ renderNodes })).toBe(1);
    expect(renderNodes.calls).toEqual([]);
  });

  it('reports what the renderer holds afterwards, not what it was asked for', () => {
    /* A renderer that kept its own number must be published as it is, or the
       probe would read healthy over the defect again. */
    const renderNodes = fakeNodes(16, 8);
    expect(pinTextureUnitsPerBatch({ renderNodes })).toBe(8);
  });

  it('answers null for a renderer with no batches to pin', () => {
    expect(pinTextureUnitsPerBatch(null)).toBeNull();
    expect(pinTextureUnitsPerBatch(undefined)).toBeNull();
    /* Phaser's Canvas renderer has no render nodes. */
    expect(pinTextureUnitsPerBatch({})).toBeNull();
    expect(pinTextureUnitsPerBatch({ renderNodes: null })).toBeNull();
    expect(pinTextureUnitsPerBatch({ renderNodes: { maxParallelTextureUnits: 16 } })).toBeNull();
    expect(
      pinTextureUnitsPerBatch({ renderNodes: { setMaxParallelTextureUnits: () => undefined } }),
    ).toBeNull();
  });
});
