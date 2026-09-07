# ADR-0001: Technology stack

- Status: Accepted (2026-09-07)
- Deciders: architecture

## Context
TrueNorth is a browser game deployed to GitHub Pages (static hosting only, no backend, 100 MB per-file and ~1 GB repo limits, no Git LFS serving). It must run in current Chrome, Edge, Firefox and Safari, reach 60 fps on a mid-range discrete GPU and 30 fps on integrated GPUs, and be fully testable in CI.

## Decision
| Concern | Choice |
|---|---|
| Language | TypeScript 5.9, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any` in `domain/` or `application/` (ESLint rule) |
| Build | Vite 8 (Rolldown), `base` read from `content/game.config.json` |
| Rendering | Three.js r185 `WebGPURenderer` with automatic WebGL2 fallback; post-processing through TSL nodes only (see ADR-0002) |
| Physics | `@dimforge/rapier3d-compat` 0.20 (kinematic character controller, static colliders, heightfield terrain) |
| Spatial | `three-mesh-bvh` for accelerated raycasts (camera collision, ground snapping) |
| NPC AI | `yuka` (steering behaviours, wander; navmesh paths later) |
| Audio | `howler` |
| i18n | `i18next`, EN and FR bundles in `content/locales` |
| Schema | JSON Schema 2020-12 validated with Ajv at build (`make validate-content`) and at runtime load |
| Tests | Vitest (domain/application ≥ 90 % lines, enforced), Playwright (e2e + perf budgets) |
| Assets | `@gltf-transform/cli` (Draco/Meshopt), `toktx` (KTX2) — `make assets` is idempotent |
| CI/CD | GitHub Actions calling Makefile targets only; Pages via `upload-pages-artifact` + `deploy-pages` |

## Alternatives considered
- **Babylon.js**: more mature WebGPU, built-in Havok and GUI. Rejected for v1 because Three's TSL pipeline already runs post-processing on both backends and the ecosystem (three-mesh-bvh, yuka examples) is larger. Revisit only if a release-critical feature is blocked (record in a new ADR).
- **PlayCanvas / Unity WebGL**: heavier payloads or licensing constraints; rejected.

## Consequences
- One repository owns code, content, assets pipeline, infra, tests and docs (BusinessRepo).
- Dependency-cruiser enforces the layering in CI (see `docs/architecture.md`).
- Rapier's WASM (≈2.8 MB, 1.1 MB gzip) is the largest single chunk; still well inside the 25 MB initial budget.
