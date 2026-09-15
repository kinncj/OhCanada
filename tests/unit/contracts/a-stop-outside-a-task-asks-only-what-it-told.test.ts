/**
 * A landmark with no task step being played asks only what it told, or nothing,
 * and never one question twice in a visit (ADR-0048).
 *
 * The second live-site audit met, on the Prairies with the task declined, a
 * question about Québec's referendums at the grain bins, the same question again
 * at the combine harvester, and one about Bombardier at the container car. None
 * of them was about the place.
 *
 * Over every landmark every level ships, through the real rule
 * (`app/bootstrap/landmark-questions.ts`), the real session and the bundled
 * bank: a draw wider than the one the game asks, so every candidate is seen, and
 * each one must rest on the landmark's own `source.quote` — the proposition
 * identity of ADR-0028 §4 — inside the level's subject. Then the landmark is
 * engaged again and again as one visit, and no answer may come back.
 *
 * Levels are read off the disk, by a route the bundle never takes, so the
 * expectation comes from `content/` and not from the code under test.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createQuestionBank } from '@adapters/content';
import { createSeededRandom } from '@adapters/random';
import type { SchedulerTuning } from '@application/ports';
import { sharesProposition } from '@application/content/proposition';
import { createStudySession, type StudySession } from '@application/use-cases/study-session';
import { defaultSettings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { EpochMillis, LocaleCode, QuestionId, SubjectId } from '@domain/ids';

import {
  landmarkDraw,
  rememberAnswered,
  teachingQuotes,
} from '../../../app/bootstrap/landmark-questions';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface PoiFile {
  readonly id: string;
  readonly fact?: { readonly source?: { readonly quote?: string } | null } | null;
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
  readonly pois?: readonly PoiFile[];
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const tuning = json<{ scheduler: SchedulerTuning }>('content/game.config.json').scheduler;

const levels = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => json<LevelFile>(`content/levels/${name}`));

/** Wider than the one question the game asks, so no candidate hides behind the first. */
const WIDE = 20;

const sessionFor = (): StudySession =>
  createStudySession({
    bank: createQuestionBank({}),
    clock: { now: () => 1_764_000_000_000 as EpochMillis, elapsed: () => 0 },
    random: createSeededRandom(2026),
    progress: () => newProgress(defaultSettings('en' as LocaleCode)),
    tuning,
    drillSize: 5,
  });

describe('a stop outside a task asks only what it told (ADR-0048)', () => {
  it('has landmarks to check, and some of them tell a sentence a question rests on', async () => {
    const landmarks = levels.flatMap((level) => (level.pois ?? []).map((poi) => ({ level, poi })));
    expect(landmarks.length).toBeGreaterThan(0);

    let asking = 0;
    for (const { level, poi } of landmarks) {
      const draw = landmarkDraw({
        levelSubject: level.subject as SubjectId,
        answering: undefined,
        teaches: teachingQuotes(level.pois, poi.id),
      });
      const drill = await sessionFor().drill(WIDE, draw.scope);
      if (drill.ok && drill.value.questions.length > 0) asking += 1;
    }
    /* Otherwise every case below passes by asking nothing anywhere. */
    expect(asking, 'no landmark in any level asks anything outside a task').toBeGreaterThan(0);
  });

  for (const level of levels) {
    for (const poi of level.pois ?? []) {
      it(`${level.id}: ${poi.id} asks nothing its own sentence does not rest on, and nothing twice`, async () => {
        const subject = level.subject as SubjectId;
        const teaches = teachingQuotes(level.pois, poi.id);
        const draw = landmarkDraw({ levelSubject: subject, answering: undefined, teaches });

        const wide = await sessionFor().drill(WIDE, draw.scope);
        expect(
          wide.ok,
          `content/levels/${level.id}.json "${poi.id}": a stop with nothing to ask is an empty draw, not a failure`,
        ).toBe(true);
        if (!wide.ok) return;
        for (const drawn of wide.value.questions) {
          expect(String(drawn.question.subject), `${poi.id} asked outside ${level.subject}`).toBe(
            level.subject,
          );
          expect(
            teaches.some((quote) => sharesProposition(drawn.question.source.quote, quote)),
            `content/levels/${level.id}.json "${poi.id}" asked ${String(drawn.question.id)}, ` +
              'which does not rest on the sentence the landmark told',
          ).toBe(true);
        }

        /* One visit: engage it again and again, answering each time. */
        const session = sessionFor();
        let answeredHere: readonly QuestionId[] = [];
        let ended = false;
        for (let engagement = 0; engagement <= wide.value.questions.length; engagement += 1) {
          const again = landmarkDraw({ levelSubject: subject, answering: undefined, teaches, answeredHere });
          const drill = await session.drill(again.count, again.scope);
          expect(drill.ok).toBe(true);
          if (!drill.ok) return;
          const asked = drill.value.questions[0]?.question.id;
          if (asked === undefined) {
            ended = true;
            break;
          }
          expect(answeredHere, `${poi.id} asked ${String(asked)} twice in one visit`).not.toContain(asked);
          expect(drill.value.repeated ?? 0).toBe(0);
          answeredHere = rememberAnswered(answeredHere, asked);
        }
        expect(ended, `${poi.id} kept asking after everything it told was answered`).toBe(true);
      });
    }
  }
});
