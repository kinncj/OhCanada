/**
 * A locomotion tuning that JSON Schema validates can still be physically
 * incoherent, and this is the gate for the part the schema cannot reach.
 *
 * `level.schema.json` bounds each number on its own — `acceleration` is positive,
 * `glide` is 0–1 — but JSON Schema 2020-12 has no way to compare two sibling
 * values, so nothing there can say that one field must be smaller than another.
 * The defect this closes was a *comment* that got it backwards in two files at
 * once ("high for skate/canoe: turning around costs time"), which is exactly the
 * class of claim this project keeps finding: prose that nothing checks, repeated
 * until it looks agreed.
 *
 * The invariant, both halves of it read off TN-LEVEL-03:
 *
 *     deceleration < turnAcceleration < acceleration
 *
 *   - **Above `deceleration`** — "Holding the other way is the brake": the player
 *     "stops in a shorter distance than a free glide from the same speed". A free
 *     glide decelerates at `deceleration`; braking decelerates at
 *     `turnAcceleration`. Equal values make the brake do nothing.
 *   - **Below `acceleration`** — "Turning around costs time": "reaching cruise
 *     speed to the left takes longer than reaching cruise speed from standing
 *     still". Equal values make a turn free; a greater value makes a skate
 *     reverse faster than it starts, which is what a level must not be able to
 *     author.
 *
 * Two suites, and both are needed. The corpus suite reads every authored level
 * and is the one that matters in the end; the fixture suite proves the predicate
 * rejects each violation *today*, while `content/levels/` is still empty. A
 * corpus check over an empty directory asserts nothing, and this repository has
 * already deleted gates that measured nothing — so the predicate is exercised
 * against real violations rather than trusted because it exists.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

interface TuningLike {
  readonly mode?: unknown;
  readonly acceleration?: unknown;
  readonly deceleration?: unknown;
  readonly turnAcceleration?: unknown;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Every way one tuning record can be incoherent, as messages. Empty means fine.
 *
 * A field that is missing or not a number is *not* reported here: that is
 * `make validate-content`'s job against the schema, and duplicating it would
 * give one defect two owners.
 */
export const incoherences = (tuning: TuningLike, where: string): readonly string[] => {
  const { acceleration, deceleration, turnAcceleration } = tuning;
  if (!isNumber(acceleration) || !isNumber(deceleration) || !isNumber(turnAcceleration)) {
    return [];
  }

  const found: string[] = [];
  if (turnAcceleration <= deceleration) {
    found.push(
      `${where}: turnAcceleration (${String(turnAcceleration)}) must be greater than ` +
        `deceleration (${String(deceleration)}), or holding the other way brakes no harder than ` +
        `letting go and TN-LEVEL-03's "stops in a shorter distance than a free glide" is false.`,
    );
  }
  if (turnAcceleration >= acceleration) {
    found.push(
      `${where}: turnAcceleration (${String(turnAcceleration)}) must be less than acceleration ` +
        `(${String(acceleration)}), or turning around is free and TN-LEVEL-03's "reaching cruise ` +
        `speed to the left takes longer than reaching cruise speed from standing still" is false. ` +
        `A skate that reverses faster than it starts is the defect this check exists to stop.`,
    );
  }
  return found;
};

const levelFiles = existsSync(LEVELS_DIR)
  ? readdirSync(LEVELS_DIR)
      .filter((name) => name.endsWith('.json'))
      .sort()
  : [];

const tuningsIn = (file: string): readonly [string, TuningLike][] => {
  const document = JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, 'utf8')) as {
    readonly locomotion?: readonly TuningLike[];
  };
  return (document.locomotion ?? []).map(
    (tuning, index) =>
      [`${file} locomotion[${String(index)}] (${String(tuning.mode ?? 'unnamed')})`, tuning] as const,
  );
};

describe('locomotion tuning is physically coherent (TN-LEVEL-03)', () => {
  describe('the predicate rejects each violation', () => {
    // These fixtures are what make the suite above meaningful before any level
    // exists. Each one is schema-valid: every number is positive and in range,
    // so `make validate-content` passes all four and only this check separates
    // them.
    const base = { mode: 'skate', acceleration: 900, deceleration: 120, turnAcceleration: 400 };

    it('accepts a tuning inside the band', () => {
      expect(incoherences(base, 'fixture')).toEqual([]);
    });

    it('rejects a turn that is no harder than a free glide', () => {
      expect(incoherences({ ...base, turnAcceleration: 120 }, 'fixture')).toHaveLength(1);
      expect(incoherences({ ...base, turnAcceleration: 90 }, 'fixture')).toHaveLength(1);
    });

    it('rejects a turn that is free, or faster than starting from rest', () => {
      expect(incoherences({ ...base, turnAcceleration: 900 }, 'fixture')).toHaveLength(1);
      expect(incoherences({ ...base, turnAcceleration: 1400 }, 'fixture')).toHaveLength(1);
    });

    it('reports both halves when a tuning breaks both', () => {
      expect(
        incoherences({ ...base, deceleration: 900, acceleration: 120 }, 'fixture'),
      ).toHaveLength(2);
    });

    it('says nothing about a record the schema already rejects', () => {
      expect(incoherences({ mode: 'skate' }, 'fixture')).toEqual([]);
    });
  });

  it('holds for every locomotion tuning in every authored level', () => {
    // Derived, not listed: a level added in slice 2 is checked without editing
    // this file. `content/levels/` is empty until task 1.7, and this assertion is
    // deliberately silent then — the suite above is what carries the check until
    // there is a corpus, and this is where it starts biting.
    const failures = levelFiles.flatMap((file) =>
      tuningsIn(file).flatMap(([where, tuning]) => incoherences(tuning, where)),
    );
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
