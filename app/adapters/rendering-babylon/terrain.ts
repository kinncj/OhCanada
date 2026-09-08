import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { HeightFn } from './procedural/noise';
import type { PbrTextureSet } from './asset-library';

export interface TerrainBuild {
  readonly mesh: Mesh;
  /** Column-major heights for the Rapier heightfield. */
  readonly heights: Float32Array;
  readonly rows: number;
  readonly cols: number;
  readonly maxHeight: number;
}

export interface TerrainTextures {
  readonly grass: PbrTextureSet;
  readonly detail: PbrTextureSet;
  readonly rock: PbrTextureSet;
  readonly snow?: PbrTextureSet;
  readonly plaza?: PbrTextureSet;
}

/**
 * Terrain as a single grid mesh: heights from the shared noise function (so physics and visuals agree),
 * vertex colours from the district palette, and a PBR ground material. Detail/rock/snow sets are blended in
 * with Babylon's detail map where available, which keeps one draw call and one shader on every device.
 */
export function buildTerrain(
  scene: Scene,
  size: number,
  heightAt: HeightFn,
  palette: readonly string[],
  snow: boolean,
  textures: TerrainTextures | null,
  segments = 160,
  plazaRadius = 0,
): TerrainBuild {
  const rows = segments + 1;
  const positions = new Float32Array(rows * rows * 3);
  const uvs = new Float32Array(rows * rows * 2);
  const colors = new Float32Array(rows * rows * 4);
  const heights = new Float32Array(rows * rows);
  const indices: number[] = [];
  const cols = palette.map((c) => Color3.FromHexString(c));
  const snowColor = new Color3(0.93, 0.95, 0.97);
  const step = size / segments;
  const half = size / 2;
  let maxH = 0;
  const tmp = new Color3();

  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < rows; ix++) {
      const i = iz * rows + ix;
      const x = -half + ix * step;
      const z = -half + iz * step;
      const h = heightAt(x, z);
      maxH = Math.max(maxH, Math.abs(h));
      positions[i * 3] = x;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = z;
      uvs[i * 2] = ix / segments;
      uvs[i * 2 + 1] = iz / segments;
      heights[ix * rows + iz] = h;
      const n = Math.min(1, Math.max(0, (h + 3) / 12 + (Math.sin(x * 0.3) * Math.cos(z * 0.27) + 1) * 0.12));
      const idx = Math.min(cols.length - 2, Math.floor(n * (cols.length - 1)));
      const t = n * (cols.length - 1) - idx;
      tmp.copyFrom(cols[idx] ?? cols[0]!);
      const next = cols[idx + 1] ?? cols[cols.length - 1]!;
      tmp.set(tmp.r + (next.r - tmp.r) * t, tmp.g + (next.g - tmp.g) * t, tmp.b + (next.b - tmp.b) * t);
      if (snow) tmp.set(tmp.r + (snowColor.r - tmp.r) * 0.85, tmp.g + (snowColor.g - tmp.g) * 0.85, tmp.b + (snowColor.b - tmp.b) * 0.85);
      const dist = Math.hypot(x, z);
      if (plazaRadius > 0 && dist < plazaRadius) {
        const k = 1 - Math.min(1, dist / plazaRadius);
        tmp.set(tmp.r + (0.72 - tmp.r) * k, tmp.g + (0.72 - tmp.g) * k, tmp.b + (0.7 - tmp.b) * k);
      }
      colors[i * 4] = tmp.r;
      colors[i * 4 + 1] = tmp.g;
      colors[i * 4 + 2] = tmp.b;
      colors[i * 4 + 3] = 1;
    }
  }
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * rows + ix;
      const b = a + 1;
      const c = a + rows;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const mesh = new Mesh('terrain', scene);
  const data = new VertexData();
  data.positions = positions as unknown as number[];
  data.indices = indices;
  data.uvs = uvs as unknown as number[];
  data.colors = colors as unknown as number[];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh, false);
  mesh.isPickable = true;
  mesh.receiveShadows = true;
  mesh.useVertexColors = true;

  const mat = new PBRMaterial('terrain-mat', scene);
  mat.metallic = 0;
  mat.roughness = snow ? 0.8 : 0.95;
  mat.backFaceCulling = true;
  if (textures) {
    const tile = size / textures.grass.tileMeters;
    const set = (t: typeof textures.grass) => {
      t.albedo.uScale = t.albedo.vScale = tile;
      if (t.normal) t.normal.uScale = t.normal.vScale = tile;
      if (t.arm) t.arm.uScale = t.arm.vScale = tile;
    };
    set(textures.grass);
    mat.albedoTexture = textures.grass.albedo;
    if (textures.grass.normal) mat.bumpTexture = textures.grass.normal;
    if (textures.grass.arm) {
      mat.metallicTexture = textures.grass.arm;
      mat.useAmbientOcclusionFromMetallicTextureRed = true;
      mat.useRoughnessFromMetallicTextureGreen = true;
      mat.useMetallnessFromMetallicTextureBlue = true;
    }
    // Detail map breaks up the repeat at close range without a second full material.
    const detail = textures.detail.albedo.clone();
    if (detail) {
      detail.uScale = detail.vScale = tile * 3;
      mat.detailMap.texture = detail;
      mat.detailMap.isEnabled = true;
      mat.detailMap.diffuseBlendLevel = 0.25;
      mat.detailMap.bumpLevel = 0.4;
    }
  } else {
    mat.albedoColor = Color3.White();
  }
  mesh.material = mat;
  void VertexBuffer.ColorKind;
  void Vector2;
  return { mesh, heights, rows, cols: rows, maxHeight: maxH };
}
