import type { Page } from '@playwright/test';

/**
 * What the device lane needs to know about the machine before it believes a
 * millisecond: which renderer is drawing, and whether it is a GPU at all.
 *
 * Reading the renderer name to classify it is not the leak ADR-0011 forbids.
 * The string stays in the test process and in the operator's own record; it is
 * never rendered, stored by the game, or sent anywhere. What that ADR bans is
 * publishing it to a visitor.
 */
export interface Host {
  readonly renderer: string;
  readonly software: boolean;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic/i;

export async function inspectHost(page: Page): Promise<Host> {
  const renderer = await page.evaluate(() => {
    const gl =
      document.createElement('canvas').getContext('webgl2') ??
      document.createElement('canvas').getContext('webgl');
    if (gl === null) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info === null ? 'unnamed (WEBGL_debug_renderer_info unavailable)' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
  });
  return { renderer: renderer === '' ? 'no WebGL context' : renderer, software: renderer === '' || SOFTWARE.test(renderer) };
}

export const softwareRefusal = (host: Host): string =>
  `this host rasterises in software (${host.renderer}), so a millisecond measured here is the cost of a CPU ` +
  'emulating a GPU. Run the device lane on hardware with a GPU (tests/perf/README.md)';
