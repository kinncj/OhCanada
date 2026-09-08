import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import type { GraphicsPreset } from '@application/ports';
import type { RenderStats } from '@application/engine-ports';

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
}

/**
 * Babylon.js engine on WebGL2 (ADR-0010) — its default, best-tested path on Safari and iOS.
 * Post-processing is Babylon's DefaultRenderingPipeline: tone mapping, bloom, FXAA and colour grading.
 */
export class GameRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly backend = 'webgl2';
  private pipeline: DefaultRenderingPipeline | null = null;
  private camera: Camera | null = null;
  private preset: GraphicsPreset | null = null;
  private reducedMotion = false;
  private frameTimes: number[] = [];
  private lastFrame = performance.now();
  private lastInfo = { drawCalls: 0, triangles: 0 };

  private constructor(engine: Engine, scene: Scene) {
    this.engine = engine;
    this.scene = scene;
  }

  static async create(opts: RendererOptions): Promise<GameRenderer> {
    const engine = new Engine(opts.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      // iOS Safari loses the context on tab switches; letting Babylon restore it avoids a dead canvas.
      doNotHandleContextLost: false,
    });
    engine.setHardwareScalingLevel(1);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.62, 0.72, 0.85, 1);
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.05;
    scene.imageProcessingConfiguration.contrast = 1.1;
    scene.skipFrustumClipping = false;
    scene.blockMaterialDirtyMechanism = true;
    return new GameRenderer(engine, scene);
  }

  attach(camera: Camera): void {
    this.camera = camera;
    this.scene.activeCamera = camera;
    if (this.preset) this.buildPipeline();
  }

  applyPreset(preset: GraphicsPreset, reducedMotion: boolean): void {
    this.preset = preset;
    this.reducedMotion = reducedMotion;
    // Babylon scales by dividing: 1 / (dpr * renderScale) gives the same meaning as a pixel ratio.
    const dpr = Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio) * preset.renderScale;
    this.engine.setHardwareScalingLevel(1 / Math.max(0.4, dpr));
    this.resize();
    if (this.camera) this.buildPipeline();
  }

  private buildPipeline(): void {
    if (!this.camera || !this.preset) return;
    this.pipeline?.dispose();
    this.pipeline = null;
    if (!this.preset.postProcessing) return;
    const p = new DefaultRenderingPipeline('post', true, this.scene, [this.camera]);
    p.fxaaEnabled = this.preset.antialias !== 'none';
    p.samples = this.preset.antialias === 'msaa' ? 4 : 1;
    p.bloomEnabled = this.preset.bloom && !this.reducedMotion;
    if (p.bloomEnabled) {
      p.bloomThreshold = 0.85;
      p.bloomWeight = 0.25;
      p.bloomKernel = 48;
      p.bloomScale = 0.5;
    }
    p.imageProcessingEnabled = true;
    if (p.imageProcessing) {
      p.imageProcessing.vignetteEnabled = true;
      p.imageProcessing.vignetteWeight = 2.2;
      p.imageProcessing.contrast = 1.12;
      p.imageProcessing.exposure = 1.05;
    }
    this.pipeline = p;
  }

  resize(): void {
    this.engine.resize();
  }

  render(): void {
    const now = performance.now();
    this.frameTimes.push(now - this.lastFrame);
    this.lastFrame = now;
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    this.scene.render();
    this.lastInfo = { drawCalls: this.scene.getActiveMeshes().length, triangles: this.scene.getActiveIndices() / 3 };
  }

  stats(): RenderStats {
    const avg = this.frameTimes.length ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { fps: avg > 0 ? 1000 / avg : 0, frameMs: avg, drawCalls: this.lastInfo.drawCalls, triangles: this.lastInfo.triangles, memoryMb: mem / 1048576 };
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
