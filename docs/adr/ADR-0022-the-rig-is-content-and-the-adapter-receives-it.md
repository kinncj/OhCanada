# ADR-0022: The rig is content the application reads, and the adapter receives it rather than fetching it

- Status: Accepted (2026-09-08)

## Context

`level-scene.ts` paints every character as a rounded rectangle. The red serge — the reference-critical
uniform that was the stated reason Ottawa went first — is not in the running game. The user has seen it and
named it as the thing to fix. It is the most visible defect in the project, and it was blocked on this
decision.

The engine agent found the cause before writing code rather than halfway through it, which is why this is a
design question and not a rescue. **The atlas that shipped and the renderer that shipped are different
models:**

| | Model |
|---|---|
| `rig-contract.json`, and the 50 frames confirmed in `atlas/shared@1x` | a **cut-out puppet** — 20 parts, one atlas frame each, placed by `pivot`, `z` and `mirrorX`, animated by per-state keyframes of `[rotation, dx, dy]` lerped on `t` across 8 states |
| `sprite-character-renderer.ts` | a **flipbook** — frames named `<artboard>/<layer>/<option>/<clip>/<index>`, advanced at 12 fps, one layer per skin slot |

Drawing the officer from the shipped atlas means giving the sprite renderer the puppet's
frame-resolution and animation model. That means the renderer needs `parts`, `states`, `frames` and
`selector` — which is verbatim the condition ADR-0017 §5 wrote down for its own reversal.

## Decision

### 1. The puppet model wins, and not on preference

The two models are not interchangeable, and the reason is a requirement rather than a taste:

**A flipbook bakes a combination; a puppet composes one.** Ottawa's rig offers 6 skin tones × 4 hair shapes ×
5 hair colours × 2 head coverings × 2 features = **480 player-selectable appearances**, 960 with both
costumes. A pre-rendered flipbook needs a frame per combination per keyframe per state; the puppet needs 21
drawings and composites them. `docs/content-review.md` §8.2 makes slot independence — every option in every
slot available with every option in every other — the anti-caricature check, and ADR-0017 built the
`hairShape`/`hairColour` split to keep a coupling from hiding inside one list.

**Only the puppet can express that requirement at all.** So "re-render the atlas as a flipbook so the current
renderer works unchanged" is not a live alternative, and the cut-out atlas was not an arbitrary authoring
choice.

### 2. The rig is content. `ContentRepository` reads it; the adapter does not

**The sprite adapter does not open `content/characters/rig.json`.** `ContentRepository` gains
`rig(): Promise<Result<RigDocument>>` and the rig reaches a renderer through `CharacterRendererSpec` — the
same field-of-the-same-spec route that already makes `skinSlots` and `skinOptions` identical in both backends
rather than merely agreed.

This is not a way around ADR-0017 §5; §5 fires in full, and §3 below honours it. It is the layering rule:
`ContentRepository` is the port that hides fetch, ajv and caching, and an adapter that opened a content
document itself would bypass validation, caching and `unload` — the last of which is how the texture budget
is honoured at all (ADR-0013). Neither renderer does content I/O today, and this keeps that true.

One rig, every character, so it is fetched once and cached like any other document.

### 3. ADR-0017 §5's condition has fired: the skip is deleted and eighteen shapes are mirrored

`rig.schema.json` is removed from `SKIPPED_SCHEMAS` in `ports-match-schemas.test.ts`, and the cascade that
covered its seventeen `$defs` goes with it. `RigDocument`, `Dimensions`, `CharacterSpace`, `RigArtboard`,
`RigStateMachine`, `RigStateMachineInput`, `RigSelector`, `RigSelectorRule`, `RigExpressions`, `RigEvent`,
`RigSlots`, `RigSlot`, `SlotIndependence`, `RigPart`, `RigAtlas`, `RigState`, `RigKeyframe` and `RigFrame`
now live in `app/application/ports/content-repository.ts`, beside every other content-document type.

They are in that file rather than a new one deliberately: a new port file with no consumer under `app/` would
need an ADR-0008 `PROVISIONAL` marker it would carry for exactly as long as it took engine to wire the first
call, and these are content-document types, which is what `content-repository.ts` is for.

**§5's condition was written a day before it fired, and that is the result to notice.** An exemption that
names the thing which would revoke it gets revoked on schedule, by whoever hits the condition, rather than
argued about — which is the whole bargain ADR-0008 proposed and the first time it has paid out.

### 4. What does not change, and the one number that does

The port, the swap conformance suite and the measurement *method* survive. Both backends still answer slot
names out of the same field of the same spec; `selector` is the ordered table both evaluate, so a conformance
test can drive each through it and compare the selected state. **The seam survives the model change, which is
the evidence that it was a seam and not a shape.**

The sprite backend's cost figure does **not** survive, and it is withdrawn here rather than carried forward:

| | Layers/parts drawn | Cost per character |
|---|---|---|
| Measured on the flipbook renderer | 4 composited layers | 0.008–0.026 ms |
| Estimated on the puppet renderer | **20 parts** | **~0.05–0.15 ms** |

Fill area is similar — the parts overlap into one silhouette — but draw calls go **4 → 20**. The old figure
was measured against a renderer that cannot draw the shipped atlas, so it describes something that will not
ship. It is quoted here only so nobody finds it in a report and reuses it.

Two honesty notes on the replacement, because a number in an ADR gets treated as measured:

- **It is an estimate, not a measurement.** It should be replaced by a real one when the puppet renderer
  exists, and the estimate should not be the thing a gate asserts against.
- **Say which quantity, every time.** 0.05–0.15 ms *per character* is roughly ten times inside a 1.5 ms
  budget; *six characters* at that rate is 0.3–0.9 ms, which is 20–60 % of it. Those are different claims and
  the second is the one that decides whether six characters fit. ADR-0011's rule — a budget met at one tier
  and at another are different claims, and a gate reporting one number for both measures nothing — applies to
  per-character versus per-scene exactly as it does to tiers.

What genuinely does not move: the sprite backend still costs **zero uncounted VRAM**, which is the property
that matters against ADR-0013, and it is still far cheaper than Rive's measured 1.72 MiB of surface per
character.

## Alternatives considered

- **Re-render the atlas as a flipbook so the existing renderer works unchanged.** The only option that touches
  no architecture, and it is unavailable: it bakes 480 combinations into pre-rendered frames, destroying slot
  independence and exploding the texture budget ADR-0013 exists to defend. See §1. This is the alternative
  that decided the ADR.
- **The sprite adapter opens `content/characters/rig.json` itself.** The literal reading of ADR-0017 §5, and
  it is a layering violation: it bypasses ajv validation, the cache and `unload`. §5 said the document would
  be "read by the application", and the application reads it — through the port that exists for reading
  documents.
- **Bake the puppet data into atlas metadata at build time**, so the adapter reads only what it already reads.
  Rejected as renaming rather than solving: the animation data has to reach the renderer whatever file it
  arrives in, so this buys no layering and loses the schema, the contract test and the human-readable source.
- **Put the rig on `CharacterDocument` per character.** Rejected by ADR-0017: the rig is *shared*, one
  skeleton for every character, and copying several thousand numbers per character makes "cartoon proportions
  are identical for all characters" a convention held by copy-paste rather than a fact.
- **Keep the rig types out of the ports and let the adapter define its own.** Rejected: two declarations of
  one document is precisely the `character.schema.json`/`rig.schema.json` overlap ADR-0017 named as a boundary
  defect, and it would put the shapes outside the schema-to-port gate that just caught three of my own errors
  in them.
- **Ship the rounded rectangles for now and fix the model in slice 2.** Rejected. The uniform is the reason
  the level exists, the user has named it, and the blocking question turned out to be one decision rather
  than a rewrite.

## Consequences

- **The most visible defect in the project is unblocked**, and the port types are the artefact that unblocks
  it. Engine writes the renderer; the shapes it compiles against are here.
- **Eighteen interfaces of mostly-data now sit in the ports layer.** That is a real cost and it is the price
  ADR-0007 sets for a document the application reads. It is bounded: the schema-to-port gate checks names,
  optionality *and* value types bidirectionally, so the file cannot drift from the schema — three deliberate
  mutations (a `number` z made `string`, a 2-tuple pivot made 3, a dropped `loop` enum member) each failed
  exactly one case, and stripping the `CharacterId` brand off `RigArtboard.characterId` failed too.
- **A latent defect in the schema-to-port gate surfaced and is fixed.** `RigStateMachineInput.fallback?:
  boolean | number` was reported as "`undefined` satisfies no branch the schema offers". The gate collapsed
  `T | undefined` to `T` only when a single branch remained and gave up on a union of two or more, so
  optionality leaked out of the name level — where it is already checked — into the value level, where the
  schema has no vocabulary for it. `undefined` is now dropped where a union is taken apart. **No optional
  union-typed property existed in any schema before the rig**, which is why a gate that has caught real
  drift twice had never met this.
- **`ContentRepository.rig()` has no caller until engine lands one.** ADR-0008's gate is file-level and
  `content-repository.ts` is consumed, so nothing fails — and ADR-0015 is explicit that a member with no
  caller is found by review, not by CI. It is named here so the review has happened: the caller is the
  blocking task, not a hypothetical.
- **`content/characters/rig.json` still does not exist.** ADR-0017 §7's obligation to move it from
  `assets/style/rig-contract.json` is now on the critical path rather than tidying, because `rig()` has to
  fetch something from `content/`.
