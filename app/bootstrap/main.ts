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

import { GameRenderer, parseBootConfig } from '@adapters/phaser';
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

  /*
   * Which level to open, if any — decided here, before anything is mounted,
   * because what the page is *for* changes what belongs on it.
   *
   * `?level=<id>` and nothing else. Slice 1's world map and character creator
   * (task 1.15) are what will choose a level for a player; until they exist,
   * opening one by URL is the honest interim — it is a real route a player could
   * be deep-linked to, it keeps the boot screen as the default so nothing about
   * the foundation build changes for a visitor who did not ask, and it means the
   * level suites drive the same artefact everything else does rather than a
   * test-only entry point.
   *
   * `window.location` is optional on purpose: the bootstrap suites stub a
   * minimal window, and a composition root that cannot be constructed without a
   * full browser is a composition root nothing can test.
   */
  const requested = new URLSearchParams(window.location?.search ?? '').get('level');
  const opensALevel = requested !== null && requested.length > 0;

  /*
   * The level's lifecycle, as one attribute on `<html>`, for `app/ui` to route
   * on. It is the composition root's job to say what state the page is in;
   * every screen above the canvas reads it rather than each of them re-deciding.
   *
   *   absent      no level was asked for — this page is the foundation shell
   *   "loading"   a level was asked for and is opening
   *   "ready"     a level is playable
   *   "failed"    a level was asked for and did not load
   *
   * There is deliberately no "none": the *absence* of the attribute is the shell
   * state, so a screen that forgets to check cannot mistake a missing value for
   * a level that is fine.
   */
  if (opensALevel) root.dataset['tnLevel'] = 'loading';

  const renderer = new GameRenderer({ parent: gameHost, config });
  applyPageTheme(renderer);

  /*
   * What the screen says about itself — and only when it is true.
   *
   * The caption says "Foundation build. There is no level to play yet", which is
   * the honest description of a page with no level and a lie over a running one.
   * It was found sitting in a panel over the Ottawa ice, the most legible text
   * on the screen, saying there was nothing to play. That is the second time
   * this project has shown a screen that misdescribes its own state — the first
   * was the boot screen reading as a stalled loading bar, reported twice from
   * two devices — and the fix is the same shape both times: the statement is
   * only made where it is true.
   *
   * Mounting is a decision, so it is made here, in the one file allowed to make
   * composition decisions (ADR-0005). `app/ui/build-status.ts` is unchanged and
   * still knows nothing about levels; it is asked for a caption or it is not.
   *
   * A level that *fails* to load does not bring the caption back. "There is no
   * level to play yet" is no truer then — there is one, it did not arrive — and
   * the page needs an error card with "Try again" and "Go back"
   * (TN-LEVEL-02), which is `app/ui`'s and hangs off `data-tn-level="failed"`.
   */
  const status = opensALevel
    ? null
    : createBuildStatus(uiHost, { locale: toUiLocale(config.defaultLocale) });

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

  /*
   * Open the level, once the renderer has a first frame.
   *
   * A level id nobody authored, and a document that will not load, both land in
   * the same place: `data-tn-level="failed"`, a developer-facing line in the
   * console, and an announcement. The player-facing error card with "Try again"
   * and "Go back" (TN-LEVEL-02) is DOM and belongs to the UI agent — this is the
   * seam it hangs on.
   */
  if (opensALevel && requested !== null) {
    void renderer.ready
      .then(() => renderer.loadLevel(requested))
      .then((result) => {
        if (!result.ok) {
          root.dataset['tnLevel'] = 'failed';
          console.error(`[bootstrap] ${result.error.code}: ${result.error.message}`);
          announce(`Could not open the level "${requested}".`);
          return;
        }
        root.dataset['tnLevel'] = 'ready';
        /* The side panels are the *level's* sky and ground now, not the boot
           screen's, and the boot screen's hills are not this level's ground.
           Re-applied here so a wide window does not frame a level in slice 0's
           scenery (ADR-0002). */
        applyPageTheme(renderer);
      });
  }

  void renderer.ready.then(() => {
    root.dataset['tnBoot'] = 'ready';
    /*
     * TODO(slice-1): localised through the LocalizerPort, like every other string.
     * "ready" alone was the whole of what assistive technology could perceive on
     * this page, and it left a screen-reader user with no way to tell a finished
     * boot from a stalled one. The build-status sentence is appended when it is
     * on screen, so the announcement says the same thing the screen does — and
     * omitted when it is not, rather than telling a screen-reader user there is
     * nothing to play while a level runs. Arriving in a level is announced from
     * `announce.arrived.ottawa` by the UI once the localiser exists
     * (TN-LEVEL-08); this file does not invent that copy.
     */
    announce(status === null ? `${config.title} ready.` : `${config.title} ready. ${status.message}`);
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
function applyPageTheme(renderer: GameRenderer): void {
  for (const [name, value] of Object.entries(renderer.cssVariables())) {
    document.documentElement.style.setProperty(name, value);
  }
  /* `renderer.palette`, not the config's: a level may override the theme, and
     the browser chrome should match the sky the player is actually looking at. */
  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', renderer.palette.sky);
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
