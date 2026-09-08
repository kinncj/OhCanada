import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, velocity, nodeObject, uv, vec3, vec4, float, mix, metalness, roughness } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import type { GraphicsPreset } from '@application/ports';
import type { RenderStats } from '@application/engine-ports';

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly forceWebGL?: boolean;
}

/**
 * Three.js WebGPURenderer with automatic WebGL2 fallback. Post-processing is built with TSL nodes
 * so the same chain runs on both backends (ADR-0002).
 */
export class GameRenderer {
  readonly renderer: THREE.WebGPURenderer;
  readonly backend: 'webgpu' | 'webgl2';
  private post: THREE.RenderPipeline | null = null;
  private preset: GraphicsPreset | null = null;
  private reducedMotion = false;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private frameTimes: number[] = [];
  private lastFrame = performance.now();
  private lastInfo = { drawCalls: 0, triangles: 0 };
  private blankFrames = 0;
  /** Set when the blank-frame watchdog has already disabled post-processing. */
  postDisabled = false;

  private constructor(renderer: THREE.WebGPURenderer, backend: 'webgpu' | 'webgl2') {
    this.renderer = renderer;
    this.backend = backend;
  }

  static async create(opts: RendererOptions): Promise<GameRenderer> {
    const hasWebGPU = !opts.forceWebGL && typeof navigator !== 'undefined' && 'gpu' in navigator;
    const renderer = new THREE.WebGPURenderer({ canvas: opts.canvas, antialias: false, forceWebGL: !hasWebGPU, powerPreference: 'high-performance' });
    await renderer.init();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
    return new GameRenderer(renderer, backend);
  }

  attach(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;
    if (this.preset) this.buildPost();
  }

  applyPreset(preset: GraphicsPreset, reducedMotion: boolean): void {
    this.preset = preset;
    this.reducedMotion = reducedMotion;
    const dpr = Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio) * preset.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = preset.shadows;
    this.resize();
    if (this.scene && this.camera) this.buildPost();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildPost(): void {
    if (!this.scene || !this.camera || !this.preset) return;
    const p = this.preset;
    const useBloom = p.bloom && !this.reducedMotion;
    // GTAO / TRAA / SSGI / SSR nodes only compile on the WebGPU backend today; WebGL2 falls back to FXAA.
    const advanced = this.backend === 'webgpu';
    const useAO = p.ssao && advanced;
    const useTAA = p.antialias === 'taa' && advanced;
    const useGI = p.screenSpaceGI === true && advanced;
    if (!p.postProcessing) {
      this.post = null;
      return;
    }
    const scenePass = pass(this.scene, this.camera);
    const mrtSpec: Record<string, THREE.Node> = { output };
    if (useAO || useGI) mrtSpec.normal = normalView;
    if (useTAA) mrtSpec.velocity = velocity;
    if (useGI) {
      mrtSpec.metalrough = vec4(metalness, roughness, 0, 0);
    }
    scenePass.setMRT(mrt(mrtSpec));
    let colorNode = nodeObject(scenePass.getTextureNode('output')) as THREE.Node<'vec4'>;
    const depth = scenePass.getTextureNode('depth');
    if (useGI) {
      // Ultra: screen-space GI (denoised) for bounce light, then SSR for wet/metallic/glass surfaces.
      const normal = scenePass.getTextureNode('normal') as unknown as THREE.Node<'vec3'>;
      const gi = nodeObject(ssgi(colorNode, depth, normal, this.camera)) as unknown as THREE.Node<'vec4'>;
      const giDenoised = nodeObject(denoise(gi, depth, normal, this.camera)) as unknown as THREE.Node<'vec4'>;
      colorNode = colorNode.add(giDenoised.mul(0.6)) as THREE.Node<'vec4'>;
      const mr = scenePass.getTextureNode('metalrough');
      const reflections = ssr(colorNode, depth, normal, { camera: this.camera, metalnessNode: mr.r, roughnessNode: mr.g, reflectNonMetals: true }) as unknown as THREE.Node<'vec4'>;
      colorNode = colorNode.add(reflections.mul(0.7)) as THREE.Node<'vec4'>;
    }
    if (useAO) {
      const aoPass = ao(depth, scenePass.getTextureNode('normal'), this.camera);
      colorNode = colorNode.mul(aoPass.getTextureNode()) as THREE.Node<'vec4'>;
    }
    if (useBloom) {
      const b = bloom(colorNode, 0.35, 0.4, 0.85);
      colorNode = colorNode.add(b) as THREE.Node<'vec4'>;
    }
    // Colour grading: gentle filmic contrast, a touch of warmth in highlights and cool shadows, plus vignette.
    const graded = grade(colorNode);
    let finalNode: THREE.Node = graded;
    if (useTAA) finalNode = traa(graded, depth, scenePass.getTextureNode('velocity'), this.camera);
    else if (p.antialias !== 'none') finalNode = fxaa(graded);
    const post = new THREE.RenderPipeline(this.renderer);
    post.outputNode = finalNode;
    this.post = post;
  }

  async render(): Promise<void> {
    if (!this.scene || !this.camera) return;
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
    this.lastInfo = { drawCalls: this.renderer.info.render.drawCalls, triangles: this.renderer.info.render.triangles };
    // Watchdog: a scene with content that draws nothing means the pipeline failed silently (this is what a
    // black canvas with a working HUD looks like). Drop post-processing, which is the fragile part.
    if (this.post && !this.postDisabled && this.scene.children.length > 2) {
      this.blankFrames = this.lastInfo.drawCalls === 0 ? this.blankFrames + 1 : 0;
      if (this.blankFrames > 90) {
        console.warn('[truenorth] no draw calls for 90 frames — disabling post-processing');
        this.post = null;
        this.postDisabled = true;
        this.blankFrames = 0;
      }
    }
  }

  stats(): RenderStats {
    const avg = this.frameTimes.length ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { fps: avg > 0 ? 1000 / avg : 0, frameMs: avg, drawCalls: this.lastInfo.drawCalls, triangles: this.lastInfo.triangles, memoryMb: mem / 1048576 };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

/** Filmic-ish grade in TSL: lift shadows slightly cool, warm highlights, mild S-curve, vignette. */
function grade(input: THREE.Node<'vec4'>): THREE.Node<'vec4'> {
  const c = input.rgb;
  const lum = c.dot(vec3(0.2126, 0.7152, 0.0722));
  const shadowTint = vec3(0.97, 0.99, 1.04);
  const highlightTint = vec3(1.04, 1.01, 0.96);
  const tinted = c.mul(mix(shadowTint, highlightTint, lum.smoothstep(0.1, 0.9)));
  const contrast = tinted.sub(0.5).mul(1.06).add(0.5);
  const saturated = mix(vec3(lum), contrast, 1.08);
  const d = uv().sub(0.5).length();
  const vignette = float(1).sub(d.smoothstep(0.45, 0.95).mul(0.35));
  return vec4(saturated.mul(vignette), input.a);
}
