/**
 * The composition root's leg of ADR-0063 §6: references in, prose out.
 *
 * Two things are asserted and they are different claims. The first is that the
 * route is **lazy by chapter** — the index is asked, exactly one chapter is
 * fetched, and a corpus of 48 documents never lands on the initial payload. The
 * second is that what comes out is a `LessonReaderView`: a title and
 * `{ id, text }`, in one language, with no field a reference, a `fact` block or
 * a `LocalizedText` could be poured into.
 *
 * It runs over the real bundled library, because the failure this route has to
 * survive is a failure of the real corpus — a renamed passage, a chapter that
 * moved — and a stub cannot be wrong in those ways.
 */

import { describe, expect, it } from 'vitest';

import { bundledLessonLibrary, createLessonLibrary } from '@adapters/content';
import type { LessonLibrary } from '@application/ports';
import type { LocalizedText } from '@domain/entities/values';
import type { UiLocale } from '@ui/copy';

import { lessonReaderView, resolveReading } from '../../../app/bootstrap/lesson-reading';
import { grantsPassage } from '../../../app/bootstrap/verified-passages';

/** The one `localise` the level holds, in the two lines it actually is. */
const localise = (value: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

/** The step `content/quests/ottawa-parliament-hill.json` ships. */
const LESSON = 'govern-03-the-royal-family-and-the-legislatures';
const REFERENCES = [
  { lesson: LESSON, passage: 'g3-royal-family-lifelong-service' },
  { lesson: LESSON, passage: 'g3-other-constitutional-monarchies' },
  { lesson: LESSON, passage: 'g3-each-legislature-passes-its-own-laws' },
];

describe('resolveReading', () => {
  it('resolves a shipped read step against the one catalogue', async () => {
    const reading = await resolveReading(bundledLessonLibrary(), REFERENCES, grantsPassage);
    expect(reading.ok, reading.ok ? '' : reading.error.message).toBe(true);
    if (!reading.ok) return;
    expect(reading.value.lesson.id).toBe(LESSON);
    expect(reading.value.passages.map((passage) => passage.id)).toEqual(
      REFERENCES.map((reference) => reference.passage),
    );
    expect(reading.value.refused).toEqual([]);
  });

  it('fetches exactly one chapter, which is the whole of the laziness', async () => {
    /*
     * ADR-0063 §6 and the ≤ 8 MB initial payload: a reference names a lesson and
     * a chunk is a chapter, so this route asks the index — which costs nothing —
     * and downloads one. Counting chapters rather than documents is the property:
     * the number that must not grow with the corpus is how many chapters a
     * single stop pulls in.
     */
    const fetched = new Set<string>();
    const library: LessonLibrary = {
      chapters: async () => bundledLessonLibrary().chapters(),
      lessons: async (chapter: string) => {
        fetched.add(chapter);
        return bundledLessonLibrary().lessons(chapter);
      },
    };

    const reading = await resolveReading(library, REFERENCES, grantsPassage);
    expect(reading.ok).toBe(true);
    expect([...fetched]).toEqual(['how-canadians-govern-themselves']);
  });

  it('is not-found, naming the lesson, when no chapter holds it', async () => {
    const reading = await resolveReading(
      bundledLessonLibrary(),
      [{ lesson: 'no-such-lesson', passage: 'no-such-passage' }],
      grantsPassage,
    );
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.kind).toBe('not-found');
    expect(reading.error.code).toBe('content.lesson.chapter.dangling');
    expect(reading.error.details?.['lesson']).toBe('no-such-lesson');
  });

  it('is dangling, not undefined, for a renamed passage inside a real lesson', async () => {
    /* `lesson.schema.json`: a rename is a new identity, so the old id points at
       nothing and must fail rather than fall back to a position. */
    const reading = await resolveReading(
      bundledLessonLibrary(),
      [{ lesson: LESSON, passage: 'g3-a-passage-that-was-renamed' }],
      grantsPassage,
    );
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.code).toBe('content.lesson.passage.dangling');
  });

  it('refuses a step naming two lessons without fetching either chapter', async () => {
    let asked = 0;
    const library: LessonLibrary = {
      chapters: async () => bundledLessonLibrary().chapters(),
      lessons: async (chapter: string) => {
        asked += 1;
        return bundledLessonLibrary().lessons(chapter);
      },
    };
    const reading = await resolveReading(
      library,
      [
        { lesson: LESSON, passage: 'g3-royal-family-lifelong-service' },
        { lesson: 'govern-01-a-federal-state', passage: 'g1-room-to-try-new-ideas' },
      ],
      grantsPassage,
    );
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.code).toBe('content.lesson.passages.manyLessons');
    expect(asked).toBe(0);
  });

  it('carries the catalogue’s own failure rather than inventing one', async () => {
    const empty = createLessonLibrary({ modules: {} });
    const reading = await resolveReading(empty, REFERENCES, grantsPassage);
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.code).toBe('content.lessons.catalogue.empty');
  });

  it('carries an io failure through, so a caller can still tell it from a defect', async () => {
    const offline: LessonLibrary = {
      chapters: async () => bundledLessonLibrary().chapters(),
      lessons: async () => ({
        ok: false,
        error: { kind: 'io', code: 'content.lessons.fetchFailed', message: 'offline' },
      }),
    };
    const reading = await resolveReading(offline, REFERENCES, grantsPassage);
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.error.kind).toBe('io');
  });
});

describe('lessonReaderView', () => {
  it('is a title and prose, in the language the caller chose, and nothing else', async () => {
    const reading = await resolveReading(bundledLessonLibrary(), REFERENCES, grantsPassage);
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;

    const en = lessonReaderView(reading.value, 'en', localise);
    const fr = lessonReaderView(reading.value, 'fr', localise);
    expect(en).not.toBeNull();
    expect(fr).not.toBeNull();
    if (en === null || fr === null) return;

    expect(en.title).toBe(reading.value.lesson.title.en);
    expect(fr.title).toBe(reading.value.lesson.title.fr);
    expect(en.passages).toEqual(
      reading.value.passages.map((passage) => ({ id: passage.id, text: passage.text.en })),
    );
    expect(fr.passages.map((passage) => passage.text)).toEqual(
      reading.value.passages.map((passage) => passage.text.fr),
    );

    /* One passage, two languages, one grant: the French is not a second claim. */
    for (let index = 0; index < en.passages.length; index += 1) {
      expect(fr.passages[index]?.text).not.toBe(en.passages[index]?.text);
    }

    /* The view carries no verification, no source and no second language. */
    expect(JSON.stringify(en)).not.toContain('verification');
    expect(JSON.stringify(en)).not.toContain('sourceHash');
    expect(JSON.stringify(en)).not.toContain('"fr"');
  });

  it('is null when every passage was refused, so no reader opens', async () => {
    /* A sheet with a heading and no words is a screen the player dismisses
       having been told nothing (ADR-0024). */
    const quarantined = await resolveReading(bundledLessonLibrary(), REFERENCES, () => ({
      granted: false,
      why: 'not-verified',
      status: 'quarantined',
    }));
    expect(quarantined.ok).toBe(true);
    if (!quarantined.ok) return;
    expect(quarantined.value.passages).toEqual([]);
    expect(quarantined.value.refused).toHaveLength(REFERENCES.length);
    expect(lessonReaderView(quarantined.value, 'en', localise)).toBeNull();
  });
});
