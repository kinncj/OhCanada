/**
 * A quest's closing line may claim the questions **of the place** only when the
 * quest really asks all of them.
 *
 * The defect this exists for, found on the live site: finishing the North's
 * quest drew "You walked the gravel bar from the vessel to the driftwood and
 * answered every question left here about Canada's regions." Its two `answer`
 * steps ask 2 of a 10-question pool and 3 of a 3-question pool — five of the
 * thirteen questions the two stops hold — so the card told a player they had
 * answered eight questions nobody had asked them. The French said the same
 * thing: « répondu à toutes les questions laissées ici ».
 *
 * The distinction the rule turns on is between two claims that read alike:
 *
 *  - **about the route** — "answered every question along the way",
 *    « répondu à toutes les questions posées en chemin ». True whatever a pool
 *    holds: the player answered every question they were asked. Nine of the ten
 *    shipped quests say it this way.
 *  - **about the place** — "every question left here", « toutes les questions
 *    laissées ici ». True only when each `answer` step asks its whole pool,
 *    because anything left in a pool is a question that is here and was not
 *    asked.
 *
 * So this gate is not a word filter: it reads each quest's own arithmetic and
 * only then decides whether the stronger claim is allowed. Two fixtures below
 * are the same line against both arithmetics, so the check is seen to fail as
 * well as to pass (`docs/plan/slices.md`: "a gate is not trusted until it has
 * been seen to fail on a real violation").
 *
 * It reads `content/` from disk rather than the bundle, like every other file in
 * this directory: the expectation is computed by a route the game never takes.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Text {
  readonly en: string;
  readonly fr: string;
}
interface StepFile {
  readonly id: string;
  readonly kind: string;
  readonly count?: number;
  readonly questionPool?: readonly string[];
}
interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly doneLine?: { readonly text: Text };
  readonly steps: readonly StepFile[];
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const jsonIn = (dir: string): readonly string[] =>
  readdirSync(`${REPO_ROOT}${dir}`)
    .filter((name) => name.endsWith('.json'))
    .sort();

const quests = jsonIn('content/quests').map((name) => json<QuestFile>(`content/quests/${name}`));

const answerSteps = (quest: QuestFile): readonly StepFile[] =>
  quest.steps.filter((step) => step.kind === 'answer');

/**
 * Saying "here", in either language, about questions the place holds.
 *
 * Deliberately narrow: it matches the demonstrative, not the quantifier. "Every
 * question along the way" is about what the player was asked and is always
 * allowed; these two are about what is at the stops.
 */
const PLACE_CLAIM: Readonly<Record<keyof Text, RegExp>> = {
  en: /\b(?:every|all the|each) questions? (?:left |asked |put )?here\b/iu,
  fr: /toutes les questions[^.!?]*\bici\b/iu,
};

/** What a quest asks, and what its stops hold. */
const arithmeticOf = (quest: QuestFile): { asked: number; held: number } => {
  let asked = 0;
  let held = 0;
  for (const step of answerSteps(quest)) {
    asked += step.count ?? 0;
    /* A step with no pool draws from the whole subject, which is more than the
       stop holds by any reading — so it can never support the stronger claim. */
    held += step.questionPool === undefined ? Number.POSITIVE_INFINITY : step.questionPool.length;
  }
  return { asked, held };
};

/** The complaint a closing line earns, or `null` when it claims only what was asked. */
const overclaimIn = (quest: QuestFile): string | null => {
  const line = quest.doneLine?.text;
  if (line === undefined) return null;
  const { asked, held } = arithmeticOf(quest);
  if (asked >= held) return null;
  for (const locale of ['en', 'fr'] as const) {
    if (PLACE_CLAIM[locale].test(line[locale])) {
      return (
        `${quest.id} (${locale}) says the player answered the questions of the place — ` +
        `"${line[locale]}" — but its answer steps ask ${String(asked)} of ${String(held)}`
      );
    }
  }
  return null;
};

describe('a quest’s closing line claims only what the quest asked', () => {
  it('has closing lines and answer steps to judge, so this is about something (ADR-0024)', () => {
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.filter((quest) => quest.doneLine !== undefined).length).toBeGreaterThan(0);
    expect(quests.flatMap(answerSteps).length).toBeGreaterThan(0);
  });

  it('is judging quests that really ask fewer questions than their stops hold', () => {
    /* Without one of these the rule would pass vacuously: every line would be
       allowed to say anything, because no quest could break the promise. */
    const partial = quests.filter((quest) => {
      const { asked, held } = arithmeticOf(quest);
      return asked < held;
    });
    expect(partial.map((quest) => quest.id).length).toBeGreaterThan(0);
  });

  it('is kept by every shipped quest, in both languages', () => {
    const overclaims = quests.map(overclaimIn).filter((complaint) => complaint !== null);
    expect(overclaims, overclaims.join('\n')).toEqual([]);
  });

  it('catches the North’s line as it was shipped, against the arithmetic it was shipped with', () => {
    /* The real defect, as a fixture: the same two steps, the same words. */
    const asShipped: QuestFile = {
      id: 'the-north-sternwheeler',
      levelId: 'the-north',
      doneLine: {
        text: {
          en: 'You walked the gravel bar from the vessel to the driftwood and answered every question left here about Canada’s regions.',
          fr: "Vous avez parcouru la plage de galets, du bateau jusqu'au bois flotté, et répondu à toutes les questions laissées ici sur les régions du Canada.",
        },
      },
      steps: [
        { id: 'answer-at-the-bar', kind: 'answer', count: 2, questionPool: Array.from({ length: 10 }, (_, n) => `q${String(n)}`) },
        { id: 'answer-at-the-driftwood', kind: 'answer', count: 3, questionPool: ['a', 'b', 'c'] },
      ],
    };

    /* Five of thirteen: 2 of a 10-question pool at the bar, 3 of a 3-question
       pool at the driftwood. The arithmetic is summed over the quest, not read
       per step, because the line is one claim about the whole walk. */
    expect(overclaimIn(asShipped)).toContain('ask 5 of 13');
  });

  it('allows the same words where every stop really is asked out', () => {
    const asksEverything: QuestFile = {
      id: 'a-quest-that-asks-it-all',
      levelId: 'a-level',
      doneLine: {
        text: {
          en: 'You answered every question left here.',
          fr: 'Vous avez répondu à toutes les questions laissées ici.',
        },
      },
      steps: [{ id: 'answer', kind: 'answer', count: 3, questionPool: ['a', 'b', 'c'] }],
    };

    expect(overclaimIn(asksEverything)).toBeNull();
  });

  it('allows a line about the route whatever the pools hold', () => {
    const aboutTheRoute: QuestFile = {
      id: 'a-quest-about-its-route',
      levelId: 'a-level',
      doneLine: {
        text: {
          en: 'You walked the harbour and answered every question along the way.',
          fr: 'Vous avez parcouru le port et répondu à toutes les questions posées en chemin.',
        },
      },
      steps: [{ id: 'answer', kind: 'answer', count: 1, questionPool: ['a', 'b', 'c'] }],
    };

    expect(overclaimIn(aboutTheRoute)).toBeNull();
  });
});
