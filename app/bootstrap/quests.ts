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
 * the schema — `fact` provenance on a dialogue line, `$schema`, unknown
 * properties. This is the artefact's guard, not the repository's: a document
 * that reaches a player must be *drawable*, and the rest fails the build long
 * before that.
 */

import { appErr, ok, type Result } from '@common/result';
import type { DialogueLine, QuestDocument, QuestStepDocument } from '@application/ports';
import type { CharacterId, LevelId, QuestId, QuestionId, SubjectId } from '@domain/ids';
import type { LocalizedText } from '@domain/entities/values';

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
 * `fact` is carried through untouched. Whether a line's claim is verified is
 * `make validate-content`'s question, not this file's, but dropping the field
 * would leave the surface unable to tell a claim from flavour if it ever needs
 * to.
 */
function readDialogue(raw: unknown, where: string): Result<DialogueLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return invalid(where, 'must be a non-empty array of lines.');
  }

  const lines: DialogueLine[] = [];
  for (const [index, line] of raw.entries()) {
    const at = `${where}[${String(index)}]`;
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

    lines.push({
      speaker: speaker.value as CharacterId,
      text: text.value,
      /* Carried through as declared. Whether the claim is *verified* is
         `make validate-content`'s question against the schema, not this file's:
         what would be wrong here is dropping the field, because a surface that
         cannot tell a claim from flavour cannot ever be made to check one. */
      fact: fact as unknown as DialogueLine['fact'],
      ...(typeof expression === 'string' ? { expression } : {}),
    });
  }
  return ok(lines);
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

  return ok({
    $schema: typeof raw['$schema'] === 'string' ? raw['$schema'] : '',
    id: id.value as QuestId,
    levelId: levelId.value as LevelId,
    giver: giver.value as CharacterId,
    title: title.value,
    summary: summary.value,
    steps,
  });
}

export interface QuestCatalogue {
  /** Every quest this build could draw, in the order the bundler found them. */
  readonly quests: readonly QuestDocument[];
  /**
   * The documents that would not load, as sentences for the console.
   *
   * Kept rather than thrown: one malformed quest must not take the other three
   * away, and it must not stop the level it belongs to from being played. The
   * level is simply quieter than it should be, and the reason is on the console
   * where a developer can act on it.
   */
  readonly refused: readonly string[];
}

/**
 * Read every bundled quest.
 *
 * The modules are sorted by path, so two machines produce the same order: a
 * glob's key order is the bundler's, and a level with two quests must offer them
 * in a stable one.
 */
export function readQuests(modules: QuestModuleMap = BUNDLED_QUEST_MODULES): QuestCatalogue {
  const quests: QuestDocument[] = [];
  const refused: string[] = [];

  for (const path of Object.keys(modules).sort()) {
    const read = readQuest(documentOf(modules[path]), path);
    if (read.ok) quests.push(read.value);
    else refused.push(`${read.error.code}: ${read.error.message}`);
  }

  return { quests, refused };
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
): readonly QuestDocument[] {
  return catalogue.quests.filter((quest) => quest.levelId === levelId);
}
