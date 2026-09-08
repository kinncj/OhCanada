/**
 * The gate on task 1.13's real acceptance.
 *
 * "The level loads from JSON alone" is not proved by Ottawa rendering. It is
 * proved by the *absence* of Ottawa from the engine, and that is a property of
 * the source rather than of a running frame — so it is checked the way
 * `filters-have-a-plain-path.test.ts` checks its own claim: by reading this
 * adapter's files with the comments stripped and failing on what is left.
 *
 * Three things must not appear in `app/adapters/phaser/**` code:
 *
 *   1. **A level id.** Derived from `content/levels/` rather than listed, so
 *      adding Quebec City in slice 2 automatically extends what this forbids. A
 *      scene that can name a level will eventually branch on one.
 *   2. **Ottawa's vocabulary.** "Rideau", "Parliament", "Peace Tower",
 *      "officer" — the words that would mean this level's *content* had leaked
 *      into the engine. An id can be a coincidence; "Peace Tower" cannot.
 *   3. **A locomotion mode name**, outside the one module whose job is to state
 *      the schema's enum. That is task 1.14's acceptance and it is asserted in
 *      more detail in `locomotion.test.ts`; here it is the directory-wide sweep.
 *
 * Comments are stripped first and deliberately so. The files here explain what
 * they are for, and a header that says "Ottawa's canal" is documentation. What
 * must not exist is an Ottawa the *code* can see.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ADAPTER_DIR = `${REPO_ROOT}app/adapters/phaser`;
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

const sourceFiles = readdirSync(ADAPTER_DIR)
  .filter((name) => name.endsWith('.ts'))
  .sort();

const levelIds = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length));

/** Source with block comments, line comments and import paths removed. */
const codeOf = (file: string): string =>
  readFileSync(`${ADAPTER_DIR}/${file}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '')
    /* Import specifiers name modules, not levels, and `content/levels/*.json`
       has to appear in the catalog's glob or there is no catalog. */
    .replace(/^\s*(?:import|export)[\s\S]*?from\s+'[^']*';$/gmu, '')
    .replace(/import\.meta\.glob\([^)]*\)/gu, '');

describe('no level id appears in the engine', () => {
  it('the premise: there is at least one level to look for', () => {
    expect(levelIds.length).toBeGreaterThan(0);
  });

  it.each(sourceFiles)('%s', (file) => {
    const code = codeOf(file);
    const found = levelIds.filter((id) => new RegExp(`['"\`]${id}['"\`]`, 'u').test(code));
    expect(
      found,
      `app/adapters/phaser/${file} names the level(s) ${found.join(', ')}. Task 1.13's ` +
        'acceptance is that a level loads from JSON alone, and slice 2 proves it by adding ' +
        'Quebec City with no engine change — which a named level makes impossible.',
    ).toEqual([]);
  });
});

describe("no level's content vocabulary appears in the engine", () => {
  /* Words that could only have come from Ottawa's content. Not a blanket ban on
     English: each of these names a place, a person or a landmark that belongs in
     `content/levels/ottawa.json` and in `assets/`, and nowhere else. */
  const VOCABULARY = ['rideau', 'parliament', 'peace tower', 'peacetower', 'skateway', 'mountie'];

  it.each(sourceFiles)('%s', (file) => {
    const code = codeOf(file).toLowerCase();
    const found = VOCABULARY.filter((word) => code.includes(word));
    expect(
      found,
      `app/adapters/phaser/${file} contains ${found.join(', ')} — Ottawa's content has leaked ` +
        'into the engine.',
    ).toEqual([]);
  });
});

describe('no locomotion mode name appears outside the module that states the enum', () => {
  const MODES = ['walk', 'canoe', 'skate', 'bike', 'train', 'horse', 'skateboard', 'dogsled'];
  /* `level-document.ts` mirrors `level.schema.json#/$defs/locomotionMode`, which
     is exactly where a list of mode names belongs: it is the vocabulary a
     document may use, and the parser has to reject anything outside it. */
  const ALLOWED = new Set(['level-document.ts']);

  it.each(sourceFiles.filter((file) => !ALLOWED.has(file)))('%s', (file) => {
    const code = codeOf(file);
    const found = MODES.filter((mode) => new RegExp(`['"\`]${mode}['"\`]`, 'u').test(code));
    expect(
      found,
      `app/adapters/phaser/${file} names the mode(s) ${found.join(', ')}. Walking, canoeing, ` +
        'skating, biking, the train, horseback, a skateboard and a dogsled differ by data and ' +
        'by one strategy, never by scene code (CLAUDE.md; slice 1 task 1.14).',
    ).toEqual([]);
  });

  it('the one allowed file really is the one that mirrors the schema', () => {
    const code = codeOf('level-document.ts');
    for (const mode of MODES) expect(code).toContain(`'${mode}'`);
  });
});

describe('the level scene reads its geometry from the document, not from constants', () => {
  const scene = codeOf('level-scene.ts');

  it('never hard-codes a world size, a spawn or a ground height', () => {
    /* The specific failure this guards: a scene that "temporarily" pins the ice
       at y = 1240 renders Ottawa perfectly and renders every other level wrong.
       Every geometry number a scene uses has to be reachable from `level.*`. */
    for (const property of ['level.size', 'level.spawn', 'level.ground', 'level.camera', 'level.layers']) {
      expect(scene, `level-scene.ts never reads ${property}`).toContain(property);
    }
  });

  it('takes its locomotion tuning from the document, not from a table', () => {
    expect(scene).toContain('level.locomotion[0]');
  });

  it('reads the parallax layers through the tier gate rather than drawing them all', () => {
    expect(scene).toContain('selectLayers');
  });
});
