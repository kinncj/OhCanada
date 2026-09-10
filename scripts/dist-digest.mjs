#!/usr/bin/env node
/**
 * One SHA-256 over everything in `dist/` — every path and every byte.
 *
 * WHY THIS EXISTS
 *
 * deploy-pages.yml used to run every gate and the upload in ONE job, and its
 * header said why: "the bytes that get uploaded are then built by the same job
 * that verified them". That sentence is the property worth keeping, and it is
 * NOT the same thing as "one job". One job also meant one CPU, and the browser
 * suites ran for fourteen minutes on it.
 *
 * The gates now run as parallel jobs, `dist/` is built exactly ONCE, and this
 * script is what replaces the single-job guarantee with a stronger one:
 *
 *   - the `build` job builds dist/, prints this digest and publishes it as a
 *     job output;
 *   - the browser suites download that artefact and serve it — so what e2e and
 *     axe exercise is that build, not a rebuild of the same commit;
 *   - the `deploy` job downloads the same artefact and runs this script with
 *     `--expect <digest>` before it hands anything to Pages.
 *
 * So the claim is no longer "the same job built and tested these bytes"; it is
 * "these are the same BYTES, and here is the number that says so". A rebuild
 * that is reproducible would pass either way. A rebuild that is not — a
 * timestamp, a hash-order flip, an artefact upload that quietly dropped the
 * dotfiles (`upload-artifact` excludes them unless told otherwise, and `dist/`
 * carries at least `.gitkeep` today) — turns a silent substitution into a red
 * deploy. That is the direction a deploy gate should fail in.
 *
 * WHAT IT COVERS, EXACTLY
 *
 * Every regular file under the directory, hidden files included, relative path
 * and content both. Paths are folded into the digest so that renaming a file to
 * another file's name cannot leave the total unchanged, and they are sorted
 * byte-wise so the answer does not depend on the locale or the filesystem's
 * readdir order. Directories carry nothing but their names, which the paths
 * already carry; an EMPTY directory is therefore invisible here, and also
 * invisible to `upload-pages-artifact`, so nothing is lost.
 *
 * Symlinks are refused rather than followed or hashed: Pages serves a tar, an
 * artefact round trip does not reliably preserve them, and a link that resolves
 * differently in two jobs is precisely the substitution this is here to catch.
 *
 * WHAT IT IS NOT
 *
 * Not a budget check. `scripts/deploy-check.mjs` weighs dist/ against the
 * payload budgets and the 100 MB per-file cap; this says only that two trees are
 * the same tree. Both run before the upload, and they answer different
 * questions.
 */

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`dist-digest: ${name} needs a value.`);
    process.exit(2);
  }
  return value;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      'usage: node scripts/dist-digest.mjs [--dir <path>] [--expect <sha256>]',
      '',
      '  --dir <path>       directory to digest (default: dist)',
      '  --expect <sha256>  compare against this digest and exit 1 if it differs',
      '',
      'With no --expect, prints the digest alone on stdout so a caller can',
      'capture it; the human-readable line goes to stderr.',
    ].join('\n'),
  );
  process.exit(0);
}

const dir = resolve(readOption('--dir', 'dist'));

// `undefined` means the flag was not given at all. An EMPTY string means it was
// given and carries nothing, which is a different thing entirely and must not
// read as "no expectation": `make verify-dist DIGEST=` with an unset variable
// is the one way this gate could quietly stop comparing, and it would look
// identical to a pass. It is rejected below, not defaulted away.
const expected = args.includes('--expect') ? readOption('--expect', '') : undefined;

/** Every regular file under `root`, as repository-relative POSIX paths. */
const walk = (root) => {
  const found = [];
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      console.error(`dist-digest: cannot read ${current}: ${error.message}`);
      process.exit(1);
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      // `withFileTypes` reports a symlink as a symlink, never as what it points
      // at, which is what we want: it is refused below, not followed.
      if (entry.isSymbolicLink()) {
        console.error(
          `dist-digest: ${relative(root, full)} is a symlink. A build output tree must not contain one:\n` +
            '  upload-artifact does not reliably round-trip links, and a link that resolves\n' +
            '  differently in two jobs is exactly the substitution this digest exists to catch.',
        );
        process.exit(1);
      }
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (!entry.isFile()) {
        console.error(
          `dist-digest: ${relative(root, full)} is neither a file nor a directory; refusing to digest it.`,
        );
        process.exit(1);
      }
      found.push(relative(root, full).split(sep).join('/'));
    }
  };
  visit(root);
  return found;
};

let stat;
try {
  stat = lstatSync(dir);
} catch {
  console.error(
    `dist-digest: ${dir} does not exist. There is nothing to digest, and a digest over nothing\n` +
      '  must never read as a passing one - run `make build` first.',
  );
  process.exit(1);
}
if (!stat.isDirectory()) {
  console.error(`dist-digest: ${dir} is not a directory.`);
  process.exit(1);
}

const files = walk(dir);

if (files.length === 0) {
  console.error(
    `dist-digest: ${dir} holds no files. A digest over an empty tree is a constant, and a\n` +
      '  constant that compares equal on both sides would let an empty deploy pass. Refusing.',
  );
  process.exit(1);
}

// Byte-wise, not locale-aware: `Array.prototype.sort` on strings compares UTF-16
// code units, which is stable everywhere. `localeCompare` is not - it would put
// `a-b.js` and `ab.js` in a different order on a runner with a different ICU
// build, and the digest would move without a byte of dist/ changing.
files.sort();

const total = createHash('sha256');
let bytes = 0;
for (const file of files) {
  const content = readFileSync(join(dir, file));
  bytes += content.length;
  // path, NUL, content digest, newline. The NUL cannot occur in a path, so no
  // pair of (path, content) can be re-cut into a different pair with the same
  // serialisation - which is what a plain concatenation would allow.
  total.update(file, 'utf8');
  total.update('\0');
  total.update(createHash('sha256').update(content).digest('hex'), 'utf8');
  total.update('\n');
}

const digest = total.digest('hex');
const summary = `${files.length} file(s), ${bytes} byte(s)`;

if (expected === undefined) {
  console.error(`dist-digest: ${digest} over ${summary} in ${dir}`);
  console.log(digest);
  process.exit(0);
}

if (!/^[0-9a-f]{64}$/.test(expected)) {
  console.error(
    `dist-digest: --expect was given "${expected}", which is not a SHA-256.\n` +
      '  An empty or malformed expectation almost always means the build job output was\n' +
      '  not wired through, and comparing against nothing would pass everything. Refusing.',
  );
  process.exit(1);
}

if (digest !== expected) {
  console.error(
    [
      'dist-digest: THE BYTES ARE NOT THE BYTES THAT WERE VERIFIED.',
      '',
      `  expected  ${expected}   (recorded by the build job)`,
      `  found     ${digest}   over ${summary} in ${dir}`,
      '',
      '  Nothing is uploaded. The end-to-end and accessibility suites ran against the',
      '  tree the build job produced, and this is a different tree, so no gate in this',
      '  run has seen these bytes. Likely causes, in the order they have happened:',
      '',
      '    - the artefact upload dropped hidden files (`include-hidden-files: true` is',
      '      required on upload-artifact v4+, and dist/ carries at least .gitkeep);',
      '    - something rebuilt dist/ in this job instead of downloading it;',
      '    - the build is not reproducible, in which case NO arrangement of jobs can',
      '      promise that what was tested is what ships. Fix that first.',
    ].join('\n'),
  );
  process.exit(1);
}

console.error(`dist-digest: OK - ${digest} over ${summary} in ${dir}, unchanged since the build job.`);
