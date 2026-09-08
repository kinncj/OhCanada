/**
 * Result — the error channel for every port and every fallible domain rule.
 *
 * TrueNorth ports never throw for expected failures (missing content, a corrupt
 * save code, an unsupported locomotion mode). They return `Result`, so the caller
 * has to deal with the failure and the type checker says so. Exceptions stay for
 * programmer errors and for genuinely exceptional host failures.
 *
 * Lives in `common/` because both `app/domain` and `app/application` need it and
 * `common` imports nothing from `app` (see ADR-0005).
 */

/** Machine-readable failure kinds. UI copy comes from the localizer, never from here. */
export type AppErrorKind =
  | 'not-found'
  | 'invalid'
  | 'unsupported'
  | 'io'
  | 'conflict'
  | 'cancelled';

/** The default error payload carried by `Result`. Plain data — serialisable, testable. */
export interface AppError {
  readonly kind: AppErrorKind;
  /** Stable, greppable identifier, e.g. `content.level.missing`. Not user-facing copy. */
  readonly code: string;
  /** Developer-facing English. Never rendered to a player. */
  readonly message: string;
  /** Structured context: ids, paths, schema pointers. */
  readonly details?: Readonly<Record<string, unknown>>;
  /** The underlying failure, when one exists. */
  readonly cause?: unknown;
}

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

/** `ok()` with no argument is the success of an operation that carries no value. */
export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Convenience constructor for the default `AppError` payload. */
export function appErr(
  kind: AppErrorKind,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
  cause?: unknown,
): Err<AppError> {
  const error: { -readonly [K in keyof AppError]: AppError[K] } = { kind, code, message };
  if (details !== undefined) error.details = details;
  if (cause !== undefined) error.cause = cause;
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Transform the success value; a failure passes straight through. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? { ok: true, value: fn(result.value) } : result;
}

/** Transform the error; a success passes straight through. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : { ok: false, error: fn(result.error) };
}

/** Chain a fallible step. The workhorse of use-case composition. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Read the value or fall back. Use at the edge, not inside rules. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/**
 * Collect a list of results into a result of a list, failing on the first error.
 * Used when loading a level's quests or a subject's questions.
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return { ok: true, value: values };
}
