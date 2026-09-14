import { expect, test, type Page } from '@playwright/test';

import { overdrawVerdict, particleVerdict, textureVerdict } from './budget-rules';
import { CENSUS_GLOBAL, installGlCensus, type CensusSnapshot } from './gl-census';

/**
 * The census, proved against scenes whose answers are known in advance.
 *
 * A measurement nobody has seen get a known answer right is a measurement on
 * trust, and this lane has already shipped two of those. The first version of
 * the census reported 1.89x and then 5.70x overdraw for the same frame - both
 * plausible, both wrong - because it never saw Phaser switch vertex arrays. So
 * before any budget in `budgets.spec.ts` is believed, these scenes check, on
 * every run and on the same runner:
 *
 *   - the covered area of drawn geometry, to the pixel, including clipping at
 *     the viewport edge, vertex-array switching through OES_vertex_array_object,
 *     indexed triangles and non-indexed strips;
 *   - that each verdict the budget rules can return is reachable: HELD, BREACHED,
 *     and NOT MEASURED for a stale vertex read and for an undecodable draw;
 *   - that a texture re-upload replaces bytes rather than adding them, and a
 *     delete gives them back.
 *
 * Nothing here is a Phaser scene, and that is the point: the answer comes from
 * arithmetic on rectangles, not from the thing being measured. WebGL1 with the
 * OES extension, because that is the path the game takes on this runner.
 */

const W = 400;
const H = 200;

async function openScene(page: Page): Promise<void> {
  await page.addInitScript(installGlCensus, CENSUS_GLOBAL);
  await page.goto('about:blank');
}

/** Run a raw-WebGL scene in the page. `frames` is a list of lists of named operations. */
async function runScene(page: Page, frames: readonly (readonly string[])[]): Promise<CensusSnapshot> {
  return page.evaluate(
    ({ frames: plan, width, height, globalName }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.appendChild(canvas);
      const gl = canvas.getContext('webgl');
      if (gl === null) throw new Error('no WebGL context on this host');
      const oes = gl.getExtension('OES_vertex_array_object');
      if (oes === null) throw new Error('OES_vertex_array_object is unavailable');

      const shader = (type: number, source: string): WebGLShader => {
        const s = gl.createShader(type) as WebGLShader;
        gl.shaderSource(s, source);
        gl.compileShader(s);
        return s;
      };
      const program = gl.createProgram() as WebGLProgram;
      gl.attachShader(program, shader(gl.VERTEX_SHADER,
        'attribute vec2 inPosition; void main() { gl_Position = vec4(inPosition.x / 200.0 - 1.0, 1.0 - inPosition.y / 100.0, 0.0, 1.0); }'));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }'));
      gl.linkProgram(program);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'inPosition');

      const quad = (x0: number, y0: number, x1: number, y1: number): number[] => [x0, y0, x1, y0, x1, y1, x0, y1];

      /* VAO 1: indexed quads in a DYNAMIC buffer, rewritten per frame like a batch. */
      const vao1 = oes.createVertexArrayOES();
      oes.bindVertexArrayOES(vao1);
      const batch = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, batch);
      gl.bufferData(gl.ARRAY_BUFFER, 64 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const indices: number[] = [];
      for (let q = 0; q < 8; q += 1) indices.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 3, q * 4);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

      /* VAO 2: a full-screen strip in a STATIC buffer, uploaded once. */
      const vao2 = oes.createVertexArrayOES();
      oes.bindVertexArrayOES(vao2);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, width, 0, 0, height, width, height]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const ops: Record<string, () => void> = {
        /* 2 full + 1 half + 1 fully off-screen + 1 half off-screen = 2.75 screens. */
        batch: () => {
          oes.bindVertexArrayOES(vao1);
          gl.bindBuffer(gl.ARRAY_BUFFER, batch);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([
            ...quad(0, 0, width, height),
            ...quad(0, 0, width, height),
            ...quad(0, 0, width / 2, height),
            ...quad(width + 100, 0, width + 300, height),
            ...quad(width - 100, 0, width + 100, height),
          ]));
          gl.drawElements(gl.TRIANGLES, 30, gl.UNSIGNED_SHORT, 0);
        },
        /* The batch VAO drawn WITHOUT rewriting its dynamic buffer this frame. */
        staleBatch: () => {
          oes.bindVertexArrayOES(vao1);
          gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        },
        /* One full screen, from the static buffer, through the other VAO. */
        strip: () => {
          oes.bindVertexArrayOES(vao2);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        lines: () => {
          oes.bindVertexArrayOES(vao2);
          gl.drawArrays(gl.LINES, 0, 2);
        },
      };

      gl.viewport(0, 0, width, height);
      for (const frame of plan) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const op of frame) (ops[op] as () => void)();
      }
      gl.clear(gl.COLOR_BUFFER_BIT); /* closes the last frame */

      const census = (window as unknown as Record<string, { snapshot: () => unknown }>)[globalName];
      if (census === undefined) throw new Error('the census was not installed');
      return census.snapshot() as CensusSnapshot;
    },
    { frames, width: W, height: H, globalName: CENSUS_GLOBAL },
  );
}

test.describe('particle rule calibration: known readings, known verdicts', () => {
  /* No page: the rule is arithmetic on attribute text, and every exit it has is
     driven here before `budgets.spec.ts` trusts one of them. */
  const at = { allowance: '400', tier: 'high', tierPinned: 'true', formFactor: 'phone', motion: 'full' } as const;

  test('an emitted count at the phone limit is HELD, and one over it is BREACHED', () => {
    expect(particleVerdict({ ...at, emitted: ['unknown', '400'] }).status).toBe('held');
    expect(particleVerdict({ ...at, emitted: ['400', '401'] }).status).toBe('breached');
  });

  test('the limit follows the form factor the page classified', () => {
    expect(particleVerdict({ ...at, formFactor: 'large', allowance: '1500', emitted: ['1200'] }).status).toBe('held');
    expect(particleVerdict({ ...at, formFactor: 'large', emitted: ['1501'] }).status).toBe('breached');
    expect(particleVerdict({ ...at, formFactor: null, emitted: ['400'] }).status).toBe('not-measured');
  });

  test('nothing emitted, never published, or not a count is NOT MEASURED, not a pass', () => {
    expect(particleVerdict({ ...at, emitted: ['0'] }).status).toBe('not-measured');
    expect(particleVerdict({ ...at, emitted: ['unknown'] }).status).toBe('not-measured');
    expect(particleVerdict({ ...at, emitted: [] }).status).toBe('not-measured');
    expect(particleVerdict({ ...at, emitted: ['400', 'nan'] }).status).toBe('not-measured');
  });
});

test.describe('census calibration: known scenes, known answers', () => {
  test('covered area is exact across VAO switches, clipping, indexed triangles and strips', async ({ page }) => {
    await openScene(page);
    const snapshot = await runScene(page, [['batch', 'strip']]);
    const frame = snapshot.frames.at(-1);

    expect(frame, 'the census closed no frame').toBeDefined();
    expect(frame?.undecoded).toEqual([]);
    expect(frame?.staleReads).toBe(0);
    expect(frame?.draws).toBe(2);
    expect(frame?.triangles).toBe(12);
    expect(frame?.screenPx).toBe(W * H);
    /* 2.75 screens of batch plus 1 of strip. */
    expect((frame?.areaPx ?? 0) / (W * H)).toBeCloseTo(3.75, 9);

    const verdict = overdrawVerdict(snapshot, { minFrames: 1 });
    expect(verdict.status).toBe('held');
    expect(verdict.measured).toBeCloseTo(3.75, 9);
  });

  test('a scene over four screens is BREACHED, not merely large', async ({ page }) => {
    await openScene(page);
    const snapshot = await runScene(page, [['batch', 'strip', 'strip']]);
    const verdict = overdrawVerdict(snapshot, { minFrames: 1 });

    expect(verdict.status).toBe('breached');
    expect(verdict.measured).toBeCloseTo(4.75, 9);
    expect(verdict.limit).toBe(4);
  });

  test('a stale vertex read is NOT MEASURED, not a smaller number', async ({ page }) => {
    await openScene(page);
    const snapshot = await runScene(page, [['batch'], ['staleBatch']]);
    const verdict = overdrawVerdict(snapshot, { minFrames: 1 });

    expect(snapshot.frames.at(-1)?.staleReads).toBe(1);
    expect(verdict.status).toBe('not-measured');
    expect(verdict.measured).toBeUndefined();
    expect(verdict.detail).toMatch(/lost track of vertex state/);
  });

  test('a draw with no triangle area is NOT MEASURED, not ignored', async ({ page }) => {
    await openScene(page);
    const snapshot = await runScene(page, [['strip', 'lines']]);
    const verdict = overdrawVerdict(snapshot, { minFrames: 1 });

    expect(verdict.status).toBe('not-measured');
    expect(verdict.detail).toMatch(/primitive mode 0x1 has no triangle area/);
  });

  test('a page that draws nothing is NOT MEASURED, and so is one with too few frames', async ({ page }) => {
    await openScene(page);
    const empty = await runScene(page, [[]]);
    expect(overdrawVerdict(empty, { minFrames: 1 }).status).toBe('not-measured');

    /* A fresh document: two canvases in one page is its own NOT MEASURED ("no
       single screen"), which is a different case from the one this asserts. */
    await page.goto('about:blank');
    const drawn = await runScene(page, [['strip']]);
    const tooFew = overdrawVerdict(drawn, { minFrames: 5 });
    expect(tooFew.status).toBe('not-measured');
    expect(tooFew.detail).toMatch(/only 1 frame/);
  });

  test('texture bytes are replaced on re-upload, returned on delete, and refused when unsized', async ({ page }) => {
    await openScene(page);
    const read = (): Promise<CensusSnapshot> =>
      page.evaluate((name) => (window as unknown as Record<string, { snapshot: () => CensusSnapshot }>)[name]?.snapshot() as CensusSnapshot, CENSUS_GLOBAL);

    const handles = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      const gl = canvas.getContext('webgl') as WebGLRenderingContext;
      const a = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, a);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const source = document.createElement('canvas');
      source.width = 64;
      source.height = 32;
      const b = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, b);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      (window as unknown as Record<string, unknown>)['__tnCal'] = { gl, a };
      return true;
    });
    expect(handles).toBe(true);

    const afterUploads = (await read()).contexts.at(-1);
    expect(afterUploads?.textureBytes, 'a re-upload must replace, not add').toBe(256 * 256 * 4 + 64 * 32 * 4);
    expect(afterUploads?.liveTextures).toBe(2);

    await page.evaluate(() => {
      const cal = (window as unknown as Record<string, { gl: WebGLRenderingContext; a: WebGLTexture }>)['__tnCal'];
      cal?.gl.deleteTexture(cal.a);
    });
    const afterDelete = await read();
    expect(afterDelete.contexts.at(-1)?.textureBytes).toBe(64 * 32 * 4);
    expect(afterDelete.contexts.at(-1)?.peakTextureBytes).toBe(256 * 256 * 4 + 64 * 32 * 4);

    const limit = { bytes: 1_048_576, source: 'calibration' };
    expect(textureVerdict(afterDelete, limit, 'no manifest in calibration').status).toBe('held');
    expect(textureVerdict(afterDelete, { bytes: 1_000, source: 'calibration' }, 'none').status).toBe('breached');

    await page.evaluate(() => {
      const cal = (window as unknown as Record<string, { gl: WebGLRenderingContext }>)['__tnCal'];
      const gl = cal?.gl as WebGLRenderingContext;
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      /* An invalid type: GL rejects it, and the census must not guess a size for it. */
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 8, 8, 0, gl.RGBA, 0x1234, null);
    });
    const unsized = textureVerdict(await read(), limit, 'none');
    expect(unsized.status).toBe('not-measured');
    expect(unsized.detail).toMatch(/could not be sized/);
  });
});
