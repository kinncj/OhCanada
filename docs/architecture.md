# Architecture

TrueNorth is a single domain-centric repository (BusinessRepo). See ADR-0001..0006 in `docs/adr/`.

## Layers

```mermaid
flowchart TB
  subgraph common[common]
    Result --- EventBus --- SchemaValidator --- RNG
  end
  subgraph domain[app/domain — pure TS]
    Question --- Quest --- District --- Progress --- Exam --- Character --- Player
  end
  subgraph application[app/application — use cases + ports]
    UC[InitializeSession · CreateCharacter · StartQuest · AdvanceQuest · AnswerQuestion · UnlockDistrict · SaveProgress/Import/Export · CitizenshipExam · UpdateSettings]
    Ports[ContentRepository · ProgressRepository · SaveCodec · Clock · InputPort · PhysicsWorldPort · AudioPort · LocalizerPort]
  end
  subgraph adapters[app/adapters]
    Rendering[rendering: Three WebGPU/WebGL2, TSL post, CSM, HDRI]
    Physics[physics: Rapier]
    AI[ai: yuka]
    Input[input: keyboard/mouse/gamepad/touch]
    Persistence[persistence: localStorage + JSON codec]
    Content[content: import.meta.glob + Ajv]
    I18n[i18n: i18next]
    Audio[audio: howler]
  end
  subgraph ui[app/ui — DOM/CSS]
    Screens[Menu · Creator · HUD · Dialogue · Question · Journal · Exam · Settings · Pause]
  end
  Bootstrap[app/bootstrap — composition root: main.ts · Game · Flow · Telemetry]
  domain --> common
  application --> domain
  adapters --> application
  ui --> application
  Bootstrap --> adapters
  Bootstrap --> ui
  Bootstrap --> application
```

Rules are enforced by dependency-cruiser in `make lint`.

## Runtime systems and the event bus

```mermaid
sequenceDiagram
  participant Input
  participant Game as Game (bootstrap)
  participant Physics as Rapier
  participant Flow as Flow (bootstrap)
  participant UC as Use cases
  participant Bus as EventBus
  participant UI
  Input->>Game: poll() each fixed step (60 Hz)
  Game->>Physics: moveCharacter / step
  Game->>Bus: player:entered-trigger
  Bus->>Flow: on(player:entered-trigger)
  Flow->>UC: AdvanceQuest.execute({kind:'reached'})
  UC->>Bus: quest:updated | quest:completed | stamp:earned | district:unlocked
  Bus->>UI: HUD objective / toasts
  Flow->>UI: QuestionPanel.show(presented)
  UI->>UC: AnswerQuestion.answer(id, key)
  UC->>Bus: question:answered
```

## Scene streaming

```mermaid
stateDiagram-v2
  [*] --> Menu: boot (hub loaded as backdrop)
  Menu --> Creator: New journey
  Creator --> Hub: CreateCharacter → SaveProgress
  Menu --> Hub: Continue
  Hub --> Loading: portal + UnlockDistrict.travel (unlocked)
  Loading --> District: WorldScene(manifest) → physics colliders → NPC brains → HDRI → weather
  District --> Loading: portal back
  Loading --> Hub
  Hub --> Exam: Journal → Citizenship Ceremony (≥ 10 stamps) or practice
```

Only one district is resident at a time. `WorldScene.dispose()` frees geometry, BVH trees and instanced meshes; `PhysicsWorldPort.clearStatic()` drops its colliders.

## Save / load

```mermaid
flowchart LR
  Progress -- JsonSaveCodec.encode --> JSON
  JSON -- localStorage --> Disk[(truenorth.save.v1)]
  Disk -- load --> JSON2[JSON]
  JSON2 -- JSON.parse → Ajv(save.schema) → version check --> Progress2[Progress]
  Import[Imported file] -- same path, size-capped --> Progress2
```

## Content pipeline

```mermaid
flowchart LR
  Author[content/*.json + $schema] --> Validate[make validate-content\nAjv 2020-12 · cross-refs · volatile ≤ 180 d · EN/FR parity · credits]
  Validate --> Build[vite build\nimport.meta.glob lazy chunks]
  Build --> Runtime[StaticContentRepository\nAjv at load]
  Assets[assets/src/manifest.json] --> Pipeline[make assets\nfetch CC0 · draco/meshopt · ktx2 · procedural audio]
  Pipeline --> Credits[assets/credits.json]
  Pipeline --> Dist[assets/dist → Vite publicDir]
```
