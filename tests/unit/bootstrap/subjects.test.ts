/**
 * `subject -> level`, the join `OQ-RESULT-2` asked for.
 *
 * Two halves. `buildSubjectIndex` is exercised over a fixture, because the cases
 * worth pinning — two levels claiming one subject, a document whose subject will
 * not load — are unreachable from the real `content/levels/` tree. The real tree
 * is then checked as a whole: every level that ships declares a subject, and no
 * two of them declare the same one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  buildSubjectIndex,
  EMPTY_SUBJECT_INDEX,
} from '../../../app/bootstrap/subjects';

const LEVELS = fileURLToPath(new URL('../../../content/levels/', import.meta.url));

const loader = (value: unknown) => (): Promise<unknown> => Promise.resolve(value);

describe('the subject index', () => {
  it('reads the level id from the file name and the subject from the document', async () => {
    const index = await buildSubjectIndex({
      '../../content/levels/ottawa.json': loader('government'),
      '../../content/levels/winnipeg.json': loader('justice'),
    });
    expect(index.levelFor('government')).toBe('ottawa');
    expect(index.levelFor('justice')).toBe('winnipeg');
  });

  it('unwraps a module namespace as well as a bare value', async () => {
    /* Both are accepted rather than assuming a shape that differs between the
       artefact under test and the artefact deployed. */
    const index = await buildSubjectIndex({
      '../../content/levels/toronto.json': loader({ default: 'elections' }),
    });
    expect(index.levelFor('elections')).toBe('toronto');
  });

  it('answers null for a subject with no level in this build', async () => {
    /* Three subjects have banks and no level document — `economy`, `symbols`,
       `who-we-are` — and an exam can ask about all three. "This build cannot
       name it" is a normal state, and `TN-RESULT-07` says what the screen does
       with it. */
    const index = await buildSubjectIndex({
      '../../content/levels/ottawa.json': loader('government'),
    });
    expect(index.levelFor('economy')).toBeNull();
    expect(EMPTY_SUBJECT_INDEX.levelFor('government')).toBeNull();
  });

  it('keeps the first level of two that claim one subject, and says so', async () => {
    const report = vi.fn();
    const index = await buildSubjectIndex(
      {
        '../../content/levels/zulu.json': loader('government'),
        '../../content/levels/alpha.json': loader('government'),
      },
      report,
    );
    /* Sorted first, so "first" is a property of the content rather than of
       whatever order a glob happened to produce. */
    expect(index.levelFor('government')).toBe('alpha');
    expect(report).toHaveBeenCalledOnce();
    expect(String(report.mock.calls[0]?.[0])).toContain('alpha');
  });

  it('survives a level document that will not load', async () => {
    const report = vi.fn();
    const index = await buildSubjectIndex(
      {
        '../../content/levels/broken.json': () => Promise.reject(new Error('offline')),
        '../../content/levels/ottawa.json': loader('government'),
      },
      report,
    );
    expect(index.levelFor('government')).toBe('ottawa');
    expect(report).toHaveBeenCalledOnce();
  });

  it('ignores a document with no subject rather than indexing an empty one', async () => {
    const index = await buildSubjectIndex({
      '../../content/levels/nameless.json': loader(''),
      '../../content/levels/other.json': loader(7),
    });
    expect(index.levelFor('')).toBeNull();
  });
});

describe('the levels this repository ships', () => {
  const documents = readdirSync(LEVELS)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      level: name.slice(0, -'.json'.length),
      subject: (JSON.parse(readFileSync(`${LEVELS}${name}`, 'utf8')) as { subject?: unknown })
        .subject,
    }));

  it('each declare a subject, so the index is never empty for a built level', () => {
    expect(documents.length).toBeGreaterThan(0);
    for (const { level, subject } of documents) {
      expect(typeof subject, `content/levels/${level}.json declares no subject`).toBe('string');
    }
  });

  it('declare no subject twice, so no result has to choose which chapter to name', () => {
    const subjects = documents.map((entry) => String(entry.subject));
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});
