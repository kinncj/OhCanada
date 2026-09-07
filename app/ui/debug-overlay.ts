import { el } from './dom';

export interface DebugSample {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  memoryMb: number;
  chunks: number;
  backend: string;
  preset: string;
  position: readonly [number, number, number];
}

export class DebugOverlay {
  readonly root = el('div', { class: 'debug', dataset: { testid: 'debug-overlay' } });

  update(s: DebugSample): void {
    this.root.textContent = [
      `${s.backend} · ${s.preset}`,
      `fps ${s.fps.toFixed(0)}  frame ${s.frameMs.toFixed(1)} ms`,
      `draws ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k`,
      `mem ${s.memoryMb.toFixed(0)} MB  chunks ${s.chunks}`,
      `pos ${s.position.map((v) => v.toFixed(1)).join(', ')}`,
    ].join('\n');
    this.root.dataset.fps = s.fps.toFixed(1);
    this.root.dataset.drawCalls = String(s.drawCalls);
  }
}
