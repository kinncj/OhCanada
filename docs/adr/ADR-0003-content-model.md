# ADR-0003: Content model

- Status: Accepted (2026-09-07)

## Decision
- Facts are data. `content/questions/<subject>.json` holds one bank per Discover Canada chapter. Every question has `id` (`q-<code>-NNN`), `subject`, `text.{en,fr}`, `answer.{en,fr}`, `distractors[]` (exactly 3), optional `explanation`, `source` (`Discover Canada: <chapter>`), `asOf` (ISO date) and `volatile`.
- `volatile: true` marks facts that change with elections/appointments (PM, Governor General, party leaders, seat counts). `make validate-content` fails when a volatile fact's `asOf` is older than `volatileMaxAgeDays` (180).
- Districts (`content/districts`), quests (`content/quests`), the character catalog and locale bundles all carry `"$schema"` and are validated with `additionalProperties: false`. Cross-references (quest → npc/trigger/question, district → quest, config → district) are checked by the validator, as is EN/FR key parity.
- Player-facing text lives only in locale JSON or in `text.{en,fr}` fields, never in code.
- Content is paraphrased, never copied verbatim from Discover Canada. Indigenous content uses current terminology and is logged for review in `docs/content-review.md`.
- Content is bundled by Vite (`import.meta.glob`) as lazy chunks per district/quest/bank and re-validated with Ajv when loaded at runtime (`StaticContentRepository`).

## Consequences
- Adding a district = one JSON manifest + quests + a question bank + locale strings; no code changes.
- Question ids encode the subject code so a quest can reference questions without an index.
