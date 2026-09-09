import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * A character document names the rig's slots, and nothing checked that it did.
 *
 * `characterSlot.name` used to `$ref` the shared kebab-case id, while the rig
 * names its slots `hairShape`, `hairColour` and `headCovering` and interpolates
 * them into part templates by exactly those keys. So the schema's pattern and
 * its own description ("identical in the atlas frame prefixes") contradicted
 * each other, and the first two character documents ever written satisfied the
 * pattern while naming three slots the rig does not have. They validated. They
 * were wrong.
 *
 * The schema now accepts the rig's key form, which makes the wrong documents
 * unwritable in the shape they were written -- but a pattern cannot say WHICH
 * keys the rig has, and a document naming `hairStyle` would still pass. That is
 * a cross-document fact, so it lives here.
 */
const ROOT = join(import.meta.dirname, '../../..');
const read = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

interface Rig {
  readonly slots: Record<string, { readonly status?: string }>;
}
interface Character {
  readonly id: string;
  readonly slots?: readonly { readonly name: string }[];
}

describe('a character document names the slots the rig actually has', () => {
  const rig = read('content/characters/rig.json') as Rig;
  const rigSlots = new Set(Object.keys(rig.slots));

  const files = readdirSync(join(ROOT, 'content/characters')).filter(
    (f) => f.endsWith('.json') && f !== 'rig.json',
  );

  it('has character documents to check, so this cannot pass over an empty directory', () => {
    expect(files.length, 'no character documents exist, so nothing was checked').toBeGreaterThan(0);
    expect(rigSlots.size, 'the rig declares no slots, so any name would pass').toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} names only slots the rig declares`, () => {
      const character = read(`content/characters/${file}`) as Character;
      const named = (character.slots ?? []).map((s) => s.name);
      expect(named.length, `${file} declares no slots`).toBeGreaterThan(0);
      const unknown = named.filter((n) => !rigSlots.has(n));
      expect(
        unknown,
        `${file} names ${unknown.join(', ')}, which content/characters/rig.json does not ` +
          `declare. The rig's slots are ${[...rigSlots].join(', ')}. A part template ` +
          'interpolates a slot by its key, so a name the rig does not have resolves to nothing ' +
          'and the character draws without that part.',
      ).toEqual([]);
    });
  }
});
