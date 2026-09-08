/** Seeded value noise + fBm. Pure functions so terrain height is identical for rendering and physics. */
function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm; // 0..1
}

export interface HeightFieldSpec {
  readonly seed: number;
  readonly amplitude: number;
  readonly frequency: number;
  readonly size: number;
  /** Radius around the origin that is flattened toward zero (plazas, streets). */
  readonly flatRadius: number;
  /** Optional extra flat discs (landmark footprints). */
  readonly flatSpots?: readonly { x: number; z: number; r: number }[];
}

export type HeightFn = (x: number, z: number) => number;

export function makeHeightFunction(spec: HeightFieldSpec): HeightFn {
  const half = spec.size / 2;
  return (x, z) => {
    const n = fbm(x * spec.frequency, z * spec.frequency, spec.seed) * 2 - 1;
    let h = n * spec.amplitude;
    // rim rises toward the edges to hide the world boundary
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    if (edge > 0.82) h += ((edge - 0.82) / 0.18) ** 2 * spec.amplitude * 6;
    const d = Math.hypot(x, z);
    if (d < spec.flatRadius) {
      const t = smooth(d / spec.flatRadius);
      h *= t;
    }
    for (const s of spec.flatSpots ?? []) {
      const dd = Math.hypot(x - s.x, z - s.z);
      if (dd < s.r) {
        const t = smooth(dd / s.r);
        h *= t;
      }
    }
    return h;
  };
}
