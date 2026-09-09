/**
 * The blind hand-off: the harness is itself checked.
 *
 * `make verify-art` exists because the first real art verification COULD NOT RUN
 * BLIND. The art-verifier had to locate the renders in order to rasterise them,
 * and the directory listing named `landmark-parliament-hill.svg` before it saw a
 * single image; every identification verdict in docs/art-verification.json is
 * marked untrusted for that reason. Its conclusion is the specification:
 *
 *     Any identifier that finds its own inputs sees their names. Anonymised
 *     hand-off must be done by a step the identifier does not run.
 *
 * And the property that makes these tests worth writing rather than trusting the
 * code: BLINDNESS LEAKS SILENTLY. A run in which a filename was glimpsed emits
 * output identical to a clean one. There is no failing assertion to notice
 * afterwards, which is exactly why the leak has to be asserted at hand-off time
 * and why a test has to prove the assertion fires.
 *
 * Every case drives the REAL CLI - argv, exit code, stdout, stderr - over either
 * the real repository or a scratch tree whose SVGs are real files that sharp
 * really rasterises. A test that re-implemented the compositing would prove the
 * copy agrees with the copy.
 *
 * The two cases that cannot go through the CLI go through the real exported
 * `scanForLeaks` instead, and the reason is worth stating: THERE IS NO ARGV THAT
 * MAKES THE HARNESS LEAK A NAME OR WRITE PNG METADATA. To prove the scan fires
 * on those, the leak has to be planted by hand in a directory the scan is then
 * pointed at. That the CLI cannot be made to produce them is the point, not a
 * gap in the coverage.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * EVERY CASE IN THIS FILE SPAWNS A PROCESS THAT RASTERISES REAL ART, so the 5 s
 * default does not describe the work.
 *
 * The comparison canvas alone composites two whole figures out of twenty rig
 * parts each, and several cases build more than one hand-off. That is 3.2 s on
 * this laptop and it timed out on a GitHub runner, which is a good deal slower.
 *
 * Set for the FILE rather than on the cases that are slow today, deliberately:
 * the next render-building case somebody adds would otherwise have to remember,
 * and would fail on the runner and pass locally -- which is the failure this
 * file is about. The budget is generous on purpose. A suite that passes at 30 s
 * against a 5 s limit is one busy runner away from flaking, and A FLAKY GATE
 * GETS DISABLED, AND A DISABLED GATE LEAKS SILENTLY. That sentence is the
 * argument for this whole harness; it applies to the harness's own tests.
 *
 * This is a ceiling, not a target. The cases below build the SMALLEST hand-off
 * that answers them (`cheap`, below) and use fixed seeds instead of repeated
 * sampling, so the suite runs in a few seconds and the ceiling is never
 * approached.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const SCRIPT = fileURLToPath(new URL('../../../scripts/verify-art.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'art-handoff-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

const run = (args: readonly string[]): Run => {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

/**
 * Ask the shipped module, in its own process, what it answers.
 *
 * Spawned rather than imported, for the same reason every other infra gate test
 * spawns its CLI: these are build scripts, not application code, and what
 * matters is what Node makes of them - not what a bundler makes of them here.
 */
const LIB = new URL('../../../scripts/lib/art-handoff.mjs', import.meta.url).href;

const callLib = <T>(fn: string, args: unknown[]): T => {
  const code =
    `import * as lib from ${JSON.stringify(LIB)};` +
    `process.stdout.write(JSON.stringify(lib[${JSON.stringify(fn)}](...${JSON.stringify(args)})));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  expect(result.stderr, `${fn} wrote to stderr`).toBe('');
  return JSON.parse(result.stdout ?? 'null') as T;
};

const scanForLeaks = (args: {
  handoffDir: string;
  keymapPath: string;
  tokens: readonly string[];
}): string[] => callLib<string[]>('scanForLeaks', [args]);

const leakTokens = (args: { references: unknown }): string[] =>
  callLib<string[]>('leakTokens', [args]);

let scratchCount = 0;
const scratch = (name: string): string => {
  scratchCount += 1;
  const dir = join(WORK, `${name}-${scratchCount}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

/* ------------------------------------------------------------------ *
 * A scratch repository
 * ------------------------------------------------------------------ */

/**
 * A real SVG that rasterises to a real picture. `label` is drawn as SHAPES, not
 * as text - a `<text>` element is refused by the harness, and refusing it is one
 * of the cases below.
 */
const svg = (width: number, height: number, fill: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  `<title>this title must never reach the identifier</title>` +
  `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}"/>` +
  `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#ffffff"/>` +
  `</svg>`;

/** The minimum rig-contract.json shape `loadContract` insists on parsing. */
const RIG = {
  characterSpace: { width: 240, height: 470 },
  expressions: { names: ['neutral'] },
  slots: {
    skin: { options: ['skin-1'] },
    hairShape: { options: ['crop'] },
    hairColour: { options: ['black'] },
  },
  parts: [{ name: 'torso', z: 1, frame: 'torso-{costume}', mirrorX: false }],
  atlas: { framePrefix: 'character-' },
  frames: {},
};

interface FixtureOptions {
  readonly subjects?: unknown[];
  readonly sources?: Readonly<Record<string, string>>;
}

const PEACE_TOWER = {
  id: 'peace-tower',
  subject: 'The Peace Tower, Centre Block, Parliament Hill, Ottawa',
  renders: ['src/svg/ottawa/landmark-parliament-hill.svg'],
  renderRecipe: 'Rasterise the file on its own at 1x.',
  expectedBlindAnswer: ['Peace Tower', 'Parliament Hill'],
  mustBeRight: [{ feature: 'green copper spire' }, { feature: 'clock face' }],
  neverAdd: ['a dome'],
};

const UNRENDERED = {
  id: 'parliament-hill-skyline',
  subject: 'Parliament Hill seen from a distance',
  renders: [],
  renderRecipe: 'UNRENDERED, by decision. The skyline tile is a droppable repeating layer.',
  expectedBlindAnswer: ['Parliament Hill'],
  mustBeRight: [{ feature: 'the escarpment' }],
};

/** A scratch repository root that `--root` can be pointed at. */
const fixture = (name: string, options: FixtureOptions = {}): string => {
  const root = scratch(name);
  mkdirSync(join(root, 'assets', 'refs'), { recursive: true });
  mkdirSync(join(root, 'assets', 'style'), { recursive: true });
  mkdirSync(join(root, 'assets', 'src', 'svg', 'ottawa'), { recursive: true });

  const sources = options.sources ?? {
    'src/svg/ottawa/landmark-parliament-hill.svg': svg(400, 300, '#c8a05a'),
  };
  for (const [rel, body] of Object.entries(sources)) {
    writeFileSync(join(root, 'assets', rel), body);
  }
  writeFileSync(
    join(root, 'assets', 'refs', 'references.json'),
    JSON.stringify({ subjects: options.subjects ?? [PEACE_TOWER, UNRENDERED] }, null, 2),
  );
  writeFileSync(join(root, 'assets', 'style', 'rig-contract.json'), JSON.stringify(RIG, null, 2));
  return root;
};

const readKeymap = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

/** Build a hand-off from a fixture and return every path a case needs. */
/**
 * The smallest hand-off that still answers a structural question: one character
 * figure, no size ladder. It KEEPS `full`, both masked-feature probes and the
 * comparison figure -- six renders instead of fourteen -- so every case that only
 * reads the keymap can use it. Cases that are about the ladder itself must not.
 */
const CHEAP = ['--variants', '1', '--no-ladder'] as const;

const handoff = (root: string, extra: readonly string[] = [], seed: string | null = 'test-seed') => {
  const out = scratch('out');
  const result = run([
    'handoff',
    '--root',
    root,
    '--out',
    out,
    ...(seed === null ? [] : ['--seed', seed]),
    ...extra,
  ]);
  return {
    result,
    out,
    handoffDir: join(out, 'handoff'),
    keymapPath: join(out, 'keymap.json'),
    answersPath: join(out, 'handoff', 'answers.json'),
  };
};

/* ================================================================== *
 * 1. The real repository
 * ================================================================== */

interface ReferenceSubject {
  readonly id: string;
  readonly renders: readonly string[];
  readonly expectedBlindAnswer: readonly string[];
}

/**
 * The subjects the contract declares, read at run time. Every case that needs
 * to know what the set contains reads it from here rather than listing members:
 * the set grows by one level at a time and an assertion pinned to today's
 * members fails on every legitimate addition and catches none of the defects it
 * was written for.
 */
const subjectsOf = (root: string): readonly ReferenceSubject[] =>
  (
    JSON.parse(readFileSync(join(root, 'assets', 'refs', 'references.json'), 'utf8')) as {
      subjects: ReferenceSubject[];
    }
  ).subjects;

describe('the gate over the repository as it stands', () => {
  const gate = run(['--root', REPO]);

  it('builds an anonymised hand-off and reports what it did not establish', () => {
    // NOT an assertion about the exit code. The gate scores the live verdict
    // record over the art as it currently stands, and BOTH of those are other
    // agents' work in progress: the day art ships a defect, or a subject has no
    // verdict yet, this gate exits 1 and is RIGHT to. A case pinned to 0 fails
    // on a correct refusal and passes on none of the defects it was written
    // for - the same shape as an assertion pinned to a count that grows.
    //
    // What is this file's to assert is the half that must hold either way: a
    // hand-off was built, and the anonymisation over it held. The scoring half
    // is asserted below over records this file constructs.
    expect(gate.stdout).toMatch(/hand-off run [0-9a-f]{16} - \d+ render\(s\) over \d+ subject\(s\)/);
    expect(gate.stdout).toContain('anonymisation held');
  });

  it('never prints a bare OK, on a run that does pass', () => {
    // The whole point, and it has to be asserted on a run that actually
    // SUCCEEDS: a gate that printed a bare OK would be indistinguishable from
    // one that had established blind identification, which is the failure this
    // harness exists to prevent. The live record cannot carry this case any
    // more - it legitimately fails today, and on a failing run there is no
    // success line to inspect - so the passing run is constructed here.
    const path = join(scratch('no-identification'), 'art-verification.json');
    writeFileSync(path, JSON.stringify({ runIntegrity: { blindnessHeld: false }, results: [] }));
    const result = run(['--root', REPO, ...CHEAP, '--record', path]);

    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('verify-art: OK');
    // and the OK is qualified, every time
    expect(result.stdout).toContain('no output can prove it after the fact');
    expect(result.stdout).toMatch(/NOT ESTABLISHED|does not establish that the verdict was made blind/);
  });

  it('names EVERY unrendered subject as neither a pass nor a failure', () => {
    // A subject with no renders is unrendered ON PURPOSE: its only sources are
    // droppable repeating parallax layers, and a verifier able to name the city
    // from one would be reporting a defect, not a pass. It must not read as a
    // failure and it must not read as a pass.
    //
    // DERIVED FROM THE CONTRACT, not listed. This case named
    // `parliament-hill-skyline` and nothing else, so when Quebec City arrived
    // with `quebec-city-riverfront` - the same decision, for the same reason -
    // the case still passed while asserting nothing about it. An assertion that
    // covers the member that prompted it and not the next one is the shape this
    // repository keeps finding (ADR-0019).
    const unrendered = subjectsOf(REPO).filter((s) => s.renders.length === 0);
    expect(unrendered.length, 'no subject is unrendered; this case has nothing to check').toBeGreaterThan(0);
    for (const subject of unrendered) {
      expect(gate.stdout).toContain(
        `${subject.id} is UNRENDERED by decision - not a pass and not a failure`,
      );
      expect(gate.stdout).not.toMatch(new RegExp(`PASS ${subject.id}`));
      expect(gate.stdout).not.toMatch(new RegExp(`FAIL ${subject.id}`));
    }
  });

  it('varies the officer between runs, because a character is never judged from one file', () => {
    // references.json: "The skin and hair choice must be VARIED between runs - a
    // subject that only ever renders with one tone is a subject nobody checked
    // the others of."
    // UNSEEDED, which is how a real run goes. `--seed` exists so the rest of
    // this file is deterministic and is the one thing a real run must not use.
    const slotsOf = (): string => {
      const built = handoff(REPO, [...CHEAP], null);
      const keymap = readKeymap(built.keymapPath);
      return keymap.entries
        .filter((e: { subjectId: string; gating: boolean }) => e.subjectId === 'officer' && e.gating)
        .map((e: { slots: { skin: string; hairShape: string; hairColour: string } }) =>
          [e.slots.skin, e.slots.hairShape, e.slots.hairColour].join('/'),
        )
        .sort()
        .join(' ');
    };
    // Four rather than five: 120 skin/hair combinations, so four runs all landing
    // on the same one is about one in a million. Cheap builds, because this reads
    // the keymap and not the pixels.
    const runs = new Set([slotsOf(), slotsOf(), slotsOf(), slotsOf()]);
    expect(runs.size, `four runs produced ${runs.size} distinct skin/hair sets`).toBeGreaterThan(1);
  });
});

/* ================================================================== *
 * 2. The anonymisation actually anonymises
 * ================================================================== */

/* ================================================================== *
 * Two leaks a genuinely unprimed run found, both metadata, not images
 * ================================================================== */

describe('the answer matcher accepts a correct answer worded differently', () => {
  /**
   * A padded SUBSTRING match cannot accept a correct answer phrased with an
   * extra adjective, and that cost a real run its meaning.
   * `rideau-canal-skateway`'s contract was amended to accept a GENERIC answer -
   * the place name is explicitly optional - and a genuinely blind run said "an
   * outdoor public skating rink on a frozen CITY canal". All four generic
   * phrases failed on one inserted word, and the subject passed ONLY because
   * the verifier volunteered "Rideau Canal". A verifier obeying the contract
   * exactly would have been marked wrong: the contract was right and the
   * matcher was not.
   */
  const scoreAnswer = (subjectId: string, answer: string): { status: number; output: string } => {
    const references = JSON.parse(
      readFileSync(join(REPO, 'assets', 'refs', 'references.json'), 'utf8'),
    ) as { subjects: { id: string; mustBeRight: { feature: string }[] }[] };
    const subject = references.subjects.find((s) => s.id === subjectId);
    const record = {
      runIntegrity: { blindnessHeld: true },
      results: [],
      handoffRun: {
        keymap: {
          id: 'truenorth-art-handoff-keymap',
          version: 1,
          runId: 'matcherfixture01',
          entries: [
            {
              render: 'fedcba9876543210.png',
              subjectId,
              probe: 'full',
              gating: true,
              width: 100,
              height: 100,
              naturalWidth: 100,
              naturalHeight: 100,
            },
          ],
          unrendered: [],
        },
        answers: {
          runId: 'matcherfixture01',
          identifications: [{ render: 'fedcba9876543210.png', answer }],
        },
        audit: {
          runId: 'matcherfixture01',
          audits: [
            {
              subjectId,
              featuresPresent: (subject?.mustBeRight ?? []).map((m) => m.feature),
              featuresAbsent: [],
              featuresUncheckable: [],
              forbiddenPresent: [],
            },
          ],
        },
      },
    };
    const path = join(scratch('matcher'), 'art-verification.json');
    writeFileSync(path, JSON.stringify(record, null, 2));
    return run(['--root', REPO, ...CHEAP, '--record', path]);
  };

  const SUBJECT = 'rideau-canal-skateway';

  it('accepts the generic answer the contract asks for, with an adjective inserted', () => {
    // No place name anywhere in this string. Under a substring match it failed.
    const result = scoreAnswer(
      SUBJECT,
      'An outdoor public skating rink on a frozen city canal in winter, with skaters on the ice.',
    );
    expect(result.output).not.toContain('the unprompted answer did not name the subject');
    expect(result.output).toContain(`PASS ${SUBJECT}`);
  });

  it('still accepts the exact phrase, which is the common case', () => {
    const result = scoreAnswer(SUBJECT, 'an outdoor skating rink on a frozen canal');
    expect(result.output).toContain(`PASS ${SUBJECT}`);
  });

  it('does not accept words merely scattered through an answer', () => {
    // The bound is what stops "in order, with gaps" from becoming a bag of
    // words. Three words apart is not a phrase, and a negation is not an
    // identification.
    const result = scoreAnswer(SUBJECT, 'the Rideau is definitely not a canal, and there is no ice');
    expect(result.output).toContain('the unprompted answer did not name the subject');
  });

  it('does not accept a different subject entirely', () => {
    const result = scoreAnswer(SUBJECT, 'a photograph of a mountain range at sunset');
    expect(result.output).toContain('the unprompted answer did not name the subject');
  });
});

describe('an earlier run must not be reachable during a later run\'s blind phase', () => {
  /**
   * The leak: an `audit.json` left in the session scratchpad from a previous
   * run. An audit is written AFTER reveal, so it names every subject and every
   * `mustBeRight` feature verbatim - and the scratchpad is the directory agents
   * are TOLD to use for working files, so an identifier following its own
   * instructions is one `cat` from the answers.
   *
   * `scoreRun` refuses a stale audit by run id, which is correct at score time
   * and no protection at identify time. The run that found it stayed honest
   * because the verifier did not open the file and checked timestamps to prove
   * it. That is discipline, and discipline is not a control.
   */
  /**
   * Any subject will do - the point is that the audit names ONE - so this takes
   * the first and asserts the contract is not empty rather than indexing into
   * it and hoping.
   */
  const someSubjectId = (): string => {
    const subjects = subjectsOf(REPO);
    expect(subjects.length, 'the contract names no subjects').toBeGreaterThan(0);
    return subjects[0]?.id ?? '';
  };

  const staleAudit = (subjectId: string): string =>
    JSON.stringify({
      runId: 'c3d5c9fb89330709',
      audits: [{ subjectId, featuresPresent: ['a frozen canal with skaters'] }],
    });

  it('refuses a hand-off when a previous run\'s audit sits beside it', () => {
    const out = scratch('working-area');
    const subjectId = someSubjectId();
    writeFileSync(join(out, 'audit.json'), staleAudit(subjectId));

    const result = run(['handoff', '--root', REPO, '--out', out, ...CHEAP, '--seed', 'wa-1']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('audit.json is in the identifier\'s working area');
    expect(result.output).toContain(subjectId);
    expect(result.output).toContain('must not be reachable during a later run\'s blind phase');
  });

  it('says it will not delete the file, because it is a previous verification\'s evidence', () => {
    const out = scratch('working-area-keep');
    writeFileSync(join(out, 'audit.json'), staleAudit(someSubjectId()));
    const result = run(['handoff', '--root', REPO, '--out', out, ...CHEAP, '--seed', 'wa-2']);
    expect(result.output).toContain('It is not deleted for you');
    expect(existsSync(join(out, 'audit.json'))).toBe(true);
  });

  it('builds once the artefact is moved away, which is the fix it asks for', () => {
    // The negative case. A refusal with no way through is a gate people turn
    // off, so the instruction it prints has to be one that works.
    const out = scratch('working-area-cleared');
    writeFileSync(join(out, 'audit.json'), staleAudit(someSubjectId()));
    expect(run(['handoff', '--root', REPO, '--out', out, ...CHEAP, '--seed', 'wa-3']).status).toBe(1);

    const archive = join(scratch('archive'), 'audit.json');
    writeFileSync(archive, readFileSync(join(out, 'audit.json'), 'utf8'));
    rmSync(join(out, 'audit.json'));
    rmSync(join(out, 'handoff'), { recursive: true, force: true });

    const second = run(['handoff', '--root', REPO, '--out', out, ...CHEAP, '--seed', 'wa-4']);
    expect(second.status, second.output).toBe(0);
  });

  it('does not object to the run\'s own keymap, which the briefing already covers', () => {
    // The keymap sits in the working area BY DESIGN - `--out DIR` puts it at
    // DIR/keymap.json - and it names every subject. It is excluded because it
    // is this run's own artefact and the identifier is told not to open it;
    // the rule being added is about UNKNOWN files, which no briefing covers.
    const built = handoff(REPO, [...CHEAP]);
    expect(built.result.status, built.result.output).toBe(0);
    expect(readFileSync(built.keymapPath, 'utf8')).toContain(someSubjectId());
  });

  it('does not walk the surroundings when no working area was named', () => {
    // The gate builds into a fresh mkdtemp whose parent is the SYSTEM TEMP
    // directory - thousands of unrelated files, including other agents' work.
    // Walking that would be both meaningless and slow, so the scan runs only
    // when the operator passed --out. This asserts the gate still completes.
    const result = run(['--root', REPO, ...CHEAP]);
    expect(result.stdout).toContain('anonymisation held');
  });
});

describe('pixel dimensions do not partition the set', () => {
  /**
   * Order was shuffled and byte length was padded, and the SIZES still gave it
   * away: 240x470 appeared four times, all one subject; 140x274 twice, same
   * subject; and so on for nine of eleven size classes, covering seventeen of
   * twenty-one renders. An identifier could link every ladder rung to its
   * full-size render out of answers.json WITHOUT OPENING AN IMAGE.
   */
  const built = handoff(REPO, ['--variants', '2']);
  const keymap = readKeymap(built.keymapPath) as {
    entries: { subjectId: string; width: number; height: number; naturalWidth: number }[];
  };

  it('hands over every render on one canvas, so no size class is subject-pure', () => {
    const classes = new Map<string, Set<string>>();
    for (const entry of keymap.entries) {
      const size = `${String(entry.width)}x${String(entry.height)}`;
      classes.set(size, (classes.get(size) ?? new Set()).add(entry.subjectId));
    }
    expect(classes.size, 'more than one size class still partitions the set').toBe(1);
    // and the one class holds every subject in the run, which is the property
    // that class being singular is FOR.
    const subjects = new Set(keymap.entries.map((e) => e.subjectId));
    expect([...classes.values()][0]?.size).toBe(subjects.size);
    expect(subjects.size).toBeGreaterThan(1);
  });

  it('shows the identifier nothing in answers.json it could sort by', () => {
    const answers = JSON.parse(readFileSync(built.answersPath, 'utf8')) as {
      identifications: { width: number; height: number }[];
    };
    const sizes = new Set(answers.identifications.map((i) => `${String(i.width)}x${String(i.height)}`));
    expect(sizes.size).toBe(1);
    expect(answers.identifications.length).toBeGreaterThan(1);
  });

  it('still records what was DRAWN in the keymap, which the identifier never reads', () => {
    // The ladder is only meaningful if something remembers which rung a render
    // is. Padding away the natural extent everywhere would have made the size
    // ladder unscoreable, which is trading one silent loss for another.
    const natural = new Set(keymap.entries.map((e) => e.naturalWidth));
    expect(natural.size).toBeGreaterThan(1);
    for (const entry of keymap.entries) {
      expect(entry.naturalWidth).toBeLessThanOrEqual(entry.width);
    }
  });
});

describe('the anonymisation', () => {
  const built = handoff(REPO);
  const keymap = readKeymap(built.keymapPath);
  const names = readdirSync(built.handoffDir);
  const renders = names.filter((n) => n.endsWith('.png'));
  const references = JSON.parse(
    readFileSync(join(REPO, 'assets', 'refs', 'references.json'), 'utf8'),
  );

  it('builds', () => {
    expect(built.result.status, built.result.output).toBe(0);
    expect(renders.length).toBeGreaterThan(0);
  });

  it('gives every render an opaque name carrying no substring of its source filename', () => {
    // The named requirement. The regex below is the stronger statement - a name
    // of sixteen hex characters cannot contain anything - but the substring
    // assertion is the one that stays legible if the naming scheme ever changes.
    const sourceTokens = new Set<string>();
    for (const entry of keymap.entries) {
      for (const source of entry.sources as string[]) {
        for (const segment of source.split('/')) {
          sourceTokens.add(segment.toLowerCase());
          sourceTokens.add(segment.replace(/(@\dx)?\.[a-z0-9]+$/i, '').toLowerCase());
          for (const word of segment.split(/[-.@]/)) {
            if (word.length >= 3) sourceTokens.add(word.toLowerCase());
          }
        }
      }
    }
    expect(sourceTokens.size).toBeGreaterThan(5);

    for (const name of renders) {
      expect(name).toMatch(/^[0-9a-f]{16}\.png$/);
      for (const token of sourceTokens) {
        expect(name.toLowerCase(), `render name "${name}" contains "${token}"`).not.toContain(token);
      }
    }
  });

  it('leaves no leaking token in any file it hands over', () => {
    const tokens = leakTokens({ references });
    expect(tokens.length).toBeGreaterThan(20);
    expect(scanForLeaks({
      handoffDir: built.handoffDir,
      keymapPath: built.keymapPath,
      tokens,
    })).toEqual([]);
  });

  it('hands over nothing but renders, a briefing and an empty answer sheet', () => {
    expect(new Set(names.filter((n) => !n.endsWith('.png')))).toEqual(
      new Set(['READ-ME-FIRST.txt', 'answers.json']),
    );
    const answers = JSON.parse(readFileSync(built.answersPath, 'utf8'));
    // The template must not carry `subjectId` or `probe`: which two images are
    // the same subject at two sizes is an inference the identifier may make from
    // the pictures, never a fact handed to it in a JSON field.
    for (const item of answers.identifications) {
      expect(Object.keys(item).sort()).toEqual(
        ['answer', 'confidence', 'cues', 'height', 'moreCertain', 'render', 'width'].sort(),
      );
    }
  });

  it("keeps the manifest out of the identifier's working directory", () => {
    expect(names).not.toContain('keymap.json');
    expect(readdirSync(built.out).sort()).toEqual(['handoff', 'keymap.json']);
    // Stated as the harness states it, so that moving the keymap inside would
    // fail here and in the gate, not just here.
    expect(
      scanForLeaks({
        handoffDir: built.handoffDir,
        keymapPath: join(built.handoffDir, 'keymap.json'),
        tokens: [],
      }).join(' '),
    ).toContain("inside the identifier's working directory");
  });

  it('is unlinkable across runs: the same picture gets a different name AND a different size', () => {
    // The second real run was caught relinking by FILE SIZE. Content addressing
    // had unlinked the names and byte length quietly put the mapping back: the
    // same picture encodes to the same number of bytes every time, so a run whose
    // mapping was once revealed hands it to every later run. Both halves are
    // asserted here, because fixing only the name fixes only half.
    const a = readKeymap(handoff(REPO, ['--variants', '1'], 'run-a').keymapPath);
    const b = readKeymap(handoff(REPO, ['--variants', '1'], 'run-b').keymapPath);

    type Entry = { render: string; bytes: number; subjectId: string; probe: string };
    const key = (e: Entry): string => `${e.subjectId}::${e.probe}`;
    // Joined on subject and probe rather than on content hash: the padding means
    // the same picture no longer HAS the same hash across runs, which is the
    // property under test.
    const byKey = new Map<string, Entry>((a.entries as Entry[]).map((e) => [key(e), e]));

    let compared = 0;
    for (const entry of b.entries as Entry[]) {
      // Character figures draw different skin and hair each run, so they are not
      // the same picture and prove nothing here.
      if (entry.subjectId === 'officer') continue;
      const other = byKey.get(key(entry));
      if (!other) continue;
      compared += 1;
      expect(entry.render, 'same picture, same opaque name across two runs').not.toBe(other.render);
      expect(entry.bytes, 'same picture, same byte length across two runs').not.toBe(other.bytes);
    }
    expect(compared, 'nothing comparable across the two runs').toBeGreaterThan(2);
  });

  it('pads with zeros, so the thing that breaks the size channel cannot itself say anything', () => {
    // The padding is only defensible while it provably carries nothing. The
    // scanner checks it rather than trusting the code that writes it, so this
    // asserts through the scanner.
    const chunk = Buffer.from('paDx');
    const path = join(built.handoffDir, renders[0]!);
    const png = readFileSync(path);
    expect(png.includes(chunk), 'no length padding was written').toBe(true);

    // Flip one padding byte away from zero and the scan must fail.
    const at = png.indexOf(chunk) + 4;
    const tampered = Buffer.from(png);
    tampered[at] = 0x41;
    const dir = scratch('tampered-pad');
    writeFileSync(join(dir, renders[0]!), tampered);
    expect(
      scanForLeaks({
        handoffDir: dir,
        keymapPath: join(scratch('tampered-key'), 'keymap.json'),
        tokens: [],
      }).join(' '),
    ).toContain('length padding is not all zeros');
  });

  it('refuses to write beside an older hand-off, and clears it only when told to', () => {
    // The leak, exactly as it happened: `handoff` wrote ten renders into a
    // directory that still held the previous run's ten, six of them with
    // byte-identical sizes. Refusing is the default because a stale hand-off may
    // hold a blind pass nobody has committed yet.
    const root = fixture('stale');
    const out = scratch('out');
    const first = run(['handoff', '--root', root, '--out', out, '--seed', 'one']);
    expect(first.status, first.output).toBe(0);
    const before = readdirSync(join(out, 'handoff')).length;
    expect(before).toBeGreaterThan(0);

    const second = run(['handoff', '--root', root, '--out', out, '--seed', 'two']);
    expect(second.status, second.output).toBe(1);
    expect(second.stderr).toContain('already holds');
    expect(second.stderr).toContain('relink by file size');
    expect(readdirSync(join(out, 'handoff')).length, 'a refusal must not delete').toBe(before);

    const forced = run(['handoff', '--root', root, '--out', out, '--seed', 'two', '--force']);
    expect(forced.status, forced.output).toBe(0);
    expect(readdirSync(join(out, 'handoff')).length).toBe(before);
  });
});

/* ================================================================== *
 * 3. A leak must fail
 * ================================================================== */

describe('a leak must fail', () => {
  it('fails when the keymap is written into the hand-off directory', () => {
    const root = fixture('keymap-inside');
    const out = scratch('out');
    const result = run([
      'handoff',
      '--root',
      root,
      '--out',
      out,
      '--keymap',
      join(out, 'handoff', 'keymap.json'),
      '--seed',
      'test-seed',
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain("inside the identifier's working directory");
  });

  it('refuses a render source that draws text, which no byte scan could catch', () => {
    const root = fixture('drawn-text', {
      sources: {
        'src/svg/ottawa/landmark-parliament-hill.svg':
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">' +
          '<text x="10" y="40" font-size="20">Peace Tower</text></svg>',
      },
    });
    const result = run(['--root', root]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('may not draw text');
  });

  it('fails on a leaking token in a handed-over text file', () => {
    // No argv makes the harness write one of these, so it is planted. That the
    // CLI cannot produce it is the design; that the scan catches it if anything
    // ever does is what this asserts.
    const dir = scratch('planted-text');
    writeFileSync(join(dir, 'notes.txt'), 'render 3 is the Peace Tower on Parliament Hill');
    const failures = scanForLeaks({
      handoffDir: dir,
      keymapPath: join(scratch('planted-key'), 'keymap.json'),
      tokens: ['peace tower', 'parliament hill'],
    });
    expect(failures.join(' ')).toContain('leaking token "peace tower"');
  });

  it('fails on a render whose name is not opaque, and on one carrying PNG metadata', () => {
    const source = handoff(REPO, [...CHEAP]);
    const dir = scratch('planted-png');
    const real = readdirSync(source.handoffDir).find((n) => n.endsWith('.png'))!;

    // A name that says what it is.
    copyFileSync(join(source.handoffDir, real), join(dir, 'landmark-parliament-hill.png'));

    // The same picture with a tEXt chunk spliced in after the signature. PNG
    // metadata is a filename that survived rasterisation, and it is the one leak
    // that is invisible in both the picture and the directory listing.
    const png = readFileSync(join(source.handoffDir, real));
    const text = Buffer.from('Title\0Peace Tower', 'latin1');
    const chunk = Buffer.concat([
      Buffer.alloc(4),
      Buffer.from('tEXt'),
      text,
      Buffer.alloc(4),
    ]);
    chunk.writeUInt32BE(text.length, 0);
    writeFileSync(
      join(dir, '00112233445566aa.png'),
      Buffer.concat([png.subarray(0, 8), chunk, png.subarray(8)]),
    );

    const failures = scanForLeaks({
      handoffDir: dir,
      keymapPath: join(scratch('planted-key2'), 'keymap.json'),
      tokens: ['landmark-parliament-hill', 'parliament'],
    });
    const all = failures.join('\n');
    expect(all).toContain('not an opaque render name');
    expect(all).toContain("the render's own name contains");
    expect(all).toContain('carries PNG text chunk(s) tEXt');
  });
});

/* ================================================================== *
 * 3b. The operator-facing text is part of the leak surface
 * ================================================================== */

describe('what the harness PRINTS, and what its own entry points say', () => {
  /**
   * The three token classes that are actual answers, as opposed to ordinary
   * English that happens to appear in a contract sentence.
   *
   * Deliberately NOT the full `leakTokens` set here. That set includes single
   * words like "block", "character" and "frozen", which are words of some
   * `expectedBlindAnswer` and are also just English -- "the blind pass is
   * frozen" tells an identifier nothing. Asserting on them would make this test
   * fire on prose and get it deleted, which is how a leak scan stops working.
   * Subject ids, render source filenames and whole candidate answers are the
   * things that narrow a candidate set, and they are asserted exactly.
   */
  /**
   * Twenty, against 68 today. Not `> 0`, which would be decoration by ADR-0014's
   * standard: a one-subject contract yields about five tokens and would sail
   * past it. Not a number near 68 either, because retiring a subject is
   * legitimate and this floor must not fail on it.
   */
  const MINIMUM_ANSWER_TOKENS = 20;

  const answerTokens = (): string[] => {
    const references = JSON.parse(
      readFileSync(join(REPO, 'assets', 'refs', 'references.json'), 'utf8'),
    ) as { subjects: { id: string; renders: string[]; expectedBlindAnswer: string[] }[] };
    const tokens = new Set<string>();
    for (const subject of references.subjects) {
      tokens.add(subject.id.toLowerCase());
      for (const answer of subject.expectedBlindAnswer) tokens.add(answer.toLowerCase());
      for (const render of subject.renders) {
        tokens.add(render.toLowerCase());
        const base = render.split('/').pop() ?? '';
        tokens.add(base.toLowerCase());
        tokens.add(base.replace(/(@\dx)?\.[a-z0-9]+$/i, '').toLowerCase());
      }
    }
    tokens.delete('');
    const all = [...tokens];
    // ADR-0024, in the place where a vacuum would be most expensive: every leak
    // case in this describe reduces to `hits === []`, and `[].filter(...)` is
    // `[]` for any text at all. An empty or truncated contract would make all of
    // them pass while establishing nothing, and the blind pass this harness
    // exists for leaked precisely because subject ids reached the terminal.
    // Today's contract yields 68 tokens over 7 subjects; the floor is set to
    // catch a contract truncated to one subject - roughly 5 tokens - while
    // leaving room for a subject to be retired.
    expect(all.length, `the leak check has only ${String(all.length)} token(s) to look for`).toBeGreaterThan(
      MINIMUM_ANSWER_TOKENS,
    );
    return all;
  };

  const assertClean = (label: string, text: string): void => {
    const hits = answerTokens().filter((token) => text.toLowerCase().includes(token));
    expect(hits, `${label} names ${JSON.stringify(hits)}`).toEqual([]);
  };

  it('--quiet names no subject, so the harness is safe to run as the identifier', () => {
    // THE SECOND REAL RUN LEAKED HERE, not through the images. `art-handoff`
    // printed two of the three subject ids in its own progress output and
    // `--help` named a third in an option description, so the identifier had
    // read them before it saw a pixel and the run was not open-set. The images
    // were clean the whole time; the terminal was not.
    const out = scratch('out');
    const result = run([
      'handoff', '--quiet', '--root', REPO, ...CHEAP, '--out', out, '--seed', 'quiet-seed',
    ]);
    expect(result.status, result.output).toBe(0);
    assertClean('--quiet output', result.output);

    // And it is still worth reading: counts, totals and the run id survive.
    expect(result.stdout).toMatch(/hand-off run [0-9a-f]{16} - \d+ render\(s\) over \d+ subject\(s\)/);
    expect(result.stdout).toMatch(/\d+ subject\(s\) UNRENDERED by decision/);
    expect(result.stdout).toContain('safe to run as the identifier');
  });

  it('names a subject in the loud mode, which is what the loud mode is for', () => {
    // Not a leak: the loud mode is for whoever runs the hand-off FOR an
    // identifier. If this ever stops being true the two modes have collapsed
    // into one and `--quiet` has quietly become the only behaviour.
    const out = scratch('out');
    const result = run(['handoff', '--root', REPO, ...CHEAP, '--out', out, '--seed', 'loud-seed']);
    expect(result.status, result.output).toBe(0);
    const hits = answerTokens().filter((t) => result.output.toLowerCase().includes(t));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('--help names no subject', () => {
    const help = run(['--help']);
    expect(help.status).toBe(0);
    assertClean('--help', help.stdout);
  });

  it('the CLI source and the Makefile name no subject', () => {
    // The entry points an identifier plausibly opens: the file whose --help it
    // just read, and the target it was told to run. scripts/lib/art-handoff.mjs
    // is NOT asserted - its recipe table is keyed by subject id, which is code
    // and cannot be scrubbed; its prose names none, and an identifier has no
    // more business opening it than opening the contract.
    assertClean('scripts/verify-art.mjs', readFileSync(SCRIPT, 'utf8'));
    assertClean('Makefile', readFileSync(join(REPO, 'Makefile'), 'utf8'));
  });
});

/* ================================================================== *
 * 4. The anti-vacuum floor
 * ================================================================== */

describe('the anti-vacuum floor', () => {
  it('fails on a contract with zero subjects rather than reporting success', () => {
    const result = run(['--root', fixture('no-subjects', { subjects: [] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('zero subjects');
    expect(result.stderr).toContain('ANTI-VACUUM FLOOR');
    expect(result.stdout).not.toContain('OK');
  });

  it('fails when every subject is unrendered, because a hand-off of nothing scores nothing', () => {
    const result = run(['--root', fixture('all-unrendered', { subjects: [UNRENDERED] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('no subject in references.json is renderable');
  });

  it('fails a subject that omits `renders` entirely, and passes one that declares it empty', () => {
    // Absent is undecided; empty is a decision with a reason. The difference is
    // the whole of how "unrendered on purpose" is expressed.
    const undecided = { ...PEACE_TOWER, id: 'undecided', renders: undefined };
    const bad = run([
      '--root',
      fixture('no-renders-field', { subjects: [PEACE_TOWER, undecided] }),
    ]);
    expect(bad.status, bad.output).toBe(1);
    expect(bad.stderr).toContain('undecided: no `renders` array');

    const good = run(['--root', fixture('empty-renders', { subjects: [PEACE_TOWER, UNRENDERED] })]);
    expect(good.status, good.output).toBe(0);
    expect(good.stdout).toContain('UNRENDERED by decision');
  });

  it('fails a subject with renders that this harness has no builder for', () => {
    const unknown = { ...PEACE_TOWER, id: 'chateau-laurier' };
    const result = run([
      '--root',
      fixture('unknown-subject', {
        subjects: [PEACE_TOWER, unknown],
        sources: { 'src/svg/ottawa/landmark-parliament-hill.svg': svg(400, 300, '#c8a05a') },
      }),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('this harness has no builder for it');
  });

  it('fails a subject with no expectedBlindAnswer or no mustBeRight', () => {
    const hollow = { ...PEACE_TOWER, id: 'peace-tower', expectedBlindAnswer: [], mustBeRight: [] };
    const result = run(['--root', fixture('hollow', { subjects: [hollow] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('no `expectedBlindAnswer`');
    expect(result.stderr).toContain('no `mustBeRight`');
  });

  it('fails when one subject forbids what another requires', () => {
    // AV-02: peace-tower's neverAdd once forbade the Library roof that
    // parliament-hill-skyline requires, so a literal verifier would have failed a
    // render for drawing a required feature. Art scoped it; this keeps it scoped.
    const a = { ...PEACE_TOWER, neverAdd: ['the escarpment'] };
    const result = run(['--root', fixture('contradiction', { subjects: [a, UNRENDERED] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('may not forbid a requirement of another');
  });
});

/* ================================================================== *
 * 5. Scoring a verdict
 * ================================================================== */

describe('scoring a verdict', () => {
  const root = fixture('scoring');

  /** A hand-off, a set of answers, an audit, and the commitment in between. */
  const session = (
    answer: string,
    audit: unknown,
    { skipCommit = false, editAfterCommit = false } = {},
  ) => {
    const built = handoff(root);
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath);
    const answers = JSON.parse(readFileSync(built.answersPath, 'utf8'));
    for (const item of answers.identifications) item.answer = answer;
    writeFileSync(built.answersPath, JSON.stringify(answers, null, 2));

    let commit: Run | null = null;
    if (!skipCommit) {
      commit = run([
        'commit',
        '--keymap',
        built.keymapPath,
        '--answers',
        built.answersPath,
        '--root',
        root,
      ]);
    }
    if (editAfterCommit) {
      answers.identifications[0].answer = `${answer} (revised)`;
      writeFileSync(built.answersPath, JSON.stringify(answers, null, 2));
    }
    const auditPath = join(built.out, 'audit.json');
    writeFileSync(auditPath, JSON.stringify({ runId: keymap.runId, ...(audit as object) }, null, 2));
    return {
      built,
      keymap,
      commit,
      auditPath,
      score: () =>
        run([
          'score',
          '--root',
          root,
          '--keymap',
          built.keymapPath,
          '--answers',
          built.answersPath,
          '--audit',
          auditPath,
        ]),
    };
  };

  const CLEAN_AUDIT = {
    audits: [
      {
        subjectId: 'peace-tower',
        featuresPresent: ['green copper spire', 'clock face'],
        featuresAbsent: [],
        forbiddenPresent: [],
      },
    ],
  };

  it('passes a verdict that names the subject and audits every feature', () => {
    const s = session('The Peace Tower on Parliament Hill in Ottawa', CLEAN_AUDIT);
    const scored = s.score();
    expect(scored.status, scored.output).toBe(0);
    expect(scored.stdout).toMatch(/scored 1\/1 subject\(s\)/);
    expect(scored.stdout).toMatch(/2 mustBeRight feature\(s\) confirmed present/);
    expect(scored.stdout).toContain('PASS peace-tower');
    // Still said, on a pass, every time.
    expect(scored.stdout).toContain('does not establish that the verdict was made blind');
  });

  it('fails an unprompted answer that does not name the subject', () => {
    const s = session('a Big Ben-like Gothic clock tower', CLEAN_AUDIT);
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('the unprompted answer did not name the subject');
  });

  it('fails a verdict for a render that was never handed over', () => {
    const s = session('The Peace Tower', CLEAN_AUDIT);
    const answers = JSON.parse(readFileSync(s.built.answersPath, 'utf8'));
    answers.identifications.push({ render: 'deadbeefdeadbeef.png', answer: 'Parliament Hill' });
    writeFileSync(s.built.answersPath, JSON.stringify(answers, null, 2));
    // Re-commit is impossible on a frozen run, so score straight through: the
    // commitment catches the edit first, which is itself the right answer.
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('changed after they were committed');
  });

  it('fails a verdict for a render not in the manifest, on an uncommitted run', () => {
    const s = session('The Peace Tower', CLEAN_AUDIT, { skipCommit: true });
    const answers = JSON.parse(readFileSync(s.built.answersPath, 'utf8'));
    answers.identifications.push({ render: 'deadbeefdeadbeef.png', answer: 'Parliament Hill' });
    writeFileSync(s.built.answersPath, JSON.stringify(answers, null, 2));
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('which is not in the keymap');
    expect(scored.stderr).toContain('never handed over');
  });

  it('fails a feature audit submitted for a subject with no render', () => {
    // The named failure mode. `parliament-hill-skyline` is unrendered by
    // decision; auditing it is auditing an image nobody was shown, and recording
    // that as a pass is the quietest possible way to claim a verification that
    // never happened.
    const s = session('The Peace Tower on Parliament Hill', {
      audits: [
        ...CLEAN_AUDIT.audits,
        {
          subjectId: 'parliament-hill-skyline',
          featuresPresent: ['the escarpment'],
          featuresAbsent: [],
          forbiddenPresent: [],
        },
      ],
    });
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('a feature audit was submitted for a subject with no render');
    expect(scored.stderr).toContain('neither a pass nor a failure');
  });

  it('fails an audit that leaves a required feature unclassified', () => {
    const s = session('The Peace Tower', {
      audits: [
        {
          subjectId: 'peace-tower',
          featuresPresent: ['green copper spire'],
          featuresAbsent: [],
          forbiddenPresent: [],
        },
      ],
    });
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('neither present nor absent');
    expect(scored.stderr).toContain('unchecked, not fine');
  });

  it('fails a missing feature and a forbidden one', () => {
    const missing = session('The Peace Tower', {
      audits: [
        {
          subjectId: 'peace-tower',
          featuresPresent: ['green copper spire'],
          featuresAbsent: ['clock face'],
          forbiddenPresent: [],
        },
      ],
    }).score();
    expect(missing.status, missing.output).toBe(1);
    expect(missing.stderr).toContain('required feature "clock face" is missing');

    const forbidden = session('The Peace Tower', {
      audits: [
        {
          subjectId: 'peace-tower',
          featuresPresent: ['green copper spire', 'clock face'],
          featuresAbsent: [],
          forbiddenPresent: ['a dome'],
        },
      ],
    }).score();
    expect(forbidden.status, forbidden.output).toBe(1);
    expect(forbidden.stderr).toContain('forbidden feature present');
  });

  it('fails an empty answer and a missing one', () => {
    const s = session('', CLEAN_AUDIT, { skipCommit: true });
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('an unanswered render is not a pass');
  });

  it('fails when the audit never came back for a subject that was handed over', () => {
    const s = session('The Peace Tower', { audits: [] });
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('no feature audit came back');
  });

  it('fails an audit naming a feature the contract does not carry', () => {
    const s = session('The Peace Tower', {
      audits: [
        {
          subjectId: 'peace-tower',
          featuresPresent: ['green copper spire', 'clock face', 'a moat'],
          featuresAbsent: [],
          forbiddenPresent: [],
        },
      ],
    });
    const scored = s.score();
    expect(scored.status, scored.output).toBe(1);
    expect(scored.stderr).toContain('which is not a mustBeRight feature');
  });
});

/* ================================================================== *
 * 5b. A bundled record, and the anti-vacuum floor on the manifest itself
 * ================================================================== */

describe('a bundled verdict record', () => {
  const root = fixture('record');

  const record = (handoffRun: unknown): string => {
    const path = join(scratch('record'), 'art-verification.json');
    writeFileSync(path, JSON.stringify({ handoffRun }, null, 2));
    return path;
  };

  const KEYMAP = (entries: unknown[], unrendered: unknown[] = []) => ({
    id: 'truenorth-art-handoff-keymap',
    version: 1,
    runId: 'abcdef0123456789',
    entries,
    unrendered,
  });

  const ENTRY = {
    render: '0011223344556677.png',
    subjectId: 'peace-tower',
    probe: 'full',
    gating: true,
    sources: ['src/svg/ottawa/landmark-parliament-hill.svg'],
  };

  const ANSWERS = {
    runId: 'abcdef0123456789',
    identifications: [{ render: '0011223344556677.png', answer: 'The Peace Tower, Ottawa' }],
  };

  const AUDIT = {
    runId: 'abcdef0123456789',
    audits: [
      {
        subjectId: 'peace-tower',
        featuresPresent: ['green copper spire', 'clock face'],
        featuresAbsent: [],
        forbiddenPresent: [],
      },
    ],
  };

  it('scores, and says out loud that it attests to itself', () => {
    const result = run([
      'score',
      '--root',
      root,
      '--record',
      record({ keymap: KEYMAP([ENTRY]), answers: ANSWERS, audit: AUDIT }),
    ]);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('PASS peace-tower');
    // The commitment binds a live run. A record checked into the tree could
    // carry any hash it liked, and a reader who assumed otherwise would be
    // reading provenance into a consistency check.
    expect(result.stderr).toContain('a bundled record attests to itself');
  });

  /* ---- present, absent, and UNCHECKABLE: the third state ---- */

  // A contract where one entry can only be judged against a second figure.
  const COMPARABLE = {
    ...PEACE_TOWER,
    mustBeRight: [
      { feature: 'green copper spire' },
      { feature: 'clock face', requiresComparisonFigure: true },
    ],
  };
  const comparableRoot = fixture('comparable', { subjects: [COMPARABLE, UNRENDERED] });
  const COMPARISON_ENTRY = { ...ENTRY, render: '8899aabbccddeeff.png', probe: 'comparison', gating: false };

  it('will not score a feature present when the hand-off could not answer it', () => {
    // THE ACCIDENTALLY-RIGHT VERDICT. On the first run through this harness this
    // entry was recorded present, and it WAS present -- confirmed from the rig
    // contract rather than from the pictures. Art's rule, and it is the right
    // instinct: a wrong verdict recorded as absent is better than a right one
    // recorded by accident.
    const result = run([
      'score',
      '--root',
      comparableRoot,
      '--record',
      record({ keymap: KEYMAP([ENTRY]), answers: ANSWERS, audit: AUDIT }),
    ]);
    expect(result.stdout).toContain('STALE');
    expect(result.stdout).toContain('is recorded PRESENT, which it cannot have been');
    expect(result.stdout).toContain('1 uncheckable');
    // Stale, not wrong: the record predates the requirement, so it is neither a
    // pass nor a failure of the art.
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toMatch(/FAIL peace-tower/);
  });

  it('makes that a hard failure under --require-identification', () => {
    const result = run([
      'score',
      '--root',
      comparableRoot,
      '--require-identification',
      '--record',
      record({ keymap: KEYMAP([ENTRY]), answers: ANSWERS, audit: AUDIT }),
    ]);
    expect(result.status, result.output).toBe(1);
  });

  it('scores the feature normally once the comparison figure was handed over', () => {
    const result = run([
      'score',
      '--root',
      comparableRoot,
      '--record',
      record({
        keymap: KEYMAP([ENTRY, COMPARISON_ENTRY]),
        answers: {
          runId: 'abcdef0123456789',
          identifications: [
            ...ANSWERS.identifications,
            { render: COMPARISON_ENTRY.render, answer: 'two cartoon figures side by side' },
          ],
        },
        audit: AUDIT,
      }),
    ]);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('PASS peace-tower');
    expect(result.stdout).toContain('0 uncheckable');
    expect(result.stdout).not.toContain('STALE');
  });

  it('fails when the identifier had the figure and still could not judge the entry', () => {
    // Not stale: the hand-off contained what the entry needs. An entry nobody
    // could judge is not an entry that held, so this is a real finding.
    const result = run([
      'score',
      '--root',
      comparableRoot,
      '--record',
      record({
        keymap: KEYMAP([ENTRY, COMPARISON_ENTRY]),
        answers: {
          runId: 'abcdef0123456789',
          identifications: [
            ...ANSWERS.identifications,
            { render: COMPARISON_ENTRY.render, answer: 'two cartoon figures side by side' },
          ],
        },
        audit: {
          runId: 'abcdef0123456789',
          audits: [
            {
              subjectId: 'peace-tower',
              featuresPresent: ['green copper spire'],
              featuresAbsent: [],
              featuresUncheckable: ['clock face'],
              forbiddenPresent: [],
            },
          ],
        },
      }),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('reports "clock face" as UNCHECKABLE');
    expect(result.stderr).toContain('not an entry that held');
  });

  it('fails a manifest with zero renders rather than reporting a clean sweep', () => {
    // THE ANTI-VACUUM FLOOR, on the manifest itself rather than on the contract:
    // an empty keymap joins to an empty set of verdicts, finds no disagreement,
    // and prints a tick over nothing at all.
    const result = run([
      'score',
      '--root',
      root,
      '--record',
      record({ keymap: KEYMAP([]), answers: { runId: 'abcdef0123456789' }, audit: { runId: 'abcdef0123456789' } }),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('the keymap holds zero renders');
    expect(result.stderr).toContain('ANTI-VACUUM FLOOR');
  });

  it('fails a manifest of nothing but diagnostic probes, which decide nothing', () => {
    const result = run([
      'score',
      '--root',
      root,
      '--record',
      record({
        keymap: KEYMAP([{ ...ENTRY, probe: 'w140', gating: false }]),
        answers: ANSWERS,
        audit: AUDIT,
      }),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('no gating render');
  });

  it('fails a verdict record from a different run', () => {
    const result = run([
      'score',
      '--root',
      root,
      '--record',
      record({
        keymap: KEYMAP([ENTRY]),
        answers: { ...ANSWERS, runId: 'ffffffffffffffff' },
        audit: AUDIT,
      }),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('cannot score another');
  });
});

/* ================================================================== *
 * 6. The commitment
 * ================================================================== */

describe('the commitment, which is the one sliver of blindness this can prove', () => {
  const root = fixture('commitment');

  it('refuses to reveal before the blind pass is frozen', () => {
    const built = handoff(root);
    const revealed = run(['reveal', '--root', root, '--keymap', built.keymapPath]);
    expect(revealed.status, revealed.output).toBe(1);
    expect(revealed.stderr).toContain('Reveal before commit would make the blind pass unfalsifiable');
  });

  it('refuses to freeze a half-finished pass', () => {
    const built = handoff(root);
    const committed = run([
      'commit',
      '--root',
      root,
      '--keymap',
      built.keymapPath,
      '--answers',
      built.answersPath,
    ]);
    expect(committed.status, committed.output).toBe(1);
    expect(committed.stderr).toContain('have no answer');
  });

  it('reveals the mapping once the answers are frozen, and not before', () => {
    const built = handoff(root);
    const answers = JSON.parse(readFileSync(built.answersPath, 'utf8'));
    for (const item of answers.identifications) item.answer = 'The Peace Tower';
    writeFileSync(built.answersPath, JSON.stringify(answers, null, 2));

    const committed = run([
      'commit',
      '--root',
      root,
      '--keymap',
      built.keymapPath,
      '--answers',
      built.answersPath,
    ]);
    expect(committed.status, committed.output).toBe(0);
    expect(committed.stdout).toMatch(/sha256 [0-9a-f]{64}/);

    const revealed = run(['reveal', '--root', root, '--keymap', built.keymapPath]);
    expect(revealed.status, revealed.output).toBe(0);
    expect(revealed.stdout).toMatch(/[0-9a-f]{16}\.png {2}peace-tower {2}full/);
    expect(revealed.stdout).toContain('(no render)  parliament-hill-skyline');

    // And it cannot be frozen twice, which would let a second freeze bless a
    // revision made with the mapping open.
    const again = run([
      'commit',
      '--root',
      root,
      '--keymap',
      built.keymapPath,
      '--answers',
      built.answersPath,
    ]);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain('already committed');
  });
});

/* ================================================================== *
 * 7. Probes
 * ================================================================== */

describe('probes', () => {
  it('emits a size ladder, and marks every derived probe diagnostic rather than gating', () => {
    // The size ladder needs no semantic knowledge, so it is always available.
    // Derived probes must NEVER gate: the first pass found that a tower crop with
    // the flag masked failed identification outright, and that is information
    // about which cue carries the recognition, not an art defect.
    const built = handoff(REPO, ['--variants', '1']);
    const keymap = readKeymap(built.keymapPath);
    const derived = keymap.entries.filter((e: { probe: string }) => e.probe !== 'full');
    expect(derived.length).toBeGreaterThan(0);
    for (const entry of derived) expect(entry.gating).toBe(false);
    for (const entry of keymap.entries.filter((e: { probe: string }) => e.probe === 'full')) {
      expect(entry.gating).toBe(true);
    }
    expect(derived.some((e: { probe: string }) => e.probe.startsWith('w'))).toBe(true);

    const without = handoff(REPO, [...CHEAP]);
    const bare = readKeymap(without.keymapPath);
    // `--no-ladder` drops the SIZE probes. It must not drop the masked-feature
    // probes or the comparison figure: those answer contract entries, they are
    // not a convenience.
    expect(bare.entries.some((e: { probe: string }) => /^w\d+$/.test(e.probe))).toBe(false);
    expect(bare.entries.some((e: { probe: string }) => e.probe === 'full')).toBe(true);
  });

  it('hands over two figures side by side, so the proportions entry is answerable', () => {
    // That entry scored PRESENT on the first run through this harness, and it was
    // in fact present -- but the hand-off held one figure and the verifier had
    // confirmed it from rig-contract.json, "a code-level check wearing an art
    // verifier's clothes". A right answer arrived at by accident. The contract
    // now marks the entry `requiresComparisonFigure` and the recipe asks for two
    // figures on one canvas, built the same way and differing in everything else.
    const built = handoff(REPO, [...CHEAP]);
    const keymap = readKeymap(built.keymapPath);
    const pairs = keymap.entries.filter((e: { probe: string }) => e.probe === 'comparison');
    expect(pairs.length, 'no comparison figure in the hand-off').toBeGreaterThan(0);

    for (const entry of pairs) {
      // Non-gating: it is what the subject is compared against, not a render of
      // the subject. "Two cartoon people" must not fail anything.
      expect(entry.gating).toBe(false);
      const { subject, comparison } = entry.slots;
      // The DRAWN extent. `width`/`height` are the run's uniform canvas now -
      // every render shares one size so that pixel dimensions cannot partition
      // the set into subject-pure classes - so what this case is about, two
      // figures side by side on one canvas, is `natural*`.
      expect(entry.naturalWidth).toBe(480);
      expect(entry.naturalHeight).toBe(470);
      // Different in everything the rig can vary, so that identical proportions
      // are the one thing left to read. Two figures alike but for costume would
      // prove far less.
      expect(subject.costume).not.toBe(comparison.costume);
      expect(subject.skin).not.toBe(comparison.skin);
      expect(subject.hairShape).not.toBe(comparison.hairShape);
      expect(subject.hairColour).not.toBe(comparison.hairColour);
      expect(subject.expression).not.toBe(comparison.expression);
      expect(['left', 'right']).toContain(entry.slots.subjectSide);
    }

    // And which side the subject stands on moves, or an identifier learns "the
    // left one is the answer" across runs.
    //
    // TWO FIXED SEEDS, not a handful of unseeded runs. The first version sampled
    // six random runs and asserted both sides appeared, which is a one-in-thirty-two
    // chance of failing for no reason -- a flaky assertion inside the suite that
    // exists to stop a flaky gate. These two seeds are known to fall on opposite
    // sides, so the check is exact: if the side ever stops varying, both land the
    // same way and this fails every time rather than sometimes.
    const sideFor = (seed: string): string =>
      readKeymap(handoff(REPO, [...CHEAP], seed).keymapPath).entries.find(
        (e: { probe: string }) => e.probe === 'comparison',
      ).slots.subjectSide;
    expect([sideFor('side-a'), sideFor('side-b')].sort()).toEqual(['left', 'right']);
  });

  it('fails a subject that needs a comparison figure and has no builder for one', () => {
    const needy = {
      ...PEACE_TOWER,
      mustBeRight: [
        { feature: 'green copper spire' },
        { feature: 'clock face', requiresComparisonFigure: true },
      ],
    };
    const result = run(['--root', fixture('needs-comparison', { subjects: [needy, UNRENDERED] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('has no comparison builder for it');
    expect(result.stderr).toContain('a right answer by accident');
  });

  it('emits a masked-feature probe when a mustBeRight entry carries a maskRegion', () => {
    // Dormant on today's references.json: no entry has a `maskRegion`, and this
    // harness cannot add one because assets/** is the art agent's boundary. The
    // MECHANISM is proved here so that adding the field is a one-line change.
    const masked = {
      ...PEACE_TOWER,
      mustBeRight: [
        { feature: 'green copper spire', maskRegion: { x: 10, y: 10, w: 60, h: 60 } },
        { feature: 'clock face' },
      ],
    };
    const built = handoff(fixture('masked', { subjects: [masked, UNRENDERED] }));
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath);
    const probe = keymap.entries.find(
      (e: { probe: string }) => e.probe === 'mask:green copper spire',
    );
    expect(probe, JSON.stringify(keymap.entries.map((e: { probe: string }) => e.probe))).toBeTruthy();
    expect(probe.gating).toBe(false);
  });

  it('refuses a maskRegion that falls outside the render it claims to mask', () => {
    const bad = {
      ...PEACE_TOWER,
      mustBeRight: [
        { feature: 'green copper spire', maskRegion: { x: 10, y: 10, w: 9000, h: 60 } },
        { feature: 'clock face' },
      ],
    };
    const result = run(['--root', fixture('bad-mask', { subjects: [bad, UNRENDERED] })]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('falls outside');
  });
});

/* ================================================================== *
 * 8. --require-identification
 * ================================================================== */

describe('--require-identification', () => {
  it('turns a missing verdict record into a failure', () => {
    const result = run([
      '--root', REPO, ...CHEAP, '--require-identification', '--record', join(WORK, 'nope.json'),
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('NOT ESTABLISHED');
  });

  it('turns a stale record into a failure rather than scoring round it', () => {
    // A record whose hand-off could not answer a `requiresComparisonFigure`
    // entry is STALE, not wrong: the default gate reports it and exits 0, and
    // under this flag it is a failure. That is what makes the flag the one-line
    // change turning identification into a hard gate.
    //
    // CONSTRUCTED, not observed. This read the live docs/art-verification.json
    // and depended on it happening to contain a stale entry. That stopped being
    // true the moment the verifier re-made the run - and the failure mode is the
    // bad one: a record with no stale entry does not make this case fail loudly,
    // it makes it test nothing. The condition is built here instead, from the
    // real contract, so it holds whatever today's record says.
    const references = JSON.parse(
      readFileSync(join(REPO, 'assets', 'refs', 'references.json'), 'utf8'),
    ) as {
      subjects: {
        id: string;
        expectedBlindAnswer: string[];
        mustBeRight: { feature: string; requiresComparisonFigure?: boolean }[];
      }[];
    };
    const subject = references.subjects.find((s) =>
      (s.mustBeRight ?? []).some((m) => m.requiresComparisonFigure === true),
    );
    expect(subject, 'no subject requires a comparison figure, so STALE is unreachable').toBeDefined();
    const id = subject?.id ?? '';

    // One gating render, identified correctly, every mustBeRight feature
    // audited present - and NO comparison figure in the keymap, which is
    // exactly what a hand-off built before the requirement looked like.
    const record = {
      runIntegrity: { blindnessHeld: true },
      results: [],
      handoffRun: {
        keymap: {
          id: 'truenorth-art-handoff-keymap',
          version: 1,
          runId: 'stalefixture0001',
          entries: [
            {
              render: '0123456789abcdef.png',
              subjectId: id,
              probe: 'full',
              gating: true,
              width: 100,
              height: 100,
              naturalWidth: 100,
              naturalHeight: 100,
            },
          ],
          unrendered: [],
        },
        answers: {
          runId: 'stalefixture0001',
          identifications: [
            { render: '0123456789abcdef.png', answer: subject?.expectedBlindAnswer[0] ?? '' },
          ],
        },
        audit: {
          runId: 'stalefixture0001',
          audits: [
            {
              subjectId: id,
              featuresPresent: (subject?.mustBeRight ?? []).map((m) => m.feature),
              featuresAbsent: [],
              featuresUncheckable: [],
              forbiddenPresent: [],
            },
          ],
        },
      },
    };
    const path = join(scratch('stale-record'), 'art-verification.json');
    writeFileSync(path, JSON.stringify(record, null, 2));

    const result = run(['--root', REPO, ...CHEAP, '--require-identification', '--record', path]);
    expect(result.stdout, result.output).toContain('STALE');
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('NOT ESTABLISHED');
  });

  it('turns a pre-harness record into a failure rather than scoring it', () => {
    const path = join(scratch('pre-harness'), 'art-verification.json');
    writeFileSync(
      path,
      JSON.stringify({ runIntegrity: { blindnessHeld: false }, results: [] }, null, 2),
    );
    const result = run(['--root', REPO, ...CHEAP, '--require-identification', '--record', path]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('predates this harness');
    expect(result.stderr).toContain('blindnessHeld: false');
  });
});
