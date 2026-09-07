import { err, ok, type Result } from '@common/result';
import { SchemaValidator, type SchemaDocument } from '@common/schema-loader';
import type { PersistenceError, SaveCodec } from '@application/ports';
import { SAVE_VERSION, type Progress } from '@domain/progress';
import saveSchema from '@content/schemas/save.schema.json';

const SCHEMA_ID = 'https://truenorth.app/schemas/save.schema.json';
const MAX_BYTES = 512 * 1024;

/** STRIDE/tampering: imports are parsed with JSON.parse only and validated against the save schema. */
export class JsonSaveCodec implements SaveCodec {
  private readonly validator = new SchemaValidator([saveSchema as SchemaDocument]);

  encode(progress: Progress): string {
    return JSON.stringify(progress, null, 2);
  }

  decode(json: string): Result<Progress, PersistenceError> {
    if (json.length > MAX_BYTES) return err({ code: 'corrupt', message: 'Save file too large' });
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return err({ code: 'corrupt', message: 'Save file is not valid JSON' });
    }
    const res = this.validator.validate<Progress>(SCHEMA_ID, raw);
    if (!res.ok) return err({ code: 'schema', message: res.error.messages.slice(0, 3).join('; ') });
    const migrated = migrate(res.value);
    if (!migrated.ok) return migrated;
    return ok(migrated.value);
  }
}

function migrate(p: Progress): Result<Progress, PersistenceError> {
  if (p.version === SAVE_VERSION) return ok(p);
  if (p.version > SAVE_VERSION) return err({ code: 'version', message: `Save version ${p.version} is newer than this game (${SAVE_VERSION})` });
  // Future: stepwise migrations v1 -> v2 -> ...
  return ok({ ...p, version: SAVE_VERSION });
}
