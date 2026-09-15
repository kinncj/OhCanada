/**
 * How many textures one WebGL batch may choose between: one, on every device.
 *
 * ## The defect
 *
 * The player drew with holes in them. The background showed through the face
 * and the legs, the torso came apart in vertical strips, and the head separated
 * from the toque, on five levels and in every mode, while the other five drew
 * whole. Nothing in the scene was wrong. Read back from the running game, every
 * part carried the right frame, depth, angle, origin and scale. The atlas page
 * held whole art at every frame rectangle, and nothing drew between the parts
 * (`depth-plan.ts`). The same scene drew whole with one texture per batch.
 *
 * Phaser's quad batch can bind up to sixteen textures and tell each quad which
 * one to sample through a per-vertex number. Phaser 4.2.1's fragment shader
 * picks the sampler with `outTexDatum == float(INDEX)`, where `outTexDatum` is an
 * interpolated varying, and a fragment that matches no index draws
 * `vec4(0.0)`, which is transparent. Interpolating a constant across a triangle
 * is not exact arithmetic, so wherever the GPU's rounding moves the value off the
 * integer, that fragment of the part is simply not drawn. Which unit the
 * character atlas lands on is decided by how many other textures the same batch
 * met first, and in this game that is the landmarks and props drawn under the
 * characters. Traced on 2026-09-15 at build 4f74d41: the five broken levels put
 * the atlas on unit 3, and the five whole ones on unit 4. A level that gains or
 * loses a landmark changes the unit, which is why the defect followed content
 * commits and not engine ones.
 *
 * ## Why one unit
 *
 * Unit 0 is the one index the shader compares exactly: every vertex carries
 * `0.0`, and no weighting of zeros is anything but zero. With one texture per
 * batch every quad samples unit 0, and the shader is compiled without the
 * comparison at all (`TEXTURE_COUNT == 1`).
 *
 * It is also the path phones already take. Phaser's `autoMobileTextures`, on by
 * default, sets one unit per batch on any device that is not a desktop. So this
 * changes nothing on an iPhone or an Android phone, and moves desktops, iPads that
 * report a desktop browser and the headless audits onto the path those phones
 * run. The cost is a draw call per texture change instead of per batch, which on
 * a level is about six extra calls a frame, because every character part shares
 * one atlas and still batches.
 *
 * The limit is set through `RenderNodeManager.setMaxParallelTextureUnits`, not
 * the game config's `render.maxTextures`. The config value caps the renderer
 * itself, including shaders that need a second sampler at once. The manager's
 * limit is only the batch's choice between textures, and every batch handler,
 * including one built later, reads it.
 *
 * Pure and structural: no Phaser import. `game-renderer.ts` hands the live
 * renderer to {@link pinTextureUnitsPerBatch} at boot, and the probe publishes
 * the value read back, as `data-texture-units-per-batch`.
 */

/** The number of textures a batch may choose between. Unit 0 only. */
export const TEXTURE_UNITS_PER_BATCH = 1;

/** The slice of Phaser's `RenderNodeManager` this module reads and sets. */
export interface ParallelTextureUnits {
  readonly maxParallelTextureUnits: number;
  setMaxParallelTextureUnits(value: number): void;
}

function renderNodesOf(renderer: unknown): ParallelTextureUnits | null {
  if (typeof renderer !== 'object' || renderer === null) return null;
  const nodes = (renderer as { readonly renderNodes?: unknown }).renderNodes;
  if (typeof nodes !== 'object' || nodes === null) return null;
  const candidate = nodes as Partial<ParallelTextureUnits>;
  if (typeof candidate.setMaxParallelTextureUnits !== 'function') return null;
  if (typeof candidate.maxParallelTextureUnits !== 'number') return null;
  return candidate as ParallelTextureUnits;
}

/**
 * Pin the live renderer to {@link TEXTURE_UNITS_PER_BATCH}, and say what is in
 * force afterwards.
 *
 * Returns the limit **read back** from the renderer, never the constant, so a
 * renderer that clamped or ignored the request is published as it is. Returns
 * `null` for a renderer with no batches to pin: Phaser's Canvas renderer, or no
 * renderer at all.
 */
export function pinTextureUnitsPerBatch(renderer: unknown): number | null {
  const nodes = renderNodesOf(renderer);
  if (nodes === null) return null;
  if (nodes.maxParallelTextureUnits !== TEXTURE_UNITS_PER_BATCH) {
    nodes.setMaxParallelTextureUnits(TEXTURE_UNITS_PER_BATCH);
  }
  return nodes.maxParallelTextureUnits;
}
