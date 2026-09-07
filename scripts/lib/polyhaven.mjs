/**
 * Poly Haven API helpers (https://api.polyhaven.com). All downloads are cached under `cacheDir`
 * and verified by byte size, so re-runs are no-ops. Everything on Poly Haven is CC0-1.0.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const API = 'https://api.polyhaven.com';

async function cachedJson(url, file) {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(json));
  return json;
}

/** /info/<id> → { name, authors: { "Name": "role" }, ... } or null when the id is unknown. */
export const phInfo = (id, cacheDir) => cachedJson(`${API}/info/${id}`, join(cacheDir, 'polyhaven', 'meta', `${id}.info.json`));
/** /files/<id> → per-map/per-resolution file table, or null. */
export const phFiles = (id, cacheDir) => cachedJson(`${API}/files/${id}`, join(cacheDir, 'polyhaven', 'meta', `${id}.files.json`));
/** /assets?t=<type> → { id: {...} } catalogue (cached once per run directory). */
export const phCatalogue = (type, cacheDir) => cachedJson(`${API}/assets?t=${type}`, join(cacheDir, 'polyhaven', 'meta', `catalogue.${type}.json`));

/** Author names joined for a credit line, e.g. "Rob Tuytel, Rico Cilliers". */
export const phAuthors = (info) => Object.keys(info?.authors ?? {}).join(', ') || 'Poly Haven';
export const phSource = (id) => `https://polyhaven.com/a/${id}`;

/** Download `url` to `file` unless it already exists with the expected size. Streams (files reach 1 GB). */
export async function download(url, file, size, log = () => {}) {
  if (existsSync(file) && (!size || statSync(file).size === size)) return file;
  mkdirSync(dirname(file), { recursive: true });
  log(`download ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status}: ${url}`);
  const tmp = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  if (size && statSync(tmp).size !== size) throw new Error(`size mismatch for ${url}`);
  renameSync(tmp, file);
  return file;
}

/**
 * Fetch the 1k glTF of a model (gltf + bin + textures, laid out as the gltf expects).
 * Returns { gltf, dir, info } or null when the asset has no glTF at that resolution.
 */
export async function phFetchModel(id, cacheDir, { resolution = '1k', log } = {}) {
  const files = await phFiles(id, cacheDir);
  const entry = files?.gltf?.[resolution]?.gltf;
  if (!entry) return null;
  const dir = join(cacheDir, 'polyhaven', 'models', id);
  const gltf = await download(entry.url, join(dir, `${id}_${resolution}.gltf`), entry.size, log);
  for (const [rel, inc] of Object.entries(entry.include ?? {})) await download(inc.url, join(dir, rel), inc.size, log);
  return { gltf, dir, info: await phInfo(id, cacheDir) };
}

/**
 * Fetch the 1k JPG diffuse / GL normal / ARM maps of a texture set.
 * Returns { diff, nor, arm, info } (paths; a missing map is undefined) or null if the id is unknown.
 */
export async function phFetchTexture(id, cacheDir, { resolution = '1k', log } = {}) {
  const files = await phFiles(id, cacheDir);
  if (!files) return null;
  const dir = join(cacheDir, 'polyhaven', 'textures', id);
  const out = {};
  for (const [key, map] of [['diff', 'Diffuse'], ['nor', 'nor_gl'], ['arm', 'arm']]) {
    const entry = files[map]?.[resolution]?.jpg;
    if (entry) out[key] = await download(entry.url, join(dir, `${key}_${resolution}.jpg`), entry.size, log);
  }
  if (!out.diff) return null;
  return { ...out, info: await phInfo(id, cacheDir) };
}
