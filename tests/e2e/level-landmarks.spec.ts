import { expect, test } from '@playwright/test';

/**
 * `TN-HUD-07`'s page structure, against the production artefact.
 *
 * The `?e2e=1` scene probe proves the *level* runs. This proves the *page* is
 * built correctly around it, which until task 1.12 nothing did: the composition
 * root mounted a canvas, a rotate overlay and a caption, and none of the DOM
 * screens at all. `tests/a11y` therefore scanned a harness page rather than
 * `dist/` (`OQ-TEST-2`), because there was nothing in `dist/` to scan — and a
 * scan of a page nobody deploys can only ever prove the components, never the
 * page they are assembled into.
 *
 * Three facts, all of them assertions about the built artefact rather than about
 * a component:
 *
 *  1. **One `<main>`**, which is axe's `landmark-one-main`.
 *  2. **The canvas is inside it.** `#game` is handed to `createHud` as
 *     `canvasHost` and the HUD adopts it, so `<main>` contains the thing the
 *     page is *for*. Without that, `<main>` is an empty wrapper invented to
 *     satisfy a scanner and the canvas sits outside every landmark.
 *  3. **Every dialog opened over a level is inside `<main>`.** A `dialog` is not
 *     a landmark, so a modal mounted beside `<main>` puts its content outside
 *     every landmark and axe's `region` rule is right to complain. Mounting them
 *     into `hud.main` fixes the page rather than switching the rule off.
 *
 * Deliberately **not** an axe scan: `tests/a11y` owns axe and runs it with its
 * own config and its own rule set. This suite states the structural facts that
 * scan depends on, so that a regression here is reported as "the canvas left
 * `<main>`" rather than as an axe rule id.
 */

const LEVEL_ID = 'ottawa';

test.describe('the page a level is played on', () => {
  test('has exactly one <main>, with the canvas inside it', async ({ page }) => {
    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('html[data-tn-level="ready"]');

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main canvas')).toHaveCount(1);
    /* Still `aria-hidden`: being inside a landmark does not make a canvas
       readable, and CLAUDE.md says everything a player needs to hear goes
       through the live region instead. */
    await expect(page.locator('main canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  test('mounts the HUD and its live region, so the level can be heard at all', async ({
    page,
  }) => {
    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('html[data-tn-level="ready"]');

    await expect(page.getByTestId('hud')).toHaveCount(1);
    await expect(page.locator('#tn-live-region')).toHaveCount(1);
    /* The foundation caption belongs to a page with no level, and saying "there
       is no level to play yet" over the Ottawa ice is the defect that put this
       decision in the composition root. */
    await expect(page.getByTestId('build-status')).toHaveCount(0);
  });

  /**
   * Every modal the composition root opens over a level is inside `<main>`, and
   * the only dialog outside it is the HUD's own menu.
   *
   * There are exactly two exemptions, and both are dialogs that must **inert
   * `<main>` itself**, which a dialog mounted inside `<main>` cannot do:
   *
   *   - **the HUD menu**, whose focus trap makes the whole page — HUD and canvas
   *     included — unreachable while it is open (`TN-HUD-04`: "menu-button is
   *     not reachable with Tab"). `app/ui/hud.ts` mounts it beside `<main>` on
   *     purpose and says so; bootstrap never places it;
   *   - **the rotate overlay**, an `alertdialog` that covers the page when a
   *     phone is turned to landscape and pauses the game behind it (ADR-0002).
   *     It is about the *device*, not about the level, and it is up on pages
   *     that have no level at all.
   *
   * The assertion is an exact set rather than a proportion, so a new modal
   * mounted into `#ui` instead of `hud.main` fails here by name and the two
   * legitimate exceptions cannot quietly become three.
   */
  test('puts every modal it opens inside <main>; only the two inerting dialogs sit beside it', async ({
    page,
  }) => {
    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('html[data-tn-level="ready"]');

    const outside = await page.evaluate(() => {
      const main = document.querySelector('main');
      return [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')]
        .filter((node) => main === null || !main.contains(node))
        /* Identity by whatever the element offers: the HUD screens carry a
           `data-testid`, the rotate overlay carries an `id`. Falling through to
           the tag name would make two unrelated `<div>`s indistinguishable in
           the failure message, which is the whole value of this assertion. */
        .map(
          (node) =>
            node.getAttribute('data-testid') ?? node.id ?? node.tagName.toLowerCase(),
        );
    });

    const inside = await page.evaluate(
      () =>
        [
          ...(document.querySelector('main')?.querySelectorAll(
            '[role="dialog"], [role="alertdialog"], dialog',
          ) ?? []),
        ].map((node) => node.getAttribute('data-testid') ?? node.tagName.toLowerCase()),
    );

    expect(
      inside.sort(),
      'no modal was found inside <main>, so this assertion checked nothing',
    ).toEqual([
      'level-error',
      'level-loading',
      'poi-card',
      /* The learning moment: a landmark's card is followed by a question, and
         finishing a level's task by the card that says so. Both are built with
         the level rather than on demand, so a landmark never waits on a screen
         being constructed after the player has read the fact. */
      'quest-complete-card',
      'question-card',
    ]);
    expect(
      /* Sorted: which elements sit outside the landmark is the assertion, and
         the order they are mounted in is a composition detail that moved when
         the front door landed (the rotate overlay is built before any level's
         HUD now, because it belongs to the page and the HUD belongs to a level). */
      outside.sort(),
      `${outside.join(', ')} are mounted outside <main>, so their content sits in no ` +
        'landmark. Only the HUD menu may be there, and only because its focus trap has ' +
        'to inert <main> itself (app/ui/hud.ts, TN-HUD-04).',
    ).toEqual(['menu', 'tn-rotate-overlay']);
  });

  test('shows the error card, in a landmark, naming the level that failed', async ({ page }) => {
    /*
     * A **real** level made to fail, rather than an id nobody wrote a document
     * for. The level document is its own lazily-imported chunk (`level-catalog.ts`
     * globs `content/levels/*.json`), so aborting the request for it is the one
     * way to reach `TN-LEVEL-02`'s failure on the shipped artefact without a
     * test hook in production code.
     *
     * `?level=atlantis` used to be how this test failed a load, and it proved
     * less than it looked: there is no `level.atlantis.error.title`, the card
     * drew one row called `level.error.title` reading "We could not load
     * Ottawa.", and it was right by coincidence because the level in the address
     * was not the level in the sentence. The title is per level now
     * (`TN-WAIT-02`), so the card can be asked to name the level that actually
     * failed.
     */
    await page.route(`**/${LEVEL_ID}-*.js`, (route) => route.abort());
    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('html[data-tn-level="failed"]');

    /* `TN-LEVEL-02`: a level that fails leaves the player something to act on.
       The card is `app/ui`'s; what is asserted here is that bootstrap published
       `level/failed` on the bus, the card heard it, and it was handed this
       level's title. */
    const card = page.getByTestId('level-error');
    await expect(card).toBeVisible();
    await expect(card).toHaveAccessibleName('We could not load Ottawa.');
    await expect(page.locator('main').getByTestId('level-error')).toHaveCount(1);
    /* And the waiting screen is gone rather than sitting behind it. */
    await expect(page.getByTestId('level-loading')).toBeHidden();
  });

  test('takes a link to a level with no document to the level select', async ({ page }) => {
    /*
     * `TN-FLOW-05`: "a deep link to a level that does not exist … no Try again
     * is offered for something that cannot succeed … the player is taken to, or
     * offered, the level select … nothing on the screen blames the player".
     *
     * This used to open a level and show the error card under a title that named
     * Ottawa whatever the address said, because there was one
     * `level.error.title` row in the game. There is no title to draw for a level
     * no document declares and `app/bootstrap` may not invent one (ADR-0010), so
     * the player is taken to a screen they can act on.
     */
    await page.goto('./?level=atlantis');

    await expect(page.getByTestId('level-select')).toBeVisible();
    await expect(page.getByTestId('level-error')).toHaveCount(0);
    await expect(page.getByTestId('level-loading')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-tn-level', /.*/);
    await expect(page.locator('main')).toHaveCount(1);
  });
});
