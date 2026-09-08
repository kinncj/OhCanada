/**
 * The probe must name a software rasteriser, and must never mistake silence for
 * a healthy GPU.
 *
 * The device strings below are real ones, kept verbatim, because the whole value
 * of this module is that it recognises what browsers actually emit. ANGLE in
 * particular buries the backend inside a nested parenthesis, which is exactly
 * the shape a naive `startsWith` check misses.
 */

import { describe, expect, it } from 'vitest';

import {
  UNMASKED_RENDERER_WEBGL,
  UNMASKED_VENDOR_WEBGL,
  classifyRasterizer,
  describeRenderer,
  identifyRenderer,
  readUnmaskedDeviceStrings,
  type DebugInfoContext,
} from '@adapters/phaser/renderer-identity';

/** Device strings observed in the wild, with what they are. */
const SOFTWARE_DEVICES: readonly string[] = [
  'Mesa/X.org llvmpipe (LLVM 15.0.7, 256 bits)',
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
  'Google SwiftShader',
  'Mesa Offscreen',
  'softpipe',
  'llvmpipe (LLVM 17.0.6, 128 bits)',
  'Microsoft Basic Render Driver',
  'GDI Generic',
  'Apple Software Renderer',
  'lavapipe (LLVM 16.0.6, 256 bits)',
];

const HARDWARE_DEVICES: readonly string[] = [
  'Apple GPU',
  'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Mali-G78 MP14',
  'Adreno (TM) 730',
  'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
];

/** A GL context that answers. `overrides` fakes the ways a browser refuses. */
const glStub = (
  strings: { vendor?: unknown; renderer?: unknown },
  overrides: Partial<DebugInfoContext> = {},
): DebugInfoContext => ({
  getExtension: (name: string) =>
    name === 'WEBGL_debug_renderer_info'
      ? { UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL }
      : null,
  getParameter: (pname: number) => {
    if (pname === UNMASKED_VENDOR_WEBGL) return strings.vendor;
    if (pname === UNMASKED_RENDERER_WEBGL) return strings.renderer;
    return null;
  },
  ...overrides,
});

describe('classifyRasterizer', () => {
  it.each(SOFTWARE_DEVICES)('names "%s" as software', (device) => {
    expect(classifyRasterizer(device)).toBe('software');
  });

  it.each(HARDWARE_DEVICES)('does not accuse "%s" of being software', (device) => {
    expect(classifyRasterizer(device)).toBe('hardware');
  });

  it.each([null, undefined, '', '   '])(
    'answers "unknown" for %p rather than assuming hardware',
    (device) => {
      expect(classifyRasterizer(device)).toBe('unknown');
    },
  );
});

describe('readUnmaskedDeviceStrings', () => {
  it('reads the vendor and renderer through the extension', () => {
    const strings = readUnmaskedDeviceStrings(
      glStub({ vendor: 'Google Inc. (Google)', renderer: 'Google SwiftShader' }),
    );

    expect(strings).toEqual({
      vendor: 'Google Inc. (Google)',
      renderer: 'Google SwiftShader',
    });
  });

  it('falls back to the standard enums when the extension object omits them', () => {
    const strings = readUnmaskedDeviceStrings(
      glStub(
        { vendor: 'Apple', renderer: 'Apple GPU' },
        { getExtension: () => ({}) },
      ),
    );

    expect(strings.renderer).toBe('Apple GPU');
  });

  it.each([
    ['no context at all', null],
    ['a context that is undefined', undefined],
  ])('returns nulls for %s', (_label, gl) => {
    expect(readUnmaskedDeviceStrings(gl)).toEqual({ vendor: null, renderer: null });
  });

  it('returns nulls when the browser hides the extension (privacy mode)', () => {
    const strings = readUnmaskedDeviceStrings(
      glStub({ vendor: 'Apple', renderer: 'Apple GPU' }, { getExtension: () => null }),
    );

    expect(strings).toEqual({ vendor: null, renderer: null });
  });

  it('survives getExtension throwing on a lost context', () => {
    const strings = readUnmaskedDeviceStrings(
      glStub(
        {},
        {
          getExtension: () => {
            throw new Error('context lost');
          },
        },
      ),
    );

    expect(strings).toEqual({ vendor: null, renderer: null });
  });

  it('survives getParameter throwing, and treats a blank string as no answer', () => {
    const throwing = readUnmaskedDeviceStrings(
      glStub(
        {},
        {
          getParameter: () => {
            throw new Error('INVALID_ENUM');
          },
        },
      ),
    );
    expect(throwing).toEqual({ vendor: null, renderer: null });

    expect(readUnmaskedDeviceStrings(glStub({ vendor: '  ', renderer: 42 }))).toEqual({
      vendor: null,
      renderer: null,
    });
  });
});

describe('identifyRenderer', () => {
  it('reports a software WebGL device by name, which is the case the tier exists for', () => {
    const identity = identifyRenderer(
      'webgl',
      glStub({
        vendor: 'Google Inc. (Google)',
        renderer:
          'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      }),
    );

    expect(identity.kind).toBe('webgl');
    expect(identity.rasterizer).toBe('software');
    expect(identity.filtersAvailable).toBe(true);
    expect(identity.note).toContain('SwiftShader');
  });

  it('reports a hardware WebGL device', () => {
    const identity = identifyRenderer(
      'webgl',
      glStub({ vendor: 'Apple', renderer: 'Apple GPU' }),
    );

    expect(identity.rasterizer).toBe('hardware');
    expect(identity.renderer).toBe('Apple GPU');
  });

  it('says "unknown", not "hardware", when the device will not identify itself', () => {
    const identity = identifyRenderer('webgl', glStub({}, { getExtension: () => null }));

    expect(identity.rasterizer).toBe('unknown');
    expect(identity.vendor).toBeNull();
    expect(identity.renderer).toBeNull();
    expect(
      identity.note,
      'the note has to say why it is unknown, or a bug report cannot be triaged',
    ).toMatch(/did not identify itself/u);
  });

  it('treats a WebGL renderer with a lost context as unknown rather than fine', () => {
    expect(identifyRenderer('webgl', null).rasterizer).toBe('unknown');
  });

  it('knows the Canvas renderer has no Filter pipeline', () => {
    const identity = identifyRenderer('canvas', null);

    expect(identity.kind).toBe('canvas');
    expect(identity.filtersAvailable).toBe(false);
    expect(identity.note).toContain('Filter');
  });

  it.each(['headless', 'unknown'] as const)('reports %s as drawing nothing', (kind) => {
    const identity = identifyRenderer(kind, null);

    expect(identity.filtersAvailable).toBe(false);
    expect(identity.rasterizer).toBe('unknown');
  });

  it('never reads a GL context that belongs to a non-WebGL renderer', () => {
    let touched = false;
    const gl: DebugInfoContext = {
      getExtension: () => {
        touched = true;
        return null;
      },
      getParameter: () => null,
    };

    identifyRenderer('canvas', gl);

    expect(touched).toBe(false);
  });
});

describe('describeRenderer', () => {
  it('is one greppable line for a bug report', () => {
    const identity = identifyRenderer(
      'webgl',
      glStub({ vendor: 'Mesa', renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' }),
    );

    expect(describeRenderer(identity)).toBe(
      'webgl/software (llvmpipe (LLVM 15.0.7, 256 bits))',
    );
  });

  it('omits the device when there is none to name', () => {
    expect(describeRenderer(identifyRenderer('canvas', null))).toBe('canvas/unknown');
  });
});
