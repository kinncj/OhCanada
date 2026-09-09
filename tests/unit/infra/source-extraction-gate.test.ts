/**
 * `make sources` — the target that makes a cached extraction reproducible, and
 * the schema rule that makes it obligatory to say how.
 *
 * WHAT THIS IS ABOUT. `content/sources/<id>.json` records `extractedTextSha256`,
 * and every question's `source.sourceHash` IS that digest. The register recorded
 * nothing about how the extraction was produced — no tool, no version, no
 * command — so a contributor could download the correct PDF, match its `sha256`
 * byte for byte, and still not produce a `.txt` that hashed to the recorded
 * value. The verbatim check, the quote-contiguity check and the evidence check
 * all read the extraction, so all three were unrunnable for anyone who did not
 * already have the file, and ADR-0003's "re-derivable from the cached bytes" was
 * true only on one machine.
 *
 * Every case below drives the real CLI over a scratch tree, with a real command
 * (`cat`, `sed`) rather than a mocked one: the whole point of the field is that
 * the command RUNS, and a fixture that stubbed the execution would prove the
 * opposite of what is claimed.
 *
 * The two directions that matter, both proved here:
 *
 *   - a recorded command that reproduces the digest passes, and one that does
 *     NOT reproduce it fails, loudly, saying not to re-hash the register;
 *   - an extraction whose command was never recorded is REPORTED rather than
 *     passed over — and `--require-recorded` turns that report into a failure,
 *     which is the switch that closes the gap once the five HTML registers in
 *     content/sources/ have commands.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/sources.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'sources-gate-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

/**
 * The document and the text it extracts to. `sed 1d` stands in for
 * `pdftotext -layout`: a real command, reading the real document, writing the
 * extraction to stdout - so "reproduced the digest" below is a measurement and
 * not a tautology.
 */
const TEXT = 'Canada is a constitutional monarchy.\nParliament has three parts.\n';
const TEXT_SHA = createHash('sha256').update(TEXT).digest('hex');
const DOC = `%PDF-1.4 fixture header, not part of the text\n${TEXT}`;
const DOC_SHA = createHash('sha256').update(DOC).digest('hex');
/** The command every fixture uses to extract: document in, TEXT out. */
const EXTRACT = 'sed 1d content/sources/fixture-source.pdf';

interface Json {
  readonly [key: string]: unknown;
}

const manifest = (overrides: Json = {}): Json => ({
  $schema: '../schemas/source.schema.json',
  id: 'fixture-source',
  title: 'A fixture source',
  publisher: 'Nobody',
  edition: 'fixture',
  url: 'https://example.invalid/fixture',
  file: 'fixture-source.pdf',
  extractedText: 'fixture-source.txt',
  sha256: DOC_SHA,
  extractedTextSha256: TEXT_SHA,
  extraction: {
    tool: 'sed (GNU sed)',
    version: 'fixture',
    versionCommand: 'sed --version',
    command: EXTRACT,
    reproducedAt: '2026-09-09',
  },
  bytes: DOC.length,
  retrievedAt: '2026-09-08',
  licence: 'fixture',
  committed: false,
  chapters: [{ title: 'Only' }],
  ...overrides,
});

let counter = 0;

/**
 * A tree whose extraction really is derivable from its document: the command
 * below turns the document into the text, so `sources` reproducing the digest is
 * a measurement rather than a tautology.
 */
const tree = (
  label: string,
  source: Json = manifest(),
  options: { readonly document?: string | null; readonly extraction?: string | null } = {},
): string => {
  counter += 1;
  const root = join(WORK, `${label}-${String(counter)}`);
  mkdirSync(join(root, 'content', 'sources'), { recursive: true });
  writeFileSync(
    join(root, 'content', 'sources', 'fixture-source.json'),
    `${JSON.stringify(source, null, 2)}\n`,
  );
  const document = options.document === undefined ? DOC : options.document;
  if (document !== null) {
    writeFileSync(join(root, 'content', 'sources', 'fixture-source.pdf'), document);
  }
  if (options.extraction !== undefined && options.extraction !== null) {
    writeFileSync(join(root, 'content', 'sources', 'fixture-source.txt'), options.extraction);
  }
  return root;
};

interface Run {
  readonly status: number;
  readonly out: string;
}

const run = (root: string, extra: readonly string[] = []): Run => {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...extra], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
};

/* -------------------------------------------------------------------------- */
/* The command runs, and the digest is compared with what it produced           */
/* -------------------------------------------------------------------------- */

describe('a recorded extraction is checked by running it', () => {
  // Proves the fixture command is honest before any case relies on it: `sed`
  // really does turn the document into the text whose digest the register holds.
  it('the fixture command really does produce the recorded text', () => {
    const root = tree('probe');
    const produced = execFileSync('sh', ['-c', EXTRACT], { cwd: root, encoding: 'utf8' });
    expect(createHash('sha256').update(produced).digest('hex')).toBe(TEXT_SHA);
  });

  it('passes when the recorded command reproduces the recorded digest', () => {
    const result = run(tree('ok'));
    expect(result.out).toContain('reproduced');
    expect(result.out).toContain('1 register(s) with an extraction — 1 record a command, of which 1 reproduced');
    expect(result.out).toContain('sources: OK.');
    expect(result.status).toBe(0);
  });

  it('FAILS when it produces different bytes, and says not to re-hash the register', () => {
    // The dangerous fix is one keystroke away: paste the new digest into the
    // register and everything goes green, having silently re-pointed every claim
    // granted against the old bytes at bytes no verifier read.
    const result = run(
      tree(
        'drift',
        manifest({
          extraction: {
            ...(manifest().extraction as Json),
            command: 'cat content/sources/fixture-source.pdf',
          },
        }),
      ),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('and the register declares extractedTextSha256');
    expect(result.out).toContain('DO NOT re-hash the register');
    expect(result.out).toContain('this is the EXTRACTOR disagreeing, not the source moving');
  });

  it('checks the document itself first, so a wrong edition is not read as a broken extractor', () => {
    const result = run(
      tree('wrong-doc', manifest(), { document: 'a different document entirely\n' }),
    );
    expect(result.status).toBe(1);
    expect(result.out).toContain('Either the document changed or this is a different edition');
  });

  it('reports rather than fails when the document is absent, which is the CI case', () => {
    const root = tree('absent', manifest(), { document: null });
    const reported = run(root);
    expect(reported.status).toBe(0);
    expect(reported.out).toContain('cannot re-run the extraction');
    expect(reported.out).toContain('The command that would have run');
    // ... and it does not pretend the run proved anything.
    expect(reported.out).toContain('NOTHING WAS RE-DERIVED');

    const required = run(root, ['--require-source']);
    expect(required.status).toBe(1);
  });

  it('writes the extraction only under --write, and only when it matches', () => {
    const root = tree('write');
    const target = join(root, 'content', 'sources', 'fixture-source.txt');

    const dry = run(root);
    expect(dry.status).toBe(0);
    expect(dry.out).toContain('pass --write to replace it');
    expect(() => readFileSync(target, 'utf8')).toThrow();

    const wrote = run(root, ['--write']);
    expect(wrote.status).toBe(0);
    expect(readFileSync(target, 'utf8')).toBe(TEXT);
    expect(wrote.out).toContain('1 file(s) written.');
  });

  it('refuses a command that could write somewhere, rather than running it', () => {
    // Defence in depth: the schema refuses these too. This is what stands
    // between a register edited outside `make validate-content` and `sh -c`.
    for (const command of [
      'cat content/sources/fixture-source.pdf > /tmp/somewhere',
      'cat content/sources/fixture-source.pdf; rm -rf .',
      'cat $(echo content/sources/fixture-source.pdf)',
    ]) {
      const result = run(tree('unsafe', manifest({ extraction: { ...(manifest().extraction as Json), command } })));
      expect(result.status, command).toBe(1);
      expect(result.out).toContain('will not be run');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* An extraction nobody recorded is declared, not omitted                       */
/* -------------------------------------------------------------------------- */

describe('an extraction whose command was never recorded', () => {
  const unrecorded = manifest({
    extraction: { unrecorded: true, reason: 'Made by hand before the field existed.' },
  });

  it('is reported on every run, with the reason', () => {
    const result = run(tree('unrecorded', unrecorded));
    expect(result.status).toBe(0);
    expect(result.out).toContain('NOT REPRODUCIBLE');
    expect(result.out).toContain('Made by hand before the field existed.');
    expect(result.out).toContain('1 declare NO command and cannot be reproduced by anyone');
  });

  it('fails under --require-recorded, which is the switch that closes the gap', () => {
    const result = run(tree('unrecorded-strict', unrecorded), ['--require-recorded']);
    expect(result.status).toBe(1);
    expect(result.out).toContain('NOT REPRODUCIBLE');
  });

  it('fails outright when the register records neither form', () => {
    const bare = { ...manifest() };
    delete (bare as { extraction?: unknown }).extraction;
    const result = run(tree('no-block', bare));
    expect(result.status).toBe(1);
    expect(result.out).toContain('and no "extraction" block');
    expect(result.out).toContain('make validate-content');
  });

  it('does not pass by having no register to look at', () => {
    // ADR-0024. The credit gate spent a slice reporting green over an empty
    // directory; a reproducibility check over no sources would be the same.
    counter += 1;
    const root = join(WORK, `empty-${String(counter)}`);
    mkdirSync(join(root, 'content', 'sources'), { recursive: true });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.out).toContain('holds no source register');
  });
});

/* -------------------------------------------------------------------------- */
/* The schema is what makes the record obligatory                               */
/* -------------------------------------------------------------------------- */

describe('source.schema.json requires an extraction to say how it was made', () => {
  const validator = ((): ((value: unknown) => boolean) => {
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    addFormats(ajv);
    const dir = `${REPO_ROOT}content/schemas`;
    for (const file of ['common.schema.json', 'source.schema.json']) {
      ajv.addSchema(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as object);
    }
    return ajv.getSchema('https://truenorth.app/schemas/source.schema.json') as unknown as (
      value: unknown,
    ) => boolean;
  })();

  const valid = (source: Json): boolean => validator(source);

  it('accepts a register that records the tool, the version and the command', () => {
    expect(valid(manifest())).toBe(true);
  });

  it('accepts a register that declares the extraction unrecorded, with a reason', () => {
    expect(valid(manifest({ extraction: { unrecorded: true, reason: 'Nobody wrote it down.' } }))).toBe(
      true,
    );
  });

  it('REFUSES a register with an extraction and no record of how it was made', () => {
    // The state every register was in until 2026-09-09, and the reason the
    // digest 389 questions are granted against could not be reproduced by anyone
    // who did not already hold the file.
    const bare = { ...manifest() };
    delete (bare as { extraction?: unknown }).extraction;
    expect(valid(bare)).toBe(false);
  });

  it('does not demand one from a register that cites a document with no extraction', () => {
    const noExtraction = { ...manifest() };
    delete (noExtraction as { extraction?: unknown }).extraction;
    delete (noExtraction as { extractedText?: unknown }).extractedText;
    delete (noExtraction as { extractedTextSha256?: unknown }).extractedTextSha256;
    expect(valid(noExtraction)).toBe(true);
  });

  it('refuses a half-recorded extraction: a command with no version behind it', () => {
    const half = { ...(manifest().extraction as Json) };
    delete (half as { version?: unknown }).version;
    expect(valid(manifest({ extraction: half }))).toBe(false);
  });

  it('refuses an unrecorded declaration with no reason', () => {
    expect(valid(manifest({ extraction: { unrecorded: true } }))).toBe(false);
  });

  it('refuses a command that redirects, chains or substitutes', () => {
    for (const command of ['cat a > b', 'cat a; rm -rf /', 'cat $(echo a)', 'cat a && rm b']) {
      expect(
        valid(manifest({ extraction: { ...(manifest().extraction as Json), command } })),
        command,
      ).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The real registers                                                           */
/* -------------------------------------------------------------------------- */

describe('the registers that ship', () => {
  it('records a reproducible command for the source every question cites', () => {
    // 389 of 389 questions cite `discover-canada`. If any register in the tree
    // must be reproducible, it is that one - and this is what fails if the field
    // is ever emptied back out.
    const source = JSON.parse(
      readFileSync(`${REPO_ROOT}content/sources/discover-canada.json`, 'utf8'),
    ) as { readonly extraction?: { readonly command?: unknown; readonly version?: unknown } };
    expect(source.extraction?.command).toBe(
      'pdftotext -layout content/sources/discover-canada-2012-large-print.pdf -',
    );
    expect(typeof source.extraction?.version).toBe('string');
  });
});
