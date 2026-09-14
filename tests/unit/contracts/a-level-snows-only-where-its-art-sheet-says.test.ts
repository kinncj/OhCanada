/**
 * A level's `weather` is the weather its art sheet states, and nothing else.
 *
 * Snow fell on all ten levels, the late-summer harvest on the Prairies
 * included, because no level document could say otherwise and the scene asked
 * every level for the same number of flakes. The decision was never missing: each
 * `assets/style/<id>-level.md` states its season, and the two winter sheets list
 * a falling-snow source while the eight others say, in so many words, that no
 * weather falls. What was missing was anything joining that sentence to the
 * document the engine reads.
 *
 * So the join is made here, mechanically, from the sheets' own phrasing:
 *
 *   - **snow** — a `| falling snow |` row in the sheet's treatment table naming
 *     this level's own `<id>-particle-snow` source (Ottawa, Québec City);
 *   - **none** — "no falling weather", or a `| falling weather | **none` row
 *     (the other eight).
 *
 * A sheet must make exactly one of those statements. One that makes neither is
 * a sheet that has not decided, and one that makes both contradicts itself;
 * either way the level's `weather` has nothing to be checked against, and that
 * fails rather than passing on silence (ADR-0024).
 *
 * Two suites, as `locomotion-tuning-is-coherent.test.ts` has: the corpus is the
 * one that matters, and the fixtures prove the reader rejects what it should
 * today, so a reader that stopped matching anything cannot pass the corpus by
 * reading nothing.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;
const STYLE_DIR = `${REPO_ROOT}assets/style`;

type Weather = 'snow' | 'none';

/** Every statement about falling weather a sheet makes, in the sheets' own words. */
const statementsIn = (sheet: string, levelId: string): readonly Weather[] => {
  const found: Weather[] = [];
  const snowRow = new RegExp(`^\\|\\s*falling snow\\s*\\|\\s*\`${levelId}-particle-snow\``, 'imu');
  if (snowRow.test(sheet)) found.push('snow');
  if (/no falling weather/iu.test(sheet) || /^\|\s*falling weather\s*\|\s*\*\*none\b/imu.test(sheet)) {
    found.push('none');
  }
  return found;
};

const levelIds = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

describe('the reader finds what a sheet says about weather', () => {
  it('reads a winter sheet by its own falling-snow source', () => {
    const sheet =
      '| falling snow | `somewhere-particle-snow`, three flat opaque discs. | none. |\n';
    expect(statementsIn(sheet, 'somewhere')).toEqual(['snow']);
  });

  it('reads both ways a sheet says nothing falls', () => {
    expect(statementsIn('**No falling weather, no fog, no spray.**', 'somewhere')).toEqual(['none']);
    expect(statementsIn('| falling weather | **none. This level is summer** |', 'somewhere')).toEqual([
      'none',
    ]);
  });

  it('does not read snow into a sheet that only mentions it', () => {
    /* Every summer sheet says "snow" somewhere: a snow-capped range, a note on
       how the scene used to draw falling snow, another level's source. */
    const prose =
      '| `x-layer-20-range` | a snow-capped range |\n' +
      'the scene draws falling snow with `Graphics`, procedurally.\n' +
      '| falling snow | `another-level-particle-snow` |\n';
    expect(statementsIn(prose, 'somewhere')).toEqual([]);
  });

  it('reports a sheet that says both, so a contradiction cannot pick a side', () => {
    const both = '| falling snow | `somewhere-particle-snow` |\n**No falling weather.**\n';
    expect(statementsIn(both, 'somewhere')).toEqual(['snow', 'none']);
  });
});

describe("every level's weather is its art sheet's", () => {
  it('there are levels, so this suite is not measuring an empty directory', () => {
    expect(levelIds.length).toBeGreaterThan(0);
  });

  it.each(levelIds)('%s', (id) => {
    const sheetPath = `${STYLE_DIR}/${id}-level.md`;
    expect(existsSync(sheetPath), `assets/style/${id}-level.md does not exist, so nothing says what season ${id} is`).toBe(true);

    const statements = statementsIn(readFileSync(sheetPath, 'utf8'), id);
    expect(
      statements,
      `assets/style/${id}-level.md must state its falling weather exactly once — a ` +
        `"| falling snow | \`${id}-particle-snow\`" row, or "no falling weather" — and it states ` +
        `${statements.length === 0 ? 'nothing' : statements.join(' and ')}.`,
    ).toHaveLength(1);

    const document = JSON.parse(readFileSync(`${LEVELS_DIR}/${id}.json`, 'utf8')) as {
      readonly weather?: unknown;
    };
    expect(
      document.weather,
      `content/levels/${id}.json declares weather ${JSON.stringify(document.weather)}, and its art ` +
        `sheet says ${String(statements[0])}. The sheet is where the season is decided.`,
    ).toBe(statements[0]);
  });
});
