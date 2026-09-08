# Security policy

## Scope

TrueNorth is a static, client-side game. There is no backend, no account system, no telemetry and no personal
data collection. Progress is stored in the browser's `localStorage` and can be exported or imported by the
player as a JSON file.

The realistic attack surface is therefore small:

- **Save-file import** — an imported save is parsed with `JSON.parse` only (never `eval` or `Function`),
  size-capped, and validated against `content/schemas/save.schema.json` with `additionalProperties: false`
  before it touches any state. Invalid input is rejected without partial application.
- **Third-party code** — no CDN scripts. Everything is bundled from the lockfile.
- **Content** — question and level JSON is schema-validated at build and again at runtime load.
- **Service worker** — precaches assets for offline play; navigations are network-first so a stale shell
  cannot pin a device to an old build.

## Reporting a vulnerability

Open a GitHub security advisory on the repository, or a regular issue if the problem is not sensitive.
Please include steps to reproduce and the affected version or commit. We aim to acknowledge within a week.

If you find a way to make an imported save file execute code, alter another player's data, or escape the
schema, treat it as sensitive and use the advisory route.
