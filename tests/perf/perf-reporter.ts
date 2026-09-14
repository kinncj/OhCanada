import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { describeVerdict, formatNumber, VERDICT_ATTACHMENT, type Verdict } from './verdict';

/**
 * The perf lane's summary: held, breached, not measured - and not checked here.
 *
 * Playwright can only say pass or fail. This reporter is what makes the three
 * outcomes distinguishable in the job's output (ADR-0024), and it adds a fourth
 * section that is not an outcome at all: the budgets this lane deliberately does
 * not measure, where they ARE checked, and when that last happened. It prints on
 * every run, green or red, because what it prevents is a green perf job being
 * read as "frame time is fine".
 *
 * Three rules keep it from becoming a new way to pass by measuring nothing:
 *
 *   1. A test that FAILED WITHOUT A VERDICT - a timeout, a crash, a navigation
 *      error - is NOT MEASURED, named, with its first error line. It is never
 *      dropped from the summary.
 *   2. A run that settled ZERO budgets fails, even if every test passed.
 *   3. A verdict of held on a test that then failed is not printed as held.
 *
 * Output goes to stdout, to `test-results/perf-verdicts.json`, as GitHub
 * annotations whose TITLES differ per outcome, and to the job summary page when
 * `GITHUB_STEP_SUMMARY` is set.
 */

interface Row {
  readonly test: string;
  readonly verdict: Verdict;
}

interface DevicePass {
  readonly recordedOn?: string;
  readonly method?: string;
  readonly commit?: string;
  readonly dirty?: boolean;
  readonly device?: string;
  readonly renderer?: string;
  readonly results?: readonly Verdict[];
}

interface DeviceRecord {
  readonly passes?: readonly DevicePass[];
}

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const VERDICTS_PATH = `${REPO_ROOT}test-results/perf-verdicts.json`;
const DEVICE_RECORD_PATH = `${REPO_ROOT}tests/perf/device-record.json`;

/** Budgets a GPU-less runner cannot measure, and which this lane therefore does not claim. */
export const NOT_CHECKED_HERE: readonly { readonly budget: string; readonly why: string }[] = [
  {
    budget:
      'frame time <= 16.7 ms at the medium preset (60 fps iPhone 13+, iPad, desktop; 30 fps Android 2021 mid-range)',
    why: 'a runner rasterises on SwiftShader, so a frame time there is the cost of a CPU emulating a GPU',
  },
  {
    budget: 'per-character cost <= 1.5 ms with 6 on screen (task 1.12)',
    why: 'a millisecond cost subtracted on a software rasteriser still contains the rasteriser',
  },
  {
    budget: 'time to play <= 6 s on a phone over 25 Mbps',
    why:
      'the runner has a data-centre network and a server CPU, so the time-to-playable this lane records ' +
      'there is a regression tripwire and bounds nothing about a phone',
  },
];

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

const escapeAnnotation = (text: string): string =>
  text.split('%').join('%25').split(CR).join('%0D').split(LF).join('%0A');

export default class PerfReporter implements Reporter {
  readonly #rows: Row[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const name = test.titlePath().filter((part) => part !== '').slice(-2).join(' > ');
    const last = result.attachments.filter((a) => a.name === VERDICT_ATTACHMENT).at(-1);

    if (last?.body !== undefined) {
      const verdict = JSON.parse(last.body.toString('utf8')) as Verdict;
      if (verdict.status === 'held' && result.status !== 'passed') {
        this.#rows.push({
          test: name,
          verdict: {
            budget: verdict.budget,
            status: 'not-measured',
            detail: `the budget read as held but the test then ended "${result.status}": ${firstError(result)}`,
          },
        });
        return;
      }
      this.#rows.push({ test: name, verdict });
      return;
    }

    if (result.status === 'passed' || result.status === 'skipped') return;
    this.#rows.push({
      test: name,
      verdict: {
        budget: test.title,
        status: 'not-measured',
        detail: `the test ended "${result.status}" before it reached a verdict: ${firstError(result)}`,
      },
    });
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    const by = (status: Verdict['status']): Row[] =>
      this.#rows.filter((row) => row.verdict.status === status);
    const heldRows = by('held');
    const breachedRows = by('breached');
    const unmeasuredRows = by('not-measured');
    const empty = this.#rows.length === 0;
    const device = readDeviceRecord();

    const out: string[] = ['', '=== Performance budgets: three outcomes ===', ''];
    const section = (title: string, rows: readonly Row[], marker: string): void => {
      out.push(`${title} (${String(rows.length)})`);
      if (rows.length === 0) out.push('  none');
      for (const row of rows) out.push(`  ${marker} ${describeVerdict(row.verdict)}`, `           [${row.test}]`);
      out.push('');
    };
    section('HELD', heldRows, 'held    ');
    section('BREACHED - the build spends more than its budget', breachedRows, 'BREACHED');
    section(
      'NOT MEASURED - the instrument failed, so nothing is known about these budgets',
      unmeasuredRows,
      'UNKNOWN ',
    );
    if (empty) {
      out.push(
        'NO VERDICTS AT ALL. Zero budgets were settled. That is not a pass: the lane measured nothing,',
        'and this run is failed for that reason alone (ADR-0024).',
        '',
      );
    }
    out.push('NOT CHECKED HERE - a GPU-less runner cannot measure these, so this job makes no claim about them');
    for (const item of NOT_CHECKED_HERE) out.push(`  - ${item.budget}`, `      why: ${item.why}`);
    out.push('  where: make test-perf-device, on real hardware; protocol in tests/perf/README.md');
    out.push(`  last device pass: ${device.line}`, '');
    process.stdout.write(`${out.join('\n')}\n`);

    mkdirSync(dirname(VERDICTS_PATH), { recursive: true });
    writeFileSync(
      VERDICTS_PATH,
      `${JSON.stringify(
        {
          playwrightStatus: result.status,
          held: heldRows,
          breached: breachedRows,
          notMeasured: unmeasuredRows,
          noVerdicts: empty,
          notCheckedHere: NOT_CHECKED_HERE,
          lastDevicePass: device.record,
        },
        null,
        2,
      )}\n`,
    );

    if (process.env.GITHUB_ACTIONS === 'true') {
      const annotate = (level: 'error' | 'notice', title: string, text: string): void => {
        process.stdout.write(`::${level} title=${title}::${escapeAnnotation(text)}\n`);
      };
      for (const row of breachedRows) annotate('error', 'Perf budget BREACHED', describeVerdict(row.verdict));
      for (const row of unmeasuredRows)
        annotate('error', 'Perf NOT MEASURED - instrument failed', describeVerdict(row.verdict));
      if (empty) annotate('error', 'Perf NOT MEASURED - no verdicts', 'The lane settled zero budgets.');
      annotate(
        'notice',
        'Perf - frame time is NOT CHECKED on this runner',
        `Checked on real hardware only (make test-perf-device). Last device pass: ${device.line}`,
      );
    }

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath !== undefined && summaryPath !== '') {
      const cell = (text: string): string => text.split('|').join('\\|').split(LF).join(' ');
      const label = (status: Verdict['status']): string =>
        status === 'held' ? 'held' : status === 'breached' ? '**BREACHED**' : '**NOT MEASURED**';
      const lines = [
        '## Performance budgets',
        '',
        '| Outcome | Budget | Measured | Limit | Detail |',
        '|---|---|---|---|---|',
        ...[...breachedRows, ...unmeasuredRows, ...heldRows].map(({ verdict: v }) =>
          `| ${label(v.status)} | ${cell(v.budget)} | ${cell(formatNumber(v.measured, v.unit))} | ` +
          `${cell(formatNumber(v.limit, v.unit))} | ${cell(v.detail)} |`,
        ),
        ...(empty ? ['| **NOT MEASURED** | every budget | no number | no number | the lane settled zero budgets |'] : []),
        '',
        '### Not checked on this runner',
        '',
        ...NOT_CHECKED_HERE.map((item) => `- **${item.budget}**: ${item.why}.`),
        '',
        `Checked by \`make test-perf-device\` on real hardware (tests/perf/README.md). Last device pass: ${device.line}`,
        '',
      ];
      appendFileSync(summaryPath, `${lines.join('\n')}\n`);
    }

    return empty ? { status: 'failed' } : undefined;
  }

  printsToStdio(): boolean {
    return true;
  }
}

function firstError(result: TestResult): string {
  const message = result.errors[0]?.message ?? result.error?.message ?? 'no error message was recorded';
  /* No trailing full stop: the line is spliced mid-sentence by describeVerdict. */
  return (message.replace(ANSI, '').split(LF)[0] ?? '').slice(0, 300).replace(/\.+$/, '');
}

function readDeviceRecord(): { line: string; record: DevicePass | null } {
  if (!existsSync(DEVICE_RECORD_PATH)) {
    return {
      line: 'NONE RECORDED. No frame-time measurement of this game on real hardware exists yet.',
      record: null,
    };
  }
  try {
    const latest = (JSON.parse(readFileSync(DEVICE_RECORD_PATH, 'utf8')) as DeviceRecord).passes?.[0];
    if (latest === undefined) {
      return { line: 'NONE RECORDED. tests/perf/device-record.json exists and holds no passes.', record: null };
    }
    const record = latest;
    const results = record.results ?? [];
    const counts = (['held', 'breached', 'not-measured'] as const)
      .map((status) => `${String(results.filter((r) => r.status === status).length)} ${status}`)
      .join(', ');
    return {
      line:
        `${record.recordedOn ?? 'undated'} on ${record.device ?? 'an unnamed device'} ` +
        `(${record.renderer ?? 'renderer not recorded'}) by ${record.method ?? 'an unrecorded method'} at ` +
        `${(record.commit ?? 'an unrecorded commit').slice(0, 12)}${record.dirty === true ? ' (dirty tree)' : ''}: ${counts}. ` +
        'A pass on this hardware is not a pass on an iPhone 13',
      record,
    };
  } catch (error) {
    return {
      line: `UNREADABLE: tests/perf/device-record.json did not parse (${String(error)}), so no device pass can be cited.`,
      record: null,
    };
  }
}
