#!/usr/bin/env node
/**
 * fetch-squash-heads — make every head named in scripts/content-squash-merges.json
 * present locally, so `make verify-content` can judge a recorded squash by its
 * branch (ADR-0073).
 *
 * verify-content itself never touches the network; it fails, naming the ref,
 * when a recorded head is missing. This is the step that fetches it, and it is
 * a separate step so the gate stays a pure function of the clone it is given.
 *
 * `actions/checkout` with `fetch-depth: 0` fetches every branch and tag, which
 * covers a head while its branch still exists on the remote. It does not fetch
 * `refs/pull/*`, and GitHub deletes a merged PR's branch when the repository is
 * set to, so this tries, in order, until the commit is present:
 *
 *   git fetch --no-tags origin <sha>                 any commit reachable from a ref
 *   git fetch --no-tags origin refs/pull/<N>/head    the PR's own ref, kept by GitHub
 *   git fetch --no-tags origin <branch>              the branch, if it still exists
 *
 * A head already present costs nothing and needs no network, so a local run
 * offline is unaffected. Exit 1 when a head is still missing afterwards.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RECORD = fileURLToPath(new URL('content-squash-merges.json', import.meta.url));
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const git = (args) =>
  execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const present = (sha) => {
  try {
    git(['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

if (!existsSync(RECORD)) {
  console.log('squash-heads: no squash record, nothing to fetch.');
  process.exit(0);
}

const squashes = JSON.parse(readFileSync(RECORD, 'utf8')).squashes ?? [];
let missing = 0;
for (const { head, branch, pr } of squashes) {
  if (present(head)) {
    console.log(`squash-heads: ${head.slice(0, 9)} (PR #${String(pr)}) present.`);
    continue;
  }
  const attempts = [head, `refs/pull/${String(pr)}/head`, branch];
  for (const ref of attempts) {
    try {
      git(['fetch', '--no-tags', 'origin', ref]);
    } catch (error) {
      console.log(`squash-heads: git fetch origin ${ref} failed — ${String(error.stderr ?? error).trim().split('\n').at(-1)}`);
    }
    if (present(head)) {
      console.log(`squash-heads: ${head.slice(0, 9)} (PR #${String(pr)}) fetched via ${ref}.`);
      break;
    }
  }
  if (!present(head)) {
    missing += 1;
    console.error(
      `squash-heads: ${head} (PR #${String(pr)}, branch ${branch}) is still missing after trying ` +
        `${attempts.join(', ')}. verify-content cannot judge that squash by its branch without it.`,
    );
  }
}
process.exit(missing > 0 ? 1 : 0);
