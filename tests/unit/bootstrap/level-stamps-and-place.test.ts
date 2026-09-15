import { describe, expect, it, vi } from 'vitest';

import type { StudyQuestion } from '@application/use-cases/study-session';

import { questionView } from '../../../app/bootstrap/quiz';
import { createScreenArt } from '../../../app/bootstrap/screen-art';

/**
 * ADR-0045: the passport presses every earned stamp in its level's landmark,
 * and the question card names where it is asked.
 */

const MANIFEST = {
  version: 2,
  files: [
    {
      path: 'img/halifax-landmark-pier-21@1x.11111111.webp',
      kind: 'image',
      scale: 1,
      keys: ['halifax-landmark-pier-21'],
      levels: ['halifax'],
    },
    {
      path: 'img/halifax-landmark-town-clock@1x.030021fe.webp',
      kind: 'image',
      scale: 1,
      keys: ['halifax-landmark-town-clock'],
      levels: ['halifax'],
    },
  ],
} as const;

function stage(levelPois?: (id: string) => Promise<readonly { readonly artKey: string }[] | null>) {
  const report = vi.fn();
  const art = createScreenArt({
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MANIFEST) }),
    baseUrl: '/OhCanada/',
    devicePixelRatio: () => 1,
    document: undefined,
    report,
    ...(levelPois === undefined ? {} : { levelPois }),
  });
  return { art, report };
}

describe('a level’s stamp, by id', () => {
  it('is the completion card’s stamp: the level’s first landmark in its own order', async () => {
    /* Halifax places the Town Clock before Pier 21; an alphabetical pick would
       press Pier 21. */
    const read = vi.fn((_id: string) =>
      Promise.resolve([
        { artKey: 'halifax-landmark-town-clock' },
        { artKey: 'halifax-prop-market-stall' },
        { artKey: 'halifax-landmark-pier-21' },
      ]),
    );
    const { art } = stage(read);
    expect(art.stampOfLevel('halifax')).toBeNull();
    expect(await art.learnStamps(['halifax'])).toBe(true);
    expect(art.stampOfLevel('halifax')).toBe('/OhCanada/img/halifax-landmark-town-clock@1x.030021fe.webp');
  });

  it('reads each level once, and says nothing new the second time', async () => {
    const read = vi.fn((_id: string) => Promise.resolve([{ artKey: 'halifax-landmark-town-clock' }]));
    const { art } = stage(read);
    await art.learnStamps(['halifax', 'halifax']);
    expect(await art.learnStamps(['halifax'])).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('is nothing for a level with no document, and for a build that cannot read one', async () => {
    const { art } = stage(() => Promise.resolve(null));
    expect(await art.learnStamps(['nowhere'])).toBe(false);
    expect(art.stampOfLevel('nowhere')).toBeNull();

    const none = stage();
    expect(await none.art.learnStamps(['halifax'])).toBe(false);
    expect(none.art.stampOfLevel('halifax')).toBeNull();
  });

  it('tries again later when a document did not arrive, and says so once', async () => {
    let fail = true;
    const read = vi.fn((_id: string) =>
      fail ? Promise.reject(new Error('offline')) : Promise.resolve([{ artKey: 'halifax-landmark-town-clock' }]),
    );
    const { art, report } = stage(read);
    expect(await art.learnStamps(['halifax'])).toBe(false);
    expect(report).toHaveBeenCalledTimes(1);
    fail = false;
    expect(await art.learnStamps(['halifax'])).toBe(true);
    expect(art.stampOfLevel('halifax')).not.toBeNull();
  });
});

describe('the place a question is asked', () => {
  const selected = {
    familiarity: 'new',
    question: {
      prompt: { en: 'Who?', fr: 'Qui?' },
      options: [
        { en: 'A', fr: 'A' },
        { en: 'B', fr: 'B' },
        { en: 'C', fr: 'C' },
        { en: 'D', fr: 'D' },
      ],
      correctIndex: 0,
      explanation: { en: 'Because.', fr: 'Parce que.' },
    },
  } as unknown as StudyQuestion;

  it('reaches the card as the names it is handed', () => {
    const view = questionView(selected, 'fr', 0, 1, null, ['Halifax', "Tour de l'horloge d'Halifax"]);
    expect(view.place).toEqual(['Halifax', "Tour de l'horloge d'Halifax"]);
  });

  it('is left off entirely in Study, where nothing names a place', () => {
    expect('place' in questionView(selected, 'en', 0, 1)).toBe(false);
    expect('place' in questionView(selected, 'en', 0, 1, null, [])).toBe(false);
  });
});
