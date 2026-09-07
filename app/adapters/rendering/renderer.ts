import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, velocity, nodeObject } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * preset.renderScale;
    this.renderer.setPixelRatio(dpr);
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
    const useAO = p.ssao;
    const useTAA = p.antialias === 'taa';
    if (!useBloom && !useAO && p.antialias === 'none') {
      this.post = null;
      return;
    }
    const scenePass = pass(this.scene, this.camera);
    const mrtSpec: Record<string, THREE.Node> = { output };
    if (useAO) mrtSpec.normal = normalView;
    if (useTAA) mrtSpec.velocity = velocity;
    scenePass.setMRT(mrt(mrtSpec));
    let colorNode = nodeObject(scenePass.getTextureNode('output')) as THREE.Node<'vec4'>;
    const depth = scenePass.getTextureNode('depth');
    if (useAO) {
      const aoPass = ao(depth, scenePass.getTextureNode('normal'), this.camera);
      colorNode = colorNode.mul(aoPass.getTextureNode()) as THREE.Node<'vec4'>;
    }
    if (useBloom) {
      const b = bloom(colorNode, 0.35, 0.4, 0.85);
      colorNode = colorNode.add(b) as THREE.Node<'vec4'>;
    }
    let finalNode: THREE.Node = colorNode;
    if (useTAA) finalNode = traa(colorNode, depth, scenePass.getTextureNode('velocity'), this.camera);
    else if (p.antialias === 'fxaa' || p.antialias === 'msaa') finalNode = fxaa(colorNode);
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
