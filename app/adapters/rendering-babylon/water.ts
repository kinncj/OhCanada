import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Reflective water plane; frozen variant for winter districts (the Rideau Canal in snow). */
export function buildWater(scene: Scene, center: readonly [number, number, number], size: readonly [number, number], frozen: boolean): Mesh {
  const mesh = MeshBuilder.CreateGround('water', { width: size[0], height: size[1], subdivisions: 1 }, scene);
  mesh.position.set(center[0], center[1], center[2]);
  mesh.isPickable = false;
  const mat = new PBRMaterial('water-mat', scene);
  mat.metallic = frozen ? 0.1 : 0.35;
  mat.roughness = frozen ? 0.35 : 0.06;
  mat.albedoColor = frozen ? new Color3(0.85, 0.9, 0.95) : new Color3(0.05, 0.16, 0.24);
  mat.alpha = frozen ? 1 : 0.88;
  mat.environmentIntensity = frozen ? 0.7 : 1.5;
  mesh.material = mat;
  mesh.receiveShadows = true;
  return mesh;
}
