# TrueNorth — architecture

The shape of the system, and why it is that shape. Decisions live in `docs/adr/`; this file shows how
they fit together. If a diagram and an ADR disagree, the ADR wins and this file is the bug.

One sentence: **the engine changes more often than the rules, so the rules do not know the engine exists.**

Every boundary in this file is defended by something that fails a build, never by a convention: layering by
`.dependency-cruiser.cjs`, content shapes by `make validate-content`, unimplemented ports by the
`PROVISIONAL` contract test, and dated commitments in documents by the obligation gate specified in
**ADR-0009**. If a rule here has no gate behind it, that is stated where the rule is.

## 1. Layers

`app/domain` is entities and pure rules. `app/application` is use cases and ports — interfaces only.
`app/adapters/*` implement those ports, one technology per directory. `app/ui` is accessible DOM.
`app/bootstrap` is the only place a concrete is chosen. `common/` is a leaf both sides may use.

Imports point inward. Facts travel outward on the typed event bus. Nothing points sideways:
adapters never import each other, and the UI never imports an adapter.

```mermaid
flowchart TB
  BOOT["app/bootstrap<br/>composition root — the only place<br/>concretes are constructed and wired"]

  subgraph DRIVING["driving side — turns the world into intent"]
    INPUT["app/adapters/input<br/>touch · keyboard · gamepad · switch"]
    UI["app/ui<br/>DOM screens, ARIA roles"]
  end

  subgraph DRIVEN["driven side — carries out effects"]
    PHASER["app/adapters/phaser<br/>scenes, camera, arcade physics"]
    RIVE["app/adapters/rive<br/>ICharacterRenderer"]
    AUDIO["app/adapters/audio<br/>howler"]
    I18N["app/adapters/i18n<br/>i18next"]
    PERSIST["app/adapters/persistence<br/>localStorage + save codec"]
  end

  BUS(["common/event-bus<br/>typed publish / subscribe"])

  APP["app/application<br/>use cases + ports<br/>StartQuest · AnswerQuestion · ScheduleReview<br/>UnlockLevel · SaveProgress · RunExam"]
  DOMAIN["app/domain<br/>Player · Level · Quest · Question<br/>Progress · Character · QuestionScheduler<br/>+ locomotion strategies"]
  COMMON["common/<br/>Result · EventBus<br/>imports nothing from app/"]

  BOOT -.->|constructs| DRIVING
  BOOT -.->|constructs| DRIVEN
  BOOT -.->|constructs| APP

  INPUT -->|implements InputPort| APP
  UI -->|calls use cases| APP
  PHASER -->|implements ports| APP
  RIVE -->|implements ICharacterRenderer| APP
  AUDIO -->|implements AudioPort| APP
  I18N -->|implements LocalizerPort| APP
  PERSIST -->|implements ProgressRepository, SaveCodec| APP

  APP --> DOMAIN
  APP --> COMMON
  DOMAIN --> COMMON

  APP ==>|emits facts| BUS
  BUS ==>|delivers| PHASER
  BUS ==>|delivers| UI
  BUS ==>|delivers| AUDIO

  classDef core fill:#0b3d2e,stroke:#0b3d2e,color:#fff
  classDef bus fill:#7a3b0b,stroke:#7a3b0b,color:#fff
  class APP,DOMAIN,COMMON core
  class BUS bus
```

`.dependency-cruiser.cjs` is this picture, written as twelve rules, run by `make lint`. Every rule carries a
`comment` saying which boundary it defends. A violation fails CI; there are no warnings. Ten rules constrain
what a layer may import; two, added by amendment to ADR-0005, constrain who may import *it* —
`app/adapters` and `app/ui` may take the id vocabulary from `app/domain/ids` and nothing else from the
domain, and an adapter may not import `app/application/use-cases`, because an adapter is driven and never
driving.

## 2. A frame

The scene owns rendering and nothing else. It samples intent, asks the application to advance the world,
and applies what comes back. The domain decides; the bus announces; the renderers react.

The DOM UI and the Phaser canvas receive the *same* facts. That is what keeps the live region honest:
if the canvas shows it, the announcement was published, so the live region has it too.

```mermaid
sequenceDiagram
  autonumber
  participant IN as input adapter
  participant SCENE as Phaser scene
  participant UC as application use case
  participant DOM as domain rule
  participant BUS as event bus
  participant UI as DOM UI + live region
  participant AUD as audio adapter
  participant CR as ICharacterRenderer

  SCENE->>IN: snapshot()
  IN-->>SCENE: InputSnapshot (held / pressed / moveAxis)
  SCENE->>UC: advance(dt, snapshot)
  UC->>UC: snapshot → LocomotionIntent
  UC->>DOM: locomotion.step(state, intent, dt)
  DOM-->>UC: next state + events (pure)
  opt player engaged an NPC or POI
    UC->>DOM: startQuestStep / answerQuestion(clock, random)
    DOM-->>UC: outcome + next review schedule
  end
  UC->>BUS: emit("player/moved", "quest/step-completed", ...)
  BUS-->>SCENE: apply transform, camera, parallax
  BUS-->>CR: setNumber(speed) · fire(jump) · update(dt)
  BUS-->>UI: render question card, announce in live region
  BUS-->>AUD: play cue (+ caption key for the subtitle)
  SCENE->>SCENE: draw
```

Three consequences worth stating plainly:

- The domain takes `Clock` and `RandomSource` as arguments. It never reads `Date.now()` or `Math.random()`,
  so an exam draw is replayable from its seed and a spaced-repetition test does not need to freeze time.
- `Locomotion.step` is pure. Adding canoe, skate, bike, train, horse, skateboard or dogsled is one strategy
  plus level JSON — the scene above does not change, because it never learns the mode.
- Nothing in this sequence is Phaser-specific except the two boxes labelled Phaser.

## 3. Level load and unload

The budget is the design driver: **≤ 64 MB decoded texture memory per level on iPhone, and the previous
level is released before the next one is loaded** (CLAUDE.md, Budgets). So unload is not cleanup after
the fact — it is a step the next load waits for.

The loader admits a level only if the manifest's declared `decodedBytes` fit the ceiling. That check is
static and runs in CI too, so a level that cannot fit is a failing build, not a crash on a phone.

```mermaid
flowchart TB
  REQ["level requested<br/>(world map or quest chain)"]
  IDX["ContentRepository.levelIndex()<br/>cheap — no payloads"]

  subgraph UNLOAD["1 · release the current level — before anything new is fetched"]
    direction TB
    UNL["scene.shutdown()"] --> BUSC["eventBus.clear()<br/>drop every subscription"]
    BUSC --> CRD["ICharacterRenderer.dispose() per character,<br/>then factory.disposeShared()"]
    CRD --> TEX["texture manager: remove atlases,<br/>destroy render textures"]
    TEX --> AUN["AudioPort.unload(levelId)"]
    AUN --> CUN["ContentRepository.unload(levelId)"]
  end

  MEAS{"decoded texture bytes<br/>back to baseline?"}
  LEAK["fail loudly in dev,<br/>report the leaked texture keys"]
  BUDGET{"manifest sum of decodedBytes<br/>+ shared baseline ≤ 64 MB?"}
  REJECT["reject at load time — and in CI,<br/>so a level that cannot fit<br/>is a failing build, not a crash"]

  subgraph LOADING["2 · load the next level"]
    direction TB
    LOAD["ContentRepository.level(id)<br/>schema-validated JSON"] --> ASSETS["queue LevelAssetRefs:<br/>atlases · Rive · audio · fonts"]
    ASSETS --> DECODE["decode + upload to GPU,<br/>accumulating decodedBytes"]
    DECODE --> STRAT["LocomotionFactory.create(tuning)<br/>per mode declared in the level"]
    STRAT --> CHARS["CharacterRendererFactory.create(spec)<br/>Rive, or sprite atlas on the low tier"]
  end

  READY["emit level/ready<br/>scene starts, UI enables input"]

  REQ --> IDX --> UNL
  CUN --> MEAS
  MEAS -->|no| LEAK
  MEAS -->|yes| BUDGET
  BUDGET -->|no| REJECT
  BUDGET -->|yes| LOAD
  CHARS --> READY

  classDef bad fill:#7a1020,stroke:#7a1020,color:#fff
  class LEAK,REJECT bad
```

`ContentRepository.unload`, `AudioPort.unload` and `CharacterRendererFactory.disposeShared` exist only
because of this diagram. They are on the ports so that no scene has to remember to call them.

## 4. Content pipeline

Facts are paraphrased from *Discover Canada* on canada.ca, chapter-referenced, and verified before they
ship (ADR-0003). The load-bearing rule is a **separation of duties**: the author writes the question and
may never set its verification status; the verifier grants or refuses status and may never edit the text.
A single agent doing both would be marking its own homework, and the status would mean nothing.

Status is granted against a `sourceHash`. If canada.ca changes, the hash changes, the status no longer
matches, and the question falls out of the build — automatically, without anyone noticing the edit.

The verifier writes five fields and only five (ADR-0003, mirrored by `QuestionVerification` in
`app/application/ports/content-repository.ts`): `status`, `model`, `checkedAt`, `sourceHash` and
`evidence`. `evidence` is the passage from the cited section quoted exactly, and it is the field that makes
ADR-0003's "the bank is auditable" consequence true — a `verified` status with no quoted passage is an
assertion, not an audit trail. An earlier draft of the port dropped it; nothing may drop it again.

```mermaid
flowchart TB
  SRC["canada.ca — Discover Canada<br/>fetched to content/sources/ with a sourceHash"]

  subgraph AUTHORING["author agent — writes text, never grants status"]
    direction TB
    WRITE["draft question: prompt + 3 distractors,<br/>EN and FR, non-verbatim,<br/>plain language (~CLB 4)"]
    WRITE --> CITE["cite chapter + sourceHash + asOf,<br/>set verification.status = unverified"]
  end

  SCHEMA{"make validate-content<br/>JSON Schema 2020-12 + ajv,<br/>$schema declared,<br/>unknown properties rejected"}
  BACK1["returned to the author"]

  subgraph VERIFICATION["verifier agent — grants status, never edits text"]
    direction TB
    VERIFY["re-read the claim against the cited chapter<br/>at the recorded sourceHash,<br/>quoting the supporting passage as evidence"]
    VERIFY --> JUDGE{"passage found, answer entailed by it,<br/>no distractor entailed, non-verbatim,<br/>EN and FR present?"}
    JUDGE -->|no| REJ["status = rejected, with a reason.<br/>The text itself is untouched."]
    JUDGE -->|yes| VER["status = verified for this sourceHash,<br/>with model, checkedAt and the quoted evidence"]
  end

  DRIFT{"sourceHash still current?<br/>volatile item re-checked every run,<br/>asOf within 180 days?"}
  QUAR["status = quarantined —<br/>excluded from the build until re-verified"]
  GATE{"≥ 30 verified questions<br/>for this subject?"}
  HOLD["the level does not ship yet"]
  BUILD["make build —<br/>only verified questions are bundled"]
  RUNTIME["runtime: ContentRepository re-validates<br/>against the same schemas on load"]

  SRC --> WRITE
  CITE --> SCHEMA
  SCHEMA -->|fails| BACK1
  SCHEMA -->|passes| VERIFY
  REJ --> BACK1
  BACK1 --> WRITE
  VER --> DRIFT
  DRIFT -->|no| QUAR
  DRIFT -->|yes| GATE
  QUAR --> VERIFY
  GATE -->|no| HOLD
  GATE -->|yes| BUILD
  BUILD --> RUNTIME

  classDef bad fill:#7a1020,stroke:#7a1020,color:#fff
  class REJ,QUAR,HOLD,BACK1 bad
```

Indigenous content passes `docs/content-review.md` as well: name the nation depicted, no invented patterns,
no sacred items as props, no caricature, identical cartoon proportions for every character.

## 5. Ports

All under `app/application/ports/`, re-exported from `index.ts`. Interfaces and types only.

`PROVISIONAL` in the last column means nothing imports the port and nothing implements it: it is a design
sketch that happens to be type-checked, and the first implementer may change it without an ADR (ADR-0008).
The column is enforced, not maintained by hand — `tests/unit/contracts/ports-are-provisional.test.ts` fails
if a port is unconsumed and unmarked, and fails again if the marker outlives the first caller.

| Port | Hides | Notes | State |
|---|---|---|---|
| `ContentRepository` | fetch, ajv, caching | Async, `Result`-returning; `unload` serves the texture budget | Consumed by the Phaser boot adapter |
| `ProgressRepository` | `localStorage`, quota, private mode | `ok(null)` means "no save", not "storage failed" | `PROVISIONAL` → slice 1 task 1.6 |
| `SaveCodec` | the export/import format | `decode` validates and migrates; never trusts its input | `PROVISIONAL` → slice 1 task 1.6 |
| `Clock` | `Date.now`, `performance.now` | `now`/`nowIso` for scheduling, `elapsed` monotonic for timers | `PROVISIONAL` → slice 1 tasks 1.4, 1.5 |
| `RandomSource` | `Math.random` | Seeded variant makes an exam draw replayable | `PROVISIONAL` → slice 1 task 1.4 |
| `ICharacterRenderer` | Rive vs. sprite atlas | Identical artboard, input, slot and expression names in both | `PROVISIONAL` → slice 1 tasks 1.11, 1.12 |
| `Locomotion` | how a mode moves | Pure `step`; implementations live in the domain | `PROVISIONAL` → slice 1 task 1.14 |
| `AudioPort` | howler, autoplay unlock | Every cue carries a `captionKey` — sound always has a visual twin | `PROVISIONAL`, **no task** — delete it if slice 2 closes without an audio adapter |
| `LocalizerPort` | i18next | No literal player-facing string exists anywhere else | `PROVISIONAL` → slice 1 task 1.15 |
| `InputPort` | touch, keyboard, gamepad, switch | Keyboard bindings keyed by `KeyboardEvent.code` | `PROVISIONAL` → slice 1 task 1.15 |

### The character seam

ADR-0001 puts Rive behind `ICharacterRenderer` with a sprite-sheet fallback. The seam only works because
both backends speak the same four things: a **named artboard**, **state-machine inputs** (bool, number,
trigger), **skin slot names** with matching option names, and **named expressions**. The sprite adapter
derives its animation selection from exactly the inputs the Rive state machine consumes, and its atlas
frame prefixes *are* the slot names. Swapping backend is a bootstrap decision keyed on device tier, and
gameplay cannot tell which one it got.

### The locomotion seam

A level's JSON supplies a `LocomotionTuning` per mode: `maxSpeed`, `acceleration`, `deceleration`,
`turnAcceleration`, `glide` (how much momentum survives a release — near 1 on ice and water),
`maxSpeedMultiplierDownhill`, `drive` (`held` or `auto`), a `jump` affordance or `null` when the mode
cannot jump, an `interaction` affordance or `null` when the player must dismount first, the character
state-machine inputs the mode drives, and a `labelKey`.

Because every difference between walking and dogsledding is a number or a `null` in that record, adding a
mode is **data plus one pure strategy registered with `LocomotionFactory`**. No scene, camera or input
handler changes. An unregistered mode fails as `unsupported` at load time, not mid-level.

## 6. Seams deliberately left open

Named here so a later slice picks them up on purpose rather than inventing them under pressure.

- **Event map.** `createEventBus` is generic over an event map; the game's actual map (`player/moved`,
  `quest/step-completed`, `question/answered`, `level/ready`) is declared in slice 1 with the use cases
  that emit it. Declaring names before there is a producer would be guessing.
- **Domain entities.** `app/domain/ids.ts` fixes the id vocabulary. `Player`, `Quest`, `Level`, `Question`,
  `Progress`, `Character` and `QuestionScheduler` belong to the domain agent in slice 1. The port document
  types (`LevelDocument`, `QuestionDocument`, …) are the *validated content shapes*, deliberately distinct
  from the entities built out of them — the content schemas remain the authority on the full shape
  (ADR-0007), which means a port type mirrors its schema exactly rather than declaring a subset.
- **Content schemas not written yet.** `content/schemas/` holds `common`, `game.config` and `credits`.
  `GameConfigDocument` is reconciled against its schema property for property; every other document shape is
  marked `SPECULATIVE` because no validator backs it, and that marker is now enforced — the contract test
  walks out from every exported `*Document`, `*Snapshot` and `*Bundle` type through its property types and
  requires each shape it reaches to be either schema-bound or marked. Slice 1 writes `level`, `quest`,
  `question`, `character` and `locale` schemas *first*, then reconciles the types — plus
  `progress.schema.json`, which the save file needs and which `SaveCodec.decode` already promises to
  validate against.
- **How a question carries its EN and FR text.** Undecided, and it must be settled by task 1.2 before a
  question is authored. `QuestionDocument` declares `promptKey`, `optionKeys` and `explanationKey`, which
  puts the wording in a locale bundle; `common.schema.json` already defines a `localizedText` `$def`
  (`{ en, fr }`, both required) that nothing references, which points the other way, and ADR-0003's CI gate
  is phrased per question ("missing EN or FR text"). Keys keep one string table; inline `localizedText` keeps
  a question, its source, its evidence and its two languages in one reviewable file, which is what the
  verifier actually reads. The agent prompts name the port's fields today and say the schema wins.
- **`evidence` has no mechanical gate yet.** The port requires the field to *exist* on every
  `QuestionVerification`, and the contract test checks that the port matches its schema — but
  `question.schema.json` does not exist, so nothing yet fails a build for a question marked `verified`
  with an empty `evidence` string. That is the one part of ADR-0003 I cannot express mechanically today.
  It closes in slice 1: task 1.2 makes the schema require a non-empty `evidence` whenever `status` is
  `verified`, and task 1.17 makes `verify-content` fail on it.
- **Four verification statuses in the port, three in ADR-0003.** ADR-0003 names `unverified`, `verified`
  and `quarantined`; the port and the diagram above also carry `rejected`, drawing a line between a
  verifier judgement that failed (`rejected`, back to the author) and a status invalidated later by drift
  (`quarantined`, back to the verifier). The distinction is useful and the ADR does not forbid it, but it
  was never decided. Task 1.2 settles it in `question.schema.json`; if the schema keeps four, ADR-0003
  gets an amendment naming the fourth rather than the schema quietly widening the ADR.
- **Id constructors.** Ids are branded types with no parse functions yet; the content adapter casts once,
  immediately after schema validation. `parseLevelId`-style validators land with the entities.
- **Device tiers.** Which tier gets Rive and which gets the sprite atlas is a bootstrap policy; the
  detection rule is not written yet, and no port needs to know it.
- **Save migration.** `SaveCodec` declares `version` and `minSupportedVersion`. The first migration is
  written when there is a second version — not before.
- **Ports not yet needed.** No telemetry port and no network port exist, because there is no server, no
  account and no analytics (CLAUDE.md, Storage). If one is ever proposed, it needs an ADR, not a file.
