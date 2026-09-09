/**
 * `SeededRandomSource` — the concrete behind the randomness port.
 *
 * An adapter rather than a domain module because a `RandomSource` is a piece of
 * *machinery* the domain is given, exactly like a `Clock`: `domain-is-pure`
 * forbids the scheduler from reaching for one, and the whole reason the port
 * exists is that `Math.random()` cannot be replayed. It is pure TypeScript with
 * no host dependency, which is why it is measured by the unit suite rather than
 * argued about in a browser.
 *
 * ## Why sfc32 and not `Math.random`
 *
 * `Math.random()` cannot be seeded, so a bad exam draw or a drill a player
 * reports as repetitive is unreproducible — which is the one thing ADR-0008's
 * marker on this port asked for. sfc32 is 32 bits of state times four, passes
 * PractRand, is nine lines, and needs no dependency. It is **not** a
 * cryptographic generator and nothing here should ever be used as one: question
 * order is not a secret.
 *
 * ## `fork`
 *
 * Two consumers pulling from one stream desync each other — the scheduler draws
 * one number per pool entry, so a distractor shuffle interleaved with it would
 * change which questions come up. `fork(label)` derives an independent stream
 * from this one's seed and the label, deterministically: the same seed and the
 * same label give the same stream on every machine and in every replay, and two
 * different labels give unrelated ones.
 */

import type { SeededRandomSource } from '@application/ports';

/** FNV-1a over the label, so `fork('exam')` is the same stream everywhere. */
const hashLabel = (label: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** sfc32, with the seed spread over the four words by a splitmix-style step. */
const sfc32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  let b = (seed ^ 0x9e3779b9) >>> 0;
  let c = (seed ^ 0x85ebca6b) >>> 0;
  let d = (seed ^ 0xc2b2ae35) >>> 0;
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return (t >>> 0) / 4_294_967_296;
  };
};

/**
 * A reproducible `RandomSource`.
 *
 * `shuffle` is Fisher-Yates on a copy: `TN-CARD` shuffles the four options and
 * an in-place shuffle would reorder the content document itself, which is shared
 * across every drill that draws the same question.
 */
export const createSeededRandom = (seed: number): SeededRandomSource => {
  const nextFloat = sfc32(Math.trunc(seed) >>> 0);

  const source: SeededRandomSource = {
    seed,
    next: nextFloat,
    int(minInclusive: number, maxExclusive: number): number {
      if (!(maxExclusive > minInclusive)) return minInclusive;
      return minInclusive + Math.floor(nextFloat() * (maxExclusive - minInclusive));
    },
    pick<T>(items: readonly T[]): T | undefined {
      if (items.length === 0) return undefined;
      return items[Math.floor(nextFloat() * items.length)];
    },
    shuffle<T>(items: readonly T[]): readonly T[] {
      const copy = items.slice();
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(nextFloat() * (index + 1));
        const held = copy[index] as T;
        copy[index] = copy[swap] as T;
        copy[swap] = held;
      }
      return copy;
    },
    fork(label: string): SeededRandomSource {
      return createSeededRandom((seed ^ hashLabel(label)) >>> 0);
    },
  };
  return source;
};
