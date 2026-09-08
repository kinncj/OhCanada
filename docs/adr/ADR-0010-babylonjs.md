# ADR-0010: Move the rendering adapter to Babylon.js

- Status: Accepted (2026-09-07)
- Supersedes the renderer half of ADR-0002 and revises ADR-0008.

## Context
ADR-0001 named Babylon.js the strongest alternative and set the trigger: adopt it "only if Three's WebGPU path blocks a release-critical feature". That trigger has been met. On the owner's iPhone the game does not render: first a black canvas with a live HUD, then loads that never complete. Four real defects were found and fixed from screenshots alone (Safari advertising WebGPU while Three's WebGPU backend draws nothing, un-culled vegetation, a shared district load reporting no progress, alpha dropped in texture compression), and the device still fails.

The deciding factor is not capability, it is **verifiability**: WebKit cannot be run on the development machine (missing system libraries, and browser automation is off-limits on the owner's laptop), so every Three fix has been reasoned from photographs instead of reproduced. Continuing to guess against an unreproducible target is worse engineering than moving to the stack with the widest first-party iOS coverage, which is the owner's explicit decision.

## Decision
Replace `app/adapters/rendering/*` with a Babylon.js 9 adapter behind the same ports.
- **Engine**: `@babylonjs/core` on WebGL2. Babylon's WebGL2 renderer is its default, most-tested path on Safari and iOS; WebGPU stays available but is not the default anywhere.
- **Post-processing**: `DefaultRenderingPipeline` (tone mapping, bloom, FXAA, vignette, colour grading) — one well-trodden pipeline instead of hand-assembled TSL nodes.
- **Sky and lighting**: `SkyMaterial` dome, directional sun with a cascaded shadow generator, hemispheric fill, exponential fog.
- **Assets**: glTF via `@babylonjs/loaders` with the Draco decoder Babylon ships locally. **KTX2 is dropped**: Babylon fetches its KTX2 transcoders from a CDN by default, which ADR-0005 forbids, so `make assets` now emits **WebP** textures. This also removes KTX2 transcoding — itself a suspect in the iOS stalls.
- **Vegetation**: thin instances (`thinInstanceSetBuffer`), still chunked with the per-preset draw distance and LOD from ADR-0007.
- **Characters**: glTF skeletons and animation groups, with the procedural humanoid retained as the fallback.

Unchanged: domain, application, UI, content, physics (Rapier), audio, i18n, persistence, and the whole asset pipeline apart from texture format. That is the layering from ADR-0004 paying for itself — the swap is confined to one adapter directory plus the composition root.

## Consequences
- Effects with no direct Babylon equivalent in this pass (screen-space GI, TRAA) are dropped; SSAO and SSR remain available through Babylon's own pipelines if wanted later.
- Textures cost more GPU memory as WebP than as KTX2; the per-preset instance and draw-distance budgets already account for the difference.
- Bundle size grows (Babylon core is larger than Three), which is measured against the 25 MB initial-payload budget in `make test-perf`.
- If iOS still fails after this, the fault is not in the rendering framework, and the next step is a device-attached debugging session rather than another rewrite.
