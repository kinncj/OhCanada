/**
 * Wait for the bundled UI face before drawing canvas text (ADR-0066 §1).
 *
 * A Phaser `Text` rasterises its string once, into its own canvas, when it is
 * created, and never looks at the font again. A title created before the face
 * has arrived is drawn in the fallback and stays that way even after the face
 * loads. The DOM swaps; the canvas does not. So the scene asks the document's
 * `FontFaceSet` to load the exact face and size it is about to draw, and creates
 * the text when that resolves.
 *
 * It never waits forever. A face that fails, a blocked request, or a browser
 * with no `document.fonts` all resolve `false` after at most `timeoutMs`, and the
 * caller draws anyway, in the fallback the stack names. A title in the fallback
 * face is a smaller defect than a title that never appears, and a hung boot
 * screen was already read once as "stuck at the loading screen" (boot-scene.ts).
 */

/**
 * How long anything waits for the UI face before drawing in the fallback: the
 * canvas title, and the front door (app/bootstrap/main.ts). The face is 23 KB
 * and the worker holds it after the first visit, so this only matters on a cold
 * load over a bad network, where text in the fallback beats no text.
 */
export const FONT_WAIT_MS = 3000;

/** The part of `FontFaceSet` this uses, so a test can hand in a fake. */
export interface FontLoader {
  load(font: string): Promise<readonly unknown[]>;
}

/**
 * Resolve `true` when every shorthand in `fonts` has a loaded face, `false` when
 * any has none, when loading fails, or when `timeoutMs` passes first.
 */
export function whenFacesReady(
  loader: FontLoader | undefined,
  fonts: readonly string[],
  timeoutMs: number,
  timers: {
    readonly set: (run: () => void, ms: number) => unknown;
    readonly clear: (handle: unknown) => void;
  } = {
    set: (run, ms) => setTimeout(run, ms),
    clear: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  },
): Promise<boolean> {
  if (loader === undefined || fonts.length === 0) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean): void => {
      if (settled) return;
      settled = true;
      timers.clear(handle);
      resolve(value);
    };
    const handle = timers.set(() => {
      settle(false);
    }, timeoutMs);

    Promise.all(fonts.map((font) => loader.load(font))).then(
      (faces) => {
        settle(faces.every((matched) => matched.length > 0));
      },
      () => {
        settle(false);
      },
    );
  });
}

/** The document's font set, or `undefined` where there is none (a worker, an old engine, a test). */
export function documentFonts(): FontLoader | undefined {
  if (typeof document === 'undefined') return undefined;
  const fonts = (document as Document & { readonly fonts?: FontFaceSet }).fonts;
  return fonts === undefined ? undefined : (fonts as unknown as FontLoader);
}
