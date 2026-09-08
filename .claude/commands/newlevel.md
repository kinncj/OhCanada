---
description: Scaffold a new level (content JSON, SVG stubs, stories)
argument-hint: <slug>
---
Scaffold level **$1** for TrueNorth.

1. `po`: stories for the level in `docs/stories/level-$1.md` — traversal, NPCs, quest, questions,
   accessibility and bilingual scenarios.
2. `content-author`: `content/levels/$1.json` (layers, ground polyline, POIs, NPC spawns, quest refs,
   ambience, locomotion, tint, particles) and `content/quests/$1-*.json`, validating against the schemas.
3. `art`: SVG stubs under `assets/src/svg/$1/` for each layer and POI, palette-compliant, with reference
   photographs recorded in `assets/credits.json`.

The level must load with **no engine changes**. If it cannot, stop and report that the level schema is
wrong — fixing the schema comes before shipping the level.
