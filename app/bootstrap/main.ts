/**
 * Composition root (ADR-0005).
 *
 * The only file in the app allowed to name a concrete implementation. It loads
 * and validates the game config, builds the renderer, mounts the DOM layer that
 * sits above the canvas, wires the orientation rule, and announces readiness.
 * Everything it wires talks through the seams: the renderer knows nothing about
 * the overlay, the overlay knows nothing about Phaser.
 */

import gameConfigDocument from '@content/game.config.json';

import { GameRenderer, parseBootConfig, type BootConfig } from '@adapters/phaser';
import { createBuildStatus } from '@ui/build-status';
import { announce, mountLiveRegion } from '@ui/live-region';
import { createRotateOverlay } from '@ui/rotate-overlay';

/**
 * The config is imported, not fetched. It is on the 6 s time-to-play budget and
 * needed before the first frame, so it is inlined by the bundler and there is no
 * request to wait for and nothing to 404 on a sub-path deploy (ADR-0006).
 * `parseBootConfig` still validates it at runtime: `make validate-content`
 * guards the repository, this guards the artefact.
 */

function main(): void {
  const root = document.documentElement;
  root.dataset['tnBoot'] = 'loading';
  root.dataset['tnPaused'] = 'false';

  const gameHost = document.getElementById('game');
  const uiHost = document.getElementById('ui');
  if (gameHost === null || uiHost === null) {
    reportFailure('index.html is missing #game or #ui.');
    return;
  }

  /*
   * The live region goes up first: it is how every later failure gets spoken.
   * "First" has to mean before the config is parsed, not after — `announce`
   * auto-mounts to `document.body` when no region exists, so a parse failure
   * reported ahead of this line would put the one screen-reader channel outside
   * the `#ui` layer that owns it. Locked by
   * tests/unit/bootstrap/live-region-order.test.ts.
   */
  mountLiveRegion(uiHost);

  const parsed = parseBootConfig(gameConfigDocument);
  if (!parsed.ok) {
    reportFailure(`${parsed.error.code}: ${parsed.error.message}`);
    return;
  }
  const config = parsed.value;

  document.title = config.title;
  root.lang = config.defaultLocale;

  const renderer = new GameRenderer({ parent: gameHost, config });
  applyPageTheme(renderer.cssVariables(), config);

  /*
   * What the screen says about itself. The canvas is `aria-hidden`, so the one
   * sentence explaining that this is a foundation build with nothing to play
   * yet has to be DOM or it does not exist for a screen-reader user. It goes up
   * with the page rather than after `renderer.ready`, so it is there whether or
   * not the canvas ever comes back.
   */
  const status = createBuildStatus(uiHost, { locale: toUiLocale(config.defaultLocale) });

  const overlay = createRotateOverlay(uiHost, {
    locale: toUiLocale(config.defaultLocale),
    onShow: () => {
      renderer.pause();
      root.dataset['tnPaused'] = 'true';
    },
    onHide: () => {
      renderer.resume();
      root.dataset['tnPaused'] = 'false';
    },
  });

  const syncOrientation = (): void => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    root.dataset['tnMode'] = overlay.sync(width, height);
  };

  syncOrientation();
  window.addEventListener('resize', syncOrientation, { passive: true });
  window.addEventListener('orientationchange', syncOrientation, { passive: true });
  window.visualViewport?.addEventListener('resize', syncOrientation, { passive: true });

  void renderer.ready.then(() => {
    root.dataset['tnBoot'] = 'ready';
    /*
     * TODO(slice-1): localised through the LocalizerPort, like every other string.
     * "ready" alone was the whole of what assistive technology could perceive on
     * this page, and it left a screen-reader user with no way to tell a finished
     * boot from a stalled one. The build-status sentence is appended so the
     * announcement says the same thing the screen does.
     */
    announce(`${config.title} ready. ${status.message}`);
  });
}

/**
 * Paints the page behind the canvas.
 *
 * This is what makes the desktop side panels: the canvas is FIT-scaled and never
 * stretched, so a wide window leaves letterbox space either side, and the page
 * under it runs the same sky -> ground gradient the scene draws. The two colours
 * come from the same config the renderer used, so they cannot drift.
 */
function applyPageTheme(
  variables: Readonly<Record<string, string>>,
  config: BootConfig,
): void {
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', config.palette.sky);
}

/** EN and FR ship from the first commit; anything else falls back to EN. */
function toUiLocale(locale: string): 'en' | 'fr' {
  return locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * A boot failure is visible and speakable, never a blank canvas. Deliberately
 * developer-facing English: a config that fails validation is a build defect,
 * not something a player can act on.
 *
 * By the time any caller but one reaches here the live region is already in
 * `#ui`, so `announce` speaks through it. The exception is the missing
 * `#game`/`#ui` branch: there is no DOM layer to mount into, so `announce`
 * falls back to `document.body` and the visible notice is dropped. That page is
 * broken beyond anything this file can repair; speaking at all is the win.
 */
function reportFailure(message: string): void {
  document.documentElement.dataset['tnBoot'] = 'failed';
  console.error(`[bootstrap] ${message}`);
  announce(`TrueNorth could not start. ${message}`);

  const uiHost = document.getElementById('ui');
  if (uiHost === null) return;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.setAttribute(
    'style',
    'position:fixed;inset:auto 1rem 1rem 1rem;margin:0;padding:1rem;' +
      'background:#7a1020;color:#ffffff;border-radius:0.5rem;pointer-events:auto;',
  );
  notice.textContent = `TrueNorth could not start: ${message}`;
  uiHost.append(notice);
}

/* `type="module"` scripts are deferred, so the document is parsed by now. */
main();
