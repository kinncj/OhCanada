/**
 * Contract tests for `common/result.ts`.
 *
 * These test the *contract* every later slice leans on, not the current
 * implementation: a rewrite that keeps `ok`/`err` discrimination, the
 * pass-through semantics of the combinators and "errors are values" must keep
 * every one of these passing.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  all,
  andThen,
  appErr,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrapOr,
} from '@common/result';
import type { AppError, AppErrorKind, Result } from '@common/result';

/** A failure payload that is not an `AppError`, to prove `E` is genuinely generic. */
interface ParseFailure {
  readonly at: number;
}

const boom = (): never => {
  throw new Error('a combinator called a function it must not call');
};

describe('ok / err construction and discrimination', () => {
  it('ok(value) carries the value and discriminates as success', () => {
    const result = ok(42);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('ok() with no argument is a success carrying no value', () => {
    const result = ok();

    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
  });

  it('err(error) carries the error and discriminates as failure', () => {
    const failure: ParseFailure = { at: 7 };
    const result = err(failure);

    expect(result.ok).toBe(false);
    expect(result.error).toBe(failure);
  });

  it('discriminates on the tag, not on truthiness of the payload', () => {
    // The classic trap: falsy success values must still be successes, and
    // falsy errors must still be failures.
    const falsy: readonly unknown[] = [0, '', false, null, undefined, NaN];

    for (const value of falsy) {
      expect(isOk(ok(value))).toBe(true);
      expect(isErr(ok(value))).toBe(false);
      expect(isOk(err(value))).toBe(false);
      expect(isErr(err(value))).toBe(true);
    }
  });

  it('narrows the union for the type checker as well as at runtime', () => {
    const result: Result<number, ParseFailure> = ok(3);

    if (isOk(result)) {
      // Compiles only because `isOk` is a type predicate.
      expect(result.value + 1).toBe(4);
    } else {
      expect.unreachable('ok(3) must narrow to Ok');
    }

    const failed: Result<number, ParseFailure> = err({ at: 2 });

    if (isErr(failed)) {
      expect(failed.error.at).toBe(2);
    } else {
      expect.unreachable('err(...) must narrow to Err');
    }
  });
});

describe('appErr', () => {
  it('builds a failure carrying kind, code and message', () => {
    const result = appErr('not-found', 'content.level.missing', 'No level for id l-01');

    expect(isErr(result)).toBe(true);
    expect(result.error.kind).toBe('not-found');
    expect(result.error.code).toBe('content.level.missing');
    expect(result.error.message).toBe('No level for id l-01');
  });

  it('omits optional keys entirely when they are not supplied', () => {
    // Not merely `undefined`: absent, so structural comparison and JSON round
    // trips stay stable and `exactOptionalPropertyTypes` holds.
    const result = appErr('invalid', 'save.code.corrupt', 'Checksum mismatch');

    expect('details' in result.error).toBe(false);
    expect('cause' in result.error).toBe(false);
    expect(result.error).toEqual({
      kind: 'invalid',
      code: 'save.code.corrupt',
      message: 'Checksum mismatch',
    });
  });

  it('carries details when supplied', () => {
    const details = { pointer: '/questions/3/answers' };
    const result = appErr('invalid', 'content.schema', 'Unknown property', details);

    expect(result.error.details).toEqual(details);
    expect('cause' in result.error).toBe(false);
  });

  it('carries a cause when supplied', () => {
    const cause = new Error('quota exceeded');
    const result = appErr('io', 'progress.write', 'Could not persist progress', undefined, cause);

    expect(result.error.cause).toBe(cause);
    expect('details' in result.error).toBe(false);
  });

  it('carries details and cause together', () => {
    const cause = new Error('underlying');
    const result = appErr('conflict', 'progress.merge', 'Diverged', { levelId: 'l-02' }, cause);

    expect(result.error.details).toEqual({ levelId: 'l-02' });
    expect(result.error.cause).toBe(cause);
  });

  it('accepts every documented failure kind', () => {
    const kinds: readonly AppErrorKind[] = [
      'not-found',
      'invalid',
      'unsupported',
      'io',
      'conflict',
      'cancelled',
    ];

    for (const kind of kinds) {
      expect(appErr(kind, 'code', 'message').error.kind).toBe(kind);
    }
  });

  it('produces a plain, serialisable payload when no cause is attached', () => {
    const result = appErr('unsupported', 'locomotion.mode', 'No such mode', { mode: 'fly' });

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      ok: false,
      error: {
        kind: 'unsupported',
        code: 'locomotion.mode',
        message: 'No such mode',
        details: { mode: 'fly' },
      },
    });
  });
});

describe('map', () => {
  it('transforms the success value', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
  });

  it('passes a failure straight through without calling the function', () => {
    const failure: Result<number, ParseFailure> = err({ at: 1 });

    const mapped = map(failure, boom);

    expect(isErr(mapped)).toBe(true);
    expect(mapped).toEqual(failure);
  });

  it('can change the success type', () => {
    const mapped = map(ok(7), (n) => `#${String(n)}`);

    expect(unwrapOr(mapped, 'fallback')).toBe('#7');
  });

  it('is composable and preserves order of application', () => {
    const seen: string[] = [];
    const step =
      (label: string) =>
      (n: number): number => {
        seen.push(label);
        return n + 1;
      };

    const result = map(map(map(ok(0), step('a')), step('b')), step('c'));

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(unwrapOr(result, -1)).toBe(3);
  });
});

describe('mapErr', () => {
  it('transforms the error', () => {
    const mapped = mapErr(err<ParseFailure>({ at: 4 }), (failure) => failure.at);

    expect(mapped).toEqual({ ok: false, error: 4 });
  });

  it('passes a success straight through without calling the function', () => {
    const success: Result<string, ParseFailure> = ok('kept');

    const mapped = mapErr(success, boom);

    expect(mapped).toEqual(success);
    expect(unwrapOr(mapped, 'fallback')).toBe('kept');
  });

  it('can widen a domain failure into the shared AppError shape', () => {
    const mapped: Result<number, AppError> = mapErr(
      err<ParseFailure>({ at: 9 }),
      (failure): AppError => ({
        kind: 'invalid',
        code: 'save.code.parse',
        message: `Bad character at ${String(failure.at)}`,
      }),
    );

    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) expect(mapped.error.code).toBe('save.code.parse');
  });
});

describe('andThen', () => {
  const half = (n: number): Result<number, AppError> =>
    n % 2 === 0 ? ok(n / 2) : appErr('invalid', 'math.odd', `${String(n)} is odd`);

  it('chains a fallible step on success', () => {
    expect(andThen(ok(8), half)).toEqual({ ok: true, value: 4 });
  });

  it('surfaces a failure raised by the chained step', () => {
    const result = andThen(ok(7), half);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('math.odd');
  });

  it('short-circuits on an incoming failure without calling the step', () => {
    const failure: Result<number, AppError> = appErr('io', 'read', 'gone');

    const result = andThen(failure, boom);

    expect(result).toEqual(failure);
  });

  it('stops the pipeline at the first failing step', () => {
    const third = vi.fn(half);

    const result = andThen(andThen(andThen(ok(12), half), half), third);

    // 12 -> 6 -> 3, and 3 is odd, so the third step runs and fails.
    expect(third).toHaveBeenCalledTimes(1);
    expect(isErr(result)).toBe(true);

    const afterFailure = vi.fn(half);
    andThen(result, afterFailure);
    expect(afterFailure).not.toHaveBeenCalled();
  });
});

describe('unwrapOr', () => {
  it('reads the success value', () => {
    expect(unwrapOr(ok('value'), 'fallback')).toBe('value');
  });

  it('returns the fallback on failure', () => {
    expect(unwrapOr(err<ParseFailure>({ at: 0 }), 'fallback')).toBe('fallback');
  });

  it('returns a falsy success value rather than the fallback', () => {
    expect(unwrapOr(ok(0), 99)).toBe(0);
    expect(unwrapOr(ok(''), 'fallback')).toBe('');
    expect(unwrapOr(ok(false), true)).toBe(false);
  });
});

describe('all', () => {
  it('collects successes into a list, preserving order', () => {
    const result = all([ok('a'), ok('b'), ok('c')]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect([...result.value]).toEqual(['a', 'b', 'c']);
  });

  it('succeeds with an empty list for an empty input', () => {
    const result = all<string, AppError>([]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect([...result.value]).toEqual([]);
  });

  it('fails with the first error', () => {
    const first = appErr('not-found', 'question.missing', 'q-01');
    const second = appErr('invalid', 'question.malformed', 'q-02');

    const result = all<string, AppError>([ok('a'), first, ok('b'), second]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('question.missing');
  });

  it('fails when the very first result is an error', () => {
    const result = all<number, AppError>([appErr('io', 'read', 'gone'), ok(1)]);

    expect(isErr(result)).toBe(true);
  });

  it('does not alias the input array', () => {
    const inputs = [ok(1), ok(2)];
    const result = all(inputs);

    inputs.push(ok(3));

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toHaveLength(2);
  });
});

describe('errors are values, never thrown across a boundary', () => {
  /** Stand-in for a port: every expected failure comes back as a value. */
  const loadQuestion = (id: string): Result<{ id: string }, AppError> =>
    id === 'q-01' ? ok({ id }) : appErr('not-found', 'content.question.missing', id, { id });

  it('a failing port call returns instead of throwing', () => {
    expect(() => loadQuestion('nope')).not.toThrow();
    expect(isErr(loadQuestion('nope'))).toBe(true);
  });

  it('a full failing pipeline of combinators never throws', () => {
    expect(() => {
      const loaded = loadQuestion('nope');
      const chained = andThen(loaded, (question) => ok(question.id.toUpperCase()));
      const mapped = map(chained, (id) => id.length);
      const rewritten = mapErr(mapped, (error) => error.code);
      const collected = all([rewritten]);
      return unwrapOr(collected, []);
    }).not.toThrow();
  });

  it('reports a failure rather than throwing even when the caller ignores it', () => {
    const outcome = map(loadQuestion('nope'), boom);

    expect(isErr(outcome)).toBe(true);
  });
});
