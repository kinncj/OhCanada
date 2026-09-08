import * as THREE from 'three/webgpu';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { attribute, float, mix, normalWorld, positionWorld, texture as texNode, vec2, vec3, vec4, smoothstep } from 'three/tsl';
import type { HeightFn } from './procedural/noise';
import type { PbrTextureSet } from './asset-library';

// three-mesh-bvh: accelerated raycasts for camera collision and ground snapping.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export interface TerrainBuild {
  readonly mesh: THREE.Mesh;
  /** Heights for the physics heightfield (column-major for Rapier). */
  readonly heights: Float32Array;
  readonly rows: number;
  readonly cols: number;
  readonly maxHeight: number;
}

export interface TerrainTextures {
  readonly grass: PbrTextureSet;
  readonly detail: PbrTextureSet; // forest floor / dirt
  readonly rock: PbrTextureSet;
  readonly snow?: PbrTextureSet;
  readonly plaza?: PbrTextureSet; // cobblestone around the origin
}

export const PHYSICS_MAX_ROWS = 97;

/** Coarse height grid for the physics collider, sampled straight from the height function. */
export function buildPhysicsHeights(size: number, heightAt: HeightFn, rows = PHYSICS_MAX_ROWS): { heights: Float32Array; rows: number; maxHeight: number } {
  const heights = new Float32Array(rows * rows);
  const step = size / (rows - 1);
  const half = size / 2;
  let maxHeight = 0;
  for (let ix = 0; ix < rows; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const h = heightAt(-half + ix * step, -half + iz * step);
      heights[ix * rows + iz] = h;
      maxHeight = Math.max(maxHeight, Math.abs(h));
    }
  }
  return { heights, rows, maxHeight };
}

export function buildTerrain(size: number, heightAt: HeightFn, palette: readonly string[], snow: boolean, textures: TerrainTextures | null, segments = 160, plazaRadius = 0): TerrainBuild {
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
    const ix = i % rows;
    const iz = Math.floor(i / rows);
    heights[ix * rows + iz] = h;
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

  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  if (textures) {
    buildSplatMaterial(mat, textures, snow, plazaRadius);
  } else {
    mat.vertexColors = true;
    mat.roughness = snow ? 0.75 : 0.95;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return { mesh, heights, rows, cols: rows, maxHeight: maxH };
}

/**
 * PBR splat: grass on flat ground, forest-floor detail in low/noisy areas, rock on slopes, snow on top when
 * the district is wintery, cobblestone plaza around the origin. World-space UVs tile in metres; a second
 * macro tile breaks up repetition. Vertex colour (the palette) tints the grass so districts keep their mood.
 */
function buildSplatMaterial(mat: THREE.MeshStandardNodeMaterial, tex: TerrainTextures, snow: boolean, plazaRadius: number): void {
  const p = positionWorld;
  const uvOf = (t: PbrTextureSet) => vec2(p.x, p.z).div(t.tileMeters);
  const macro = vec2(p.x, p.z).div(37.0);
  const sample = (t: PbrTextureSet, u: THREE.Node<'vec2'>) => texNode(t.map, u);
  const nor = (t: PbrTextureSet, u: THREE.Node<'vec2'>) => (t.normalMap ? texNode(t.normalMap, u).rgb : vec3(0.5, 0.5, 1));
  const arm = (t: PbrTextureSet, u: THREE.Node<'vec2'>) => (t.armMap ? texNode(t.armMap, u).rgb : vec3(1, 1, 0));

  const slope = float(1).sub(normalWorld.y.clamp(0, 1)); // 0 flat .. 1 vertical
  const tint = attribute<'vec3'>('color', 'vec3');
  const macroNoise = texNode(tex.detail.map, macro).r; // cheap low-frequency variation
  const grass = sample(tex.grass, uvOf(tex.grass)).rgb.mul(tint.mul(1.6).clamp(0.45, 1.35));
  const detail = sample(tex.detail, uvOf(tex.detail)).rgb;
  const rock = sample(tex.rock, uvOf(tex.rock)).rgb;
  const wDetail = smoothstep(0.35, 0.75, macroNoise).mul(float(1).sub(slope));
  const wRock = smoothstep(0.35, 0.6, slope);
  let albedo = mix(grass, detail, wDetail);
  let normal = mix(nor(tex.grass, uvOf(tex.grass)), nor(tex.detail, uvOf(tex.detail)), wDetail);
  let armv = mix(arm(tex.grass, uvOf(tex.grass)), arm(tex.detail, uvOf(tex.detail)), wDetail);
  albedo = mix(albedo, rock, wRock);
  normal = mix(normal, nor(tex.rock, uvOf(tex.rock)), wRock);
  armv = mix(armv, arm(tex.rock, uvOf(tex.rock)), wRock);
  if (snow && tex.snow) {
    const wSnow = smoothstep(0.55, 0.25, slope);
    albedo = mix(albedo, sample(tex.snow, uvOf(tex.snow)).rgb, wSnow);
    normal = mix(normal, nor(tex.snow, uvOf(tex.snow)), wSnow);
    armv = mix(armv, arm(tex.snow, uvOf(tex.snow)), wSnow);
  }
  if (plazaRadius > 0 && tex.plaza) {
    const d = vec2(p.x, p.z).length();
    const wPlaza = smoothstep(float(plazaRadius), float(plazaRadius - 3), d).mul(float(1).sub(wRock));
    albedo = mix(albedo, sample(tex.plaza, uvOf(tex.plaza)).rgb, wPlaza);
    normal = mix(normal, nor(tex.plaza, uvOf(tex.plaza)), wPlaza);
    armv = mix(armv, arm(tex.plaza, uvOf(tex.plaza)), wPlaza);
  }
  mat.colorNode = vec4(albedo, 1);
  mat.normalNode = normal.mul(2).sub(1).normalize().mul(vec3(0.8, 0.8, 1)).normalize();
  mat.normalMapType = THREE.TangentSpaceNormalMap;
  mat.roughnessNode = armv.g.clamp(0.45, 1);
  mat.metalnessNode = float(0);
  mat.aoNode = armv.r;
}
