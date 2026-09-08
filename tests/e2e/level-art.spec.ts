import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

/*
  Imported, not restated: the same selection the game runs at boot. This suite is
  where the *real* `assets/dist/manifest.json` may be read at all — `assets/dist`
  is gitignored build output, and CI's unit job runs before `make assets`, so a
  unit test that opened this file could only ever be green on a machine that had
  already built. `make assets build test-e2e` is one command in one job, so by
  the time this runs the manifest is the one the browser two lines below fetches.
*/
import { parseAssetManifest, selectLevelAssets } from '@adapters/phaser/level-assets';

/**
 * **The assertion that was missing.**
 *
 * The Ottawa level was deployed and every gate was green: forty e2e tests, five
 * perf tests, a hundred and twenty-three a11y tests, the texture-memory gate,
 * the payload gate. And the live page drew **no art whatsoever** — zero image
 * requests in the network log, every parallax band a flat theme-coloured
 * placeholder, `data-tn-level="ready"`, `[data-testid="playable"]` present, no
 * console error.
 *
 * Nothing was broken in a way anything could see. `level-scene.ts` draws a
 * coloured band when `textures.exists(key)` is false, which is correct while art
 * is in flight, and no test asked the one question that separates the two cases:
 * **did a layer draw from a texture, or from a band?** Every test asked whether
 * the scene reached `ready`, and it did.
 *
 * So this file asks it three ways, each of which would have failed on the
 * deployed build:
 *
 *  1. **The network.** A level with art fetches images. Zero image requests is
 *     the raw symptom and the one that is impossible to argue with.
 *  2. **The manifest.** Every texture key `content/levels/ottawa.json` names is
 *     one `assets/dist/manifest.json` provides — read from disk, both sides, so
 *     a rename on either side fails here rather than becoming a coloured band.
 *  3. **The selection.** `selectLevelAssets` — the real function, against the
 *     real manifest — resolves every layer key at both scales. This is the half
 *     that used to live in the unit suite and could not: it needs build output.
 *  4. **The scene's own count.** `data-layers-textured` equals `data-layers`.
 *     This is the durable one: it is a fact the game publishes about itself, so
 *     it keeps working when the assets change, and it distinguishes "drew its
 *     art" from "drew a band" without anybody counting requests.
 *
 * The third is deliberately not phrased as "> 0". A level that drew five of six
 * layers from textures and one from a band would pass that, and one silently
 * missing layer is exactly how this failure would come back at a smaller scale.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEVEL_ID = 'ottawa';

interface LevelFile {
  readonly layers: readonly { readonly key: string }[];
  readonly pois: readonly { readonly artKey?: string; readonly position: { readonly x: number } }[];
  readonly characters: readonly { readonly position: { readonly x: number } }[];
}

interface Manifest {
  readonly files: readonly {
    readonly keys?: readonly string[];
    readonly levels?: readonly string[];
  }[];
}

const level = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${LEVEL_ID}.json`, 'utf8'),
) as LevelFile;

/**
 * Read at first use, never at module scope.
 *
 * `assets/dist/` is build output and it is not always there: `make assets`
 * **empties it before it validates**, so a failure anywhere in the pipeline —
 * today, art's Québec City sources arriving before their level document —
 * leaves the directory bare. Read at module scope, that `ENOENT` is thrown while
 * Playwright is *collecting* the suite, and it takes down all forty-seven tests
 * with a stack trace pointing at a `readFileSync`. Nothing about the boot,
 * locomotion, camera or probe suites depends on the manifest, and they should
 * not disappear because the art pipeline is mid-flight.
 *
 * So it is read here, and the message names the command that produces it.
 */
function readManifest(): { source: unknown; manifest: Manifest } {
  const path = `${REPO_ROOT}assets/dist/manifest.json`;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `${path} is missing, so there is nothing to check the level's art against. It is build ` +
        `output — run \`make assets\`. If that fails, this suite cannot judge the art and says ` +
        `so here rather than reporting a level that draws nothing as fine.`,
    );
  }
  const source: unknown = JSON.parse(text);
  return { source, manifest: source as Manifest };
}

test.describe('the level draws its art', () => {
  test('the manifest provides every texture key the level names', () => {
    const { manifest } = readManifest();
    const provided = new Set(
      manifest.files
        .filter((file) => file.levels?.includes(LEVEL_ID) === true)
        .flatMap((file) => file.keys ?? []),
    );
    const wanted = [
      ...level.layers.map((layer) => layer.key),
      ...level.pois.map((poi) => poi.artKey).filter((key): key is string => key !== undefined),
    ];

    expect(wanted.length, 'the level names no art, so this assertion checks nothing').toBeGreaterThan(
      0,
    );
    expect(
      wanted.filter((key) => !provided.has(key)),
      'the level names a texture key the asset pipeline does not build. It will not 404 — ' +
        'nothing will request it — it will silently draw a placeholder band.',
    ).toEqual([]);
  });

  /* Playwright's `test` has no `.each`; both scales in one body, and the scale
     that failed is named in the message. */
  test('resolves every layer key at both scales, through the real selector', () => {
    const parsed = parseAssetManifest(readManifest().source);
    expect(parsed.ok, parsed.ok ? '' : parsed.error.message).toBe(true);
    if (!parsed.ok) return;

    for (const scale of [1, 2]) {
      const keys = new Set(
        selectLevelAssets(parsed.value, LEVEL_ID, { scale, baseUrl: '/' }).map(
          (request) => request.key,
        ),
      );
      expect(
        level.layers.map((layer) => layer.key).filter((key) => !keys.has(key)),
        `at scale ${String(scale)}, a layer the level draws resolves to no load request, so ` +
          'it will silently draw a flat theme-coloured band. At scale 2 this is also the ' +
          'pinned-asset case: a key with no 2x file must fall back to its 1x, not disappear.',
      ).toEqual([]);
    }
  });

  test('fetches its images, which the deployed build did not do at all', async ({ page }) => {
    const images: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\.(webp|png|avif)(\?|$)/u.test(url)) images.push(url);
    });

    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    expect(
      images.length,
      'the page requested no image at all, so every layer is drawing a coloured band. ' +
        'This is the exact symptom of the deployed build: the assets are on the server ' +
        'and nothing asks for them.',
    ).toBeGreaterThan(0);
  });

  /**
   * The officer, and the Peace Tower.
   *
   * Every character in the game was drawn with `fillRoundedRect` and every point
   * of interest with a rectangle plus a triangle, in production, for as long as
   * anyone looked. The red serge — the reference-critical uniform that was the
   * stated reason Ottawa is the first level — was never on screen, and no gate
   * could see it, because a scene that draws a rectangle reaches `ready` exactly
   * like one that composes twenty parts.
   *
   * `data-actors-drawn` is the count of those that drew real art. Asserted equal
   * to `data-actors`, not `> 0`: one silent placeholder among several is how
   * this comes back at a smaller scale.
   */
  /**
   * **Bookkeeping, and knowing that is all it is.**
   *
   * `data-actors-drawn` counts an actor that was *constructed from a texture*.
   * It does **not** count one that put pixels on the screen, and the difference
   * is not academic: this attribute read `2/2` on a build whose visible output
   * was a gradient, an ice band, snow and one dark rounded rectangle. The level
   * places its officer at x = 2400 and Parliament Hill at x = 5400, and the
   * player spawns at 640 with a 1080-wide window — so both were faithfully
   * "drawn" a thousand pixels off screen.
   *
   * A whole-canvas distinct-colour count does not rescue it either: that empty
   * screen has **865** distinct colours, because a vertical gradient and a few
   * hundred snowflakes are colourful. Two plausible metrics, both green, nothing
   * on screen.
   *
   * So this stays as a **precondition** — construction is necessary — and the
   * test below is the one that decides, by looking at pixels.
   */
  test('constructs every character and point of interest from real art', async ({ page }) => {
    await page.goto(`./?e2e=1&level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', LEVEL_ID);

    const total = Number(await probe.getAttribute('data-actors'));
    const drawn = Number(await probe.getAttribute('data-actors-drawn'));

    expect(total, 'the level places nobody and nothing, so this checks nothing').toBe(
      level.pois.length + level.characters.length,
    );
    expect(
      drawn,
      `${String(total - drawn)} of ${String(total)} actors fell back to a placeholder shape — ` +
        'a rounded rectangle for a character, a rectangle and a triangle for a landmark. That ' +
        'is what shipped, and it reaches "ready" exactly like the real thing. Necessary, and ' +
        'not sufficient: see the pixel test below for why.',
    ).toBe(total);
  });

  /**
   * **The assertion that cannot pass while the screen is empty**, and the
   * honest account of why it is geometry rather than pixels.
   *
   * ### What was wrong with the counter beside it
   *
   * `data-actors-drawn: 2` was true of a build whose visible output was a
   * gradient, an ice band, snow and one dark rounded rectangle. Ottawa places
   * its officer at x = 2400 and Parliament Hill at x = 5400; the player spawns
   * at 640 with a 1080-wide window. Both were drawn perfectly, a long way off to
   * the right. The counter's passing value did not require the outcome
   * (ADR-0024), which is the same defect as `sum([]) === 0` clearing a budget.
   *
   * ### Why this counts screen area instead
   *
   * `data-actors-visible` is a rectangle intersection between each subject's
   * world bounds and the camera's view, so it **moves as the camera moves**.
   * That gives the test a control it can run in the same session: the same
   * counter must read `0` while the officer is off screen and rise once the
   * player has skated to them. A number that is the same whether or not anything
   * worked cannot do that, which is exactly what was wrong before.
   *
   * ### What was tried for the stronger claim, and what it measured
   *
   * "Prove a pixel was lit" was attempted first, by sampling the framebuffer:
   * columns 240 design pixels wide — a character's width — scored by pixels far
   * from a background estimate, and by how many distinct colours those pixels
   * held, with the player's `fillRoundedRect` as a placeholder control in the
   * same frame. At a 1x device scale it separated cleanly: **officer 533
   * distinct ink colours, player 67**. At the 3x this suite runs at it did not,
   * and the reasons are structural rather than tunable:
   *
   *   - a **row-median** baseline breaks on rows split between sky and ground —
   *     near Parliament Hill an empty column scored *more* ink than the landmark
   *     (98 781 against 95 454), because the median of those rows is the ground
   *     and the sky above it reads as something drawn on top;
   *   - a **neighbouring-column** baseline breaks where the ground polyline
   *     slopes, which is exactly where the landmark stands;
   *   - **snow** is animated and random, so it puts a different floor under
   *     every sample.
   *
   * Every fix from there was a threshold, and a threshold tuned until it passes
   * is the failure this project has spent the day removing. So it is not
   * shipped. **What this suite proves is that the art occupies screen area, not
   * that it lit a pixel** — a transparent texture would still count. Closing
   * that gap honestly needs a reference image and a perceptual diff, which is a
   * task with an artefact and a review step, not a statistic.
   */
  test('puts the officer on screen — and reports nothing there when it is not', async ({
    page,
  }) => {
    const officerX = level.characters[0]?.position.x ?? 0;
    expect(officerX, 'the level places no character to look for').toBeGreaterThan(0);

    await page.goto(`./?e2e=1&level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');

    /*
     * The control, and it runs first: at the spawn the officer is 1 760 design
     * pixels away and the landmark 4 760, so nothing is in view. A counter that
     * reported them here would be the one this test replaces.
     */
    const atSpawn = Number(await probe.getAttribute('data-actors-visible'));
    expect(
      atSpawn,
      'the level reports an actor on screen at the spawn, where the level document places ' +
        'none within a screen width. This counter is reporting construction again, not view.',
    ).toBe(0);
    /* And it is not simply stuck at zero: they were built. */
    expect(Number(await probe.getAttribute('data-actors-drawn'))).toBeGreaterThan(0);

    await walkTo(page, officerX - 400);

    const playerX = Number(await probe.getAttribute('data-player-x'));
    expect(
      playerX,
      'the player never reached the officer, so the assertion below never had its subject',
    ).toBeGreaterThan(officerX - 600);
    await expect(
      probe,
      'the player is standing next to the officer and the scene reports nothing on screen',
    ).toHaveAttribute('data-actors-visible', /^[1-9]/u);
  });

  test('draws every authored layer from a texture, not from a placeholder band', async ({
    page,
  }) => {
    await page.goto(`./?e2e=1&level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', LEVEL_ID);

    const total = Number(await probe.getAttribute('data-layers'));
    const textured = Number(await probe.getAttribute('data-layers-textured'));

    expect(total, 'the level authored no layers, so this assertion checks nothing').toBe(
      level.layers.length,
    );
    expect(
      textured,
      `${String(total - textured)} of ${String(total)} parallax layers fell back to a flat ` +
        'theme-coloured band. That fallback is correct while the art is in flight and ' +
        'indistinguishable from success at the level of "the scene reached ready" — which is ' +
        'how a level with no art in it shipped, passed every gate, and was found by loading ' +
        'the live site.',
    ).toBe(total);
  });
});

/** Hold right until the player is at least here, then let the glide settle. */
async function walkTo(page: Page, worldX: number): Promise<void> {
  const probe = page.locator('[data-testid="scene-state"]');
  await page.keyboard.down('ArrowRight');
  for (let tick = 0; tick < 400; tick += 1) {
    if (Number(await probe.getAttribute('data-player-x')) >= worldX) break;
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('ArrowRight');
  /* Skating glides: releasing the key is not stopping, and the assertions are
     about where the camera settles rather than where the key went up. */
  await page.waitForTimeout(1200);
}
