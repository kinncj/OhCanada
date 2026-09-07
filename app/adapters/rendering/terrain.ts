import * as THREE from 'three/webgpu';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { HeightFn } from './procedural/noise';

// three-mesh-bvh: accelerated raycasts for camera collision and ground snapping.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export interface TerrainBuild {
  readonly mesh: THREE.Mesh;
  /** Heights for the physics heightfield (row-major, rows along z). */
  readonly heights: Float32Array;
  readonly rows: number;
  readonly cols: number;
  readonly maxHeight: number;
}

export function buildTerrain(size: number, heightAt: HeightFn, palette: readonly string[], snow: boolean, segments = 128): TerrainBuild {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cols = palette.map((c) => new THREE.Color(c));
  const snowColor = new THREE.Color('#eef3f7');
  let maxH = 0;
  const rows = segments + 1;
  const heights = new Float32Array(rows * rows);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    maxH = Math.max(maxH, Math.abs(h));
    // PlaneGeometry vertices are laid out row by row along x for each z row.
    const ix = i % rows;
    const iz = Math.floor(i / rows);
    heights[ix * rows + iz] = h; // column-major for Rapier (x major)
    const n = Math.min(1, Math.max(0, (h + 3) / 12 + (Math.sin(x * 0.3) * Math.cos(z * 0.27) + 1) * 0.12));
    const idx = Math.min(cols.length - 2, Math.floor(n * (cols.length - 1)));
    const t = n * (cols.length - 1) - idx;
    tmp.copy(cols[idx] ?? cols[0]!).lerp(cols[idx + 1] ?? cols[cols.length - 1]!, t);
    if (snow) tmp.lerp(snowColor, 0.85);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.boundsTree = new MeshBVH(geo);
  const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: snow ? 0.75 : 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return { mesh, heights, rows, cols: rows, maxHeight: maxH };
}
