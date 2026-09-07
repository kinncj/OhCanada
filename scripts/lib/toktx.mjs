/**
 * Locate KTX-Software's `ktx`/`toktx` (gltf-transform 4.5 spawns `ktx create`, which needs >= 4.4.0).
 * Order: PATH → node_modules/.cache/ktx-software/bin → download the official Linux x86_64 tarball there.
 * Returns the bin directory to prepend to PATH, or null when KTX2 output is not possible on this machine.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KTX_VERSION = '4.4.2';
const MIN = [4, 4, 0];

function versionOf(bin) {
  try {
    const out = execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = /(\d+)\.(\d+)\.(\d+)/.exec(out);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  } catch {
    return null;
  }
}
const recentEnough = (v) => !!v && (v[0] > MIN[0] || (v[0] === MIN[0] && (v[1] > MIN[1] || (v[1] === MIN[1] && v[2] >= MIN[2]))));

function onPath(name) {
  for (const dir of (process.env.PATH ?? '').split(':')) if (dir && existsSync(join(dir, name)) && recentEnough(versionOf(join(dir, name)))) return dir;
  return null;
}

export async function ensureKtx({ root, log = console.log }) {
  const fromPath = onPath('ktx');
  if (fromPath) return fromPath;
  const cache = join(root, 'node_modules', '.cache', 'ktx-software');
  const bin = join(cache, 'bin');
  if (existsSync(join(bin, 'ktx')) && recentEnough(versionOf(join(bin, 'ktx')))) return bin;
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    log(`toktx: no ktx >= ${MIN.join('.')} on PATH and no automatic install for ${process.platform}/${process.arch}`);
    return null;
  }
  const name = `KTX-Software-${KTX_VERSION}-Linux-x86_64.tar.bz2`;
  const url = `https://github.com/KhronosGroup/KTX-Software/releases/download/v${KTX_VERSION}/${name}`;
  const tar = join(cache, name);
  try {
    mkdirSync(cache, { recursive: true });
    if (!existsSync(tar)) {
      log(`toktx: downloading ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${tar}.part`, Buffer.from(await res.arrayBuffer()));
      renameSync(`${tar}.part`, tar);
    }
    // Only the two CLIs and libktx (the binaries carry an rpath to ../lib).
    execFileSync('tar', ['xjf', tar, '-C', cache, '--strip-components=1', '--wildcards', '*/bin/ktx', '*/bin/toktx', '*/lib/libktx.so*'], { stdio: 'inherit' });
    if (recentEnough(versionOf(join(bin, 'ktx')))) return bin;
    log('toktx: extracted ktx does not run on this system');
  } catch (err) {
    log(`toktx: could not install KTX-Software (${err.message})`);
    rmSync(`${tar}.part`, { force: true });
  }
  return null;
}

/** Add `binDir` to PATH for child processes spawned by gltf-transform's toktx() transform. */
export function prependPath(binDir) {
  if (binDir && !(process.env.PATH ?? '').split(':').includes(binDir)) process.env.PATH = `${binDir}:${process.env.PATH ?? ''}`;
  return dirname(binDir);
}
