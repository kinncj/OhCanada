# `content/levels/`

One JSON document per level, validated against `content/schemas/level.schema.json`. The document *is* the
level: parallax layers, ground polyline, camera, spawn, points of interest, character placements,
locomotion tuning and the asset manifest. Adding a level is this file plus assets — `app/adapters/phaser`
has no level ids in it, and `tests/unit/adapters/phaser/level-is-data-only.test.ts` is the gate that keeps
that true.

## `ottawa.json` is engine scaffolding, not the finished level

It was written by the **engine** agent (slice 1 tasks 1.13 and 1.14) because a level scene cannot be built
against a directory with nothing in it. It validates, it loads, it plays, and the parts below are
placeholders that their owners replace. Nothing in the engine changes when they do.

| Part | Status | Owner |
|---|---|---|
| `locomotion` (skate, walk) | **Real.** Tuned against the relationships in `TN-LEVEL-03` and asserted by `tests/unit/adapters/phaser/locomotion.test.ts`. Retune freely; the tests read the numbers from here. | engine (1.14) |
| `camera`, `size`, `spawn`, `ground` | **Provisional geometry.** The shape of a canal with one descent in it, chosen so the slope scenario has a slope to skate down and the camera has room to clamp at both ends. Real once the art fixes the level's proportions. | art (1.9) + engine |
| `layers` | **Keys are real, geometry is provisional.** The keys are the ones the asset pipeline produces (`ottawa-layer-<depth>-<name>`); the `offset` and `scrollFactor` values are guesses until the atlases exist and can be looked at. | art (1.9) |
| `pois[].position`, `radiusPx`, `artKey` | Provisional placement; the key is the pipeline's. | art (1.9) |
| `pois[].name`, `blurb` | **Copy from `docs/stories/TN-LEVEL-ottawa.md`**, transcribed, not invented. | content-author (1.7) |
| `pois[].fact`, `territory.fact`, `territory.nationSource` | **Unverified, and must stay that way until a verifier grants a status.** The author never sets verification status (ADR-0003). The `source` blocks name the cached Discover Canada manifest as the author's *proposal* of where the claim comes from; nobody has checked that the claim is in it. | content-author (1.7), content-verifier (1.8) |
| `territory.statement`, `territory.nations` | **Provisional and the most sensitive thing in this file.** `docs/content-review.md` §10 governs it. A citable fact is required, the nation names must come from that nation's own material, and neither has been checked. | content-author + review |
| `characters` | One placement, `officer`, referring to a character document that does not exist yet. | content-author (1.7), art (1.11) |
| `quests` | Empty. | content-author (1.7) |
| `assets` | **Empty**, so the loader's texture-budget refusal currently sums to zero. It fills in when `make assets` produces the manifest, and `textureBudgetBytes` has to be checked against the real numbers then. | infra (1.10) |
| `subject` | `government`, following `OQ-SUBJECT-1`'s recommendation. Confirm before questions are authored against it. | content-author (1.7) |

## `textureBudgetBytes`

50 331 648 (48 MiB), under the schema's and CLAUDE.md's 64 MB ceiling, and it is a **guess that has to be
re-derived** the moment `assets` is filled in. The number it was chosen against: the Ottawa art set measures
136.8 MiB decoded at 2×, which is why full-screen parallax layers ship at 1× only — 48 MiB leaves the 1×
backdrop set room and keeps 2× for characters, props and anything the player looks at closely.

The engine does not assume a 2× variant exists for any layer. `LevelScene` asks the texture manager whether
the key it was given resolves and falls back to a flat band in the level's own theme colours when it does
not, so a missing variant is a plainer backdrop and never a blank screen.

## Adding a level

Drop `<id>.json` in this directory. `app/adapters/phaser/level-catalog.ts` globs it, so it appears in
`levelIds()` and can be opened with `?level=<id>` without an engine change. If it needs one, the schema is
wrong and that is the thing to fix (`docs/plan/slices.md`, Rules).

## Where a level's art may sit, vertically

`LevelScene` paints the ground polygon **opaque, at `DEPTH_GROUND` 400, over every parallax layer**
(`DEPTH_LAYERS` 100 + index), filling from the polyline down to `size.y`. `selectLayers` models the same
thing when it ranks layers by coverage, clipping each band at the highest point of the polyline. So:

> **A parallax band is only visible above the ground line.** Rows below it are painted over, and they are
> also charged to the level's texture budget.

`halifax.json` and `toronto.json` are composed for that: no layer in either has content below y = 1280, and
each near band's last twenty rows sit under the line on purpose so the tile and the ground polygon meet with
no step. `assets/style/halifax-level.md` §7.1 records the two levels that are not composed for it —
`quebec-city-layer-60-slope` (0 of 560 rows visible) and `ottawa-layer-60-ice` (26 of 560) — and calls the
fix one number per document. It is not: both tiles are the near-ground *surface*, authored to run from the
ground line down to the bottom of the frame, and the band immediately above each of them (the terrace, the
canal wall) already occupies every row up to it. Raising the surface tile paints over the promenade; lowering
the polyline moves the player 560 px into the lower third that ADR-0002 reserves for the question card, and
the camera cannot compensate because `size.y` equals the design height and is therefore pinned. The change
that fixes those two levels is in the scene — the ground **fill** below the near layers with the **crest**
still above them, plus the matching change to `layerCoverage` — and it belongs to the engine, not here.

## `halifax.json` and `toronto.json`

| Part | Status | Owner |
|---|---|---|
| `size`, `spawn`, `ground`, `layers`, `pois[].position`, `radiusPx`, `artKey`, `theme` | **Measured.** Transcribed from `assets/style/halifax-level.md` §3 and `assets/style/toronto-level.md` §3, which are the numbers the tiles were drawn against. | art |
| `theme.ink`, `theme.inkMuted` | **Copied from the other two levels and not derived.** Both sheets say the pair is `ui-a11y`'s and decline to propose one. Neither level's ground stop reaches 4.5:1 against it — Halifax's `#8b857c` needs a darker ink than `#1a2036`, Toronto's `#605a55` needs a lighter one than its sky does — so no single pair satisfies the schema's stated floor at both ends. Open. | ui-a11y |
| `locomotion` | **Real.** `walk` is the tuning the other levels already ship; `bike` is new and sits inside `TN-LEVEL-03`'s band. `jump` is `null` on the bike: the Toronto art frames no jump and draws no gap, and a bunny-hop would be the trick system `CLAUDE.md` rules out. | engine + art |
| `textureBudgetBytes` | **Derived**, 34 MiB, and re-checked: `make assets` measures Halifax at 25.01 MiB (74 %) and Toronto at 23.74 (70 %). | art (§5 of each sheet) |
| `territory` | **Author's proposal, unverified.** Each cites a source cached in `content/sources/`; the nation names come from that nation's own material and no verifier has looked at either. | content-author + verifier |
| `pois[].blurb`, `fact` | **Author's proposal, unverified**, paraphrased from the cached *Discover Canada* extraction at the recorded hash. | content-author + verifier |
| `characters` | Empty. The guide and the volunteer have no character document yet. | content-author |
| `quests` | Empty. | content-author |
| `subject` | `rights` and `elections`, per `docs/stories/TN-LEVELS-2-to-10-spine.md`. **`content/questions/elections/` does not exist**; `OQ-SPINE-3` already records that level 5's bank is currently inside level 4's. | content-author |
