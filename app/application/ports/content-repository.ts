/**
 * ContentRepository — the only way the application reads authored content.
 *
 * Everything a level needs is data (ADR-0005): levels, quests, questions,
 * characters and locale bundles are JSON validated against `content/schemas`
 * before they cross this seam. Every document type below now has a schema, and
 * `tests/unit/contracts/ports-match-schemas.test.ts` compares the two property
 * by property *and type by type*, so the contract below is checked rather than
 * asserted. The implementation (fetch + ajv + cache) is an adapter; nothing here
 * knows about HTTP, bundlers or the file system.
 *
 * Contract:
 *  - every read is async and returns `Result` — a missing or invalid document is
 *    an expected failure, not an exception;
 *  - a returned document has already passed schema validation, so callers may
 *    trust its shape but must still trust nothing about game rules;
 *  - `unload` exists because of the 64 MB decoded-texture budget: the previous
 *    level is released before the next one is loaded (CLAUDE.md, Budgets).
 */

import type {
  CharacterId,
  IsoInstant,
  LevelId,
  LocaleCode,
  PoiId,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';
import type { Result } from '@common/result';
import type { LocomotionTuning } from './locomotion';

/**
 * The document types below mirror `content/schemas/*.schema.json` exactly: same
 * properties, same optionality, same names, same value types. The schema is the
 * authority — it is what `make validate-content` runs in CI and it sets
 * `additionalProperties: false`, so a port that declares a property the schema
 * does not have is a defect, not a convenience.
 *
 * Keep every type structural and dumb — behaviour belongs to the domain entities
 * built from them.
 */

/* --------------------------------------------------------------------------
 * shared value types — schema: content/schemas/common.schema.json
 * ----------------------------------------------------------------------- */

/**
 * A string in every supported locale, `common.schema.json#/$defs/localizedText`.
 *
 * Both languages are required by the schema, which is how ADR-0003's "missing EN
 * or FR text" clause is enforced per document rather than per string table
 * (ADR-0010). Content documents carry their player-facing text as one of these;
 * engine and UI vocabulary reused across content stays a key in a locale bundle.
 */
export interface LocalizedText {
  readonly en: string;
  readonly fr: string;
}

/** A point, size or scroll factor in design-resolution pixels (1080x1920). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a claim about Canada comes from. Written by the author agent, never by
 * the verifier (ADR-0003).
 */
export interface FactSource {
  /**
   * The `id` of a `content/sources/<id>.json` manifest. Without it a chapter and
   * a hash point at nothing, and ADR-0003's mechanism — a status granted for a
   * hash, invalidated when the hash moves — has no second end.
   */
  readonly sourceId: string;
  /** Chapter or section heading, exactly as it appears in the cited source. */
  readonly chapter: string;
  /**
   * Page the claim was read from, when the source is paginated. Checked against
   * the cited chapter's range, and it is what lets a page-grain staleness flag be
   * evaluated per question rather than forcing every question in a long chapter
   * volatile.
   */
  readonly page?: number;
  /**
   * The passage the author read the claim from, copied exactly.
   *
   * Not the same field as `FactVerification.evidence`, and the difference is the
   * point: this says where the *wording* came from and is written by the author;
   * the verifier's says what entails the *answer*, and for a question with three
   * distractors those are often different sentences. Copied exactly because it
   * must be a contiguous passage of the cached extraction at the recorded hash —
   * a check that catches a fabricated citation before any verifier runs.
   */
  readonly quote: string;
  readonly url: string;
  /** SHA-256 of what the verifier read: the manifest's extracted text, or the file. */
  readonly sourceHash: string;
  readonly asOf: IsoInstant;
  /** Volatile facts are re-verified every run and quarantined after 180 days. */
  readonly volatile: boolean;
}

/**
 * The block ADR-0003's verifier agent writes, and the only block it may write.
 *
 * Four statuses, and the fourth is deliberate (ADR-0003, amended): `rejected` is
 * a verifier judgement that failed and goes back to the author; `quarantined` is
 * a granted status invalidated later by source drift or age and goes back to the
 * verifier. Both are excluded from the build.
 *
 * `evidence` is not optional detail. The schema requires it to be non-empty
 * whenever `status` is `verified`, together with a non-null `checkedAt`, a
 * non-empty `model` and a full `sourceHash`, so a status with no quoted passage
 * fails `make validate-content` and not only `verify-content`.
 */
export interface FactVerification {
  /** Only `verified` may ship. Set by the verifier agent, never by the author. */
  readonly status: 'unverified' | 'verified' | 'quarantined' | 'rejected';
  /** The model that granted the status, so a bad verifier run can be identified later. */
  readonly model: string;
  /** When the check ran. `null` while `status` is `unverified`. */
  readonly checkedAt: IsoInstant | null;
  /** The `sourceHash` the status was granted for; a mismatch invalidates it. */
  readonly sourceHash: string;
  /** The passage from the cited section that entails the claim, quoted exactly. */
  readonly evidence: string;
}

/**
 * Evidence that a named nation was copied from somewhere real
 * (`docs/content-review.md` §3.2). The source must be the nation's own published
 * material, or a registry that nation is listed in.
 *
 * What it proves is narrow: that the name appears on a page that was fetched and
 * hashed. Not that the name is right, that the nation would recognise the
 * spelling, or that this is the nation actually depicted.
 */
export interface NationSource {
  /** Whose material this is, named. */
  readonly publisher: string;
  readonly url: string;
  /** Empty until the verifier has fetched it. */
  readonly sourceHash: string;
  readonly asOf: IsoInstant | null;
  readonly verification: FactVerification;
}

/**
 * Whether the nation depicted has been asked, and what they said.
 *
 * `docs/content-review.md` §1 extends ADR-0003's separation of duties: **no agent
 * may grant cultural sign-off, ever.** An agent may write `not-sought` and
 * nothing else.
 *
 * Neither this type nor its schema can enforce that, and neither should be read
 * as doing so — a type constrains a value, not its author. What they do is force
 * a fabricated sign-off to name a person, an organisation, a date and a scope,
 * which is a specific and checkable lie rather than a flag flip, and force
 * `not-sought` to carry no names so a review cannot be half-claimed.
 *
 * The git-history gate landed in slice 1 and found that authorship is **not
 * establishable** from this repository — one identity per commit, no signatures —
 * so `verify-content`'s rule A3 refuses every transition off `not-sought`
 * outright. ADR-0003's 2026-09-08 amendment ratifies that: a genuine human
 * sign-off cannot be recorded today, the refusal is still correct, and the route
 * out is an identity the committer does not control — never a looser gate.
 */
export interface CommunityReview {
  readonly status: 'not-sought' | 'sought' | 'granted' | 'refused';
  /** Named person. `null` if and only if `status` is `not-sought`. */
  readonly reviewer: string | null;
  readonly organisation: string | null;
  readonly date: IsoInstant | null;
  /** What exactly was reviewed. A sign-off on a hat is not a sign-off on a character. */
  readonly scope: string | null;
  /**
   * Where the sign-off can be read, independently of this file: a URL to a
   * published statement, or a repository path to a committed letter. `null` if
   * and only if `status` is `not-sought`.
   *
   * The other four fields *name* a claim; this one *points at* the evidence.
   * Without it a later reader can only re-read the same assertion in the same
   * file. No schema and no gate can check that the artefact says what this block
   * claims — that is stated in ADR-0003's amendment rather than implied by the
   * field's presence.
   */
  readonly record: string | null;
  readonly note: string;
}

/**
 * Attached to player-facing prose outside the question bank — a landmark blurb, a
 * line of NPC dialogue — so ADR-0003 governs every sentence stating something
 * about Canada, not only the ones on a question card.
 *
 * `factual` is required rather than optional so the judgement is *recorded* for
 * every line instead of defaulting to unchecked; when it is true the schema
 * requires both other fields to be present.
 */
export interface FactClaim {
  /** Greetings and instructions are false; anything a player could be tested on is true. */
  readonly factual: boolean;
  readonly source: FactSource | null;
  readonly verification: FactVerification | null;
}

/* --------------------------------------------------------------------------
 * game.config.json — schema: content/schemas/game.config.schema.json
 * ----------------------------------------------------------------------- */

/** Which levels are playable at the start, and how the next one is earned. */
export interface UnlockRules {
  /** Levels playable before any stamp is earned. */
  readonly initialLevels: readonly LevelId[];
  /**
   * The unlock sequence: the levels this build can chain, in the sequence a
   * player walks them. **Not the map's numbering** — that is
   * `GameConfigDocument.journey`. It has to begin at a level `initialLevels`
   * already opens, because the walk stops at the first level it cannot open.
   */
  readonly order: readonly LevelId[];
  readonly stampsToUnlockNext: number;
}

/** Mirrors IRCC: 20 questions, 15 to pass, 30 minutes, timer optional. */
export interface ExamRules {
  readonly questionCount: number;
  readonly passMark: number;
  readonly timeLimitSeconds: number;
  readonly timerOptional: boolean;
}

/** Tuning for the FSRS-backed review scheduler, which is pure domain. */
export interface SchedulerTuning {
  /** Number of recent questions that may not repeat. */
  readonly exclusionWindow: number;
  /** Relative draw weight of a previously wrong question. */
  readonly wrongWeight: number;
  /** Maximum unseen questions introduced per day. */
  readonly dailyNewLimit: number;
}

export interface GraphicsPreset {
  /** Backbuffer scale, greater than 0 and at most 1. */
  readonly renderScale: number;
  readonly maxPixelRatio: number;
  readonly particles: number;
  readonly parallaxLayers: number;
  readonly postProcessing: boolean;
}

/** The three tiers a device may be placed in. Picking one is an adapter concern. */
export interface GraphicsPresets {
  readonly low: GraphicsPreset;
  readonly medium: GraphicsPreset;
  readonly high: GraphicsPreset;
}

/** CI gates. Breaching any of these fails the build (CLAUDE.md, Budgets). */
export interface PerformanceBudgets {
  readonly initialPayloadBytes: number;
  readonly levelPayloadBytes: number;
  readonly totalPayloadBytes: number;
  readonly textureMemoryMbPerLevel: number;
  readonly timeToPlayMs: number;
  readonly frameTimeMs: number;
}

/** Study mode: the drill a player runs outside a quest. */
export interface StudyRules {
  /**
   * How many questions one drill asks. In config rather than in a scene so the
   * copy that says "3 of 5" and the loop that stops at five read one value.
   */
  readonly drillSize: number;
}

/** Limits on the save file. In config because SECURITY.md's cap and the message reporting it must not drift. */
export interface SaveRules {
  /** Largest file JSON import will read. A larger file is refused before it is parsed. */
  readonly maxImportBytes: number;
}

export interface FeatureFlags {
  readonly debugOverlay: boolean;
  readonly autoMove: boolean;
  readonly serviceWorker: boolean;
  readonly switchMode: boolean;
}

/**
 * The palette a scene paints itself from, `game.config.schema.json#/$defs/theme`.
 *
 * Optional at the root of the config: the schema does not require `theme`, and a
 * renderer that gets none keeps its built-in default. The same block is `$ref`d
 * by `level.schema.json`, so a level overrides the whole palette without an
 * engine change — which is why these five colours are not folded into
 * `GameConfigDocument`.
 *
 * Colours are sRGB `#rrggbb` (`common.schema.json#/$defs/hexColour`). All five
 * are required when the block is present.
 */
export interface ThemeColours {
  /** Top of the vertical gradient; also the renderer's clear colour. */
  readonly sky: string;
  /** Bottom of the vertical gradient. */
  readonly ground: string;
  /** The horizon rule (ADR-0002). */
  readonly horizon: string;
  /** Primary on-canvas text. */
  readonly ink: string;
  /** Secondary on-canvas text. */
  readonly inkMuted: string;
}

/**
 * `content/game.config.json`, exactly as validated by
 * `content/schemas/game.config.schema.json`.
 *
 * Every property here is `required` in that schema except `theme` (see above),
 * and the schema rejects anything not listed. If this interface and that file
 * disagree, the schema wins and this file is wrong.
 */
export interface GameConfigDocument {
  readonly $schema: string;
  readonly title: string;
  /** Semantic version of the configuration payload, `major.minor.patch`. */
  readonly version: string;
  /** Vite `base` and the Pages sub-path; starts and ends with `/` (ADR-0006). */
  readonly basePath: string;
  readonly defaultLocale: LocaleCode;
  readonly locales: readonly LocaleCode[];
  /** Design resolution — 1080x1920, portrait only (ADR-0002). */
  readonly designWidth: number;
  readonly designHeight: number;
  /** Level ids in authoring order. */
  readonly levels: readonly LevelId[];
  /**
   * The ten places, in map order (`TN-MAP-01`, `TN-LEVELS`) — the game's shape,
   * not its progression.
   *
   * `null` is a place whose id is not fixed: `docs/content-review.md` §1 blocks
   * levels 2 and 10 and `TN-MAP-04` forbids a placeholder standing in for a
   * name, so the slot keeps its position and carries no id. A level document's
   * own `order` is its position in this list.
   */
  readonly journey: readonly (LevelId | null)[];
  /**
   * Every way a level may declare that the player moves — the legal set, as data
   * (ADR-0023). A new mode is a name here, a `LocomotionTuning` in the level
   * document and a `labelKey` in the locale bundles. No code.
   */
  readonly locomotionModes: readonly string[];
  readonly unlockRules: UnlockRules;
  readonly exam: ExamRules;
  readonly scheduler: SchedulerTuning;
  readonly study: StudyRules;
  readonly save: SaveRules;
  readonly graphicsPresets: GraphicsPresets;
  readonly budgets: PerformanceBudgets;
  readonly featureFlags: FeatureFlags;
  /** Optional in the schema; the renderer falls back to its default palette. */
  readonly theme?: ThemeColours;
}

/* --------------------------------------------------------------------------
 * content/levels/<id>.json — schema: content/schemas/level.schema.json
 * ----------------------------------------------------------------------- */

/**
 * The first line of a level's "About this place" panel
 * (`docs/content-review.md` §10.2): a territorial **fact**, sourced and
 * verifiable — not an acknowledgement.
 *
 * That distinction is load-bearing. "Ottawa is on the unceded traditional
 * territory of the Algonquin Anishinaabe Nation" is a citable statement an agent
 * may write and a verifier may check. "We acknowledge that we live and work
 * on…" is a statement of relationship in the project's own voice, and no agent
 * may write it. There is deliberately no field for one here.
 */
export interface TerritoryStatement {
  /** Each named as that nation names itself; the same deny-list as `CharacterDocument.nation`. */
  readonly nations: readonly string[];
  readonly statement: LocalizedText;
  /** Source and verification, checked under ADR-0003 like any other claim. */
  readonly fact: FactClaim;
  readonly nationSource: NationSource;
}

/** How the camera follows the player. Portrait only, so the vertical numbers matter. */
export interface CameraTuning {
  /** 0–1 per frame at 60 fps. 1 is rigid. */
  readonly followLerp: number;
  /** Half-size of the box the player may move inside before the camera follows. */
  readonly deadZone: Vec2;
  /** Where the player sits in frame; a negative `y` keeps the lower third free. */
  readonly offset: Vec2;
  readonly zoom: number;
}

/** One scrolling band of the backdrop. */
export interface ParallaxLayer {
  /** Texture key, matching a `LevelAssetRef.key` or a frame inside one of its atlases. */
  readonly key: string;
  /**
   * Render order, low to high. The graphics preset's `parallaxLayers` count keeps
   * the highest-depth layers and drops the rest, so decoration sits low.
   */
  readonly depth: number;
  /** Camera-relative scroll rate per axis; 0 is pinned, 1 moves with the world. */
  readonly scrollFactor: Vec2;
  readonly offset: Vec2;
  readonly repeatX: boolean;
}

/**
 * A landmark the player taps to engage. The blurb is the fact it teaches, which
 * is why a POI is content and a backdrop is a `ParallaxLayer`.
 */
export interface PointOfInterest {
  readonly id: PoiId;
  readonly name: LocalizedText;
  readonly blurb: LocalizedText;
  /** Whether the blurb claims a fact about Canada and, if so, who checked it. */
  readonly fact: FactClaim;
  readonly position: Vec2;
  readonly artKey: string;
  /** Engagement radius; at least 44 pt of screen at design scale. */
  readonly radiusPx: number;
  readonly questId?: QuestId;
}

/** Where a character document is placed in a level. Placement only — the rig lives in the character file. */
export interface LevelCharacter {
  readonly characterId: CharacterId;
  readonly position: Vec2;
  readonly facing: 'left' | 'right';
  readonly questId?: QuestId;
}

/**
 * `image` is here because the pipeline emits it and the enum did not have it
 * (ADR-0020). Seven of Ottawa's eight pieces of art are standalone images —
 * six parallax layers and the landmark — because they are wider than the
 * 2048 px atlas limit and cannot be packed. An enum that cannot name what the
 * build produces makes the array unfillable, which is how `assets: []` survived.
 */
export type LevelAssetKind =
  | 'atlas'
  | 'image'
  | 'rive'
  | 'audio'
  | 'font'
  | 'tilemap'
  | 'json';

/**
 * What art a level needs, **by key**.
 *
 * **`url` is optional and build-derived** (ADR-0020). The pipeline content-hashes
 * every output and emits a 1× and a 2× variant per key, so a path written by a
 * person is wrong at the next `make assets` and names only one of the two scales.
 * `assets/dist/manifest.json` resolves a key to its files; a level names the key.
 *
 * **`bytes` and `decodedBytes` stay required**, and the distinction matters.
 * `decodedBytes` is what TN-LEVEL-02 sums to refuse an over-budget level before
 * anything is fetched — an optional one would default to zero and re-create the
 * defect ADR-0020 records, a refusal that cannot fire. ADR-0013 forbids trusting
 * a `decodedBytes` nobody re-derives, and `scripts/lib/texture-memory.mjs`
 * re-derives every declared figure from the manifest. Hand-written and
 * machine-checked is the arrangement ADR-0013 asks for; hand-written and
 * unchecked is the one it warns about.
 */
export interface LevelAssetRef {
  readonly key: string;
  readonly kind: LevelAssetKind;
  /** Build-derived; the manifest resolves `key`. See above. */
  readonly url?: string;
  /** Transfer size at the worst device scale, against the 8 MB per-level payload budget. */
  readonly bytes: number;
  /** Decoded size at the worst device scale; 0 for non-texture assets. */
  readonly decodedBytes: number;
}

/**
 * `content/levels/<id>.json` — the whole level.
 *
 * Adding a level is this document plus assets. If a level ever needs an engine
 * change, this shape is wrong and the schema is fixed first
 * (`docs/plan/slices.md`, Rules); slice 2 is the proof.
 */
export interface LevelDocument {
  readonly $schema: string;
  readonly id: LevelId;
  /** The subject this level teaches; also the question-bank key. */
  readonly subject: SubjectId;
  /** Position in the world map, 1–10. Unlocking is `game.config`'s job. */
  readonly order: number;
  readonly title: LocalizedText;
  /** World size in design-resolution pixels. */
  readonly size: Vec2;
  readonly spawn: Vec2;
  /** Palette override; absent keeps `game.config`'s theme. */
  readonly theme?: ThemeColours;
  /** Whose land this level is set on, stated as a citable fact. */
  readonly territory: TerritoryStatement;
  readonly camera: CameraTuning;
  /** The surface as a polyline, ordered left to right; slope is sampled from it. */
  readonly ground: readonly Vec2[];
  readonly layers: readonly ParallaxLayer[];
  /**
   * Locomotion modes this level offers, in the order the player unlocks them. The
   * first is the mode the player spawns in. Walking and skating differ by these
   * numbers alone.
   */
  readonly locomotion: readonly LocomotionTuning[];
  readonly quests: readonly QuestId[];
  readonly pois: readonly PointOfInterest[];
  readonly characters: readonly LevelCharacter[];
  /** Preload manifest, and the input to the per-level payload budget (≤ 8 MB). */
  readonly assets: readonly LevelAssetRef[];
  /**
   * Author-declared decoded-texture ceiling in bytes, at most 64 MB. CI checks the
   * manifest sum against it; the loader checks it again before it commits.
   */
  readonly textureBudgetBytes: number;
}

/**
 * The cheap list the world map renders, derived from the level documents rather
 * than declared beside them (ADR-0007: an adapter that needs a subset derives it
 * from the port type). There is no `levelSummary` schema because there is no
 * summary file — nothing authors this shape.
 */
export type LevelSummary = Pick<LevelDocument, 'id' | 'subject' | 'order' | 'title'>;

/* --------------------------------------------------------------------------
 * content/quests/<id>.json — schema: content/schemas/quest.schema.json
 * ----------------------------------------------------------------------- */

/** One spoken line. Subtitles are on by default, so this is the subtitle text too. */
export interface DialogueLine {
  readonly speaker: CharacterId;
  readonly text: LocalizedText;
  /**
   * Whether this line claims a fact about Canada. "Welcome to Parliament Hill"
   * is flavour; "Ottawa is Canada's capital" is a claim, and a wrong claim in an
   * NPC's mouth is exactly as wrong as one on a question card.
   */
  readonly fact: FactClaim;
  /** Named face pose on the speaker's rig; absent leaves the rig's default. */
  readonly expression?: string;
}

/**
 * One objective.
 *
 * `targetId` is deliberately an unbranded string: what it names depends on
 * `kind`, and a union of brands is not a shape a schema can state.
 */
export interface QuestStepDocument {
  readonly id: string;
  readonly kind: 'talk' | 'visit' | 'collect' | 'answer';
  readonly targetId: string;
  readonly prompt: LocalizedText;
  /**
   * The draw specification for an `answer` step, and absent on every other kind.
   *
   * The quest says *how many* and, optionally, *from which pool*; the FSRS
   * scheduler in the domain says *which*, from the player's own review state. A
   * quest that named the ids outright would make the scheduler decorative, and a
   * scheduler ignoring the quest would make the step unbounded.
   */
  readonly subject?: SubjectId;
  readonly count?: number;
  /** Narrows the draw without choosing it. Absent means the whole subject bank. */
  readonly questionPool?: readonly QuestionId[];
  /** Lines spoken when the step starts. Present on `talk` steps, absent elsewhere. */
  readonly dialogue?: readonly DialogueLine[];
}

export interface QuestDocument {
  readonly $schema: string;
  readonly id: QuestId;
  readonly levelId: LevelId;
  /** The character who offers the quest. */
  readonly giver: CharacterId;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly steps: readonly QuestStepDocument[];
}

/* --------------------------------------------------------------------------
 * content/questions/<subject>/<id>.json — schema: content/schemas/question.schema.json
 * ----------------------------------------------------------------------- */

/**
 * One exam-style question.
 *
 * Prompt, options and explanation carry their EN and FR text inline rather than
 * as locale keys (ADR-0010): the verifier reads the claim, its source, its
 * evidence and both languages in one file, and a quarantined question takes its
 * text out of the build with it.
 */
export interface QuestionDocument {
  readonly $schema: string;
  readonly id: QuestionId;
  readonly subject: SubjectId;
  readonly prompt: LocalizedText;
  /** Exactly four — one correct, three distractors (CLAUDE.md, Content rules). */
  readonly options: readonly [LocalizedText, LocalizedText, LocalizedText, LocalizedText];
  readonly correctIndex: 0 | 1 | 2 | 3;
  readonly explanation: LocalizedText;
  /** A question always claims a fact, so both blocks are required and non-null. */
  readonly source: FactSource;
  readonly verification: FactVerification;
}

/* --------------------------------------------------------------------------
 * content/characters/<id>.json — schema: content/schemas/character.schema.json
 * ----------------------------------------------------------------------- */

/**
 * One state-machine input, in the vocabulary `ICharacterRenderer` addresses.
 *
 * `kind` here and `type` in `rig.schema.json#/$defs/rigInput` are the same field
 * under two names, and that overlap is a known boundary defect rather than a
 * coincidence — see ADR-0017. **The rig owns the vocabulary; a character selects
 * from it.** Until `character.schema.json` is rewritten to reference the rig
 * (deliberately deferred: `content/characters/` has no documents yet, so the
 * shape would be designed against nothing), a character can declare an input or
 * a slot option the rig has no frame for and nothing joins the two.
 */
export interface CharacterInput {
  readonly name: string;
  readonly kind: 'bool' | 'number' | 'trigger';
}

/** One choice inside a slot. Every option has a name shown as text: colour is never the only signal. */
export interface CharacterSkinOption {
  readonly id: string;
  /** Localiser key naming the option, e.g. `creator.hair.curly`. */
  readonly labelKey: string;
}

/**
 * One runtime-swappable slot: skin tone, hair, coat.
 *
 * The slot NAMES are the rig's, and `rig.schema.json` fixes them: `skin`,
 * `hairShape`, `hairColour`, `headCovering`, `feature`, `costume`,
 * `presentation`. `hairShape` and `hairColour` are two slots and not one
 * because `docs/content-review.md` §8.2 makes slot independence the
 * anti-caricature check, and the failure mode is a MERGE — one `hair` slot of
 * twenty combined options in which "the coily one only in black" is invisible.
 * Two slots make that coupling expressible only as a missing atlas frame, which
 * a contract test can and does refuse (ADR-0017).
 *
 * Slot and option names are
 * identical in Rive and in the atlas, which is what makes the fallback a swap.
 */
export interface CharacterSlot {
  readonly name: string;
  /** Localiser key naming the slot in the creator, e.g. `creator.slot.hair`. */
  readonly labelKey: string;
  /** What the character creator offers; an NPC's costume slots are not selectable. */
  readonly playerSelectable: boolean;
  readonly options: readonly CharacterSkinOption[];
  /**
   * Option id used when nothing has been chosen: an NPC document, and save
   * recovery when a saved option id no longer exists. **Not a pre-selection.**
   *
   * It was called `default` for one day, and that name was the whole of a real
   * conflict with `assets/style/art-bible.md` §8 — no skin tone is the default,
   * and a field named `default` reads as "show this one chosen". The creator
   * randomises uniformly on open; that is UI behaviour, checked by task 1.15's
   * seeded-draw test, not by a schema.
   */
  readonly fallback: string;
}

export interface CharacterDocument {
  readonly $schema: string;
  readonly id: CharacterId;
  readonly name: LocalizedText;
  /** Rive artboard name, or the atlas namespace the sprite fallback uses. */
  readonly artboard: string;
  readonly stateMachine: string;
  /**
   * Inputs the rig must expose. Declared as data so slice 1 task 1.11's contract
   * test can load the `.riv` and assert each one exists.
   */
  readonly inputs: readonly CharacterInput[];
  /**
   * Every skin slot this character offers, with its options and its default.
   * Declared as data so the creator renders itself from the document rather than
   * from a hardcoded list — adding a slot is content, not an engine change.
   */
  readonly slots: readonly CharacterSlot[];
  /**
   * Is this character depicted as Indigenous? Required and never inferred, so
   * the judgement is recorded rather than defaulted — the same shape as
   * `FactClaim.factual`. `false` is a real answer: a character carrying no
   * cultural marker at all, about whom the game asserts nothing
   * (`docs/content-review.md` §3.3, outcome 2).
   */
  readonly indigenous: boolean;
  /**
   * One nation, as that nation names itself. Present if and only if
   * `indigenous` is true. The schema holds a case-insensitive deny-list of the
   * category words that are not nations — `Indigenous`, `First Nations`,
   * `Inuit`, `TBD` and the rest — and a value matching one is a build failure.
   */
  readonly nation?: string;
  readonly nationSource?: NationSource;
  readonly communityReview?: CommunityReview;
}

/* --------------------------------------------------------------------------
 * content/locales/<locale>/<bundle>.json — schema: content/schemas/locale.schema.json
 * ----------------------------------------------------------------------- */

/**
 * One locale's UI string table, exactly as it sits on disk — the adapter no
 * longer attaches the locale, the file declares it.
 *
 * Bundles hold engine and UI vocabulary reused across content: menus, settings,
 * the rotate overlay, the build-status line, live-region templates, locomotion
 * mode labels. Text belonging to one content document lives in that document
 * (ADR-0010). Keys are flat and dotted, so a key is spelled exactly one way.
 */
export interface LocaleBundle {
  readonly $schema: string;
  readonly locale: LocaleCode;
  readonly strings: Readonly<Record<string, string>>;
}

/* --------------------------------------------------------------------------
 * content/characters/rig.json — schema: content/schemas/rig.schema.json
 *
 * The SHARED character rig: one skeleton, every character. ADR-0017 put the
 * vocabulary here and ADR-0022 made this a document the application reads, so
 * ADR-0007 applies and these types mirror the schema.
 *
 * Why it is read at runtime, in one line: the shipped atlas is a CUT-OUT PUPPET
 * — 20 parts placed by `pivot`, `z` and `mirrorX` and animated by keyframes —
 * and a puppet is the only model that can compose 480 player-selectable
 * appearances from 21 drawings. A pre-rendered flipbook would have to bake each
 * combination, which is what `docs/content-review.md` §8.2 forbids.
 *
 * The adapter does NOT open this file. `ContentRepository.rig()` loads it and it
 * reaches a renderer through `CharacterRendererSpec`, the same field-of-the-same
 * -spec route that already makes `skinSlots` identical in both backends.
 * ----------------------------------------------------------------------- */

/** Pixel dimensions of the design surface. */
export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * The coordinate space every part window and pivot is stated in.
 *
 * `heightPx`, `headPx` and `heightHeads` are three numbers describing one fact,
 * and `heightPx / headPx === heightHeads` is asserted by
 * `tests/unit/contracts/rig-is-coherent.test.ts`. The 6-head proportion is a
 * canon rule identical for every character, which is an anti-caricature rule and
 * not a style preference.
 *
 * `height` is the ARTBOARD and `heightPx` is the crown-to-sole span; they are
 * different numbers and confusing them under-counts a Rive surface by 12 %
 * (ADR-0013, second amendment).
 */
export interface CharacterSpace {
  readonly width: number;
  readonly height: number;
  readonly centreX: number;
  readonly crownY: number;
  readonly soleY: number;
  readonly groundLineY?: number;
  readonly heightPx: number;
  readonly headPx: number;
  readonly heightHeads: number;
  readonly note?: string;
}

/** One character that plays this rig. `characterId` joins to `content/characters/<id>.json`. */
export interface RigArtboard {
  readonly characterId: CharacterId;
  readonly artboard: string;
  readonly stateMachine: string;
  /** Slot choices this artboard ships with: slot name -> option name. */
  readonly skins: Readonly<Record<string, string>>;
  /** Slots the creator offers for this artboard. Empty is a real answer, and is what an NPC has. */
  readonly playerSelectableSlots: readonly string[];
  readonly note?: string;
}

/**
 * One input both backends expose under this exact name.
 *
 * A `number` carries `min`/`max` and a numeric `fallback`; a `bool` carries a
 * boolean one; **a `trigger` carries no `fallback` at all** — it is an event, it
 * has no resting value, and the schema makes that unwritable rather than merely
 * discouraged.
 */
export interface RigStateMachineInput {
  readonly name: string;
  readonly type: 'bool' | 'number' | 'trigger';
  readonly fallback?: boolean | number;
  readonly min?: number;
  readonly max?: number;
  readonly meaning: string;
}

export interface RigStateMachine {
  readonly name: string;
  readonly inputs: readonly RigStateMachineInput[];
}

/** One first-match-wins rule. `state` must be a key of `RigDocument.states`. */
export interface RigSelectorRule {
  /**
   * The condition in words, deliberately prose. An executable condition here
   * would be a second implementation of the state machine that could disagree
   * with both backends.
   */
  readonly when: string;
  readonly state: string;
}

/**
 * The Rive state machine written out as an ordered table, so a sprite adapter
 * evaluates the same rules in the same order and a conformance suite can drive
 * both backends through it and compare the selected state.
 */
export interface RigSelector {
  readonly note?: string;
  readonly rules: readonly RigSelectorRule[];
}

/** Named face poses. `fallback` is one of `names`. */
export interface RigExpressions {
  readonly names: readonly string[];
  readonly fallback: string;
  readonly note?: string;
}

/** A named moment the animation reports, so audio, subtitles and UI agree with the art. */
export interface RigEvent {
  readonly name: string;
  readonly when: string;
  readonly use: string;
}

/**
 * One slot and the options the artwork provides.
 *
 * `fallback` is the option used when nothing has been chosen — an NPC, or save
 * recovery when a saved option id no longer exists. It is **not** a
 * pre-selection: no skin tone is the default, and the creator randomises
 * uniformly on open. It is `null` exactly when `status` is `reserved`, and a
 * reserved slot has zero options and names what blocks it.
 */
export interface RigSlot {
  readonly options: readonly string[];
  readonly fallback: string | null;
  readonly playerSelectable: boolean;
  readonly status?: 'reserved';
  readonly blockedBy?: string;
  readonly namesOwnedBy?: string;
  readonly note?: string;
}

/**
 * The runtime-swappable slots. The names are fixed by the schema, and that is
 * the anti-caricature mechanism rather than tidiness: `hairShape` and
 * `hairColour` are two slots precisely so a coupling — "the coily one only in
 * black" — cannot hide inside one combined list of twenty options.
 */
export interface RigSlots {
  readonly skin: RigSlot;
  readonly hairShape: RigSlot;
  readonly hairColour: RigSlot;
  readonly headCovering: RigSlot;
  readonly feature: RigSlot;
  readonly costume: RigSlot;
  readonly presentation: RigSlot;
}

/** The anti-caricature rule, stated in the rig so it travels with what it constrains. */
export interface SlotIndependence {
  readonly rule: string;
  /** How it is checked. What stops the rule being a sentiment. */
  readonly checkable: string;
  readonly source: string;
}

/**
 * One drawable part.
 *
 * `frame` is a template: literal text plus `{slot}` or `{expression}` braces,
 * each naming a declared slot or the expression list. That is what makes slot
 * independence mechanical — a template naming two slots that constrain each
 * other is visible in the template.
 */
export interface RigPart {
  readonly name: string;
  /** Draw order, back to front. The set over all parts is a dense 1..n permutation. */
  readonly z: number;
  readonly frame: string;
  /** Rotation origin in character space. */
  readonly pivot: readonly [number, number];
  readonly mirrorX: boolean;
  readonly note?: string;
}

/** How a resolved frame template becomes an atlas frame key. */
export interface RigAtlas {
  readonly framePrefix: string;
  readonly grammar: string;
  readonly rule: string;
  readonly note?: string;
}

/** Per-part transform at one instant: `[rotationDeg, dx, dy]`, keyed by part name. */
export interface RigKeyframe {
  /** Normalised time within the state, 0 to 1. Ascending, first 0, last 1. */
  readonly t: number;
  readonly parts: Readonly<Record<string, readonly [number, number, number]>>;
}

/** One animation state. */
export interface RigState {
  /** `loop` repeats; `once` plays and returns to the selector; `hold` stops on the last key. */
  readonly loop: 'loop' | 'once' | 'hold';
  readonly durationMs: number;
  readonly keys: readonly RigKeyframe[];
  readonly note?: string;
}

/** One atlas frame: its source art and the window it occupies in character space. */
export interface RigFrame {
  readonly source: string;
  /** May be negative — a toque crosses the crown line. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RigDocument {
  readonly $schema?: string;
  /** Prose about the document, a line array so a long note diffs a line at a time. */
  readonly $comment?: readonly string[];
  readonly version: number;
  readonly licence: string;
  readonly designResolution: Dimensions;
  readonly characterSpace: CharacterSpace;
  readonly artboards: readonly RigArtboard[];
  readonly stateMachine: RigStateMachine;
  readonly selector: RigSelector;
  readonly expressions: RigExpressions;
  readonly events?: readonly RigEvent[];
  readonly slots: RigSlots;
  readonly slotIndependence: SlotIndependence;
  readonly parts: readonly RigPart[];
  readonly atlas: RigAtlas;
  /** Animation states by name. A `selector.rules[].state` names one of these keys. */
  readonly states: Readonly<Record<string, RigState>>;
  /**
   * Every atlas frame the rig can resolve to, by frame key. A part whose resolved
   * template is absent draws nothing, which is how every "none" option works
   * without a special case in either backend.
   */
  readonly frames: Readonly<Record<string, RigFrame>>;
}

export interface ContentRepository {
  gameConfig(): Promise<Result<GameConfigDocument>>;
  /** Cheap list for the world map — never loads level payloads. */
  levelIndex(): Promise<Result<readonly LevelSummary[]>>;
  level(id: LevelId): Promise<Result<LevelDocument>>;
  quests(levelId: LevelId): Promise<Result<readonly QuestDocument[]>>;
  /** The whole bank for a subject; the scheduler picks from it in the domain. */
  questions(subject: SubjectId): Promise<Result<readonly QuestionDocument[]>>;
  character(id: CharacterId): Promise<Result<CharacterDocument>>;
  /**
   * The shared character rig, `content/characters/rig.json` (ADR-0022).
   *
   * One rig, every character, so it is fetched once and cached like any other
   * document. It is here rather than on the renderer because an adapter does not
   * do content I/O: this port hides fetch, ajv and caching, and the rig reaches a
   * backend through `CharacterRendererSpec`.
   */
  rig(): Promise<Result<RigDocument>>;
  locale(code: LocaleCode): Promise<Result<LocaleBundle>>;
  /**
   * Drop everything cached for a level. Called before the next level loads so the
   * decoded-texture footprint stays inside budget. Safe to call for a level that
   * was never loaded.
   */
  unload(levelId: LevelId): Promise<Result<void>>;
}
