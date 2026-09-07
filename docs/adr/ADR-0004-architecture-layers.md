# ADR-0004: Layered architecture and event bus

- Status: Accepted (2026-09-07)

## Decision
- `app/domain` (pure TS entities and reducers), `app/application` (use cases + ports), `app/adapters/*` (Three, Rapier, yuka, howler, i18next, localStorage, content), `app/ui` (DOM/CSS), `app/bootstrap` (composition root), `common` (Result, EventBus, SchemaValidator, RNG).
- Rules enforced by dependency-cruiser (`.dependency-cruiser.cjs`): domain imports only domain/common; application imports domain/common; adapters never import each other, the UI or bootstrap; UI never imports adapters or bootstrap; bootstrap may import everything; no cycles.
- Systems communicate through the typed `EventBus<GameEvents>`; use cases emit, adapters/UI subscribe. Telemetry mirrors every event to `console.info('[truenorth] {...}')` for Playwright.
- ECS-lite: entities are ids, components are plain data (`PlayerComponent`), systems are functions/classes in bootstrap that read components and call ports.
- Composition over inheritance; all state transitions in domain are pure functions returning new objects.

## Consequences
- Domain/application are unit-tested without a browser (≥ 90 % coverage gate); adapters are covered by integration (content, persistence) and Playwright.
