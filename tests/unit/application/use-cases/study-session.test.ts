/**
 * The seam Study mounts against, driven over the real bank.
 *
 * The use case is stated in ports, but it is exercised here against the actual
 * `content/questions/` tree through the actual adapter, because the thing worth
 * proving is not that `scheduleReview` can be called — that has its own suite —
 * but that a screen handed this object can render a count, run a drill and be
 * told when it cannot, from the files the repository ships.
 */

import { describe, expect, it } from 'vitest';

import albertaFoothills from '@content/levels/alberta-foothills.json';
import prairieRail from '@content/levels/prairie-rail.json';
import prairieQuest from '@content/quests/prairie-rail-grain-elevator.json';
import toronto from '@content/levels/toronto.json';
import {
  BUNDLED_QUESTION_MODULES,
  createQuestionBank,
  type QuestionModuleMap,
} from '@adapters/content';
import { createSeededRandom } from '@adapters/random';
import type { Clock, SchedulerTuning } from '@application/ports';
import { sharesProposition } from '@application/content/proposition';
import { loadEveryBank } from '@application/content/question-bank';
import { answerQuestion } from '@application/use-cases/answer-question';
import { shippableQuestions } from '@domain/entities/question';
import { newProgress } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { defaultSettings } from '@domain/entities/player';
import type { EpochMillis, LocaleCode, QuestionId, SubjectId } from '@domain/ids';

import { createStudySession } from '@application/use-cases/study-session';

const TUNING: SchedulerTuning = { exclusionWindow: 20, wrongWeight: 3, dailyNewLimit: 10 };

const clockAt = (millis: number): Clock => ({
  now: () => millis as EpochMillis,
  elapsed: () => 0,
});

const emptyProgress = (): Progress => newProgress(defaultSettings('en' as LocaleCode));

const sourceOver = (modules?: QuestionModuleMap, progress: Progress = emptyProgress()) =>
  createStudySession({
    bank: createQuestionBank(modules === undefined ? {} : { modules }),
    clock: clockAt(1_764_000_000_000),
    random: createSeededRandom(2026),
    progress: () => progress,
    tuning: TUNING,
    drillSize: 5,
  });

describe('the Study seam, over the shipped bank', () => {
  it('reports how many questions the build can ask', async () => {
    const onDisk = Object.keys(BUNDLED_QUESTION_MODULES).length;
    const available = await sourceOver().available();
    expect(available.ok).toBe(true);
    if (!available.ok) return;
    /*
     * Every VERIFIED question, across every subject. The bounds are derived
     * rather than written down — the bank is being authored while this runs —
     * but they are still both ends of an interval: at least four subjects'
     * shipping threshold, and strictly fewer than the documents on disk,
     * because some of those are rejected and must not be counted.
     */
    expect(available.value).toBeGreaterThanOrEqual(4 * 30);
    expect(available.value).toBeLessThan(onDisk);
  });

  it('carries the configured drill size so the copy and the loop read one number', () => {
    expect(sourceOver().drillSize).toBe(5);
  });

  it('draws a drill of documents the card can render in either language', async () => {
    const drill = await sourceOver().drill(5);
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions).toHaveLength(5);
    expect(drill.value.shortfall).toBe(0);
    for (const drawn of drill.value.questions) {
      expect(drawn.question.prompt.en.length).toBeGreaterThan(0);
      expect(drawn.question.prompt.fr.length).toBeGreaterThan(0);
      expect(drawn.question.verification.status).toBe('verified');
      expect(['new', 'seen']).toContain(drawn.familiarity);
    }
    /* No duplicate inside one drill. */
    expect(new Set(drill.value.questions.map((d) => String(d.question.id))).size).toBe(5);
  });

  it('replays exactly from its seed', async () => {
    const first = await sourceOver().drill(5);
    const second = await sourceOver().drill(5);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.questions.map((d) => String(d.question.id))).toEqual(
      second.value.questions.map((d) => String(d.question.id)),
    );
  });

  it('does not repeat a question in the next drill (TN-STUDY-02)', async () => {
    const source = sourceOver();
    const first = await source.drill(5);
    const second = await source.drill(5);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const asked = new Set(first.value.questions.map((d) => String(d.question.id)));
    for (const drawn of second.value.questions) {
      expect(asked.has(String(drawn.question.id))).toBe(false);
    }
  });

  it('states a short drill instead of padding it', async () => {
    /* `dailyNewLimit` is 10 and nothing has been seen, so asking for more than
       the day's budget is exactly TN-STUDY-02's short drill. */
    const drill = await sourceOver().drill(12);
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions.length).toBeLessThan(12);
    expect(drill.value.shortfall).toBe(12 - drill.value.questions.length);
    expect(new Set(drill.value.questions.map((d) => String(d.question.id))).size).toBe(
      drill.value.questions.length,
    );
  });

  it('reports a bank it cannot read rather than an empty drill', async () => {
    const source = sourceOver({});
    const available = await source.available();
    const drill = await source.drill(5);
    expect(available.ok).toBe(false);
    expect(drill.ok).toBe(false);
    if (!available.ok) expect(available.error.code).toBe('content.questions.catalogue.empty');
    if (!drill.ok) expect(drill.error.code).toBe('content.questions.catalogue.empty');
  });

  it('draws only the subject a level asks for (ADR-0036)', async () => {
    const drill = await sourceOver().drill(5, { subject: 'justice' as SubjectId });
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions).toHaveLength(5);
    for (const drawn of drill.value.questions) {
      expect(String(drawn.question.subject)).toBe('justice');
    }
  });

  it('asks first the question resting on the sentence a landmark just told', async () => {
    /* The Alberta foothills' pump jack, read from the level that ships it. */
    const pumpJack = albertaFoothills.pois.find((poi) => poi.id === 'pump-jack');
    const quote = pumpJack?.fact.source?.quote;
    expect(quote, 'content/levels/alberta-foothills.json places no sourced pump jack').toBeDefined();
    if (quote === undefined) return;

    const drill = await sourceOver().drill(2, {
      subject: albertaFoothills.subject as SubjectId,
      teaches: [quote],
    });
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(String(drill.value.questions[0]?.question.id)).toMatch(/^eco-30-/u);
    expect(drill.value.questions.every((drawn) => String(drawn.question.subject) === 'economy')).toBe(true);
  });

  it('never leaves the level’s subject for a sentence another subject grades', async () => {
    /*
     * Toronto's streetcar tells what municipalities look after, a sentence
     * `government` grades (ADR-0030). Toronto teaches elections, so the streetcar
     * asks an elections question rather than that one.
     */
    const streetcar = toronto.pois.find((poi) => poi.id === 'streetcar');
    const quote = streetcar?.fact.source?.quote;
    expect(quote).toBeDefined();
    if (quote === undefined) return;

    const drill = await sourceOver().drill(3, {
      subject: toronto.subject as SubjectId,
      teaches: [quote],
    });
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions).toHaveLength(3);
    for (const drawn of drill.value.questions) {
      expect(String(drawn.question.subject)).toBe('elections');
    }
  });

  it('draws only from a quest step’s pool when it names one', async () => {
    const pool = ['jus-01', 'jus-02'].map((prefix) =>
      Object.keys(BUNDLED_QUESTION_MODULES)
        .map((path) => path.split('/').at(-1)?.replace(/\.json$/u, '') ?? '')
        .find((id) => id.startsWith(`${prefix}-`)),
    );
    expect(pool.every((id) => id !== undefined)).toBe(true);
    const ids = pool.filter((id): id is string => id !== undefined) as unknown as QuestionId[];

    const drill = await sourceOver().drill(5, { subject: 'justice' as SubjectId, pool: ids });
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.value.questions.map((drawn) => String(drawn.question.id)).sort()).toEqual(
      [...ids].map(String).sort(),
    );
    expect(drill.value.shortfall).toBe(3);
  });

  it('refuses a drill of zero rather than reporting an empty session', async () => {
    const drill = await sourceOver().drill(0);
    expect(drill.ok).toBe(false);
    if (!drill.ok) expect(drill.error.code).toBe('scheduler.count.invalid');
  });
});

describe('the Prairies with the task declined, over the shipped bank (ADR-0048)', () => {
  /*
   * The second live-site audit: the grain bins asked about Québec's referendums,
   * the combine harvester asked the same question again ("You have seen this
   * question before"), and the container car asked about Bombardier.
   */
  const SUBJECT = prairieRail.subject as SubjectId;
  const STOPS = ['grain-bins', 'grain-elevator', 'combine-harvester', 'container-car'];

  const quoteOf = (id: string): string => {
    const quote = prairieRail.pois.find((poi) => poi.id === id)?.fact.source?.quote;
    if (quote === undefined) throw new Error(`content/levels/prairie-rail.json places no sourced ${id}`);
    return quote;
  };

  it('asks at each stop only what rests on the stop’s own sentence, or nothing', async () => {
    const bank = await loadEveryBank(createQuestionBank({}));
    expect(bank.ok).toBe(true);
    if (!bank.ok) return;

    for (const stop of STOPS) {
      const quote = quoteOf(stop);
      /* Worked out from the documents, not the session: every askable question in
         the level's subject resting on this stop's sentence. */
      const related = shippableQuestions(bank.value)
        .filter((question) => question.subject === SUBJECT)
        .filter((question) => sharesProposition(question.source.quote, quote))
        .map((question) => String(question.id));

      const drill = await sourceOver().drill(5, { subject: SUBJECT, teaches: [quote], onlyWhatItTells: true });
      expect(drill.ok, `${stop}: a stop with nothing to ask is an empty drill, not a failure`).toBe(true);
      if (!drill.ok) return;
      const asked = drill.value.questions.map((drawn) => String(drawn.question.id));
      expect(asked.sort(), `${stop} asked what it did not tell`).toEqual([...related].sort());
      expect(asked.some((id) => /^mc-(16|35)-/u.test(id)), `${stop} asked the audit's questions`).toBe(false);
    }
  });

  it('never puts one question on the card twice in a visit, even one answered wrongly and come due', async () => {
    let now = 1_764_000_000_000;
    let progress = emptyProgress();
    const clock: Clock = { now: () => now as EpochMillis, elapsed: () => 0 };
    const session = createStudySession({
      bank: createQuestionBank({}),
      clock,
      random: createSeededRandom(2026),
      progress: () => progress,
      tuning: TUNING,
      drillSize: 5,
    });

    /* What the build did at the first stop: one question from the whole subject. */
    const first = await session.drill(1, { subject: SUBJECT });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const asked = first.value.questions[0]?.question;
    expect(asked).toBeDefined();
    if (asked === undefined) return;

    const answered = answerQuestion(
      { clock },
      { question: asked, chosenIndex: (asked.correctIndex + 1) % asked.options.length, progress },
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    progress = answered.value.progress;
    /* The ride to the next stop: past both learning steps, so the question is due
       and sits in the missed tier. */
    now += 11 * 60_000;

    /* The audit's repeat, as it was: nothing told the draw what the visit had answered. */
    const unguarded = await session.drill(1, { subject: SUBJECT });
    expect(unguarded.ok).toBe(true);
    if (!unguarded.ok) return;
    expect(String(unguarded.value.questions[0]?.question.id)).toBe(String(asked.id));

    const guarded = await session.drill(1, { subject: SUBJECT, answeredHere: [asked.id] });
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(guarded.value.questions).toHaveLength(1);
    expect(guarded.value.questions.map((drawn) => String(drawn.question.id))).not.toContain(
      String(asked.id),
    );
    expect(guarded.value.repeated).toBe(0);
  });

  it('asks a spent task step again only when told to, and counts what came round again', async () => {
    const step = prairieQuest.steps.find((candidate) => candidate.id === 'answer-at-the-combine-harvester');
    const pool = (step !== undefined && 'questionPool' in step ? step.questionPool : []) as unknown as QuestionId[];
    expect(pool.length, 'the combine’s pool no longer holds exactly its two questions').toBe(2);
    const [spent, fresh] = pool;
    if (spent === undefined || fresh === undefined) return;

    const again = await sourceOver().drill(2, {
      subject: SUBJECT,
      pool,
      answeredHere: [spent],
      repeatWhenExhausted: true,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.questions.map((drawn) => String(drawn.question.id))).toEqual([
      String(fresh),
      String(spent),
    ]);
    expect(again.value.repeated).toBe(1);
    expect(again.value.shortfall).toBe(0);

    const short = await sourceOver().drill(2, { subject: SUBJECT, pool, answeredHere: [spent] });
    expect(short.ok).toBe(true);
    if (!short.ok) return;
    expect(short.value.questions.map((drawn) => String(drawn.question.id))).toEqual([String(fresh)]);
    expect(short.value.repeated).toBe(0);
    expect(short.value.shortfall).toBe(1);
  });
});
