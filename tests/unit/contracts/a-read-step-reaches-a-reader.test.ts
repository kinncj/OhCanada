import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  passageVerdict,
  readLessonCorpus,
  resolvePassage,
  type CorpusLesson,
  type CorpusPassage,
} from '../../../scripts/lib/lesson-passages.mjs';

import { readQuest } from '../../../app/bootstrap/quests';
import { createLessonReader, type LessonReaderView } from '@ui/lesson-reader';

import { buildPage } from '../ui/support/fake-dom';

/**
 * THE WHOLE ROUTE, END TO END: a `read` step, a reference, a resolution, a
 * readable verdict, a language, and the words on a phone.
 *
 * ADR-0063 left the last leg of this route undescribed on purpose. The loader
 * checks a `read` step's **shape** and deliberately not whether its references
 * resolve, "because resolving a reference in the composition root would mean
 * eagerly globbing 48 lesson documents into the initial payload, against §6's
 * per-chapter lazy catalogue and the <= 8 MB budget". The resolver answers
 * exactly one passage or a named failure. The reader draws prose. Nothing until
 * now joined the three, and a route proved in three pieces is a route nobody has
 * walked.
 *
 * ## What this file pins, and it is a decision as much as a test
 *
 * **The passage reaches `app/ui` as prose and an id, and as nothing else.**
 * Every step before the screen happens outside it:
 *
 *  1. `readQuest` accepts the step and hands back `passages[]` — pairs, never
 *     words.
 *  2. `resolvePassage` turns one pair into exactly one passage **or a named
 *     failure**. Zero matches is `dangling`, two is `ambiguous`, and neither is
 *     `undefined`, which is the whole reason the resolver exists (ADR-0024).
 *  3. `passageVerdict` is the shippable-passage filter ADR-0063 §6 puts outside
 *     every screen, so the level reader and the Learn reader cannot disagree
 *     about what is readable. A quarantined passage leaves the level the way it
 *     leaves Learn: by not being in the list.
 *  4. Only then is a language chosen, and only then does a view exist.
 *
 * The screen cannot do any of that and cannot be made to: `LessonReaderView` has
 * no field a reference, a `fact` block or a `LocalizedText` fits into. That is
 * asserted below by reading the screen's own source, because a type keeps a
 * promise the day it is written and a gate keeps it afterwards.
 *
 * ## The fixture is built from the real corpus, and why
 *
 * No quest ships a `read` step — authoring the first is content's obligation,
 * dated 2027-02-20 — and this suite may not write one into `content/`. So the
 * fixture quest below is assembled **in this file**, around references taken
 * from the corpus as it actually stands. That is deliberate rather than lazy: a
 * hard-coded `{ lesson, passage }` pair would rot the first time a passage is
 * renamed, and `lesson.schema.json` says a rename is a new identity, so it would
 * rot *legitimately* and fail this route test for a content edit that broke
 * nothing here. The dangling case is proved on purpose instead, below, with a
 * pair that never existed.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const corpus = readLessonCorpus(REPO_ROOT);

/** The passage's own text, narrowed out of the corpus reader's wide JSON. */
const textOf = (passage: CorpusPassage, locale: 'en' | 'fr'): string => {
  const value = passage.text?.[locale];
  return typeof value === 'string' ? value : '';
};

/**
 * A lesson this route test reads from: the first in chapter order whose first
 * three passages are all readable.
 *
 * Not *Canada's Regions*: ADR-0028's live check of that chapter is still open
 * and ADR-0063 names it among the material the first authored step may not use.
 * Choosing the same way an author would keeps the fixture honest about what a
 * `read` step will actually carry.
 */
const READABLE = (lesson: CorpusLesson): boolean =>
  lesson.chapter !== "Canada's Regions" &&
  lesson.passages.length >= 3 &&
  lesson.passages.slice(0, 3).every((passage) => passageVerdict(passage).readable);

const lesson = [...corpus.lessons].sort((a, b) => a.id.localeCompare(b.id)).find(READABLE);

/** The `read` step this route walks, assembled here and never in `content/`. */
const questWithARead = (references: readonly { lesson: string; passage: string }[]): unknown => ({
  $schema: '../schemas/quest.schema.json',
  id: 'fixture-read-route',
  levelId: 'toronto',
  giver: 'fixture-plaque',
  title: { en: 'A fixture quest', fr: 'Une quête fictive' },
  summary: { en: 'Read the plaque.', fr: 'Lisez la plaque.' },
  steps: [
    {
      id: 'read-the-plaque',
      kind: 'read',
      targetId: 'fixture-plaque',
      prompt: { en: 'Read the plaque.', fr: 'Lisez la plaque.' },
      passages: references,
    },
  ],
});

describe('a read step reaches a reader', () => {
  it('has a corpus to walk at all', () => {
    /* ADR-0024: this file must not reduce to a pass on an empty corpus. */
    expect(corpus.faults).toEqual([]);
    expect(corpus.passageCount).toBeGreaterThan(0);
    expect(lesson, 'no shipped lesson has three readable passages').toBeDefined();
  });

  it('carries references through the loader as pairs, never as words', () => {
    const chosen = lesson as CorpusLesson;
    const references = chosen.passages
      .slice(0, 3)
      .map((passage) => ({ lesson: chosen.id, passage: passage.id }));

    const quest = readQuest(questWithARead(references), 'tests/fixture-read-route');
    expect(quest.ok, quest.ok ? '' : quest.error.message).toBe(true);
    if (!quest.ok) return;

    const step = quest.value.steps[0];
    expect(step?.kind).toBe('read');
    expect(step?.passages).toEqual(references);
    /* The step has no field for text, and the loader invents none. */
    expect(step?.dialogue).toBeUndefined();
    expect(JSON.stringify(step)).not.toContain(textOf(chosen.passages[0] as CorpusPassage, 'en'));
  });

  it('resolves each pair to exactly one readable passage, then to prose in one language', () => {
    const chosen = lesson as CorpusLesson;
    const references = chosen.passages
      .slice(0, 3)
      .map((passage) => ({ lesson: chosen.id, passage: passage.id }));

    const view: LessonReaderView = {
      title: 'A fixture lesson title',
      passages: references.map((reference) => {
        const resolution = resolvePassage(corpus, reference);
        expect(resolution.ok, resolution.ok ? '' : resolution.message).toBe(true);
        if (!resolution.ok) throw new Error(resolution.message);
        /* §6's filter, outside the screen, before a view exists. */
        expect(passageVerdict(resolution.match.passage).readable).toBe(true);
        return {
          id: resolution.match.passage.id,
          text: textOf(resolution.match.passage, 'en'),
        };
      }),
    };

    const page = buildPage();
    const reader = createLessonReader(page.host, { locale: 'en' });
    reader.show(view);

    /* The words on the phone are the corpus's own words, letter for letter. */
    const drawn = page.doc
      .querySelectorAll('[data-testid="lesson-reader-passage"]')
      .map((node) => node.textContent);
    expect(drawn).toEqual(chosen.passages.slice(0, 3).map((passage) => textOf(passage, 'en')));
    expect(drawn.every((paragraph) => paragraph.length > 0)).toBe(true);
  });

  it('draws the French passage in French, from the same one grant', () => {
    const chosen = lesson as CorpusLesson;
    const build = (locale: 'en' | 'fr'): LessonReaderView => ({
      title: 'A fixture lesson title',
      passages: chosen.passages.slice(0, 3).map((passage) => {
        const resolution = resolvePassage(corpus, {
          lesson: chosen.id,
          passage: passage.id,
        });
        if (!resolution.ok) throw new Error(resolution.message);
        return { id: resolution.match.passage.id, text: textOf(resolution.match.passage, locale) };
      }),
    });

    const page = buildPage();
    const reader = createLessonReader(page.host, { locale: 'en' });
    reader.show(build('en'));
    reader.setLocale('fr', build('fr'));

    const drawn = page.doc
      .querySelectorAll('[data-testid="lesson-reader-passage"]')
      .map((node) => node.textContent);
    expect(drawn).toEqual(chosen.passages.slice(0, 3).map((passage) => textOf(passage, 'fr')));
    expect(page.doc.byTestId('lesson-reader')?.getAttribute('lang')).toBe('fr');
    /* One passage, two languages, one grant: the French is not a second claim. */
    for (const passage of chosen.passages.slice(0, 3)) {
      expect(textOf(passage, 'fr')).not.toBe(textOf(passage, 'en'));
    }
  });

  it('opens no reader for a reference that names nothing', () => {
    /*
     * The dangling case, proved with a pair that never existed rather than by
     * breaking a real one. `resolvePassage` answers a named failure and never
     * `undefined`, so the caller has nothing success-shaped to pour into a view
     * — and a reader with no passages does not open (ADR-0024).
     */
    const resolution = resolvePassage(corpus, {
      lesson: 'no-such-lesson-in-this-corpus',
      passage: 'no-such-passage',
    });
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;
    expect(resolution.why).toBe('dangling');
    expect(resolution.count).toBe(0);

    const page = buildPage();
    const reader = createLessonReader(page.host, { locale: 'en' });
    reader.show({ title: 'A lesson whose passages all dangled', passages: [] });
    expect(reader.visible).toBe(false);
  });

  it('keeps the shippable-passage filter out of the screen', () => {
    /*
     * ADR-0063 §6, held by reading the source rather than by trusting the type.
     * A screen that learned to read a `fact` block would be a screen that could
     * put a quarantined paragraph on a phone with every gate still green, and
     * the second place that decides what "readable" means.
     */
    const source = readFileSync(
      fileURLToPath(new URL('../../../app/ui/lesson-reader.ts', import.meta.url)),
      'utf8',
    );
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line))
      .join('\n');

    for (const forbidden of [
      'verification',
      'sourceHash',
      'factual',
      'import.meta.glob',
      'content/lessons',
      'LocalizedText',
    ]) {
      expect(code, `app/ui/lesson-reader.ts reads ${forbidden}`).not.toContain(forbidden);
    }
  });
});
