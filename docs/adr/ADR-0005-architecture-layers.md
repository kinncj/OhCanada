# ADR-0005: Layered architecture and the event bus

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: the layering only ever constrained what `domain` imports, never who imports
  `domain`, and said nothing about an adapter reaching for a use case. Two rules added below.

## Context
The engine will change more often than the rules. Levels must be addable as data. Multiple agents work in
parallel and must not collide in the same files.

## Decision
- `app/domain` — entities and pure rules (Player, Quest, Level, Question, Progress, Character,
  QuestionScheduler). Imports nothing outside `domain` and `common`. No framework, no DOM, no clock, no RNG.
- `app/application` — use cases and **ports only** (StartQuest, AnswerQuestion, ScheduleReview, UnlockLevel,
  SaveProgress, RunExam). Imports `domain` and `common`.
- `app/adapters/*` — Phaser, Rive, input, persistence, audio, i18n. Adapters implement ports and
  **never import each other**.
- `app/ui` — DOM screens; never imports adapters or scenes.
- `app/bootstrap` — the composition root, the only place concretes are wired.
- Systems communicate over a typed event bus, not direct references.
- ECS-lite: entities are ids, components are data, systems are functions. Composition over inheritance.

Added by amendment, because the original decision constrained only one direction of each edge:

- **`app/adapters` and `app/ui` may import `app/domain/ids` and nothing else from the domain.** Ids are
  branded strings that exist so every layer can name the same level, quest or question; the rest of the
  domain is *rules*, and a rule executed inside an adapter or a DOM screen is a rule the ≥ 90 % domain
  coverage gate never runs, because it can only be reached through a canvas or a browser. An adapter that
  needs domain data takes it as a port type or reads it off the event bus.
- **`app/adapters` may not import `app/application/use-cases`.** An adapter is driven, never driving: it
  implements ports and publishes facts, and `app/bootstrap` is what subscribes a use case to those facts.
  Importing a use case from an adapter means the input adapter starts orchestrating the game and the use
  case can no longer be unit-tested without it. Importing a *port* stays allowed — that is the point of the
  directory — so this rule is deliberately narrower than "adapters do not import the application".
  `app/ui` is deliberately **not** named: the UI is the human driving the game, and whether it calls a use
  case directly or goes through the bus is a slice-1 decision that deserves its own ADR rather than a rule
  guessed before the first screen exists.

dependency-cruiser enforces all of it in `make lint`; a violation fails CI.

## Alternatives considered
- **Scene-owned game logic** (the Phaser default) — rejected: rules become untestable without a canvas and a
  level change becomes an engine change.
- **A shared "core" grab-bag** — rejected: it is where layering goes to die.

## Consequences
- Domain and application are unit-testable with no browser, which is why they carry the ≥ 90% coverage gate.
- Swapping Rive for sprite sheets, or Phaser for Pixi, touches one adapter directory plus bootstrap.
- If two agents need the same file, that is a boundary defect for the architect — not a merge.
