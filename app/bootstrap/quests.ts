/**
 * The quests this build ships, read from `content/quests/*.json`.
 *
 * ## Why the composition root and not an adapter
 *
 * `ContentRepository.quests(levelId)` is the port a quest catalogue will one day
 * live behind, and no adapter implements it yet. This file is deliberately not
 * that adapter: it is the same shape as `./game-rules.ts`, which parses
 * `game.config.json` here rather than in `app/adapters/phaser` — a bundled
 * document, validated at the point of composition, with the runtime check that
 * `make validate-content` performs on the repository repeated on the artefact.
 * When the port grows an implementation this file becomes its caller and nothing
 * above it changes, because everything above it already takes `QuestDocument`.
 *
 * ## A build with no quests is a normal build
 *
 * `content/quests/` may be empty — it is, at the moment this file is written,
 * while an author writes the first four. {@link readQuests} answers with an empty
 * map, {@link questsForLevel} answers with an empty list, and the surfaces above
 * draw nothing: no tracker, no offer, no empty quest log that looks broken. That
 * is the point of validating here rather than trusting a glob: a build with no
 * quests and a build with a broken quest must not look the same to a player, and
 * they do not — one is silent and the other is on the console.
 *
 * ## What is checked, and what is not
 *
 * Every field the quest **surface** reads: the ids, the giver, both languages of
 * the title and summary, and each step's kind, target and prompt. An `answer`
 * step must carry a subject and a count, because the domain refuses a step it
 * cannot size and a quest that cannot advance is worse than a quest that never
 * loads.
 *
 * What is **not** checked here is anything `make validate-content` owns against
 * the schema — `$schema`, unknown properties, the shape of a `source` block.
 * This is the artefact's guard, not the repository's: a document that reaches a
 * player must be *drawable*, and the rest fails the build long before that.
 *
 * ## What changed: verification is not the schema's job alone
 *
 * This file used to say that whether a line's claim is verified was
 * `make validate-content`'s question and not its own. That was wrong in the way
 * the level path was wrong before `app/adapters/phaser/verified-claim.ts`: CI
 * *counted* five rejected lines as "excluded from the build" while `./quest.ts`
 * put them on screen in a named character's voice. A gate that runs in CI and
 * not at the artefact is a gate for the repository, and a player does not play
 * the repository.
 *
 * So {@link readQuests} now hands out {@link SpokenQuest}s, not `QuestDocument`s:
 * every line has been through `./verified-dialogue.ts`, and a line a verifier
 * declined is not a value the quest surface can be given. {@link readQuest} is
 * unchanged and still answers a plain `QuestDocument` — it reads the document,
 * it does not adjudicate it — which keeps "is this drawable" and "is this true"
 * as two separate refusals with two separate messages.
 */

import { appErr, ok, type Result } from '@common/result';
import type { DialogueLine, QuestDocument, QuestStepDocument } from '@application/ports';
import type { CharacterId, LevelId, QuestId, QuestionId, SubjectId } from '@domain/ids';
import type { LocalizedText } from '@domain/entities/values';

import {
  adjudicateQuest,
  createDialogueLedger,
  QUEST_MOMENTS,
  type DialogueCensus,
  type QuestMoment,
  type SpokenQuest,
} from './verified-dialogue';

/**
 * Every `content/quests/<id>.json`, eagerly.
 *
 * Eager rather than lazy, unlike the question bank: a quest document is a few
 * hundred bytes, there are at most ten of them, and the offer has to be ready on
 * the frame the player reaches the giver. Lazily loading it would put a network
 * round trip between walking up to a character and being spoken to.
 *
 * Declared as a type so a test can build one over a fixture — the same code the
 * deploy runs, over documents that do not have to exist yet.
 */
export type QuestModuleMap = Readonly<Record<string, unknown>>;

const BUNDLED_QUEST_MODULES: QuestModuleMap = import.meta.glob(
  '../../content/quests/*.json',
  { eager: true },
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A vite module namespace (`{ default: … }`), or the document itself. */
const documentOf = (module: unknown): unknown =>
  isRecord(module) && 'default' in module ? module['default'] : module;

const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

const invalid = (where: string, message: string): Result<never> =>
  appErr('invalid', 'content.quest.invalid', `${where}: ${message}`, { field: where });

function readId(source: Record<string, unknown>, field: string, where: string): Result<string> {
  const value = source[field];
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    return invalid(`${where}.${field}`, 'must be a kebab-case id.');
  }
  return ok(value);
}

/**
 * Both languages or neither.
 *
 * A quest whose French is missing would reach a French player as English text in
 * a French dialog — the defect `TN-CREATOR-09` names, and the one `app/ui`'s copy
 * table makes a compile error. Content cannot be typed that way, so it is
 * refused here.
 */
function readLocalized(
  source: Record<string, unknown>,
  field: string,
  where: string,
): Result<LocalizedText> {
  const value = source[field];
  if (!isRecord(value)) return invalid(`${where}.${field}`, 'must be an object with en and fr.');
  const en = value['en'];
  const fr = value['fr'];
  if (typeof en !== 'string' || en === '') return invalid(`${where}.${field}.en`, 'is missing.');
  if (typeof fr !== 'string' || fr === '') return invalid(`${where}.${field}.fr`, 'is missing.');
  return ok({ en, fr });
}

const STEP_KINDS: readonly QuestStepDocument['kind'][] = ['talk', 'visit', 'collect', 'answer'];

/**
 * The lines a step's giver speaks, in both languages.
 *
 * **This is the whole of the quest's voice.** The offer, the greeting and every
 * fact the character states arrive here and nowhere else — `app/ui/copy.ts` has
 * no `officer.*` row and must not grow one, because a line about Parliament Hill
 * written once for every quest is the `level.loading` defect one story later. So
 * a `talk` step whose dialogue would not load is refused: a giver who opens a
 * dialog and says nothing is worse than a giver who is not offered.
 *
 * `fact` is carried through untouched, and that is now load-bearing rather than
 * merely tidy: `./verified-dialogue.ts` reads it a moment later and decides
 * whether the block may be said at all. This reader's job is the *shape* — a
 * line with no `fact` is a line nobody recorded a judgement for, and it is
 * refused here so the adjudicator downstream is never handed one.
 */
function readDialogue(raw: unknown, where: string): Result<DialogueLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return invalid(where, 'must be a non-empty array of lines.');
  }

  const lines: DialogueLine[] = [];
  for (const [index, line] of raw.entries()) {
    const read = readLine(line, `${where}[${String(index)}]`);
    if (!read.ok) return read;
    lines.push(read.value);
  }
  return ok(lines);
}

/**
 * One line, wherever it sits: in a step's `dialogue` array, or as one of the
 * quest's four moment lines.
 *
 * One reader for both, because they are one `$defs/dialogueLine` in the schema
 * and a second reader is how the two would come to accept different shapes.
 *
 * `expression` is carried only when the document declares it, so a landmark's
 * line has no `expression` key at all rather than one set to `undefined`
 * (ADR-0029 §4) — whichever of the two places the line came from.
 */
function readLine(line: unknown, at: string): Result<DialogueLine> {
  if (!isRecord(line)) return invalid(at, 'must be an object.');

  const speaker = readId(line, 'speaker', at);
  if (!speaker.ok) return speaker;
  const text = readLocalized(line, 'text', at);
  if (!text.ok) return text;

  const fact = line['fact'];
  if (!isRecord(fact)) return invalid(`${at}.fact`, 'is required on every line.');

  const expression = line['expression'];
  if (expression !== undefined && typeof expression !== 'string') {
    return invalid(`${at}.expression`, 'must be the name of a face pose.');
  }

  return ok({
    speaker: speaker.value as CharacterId,
    text: text.value,
    /* Carried through as declared, for `./verified-dialogue.ts` to read.
       Dropping it here would leave the surface unable to tell a claim from
       flavour, which is what the dialogue path had instead of a gate. */
    fact: fact as unknown as DialogueLine['fact'],
    ...(typeof expression === 'string' ? { expression } : {}),
  });
}

function readStep(raw: unknown, where: string): Result<QuestStepDocument> {
  if (!isRecord(raw)) return invalid(where, 'must be an object.');

  const id = readId(raw, 'id', where);
  if (!id.ok) return id;

  const kind = raw['kind'];
  if (typeof kind !== 'string' || !STEP_KINDS.includes(kind as QuestStepDocument['kind'])) {
    return invalid(`${where}.kind`, `must be one of ${STEP_KINDS.join(', ')}.`);
  }

  const targetId = readId(raw, 'targetId', where);
  if (!targetId.ok) return targetId;

  const prompt = readLocalized(raw, 'prompt', where);
  if (!prompt.ok) return prompt;

  const base = {
    id: id.value,
    kind: kind as QuestStepDocument['kind'],
    targetId: targetId.value,
    prompt: prompt.value,
  };

  if (kind !== 'answer') {
    /*
     * The lines, on the step that has them. A `talk` step without them is
     * refused rather than carried: it is the step that opens the offer, and a
     * quest whose offer has nothing to say cannot be offered at all — which
     * would present to a player as a character who does not react.
     */
    const dialogue = raw['dialogue'];
    if (dialogue === undefined) {
      return kind === 'talk'
        ? invalid(`${where}.dialogue`, 'is required on a talk step: it is what the giver says.')
        : ok(base);
    }
    const lines = readDialogue(dialogue, `${where}.dialogue`);
    if (!lines.ok) return lines;
    return ok({ ...base, dialogue: lines.value });
  }

  /*
   * An `answer` step has to say how many questions it asks, because
   * `requiredForStep` sizes the step from it and a step with no size is a step
   * that finishes on the first answer or on none. The subject is what the draw
   * comes from. Both are required by the schema; both are checked because this
   * is the artefact and not the repository.
   */
  const subject = raw['subject'];
  if (typeof subject !== 'string' || subject === '') {
    return invalid(`${where}.subject`, 'is required on an answer step.');
  }
  const count = raw['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    return invalid(`${where}.count`, 'must be a whole number of at least 1.');
  }

  const pool = raw['questionPool'];
  if (pool !== undefined && (!Array.isArray(pool) || pool.some((it) => typeof it !== 'string'))) {
    return invalid(`${where}.questionPool`, 'must be an array of question ids.');
  }

  return ok({
    ...base,
    subject: subject as SubjectId,
    count,
    ...(pool === undefined ? {} : { questionPool: pool as readonly QuestionId[] }),
  });
}

/** One document, checked. */
export function readQuest(raw: unknown, where: string): Result<QuestDocument> {
  if (!isRecord(raw)) return invalid(where, 'must be an object.');

  const id = readId(raw, 'id', where);
  if (!id.ok) return id;
  const levelId = readId(raw, 'levelId', where);
  if (!levelId.ok) return levelId;
  const giver = readId(raw, 'giver', where);
  if (!giver.ok) return giver;

  const title = readLocalized(raw, 'title', where);
  if (!title.ok) return title;
  const summary = readLocalized(raw, 'summary', where);
  if (!summary.ok) return summary;

  const rawSteps = raw['steps'];
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return invalid(`${where}.steps`, 'must be a non-empty array.');
  }

  const steps: QuestStepDocument[] = [];
  for (const [index, step] of rawSteps.entries()) {
    const read = readStep(step, `${where}.steps[${String(index)}]`);
    if (!read.ok) return read;
    steps.push(read.value);
  }

  /*
   * The four moment lines, which until this change nothing in `app/` read: the
   * port declared them, the schema validated them, a verifier granted them, and
   * this function dropped them on the floor. Forty lines across ten quests.
   *
   * Each is optional and absent is legal — a quest with no line for a moment
   * says nothing at that moment (`TN-DIALOGUE-02`). One that is present and
   * malformed refuses the document, exactly as a malformed step line does: a
   * half-read line is not a thing to speak, and one document costs itself and
   * not the other nine.
   */
  const moments: Partial<Record<QuestMoment, DialogueLine>> = {};
  for (const moment of QUEST_MOMENTS) {
    const value = raw[moment];
    if (value === undefined) continue;
    const read = readLine(value, `${where}.${moment}`);
    if (!read.ok) return read;
    moments[moment] = read.value;
  }

  return ok({
    $schema: typeof raw['$schema'] === 'string' ? raw['$schema'] : '',
    id: id.value as QuestId,
    levelId: levelId.value as LevelId,
    giver: giver.value as CharacterId,
    title: title.value,
    summary: summary.value,
    ...moments,
    steps,
  });
}

export interface QuestCatalogue {
  /**
   * Every quest this build may speak, in the order the bundler found them.
   *
   * {@link SpokenQuest} and not `QuestDocument`: every line in here has been
   * adjudicated under ADR-0003, and the type is the receipt. Nothing downstream
   * can be handed a line a verifier declined, because there is no such value to
   * hand it (`./verified-dialogue.ts`).
   */
  readonly quests: readonly SpokenQuest[];
  /**
   * The documents that would not load, as sentences for the console.
   *
   * Kept rather than thrown: one malformed quest must not take the other three
   * away, and it must not stop the level it belongs to from being played. The
   * level is simply quieter than it should be, and the reason is on the console
   * where a developer can act on it.
   *
   * Two kinds of document land here now. One this reader could not *draw* — a
   * missing prompt, an `answer` step with no count — and one
   * `./verified-dialogue.ts` could not *adjudicate*, which is a `fact` block
   * that is misspelt, mistyped or absent where `factual` is true. The second is
   * refused rather than treated as unverified on purpose: a renamed field must
   * not be able to present as an honest rejection (ADR-0024).
   */
  readonly refused: readonly string[];
  /**
   * What ADR-0003's filter looked at across every quest in the build, and what
   * it did. Printed by `./main.ts` when it is remarkable and published to the
   * scene probe whether or not it is.
   */
  readonly census: DialogueCensus;
}

/**
 * Read every bundled quest.
 *
 * The modules are sorted by path, so two machines produce the same order: a
 * glob's key order is the bundler's, and a level with two quests must offer them
 * in a stable one.
 */
export function readQuests(modules: QuestModuleMap = BUNDLED_QUEST_MODULES): QuestCatalogue {
  const quests: SpokenQuest[] = [];
  const refused: string[] = [];
  const ledger = createDialogueLedger();

  for (const path of Object.keys(modules).sort()) {
    const read = readQuest(documentOf(modules[path]), path);
    if (!read.ok) {
      refused.push(`${read.error.code}: ${read.error.message}`);
      continue;
    }
    /*
     * Read, then adjudicated, and never the other way round: a document that
     * cannot be drawn has nothing worth verifying, and one whose claims cannot
     * be read must not reach a surface because its prose happened to parse.
     *
     * The pointer is the quest's own id rather than the module path, because
     * that is what `verify-content` prints and a developer comparing the two
     * should not have to translate between a glob key and a document.
     */
    const spoken = adjudicateQuest(read.value, ledger, String(read.value.id));
    if (spoken.ok) quests.push(spoken.value);
    else refused.push(`${spoken.error.code}: ${spoken.error.message}`);
  }

  /* `ledger.census` and not a special case for the empty build: a build with no
     quests reports `quests: 0, examined: 0`, which is a different sentence from
     `quests: 10, examined: 0` and is exactly why `quests` is in the census. */
  return { quests, refused, census: ledger.census };
}

/**
 * The quests a level offers, in order.
 *
 * An empty list is the normal answer for every level in this build today, and it
 * is what keeps the surfaces honest: nothing to offer means no tracker, no
 * dialogue and no empty quest log.
 */
export function questsForLevel(
  catalogue: QuestCatalogue,
  levelId: LevelId,
): readonly SpokenQuest[] {
  return catalogue.quests.filter((quest) => quest.levelId === levelId);
}
