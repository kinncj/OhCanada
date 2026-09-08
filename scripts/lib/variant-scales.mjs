/**
 * What a single device holds, out of a manifest that ships several scales.
 *
 * Both budget gates need this and they used to answer it differently. The
 * payload gate's original rule was "the worst single scale, plus the
 * scale-independent files", which was exactly right while the pipeline emitted
 * 1x and 2x of everything: a device downloads one scale or the other, never
 * both, so summing both would have made the 8 MiB budget silently mean 4.
 *
 * That rule stopped being true the day full-screen parallax layers were pinned
 * to 1x (owner's decision, slice 1: 2x is for characters, props and things the
 * player looks at closely). A phone at 2x now downloads the 2x props AND the 1x
 * layers, because there is no 2x layer to download. Bucketing by scale loses the
 * layers entirely from the 2x bucket — which, on Ottawa, is most of the level.
 *
 * So the unit is not a scale, it is a VARIANT GROUP: the set of files that are
 * the same texture at different scales, named by `group` in the manifest. For a
 * given device scale, a loader takes ONE variant per group, and this file is
 * that choice written down once so that two gates and the pipeline cannot answer
 * it three ways.
 */

/**
 * The variant a device at `deviceScale` loads out of one group.
 *
 * Exact match, else the largest scale below it (a 3x device takes the 2x art),
 * else the smallest above it (a 1x device offered only 2x art takes it and pays
 * for it — the honest answer, and the one that keeps the budget conservative).
 * `variants` must all have a numeric `scale`; scale-independent files are the
 * caller's business, because they load at every scale.
 */
export function chooseVariant(variants, deviceScale) {
  const exact = variants.find((v) => v.scale === deviceScale);
  if (exact !== undefined) return exact;
  const below = variants.filter((v) => v.scale < deviceScale).sort((a, b) => b.scale - a.scale)[0];
  if (below !== undefined) return below;
  return variants.filter((v) => v.scale > deviceScale).sort((a, b) => a.scale - b.scale)[0];
}

/**
 * `[[deviceScale, total], ...]` sorted by scale, where `total` is `weigh(file)`
 * summed over one variant per group plus every scale-independent file.
 *
 * `weigh` is `f => f.bytes` for the payload budget and `f => f.decodedBytes` for
 * the texture budget: same resolution, two quantities, one model.
 */
export function resolveByDeviceScale(files, deviceScales, weigh) {
  const groups = new Map();
  let independent = 0;
  for (const file of files) {
    if (file.scale === null || file.scale === undefined) {
      independent += weigh(file);
      continue;
    }
    const group = file.group ?? file.path;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(file);
  }
  return deviceScales
    .slice()
    .sort((a, b) => a - b)
    .map((scale) => {
      let total = independent;
      for (const [, variants] of groups) {
        const chosen = chooseVariant(variants, scale);
        if (chosen !== undefined) total += weigh(chosen);
      }
      return [scale, total];
    });
}

/** The worst device scale's total, which is the number a budget is held to. */
export const worstDeviceScale = (perScale) => perScale.reduce((max, [, total]) => Math.max(max, total), 0);
