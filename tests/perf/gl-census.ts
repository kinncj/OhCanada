/**
 * The GL census: what the page asked the GPU to do, counted at the API.
 *
 * ## Why this exists
 *
 * Every earlier version of this suite timed frames on a GitHub runner, and a
 * runner has no GPU. Chromium rasterises on SwiftShader there, so a frame time
 * is a property of a CPU emulating a GPU, and the job failed or reported on
 * every run without once describing the build (tests/perf/README.md has the
 * history). What a software rasteriser does NOT change is the work it is
 * handed: the same build submits the same draw calls, the same triangles over
 * the same pixels, and uploads the same textures, on SwiftShader and on an
 * iPhone. That work is what CLAUDE.md budgets in pixels and bytes - overdraw
 * <= 4x screen area, decoded texture memory <= 64 MiB a level - and it is what
 * this module counts.
 *
 * It wraps the WebGL context from outside the page (`page.addInitScript`), so
 * the game is measured as it ships: no app code, no build flag, no probe the
 * game has to cooperate with.
 *
 * ## What it counts, per frame and per context
 *
 *   - draw calls and triangles;
 *   - **covered area**: every triangle clipped to the viewport (and to the
 *     scissor box while the scissor test is on), summed. Divided by the
 *     viewport's area this is overdraw - how many screens of fragments the GPU
 *     shades - which is independent of how fast it shades them;
 *   - **texture bytes resident**, per texture, per face and mip level, so a
 *     re-upload REPLACES what it replaces rather than adding to it (a canvas
 *     texture re-uploaded every frame would otherwise read as a leak), and a
 *     delete gives the bytes back;
 *   - renderbuffer bytes, separately, because they are not textures.
 *
 * ## What it refuses to guess
 *
 * A number this module cannot stand behind is not rounded into one it can.
 * Every draw it could not decode, every upload whose size it could not derive,
 * and every **stale read** is recorded with a reason, and the verdict layer
 * turns any of them into NOT MEASURED rather than into a smaller total.
 *
 * The stale-read check exists because the first version of this census was
 * wrong in exactly that way, and plausibly. Phaser binds its vertex arrays
 * through `OES_vertex_array_object` on a WebGL1 context; the prototype wrapped
 * only WebGL2's `bindVertexArray`, so every draw decoded its positions from the
 * buffer bound at start-up, and the census reported 1.89x and then 5.70x
 * overdraw - both confident, both wrong, one a false breach. A position read
 * from a DYNAMIC buffer that nothing wrote this frame is the signature of that
 * mistake (a batch buffer is rewritten before every draw that uses it), so it is
 * detected rather than trusted. STATIC buffers are exempt: a mesh uploaded once
 * and drawn forever is legitimate and must not read as a broken probe.
 *
 * Everything inside `installGlCensus` runs IN THE PAGE and is serialised by
 * Playwright, so it may not close over anything declared outside it.
 */

export interface CensusDraw {
  readonly mode: number;
  readonly triangles: number;
  readonly areaPx: number;
  readonly offscreen: boolean;
}

export interface CensusFrame {
  readonly context: number;
  /**
   * `performance.now()` when the frame began. Lets a caller attribute each frame
   * to whatever was true in the page at that moment - the visual tier, above all,
   * which a host can change many times a minute.
   */
  readonly startedAt: number;
  readonly draws: number;
  readonly triangles: number;
  /** Area covered in the default framebuffer, clipped to viewport and scissor. */
  readonly areaPx: number;
  /** Viewport area of the default framebuffer when the frame began. */
  readonly screenPx: number;
  /** Area drawn into framebuffer objects: real cost, not screen area. */
  readonly offscreenAreaPx: number;
  /** Why a draw's area is unknown. Empty means every draw was decoded. */
  readonly undecoded: readonly string[];
  /** Draws whose positions came from a dynamic buffer nothing wrote this frame. */
  readonly staleReads: number;
  readonly perDraw: readonly CensusDraw[];
}

export interface CensusContext {
  readonly index: number;
  readonly type: string;
  readonly renderer: string;
  readonly attached: boolean;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly maxTextureUnits: number;
  readonly vertexArrayObjects: 'webgl2' | 'oes' | 'none-seen';
  readonly textureBytes: number;
  readonly peakTextureBytes: number;
  readonly renderbufferBytes: number;
  readonly liveTextures: number;
  /** Level-0 width x height of each live texture, for reconciling against the manifest. */
  readonly liveTextureSizes: readonly (readonly [number, number, number])[];
  /** Why an upload's size is unknown. Empty means every allocation was sized. */
  readonly unsizedUploads: readonly string[];
  readonly framesSeen: number;
}

export interface CensusSnapshot {
  readonly contexts: readonly CensusContext[];
  readonly frames: readonly CensusFrame[];
}

/** The name the census answers to in the page. */
export const CENSUS_GLOBAL = '__tnGlCensus';

/**
 * Install the census. Pass to `page.addInitScript` BEFORE the first navigation,
 * so it wraps `getContext` before the game asks for one.
 */
export function installGlCensus(globalName: string): void {
  type Fn = (...args: unknown[]) => unknown;
  type Obj = Record<string, unknown>;
  type Point = readonly [number, number];

  interface BufferInfo {
    bytes: Uint8Array;
    dynamic: boolean;
    writtenAtFrame: number;
  }
  interface Attrib {
    buffer: object | null;
    size: number;
    type: number;
    stride: number;
    offset: number;
  }
  interface VaoState {
    attribs: Map<number, Attrib>;
    element: object | null;
  }
  interface FrameAcc {
    startedAt: number;
    draws: number;
    triangles: number;
    areaPx: number;
    screenPx: number;
    offscreenAreaPx: number;
    undecoded: string[];
    staleReads: number;
    perDraw: { mode: number; triangles: number; areaPx: number; offscreen: boolean }[];
  }
  interface ContextAcc {
    index: number;
    type: string;
    renderer: string;
    canvas: { width: number; height: number; isConnected?: boolean };
    maxTextureUnits: number;
    vertexArrayObjects: 'webgl2' | 'oes' | 'none-seen';
    textureBytes: number;
    peakTextureBytes: number;
    renderbufferBytes: number;
    textures: Map<object, Map<string, number>>;
    textureSizes: Map<object, [number, number, number]>;
    renderbuffers: Map<object, number>;
    unsizedUploads: string[];
    framesSeen: number;
  }

  /* Enough for a 25 s observation at 60 fps; a frame record is a handful of numbers. */
  const RING = 2_000;
  const contexts: ContextAcc[] = [];
  const frames: (FrameAcc & { context: number })[] = [];
  const instrumented = new WeakSet<object>();

  const GL = {
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLE_FAN: 0x0006,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88e4,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    HALF_FLOAT: 0x140b,
    HALF_FLOAT_OES: 0x8d61,
    UNSIGNED_SHORT_4_4_4_4: 0x8033,
    UNSIGNED_SHORT_5_5_5_1: 0x8034,
    UNSIGNED_SHORT_5_6_5: 0x8363,
    ALPHA: 0x1906,
    RGB: 0x1907,
    RGBA: 0x1908,
    LUMINANCE: 0x1909,
    LUMINANCE_ALPHA: 0x190a,
    TEXTURE_2D: 0x0de1,
    TEXTURE_CUBE_MAP: 0x8513,
    CUBE_FIRST: 0x8515,
    CUBE_LAST: 0x851a,
    TEXTURE0: 0x84c0,
    SCISSOR_TEST: 0x0c11,
    FRAMEBUFFER: 0x8d40,
    DRAW_FRAMEBUFFER: 0x8ca9,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
    COLOR_BUFFER_BIT: 0x4000,
  } as const;

  /** Bytes per pixel for an unsized (WebGL1-style) format/type pair, or null. */
  const unsizedBytesPerPixel = (format: number, type: number): number | null => {
    const components: Record<number, number> = {
      [GL.RGBA]: 4,
      [GL.RGB]: 3,
      [GL.LUMINANCE_ALPHA]: 2,
      [GL.LUMINANCE]: 1,
      [GL.ALPHA]: 1,
    };
    const count = components[format];
    if (count === undefined) return null;
    if (type === GL.UNSIGNED_BYTE) return count;
    if (
      type === GL.UNSIGNED_SHORT_4_4_4_4 ||
      type === GL.UNSIGNED_SHORT_5_5_5_1 ||
      type === GL.UNSIGNED_SHORT_5_6_5
    )
      return 2;
    if (type === GL.FLOAT) return count * 4;
    if (type === GL.HALF_FLOAT || type === GL.HALF_FLOAT_OES) return count * 2;
    return null;
  };

  /** WebGL1's unsized internal formats: their size comes from format + type, never from this table. */
  const UNSIZED_FORMATS: readonly number[] = [GL.RGBA, GL.RGB, GL.ALPHA, GL.LUMINANCE, GL.LUMINANCE_ALPHA];

  /**
   * Bytes per pixel for a texImage2D, choosing the right table.
   *
   * An unsized internal format (WebGL1's RGBA, RGB, ...) says nothing about size
   * by itself - RGBA with UNSIGNED_BYTE is 4 B/px and RGBA with FLOAT is 16 - so
   * its size is derived from format + type or not at all. Reading RGBA as "4" was
   * this census's first texture defect: an upload GL rejected for an invalid type
   * was counted at 4 B/px, and the calibration suite caught it.
   */
  const texImageBytesPerPixel = (internalFormat: number, format: number, type: number): number | null =>
    UNSIZED_FORMATS.includes(internalFormat)
      ? unsizedBytesPerPixel(format, type)
      : sizedBytesPerPixel(internalFormat);

  /** Bytes per pixel for the sized internal formats a 2D game plausibly allocates, or null. */
  const sizedBytesPerPixel = (internalFormat: number): number | null => {
    const table: Record<number, number> = {
      0x8058: 4, // RGBA8
      0x8c43: 4, // SRGB8_ALPHA8
      0x8051: 3, // RGB8
      0x8229: 1, // R8
      0x822b: 2, // RG8
      0x881a: 8, // RGBA16F
      0x8814: 16, // RGBA32F
      0x8056: 2, // RGBA4
      0x8d62: 2, // RGB565
      0x81a5: 2, // DEPTH_COMPONENT16
      0x88f0: 4, // DEPTH24_STENCIL8
      0x8d48: 1, // STENCIL_INDEX8
      [GL.RGBA]: 4,
      [GL.RGB]: 3,
    };
    return table[internalFormat] ?? null;
  };

  const sourceSize = (source: unknown): [number, number] | null => {
    if (source === null || typeof source !== 'object') return null;
    const s = source as Obj;
    const pick = (...keys: string[]): number => {
      for (const key of keys) {
        const value = s[key];
        if (typeof value === 'number' && value > 0) return value;
      }
      return 0;
    };
    const width = pick('videoWidth', 'naturalWidth', 'displayWidth', 'codedWidth', 'width');
    const height = pick('videoHeight', 'naturalHeight', 'displayHeight', 'codedHeight', 'height');
    return width > 0 && height > 0 ? [width, height] : null;
  };

  /** Area of a triangle clipped to an axis-aligned rectangle (Sutherland-Hodgman). */
  const clippedArea = (tri: readonly Point[], rect: readonly [number, number, number, number]): number => {
    const [x0, y0, x1, y1] = rect;
    if (x1 <= x0 || y1 <= y0) return 0;
    let poly: Point[] = [...tri];
    const edge = (inside: (p: Point) => boolean, cross: (a: Point, b: Point) => Point): void => {
      const out: Point[] = [];
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Point;
        const b = poly[(i + 1) % poly.length] as Point;
        const ai = inside(a);
        if (ai) out.push(a);
        if (ai !== inside(b)) out.push(cross(a, b));
      }
      poly = out;
    };
    const atX = (x: number) => (a: Point, b: Point): Point => {
      const t = (x - a[0]) / (b[0] - a[0]);
      return [x, a[1] + (b[1] - a[1]) * t];
    };
    const atY = (y: number) => (a: Point, b: Point): Point => {
      const t = (y - a[1]) / (b[1] - a[1]);
      return [a[0] + (b[0] - a[0]) * t, y];
    };
    edge((p) => p[0] >= x0, atX(x0));
    edge((p) => p[0] <= x1, atX(x1));
    edge((p) => p[1] >= y0, atY(y0));
    edge((p) => p[1] <= y1, atY(y1));
    if (poly.length < 3) return 0;
    let twice = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i] as Point;
      const b = poly[(i + 1) % poly.length] as Point;
      twice += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(twice) / 2;
  };

  function instrument(gl: Obj, type: string, canvas: ContextAcc['canvas']): void {
    const call = (name: string, ...args: unknown[]): unknown => (gl[name] as Fn).apply(gl, args);

    let renderer = '';
    try {
      const info = call('getExtension', 'WEBGL_debug_renderer_info') as Obj | null;
      if (info !== null) renderer = String(call('getParameter', info['UNMASKED_RENDERER_WEBGL']) ?? '');
    } catch {
      renderer = '';
    }

    const acc: ContextAcc = {
      index: contexts.length,
      type,
      renderer,
      canvas,
      maxTextureUnits: Number(call('getParameter', GL.MAX_COMBINED_TEXTURE_IMAGE_UNITS) ?? 0),
      vertexArrayObjects: 'none-seen',
      textureBytes: 0,
      peakTextureBytes: 0,
      renderbufferBytes: 0,
      textures: new Map(),
      textureSizes: new Map(),
      renderbuffers: new Map(),
      unsizedUploads: [],
      framesSeen: 0,
    };
    contexts.push(acc);

    let frameIndex = 0;
    let frame: FrameAcc | null = null;
    const buffers = new WeakMap<object, BufferInfo>();
    const attribNames = new Map<number, string>();
    const defaultVao: VaoState = { attribs: new Map(), element: null };
    const vaos = new WeakMap<object, VaoState>();
    let vao = defaultVao;
    let arrayBuffer: object | null = null;
    let viewport: [number, number, number, number] = [0, 0, canvas.width, canvas.height];
    let scissor: [number, number, number, number] = [0, 0, canvas.width, canvas.height];
    let scissorOn = false;
    let framebufferBound = false;
    let activeUnit = 0;
    const boundTextures = new Map<string, object | null>();
    let renderbuffer: object | null = null;

    const newFrame = (): FrameAcc => ({
      startedAt: performance.now(),
      draws: 0,
      triangles: 0,
      areaPx: 0,
      screenPx: viewport[2] * viewport[3],
      offscreenAreaPx: 0,
      undecoded: [],
      staleReads: 0,
      perDraw: [],
    });

    const wrap = (target: Obj, name: string, make: (original: Fn) => Fn): void => {
      const original = target[name];
      if (typeof original !== 'function') return;
      const bound = (original as Fn).bind(target);
      target[name] = make(bound);
    };

    const setTextureBytes = (texture: object | null, slot: string, bytes: number, size: [number, number, number] | null): void => {
      if (texture === null) {
        acc.unsizedUploads.push(`upload to ${slot} with no texture bound`);
        return;
      }
      let slots = acc.textures.get(texture);
      if (slots === undefined) {
        slots = new Map();
        acc.textures.set(texture, slots);
      }
      acc.textureBytes += bytes - (slots.get(slot) ?? 0);
      slots.set(slot, bytes);
      if (size !== null) acc.textureSizes.set(texture, size);
      if (acc.textureBytes > acc.peakTextureBytes) acc.peakTextureBytes = acc.textureBytes;
    };

    const textureFor = (target: number): object | null => {
      const binding = target >= GL.CUBE_FIRST && target <= GL.CUBE_LAST ? GL.TEXTURE_CUBE_MAP : target;
      return boundTextures.get(`${String(activeUnit)}:${String(binding)}`) ?? null;
    };

    /* ---------------------------------------------------------- frame edge -- */
    wrap(gl, 'clear', (original) => (...args) => {
      const mask = Number(args[0]);
      if (!framebufferBound && (mask & GL.COLOR_BUFFER_BIT) !== 0) {
        if (frame !== null) {
          frames.push({ ...frame, context: acc.index });
          if (frames.length > RING) frames.shift();
        }
        frameIndex += 1;
        acc.framesSeen += 1;
        frame = newFrame();
      }
      return original(...args);
    });

    /* ------------------------------------------------------------- state -- */
    wrap(gl, 'viewport', (original) => (...args) => {
      viewport = [Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3])];
      return original(...args);
    });
    wrap(gl, 'scissor', (original) => (...args) => {
      scissor = [Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3])];
      return original(...args);
    });
    wrap(gl, 'enable', (original) => (...args) => {
      if (args[0] === GL.SCISSOR_TEST) scissorOn = true;
      return original(...args);
    });
    wrap(gl, 'disable', (original) => (...args) => {
      if (args[0] === GL.SCISSOR_TEST) scissorOn = false;
      return original(...args);
    });
    wrap(gl, 'bindFramebuffer', (original) => (...args) => {
      if (args[0] === GL.FRAMEBUFFER || args[0] === GL.DRAW_FRAMEBUFFER) framebufferBound = args[1] !== null;
      return original(...args);
    });
    wrap(gl, 'getAttribLocation', (original) => (...args) => {
      const location = Number(original(...args));
      if (location >= 0) attribNames.set(location, String(args[1]));
      return location;
    });
    wrap(gl, 'bindAttribLocation', (original) => (...args) => {
      attribNames.set(Number(args[1]), String(args[2]));
      return original(...args);
    });

    const bindVao = (object: unknown): void => {
      if (object === null || typeof object !== 'object') {
        vao = defaultVao;
        return;
      }
      let state = vaos.get(object);
      if (state === undefined) {
        state = { attribs: new Map(), element: null };
        vaos.set(object, state);
      }
      vao = state;
    };
    wrap(gl, 'bindVertexArray', (original) => (...args) => {
      acc.vertexArrayObjects = 'webgl2';
      bindVao(args[0]);
      return original(...args);
    });
    wrap(gl, 'getExtension', (original) => (...args) => {
      const extension = original(...args) as Obj | null;
      if (
        extension !== null &&
        /OES_vertex_array_object/i.test(String(args[0])) &&
        extension['__tnCensus'] !== true
      ) {
        extension['__tnCensus'] = true;
        wrap(extension, 'bindVertexArrayOES', (bindOriginal) => (...vaoArgs) => {
          acc.vertexArrayObjects = 'oes';
          bindVao(vaoArgs[0]);
          return bindOriginal(...vaoArgs);
        });
      }
      return extension;
    });

    /* ----------------------------------------------------------- buffers -- */
    wrap(gl, 'bindBuffer', (original) => (...args) => {
      const buffer = (args[1] ?? null) as object | null;
      if (args[0] === GL.ARRAY_BUFFER) arrayBuffer = buffer;
      else if (args[0] === GL.ELEMENT_ARRAY_BUFFER) vao.element = buffer;
      return original(...args);
    });
    const bufferFor = (target: unknown): object | null =>
      target === GL.ARRAY_BUFFER ? arrayBuffer : target === GL.ELEMENT_ARRAY_BUFFER ? vao.element : null;
    const viewOf = (data: unknown, srcOffset?: unknown, length?: unknown): Uint8Array | null => {
      if (data === null || typeof data !== 'object') return null;
      if (ArrayBuffer.isView(data)) {
        const element = (data as unknown as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1;
        const start = typeof srcOffset === 'number' ? srcOffset * element : 0;
        const count =
          typeof length === 'number' && length > 0 ? length * element : data.byteLength - start;
        return new Uint8Array(data.buffer, data.byteOffset + start, count);
      }
      if (data instanceof ArrayBuffer) return new Uint8Array(data);
      return null;
    };
    const write = (buffer: object | null, bytes: Uint8Array, at: number, dynamic: boolean, replace: boolean): void => {
      if (buffer === null) return;
      let info = buffers.get(buffer);
      if (info === undefined || replace) {
        const fresh: BufferInfo = { bytes: new Uint8Array(at + bytes.byteLength), dynamic, writtenAtFrame: frameIndex };
        info = fresh;
        buffers.set(buffer, fresh);
      }
      if (info.bytes.byteLength < at + bytes.byteLength) {
        const grown = new Uint8Array(at + bytes.byteLength);
        grown.set(info.bytes);
        info.bytes = grown;
      }
      info.bytes.set(bytes, at);
      info.dynamic = info.dynamic || dynamic;
      info.writtenAtFrame = frameIndex;
    };
    wrap(gl, 'bufferData', (original) => (...args) => {
      const buffer = bufferFor(args[0]);
      const dynamic = args[2] !== GL.STATIC_DRAW;
      if (typeof args[1] === 'number') {
        if (buffer !== null) buffers.set(buffer, { bytes: new Uint8Array(args[1]), dynamic, writtenAtFrame: frameIndex });
      } else {
        const bytes = viewOf(args[1], args[3], args[4]);
        if (bytes !== null) write(buffer, bytes, 0, dynamic, true);
      }
      return original(...args);
    });
    wrap(gl, 'bufferSubData', (original) => (...args) => {
      const bytes = viewOf(args[2], args[3], args[4]);
      if (bytes !== null) write(bufferFor(args[0]), bytes, Number(args[1]), true, false);
      return original(...args);
    });
    wrap(gl, 'vertexAttribPointer', (original) => (...args) => {
      vao.attribs.set(Number(args[0]), {
        buffer: arrayBuffer,
        size: Number(args[1]),
        type: Number(args[2]),
        stride: Number(args[4]),
        offset: Number(args[5]),
      });
      return original(...args);
    });

    /* ------------------------------------------------------------- draws -- */
    const positionAttrib = (): Attrib | null => {
      for (const [location, attrib] of vao.attribs) {
        if (/pos/i.test(attribNames.get(location) ?? '') && attrib.size >= 2) return attrib;
      }
      return null;
    };

    const record = (mode: number, count: number, indexAt: ((i: number) => number) | null, first: number): void => {
      if (frame === null) return;
      const current = frame;
      current.draws += 1;
      const offscreen = framebufferBound;
      const reason = (why: string): void => {
        current.undecoded.push(`draw ${String(current.draws)}: ${why}`);
      };
      if (mode !== GL.TRIANGLES && mode !== GL.TRIANGLE_STRIP && mode !== GL.TRIANGLE_FAN) {
        /* Points and lines cover area too, and this does not know how much. */
        reason(`primitive mode 0x${mode.toString(16)} has no triangle area`);
        return;
      }
      const attrib = positionAttrib();
      if (attrib === null) return reason('no attribute named like a position is enabled');
      if (attrib.type !== GL.FLOAT) return reason(`position attribute type 0x${attrib.type.toString(16)} is not FLOAT`);
      const info = attrib.buffer === null ? undefined : buffers.get(attrib.buffer);
      if (info === undefined) return reason('position buffer was never uploaded through a wrapped call');
      if (info.dynamic && info.writtenAtFrame !== frameIndex) current.staleReads += 1;
      const stride = attrib.stride > 0 ? attrib.stride : attrib.size * 4;
      const data = new DataView(info.bytes.buffer, info.bytes.byteOffset, info.bytes.byteLength);
      const point = (vertex: number): Point | null => {
        const at = attrib.offset + vertex * stride;
        if (vertex < 0 || at + 8 > data.byteLength) return null;
        return [data.getFloat32(at, true), data.getFloat32(at + 4, true)];
      };
      const [vx, vy, vw, vh] = viewport;
      let rect: [number, number, number, number] = [vx, vy, vx + vw, vy + vh];
      if (scissorOn) {
        /* GL scissor is bottom-up; positions here are in the top-down space the
           projection maps from. Only the horizontal extent and the height are
           used, which is exact for the full-width camera scissor a 2D scene sets
           and conservative otherwise. */
        const [sx, , sw, sh] = scissor;
        rect = [Math.max(rect[0], sx), rect[1], Math.min(rect[2], sx + sw), Math.min(rect[3], rect[1] + sh)];
      }
      const step = mode === GL.TRIANGLES ? 3 : 1;
      let triangles = 0;
      let area = 0;
      for (let i = 0; i + 2 < count; i += step) {
        const corners: Point[] = [];
        for (let k = 0; k < 3; k += 1) {
          const at = mode === GL.TRIANGLE_FAN ? (k === 0 ? 0 : i + k) : i + k;
          const p = point(indexAt === null ? first + at : indexAt(at));
          if (p === null) return reason(`vertex ${String(at)} lies outside the uploaded buffer`);
          corners.push(p);
        }
        triangles += 1;
        area += clippedArea(corners, rect);
      }
      current.triangles += triangles;
      if (offscreen) current.offscreenAreaPx += area;
      else current.areaPx += area;
      current.perDraw.push({ mode, triangles, areaPx: area, offscreen });
    };

    wrap(gl, 'drawArrays', (original) => (...args) => {
      record(Number(args[0]), Number(args[2]), null, Number(args[1]));
      return original(...args);
    });
    wrap(gl, 'drawElements', (original) => (...args) => {
      const [mode, count, type, offset] = [Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3])];
      const info = vao.element === null ? undefined : buffers.get(vao.element);
      const width = type === GL.UNSIGNED_INT ? 4 : type === GL.UNSIGNED_SHORT ? 2 : 1;
      if (info === undefined) {
        if (frame !== null) {
          frame.draws += 1;
          frame.undecoded.push(`draw ${String(frame.draws)}: index buffer was never uploaded through a wrapped call`);
        }
      } else {
        const view = new DataView(info.bytes.buffer, info.bytes.byteOffset, info.bytes.byteLength);
        const indexAt = (i: number): number => {
          const at = offset + i * width;
          if (at + width > view.byteLength) return -1;
          return width === 4 ? view.getUint32(at, true) : width === 2 ? view.getUint16(at, true) : view.getUint8(at);
        };
        record(mode, count, indexAt, 0);
      }
      return original(...args);
    });
    for (const name of ['drawArraysInstanced', 'drawElementsInstanced']) {
      wrap(gl, name, (original) => (...args) => {
        if (frame !== null) {
          frame.draws += 1;
          frame.undecoded.push(`draw ${String(frame.draws)}: ${name} is not decoded`);
        }
        return original(...args);
      });
    }

    /* ---------------------------------------------------------- textures -- */
    wrap(gl, 'activeTexture', (original) => (...args) => {
      activeUnit = Number(args[0]) - GL.TEXTURE0;
      return original(...args);
    });
    wrap(gl, 'bindTexture', (original) => (...args) => {
      boundTextures.set(`${String(activeUnit)}:${String(args[0])}`, (args[1] ?? null) as object | null);
      return original(...args);
    });
    wrap(gl, 'texImage2D', (original) => (...args) => {
      const target = Number(args[0]);
      const level = Number(args[1]);
      const slot = `${String(target)}:${String(level)}`;
      let width = 0;
      let height = 0;
      let bpp: number | null;
      if (args.length >= 9) {
        width = Number(args[3]);
        height = Number(args[4]);
        bpp = texImageBytesPerPixel(Number(args[2]), Number(args[6]), Number(args[7]));
      } else {
        const size = sourceSize(args[5]);
        if (size !== null) [width, height] = size;
        bpp = texImageBytesPerPixel(Number(args[2]), Number(args[3]), Number(args[4]));
      }
      if (bpp === null || width <= 0 || height <= 0) {
        acc.unsizedUploads.push(
          `texImage2D level ${String(level)}: ${bpp === null ? 'unknown format/type' : 'source has no dimensions'}`,
        );
      } else {
        setTextureBytes(textureFor(target), slot, width * height * bpp, level === 0 ? [width, height, bpp] : null);
      }
      return original(...args);
    });
    wrap(gl, 'compressedTexImage2D', (original) => (...args) => {
      const data = args[args.length - 1];
      const bytes = ArrayBuffer.isView(data) ? data.byteLength : 0;
      if (bytes === 0) acc.unsizedUploads.push('compressedTexImage2D with no data view');
      else setTextureBytes(textureFor(Number(args[0])), `${String(args[0])}:${String(args[1])}`, bytes, null);
      return original(...args);
    });
    wrap(gl, 'copyTexImage2D', (original) => (...args) => {
      const bpp = sizedBytesPerPixel(Number(args[2]));
      if (bpp === null) acc.unsizedUploads.push('copyTexImage2D with an unknown internal format');
      else {
        const [w, h] = [Number(args[5]), Number(args[6])];
        setTextureBytes(textureFor(Number(args[0])), `${String(args[0])}:${String(args[1])}`, w * h * bpp, [w, h, bpp]);
      }
      return original(...args);
    });
    wrap(gl, 'texStorage2D', (original) => (...args) => {
      const [target, levels, internalFormat, w, h] = args.map(Number) as [number, number, number, number, number];
      const bpp = sizedBytesPerPixel(internalFormat);
      if (bpp === null) acc.unsizedUploads.push(`texStorage2D internal format 0x${internalFormat.toString(16)}`);
      else {
        for (let level = 0; level < levels; level += 1) {
          const lw = Math.max(1, w >> level);
          const lh = Math.max(1, h >> level);
          setTextureBytes(textureFor(target), `${String(target)}:${String(level)}`, lw * lh * bpp, level === 0 ? [w, h, bpp] : null);
        }
      }
      return original(...args);
    });
    wrap(gl, 'deleteTexture', (original) => (...args) => {
      const texture = (args[0] ?? null) as object | null;
      if (texture !== null) {
        const slots = acc.textures.get(texture);
        if (slots !== undefined) for (const bytes of slots.values()) acc.textureBytes -= bytes;
        acc.textures.delete(texture);
        acc.textureSizes.delete(texture);
      }
      return original(...args);
    });

    /* ----------------------------------------------------- renderbuffers -- */
    wrap(gl, 'bindRenderbuffer', (original) => (...args) => {
      renderbuffer = (args[1] ?? null) as object | null;
      return original(...args);
    });
    for (const name of ['renderbufferStorage', 'renderbufferStorageMultisample']) {
      wrap(gl, name, (original) => (...args) => {
        const multisample = name === 'renderbufferStorageMultisample';
        const samples = multisample ? Math.max(1, Number(args[1])) : 1;
        const [format, w, h] = multisample
          ? [Number(args[2]), Number(args[3]), Number(args[4])]
          : [Number(args[1]), Number(args[2]), Number(args[3])];
        const bpp = sizedBytesPerPixel(format);
        if (bpp === null) acc.unsizedUploads.push(`${name} format 0x${format.toString(16)}`);
        else if (renderbuffer !== null) {
          const bytes = w * h * bpp * samples;
          acc.renderbufferBytes += bytes - (acc.renderbuffers.get(renderbuffer) ?? 0);
          acc.renderbuffers.set(renderbuffer, bytes);
        }
        return original(...args);
      });
    }
    wrap(gl, 'deleteRenderbuffer', (original) => (...args) => {
      const object = (args[0] ?? null) as object | null;
      if (object !== null) {
        acc.renderbufferBytes -= acc.renderbuffers.get(object) ?? 0;
        acc.renderbuffers.delete(object);
      }
      return original(...args);
    });
  }

  const patch = (proto: { getContext?: unknown } | undefined): void => {
    if (proto === undefined || typeof proto.getContext !== 'function') return;
    const original = proto.getContext as Fn;
    proto.getContext = function (this: ContextAcc['canvas'], ...args: unknown[]): unknown {
      const context = original.apply(this, args);
      const type = String(args[0]);
      if (context !== null && typeof context === 'object' && /webgl/i.test(type) && !instrumented.has(context)) {
        instrumented.add(context);
        instrument(context as Obj, type, this);
      }
      return context;
    };
  };
  patch(typeof HTMLCanvasElement === 'undefined' ? undefined : (HTMLCanvasElement.prototype as unknown as { getContext?: unknown }));
  patch(typeof OffscreenCanvas === 'undefined' ? undefined : (OffscreenCanvas.prototype as unknown as { getContext?: unknown }));

  (globalThis as unknown as Obj)[globalName] = {
    snapshot: (): unknown => ({
      contexts: contexts.map((c) => ({
        index: c.index,
        type: c.type,
        renderer: c.renderer,
        attached: c.canvas.isConnected === true,
        canvasWidth: c.canvas.width,
        canvasHeight: c.canvas.height,
        maxTextureUnits: c.maxTextureUnits,
        vertexArrayObjects: c.vertexArrayObjects,
        textureBytes: c.textureBytes,
        peakTextureBytes: c.peakTextureBytes,
        renderbufferBytes: c.renderbufferBytes,
        liveTextures: c.textures.size,
        liveTextureSizes: [...c.textureSizes.values()],
        unsizedUploads: [...c.unsizedUploads],
        framesSeen: c.framesSeen,
      })),
      frames: frames.map((f) => ({ ...f, undecoded: [...f.undecoded], perDraw: [...f.perDraw] })),
    }),
    /** Forget recorded frames; texture accounting is cumulative by design and is never reset. */
    clearFrames: (): void => {
      frames.length = 0;
    },
  };
}
