import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DracoDecoder } from '@babylonjs/core/Meshes/Compression/dracoDecoder';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF/2.0';

/** Contract produced by `make assets` at assets/dist/manifest.json (shared with the pipeline). */
export interface AssetManifest {
  readonly version: number;
  readonly textureFormat: 'ktx2' | 'jpg' | 'webp';
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
  readonly albedo: Texture;
  readonly normal: Texture | null;
  /** Packed occlusion (R), roughness (G), metalness (B). */
  readonly arm: Texture | null;
  readonly tileMeters: number;
}

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

/**
 * Loads the manifest's glTF models, PBR texture sets and characters into Babylon. Everything is cached as an
 * AssetContainer so callers instantiate copies. With no manifest (or in safe mode) `available` is false and
 * every builder falls back to procedural geometry.
 */
export class AssetLibrary {
  readonly manifest: AssetManifest | null;
  private readonly containers = new Map<string, Promise<AssetContainer>>();
  private readonly textures = new Map<string, Promise<PbrTextureSet>>();
  private readonly loose = new Map<string, Promise<Texture>>();

  private constructor(
    private readonly base: string,
    manifest: AssetManifest | null,
    private readonly scene: Scene,
  ) {
    this.manifest = manifest;
    // Babylon ships the Draco decoder locally; no CDN fetch (ADR-0005).
    DracoDecoder.DefaultConfiguration = {
      wasmUrl: `${base}draco/draco_wasm_wrapper_gltf.js`,
      wasmBinaryUrl: `${base}draco/draco_decoder_gltf.wasm`,
      fallbackUrl: `${base}draco/draco_decoder_gltf.js`,
    };
  }

  static async create(base: string, scene: Scene, safeMode = false): Promise<AssetLibrary> {
    if (safeMode) return new AssetLibrary(base, null, scene);
    let manifest: AssetManifest | null = null;
    try {
      const res = await fetch(`${base}manifest.json`, { cache: 'no-cache', signal: AbortSignal.timeout(10_000) });
      if (res.ok) manifest = (await res.json()) as AssetManifest;
    } catch {
      manifest = null;
    }
    return new AssetLibrary(base, manifest, scene);
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
  modelEntry(key: string): ModelEntry | undefined {
    return this.manifest?.models[key];
  }
  characterEntry(key: string): CharacterEntry | undefined {
    return this.manifest?.characters[key];
  }

  /** Cached container for a manifest model; callers use `instantiateModelsToScene` or clone meshes. */
  container(key: string): Promise<AssetContainer> {
    const entry = this.manifest?.models[key] ?? this.manifest?.characters[key];
    if (!entry) return Promise.reject(new Error(`Asset ${key} not in manifest`));
    let p = this.containers.get(key);
    if (!p) {
      const path = entry.path;
      const dir = `${this.base}${path.slice(0, path.lastIndexOf('/') + 1)}`;
      const file = path.slice(path.lastIndexOf('/') + 1);
      p = withTimeout(SceneLoader.LoadAssetContainerAsync(dir, file, this.scene), 30_000, path);
      this.containers.set(key, p);
    }
    return p;
  }

  texture(key: string): Promise<PbrTextureSet> {
    const entry = this.manifest?.textures[key];
    if (!entry) return Promise.reject(new Error(`Texture ${key} not in manifest`));
    let p = this.textures.get(key);
    if (!p) {
      p = (async () => {
        const [albedo, normal, arm] = await Promise.all([
          this.loadTexture(entry.diff, true),
          entry.nor ? this.loadTexture(entry.nor, false) : Promise.resolve(null),
          entry.arm ? this.loadTexture(entry.arm, false) : Promise.resolve(null),
        ]);
        return { albedo, normal, arm, tileMeters: entry.tileMeters };
      })();
      this.textures.set(key, p);
    }
    return p;
  }

  loadTexture(relPath: string, srgb: boolean): Promise<Texture> {
    let p = this.loose.get(relPath);
    if (!p) {
      p = withTimeout(
        new Promise<Texture>((resolve, reject) => {
          const t = new Texture(
            `${this.base}${relPath}`,
            this.scene,
            { noMipmap: false, invertY: false, samplingMode: Texture.TRILINEAR_SAMPLINGMODE, onLoad: () => resolve(t), onError: (message?: string) => reject(new Error(message ?? `Failed to load ${relPath}`)) },
          );
          t.wrapU = Texture.WRAP_ADDRESSMODE;
          t.wrapV = Texture.WRAP_ADDRESSMODE;
          t.anisotropicFilteringLevel = 8;
          if (!srgb) t.gammaSpace = false;
        }),
        20_000,
        relPath,
      );
      this.loose.set(relPath, p);
    }
    return p;
  }
}
