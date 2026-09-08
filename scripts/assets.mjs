#!/usr/bin/env node
/**
 * assets — STUB (slice 0, task 0.12).
 *
 * Planned for slice 1: the art pipeline. Rasterise assets/src/svg with sharp,
 * pack atlases with free-tex-packer-core, generate MSDF fonts with
 * msdf-bmfont-xml, copy assets/src/rive, and emit assets/dist plus a manifest,
 * holding the per-level payload and texture-memory budgets.
 *
 * It deliberately does not pretend to have built anything today.
 */

const HELP = `assets — build assets/dist from assets/src

Usage: node scripts/assets.mjs [--help]

Status: not yet implemented (slice 1).

Will, once implemented:
  - rasterise assets/src/svg at the design resolution (sharp)
  - pack per-level texture atlases (free-tex-packer-core)
  - generate MSDF bitmap fonts (msdf-bmfont-xml)
  - copy assets/src/rive artboards
  - write assets/dist/manifest.json and enforce the per-level payload budgets
`;

if (process.argv.slice(2).some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

console.log('assets: not yet implemented (slice 1). assets/src is empty; nothing to build.');
console.log('assets: run with --help to see what it will produce.');
process.exit(0);
