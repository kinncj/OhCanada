# TrueNorth user stories

User stories with Gherkin acceptance criteria for TrueNorth, a browser 3D game that teaches the Canadian citizenship test (content paraphrased from *Discover Canada*). Stories are the contract between product, engineering and content; tests in `tests/` should trace back to a story ID.

## Index

| File | Scope |
| --- | --- |
| [system-core-loop.md](system-core-loop.md) | Boot, menu, save/load/import/export, autosave, locale, settings, accessibility, pause, journal |
| [system-character.md](system-character.md) | Character creator and appearance persistence |
| [system-quests-and-questions.md](system-quests-and-questions.md) | Quest state machine, question presentation, Passport Stamps, district unlock, portals |
| [system-exam.md](system-exam.md) | Citizenship Ceremony mock exam and practice mode |
| [system-world-and-rendering.md](system-world-and-rendering.md) | Hub, district streaming, day/night, weather, presets, budgets, telemetry |
| [district-hub.md](district-hub.md) | Parliament Hill tutorial |
| [district-rights-responsibilities.md](district-rights-responsibilities.md) | Rights & Responsibilities |
| [district-who-we-are.md](district-who-we-are.md) | Who We Are |
| [district-history.md](district-history.md) | Canada's History |
| [district-modern-canada.md](district-modern-canada.md) | Modern Canada |
| [district-government.md](district-government.md) | How Canadians Govern Themselves |
| [district-elections.md](district-elections.md) | Federal Elections |
| [district-justice.md](district-justice.md) | The Justice System |
| [district-symbols.md](district-symbols.md) | Canadian Symbols |
| [district-economy.md](district-economy.md) | Canada's Economy |
| [district-regions.md](district-regions.md) | Canada's Regions |

## Story ID convention

`TN-<AREA>-<NN>` where AREA is one of `CORE`, `CHAR`, `QST`, `EXAM`, `WLD`, `HUB`, `RR`, `WWA`, `HIS`, `MC`, `GOV`, `ELE`, `JUS`, `SYM`, `ECO`, `REG` and NN is a two-digit sequence within the area (e.g. `TN-HUB-01`). IDs are never reused; a withdrawn story keeps its ID and is marked *Withdrawn*.

Each story carries a status: **Implemented** (covered by slice 1 tests), **Planned** (agreed, not built), or **Proposed (not yet implemented)** (needs product sign-off; content files do not exist yet).

## Writing conventions

- Scenarios reference observable UI text from `content/locales/<locale>/ui.json`, `data-testid` names used in `tests/e2e/`, or event names from `app/application/events.ts` (written as `'quest:completed'`).
- Scenarios must not state facts about Canada beyond what `content/questions/*.json` already contains. Question IDs (`q-rr-001`) are cited rather than answers restated.
- Content limits come from `content/game.config.json` (unlock rules, exam parameters, budgets); update the story if the config changes.
- Spelling: Canadian English (colour, centre, licence).

## Definition of done (per story)

1. Unit tests cover the domain/application rule in the story (state transitions, validation, scoring).
2. An e2e scenario in `tests/e2e/` exercises the user-facing path, using the `data-testid`s named in the story.
3. Any new or changed content (`content/**`) validates against `content/schemas/*.schema.json` and has both `en` and `fr` text.
4. Docs updated: this story's status, and any affected ADR or content-review note.
5. Feature works with keyboard only and in both locales; no new console errors.
