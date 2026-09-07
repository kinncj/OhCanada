# ADR-0008: Engine evaluation — stay on Three.js (WebGPU)

- Status: Accepted (2026-09-07)

## Context
The owner asked for "a proper 3D engine for the browser: beautiful, photo-realistic and performant" after seeing the slice-1 placeholder art. ADR-0001 chose Three.js and required an ADR before relitigating.

## Options considered
| Engine | Photoreal features | Payload / static hosting | Fit |
|---|---|---|---|
| **Three.js r185, WebGPURenderer + TSL** (current) | PBR, HDRI IBL, CSM shadows, GTAO, SSR, SSGI, TAA/TRAA, bloom, DoF, motion blur, colour grading — all as TSL nodes running on WebGPU and WebGL2 | ≈ 1 MB gzip core; static | Already integrated; largest ecosystem (three-mesh-bvh, loaders, KTX2/Draco/Meshopt) |
| Babylon.js 8 | Comparable PBR/IBL, SSR, SSAO2, TAA, Havok physics, node materials | ≈ 1.5–2 MB gzip; static | Strong alternative; would replace the rendering + physics adapters, no content/domain change. No fidelity gain over Three for our asset set |
| PlayCanvas engine | Good PBR/IBL, clustered lighting; editor is a hosted service | static OK | Smaller ecosystem for TSL-style custom post-processing |
| Unity WebGL / Unreal (Pixel Streaming) | Highest out-of-the-box fidelity | 30–150 MB payloads, WebGL-only (Unity) or needs streaming servers (Unreal); licensing | Violates the 25 MB initial budget and static-only hosting |

## Decision
Keep Three.js. Realism is decided by **assets and the lighting/post stack**, not by the engine label:
- Assets: photoscanned models and PBR texture sets from Poly Haven, rigged/animated humans from Quaternius (ADR-0007), KTX2 + Draco.
- Lighting: HDRI environment, physically based sun with cascaded shadow maps, night lamps.
- Post stack by preset: `medium` bloom + FXAA + grading; `high` adds GTAO + TAA; `ultra` adds screen-space reflections (SSR) and screen-space GI (SSGI) with denoise. `minimal` (phones/CI) renders directly with no post chain.
- Performance: fixed-step simulation, chunked instancing with two LODs, BVH raycasts, per-preset instance budgets, capped pixel ratio, boot benchmark.

Re-evaluate Babylon.js only if a release-critical WebGPU feature is blocked in Three (record in a new ADR).
