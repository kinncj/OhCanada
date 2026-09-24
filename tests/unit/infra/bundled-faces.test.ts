/**
 * ADR-0071: the bundled faces weigh at most 300 KB, and ship as upstream made them.
 *
 * Every rule ADR-0071 states about the files is checkable from the files, so it
 * is checked here and not left to review:
 *
 *  - **Unmodified.** Each `woff2` hashes to the sha256 of the upstream file at the
 *    commit its credit names. Subsetting, re-hinting or re-compressing changes
 *    the bytes, and OFL-1.1 §3 would then take the name "OpenDyslexic" away.
 *  - **The ceiling.** 300 000 B for all of them together.
 *  - **The licence travels with the font.** `OFL.txt` sits beside each family,
 *    unmodified, and OpenDyslexic's still declares its Reserved Font Name.
 *  - **Credited as shipped, under OFL-1.1**, with a source pinned to the commit
 *    the digest was taken from.
 *  - **Nothing else.** The fonts directory holds exactly these files, so a fifth
 *    face cannot arrive without this list, and ADR-0071's table, being changed.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const FONTS = join(REPO, 'assets', 'src', 'fonts');

/** ADR-0071's table: upstream digests, taken 2026-09-23 and re-checked against upstream. */
const FACES = [
  {
    path: 'atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
    bytes: 23_196,
    sha256: '2df4ba17804bc7a36f123127966075d8427bff2df58d0d76820c1130bb1a4150',
    upstream: 'googlefonts/atkinson-hyperlegible/blob/1cb311624b2ddf88e9e37873999d165a8cd28b46/',
  },
  {
    path: 'atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
    bytes: 23_776,
    sha256: 'da8fce41a04f8498fbf79076f92d304b12e70c76f71b143c5dcfb6536c93c075',
    upstream: 'googlefonts/atkinson-hyperlegible/blob/1cb311624b2ddf88e9e37873999d165a8cd28b46/',
  },
  {
    path: 'opendyslexic/OpenDyslexic-Regular.woff2',
    bytes: 103_336,
    sha256: '0441bc21071e42db57c217f93fbc48d3b55a2987c02814c94dc93621c42e8695',
    upstream: 'antijingoist/opendyslexic/blob/1824da5c0e41dc3e13ffc7f3a636dcaf695d61b7/',
  },
  {
    path: 'opendyslexic/OpenDyslexic-Bold.woff2',
    bytes: 108_068,
    sha256: 'b534a0b84ef3cca941ebdb506ce3f4e0010aa4ef881271bac8b6959dbf694fbf',
    upstream: 'antijingoist/opendyslexic/blob/1824da5c0e41dc3e13ffc7f3a636dcaf695d61b7/',
  },
] as const;

/** The two licence texts, byte-identical to upstream's `OFL.txt` at the same commits. */
const LICENCES = [
  {
    path: 'atkinson-hyperlegible/OFL.txt',
    sha256: 'f32d22b3908fcad2c86a74000614ec22e6a7f66ea7e867e616026a27aebdc143',
  },
  {
    path: 'opendyslexic/OFL.txt',
    sha256: 'caafcccfb70fc72458fcbda812ec8f0a06cb300cbabb87eabbb30b946124394b',
  },
] as const;

/** ADR-0071 §1: 300 KB, read as 1 000-byte kilobytes, the stricter reading. */
const CEILING_BYTES = 300_000;

const sha256 = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name)).map((name) => `${entry.name}/${name}`)
      : [entry.name],
  );

interface Credit {
  readonly path: string;
  readonly kind: string;
  readonly licence: string;
  readonly source: string;
}

const credits = (
  JSON.parse(readFileSync(join(REPO, 'assets', 'credits.json'), 'utf8')) as {
    readonly assets: readonly Credit[];
  }
).assets;

describe('the bundled faces (ADR-0071)', () => {
  it('are exactly the four faces and their two licence texts, and nothing else', () => {
    expect(listFiles(FONTS).sort()).toEqual(
      [...FACES.map((face) => face.path), ...LICENCES.map((licence) => licence.path)].sort(),
    );
  });

  for (const face of FACES) {
    it(`ships ${face.path} byte-for-byte as upstream made it`, () => {
      const file = join(FONTS, face.path);
      expect(statSync(file).size).toBe(face.bytes);
      expect(sha256(file), 'the file differs from upstream: it was modified, which ADR-0071 forbids').toBe(
        face.sha256,
      );
      /* A woff2 signature, so a renamed ttf cannot pass on size alone. */
      expect(readFileSync(file).subarray(0, 4).toString('latin1')).toBe('wOF2');
    });
  }

  it(`weighs ${String(FACES.reduce((sum, face) => sum + face.bytes, 0))} B together, under the 300 KB ceiling`, () => {
    const total = FACES.reduce((sum, face) => sum + statSync(join(FONTS, face.path)).size, 0);
    expect(total).toBe(258_376);
    expect(total).toBeLessThanOrEqual(CEILING_BYTES);
  });

  for (const licence of LICENCES) {
    it(`keeps ${licence.path} beside its font, unmodified`, () => {
      expect(sha256(join(FONTS, licence.path))).toBe(licence.sha256);
      expect(readFileSync(join(FONTS, licence.path), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    });
  }

  it("keeps OpenDyslexic's Reserved Font Name on record, which is why nothing may be modified", () => {
    expect(readFileSync(join(FONTS, 'opendyslexic/OFL.txt'), 'utf8')).toContain(
      'with Reserved Font Name OpenDyslexic.',
    );
    /* Atkinson reserves none; ADR-0071 records that too, and a new release that
       added one would need that record changed. */
    expect(readFileSync(join(FONTS, 'atkinson-hyperlegible/OFL.txt'), 'utf8')).not.toMatch(
      /with Reserved Font Name/,
    );
  });

  for (const face of FACES) {
    it(`credits ${face.path} as shipped, under OFL-1.1, from the commit its digest was taken at`, () => {
      const credit = credits.find((entry) => entry.path === `src/fonts/${face.path}`);
      expect(credit, 'the face is not in assets/credits.json').toBeDefined();
      expect(credit?.kind).toBe('shipped');
      expect(credit?.licence).toBe('OFL-1.1');
      expect(credit?.source).toContain(face.upstream);
    });
  }
});
