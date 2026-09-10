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
 * ## Seeding, and the defect that made this section necessary
 *
 * sfc32 is specified as *load the state, then discard some rounds*. The first
 * version of this file did neither part properly: it filled the four words by
 * xoring three constants over one seed and then handed the first output
 * straight out. Both halves of that were wrong in the same direction.
 *
 *  - **Correlated words.** With `a = seed`, `b = seed ^ k1`, `d = seed ^ k3`,
 *    the very first output is `(a + b + d)`, which for any small seed is about
 *    `3 * seed` plus a fixed constant. The seed moved the low bits and left the
 *    high bits alone.
 *  - **No warm-up.** Nothing was run between loading the state and reading it,
 *    so those high bits reached the caller untouched.
 *
 * The measured consequence: **the first shuffle of a three-element array was
 * `['c','a','b']` for every seed from 1 to 40** — `shuffle` reads
 * `floor(next() * 3)`, which is exactly the high bits the seed never reached.
 * The stream decorrelated a few draws later, so "different seeds give different
 * sequences" passed the whole time. Exam mode noticed because `TN-EXAM-02` needs
 * each of three subjects to be able to be the one contributing six, and that
 * decision is one small shuffle taken early; `drawExam` carried an ordering
 * workaround to keep the stream warm until this was fixed here.
 *
 * The fix is both halves:
 *
 *  1. **splitmix32 fills the four words**, so a one-bit change in the seed
 *     changes all four rather than the low bits of three of them. This alone is
 *     enough to make the first shuffle vary — measured: all six orderings appear
 *     over seeds 1 to 40 with zero warm-up rounds.
 *  2. **{@link WARM_UP_ROUNDS} discarded outputs**, the count the reference sfc
 *     implementation uses after seeding, kept because it is what the algorithm
 *     specifies rather than because the measurement demanded it. It is belt to
 *     splitmix32's braces: with the *old* correlated seeding, warm-up alone
 *     needed four rounds before all six orderings appeared and was still
 *     showing only five of six at twelve — evidence that a warm-up count tuned
 *     against a measurement is the wrong thing to lean on, and that the seeding
 *     is where the correlation had to die.
 *
 * Twelve rounds is roughly 60 ns per stream and streams are created per session
 * and per `fork`, not per draw.
 *
 * **This changes what every existing seed produces.** A save that recorded seed
 * `n` draws a different twenty questions than it did before this commit. That is
 * accepted rather than migrated: the seed is a replay handle, no released build
 * has an exam mid-flight, and the alternative is shipping a generator whose
 * first shuffle is a constant.
 *
 * ## `fork`
 *
 * Two consumers pulling from one stream desync each other — the scheduler draws
 * one number per pool entry, so a distractor shuffle interleaved with it would
 * change which questions come up. `fork(label)` derives an independent stream
 * from this one's seed and the label, deterministically: the same seed and the
 * same label give the same stream on every machine and in every replay, and two
 * different labels give unrelated ones.
 *
 * `fork` had the same cold-start exposure as its parent, measured the same way —
 * every seed from 1 to 40 forked with `'exam'` produced the first shuffle
 * `['c','b','a']` — because xoring a fixed label hash over a small seed is just
 * another small seed. It needs no warm-up of its own: it routes through
 * {@link createSeededRandom}, so the generator's seeding and warm-up are the
 * fork's too. What it did need was a derivation that is not plain xor, because
 * xor is its own inverse and commutative: `fork('a').fork('a')` handed back the
 * parent's exact stream, and `fork('a').fork('b')` was the same stream as
 * `fork('b').fork('a')`. Folding the parent seed into the FNV-1a basis and
 * avalanching the result is order-dependent and not self-inverse.
 */

import type { SeededRandomSource } from '@application/ports';

/**
 * Rounds discarded after the state is loaded.
 *
 * Twelve is the count in the reference sfc32 (`sfc32::seed`), not a number tuned
 * until a test went green — see this file's header for why that distinction is
 * the whole point.
 */
const WARM_UP_ROUNDS = 12;

/** splitmix32's odd increment: the 32-bit fractional part of the golden ratio. */
const GOLDEN_GAMMA = 0x9e3779b9;

/**
 * One splitmix32 finalizer: an avalanche, so a single input bit flips about half
 * the output bits. Used to spread the seed over the four words and to fold a
 * fork label into a parent seed.
 */
const avalanche = (value: number): number => {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97) >>> 0;
  return (mixed ^ (mixed >>> 15)) >>> 0;
};

/**
 * FNV-1a over the label, with the parent seed as the basis, so `fork('exam')` is
 * the same stream everywhere and a different one under every parent.
 */
const forkSeed = (seed: number, label: string): number => {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return avalanche(hash);
};

/** sfc32, seeded through splitmix32 and warmed up. */
const sfc32 = (seed: number): (() => number) => {
  let spread = seed >>> 0;
  const word = (): number => {
    spread = (spread + GOLDEN_GAMMA) >>> 0;
    return avalanche(spread);
  };

  let a = word();
  let b = word();
  let c = word();
  let d = word();

  const nextFloat = (): number => {
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

  for (let round = 0; round < WARM_UP_ROUNDS; round += 1) nextFloat();

  return nextFloat;
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
      return createSeededRandom(forkSeed(Math.trunc(seed) >>> 0, label));
    },
  };
  return source;
};
