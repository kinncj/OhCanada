import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * AN ADR NUMBER NAMES ONE DECISION, FOR EVER.
 *
 * On 2026-09-17 two agents, working on branches that could not see each other,
 * each took the next free number from `git log` and each wrote an ADR-0057.
 * Both branches passed every gate and both landed, so `main` carried two
 * different decisions - "a level asks only what it taught" and "a question's
 * options are shuffled where they are drawn" - under one number, and a dozen
 * source comments citing "ADR-0057" no longer said which one they meant.
 *
 * A high-water-mark convention cannot prevent this: the branches were concurrent,
 * so both readings of the high-water mark were correct when they were taken. Only
 * a check at the point the two meet - here - can catch it.
 */
describe('an ADR number is used once', () => {
  const files = readdirSync('docs/adr').filter((n) => n.endsWith('.md'));

  it('gives every ADR file a distinct number', () => {
    const byNumber = new Map<string, string[]>();
    for (const name of files) {
      const number = /^ADR-(\d{4})/u.exec(name)?.[1];
      if (number === undefined) continue;
      byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
    }

    const collisions = [...byNumber.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([number, names]) => `ADR-${number}: ${names.join(' AND ')}`);

    expect(
      collisions,
      `Two decisions cannot share a number - every citation of it becomes ambiguous:\n${collisions.join('\n')}`,
    ).toEqual([]);
  });

  it('can fail: it would report a duplicate it was given', () => {
    const names = ['ADR-0001-one.md', 'ADR-0001-two.md', 'ADR-0002-three.md'];
    const byNumber = new Map<string, string[]>();
    for (const name of names) {
      const number = /^ADR-(\d{4})/u.exec(name)?.[1];
      if (number === undefined) continue;
      byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
    }
    const collisions = [...byNumber.entries()].filter(([, n]) => n.length > 1);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.[1]).toEqual(['ADR-0001-one.md', 'ADR-0001-two.md']);
  });
});
