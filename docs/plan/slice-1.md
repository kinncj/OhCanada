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
| 1.6 | Persistence adapter: localStorage + JSON export/import | domain→adapter | `progress.schema.json` exists and `SaveCodec.decode` validates against it; import is size-capped, never `eval` (SECURITY.md) | Done (decode pinned against real ajv, ~700 mutations). **Superseded by 1.22:** the store is now IndexedDB (ADR-0026); the codec, the schema and the export/import format are unchanged. |
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
| 1.20 | Compose the DOM layer in `app/bootstrap`: creator, HUD, menu, dialogue, question card, study, settings, POI card, level screens | engine + ui-a11y | Every slice-1 screen reachable in the built artefact; the a11y suite scans `dist/`, not a harness; the two character renderers are constructed | **Partly done.** The front door is wired and shipped: title -> map -> Ottawa -> map, through `createShell`, with the HUD, the POI card, the level error card, settings and the save behind it, and `tests/a11y/shell.spec.ts` now scans `dist/` (`OQ-TEST-2`, half closed). **Still unreachable: the character creator, Study, the question card and dialogue** — each blocked on data rather than on wiring, and each named under Risks below. Neither character renderer is constructed. |
| 1.21 | Touch controls: hold anywhere to walk, tap to jump, tap an NPC or POI to engage — **no virtual controller** | engine | Direction is taken from the player's screen position, never from a screen half; a cancelled pointer stops the walk; multi-touch cannot ask for two directions; proven through real `touchstart`/`touchmove`/`touchend`/`touchcancel` events | **Done, with one wire outstanding.** `app/adapters/phaser/touch-controls.ts` (pure, 100% covered) plus the pointer binding in `level-scene.ts`; twelve scenarios in `tests/e2e/touch-controls.spec.ts` drive Chromium's own touch events into real Phaser. `InputPort` was **not** changed and is still `PROVISIONAL`: it describes a device in terms of `GameAction`s and a `moveAxis`, and neither the walk direction (which needs the player's position on screen) nor the meaning of a tap (which needs a world hit test) can be decided without gameplay state the port deliberately does not carry. A proposal is in the task report; changing it needs an owner for `app/application`. Auto-move is exposed as `GameRenderer.setAutoMove` and has **no caller**: `app/bootstrap` has to join it to `SettingsDocument.autoMove`, which the settings screen already offers. |
| 1.23 | Player-facing shell: the screens made to look like a game, Study and the in-level learning loop mounted, settings reachable from the strip, and a finished level leading to the next | ui-a11y | Every DOM screen drawn from `assets/style/palette.json` through `app/ui/palette.ts`, with contrast measured rather than asserted; axe clean on every screen including the two new ones; Study runs a real drill on `dist/`; a landmark teaches then asks; earning a stamp lands the player on the card that opened | **Done, with one named gap and a copy list.** Gap (2) is **closed**: reaching the end of the level is what finishes it. The scene publishes `level/exitReached` (`app/adapters/phaser/level-exit.ts`), `app/bootstrap/main.ts` decides what the arrival is worth — `withStamp`, `markLevelComplete`, then the card — and `tests/e2e/level-end-to-next.spec.ts` walks a player from the spawn to the end of one level and into the next. The card offers that level directly as its primary action. Gap (1) stands: `SceneLevel` carries no `subject`, so a landmark's question is drawn from the whole bank rather than from the level's subject (`TN-CARD-01` asks for the subject). Copy rows still missing and reported rather than invented: `hud.interact.*`; `stamp.<id>.earned` for every level but Ottawa — **now load-bearing, because the game starts on Halifax and the card it draws has no stamp line**; and a sentence for the player who reaches the end having answered nothing. A sentence naming the level that just opened is **no longer needed**: the card draws the map's own description of that card (`describeEntry` in `app/ui/level-select.ts`), which is three reviewed rows joined rather than a fourth string invented at the one screen that wanted it. |
| 1.22 | Progress and settings in IndexedDB, exportable and importable | domain→adapter | IndexedDB behind the unchanged `ProgressRepository`; `localStorage` is the tested fallback and the store an existing save is carried out of, verified by read-back before the original is removed; an unreadable store never reads as "new player" (ADR-0024); export/import round-trips a played game exactly | **Done (ADR-0026).** `holdToChooseMs` is now saved, which made this save format version 2 and fired ADR-0015's migration tripwire: the first real `SaveMigration` (1 -> 2) is wired from the composition root, `tests/unit/contracts/a-version-1-save-survives-the-first-migration.test.ts` replaces the tripwire, and ADR-0015 carries the amendment. **CLAUDE.md's Storage row still says `localStorage` and needs its owner's edit** — agents do not edit CLAUDE.md. |

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

- **Nothing composed the DOM layer.** `app/bootstrap/main.ts` mounted four things: the live region, the
  rotate overlay, the build-status caption and the renderer. The character creator, HUD, menu, dialogue,
  question card, study screen, settings, POI card and level screens had **zero consumers under `app/`** —
  roughly 4,000 lines reachable only from tests, along with both character renderers, the persistence
  adapter, the four use cases and the scheduler. No task in the table owned the wiring, which is why nothing
  did it.
  **Task 1.20 wired what has data.** The shell, the level select, the HUD and its menu, the POI card, the
  level error card, the settings screen, the storage warning, the `localStorage` repository, the JSON save
  codec and `saveProgress`/`loadProgress`/`exportProgress` are all composed and reachable from a cold load.
  What is still unreachable is unreachable for a stated reason, not for want of a line:
  - **the character creator** needs a character document with slot *options and labels*. `content/characters/rig.json`
    lists five player-selectable slot names and their option ids and says the names are the localiser's;
    `app/ui/copy.ts` has labels for three slots that do not match those five and no option names at all,
    because naming the six skin ramps is `docs/content-review.md` §8.1 / `OQ-REVIEW-6` and is open. Mounting
    it means inventing player-facing content, which ADR-0010 forbids.
  - ~~**Study, the question card and dialogue**~~ **Study and the question card are wired and reachable**
    (task 1.23). `app/bootstrap/study.ts` mounts `app/ui/study-screen.ts` over `StudySession`, brackets it
    with `shell.setModalOpen`, and routes every answer through `answerQuestion` and the save;
    `app/bootstrap/quiz.ts` runs the card and is shared by Study and by a landmark's question, so
    `TN-STUDY-01`'s "answering behaves exactly as it does in a level" is one implementation rather than two
    that agree today. `onOpenStudy` is passed from the title screen and from the level's menu.
    `tests/e2e/study-and-settings.spec.ts` runs a whole drill against the real bundled bank on the shipped
    artefact. **Dialogue is still unreachable**: it needs `quests()` and `level()`, which no adapter
    implements, and `SceneLevel` carries no `quests`.
  - **both character renderers** are still constructed by nothing; `level-scene.ts` owns character drawing.
- **`data-tn-level="ready"` now means *playable*, not *loaded*.** It used to be written when
  `renderer.loadLevel` resolved, which is before Phaser boots the scene: the camera, the affordances and the
  keyboard keys are all created in `create`, one or more frames later. The page therefore said "ready", the
  waiting screen came down, and a key pressed in that window reached a scene that did not exist — measured
  with a 1.5 s delay on the level's textures, lost two runs in three. It is written from
  `GameRendererOptions.onLevelReady` now, and the waiting screen comes down with it, which is what
  `TN-WAIT-01`'s "the waiting screen goes when the level is playable" actually asks for. Any suite that waits
  on that attribute is waiting on a level it can really drive.
- **The build-status caption is now dead code.** Nothing under `app/` imports `app/ui/build-status.ts`: the
  title screen replaced the sentence it existed to say. Under ADR-0015 it should be pruned — the module, its
  unit suite, and the two comments in `app/adapters/phaser/boot-scene.ts` that point at it. Left in place
  deliberately, because `boot-scene.ts` belongs to the engine agent and three agents were writing to this
  tree at once.
- **The accessibility claim is narrower than it sounds — and is now half as narrow.** The axe checks used to
  run only against a dev-server harness that mounts components directly. Task 1.20 added the scan of `dist/`:
  the shipped page, through the door a visitor opens, with `region` and `landmark-one-main` on. That covers
  the title screen and the map. The level and its modals, and every screen of Exam mode, are still harness
  only, so no report may yet describe the suite as proving the shipped *game* — only its front door
  (`OQ-TEST-2`).
- **The officer is a rounded rectangle and the Peace Tower is not drawn.** `level-scene.ts` paints every
  character with `fillRoundedRect` unconditionally. The reference-critical red serge — the stated reason
  Ottawa was chosen first — is not in the running game.
- **ADR-0008 cannot see this.** Its gate reads import edges, so a port with two implementations looks
  consumed even when nothing constructs either. "A port exists when something calls it" is satisfied by an
  implementation nothing composes.

- **`OQ-SCHEMA-1`'s two schema changes landed on 2026-09-09, and Exam mode is now buildable.**
  `content/schemas/quest.schema.json` carries `declinedLine`, `reminderLine`, `afterLine` and `doneLine`
  (ADR-0010, amended — a giver's line is quest content, and `OQ-DIALOGUE-2` is ruled quest-level);
  `content/schemas/progress.schema.json` carries an `answers[]` record per attempt, a nullable
  `examInProgress` beside `exams`, and no `askedQuestionIds` or `correctCount` (ADR-0027). **The save format
  is version 3** and the 2 -> 3 step drops version-2 attempts, which cannot be converted and which no player
  holds. Two things are still owed by other owners: the three Ottawa copy rows have to move into the quest
  document and `validate-content` needs the speaker cross-check (ADR-0010 carries the dated marker, owner=content), and
  **Exam mode itself is unbuilt — this change made it buildable and built none of it.**
- **A schema with no documents was never compiled, so two of them were broken.**
  `tests/unit/contracts/every-schema-compiles.test.ts` compiles every file in `content/schemas/` with ajv
  configured as the content gate configures it. It found `character.schema.json` carrying the same
  `strictRequired` defect `quest.schema.json` had — a conditional branch requiring properties it did not
  declare — which meant the character schema had never validated anything. Fixed in the same change;
  ADR-0024 §4 carries the rule.
