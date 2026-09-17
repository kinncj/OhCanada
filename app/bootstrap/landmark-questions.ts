/**
 * What a level asks at a landmark, and how the card counts it (ADR-0036, ADR-0048).
 *
 * The play-through that found this: Toronto's streetcar — a card about what
 * cities look after — asked about Magna Carta; the CN Tower asked about
 * residential schools; "What is the job of the police?" was the first landmark
 * question in five different levels; and Halifax's tracker said "Answer 2
 * questions about voting" over a card reading "Question 1 of 1" that asked about
 * the police. Every in-level question was one draw from the whole bank, because
 * the loaded level did not carry its subject.
 *
 * The second live-site audit found what was left (ADR-0048): on the Prairies,
 * with the task declined, the grain bins asked about Québec's referendums, the
 * combine harvester asked the same question again, and the container car asked
 * about Bombardier. With no step being played a landmark still drew from the
 * whole subject, and the missed-first tier put a wrong answer straight back on
 * the next stop's card.
 *
 * ## The rules
 *
 *  1. **Every question comes from the level's subject.** ADR-0030 §2: "a level's
 *     `subject` is the remit of its quest's `answer` steps and of the bank the
 *     scheduler draws for it". The level document's `subject` decides; an
 *     `answer` step's own `subject` is the fallback only when the level has none
 *     to say, and `tests/unit/contracts/an-answer-step-asks-its-level-subject.test.ts`
 *     holds the two equal in the content that ships.
 *  2. **An `answer` step asks what it has left, where the player is standing.**
 *     A step of two asks two; one already answered asks the second. The step's
 *     `questionPool`, when it names one, narrows the draw.
 *  3. **The card counts the step, not the draw.** "Question 2 of 2" is the second
 *     of the step's two questions, so the tracker and the card count the same
 *     thing. With no step being played the card draws no counter at all —
 *     "Question 1 of 1" counts nothing.
 *  4. **What the landmark just told comes first.** A question resting on the
 *     sentence its blurb rests on is asked first, when it is inside the subject
 *     and was not asked in this sitting (`@application/content/proposition`).
 *  5. **With no step being played, a landmark asks only what it just told, or
 *     nothing** (ADR-0048). One question at most, resting on its own sentence and
 *     inside the subject. The rest of the subject is not about the place, and a
 *     task's pool belongs to a step the player has not taken. Rule 4's "not
 *     asked in this sitting" holds for it too, for a question the player
 *     answered; one closed unanswered is asked again (`TN-CARD-05`).
 *  6. **Nothing is asked twice in one level visit** (ADR-0048). Every draw is
 *     told what the visit has already answered. A landmark with no step asks
 *     nothing rather than repeat; a task step whose pool the visit has spent asks
 *     again what it answered, and the caller says so.
 *
 * Pure: no DOM, no session. `main.ts` asks this and hands the answer to the
 * drill and the card.
 */

import type { DrillScope } from '@application/use-cases/study-session';
import type { QuestionId, SubjectId } from '@domain/ids';

/** What the card's counter counts, when it counts more than the questions on screen. */
export interface DrillCounter {
  /** Questions already answered before this drill began. */
  readonly answered: number;
  /** Questions the step asks in all. */
  readonly total: number;
}

/** The `answer` step being played, as much of it as the draw needs. */
export interface AnsweringNow {
  readonly step: {
    readonly subject?: SubjectId | undefined;
    readonly questionPool?: readonly QuestionId[] | undefined;
  };
  readonly done: number;
  readonly required: number;
}

export interface LandmarkDrawInput {
  /** `SceneLevel.subject`. `undefined` only for a level the renderer does not hold. */
  readonly levelSubject: SubjectId | undefined;
  readonly answering: AnsweringNow | undefined;
  /** The `source.quote` of what the landmark just told, or nothing. */
  readonly teaches: readonly string[];
  /** What this level visit has answered at its landmarks, most recent first. */
  readonly answeredHere?: readonly QuestionId[] | undefined;
}

export interface LandmarkDraw {
  readonly count: number;
  readonly scope: DrillScope;
  /** `null`: count the drill itself, which for one question means no counter. */
  readonly counter: DrillCounter | null;
}

export function landmarkDraw(input: LandmarkDrawInput): LandmarkDraw {
  const { answering, teaches } = input;
  const subject = input.levelSubject ?? answering?.step.subject;
  const answeredHere = input.answeredHere ?? [];

  if (answering === undefined) {
    return {
      count: 1,
      scope: { subject, teaches, onlyWhatItTells: true, answeredHere },
      counter: null,
    };
  }

  const required = Math.max(1, answering.required);
  const done = Math.min(Math.max(0, answering.done), required - 1);
  return {
    count: required - done,
    scope: {
      subject,
      teaches,
      ...(answering.step.questionPool === undefined ? {} : { pool: answering.step.questionPool }),
      answeredHere,
      repeatWhenExhausted: true,
      /* ADR-0053: the tracker promised this count before a question was asked, so
         the day's new-question budget does not get to make it unreachable. */
      dailyNewLimitApplies: false,
    },
    counter: { answered: done, total: required },
  };
}

/**
 * The visit's answers with one more, most recent first and each id once.
 *
 * Counted on the answer, not the draw: a question put on screen and closed
 * unanswered is asked again at the landmark (`TN-CARD-05`), so only an answer
 * spends it.
 */
export function rememberAnswered(
  answered: readonly QuestionId[],
  id: QuestionId,
): readonly QuestionId[] {
  return [id, ...answered.filter((earlier) => earlier !== id)];
}

/**
 * The counter for what the bank actually handed back.
 *
 * A short bank asks fewer questions than the step has left (`TN-QUEST-05`), and
 * a card reading "Question 2 of 3" over the last question drawn would promise
 * one that is not coming — its button already says "Finish". So a short draw
 * counts to what was drawn; a full draw keeps the step's count.
 */
export function counterForDrawn(draw: LandmarkDraw, drawn: number): DrillCounter | null {
  if (draw.counter === null || drawn >= draw.count) return draw.counter;
  return { answered: draw.counter.answered, total: draw.counter.answered + Math.max(0, drawn) };
}

/** A landmark as the level holds it: enough to find the sentence its blurb rests on. */
export interface TeachingLandmark {
  readonly id: string;
  readonly fact?: { readonly source?: { readonly quote?: string } | null } | null;
}

/**
 * The sentence this landmark's card told the player, or nothing.
 *
 * Read from `teachingPois` only: a landmark whose claim was refused drew no card,
 * so it told nothing and has nothing to ask first.
 */
export function teachingQuotes(
  teachingPois: readonly TeachingLandmark[] | undefined,
  landmarkId: string,
): readonly string[] {
  const quote = teachingPois?.find((poi) => poi.id === landmarkId)?.fact?.source?.quote;
  return quote === undefined || quote.trim() === '' ? [] : [quote];
}
