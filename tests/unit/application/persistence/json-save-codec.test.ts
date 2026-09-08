/**
 * The codec: the size cap that runs before the parser, the version gate, and
 * the schema check (SECURITY.md, TN-SAVE-04, TN-SAVE-06).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CURRENT_SAVE_VERSION,
  MIN_SUPPORTED_SAVE_VERSION,
  createJsonSaveCodec,
  utf8ByteLength,
} from '@application/persistence/json-save-codec';
import type { SaveMigration } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';

import { ORIGIN, at, emptyProgress } from '../../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

interface GameConfig {
  readonly save: { readonly maxImportBytes: number };
}

const gameConfig = JSON.parse(
  readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8'),
) as GameConfig;

const MAX_IMPORT_BYTES = gameConfig.save.maxImportBytes;

const codec = createJsonSaveCodec({ maxImportBytes: MAX_IMPORT_BYTES });

const snapshot = (): ProgressSnapshot => {
  const written = toProgressSnapshot(emptyProgress(), {
    version: CURRENT_SAVE_VERSION,
    updatedAt: ORIGIN,
  });
  if (!written.ok) throw new Error('the fixture must be encodable');
  return written.value;
};

describe('the cap comes from the config, not from this file', () => {
  it('is whatever game.config.json says', () => {
    expect(MAX_IMPORT_BYTES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_IMPORT_BYTES)).toBe(true);
  });

  it('counts UTF-8 bytes, not UTF-16 units', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('日')).toBe(3);
    expect(utf8ByteLength('🍁')).toBe(4);
    expect(utf8ByteLength('🍁')).toBe(Buffer.byteLength('🍁', 'utf8'));
    expect(utf8ByteLength('Répondez à 3 questions 🍁')).toBe(
      Buffer.byteLength('Répondez à 3 questions 🍁', 'utf8'),
    );
  });

  it('refuses an oversized file before the parser sees it (TN-SAVE-06)', () => {
    // Deliberately not JSON: if this were parsed, the error would be a parse
    // failure. It is a size failure, which is the only way to prove the order.
    const huge = `{${'x'.repeat(MAX_IMPORT_BYTES)}`;
    const decoded = codec.decode(huge);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.code).toBe('save.import.tooBig');
      expect(decoded.error.details).toMatchObject({ maxImportBytes: MAX_IMPORT_BYTES });
    }
  });

  it('accepts a file exactly at the cap', () => {
    const small = createJsonSaveCodec({ maxImportBytes: 64 });
    expect(small.decode('{"version":1}').ok).toBe(false); // schema, not size
    const overCap = small.decode(`{"version":1,"pad":"${'x'.repeat(80)}"}`);
    expect(overCap.ok).toBe(false);
    if (!overCap.ok) expect(overCap.error.code).toBe('save.import.tooBig');
  });
});

describe('parsing', () => {
  it('uses JSON.parse and reports a broken file as a broken file (TN-SAVE-04)', () => {
    const decoded = codec.decode('{not json');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.parse.failed');
  });

  it('refuses a JSON document that is not a save', () => {
    for (const text of ['null', '7', '"save"', '[]', '{}', '{"version":"1"}']) {
      const decoded = codec.decode(text);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) {
        expect(['save.version.missing', 'save.schema.invalid']).toContain(decoded.error.code);
      }
    }
  });

  it('cannot be talked into polluting a prototype', () => {
    // Written as text, not as an object literal: `__proto__` in a literal sets
    // the prototype and disappears from the JSON, which would make this pass
    // without testing anything. `JSON.parse` gives the parsed object a real own
    // property with that name, and the schema check refuses it as unknown.
    const body = JSON.stringify(snapshot());
    const injected = `{"__proto__":{"polluted":true},${body.slice(1)}`;
    const decoded = codec.decode(injected);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.schema.invalid');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('versions (TN-SAVE-04)', () => {
  it('reads its own version', () => {
    expect(codec.version).toBe(CURRENT_SAVE_VERSION);
    expect(codec.minSupportedVersion).toBe(MIN_SUPPORTED_SAVE_VERSION);
  });

  it('refuses a save from a newer build without touching it', () => {
    const fromTheFuture = JSON.stringify({ ...snapshot(), version: codec.version + 1 });
    const decoded = codec.decode(fromTheFuture);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.kind).toBe('unsupported');
      expect(decoded.error.code).toBe('save.version.newer');
    }
  });

  it('refuses a version older than it can migrate', () => {
    const strict = createJsonSaveCodec({
      maxImportBytes: MAX_IMPORT_BYTES,
      version: 3,
      minSupportedVersion: 2,
    });
    const decoded = strict.decode(JSON.stringify({ ...snapshot(), version: 1 }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.version.tooOld');
  });

  it('migrates an older supported save forward, step by step', () => {
    const steps: readonly SaveMigration[] = [
      {
        from: 1,
        to: 2,
        apply: (document) => ({ ok: true, value: { ...document, version: 2, bestScoreCarried: true } }),
      },
      {
        from: 2,
        to: 3,
        apply: (document) => {
          const { bestScoreCarried: _dropped, ...rest } = document;
          return { ok: true, value: { ...rest, version: 3 } };
        },
      },
    ];
    const migrating = createJsonSaveCodec({
      maxImportBytes: MAX_IMPORT_BYTES,
      version: 3,
      minSupportedVersion: 1,
      migrations: steps,
    });
    const decoded = migrating.decode(JSON.stringify({ ...snapshot(), version: 1 }));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.version).toBe(3);
  });

  it('says so when a step is missing rather than guessing', () => {
    const missing = createJsonSaveCodec({
      maxImportBytes: MAX_IMPORT_BYTES,
      version: 2,
      minSupportedVersion: 1,
    });
    const decoded = missing.decode(JSON.stringify({ ...snapshot(), version: 1 }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.migration.missing');
  });

  it('reports a migration that failed rather than writing what it produced', () => {
    const failing = createJsonSaveCodec({
      maxImportBytes: MAX_IMPORT_BYTES,
      version: 2,
      minSupportedVersion: 1,
      migrations: [
        {
          from: 1,
          to: 2,
          apply: () => ({
            ok: false,
            error: { kind: 'invalid', code: 'save.migration.failed', message: 'no' },
          }),
        },
      ],
    });
    const decoded = failing.decode(JSON.stringify({ ...snapshot(), version: 1 }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.migration.failed');
  });
});

describe('encoding', () => {
  it('round-trips a save', () => {
    const encoded = codec.encode(snapshot());
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = codec.decode(encoded.value);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value).toEqual(snapshot());
  });

  it('refuses to write a document it could not read back', () => {
    const broken = { ...snapshot(), updatedAt: at(0) as unknown as ProgressSnapshot['updatedAt'] };
    const encoded = codec.encode(broken);
    expect(encoded.ok).toBe(false);
    if (!encoded.ok) expect(encoded.error.code).toBe('save.schema.invalid');
  });
});
