/**
 * One-off: shrink the character GLBs in place (resize textures, then re-apply KTX2 + Draco).
 * `resize` alone decompresses everything and makes the file larger, so the re-encode is not optional.
 * Used when the upstream packs are rate-limited and the committed assets must shrink without a re-download.
 * Usage: node scripts/dev/shrink-characters.mjs [maxSize]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, copyFileSync, rmSync } from "node:fs";
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const size = String(Number(process.argv[2] ?? 512));
const dist = new URL('../../assets/dist/', import.meta.url).pathname;
const cli = new URL('../../node_modules/.bin/gltf-transform', import.meta.url).pathname;
const ktxBin = new URL('../../node_modules/.cache/ktx-software/bin', import.meta.url).pathname;
const env = { ...process.env, PATH: `${ktxBin}:${process.env.PATH ?? ''}` };
const run = (args) => execFileSync(cli, args, { stdio: ['ignore', 'ignore', 'inherit'], env });

for (const body of ['male', 'female']) {
  const glb = join(dist, 'models', 'characters', `${body}.glb`);
  if (!existsSync(glb)) continue;
  const before = statSync(glb).size;
  const a = join(tmpdir(), `${body}-resized.glb`);
  const b = join(tmpdir(), `${body}-etc1s.glb`);
  const c = join(tmpdir(), `${body}-draco.glb`);
  run(['resize', glb, a, '--width', size, '--height', size]);
  run(['etc1s', a, b, '--quality', '160']);
  run(['draco', b, c]);
  copyFileSync(c, glb);
  rmSync(c, { force: true });
  for (const f of [a, b]) rmSync(f, { force: true });
  console.log(`${body}.glb ${(before / 1e6).toFixed(2)} MB -> ${(statSync(glb).size / 1e6).toFixed(2)} MB`);
}
