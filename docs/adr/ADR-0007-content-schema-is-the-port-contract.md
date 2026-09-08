# ADR-0007: The content schema is the port contract

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: the enforcement gap recorded in Consequences was closed; that bullet said
  the rule was enforced by review and is now wrong. See the enforcement bullets below.
- Amended 2026-09-08 (second): two of the three gaps this ADR recorded honestly but left to review
  are now mechanical — sub-objects declared inline, and document types with no schema. The
  `SPECULATIVE` rule is also scoped properly here: it is about *content and persisted documents*,
  and ADR-0008 covers the different question of a port nothing has ever implemented.

## Context
`app/application/ports/content-repository.ts` declares TypeScript shapes for every authored document, and
`content/schemas/*.schema.json` declares the same shapes for the validator. Two declarations of one thing.
They drifted on the first slice: the port declared `levelOrder` where the schema and the shipped file say
`levels`, and omitted `title`, `version`, `designWidth`, `designHeight` and `featureFlags` — all five
required by the schema and all five already read by the Phaser boot adapter. The adapter compensated by
parsing the raw JSON itself, which hid the drift behind a second, hand-written definition of the same
document. Nothing failed, which is the problem: the port looked authoritative and was wrong.

The port also declared level, quest, question, character and locale documents for which no schema exists.
The port's own contract says "a returned document has already passed schema validation". For those five that
promise cannot be kept by anyone. A type that nothing validates reads exactly like a type that something
validates.

## Decision
- `content/schemas/*.schema.json` is the **single authority** on the shape of authored content. Every schema
  sets `additionalProperties: false`, so the schema is a closed statement, not a lower bound.
- A document interface in `app/application/ports` mirrors its schema **exactly**: same property names, same
  set, and TypeScript-optional if and only if the property is absent from the schema's `required`. Not a
  subset ("the minimum consumers rely on"), not a superset.
- **Schema first.** When a new content type is needed, the schema is written before the port type. A port
  type with no schema behind it is marked `SPECULATIVE` in its own doc comment, naming the schema file that
  does not exist yet, and may not be treated as a contract by any consumer. "Its own" is literal: a section
  banner above a run of declarations does not count, because one banner vouching for ten types is how a
  marker ends up describing a type nobody looked at.
- **`SPECULATIVE` is about documents, not about ports in general.** A *document* is anything authored or
  persisted — content JSON and the save file both qualify; the save file is authored by the previous session
  rather than by a content agent, and `SaveCodec.decode` makes exactly this ADR's promise about it. A
  behavioural seam (`Clock`, `AudioPort`, `InputPort`) will never have a schema and is not covered here; the
  separate question of a port nothing has ever implemented is ADR-0008's `PROVISIONAL` marker.
- **`*Document`, `*Snapshot` and `*Bundle` are reserved suffixes** for document shapes. The enforcement below
  starts its walk from them, so a per-frame value object must not borrow one (`InputSnapshot` was renamed to
  `InputFrame` for precisely this reason).
- **Every object shape lives at the root of a schema or in `$defs`, never inline under `properties` or
  `items`.** An inline object contributes one property *name* to its parent and its own shape is then
  compared with nothing at all: a schema saying `camera: { minZoom, maxZoom }` and a port saying
  `camera: { zoom }` are both green, `validate-content` passes, and the level ships reading `undefined`. That
  is the `levelOrder`/`levels` defect one level deeper. Put it in `$defs` and `$ref` it; the `$def` then gets
  an interface and a check of its own.
- A consumer that needs a property it cannot find adds it to the **schema**, then to the port type. Adding it
  to the port type alone makes the consumer depend on data no validator will ever check.
- The port type is the only place a document shape is declared in TypeScript. An adapter that needs a subset
  derives it from the port type (`Pick<GameConfigDocument, ...>`) rather than restating the fields.

## Alternatives considered
- **Generate the types from the schemas (`json-schema-to-typescript`) at build time.** Removes drift by
  construction and was the tempting answer. Rejected for now: generated types cannot carry branded ids
  (`LevelId`, `LocaleCode`), which is most of what the ids vocabulary buys us; the generator output would
  either land in the repo as a large reviewed artefact or become a build step on the critical path of a
  6 s time-to-play budget; and it puts a code generator inside `app/application`, a directory that is meant
  to hold nothing but hand-written interfaces. Revisit in slice 2 if drift recurs — the decision above is
  what makes generation a mechanical swap later.
- **Derive the schemas from the TypeScript types instead.** Inverts the authority so the port wins. Rejected:
  content is authored and reviewed by people and agents who do not read TypeScript (ADR-0003's verifier
  writes JSON), the validator runs in CI over files the type system never sees, and JSON Schema expresses
  constraints the type system cannot (patterns, ranges, `uniqueItems`) — those constraints are the reason
  the validation gate exists.
- **Keep the port as a deliberate minimal subset and let adapters read the rest of the JSON.** This is the
  status quo that produced the defect. Rejected: it gives every adapter a private, unvalidated second
  definition of the document, and it means "the config changed" is a change in N files instead of one.
- **Validate at runtime in the port and drop the schema files.** Rejected: it moves an ajv-sized dependency
  into the initial chunk and turns a CI-time authoring error into a runtime error in front of a player.

## Consequences
- Adding a property to a content document is a two-file change in a fixed order: schema, then port type.
  Concurrent work coordinates by declaring the property optional on both sides, as `theme` did here.
- `GameConfigDocument` now carries the whole config, including `budgets`, `graphicsPresets` and `exam`, which
  the application had no typed access to before. Sub-objects are exported (`ExamRules`, `SchedulerTuning`,
  `GraphicsPresets`, `PerformanceBudgets`, `FeatureFlags`, `UnlockRules`, `ThemeColours`) so a consumer can
  depend on one block instead of the whole document.
- The `SPECULATIVE` document types are visibly provisional, and the set is larger than this ADR first
  recorded. Slice 1 must write `level.schema.json`, `quest.schema.json`, `question.schema.json`,
  `character.schema.json` and `locale.schema.json` and reconcile each type against its schema before those
  documents are loaded — plus `progress.schema.json`, which the first version of this ADR missed entirely.
  `progress-repository.ts` declares five persisted shapes (`ProgressSnapshot`, `SettingsDocument`,
  `LevelProgressDocument`, `ReviewStateDocument`, `ExamAttemptDocument`) and `SaveCodec.decode` promises to
  "validate against the save schema" — a schema that does not exist, which makes that promise unkeepable by
  anyone. Slice 1 task 1.6 writes it. `locomotion.ts` is the other miss: `LocomotionTuning` is read straight
  out of a level's JSON, its header claimed "the content schema mirrors it", and no such schema exists. That
  sentence is deleted; the eleven-field record and its four satellites are marked.
- This rule **is** mechanically enforced, by `tests/unit/contracts/ports-match-schemas.test.ts`. It runs in
  `make test`, so it is a required check on every PR. It reads every file in `content/schemas/`, binds each
  object schema to a port interface by naming convention (`level.schema.json` -> `LevelDocument`; a `$defs`
  entry -> the interface named by its `title`, with explicit pairings for the few names chosen before this
  rule existed), takes the type side through the TypeScript compiler API so that inherited members and `?`
  are read from the symbol rather than from the source text, and asserts the two property sets are equal
  with the same required/optional split. It also asserts `additionalProperties: false` on every bound
  schema, since "exactly the same set" is only meaningful against a closed one. A schema that maps to no
  exported type fails with a message naming the missing interface; the only way out is a named entry, with a
  reason, in the test's skip tables, and an entry naming a file that no longer exists fails too, so the
  exemption list cannot quietly go stale. Bindings are derived, not listed, so the five SPECULATIVE types
  named above become checked the moment their schemas land, with no edit to the test.
- **Inline object schemas now fail the run.** The previous version of this ADR recorded that "sub-objects
  belong in `$defs`" was load-bearing and then left it to review, which is the same shape of mistake as the
  rule it replaced. The test now walks every subschema position JSON Schema 2020-12 defines — `properties`,
  `patternProperties`, `items`, `prefixItems`, `contains`, `additionalProperties`, `unevaluated*`,
  `propertyNames`, `allOf`/`anyOf`/`oneOf`/`not`/`if`/`then`/`else`, `dependentSchemas`, `$defs` — and fails
  on any node that lists `properties` outside the root or a top-level `$def`. It is a whole-file statement,
  not a check of the two places we happened to look. Verified by adding the reviewer's inline `telemetry`
  object plus a port interface with three unrelated property names: the property-set test still passed and
  the new one failed, which is the point.
- **Document types with no schema now fail the run too.** This closes the "schema -> type only" gap by
  walking the other direction. The test takes every exported `*Document`, `*Snapshot` or `*Bundle` type as a
  root and follows property types and base interfaces to build the closure of everything those documents are
  made of — so `LevelDocument.locomotion: readonly LocomotionTuning[]` drags in `LocomotionTuning`,
  `JumpAffordance`, `InteractionAffordance`, `LocomotionAnimationBinding`, `LocomotionMode` and
  `MovementDrive` with nobody remembering to list them. Every member of that closure is either bound to a
  schema or carries `SPECULATIVE` in its own doc comment. Both directions fail: an unmarked unbound type, and
  a marker left on a type whose schema has since landed. It found fourteen unmarked types on its first run.
- What that test still does **not** cover, recorded here so nobody reads it as more than it is:
  - **Types, formats and value constraints.** It compares property *names* and optionality, nothing else. A
    port declaring `questionCount: string` against a schema saying `"type": "integer"` passes, as does a
    `string` against a `pattern`, an `enum`, a `minimum` or `uniqueItems`, and `levels: readonly LevelId[]`
    passes against `levels: number`. The schema remains the only authority on values, and
    `make validate-content` remains the only thing that checks them — against content files, not against
    types. A type and a schema can agree on every key and still disagree about what the keys hold.
    **Assessment: this is slice 1 task 1.2's job, not a slice-0 fix.** Closing it means teaching the test the
    schema -> TypeScript type mapping, and the hard half of that mapping is ours by choice: a `$ref` to
    `common.schema.json#/$defs/id` must accept a *branded* `LevelId`, not merely a `string`, or the check
    either rejects every id we have or accepts every string, and branded ids are the one thing this ADR gave
    up code generation to keep. Written today it would be exercised by one schema, one document and zero
    branded properties. Written in 1.2 it is exercised by six schemas, every id in the game, arrays,
    nullables and enums on the day they are authored — which is the difference between a mapping that is
    tested and one that is guessed. The risk of deferring is bounded and named: between now and 1.2 the only
    checked document is `game.config.json`, whose types are already reconciled by hand.
  - **Ports with no schema and no document nature.** `Clock`, `AudioPort` and `InputPort` will never have a
    schema, so this ADR has nothing to say about them. ADR-0008 does.
  These are narrower gaps than the ones they replace. The original defect — a renamed property, five missing
  ones and an optional made required — is now reported in a single run, and so is a `camera` sub-object that
  disagrees with its port.
- The exemptions in the test's `SKIPPED_SCHEMAS` are correct and stay, but they are now **root-only**. The
  previous file-level skip also hid every object under that file's `$defs` — the narrowing this ADR said a
  future port "must" do, done now instead, because slice 1's schemas will `$ref`
  `common.schema.json#/$defs/localizedText` from every player-facing string and a file-level skip would have
  made all of them invisible on the day they landed. `common.schema.json` declares no root document: it is
  shared `$defs` (`id`, `locale`, `localizedText`, `hexColour`, `vec2`) referenced by other schemas and never
  validated against. `credits.schema.json` has no port type and needs none: credits are a build-time artefact
  (ADR-0004) written to `assets/credits.json`, checked by `scripts/verify-art.mjs` and
  `make validate-content`, and read by nothing under `app/`. If the game ever shows a credits screen, that
  screen reads a document, this ADR applies to it, and that entry is deleted.
- Every exemption table is now staleness-checked in both directions, which `SKIPPED_SCHEMAS` was and
  `SKIPPED_DEFS` and `TYPE_NAME_OVERRIDES` were not. An entry naming a file or a JSON pointer that no longer
  exists fails, so a rename cannot leave an exemption protecting nothing; and an entry whose port type has
  since been written fails too, so an exemption cannot outlive the reason for it. An override keyed on a
  pointer no schema declares renames nothing and fails on the same principle. The three `SKIPPED_DEFS`
  entries added with the root-only narrowing (`localizedText`, `vec2`, `creditedAsset`) all say the same
  thing — no port re-declares this shape, and per ADR-0008 none should be written before something reads it —
  and each fails the moment a port does.
