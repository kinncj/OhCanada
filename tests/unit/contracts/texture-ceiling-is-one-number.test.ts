/**
 * ADR-0013 §4: the decoded-texture ceiling is written in four files and they say
 * the same thing.
 *
 * `67108864` lives in `CLAUDE.md` (as the prose "64 MB"), in
 * `content/schemas/level.schema.json` (as the `maximum` on `textureBudgetBytes`),
 * in `app/adapters/phaser/level-document.ts` (as `MAX_DECODED_TEXTURE_BYTES`, the
 * runtime refusal) and in `scripts/lib/texture-memory.mjs` (as
 * `MAX_DECODED_TEXTURE_BYTES`, the CI gate). It cannot be one file: a JSON Schema
 * cannot import, and a build script may not import from `app/`. Infra kept the
 * four identical and made each one name the other three, which is the most that
 * can be done from inside a build script — and a cross-reference is a claim, which
 * is the class of thing this project keeps finding has quietly stopped being true.
 *
 * So the duplication is deliberate and this file is what makes it unfalsifiable.
 * A rule nobody can violate silently beats a rule written down four times.
 *
 * Each source is read AS THE THING IT IS, not as text, because a textual check
 * across four file formats would pass on a comment:
 *
 *   - the schema is `JSON.parse`d and the `maximum` keyword is read out of it;
 *   - the adapter constant is a real `import`, so a rename or a deletion is a
 *     compile error here rather than a silent skip;
 *   - the `.mjs` is loaded by a spawned `node --input-type=module`, which is how
 *     `tests/unit/infra/texture-memory-gate.test.ts` already interrogates that
 *     module: it is a build script, and what matters is what Node makes of it,
 *     not what a bundler makes of it here;
 *   - only `CLAUDE.md` is read as text, because it is prose and there is nothing
 *     else to read it as.
 *
 * The MB/MiB reading is pinned on purpose. `CLAUDE.md` says "64 MB" and all three
 * implementations mean 64 MiB — a 6.9 % difference, and the direction that matters
 * because the looser reading (`64_000_000`) is the one somebody reaching for a
 * round number would write. The assertion states `64 * 1024 * 1024` outright so
 * that reading is a checked fact rather than an inherited habit.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAX_DECODED_TEXTURE_BYTES } from '@adapters/phaser/level-document';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The ceiling, stated once here in the form a human would argue about, so the
 * test is not simply four copies compared to each other. If every source moves
 * together to a wrong number, this line is what still fails.
 */
const MIB = 1024 * 1024;
const CEILING_BYTES = 64 * MIB;

/* ------------------------------------------------------------------ sources */

/** CLAUDE.md, Budgets. Prose: the only source with no machine-readable form. */
const claudeMdCeilingMb = (): number => {
  const text = readFileSync(`${REPO_ROOT}CLAUDE.md`, 'utf8');
  const match = /decoded texture memory\s*[≤<]=?\s*(\d+)\s*(MiB|MB)\b/iu.exec(text);
  expect(
    match,
    'CLAUDE.md no longer states a decoded-texture budget in the form ' +
      '"Decoded texture memory ≤ N MB". It is the source the other three cite; if it ' +
      'has been reworded, this test must be taught the new wording deliberately, not ' +
      'left matching nothing.',
  ).not.toBeNull();
  return Number(match?.[1]);
};

/** content/schemas/level.schema.json — the authoring gate. */
const schemaMaximum = (): unknown => {
  const schema = JSON.parse(
    readFileSync(`${REPO_ROOT}content/schemas/level.schema.json`, 'utf8'),
  ) as { properties?: Record<string, { maximum?: unknown; minimum?: unknown }> };
  const property = schema.properties?.textureBudgetBytes;
  expect(
    property,
    'level.schema.json declares no `textureBudgetBytes` property, so nothing caps ' +
      'what a level document may ask for at authoring time.',
  ).toBeDefined();
  return property?.maximum;
};

/** scripts/lib/texture-memory.mjs — the CI gate, asked in its own runtime. */
const buildScriptConstant = (): number => {
  const module = new URL('../../../scripts/lib/texture-memory.mjs', import.meta.url).href;
  const code =
    `import { MAX_DECODED_TEXTURE_BYTES } from ${JSON.stringify(module)};` +
    `process.stdout.write(JSON.stringify(MAX_DECODED_TEXTURE_BYTES ?? null));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  expect(
    result.stderr,
    'scripts/lib/texture-memory.mjs could not be loaded, or no longer exports ' +
      '`MAX_DECODED_TEXTURE_BYTES`. The CI gate is the only one of the four that ' +
      'measures real files, so a rename here is the copy that matters most.',
  ).toBe('');
  return JSON.parse(result.stdout || 'null') as number;
};

/* -------------------------------------------------------------------- gate */

describe('the decoded-texture ceiling is one number in four files (ADR-0013)', () => {
  it('is 64 MiB, and MiB is the reading CLAUDE.md’s "MB" gets', () => {
    // 64 MB read as 64_000_000 would be 6.9% looser than every implementation.
    // Stating the arithmetic is what stops that reading being introduced quietly.
    expect(CEILING_BYTES).toBe(67_108_864);
    expect(claudeMdCeilingMb()).toBe(64);
  });

  it('is the `maximum` on level.schema.json#/properties/textureBudgetBytes', () => {
    expect(
      schemaMaximum(),
      'The schema is what makes "a level may declare itself stricter than the global ' +
        'cap, never looser" true. A `maximum` that drifts above the ceiling lets a ' +
        'level document ask for more than the engine and CI will give it.',
    ).toBe(CEILING_BYTES);
  });

  it('is `MAX_DECODED_TEXTURE_BYTES` in app/adapters/phaser/level-document.ts', () => {
    expect(
      MAX_DECODED_TEXTURE_BYTES,
      'This is the runtime refusal (TN-LEVEL-02). It exists separately from the CI ' +
        'gate because it judges a different population of level document: one that ' +
        'never went through our CI. If it drifts above the ceiling, a too-heavy level ' +
        'reaches the GPU instead of the error card.',
    ).toBe(CEILING_BYTES);
  });

  it('is `MAX_DECODED_TEXTURE_BYTES` in scripts/lib/texture-memory.mjs', () => {
    expect(
      buildScriptConstant(),
      'This is the CI gate, and it is the only copy that measures real files. If it ' +
        'drifts above the ceiling, a build passes on art that no other check will ' +
        'catch before a player does.',
    ).toBe(CEILING_BYTES);
  });

  it('leaves the level schema a lower bound, so a budget of 0 is not authorable', () => {
    // Not part of the four-way agreement, but it is the other half of the claim
    // ADR-0013 makes about the schema: the range is 1..ceiling, so "stricter" has
    // a floor and a level cannot declare a budget it can never satisfy.
    const schema = JSON.parse(
      readFileSync(`${REPO_ROOT}content/schemas/level.schema.json`, 'utf8'),
    ) as { properties?: Record<string, { minimum?: unknown; type?: unknown }> };
    expect(schema.properties?.textureBudgetBytes?.minimum).toBe(1);
    expect(schema.properties?.textureBudgetBytes?.type).toBe('integer');
  });
});
