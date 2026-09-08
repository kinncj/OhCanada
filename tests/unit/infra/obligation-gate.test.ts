/**
 * ADR-0009 enforcement: the gate that checks dated obligations is itself checked.
 *
 * The obligation this discharges asked for "a test that exercises the overdue,
 * malformed, dangling, double-closure, discharged and voided cases against a
 * fixed `TRUENORTH_OBLIGATION_TODAY`", and the reason it asked is worth keeping
 * in front of whoever edits the parser next: this gate exists to stop documents
 * making false claims, so a gate that passed a corpus it could not really read
 * would be the same failure one level up. Every case below is run through the
 * real CLI - argv, environment, exit code, stderr - because the exit code is the
 * only part of this script `make lint` actually consumes.
 *
 * Fixtures are written to a temp directory rather than committed under `docs/`,
 * for the obvious reason: a fixture containing a live `OBLIGATION` marker inside
 * the scanned tree would fail the real gate the moment its date passed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/check-obligations.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'obligation-gate-'));
const TODAY = '2026-09-08';

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly output: string;
}

let caseId = 0;

/** Write `markdown` as a one-document corpus and run the gate over it. */
function run(markdown: string, today: string = TODAY): Run {
  caseId += 1;
  const dir = join(WORK, `case-${caseId}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'case.md'), markdown, 'utf8');

  try {
    // stderr is piped rather than inherited: the gate is *meant* to shout, and
    // an expected failure printing its whole banner into the test log makes a
    // real failure harder to find.
    const stdout = execFileSync(process.execPath, [SCRIPT, '--docs', dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, TRUENORTH_OBLIGATION_TODAY: today },
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

describe('the obligation gate fails', () => {
  it('on an obligation past its due date with no closure', () => {
    const result = run('# Doc\n- **OBLIGATION due=2026-09-07 owner=infra** — land the thing.\n');
    expect(result.status).toBe(1);
    expect(result.output).toContain('case.md:2  overdue  owner=infra');
  });

  it('on a malformed obligation marker, rather than ignoring it', () => {
    // The defect that makes this the second-most important case: a typo that is
    // silently unrecognised looks exactly like coverage.
    const result = run('# Doc\n- **OBLIGATION due=2026-09-30 ownr=infra** — typo.\n');
    expect(result.status).toBe(1);
    expect(result.output).toContain('malformed marker');
  });

  it('on a closure keyword with no date', () => {
    const result = run(
      '# Doc\n- ~~**OBLIGATION due=2026-09-01 owner=infra** — done.~~\n  **DISCHARGED** — no date.\n',
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('`DISCHARGED` is not followed by an ISO date');
  });

  it('on a closure with no obligation in the same list item', () => {
    const result = run('# Doc\n- An item.\n  **VOIDED 2026-09-01** — pasted from elsewhere.\n');
    expect(result.status).toBe(1);
    expect(result.output).toContain('dangling closure');
  });

  it('on a closure that sits in a different list item from its obligation', () => {
    // ADR-0009's whole reason for "same block": a discharge recorded away from
    // the obligation is the runbook/ADR-0006 drift that produced this ADR.
    const result = run(
      '# Doc\n- **OBLIGATION due=2026-09-01 owner=infra** — the work.\n- **DISCHARGED 2026-09-02** — over here.\n',
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('overdue');
    expect(result.output).toContain('dangling closure');
  });

  it('on a block claiming both DISCHARGED and VOIDED', () => {
    const result = run(
      '# Doc\n- ~~**OBLIGATION due=2026-09-01 owner=infra** — x.~~\n' +
        '  **DISCHARGED 2026-09-02** — done.\n  **VOIDED 2026-09-03** — moot.\n',
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('double closure');
  });

  it('on a due date that is not a real calendar date', () => {
    const result = run('# Doc\n- **OBLIGATION due=2026-02-30 owner=infra** — no such day.\n');
    expect(result.status).toBe(1);
    expect(result.output).toContain('due=2026-02-30 is not a real calendar date');
  });

  it('on a closure dated after today', () => {
    const result = run(
      '# Doc\n- ~~**OBLIGATION due=2026-09-01 owner=infra** — x.~~\n  **DISCHARGED 2026-09-09** — tomorrow.\n',
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('future closure');
  });
});

describe('the obligation gate passes', () => {
  it('on an obligation discharged in the same list item', () => {
    const result = run(
      '# Doc\n- ~~**OBLIGATION due=2026-09-01 owner=infra** — the work.~~\n' +
        '  **DISCHARGED 2026-09-02** — evidence.\n',
    );
    expect(result.status).toBe(0);
    expect(result.output).toContain('1 closed');
  });

  it('on an obligation voided in the same list item', () => {
    // DISCHARGED and VOIDED are not synonyms: one claims delivery, the other
    // says the premise went away. Both close a block; only a reader can tell
    // whether the right one was chosen.
    const result = run(
      '# Doc\n- ~~**OBLIGATION due=2026-09-01 owner=infra** — the work.~~\n' +
        '  **VOIDED 2026-09-02** — the decision behind it was reversed.\n',
    );
    expect(result.status).toBe(0);
    expect(result.output).toContain('1 closed');
  });

  it('on an obligation due today, because the day is not over', () => {
    const result = run(`# Doc\n- **OBLIGATION due=${TODAY} owner=infra** — today.\n`);
    expect(result.status).toBe(0);
    expect(result.output).toContain('due today');
  });

  it('on markers inside fenced code blocks and inline code spans', () => {
    // ADR-0009 documents its own format, so without this exclusion the gate
    // would report the specification that defines it.
    const result = run(
      '# Doc\n\n```\nOBLIGATION due=YYYY-MM-DD owner=<owner>\nDISCHARGED YYYY-MM-DD\n```\n\n' +
        'Prose about `OBLIGATION`, `DISCHARGED` and `VOIDED`, and a real-looking\n' +
        '`OBLIGATION due=2026-01-01 owner=infra` in a span.\n',
    );
    expect(result.status).toBe(0);
    expect(result.output).toContain('0 open, 0 closed');
  });

  it('but still reports every open obligation, soonest first', () => {
    const result = run(
      '# Doc\n- **OBLIGATION due=2026-12-01 owner=architect** — later.\n' +
        '- **OBLIGATION due=2026-10-01 owner=infra** — sooner.\n',
    );
    expect(result.status).toBe(0);
    const sooner = result.output.indexOf('2026-10-01');
    const later = result.output.indexOf('2026-12-01');
    expect(sooner).toBeGreaterThan(-1);
    expect(later).toBeGreaterThan(sooner);
  });
});

describe('the gate reads the clock', () => {
  const corpus = '# Doc\n- **OBLIGATION due=2026-09-08 owner=infra** — due today.\n';

  it('turns the same unchanged document red when the date passes', () => {
    // ADR-0009's "one deliberate oddity", pinned so nobody removes it as a bug:
    // identical bytes, one day apart, green then red.
    expect(run(corpus, '2026-09-08').status).toBe(0);

    const nextDay = run(corpus, '2026-09-09');
    expect(nextDay.status).toBe(1);
    expect(nextDay.output).toContain('overdue');
    expect(nextDay.output).toContain('NOTHING IN THE TREE HAS TO HAVE CHANGED');
  });

  it('rejects a TRUENORTH_OBLIGATION_TODAY that is not a real date', () => {
    const result = run(corpus, '2026-02-30');
    expect(result.status).toBe(1);
    expect(result.output).toContain('TRUENORTH_OBLIGATION_TODAY');
  });
});
