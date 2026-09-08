import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Contract produced by `make assets` (scripts/assets.mjs) at assets/dist/manifest.json. */
export interface AssetManifest {
  readonly version: number;
  readonly textureFormat: 'ktx2' | 'jpg' | 'webp';
  readonly basisTranscoderPath: string;
  readonly dracoDecoderPath: string;
  readonly models: Readonly<Record<string, ModelEntry>>;
  readonly textures: Readonly<Record<string, TextureEntry>>;
  readonly characters: Readonly<Record<string, CharacterEntry>>;
}
export interface ModelEntry {
  readonly path: string;
  readonly lods: readonly string[];
  readonly triangles: Readonly<Record<string, number>>;
  readonly height: number;
  readonly radius: number;
  readonly category: string;
}
export interface TextureEntry {
  readonly diff: string;
  readonly nor?: string;
  readonly arm?: string;
  readonly tileMeters: number;
}
export interface CharacterEntry {
  readonly path: string;
  readonly hair: readonly string[];
  readonly animations: readonly string[];
  readonly skin: Readonly<Record<string, string>>;
}

export interface PbrTextureSet {
  readonly map: THREE.Texture;
  readonly normalMap: THREE.Texture | null;
  readonly armMap: THREE.Texture | null; // R = AO, G = roughness, B = metalness
  readonly tileMeters: number;
}

export interface LoadedModel {
  /** LOD groups (LOD0 = highest detail). Cloned per use. */
  readonly lods: readonly THREE.Object3D[];
  readonly entry: ModelEntry;
}

/**
 * Loads real assets (glTF + KTX2/Draco/Meshopt) described by the manifest. Everything is cached; callers
 * clone what they place in the scene. When no manifest exists (fresh checkout without `make assets`),
 * `available` is false and builders fall back to procedural geometry.
 */
/** Rejects if a load takes too long: a hung transcoder must degrade to procedural, never block the game. */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms loading ${what}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export class AssetLibrary {
  readonly manifest: AssetManifest | null;
  private readonly gltf: GLTFLoader;
  private readonly ktx2: KTX2Loader | null;
  private readonly texLoader = new THREE.TextureLoader();
  private readonly models = new Map<string, Promise<LoadedModel>>();
  private readonly textures = new Map<string, Promise<PbrTextureSet>>();
  private readonly characters = new Map<string, Promise<GLTF>>();
  private readonly loose = new Map<string, Promise<THREE.Texture>>();
  /** Rough GPU cost tracker: phones lose the WebGL context somewhere north of ~500 MB of textures. */
  private textureBudgetBytes = 160 * 1024 * 1024;
  private spentBytes = 0;

  private constructor(
    private readonly base: string,
    manifest: AssetManifest | null,
    renderer: THREE.WebGPURenderer,
  ) {
    this.manifest = manifest;
    this.gltf = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${base}${manifest?.dracoDecoderPath ?? 'draco/'}`);
    this.gltf.setDRACOLoader(draco);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
    if (manifest?.textureFormat === 'ktx2') {
      this.ktx2 = new KTX2Loader().setTranscoderPath(`${base}${manifest.basisTranscoderPath}`);
      this.ktx2.detectSupport(renderer);
      this.gltf.setKTX2Loader(this.ktx2);
    } else {
      this.ktx2 = null;
    }
  }

  static async create(base: string, renderer: THREE.WebGPURenderer, safeMode = false): Promise<AssetLibrary> {
    let manifest: AssetManifest | null = null;
    if (safeMode) return new AssetLibrary(base, null, renderer); // procedural everything: no glTF, no KTX2
    try {
      const res = await fetch(`${base}manifest.json`, { cache: 'no-cache', signal: AbortSignal.timeout(10_000) });
      if (res.ok) manifest = (await res.json()) as AssetManifest;
    } catch {
      manifest = null;
    }
    return new AssetLibrary(base, manifest, renderer);
  }

  setTextureBudget(mb: number): void {
    this.textureBudgetBytes = mb * 1024 * 1024;
  }

  /** True while there is room for more texture memory; builders fall back to untextured when it runs out. */
  get withinBudget(): boolean {
    return this.spentBytes < this.textureBudgetBytes;
  }

  get spentMb(): number {
    return this.spentBytes / 1048576;
  }

  private charge(bytes: number): void {
    this.spentBytes += bytes;
  }

  /** Free everything except the keys still in use (called when a district unloads). */
  releaseUnused(keepModels: readonly string[], keepCharacters: readonly string[]): void {
    for (const [key, p] of [...this.models]) {
      if (keepModels.includes(key)) continue;
      this.models.delete(key);
      void p.then((m) => {
        for (const lod of m.lods) lod.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mat of mats) {
              for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) {
                const tex = (mat as THREE.MeshStandardMaterial)[slot];
                if (tex) tex.dispose();
              }
              mat.dispose();
            }
          }
        });
      }).catch(() => undefined);
    }
    for (const [key, p] of [...this.characters]) {
      if (keepCharacters.includes(key)) continue;
      this.characters.delete(key);
      void p.catch(() => undefined);
    }
    this.spentBytes = 0;
  }

  get available(): boolean {
    return this.manifest !== null;
  }

  hasModel(key: string): boolean {
    return !!this.manifest?.models[key];
  }

  hasTexture(key: string): boolean {
    return !!this.manifest?.textures[key];
  }

  hasCharacter(key: string): boolean {
    return !!this.manifest?.characters[key];
  }

  model(key: string): Promise<LoadedModel> {
    const entry = this.manifest?.models[key];
    if (!entry) return Promise.reject(new Error(`Model ${key} not in manifest`));
    let p = this.models.get(key);
    if (!p) {
      p = withTimeout(this.gltf.loadAsync(`${this.base}${entry.path}`), 25_000, entry.path).then((g) => {
        const lods = entry.lods.map((name) => g.scene.getObjectByName(name) ?? g.scene).map((o) => {
          o.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.castShadow = true;
              c.receiveShadow = true;
              const m = c.material as THREE.MeshStandardMaterial;
              if (m.map) m.map.anisotropy = 8;
            }
          });
          return o;
        });
        return { lods, entry };
      });
      this.models.set(key, p);
    }
    return p;
  }

  texture(key: string): Promise<PbrTextureSet> {
    const entry = this.manifest?.textures[key];
    if (!entry) return Promise.reject(new Error(`Texture ${key} not in manifest`));
    let p = this.textures.get(key);
    if (!p) {
      p = (async () => {
        const [map, normalMap, armMap] = await Promise.all([
          this.loadTexture(entry.diff, true),
          entry.nor ? this.loadTexture(entry.nor, false) : Promise.resolve(null),
          entry.arm ? this.loadTexture(entry.arm, false) : Promise.resolve(null),
        ]);
        return { map, normalMap, armMap, tileMeters: entry.tileMeters };
      })();
      this.textures.set(key, p);
    }
    return p;
  }

  /** Character glTF (SkinnedMesh + clips). Callers must use SkeletonUtils.clone for multiple instances. */
  character(key: string): Promise<GLTF> {
    const entry = this.manifest?.characters[key];
    if (!entry) return Promise.reject(new Error(`Character ${key} not in manifest`));
    let p = this.characters.get(key);
    if (!p) {
      p = withTimeout(this.gltf.loadAsync(`${this.base}${entry.path}`), 30_000, entry.path);
      this.characters.set(key, p);
    }
    return p;
  }

  characterEntry(key: string): CharacterEntry | undefined {
    return this.manifest?.characters[key];
  }

  loadTexture(relPath: string, srgb: boolean): Promise<THREE.Texture> {
    let p = this.loose.get(relPath);
    if (!p) {
      const url = `${this.base}${relPath}`;
      const loader: { loadAsync(url: string): Promise<THREE.Texture> } = relPath.endsWith('.ktx2') && this.ktx2 ? this.ktx2 : this.texLoader;
      p = withTimeout(loader.loadAsync(url), 20_000, relPath).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 8;
        if (!relPath.endsWith('.ktx2')) t.generateMipmaps = true;
        const img = t.image as { width?: number; height?: number } | undefined;
        // Compressed formats cost ~1 byte/texel on iOS (ASTC/ETC); uncompressed costs 4. Mips add a third.
        const texels = (img?.width ?? 1024) * (img?.height ?? 1024);
        this.charge(texels * (relPath.endsWith('.ktx2') ? 1 : 4) * 1.34);
        return t;
      });
      this.loose.set(relPath, p);
    }
    return p;
  }
}
