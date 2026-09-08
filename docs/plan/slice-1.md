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
| 1.11 | Rive rig contract + `.riv` for Mountie and player, sprite-sheet fallback | art | Contract test loads each `.riv` and asserts inputs exist | Done (rig contract + schema; sprite parts, no drawable .riv on purpose) |
| 1.12 | `ICharacterRenderer` implementations (Rive + sprite sheet) | engine | ≤ 1.5 ms per character, ≤ 6 on screen; swap proven by test | Done — both backends behind the port, swap pinned by `tests/unit/adapters/character-renderer-swap.test.ts`; measured in `tests/perf/character-cost.spec.ts`. **Sprite ships**; Rive undecided, see the risk below |
| 1.13 | Level scene: parallax layers, ground polyline, camera, POIs | engine | Level loads from JSON alone | Done (level-is-data-only gate) |
| 1.14 | Skate locomotion behind `Locomotion` | engine | Tuning from level JSON; walk and skate differ by data only | Done (tuning inside the asserted band) |
| 1.15 | DOM: character creator, dialogue, question card, Study mode, settings | ui-a11y | axe-core clean; keyboard and switch paths tested | Done (122 a11y checks) |
| 1.16 | `make verify-art` implemented (blind identification then reference compare) | art-verifier + infra | `docs/art-verification.json` written; CI fails on a miss | Done — harness built, first blind pass ran 10/10; anonymisation leaked via operator text, being closed |
| 1.17 | `make verify-content` implemented (author/verifier separation enforced) | content-verifier + infra | Quarantined items excluded from the build; a question with status `verified` and an empty evidence quote fails the gate (ADR-0003 CI clause) | Done, with one stated gap — 46 fixtures; ADR-0003 CI clause + ADR-0016 §2 table enforced; separation of duties enforced as *no single commit both authors a claim and grants its verification*, because **commit authorship is not establishable in this repository** (one identity, no signatures, trailers forbidden). `scripts/verify-content.mjs`'s header specifies the three things that would make it establishable; a `scripts/content-roles.json` map is already wired and absent. |
| 1.18 | Screenshots on iPhone, iPad and desktop via Playwright MCP | orchestrator | Attached to the slice; portrait canvas correct on all three | Done (iPhone 13, iPad Mini, desktop, against the live site) |
| 1.19 | Renderer capability probe + visual tiers (WebGL / software-WebGL / Canvas) | engine | Tier chosen from a measured frame cost, not a feature flag; every effect has a no-Filter path | Done (ADR-0011) |
| 1.20 | Compose the DOM layer in `app/bootstrap`: creator, HUD, menu, dialogue, question card, study, settings, POI card, level screens | engine + ui-a11y | Every slice-1 screen reachable in the built artefact; the a11y suite scans `dist/`, not a harness; the two character renderers are constructed | **Not started** |

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

- **Rive budget — measured, and answered as far as the evidence goes (task 1.12).** The rule stands: if
  ≤ 1.5 ms per character does not hold, the sprite-sheet fallback ships and Rive waits, and the
  `ICharacterRenderer` seam makes that a swap rather than a rewrite. What the measurement says, on
  SwiftShader/WebGL at 1080×1920, engine cost sampled as `POST_RENDER now - PRE_STEP now` (never a rAF
  interval — ADR-0011) against a zero-character baseline:

  | | 1 character | 6 characters | VRAM the texture gate cannot see |
  |---|---|---|---|
  | sprite atlas, 4 layers each | 0.13–0.17 ms | 0.02–0.03 ms each (≤ 0.16 ms total) | **0** — the parts are inside the counted atlas |
  | Rive **runtime floor**, empty artboard | 0.36–0.40 ms | 0.12–0.13 ms each (≈ 0.77 ms total) | **1.72 MiB each, 10.3 MiB at six** |

  **The sprite sheet ships for slice 1. Rive is undecided, pending real artboards.** The Rive column is a
  *floor*, not a per-character cost: `assets/style/rig-contract.riv` is a valid rig with all nine inputs and
  **no drawable content**, kept that way deliberately so nobody adopts Rive on a measurement of an empty
  file. Instantiation, `advanceAndApply`, the canvas surface and the per-frame upload are all real and all
  paid whatever the rig contains; the vector rasterisation of 50 parts is *on top* of it. So the floor being
  inside budget proves nothing, and only the floor being *over* budget could have settled it — which is the
  only direction `character-cost.spec.ts` asserts.

  The VRAM column is why the millisecond column is not the whole answer. A Rive surface is sized by the
  display, not by a file, so `scripts/assets.mjs` records `decodedBytes: 0` for a `.riv` and no gate moves
  when six of them are added. Ottawa with Rive characters would sit around 55 MiB against the 64 MiB ceiling
  with under 9 MiB left for Phaser's render targets and the browser — uncounted memory, which is the shape
  of the failure that killed this project's predecessor. Reversing the verdict needs a drawable `.riv` **and**
  that number brought inside a gate.

- **The sprite fallback cannot yet draw the shipped atlas (task 1.12 → 1.13).** The renderer is complete
  against `CharacterRendererSpec`, but it resolves frames by its own convention and selects a clip from the
  document's input declaration order. `assets/style/rig-contract.json` declares something richer and
  authoritative: 20 parts with z-order, pivots and `mirrorX`, 50 frame templates with `{brace}` slots, 8
  states with per-part keyframes, and an explicit `selector` table. Drawing the shipped art means the sprite
  adapter *reads the rig document at runtime* — which is exactly the condition ADR-0017 §5 records for
  deleting `rig.schema.json`'s `SKIPPED_SCHEMAS` entry and writing the mirroring port types. That is an
  architect decision, not an engine workaround, and it blocks nothing today because no level places a
  character yet.
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

- **A blind pass leaks through the operator's own output, not the images.** The first real run identified
  10/10 renders correctly with the commitment hash verified — and the verifier still downgraded its verdicts
  to `trusted-with-caveat`, because `make art-handoff` printed two of three subject ids to its terminal before
  it saw a pixel, `--help` names a third, and the task brief named a source file verbatim. The images were
  clean: uniform mtimes, 16-hex names, no text chunks. Blindness is an operational property, not a file
  property, and the only subject that was genuinely open-set returned 0.60 rather than 0.92.
- **A contract can demand what the art is forbidden to show.** The canal's `expectedBlindAnswer` asks for
  "Ottawa" while `references.json` instructs that the one recognisable landmark must not be drawn there. It
  passed on the verifier inferring project intent, and said so. A contract that outruns its art fails an
  honest verifier and passes a compliant one, which is the wrong way round.
- **Every texture number was a budget for art the running game had never loaded.** `assets: []` meant the
  loader queued nothing and the runtime budget refusal summed to zero, for the whole slice, while 36 e2e tests
  passed. The fallback is indistinguishable from success unless something asserts the difference — now
  `data-layers` must *equal* `data-layers-textured`, because five of six would be the same bug, smaller.
- **A diagnostic shipped a fingerprinting surface.** `data-tn-device` published the raw
  `UNMASKED_RENDERER_WEBGL` string on every load, against the explicit clause in ADR-0011 that kept the
  diagnostics in the first place. Live on a public site until found.

## What "done" meant in the task table, and what it did not

A staff review of the committed slice (`208d8f3..3c5a6e4`) found the table asserting completion for work the
shipped artefact does not contain. The tasks were built; the game was not assembled. Recorded here because a
plan that overstates is worse than one that is behind — the next reader trusts it.

- **Nothing composes the DOM layer.** `app/bootstrap/main.ts` mounts four things: the live region, the rotate
  overlay, the build-status caption and the renderer. The character creator, HUD, menu, dialogue, question
  card, study screen, settings, POI card and level screens have **zero consumers under `app/`** — roughly
  4,000 lines reachable only from tests, along with both character renderers, the persistence adapter, the
  four use cases and the scheduler. No task in the table owned the wiring, which is why nothing did it. That
  is task 1.20 now.
- **The accessibility claim is narrower than it sounds.** 123 axe checks pass against a dev-server harness
  that mounts components directly. `tests/a11y/playwright.config.ts` says so in its own header. They prove
  the components; they say nothing about the shipped page, and there is no shipped page for them to be about.
- **The officer is a rounded rectangle and the Peace Tower is not drawn.** `level-scene.ts` paints every
  character with `fillRoundedRect` unconditionally. The reference-critical red serge — the stated reason
  Ottawa was chosen first — is not in the running game.
- **ADR-0008 cannot see this.** Its gate reads import edges, so a port with two implementations looks
  consumed even when nothing constructs either. "A port exists when something calls it" is satisfied by an
  implementation nothing composes.
