# ADR-0001: Technology stack

- Status: Accepted (2026-09-08)

## Context
TrueNorth is an open-source, portrait-first 2D side-scrolling learning game for the Canadian citizenship test.
It ships as a static site on GitHub Pages with no backend, must hold 60 fps on an iPhone 13 in portrait, and
must be redistributable by anyone (open source, including the art and the question data).

## Decision
| Concern | Choice |
|---|---|
| Language | TypeScript, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Build | Vite 8; `base` from `content/game.config.json` |
| Engine | Phaser 4 (≥ 4.2): node renderer, Filters, GPU sprite layer, Scale manager, Arcade physics |
| Characters | Rive (`@rive-app/canvas`, Apache-2.0) behind `ICharacterRenderer`, sprite-sheet fallback |
| Scheduling | FSRS spaced repetition (`ts-fsrs`, MIT) inside the domain layer |
| Audio | howler |
| i18n | i18next, EN + FR from the first commit |
| Schema | JSON Schema 2020-12 + ajv, at build and at runtime load |
| Tests | Vitest (domain/application ≥ 90%), Playwright (e2e, perf, axe-core a11y) |
| Arch lint | dependency-cruiser |
| Offline | Workbox, precache per level |
| CI/CD | GitHub Actions calling Makefile targets → Pages |

## Alternatives considered
- **PixiJS v8 + a custom ECS** — more control, but we would rebuild scenes, input, cameras and particles.
  On record as the fallback if a required effect is blocked in Phaser; requires its own ADR.
- **Unity / Godot web export** — payload far beyond the 8 MB initial budget, and neither fits an
  "open the repo and read the source" open-source posture as cleanly.
- **Spine for characters** — better tooling, but its runtime licence restricts redistribution, which is
  incompatible with shipping this repo open source. Excluded by ADR-0004.

## Consequences
- One repository owns code, content, assets, infra, tests and docs.
- Phaser's scale manager handles the portrait-canvas rule (ADR-0002) without custom letterboxing.
- Every dependency above is MIT/Apache-2.0/BSD, so the built game and its source stay freely redistributable.
