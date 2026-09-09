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
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
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
const SCORE_LIB = new URL('../../../scripts/lib/art-score.mjs', import.meta.url).href;

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

/** The digest of a source AS IT STANDS in a fixture, computed the way the harness does. */
const digestOf = (root: string, rel: string): string =>
  createHash('sha256').update(readFileSync(join(root, 'assets', rel))).digest('hex');

/** A hand-written keymap entry, told what its sources hashed to when it was written. */
interface BareEntry {
  readonly render: string;
  readonly subjectId: string;
  readonly probe: string;
  readonly gating: boolean;
  readonly sources: readonly string[];
}
const withArtDigest = (root: string, entry: BareEntry) => ({
  ...entry,
  sourceSha256: Object.fromEntries(entry.sources.map((rel) => [rel, digestOf(root, rel)])),
});

/**
 * `{ sources, sourceSha256 }` for a subject's art AS IT STANDS in a tree,
 * resolving the `@1x` pin the way the harness does.
 *
 * Hand-written records that are about something else -- the answer matcher, the
 * comparison-figure staleness -- go through this so that the art half of the
 * record is honest and stays out of their way. A case that meant to test the
 * matcher and instead tests the staleness check proves neither.
 */
const artOf = (root: string, rels: readonly string[]) => {
  const sourceSha256: Record<string, string> = {};
  for (const rel of rels) {
    const literal = join(root, 'assets', rel);
    const path = existsSync(literal)
      ? literal
      : join(root, 'assets', rel.replace(/(\.[a-z0-9]+)$/i, '@1x$1'));
    sourceSha256[rel] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return { sources: [...rels], sourceSha256 };
};

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

/** A keymap entry, as the harness writes it. The identifier never reads this. */
interface KeymapEntry {
  readonly render: string;
  readonly subjectId: string;
  readonly probe: string;
  readonly gating: boolean;
  readonly sources: readonly string[];
  readonly slots: Record<string, unknown>;
}

interface RigPart {
  name: string;
  z: number;
  frame: string;
}
interface RigFrame {
  source: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Rig {
  parts: RigPart[];
  atlas: { framePrefix: string };
  frames: Record<string, RigFrame>;
  slots: Record<string, { options?: string[]; fallback?: string | null }>;
  expressions: { names: string[]; fallback: string };
  artboards: { characterId: string; skins: Record<string, string>; playerSelectableSlots: string[] }[];
}

/**
 * The rig as it stands, read at run time for the same reason the subjects are:
 * the part list, the z order and the option sets all move, and a case that
 * listed today's is a case that stops describing the rig without failing.
 */
const rigOf = (root: string): Rig =>
  JSON.parse(readFileSync(join(root, 'assets', 'style', 'rig-contract.json'), 'utf8')) as Rig;

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

  it('hands over EVERY subject the contract says has renders, and all of its sources', () => {
    // THE CASE THE HALIFAX AND TORONTO ART LANDING WOULD HAVE NEEDED, and the
    // one shape of silent pass this harness has left. `checkContract` refuses a
    // subject it has no builder for, loudly, and that refusal is asserted below
    // over a fixture. What it cannot refuse is a builder that is present and
    // WRONG in the quiet direction: wire `singleSource()` onto a two-tile
    // composite and the gate builds, the anonymisation holds, the summary reads
    // exactly the same, and the identifier is handed half a subject.
    //
    // So both halves are asserted, derived from the contract and never listed:
    //   - every subject with a non-empty `renders` reaches the identifier with
    //     at least one GATING render. Diagnostic probes decide nothing.
    //   - every file that subject declares in `renders` was actually composited
    //     into it.
    //
    // The second half is skipped for a subject built from SLOT CHOICES, and
    // that exception is detected the way the shipped summary detects it
    // (`slots.skin`) rather than by naming a subject: the character subject
    // lists one costume's worth of parts and the builder deliberately draws a
    // different skin and hair every run, so the declared set is a sample of what
    // it may use and not a checklist.
    const built = handoff(REPO, [...CHEAP], null);
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath) as {
      entries: { subjectId: string; gating: boolean; sources: string[]; slots: Record<string, unknown> }[];
    };

    const rendered = subjectsOf(REPO).filter((s) => s.renders.length > 0);
    expect(rendered.length, 'no subject has renders; this case has nothing to check').toBeGreaterThan(0);

    for (const subject of rendered) {
      const mine = keymap.entries.filter((e) => e.subjectId === subject.id);
      const gating = mine.filter((e) => e.gating);
      expect(
        gating.length,
        `${subject.id} declares ${subject.renders.length} render source(s) and no gating render ` +
          `was handed over for it`,
      ).toBeGreaterThan(0);

      if (mine.some((e) => e.slots?.skin !== undefined)) continue;
      const used = new Set(mine.flatMap((e) => e.sources));
      for (const rel of subject.renders) {
        expect(
          used.has(rel),
          `${subject.id} declares "${rel}" in renders[] and no render handed over used it. ` +
            `A builder that drops a source shows the identifier a different picture from ` +
            `the one the contract is about.`,
        ).toBe(true);
      }
    }
  });

  it('draws every part of a character artboard that only its costume decides', () => {
    // THE HALF OF THE CASE ABOVE THAT A CHARACTER SUBJECT SKIPS, and the gap
    // the two new artboards would have fallen into. The source checklist above
    // is skipped for a subject built from SLOT CHOICES, correctly: its
    // `renders[]` is a sample of one appearance, not a manifest. That exemption
    // covers the whole figure, though, so a character builder wired to the
    // WRONG COSTUME - or one that drops a part - renders a complete, plausible
    // figure of somebody else, hands it over, and prints the same summary. It
    // is the quiet direction again, one layer in.
    //
    // What is checkable is the part of a figure that the slots do not decide:
    // a part whose frame template reads NO slot but `{costume}` resolves to
    // exactly one frame per artboard, so if that frame exists in the rig its
    // source MUST have been composited. Derived from rig-contract.json and from
    // the costume the keymap records, so it covers an artboard nobody has
    // written yet - which is exactly what it failed to do last time.
    const rig = rigOf(REPO);
    const built = handoff(REPO, [...CHEAP], null);
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath) as { entries: KeymapEntry[] };

    const figures = keymap.entries.filter((e) => e.gating && e.slots.costume !== undefined);
    expect(figures.length, 'no character figure was handed over').toBeGreaterThan(0);

    const costumeOnly = rig.parts.filter((part) =>
      [...part.frame.matchAll(/\{(\w+)\}/g)].every((match) => match[1] === 'costume'),
    );
    expect(
      costumeOnly.length,
      'no part of the rig is decided by the costume alone; this case checks nothing',
    ).toBeGreaterThan(5);

    for (const figure of figures) {
      const costume = String(figure.slots.costume);
      const used = new Set(figure.sources);
      for (const part of costumeOnly) {
        const frame = rig.frames[`${rig.atlas.framePrefix}${part.frame.replace(/\{costume\}/g, costume)}`];
        // `atlas.rule`: a template that is not in `frames` draws nothing, which
        // is how one artboard gets no tail and another gets no hat. Not a defect.
        if (!frame) continue;
        expect(
          used.has(frame.source),
          `a figure of costume "${costume}" left out "${part.name}", which its costume ` +
            `alone decides: the rig gives it "${frame.source}" and no render used the file`,
        ).toBe(true);
      }
    }
  });

  it('renders every character artboard more than one way, in a run and between runs', () => {
    // Every character recipe in references.json says a version of "the skin and
    // hair choice must be VARIED between runs - a subject that only ever
    // renders with one tone is a subject nobody checked the others of".
    //
    // DERIVED, over every artboard the hand-off carries, and not written for
    // one of them. This case named a single subject until the day two more
    // arrived, at which point it still passed while asserting nothing about
    // either - and `--variants` was itself keyed on that one subject id, so
    // the new artboards would have been rendered once each with the clause
    // quietly unmet. That is ADR-0019 in one case: the property belongs to a
    // character artboard, not to the first one somebody wrote a case about.
    //
    // The slots a figure did not vary ON PURPOSE are excluded by reading
    // `inertSlots` off the keymap, which is the same field the shipped summary
    // reads. One artboard's skin and hair are drawn and then covered entirely;
    // demanding that they vary would be demanding coverage of something nobody
    // can see, and "fixing" it would put a fur tone in the list of skin tones
    // the character creator offers.
    const tuple = (slots: KeymapEntry['slots']): string => {
      const inert = new Set((slots.inertSlots as string[] | undefined) ?? []);
      return Object.entries(slots)
        .filter(([key]) => !['costume', 'variantIndex', 'inertSlots'].includes(key))
        .filter(([key]) => !inert.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' ');
    };

    // UNSEEDED, which is how a real run goes: `--seed` exists so the rest of
    // this file is deterministic and is the one thing a real run must not use.
    //
    // SIX RUNS, and the number is the narrowest artboard's arithmetic rather
    // than a feeling. One artboard varies a single four-option slot, and its
    // two variants are drawn without replacement, so a run shows one of six
    // pairs; six runs all landing on the same pair is 1 in 6^5, about one in
    // eight thousand. Four runs would have been one in two hundred, which is a
    // case that fails a correct build a few times a year - and this file's own
    // argument is that a flaky gate gets disabled.
    const RUNS = 6;
    const seen = new Map<string, Set<string>>();
    for (let index = 0; index < RUNS; index += 1) {
      const keymap = readKeymap(
        handoff(REPO, ['--variants', '2', '--no-ladder'], null).keymapPath,
      ) as { entries: KeymapEntry[] };
      const figures = keymap.entries.filter((e) => e.gating && e.slots.costume !== undefined);
      expect(figures.length).toBeGreaterThan(0);

      const perSubject = new Map<string, string[]>();
      for (const figure of figures) {
        perSubject.set(figure.subjectId, [...(perSubject.get(figure.subjectId) ?? []), tuple(figure.slots)]);
      }
      for (const [subjectId, tuples] of perSubject) {
        // WITHIN one run, and this half needs no luck at all: `--variants 2`
        // exists to render a subject twice with different choices, and two
        // independent draws collide often enough to matter (one time in four
        // for the narrowest artboard). They are drawn without replacement, so
        // two figures of one subject in one run are different by construction.
        expect(
          new Set(tuples).size,
          `${subjectId} rendered ${String(tuples.length)} figure(s) in one run and ` +
            `${String(new Set(tuples).size)} of them differ: ${JSON.stringify(tuples)}`,
        ).toBe(tuples.length);
        for (const value of tuples) {
          seen.set(subjectId, (seen.get(subjectId) ?? new Set()).add(value));
        }
      }
    }

    expect(seen.size, 'no character artboard was handed over').toBeGreaterThan(0);
    for (const [subjectId, values] of seen) {
      // BETWEEN runs: more distinct appearances than any one run produced.
      expect(
        values.size,
        `${subjectId} produced ${String(values.size)} distinct appearance(s) over ` +
          `${String(RUNS)} runs of two figures each`,
      ).toBeGreaterThan(2);
    }
  });

  it('hands over the bare-headed figure of every artboard whose covering a person picks', () => {
    // references.json: "at least one run must set headCovering=none, because the
    // toque carries a large share of the identification and a costume that only
    // reads with a hat on has not been checked."
    //
    // ASSERTED ON THE SMALLEST RUN THERE IS - one figure per subject - because
    // that is where a rule phrased as "at least one" quietly becomes "on
    // average". The first implementation of this pinned the bare head to
    // variant 0 and let the shuffle place the other option anywhere, so a
    // `--variants 1` run always covered the clause and a `--variants 2` run
    // covered it twice and rendered the covering zero times. Both halves are
    // asserted: the bare head is in every run, and the covering is reachable.
    //
    // WHICH ARTBOARDS, from rig-contract.json rather than from a list here: the
    // ones whose `playerSelectableSlots` name the covering as a slot a person
    // chooses. An artboard that draws its own hat, or that may not wear one at
    // all, is not making this promise and must not be held to it.
    const rig = rigOf(REPO);
    const slot = 'headCovering';
    const artboards = rig.artboards.filter((board) => board.playerSelectableSlots.includes(slot));
    expect(artboards.length, `no artboard offers "${slot}"`).toBeGreaterThan(0);
    const bare = rig.slots[slot]?.fallback;
    expect(bare).toBe('none');

    const figuresOf = (extra: readonly string[]): KeymapEntry[] =>
      (readKeymap(handoff(REPO, extra, null).keymapPath) as { entries: KeymapEntry[] }).entries
        .filter((e) => e.gating && e.slots.costume !== undefined);

    const smallest = figuresOf([...CHEAP]);
    for (const board of artboards) {
      const costume = board.skins.costume;
      const mine = smallest.filter((figure) => String(figure.slots.costume) === costume);
      expect(mine.length, `no figure of costume "${costume}" in the smallest run`).toBeGreaterThan(0);
      expect(
        mine.some((figure) => String(figure.slots[slot]) === bare),
        `every figure of costume "${costume}" in a one-figure run wears a covering; the ` +
          `costume has not been checked without one`,
      ).toBe(true);
    }

    const twice = figuresOf(['--variants', '2', '--no-ladder']);
    for (const board of artboards) {
      const worn = new Set(
        twice.filter((f) => String(f.slots.costume) === board.skins.costume).map((f) => f.slots[slot]),
      );
      expect(
        worn.size,
        `costume "${board.skins.costume}" rendered ${String(worn.size)} head covering(s) over ` +
          `two figures; a slot pinned to one value is not a slot`,
      ).toBeGreaterThan(1);
    }
  });

  it('prints a slot that CANNOT apply differently from one that failed, and counts it nowhere', () => {
    // THE DISTINCTION THIS EXISTS FOR. One artboard in the contract is not a
    // person: its fills are hide and felt rather than a `skin-1`..`skin-6`
    // ramp, so docs/content-review.md 6.2's "every skin fill is a skin ramp
    // entry" row genuinely cannot apply to it, and art recorded that as an
    // exemption for one non-human artboard so a verifier scores it NOT
    // APPLICABLE rather than FAILED.
    //
    // Two things have to be true for that to mean anything, and neither is
    // "the harness stayed quiet":
    //   - it PRINTS, under its own word, because silence reads exactly like a
    //     rule nobody got to; and
    //   - it COUNTS NOWHERE. The slot still takes the rig's fallback and is
    //     still drawn, so a summary that counted it would report one more skin
    //     tone exercised than the run exercised, on an artboard where the tone
    //     is painted over. That is a green number about something nobody can
    //     see, which is the shape of every failure this harness refuses.
    const built = handoff(REPO, ['--variants', '2', '--no-ladder'], null);
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath) as { entries: KeymapEntry[] };

    const figures = keymap.entries.filter((e) => e.gating && e.slots.costume !== undefined);
    const inertOf = (entry: KeymapEntry): string[] => (entry.slots.inertSlots as string[]) ?? [];
    const exempt = [...new Set(figures.filter((f) => inertOf(f).length > 0).map((f) => f.subjectId))];
    expect(
      exempt.length,
      'no artboard declares a slot it cannot vary; this case checks nothing',
    ).toBeGreaterThan(0);

    expect(built.result.stdout).toContain('NOT APPLICABLE');
    for (const subjectId of exempt) {
      expect(built.result.stdout).toContain(`N/A ${subjectId} - `);
      // Not a failure, and not merely absent from the failure list: the words
      // must differ where a reader looks.
      expect(built.result.stdout).not.toContain(`FAIL ${subjectId}`);
      expect(built.result.output).not.toMatch(new RegExp(`${subjectId}[^\\n]*(FAILED|is missing)`));
    }

    // The counted total is over the figures the check APPLIES to, and it is
    // read back from the line the operator sees rather than from the keymap
    // twice.
    const applicable = figures.filter((figure) => !inertOf(figure).includes('skin'));
    const tones = new Set(applicable.map((figure) => String(figure.slots.skin)));
    const printed = /(\d+) skin tone\(s\)/.exec(built.result.stdout);
    expect(printed, built.result.stdout).toBeTruthy();
    expect(
      Number(printed![1]),
      `the summary counted ${printed![1]} skin tone(s); ${String(tones.size)} figure tone(s) ` +
        `were chosen on artboards where a skin ramp applies`,
    ).toBe(tones.size);
    // And the fallback the exempt artboard carries is present in the keymap all
    // the same -- it is DRAWN, not omitted, which is why a composite without it
    // would not be what ships.
    for (const figure of figures.filter((f) => inertOf(f).includes('skin'))) {
      expect(figure.slots.skin).toBe(rigOf(REPO).slots.skin?.fallback);
    }
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
    ) as { subjects: { id: string; renders: string[]; mustBeRight: { feature: string }[] }[] };
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
              ...artOf(REPO, subject?.renders ?? []),
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
    /**
     * A TOKEN THAT IS ITSELF HEX IS EXCLUDED, AND THAT IS NOT A HOLE IN THIS.
     *
     * Found by this case failing on a clean run: one render was named
     * `40f18b1976face89.png`, and `face` is a word of `face-neutral.svg`.
     * Nothing leaked. Sixteen hex characters spell `face`, `cafe`, `beef` and
     * `decade` by arithmetic, about once in every 2400 names for a four-letter
     * one, and the hand-off now carries about twenty. That is a case that fails
     * a correct run a few times a year - and this file's own argument is that a
     * FLAKY GATE GETS DISABLED AND A DISABLED GATE LEAKS SILENTLY.
     *
     * What replaces it for those tokens is STRONGER, not weaker: the regex on
     * the line below says the name is sixteen hex characters and nothing else,
     * so it cannot carry semantic content at all. The substring assertion is
     * the legible statement of intent and it keeps every token the regex does
     * not already settle. `scanForLeaks` makes the same split, for the same
     * reason, and only for names it has just proved opaque.
     */
    const hexSpellable = [...sourceTokens].filter((token) => /^[0-9a-f]+$/.test(token));
    const meaningful = [...sourceTokens].filter((token) => !/^[0-9a-f]+$/.test(token));
    expect(
      meaningful.length,
      `only ${String(meaningful.length)} token(s) are not hex-spellable`,
    ).toBeGreaterThan(5);
    // Named rather than merely skipped, so that a contract which somehow made
    // MOST of its tokens hex-spellable would be visible here rather than
    // quietly emptying the check.
    expect(hexSpellable.length).toBeLessThan(meaningful.length);

    for (const name of renders) {
      expect(name).toMatch(/^[0-9a-f]{16}\.png$/);
      for (const token of meaningful) {
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

  it('says so when the contract has a subject this record never covered', () => {
    // THE SAME VACUUM AS A MISSING BUILDER, ONE LAYER UP. `checkContract`
    // refuses a subject it cannot render, loudly, because "skipping an unknown
    // subject would verify four fifths of the set and print the same OK". A
    // RECORD has the identical hole and it is harder to see: a verdict is
    // scored against its own manifest, so a record made before two subjects
    // existed scores every subject it holds, cleanly, and the summary reads as
    // a full pass with a smaller denominator. Nothing in it says the contract
    // has since grown.
    //
    // Advisory, not fatal, and the line is the one this scorer already draws: a
    // missing record makes no claim. Under `--require-identification`, where a
    // claim is required, it is a failure.
    const grown = fixture('grew-a-subject');
    const built = handoff(grown);
    expect(built.result.status, built.result.output).toBe(0);
    const keymap = readKeymap(built.keymapPath);
    const answers = JSON.parse(readFileSync(built.answersPath, 'utf8'));
    for (const item of answers.identifications) item.answer = 'The Peace Tower, Parliament Hill';
    writeFileSync(built.answersPath, JSON.stringify(answers, null, 2));
    const auditPath = join(built.out, 'audit.json');
    writeFileSync(
      auditPath,
      JSON.stringify({ runId: keymap.runId, ...CLEAN_AUDIT }, null, 2),
    );
    const score = (extra: readonly string[] = []): Run =>
      run([
        'score', '--root', grown,
        '--keymap', built.keymapPath,
        '--answers', built.answersPath,
        '--audit', auditPath,
        ...extra,
      ]);

    // The control: this record answers everything the contract renders today.
    const before = score();
    expect(before.status, before.output).toBe(0);
    expect(before.stdout).toContain('0 in the contract and not in this record');

    // Art lands a subject. Nothing about the record changes.
    const references = JSON.parse(
      readFileSync(join(grown, 'assets', 'refs', 'references.json'), 'utf8'),
    ) as { subjects: unknown[] };
    references.subjects = [...references.subjects, { ...PEACE_TOWER, id: 'cn-tower' }];
    writeFileSync(
      join(grown, 'assets', 'refs', 'references.json'),
      JSON.stringify(references, null, 2),
    );

    const after = score();
    expect(after.stdout).toContain('STALE - cn-tower');
    expect(after.stdout).toContain('covers it with NONE');
    expect(after.stdout).toContain('1 in the contract and not in this record');
    // Not a failure on its own: nobody has looked, and the record does not
    // pretend otherwise.
    expect(after.status, after.output).toBe(0);
    expect(after.stdout).not.toContain('FAIL cn-tower');

    const strict = score(['--require-identification']);
    expect(strict.status, strict.output).toBe(1);
    expect(strict.stderr).toContain('NOT ESTABLISHED');
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

  /**
   * A hand-written keymap entry has to carry `sourceSha256` for the same reason
   * a real one does: without it the scorer cannot tell that the verdict is about
   * the art in this fixture, and refuses to score it. That refusal is the
   * subject of section 5c; here it would only be noise, so these entries are
   * honest about what they were drawn from.
   */
  const ENTRY = withArtDigest(root, {
    render: '0011223344556677.png',
    subjectId: 'peace-tower',
    probe: 'full',
    gating: true,
    sources: ['src/svg/ottawa/landmark-parliament-hill.svg'],
  });

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
  // ENTRY's digests are taken from `root`, and reused here. Asserted rather than
  // assumed: the day someone gives `comparable` its own art, this line says so
  // instead of the cases below failing as STALE for a reason that is not theirs.
  expect(digestOf(comparableRoot, 'src/svg/ottawa/landmark-parliament-hill.svg')).toBe(
    digestOf(root, 'src/svg/ottawa/landmark-parliament-hill.svg'),
  );
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
 * 5c. A verdict is about a picture, and the picture moves
 * ================================================================== */

/**
 * THE FAILURE MODE: A RECORD THAT PASSED STAYS PASSING AFTER THE ART IT
 * DESCRIBES IS REDRAWN.
 *
 * Nothing in a verdict record changes when the SVG under it does, so the green
 * tick survives the picture it was about and is indistinguishable in the output
 * from a green tick about the art on disk. That is the same shape as every
 * other thing this harness refuses -- SILENT GREENNESS -- and it was the last
 * one left: the scorer joined a verdict to a keymap and never asked whether
 * either still described the tree.
 *
 * THE CASES BELOW MOSTLY COME IN PAIRS, and the pairing is the point. A check
 * that only ever sees changed art proves it can say STALE; it does not prove it
 * says STALE *because* the art changed. So each redraw case scores the SAME
 * RECORD, byte for byte, before and after -- pass, then refusal.
 *
 * TWO THINGS THAT WOULD MAKE THIS CHANGE WORSE THAN NOTHING, both asserted:
 *
 *   1. STALE READING AS A PASS. It exits 1, with or without
 *      `--require-identification`, and its row in the table is neither PASS nor
 *      FAIL.
 *   2. STALE LAUNDERING A FINDING. The one recorded verdict this repository has
 *      FAILED on a real art defect, and its art has since been redrawn. If
 *      "redrawn" quietly replaced "failed", the fix for the first silent pass
 *      would have introduced a second, quieter one. The findings travel with the
 *      stale entry and the report says which of the two it is looking at.
 */
describe('a verdict is about a picture, and the picture moves', () => {
  const SOURCE = 'src/svg/ottawa/landmark-parliament-hill.svg';
  const SECOND = 'src/svg/ottawa/layer-60-ice.svg';
  const RUN_ID = 'abcdef0123456789';

  /**
   * A SECOND SUBJECT with its own source, so that a case can leave part of the
   * run live. Without one, every stale case here also empties the live set and
   * trips the anti-vacuum floor -- and a floor firing would MASK a regression in
   * whether staleness itself is fatal. Found by mutation: making `staleArt`
   * non-fatal broke no case in this section until this subject existed.
   */
  const SECOND_SUBJECT = {
    id: 'rideau-canal-skateway',
    subject: 'A skating rink on a frozen canal',
    renders: [SECOND],
    renderRecipe: 'Rasterise the file on its own at 1x.',
    expectedBlindAnswer: ['a skating rink on a frozen canal'],
    mustBeRight: [{ feature: 'scored skate marks in the ice' }],
    neverAdd: [],
  };

  /** A tree of its OWN per case: these cases redraw the art in it. */
  const tree = (name: string): string =>
    fixture(name, {
      subjects: [PEACE_TOWER, SECOND_SUBJECT, UNRENDERED],
      sources: { [SOURCE]: svg(400, 300, '#c8a05a'), [SECOND]: svg(300, 120, '#8fb8d8') },
    });

  /** The same edit an art agent makes: same file, different picture. */
  const redraw = (root: string, rel: string): void =>
    writeFileSync(join(root, 'assets', rel), svg(400, 300, '#2a6ebb'));

  const keymap = (entries: unknown[]) => ({
    id: 'truenorth-art-handoff-keymap',
    version: 1,
    runId: RUN_ID,
    entries,
    unrendered: [],
  });

  const GATING = { render: '0011223344556677.png', subjectId: 'peace-tower', probe: 'full', gating: true };
  const DIAGNOSTIC = { render: 'aabbccddeeff0011.png', subjectId: 'peace-tower', probe: 'w140', gating: false };

  const gatingEntry = (root: string) => withArtDigest(root, { ...GATING, sources: [SOURCE] });
  const diagnosticEntry = (root: string) => withArtDigest(root, { ...DIAGNOSTIC, sources: [SECOND] });

  const answersFor = (renders: readonly string[]) => ({
    runId: RUN_ID,
    identifications: renders.map((render) => ({
      render,
      answer: 'The Peace Tower on Parliament Hill, Ottawa',
    })),
  });

  const CLEAN_AUDIT = {
    runId: RUN_ID,
    audits: [
      {
        subjectId: 'peace-tower',
        featuresPresent: ['green copper spire', 'clock face'],
        featuresAbsent: [],
        forbiddenPresent: [],
      },
    ],
  };

  /**
   * A verdict that FOUND SOMETHING. Modelled on the one this repository actually
   * has: a missing `mustBeRight` feature and a `neverAdd` violation, recorded by
   * the verifier against art that has since been redrawn.
   */
  const DEFECT_AUDIT = {
    runId: RUN_ID,
    audits: [
      {
        subjectId: 'peace-tower',
        featuresPresent: ['green copper spire'],
        featuresAbsent: ['clock face'],
        forbiddenPresent: ['a dome'],
      },
    ],
  };

  const score = (root: string, handoffRun: unknown, extra: readonly string[] = []): Run => {
    const path = join(scratch('moves'), 'art-verification.json');
    writeFileSync(path, JSON.stringify({ handoffRun }, null, 2));
    return run(['score', '--root', root, '--record', path, ...extra]);
  };

  /* ---- the pair that names the whole problem ---- */

  it('scores a record whose art is still the art it was made from', () => {
    const root = tree('unchanged');
    const result = score(root, {
      keymap: keymap([gatingEntry(root)]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('PASS peace-tower');
    expect(result.output).not.toContain('STALE ART');
  });

  it('refuses THE SAME RECORD once the art has been redrawn under it', () => {
    const root = tree('redrawn');
    const handoffRun = {
      keymap: keymap([gatingEntry(root)]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    };

    // Identical bytes, twice, either side of one edit to one SVG. Nothing about
    // the record is different; everything about the verdict's standing is.
    expect(score(root, handoffRun).status).toBe(0);
    redraw(root, SOURCE);
    const after = score(root, handoffRun);

    expect(after.status, after.output).toBe(1);
    expect(after.stderr).toContain('STALE ART');
    expect(after.stderr).toContain('REDRAWN since the verdict was recorded');
    expect(after.stderr).toContain(SOURCE);
    // Neither a pass nor a judgement: a THIRD word, because `pass: false` alone
    // would file "nobody looked" under "we looked and it was wrong".
    expect(after.stdout).toContain('STALE peace-tower');
    expect(after.stdout).not.toContain('PASS peace-tower');
    expect(after.stdout).not.toContain('FAIL peace-tower');
    expect(after.stdout).toContain('none of that was re-checked');
  });

  it('fails on redrawn art WITHOUT --require-identification, unlike the other stale', () => {
    // The two kinds of stale exit differently and that is deliberate. A CONTRACT
    // that moved leaves a record true but incomplete, and is advisory (asserted
    // in 5b: exit 0, and 1 under the flag). ART that moved leaves the record not
    // about today's tree at all, and there is no run in which printing that and
    // exiting 0 is honest.
    const root = tree('no-flag');
    const handoffRun = {
      keymap: keymap([gatingEntry(root)]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    };
    redraw(root, SOURCE);

    const plain = score(root, handoffRun);
    const strict = score(root, handoffRun, ['--require-identification']);
    expect(plain.status, plain.output).toBe(1);
    expect(strict.status, strict.output).toBe(1);
    // Fatal goes to stderr, advisory to stdout. One more way to tell them apart
    // that does not depend on reading the sentence.
    expect(plain.stderr).toContain('STALE ART');
    expect(plain.stdout).not.toContain('STALE ART');
  });

  /* ---- the three ways art stops being checkable ---- */

  it('refuses a record that never wrote down what it was looking at', () => {
    // A record from before this check. The tempting reading is "no digest, so
    // nothing to compare, so nothing is wrong" -- which is the vacuum: it makes
    // every pre-existing record permanently, silently green.
    const root = tree('no-digest');
    const result = score(root, {
      keymap: keymap([{ ...GATING, sources: [SOURCE] }]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    });
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('carries no `sourceSha256`');
    // And it must not INVENT a change it cannot know about: the art here is
    // untouched. "Never known" is a different sentence from "changed".
    expect(result.stderr).not.toContain('REDRAWN');
    expect(result.stderr).toContain('cannot be tied to what it looked at');
  });

  it('refuses a record whose source has left the tree', () => {
    const root = tree('deleted');
    const handoffRun = {
      keymap: keymap([gatingEntry(root)]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    };
    expect(score(root, handoffRun).status).toBe(0);
    rmSync(join(root, 'assets', SOURCE));
    const after = score(root, handoffRun);
    expect(after.status, after.output).toBe(1);
    expect(after.stderr).toContain('GONE from the tree');
    expect(after.stderr).toContain(SOURCE);
  });

  it('refuses an entry that names no source at all', () => {
    const root = tree('no-source');
    const result = score(root, {
      keymap: keymap([{ ...GATING, sources: [] }]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    });
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('names no source files');
  });

  /* ---- the trap: staleness must not launder a finding ---- */

  it('carries a recorded FAILURE into the stale entry instead of dropping it', () => {
    // THE SECOND SILENT PASS, and it would have been hidden inside the fix for
    // the first. The live record's Quebec City verdict failed on a missing
    // mustBeRight feature and a neverAdd violation; that art has since been
    // redrawn. If the entry simply became STALE, the output would go from
    // "FAILED: forbidden feature present" to "not checked" -- which READS as an
    // improvement, and is not one. Nobody has looked at the new art.
    const root = tree('finding');
    const handoffRun = {
      keymap: keymap([gatingEntry(root)]),
      answers: answersFor([GATING.render]),
      audit: DEFECT_AUDIT,
    };

    const before = score(root, handoffRun);
    expect(before.status, before.output).toBe(1);
    expect(before.stderr).toContain('forbidden feature present');

    redraw(root, SOURCE);
    const after = score(root, handoffRun);
    expect(after.status, after.output).toBe(1);

    // Every word of the finding survives the redraw.
    expect(after.stderr).toContain('forbidden feature present — "a dome" (neverAdd)');
    expect(after.stderr).toContain('required feature "clock face" is missing');
    // And it is framed as unresolved rather than as history.
    expect(after.stderr).toContain('WAS A FAILURE, WHICH GOING STALE DOES NOT RESOLVE');
    expect(after.stderr).toContain('was failing, and is now unverified');
    expect(after.stdout).toContain('THE LAST VERDICT ON IT FAILED');
    expect(after.stdout).not.toContain('PASS peace-tower');
  });

  it('says "the last verdict FAILED" only when it did, or the phrase means nothing', () => {
    // The other half of the case above. A banner that appears on every stale row
    // is decoration; a reader learns nothing from a warning that is always on.
    const root = tree('clean-stale');
    redraw(root, SOURCE);
    const result = score(root, {
      keymap: keymap([withArtDigest(tree('clean-stale-src'), { ...GATING, sources: [SOURCE] })]),
      answers: answersFor([GATING.render]),
      audit: CLEAN_AUDIT,
    });
    expect(result.status, result.output).toBe(1);
    expect(result.stdout).toContain('STALE peace-tower');
    expect(result.stdout).not.toContain('THE LAST VERDICT ON IT FAILED');
    expect(result.stderr).not.toContain('WHICH GOING STALE DOES NOT RESOLVE');
  });

  it('fails on ONE stale subject while the rest of the run is live and passing', () => {
    // THE CASE THAT ISOLATES FATALITY. Every other stale case here empties the
    // live set too, so the anti-vacuum floor also fires and the run would exit 1
    // even if staleness were merely advisory -- the floor MASKS the property
    // under test. Here half the run is current and passing, no floor can fire,
    // and the only thing that can produce a non-zero exit is the stale subject.
    //
    // This is what the check is for in practice: one tile gets redrawn, the rest
    // of the level's verdicts are untouched, and the run must not go green on
    // the strength of the parts nobody changed.
    const root = tree('one-stale');
    const other = withArtDigest(root, {
      render: '9988776655443322.png',
      subjectId: SECOND_SUBJECT.id,
      probe: 'full',
      gating: true,
      sources: [SECOND],
    });
    const handoffRun = {
      keymap: keymap([gatingEntry(root), other]),
      answers: {
        runId: RUN_ID,
        identifications: [
          { render: GATING.render, answer: 'The Peace Tower on Parliament Hill, Ottawa' },
          { render: other.render, answer: 'a skating rink on a frozen canal' },
        ],
      },
      audit: {
        runId: RUN_ID,
        audits: [
          ...CLEAN_AUDIT.audits,
          {
            subjectId: SECOND_SUBJECT.id,
            featuresPresent: ['scored skate marks in the ice'],
            featuresAbsent: [],
            forbiddenPresent: [],
          },
        ],
      },
    };
    expect(score(root, handoffRun).status).toBe(0);

    redraw(root, SECOND);
    const after = score(root, handoffRun);

    expect(after.status, after.output).toBe(1);
    // No floor fired: something IS still checkable, and it still passes.
    expect(after.stderr, 'a floor fired and would mask the property under test').not.toContain(
      'ANTI-VACUUM FLOOR',
    );
    expect(after.stdout).toContain('PASS peace-tower');
    expect(after.stdout).toContain(`STALE ${SECOND_SUBJECT.id}`);
    expect(after.stderr).toContain(`STALE ART - ${SECOND_SUBJECT.id}`);
    // 1 of 2, not 2 of 2: a live subject next to a stale one, told apart.
    expect(after.stdout).toContain('scored 1/2 subject(s)');
  });

  /* ---- ADR-0024: the floors, and proof that each of them fires ---- */

  it('fails a keymap whose every entry went stale, which is a full manifest of nothing', () => {
    // ADR-0024 over the LIVE set rather than over `entries`. A keymap of twenty
    // renders whose art has all moved scores exactly as much as a keymap of
    // none -- it just has a fuller-looking manifest to hide in, which makes it
    // the more dangerous of the two.
    const root = tree('all-stale');
    const handoffRun = {
      keymap: keymap([gatingEntry(root), diagnosticEntry(root)]),
      answers: answersFor([GATING.render, DIAGNOSTIC.render]),
      audit: CLEAN_AUDIT,
    };
    expect(score(root, handoffRun).status).toBe(0);

    redraw(root, SOURCE);
    redraw(root, SECOND);
    const after = score(root, handoffRun);
    expect(after.status, after.output).toBe(1);
    expect(after.stderr).toContain('ANTI-VACUUM FLOOR');
    expect(after.stderr).toContain('not one of the 2 render(s) in this keymap');
  });

  it('fails a keymap whose every GATING entry went stale, even with a live diagnostic', () => {
    // The floor that the first one cannot reach: something IS still checkable,
    // so `live.length === 0` does not fire -- and what is left is a size-ladder
    // rung, which is diagnostic by design and decides nothing.
    const root = tree('gating-stale');
    const handoffRun = {
      keymap: keymap([gatingEntry(root), diagnosticEntry(root)]),
      answers: answersFor([GATING.render, DIAGNOSTIC.render]),
      audit: CLEAN_AUDIT,
    };
    redraw(root, SOURCE);
    const after = score(root, handoffRun);
    expect(after.status, after.output).toBe(1);
    expect(after.stderr).toContain('every gating render in this keymap describes art that has since changed');
    expect(after.stdout).not.toContain('PASS peace-tower');
  });

  it('fails a keymap where NOTHING carries a digest, which is the same vacuum', () => {
    const root = tree('none-digested');
    const result = score(root, {
      keymap: keymap([
        { ...GATING, sources: [SOURCE] },
        { ...DIAGNOSTIC, sources: [SECOND] },
      ]),
      answers: answersFor([GATING.render, DIAGNOSTIC.render]),
      audit: CLEAN_AUDIT,
    });
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('not one of the 2 render(s) in this keymap');
    expect(result.stderr).toContain('A record that scores nothing is not a record that passed');
  });

  it('reports everything stale when the scorer is given no way to read the art', () => {
    // FAIL-SAFE, and the only branch no argv can reach: the CLI always supplies
    // a reader. A `scoreRun` wired up without one must report a keymap of
    // nothing-checkable, not a keymap of nothing-wrong. Asked of the shipped
    // module in its own process, like the other two library-level cases.
    const root = tree('no-reader');
    const code =
      `import { scoreRun } from ${JSON.stringify(SCORE_LIB)};` +
      `const r = scoreRun(${JSON.stringify({
        references: { subjects: [PEACE_TOWER] },
        keymap: { runId: RUN_ID, entries: [{ ...GATING, sources: [SOURCE] }], unrendered: [] },
        answers: answersFor([GATING.render]),
        audit: CLEAN_AUDIT,
      })});` +
      `process.stdout.write(JSON.stringify({ fatal: r.fatal, staleArt: r.staleArt, totals: r.totals }));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      encoding: 'utf8',
      cwd: root,
    });
    expect(result.stderr, result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout) as {
      fatal: boolean;
      staleArt: string[];
      totals: { rendersScored: number; rendersStaleArt: number };
    };
    expect(parsed.fatal).toBe(true);
    expect(parsed.totals.rendersScored).toBe(0);
    expect(parsed.totals.rendersStaleArt).toBe(1);
    expect(parsed.staleArt.join('\n')).toContain('no reader for the art on disk');
  });

  /* ---- and over the record this repository actually ships ---- */

  it('never prints PASS for a subject in the LIVE record whose art it cannot vouch for', () => {
    // Deliberately an INVARIANT rather than an expected verdict. A full blind
    // re-run of docs/art-verification.json is being commissioned separately, so
    // pinning this to "stale" would fail the day the fresh record lands and
    // pinning it to "pass" would fail today. What must hold either way is the
    // property this whole section exists for, so that is what is asserted -- and
    // BOTH branches assert something, so a fully-current record does not reduce
    // this case to checking nothing.
    const record = JSON.parse(
      readFileSync(join(REPO, 'docs', 'art-verification.json'), 'utf8'),
    ) as { handoffRun?: { keymap: { entries: BareEntry[] } } };
    const entries = record.handoffRun?.keymap.entries;
    expect(entries, 'the live record carries no handoffRun block').toBeDefined();
    expect(entries?.length, 'the live record holds zero renders').toBeGreaterThan(0);

    const unvouchable = new Set<string>();
    for (const entry of entries ?? []) {
      const recorded = (entry as { sourceSha256?: Record<string, string> }).sourceSha256;
      const sources = entry.sources ?? [];
      let moved = recorded === undefined || sources.length === 0;
      for (const rel of sources) {
        try {
          if (recorded?.[rel] !== artOf(REPO, [rel]).sourceSha256[rel]) moved = true;
        } catch {
          moved = true; // the file is gone, which is the sharpest kind of moved
        }
      }
      if (moved) unvouchable.add(entry.subjectId);
    }

    const gate = run(['--root', REPO, ...CHEAP]);
    if (unvouchable.size === 0) {
      expect(gate.output, 'every entry is current, so nothing may be reported stale').not.toContain(
        'STALE ART',
      );
      return;
    }
    for (const id of unvouchable) {
      expect(gate.stdout, `${id} is unvouchable and was printed as a pass`).not.toContain(`PASS ${id}`);
      expect(gate.output, `${id} is unvouchable and was not reported`).toContain(`STALE ART - ${id}`);
    }
    expect(gate.status, gate.output).toBe(1);
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
    //
    // PER SUBJECT, and no longer `entries.find(...)`. That took the FIRST
    // comparison in a shuffled directory, which was one subject's side when
    // there was one subject with a comparison figure and is an arbitrary
    // subject's now that there are three. It would have gone on passing while
    // checking that two different subjects landed on two different sides,
    // which is not a property of anything.
    const sidesFor = (seed: string): Map<string, string> =>
      new Map(
        (readKeymap(handoff(REPO, [...CHEAP], seed).keymapPath) as { entries: KeymapEntry[] }).entries
          .filter((entry) => entry.probe === 'comparison')
          .map((entry) => [entry.subjectId, String(entry.slots.subjectSide)]),
      );
    const first = sidesFor('side-a');
    const second = sidesFor('side-c');
    expect(first.size, 'no comparison figure to check the side of').toBeGreaterThan(0);
    expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
    for (const [subjectId, side] of first) {
      expect(
        [side, second.get(subjectId)].sort(),
        `${subjectId} stood on the ${side} under both seeds`,
      ).toEqual(['left', 'right']);
    }
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
 * 7b. "This rule cannot apply here" is a claim, and it is checked
 * ================================================================== */

/**
 * An exemption that is believed rather than checked is the most expensive kind
 * of comment in this repository: it reads as a decision protecting something,
 * so the next reader trusts it, and it goes on reading the same way for years
 * after it stopped being true (ADR-0017 §, ADR-0019).
 *
 * The exemption here is real. One artboard in the contract is not a person; its
 * fills are hide and felt rather than a `skin-1`..`skin-6` ramp, and
 * docs/content-review.md 6.2's "every skin fill is a skin ramp entry" row
 * cannot apply to it. The MECHANICAL half of the reason is that those slots are
 * drawn and then covered entirely by a later part of that costume - and that
 * half moves. The rig gained two parts and reordered `hair` under `face` in one
 * commit. A covering that has been moved above what it covers, shrunk below it,
 * or removed RENDERS PERFECTLY; there is no exception to catch and nothing in
 * the picture to notice.
 *
 * So the hand-off re-derives the claim from the rig's z order and part windows
 * on every run, and these cases prove all three ways of breaking it fail. They
 * run against the REAL art through a doctored rig, because a fixture rig would
 * only prove the check reads its own fixture.
 */
describe('a slot declared NOT APPLICABLE has to still be invisible', () => {
  /** The real sources and the real contract, with the rig bent out of shape. */
  const bentRig = (name: string, bend: (rig: Rig) => void): string => {
    const root = scratch(name);
    mkdirSync(join(root, 'assets', 'refs'), { recursive: true });
    mkdirSync(join(root, 'assets', 'style'), { recursive: true });
    // Symlinked, not copied: these cases are about the rig, and rasterising the
    // real art is the point of running them against it.
    symlinkSync(join(REPO, 'assets', 'src'), join(root, 'assets', 'src'));

    const references = JSON.parse(
      readFileSync(join(REPO, 'assets', 'refs', 'references.json'), 'utf8'),
    ) as { subjects: { id: string; renders: string[]; mustBeRight?: { requiresComparisonFigure?: boolean }[] }[] };
    // The artboards that declare a covered slot, found rather than named: the
    // hand-off records them, so the fixture asks it which they are.
    const keymap = readKeymap(handoff(REPO, [...CHEAP], 'bent-seed').keymapPath) as {
      entries: KeymapEntry[];
    };
    const exempt = new Set(
      keymap.entries
        .filter((entry) => ((entry.slots.inertSlots as string[] | undefined) ?? []).length > 0)
        .map((entry) => entry.subjectId),
    );
    expect(exempt.size, 'no artboard declares a covered slot').toBeGreaterThan(0);
    references.subjects = references.subjects.filter((subject) => exempt.has(subject.id));

    writeFileSync(
      join(root, 'assets', 'refs', 'references.json'),
      JSON.stringify(references, null, 2),
    );
    const rig = rigOf(REPO);
    bend(rig);
    writeFileSync(join(root, 'assets', 'style', 'rig-contract.json'), JSON.stringify(rig, null, 2));
    return root;
  };

  /**
   * The part the exemption RESTS ON, read off the keymap rather than named.
   *
   * `coveredBy` is recorded beside `inertSlots` for exactly this: the reason an
   * exemption holds is a fact about the rig, the rig moves, and a case that
   * re-derived the reason here would be re-deriving it with the same rule it is
   * supposed to be testing.
   */
  const exemption = (): { slot: string; cover: RigPart; readers: RigPart[] } => {
    const rig = rigOf(REPO);
    const keymap = readKeymap(handoff(REPO, [...CHEAP], 'cover-seed').keymapPath) as {
      entries: KeymapEntry[];
    };
    const figure = keymap.entries.find(
      (entry) => Object.keys((entry.slots.coveredBy as Record<string, string>) ?? {}).length > 0,
    );
    expect(figure, 'no figure carries a covered slot').toBeTruthy();
    const coveredBy = figure!.slots.coveredBy as Record<string, string>;
    const [slot, by] = Object.entries(coveredBy)[0] ?? ['', ''];
    expect(slot, 'the figure records no covered slot').not.toBe('');
    const cover = rig.parts.find((part) => part.name === by);
    expect(cover, `the rig has no part named "${by}"`).toBeTruthy();
    const readers = rig.parts.filter((part) => part.frame.includes(`{${slot}}`));
    expect(readers.length, `no part of the rig reads "${slot}"`).toBeGreaterThan(0);
    return { slot, cover: cover!, readers };
  };

  /** Every frame key a part can resolve to, whatever the slots say. */
  const framesOf = (rig: Rig, part: RigPart): string[] => {
    const prefix = `${rig.atlas.framePrefix}${part.frame.split('{')[0]}`;
    return Object.keys(rig.frames).filter((key) => key.startsWith(prefix));
  };

  it('builds when the claim holds, which is the control for the three below', () => {
    const result = run(['--root', bentRig('bent-none', () => {})]);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('NOT APPLICABLE');
  });

  it('fails when what is covered is moved on top of what covers it', () => {
    const { cover, readers } = exemption();
    const root = bentRig('bent-z', (bent) => {
      for (const part of bent.parts) {
        if (readers.some((reader) => reader.name === part.name)) part.z = cover.z + 50;
      }
    });
    const result = run(['--root', root]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('It is on top, so it is visible');
    expect(result.stderr).toContain('neither varied it nor checked it');
  });

  it('fails when what covers it no longer covers all of it', () => {
    const { cover } = exemption();
    const root = bentRig('bent-window', (bent) => {
      for (const key of framesOf(bent, cover)) {
        bent.frames[key] = { ...(bent.frames[key] as RigFrame), w: 8, h: 8 };
      }
    });
    const result = run(['--root', root]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('does not contain');
    expect(result.stderr).toContain('Part of the slot shows');
  });

  it('fails when what covers it is not drawn on this artboard at all', () => {
    const { cover } = exemption();
    const root = bentRig('bent-gone', (bent) => {
      for (const key of framesOf(bent, cover)) delete bent.frames[key];
    });
    const result = run(['--root', root]);
    expect(result.status, result.output).toBe(1);
    expect(result.stderr).toContain('draws nothing here');
    expect(result.stderr).toContain('An exemption whose reason has gone');
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
        renders: string[];
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
              // Current art, so the ONLY staleness this case can produce is the
              // advisory one it is about: the contract asked for a comparison
              // figure this hand-off predates.
              ...artOf(REPO, subject?.renders ?? []),
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
