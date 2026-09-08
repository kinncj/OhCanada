# Slice 1 — Vertical proof

**Goal.** One thin slice through every layer, live on Pages: boot → rotate overlay → character creator →
Level 4 Ottawa → Mountie NPC → one quest → three scheduled questions → Study mode → save → reload.
Nothing else starts until this is live and verified.

**Why Level 4 first.** Ottawa exercises the hardest parts early: a named landmark that must be recognisable
(Peace Tower), skate locomotion on canal ice rather than plain walking, and an NPC whose costume is
reference-critical (red serge, Stetson, Sam Browne belt, no RCMP crest or name).

## Tasks

| # | Task | Owner | Acceptance | Status |
|---|---|---|---|---|
| 1.1 | Stories: level, creator, quest, question card, Study mode, save/reload, **settings** — each with a11y and bilingual scenarios | po | `docs/stories/` covers every player-facing behaviour in this slice | Done |
| 1.2 | Schemas: `level`, `quest`, `question`, `character`, `locale`, `progress` | architect + infra | Written before the content; `ports-match-schemas` binds all six automatically, and compares property *types*, not just names — branded ids must survive; no inline object schemas (ADR-0007) | Done (11 schemas; type-blindness gate closed, proved by 15 mutations) |
| 1.3 | Domain entities: Player, Quest, Level, Question, Progress, Character | domain | Pure, ≥ 90% coverage, no framework imports | Done (100% lines) |
| 1.4 | `QuestionScheduler` (FSRS) | domain | 50 draws from a 30-question pool never repeat inside the exclusion window, seeded RNG | Done (FSRS written out, pinned by oracle — ADR-0012) |
| 1.5 | Use cases: StartQuest, AnswerQuestion, ScheduleReview, SaveProgress | domain | Ports only, Result-typed, unit-tested | Done |
| 1.6 | Persistence adapter: localStorage + JSON export/import | domain→adapter | `progress.schema.json` exists and `SaveCodec.decode` validates against it; import is size-capped, never `eval` (SECURITY.md) | Done (decode pinned against real ajv, ~700 mutations) |
| 1.7 | Level 4 content: `levels/ottawa.json`, quest, 3+ questions authored | content-author | Validates; questions carry source + asOf + volatile | Done (57 questions) |
| 1.8 | Question verification | content-verifier | Every shipped question `verified` against a cached canada.ca source hash, each carrying the quoted passage as evidence | Done (54 verified, 3 rejected, 0 quarantined) |
| 1.9 | Art: Ottawa layers, Peace Tower, Centre Block, Rideau Canal, Mountie parts | art | Palette-compliant SVG; refs in `assets/refs/` credited | Done |
| 1.10 | `make assets`: SVG → WebP atlases, 1×/2× | infra | Level payload ≤ 8 MB **enforced by code, written with this task not after it**; `assets/dist/manifest.json` maps files to levels; a manifest with zero levels fails; atlas ≤ 2048 px | Done (payload + texture gates, ADR-0013) |
| 1.11 | Rive rig contract + `.riv` for Mountie and player, sprite-sheet fallback | art | Contract test loads each `.riv` and asserts inputs exist | Not started |
| 1.12 | `ICharacterRenderer` implementations (Rive + sprite sheet) | engine | ≤ 1.5 ms per character, ≤ 6 on screen; swap proven by test | Not started |
| 1.13 | Level scene: parallax layers, ground polyline, camera, POIs | engine | Level loads from JSON alone | Done (level-is-data-only gate) |
| 1.14 | Skate locomotion behind `Locomotion` | engine | Tuning from level JSON; walk and skate differ by data only | Done (tuning inside the asserted band) |
| 1.15 | DOM: character creator, dialogue, question card, Study mode, settings | ui-a11y | axe-core clean; keyboard and switch paths tested | Done (122 a11y checks) |
| 1.16 | `make verify-art` implemented (blind identification then reference compare) | art-verifier + infra | `docs/art-verification.json` written; CI fails on a miss | Blocked — blind pass could not run blind; needs anonymised hand-off and an asset-to-subject map |
| 1.17 | `make verify-content` implemented (author/verifier separation enforced) | content-verifier + infra | Quarantined items excluded from the build; a question with status `verified` and an empty evidence quote fails the gate (ADR-0003 CI clause) | Done, with one stated gap — 46 fixtures; ADR-0003 CI clause + ADR-0016 §2 table enforced; separation of duties enforced as *no single commit both authors a claim and grants its verification*, because **commit authorship is not establishable in this repository** (one identity, no signatures, trailers forbidden). `scripts/verify-content.mjs`'s header specifies the three things that would make it establishable; a `scripts/content-roles.json` map is already wired and absent. |
| 1.18 | Screenshots on iPhone, iPad and desktop via Playwright MCP | orchestrator | Attached to the slice; portrait canvas correct on all three | Not started |
| 1.19 | Renderer capability probe + visual tiers (WebGL / software-WebGL / Canvas) | engine | Tier chosen from a measured frame cost, not a feature flag; every effect has a no-Filter path | Done (ADR-0011) |

## Level 4 — subject and setting

Subject: **How Canadians Govern Themselves** / « Comment les Canadiens se gouvernent ». `slices.md` named a
subject for every level except 3 and 4; this closes 4. Setting is Ottawa — Parliament Hill and the Rideau
Canal, skate locomotion. The NPC wears the recognisable red-serge silhouette without any protected mark: no
crest, no wordmark, no exact insignia, and named generically rather than as a member of a named force. That
is the owner's decision, taken after the licensing risk was raised.

## Definition of done

Live on Pages. `make lint typecheck test test-e2e test-perf test-a11y validate-content verify-content verify-art`
all green. A player can create a character, walk (skate) the Ottawa level, talk to the Mountie, accept and
finish one quest, answer three scheduled questions, earn a stamp, run a Study drill, close the tab and come
back to the same state.

## Risks

- **Rive budget.** If ≤ 1.5 ms per character does not hold on an iPhone, the sprite-sheet fallback ships and
  Rive waits. The `ICharacterRenderer` seam exists so this is a swap, not a rewrite. Decide with a measurement.
- **Art verification is unproven.** `verify-art` has never run. If blind identification proves unreliable,
  that is an ADR, not a quiet downgrade of the bar.
- **Schema-before-content.** Task 1.2 must land before 1.7, or the content is written against a shape nothing
  validates — the defect ADR-0007 was written to prevent.

- **The renderer is assumed, not decided.** `Phaser.AUTO` picks WebGL when it is *advertised*, which is not the
  same as usable: Linux on llvmpipe/SwiftShader, a VM, a remote desktop, or a browser with hardware acceleration
  disabled all report a working WebGL context and then run at single digit frames. Phaser 4 keeps a Canvas
  renderer, but Canvas has no Filters, so any effect built on Filters silently disappears there. This is the
  phase 1 failure repeating in 2D — a device advertising a capability it cannot deliver, found by the player
  rather than by us. Task 1.19 answers it by degrading the *visual tier* on a measured frame cost rather than
  degrading the renderer on a capability bit, and by reading `UNMASKED_RENDERER_WEBGL` to name software
  rasterizers outright. Needs an ADR before 1.13 leans on Filters.

- **`budgets.levelPayloadBytes` is enforced by nothing.** It sits in `content/game.config.json`, is required by
  `game.config.schema.json`, and no code anywhere reads it — the only other mention is a comment in
  `deploy-check.mjs` calling it "a different gate", and that gate does not exist. It reads as enforced because
  it appears in the config and the schema. This is the slice-0 pattern one level worse: the vacuous coverage
  gate at least printed a number, and this one prints nothing at all. It cannot be closed before the asset
  pipeline lands, because a per-level budget needs `assets/dist/manifest.json` to know which files belong to
  which level — so it is written *with* task 1.10, not after it, or the first atlas ships against a budget
  nobody measured. Give it the same anti-vacuum floor the credit gate now has.
