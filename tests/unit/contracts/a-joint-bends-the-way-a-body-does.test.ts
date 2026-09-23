/**
 * A joint bends the way a body does, in every key of every state.
 *
 * ## The defect this exists for
 *
 * The product owner watched the live game and said the character "looks odd —
 * the chest and arm moves, and the elbows look inverted". Both halves were real,
 * and NOTHING in this repository could have caught either: the blind art
 * hand-off judges STILL renders and the live audits judge SCREENSHOTS, so a
 * walk cycle had never been looked at frame by frame. A pose that is wrong only
 * while it moves is invisible to every gate that looks at one frame.
 *
 *   1. Every elbow in every on-foot state bent BACKWARDS — 93 keys of it. The
 *      forearm was authored as the upper arm's angle plus a positive offset, and
 *      positive is backwards in this space, so the arm hyperextended through the
 *      whole cycle. `skate` was worse: its forearm was a fixed FRACTION of the
 *      upper arm's absolute angle, so the bend flipped sign whenever the arm
 *      swung through vertical, and the elbow inverted twice per stride.
 *   2. The torso turns about the HIP, so the shoulders and the head sit on
 *      pivots that MOVE — and in `walk`, `run`, `jump-*`, `land` and `interact`
 *      they carried dx 0 and did not move at all. The chest slid out from under
 *      the arms and the head by 6.2 px walking and 14.6 px running, and because
 *      `idle` has no torso rotation the seam OPENED the instant the player
 *      started moving. That is the "chest and arm" half, exactly.
 *
 * ## Why these are facts and not taste
 *
 * The rig already disagreed with itself, which is what makes this checkable
 * rather than a matter of opinion. `idle` bends both elbows FORWARD ("the elbows
 * are soft", its own note), and every mounted pose that solves a fist onto a
 * handlebar or a rein — `bike/*`, `skateboard/*`, `train/*`, `horse/*` — bends
 * them forward too and carries the torso correctly. The on-foot states were the
 * odd ones out. So this file does not impose an anatomy on the rig; it holds the
 * rig to the one its own best-authored poses already use.
 *
 * ## The convention, and where it comes from
 *
 * Character space is y-DOWN and the canonical facing is RIGHT, so +x is FORWARD
 * (`rig-contract.md` §1). A positive rotation is CLOCKWISE on screen, so a limb
 * hanging down swings its distal end BACKWARD for a positive angle. That is not
 * assumed here: `scripts/lib/art-handoff.mjs#poseOnePart` derives the same
 * convention from the rig's own numbers, and the chain check below reproduces
 * every shipped `[dx, dy]` to the hundredth, which is the proof that the
 * convention is the one the document was authored in.
 *
 * Rotations are ABSOLUTE, and a few keys are authored past a full turn, so every
 * comparison goes through {@link wrap} — a raw subtraction reads 304° where the
 * joint is really bent 56° the other way.
 *
 * ## What is deliberately NOT checked
 *
 * Only the HORIZONTAL half of the torso carry. `dy` legitimately carries
 * authored extras — `land`'s head dip, `talk`'s nod — so a strict `dy` check
 * would fail on real animation, while `dx` has no such licence. The thighs and
 * the beaver's tail are left alone too: the torso's pivot IS the hip, so a leg
 * root barely moves, and the tail carries its own swish.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
/** The same single path `rig-is-coherent.test.ts` reads. */
const RIG_FILE = 'content/characters/rig.json';

interface RigPart {
  readonly name: string;
  readonly pivot: readonly number[];
}
interface RigKeyframe {
  readonly t: number;
  readonly parts: Readonly<Record<string, readonly number[]>>;
}
interface Rig {
  readonly parts: readonly RigPart[];
  readonly states: Readonly<Record<string, { readonly keys: readonly RigKeyframe[] }>>;
}

const rig = JSON.parse(readFileSync(`${REPO_ROOT}${RIG_FILE}`, 'utf8')) as Rig;

/** Within half a pixel, or half a degree. The keys are authored to 2 d.p. */
const TOL = 0.5;
const RAD = Math.PI / 180;

/** The shortest signed angle congruent to `d`, in (-180, 180]. */
export const wrap = (d: number): number => {
  const m = ((d % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
};

const spin = (x: number, y: number, deg: number): readonly [number, number] => [
  x * Math.cos(deg * RAD) - y * Math.sin(deg * RAD),
  x * Math.sin(deg * RAD) + y * Math.cos(deg * RAD),
];

const HEAD_GROUP = ['head', 'hair', 'head-shell', 'face', 'head-covering', 'hat', 'feature'] as const;
const RIDERS = ['arm-upper-l', 'arm-upper-r', ...HEAD_GROUP] as const;

/** proximal, distal, tip, and the sign the joint between them must bend. */
const CHAINS: readonly (readonly [string, string, string, number])[] = [
  ['arm-upper-l', 'arm-lower-l', 'hand-l', -1],
  ['arm-upper-r', 'arm-lower-r', 'hand-r', -1],
  ['leg-upper-l', 'leg-lower-l', 'foot-l', +1],
  ['leg-upper-r', 'leg-lower-r', 'foot-r', +1],
];

interface Report {
  readonly bend: readonly string[];
  readonly chain: readonly string[];
  readonly ride: readonly string[];
  readonly group: readonly string[];
  readonly neck: readonly string[];
  /** How many keys were actually examined — the anti-vacuum floor (ADR-0014). */
  readonly keysSeen: number;
}

/**
 * Every fault in one rig document.
 *
 * A function over a passed-in rig rather than over the module-level one, so the
 * negative control can feed it a deliberately broken copy. A checker that has
 * never been seen to fail is not a gate (`docs/plan/slices.md`, Rules).
 */
export function faultsIn(document: Rig): Report {
  const pivots = new Map(document.parts.map((part) => [part.name, part.pivot]));
  const px = (name: string, axis: number): number => pivots.get(name)?.[axis] ?? 0;

  const bend: string[] = [];
  const chain: string[] = [];
  const ride: string[] = [];
  const group: string[] = [];
  const neck: string[] = [];
  let keysSeen = 0;

  for (const [stateName, state] of Object.entries(document.states)) {
    for (const key of state.keys) {
      keysSeen += 1;
      const at = (name: string): readonly number[] => key.parts[name] ?? [0, 0, 0];
      const has = (name: string): boolean => key.parts[name] !== undefined;
      const v = (name: string, i: number): number => at(name)[i] ?? 0;
      const where = `${stateName} t ${String(key.t)}`;

      for (const [up, lo, tip, want] of CHAINS) {
        if (!has(up)) continue;
        const upperAngle = v(up, 2);
        const lowerAngle = v(lo, 2);
        const rel = wrap(lowerAngle - upperAngle);
        if (rel !== 0 && Math.sign(rel) !== want) {
          bend.push(
            `${where}: "${lo}" bends ${rel.toFixed(1)}° relative to "${up}". A knee flexes ` +
              `BACKWARD and an elbow flexes FORWARD; this one goes the other way, which is the ` +
              `joint bending inside out. The rig's own idle, and every pose that puts a fist on a ` +
              `handlebar or a rein, bend it the anatomical way.`,
          );
        }

        const upperLength = px(lo, 1) - px(up, 1);
        const [ex, ey] = spin(0, upperLength, upperAngle);
        const elbowX = v(up, 0) + ex;
        const elbowY = v(up, 1) + ey - upperLength;
        if (Math.abs(elbowX - v(lo, 0)) > TOL || Math.abs(elbowY - v(lo, 1)) > TOL) {
          chain.push(
            `${where}: "${lo}" sits at [${String(v(lo, 0))}, ${String(v(lo, 1))}] but "${up}" ` +
              `turned ${String(upperAngle)}° puts that joint at [${elbowX.toFixed(2)}, ` +
              `${elbowY.toFixed(2)}]. The rig is FLAT — no backend parents one part to another — ` +
              `so a [dx, dy] that is not the solved chain comes apart at the joint.`,
          );
        }

        const lowerLength = px(tip, 1) - px(lo, 1);
        const [tx, ty] = spin(0, lowerLength, lowerAngle);
        const tipX = elbowX + tx;
        const tipY = elbowY + ty - lowerLength;
        if (Math.abs(tipX - v(tip, 0)) > TOL || Math.abs(tipY - v(tip, 1)) > TOL) {
          chain.push(
            `${where}: "${tip}" sits at [${String(v(tip, 0))}, ${String(v(tip, 1))}] but the chain ` +
              `puts it at [${tipX.toFixed(2)}, ${tipY.toFixed(2)}].`,
          );
        }
      }

      const torsoAngle = v('torso', 2);
      for (const part of RIDERS) {
        if (!has(part)) continue;
        const offsetX = px(part, 0) - px('torso', 0);
        const offsetY = px(part, 1) - px('torso', 1);
        const carried = v('torso', 0) + spin(offsetX, offsetY, torsoAngle)[0] - offsetX;
        if (Math.abs(carried - v(part, 0)) > TOL) {
          ride.push(
            `${where}: "${part}" has dx ${String(v(part, 0))}, but a torso turned ` +
              `${String(torsoAngle)}° about the hip carries its pivot to dx ${carried.toFixed(2)} ` +
              `(out by ${Math.abs(carried - v(part, 0)).toFixed(2)} px). The shoulders and the ` +
              `head sit ON the chest, so when the chest turns they move with it — otherwise the ` +
              `torso slides out from under the arms as soon as the character starts moving.`,
          );
        }
      }

      const head = JSON.stringify(at('head'));
      for (const part of HEAD_GROUP) {
        if (!has(part)) continue;
        if (JSON.stringify(at(part)) !== head) {
          group.push(
            `${where}: "${part}" is ${JSON.stringify(at(part))} and "head" is ${head}. They share ` +
              `one pivot, so a difference pulls the face off the skull.`,
          );
        }
      }

      if (has('neck')) {
        for (let i = 0; i < 3; i += 1) {
          const average = (v('torso', i) + v('head', i)) / 2;
          if (Math.abs(average - v('neck', i)) > TOL) {
            neck.push(
              `${where}: neck[${String(i)}] is ${String(v('neck', i))}, and the chest/head average ` +
                `is ${average.toFixed(2)}. The neck bridges the two (rig-contract.md §4).`,
            );
          }
        }
      }
    }
  }

  return { bend, chain, ride, group, neck, keysSeen };
}

const shipped = faultsIn(rig);

describe('a joint bends the way a body does', () => {
  it('looked at every key of every state, so a pass is not an empty loop', () => {
    // ADR-0014's anti-vacuum floor. The shipped rig has 33 states and 117 keys;
    // a floor well under that leaves honest authoring room and still fails a
    // document that lost its states.
    expect(
      shipped.keysSeen,
      'too few keyframes were examined for this file to be checking anything',
    ).toBeGreaterThanOrEqual(40);
  });

  it('never bends an elbow backwards or a knee forwards', () => {
    expect(shipped.bend, shipped.bend.join('\n')).toEqual([]);
  });

  it('ships every limb chain already solved, because the rig parents nothing', () => {
    expect(shipped.chain, shipped.chain.join('\n')).toEqual([]);
  });

  it('carries the shoulders and the head with the chest when the chest turns', () => {
    expect(shipped.ride, shipped.ride.join('\n')).toEqual([]);
  });

  it('keeps the head parts on one transform, since they share one pivot', () => {
    expect(shipped.group, shipped.group.join('\n')).toEqual([]);
  });

  it('keeps the neck between the chest and the head', () => {
    expect(shipped.neck, shipped.neck.join('\n')).toEqual([]);
  });
});

describe('the negative controls (a gate nobody has seen fail is not a gate)', () => {
  /** The shipped rig with one part's tuple replaced, in one key of one state. */
  const withPart = (state: string, part: string, tuple: readonly number[]): Rig => {
    const copy = JSON.parse(JSON.stringify(rig)) as Rig;
    const keys = copy.states[state]?.keys;
    const first = keys?.[0];
    if (first === undefined) throw new Error(`no state "${state}"`);
    (first.parts as Record<string, readonly number[]>)[part] = tuple;
    return copy;
  };

  it('catches an elbow turned inside out', () => {
    // walk's first key: the shoulder is at -11 and the forearm at -26. Putting
    // the forearm BEHIND the upper arm is precisely the shipped defect, and it
    // must be caught as a bend fault and not merely as a broken chain.
    const broken = faultsIn(withPart('walk', 'arm-lower-l', [12.98, -1.25, 4]));
    expect(broken.bend.length, 'an inverted elbow was not reported').toBeGreaterThan(0);
    expect(broken.bend.join('\n')).toContain('arm-lower-l');
  });

  it('catches a knee turned inside out', () => {
    const shin = rig.states['walk']?.keys[0]?.parts['leg-lower-l'] ?? [0, 0, 0];
    const thigh = rig.states['walk']?.keys[0]?.parts['leg-upper-l'] ?? [0, 0, 0];
    const flipped = (thigh[2] ?? 0) - Math.abs((shin[2] ?? 0) - (thigh[2] ?? 0)) - 20;
    const broken = faultsIn(withPart('walk', 'leg-lower-l', [shin[0] ?? 0, shin[1] ?? 0, flipped]));
    expect(broken.bend.length, 'an inverted knee was not reported').toBeGreaterThan(0);
  });

  it('catches a shoulder that does not ride a turned chest', () => {
    // dx 0 under a rotated torso: the exact shape of the shipped defect.
    const broken = faultsIn(withPart('walk', 'arm-upper-l', [0, 0, -11]));
    expect(broken.ride.length, 'a detached shoulder was not reported').toBeGreaterThan(0);
    expect(broken.ride.join('\n')).toContain('arm-upper-l');
  });

  it('catches a limb chain that has come apart at the joint', () => {
    const broken = faultsIn(withPart('walk', 'hand-l', [999, 999, 4]));
    expect(broken.chain.length, 'a detached hand was not reported').toBeGreaterThan(0);
  });

  it('catches a face that has slid off its skull', () => {
    const broken = faultsIn(withPart('walk', 'face', [40, 0, -1.5]));
    expect(broken.group.length, 'a displaced face part was not reported').toBeGreaterThan(0);
  });
});
