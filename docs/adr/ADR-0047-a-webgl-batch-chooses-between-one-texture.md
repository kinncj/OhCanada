# ADR-0047: A WebGL batch chooses between one texture, on every device

- Status: Accepted (2026-09-15)
- Slice: A5 (character bodies, second live-site audit of 2026-09-15).
- Builds on: ADR-0011 (the visual tier), ADR-0033 (the atlas page), ADR-0031 (a ride is level art).

## Context

A second live-site audit at 390 × 844 and DPR 3, on build 4f74d41, photographed the player drawn with
holes in them on five levels: Québec City, Toronto, Vancouver, Winnipeg and The North. The background showed
through the face and legs, the torso came apart in vertical strips, the head separated from the toque, and the
glasses drew as a flat band. It happened in every mode, including standing still. Ottawa, Halifax, Peggy's Cove,
the Prairies and Alberta drew whole. The scene probe read `data-parts-interleaved=0` and `data-mode-gaps=0`.

Each suspect was checked against the running scene and the built files:

| suspect | finding |
|---|---|
| Depth slots (`depth-plan.ts`) | Player parts at 532..559 on every level. No layer, strip, track or other object inside the range, and no depth inversion in the display list. |
| Part transforms | Toronto and Winnipeg carry the same frames, origins, scales and angles as Halifax and Alberta. |
| Atlas art and trim | The torso, legs, head and glasses frames, cut out of the built `shared@2x` page at their JSON rectangles, are whole. `feature-glasses` is glasses. |
| Atlas scale | Toronto is broken at DPR 1 on the `@1x` page too. |
| The commits after 2d7a5f3 | Toronto is already broken at 2d7a5f3 on the same headless browser. |

One experiment separated whole from broken. Building the same commit with one texture per batch drew Toronto and
Winnipeg whole.

**The cause is in Phaser 4.2.1's quad batch.** A batch binds up to `maxParallelTextureUnits` textures, 16 on a
desktop, and each vertex carries the unit its quad samples. `GetTexture.glsl` chooses the sampler with
`outTexDatum == float(INDEX)`. `outTexDatum` is an interpolated `varying float`, and a fragment that matches no
index returns `vec4(0.0)`, which is transparent. Interpolating a constant across a triangle is not exact
arithmetic, so the fragments where the GPU's rounding moves it off the integer draw nothing.

Which unit the character atlas takes is decided by how many textures the same batch met first, which in this game
is the landmarks and props drawn under the characters. Traced from `drawElements` on every level:

| `shared` atlas on | levels | drawn |
|---|---|---|
| unit 3 | Québec City, Toronto, Vancouver, Winnipeg, The North | broken |
| unit 4 | Ottawa, Halifax, Peggy's Cove, the Prairies, Alberta | whole |

The measured rule is that unit 3 broke and unit 4 did not on this renderer. The ride art on unit 5 drew whole
too, so this record does not claim a rule for other units or other GPUs. The claim it rests on is narrower:
**unit 0 is the only index the shader compares exactly on every GPU**, because every vertex carries `0.0`.

This is why the defect followed content, not engine code. Toronto went from one landmark texture to three on
2026-09-13 (bf59d55), and the other four broken levels reached three stops in the content commits of the same
day. Phones never showed it: Phaser's `autoMobileTextures`, on by default, already gives any device that is not a
desktop one texture per batch.

## Decision

1. **One texture per batch, on every device.** At `postBoot`, before the first frame, `game-renderer.ts` calls
   `pinTextureUnitsPerBatch`, in `texture-batching.ts`, which calls
   `RenderNodeManager.setMaxParallelTextureUnits(1)`. Every quad then samples unit 0, and the batch shader is
   compiled with `TEXTURE_COUNT == 1`, which has no comparison at all.
2. **Through the render node manager, not `render.maxTextures`.** The config value caps the renderer, including
   shaders that need a second sampler at once. The manager's limit is only the batch's choice between textures,
   and every batch handler reads it, including one built later (`BatchHandler` calls
   `updateTextureCount(manager.maxParallelTextureUnits)`).
3. **The probe publishes the renderer's read-back** as `data-texture-units-per-batch`: `1` on a healthy build,
   `unknown` on a renderer with no batches. `tests/e2e/level-character-depth.spec.ts` asserts `1` on all ten
   levels. CI's Chromium runs SwiftShader WebGL, which read 16 before this change.

## Consequences

- **Draw calls.** A batch breaks at each texture change instead of every sixteen textures. Toronto went from 6
  quad draw calls a frame to 12. Every character part shares one atlas, so the cast still draws in one call.
  No perf lane budgets draw calls. The overdraw and texture-memory lanes are unaffected, because the pixels
  drawn and the textures held are the same.
- **Phones:** no change. Desktop, iPads that report a desktop browser, and headless audits now run the path phones
  already run.
- **A level is still data.** Adding a landmark can no longer move the character atlas to a unit the shader
  misreads, so no level document has to count its textures.
- **Upstream.** The comparison is a Phaser defect. If a later Phaser rounds `outTexDatum`, or passes it `flat`
  under WebGL 2, the pin can be lifted by a new ADR, and that change must re-run this trace on all ten levels.
