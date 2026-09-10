#!/usr/bin/env bash
#
# Run one Playwright suite at a time, per checkout.
#
# WHY THIS EXISTS
#
# Two Playwright runs in the same working tree destroy each other, and the way
# they do it is almost impossible to read from the failure. Diagnosed 2026-09-08
# after `make test-e2e` failed eight times with no assertion in sight:
#
#   Error: browserContext.close: ENOENT: no such file or directory, open
#   '.../test-results/e2e/.playwright-artifacts-3/traces/<id>-recording6.trace'
#
# What happens:
#
#   1. Every run of a suite uses the same `outputDir` (test-results/e2e), because
#      it is fixed in the config -- as it should be; a report you cannot find is
#      not a report.
#   2. At startup a run DELETES its whole `outputDir` ("clear output" task,
#      playwright/lib/runner/index.js `createRemoveOutputDirsTask`). That wipes
#      the in-flight trace files of a run that is already going.
#   3. Worker artifact directories are named `.playwright-artifacts-<workerIndex>`
#      and `workerIndex` restarts at 0 in each runner process, so the two runs
#      do not merely share a parent directory -- they use the SAME paths.
#   4. A test that then fails asks Playwright to persist its trace, and the
#      `.trace` file it recorded into is gone. The error surfaces on
#      `browserContext.close`, names a file nobody wrote by hand, and mentions
#      neither concurrency nor the test's real problem.
#
# The longest-running tests are hit hardest because they are alive across more of
# the other run, which is why this looks like "the level suite is flaky".
#
# TRACING IS THE MESSENGER, NOT THE CAUSE. Measured: two concurrent runs with
# `--trace off` still fail, as `page.waitForFunction: Timeout 45000ms exceeded` --
# eight SwiftShader browsers on one machine, with suites that assert real-time
# physics. Turning tracing off would have swapped a confusing failure for an
# undiagnosable one and left the runs just as invalid, so the fix is here and the
# trace settings are untouched.
#
# WHY A LOCK RATHER THAN PER-RUN OUTPUT DIRECTORIES
#
# Isolating the artefacts would stop the ENOENT and leave both runs wrong. These
# suites assert relationships stated in seconds; `tests/perf` goes further and
# pins itself to one worker because a frame time sampled while other browsers
# saturate the CPU is a measurement of the machine, not of the build. Two
# concurrent runs cannot both be true, so the second one waits.
#
# One lock covers all three browser suites for the same reason: an e2e run and a
# perf run at once invalidate the perf numbers exactly as two e2e runs do.
#
# WHERE THE GUARD LIVES, AND WHAT IT CANNOT COVER
#
# In the `test:e2e` / `test:perf` / `test:a11y` npm scripts, so `npm run` and
# `make` are both covered by ONE lock -- wrapping both layers would make a run
# wait for itself, because flock is per open file description and the inner shell
# opens the file again.
#
# It cannot cover `npx playwright test --config ...` typed directly, and that is
# not fixable from inside the config: `createRemoveOutputDirsTask` deletes
# outputDir BEFORE `globalSetup` runs (playwright/lib/runner/index.js
# `createGlobalSetupTasks`), so by the time any hook of ours could refuse, the
# other run's artefacts are already gone. If you are automating this repository,
# call `make test-e2e`.
#
# Serial runs are unaffected, and so is CI. Both workflows used to run these
# targets one after another in a single job; they now run them in separate jobs,
# six e2e shards and two a11y shards, each on its own runner with its own
# checkout and its own /tmp. Either way no two Playwright runs share a working
# tree, so the lock is never contended in CI -- it is here for the person who
# starts a second run by hand.

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/browser-suite-lock.sh <command> [args...]" >&2
  exit 2
fi

# How long to wait for the other run before giving up. A browser suite here takes
# well under two minutes; half an hour is "the other run is wedged", not "the
# other run is slow".
WAIT_SECONDS="${TN_BROWSER_SUITE_WAIT:-1800}"

# Outside the repository on purpose: `make clean` removes test-results/ and
# playwright-report/, and a lock file that a target can delete mid-run is not a
# lock. Keyed by the checkout, so two clones do not block each other.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_KEY="$(printf '%s' "$REPO_ROOT" | cksum | cut -d' ' -f1)"
LOCK_FILE="${TMPDIR:-/tmp}/truenorth-browser-suite-${LOCK_KEY}.lock"

# No flock (macOS, a minimal container): run anyway and say so. Refusing to run
# the tests because a locking tool is missing would be a worse failure than the
# one this guards against, and the guard is for a race that only happens when
# somebody starts a second run by hand.
if ! command -v flock >/dev/null 2>&1; then
  echo "browser-suite: flock is not available; running without the one-at-a-time guard." >&2
  echo "browser-suite: do not start a second Playwright run in this tree until this finishes." >&2
  exec "$@"
fi

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  cat >&2 <<EOF
browser-suite: another Playwright suite is already running in this checkout.

  lock: $LOCK_FILE

Waiting for it, up to ${WAIT_SECONDS}s. Two runs at once do not merely slow each
other down: the second one deletes the first one's test-results/ at startup and
both reuse the same .playwright-artifacts-<n> paths, so the first run starts
failing with "browserContext.close: ENOENT ... traces/<id>-recording<n>.trace"
and no assertion error at all. The timing assertions in these suites are also
invalid with eight browsers on one CPU.

Set TN_BROWSER_SUITE_WAIT to change the wait.
EOF
  if ! flock -w "$WAIT_SECONDS" 9; then
    cat >&2 <<EOF
browser-suite: gave up after ${WAIT_SECONDS}s; the other run is still holding the lock.

If nothing is actually running, a previous run was killed while holding it and
the file descriptor is still open somewhere:

  fuser -v $LOCK_FILE
  pgrep -af 'playwright test'

Kill what is left and run again.
EOF
    exit 1
  fi
  echo "browser-suite: lock acquired, starting." >&2
fi

exec "$@"
