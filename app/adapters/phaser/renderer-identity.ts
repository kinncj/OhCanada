/**
 * What renderer did we actually get, and is anything actually drawing it?
 *
 * `Phaser.AUTO` picks WebGL whenever a context can be created, which is not the
 * same as WebGL being *usable*. Linux on llvmpipe, Chrome started with
 * `--use-angle=swiftshader`, a VM, a remote desktop session and a browser with
 * hardware acceleration switched off all hand back a complete, conformant WebGL
 * context and then rasterise every pixel on the CPU. Nothing in the WebGL API
 * says so. `WEBGL_debug_renderer_info` is the one place the device names itself,
 * and it is advisory: Firefox's `privacy.resistFingerprinting`, Safari's Lockdown
 * Mode and several extensions remove the extension entirely, and some drivers
 * return an empty string.
 *
 * So this module answers two separate questions and never conflates them:
 *
 *   1. **Which renderer did Phaser choose?** (`RendererKind`) — a fact, read off
 *      the game instance rather than off `navigator` or a feature test. It is
 *      what decides whether Filters exist at all: Phaser 4's Canvas renderer has
 *      no Filter pipeline, so an effect built on one silently does nothing there.
 *   2. **Is that renderer a software rasteriser?** (`Rasterizer`) — a *hint*.
 *      `'software'` when the device names itself as one, `'hardware'` when it
 *      names itself as something else, and `'unknown'` when it will not say.
 *
 * The hint never decides the visual tier on its own; `visual-tier.ts` uses it to
 * pick where measurement *starts* and how high it may climb, and the measured
 * frame cost does the rest. That split is the whole point of task 1.19: a
 * capability bit cannot tell you a GPU is slow, and this project's predecessor
 * died of believing one — an iPhone advertised WebGPU, the renderer went black,
 * and a player found it before we did.
 *
 * Crucially, `'unknown'` is not `'hardware'`. A device that refuses to name
 * itself gets the cautious start and has to earn its tier from measured frames.
 *
 * No Phaser import and no DOM import: the two inputs are a `RendererKind` string
 * and a structural view of a GL context, so every branch below runs under
 * `environment: 'node'`. `game-renderer.ts` is the only file that translates
 * `Phaser.WEBGL`/`Phaser.CANVAS` into the union.
 */

/** Which renderer Phaser built. `'headless'` and `'unknown'` mean nothing is drawing. */
export type RendererKind = 'webgl' | 'canvas' | 'headless' | 'unknown';

/** What the WebGL device says it is. `'unknown'` means it would not say. */
export type Rasterizer = 'hardware' | 'software' | 'unknown';

/**
 * The `WEBGL_debug_renderer_info` enums. Read from the extension object when it
 * carries them (it always should) and used as the fallback when it does not, so
 * a polyfilled or trimmed extension object still works.
 */
export const UNMASKED_VENDOR_WEBGL = 0x9245;
export const UNMASKED_RENDERER_WEBGL = 0x9246;

/**
 * The slice of a `WebGLRenderingContext` this module touches.
 *
 * Structural on purpose. Typing the parameter as `WebGLRenderingContext` would
 * make every test of this file need a browser, and the branch that matters most
 * — the extension being absent — is the one a real browser will not give us on
 * demand.
 */
export interface DebugInfoContext {
  getExtension(name: string): unknown;
  getParameter(pname: number): unknown;
}

/** What `getExtension('WEBGL_debug_renderer_info')` returns, when it returns anything. */
interface DebugRendererInfoExtension {
  readonly UNMASKED_VENDOR_WEBGL?: number;
  readonly UNMASKED_RENDERER_WEBGL?: number;
}

/**
 * Device strings that name a CPU rasteriser outright.
 *
 * Deliberately narrow. Every pattern here is a renderer that is *definitionally*
 * software; nothing is included on suspicion. A false positive costs a player
 * visual quality they could have had, and — worse — it would make the tier a
 * string match again rather than a measurement, which is the failure mode this
 * task exists to remove. Anything ambiguous (VMware SVGA3D, virtio-gpu, an
 * unnamed ANGLE backend) is left to the frame-cost measurement, which does not
 * care what the device calls itself.
 *
 * Matched case-insensitively against the concatenation of the vendor and
 * renderer strings, because ANGLE reports the real backend inside the renderer
 * string: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`.
 */
const SOFTWARE_RENDERER_PATTERNS: readonly RegExp[] = [
  /llvmpipe/iu,
  /lavapipe/iu,
  /softpipe/iu,
  /swiftshader/iu,
  /software rasterizer/iu,
  /software renderer/iu,
  /software adapter/iu,
  /mesa offscreen/iu,
  /microsoft basic render/iu,
  /gdi generic/iu,
];

/**
 * Classify a device string. `null`, `undefined` and blank all mean `'unknown'` —
 * "the device would not say" is a third answer, never a quiet `'hardware'`.
 */
export function classifyRasterizer(deviceName: string | null | undefined): Rasterizer {
  if (typeof deviceName !== 'string' || deviceName.trim().length === 0) return 'unknown';
  return SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(deviceName))
    ? 'software'
    : 'hardware';
}

export interface UnmaskedDeviceStrings {
  readonly vendor: string | null;
  readonly renderer: string | null;
}

/**
 * Read `UNMASKED_VENDOR_WEBGL` / `UNMASKED_RENDERER_WEBGL`, tolerating every way
 * a browser can refuse.
 *
 * Failure modes handled, all of them observed in the wild: no context at all;
 * `getExtension` returning `null` (privacy mode, Lockdown Mode, an extension
 * that strips it); `getExtension` throwing on a lost context; `getParameter`
 * throwing or returning a non-string; and a driver returning `''`. Every one of
 * them yields `null`, which downstream reads as `'unknown'` — never as a pass.
 */
export function readUnmaskedDeviceStrings(
  gl: DebugInfoContext | null | undefined,
): UnmaskedDeviceStrings {
  if (gl === null || gl === undefined) return { vendor: null, renderer: null };

  let extension: DebugRendererInfoExtension | null = null;
  try {
    const found = gl.getExtension('WEBGL_debug_renderer_info');
    if (typeof found === 'object' && found !== null) {
      extension = found as DebugRendererInfoExtension;
    }
  } catch {
    return { vendor: null, renderer: null };
  }
  if (extension === null) return { vendor: null, renderer: null };

  const read = (name: number): string | null => {
    try {
      const value = gl.getParameter(name);
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    } catch {
      return null;
    }
  };

  return {
    vendor: read(extension.UNMASKED_VENDOR_WEBGL ?? UNMASKED_VENDOR_WEBGL),
    renderer: read(extension.UNMASKED_RENDERER_WEBGL ?? UNMASKED_RENDERER_WEBGL),
  };
}

export interface RendererIdentity extends UnmaskedDeviceStrings {
  readonly kind: RendererKind;
  readonly rasterizer: Rasterizer;
  /** Whether Phaser's Filter pipeline exists on this renderer. Canvas has none. */
  readonly filtersAvailable: boolean;
  /**
   * One line naming *why* the rasteriser was classified that way, greppable in
   * a bug report. "unknown" that reads as "the browser hid the device" is worth
   * far more to a triager than a bare enum.
   */
  readonly note: string;
}

/**
 * Build the identity from the renderer Phaser chose and the context it is using.
 *
 * `gl` is expected to be `null` for anything but the WebGL renderer, and a
 * WebGL renderer whose context has been lost also arrives here as `null`; both
 * end up `'unknown'` rather than silently `'hardware'`.
 */
export function identifyRenderer(
  kind: RendererKind,
  gl: DebugInfoContext | null | undefined,
): RendererIdentity {
  const filtersAvailable = kind === 'webgl';

  if (kind !== 'webgl') {
    return {
      kind,
      rasterizer: 'unknown',
      vendor: null,
      renderer: null,
      filtersAvailable,
      note:
        kind === 'canvas'
          ? 'Canvas renderer: no GL device to name, and no Filter pipeline.'
          : `no drawing renderer (${kind}).`,
    };
  }

  const device = readUnmaskedDeviceStrings(gl);
  const name = [device.vendor, device.renderer].filter((part) => part !== null).join(' ');
  const rasterizer = classifyRasterizer(name);

  return {
    kind,
    ...device,
    rasterizer,
    filtersAvailable,
    note:
      rasterizer === 'unknown'
        ? 'WebGL device did not identify itself (extension hidden or context lost); ' +
          'the tier is decided by measurement alone.'
        : `WebGL device reports "${name}", classified ${rasterizer}.`,
  };
}

/** A one-line identity for the debug overlay, a bug report or a data attribute. */
export function describeRenderer(identity: RendererIdentity): string {
  return `${identity.kind}/${identity.rasterizer}${
    identity.renderer === null ? '' : ` (${identity.renderer})`
  }`;
}
