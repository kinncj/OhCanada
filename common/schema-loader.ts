import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { err, ok, type Result } from './result';

export interface SchemaDocument {
  $id?: string;
  [key: string]: unknown;
}

export interface ValidationError {
  readonly schemaId: string;
  readonly messages: readonly string[];
}

/**
 * Wraps Ajv (JSON Schema 2020-12). Used at build time (scripts/validate-content.mjs
 * re-implements the same options) and at runtime when content is loaded.
 */
export class SchemaValidator {
  private readonly ajv: Ajv2020;
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor(schemas: readonly SchemaDocument[] = []) {
    this.ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    addFormats(this.ajv);
    for (const s of schemas) this.addSchema(s);
  }

  addSchema(schema: SchemaDocument): void {
    if (!schema.$id) throw new Error('Schema must declare $id');
    if (this.ajv.getSchema(schema.$id)) return;
    this.ajv.addSchema(schema, schema.$id);
  }

  validate<T>(schemaId: string, data: unknown): Result<T, ValidationError> {
    let fn = this.compiled.get(schemaId);
    if (!fn) {
      const found = this.ajv.getSchema(schemaId);
      if (!found) return err({ schemaId, messages: [`Unknown schema: ${schemaId}`] });
      fn = found;
      this.compiled.set(schemaId, fn);
    }
    if (fn(data)) return ok(data as T);
    return err({ schemaId, messages: formatErrors(fn.errors ?? []) });
  }
}

export function formatErrors(errors: readonly ErrorObject[]): string[] {
  return errors.map((e) => {
    const extra = e.keyword === 'additionalProperties' ? ` (${String((e.params as { additionalProperty?: string }).additionalProperty)})` : '';
    return `${e.instancePath || '/'} ${e.message ?? 'invalid'}${extra}`;
  });
}
