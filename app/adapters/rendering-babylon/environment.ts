import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointsCloudSystem } from '@babylonjs/core/Particles/pointsCloudSystem';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { Ambience } from '@domain/district';
import type { GraphicsPreset } from '@application/ports';

/** Sun, sky dome, fog and the day/night cycle. */
export class Environment {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphericLight;
  shadows: CascadedShadowGenerator | null = null;
  private readonly sky: Mesh;
  private readonly skyMaterial: SkyMaterial;
  private stars: Mesh | null = null;
  private timeOfDay = 0.4;
  private cycleSpeed = 0;
  private useSky = true;
  private readonly fogColor = new Color3();

  constructor(private readonly scene: Scene) {
    this.sun = new DirectionalLight('sun', new Vector3(-0.4, -0.8, -0.3), scene);
    this.sun.intensity = 3;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 400;
    this.hemi = new HemisphericLight('sky-fill', new Vector3(0, 1, 0), scene);
    this.hemi.intensity = 0.5;
    this.hemi.diffuse = new Color3(0.75, 0.84, 1);
    this.hemi.groundColor = new Color3(0.35, 0.3, 0.22);

    this.skyMaterial = new SkyMaterial('sky-material', scene);
    this.skyMaterial.backFaceCulling = false;
    this.skyMaterial.useSunPosition = true;
    this.skyMaterial.luminance = 1;
    this.sky = MeshBuilder.CreateBox('sky', { size: 4000 }, scene);
    this.sky.material = this.skyMaterial;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;
    this.sky.applyFog = false;

    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.004;
    scene.fogColor = new Color3(0.81, 0.85, 0.9);
  }

  async load(ambience: Ambience, preset: GraphicsPreset, cycleEnabled: boolean, worldSize = 260): Promise<void> {
    this.timeOfDay = ambience.timeOfDay;
    this.cycleSpeed = cycleEnabled ? 1 / 3600 : 0;
    const w = ambience.weather;
    this.skyMaterial.turbidity = w === 'fog' ? 14 : w === 'rain' ? 10 : w === 'snow' ? 6 : 3;
    this.skyMaterial.rayleigh = w === 'rain' || w === 'fog' ? 0.6 : 2;
    this.skyMaterial.mieCoefficient = w === 'fog' ? 0.02 : 0.005;
    this.skyMaterial.mieDirectionalG = w === 'snow' ? 0.85 : 0.8;
    // Fog reach scales with the map: a density tuned for a 260 m block turns a 1.3 km district into haze.
    const reach = (w === 'fog' ? 2.2 : w === 'rain' || w === 'snow' ? 1.4 : 0.85) / Math.max(120, worldSize);
    this.scene.fogDensity = Math.min(ambience.fogDensity ?? 0.004, reach);
    this.useSky = preset.assetPolicy !== 'lite';
    this.sky.setEnabled(this.useSky);

    this.shadows?.dispose();
    this.shadows = null;
    if (preset.shadows) {
      const gen = new CascadedShadowGenerator(preset.shadowMapSize, this.sun);
      gen.numCascades = Math.min(4, Math.max(2, preset.shadowCascades));
      gen.lambda = 0.85;
      gen.stabilizeCascades = true;
      gen.shadowMaxZ = Math.min(400, preset.drawDistance);
      gen.bias = 0.008;
      gen.normalBias = 0.02;
      gen.usePercentageCloserFiltering = preset.shadowMapSize >= 2048;
      gen.filteringQuality = CascadedShadowGenerator.QUALITY_MEDIUM;
      this.shadows = gen;
    }
    if (!this.stars && this.useSky) this.buildStars();
    this.update(0, Vector3.Zero());
  }

  private buildStars(): void {
    const pcs = new PointsCloudSystem('stars', 2, this.scene);
    pcs.addPoints(700, (particle: { position: Vector3; color: Color4 }) => {
      const u = Math.random();
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      particle.position = new Vector3(Math.cos(a) * r * 1800, u * 1800 + 60, Math.sin(a) * r * 1800);
      particle.color = new Color4(0.9, 0.94, 1, 1);
    });
    void pcs.buildMeshAsync().then((mesh) => {
      mesh.isPickable = false;
      mesh.applyFog = false;
      mesh.infiniteDistance = true;
      const m = new StandardMaterial('stars-mat', this.scene);
      m.emissiveColor = new Color3(0.9, 0.94, 1);
      m.disableLighting = true;
      m.alpha = 0;
      mesh.material = m;
      this.stars = mesh;
    });
  }

  update(dt: number, focus: Vector3): void {
    this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed) % 1;
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const elev = Math.sin(angle);
    const dir = new Vector3(Math.cos(angle) * 0.6, elev, Math.sin(angle) * 0.4 + 0.3).normalize();
    this.sun.direction = dir.scale(-1);
    this.sun.position = focus.add(dir.scale(180));
    const day = Math.min(1, Math.max(0, elev * 1.6 + 0.2));
    const dusk = Math.min(1, Math.max(0, 1 - Math.abs(elev) * 4));
    this.sun.intensity = 0.15 + day * 3.4;
    this.sun.diffuse = Color3.FromHSV((32 - dusk * 20) % 360, 0.35 + dusk * 0.35, 1);
    this.hemi.intensity = 0.12 + day * 0.6;
    if (this.useSky) this.skyMaterial.sunPosition = dir.scale(1000);
    this.fogColor.set(0.1 + day * 0.62, 0.13 + day * 0.62, 0.2 + day * 0.6);
    this.scene.fogColor = this.fogColor;
    this.scene.clearColor = new Color4(this.fogColor.r, this.fogColor.g, this.fogColor.b, 1);
    if (this.stars?.material) {
      const night = Math.min(1, Math.max(0, -elev * 3));
      this.stars.material.alpha = this.useSky ? night * 0.9 : 0;
      this.stars.setEnabled(night > 0.01 && this.useSky);
    }
  }

  get isNight(): boolean {
    return Math.sin((this.timeOfDay - 0.25) * Math.PI * 2) < 0.05;
  }

  get time(): number {
    return this.timeOfDay;
  }

  dispose(): void {
    this.shadows?.dispose();
    this.sky.dispose();
    this.skyMaterial.dispose();
    this.stars?.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
