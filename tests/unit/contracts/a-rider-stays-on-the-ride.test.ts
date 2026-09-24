/**
 * ADR-0031: a rider posed for a ride keeps their feet where the ride put them.
 *
 * A ride says where its rider's sole line rests — a train's floor, a horse's
 * stirrup — with one `riderAnchor`, and the engine draws the art there every
 * frame. It cannot say where the rig's feet go inside a pose. So a `<mode>/*`
 * state that moves an ankle between keys, or from one state to the next,
 * lifts a boot off the floor or out of the stirrup while the ride stays put:
 * the passenger's feet float, the rider's foot swings through the horse's
 * side. Every render of one key looks right; the defect is between keys, and
 * nothing else in the contract compares them.
 *
 * So for every mode any level rides, derived from the level documents so no
 * mode is named here, each ankle is ONE point across every key of every state
 * of that mode, and `foot-gear` carries its boot's transform in every one of
 * those keys (rig-contract.md section 11.2). The seat may move and the knees
 * re-solve to it — that is how a rider goes with a walking horse — but the
 * feet do not.
 *
 * The rig is flat (rig-contract.md section 5): a foot's `[dx, dy]` is where its
 * ankle ended up, so the ankle is the part's pivot plus that offset and no
 * kinematics are needed to read it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface RigPart {
  readonly name: string;
  readonly pivot: readonly number[];
}
interface RigKey {
  readonly t: number;
  readonly parts: Readonly<Record<string, readonly number[]>>;
}
interface RigDoc {
  readonly parts: readonly RigPart[];
  readonly states: Readonly<Record<string, { readonly keys: readonly RigKey[] }>>;
}
interface LevelDoc {
  readonly id: string;
  readonly rides?: readonly { readonly mode: string }[];
}

const rig = JSON.parse(readFileSync(`${REPO_ROOT}content/characters/rig.json`, 'utf8')) as RigDoc;

const levels: readonly LevelDoc[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')) as LevelDoc);

const riddenModes = [...new Set(levels.flatMap((level) => (level.rides ?? []).map((ride) => ride.mode)))].sort();

const SIDES = ['l', 'r'] as const;

/** Two decimals, which is what the rig is authored to; float addition must not split one point in two. */
const at = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

/**
 * Everything wrong with one mode's feet, as sentences, or `[]`.
 *
 * Exported shape kept local: the negative control below runs the same function
 * over a copy of the rig with one foot moved.
 */
function strayFeet(doc: RigDoc, mode: string): string[] {
  const faults: string[] = [];
  const pivots = new Map(doc.parts.map((part) => [part.name, part.pivot]));
  const states = Object.entries(doc.states).filter(([name]) => name.startsWith(`${mode}/`));
  if (states.length === 0) return [`the rig declares no "${mode}/" state, so a ride carries a figure it cannot pose`];

  for (const side of SIDES) {
    const foot = `foot-${side}`;
    const gear = `foot-gear-${side}`;
    const pivot = pivots.get(foot);
    if (pivot === undefined) {
      faults.push(`the rig has no part "${foot}"`);
      continue;
    }
    const ankles = new Map<string, string[]>();
    for (const [name, state] of states) {
      for (const key of state.keys) {
        const transform = key.parts[foot];
        if (transform === undefined) {
          faults.push(`${name} t ${String(key.t)} does not place "${foot}"`);
          continue;
        }
        const point = `(${at((pivot[0] ?? 0) + (transform[0] ?? 0))}, ${at((pivot[1] ?? 0) + (transform[1] ?? 0))})`;
        ankles.set(point, [...(ankles.get(point) ?? []), `${name} t ${String(key.t)}`]);
        const carried = key.parts[gear];
        if (carried === undefined || carried.some((value, index) => value !== transform[index])) {
          faults.push(
            `${name} t ${String(key.t)}: "${gear}" is ${JSON.stringify(carried)} and its boot "${foot}" is ` +
              `${JSON.stringify(transform)}. Equipment rides on its boot in every key (rig-contract.md section 11.2).`,
          );
        }
      }
    }
    if (ankles.size !== 1) {
      const where = [...ankles.entries()].map(([point, keys]) => `${point} in ${keys.join(', ')}`).join('; ');
      faults.push(
        `the "${mode}" ride's rider puts the ${side === 'r' ? 'near' : 'far'} ankle at ${String(ankles.size)} ` +
          `points: ${where}. The ride draws its floor or stirrup at one anchor, so a foot that moves between keys ` +
          'leaves it.',
      );
    }
  }
  return faults;
}

describe('a rider posed for a ride keeps both feet where the ride puts them (ADR-0031)', () => {
  it('has a ridden mode to check, so this is not a pass over nothing (ADR-0024)', () => {
    expect(riddenModes.length).toBeGreaterThan(0);
  });

  for (const mode of riddenModes) {
    it(`${mode}: each ankle is one point across every key of every "${mode}/" state, with its gear on it`, () => {
      const faults = strayFeet(rig, mode);
      expect(faults, faults.join('\n')).toEqual([]);
    });
  }

  it('fails a rig in which one key lifts one foot (the negative control)', () => {
    const [mode] = riddenModes;
    expect(mode, 'no ridden mode to build the control from').toBeDefined();
    if (mode === undefined) return;

    const copy = JSON.parse(JSON.stringify(rig)) as {
      states: Record<string, { keys: { t: number; parts: Record<string, number[]> }[] }>;
      parts: RigPart[];
    };
    const [name] = Object.keys(copy.states).filter((state) => state.startsWith(`${mode}/`));
    const key = name === undefined ? undefined : copy.states[name]?.keys[0];
    const foot = key?.parts['foot-r'];
    expect(foot, `the rig's first "${mode}/" state has no near foot to move`).toBeDefined();
    if (key === undefined || foot === undefined) return;

    const lifted = [foot[0] ?? 0, (foot[1] ?? 0) - 12, foot[2] ?? 0];
    key.parts['foot-r'] = lifted;
    key.parts['foot-gear-r'] = [...lifted];
    expect(strayFeet(copy, mode).join('\n')).toContain('near ankle');

    key.parts['foot-gear-r'] = [...foot];
    expect(strayFeet(copy, mode).join('\n')).toContain('Equipment rides on its boot');
  });
});
