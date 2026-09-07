# ADR-0002: Renderer and post-processing

- Status: Accepted (2026-09-07)

## Context
The fidelity target is high-fidelity stylized realism: PBR, HDRI image-based lighting, cascaded shadow maps, SSAO, bloom, TAA (FXAA fallback), colour grading, fog, day/night and weather. It must work on WebGPU and on WebGL2 fallback machines, including headless CI (SwiftShader).

## Decision
- `THREE.WebGPURenderer`; when `navigator.gpu` is missing or adapter creation fails, Three falls back to its WebGL2 backend automatically (`GameRenderer.backend` reports which one is active).
- All post-processing is built from TSL nodes (`RenderPipeline` + `pass`, `bloom`, `ao` (GTAO), `fxaa`, `traa`). WebGL-only libraries (`postprocessing`, `EffectComposer`) are not used.
- Shadows: `DirectionalLight` with `CSMShadowNode` when the preset has ≥ 2 cascades.
- Environment: Poly Haven HDRI as `scene.environment` and `scene.background`; sun direction/colour, fog and intensities are driven by a time-of-day value (full cycle 10 minutes).
- Graphics presets (`low`/`medium`/`high`/`ultra`) live in `game.config.json`; `auto` runs a 2 s benchmark on first boot and stores the result in `localStorage` (`truenorth.benchmark.v1`).
- Reduced motion disables bloom and camera bob.

## Consequences
- Headless Chromium uses SwiftShader: frame-rate gates are informational there; real budgets are measured on the reference configs (docs/runbook.md).
- Draw calls are kept low with chunked `InstancedMesh` vegetation (two LOD levels toggled per chunk).
