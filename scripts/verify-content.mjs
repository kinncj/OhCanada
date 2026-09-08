#!/usr/bin/env node
/**
 * verify-content — STUB (slice 0, task 0.12).
 *
 * Planned for slice 1 (ADR-0003): fetch each `content/sources/*` page from
 * canada.ca, recompute its `sourceHash`, and for every question assert
 * `verification.status === "verified"` against that hash, a non-empty
 * `verification.evidence` quote, 3 distractors, EN + FR text and non-verbatim
 * wording; re-verify `volatile` items every run and quarantine anything whose
 * source moved or whose `asOf` is over 180 days.
 *
 * It deliberately does not pretend to have verified anything today.
 */

const HELP = `verify-content — verify question data against Discover Canada sources

Usage: node scripts/verify-content.mjs [--help]

Status: not yet implemented (slice 1).

Will, once implemented:
  - refresh content/sources/* and recompute each sourceHash
  - fail any question whose verification.status is not "verified" for the current hash
  - fail any question marked "verified" with an empty verification.evidence quote
  - fail any question missing 3 distractors or EN/FR text, or quoting the source verbatim
  - quarantine volatile items whose source changed or whose asOf exceeds 180 days
`;

if (process.argv.slice(2).some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

console.log('verify-content: not yet implemented (slice 1). No questions exist to verify.');
console.log('verify-content: run with --help to see what it will check.');
process.exit(0);
