import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '@common/schema-loader';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://t/thing.json',
  type: 'object',
  properties: { n: { type: 'integer' } },
  required: ['n'],
  additionalProperties: false,
};

describe('SchemaValidator', () => {
  it('validates and rejects unknown props', () => {
    const v = new SchemaValidator([schema]);
    expect(v.validate('https://t/thing.json', { n: 1 }).ok).toBe(true);
    const bad = v.validate('https://t/thing.json', { n: 1, extra: true });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.messages[0]).toContain('extra');
    const missing = v.validate('https://t/thing.json', {});
    expect(missing.ok).toBe(false);
  });
  it('unknown schema id and duplicate add', () => {
    const v = new SchemaValidator();
    expect(v.validate('nope', {}).ok).toBe(false);
    v.addSchema(schema);
    v.addSchema(schema); // idempotent
    expect(() => v.addSchema({ type: 'object' })).toThrow('$id');
  });
});
