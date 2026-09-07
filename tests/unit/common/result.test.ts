import { describe, expect, it } from 'vitest';
import { andThen, err, isErr, isOk, map, mapErr, ok, unwrap } from '@common/result';

describe('Result', () => {
  it('ok/err discriminate', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('x'))).toBe(true);
    expect(isOk(err('x'))).toBe(false);
  });
  it('map/mapErr/andThen', () => {
    expect(map(ok(2), (v) => v * 2)).toEqual(ok(4));
    expect(map(err('e'), (v: number) => v * 2)).toEqual(err('e'));
    expect(mapErr(err('e'), (e) => e + '!')).toEqual(err('e!'));
    expect(mapErr(ok(1), (e: string) => e + '!')).toEqual(ok(1));
    expect(andThen(ok(1), (v) => ok(v + 1))).toEqual(ok(2));
    expect(andThen(err('e'), (v: number) => ok(v + 1))).toEqual(err('e'));
  });
  it('unwrap throws on err', () => {
    expect(unwrap(ok(5))).toBe(5);
    expect(() => unwrap(err(new Error('bad')))).toThrow('bad');
    expect(() => unwrap(err('plain'))).toThrow('plain');
  });
});
