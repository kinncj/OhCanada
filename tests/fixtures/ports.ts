import { ok, err, type Result } from '@common/result';
import type { Clock, PersistenceError, ProgressRepository, SaveCodec } from '@application/ports';
import type { Progress } from '@domain/progress';

export class FakeClock implements Clock {
  constructor(public t = Date.parse('2026-09-07T12:00:00.000Z')) {}
  now(): number { return this.t; }
  nowIso(): string { return new Date(this.t).toISOString(); }
  advance(ms: number): void { this.t += ms; }
}

export class MemoryRepo implements ProgressRepository {
  stored: Progress | null = null;
  failLoad = false;
  failSave = false;
  async load(): Promise<Result<Progress | null, PersistenceError>> { return this.failLoad ? err({ code: 'io', message: 'load failed' }) : ok(this.stored); }
  async save(p: Progress): Promise<Result<void, PersistenceError>> {
    if (this.failSave) return err({ code: 'io', message: 'save failed' });
    this.stored = p;
    return ok(undefined);
  }
  async clear(): Promise<Result<void, PersistenceError>> { this.stored = null; return ok(undefined); }
}

export class JsonCodec implements SaveCodec {
  encode(p: Progress): string { return JSON.stringify(p); }
  decode(json: string): Result<Progress, PersistenceError> {
    try {
      const v = JSON.parse(json) as Progress;
      if (typeof v.version !== 'number') return err({ code: 'schema', message: 'no version' });
      return ok(v);
    } catch (e) {
      return err({ code: 'corrupt', message: (e as Error).message });
    }
  }
}

export const seq = (values: number[]) => {
  let i = 0;
  return { next: () => values[i++ % values.length] ?? 0 };
};
