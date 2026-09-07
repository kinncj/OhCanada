# ADR-0005: Persistence, save import and threat model (STRIDE)

- Status: Accepted (2026-09-07)

## Decision
- Progress is saved to `localStorage` (`truenorth.save.v1`) via `LocalStorageProgressRepository`; export/import as JSON via `JsonSaveCodec`.
- **Tampering**: imported saves are parsed with `JSON.parse` only (never `eval`/`Function`), size-capped at 512 KB, validated against `content/schemas/save.schema.json` (`additionalProperties: false`, key bindings restricted to `^[A-Za-z0-9]+$`), and version-checked (`SAVE_VERSION`). Invalid input never touches session state.
- **Spoofing/Information disclosure**: no accounts, no network calls at runtime other than same-origin asset fetches; no analytics.
- **Third-party scripts**: none. Everything is bundled; `make deploy-check` and the perf suite fail if `index.html` references an external script or stylesheet.
- **Denial of service**: content and saves are size-bounded; quest reducers are O(steps).
- **Leaderboard**: out of scope (would need a backend and its own ADR).
- Offline: a Workbox service worker (`dist/sw.js`, scoped to `basePath`) precaches the app shell and hub assets after first load.

## Consequences
- A future save-format change requires a migration step in `JsonSaveCodec.migrate` and a bump of `SAVE_VERSION`.
