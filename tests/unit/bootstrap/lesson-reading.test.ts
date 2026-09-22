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

import { beforeAll, describe, expect, it } from 'vitest';

import { bundledLessonLibrary, createLessonLibrary } from '@adapters/content';
import type { LessonDocument, LessonLibrary } from '@application/ports';
import type { LocalizedText } from '@domain/entities/values';
import type { UiLocale } from '@ui/copy';

import { lessonReaderView, resolveReading } from '../../../app/bootstrap/lesson-reading';
import { grantsPassage } from '../../../app/bootstrap/verified-passages';

/** The one `localise` the level holds, in the two lines it actually is. */
const localise = (value: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

/**
 * The references this route is walked with — **read out of the shipped corpus**,
 * not typed in.
 *
 * No quest ships a `read` step: the first one was authored on Ottawa's canal
 * locks and withdrawn when the canal turned out to have no room for it
 * (ADR-0063 carries the arithmetic), so there is no document to derive them
 * from. Taking them from the corpus instead is the same discipline
 * `a-read-step-reaches-a-reader.test.ts` uses and for its reason: a hard-coded
 * `{ lesson, passage }` pair rots the first time a passage is renamed, and
 * `lesson.schema.json` says a rename is a **new identity** — so it would rot
 * legitimately and fail this suite for a content edit that broke nothing here.
 *
 * **It asks the corpus what it offers; it does not tell the corpus what to
 * have.** The first draft took the first chapter in address order and then
 * demanded a lesson of three passages in it — and the first chapter in address
 * order is `canadas-economy`, which ships one lesson of two. That is not a
 * defect in the corpus: `rights-and-responsibilities-of-citizenship` and
 * `the-justice-system` hold lessons of one, because ADR-0061 measured those
 * chapters as nearly exhausted. A fixture that requires a shape the corpus is
 * allowed not to have fails on content that is doing nothing wrong.
 *
 * So the search is over **every** chapter, in address order, for the first
 * lesson that carries {@link WANTED} passages; and if no lesson anywhere carries
 * that many, the scenario takes the longest one there is and walks with however
 * many that holds — a different number, not a different chapter. Which lesson it
 * settled on, and what it searched, are in every message below, so the next
 * person reading a red run is not guessing.
 */

/**
 * How many passages the walk would like.
 *
 * Three because that is what a stop holds (`TN-READ`, ADR-0065 §3.3) and what a
 * `read` step will name, not because anything here breaks with fewer. Nothing
 * below asserts this number; they all count {@link REFERENCES}.
 */
const WANTED = 3;

let CHAPTER = '';
let LESSON = '';
let SEARCHED = '';
let REFERENCES: { readonly lesson: string; readonly passage: string }[] = [];

beforeAll(async () => {
  const library = bundledLessonLibrary();
  const catalogue = await library.chapters();
  if (!catalogue.ok) throw new Error(`no lesson catalogue: ${catalogue.error.message}`);

  let chapters = 0;
  let lessons = 0;
  /* The longest lesson met so far, which is the answer when nothing reaches
     WANTED. Kept as the search runs so one pass serves both outcomes. */
  let best: { chapter: string; lesson: LessonDocument } | null = null;

  for (const entry of catalogue.value) {
    const held = await library.lessons(entry.chapter);
    if (!held.ok) throw new Error(`chapter "${entry.chapter}": ${held.error.message}`);
    chapters += 1;
    for (const lesson of held.value) {
      lessons += 1;
      if (best === null || lesson.passages.length > best.lesson.passages.length) {
        best = { chapter: entry.chapter, lesson };
      }
    }
    /* Stop at the first chapter that offers enough: the search is a fixture,
       not a survey, and loading all ten to prove one is waste. */
    if (best !== null && best.lesson.passages.length >= WANTED) break;
  }

  SEARCHED = `${String(lessons)} lesson(s) in ${String(chapters)} chapter(s)`;
  if (best === null) {
    throw new Error(
      `the lesson catalogue offers no lesson at all (searched ${SEARCHED}), so this route has ` +
        'nothing to walk. ADR-0024: an empty corpus is a failure, not a quiet pass.',
    );
  }

  CHAPTER = best.chapter;
  LESSON = best.lesson.id;
  REFERENCES = best.lesson.passages
    .slice(0, Math.min(WANTED, best.lesson.passages.length))
    .map((passage) => ({ lesson: best?.lesson.id ?? '', passage: passage.id }));
});

describe('resolveReading', () => {
  it('has a corpus to walk at all, and says what it walked (ADR-0024)', () => {
    const chose = `"${CHAPTER}/${LESSON}" with ${String(REFERENCES.length)} passage(s), ` +
      `after searching ${SEARCHED}`;
    expect(LESSON.length, `no lesson was chosen: ${chose}`).toBeGreaterThan(0);
    expect(REFERENCES.length, `the chosen lesson has no passages: ${chose}`).toBeGreaterThan(0);
    /* Not an assertion that the corpus holds WANTED — it is allowed not to, and
       two of its chapters do not. A number is reported so a reader of a red run
       below knows how long the walk was. */
    expect(REFERENCES.length).toBeLessThanOrEqual(WANTED);
  });

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
    expect([...fetched]).toEqual([CHAPTER]);
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
      [{ lesson: LESSON, passage: 'a-passage-that-was-renamed' }],
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
        REFERENCES[0] as { lesson: string; passage: string },
        { lesson: 'a-lesson-in-another-chapter', passage: 'a-passage' },
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
