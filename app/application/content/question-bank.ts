/**
 * The gate every question passes through on its way to a player, and the floor
 * that stops an empty bank reading as a finished one.
 *
 * It lives in `app/application/` rather than in the adapter for one structural
 * reason: `outer-layers-use-domain-vocabulary-only` forbids `app/adapters` from
 * importing anything in `app/domain` except the id vocabulary, so an adapter
 * *cannot* call `isShippable` itself. This module is the only door between the
 * two, which means there is exactly one place in the build where a
 * `QuestionDocument` becomes something a card may render.
 *
 * ## Why a brand and not a filter (ADR-0003)
 *
 * `content/questions/` holds 237 documents and seven of them are `rejected` — a
 * verifier looked at each and said no. A filter applied at the load site is a
 * call somebody has to remember: delete it, or add a second load path beside it,
 * and a rejected claim is on screen with nothing failing.
 *
 * So the port does not promise `QuestionDocument[]`; it promises
 * `ShippableQuestion[]`, and `Shippable<T>` carries a `unique symbol` that is
 * module-private to `app/domain/entities/question.ts`. No object literal, no
 * `filter`, no `as unknown as` inside an adapter's own types can produce one.
 * The only function in the program that mints the brand is `shippableQuestions`,
 * and it mints it only for a question that is `verified`, whose verification
 * hash still matches its source, that quotes evidence, and that has EN and FR
 * text everywhere a player can read.
 *
 * The exclusion is therefore not a step in the adapter's happy path that can be
 * skipped. It is the only way to construct the adapter's declared return type.
 *
 * ## Why the floor (ADR-0024)
 *
 * `filter` over an empty list succeeds. `every` over an empty list is true.
 * A repository that returns `ok([])` because a glob missed, a directory moved,
 * or every question in a subject was rejected hands Study a deck of nothing —
 * and Study's empty state is the same screen a player sees when they have
 * genuinely finished. A vacuous pass and a real one must not look alike, so zero
 * shippable questions is an error with a code, not a success with a length.
 *
 * Pure: no fetch, no DOM, no clock. `app/application` may import `app/domain`
 * and `common` and nothing else (ADR-0005).
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { SubjectId } from '@domain/ids';

import { shippableQuestions } from '@domain/entities/question';
import type { Shippable } from '@domain/entities/question';
import type { QuestionBank, QuestionDocument } from '@application/ports/content-repository';

/**
 * A question that may be put in front of a player.
 *
 * Assignable to `QuestionDocument`, so every existing consumer — the card, the
 * `answerQuestion` use case, `scheduleReview` — takes one unchanged. The
 * assignability does not run the other way, which is the whole mechanism.
 */
export type ShippableQuestion = Shippable<QuestionDocument>;

/**
 * The smallest bank that is a bank.
 *
 * One, not thirty. Thirty is CLAUDE.md's *shipping* threshold for a subject
 * whose level is going out, and enforcing it here would black out Study for a
 * subject sitting at twenty-nine — which contradicts TN-STUDY-02's "a drill can
 * be shorter than the drill size" and turns an authoring backlog into a runtime
 * outage. What cannot be tolerated at runtime is *zero*: zero is
 * indistinguishable from a broken build, and it is the value every vacuous
 * success collapses to.
 */
export const MIN_SHIPPABLE_PER_SUBJECT = 1;

/**
 * CLAUDE.md, Content rules: ">= 30 verified questions per subject before that
 * level ships."
 *
 * Stated here so the number has one home, and checked in
 * `tests/unit/contracts/question-bank-floor.test.ts` against the real
 * `content/questions/` tree — a build gate, which is what "before that level
 * ships" describes. It is deliberately NOT checked by `admitSubjectBank`: see
 * `MIN_SHIPPABLE_PER_SUBJECT`.
 */
export const SUBJECT_SHIP_THRESHOLD = 30;

/**
 * Admit one subject's documents, or say why the subject has no deck.
 *
 * `offered` and `admitted` are both reported on failure because the two
 * failures need different fixes and look identical from the outside: `offered:
 * 0` is a glob that matched nothing or a directory that moved, and `offered: 7,
 * admitted: 0` is a subject whose every question was rejected. Neither is a
 * short drill.
 */
export const admitSubjectBank = (
  subject: SubjectId,
  documents: readonly QuestionDocument[],
): Result<readonly ShippableQuestion[]> => {
  const admitted = shippableQuestions(documents);
  if (admitted.length < MIN_SHIPPABLE_PER_SUBJECT) {
    return appErr(
      'not-found',
      'content.questions.bank.empty',
      documents.length === 0
        ? `no question document was found for subject "${String(subject)}". A bank that ` +
          'resolves to nothing is a broken build, not an empty deck.'
        : `none of the ${documents.length} question(s) for subject "${String(subject)}" may be ` +
          'shown: each is unverified, rejected, quarantined, cites a source hash its ' +
          'verification was not granted for, or is missing EN or FR text.',
      { subject: String(subject), offered: documents.length, admitted: admitted.length },
    );
  }
  return ok(admitted);
};

/**
 * Admit the catalogue itself: at least one subject must have a bank.
 *
 * The floor under the floor. `admitSubjectBank` cannot fire for a subject the
 * catalogue never listed, so a glob that matched nothing at all would leave
 * every per-subject check unreachable and every aggregate — the total, the
 * "every subject has 30" — vacuously true. This is the check that has something
 * to say when there is nothing to check.
 */
export const admitSubjectCatalogue = (
  subjects: readonly SubjectId[],
): Result<readonly SubjectId[]> => {
  if (subjects.length === 0) {
    return appErr(
      'not-found',
      'content.questions.catalogue.empty',
      'the question catalogue lists no subject at all. `content/questions/<subject>/*.json` ' +
        'resolved to nothing, so no drill and no exam can be built. This is a build failure ' +
        'that presents as a finished session, which is why it is refused here.',
      { subjects: 0 },
    );
  }
  const duplicates = subjects.filter((id, index) => subjects.indexOf(id) !== index);
  if (duplicates.length > 0) {
    return appErr(
      'invalid',
      'content.questions.catalogue.duplicate',
      'the question catalogue lists the same subject more than once, so a draw across every ' +
        'subject would weight it twice.',
      { duplicates: duplicates.map(String) },
    );
  }
  return ok(subjects);
};

/**
 * Every subject's bank at once, for a draw that spans the whole game.
 *
 * Study drills across everything a build knows and an exam mirrors IRCC's mixed
 * 20 questions, so both need the union — and neither should have to know which
 * subjects exist, which is what `QuestionBank.subjects()` is for.
 *
 * ## Where the floor goes, and where it does not
 *
 * The floor is on the **union**, not on each member, and the difference was
 * found rather than designed: a `content/questions/elections/` directory
 * appeared with eight authored questions and no verifier run yet, and a
 * per-member floor took Study offline over a bank of 232 good questions to
 * report that a subject nobody can reach yet is empty. That is a worse failure
 * than the one it prevents.
 *
 * So a subject that admits nothing is *skipped here* and refused everywhere it
 * is asked for by name. Those are different questions with different right
 * answers: "give me the elections bank" has no honest answer but an error, and
 * "give me everything a player can be asked" has an honest answer that simply
 * does not include elections. What must never happen is the union coming back
 * empty and reading as success — so it does not.
 *
 * Only `content.questions.bank.empty` is tolerated. A chunk that will not
 * download (`io`) and a malformed document (`invalid`) fail the whole call,
 * because those are not "this subject is not verified yet", they are "this build
 * is broken", and a Study screen quietly drawing from three subjects of four
 * would be describing a bank it is not using.
 *
 * Here rather than in the adapter because it uses nothing but the port, and an
 * implementation of it inside one adapter would have to be written again inside
 * the next.
 */
export const loadEveryBank = async (
  bank: QuestionBank,
): Promise<Result<readonly ShippableQuestion[]>> => {
  const subjects = await bank.subjects();
  if (!subjects.ok) return subjects;

  const banks = await Promise.all(subjects.value.map((subject) => bank.questions(subject)));

  const loaded: ShippableQuestion[] = [];
  const skipped: string[] = [];
  for (let index = 0; index < banks.length; index += 1) {
    const result = banks[index];
    if (result === undefined) continue;
    if (result.ok) {
      loaded.push(...result.value);
      continue;
    }
    if (result.error.code !== 'content.questions.bank.empty') return result;
    skipped.push(String(subjects.value[index]));
  }

  if (loaded.length === 0) {
    return appErr(
      'not-found',
      'content.questions.union.empty',
      `the catalogue lists ${subjects.value.length} subject(s) and not one of them can be asked ` +
        'from. A draw across the whole game has nothing to draw, which is a build failure and ' +
        'not a finished session.',
      {
        subjects: subjects.value.map(String),
        skipped,
      },
    );
  }
  return ok(loaded);
};
