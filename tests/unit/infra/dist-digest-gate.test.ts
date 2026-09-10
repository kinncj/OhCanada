/**
 * The hand-off between the job that builds and the job that deploys.
 *
 * deploy-pages.yml used to run every gate and the upload in ONE job, so "the
 * bytes that get uploaded were built by the job that verified them" was true by
 * construction. The gates now run as parallel jobs — that is where fourteen
 * minutes of wall clock went — and `scripts/dist-digest.mjs` is what carries
 * that sentence across the gap: the build job prints a digest over `dist/`, the
 * browser suites run against the artefact it describes, and the deploy job
 * re-derives it and refuses anything else.
 *
 * That makes this script the last thing standing between a substituted tree and
 * the internet, so every case here drives the real CLI — argv, exit code,
 * stdout, stderr — over a scratch tree. A test that re-implemented the walk
 * would prove the copy agrees with the copy.
 *
 * THE CASES THAT MATTER ARE THE ONES WHERE IT MUST REFUSE. A digest gate that
 * fails open looks exactly like one that passes: same green tick, same silence.
 * So an empty `--expect`, an empty directory and a missing directory each get a
 * case of their own, and each is proved to EXIT NON-ZERO rather than merely to
 * print something.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/dist-digest.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'dist-digest-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const run = (args: readonly string[]): Run => {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  expect(result.error, `dist-digest could not be run: ${result.error?.message ?? ''}`).toBeUndefined();
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

let trees = 0;
/** A scratch tree. `files` maps a relative path to its contents. */
const tree = (files: Readonly<Record<string, string>>): string => {
  trees += 1;
  const root = join(WORK, `tree-${String(trees)}`);
  mkdirSync(root, { recursive: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
};

const digestOf = (root: string): string => {
  const result = run(['--dir', root]);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
};

const SITE = {
  'index.html': '<!doctype html><title>TrueNorth</title>',
  'assets/index-abc123.js': 'console.log("boot");',
  'assets/phaser-def456.js': 'export const phaser = 1;',
  'sw.js': 'self.addEventListener("fetch", () => {});',
} as const;

describe('the digest identifies a tree', () => {
  it('prints a sha256 on stdout and nothing else, so a caller can capture it', () => {
    const result = run(['--dir', tree(SITE)]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
    // The human-readable line goes to stderr on purpose: the build job does
    // `digest="$(make dist-digest)"`, and a second line on stdout would be
    // captured into the job output and then compared against, unequal, forever.
    expect(result.stdout.trim().split('\n')).toHaveLength(1);
    expect(result.stderr).toContain('4 file(s)');
  });

  it('gives two identical trees the same digest, wherever they sit on disk', () => {
    expect(digestOf(tree(SITE))).toBe(digestOf(tree(SITE)));
  });

  it('accepts the digest it just printed', () => {
    const root = tree(SITE);
    const result = run(['--dir', root, '--expect', digestOf(root)]);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('unchanged since the build job');
  });
});

describe('a tree that is not that tree', () => {
  const baseline = digestOf(tree(SITE));

  const rejects = (files: Readonly<Record<string, string>>, because: string): void => {
    const result = run(['--dir', tree(files), '--expect', baseline]);
    expect(result.status, `${because}: expected a refusal`).toBe(1);
    expect(result.stderr).toContain('THE BYTES ARE NOT THE BYTES THAT WERE VERIFIED');
  };

  it('refuses a tree where one byte of one file changed', () => {
    rejects({ ...SITE, 'sw.js': 'self.addEventListener("fetch", () => {});;' }, 'one byte');
  });

  it('refuses a tree with a file added', () => {
    rejects({ ...SITE, 'assets/extra.js': '' }, 'an extra file');
  });

  it('refuses a tree with a file missing', () => {
    const { 'sw.js': _dropped, ...withoutServiceWorker } = SITE;
    rejects(withoutServiceWorker, 'a missing file');
  });

  // THE DOTFILE CASE IS THE ONE THAT HAS ACTUALLY HAPPENED. upload-artifact v4+
  // excludes hidden files unless told otherwise, and dist/ carries `.gitkeep`
  // today (Vite copies it out of assets/dist via publicDir) and could carry
  // `.nojekyll` or `.well-known/assetlinks.json` tomorrow. If the digest did not
  // walk them, an artefact round trip could quietly ship a different tree from
  // the one the suites tested, and every check in the run would still be green.
  it('walks hidden files, so an artefact upload that drops them is a red deploy', () => {
    // Stated both ways round: the tree WITH the dotfile digests differently
    // from the one without it, and the one without it is refused against the
    // one with it. The second is the shape the deploy job actually runs.
    const withDotfile = tree({ ...SITE, '.gitkeep': '' });
    expect(digestOf(withDotfile)).not.toBe(baseline);

    const stripped = run(['--dir', tree(SITE), '--expect', digestOf(withDotfile)]);
    expect(stripped.status).toBe(1);
    expect(stripped.stderr).toContain('THE BYTES ARE NOT THE BYTES THAT WERE VERIFIED');
  });

  // Contents alone are not enough: two files that swap names have the same
  // bytes and are a different site. The digest folds the path in beside the
  // content for exactly this.
  it('refuses a tree whose files kept their contents and swapped their names', () => {
    rejects(
      {
        ...SITE,
        'assets/index-abc123.js': SITE['assets/phaser-def456.js'],
        'assets/phaser-def456.js': SITE['assets/index-abc123.js'],
      },
      'two files swapped',
    );
  });
});

describe('the ways this could stop comparing, which must all be loud', () => {
  // `make verify-dist DIGEST=` with an unset variable is the realistic one: the
  // build job's output not wired through, an empty string arriving, and a gate
  // that treats "nothing to compare with" as "nothing to complain about". That
  // failure is indistinguishable from a pass in every log.
  it('refuses an empty --expect rather than reading it as "no expectation"', () => {
    const result = run(['--dir', tree(SITE), '--expect', '']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a SHA-256');
  });

  it('refuses an --expect that is not a sha256 at all', () => {
    const result = run(['--dir', tree(SITE), '--expect', 'probably-fine']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a SHA-256');
  });

  // A digest over an empty tree is a constant. If both sides computed it, they
  // would agree, and an empty deploy would pass a byte-identity check.
  it('refuses an empty directory, whose digest would otherwise be a constant', () => {
    const empty = join(WORK, 'empty');
    mkdirSync(empty, { recursive: true });
    const result = run(['--dir', empty]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('holds no files');
  });

  it('refuses a directory that does not exist', () => {
    const result = run(['--dir', join(WORK, 'never-built')]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not exist');
  });

  // Refused rather than followed: an artefact round trip does not reliably
  // preserve a link, so a tree containing one would digest differently on the
  // two sides of the hand-off for a reason that has nothing to do with the
  // build. Saying so beats a mismatch nobody can explain.
  it('refuses a symlink instead of following it', () => {
    const root = tree(SITE);
    symlinkSync(join(root, 'index.html'), join(root, 'home.html'));
    const result = run(['--dir', root]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is a symlink');
  });
});
