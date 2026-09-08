import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { AssetLibrary, PbrTextureSet } from './asset-library';

/** Materials shared by every landmark in a district: one instance per look, so shaders compile once. */
export interface MaterialKit {
  readonly sandstone: PBRMaterial;
  readonly darkStone: PBRMaterial;
  readonly copper: PBRMaterial;
  readonly wood: PBRMaterial;
  readonly metal: PBRMaterial;
  readonly glass: PBRMaterial;
  readonly brick: PBRMaterial;
  readonly plaster: PBRMaterial;
  readonly concrete: PBRMaterial;
  readonly roof: PBRMaterial;
  readonly white: PBRMaterial;
  readonly flame: PBRMaterial;
  readonly bulb: PBRMaterial;
  readonly red: PBRMaterial;
}

function solid(scene: Scene, name: string, hex: string, roughness: number, metallic = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex);
  m.roughness = roughness;
  m.metallic = metallic;
  return m;
}

function textured(scene: Scene, name: string, set: PbrTextureSet, tileMeters: number, roughness: number, metallic = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  const scale = 1 / tileMeters;
  const apply = (t: PbrTextureSet['albedo'] | null) => {
    if (!t) return;
    t.uScale = scale * 4;
    t.vScale = scale * 4;
  };
  apply(set.albedo);
  apply(set.normal);
  apply(set.arm);
  m.albedoTexture = set.albedo;
  if (set.normal) m.bumpTexture = set.normal;
  if (set.arm) {
    m.metallicTexture = set.arm;
    m.useAmbientOcclusionFromMetallicTextureRed = true;
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useMetallnessFromMetallicTextureBlue = true;
  } else {
    m.roughness = roughness;
    m.metallic = metallic;
  }
  return m;
}

export async function buildMaterialKit(scene: Scene, lib: AssetLibrary | null): Promise<MaterialKit> {
  const tex = async (key: string, tile: number, fallback: PBRMaterial, roughness: number, metallic = 0): Promise<PBRMaterial> => {
    if (!lib?.hasTexture(key)) return fallback;
    try {
      return textured(scene, `kit-${key}`, await lib.texture(key), tile, roughness, metallic);
    } catch {
      return fallback;
    }
  };
  const glass = new PBRMaterial('kit-glass', scene);
  glass.albedoColor = Color3.FromHexString('#223447');
  glass.metallic = 0.9;
  glass.roughness = 0.08;
  glass.environmentIntensity = 1.4;

  const flame = solid(scene, 'kit-flame', '#ff9a2a', 0.4);
  flame.emissiveColor = Color3.FromHexString('#ff6a00');
  flame.emissiveIntensity = 2.5;
  const bulb = solid(scene, 'kit-bulb', '#fff3c4', 0.5);
  bulb.emissiveColor = Color3.FromHexString('#ffe2a0');
  bulb.emissiveIntensity = 1.6;

  const [sandstone, brick, plaster, concrete, roof, wood, metal, copper] = await Promise.all([
    tex('sandstone', 7, solid(scene, 'kit-sandstone', '#b9a98c', 0.85), 0.85),
    tex('brick', 3, solid(scene, 'kit-brick', '#8a4a3a', 0.9), 0.9),
    tex('plaster', 3, solid(scene, 'kit-plaster', '#d9d2c3', 0.85), 0.85),
    tex('concrete', 3, solid(scene, 'kit-concrete', '#9a9a96', 0.9), 0.9),
    tex('roof-grey', 2, solid(scene, 'kit-roof', '#55595e', 0.8), 0.8),
    tex('wood', 1, solid(scene, 'kit-wood', '#6b4a2b', 0.9), 0.9),
    tex('metal', 1, solid(scene, 'kit-metal', '#9aa0a6', 0.35, 0.8), 0.35, 0.8),
    tex('roof-copper', 2, solid(scene, 'kit-copper', '#4f8a72', 0.5, 0.35), 0.5, 0.35),
  ]);
  return {
    sandstone, brick, plaster, concrete, roof, wood, metal, copper, glass, flame, bulb,
    darkStone: solid(scene, 'kit-darkstone', '#6f6a62', 0.9),
    white: solid(scene, 'kit-white', '#f1f1ee', 0.6),
    red: solid(scene, 'kit-red', '#c8102e', 0.5, 0.2),
  };
}
