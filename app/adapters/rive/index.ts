/**
 * The Rive adapter's public surface, for `app/bootstrap` and for nothing else.
 *
 * `character-renderer.ts` is pure and has no dependency on `@rive-app/canvas`;
 * `rive-runtime.ts` is the binding that does, and it is **not** re-exported
 * here. Bootstrap imports it with a dynamic `import()` so the 450 kB runtime is
 * fetched only on a build that chose the Rive backend — the initial payload
 * budget is 8 MB and a backend that may not ship must not be on the boot path.
 */

export {
  createRiveCharacterRendererFactory,
  defaultTextureKeyFor,
  type RiveCharacterRendererOptions,
  type RiveInstance,
  type RiveInstanceRequest,
  type RiveRuntime,
} from './character-renderer';
