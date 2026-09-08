#!/usr/bin/env node
/**
 * verify-art — STUB (slice 0, task 0.12).
 *
 * Planned for slice 1: check every shipped art asset against the style guide in
 * content/style and the reference set in assets/refs — palette conformance,
 * outline-on-characters-only, 3-tone cel shading, landmark reference accuracy,
 * and the Indigenous content rules in docs/content-review.md.
 *
 * It deliberately does not pretend to have verified anything today.
 */

const HELP = `verify-art — verify art assets against the style guide and references

Usage: node scripts/verify-art.mjs [--help]

Status: not yet implemented (slice 1).

Will, once implemented:
  - check palette conformance against content/style
  - check outline-on-characters-only and 3-tone cel shading
  - compare landmark art to assets/refs and flag invented detail
  - apply the review rules in docs/content-review.md to Indigenous content
  - confirm every asset in assets/dist is attributed in assets/credits.json
`;

if (process.argv.slice(2).some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

console.log('verify-art: not yet implemented (slice 1). No art assets exist to verify.');
console.log('verify-art: run with --help to see what it will check.');
process.exit(0);
